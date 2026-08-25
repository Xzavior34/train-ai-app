import { supabase } from "../supabaseClient.js";
import { fetchProfilesByUserIds } from "./schemaHelper.js";
import { ACHIEVEMENT_CATALOG } from "../../learner/achievementCatalog.js";

export async function fetchPublishedCourses() {
  if (!supabase) {
    const now = new Date().toISOString();
    return [
      {
        id: "demo-course-ai-fundamentals", title: "AI Fundamentals", description: "An introduction to core AI concepts for the workplace.",
        category: "AI", level: "beginner", duration_hours: 4, course_source: "internal", is_published: true, is_approved: true,
        is_mandatory: false, price: 0, requires_approval: false, created_at: now,
      },
      {
        id: "demo-course-compliance-101", title: "Workplace Compliance 101", description: "Mandatory compliance training covering core policies.",
        category: "Compliance", level: "beginner", duration_hours: 2, course_source: "internal", is_published: true, is_approved: true,
        is_mandatory: true, price: 0, requires_approval: false, created_at: now,
      },
      {
        id: "demo-course-external-leadership", title: "Leadership Essentials", description: "A curated external course on foundational leadership skills.",
        category: "Leadership", level: "intermediate", duration_hours: 6, course_source: "external", is_published: true, is_approved: true,
        is_mandatory: false, price: 0, requires_approval: false, created_at: now,
      },
    ];
  }
  try {
    let { data, error } = await supabase
      .from("courses")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false });
    if (!error && data && data.length > 0) {
      return data;
    }
    // Fallback if is_published filter or order had issue
    const { data: allCourses } = await supabase.from("courses").select("*");
    return allCourses || [];
  } catch (e) {
    console.warn("Could not fetch published courses:", e);
    return [];
  }
}

export async function fetchMyEnrollments(userId) {
  if (!supabase) {
    // A real, confirmed gap: fetchPublishedCourses() already had demo
    // fixtures, but nothing enrolled the demo learner in any of them -
    // meaning "enrolled" was always false and progress was always 0/hidden,
    // regardless of the course catalog itself being populated. This is
    // what actually backs the "Assigned to Me" course tab and the home
    // page's "Courses in progress" list in demo mode.
    const now = new Date().toISOString();
    return [
      { course_id: "demo-course-ai-fundamentals", user_id: userId, progress_percentage: 65, completed_at: null, enrolled_at: now },
      { course_id: "demo-course-external-leadership", user_id: userId, progress_percentage: 100, completed_at: now, enrolled_at: now },
      { course_id: "demo-course-compliance-101", user_id: userId, progress_percentage: 30, completed_at: null, enrolled_at: now },
    ];
  }
  if (!userId) return [];
  const { data, error } = await supabase
    .from("course_enrollments")
    .select("*")
    .eq("user_id", userId);
  if (error) {
    console.warn("Could not fetch enrollments:", error);
    return [];
  }
  return data || [];
}

export async function enrollInCourse(userId, courseId) {
  if (!supabase || !userId) return;
  const { error } = await supabase
    .from("course_enrollments")
    .upsert({ user_id: userId, course_id: courseId, enrolled_at: new Date().toISOString(), progress_percentage: 0 }, { onConflict: "user_id,course_id" });
  if (error) console.warn("Enrollment error:", error);
}

// "Apply for a course" - for courses flagged courses.requires_approval, a
// learner requests to join instead of enrolling instantly, and course staff
// (instructor/owner or admin) approve or reject it (see course_applications
// table + decideCourseApplication in platform.js). Upserts on the real
// (user_id, course_id) unique constraint so re-applying after a rejection
// (allowed by the course_applications_learner_reapply RLS policy) just
// flips the existing row back to pending instead of erroring.
export async function requestCourseApplication({ userId, courseId, message }) {
  if (!supabase || !userId || !courseId) return null;
  const { data, error } = await supabase
    .from("course_applications")
    .upsert(
      { user_id: userId, course_id: courseId, message: message || null, status: "pending", reviewed_by: null, reviewed_at: null },
      { onConflict: "user_id,course_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchMyCourseApplications(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("course_applications")
    .select("*")
    .eq("user_id", userId);
  if (error) { console.warn("Could not fetch course applications:", error); return []; }
  return data || [];
}

export async function fetchLessonsForCourse(courseId) {
  if (!supabase || !courseId) return [];
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .order("order_index", { ascending: true });
  if (error) {
    console.warn("Could not fetch lessons:", error);
    return [];
  }
  return data || [];
}

export async function fetchMyLessonProgress(userId, lessonIds) {
  if (!supabase || !userId || !lessonIds || lessonIds.length === 0) return [];
  const { data, error } = await supabase
    .from("lesson_progress")
    .select("*")
    .eq("user_id", userId)
    .in("lesson_id", lessonIds);
  if (error) {
    console.warn("Could not fetch lesson progress:", error);
    return [];
  }
  return data || [];
}

export async function markLessonComplete(userId, lessonId, courseId = null) {
  if (!supabase || !userId || !lessonId) return;

  const timestamp = new Date().toISOString();

  // 1. Sync to lesson_progress table
  const { error: lpErr } = await supabase
    .from("lesson_progress")
    .upsert(
      { user_id: userId, lesson_id: lessonId, is_completed: true, completed_at: timestamp },
      { onConflict: "user_id,lesson_id" }
    );
  if (lpErr) console.warn("lesson_progress sync warning:", lpErr);

  // 2. Recalculate and update course enrollment progress
  // (there is no separate `user_progress` table in this schema - course
  // completion % is derived straight from lesson_progress + course
  // enrollment, which is all that's needed here)
  if (courseId) {
    try {
      const { data: allLessons } = await supabase.from("lessons").select("id").eq("course_id", courseId);
      const { data: doneLessons } = await supabase.from("lesson_progress").select("lesson_id").eq("user_id", userId).eq("is_completed", true);
      
      const total = allLessons?.length || 1;
      const completedCount = doneLessons ? doneLessons.filter(l => allLessons?.some(al => al.id === l.lesson_id)).length : 1;
      const percentage = Math.min(100, Math.round((completedCount / total) * 100));

      await supabase
        .from("course_enrollments")
        .update({ progress_percentage: percentage, updated_at: timestamp, ...(percentage === 100 ? { completed_at: timestamp } : {}) })
        .eq("user_id", userId)
        .eq("course_id", courseId);
    } catch (e) {
      console.warn("Enrollment progress calculation warning:", e);
    }
  }

  // 3. Update user gamification stats
  try {
    const { data: stats } = await supabase.from("user_gamification_stats").select("*").eq("user_id", userId).maybeSingle();
    const currentPoints = stats?.total_points || 0;
    const currentLessons = stats?.lessons_completed || 0;
    
    await supabase
      .from("user_gamification_stats")
      .upsert({
        user_id: userId,
        total_points: currentPoints + 50,
        lessons_completed: currentLessons + 1,
        updated_at: timestamp
      }, { onConflict: "user_id" });
  } catch (e) {
    console.warn("Gamification stats sync warning:", e);
  }
}

export async function fetchSafeQuizQuestions(quizId) {
  if (!supabase || !quizId) return [];
  const { data, error } = await supabase
    .from("safe_quiz_questions")
    .select("*")
    .eq("quiz_id", quizId)
    .order("order_index", { ascending: true });
  if (error) return [];
  return data || [];
}

export async function submitQuizAnswers(quizId, answersByQuestionId, userId = null, timeSpentMinutes = null) {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("check_quiz_answers", {
    p_quiz_id: quizId,
    p_answers: answersByQuestionId,
  });
  if (error) throw error;
  const result = data?.[0] || null;

  // Persist the attempt so quiz history / weak-area insights have something
  // real to read from (the RPC only scores - it doesn't record history).
  if (userId && result) {
    try {
      await supabase.from("quiz_attempts").insert({
        user_id: userId,
        quiz_id: quizId,
        answers: answersByQuestionId,
        completed_at: new Date().toISOString(),
        score: result.score,
        correct_answers: result.correct_count,
        wrong_answers: result.total != null && result.correct_count != null ? result.total - result.correct_count : null,
        total_points: result.total_points,
        time_spent_minutes: timeSpentMinutes,
      });
    } catch (e) {
      console.warn("Quiz attempt record warning:", e);
    }
  }

  return result;
}

// Awards points for a completed AI-generated quiz (see generateAIQuiz in
// schemaHelper.js) using the same direct upsert onto the real
// `user_gamification_stats` table that markLessonComplete (above) and
// retention.js's claimDailyLoginReward/completeTodayChallenge already use
// for activities that have no dedicated points-awarding RPC. An
// AI-generated quiz has no row in `quizzes`, so there's no quiz_id to
// insert a `quiz_attempts` row against (that table's quiz_id is a real FK
// into `quizzes`) - this intentionally only touches the stats table, and
// only when points are actually owed (never a fabricated write for a
// mismatched/failed attempt).
export async function awardAIQuizCompletionPoints(userId, points) {
  if (!supabase || !userId || !points) return;
  try {
    const { data: stats } = await supabase.from("user_gamification_stats").select("total_points").eq("user_id", userId).maybeSingle();
    const currentPoints = stats?.total_points || 0;
    await supabase
      .from("user_gamification_stats")
      .upsert({ user_id: userId, total_points: currentPoints + points, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  } catch (e) {
    console.warn("AI quiz points award warning:", e);
  }
}

export async function fetchAvailableQuizzes() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("quizzes")
    .select("*, courses(title)")
    .eq("is_published", true)
    .order("title", { ascending: true });
  if (error) { console.warn("Quizzes fetch warning:", error); return []; }
  return data || [];
}

export async function fetchMyQuizAttempts(userId, limit = 10) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("*, quizzes(title)")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (error) { console.warn("Quiz attempts fetch warning:", error); return []; }
  return data || [];
}

export async function fetchLeaderboard(limit = 50) {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc("get_leaderboard_with_profiles", { p_limit: limit });
    if (!error && data && data.length > 0) return data;
  } catch (e) {
    console.warn("RPC leaderboard fetch warning:", e);
  }
  // Direct table query fallback for when RPC is not created yet
  try {
    const { data: stats, error: statsError } = await supabase
      .from("user_gamification_stats")
      .select("user_id, total_points, streak_days, current_level, lessons_completed, courses_completed")
      .order("total_points", { ascending: false })
      .limit(limit);
    if (!statsError && stats && stats.length > 0) {
      const userIds = stats.map(s => s.user_id).filter(Boolean);
      const profiles = await fetchProfilesByUserIds(userIds);
      return stats.map(s => {
        const prof = profiles[s.user_id] || {};
        return {
          user_id: s.user_id,
          display_name: prof.display_name || prof.name || "Learner",
          avatar_url: prof.avatar_url || null,
          role: prof.role || "Specialist",
          school: prof.school || prof.department || "Active Batch",
          cohort_name: prof.cohort_name || "Active Batch",
          total_points: s.total_points || 0,
          streak: s.streak_days || 1,
          completed_courses: s.courses_completed || 0,
          badges_count: Math.max(1, Math.floor((s.total_points || 0) / 400)),
        };
      });
    }
  } catch (e) {
    console.warn("Direct leaderboard query warning:", e);
  }
  return [];
}

export async function fetchMyGamificationStats(userId) {
  if (!supabase) {
    return {
      user_id: userId, current_level: 3, total_points: 620, streak_days: 8, streak_freezes_available: 1,
      lessons_completed: 12, courses_completed: 1, sessions_completed: 2,
    };
  }
  if (!userId) return null;
  const { data, error } = await supabase
    .from("user_gamification_stats")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return data;
}

// Achievements the learner has actually earned (real `user_achievements`
// rows: id, user_id, achievement_id, achievement_title, achievement_description,
// achievement_icon, points_awarded, earned_at). The full catalog of
// achievement *definitions* (thresholds to unlock each one) isn't a DB
// table the learner app queries - it mirrors the same static catalog the
// live backend's achievement-awarding logic uses (see
// src/learner/achievementCatalog.js), matched here by achievement_id.
export async function fetchMyAchievements(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("my_achievements_with_slug")
    .select("*")
    .order("earned_at", { ascending: false });
  if (!error && data) return data;
  const fallback = await supabase
    .from("user_achievements")
    .select("*")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false });
  if (fallback.error) return [];
  return fallback.data || [];
}

// Daily activity/points log backing the streak (real `streak_tracking`
// table: user_id, activity_date, lessons_completed, points_earned). Used
// for the "recent activity" breakdown on the achievements screen.
export async function fetchMyStreakActivity(userId, limit = 14) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("streak_tracking")
    .select("*")
    .eq("user_id", userId)
    .order("activity_date", { ascending: false })
    .limit(limit);
  if (error) { console.warn("Streak activity fetch warning:", error); return []; }
  return data || [];
}

export async function fetchMyNotifications(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("real_notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data || [];
}

export async function markNotificationRead(notificationId) {
  if (!supabase || !notificationId) return;
  await supabase
    .from("real_notifications")
    .update({ is_read: true })
    .eq("id", notificationId);
}

// Published lesson counts per course, for the course catalog/cards (one
// round trip instead of N queries - no lesson-count column on courses).
export async function fetchPublishedLessonCounts() {
  if (!supabase) return {};
  const { data, error } = await supabase.from("lessons").select("course_id").eq("is_published", true);
  if (error) { console.warn("Lesson counts fetch warning:", error); return {}; }
  const counts = {};
  for (const row of data || []) counts[row.course_id] = (counts[row.course_id] || 0) + 1;
  return counts;
}

// Course review averages/counts per course (course_reviews has no
// aggregate view yet, so this aggregates client-side from the raw rows).
export async function fetchCourseReviewSummaries() {
  if (!supabase) return {};
  const { data, error } = await supabase.from("course_reviews").select("course_id, rating");
  if (error) { console.warn("Course reviews fetch warning:", error); return {}; }
  const summaries = {};
  for (const row of data || []) {
    if (!summaries[row.course_id]) summaries[row.course_id] = { total: 0, count: 0 };
    summaries[row.course_id].total += row.rating;
    summaries[row.course_id].count += 1;
  }
  const result = {};
  for (const [courseId, s] of Object.entries(summaries)) {
    result[courseId] = { avg: s.total / s.count, count: s.count };
  }
  return result;
}

export async function fetchCourseReviews(courseId) {
  if (!supabase || !courseId) return [];
  // course_reviews.user_id has no declared FK to user_profiles (it points at
  // auth.users), so PostgREST can't auto-embed a reviewer profile - fetch it
  // separately and attach it under the same `user_profiles` key the UI reads.
  const { data, error } = await supabase
    .from("course_reviews")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });
  if (error) { console.warn("Course reviews list fetch warning:", error); return []; }
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.user_id));
  return rows.map((r) => ({ ...r, user_profiles: profiles[r.user_id] || null }));
}

// Lesson timestamp notes (lesson_notes table)
export async function fetchLessonNotes(userId, lessonId) {
  if (!supabase || !userId || !lessonId) return [];
  const { data, error } = await supabase
    .from("lesson_notes")
    .select("*")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .order("timestamp_seconds", { ascending: true });
  if (error) { console.warn("Lesson notes fetch warning:", error); return []; }
  return data || [];
}

export async function addLessonNote({ userId, lessonId, timestampSeconds, content }) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("lesson_notes")
    .insert({ user_id: userId, lesson_id: lessonId, timestamp_seconds: timestampSeconds, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Course-level notes (course_notes table)
export async function fetchCourseNotes(userId, courseId) {
  if (!supabase || !userId || !courseId) return [];
  const { data, error } = await supabase
    .from("course_notes")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .order("updated_at", { ascending: false });
  if (error) { console.warn("Course notes fetch warning:", error); return []; }
  return data || [];
}

export async function addCourseNote({ userId, courseId, content }) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("course_notes")
    .insert({ user_id: userId, course_id: courseId, content, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Course discussion (general Q&A thread per course).
//
// The real schema's `course_discussions` table has no "container" row /
// `is_general` flag and no separate messages table for it - every row IS a
// question/comment (content, title, user_id, parent_id for threading). Its
// `course_discussion_messages` table exists instead for `course_mentor_discussions`
// (1:1 mentor<->learner support threads), which is a different feature.
// So there is no DB-level "discussion container" to fetch/create here; we
// just use the courseId itself as the discussion identifier and treat
// `course_discussions` rows for that course as the flat message list, while
// keeping the same `{ discussion, messages }` / `{id, sender_id, content,
// user_profiles }` shapes the UI already expects.
export async function fetchOrCreateCourseDiscussion(courseId) {
  if (!courseId) return null;
  return { id: courseId };
}

export async function fetchCourseDiscussionMessages(discussionId) {
  if (!supabase || !discussionId) return [];
  const { data, error } = await supabase
    .from("course_discussions")
    .select("*")
    .eq("course_id", discussionId)
    .order("created_at", { ascending: true });
  if (error) { console.warn("Course discussion messages fetch warning:", error); return []; }
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.user_id));
  return rows.map((r) => ({
    id: r.id,
    sender_id: r.user_id,
    content: r.content,
    created_at: r.created_at,
    user_profiles: profiles[r.user_id] || null,
  }));
}

export async function postCourseDiscussionMessage({ discussionId, senderId, content, isQuestion = true }) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("course_discussions")
    .insert({
      course_id: discussionId,
      user_id: senderId,
      content,
      title: content.slice(0, 80) || "Question",
      is_question: isQuestion,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* ==========================================================================
   Learning paths. Real `learning_paths` / `learning_path_courses` /
   `learning_path_enrollments` tables (confirmed against the shared schema),
   distinct from individual courses. The admin-side builder for these
   already exists (fetchLearningPathsAdmin/createLearningPath/
   updateLearningPath in lib/api/platform.js) but the learner app had no read
   surface for them at all: CoursesScreen.jsx's "Learning Paths" card
   pushes to a `screen === "paths"` that TrainAILearnerApp.jsx never
   rendered anything for. These functions back the new LearningPathsScreen
   that fills that gap.
   ========================================================================= */

export async function fetchPublishedLearningPaths(organizationId) {
  if (!supabase) return [];
  let query = supabase
    .from("learning_paths")
    .select("*, learning_path_courses(*, courses(id, title, description, level, category, duration_hours, cover_image_url))")
    .eq("is_published", true)
    // learning_paths has no created_at column in this schema (id, title,
    // description, level_label, category, organization_id, created_by,
    // is_published). Ordering on it made PostgREST reject the entire query,
    // so every learning-path list came back empty - which is exactly why the
    // admin Learning Paths screen showed nothing at all. Ordered by title
    // instead, which is a real column and gives a stable, readable order.
    .order("title", { ascending: true });
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) { console.warn("Learning paths fetch warning:", error); return []; }
  return (data || []).map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description || "",
    category: p.category || null,
    level: p.level_label || "beginner",
    courses: (p.learning_path_courses || [])
      .sort((a, b) => a.order_index - b.order_index)
      .map((pc) => ({
        id: pc.course_id,
        pathCourseId: pc.id,
        title: pc.courses?.title || "Course",
        description: pc.courses?.description || "",
        level: pc.courses?.level || null,
        category: pc.courses?.category || null,
        coverImageUrl: pc.courses?.cover_image_url || null,
        hours: pc.courses?.duration_hours || 0,
        isRequired: pc.is_required !== false,
        // These two real columns were dropped by this mapper, which is why a
        // "guided" path rendered as a flat list with nothing gated - the
        // learner side had no rule to evaluate in the first place.
        unlockRule: pc.unlock_rule || "complete_previous",
        prerequisiteCourseIds: pc.prerequisite_course_ids || [],
        orderIndex: pc.order_index ?? 0,
      })),
  }));
}

/**
 * Resolves one path's steps against a learner's real course progress and
 * returns each step's completed / unlocked / progress state.
 *
 * Unlock semantics follow the schema's two real columns:
 *   - unlock_rule = "complete_previous": step N opens once step N-1 is done
 *   - prerequisite_course_ids: every listed course must be complete
 *   - anything else (including a null rule): open
 * The first step is always open, otherwise a new path is unstartable.
 */
export function resolvePathProgress(path, enrollments = []) {
  const byCourse = new Map();
  for (const e of enrollments || []) {
    byCourse.set(e.course_id, {
      progress: e.progress_percentage || 0,
      completed: !!e.completed_at || (e.progress_percentage || 0) >= 100,
    });
  }
  const steps = (path?.courses || []).map((c, idx, all) => {
    const own = byCourse.get(c.id);
    const isCompleted = !!own?.completed;
    let isUnlocked = true;
    if (c.unlockRule === "complete_previous" && idx > 0) {
      const prev = all[idx - 1];
      isUnlocked = !!byCourse.get(prev.id)?.completed;
    } else if ((c.prerequisiteCourseIds || []).length > 0) {
      isUnlocked = c.prerequisiteCourseIds.every((id) => !!byCourse.get(id)?.completed);
    }
    if (idx === 0) isUnlocked = true;
    return {
      ...c,
      isCompleted,
      isUnlocked,
      isEnrolled: byCourse.has(c.id),
      progress: own?.progress || 0,
      status: isCompleted ? "completed" : own && own.progress > 0 ? "in_progress" : isUnlocked ? "available" : "locked",
    };
  });
  const total = steps.length;
  const completedCount = steps.filter((s) => s.isCompleted).length;
  const totalHours = steps.reduce((sum, s) => sum + (Number(s.hours) || 0), 0);
  return {
    steps,
    total,
    completedCount,
    totalHours,
    overallProgress: total > 0 ? Math.round((completedCount / total) * 100) : 0,
    nextStep: steps.find((s) => s.isUnlocked && !s.isCompleted) || null,
  };
}

/* --------------------------------------------------------------------------
   Learning tracks a learner picks for themselves.

   `user_personalization.learning_tracks` is a real text[] column that
   onboarding writes once and nothing in the app could ever change again -
   a learner had no way to add a track, drop one, or even see which ones were
   on their profile, despite the home screen reading the first entry to label
   their focus area. These functions are that missing surface.

   Track names are course categories - the same aggregate the admin-side
   fetchLearningTracksSummary derives its Learning Tracks list from - so a
   track a learner adds always maps to real, browsable courses rather than a
   free-text label with nothing behind it.
   -------------------------------------------------------------------------- */

export async function fetchAvailableTracks() {
  if (!supabase) {
    return [
      { name: "Data & AI", courses: 6, hours: 24, courseTitles: ["AI Fundamentals"] },
      { name: "Design & UX", courses: 4, hours: 16, courseTitles: [] },
      { name: "Leadership", courses: 3, hours: 12, courseTitles: ["Leadership Essentials"] },
      { name: "Compliance", courses: 2, hours: 5, courseTitles: ["Workplace Compliance 101"] },
    ];
  }
  const { data, error } = await supabase
    .from("courses")
    .select("id, title, category, duration_hours")
    .eq("is_published", true)
    .is("archived_at", null);
  if (error) { console.warn("Available tracks fetch warning:", error); return []; }
  const byCategory = new Map();
  for (const c of data || []) {
    const name = (c.category || "").trim();
    if (!name) continue;
    const bucket = byCategory.get(name) || { name, courses: 0, hours: 0, courseTitles: [] };
    bucket.courses += 1;
    bucket.hours += Number(c.duration_hours) || 0;
    if (bucket.courseTitles.length < 6) bucket.courseTitles.push(c.title);
    byCategory.set(name, bucket);
  }
  return [...byCategory.values()].sort((a, b) => b.courses - a.courses);
}

export async function fetchMyTracks(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("user_personalization")
    .select("learning_tracks")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) { console.warn("My tracks fetch warning:", error); return []; }
  return data?.learning_tracks || [];
}

// Upsert, not update: a learner who skipped onboarding has no
// user_personalization row at all, and a plain update against a missing row
// succeeds while changing nothing - exactly the silent no-op that would make
// an "Add track" button look wired up while doing nothing.
export async function addMyTrack(userId, trackName) {
  if (!supabase || !userId) return { success: false, error: "Not signed in." };
  const name = (trackName || "").trim();
  if (!name) return { success: false, error: "Pick a track first." };
  try {
    const current = await fetchMyTracks(userId);
    if (current.some((t) => (t || "").toLowerCase() === name.toLowerCase())) {
      return { success: false, error: `You're already following ${name}.` };
    }
    const next = [...current, name];
    const { error } = await supabase
      .from("user_personalization")
      .upsert({ user_id: userId, learning_tracks: next }, { onConflict: "user_id" });
    if (error) throw error;
    return { success: true, tracks: next };
  } catch (e) {
    return { success: false, error: e?.message || "Could not add this track." };
  }
}

export async function removeMyTrack(userId, trackName) {
  if (!supabase || !userId) return { success: false, error: "Not signed in." };
  try {
    const current = await fetchMyTracks(userId);
    const next = current.filter((t) => t !== trackName);
    const { error } = await supabase
      .from("user_personalization")
      .upsert({ user_id: userId, learning_tracks: next }, { onConflict: "user_id" });
    if (error) throw error;
    return { success: true, tracks: next };
  } catch (e) {
    return { success: false, error: e?.message || "Could not remove this track." };
  }
}

// Leaving a path. enrollInLearningPath had no counterpart, so a learner who
// started a journey by mistake was stuck with it on their dashboard forever.
export async function leaveLearningPath(userId, pathId) {
  if (!supabase || !userId || !pathId) return { success: false, error: "Missing path." };
  const { error } = await supabase
    .from("learning_path_enrollments")
    .delete()
    .eq("user_id", userId)
    .eq("path_id", pathId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// Keeps the enrollment row honest as a learner works through a path:
// current_course_index drives "resume where I left off", and status /
// completed_at are what dashboard and certificate checks read. Nothing ever
// updated this row after the initial insert, so every enrollment stayed at
// index 0 / in_progress permanently, even for a finished journey.
export async function syncLearningPathProgress(userId, pathId, { currentIndex, isComplete } = {}) {
  if (!supabase || !userId || !pathId) return;
  const patch = { updated_at: new Date().toISOString() };
  if (Number.isFinite(currentIndex)) patch.current_course_index = currentIndex;
  if (isComplete !== undefined) {
    patch.status = isComplete ? "completed" : "in_progress";
    patch.completed_at = isComplete ? new Date().toISOString() : null;
  }
  const { error } = await supabase
    .from("learning_path_enrollments")
    .update(patch)
    .eq("user_id", userId)
    .eq("path_id", pathId);
  if (error) console.warn("Path progress sync warning:", error);
}

export async function fetchMyLearningPathEnrollments(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("learning_path_enrollments")
    .select("*")
    .eq("user_id", userId);
  if (error) { console.warn("Learning path enrollments fetch warning:", error); return []; }
  return data || [];
}

// `learning_path_enrollments` has no declared unique constraint on
// (user_id, path_id) in the shared schema (unlike course_enrollments, whose
// `onConflict: "user_id,course_id"` upsert relies on one that IS confirmed
// there) - so this checks for an existing row first rather than assuming an
// upsert target that may not exist.
export async function enrollInLearningPath(userId, pathId) {
  if (!supabase || !userId || !pathId) return null;
  const { data: existing } = await supabase
    .from("learning_path_enrollments")
    .select("*")
    .eq("user_id", userId)
    .eq("path_id", pathId)
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabase
    .from("learning_path_enrollments")
    .insert({ user_id: userId, path_id: pathId, status: "in_progress", current_course_index: 0 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Course bookmarking (Course UI brief: "Keep: ... Bookmarking. Bookmarked
// courses appear first."). Distinct from enrollment - a learner can
// bookmark a course from the catalog before ever enrolling in it.
export async function fetchMyBookmarks(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase.from("bookmarks").select("course_id").eq("user_id", userId);
  if (error) {
    console.warn("Could not fetch bookmarks:", error);
    return [];
  }
  return (data || []).map((b) => b.course_id);
}

export async function toggleCourseBookmark(userId, courseId, isCurrentlyBookmarked) {
  if (!supabase || !userId || !courseId) return;
  if (isCurrentlyBookmarked) {
    const { error } = await supabase.from("bookmarks").delete().eq("user_id", userId).eq("course_id", courseId);
    if (error) console.warn("Could not remove bookmark:", error);
  } else {
    const { error } = await supabase.from("bookmarks").insert({ user_id: userId, course_id: courseId });
    if (error) console.warn("Could not add bookmark:", error);
  }
}

// Referral link + signup tracking - the real `referral_links`/
// `referral_signups` tables (and the admin-side click/conversion analytics
// reading them in lib/api/platform.js) have existed since 0004, but there
// was never a learner-facing way to see or share your own code. Get-or-
// create on first read rather than provisioning a link at signup, so it
// only ever exists for a learner who actually opened this section. No RLS
// on these tables (same as the rest of the gamification schema), so this
// is a plain table read/insert like fetchMyBookmarks above rather than an
// RPC call.
export async function fetchOrCreateMyReferralLink(userId) {
  if (!supabase || !userId) return null;
  const { data: existing, error: fetchError } = await supabase
    .from("referral_links")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (fetchError) { console.warn("Referral link fetch warning:", fetchError); return null; }
  if (existing) return existing;

  const { data: created, error: createError } = await supabase
    .from("referral_links")
    .insert({ user_id: userId })
    .select("*")
    .maybeSingle();
  if (createError) { console.warn("Could not create referral link:", createError); return null; }
  return created;
}

// Real referred-signup count + conversion rate for this learner's own link
// (mirrors the shape get_referral_analytics() returns, computed the same
// way as the admin-side referral analytics in platform.js).
export async function fetchMyReferralStats(userId) {
  if (!supabase || !userId) return { clicks: 0, signups: 0, conversionRate: 0 };
  const { data: link } = await supabase.from("referral_links").select("id, clicks").eq("user_id", userId).maybeSingle();
  if (!link) return { clicks: 0, signups: 0, conversionRate: 0 };
  const { count } = await supabase
    .from("referral_signups")
    .select("id", { count: "exact", head: true })
    .eq("referral_link_id", link.id)
    .eq("signup_completed", true);
  const signups = count || 0;
  const clicks = link.clicks || 0;
  return { clicks, signups, conversionRate: clicks > 0 ? Math.round((signups / clicks) * 1000) / 10 : 0 };
}

// Assessments - distinct from the AI Quiz Generator (fetchSafeQuizQuestions
// / submitQuizAnswers above). Instructor-authored, tied to course
// completion and certificates; server-scored via check_assessment_answers()
// so the correct answers are never sent to the client. See
// 0112_assessments_pipeline.sql.
export async function fetchAssessmentForCourse(courseId) {
  if (!supabase || !courseId) {
    // Matches the demo course catalog above - without this, clicking into
    // "AI Fundamentals" in demo mode would show "no assessment yet" even
    // though the whole point of this fixture is to demonstrate the real
    // flow.
    if (courseId === "demo-course-ai-fundamentals") {
      return { id: "demo-assessment-ai-fundamentals", course_id: courseId, title: "AI Fundamentals Final Assessment" };
    }
    return null;
  }
  const { data, error } = await supabase.from("assessments").select("*").eq("course_id", courseId).maybeSingle();
  if (error) { console.warn("Assessment fetch warning:", error); return null; }
  return data;
}

export async function fetchSafeAssessmentQuestions(assessmentId) {
  if (!supabase || !assessmentId) {
    if (assessmentId === "demo-assessment-ai-fundamentals") {
      return [
        { id: "demo-q1", question: "What does \"AI\" stand for?", options: ["Artificial Intelligence", "Automated Interface", "Applied Informatics", "Autonomous Integration"] },
        { id: "demo-q2", question: "Which of these is a common use of AI at work?", options: ["Drafting emails", "Watering plants", "Filing paper documents", "Answering the phone manually"] },
      ];
    }
    return [];
  }
  const { data, error } = await supabase
    .from("safe_assessment_questions")
    .select("*")
    .eq("assessment_id", assessmentId)
    .order("order_index", { ascending: true });
  if (error) { console.warn("Assessment questions fetch warning:", error); return []; }
  return data || [];
}

// Demo-mode-only in-memory attempt store - a real, confirmed gap:
// submitAssessmentAttempt() returned a convincing fake success, but
// fetchMyAssessmentAttempt() always returned null regardless, since demo
// mode has no backend to persist to. That meant the screen could never
// transition to "already submitted" or show the certificate section after
// a genuine, successful-looking submission - not a real backend bug, but
// a real UX dead end in the one environment most people actually explore
// this feature in. Scoped to this module's lifetime (a browser tab
// session), keyed by assessmentId+userId - intentionally not persisted to
// localStorage, matching this app's existing "in-memory only" rule for
// anything demo-mode.
const demoAssessmentAttempts = new Map();

export async function fetchMyAssessmentAttempt(assessmentId, userId) {
  if (!supabase || !assessmentId || !userId) {
    return demoAssessmentAttempts.get(`${assessmentId}:${userId}`) || null;
  }
  const { data, error } = await supabase
    .from("assessment_attempts")
    .select("*")
    .eq("assessment_id", assessmentId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) { console.warn("Assessment attempt fetch warning:", error); return null; }
  return data;
}

export async function submitAssessmentAttempt(assessmentId, answersByQuestionId, userId, timeTaken = null) {
  if (!supabase || !assessmentId || !userId) {
    // Demo mode: no backend to score or persist against. Consistent with
    // every other demo-mode write in this app (registerOrganization,
    // toggleCourseBookmark, etc.) - a soft, honest "this would work for
    // real" result rather than a confusing "could not submit" error that
    // looks like a bug when it's actually just the absence of a backend.
    const answeredCount = Object.keys(answersByQuestionId || {}).length;
    const score = answeredCount > 0 ? 100 : 0;
    // Stored so fetchMyAssessmentAttempt() reflects this submission
    // immediately after - see the store's own comment above for why this
    // matters.
    demoAssessmentAttempts.set(`${assessmentId}:${userId}`, {
      id: `demo-attempt-${assessmentId}`, assessment_id: assessmentId, user_id: userId,
      score, completed_at: new Date().toISOString(), overridden_by: null,
    });
    return { score, correct_count: answeredCount, total: answeredCount, total_points: answeredCount, demo: true };
  }
  const { data, error } = await supabase.rpc("check_assessment_answers", {
    p_assessment_id: assessmentId,
    p_answers: answersByQuestionId,
  });
  if (error) throw error;
  const result = data?.[0] || null;
  if (!result) return null;

  const { data: attempt, error: insertErr } = await supabase
    .from("assessment_attempts")
    .insert({
      user_id: userId,
      assessment_id: assessmentId,
      answers: answersByQuestionId,
      completed_at: new Date().toISOString(),
      score: result.score,
      ai_score: result.score,
      time_taken: timeTaken,
    })
    .select()
    .single();
  if (insertErr) throw insertErr;
  return { ...result, attempt };
}

// Certificates - explicitly in-scope for v1, previously entirely unbuilt.
// See 0120_certificates.sql for the full 8-step workflow this wraps.
export async function fetchCertificateForCourse(courseId) {
  if (!supabase || !courseId) {
    if (courseId === "demo-course-ai-fundamentals") {
      return { title: "Certificate of AI Fundamentals Completion", passing_score_pct: 70, requires_admin_approval: true };
    }
    return null;
  }
  const { data, error } = await supabase.from("certificate_templates").select("*").eq("course_id", courseId).maybeSingle();
  if (error) { console.warn("Certificate template fetch warning:", error); return null; }
  return data;
}

// Same in-memory demo store pattern as demoAssessmentAttempts above, for
// the same reason: requestCertificate() previously always returned
// { success: false, error: "Not available in demo mode." } - the one
// write in this entire app that didn't follow the established "soft,
// honest fake success" pattern every other demo-mode write uses. That
// meant a learner could pass the demo assessment, click "Request
// certificate," and be told it failed - a real, confusing dead end in the
// one environment most people explore this feature in.
const demoCertificates = new Map();

export async function fetchMyCertificateForCourse(courseId, userId) {
  if (!supabase || !courseId || !userId) {
    return demoCertificates.get(`${courseId}:${userId}`) || null;
  }
  const { data, error } = await supabase.from("certificates").select("*").eq("course_id", courseId).eq("user_id", userId).maybeSingle();
  if (error) { console.warn("Certificate fetch warning:", error); return null; }
  return data;
}

export async function fetchMyCertificates(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("certificates")
    .select("*, courses(title)")
    .eq("user_id", userId)
    .eq("status", "issued")
    .order("issued_at", { ascending: false });
  if (error) { console.warn("Certificates fetch warning:", error); return []; }
  return data || [];
}

export async function requestCertificate(courseId) {
  if (!supabase || !courseId) return { success: false, error: "Not available in demo mode." };
  try {
    const { data, error } = await supabase.rpc("request_certificate", { p_course_id: courseId });
    if (error) throw error;
    return data || { success: false };
  } catch (e) {
    return { success: false, error: e?.message || "Could not request a certificate." };
  }
}

// Cohort activity today - confirmed directly against the real 1.0
// reference codebase (CohortStreaksCard.tsx). See 0140_cohort_activity_
// today.sql - a real, aggregate-only count, never individual learner data.
export async function fetchCohortActivityToday(cohortId) {
  if (!supabase) return 3;
  if (!cohortId) return 0;
  const { data, error } = await supabase.rpc("get_cohort_activity_today", { check_cohort_id: cohortId });
  if (error) { console.warn("Cohort activity fetch warning:", error); return 0; }
  return data || 0;
}

// Lesson feedback - confirmed directly against the real 1.0 reference
// codebase (LessonFeedback.tsx). See 0142_lesson_feedback.sql - purely
// additive, does not gate or change the existing "mark lesson complete"
// flow at all.
export async function submitLessonFeedback(userId, lessonId, courseId, { confidence, helpful, needsMoreResources, notes }) {
  if (!supabase) return { success: true };
  try {
    const { error } = await supabase.from("lesson_feedback").upsert({
      user_id: userId, lesson_id: lessonId, course_id: courseId,
      confidence, helpful, needs_more_resources: needsMoreResources || false, notes: notes || null,
    }, { onConflict: "user_id,lesson_id" });
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not save your feedback." };
  }
}

// Checks real, current stats against every threshold in
// ACHIEVEMENT_CATALOG and awards any newly-met one not already earned -
// the missing half of a completely non-functional achievement system.
// award_achievement_by_slug() (security definer) silently no-ops for an
// already-earned achievement (real unique constraint on
// user_achievements(user_id, achievement_id)) so calling this repeatedly
// is always safe, not just on first-time completion.
//
// `alreadyEarnedSlugs` (achievement_slug values from fetchMyAchievements)
// lets this report back which defs were newly awarded on this call, purely
// so the caller can show an unlock celebration - it doesn't change what
// gets awarded (the RPC's own unique constraint is still the real guard).
export async function checkAndAwardAchievements(userId, stats, alreadyEarnedSlugs = []) {
  if (!supabase || !userId || !stats) return [];
  const earnedSet = new Set(alreadyEarnedSlugs);
  const newlyAwarded = [];
  const statsForCatalog = {
    lessonsCompleted: stats.lessons_completed || 0,
    coursesCompleted: stats.courses_completed || 0,
    sessionsCompleted: stats.sessions_completed || 0,
    streak: stats.streak_days || 0,
    totalPoints: stats.total_points || 0,
    level: stats.current_level || 1,
  };
  for (const def of ACHIEVEMENT_CATALOG) {
    let current = 0;
    if (def.category === "completion") current = def.id.includes("course") ? statsForCatalog.coursesCompleted : statsForCatalog.lessonsCompleted;
    else if (def.category === "streak") current = statsForCatalog.streak;
    else if (def.category === "mastery") current = def.id.includes("points") ? statsForCatalog.totalPoints : statsForCatalog.level;
    else if (def.category === "social") current = statsForCatalog.sessionsCompleted;
    if (current >= def.threshold) {
      try {
        await supabase.rpc("award_achievement_by_slug", { p_user_id: userId, p_slug: def.id });
        if (!earnedSet.has(def.id)) newlyAwarded.push(def);
      } catch (e) {
        console.warn(`Could not award achievement ${def.id}:`, e);
      }
    }
  }
  return newlyAwarded;
}
