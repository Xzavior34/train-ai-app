import { supabase } from "../supabaseClient.js";

// Public/pre-auth invitation acceptance flow — deliberately kept separate
// from platform.js (which is admin-scoped and documents itself as relying on
// RLS to restrict callers to their own organization). Whoever lands on
// AcceptInvitationScreen may have no session at all yet (a brand-new
// invitee), so these calls must work for anonymous/just-signed-up callers.
//
// Backed by the same DB functions the reference train-ai-ltd-main app uses
// (confirmed by reading supabase/migrations/20260110064047_...sql and
// supabase/functions/{invite-user,accept-invitation}/index.ts):
//   - validate_invitation_token(p_token) — SECURITY DEFINER, GRANTed to
//     anon + authenticated. Returns a table row (not a single object):
//     { invitation_id, email, organization_id, organization_name, role,
//       organization_role, expires_at, is_valid }.
//   - accept_invitation(p_token, p_user_id) — GRANTed to authenticated only;
//     only usable once a Supabase auth user exists for the invited email,
//     which is exactly what the "accept-invitation" edge function handles
//     (creating that user via the service-role admin API when needed) before
//     calling it server-side. There is no way to call this RPC directly from
//     the client for a user that doesn't exist yet, so brand-new invitees
//     always go through the edge function below.

/**
 * Looks up an invitation by its raw token (the ?invite=TOKEN value). Works
 * whether or not the caller is signed in.
 * Returns null if the token doesn't resolve to any row at all, otherwise the
 * row as returned by validate_invitation_token (check `.is_valid`).
 */
export async function validateInvitationToken(token) {
  if (!supabase || !token) return null;
  const { data, error } = await supabase.rpc("validate_invitation_token", { p_token: token });
  if (error) throw error;
  if (!data || !data.length) return null;
  return data[0];
}

// FunctionsHttpError (thrown by supabase-js when an edge function responds
// with a non-2xx status) exposes the raw Response on `.context` — this is
// the only way to read the structured `{ error, requires_signup, email,
// organization_name, role }` body the accept-invitation function sends back
// for the "this is a new user, we need a password" case (HTTP 400).
async function readFunctionErrorBody(error) {
  try {
    if (error?.context?.json) return await error.context.json();
  } catch {
    // context body already consumed / not JSON — fall through
  }
  return null;
}

/**
 * Calls the live "accept-invitation" edge function.
 *
 * First call (no password): if the invited email already has an account,
 * the function adds it to the org and returns { success: true, is_new_user:
 * false, user_id, organization_id, role }. If the email has no account yet,
 * it responds 400 with { requires_signup: true, email, organization_name,
 * role } instead of failing — the caller should re-render a signup form and
 * call this again with `password` (and optionally `displayName`) filled in.
 *
 * Returns a normalized shape so callers never have to branch on HTTP status:
 *   { ok: true, isNewUser, userId, organizationId, role, message }
 *   { ok: false, requiresSignup: true, email, organizationName, role }
 *   { ok: false, requiresSignup: false, message }
 */
export async function acceptInvitation({ token, password, displayName } = {}) {
  if (!supabase) return { ok: false, requiresSignup: false, message: "Not available right now." };
  if (!token) return { ok: false, requiresSignup: false, message: "Missing invitation token." };

  const { data, error } = await supabase.functions.invoke("accept-invitation", {
    body: { token, password: password || undefined, display_name: displayName || undefined },
  });

  if (error) {
    const body = await readFunctionErrorBody(error);
    if (body?.requires_signup) {
      return {
        ok: false,
        requiresSignup: true,
        email: body.email,
        organizationName: body.organization_name,
        role: body.role,
      };
    }
    return { ok: false, requiresSignup: false, message: body?.error || error.message || "Failed to accept invitation." };
  }

  // The edge function returns 200 with { success: false, error } on some
  // validation failures (e.g. token already used) rather than a non-2xx —
  // handle that shape too instead of assuming `error` covers every failure.
  if (data && data.success === false) {
    return { ok: false, requiresSignup: !!data.requires_signup, message: data.error || "Failed to accept invitation." };
  }

  return {
    ok: true,
    isNewUser: !!data?.is_new_user,
    userId: data?.user_id,
    organizationId: data?.organization_id,
    role: data?.role,
    message: data?.message,
  };
}
