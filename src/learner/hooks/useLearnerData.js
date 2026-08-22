import { useState, useEffect } from "react";
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
  fetchMyBookmarks, toggleCourseBookmark, checkAndAwardAchievements
} from "../../lib/api/learner.js";
import { fetchCurrentUserProfile } from "../../lib/api/platform.js";
import { fetchMyPersonalization } from "../../services/authService.js";
import {
  fetchCommunityPosts,
  fetchStudyGroups, fetchMyStudyGroupIds, fetchCommunityPeople,
  fetchAllMentors, fetchUpcomingLearnerSessions,
  fetchCommunityActivityFeed, fetchGamificationStatsByUserIds,
  fetchForumCategories, fetchMyCohortMembership, fetchCohortPostsFeed,
  fetchCohortResources, fetchCohortSessions, fetchCohortAssignedCourses, fetchCohortMembers
} from "../../lib/api/schemaHelper.js";
import { initialsOf, gradForIndex, timeAgo } from "../components/LearnerUI.jsx";
import { isMockDataEnabled, subscribeToMockDataChanges, getYouTubeEmbedId } from "../../lib/mockDataManager.js";

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
  useEffect(() => {
    if (!session?.user?.id || !gamificationStatsQuery.data) return;
    checkAndAwardAchievements(session.user.id, gamificationStatsQuery.data).then(() => {
      achievementsQuery.refetch();
    });
  }, [session?.user?.id, gamificationStatsQuery.data]);

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

  const [mockEnabled, setMockEnabled] = useState(() => isMockDataEnabled());
  useEffect(() => {
    return subscribeToMockDataChanges((enabled) => setMockEnabled(enabled));
  }, []);

  const MOCK_COURSE_LESSONS = {
    "course-figma-ai": [
      { id: "l-figma-1", title: "1. Foundations of Spatial Design Systems & Tokens", duration: 18, module: "Module 1: Foundations", youtubeVideoId: "jwEbff6X3vY" },
      { id: "l-figma-2", title: "2. Setting Up Figma Variables & Modes for Enterprise", duration: 22, module: "Module 1: Foundations", youtubeVideoId: "7gqG2_v-s_s" },
      { id: "l-figma-3", title: "3. Auto-Layout 5.0 & Responsive Component Matrix", duration: 26, module: "Module 2: Advanced Prototyping", youtubeVideoId: "b_3gLp0r-2w" },
      { id: "l-figma-4", title: "4. Integrating AI Design Plugins & Code Exporters", duration: 30, module: "Module 2: Advanced Prototyping", youtubeVideoId: "5A4Q4DqM3E8" }
    ],
    "course-fullstack-ai": [
      { id: "l-fullstack-1", title: "1. Multi-Agent Systems Architecture & Tool Calling", duration: 24, module: "Module 1: Agent Systems", youtubeVideoId: "2F3TfH3Yf-A" },
      { id: "l-fullstack-2", title: "2. FastAPI Backend Setup with Streaming Endpoints", duration: 28, module: "Module 1: Agent Systems", youtubeVideoId: "aywZrzNaKjs" },
      { id: "l-fullstack-3", title: "3. Vector Search with Supabase pgvector & RAG Pipelines", duration: 35, module: "Module 2: Vector Stores & Scaling", youtubeVideoId: "L_W_tXq3u3k" }
    ],
    "course-prompt-pro": [
      { id: "l-prompt-1", title: "1. Zero-Shot, Few-Shot & Chain-of-Thought Prompting", duration: 16, module: "Module 1: Core Prompting", youtubeVideoId: "jC4v5AS4RIM" },
      { id: "l-prompt-2", title: "2. Function Calling Schemas & Automated Model Eval", duration: 20, module: "Module 2: Schemas & Evals", youtubeVideoId: "94S35K3mZ_k" }
    ],
    "course-cloud-devops": [
      { id: "l-cloud-1", title: "1. Containerizing Microservices with Multi-Stage Docker", duration: 22, module: "Module 1: Containers", youtubeVideoId: "d6WC5n9G_sM" },
      { id: "l-cloud-2", title: "2. Deploying & Scaling Kubernetes Pods on Google Cloud", duration: 30, module: "Module 2: Kubernetes", youtubeVideoId: "X48VuDVv0do" }
    ],
    "course-spatial-ui": [
      { id: "l-spatial-1", title: "1. VisionOS Spatial Canvas & Depth Ergonomics", duration: 18, module: "Module 1: Spatial Canvas", youtubeVideoId: "Vb0nP_R590k" },
      { id: "l-spatial-2", title: "2. Eye Tracking, Gaze Targets & Glassmorphism Tokens", duration: 25, module: "Module 2: Interactions", youtubeVideoId: "7pL4f-O1o34" }
    ],
    "course-data-python": [
      { id: "l-data-1", title: "1. Python for Data Science & Pandas DataFrame Analytics", duration: 24, module: "Module 1: Data Analytics", youtubeVideoId: "LHBE6Q9XlzI" },
      { id: "l-data-2", title: "2. Vector Embeddings, Cosine Similarity & Index Tuning", duration: 28, module: "Module 2: Vector Math", youtubeVideoId: "nLRL_NcnK-4" }
    ]
  };

  const DEFAULT_FALLBACK_COURSES = [
    {
      id: "course-figma-ai",
      title: "Master Design Systems in Figma with AI",
      tagline: "Build scalable enterprise design systems using Figma variables, token architecture, auto-layout 5.0, and generative AI plugins.",
      category: "UI/UX & Design Systems",
      level: "intermediate",
      hours: 18,
      lessons: 4,
      enrolled: true,
      isBookmarked: true,
      progress: 72,
      source: "assigned",
      coverImageUrl: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80",
      instructor: "Astrid Larsson",
      partner: "Figma Official",
      grad: gradForIndex(0),
      mandatory: true,
      price: 0,
      requiresApproval: false
    },
    {
      id: "course-fullstack-ai",
      title: "Full-Stack AI Application Engineering",
      tagline: "Architect and deploy end-to-end multi-agent applications with Python FastAPI backends, LangChain orchestration, and React frontends.",
      category: "Full-Stack & Web Dev",
      level: "advanced",
      hours: 26,
      lessons: 3,
      enrolled: false,
      isBookmarked: false,
      progress: 0,
      source: "internal",
      isInternal: true,
      coverImageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
      instructor: "Alex Rivera",
      grad: gradForIndex(1),
      mandatory: false,
      price: 0,
      requiresApproval: false
    },
    {
      id: "course-prompt-pro",
      title: "Prompt Engineering & LLM Architecture",
      tagline: "Master zero-shot, few-shot, chain-of-thought prompting, function calling schemas, and automated model evaluations.",
      category: "AI & Prompt Engineering",
      level: "beginner",
      hours: 12,
      lessons: 2,
      enrolled: true,
      isBookmarked: false,
      progress: 100,
      source: "assigned",
      partner: "Anthropic / OpenAI",
      coverImageUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80",
      instructor: "Elena Rostova",
      grad: gradForIndex(2),
      mandatory: true,
      price: 0,
      requiresApproval: false
    },
    {
      id: "course-cloud-devops",
      title: "Cloud Native Microservices & Kubernetes",
      tagline: "Containerize scalable services with Docker, manage Kubernetes clusters on Google Cloud, and set up automated CI/CD pipelines.",
      category: "Cloud & DevOps",
      level: "intermediate",
      hours: 22,
      lessons: 2,
      enrolled: false,
      isBookmarked: false,
      progress: 0,
      source: "partner",
      partner: "Google Cloud",
      coverImageUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80",
      instructor: "David Vance",
      grad: gradForIndex(3),
      mandatory: false,
      price: 0,
      requiresApproval: false
    },
    {
      id: "course-spatial-ui",
      title: "Spatial Computing & VisionOS Design Foundations",
      tagline: "Design immersive 3D spatial user experiences, depth layering, eye-tracking ergonomics, and glassmorphism interface tokens.",
      category: "UI/UX & Design Systems",
      level: "advanced",
      hours: 14,
      lessons: 2,
      enrolled: false,
      isBookmarked: false,
      progress: 0,
      source: "partner",
      partner: "Apple VisionOS",
      coverImageUrl: "https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?w=800&auto=format&fit=crop&q=80",
      instructor: "Sarah Connor",
      grad: gradForIndex(4),
      mandatory: false,
      price: 0,
      requiresApproval: false
    },
    {
      id: "course-data-python",
      title: "Python Data Science, Vector Stores & pgvector",
      tagline: "Perform high-performance data wrangling, model training, similarity search indexing, and real-time visualization dashboards.",
      category: "Data Science & Python",
      level: "intermediate",
      hours: 20,
      lessons: 2,
      enrolled: false,
      isBookmarked: false,
      progress: 0,
      source: "internal",
      isInternal: true,
      coverImageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80",
      instructor: "David Kim",
      grad: gradForIndex(5),
      mandatory: false,
      price: 0,
      requiresApproval: false
    }
  ];

  const courses = (() => {
    const enrollmentByCourseId = new Map((enrollmentsQuery.data || []).map(e => [e.course_id, e]));
    const lessonCounts = lessonCountsQuery.data || {};
    const bookmarkedIds = new Set(bookmarksQuery.data || []);
    
    const dbCourses = (coursesQuery.data || []).map((c, i) => {
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

    if (!mockEnabled) {
      return dbCourses;
    }

    if (dbCourses.length > 0) {
      return dbCourses;
    }

    return DEFAULT_FALLBACK_COURSES;
  })();

  function courseById(id) {
    if (!id) return courses[0];
    const found = courses.find(c => c.id === id);
    if (found) return found;
    if (mockEnabled) {
      return DEFAULT_FALLBACK_COURSES.find(c => c.id === id) || courses[0];
    }
    return null;
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
    const mapped = raw.map(l => ({
      id: l.id,
      title: l.title,
      duration: l.duration_minutes || 0,
      completed: !!progressByLessonId.get(l.id)?.is_completed,
      current: false,
      youtubeVideoId: l.youtube_video_id || getYouTubeEmbedId(params?.id, l.id)
    }));

    if (mapped.length > 0) {
      const firstIncomplete = mapped.findIndex(l => !l.completed);
      if (firstIncomplete >= 0) mapped[firstIncomplete].current = true;
      return mapped;
    }

    if (mockEnabled && params?.id && MOCK_COURSE_LESSONS[params.id]) {
      return MOCK_COURSE_LESSONS[params.id];
    }

    if (mockEnabled) {
      return MOCK_COURSE_LESSONS["course-figma-ai"];
    }

    return [];
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
    cohortCoursesQuery,
    cohortMembersQuery,
    cohortSessionsQuery,
    memberStatsQuery,
    notificationsQuery,
    upcomingSessionsQuery,
    mentorsQuery,
    learningPathsQuery,
    pathEnrollmentsQuery,
  };
}
