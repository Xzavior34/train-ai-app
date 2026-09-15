import { supabase } from "./supabaseClient.js";
import { isDemoAdminMarker, isPlatformOwnerEmail } from "../lib/roleRouting.js";

export async function fetchMyRoles() {
  const saved = localStorage.getItem("trainai_active_session_v1");
  let savedEmail = "";
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      savedEmail = parsed.user?.email || "";
      if (parsed._demo) {
        const demoRole = parsed.user?.user_metadata?.role || parsed.role;
        if (demoRole === "admin") {
          return isPlatformOwnerEmail(savedEmail) || isDemoAdminMarker(savedEmail)
            ? ["admin", "super_admin", "learner"]
            : ["admin", "learner"];
        }
        if (demoRole === "mentor") return ["mentor", "learner"];
      }
    } catch {}
  }

  if (supabase) {
    try {
      const { data, error } = await supabase.from("user_roles").select("role");
      if (!error && data && data.length > 0) {
        const roles = data.map((r) => r.role);
        // Only trainailtd@gmail.com can have super_admin (Platform Owner)
        if (!isPlatformOwnerEmail(savedEmail)) {
          return roles.map(r => r === "super_admin" ? "admin" : r);
        }
        return roles;
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
