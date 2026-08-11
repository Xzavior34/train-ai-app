import { supabase } from "./supabaseClient.js";
import { isDemoAdminMarker } from "../lib/roleRouting.js";

export async function fetchMyRoles() {
  const saved = localStorage.getItem("trainai_active_session_v1");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Demo mode only: no real user_roles table exists to query below, so
      // this reads back whatever role useAuth.js's demo sign-in/sign-up
      // already decided (learner/mentor/admin). Real accounts never hit
      // this path; the Supabase query below is what actually determines a
      // real account's roles.
      //
      // A REAL BUG, found by actually testing a plain "Organization"
      // sign-up (no +admin marker at all) rather than assuming this was
      // fine: this used to grant every demoRole === "admin" account
      // super_admin unconditionally - meaning a real organization's admin
      // account (created via registerOrganization(), which correctly only
      // ever sets role="admin") incorrectly saw the cross-tenant "All
      // Organizations" selector and would have had Super Admin's Dashboard
      // Switcher option too. Confirmed with a real signup + screenshot,
      // not assumed. Fixed: super_admin is now only granted in demo mode
      // to the email that explicitly opted into previewing it (the
      // +admin marker) - a plain organization admin gets exactly
      // ["admin", "learner"], matching what a real org admin account
      // would actually have.
      if (parsed._demo) {
        const email = parsed.user?.email || "";
        const demoRole = parsed.user?.user_metadata?.role || parsed.role;
        if (demoRole === "admin") {
          return isDemoAdminMarker(email) ? ["admin", "super_admin", "learner"] : ["admin", "learner"];
        }
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
