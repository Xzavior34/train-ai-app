import { useState, useEffect, useCallback } from "react";
import { supabase } from "../services/supabaseClient.js";
import { ADMIN_EMAIL } from "../lib/roleRouting.js";

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

  useEffect(() => {
    if (!supabase) {
      if (session === undefined) setSession(null);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        setSession(data.session);
      } else {
        const saved = localStorage.getItem(AUTH_STORAGE_KEY);
        setSession(saved ? JSON.parse(saved) : null);
      }
    }).catch(() => {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      setSession(saved ? JSON.parse(saved) : null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (newSession) {
        setSession(newSession);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newSession));
      }
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  // IMPORTANT: the local/demo session below is ONLY a fallback for when no
  // Supabase project is configured at all (`supabase === null`). It must
  // never fire just because a *real* sign-in attempt failed (wrong password,
  // network error, etc.) — doing that would let anyone log in as anyone,
  // including as the hardcoded admin email, without a valid password. If
  // Supabase is configured, a failed/rejected auth call always surfaces a
  // real error and stops there.
  const signIn = useCallback(async (email, password) => {
    setAuthError(null);

    if (supabase) {
      const supaRes = await supabase.auth.signInWithPassword({ email, password });
      if (supaRes?.data?.session) {
        setSession(supaRes.data.session);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(supaRes.data.session));
        return { data: supaRes.data, error: null };
      }
      const message = supaRes?.error?.message || "Sign in failed. Check your email and password and try again.";
      setAuthError(message);
      return { data: null, error: supaRes?.error || new Error(message) };
    }

    // Demo mode only (no Supabase project configured for this environment).
    let userRole = "learner";
    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
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

  const signUp = useCallback(async (email, password, role = "learner") => {
    setAuthError(null);
    let finalRole = role === "mentor" ? "mentor" : "learner";
    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      finalRole = "admin";
    }

    if (supabase) {
      const supaRes = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role: finalRole } }
      });
      if (supaRes?.error) {
        const message = supaRes.error.message || "Sign up failed. Please try again.";
        setAuthError(message);
        return { data: null, error: supaRes.error };
      }
      if (supaRes?.data?.session) {
        setSession(supaRes.data.session);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(supaRes.data.session));
      }
      // Supabase projects with email confirmation enabled return a user but
      // no session yet — that's success (check your email), not a fallback
      // to demo mode, so return here either way.
      return { data: supaRes.data, error: null };
    }

    // Demo mode only (no Supabase project configured for this environment).
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
    return { data: newSession, error: null };
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) {
      try { await supabase.auth.signOut(); } catch {}
    }
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setSession(null);
  }, []);

  return {
    session,
    loading: session === undefined,
    isDemoMode: !supabase,
    authError,
    signIn,
    signUp,
    signOut,
  };
}
