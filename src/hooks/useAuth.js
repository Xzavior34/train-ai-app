import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, resolveProjectForSignIn, resolveProjectForSignUp, setActiveSupabaseProject, getSupabaseClientForProject, SUPABASE_PROJECTS } from "../services/supabaseClient.js";
import { isDemoAdminMarker, getDemoRoleForEmail, setDemoRoleForEmail } from "../lib/roleRouting.js";
import { getRateLimitStatus, recordFailedPasswordAttempt, resetPasswordRateLimit, formatLockoutTime } from "../lib/authRateLimiter.js";
import { safeStorage } from "../lib/storage.js";
import { getCanonicalDomain, CANONICAL_DOMAIN } from "../services/emailService.js";

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
      // project owns the session. With two projects, automatic URL parsing is
      // inherently racy and previously produced "Auth session missing".
      const hashParams = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const recoveryType = hashParams.get("type");
      if (accessToken && refreshToken && recoveryType === "recovery") {
        try {
          const payloadPart = accessToken.split(".")[1] || "";
          const padded = payloadPart.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payloadPart.length / 4) * 4, "=");
          const payload = JSON.parse(window.atob(padded));
          const issuer = String(payload?.iss || "");
          const tokenProject = issuer.includes("djikuoucsuhdiyrhsduz")
            ? SUPABASE_PROJECTS.ORGANIZATION_DB
            : issuer.includes("jeobggrtxeybxvlwpxvn")
              ? SUPABASE_PROJECTS.SARA_FOUNDATION
              : null;
          const tokenClient = tokenProject ? getSupabaseClientForProject(tokenProject) : null;
          if (tokenClient) {
            const { data, error } = await tokenClient.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            if (!error && data?.session) {
              resolvedSession = data.session;
              resolvedProject = tokenProject;
              recoveryProjectRef.current = tokenProject;
              persistRecoveryVerified(true);
              setRecoverySessionReady(true);
              setIsPasswordRecovery(true);
              window.history.replaceState({}, document.title, "/?view=auth&recovery=1");
            }
          }
        } catch (error) {
          console.warn("Could not establish password recovery session:", error);
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

    const candidateEmails = [rawInput];
    if (!rawInput.includes("@") && rawInput.length > 0) {
      candidateEmails.push(`${rawInput}@gmail.com`);
      candidateEmails.push(`${rawInput}@sarafoundation.org`);
      candidateEmails.push(`${rawInput}@sarafoundationafrica.com`);
      candidateEmails.push(`${rawInput}@yahoo.com`);
      candidateEmails.push(`${rawInput}@outlook.com`);
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

  const signUp = useCallback(async (email, password, role = "learner", accountType = "learner") => {
    setAuthError(null);
    const normalizedEmail = (email || "").trim().toLowerCase();
    let finalRole = role === "mentor" ? "mentor" : "learner";

    const targetProject = resolveProjectForSignUp(normalizedEmail, accountType);
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
          options: { data: { role: finalRole } }
        });
      } catch (networkErr) {
        const message = "Could not reach the authentication server. Please check your network connection and try again.";
        setAuthError(message);
        return { data: null, error: new Error(message) };
      }

      if (supaRes?.error) {
        const errMsg = supaRes.error.message || "";
        let message = errMsg;
        if (supaRes.error.status === 429 || errMsg.toLowerCase().includes("rate limit")) {
          message = "Sign up is temporarily delayed due to mail provider limits. Please try again shortly or contact support at info@trainailtd.com.";
        }
        setAuthError(message);
        return { data: null, error: new Error(message) };
      }

      if (supaRes?.data?.session) {
        setSession(supaRes.data.session);
        safeStorage.setItem(AUTH_STORAGE_KEY, supaRes.data.session);
      }
      return { data: supaRes.data, error: null };
    }

    // Demo mode only
    if (isDemoAdminMarker(normalizedEmail)) {
      finalRole = "admin";
    }
    const newSession = {
      user: {
        id: `user_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, "_")}`,
        email: normalizedEmail,
        user_metadata: { display_name: normalizedEmail.split("@")[0].replace(".", " "), role: finalRole }
      },
      role: finalRole,
      _demo: true
    };
    setSession(newSession);
    safeStorage.setItem(AUTH_STORAGE_KEY, newSession);
    setDemoRoleForEmail(normalizedEmail, finalRole);
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

    const edgeResults = await Promise.allSettled(resetClients.map((client) =>
      client.functions.invoke("send-password-reset", {
        body: { email: normalizedEmail, redirectTo: targetRedirectUrl }
      })
    ));
    const edgeDelivered = edgeResults.some((result) =>
      result.status === "fulfilled" && !result.value?.error && result.value?.data?.emailSent === true
    );
    rateLimited = edgeResults.some((result) =>
      result.status === "fulfilled" && result.value?.data?.rateLimited === true
    );
    if (edgeDelivered) {
      return { success: true, emailSent: true, rateLimited: false, otp: null, actionLink: null, email: normalizedEmail, viaResend: true };
    }

    // If a custom mail function is unavailable, ask both Auth projects to
    // dispatch their standard recovery email. Their neutral response keeps
    // account existence private while ensuring the owning project is tried.
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
      try {
        const { data, error } = await client.auth.verifyOtp({
          email: normalizedEmail,
          token: cleanToken,
          type: "recovery"
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
        if (error) lastError = error.message;
      } catch (e) {
        lastError = e?.message;
      }
    }

    return { success: false, error: lastError || "Invalid or expired recovery code. Please request a new link." };
  }, []);

  const completePasswordReset = useCallback(async (newPassword) => {
    if (!supabase) return { success: false, error: "Not available in demo mode." };
    if (!recoverySessionReady) {
      return { success: false, error: "Your secure reset session is missing or has expired. Please request a new reset email and open only the newest link." };
    }
    try {
      let lastError = null;
      const orderedProjects = [
        recoveryProjectRef.current,
        SUPABASE_PROJECTS.SARA_FOUNDATION,
        SUPABASE_PROJECTS.ORGANIZATION_DB,
      ].filter((value, index, values) => value && values.indexOf(value) === index);

      for (const projKey of orderedProjects) {
        const client = getSupabaseClientForProject(projKey);
        if (client?.auth?.updateUser) {
          const { data: sessionData } = await client.auth.getSession();
          if (!sessionData?.session) {
            lastError = new Error("Auth session missing");
            continue;
          }
          const { error } = await client.auth.updateUser({ password: newPassword });
          if (!error) {
            recoveryProjectRef.current = null;
            persistRecoveryVerified(false);
            setRecoverySessionReady(false);
            setIsPasswordRecovery(false);
            return { success: true };
          }
          lastError = error;
        }
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
