// NOT CURRENTLY USED — nothing imports this file. App.jsx calls the
// equivalent functions from ../../services/authService.js instead, which now
// imports ADMIN_EMAIL from ../lib/roleRouting.js as the single source of
// truth (this file still had its own separately-hardcoded copy).
import { supabase } from "../supabaseClient.js";
import { ADMIN_EMAIL } from "../roleRouting.js";

export async function fetchMyRoles() {
  const saved = localStorage.getItem("trainai_active_session_v1");
  let userEmail = "";
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      userEmail = parsed.user?.email || "";
      if (userEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        return ["admin", "super_admin", "learner"];
      }
      if (parsed.user?.user_metadata?.role === "mentor") {
        return ["mentor", "learner"];
      }
      if (parsed.role === "mentor") {
        return ["mentor", "learner"];
      }
    } catch {}
  }

  if (supabase) {
    try {
      const { data, error } = await supabase.from("user_roles").select("role");
      if (!error && data && data.length > 0) {
        const roles = data.map((r) => r.role);
        if (userEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase() && !roles.includes("admin")) {
          roles.push("admin", "super_admin");
        }
        return roles;
      }
    } catch (e) {
      console.warn("Could not query user_roles table:", e);
    }
  }

  if (userEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return ["admin", "super_admin", "learner"];
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
      // default — it has to be included on every insert/upsert.
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
