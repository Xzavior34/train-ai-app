import { supabase } from "../supabaseClient.js";

const LOCAL_STORAGE_CHECKINS_KEY = "trainai_mentor_checkins_cache_v1";

const SEED_CHECKINS = [
  {
    id: "chk-1",
    team_id: "cap-team-1",
    team_name: "Nexus AI Healthcare",
    mentor_id: "mentor-1",
    mentor_name: "Dr. Amara Okafor",
    checkin_date: "2026-10-04",
    progress_rating: 5,
    notes: "Sprint 3 completed. All API integrations with Supabase and OpenAI are humming. Ready for end-to-end stress testing.",
    issues_blockers: "Minor latency on cold start for the triage LLM prompt chain. Suggested prompt compression.",
    recommended_actions: "Implement Redis prompt caching and finalize the 3-minute Demo Day pitch deck.",
    next_checkin_date: "2026-10-11",
    is_private_admin: false,
    created_at: "2026-10-04T14:30:00Z",
  },
  {
    id: "chk-2",
    team_id: "cap-team-2",
    team_name: "AgriSense Africa",
    mentor_id: "mentor-2",
    mentor_name: "Engr. David Adeleke",
    checkin_date: "2026-10-02",
    progress_rating: 4,
    notes: "Mobile camera integration working on Android test devices. Offline model quantization in progress.",
    issues_blockers: "Dataset size for cassava mosaic disease is smaller than maize rust.",
    recommended_actions: "Use synthetic data augmentation for the underrepresented class before Thursday.",
    next_checkin_date: "2026-10-09",
    is_private_admin: false,
    created_at: "2026-10-02T11:00:00Z",
  },
];

function getCachedCheckins() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CHECKINS_KEY);
    return raw ? JSON.parse(raw) : SEED_CHECKINS;
  } catch {
    return SEED_CHECKINS;
  }
}

function saveCachedCheckins(items) {
  try {
    localStorage.setItem(LOCAL_STORAGE_CHECKINS_KEY, JSON.stringify(items));
  } catch {}
}

/**
 * Fetches check-ins for a team, cohort, or mentor
 */
export async function fetchMentorshipCheckins({ teamId, mentorId, cohortId, includePrivate = false } = {}) {
  if (!supabase) {
    let items = getCachedCheckins();
    if (teamId) items = items.filter((c) => c.team_id === teamId);
    if (mentorId) items = items.filter((c) => c.mentor_id === mentorId);
    if (!includePrivate) items = items.filter((c) => !c.is_private_admin);
    return items;
  }

  try {
    let query = supabase.from("mentorship_checkins").select("*").order("checkin_date", { ascending: false });
    if (teamId) query = query.eq("team_id", teamId);
    if (mentorId) query = query.eq("mentor_id", mentorId);
    if (cohortId) query = query.eq("cohort_id", cohortId);
    if (!includePrivate) query = query.eq("is_private_admin", false);

    const { data, error } = await query;
    if (error || !data || data.length === 0) return getCachedCheckins();
    saveCachedCheckins(data);
    return data;
  } catch {
    return getCachedCheckins();
  }
}

/**
 * Records a new structured mentor check-in
 */
export async function createMentorCheckin({
  teamId,
  teamName,
  cohortId,
  mentorId,
  mentorName,
  checkinDate,
  notes,
  progressRating = 4,
  issuesBlockers,
  recommendedActions,
  nextCheckinDate,
  isPrivateAdmin = false,
}) {
  const newRow = {
    id: `chk-${Date.now()}`,
    team_id: teamId,
    team_name: teamName || "CAP Project Team",
    cohort_id: cohortId || null,
    mentor_id: mentorId || "mentor-current",
    mentor_name: mentorName || "Mentor",
    checkin_date: checkinDate || new Date().toISOString().slice(0, 10),
    notes,
    progress_rating: progressRating,
    issues_blockers: issuesBlockers || "",
    recommended_actions: recommendedActions || "",
    next_checkin_date: nextCheckinDate || null,
    is_private_admin: !!isPrivateAdmin,
    created_at: new Date().toISOString(),
  };

  if (supabase) {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      const currentUid = authUser?.user?.id;
      const isUid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val || ""));

      const dbRow = {
        team_name: newRow.team_name,
        mentor_name: newRow.mentor_name,
        checkin_date: newRow.checkin_date,
        notes: newRow.notes,
        progress_rating: newRow.progress_rating,
        issues_blockers: newRow.issues_blockers,
        recommended_actions: newRow.recommended_actions,
        next_checkin_date: newRow.next_checkin_date,
        is_private_admin: newRow.is_private_admin,
      };
      if (isUid(teamId)) dbRow.team_id = teamId;
      if (isUid(cohortId)) dbRow.cohort_id = cohortId;
      if (isUid(mentorId)) dbRow.mentor_id = mentorId;
      else if (isUid(currentUid)) dbRow.mentor_id = currentUid;

      const { data, error } = await supabase.from("mentorship_checkins").insert(dbRow).select().single();
      if (!error && data) {
        const merged = { ...newRow, id: data.id };
        const existing = getCachedCheckins();
        saveCachedCheckins([merged, ...existing]);
        return { success: true, data: merged };
      }
    } catch (e) {
      console.warn("createMentorCheckin Supabase fallback:", e);
    }
  }

  const existing = getCachedCheckins();
  const updated = [newRow, ...existing];
  saveCachedCheckins(updated);
  return { success: true, data: newRow };
}
