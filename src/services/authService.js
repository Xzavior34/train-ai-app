import { supabase, getSupabaseClientForProject, SUPABASE_PROJECTS } from "./supabaseClient.js";
import { isDemoAdminMarker, isPlatformOwnerEmail } from "../lib/roleRouting.js";
import { safeStorage } from "../lib/storage.js";

export async function fetchMyRoles() {
  if (supabase) {
    const { data, error } = await supabase.rpc("get_my_workspace_roles");
    if (!error) return Array.isArray(data) && data.length ? data : ["learner"];

    // Keep sign-in usable while a new database migration is propagating or
    // PostgREST is refreshing its schema cache. The self-read policy on
    // user_roles makes this a safe compatibility path and prevents a missing
    // helper RPC from blocking every learner and administrator at startup.
    const rpcUnavailable = error.code === "PGRST202"
      || /get_my_workspace_roles|schema cache/i.test(error.message || "");
    if (!rpcUnavailable) throw error;

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user?.id) throw authError || error;

    const userId = authData.user.id;
    const [{ data: roleRows, error: rolesError }, { data: profile, error: profileError }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("user_profiles").select("role").eq("id", userId).maybeSingle(),
    ]);
    if (rolesError && profileError) throw error;

    const roles = [...new Set([
      ...(roleRows || []).map((row) => row.role),
      profile?.role,
    ].filter(Boolean))];
    return roles.length ? roles : ["learner"];
  }
  return fetchDemoRoles();
}

async function fetchDemoRoles() {
  let email = "";
  const parsed = safeStorage.getJSON("trainai_active_session_v1");
  if (parsed) {
    try {
      if (!email) email = parsed.user?.email || "";
      if (parsed._demo) {
        const demoRole = parsed.user?.user_metadata?.role || parsed.role;
        if (demoRole === "admin") {
          return isPlatformOwnerEmail(email) || isDemoAdminMarker(email)
            ? ["admin", "super_admin", "learner"]
            : ["admin", "learner"];
        }
        if (demoRole === "mentor") return ["mentor", "learner"];
        if (demoRole === "manager") return ["manager", "learner"];
      }
    } catch {}
  }

  return ["learner"];
}

export async function fetchMyPersonalization() {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("user_personalization")
        .select("*")
        .maybeSingle();
      if (!error && data) return data;
    } catch (e) {
      console.warn("Could not query user_personalization table:", e);
    }
  }

  const saved = safeStorage.getJSON("trainai_personalization_v1");
  return saved || { learning_tracks: ["Data & AI"], skill_level: "beginner" };
}

export async function saveMyPersonalization(userId, learningTracks, skillLevel) {
  const localPayload = { user_id: userId, learning_tracks: learningTracks, skill_level: skillLevel, updated_at: new Date().toISOString() };
  safeStorage.setItem("trainai_personalization_v1", localPayload);
  if (supabase) {
    try {
      // `data` is a NOT NULL jsonb column on user_personalization with no
      // default - it has to be included on every insert/upsert.
      await supabase
        .from("user_personalization")
        .upsert(
          { user_id: userId, learning_tracks: learningTracks, skill_level: skillLevel, data: { learning_tracks: learningTracks, skill_level: skillLevel }, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
    } catch (e) {
      console.warn("Could not save user_personalization to database:", e);
    }
  }
}

export async function performGlobalSignOut() {
  try {
    const promises = [];
    if (supabase?.auth?.signOut) {
      promises.push(supabase.auth.signOut().catch(() => {}));
    }
    for (const projKey of Object.values(SUPABASE_PROJECTS)) {
      const client = getSupabaseClientForProject(projKey);
      if (client?.auth?.signOut && client !== supabase) {
        promises.push(client.auth.signOut().catch(() => {}));
      }
    }
    await Promise.race([
      Promise.all(promises),
      new Promise((resolve) => setTimeout(resolve, 1200))
    ]);
  } catch (err) {
    console.warn("Supabase sign out error:", err);
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
  } catch (err) {
    console.warn("Storage wipe error:", err);
  }

  try {
    window.location.href = "/";
    window.location.reload();
  } catch {
    window.location.replace("/");
  }
}
