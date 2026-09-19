import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchLeaderboard, fetchPublishedCourses, fetchMyEnrollments,
  fetchPublishedLessonCounts, fetchCourseInstructorNames,
  fetchMyGamificationStats, fetchMyAchievements, fetchMyStreakActivity,
  fetchMyNotifications, fetchAvailableQuizzes,
  fetchMyQuizAttempts, fetchCourseNotes, fetchCourseReviews,
  fetchOrCreateCourseDiscussion, fetchCourseDiscussionMessages, fetchLessonNotes,
  fetchLessonsForCourse, fetchMyLessonProgress,
  fetchPublishedLearningPaths, fetchMyLearningPathEnrollments,
  fetchMyBookmarks, toggleCourseBookmark, checkAndAwardAchievements,
  fetchOrCreateMyReferralLink, fetchMyReferralStats,
  fetchMyComplianceAssignments, fetchMyCertificates, fetchMyFeedbackNotes
} from "../../lib/api/learner.js";
import { fetchCurrentUserProfile } from "../../lib/api/platform.js";
import { fetchMyPersonalization } from "../../services/authService.js";
import {
  fetchCommunityPosts,
  fetchStudyGroups, fetchMyStudyGroupIds, fetchCommunityPeople,
  fetchAllMentors, fetchUpcomingLearnerSessions,
  fetchCommunityActivityFeed, fetchGamificationStatsByUserIds, fetchMyCommunityStats,
  fetchForumCategories, fetchMyCohortMembership, fetchCohortPostsFeed,
  fetchCohortResources, fetchCohortSessions, fetchCohortAssignedCourses, fetchCohortMembers
} from "../../lib/api/schemaHelper.js";
import { initialsOf, gradForIndex, timeAgo } from "../components/LearnerUI.jsx";
import { isMockDataEnabled, subscribeToMockDataChanges, getYouTubeEmbedId, isRealDatabaseId } from "../../lib/mockDataManager.js";
import { isPlatformOwnerEmail } from "../../lib/roleRouting.js";

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

  // The other half of a previously completely non-functional achievement
  // system - award_achievement() existed and was correct, but nothing in
  // the client ever called it, and the achievements table itself had
  // never been seeded. Runs every time real stats load (including after
  // any refetch triggered by completing a lesson, course, or session
  // elsewhere in the app) and re-checks every threshold - safe to call
  // repeatedly since already-earned achievements are silently no-op'd by
  // a real unique constraint, not by this check.
  //
  // Also the only place a learner ever finds out a badge unlocked -
  // previously the whole flow was silent (points landed, no toast, no
  // celebration). newlyEarnedAchievements surfaces what to celebrate;
  // consumers should clear it after showing it (see TrainAILearnerApp).
  const [newlyEarnedAchievements, setNewlyEarnedAchievements] = useState([]);
  useEffect(() => {
    if (!session?.user?.id || !gamificationStatsQuery.data) return;
    const alreadyEarnedSlugs = (achievementsQuery.data || []).map((a) => a.achievement_slug || a.achievement_id);
    checkAndAwardAchievements(session.user.id, gamificationStatsQuery.data, alreadyEarnedSlugs).then((newlyAwarded) => {
      achievementsQuery.refetch();
      if (newlyAwarded && newlyAwarded.length > 0) {
        setNewlyEarnedAchievements((prev) => [...prev, ...newlyAwarded]);
      }
    });
  }, [session?.user?.id, gamificationStatsQuery.data]);

  // "Invite & Earn" - only needed on the settings/profile screen, same
  // gating pattern as the other screen-specific queries below.
  const referralLinkQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id || screen !== "settings") return null;
    return fetchOrCreateMyReferralLink(session.user.id);
  }, [session?.user?.id, screen === "settings"]);

  const referralStatsQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id || screen !== "settings") return { clicks: 0, signups: 0, conversionRate: 0 };
    return fetchMyReferralStats(session.user.id);
  }, [session?.user?.id, screen === "settings"]);

  // Only needed on the achievements screen - gated like the other
  // screen-specific queries (courseLessonsQuery, courseNotesQuery, etc.)
  // so it doesn't fire on every tab.
  const streakActivityQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id || screen !== "achievements") return [];
    return fetchMyStreakActivity(session.user.id, 14);
  }, [session?.user?.id, screen === "achievements"]);

  const cohortMembershipQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return null;
    return fetchMyCohortMembership(session.user.id);
  }, [session?.user?.id]);

  const user = {
    email: userProfileQuery.data?.email || session?.user?.email || "",
    name: userProfileQuery.data?.display_name || session?.user?.user_metadata?.display_name || session?.user?.email?.split("@")[0] || "Learner",
    initials: initialsOf(userProfileQuery.data?.display_name || session?.user?.user_metadata?.display_name || session?.user?.email),
    avatarUrl: userProfileQuery.data?.avatar_url || null,
    location: userProfileQuery.data?.school || userProfileQuery.data?.department || "",
    role: (userProfileQuery.data?.platform_role === "platform_owner" || userProfileQuery.data?.role === "super_admin" || isPlatformOwnerEmail(session?.user?.email))
      ? "Platform Owner"
      : userProfileQuery.data?.role === "admin"
      ? "Admin"
      : userProfileQuery.data?.role === "instructor" || userProfileQuery.data?.role === "mentor"
      ? "Instructor"
      : "Learner",
    organization: userProfileQuery.data?.organizations?.name || userProfileQuery.data?.organization_name || "",
    organization_id: userProfileQuery.data?.organization_id || null,
    cohort: cohortMembershipQuery.data?.cohort?.name || null,
    batch: cohortMembershipQuery.data?.cohort?.name || null,
    level: gamificationStatsQuery.data?.current_level || Math.floor((gamificationStatsQuery.data?.total_points || 0) / 500) + 1 || 1,
    totalPoints: gamificationStatsQuery.data?.total_points ?? 0,
    streak: gamificationStatsQuery.data?.streak_days || 0,
    streakFreezes: gamificationStatsQuery.data?.streak_freezes_available || 0,
    lessonsCompleted: gamificationStatsQuery.data?.lessons_completed || 0,
    coursesCompleted: gamificationStatsQuery.data?.courses_completed || 0,
    sessionsCompleted: gamificationStatsQuery.data?.sessions_completed || 0,
    studyHours: Math.round(((gamificationStatsQuery.data?.lessons_completed || 0) * 20) / 60 * 10) / 10,
    weeklyGoal: userProfileQuery.data?.weekly_lesson_goal || 5,
    weeklyDone: (gamificationStatsQuery.data?.lessons_completed || 0) % (userProfileQuery.data?.weekly_lesson_goal || 5),
    lastActiveAt: gamificationStatsQuery.data?.updated_at || null,
    track: personalizationQuery.data?.learning_tracks?.[0] || "",
    skillLevel: personalizationQuery.data?.skill_level || "beginner",
    mastery: Math.min(100, Math.round(((gamificationStatsQuery.data?.lessons_completed || 0) * 10) / 2)),
    accuracy: 0,
  };

  const orgId = userProfileQuery.data?.organization_id || null;

  const leaderboardQuery = useSupabaseQuery(async () => {
    if (!session || !orgId) return [];
    const rows = await fetchLeaderboard(50, orgId);
    return rows.map((r, i) => ({
      user_id: r.user_id,
      rank: i + 1,
      name: r.display_name || "Learner",
      initials: (r.display_name || "L").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
      avatar_url: r.avatar_url || null,
      avatar: r.avatar_url || null,
      role: r.role || "Specialist",
      cohort_name: r.cohort_name || "Active Batch",
      points: r.total_points || 0,
      total_points: r.total_points || 0,
      streak: r.streak_days || r.streak || 1,
      level: r.current_level || 1,
      completed_courses: r.completed_courses || 0,
      badges_count: r.badges_count || 1,
      you: r.user_id === session?.user?.id,
    }));
  }, [session?.user?.id, orgId]);

  const coursesQuery = useSupabaseQuery(async () => {
    if (!orgId) return [];
    return fetchPublishedCourses(orgId);
  }, [orgId]);
  const enrollmentsQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return [];
    return fetchMyEnrollments(session.user.id);
  }, [session?.user?.id]);
  const lessonCountsQuery = useSupabaseQuery(async () => fetchPublishedLessonCounts(), []);
  const courseInstructorsQuery = useSupabaseQuery(async () => fetchCourseInstructorNames(), []);
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
    const instructorNames = courseInstructorsQuery.data || {};

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
        instructor: instructorNames[c.id] || null,
      };
    });
  })();

  function courseById(id) {
    if (!id) return courses[0] || undefined;
    return courses.find(c => c.id === id);
  }

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
    const currentCourse = courseById(params?.id);
    const courseKey = params?.id || "";

    if (raw.length > 0) {
      const mapped = raw.map(l => ({
        id: l.id,
        title: l.title,
        duration: l.duration_minutes || 20,
        completed: !!progressByLessonId.get(l.id)?.is_completed,
        current: false,
        youtubeVideoId: l.youtube_video_id || getYouTubeEmbedId(courseKey, l.id, currentCourse?.title, currentCourse?.category)
      }));
      const firstIncomplete = mapped.findIndex(l => !l.completed);
      if (firstIncomplete >= 0) mapped[firstIncomplete].current = true;
      return mapped;
    }

    // When course has no lessons in the database, return honest empty curriculum state
    return [];
  }

  // Mock/demo course ids (course-figma-ai and friends, see
  // DEFAULT_FALLBACK_COURSES above) are plain strings, not UUIDs. The
  // course-list merge above already learned this lesson once ("only show
  // them when mock data is actually on" - see that comment) but these
  // three course-detail sub-queries still queried real UUID columns
  // unconditionally with whatever params.id was, which throws "invalid
  // input syntax for type uuid" against a real Supabase project the
  // moment a learner opens a mock course's detail page - the actual root
  // cause of that page rendering blank, not merely an unhandled edge case.
  const isRealCourseId = (id) => isRealDatabaseId(id);

  const courseNotesQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id || !params?.id || screen !== "courseDetail" || !isRealCourseId(params.id)) return [];
    return fetchCourseNotes(session.user.id, params.id);
  }, [session?.user?.id, screen === "courseDetail" ? params?.id : null]);

  const courseDiscussionQuery = useSupabaseQuery(async () => {
    if (!params?.id || screen !== "courseDetail" || !isRealCourseId(params.id)) return { discussion: null, messages: [] };
    const discussion = await fetchOrCreateCourseDiscussion(params.id);
    if (!discussion) return { discussion: null, messages: [] };
    const messages = await fetchCourseDiscussionMessages(discussion.id);
    return { discussion, messages };
  }, [screen === "courseDetail" ? params?.id : null]);

  const courseReviewsQuery = useSupabaseQuery(async () => {
    if (!params?.id || screen !== "courseDetail" || !isRealCourseId(params.id)) return [];
    return fetchCourseReviews(params.id);
  }, [screen === "courseDetail" ? params?.id : null]);

  const lessonNotesQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id || !params?.lessonId || screen !== "lesson" || !isRealDatabaseId(params.lessonId)) return [];
    return fetchLessonNotes(session.user.id, params.lessonId);
  }, [session?.user?.id, screen === "lesson" ? params?.lessonId : null]);

  // Lesson Q&A - same real course_discussions/course_discussion_messages
  // tables as courseDiscussionQuery above, scoped to this specific lesson
  // instead of the whole course. Same mock-id guard as everywhere else on
  // this page - a mock course can have real-looking mock lessons (l-figma-2
  // and friends), and either id being a mock slug breaks this query.
  const lessonDiscussionQuery = useSupabaseQuery(async () => {
    if (!params?.id || !params?.lessonId || screen !== "lesson" || !isRealDatabaseId(params.id) || !isRealDatabaseId(params.lessonId)) return { discussion: null, messages: [] };
    const discussion = await fetchOrCreateCourseDiscussion(params.id, params.lessonId);
    if (!discussion) return { discussion: null, messages: [] };
    const messages = await fetchCourseDiscussionMessages(discussion.id);
    return { discussion, messages };
  }, [screen === "lesson" ? params?.id : null, screen === "lesson" ? params?.lessonId : null]);

  const quizzesQuery = useSupabaseQuery(async () => fetchAvailableQuizzes(orgId), [orgId]);
  const quizAttemptsQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return [];
    return fetchMyQuizAttempts(session.user.id, 10);
  }, [session?.user?.id]);

  const postsQuery = useSupabaseQuery(async () => fetchCommunityPosts(null, orgId), [orgId]);
  const studyGroupsQuery = useSupabaseQuery(async () => fetchStudyGroups(orgId), [orgId]);
  const myGroupIdsQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return [];
    return fetchMyStudyGroupIds(session.user.id);
  }, [session?.user?.id]);
  const communityPeopleQuery = useSupabaseQuery(async () => fetchCommunityPeople(session?.user?.id, 20, orgId), [session?.user?.id, orgId]);
  // Backs the "Your Community Status" card on the Community screen - real
  // engagement counts for the signed-in learner (see fetchMyCommunityStats).
  const myCommunityStatsQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return { totalPosts: 0, totalComments: 0, score: 0, tier: "newcomer" };
    return fetchMyCommunityStats(session.user.id);
  }, [session?.user?.id]);

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
  const activityFeedQuery = useSupabaseQuery(async () => fetchCommunityActivityFeed(15, orgId), [orgId]);

  // Which real cohort (if any) the learner belongs to, and that cohort's
  // real posts feed - backs the Community screen's "Cohort Channels" tab.
  const cohortId = params?.id || params?.cohortId || cohortMembershipQuery.data?.cohort?.id || null;
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
  // Cohort "Assigned Courses" and "Members" - PRD 7.4, a real gap found and
  // fixed (cohort_courses had RLS enabled with zero policies until
  // 0124_cohort_courses_rls_fix.sql - nothing had ever queried it before).
  const cohortCoursesQuery = useSupabaseQuery(async () => {
    if (!cohortId) return [];
    return fetchCohortAssignedCourses(cohortId);
  }, [cohortId]);
  const cohortMembersQuery = useSupabaseQuery(async () => {
    if (!cohortId) return [];
    return fetchCohortMembers(cohortId);
  }, [cohortId]);
  const cohortSessionsQuery = useSupabaseQuery(async () => {
    if (!cohortId) return [];
    return fetchCohortSessions(cohortId);
  }, [cohortId]);

  // Batched gamification stats (streak/level/points) for whoever is in the
  // Members directory, keyed the same way fetchProfilesByUserIds is
  // avoids one query per learner row. communityPeopleQuery.data is a list
  // of raw user_profiles rows (see fetchCommunityPeople) whose real auth
  // user id IS their own `id` column directly (confirmed against the
  // actual schema - no separate user_id column exists on this table).
  const communityPeopleIdsKey = (communityPeopleQuery.data || []).map((p) => p.id).filter(Boolean).join(",");
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

  const mentorsQuery = useSupabaseQuery(async () => fetchAllMentors(orgId), [orgId]);

  // Learning paths - org-scoped the same way the admin builder scopes them
  // on create (see createLearningPath in lib/api/platform.js).
  const orgIdForPaths = userProfileQuery.data?.organization_id || null;
  const learningPathsQuery = useSupabaseQuery(async () => fetchPublishedLearningPaths(orgIdForPaths), [orgIdForPaths]);
  const pathEnrollmentsQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return [];
    return fetchMyLearningPathEnrollments(session.user.id);
  }, [session?.user?.id]);

  const complianceAssignmentsQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return [];
    return fetchMyComplianceAssignments(session.user.id);
  }, [session?.user?.id]);

  const myCertificatesQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return [];
    return fetchMyCertificates(session.user.id);
  }, [session?.user?.id]);

  const feedbackNotesQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return [];
    return fetchMyFeedbackNotes(session.user.id);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "learning_paths" }, () => {
        learningPathsQuery.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "learning_path_courses" }, () => {
        learningPathsQuery.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "learning_path_enrollments" }, () => {
        pathEnrollmentsQuery.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "courses" }, () => {
        coursesQuery.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "compliance_assignments" }, () => {
        complianceAssignmentsQuery.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "certificates" }, () => {
        myCertificatesQuery.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cohort_posts" }, () => {
        cohortPostsQuery.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cohort_resources" }, () => {
        cohortResourcesQuery.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cohort_sessions" }, () => {
        cohortSessionsQuery.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cohort_members" }, () => {
        cohortMembershipQuery.refetch();
        cohortMembersQuery.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "course_applications" }, () => {
        // applications refetch
        enrollmentsQuery.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "course_enrollments" }, () => {
        enrollmentsQuery.refetch();
        coursesQuery.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "course_lessons" }, () => {
        courseLessonsQuery.refetch();
        lessonCountsQuery.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lesson_progress" }, () => {
        lessonProgressQuery.refetch();
        enrollmentsQuery.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "mentorship_sessions" }, () => {
        upcomingSessionsQuery.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "study_groups" }, () => {
        studyGroupsQuery.refetch();
        myGroupIdsQuery.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "study_group_members" }, () => {
        studyGroupsQuery.refetch();
        myGroupIdsQuery.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "feedback_notes" }, () => {
        feedbackNotesQuery.refetch();
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
    newlyEarnedAchievements,
    clearNewlyEarnedAchievements: () => setNewlyEarnedAchievements([]),
    referralLinkQuery,
    referralStatsQuery,
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
    lessonDiscussionQuery,
    courseReviewsQuery,
    lessonNotesQuery,
    quizzesQuery,
    quizAttemptsQuery,
    postsQuery,
    studyGroupsQuery,
    myGroupIdsQuery,
    communityPeopleQuery,
    memberStatsQuery,
    myCommunityStatsQuery,
    forumCategoriesQuery,
    activityFeedQuery,
    cohortMembershipQuery,
    cohortPostsQuery,
    cohortResourcesQuery,
    cohortCoursesQuery,
    cohortMembersQuery,
    cohortSessionsQuery,
    notificationsQuery,
    upcomingSessionsQuery,
    mentorsQuery,
    learningPathsQuery,
    pathEnrollmentsQuery,
    complianceAssignmentsQuery,
    myCertificatesQuery,
    feedbackNotesQuery,
  };
}
