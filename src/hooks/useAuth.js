import { useState, useEffect, useCallback } from "react";
import { supabase, resolveProjectForSignIn, resolveProjectForSignUp, fallbackProjectForSignIn, setActiveSupabaseProject, getSupabaseClientForProject, SUPABASE_PROJECTS } from "../services/supabaseClient.js";
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
  // network error, etc.) - doing that would let anyone log in as anyone,
  // including as the hardcoded admin email, without a valid password. If
  // Supabase is configured, a failed/rejected auth call always surfaces a
  // real error and stops there.
  const signIn = useCallback(async (email, password) => {
    setAuthError(null);

    // Three separate Supabase projects, not one shared database.
    // @sarafoundationafrica.com and @trainailtd.com resolve with certainty
    // (fixed domains). Everything else is genuinely ambiguous at sign-in
    // time now that Digital Training Organization and B2B are separate
    // databases - a plain email address doesn't say which one it belongs
    // to. Tries Digital Training Organization first, and falls back to B2B
    // once (and only once) if that attempt fails with a real auth error
    // (not a network error - a network failure means the project is
    // unreachable, not that the account doesn't exist there, so it should
    // surface as the actual problem rather than silently trying somewhere
    // else and masking it).
    let targetProject = resolveProjectForSignIn(email);
    setActiveSupabaseProject(targetProject);

    async function attemptSignIn(projectKey) {
      const client = getSupabaseClientForProject(projectKey);
      if (!client) return { client: null, supaRes: null, networkErr: null };
      try {
        const supaRes = await client.auth.signInWithPassword({ email, password });
        return { client, supaRes, networkErr: null };
      } catch (networkErr) {
        return { client, supaRes: null, networkErr };
      }
    }

    if (supabase) {
      let { client, supaRes, networkErr } = await attemptSignIn(targetProject);

      // Only retry against the other tenant-hosting project on a real auth
      // rejection, and only when the first attempt was Digital Training or
      // B2B (never for Sara Foundation, which has no fallback - see
      // fallbackProjectForSignIn).
      const canFallback = !networkErr && supaRes?.error && fallbackProjectForSignIn(targetProject);
      if (canFallback) {
        const fallbackKey = fallbackProjectForSignIn(targetProject);
        const fallbackClient = getSupabaseClientForProject(fallbackKey);
        if (fallbackClient) {
          const fallbackAttempt = await attemptSignIn(fallbackKey);
          if (fallbackAttempt.supaRes?.data?.session) {
            targetProject = fallbackKey;
            setActiveSupabaseProject(fallbackKey);
            client = fallbackAttempt.client;
            supaRes = fallbackAttempt.supaRes;
            networkErr = fallbackAttempt.networkErr;
          }
        }
      }

      if (networkErr) {
        const message = "Could not reach the configured backend (network error). If you want to test in demo mode instead, remove the relevant project's URL/anon key from your .env.local (or delete the file) and restart the dev server.";
        setAuthError(message);
        return { data: null, error: new Error(message) };
      }
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
    // No database exists here to read a real role from. First check
    // whether this email already has a demo role on record in this browser
    // (e.g. a prior organization sign-up promoted it to admin) - without
    // this, every sign-in fabricated a brand-new session from scratch and
    // a demo org account would silently revert to plain "learner" the
    // moment you signed out and back in, since only the +admin marker was
    // ever checked. Fall back to the +admin marker for an email with no
    // history yet.
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

  const signUp = useCallback(async (email, password, role = "learner", accountType = "learner") => {
    setAuthError(null);
    let finalRole = role === "mentor" ? "mentor" : "learner";

    // Sign-up routing knows something sign-in can't: the account type the
    // person actually chose on the form, before any account exists. An
    // "organization" sign-up needs to land in the B2B project; everyone
    // else (including a future org's eventual invited members, who sign up
    // as individuals first if they don't already have an account) lands in
    // Digital Training Organization. Fixed domains
    // (@sarafoundationafrica.com, @trainailtd.com) override this
    // regardless of account type - see resolveProjectForSignUp().
    setActiveSupabaseProject(resolveProjectForSignUp(email, accountType));

    if (supabase) {
      // Real mode: role metadata is informational only (nothing reads
      // raw_user_meta_data into the real user_roles table), and the demo
      // admin marker below deliberately does not apply here - an admin role
      // is only ever real once granted in user_roles by an existing
      // super_admin.
      let supaRes;
      try {
        supaRes = await supabase.auth.signUp({
          email,
          password,
          options: { data: { role: finalRole } }
        });
      } catch (networkErr) {
        // Same uncaught-network-failure gap as signIn above - a configured
        // but unreachable project threw a raw "Failed to fetch" here with
        // no indication of what to do about it.
        const message = "Could not reach the configured backend (network error). If you want to test in demo mode instead, remove the relevant project's URL/anon key from your .env.local (or delete the file) and restart the dev server.";
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
      // Supabase projects with email confirmation enabled return a user but
      // no session yet - that's success (check your email), not a fallback
      // to demo mode, so return here either way.
      return { data: supaRes.data, error: null };
    }

    // Demo mode only (no Supabase project configured for this environment).
    // No database exists here to read a real role from, so this uses the
    // plus-addressing demo-admin marker (see roleRouting.js) purely to let
    // this sandbox preview the platform/admin shell - never a real email.
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
