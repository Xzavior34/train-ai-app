// Static catalog of achievement *definitions* - id, title, description,
// category and the threshold that unlocks it. This mirrors the same catalog
// the live backend's achievement-awarding logic checks against (same ids,
// thresholds and categories), so a learner's earned rows in the real
// `user_achievements` table (achievement_id column) line up with entries
// here. There's no separate "achievement catalog" table the learner app
// reads for this - the source of truth for *earned* achievements is always
// `user_achievements`; this file only supplies the locked/not-yet-earned
// side (title, description, and how close the learner is) since that has
// nowhere else to come from.
export const ACHIEVEMENT_CATALOG = [
  { id: "first_lesson", title: "First Steps", description: "Complete your first lesson", category: "completion", threshold: 1, points: 10 },
  { id: "five_lessons", title: "Dedicated Learner", description: "Complete 5 lessons", category: "completion", threshold: 5, points: 50 },
  { id: "ten_lessons", title: "Knowledge Seeker", description: "Complete 10 lessons", category: "completion", threshold: 10, points: 100 },
  { id: "first_course", title: "Course Completer", description: "Complete your first course", category: "completion", threshold: 1, points: 100 },
  { id: "five_courses", title: "Course Master", description: "Complete 5 courses", category: "completion", threshold: 5, points: 500 },
  { id: "ten_courses", title: "Learning Champion", description: "Complete 10 courses", category: "completion", threshold: 10, points: 1000 },

  { id: "three_day_streak", title: "3-Day Streak", description: "Learn for 3 consecutive days", category: "streak", threshold: 3, points: 30 },
  { id: "week_streak", title: "Week Warrior", description: "Learn for 7 consecutive days", category: "streak", threshold: 7, points: 70 },
  { id: "two_week_streak", title: "Consistency King", description: "Learn for 14 consecutive days", category: "streak", threshold: 14, points: 140 },
  { id: "month_streak", title: "Monthly Master", description: "Learn for 30 consecutive days", category: "streak", threshold: 30, points: 300 },

  { id: "hundred_points", title: "Century", description: "Earn 100 points", category: "mastery", threshold: 100, points: 10 },
  { id: "five_hundred_points", title: "Point Master", description: "Earn 500 points", category: "mastery", threshold: 500, points: 50 },
  { id: "thousand_points", title: "Elite Learner", description: "Earn 1000 points", category: "mastery", threshold: 1000, points: 100 },
  { id: "level_five", title: "Level 5 Legend", description: "Reach level 5", category: "mastery", threshold: 5, points: 50 },
  { id: "level_ten", title: "Level 10 Hero", description: "Reach level 10", category: "mastery", threshold: 10, points: 100 },

  { id: "first_session", title: "First Session", description: "Complete your first mentorship session", category: "social", threshold: 1, points: 25 },
  { id: "session_regular", title: "Session Regular", description: "Complete 5 mentorship sessions", category: "social", threshold: 5, points: 75 },
  { id: "session_master", title: "Session Master", description: "Complete 10 mentorship sessions", category: "social", threshold: 10, points: 150 },
];

// `stats` is the same shape `user_gamification_stats` returns (plus the
// derived `level` already computed elsewhere): total_points, streak_days,
// lessons_completed, courses_completed, sessions_completed, level.
export function getAchievementProgress(def, stats = {}) {
  let current = 0;
  if (def.category === "completion") {
    current = def.id.includes("course") ? (stats.coursesCompleted || 0) : (stats.lessonsCompleted || 0);
  } else if (def.category === "streak") {
    current = stats.streak || 0;
  } else if (def.category === "mastery") {
    current = def.id.includes("points") ? (stats.totalPoints || 0) : (stats.level || 1);
  } else if (def.category === "social") {
    current = stats.sessionsCompleted || 0;
  }
  const threshold = def.threshold || 1;
  return {
    current,
    threshold,
    percent: Math.max(0, Math.min(100, Math.round((current / threshold) * 100))),
  };
}
