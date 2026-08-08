import { useEffect } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchLeaderboard, fetchPublishedCourses, fetchMyEnrollments,
  fetchPublishedLessonCounts,
  fetchMyGamificationStats, fetchMyAchievements, fetchMyStreakActivity,
  fetchMyNotifications, fetchAvailableQuizzes,
  fetchMyQuizAttempts, fetchCourseNotes, fetchCourseReviews,
  fetchOrCreateCourseDiscussion, fetchCourseDiscussionMessages, fetchLessonNotes,
  fetchLessonsForCourse, fetchMyLessonProgress,
  fetchPublishedLearningPaths, fetchMyLearningPathEnrollments,
  fetchMyBookmarks, toggleCourseBookmark
} from "../../lib/api/learner.js";
import { fetchCurrentUserProfile } from "../../lib/api/platform.js";
import { fetchMyPersonalization } from "../../services/authService.js";
import {
  fetchCommunityPosts,
  fetchStudyGroups, fetchMyStudyGroupIds, fetchCommunityPeople,
  fetchAllMentors, fetchUpcomingLearnerSessions,
  fetchCommunityActivityFeed, fetchGamificationStatsByUserIds,
  fetchForumCategories, fetchMyCohortMembership, fetchCohortPostsFeed,
  fetchCohortResources, fetchCohortSessions
} from "../../lib/api/schemaHelper.js";
import { initialsOf, gradForIndex, timeAgo } from "../components/LearnerUI.jsx";

export function useLearnerData(session, screen, params) {
  const userProfileQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return null;
    return fetchCurrentUserProfile(session.user.id);
  }, [session?.user?.id]);

  const gamificationStatsQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return null;
    return fetchMyGamificationStats(session.user.id);
  }, [session?.user?.id]);

  const personalizationQuery = useSupabaseQuery(async () => {
    return fetchMyPersonalization();
  }, [session?.user?.id]);

  const achievementsQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return [];
    return fetchMyAchievements(session.user.id);
  }, [session?.user?.id]);

  // Only needed on the achievements screen - gated like the other
  // screen-specific queries (courseLessonsQuery, courseNotesQuery, etc.)
  // so it doesn't fire on every tab.
  const streakActivityQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id || screen !== "achievements") return [];
    return fetchMyStreakActivity(session.user.id, 14);
  }, [session?.user?.id, screen === "achievements"]);

  const user = {
    name: userProfileQuery.data?.display_name || session?.user?.user_metadata?.display_name || session?.user?.email?.split("@")[0] || "Learner",
    initials: initialsOf(userProfileQuery.data?.display_name || session?.user?.user_metadata?.display_name || session?.user?.email),
    avatarUrl: userProfileQuery.data?.avatar_url || null,
    location: userProfileQuery.data?.school || userProfileQuery.data?.department || "Member",
    role: "Learner",
    level: gamificationStatsQuery.data?.current_level || Math.floor((gamificationStatsQuery.data?.total_points || 0) / 500) + 1 || 1,
    totalPoints: gamificationStatsQuery.data?.total_points || 0,
    streak: gamificationStatsQuery.data?.streak_days || 1,
    streakFreezes: gamificationStatsQuery.data?.streak_freezes_available || 1,
    lessonsCompleted: gamificationStatsQuery.data?.lessons_completed || 0,
    coursesCompleted: gamificationStatsQuery.data?.courses_completed || 0,
    sessionsCompleted: gamificationStatsQuery.data?.sessions_completed || 0,
    weeklyGoal: userProfileQuery.data?.weekly_lesson_goal || 5,
    weeklyDone: (gamificationStatsQuery.data?.lessons_completed || 0) % (userProfileQuery.data?.weekly_lesson_goal || 5),
    // Real `updated_at` column on `user_gamification_stats` - touched every
    // time points/streak/lessons are written (lesson complete, quiz, daily
    // reward claim, etc.), so it doubles as a "last learning activity"
    // signal for the retention nudges without needing a second query.
    lastActiveAt: gamificationStatsQuery.data?.updated_at || null,
    track: personalizationQuery.data?.learning_tracks?.[0] || "Data & AI",
    skillLevel: personalizationQuery.data?.skill_level || "beginner",
    mastery: Math.min(100, Math.round(((gamificationStatsQuery.data?.lessons_completed || 0) * 10) / 2)),
    accuracy: 85,
  };

  const leaderboardQuery = useSupabaseQuery(async () => {
    if (!session) return [];
    const rows = await fetchLeaderboard(50);
    return rows.map((r, i) => ({
      rank: i + 1,
      name: r.display_name || "Learner",
      initials: (r.display_name || "L").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
      points: r.total_points,
      streak: r.streak_days,
      level: r.current_level,
      you: r.user_id === session.user.id,
    }));
  }, [session?.user?.id]);

  const coursesQuery = useSupabaseQuery(async () => fetchPublishedCourses(), []);
  const enrollmentsQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return [];
    return fetchMyEnrollments(session.user.id);
  }, [session?.user?.id]);
  const lessonCountsQuery = useSupabaseQuery(async () => fetchPublishedLessonCounts(), []);
  // Course ratings/reviews summary removed from the learner-facing course
  // list per the product brief ("Course UI... Remove: ... Ratings").
  // fetchCourseReviewSummaries is no longer called here; the per-course
  // detail-page reviews tab is removed too (see CourseDetailScreen.jsx).
  const bookmarksQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return [];
    return fetchMyBookmarks(session.user.id);
  }, [session?.user?.id]);

  const courses = (() => {
    const enrollmentByCourseId = new Map((enrollmentsQuery.data || []).map(e => [e.course_id, e]));
    const lessonCounts = lessonCountsQuery.data || {};
    const bookmarkedIds = new Set(bookmarksQuery.data || []);
    return (coursesQuery.data || []).map((c, i) => {
      const enrollment = enrollmentByCourseId.get(c.id);
      return {
        id: c.id,
        title: c.title,
        tagline: c.description || "",
        category: c.category || "General",
        level: c.level || "beginner",
        hours: c.duration_hours || 0,
        lessons: lessonCounts[c.id] || 0,
        enrolled: !!enrollment,
        isBookmarked: bookmarkedIds.has(c.id),
        progress: enrollment ? Math.round(enrollment.progress_percentage || 0) : 0,
        source: c.course_source || "internal",
        coverImageUrl: c.cover_image_url || null,
        provider: c.course_source === "external" ? "External partner" : undefined,
        grad: gradForIndex(i),
        mandatory: !!c.is_mandatory,
        price: Number(c.price) || 0,
        requiresApproval: !!c.requires_approval,
      };
    });
  })();

  function courseById(id) { return courses.find(c => c.id === id); }

  const courseLessonsQuery = useSupabaseQuery(async () => {
    if (!params?.id || !["courseDetail", "lesson"].includes(screen)) return [];
    return fetchLessonsForCourse(params.id);
  }, [screen, params?.id]);

  const lessonIdsKey = (courseLessonsQuery.data || []).map(l => l.id).join(",");
  const lessonProgressQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id || !lessonIdsKey) return [];
    return fetchMyLessonProgress(session.user.id, lessonIdsKey.split(","));
  }, [session?.user?.id, lessonIdsKey]);

  function lessonsForCurrentCourse() {
    const raw = courseLessonsQuery.data || [];
    const progressByLessonId = new Map((lessonProgressQuery.data || []).map(p => [p.lesson_id, p]));
    const mapped = raw.map(l => ({
      id: l.id,
      title: l.title,
      duration: l.duration_minutes || 0,
      completed: !!progressByLessonId.get(l.id)?.is_completed,
      current: false,
    }));
    const firstIncomplete = mapped.findIndex(l => !l.completed);
    if (firstIncomplete >= 0) mapped[firstIncomplete].current = true;
    return mapped;
  }

  const courseNotesQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id || !params?.id || screen !== "courseDetail") return [];
    return fetchCourseNotes(session.user.id, params.id);
  }, [session?.user?.id, screen === "courseDetail" ? params?.id : null]);

  const courseDiscussionQuery = useSupabaseQuery(async () => {
    if (!params?.id || screen !== "courseDetail") return null;
    const discussion = await fetchOrCreateCourseDiscussion(params.id);
    if (!discussion) return { discussion: null, messages: [] };
    const messages = await fetchCourseDiscussionMessages(discussion.id);
    return { discussion, messages };
  }, [screen === "courseDetail" ? params?.id : null]);

  const courseReviewsQuery = useSupabaseQuery(async () => {
    if (!params?.id || screen !== "courseDetail") return [];
    return fetchCourseReviews(params.id);
  }, [screen === "courseDetail" ? params?.id : null]);

  const lessonNotesQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id || !params?.lessonId || screen !== "lesson") return [];
    return fetchLessonNotes(session.user.id, params.lessonId);
  }, [session?.user?.id, screen === "lesson" ? params?.lessonId : null]);

  const quizzesQuery = useSupabaseQuery(async () => fetchAvailableQuizzes(), []);
  const quizAttemptsQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return [];
    return fetchMyQuizAttempts(session.user.id, 10);
  }, [session?.user?.id]);

  const postsQuery = useSupabaseQuery(async () => fetchCommunityPosts(), []);
  const studyGroupsQuery = useSupabaseQuery(async () => fetchStudyGroups(), []);
  const myGroupIdsQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return [];
    return fetchMyStudyGroupIds(session.user.id);
  }, [session?.user?.id]);
  const communityPeopleQuery = useSupabaseQuery(async () => fetchCommunityPeople(session?.user?.id), [session?.user?.id]);

  // Forum categories - distinct from study groups. Only fetched once the
  // learner is signed in, same gating as everything else in this hook; the
  // per-category threads/replies are fetched lazily inside ForumCategoryPanel
  // (CommunityScreen.jsx), keyed to whichever category is open, mirroring how
  // GroupChatPanel owns its own study_group_messages query.
  const forumCategoriesQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return [];
    return fetchForumCategories();
  }, [session?.user?.id]);

  // Real-time-ish activity ticker for the Community screen, sourced from the
  // actual `community_activity_feed` table (not client-derived).
  const activityFeedQuery = useSupabaseQuery(async () => fetchCommunityActivityFeed(15), []);

  // Which real cohort (if any) the learner belongs to, and that cohort's
  // real posts feed - backs the Community screen's "Cohort Channels" tab,
  // which previously rendered hardcoded sample cohort/announcement copy
  // instead of querying anything. The posts query is gated on the resolved
  // cohort id, the same "dependent query" pattern memberStatsQuery below
  // uses against communityPeopleQuery's ids.
  const cohortMembershipQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return null;
    return fetchMyCohortMembership(session.user.id);
  }, [session?.user?.id]);
  const cohortId = cohortMembershipQuery.data?.cohort?.id || null;
  const cohortPostsQuery = useSupabaseQuery(async () => {
    if (!cohortId) return [];
    return fetchCohortPostsFeed(cohortId);
  }, [cohortId]);
  // Real cohort_resources / cohort_sessions rows for the learner's cohort
  // an admin already writes these from CohortDetailScreen.jsx, but no
  // learner-facing screen ever read them until the dedicated Cohort screen.
  const cohortResourcesQuery = useSupabaseQuery(async () => {
    if (!cohortId) return [];
    return fetchCohortResources(cohortId);
  }, [cohortId]);
  const cohortSessionsQuery = useSupabaseQuery(async () => {
    if (!cohortId) return [];
    return fetchCohortSessions(cohortId);
  }, [cohortId]);

  // Batched gamification stats (streak/level/points) for whoever is in the
  // Members directory, keyed the same way fetchProfilesByUserIds is
  // avoids one query per learner row. communityPeopleQuery.data is a list of
  // raw user_profiles rows (see fetchCommunityPeople) whose real auth user id
  // lives in their `user_id` column (user_profiles.id is a separate internal PK).
  const communityPeopleIdsKey = (communityPeopleQuery.data || []).map((p) => p.user_id).filter(Boolean).join(",");
  const memberStatsQuery = useSupabaseQuery(async () => {
    if (!communityPeopleIdsKey) return {};
    return fetchGamificationStatsByUserIds(communityPeopleIdsKey.split(","));
  }, [communityPeopleIdsKey]);

  const notificationsQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return [];
    const rows = await fetchMyNotifications(session.user.id);
    return rows.map(r => ({ id: r.id, type: r.type, title: r.title, message: r.message, time: timeAgo(r.created_at), read: r.is_read }));
  }, [session?.user?.id]);

  const upcomingSessionsQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return [];
    return fetchUpcomingLearnerSessions(session.user.id);
  }, [session?.user?.id]);

  const mentorsQuery = useSupabaseQuery(async () => fetchAllMentors(), []);

  // Learning paths - org-scoped the same way the admin builder scopes them
  // on create (see createLearningPath in lib/api/platform.js).
  const orgIdForPaths = userProfileQuery.data?.organization_id || null;
  const learningPathsQuery = useSupabaseQuery(async () => fetchPublishedLearningPaths(orgIdForPaths), [orgIdForPaths]);
  const pathEnrollmentsQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return [];
    return fetchMyLearningPathEnrollments(session.user.id);
  }, [session?.user?.id]);

  // Realtime subscription
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("learner_realtime_channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts" }, () => {
        postsQuery.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "real_notifications" }, () => {
        notificationsQuery.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_gamification_stats" }, () => {
        gamificationStatsQuery.refetch();
        leaderboardQuery.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_achievements" }, () => {
        achievementsQuery.refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    userProfileQuery,
    gamificationStatsQuery,
    achievementsQuery,
    streakActivityQuery,
    personalizationQuery,
    user,
    leaderboardQuery,
    coursesQuery,
    enrollmentsQuery,
    lessonCountsQuery,
    bookmarksQuery,
    handleToggleBookmark: async (courseId, isCurrentlyBookmarked) => {
      if (!session?.user?.id) return;
      await toggleCourseBookmark(session.user.id, courseId, isCurrentlyBookmarked);
      bookmarksQuery.refetch();
    },
    courses,
    courseById,
    courseLessonsQuery,
    lessonProgressQuery,
    lessonsForCurrentCourse,
    courseNotesQuery,
    courseDiscussionQuery,
    courseReviewsQuery,
    lessonNotesQuery,
    quizzesQuery,
    quizAttemptsQuery,
    postsQuery,
    studyGroupsQuery,
    myGroupIdsQuery,
    communityPeopleQuery,
    forumCategoriesQuery,
    activityFeedQuery,
    cohortMembershipQuery,
    cohortPostsQuery,
    cohortResourcesQuery,
    cohortSessionsQuery,
    memberStatsQuery,
    notificationsQuery,
    upcomingSessionsQuery,
    mentorsQuery,
    learningPathsQuery,
    pathEnrollmentsQuery,
  };
}
