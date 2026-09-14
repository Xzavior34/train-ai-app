import { supabase } from "../supabaseClient.js";

// Retention/growth "nudge" data helpers.
//
// DailyLoginReward is backed by a real table in the shared Supabase schema
// - `daily_login_rewards` - confirmed against the live schema's generated
// types. Daily challenges (a second nudge, `daily_challenges`) were removed
// per the product brief; see the note further down.
//
// The other three nudges (ComebackBanner, AlmostThereNudge, WeeklyLeagueCard)
// are pure derivations from data the app already fetches elsewhere
// (gamification stats, achievement catalog, leaderboard RPC) and so have no
// data functions here - see the components themselves.

const todayISODate = () => new Date().toISOString().split("T")[0];
const isoDateDaysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().split("T")[0];

// 7-day reward ladder, capped low on purpose - this is a login nudge, not a
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
// uses for awarding points - there's no separate "award points" RPC in
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

// Daily challenges removed per the product brief ("Features Removed:
// Daily challenges"). fetchOrCreateTodayChallenge / tabForChallengeType /
// completeTodayChallenge and their DAILY_CHALLENGE_TEMPLATES used to live
// here, backing DailyChallengeCard.jsx - which, on inspection, was never
// actually imported or rendered anywhere in the app. Removed together
// rather than leaving one half of an already-dead feature behind. The
// `daily_challenges` table itself is left alone (not dropped) - this is a
// frontend/feature removal, not a data-retention decision, and GDPR export/
// deletion (gdprService.js) still correctly covers it for any legacy rows.

