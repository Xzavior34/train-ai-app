import { useState, useEffect, useCallback } from "react";
import { supabase } from "../services/supabaseClient.js";
import { isDemoAdminMarker, getDemoRoleForEmail, setDemoRoleForEmail } from "../lib/roleRouting.js";

const AUTH_STORAGE_KEY = "trainai_active_session_v1";

export function useAuth() {
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return undefined;
  });
  const [authError, setAuthError] = useState(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let resolvedSession = null;

      if (supabase) {
        try {
          const { data } = await supabase.auth.getSession();
          if (data?.session) {
            resolvedSession = data.session;
          }
        } catch {}
      }

      if (cancelled) return;

      if (resolvedSession) {
        setSession(resolvedSession);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(resolvedSession));
      } else {
        const saved = localStorage.getItem(AUTH_STORAGE_KEY);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setSession(parsed);
          } catch {
            setSession(null);
          }
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

    let subscription = null;
    if (supabase?.auth?.onAuthStateChange) {
      const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (event === "PASSWORD_RECOVERY") {
          setIsPasswordRecovery(true);
        }
        if (newSession) {
          setSession(newSession);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newSession));
        } else if (event === "SIGNED_OUT") {
          setSession(null);
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      });
      subscription = listener?.subscription || null;
    }

    return () => {
      cancelled = true;
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    setAuthError(null);

    if (supabase) {
      try {
        const supaRes = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (supaRes?.error) {
          const message = supaRes.error.message || "Sign in failed. Check your email and password and try again.";
          setAuthError(message);
          return { data: null, error: supaRes.error };
        }
        if (supaRes?.data?.session) {
          setSession(supaRes.data.session);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(supaRes.data.session));
          return { data: supaRes.data, error: null };
        }
      } catch (networkErr) {
        const message = "Could not reach the configured backend (network error). Please check your internet connection.";
        setAuthError(message);
        return { data: null, error: new Error(message) };
      }
    }

    // Demo mode fallback only when no database client is initialized
    let userRole = getDemoRoleForEmail(email) || "learner";
    if (!getDemoRoleForEmail(email) && isDemoAdminMarker(email)) {
      userRole = "admin";
    }

    const newSession = {
      user: {
        id: `user_${email.replace(/[^a-zA-Z0-9]/g, "_")}`,
        email: email,
        user_metadata: { display_name: email.split("@")[0].replace(".", " "), role: userRole }
      },
      role: userRole,
      _demo: true
    };
    setSession(newSession);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newSession));
    return { data: newSession, error: null };
  }, []);

  const signUp = useCallback(async (email, password, role = "learner", _accountType = "learner") => {
    setAuthError(null);
    let finalRole = role === "mentor" ? "mentor" : "learner";

    if (supabase) {
      let supaRes;
      try {
        supaRes = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { role: finalRole },
            emailRedirectTo: window.location.origin + "/auth/callback",
          }
        });
      } catch (networkErr) {
        const message = "Could not reach the configured backend (network error). Please check your internet connection.";
        setAuthError(message);
        return { data: null, error: new Error(message) };
      }
      if (supaRes?.error) {
        const message = supaRes.error.message || "Sign up failed. Please try again.";
        setAuthError(message);
        return { data: null, error: supaRes.error };
      }
      if (supaRes?.data?.session) {
        setSession(supaRes.data.session);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(supaRes.data.session));
      }
      return { data: supaRes.data, error: null };
    }

    // Demo mode only
    if (isDemoAdminMarker(email)) {
      finalRole = "admin";
    }
    const newSession = {
      user: {
        id: `user_${email.replace(/[^a-zA-Z0-9]/g, "_")}`,
        email: email,
        user_metadata: { display_name: email.split("@")[0].replace(".", " "), role: finalRole }
      },
      role: finalRole,
      _demo: true
    };
    setSession(newSession);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newSession));
    setDemoRoleForEmail(email, finalRole);
    return { data: newSession, error: null };
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut().catch(() => {});
      }
    } catch (e) {
      console.warn("Sign out warning:", e);
    }

    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem("trainai_active_session_v1");
      localStorage.removeItem("trainai_demo_role");
      
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("sb-") || key.includes("supabase.auth.token") || key.startsWith("trainai_session"))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      const sessionKeysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith("sb-") || key.includes("supabase.auth.token"))) {
          sessionKeysToRemove.push(key);
        }
      }
      sessionKeysToRemove.forEach(k => sessionStorage.removeItem(k));
    } catch {}

    setSession(null);

    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("portal") || url.searchParams.has("invite") || url.searchParams.has("session_id")) {
        url.search = "";
        window.history.replaceState({}, "", url.pathname);
      }
    } catch {}
  }, []);

  const sendPasswordReset = useCallback(async (email) => {
    if (!supabase) {
      return { success: true };
    }
    const cleanEmail = email.trim();

    // 1. Try invoking the reset-password edge function for Resend branded email
    try {
      const { data, error } = await supabase.functions.invoke("reset-password", {
        body: { email: cleanEmail },
      });
      if (!error && data?.success) {
        return { success: true, emailSent: true, organizationName: data.organization_name };
      }
    } catch (edgeErr) {
      console.warn("Reset password edge function warning:", edgeErr);
    }

    // 2. Direct HTTP call to reset-password function endpoint
    try {
      const res = await fetch("https://jeobggrtxeybxvlwpxvn.supabase.co/functions/v1/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success) {
          return { success: true, emailSent: true, organizationName: json.organization_name };
        }
      }
    } catch (fetchErr) {
      console.warn("Reset password function endpoint warning:", fetchErr);
    }

    // 3. Standard Supabase Auth fallback
    try {
      await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: window.location.origin + "/auth/callback" });
    } catch (e) {
      console.warn("Password reset request warning:", e);
    }
    return { success: true };
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
    completePasswordReset,
    cancelPasswordRecovery: () => setIsPasswordRecovery(false),
  };
}
