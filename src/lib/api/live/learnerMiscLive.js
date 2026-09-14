import { supabase } from "../../supabaseClient.js";

/**
 * Live queries added for learner screens that previously rendered constants.
 *
 * Everything here reads real tables only. Where an existing helper in
 * lib/api/ already covered a need it is reused rather than duplicated; the
 * functions below exist because nothing batched or selected the columns
 * these screens actually display (per-learner badge counts, courses
 * completed, cohort names, AI conversation lists, schedule facilitators).
 *
 * NOTE on profile lookups: `user_profiles` is keyed by `id` (it is a 1:1
 * table on auth.users - see 0001_init_schema.sql), so batched lookups here
 * filter on `id`, not on a `user_id` column.
 */

export async function fetchProfilesByIds(userIds) {
  if (!supabase || !userIds || !userIds.length) return {};
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, display_name, avatar_url, role, department, school")
    .in("id", ids);
  if (error) { console.warn("Profiles (by id) batch fetch warning:", error); return {}; }
  return Object.fromEntries((data || []).map((p) => [p.id, p]));
}

// Same shape as fetchGamificationStatsByUserIds in schemaHelper.js, but also
// selects courses_completed/lessons_completed - the leaderboard table shows
// completed-course counts and that helper never selected the column, so the
// value was always undefined.
export async function fetchGamificationStatsWithProgress(userIds) {
  if (!supabase || !userIds || !userIds.length) return {};
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from("user_gamification_stats")
    .select("user_id, total_points, current_level, streak_days, courses_completed, lessons_completed")
    .in("user_id", ids);
  if (error) { console.warn("Gamification stats (with progress) fetch warning:", error); return {}; }
  return Object.fromEntries((data || []).map((s) => [s.user_id, s]));
}

// Per-learner earned badge counts. No batched API existed for this, so the
// leaderboard's Badges column was a literal. Counted client-side from real
// `user_achievements` rows (id, user_id) - a learner only sees the rows RLS
// exposes to them, so a zero here means "no visible earned badges", never a
// stand-in figure.
export async function fetchAchievementCountsByUserIds(userIds) {
  if (!supabase || !userIds || !userIds.length) return {};
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from("user_achievements")
    .select("id, user_id")
    .in("user_id", ids);
  if (error) { console.warn("Achievement counts fetch warning:", error); return {}; }
  const counts = {};
  for (const row of data || []) {
    counts[row.user_id] = (counts[row.user_id] || 0) + 1;
  }
  return counts;
}

// Which cohort each learner belongs to, for the leaderboard's "Batch"
// column. Two steps because cohort_members carries only cohort_id.
export async function fetchCohortNamesByUserIds(userIds) {
  if (!supabase || !userIds || !userIds.length) return {};
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return {};
  const { data: memberRows, error } = await supabase
    .from("cohort_members")
    .select("user_id, cohort_id")
    .in("user_id", ids);
  if (error) { console.warn("Cohort names fetch warning:", error); return {}; }
  const cohortIds = [...new Set((memberRows || []).map((m) => m.cohort_id).filter(Boolean))];
  if (!cohortIds.length) return {};
  const { data: cohorts } = await supabase.from("cohorts").select("id, name").in("id", cohortIds);
  const nameById = Object.fromEntries((cohorts || []).map((c) => [c.id, c.name]));
  return Object.fromEntries((memberRows || []).map((m) => [m.user_id, nameById[m.cohort_id] || null]));
}

/**
 * Everything the leaderboard rows display beyond what the leaderboard RPC
 * itself returns: profile (role/department/avatar), courses completed,
 * badge count, cohort name. One call per column-group, batched across all
 * ranked learners rather than per row.
 */
export async function fetchLeaderboardExtras(userIds) {
  if (!supabase || !userIds || !userIds.length) return {};
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return {};
  const [profiles, stats, badgeCounts, cohortNames] = await Promise.all([
    fetchProfilesByIds(ids),
    fetchGamificationStatsWithProgress(ids),
    fetchAchievementCountsByUserIds(ids),
    fetchCohortNamesByUserIds(ids),
  ]);
  return Object.fromEntries(ids.map((id) => [id, {
    displayName: profiles[id]?.display_name || null,
    avatarUrl: profiles[id]?.avatar_url || null,
    role: profiles[id]?.role || null,
    department: profiles[id]?.department || null,
    coursesCompleted: stats[id]?.courses_completed ?? 0,
    badgesCount: badgeCounts[id] ?? 0,
    cohortName: cohortNames[id] || null,
  }]));
}

/**
 * The learner's own upcoming 1-on-1 sessions for the Schedule screen.
 *
 * fetchUpcomingLearnerSessions in schemaHelper.js already reads the same
 * rows, but resolves the mentor's profile through a lookup keyed on a
 * `user_profiles.user_id` column that does not exist, so every session came
 * back without a facilitator name. This resolves the profile by `id`.
 */
export async function fetchLearnerScheduleSessions(learnerId) {
  if (!supabase || !learnerId) return [];
  const { data, error } = await supabase
    .from("mentorship_sessions")
    .select("id, title, description, scheduled_at, duration_minutes, status, meeting_url, mentor_id, mentors(id, user_id, title)")
    .eq("learner_id", learnerId)
    .gte("scheduled_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
    .order("scheduled_at", { ascending: true });
  if (error) { console.warn("Learner schedule sessions fetch warning:", error); return []; }
  const rows = data || [];
  const profiles = await fetchProfilesByIds(rows.map((r) => r.mentors?.user_id));
  return rows.map((r) => ({
    ...r,
    facilitatorName: profiles[r.mentors?.user_id]?.display_name || null,
    facilitatorAvatarUrl: profiles[r.mentors?.user_id]?.avatar_url || null,
    facilitatorTitle: r.mentors?.title || null,
  }));
}

// Cohort sessions plus the real facilitator behind `created_by`. The plain
// fetchCohortSessions selects the row only, which is why the cohort session
// cards fell back to a hardcoded instructor name and avatar.
export async function fetchCohortSessionsWithFacilitator(cohortId) {
  if (!supabase || !cohortId) return [];
  const { data, error } = await supabase
    .from("cohort_sessions")
    .select("id, title, description, starts_at, join_url, recording_url, created_by, cohort_id")
    .eq("cohort_id", cohortId)
    .order("starts_at", { ascending: true });
  if (error) { console.warn("Cohort sessions (with facilitator) fetch warning:", error); return []; }
  const rows = data || [];
  const profiles = await fetchProfilesByIds(rows.map((r) => r.created_by));
  return rows.map((r) => ({
    ...r,
    facilitatorName: profiles[r.created_by]?.display_name || null,
    facilitatorAvatarUrl: profiles[r.created_by]?.avatar_url || null,
  }));
}

/**
 * The learner's real AI Coach conversations, with a message count and the
 * first user message as a snippet - the AI chat history sidebar was a
 * useState array of invented threads and selecting one only fired a toast.
 * Two queries (conversations, then their messages) because the count and
 * snippet both come from `ai_messages`.
 */
export async function fetchMyAIConversations(userId, limit = 20) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, title, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) { console.warn("AI conversations fetch warning:", error); return []; }
  const rows = data || [];
  if (!rows.length) return [];
  const { data: messages, error: msgErr } = await supabase
    .from("ai_messages")
    .select("id, conversation_id, role, content, created_at")
    .in("conversation_id", rows.map((r) => r.id))
    .order("created_at", { ascending: true });
  if (msgErr) console.warn("AI conversation messages fetch warning:", msgErr);
  const byConversation = {};
  for (const m of messages || []) {
    if (!byConversation[m.conversation_id]) byConversation[m.conversation_id] = [];
    byConversation[m.conversation_id].push(m);
  }
  return rows.map((r) => {
    const msgs = byConversation[r.id] || [];
    const firstUserMessage = msgs.find((m) => m.role === "user") || msgs[0] || null;
    return {
      ...r,
      messagesCount: msgs.length,
      snippet: firstUserMessage?.content || null,
      lastMessageAt: msgs.length ? msgs[msgs.length - 1].created_at : r.created_at,
    };
  });
}

// "New Conversation" previously only prepended a row to local state. This
// writes a real ai_conversations row so the thread survives a reload and
// its messages have somewhere to land.
export async function createAIConversation(userId, title = "New AI Learning Session") {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({ user_id: userId, title })
    .select()
    .single();
  if (error) { console.warn("AI conversation create warning:", error); return null; }
  return data;
}
