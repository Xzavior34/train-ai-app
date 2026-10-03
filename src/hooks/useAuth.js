import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, resolveProjectForSignIn, resolveProjectForSignUp, setActiveSupabaseProject, getSupabaseClientForProject, SUPABASE_PROJECTS } from "../services/supabaseClient.js";
import { isDemoAdminMarker, getDemoRoleForEmail, setDemoRoleForEmail } from "../lib/roleRouting.js";
import { getRateLimitStatus, recordFailedPasswordAttempt, resetPasswordRateLimit, formatLockoutTime } from "../lib/authRateLimiter.js";
import { safeStorage } from "../lib/storage.js";
import { getCanonicalDomain, CANONICAL_DOMAIN, sendPasswordResetViaResendDirect } from "../services/emailService.js";

const AUTH_STORAGE_KEY = "trainai_active_session_v1";

export function useAuth() {
  const [session, setSession] = useState(() => {
    return safeStorage.getJSON(AUTH_STORAGE_KEY, undefined);
  });
  const [authError, setAuthError] = useState(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
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
      if (primaryClient) {
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
      // 1. Use Admin API to create user with email_confirm: true
      // This bypasses email service rate limits and prevents users being stuck unconfirmed
      if (client.auth?.admin?.createUser) {
        try {
          const adminCreateRes = await client.auth.admin.createUser({
            email: normalizedEmail,
            password,
            email_confirm: true,
            user_metadata: { role: finalRole }
          });

          if (adminCreateRes?.data?.user) {
            // Immediately sign the user in with password to obtain active session
            const signInRes = await client.auth.signInWithPassword({
              email: normalizedEmail,
              password
            });
            if (signInRes?.data?.session) {
              setSession(signInRes.data.session);
              safeStorage.setItem(AUTH_STORAGE_KEY, signInRes.data.session);
              return { data: signInRes.data, error: null };
            }
            return { data: adminCreateRes.data, error: null };
          }

          if (adminCreateRes?.error) {
            const errMsg = (adminCreateRes.error.message || "").toLowerCase();
            if (errMsg.includes("already registered") || errMsg.includes("already exists")) {
              const msg = "An account with this email already exists. Please sign in instead.";
              setAuthError(msg);
              return { data: null, error: new Error(msg), alreadyRegistered: true };
            }
          }
        } catch (adminErr) {
          console.warn("admin.createUser attempt encountered error:", adminErr);
        }
      }

      // 2. Standard signUp fallback
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

    const targetProject = resolveProjectForSignIn(rawInput);
    const client = getSupabaseClientForProject(targetProject) || supabase;

    const domainOrigin = getCanonicalDomain();
    // Supabase appends its own token fragment. Keep our recovery marker in the
    // query string so it cannot be overwritten by that fragment.
    const targetRedirectUrl = `${domainOrigin}/?view=auth&recovery=1`;

    let otp = null;
    let actionLink = null;
    let emailSent = false;
    let rateLimited = false;

    // 1. Primary: Try dedicated send-password-reset Edge Function (dispatches via Resend with trainailtd.com branding)
    if (client?.functions?.invoke) {
      try {
        const { data: edgeData, error: edgeErr } = await client.functions.invoke("send-password-reset", {
          body: {
            email: normalizedEmail,
            redirectTo: targetRedirectUrl
          }
        });

        if (!edgeErr && edgeData?.success) {
          return {
            success: true,
            emailSent: edgeData.emailSent ?? true,
            rateLimited: false,
            otp: edgeData.otp || null,
            actionLink: edgeData.actionLink || null,
            email: normalizedEmail,
            viaResend: true
          };
        }

        if (edgeData?.notFound) {
          return {
            success: false,
            notFound: true,
            error: edgeData.error || "No account found with this email address. Please check your spelling or create a new account."
          };
        }
      } catch (edgeInvocationErr) {
        console.info("send-password-reset edge function notice:", edgeInvocationErr);
      }
    }

    // 2. Admin generateLink extraction if service/admin API is accessible
    if (client?.auth?.admin?.generateLink) {
      try {
        const linkRes = await client.auth.admin.generateLink({
          type: "recovery",
          email: normalizedEmail,
          options: { redirectTo: targetRedirectUrl }
        });
        if (linkRes?.data?.properties) {
          otp = linkRes.data.properties.email_otp;
          actionLink = linkRes.data.properties.action_link;

          // Attempt direct Resend dispatch if client key exists
          const resendDirect = await sendPasswordResetViaResendDirect({
            email: normalizedEmail,
            resetUrl: actionLink || targetRedirectUrl,
            otpCode: otp
          });
          if (resendDirect?.success) {
            emailSent = true;
          }
        }
      } catch (e) {
        console.warn("generateLink fallback notice:", e);
      }
    }

    // 3. Fallback: Supabase standard password reset
    if (!emailSent) {
      try {
        const resetRes = await client.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: targetRedirectUrl
        });
        if (resetRes?.error) {
          const errMsg = (resetRes.error.message || "").toLowerCase();
          if (resetRes.error.status === 429 || errMsg.includes("rate limit")) {
            rateLimited = true;
          } else if (errMsg.includes("not found")) {
            return {
              success: false,
              notFound: true,
              error: "No account found with this email address. Please check your spelling or create a new account."
            };
          } else if (resetRes.error.status === 401 || errMsg.includes("invalid api key")) {
            return {
              success: false,
              error: "Authentication service connection error (Invalid API Key). Please contact support at info@trainailtd.com."
            };
          } else {
            return {
              success: false,
              error: resetRes.error.message || "Failed to send reset link."
            };
          }
        } else {
          emailSent = true;
        }
      } catch (e) {
        console.warn("resetPasswordForEmail fallback error:", e);
        rateLimited = true;
      }
    }

    return {
      success: true,
      emailSent,
      rateLimited,
      otp,
      actionLink,
      email: normalizedEmail
    };
  }, []);

  // Verifies the 6-8 digit OTP recovery code directly
  const verifyRecoveryOtp = useCallback(async (email, otpToken) => {
    const normalizedEmail = (email || "").trim().toLowerCase();
    const targetProject = resolveProjectForSignIn(normalizedEmail);
    const client = getSupabaseClientForProject(targetProject) || supabase;
    if (!client) return { success: false, error: "Authentication client unavailable." };

    try {
      const { data, error } = await client.auth.verifyOtp({
        email: normalizedEmail,
        token: (otpToken || "").trim(),
        type: "recovery"
      });

      if (error) {
        return { success: false, error: error.message || "Invalid or expired recovery code." };
      }

      if (data?.session) {
        setSession(data.session);
        safeStorage.setItem(AUTH_STORAGE_KEY, data.session);
        setIsPasswordRecovery(true);
        return { success: true, session: data.session };
      }

      return { success: false, error: "Could not create recovery session. Please try again." };
    } catch (e) {
      return { success: false, error: e?.message || "Verification failed." };
    }
  }, []);

  const completePasswordReset = useCallback(async (newPassword) => {
    if (!supabase) return { success: false, error: "Not available in demo mode." };
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
      setIsPasswordRecovery(false);
      return { success: true };
    } catch (e) {
      return { success: false, error: e?.message || "Could not update your password." };
    }
  }, []);

  return {
    session,
    loading: session === undefined,
    isDemoMode: !supabase,
    authError,
    signIn,
    signUp,
    signOut,
    isPasswordRecovery,
    sendPasswordReset,
    verifyRecoveryOtp,
    completePasswordReset,
    cancelPasswordRecovery: () => setIsPasswordRecovery(false),
  };
}
