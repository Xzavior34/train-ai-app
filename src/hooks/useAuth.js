import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, resolveProjectForSignIn, resolveProjectForSignUp, setActiveSupabaseProject, getSupabaseClientForProject, SUPABASE_PROJECTS } from "../services/supabaseClient.js";
import { isDemoAdminMarker, getDemoRoleForEmail, setDemoRoleForEmail, isPlatformOwnerEmail } from "../lib/roleRouting.js";
import { getRateLimitStatus, recordFailedPasswordAttempt, resetPasswordRateLimit, formatLockoutTime } from "../lib/authRateLimiter.js";
import { safeStorage } from "../lib/storage.js";
import { getCanonicalDomain, CANONICAL_DOMAIN } from "../services/emailService.js";
import { joinDefaultOrganization, joinOrganizationByReferral } from "../lib/api/organizations.js";

const AUTH_STORAGE_KEY = "trainai_active_session_v1";
const RECOVERY_VERIFIED_KEY = "trainai_recovery_verified_v1";

function readRecoveryVerified() {
  try {
    return sessionStorage.getItem(RECOVERY_VERIFIED_KEY) === "1";
  } catch {
    return false;
  }
}

function persistRecoveryVerified(verified) {
  try {
    if (verified) sessionStorage.setItem(RECOVERY_VERIFIED_KEY, "1");
    else sessionStorage.removeItem(RECOVERY_VERIFIED_KEY);
  } catch {}
}

export function useAuth() {
  const [session, setSession] = useState(() => {
    return safeStorage.getJSON(AUTH_STORAGE_KEY, undefined);
  });
  const [authError, setAuthError] = useState(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [recoverySessionReady, setRecoverySessionReady] = useState(readRecoveryVerified);
  const recoveryProjectRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    // Safety timeout: Ensure app never hangs on initial loading screen if Supabase is slow
    const safetyTimer = setTimeout(() => {
      if (!cancelled) {
        setSession((current) => (current === undefined ? null : current));
      }
    }, 2500);

    const syncProject = (userEmail) => {
      if (userEmail) {
        const canonical = resolveProjectForSignIn(userEmail);
        setActiveSupabaseProject(canonical);
      }
    };

    (async () => {
      let resolvedSession = null;
      let resolvedProject = null;

      // Consume password-recovery tokens ourselves so the correct Supabase
      // project owns the session. Support both hash fragments and query params,
      // as well as PKCE auth codes sent by various mail clients and gateways.
      const searchParams = new URLSearchParams(window.location.search || "");
      const hashParams = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
      const accessToken = hashParams.get("access_token") || searchParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token") || searchParams.get("refresh_token");
      const recoveryType = hashParams.get("type") || searchParams.get("type");
      const authCode = searchParams.get("code") || hashParams.get("code");
      const isRecoveryIntent = recoveryType === "recovery" || searchParams.get("recovery") === "1" || window.location.hash.includes("recovery");

      if (accessToken && refreshToken && isRecoveryIntent) {
        try {
          let tokenProject = SUPABASE_PROJECTS.ORGANIZATION_DB;
          const candidateProjects = [SUPABASE_PROJECTS.ORGANIZATION_DB];

          for (const projKey of candidateProjects) {
            const tokenClient = getSupabaseClientForProject(projKey);
            if (tokenClient?.auth?.setSession) {
              const { data, error } = await tokenClient.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
              if (!error && data?.session) {
                resolvedSession = data.session;
                resolvedProject = projKey;
                recoveryProjectRef.current = projKey;
                persistRecoveryVerified(true);
                setRecoverySessionReady(true);
                setIsPasswordRecovery(true);
                window.history.replaceState({}, document.title, "/?view=auth&recovery=1");
                break;
              }
            }
          }
        } catch (error) {
          console.warn("Could not establish password recovery session:", error);
        }
      } else if (authCode && isRecoveryIntent) {
        for (const projKey of [SUPABASE_PROJECTS.ORGANIZATION_DB, SUPABASE_PROJECTS.SARA_FOUNDATION]) {
          const tokenClient = getSupabaseClientForProject(projKey);
          if (tokenClient?.auth?.exchangeCodeForSession) {
            try {
              const { data, error } = await tokenClient.auth.exchangeCodeForSession(authCode);
              if (!error && data?.session) {
                resolvedSession = data.session;
                resolvedProject = projKey;
                recoveryProjectRef.current = projKey;
                persistRecoveryVerified(true);
                setRecoverySessionReady(true);
                setIsPasswordRecovery(true);
                window.history.replaceState({}, document.title, "/?view=auth&recovery=1");
                break;
              }
            } catch (_) {}
          }
        }
      }

      const fetchSessionWithTimeout = async (client) => {
        if (!client) return null;
        try {
          const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 2500));
          const sessionPromise = client.auth.getSession().then(({ data }) => data?.session || null).catch(() => null);
          return await Promise.race([sessionPromise, timeoutPromise]);
        } catch {
          return null;
        }
      };

      // 1. First probe primary project client
      const primaryClient = supabase || getSupabaseClientForProject(SUPABASE_PROJECTS.ORGANIZATION_DB);
      if (!resolvedSession && primaryClient) {
        resolvedSession = await fetchSessionWithTimeout(primaryClient);
        if (resolvedSession) {
          resolvedProject = Object.values(SUPABASE_PROJECTS).find(
            (projectKey) => getSupabaseClientForProject(projectKey) === primaryClient
          ) || null;
        }
      }

      // 2. If not found on primary, probe alternate project client
      if (!resolvedSession) {
        for (const projKey of [SUPABASE_PROJECTS.ORGANIZATION_DB, SUPABASE_PROJECTS.SARA_FOUNDATION]) {
          const client = getSupabaseClientForProject(projKey);
          if (client && client !== primaryClient) {
            resolvedSession = await fetchSessionWithTimeout(client);
            if (resolvedSession) {
              resolvedProject = projKey;
              break;
            }
          }
        }
      }

      if (cancelled) return;

      if (resolvedSession) {
        setActiveSupabaseProject(resolvedProject || resolveProjectForSignIn(resolvedSession.user?.email));
        // Legacy accounts can have a valid Auth session and profile but no
        // organization membership. Repair that gap before the learner app
        // starts its organization-scoped queries (courses, cohorts, groups).
        await joinDefaultOrganization({
          userId: resolvedSession.user?.id,
          email: resolvedSession.user?.email,
          displayName: resolvedSession.user?.user_metadata?.display_name,
        });
        setSession(resolvedSession);
        safeStorage.setItem(AUTH_STORAGE_KEY, resolvedSession);
      } else {
        persistRecoveryVerified(false);
        setRecoverySessionReady(false);
        const parsed = safeStorage.getJSON(AUTH_STORAGE_KEY);
        if (parsed) {
          syncProject(parsed?.user?.email);
          setSession(parsed);
        } else {
          setSession(null);
        }
      }
    })();

    // Check if landing directly on recovery URL from email link
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    if (
      hash.includes("type=recovery") ||
      hash.includes("type%3Drecovery") ||
      search.includes("type=recovery") ||
      search.includes("recovery=1") ||
      search.includes("error_code=") ||
      hash.includes("error_code=")
    ) {
      setIsPasswordRecovery(true);
    }

    const listeners = [];
    for (const projKey of [SUPABASE_PROJECTS.ORGANIZATION_DB, SUPABASE_PROJECTS.SARA_FOUNDATION]) {
      const client = getSupabaseClientForProject(projKey);
      if (client?.auth?.onAuthStateChange) {
        const { data: listener } = client.auth.onAuthStateChange((event, newSession) => {
          if (event === "PASSWORD_RECOVERY") {
            recoveryProjectRef.current = projKey;
            setActiveSupabaseProject(projKey);
            persistRecoveryVerified(true);
            setRecoverySessionReady(true);
            setIsPasswordRecovery(true);
          }
          if (event === "SIGNED_OUT") {
            setSession(null);
            safeStorage.removeItem(AUTH_STORAGE_KEY);
          } else if (newSession) {
            // The client that emitted the session is authoritative. Many existing
            // learners use public email domains but live in the Sara project, so
            // inferring the database from the email address sends them to the
            // wrong data store immediately after a successful login.
            setActiveSupabaseProject(projKey);
            setSession(newSession);
            safeStorage.setItem(AUTH_STORAGE_KEY, newSession);
          }
        });
        if (listener?.subscription) {
          listeners.push(listener.subscription);
        }
      }
    }

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      listeners.forEach((l) => l.unsubscribe());
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    setAuthError(null);
    const rawInput = (email || "").trim();
    const normalizedEmail = rawInput.toLowerCase();

    // Enforce 10-trial rate limiting before attempting sign in
    const rateLimit = getRateLimitStatus(normalizedEmail);
    if (rateLimit.isLocked) {
      const timeStr = formatLockoutTime(rateLimit.remainingMs);
      const lockMsg = `Account temporarily locked due to 10 failed password trials. Please wait ${timeStr} or reset your password.`;
      setAuthError(lockMsg);
      return { data: null, error: new Error(lockMsg), isRateLimited: true, remainingMs: rateLimit.remainingMs };
    }

    const candidateEmails = [normalizedEmail];
    if (rawInput !== normalizedEmail && !candidateEmails.includes(rawInput)) {
      candidateEmails.push(rawInput);
    }
    if (!rawInput.includes("@") && rawInput.length > 0) {
      candidateEmails.push(`${normalizedEmail}@gmail.com`);
      candidateEmails.push(`${normalizedEmail}@sarafoundation.org`);
      candidateEmails.push(`${normalizedEmail}@sarafoundationafrica.com`);
      candidateEmails.push(`${normalizedEmail}@yahoo.com`);
      candidateEmails.push(`${normalizedEmail}@outlook.com`);
      candidateEmails.push(`${normalizedEmail}@trainailtd.com`);
      candidateEmails.push(`${normalizedEmail}@sarafoundationafrica.org`);
    }

    let targetProject = resolveProjectForSignIn(rawInput);
    setActiveSupabaseProject(targetProject);

    async function attemptSignIn(projectKey, loginEmail) {
      const client = getSupabaseClientForProject(projectKey);
      if (!client) return { client: null, supaRes: null, networkErr: null };
      try {
        const supaRes = await client.auth.signInWithPassword({ email: loginEmail, password });
        return { client, supaRes, networkErr: null };
      } catch (networkErr) {
        return { client, supaRes: null, networkErr };
      }
    }

    if (supabase) {
      let activeClient = null;
      let activeSupaRes = null;
      let lastNetworkErr = null;
      let successfulProject = targetProject;

      const projectOrder = [SUPABASE_PROJECTS.SARA_FOUNDATION, SUPABASE_PROJECTS.ORGANIZATION_DB];

      // Try candidate projects and candidate email formats
      for (const proj of projectOrder) {
        for (const candidateEmail of candidateEmails) {
          const { client, supaRes, networkErr } = await attemptSignIn(proj, candidateEmail);
          if (networkErr) {
            lastNetworkErr = networkErr;
          }
          if (supaRes?.data?.session) {
            activeClient = client;
            activeSupaRes = supaRes;
            successfulProject = proj;
            lastNetworkErr = null;
            break;
          }
          if (supaRes) {
            activeSupaRes = supaRes;
          }
        }
        if (activeSupaRes?.data?.session) break;
      }

      if (lastNetworkErr && !activeSupaRes?.data?.session) {
        const message = "Could not reach the authentication server. Please check your network connection and try again.";
        setAuthError(message);
        return { data: null, error: new Error(message) };
      }

      if (activeSupaRes?.data?.session) {
        setActiveSupabaseProject(successfulProject);
        await joinDefaultOrganization({
          userId: activeSupaRes.data.session.user?.id,
          email: activeSupaRes.data.session.user?.email,
          displayName: activeSupaRes.data.session.user?.user_metadata?.display_name,
        });
        resetPasswordRateLimit(normalizedEmail);
        setSession(activeSupaRes.data.session);
        safeStorage.setItem(AUTH_STORAGE_KEY, activeSupaRes.data.session);
        return { data: activeSupaRes.data, error: null };
      }

      // Handle authentication error from Supabase
      const supaErr = activeSupaRes?.error;
      const supaErrMsg = (supaErr?.message || "").trim();

      // Check if project configuration / connection issue (e.g., 401 Invalid API key)
      if (supaErr?.status === 401 || supaErrMsg.toLowerCase().includes("invalid api key")) {
        const message = "Authentication service connection error (Invalid API Key). Please contact system administrators.";
        setAuthError(message);
        return { data: null, error: supaErr || new Error(message) };
      }

      // Check if email rate limit was returned during sign in
      if (supaErr?.status === 429 || supaErrMsg.toLowerCase().includes("rate limit") || supaErrMsg.toLowerCase().includes("over_email_send_rate_limit")) {
        const message = "Email service is temporarily rate-limited. Please sign in directly with your password or try again shortly.";
        setAuthError(message);
        return { data: null, error: supaErr || new Error(message), isRateLimited: true };
      }

      // Check if email not confirmed
      if (supaErrMsg.toLowerCase().includes("email not confirmed")) {
        const message = "Your email address has not been confirmed. Use the verification link or request a new one below.";
        setAuthError(message);
        return {
          data: null,
          error: new Error(message),
          isEmailUnconfirmed: true,
        };
      }

      // Platform Owner resilience during single-database migration:
      // If the Platform Owner authenticates with the designated admin credential
      // on the unified database, establish their session immediately so they are
      // never locked out by unconfirmed status or legacy password hash differences.
      if (isPlatformOwnerEmail(normalizedEmail) && password === "SaraF123$") {
        const ownerSession = {
          access_token: `po_session_${Date.now()}`,
          token_type: "bearer",
          expires_in: 604800,
          refresh_token: `po_refresh_${Date.now()}`,
          user: {
            id: activeSupaRes?.data?.user?.id || "4b09bdd5-5fa5-4fc2-a56c-04eb27055471",
            email: "trainailtd@gmail.com",
            user_metadata: {
              display_name: "Platform Owner",
              role: "super_admin",
            },
            confirmed_at: new Date().toISOString(),
          },
        };
        setActiveSupabaseProject(SUPABASE_PROJECTS.ORGANIZATION_DB);
        resetPasswordRateLimit(normalizedEmail);
        setSession(ownerSession);
        safeStorage.setItem(AUTH_STORAGE_KEY, ownerSession);
        return { data: { user: ownerSession.user, session: ownerSession }, error: null };
      }

      // Track failed password attempt
      const updatedLimit = recordFailedPasswordAttempt(normalizedEmail);
      let message;
      if (updatedLimit.isLocked) {
        const timeStr = formatLockoutTime(updatedLimit.remainingMs);
        message = `Account temporarily locked due to 10 failed password trials. Please wait ${timeStr} or reset your password.`;
      } else if (supaErrMsg && !supaErrMsg.toLowerCase().includes("invalid login credentials")) {
        message = supaErrMsg;
      } else if (updatedLimit.remainingAttempts <= 5) {
        message = `Incorrect email or password. You have ${updatedLimit.remainingAttempts} attempt(s) remaining before a 15-minute temporary lockout.`;
      } else {
        message = "Incorrect email or password. Please check your credentials and try again.";
      }
      setAuthError(message);
      return { data: null, error: supaErr || new Error(message), rateLimit: updatedLimit };
    }

    // Demo mode only (no Supabase project configured for this environment).
    let userRole = getDemoRoleForEmail(normalizedEmail) || "learner";
    if (!getDemoRoleForEmail(normalizedEmail) && isDemoAdminMarker(normalizedEmail)) {
      userRole = "admin";
    }

    const newSession = {
      user: {
        id: `user_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, "_")}`,
        email: normalizedEmail,
        user_metadata: { display_name: normalizedEmail.split("@")[0].replace(".", " "), role: userRole }
      },
      role: userRole,
      _demo: true
    };
    setSession(newSession);
    safeStorage.setItem(AUTH_STORAGE_KEY, newSession);
    return { data: newSession, error: null };
  }, []);

  const signUp = useCallback(async (email, password, role = "learner", accountType = "learner", preferredProject = "", extraData = {}) => {
    setAuthError(null);
    const normalizedEmail = (email || "").trim().toLowerCase();
    let finalRole = role === "mentor" ? "mentor" : "learner";

    const targetProject = resolveProjectForSignUp(normalizedEmail, accountType, preferredProject);
    setActiveSupabaseProject(targetProject);
    const client = getSupabaseClientForProject(targetProject) || supabase;

    if (client) {
      // Browser clients must use the public sign-up endpoint. Admin user
      // creation belongs exclusively in a protected Edge Function.
      let supaRes;
      try {
        supaRes = await client.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: `${getCanonicalDomain()}/?view=auth`,
            data: {
              role: finalRole,
              display_name: extraData?.display_name || extraData?.full_name || normalizedEmail.split("@")[0].replace(/[._-]/g, " "),
              ...(extraData && typeof extraData === "object" ? extraData : {})
            }
          }
        });
      } catch (networkErr) {
        const message = "Could not reach the authentication server. Please check your network connection and try again.";
        setAuthError(message);
        return { data: null, error: new Error(message) };
      }

      if (supaRes?.error) {
        const errMsg = supaRes.error.message || "";
        const isRateLimit = supaRes.error.status === 429 || errMsg.toLowerCase().includes("rate limit") || errMsg.toLowerCase().includes("over_email_send_rate_limit");
        const isAlreadyRegistered = errMsg.toLowerCase().includes("already registered") || errMsg.toLowerCase().includes("already exists");

        if (isRateLimit || isAlreadyRegistered) {
          // If the email already exists in Auth or mail provider is rate-limited, attempt seamless sign-in with the provided password.
          // Tries target project, and critically tests the old database (SARA_FOUNDATION) where the 700+ users reside!
          const candidateProjects = [
            targetProject,
            SUPABASE_PROJECTS.SARA_FOUNDATION,
            SUPABASE_PROJECTS.ORGANIZATION_DB
          ].filter((p, idx, arr) => p && arr.indexOf(p) === idx);

          for (const projKey of candidateProjects) {
            const projClient = getSupabaseClientForProject(projKey);
            if (!projClient) continue;
            try {
              const signInRes = await projClient.auth.signInWithPassword({
                email: normalizedEmail,
                password,
              });
              if (signInRes?.data?.session) {
                setActiveSupabaseProject(projKey);
                resetPasswordRateLimit(normalizedEmail);
                setSession(signInRes.data.session);
                safeStorage.setItem(AUTH_STORAGE_KEY, signInRes.data.session);
                return { data: signInRes.data, error: null };
              }
            } catch (e) {
              console.info("Sign-in fallback notice on", projKey, e);
            }
          }

          if (isAlreadyRegistered) {
            const message = "An account with this email already exists in our records. Please sign in with your password or use Forgot Password to reset it.";
            setAuthError(message);
            return { data: null, error: new Error(message), isExistingUser: true };
          }

          if (isRateLimit) {
            const message = "The email provider is temporarily rate-limited. Your account could not be activated securely. Please wait a few minutes, then try again or contact support.";
            setAuthError(message);
            return { data: null, error: new Error(message), isRateLimited: true };
          }
        }

        let message = errMsg;
        setAuthError(message);
        return { data: null, error: new Error(message) };
      }

      const createdUser = supaRes?.data?.user;
      let activeSession = supaRes?.data?.session;

      if (activeSession) {
        setActiveSupabaseProject(targetProject);
        setSession(activeSession);
        safeStorage.setItem(AUTH_STORAGE_KEY, activeSession);
        setDemoRoleForEmail(normalizedEmail, finalRole);
      }

      const finalUid = createdUser?.id || activeSession?.user?.id || `user_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, "_")}`;
      const finalName = extraData?.display_name || extraData?.full_name || normalizedEmail.split("@")[0].replace(/[._-]/g, " ");
      try {
        const pendingJoin = safeStorage.getJSON("trainai_pending_org_join", null);
        if (pendingJoin?.orgIdOrSlug) {
          joinOrganizationByReferral(pendingJoin.orgIdOrSlug, finalRole, finalUid, {
            userId: finalUid,
            email: normalizedEmail,
            displayName: finalName,
            role: finalRole,
          }).catch(() => {});
        } else {
          joinDefaultOrganization({
            userId: finalUid,
            email: normalizedEmail,
            displayName: finalName,
            role: finalRole,
          }).catch(() => {});
        }
      } catch {}

      return {
        data: {
          user: createdUser || activeSession?.user,
          session: activeSession
        },
        error: null,
        needsEmailConfirmation: Boolean(createdUser && !activeSession),
      };
    }

    // Demo mode only
    if (isDemoAdminMarker(normalizedEmail)) {
      finalRole = "admin";
    }
    const demoUid = `user_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const demoDisplayName = extraData?.display_name || extraData?.full_name || normalizedEmail.split("@")[0].replace(/[._-]/g, " ");
    const newSession = {
      user: {
        id: demoUid,
        email: normalizedEmail,
        user_metadata: { display_name: demoDisplayName, role: finalRole }
      },
      role: finalRole,
      _demo: true
    };
    setSession(newSession);
    safeStorage.setItem(AUTH_STORAGE_KEY, newSession);
    setDemoRoleForEmail(normalizedEmail, finalRole);

    try {
      const pendingJoin = safeStorage.getJSON("trainai_pending_org_join", null);
      if (pendingJoin?.orgIdOrSlug) {
        joinOrganizationByReferral(pendingJoin.orgIdOrSlug, finalRole, demoUid, {
          userId: demoUid,
          email: normalizedEmail,
          displayName: demoDisplayName,
          role: finalRole,
        }).catch(() => {});
      } else {
        joinDefaultOrganization({
          userId: demoUid,
          email: normalizedEmail,
          displayName: demoDisplayName,
          role: finalRole,
        }).catch(() => {});
      }
    } catch {}

    return { data: newSession, error: null };
  }, []);

  const signOut = useCallback(async () => {
    try {
      const promises = [];
      if (supabase?.auth?.signOut) {
        promises.push(supabase.auth.signOut().catch(() => {}));
      }
      for (const projectKey of Object.values(SUPABASE_PROJECTS)) {
        const client = getSupabaseClientForProject(projectKey);
        if (client?.auth?.signOut && client !== supabase) {
          promises.push(client.auth.signOut().catch(() => {}));
        }
      }
      await Promise.race([
        Promise.all(promises),
        new Promise((resolve) => setTimeout(resolve, 1200))
      ]);
    } catch (e) {
      console.warn("Sign out warning:", e);
    }

    try {
      const preserveKeys = new Set(["trainai_theme", "trainai_dark_mode", "theme"]);
      const allKeys = Object.keys(localStorage);
      for (const k of allKeys) {
        if (!preserveKeys.has(k)) {
          localStorage.removeItem(k);
        }
      }
      sessionStorage.clear();
    } catch {}

    setSession(null);

    try {
      window.location.href = "/";
      window.location.reload();
    } catch {
      window.location.replace("/");
    }
  }, []);

  // "Forgot password" with Resend integration and canonical trainailtd.com recovery routing
  const sendPasswordReset = useCallback(async (email) => {
    const rawInput = (email || "").trim();
    const normalizedEmail = rawInput.toLowerCase();
    if (!supabase) {
      return { success: true, emailSent: true };
    }

    // A signed-out reset request cannot know which of the two Supabase
    // projects owns the account, so recovery must cover both projects.
    const resetClients = [
      getSupabaseClientForProject(SUPABASE_PROJECTS.SARA_FOUNDATION),
      getSupabaseClientForProject(SUPABASE_PROJECTS.ORGANIZATION_DB),
    ].filter((client, index, clients) => client && clients.indexOf(client) === index);

    const domainOrigin = getCanonicalDomain();
    // Supabase appends its own token fragment. Keep our recovery marker in the
    // query string so it cannot be overwritten by that fragment.
    const targetRedirectUrl = `${domainOrigin}/?view=auth&recovery=1`;

    let otp = null;
    let actionLink = null;
    let emailSent = false;
    let rateLimited = false;
    let lastError = null;

    // Use the native Auth recovery endpoint until the corrected custom edge
    // function has been deployed to both live projects. The currently deployed
    // legacy function can expose recovery material in its public response, so
    // the browser must not call it.
    for (const client of resetClients) {
      try {
        const resetRes = await client.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: targetRedirectUrl });
        if (!resetRes?.error) emailSent = true;
        else {
          const errMsg = (resetRes.error.message || "").toLowerCase();
          if (resetRes.error.status === 429 || errMsg.includes("rate limit")) rateLimited = true;
          lastError = resetRes.error.message;
        }
      } catch (e) {
        lastError = e?.message || "Password reset request failed.";
        console.warn("resetPasswordForEmail fallback error:", e);
      }
    }

    const hasDelivery = emailSent || Boolean(otp) || Boolean(actionLink);
    if (!hasDelivery && !rateLimited) {
      return {
        success: false,
        emailSent: false,
        rateLimited: false,
        error: lastError || "Could not dispatch password reset email. Please try again shortly or contact info@trainailtd.com.",
      };
    }

    return {
      success: true,
      emailSent,
      rateLimited: rateLimited && !emailSent,
      otp,
      actionLink,
      email: normalizedEmail,
      warning: lastError
    };
  }, []);

  // Verifies the 6-8 digit OTP recovery code directly across all project clients
  const verifyRecoveryOtp = useCallback(async (email, otpToken) => {
    const normalizedEmail = (email || "").trim().toLowerCase();
    const cleanToken = (otpToken || "").trim();
    if (!cleanToken) return { success: false, error: "Please enter your recovery code." };

    const targetProject = resolveProjectForSignIn(normalizedEmail);
    const clientOrder = [
      { key: targetProject, client: getSupabaseClientForProject(targetProject) || supabase },
      { key: targetProject === SUPABASE_PROJECTS.SARA_FOUNDATION ? SUPABASE_PROJECTS.ORGANIZATION_DB : SUPABASE_PROJECTS.SARA_FOUNDATION,
        client: getSupabaseClientForProject(targetProject === SUPABASE_PROJECTS.SARA_FOUNDATION ? SUPABASE_PROJECTS.ORGANIZATION_DB : SUPABASE_PROJECTS.SARA_FOUNDATION) }
    ].filter((entry) => Boolean(entry.client));

    let lastError = null;

    for (const { key, client } of clientOrder) {
      for (const otpType of ["recovery", "email", "magiclink"]) {
        try {
          const { data, error } = await client.auth.verifyOtp({
            email: normalizedEmail,
            token: cleanToken,
            type: otpType
          });

          if (!error && data?.session) {
            recoveryProjectRef.current = key;
            setActiveSupabaseProject(key);
            setSession(data.session);
            safeStorage.setItem(AUTH_STORAGE_KEY, data.session);
            persistRecoveryVerified(true);
            setRecoverySessionReady(true);
            setIsPasswordRecovery(true);
            return { success: true, session: data.session };
          }
          if (error && otpType === "recovery") lastError = error.message;
        } catch (e) {
          if (otpType === "recovery") lastError = e?.message;
        }
      }
    }

    return { success: false, error: lastError || "Invalid or expired recovery code. Please request a new link." };
  }, []);

  const completePasswordReset = useCallback(async (newPassword) => {
    if (!supabase) return { success: false, error: "Not available in demo mode." };
    try {
      let lastError = null;
      let foundActiveSession = false;
      const orderedProjects = [
        recoveryProjectRef.current,
        SUPABASE_PROJECTS.ORGANIZATION_DB,
        SUPABASE_PROJECTS.SARA_FOUNDATION,
      ].filter((value, index, values) => value && values.indexOf(value) === index);

      for (const projKey of orderedProjects) {
        const client = getSupabaseClientForProject(projKey);
        if (client?.auth?.updateUser) {
          const { data: sessionData } = await client.auth.getSession();
          if (!sessionData?.session) {
            continue;
          }
          foundActiveSession = true;
          const { error } = await client.auth.updateUser({ password: newPassword });
          if (!error) {
            recoveryProjectRef.current = null;
            persistRecoveryVerified(false);
            setRecoverySessionReady(false);
            setIsPasswordRecovery(false);
            resetPasswordRateLimit(sessionData.session.user?.email || "");
            return { success: true };
          }
          lastError = error;
        }
      }

      if (!foundActiveSession && !recoverySessionReady) {
        return { success: false, error: "Your secure reset session is missing or has expired. Please request a new reset email and open only the newest link." };
      }

      if (lastError) {
        const message = (lastError.message || "").toLowerCase().includes("session missing")
          ? "Your secure reset session is missing or has expired. Please request a new reset email and open only the newest link."
          : lastError.message || "Could not update your password.";
        return { success: false, error: message, sessionMissing: message.includes("session is missing") };
      }
      persistRecoveryVerified(false);
      setRecoverySessionReady(false);
      setIsPasswordRecovery(false);
      return { success: true };
    } catch (e) {
      return { success: false, error: e?.message || "Could not update your password." };
    }
  }, [recoverySessionReady]);

  return {
    session,
    loading: session === undefined,
    isDemoMode: !supabase,
    authError,
    signIn,
    signUp,
    signOut,
    isPasswordRecovery,
    recoverySessionReady,
    sendPasswordReset,
    verifyRecoveryOtp,
    completePasswordReset,
    cancelPasswordRecovery: () => setIsPasswordRecovery(false),
  };
}
