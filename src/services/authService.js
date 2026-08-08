import { supabase } from "./supabaseClient.js";

export async function fetchMyRoles() {
  const saved = localStorage.getItem("trainai_active_session_v1");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Demo mode only: no real user_roles table exists to query below, so
      // this reads back whatever role useAuth.js's demo sign-in/sign-up
      // already decided (learner/mentor/admin, including via the
      // plus-addressing demo-admin marker - see roleRouting.js). Real
      // accounts never hit this path; the Supabase query below is what
      // actually determines a real account's roles.
      if (parsed._demo) {
        const demoRole = parsed.user?.user_metadata?.role || parsed.role;
        if (demoRole === "admin") return ["admin", "super_admin", "learner"];
        if (demoRole === "mentor") return ["mentor", "learner"];
      }
    } catch {}
  }

  if (supabase) {
    try {
      const { data, error } = await supabase.from("user_roles").select("role");
      if (!error && data && data.length > 0) {
        return data.map((r) => r.role);
      }
    } catch (e) {
      console.warn("Could not query user_roles table:", e);
    }
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

  const saved = localStorage.getItem("trainai_personalization_v1");
  return saved ? JSON.parse(saved) : { learning_tracks: ["Data & AI"], skill_level: "beginner" };
}

export async function saveMyPersonalization(userId, learningTracks, skillLevel) {
  const localPayload = { user_id: userId, learning_tracks: learningTracks, skill_level: skillLevel, updated_at: new Date().toISOString() };
  localStorage.setItem("trainai_personalization_v1", JSON.stringify(localPayload));
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
