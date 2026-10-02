import { useState, useEffect, useCallback } from "react";
import { supabase, resolveProjectForSignIn, resolveProjectForSignUp, fallbackProjectForSignIn, setActiveSupabaseProject, getSupabaseClientForProject, SUPABASE_PROJECTS } from "../services/supabaseClient.js";
import { isDemoAdminMarker, getDemoRoleForEmail, setDemoRoleForEmail } from "../lib/roleRouting.js";
import { getRateLimitStatus, recordFailedPasswordAttempt, resetPasswordRateLimit, formatLockoutTime } from "../lib/authRateLimiter.js";
import { safeStorage } from "../lib/storage.js";

const AUTH_STORAGE_KEY = "trainai_active_session_v1";

export function useAuth() {
  const [session, setSession] = useState(() => {
    return safeStorage.getJSON(AUTH_STORAGE_KEY, undefined);
  });
  const [authError, setAuthError] = useState(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

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

      // 1. First probe primary project client
      const primaryClient = supabase || getSupabaseClientForProject(SUPABASE_PROJECTS.ORGANIZATION_DB);
      if (primaryClient) {
        try {
          const { data } = await primaryClient.auth.getSession();
          if (data?.session) {
            resolvedSession = data.session;
          }
        } catch {}
      }

      // 2. If not found on primary, probe alternate project client
      if (!resolvedSession) {
        for (const projKey of [SUPABASE_PROJECTS.ORGANIZATION_DB, SUPABASE_PROJECTS.SARA_FOUNDATION]) {
          const client = getSupabaseClientForProject(projKey);
          if (client && client !== primaryClient) {
            try {
              const { data } = await client.auth.getSession();
              if (data?.session) {
                resolvedSession = data.session;
                break;
              }
            } catch {}
          }
        }
      }

      if (cancelled) return;

      if (resolvedSession) {
        syncProject(resolvedSession.user?.email);
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
    if (hash.includes("type=recovery") || hash.includes("type%3Drecovery") || search.includes("type=recovery")) {
      setIsPasswordRecovery(true);
    }

    const listeners = [];
    for (const projKey of [SUPABASE_PROJECTS.ORGANIZATION_DB, SUPABASE_PROJECTS.SARA_FOUNDATION]) {
      const client = getSupabaseClientForProject(projKey);
      if (client?.auth?.onAuthStateChange) {
        const { data: listener } = client.auth.onAuthStateChange((event, newSession) => {
          if (event === "PASSWORD_RECOVERY") {
            setIsPasswordRecovery(true);
          }
          if (event === "SIGNED_OUT") {
            setSession(null);
            safeStorage.removeItem(AUTH_STORAGE_KEY);
          } else if (newSession) {
            syncProject(newSession.user?.email);
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
    const normalizedEmail = (email || "").trim().toLowerCase();

    // Enforce 10-trial rate limiting before attempting sign in
    const rateLimit = getRateLimitStatus(normalizedEmail);
    if (rateLimit.isLocked) {
      const timeStr = formatLockoutTime(rateLimit.remainingMs);
      const lockMsg = `Account temporarily locked due to 10 failed password trials. Please wait ${timeStr} or reset your password.`;
      setAuthError(lockMsg);
      return { data: null, error: new Error(lockMsg), isRateLimited: true, remainingMs: rateLimit.remainingMs };
    }

    let targetProject = resolveProjectForSignIn(normalizedEmail);
    setActiveSupabaseProject(targetProject);

    async function attemptSignIn(projectKey) {
      const client = getSupabaseClientForProject(projectKey);
      if (!client) return { client: null, supaRes: null, networkErr: null };
      try {
        const supaRes = await client.auth.signInWithPassword({ email: normalizedEmail, password });
        return { client, supaRes, networkErr: null };
      } catch (networkErr) {
        return { client, supaRes: null, networkErr };
      }
    }

    if (supabase) {
      let { client, supaRes, networkErr } = await attemptSignIn(targetProject);

      if (!supaRes?.data?.session && !networkErr) {
        const alternateProject =
          targetProject === SUPABASE_PROJECTS.SARA_FOUNDATION
            ? SUPABASE_PROJECTS.ORGANIZATION_DB
            : SUPABASE_PROJECTS.SARA_FOUNDATION;
        const altAttempt = await attemptSignIn(alternateProject);
        if (altAttempt.supaRes?.data?.session) {
          targetProject = alternateProject;
          setActiveSupabaseProject(alternateProject);
          client = altAttempt.client;
          supaRes = altAttempt.supaRes;
          networkErr = altAttempt.networkErr;
        }
      }

      if (networkErr) {
        const message = "Could not reach the authentication server. Please check your network connection and try again.";
        setAuthError(message);
        return { data: null, error: new Error(message) };
      }

      if (supaRes?.data?.session) {
        resetPasswordRateLimit(normalizedEmail);
        setSession(supaRes.data.session);
        safeStorage.setItem(AUTH_STORAGE_KEY, supaRes.data.session);
        return { data: supaRes.data, error: null };
      }

      // Check whether this account actually exists in the database
      let userExists = false;
      try {
        const checkClient = client || getSupabaseClientForProject(targetProject) || supabase;
        if (checkClient?.auth?.admin?.generateLink) {
          const checkRes = await checkClient.auth.admin.generateLink({
            type: "recovery",
            email: normalizedEmail
          });
          userExists = checkRes?.data?.properties !== null;
        }
      } catch (_) {}

      if (!userExists) {
        // Do not penalize non-registered emails with rate-limiting lockouts
        const message = "No account found with this email address. Please check your spelling or create a new account.";
        setAuthError(message);
        return { data: null, error: new Error(message), notRegistered: true };
      }

      // Existing user entered an incorrect password: track trial attempt
      const updatedLimit = recordFailedPasswordAttempt(normalizedEmail);
      let message;
      if (updatedLimit.isLocked) {
        const timeStr = formatLockoutTime(updatedLimit.remainingMs);
        message = `Account temporarily locked due to 10 failed password trials. Please wait ${timeStr} or reset your password.`;
      } else if (updatedLimit.remainingAttempts <= 5) {
        message = `Incorrect password. You have ${updatedLimit.remainingAttempts} attempt(s) remaining before a 15-minute temporary lockout.`;
      } else {
        message = `Incorrect password. Trial ${updatedLimit.attempts} of 10 failed. You have ${updatedLimit.remainingAttempts} attempts remaining.`;
      }
      setAuthError(message);
      return { data: null, error: supaRes?.error || new Error(message), rateLimit: updatedLimit };
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

  // "Forgot password" with existence verification and multi-path fallback
  const sendPasswordReset = useCallback(async (email) => {
    const normalizedEmail = (email || "").trim().toLowerCase();
    if (!supabase) {
      return { success: true, emailSent: true };
    }

    const targetProject = resolveProjectForSignIn(normalizedEmail);
    const client = getSupabaseClientForProject(targetProject) || supabase;

    // 1. Verify if account exists
    let userExists = false;
    let otp = null;
    let actionLink = null;

    if (client?.auth?.admin?.generateLink) {
      try {
        const linkRes = await client.auth.admin.generateLink({
          type: "recovery",
          email: normalizedEmail,
          options: { redirectTo: `${window.location.origin}/?view=auth#type=recovery` }
        });
        if (linkRes?.data?.properties) {
          userExists = true;
          otp = linkRes.data.properties.email_otp;
          actionLink = linkRes.data.properties.action_link;
        } else {
          userExists = false;
        }
      } catch (e) {
        console.warn("generateLink check error:", e);
      }
    }

    if (!userExists) {
      return {
        success: false,
        notFound: true,
        error: "No account found with this email address. Please check your spelling or create a new account."
      };
    }

    // 2. Attempt sending reset email
    let emailSent = false;
    let rateLimited = false;
    try {
      const resetRes = await client.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/?view=auth#type=recovery`
      });
      if (resetRes?.error) {
        if (resetRes.error.status === 429 || (resetRes.error.message || "").toLowerCase().includes("rate limit")) {
          rateLimited = true;
        }
      } else {
        emailSent = true;
      }
    } catch (e) {
      console.warn("resetPasswordForEmail error:", e);
      rateLimited = true;
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
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { success: false, error: error.message };
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
