import { supabase } from "../supabaseClient.js";

// Retention/growth "nudge" data helpers.
//
// Two of the five nudge components (DailyLoginReward, DailyChallengeCard)
// are backed by real tables that exist in the shared Supabase schema —
// `daily_login_rewards` and `daily_challenges` — confirmed against the
// live schema's generated types (both tables carry a `user_id` +
// per-day date column + points/reward columns, exactly like every other
// real gamification table this app already reads). Nothing here is a new
// invented table; these two already exist alongside `user_gamification_stats`,
// `user_achievements` and `streak_tracking`.
//
// The other three nudges (ComebackBanner, AlmostThereNudge, WeeklyLeagueCard)
// are pure derivations from data the app already fetches elsewhere
// (gamification stats, achievement catalog, leaderboard RPC) and so have no
// data functions here — see the components themselves.

const todayISODate = () => new Date().toISOString().split("T")[0];
const isoDateDaysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().split("T")[0];

// 7-day reward ladder, capped low on purpose — this is a login nudge, not a
// currency system. Mirrors the shape of the reference app's own ladder
// (day -> points), just smaller since this app's "points" already feed
// straight into `user_gamification_stats.total_points` (no separate credits
// wallet concept here).
export const DAILY_LOGIN_REWARD_LADDER = [
  { day: 1, points: 5, bonus: null },
  { day: 2, points: 8, bonus: null },
  { day: 3, points: 10, bonus: null },
  { day: 4, points: 12, bonus: null },
  { day: 5, points: 15, bonus: null },
  { day: 6, points: 15, bonus: null },
  { day: 7, points: 20, bonus: "Streak freeze" },
];

// Reads the learner's most recent `daily_login_rewards` row and works out
// whether today's reward is already claimed and which day of the 7-day
// cycle they're on next (same "claimed yesterday -> continue, missed a day
// -> reset to day 1" logic used elsewhere in this app's gamification data).
export async function fetchDailyLoginRewardState(userId) {
  if (!supabase || !userId) return { todayClaimed: false, nextDay: 1, lastClaimedDate: null };
  const { data, error } = await supabase
    .from("daily_login_rewards")
    .select("claimed_date, day_in_cycle")
    .eq("user_id", userId)
    .order("claimed_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("Daily login reward state fetch warning:", error);
    return { todayClaimed: false, nextDay: 1, lastClaimedDate: null };
  }
  if (!data) return { todayClaimed: false, nextDay: 1, lastClaimedDate: null };

  const today = todayISODate();
  const yesterday = isoDateDaysAgo(1);
  const todayClaimed = data.claimed_date === today;
  let nextDay = 1;
  if (data.claimed_date === today) {
    nextDay = data.day_in_cycle;
  } else if (data.claimed_date === yesterday) {
    nextDay = data.day_in_cycle >= 7 ? 1 : data.day_in_cycle + 1;
  }
  return { todayClaimed, nextDay, lastClaimedDate: data.claimed_date };
}

// Claims today's login reward: inserts the `daily_login_rewards` row and
// credits the points straight onto `user_gamification_stats.total_points`
// (same direct upsert pattern `markLessonComplete` in learner.js already
// uses for awarding points — there's no separate "award points" RPC in
// this schema).
export async function claimDailyLoginReward(userId, dayInCycle) {
  if (!supabase || !userId) return null;
  const rung = DAILY_LOGIN_REWARD_LADDER[Math.min(Math.max(dayInCycle, 1), 7) - 1];
  const today = todayISODate();

  const { error: insertErr } = await supabase.from("daily_login_rewards").insert({
    user_id: userId,
    claimed_date: today,
    day_in_cycle: dayInCycle,
    points_awarded: rung.points,
    bonus_reward: rung.bonus,
  });
  if (insertErr) {
    console.warn("Daily login reward claim warning:", insertErr);
    return null;
  }

  try {
    const { data: stats } = await supabase
      .from("user_gamification_stats")
      .select("total_points, streak_freezes_available")
      .eq("user_id", userId)
      .maybeSingle();
    const freezeBonus = dayInCycle >= 7 ? 1 : 0;
    await supabase.from("user_gamification_stats").upsert(
      {
        user_id: userId,
        total_points: (stats?.total_points || 0) + rung.points,
        streak_freezes_available: (stats?.streak_freezes_available || 0) + freezeBonus,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  } catch (e) {
    console.warn("Gamification stats sync warning (daily login reward):", e);
  }

  return rung;
}

// Rotating set of small, honest daily tasks — each maps to something the
// learner can actually go do right now in this app (no feature here points
// at anything that doesn't exist, e.g. no "streak" deep link since there's
// no dedicated streak screen).
const DAILY_CHALLENGE_TEMPLATES = [
  { type: "lesson", title: "Complete 1 lesson today", description: "Keep your momentum going.", points: 25, tab: "courses" },
  { type: "quiz", title: "Take an AI quiz today", description: "Test what you've learned so far.", points: 20, tab: "ai" },
  { type: "community", title: "Reply to a community post", description: "Help a fellow learner out.", points: 15, tab: "community" },
  { type: "explore", title: "Browse a new course", description: "Discover your next topic.", points: 15, tab: "courses" },
  { type: "mentor", title: "Check out a mentor", description: "See who could help you level up.", points: 15, tab: "mentors" },
  { type: "lesson", title: "Complete 1 lesson today", description: "Keep your momentum going.", points: 25, tab: "courses" },
  { type: "quiz", title: "Take an AI quiz today", description: "Test what you've learned so far.", points: 20, tab: "ai" },
];

// Gets (or creates) today's `daily_challenges` row for this learner. One
// row per user per day — real table, same get-or-create-for-today shape
// `useDailyChallenge` uses in the reference app.
export async function fetchOrCreateTodayChallenge(userId) {
  if (!supabase || !userId) return null;
  const today = todayISODate();

  const { data: existing, error: existingErr } = await supabase
    .from("daily_challenges")
    .select("*")
    .eq("user_id", userId)
    .eq("challenge_date", today)
    .maybeSingle();
  if (existingErr) {
    console.warn("Daily challenge fetch warning:", existingErr);
    return null;
  }
  if (existing) return existing;

  const template = DAILY_CHALLENGE_TEMPLATES[new Date().getDay() % DAILY_CHALLENGE_TEMPLATES.length];
  const { data: created, error: createErr } = await supabase
    .from("daily_challenges")
    .insert({
      user_id: userId,
      challenge_date: today,
      challenge_type: template.type,
      challenge_title: template.title,
      challenge_description: template.description,
      target_value: 1,
      points_reward: template.points,
    })
    .select()
    .maybeSingle();
  if (createErr) {
    console.warn("Daily challenge create warning:", createErr);
    return null;
  }
  return created ? { ...created, _tab: template.tab } : null;
}

export function tabForChallengeType(challengeType) {
  const template = DAILY_CHALLENGE_TEMPLATES.find((t) => t.type === challengeType);
  return template?.tab || "courses";
}

// Marks today's challenge complete and credits its points the same direct
// way `claimDailyLoginReward` does above.
export async function completeTodayChallenge(userId, challenge) {
  if (!supabase || !userId || !challenge || challenge.is_completed) return null;
  const timestamp = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from("daily_challenges")
    .update({ is_completed: true, current_progress: challenge.target_value, completed_at: timestamp })
    .eq("id", challenge.id);
  if (updateErr) {
    console.warn("Daily challenge complete warning:", updateErr);
    return null;
  }

  try {
    const { data: stats } = await supabase
      .from("user_gamification_stats")
      .select("total_points")
      .eq("user_id", userId)
      .maybeSingle();
    await supabase
      .from("user_gamification_stats")
      .upsert(
        { user_id: userId, total_points: (stats?.total_points || 0) + (challenge.points_reward || 0), updated_at: timestamp },
        { onConflict: "user_id" }
      );
  } catch (e) {
    console.warn("Gamification stats sync warning (daily challenge):", e);
  }

  return { ...challenge, is_completed: true, current_progress: challenge.target_value };
}
