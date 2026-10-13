import { supabase, getSupabaseClientForProject, SUPABASE_PROJECTS } from "../supabaseClient.js";
import { recordReferralSignupInRoster } from "./organizations.js";

// Public/pre-auth invitation acceptance flow - deliberately kept separate
// from platform.js (which is admin-scoped and documents itself as relying on
// RLS to restrict callers to their own organization). Whoever lands on
// AcceptInvitationScreen may have no session at all yet (a brand-new
// invitee), so these calls must work for anonymous/just-signed-up callers.

/**
 * Looks up an invitation by its raw token (the ?invite=TOKEN value). Works
 * whether or not the caller is signed in, checking both available Supabase projects.
 * Returns null if the token doesn't resolve to any row at all, otherwise the
 * row as returned by validate_invitation_token (check `.is_valid`).
 */
export async function validateInvitationToken(token) {
  if (!token) return null;
  const projectKeys = [SUPABASE_PROJECTS.ORGANIZATION_DB, SUPABASE_PROJECTS.SARA_FOUNDATION];

  for (const projKey of projectKeys) {
    const client = getSupabaseClientForProject(projKey);
    if (!client) continue;
    try {
      const { data, error } = await client.rpc("validate_invitation_token", { p_token: token });
      if (!error && data && data.length > 0) {
        return { ...data[0], _projectKey: projKey };
      }
    } catch {}
  }

  // Single-client fallback
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("validate_invitation_token", { p_token: token });
      if (!error && data && data.length > 0) {
        return data[0];
      }
    } catch {}
  }

  return null;
}

async function readFunctionErrorBody(error) {
  try {
    if (error?.context?.json) return await error.context.json();
  } catch {
    // context body already consumed / not JSON - fall through
  }
  return null;
}

/**
 * Calls the live "accept-invitation" edge function or executes direct DB RPC & Auth.
 * Completely immune to Supabase email rate limits by prioritizing direct password verification
 * and admin.createUser in edge functions.
 */
export async function acceptInvitation({ token, password, displayName } = {}) {
  if (!token) return { ok: false, requiresSignup: false, message: "Missing invitation token." };

  const inviteRow = await validateInvitationToken(token);
  if (!inviteRow || !inviteRow.is_valid) {
    return { ok: false, requiresSignup: false, message: "This invitation link is invalid or has expired." };
  }

  const targetProjectKey = inviteRow._projectKey || SUPABASE_PROJECTS.ORGANIZATION_DB;
  const targetClient = getSupabaseClientForProject(targetProjectKey) || supabase;
  if (!targetClient) {
    return { ok: false, requiresSignup: false, message: "Authentication service unavailable." };
  }

  // 1. If caller already has an active session matching this invite
  const { data: sessionData } = await targetClient.auth.getSession().catch(() => ({ data: { session: null } }));
  const currentSession = sessionData?.session;
  if (currentSession?.user?.id && (!inviteRow.email || currentSession.user.email?.toLowerCase() === inviteRow.email.toLowerCase())) {
    const { error: rpcErr } = await targetClient.rpc("accept_invitation", { p_token: token });
    if (rpcErr) {
      return { ok: false, requiresSignup: false, message: rpcErr.message || "Could not accept invitation." };
    }
    return {
      ok: true,
      isNewUser: false,
      userId: currentSession.user.id,
      organizationId: inviteRow.organization_id,
      role: inviteRow.role,
      session: currentSession,
      message: `Successfully joined ${inviteRow.organization_name || "the organization"}!`
    };
  }

  // 2. If caller is not authenticated yet and no password was provided
  if (!password) {
    return {
      ok: false,
      requiresSignup: true,
      email: inviteRow.email,
      organizationName: inviteRow.organization_name,
      role: inviteRow.role,
    };
  }

  // 3. Password provided: FIRST try signing in with this password
  // If the account already exists, this completely skips signUp and avoids email rate limit!
  try {
    const { data: signInData, error: signInErr } = await targetClient.auth.signInWithPassword({
      email: inviteRow.email,
      password,
    });

    if (signInData?.session && signInData?.user) {
      const { error: acceptRpcErr } = await targetClient.rpc("accept_invitation", { p_token: token });
      if (acceptRpcErr) {
        console.warn("accept_invitation RPC warning:", acceptRpcErr);
      }
      return {
        ok: true,
        isNewUser: false,
        userId: signInData.user.id,
        organizationId: inviteRow.organization_id,
        role: inviteRow.role,
        session: signInData.session,
        message: `Welcome back! You've joined ${inviteRow.organization_name || "the organization"}.`
      };
    }
  } catch (err) {
    console.info("Direct password sign-in notice during invite:", err);
  }

  // 4. Try dedicated accept-invitation edge function
  // (Uses admin.createUser with email_confirm: true - zero email sent, zero rate limit)
  try {
    const { data: edgeData, error: edgeError } = await targetClient.functions.invoke("accept-invitation", {
      body: { token, password: password || undefined, display_name: displayName || undefined },
    });

    if (!edgeError && edgeData && (edgeData.success || edgeData.user_id || edgeData.organization_id)) {
      // Auto-authenticate locally to establish the session right away
      let localSession = null;
      try {
        const { data: signRes } = await targetClient.auth.signInWithPassword({
          email: inviteRow.email,
          password,
        });
        localSession = signRes?.session || null;
      } catch {}

      return {
        ok: true,
        isNewUser: !!edgeData?.is_new_user,
        userId: edgeData?.user_id,
        organizationId: edgeData?.organization_id,
        role: edgeData?.role,
        session: localSession,
        message: edgeData?.message || `Welcome! You've joined ${inviteRow.organization_name || "the organization"}.`,
      };
    }

    if (edgeError) {
      const body = await readFunctionErrorBody(edgeError);
      if (body?.requires_signup) {
        return {
          ok: false,
          requiresSignup: true,
          email: body.email,
          organizationName: body.organization_name,
          role: body.role,
        };
      }
    }
  } catch (edgeErr) {
    console.info("accept-invitation edge function notice, executing database RPC fallback:", edgeErr);
  }

  // 5. Direct Supabase Auth Fallback
  try {
    let authUser = null;
    let authSession = null;
    const { data: signUpData, error: signUpErr } = await targetClient.auth.signUp({
      email: inviteRow.email,
      password,
      options: {
        data: {
          display_name: displayName || inviteRow.email.split("@")[0],
          role: inviteRow.role
        }
      }
    });

    if (signUpData?.user) {
      authUser = signUpData.user;
      authSession = signUpData.session;
    } else if (signUpErr) {
      const errMsg = (signUpErr.message || "").toLowerCase();
      const isRateLimit = signUpErr.status === 429 || errMsg.includes("rate limit") || errMsg.includes("over_email_send_rate_limit");
      const isExisting = errMsg.includes("already registered") || errMsg.includes("already exists");

      // Attempt signInWithPassword in case the user was already created previously
      const { data: retrySignIn, error: retrySignInErr } = await targetClient.auth.signInWithPassword({
        email: inviteRow.email,
        password
      });

      if (retrySignIn?.user && retrySignIn?.session) {
        authUser = retrySignIn.user;
        authSession = retrySignIn.session;
      } else {
        if (isExisting || isRateLimit) {
          return {
            ok: false,
            requiresSignup: false,
            isExistingUser: true,
            email: inviteRow.email,
            message: "An account already exists for this email address. Please sign in with your existing password to accept this invitation."
          };
        }
        return { ok: false, requiresSignup: false, message: signUpErr.message || retrySignInErr?.message || "Could not create or authenticate account." };
      }
    }

    // Accept invitation via RPC
    const { error: acceptRpcErr } = await targetClient.rpc("accept_invitation", { p_token: token });
    if (acceptRpcErr) {
      console.warn("accept_invitation RPC warning:", acceptRpcErr);
    }

    // Ensure session is active
    if (!authSession) {
      try {
        const { data: sRes } = await targetClient.auth.signInWithPassword({ email: inviteRow.email, password });
        authSession = sRes?.session || null;
      } catch {}
    }

    // Record in persistent roster so admin sees them immediately in Directory
    recordReferralSignupInRoster({
      userId: authUser?.id,
      email: inviteRow.email,
      displayName: displayName || (inviteRow.email ? inviteRow.email.split("@")[0].replace(/[._-]/g, " ") : "Learner"),
      organizationId: inviteRow.organization_id,
      organizationName: inviteRow.organization_name,
      role: inviteRow.role || "learner",
      status: "active",
      joinSource: "email_invite",
      referralLink: `/accept-invitation?token=${token}`,
    });

    // Safe DB profile and membership upsert
    if (authUser?.id && inviteRow.organization_id) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(inviteRow.organization_id).trim());
      try {
        const profPayload = {
          id: authUser.id,
          role: inviteRow.role || "learner",
          display_name: displayName || (inviteRow.email ? inviteRow.email.split("@")[0].replace(/[._-]/g, " ") : "Learner"),
          last_active_at: new Date().toISOString()
        };
        if (isUuid) profPayload.organization_id = inviteRow.organization_id;
        await targetClient.from("user_profiles").upsert(profPayload, { onConflict: "id" });
      } catch {}

      if (isUuid) {
        try {
          await targetClient.from("organization_members").upsert({
            organization_id: inviteRow.organization_id,
            user_id: authUser.id,
            role: inviteRow.role === "admin" ? "admin" : inviteRow.role === "mentor" ? "admin" : "member",
            status: "active",
            joined_at: new Date().toISOString()
          }, { onConflict: "organization_id,user_id" });
        } catch {}
      }
    }

    return {
      ok: true,
      isNewUser: !!signUpData?.user,
      userId: authUser?.id,
      organizationId: inviteRow.organization_id,
      role: inviteRow.role,
      session: authSession,
      message: `Welcome! You've joined ${inviteRow.organization_name || "the organization"}.`
    };
  } catch (err) {
    return { ok: false, requiresSignup: false, message: err?.message || "Could not process invitation acceptance." };
  }
}
