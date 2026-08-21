import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../lib/useAuth.js";
import { useLearnerData } from "./hooks/useLearnerData.js";
import { TOKENS, BottomNav, DesktopSidebar, LearnerHeader, LearningPathsView, ScheduleView, timeAgo, NotificationBellContext } from "./components/LearnerUI.jsx";
import { SearchBar } from "./components/SearchBar.jsx";
import { fetchOrgAISettings, fetchOrgLeaderboardSettings, fetchOrgGamificationSettings } from "../lib/api/organizations.js";
import { HomeScreen } from "./screens/HomeScreen.jsx";
import { CoursesScreen } from "./screens/CoursesScreen.jsx";
import { CourseDetailScreen } from "./screens/CourseDetailScreen.jsx";
import { LessonScreen } from "./screens/LessonScreen.jsx";
import { AIQuizScreen } from "./screens/AIQuizScreen.jsx";
import { CommunityScreen } from "./screens/CommunityScreen.jsx";
import { CohortScreen } from "./screens/CohortScreen.jsx";
import { MentorsScreen } from "./screens/MentorsScreen.jsx";
import { MessagesScreen } from "./screens/MessagesScreen.jsx";
import { NotificationsScreen } from "./screens/NotificationsScreen.jsx";
import { ProfileScreen } from "./screens/ProfileScreen.jsx";
import { AchievementsScreen } from "./screens/AchievementsScreen.jsx";
import { BookmarksScreen } from "./screens/BookmarksScreen.jsx";
import { MyProgressScreen } from "./screens/MyProgressScreen.jsx";
import { CreditsCheckoutScreen } from "./screens/CreditsCheckoutScreen.jsx";
import { PaymentCallbackScreen } from "./screens/PaymentCallbackScreen.jsx";
import { useCredits } from "./hooks/useCredits.js";
import { useSupabaseQuery } from "../lib/useSupabaseQuery.js";
import { enrollInCourse, markLessonComplete, addCourseNote, postCourseDiscussionMessage, addLessonNote, markNotificationRead, submitQuizAnswers, fetchSafeQuizQuestions, awardAIQuizCompletionPoints, requestCourseApplication, fetchMyCourseApplications,
  fetchAssessmentForCourse, fetchSafeAssessmentQuestions, fetchMyAssessmentAttempt, submitAssessmentAttempt,
  fetchCertificateForCourse, fetchMyCertificateForCourse, requestCertificate,
} from "../lib/api/learner.js";
import {
  createCommunityPost, addPostComment, togglePostReaction, bookMentorshipSession, sendMentorMessage,
  joinStudyGroup, leaveStudyGroup, fetchStudyGroupMessages, fetchStudyGroupMembers, fetchMentorAvailability,
  generateAIQuiz,
  fetchMentorMessageThreads, fetchMentorMessageThread, markMentorMessagesRead,
  fetchOrCreateAIConversation, fetchAIChatMessages, sendAIChatMessage, requestAIReply
} from "../lib/api/schemaHelper.js";
import { updateUserAvatar, fetchOrgBranding } from "../lib/api/platform.js";
import { CheckCircle2, Search } from "lucide-react";

// Paystack/Stripe redirect the browser back to this same page (no router in
// this app) with either ?reference=/?trxref= (Paystack) or ?session_id=
// (Stripe) on the query string. If present at boot, land straight on the
// payment callback screen instead of "home" so PaymentCallbackScreen can
// verify the transaction - this is the whole "no-router landing" story.
function initialScreenFromLocation() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reference") || params.get("trxref") || params.get("session_id")) {
      return "paymentCallback";
    }
  } catch {
    // window/URLSearchParams unavailable (e.g. SSR) - fall through to home
  }
  return "home";
}

import { DashboardSwitcher } from "../platform/components/PlatformUI.jsx";
import { getAvailableDashboards, DASHBOARDS } from "../lib/roleRouting.js";

export default function TrainAILearnerApp({ isActive = true, onSwitchToPlatform, onSwitchDashboard, userRoles = [], onSignOut } = {}) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const { session, signOut } = useAuth();
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("trainai_theme_dark") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("trainai_theme_dark", dark ? "true" : "false");
      if (dark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch {}
  }, [dark]);

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  function showToast(message) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  }

  async function handleSignOut() {
    try {
      if (onSignOut) await onSignOut();
      else if (signOut) await signOut();
    } catch {}
    localStorage.removeItem("trainai_active_session_v1");
  }

  const [screen, setScreen] = useState(initialScreenFromLocation);
  const [params, setParams] = useState({});
  const [stack, setStack] = useState([]);
  const { credits, addCredits, consume: consumeCredit } = useCredits(session?.user?.id);

  function push(nextScreen, nextParams = {}) {
    setStack(s => [...s, { screen, params }]);
    setScreen(nextScreen);
    setParams(nextParams);
  }
  function back() {
    if (stack.length === 0) { setScreen("home"); setParams({}); return; }
    const prev = stack[stack.length - 1];
    setStack(s => s.slice(0, -1));
    setScreen(prev.screen);
    setParams(prev.params);
  }
  function goTab(tabKey) {
    setStack([]);
    setScreen(tabKey);
    setParams({});
  }

  function handleSidebarNav(key) {
    if (key === "home") {
      goTab("home");
    } else if (key === "courses") {
      setShowMyCoursesOnly(false);
      setCourseSourceTab("all");
      goTab("courses");
    } else if (key === "learningPaths") {
      push("learningPaths");
    } else if (key === "bookmarks") {
      push("bookmarks");
    } else if (key === "myCourses" || key === "myProgress") {
      push("myProgress");
    } else if (key === "ai") {
      goTab("ai");
    } else if (key === "communityFeed") {
      setCommunityTab("posts");
      goTab("community");
    } else if (key === "cohort") {
      goTab("cohort");
    } else if (key === "leaderboard") {
      setCommunityTab("leaderboard");
      goTab("community");
    } else if (key === "messages") {
      push("messages");
    } else if (key === "schedule") {
      push("schedule");
    } else if (key === "mentors") {
      push("mentors");
    } else if (key === "notifications") {
      push("notifications");
    } else if (key === "settings" || key === "notificationSettings" || key === "feedbackSupport") {
      push("settings");
    } else if (key === "achievements") {
      push("achievements");
    } else if (key === "creditsCheckout") {
      push("creditsCheckout", { mode: "credits" });
    }
  }

  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  useEffect(() => {
    window.history.pushState({ taiNav: true }, "");
    const onPopState = () => { if (isActiveRef.current) back(); };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const learnerData = useLearnerData(session, screen, params);
  const {
    user, courses, coursesLoading, courseById, lessonsForCurrentCourse, courseLessonsQuery,
    courseNotesQuery, courseDiscussionQuery, courseReviewsQuery, lessonNotesQuery,
    quizzesQuery, quizAttemptsQuery, postsQuery, studyGroupsQuery,
    myGroupIdsQuery, communityPeopleQuery, activityFeedQuery, memberStatsQuery, notificationsQuery, upcomingSessionsQuery, mentorsQuery,
    cohortMembershipQuery, cohortPostsQuery, cohortResourcesQuery, cohortSessionsQuery, cohortCoursesQuery, cohortMembersQuery,
    gamificationStatsQuery, achievementsQuery, streakActivityQuery, leaderboardQuery, enrollmentsQuery, lessonProgressQuery,
    userProfileQuery, handleToggleBookmark,
  } = learnerData;

  // Per-organization white-label branding (real `branding_settings` table
  // see fetchOrgBranding in lib/api/platform.js). Applied in exactly one
  // place: the --primary CSS custom property on this app's root element
  // (every ta-* color in TOKENS above derives from it) and the desktop
  // sidebar logo, in place of the default Train AI mark.
  const orgId = userProfileQuery.data?.organization_id || null;
  const orgBrandingQuery = useSupabaseQuery(async () => {
    if (!orgId) return null;
    return fetchOrgBranding(orgId);
  }, [orgId]);
  const brandPrimaryColor = orgBrandingQuery.data?.primary_color || null;
  const brandLogoUrl = orgBrandingQuery.data?.logo_url || null;

  const [wishlist, setWishlist] = useState(new Set());
  const [bookmarks, setBookmarks] = useState(new Set());
  const [completedLessonIds, setCompletedLessonIds] = useState(new Set());
  const [discussionInput, setDiscussionInput] = useState("");
  const [noteInputText, setNoteInputText] = useState("");
  const [newNoteText, setNewNoteText] = useState("");
  const [replyInput, setReplyInput] = useState("");
  const [showMyCoursesOnly, setShowMyCoursesOnly] = useState(false);
  const [courseLevelFilter, setCourseLevelFilter] = useState("all");
  const [courseSourceTab, setCourseSourceTab] = useState("all");
  const [courseSearch, setCourseSearch] = useState("");

  const [aiTab, setAiTab] = useState("coach");
  const [quizTopic, setQuizTopic] = useState(null);
  const [quizStage, setQuizStage] = useState("setup");
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSelected, setQuizSelected] = useState(null);
  const [quizShowHint, setQuizShowHint] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const [quizSubmitting, setQuizSubmitting] = useState(false);

  // AI Coach chat - real ai_conversations/ai_messages tables + the deployed
  // ai-chat edge function (schemaHelper.js: fetchOrCreateAIConversation /
  // fetchAIChatMessages / sendAIChatMessage / requestAIReply). This backend
  // already existed fully wired end-to-end but had no UI surface anywhere
  // the AI section only ever exposed Quiz/History/Insights. Gated on
  // screen === "ai" the same way the other screen-specific queries above are.
  const [coachInput, setCoachInput] = useState("");
  const [coachSending, setCoachSending] = useState(false);
  const aiConversationQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id || screen !== "ai") return null;
    return fetchOrCreateAIConversation(session.user.id);
  }, [session?.user?.id, screen === "ai"]);
  const coachConversationId = aiConversationQuery.data?.id || null;
  const coachMessagesQuery = useSupabaseQuery(async () => {
    if (!coachConversationId) return [];
    return fetchAIChatMessages(coachConversationId);
  }, [coachConversationId]);

  // Org-level AI Coach controls (enable/disable, Manual Mode) - per the
  // product brief, an org admin can turn AI Coach off entirely or switch it
  // to Manual Mode (admin's own canned message instead of a real AI reply).
  // Defaults to fully-on/automatic for any org that hasn't configured this.
  const orgAISettingsQuery = useSupabaseQuery(async () => fetchOrgAISettings(orgId), [orgId]);
  const orgAISettings = orgAISettingsQuery.data || { enabled: true, manual_mode: false, manual_message: "" };

  // Org-level leaderboard visibility - "Leaderboard visibility is
  // configurable. Admins can disable rankings."
  const orgLeaderboardSettingsQuery = useSupabaseQuery(async () => fetchOrgLeaderboardSettings(orgId), [orgId]);
  const leaderboardEnabled = orgLeaderboardSettingsQuery.data?.enabled !== false;
  // Gamification on/off - separate control from the leaderboard toggle
  // above (PRD: "Option to on gamification or off - on and off leadership
  // board" names two distinct toggles; only the leaderboard one existed
  // before this). Gates streaks/points/badges visibility across the app.
  const orgGamificationSettingsQuery = useSupabaseQuery(async () => fetchOrgGamificationSettings(orgId), [orgId]);
  const gamificationEnabled = orgGamificationSettingsQuery.data?.enabled !== false;

  // Assessments - distinct from AI Quiz Generator, tied to the course
  // currently open in CourseDetailScreen. Gated on screen === "courseDetail"
  // the same way aiConversationQuery above is gated on screen === "ai".
  const assessmentQuery = useSupabaseQuery(async () => {
    if (screen !== "courseDetail" || !params?.id) return null;
    return fetchAssessmentForCourse(params.id);
  }, [screen === "courseDetail", params?.id]);
  const assessmentId = assessmentQuery.data?.id || null;
  const assessmentQuestionsQuery = useSupabaseQuery(async () => {
    if (!assessmentId) return [];
    return fetchSafeAssessmentQuestions(assessmentId);
  }, [assessmentId]);
  const myAssessmentAttemptQuery = useSupabaseQuery(async () => {
    if (!assessmentId || !session?.user?.id) return null;
    return fetchMyAssessmentAttempt(assessmentId, session.user.id);
  }, [assessmentId, session?.user?.id]);

  async function handleSubmitAssessment(answersByQuestionId) {
    if (!assessmentId || !session?.user?.id) return;
    try {
      const result = await submitAssessmentAttempt(assessmentId, answersByQuestionId, session.user.id);
      showToast(result ? `Submitted! Score: ${result.score}%` : "Could not submit. Try again.");
      myAssessmentAttemptQuery.refetch();
    } catch (e) {
      showToast(e?.message || "Could not submit your assessment.");
    }
  }

  // Certificates - explicitly in-scope for v1, gated the same way as
  // assessmentQuery above (screen === "courseDetail" only).
  const certificateQuery = useSupabaseQuery(async () => {
    if (screen !== "courseDetail" || !params?.id) return null;
    return fetchCertificateForCourse(params.id);
  }, [screen === "courseDetail", params?.id]);
  const myCertificateQuery = useSupabaseQuery(async () => {
    if (!params?.id || !session?.user?.id) return null;
    return fetchMyCertificateForCourse(params.id, session.user.id);
  }, [params?.id, session?.user?.id]);

  async function handleRequestCertificate() {
    if (!params?.id) return;
    const result = await requestCertificate(params.id, session?.user?.id);
    if (result.success) {
      showToast(result.status === "issued" ? "Certificate issued!" : "Certificate requested - awaiting instructor approval.");
      myCertificateQuery.refetch();
    } else {
      showToast(result.error || "Could not request a certificate.");
    }
  }

  async function handleSendCoachMessage() {
    const content = coachInput.trim();
    if (!content || !coachConversationId || !session?.user?.id || coachSending) return;
    setCoachInput("");
    setCoachSending(true);
    try {
      await sendAIChatMessage({ conversationId: coachConversationId, userId: session.user.id, content, role: "user" });
      coachMessagesQuery.refetch();

      if (!orgAISettings.enabled) {
        // AI Coach turned off for this organization entirely - don't call
        // the real AI at all, just let the learner know why nothing happened.
        showToast("AI Coach has been turned off for your organization. Reach out to your instructor for help.");
        return;
      }

      if (orgAISettings.manual_mode) {
        // Manual Mode: the admin's own configured message stands in for a
        // real AI reply. Still written to ai_messages as an "assistant"
        // message (same table/shape a real reply would use) so it appears
        // in the conversation exactly like one - it just isn't generated by
        // the model.
        const manualText = orgAISettings.manual_message?.trim()
          || "Your organization has AI Coach set to manual mode right now. An instructor will follow up with you directly.";
        await sendAIChatMessage({ conversationId: coachConversationId, userId: session.user.id, content: manualText, role: "assistant" });
        coachMessagesQuery.refetch();
        return;
      }

      const reply = await requestAIReply({ conversationId: coachConversationId, message: content });
      if (reply?.error) {
        showToast(reply.error);
      }
      coachMessagesQuery.refetch();
    } catch (e) {
      showToast(e?.message || "Couldn't reach the AI coach. Try again.");
    } finally {
      setCoachSending(false);
    }
  }

  // Which quiz source is currently active: only AI-generated quizzes now
  // exist ("ai") - the pre-authored "bank" mode ("Practice Bank") was
  // removed entirely per direct confirmation. activeQuizSource is kept
  // (rather than removed) since the "active quiz" view still branches on
  // it for its title, and removing it outright would have meant touching
  // that render logic too for no real benefit.
  const [activeQuizSource, setActiveQuizSource] = useState("ai");
  const [quizGenTopic, setQuizGenTopic] = useState("");
  const [quizGenDifficulty, setQuizGenDifficulty] = useState("medium");
  const [quizGenQuestionCount, setQuizGenQuestionCount] = useState(5);
  const [quizGenerating, setQuizGenerating] = useState(false);
  const [quizGenError, setQuizGenError] = useState(null);
  // The generated quiz itself, normalized to { title, description,
  // estimatedTime, difficulty, questions: [{ id, question_text, options,
  // correctAnswer, explanation, points }] } - see generateAIQuiz in
  // schemaHelper.js for the raw edge-function response this comes from.
  const [aiQuiz, setAiQuiz] = useState(null);

  useEffect(() => {
    if (!quizTopic && quizzesQuery.data && quizzesQuery.data.length > 0) {
      setQuizTopic(quizzesQuery.data[0].id);
    }
  }, [quizzesQuery.data]);

  // Real question rows for whichever pre-authored quiz is selected (the
  // `safe_quiz_questions` view - no correct-answer column, scoring for these
  // happens server-side via the check_quiz_answers RPC in submitQuizAnswers).
  // This previously didn't exist at all: AIQuizScreen destructured
  // `selectedQuizQuestionsQuery` from useLearnerData()'s return value, but
  // that hook never defined or returned any such query, so the destructure
  // silently produced `undefined` and `selectedQuizQuestionsQuery.data` threw
  // a TypeError the instant the AI Quiz screen rendered - the pre-authored
  // quiz flow was completely broken, not just the missing "generate a quiz"
  // feature. Gated on screen==="ai" the same way the other screen-specific
  // queries in useLearnerData.js are.
  const selectedQuizQuestionsQuery = useSupabaseQuery(async () => {
    if (!quizTopic || screen !== "ai") return [];
    return fetchSafeQuizQuestions(quizTopic);
  }, [quizTopic, screen === "ai"]);

  const quizHistory = (quizAttemptsQuery.data || []).map(a => ({
    topic: a.quizzes?.title || "Quiz",
    score: Math.round(a.score || 0),
    date: timeAgo(a.completed_at),
  }));

  const weakAreas = (() => {
    const byTopic = {};
    for (const a of quizAttemptsQuery.data || []) {
      const topic = a.quizzes?.title || "Quiz";
      if (!byTopic[topic]) byTopic[topic] = { total: 0, count: 0 };
      byTopic[topic].total += a.score || 0;
      byTopic[topic].count += 1;
    }
    return Object.entries(byTopic)
      .map(([topic, v]) => ({ topic, mastery: Math.round(v.total / v.count) }))
      .filter(w => w.mastery < 70)
      .map(w => ({ ...w, note: `Average quiz score is ${w.mastery}%: worth another pass.` }));
  })();

  const [communityTab, setCommunityTab] = useState("posts");
  const [newPostText, setNewPostText] = useState("");
  const [expandedPost, setExpandedPost] = useState(null);

  const posts = (postsQuery.data || []).map(p => ({
    id: p.id,
    author: p.user_profiles?.display_name || "Learner",
    initials: p.user_profiles?.display_name ? p.user_profiles.display_name.slice(0, 2).toUpperCase() : "L",
    time: timeAgo(p.created_at),
    content: p.content,
    tag: p.post_type === "question" ? "Question" : "Community",
    isQuestion: p.post_type === "question",
    tags: p.tags || [],
    pinned: !!p.is_pinned,
    // Real `moderation_status` column, set 'pending' at insert and flipped
    // to 'approved'/'rejected' by the live ai-content-moderation edge
    // function (see createCommunityPost in schemaHelper.js). RLS already
    // hides non-approved posts from everyone except their author + admins,
    // so `isMine` here is only used to decide whether to show the learner
    // their own post's pending/rejected badge - other learners will simply
    // never receive a non-approved row from fetchCommunityPosts at all.
    moderationStatus: p.moderation_status || "approved",
    isMine: p.user_id === session?.user?.id,
    likes: (p.post_reactions || []).length,
    liked: (p.post_reactions || []).some(r => r.user_id === session?.user?.id),
    comments: (p.post_comments || []).length,
    replies: (p.post_comments || []).map(c => ({
      id: c.id,
      author: c.user_id === session?.user?.id ? "You" : (c.user_profiles?.display_name || "Learner"),
      text: c.content,
      time: timeAgo(c.created_at),
    })),
  }));

  const joinedGroupIds = new Set(myGroupIdsQuery.data || []);
  const notifications = notificationsQuery.data || [];

  async function markAllNotificationsRead() {
    const unread = notifications.filter(n => !n.read);
    await Promise.all(unread.map(n => markNotificationRead(n.id).catch(() => {})));
    notificationsQuery.refetch();
  }
  async function markOneNotificationRead(id) {
    await markNotificationRead(id).catch(() => {});
    notificationsQuery.refetch();
  }

  const mentorsList = (mentorsQuery.data || []).map(m => ({
    id: m.id,
    userId: m.user_id,
    name: m.user_profiles?.display_name || "Instructor",
    title: m.title || "Instructor",
    tagline: m.tagline || "",
    rate: m.hourly_rate || 0,
    rating: m.rating || 0,
    sessions: m.total_sessions || 0,
    years: m.years_of_experience || 0,
    languages: m.languages || [],
    specializations: m.specializations || [],
    // NOTE: the real `mentors` table has no `is_approved` column (only
    // `is_active`, which fetchAllMentors already filters on) - `is_approved`
    // was always undefined here, so every mentor silently rendered as
    // unverified regardless of status.
    verified: m.is_active,
    autoAccept: m.auto_accept_bookings,
    waitlist: false,
    bio: m.bio || "",
  }));

  const [messageInput, setMessageInput] = useState("");
  const [activeMentorThread, setActiveMentorThread] = useState(null);

  // Direct Messages - was previously a non-functional shell: conversationMessages
  // was hardcoded to [] and nothing ever called setActiveMentorThread, so the
  // recipientId/recipientName pushed from Community's "Message" buttons was
  // silently discarded and the Send button permanently no-op'd. Real thread
  // list + conversation fetch, mirroring the working mentor-side
  // MentorMessagesScreen.jsx, using the same schemaHelper.js functions.
  const messageThreadsQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return [];
    return fetchMentorMessageThreads(session.user.id);
  }, [session?.user?.id]);
  const messageThreads = (() => {
    const myId = session?.user?.id;
    if (!myId) return [];
    const rows = messageThreadsQuery.data || [];
    const byCounterpart = new Map();
    for (const r of rows) {
      const counterpartId = r.sender_id === myId ? r.receiver_id : r.sender_id;
      const counterpartProfile = r.sender_id === myId ? r.receiver : r.sender;
      if (!byCounterpart.has(counterpartId)) {
        byCounterpart.set(counterpartId, {
          counterpartId,
          name: counterpartProfile?.display_name || "Instructor",
          last: r.content,
          time: r.created_at,
          unread: 0,
        });
      }
      if (r.receiver_id === myId && !r.is_read) {
        byCounterpart.get(counterpartId).unread += 1;
      }
    }
    return [...byCounterpart.values()];
  })();

  useEffect(() => {
    if (screen !== "messages") return;
    if (params?.recipientId) {
      setActiveMentorThread({ counterpartId: params.recipientId, name: params.recipientName || "Instructor" });
    } else if (!activeMentorThread && messageThreads.length > 0) {
      setActiveMentorThread(messageThreads[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, params?.recipientId, messageThreadsQuery.loading]);

  const conversationQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id || !activeMentorThread?.counterpartId) return [];
    return fetchMentorMessageThread(session.user.id, activeMentorThread.counterpartId);
  }, [session?.user?.id, activeMentorThread?.counterpartId]);

  useEffect(() => {
    if (session?.user?.id && activeMentorThread?.counterpartId) {
      markMentorMessagesRead(session.user.id, activeMentorThread.counterpartId).then(() => messageThreadsQuery.refetch());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, activeMentorThread?.counterpartId]);

  async function handleSendMessage() {
    if (!messageInput.trim() || !activeMentorThread?.counterpartId || !session?.user?.id) return;
    await sendMentorMessage({ senderId: session.user.id, receiverId: activeMentorThread.counterpartId, content: messageInput.trim() });
    setMessageInput("");
    conversationQuery.refetch();
    messageThreadsQuery.refetch();
    showToast("Message sent!");
  }
  const [weeklyGoal, setWeeklyGoal] = useState(user.weeklyGoal);
  const [requestingSession, setRequestingSession] = useState(false);
  const [sessionRequestSent, setSessionRequestSent] = useState(false);
  const [sessionMentorChoice, setSessionMentorChoice] = useState(null);
  const [sessionTopicInput, setSessionTopicInput] = useState("");
  const [bookingDay, setBookingDay] = useState(null);
  const [bookingTime, setBookingTime] = useState("");

  // Real `mentor_availability` rows for whichever mentor the learner picked
  // to book - used to constrain the booking form to the mentor's actual
  // weekly recurring slots instead of letting a session get requested for
  // any arbitrary time (previously this booked "tomorrow, same time" no
  // matter what, regardless of whether the mentor was even available then).
  const mentorAvailabilityQuery = useSupabaseQuery(async () => {
    if (!sessionMentorChoice?.id) return [];
    return fetchMentorAvailability(sessionMentorChoice.id);
  }, [sessionMentorChoice?.id]);

  const activeTabKey = ["home", "courses", "ai", "community"].includes(screen) ? screen
    : ["courseDetail", "lesson"].includes(screen) ? "courses"
    : ["insights"].includes(screen) ? "ai"
    : ["postDetail", "mentors", "mentorDetail", "cohort"].includes(screen) ? "community"
    : null;

  const unreadNotifs = notifications.filter(n => !n.read).length;

  async function handleEnroll(courseId) {
    if (!session?.user?.id) return;
    const course = courseById(courseId);
    if (course && course.price > 0) {
      // Paid course: send the user to checkout instead of enrolling for
      // free. The paystack-initialize/stripe-initialize edge functions
      // create the pending course_enrollments row server-side once payment
      // starts, and flip it to "completed" once verified.
      push("creditsCheckout", {
        mode: "course_enrollment",
        courseId: course.id,
        courseTitle: course.title,
        coursePrice: course.price,
      });
      return;
    }
    await enrollInCourse(session.user.id, courseId);
    enrollmentsQuery.refetch();
    showToast("Enrolled in course!");
  }

  // "Apply for a course" - for courses flagged requires_approval, this
  // requests to join instead of enrolling instantly (see
  // course_applications table + CourseDetailScreen's requires_approval
  // branch). Loaded once per learner and matched to whichever course is
  // being viewed, same pattern as enrollmentsQuery/courseById above.
  const applicationsQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return [];
    return fetchMyCourseApplications(session.user.id);
  }, [session?.user?.id]);
  function myApplicationForCourse(courseId) {
    return (applicationsQuery.data || []).find(a => a.course_id === courseId) || null;
  }
  async function handleRequestJoin(courseId) {
    if (!session?.user?.id) return;
    try {
      await requestCourseApplication({ userId: session.user.id, courseId });
      applicationsQuery.refetch();
      showToast("Request sent. You'll be enrolled once it's approved.");
    } catch (e) {
      showToast(e?.message || "Could not send your request.");
    }
  }

  async function handleAvatarUploaded(url) {
    if (!session?.user?.id || !url) return;
    try {
      await updateUserAvatar(session.user.id, url);
      userProfileQuery.refetch();
      showToast("Profile photo updated!");
    } catch (e) {
      showToast("Couldn't save your new photo. Please try again.");
    }
  }

  return (
    <NotificationBellContext.Provider value={{ unread: unreadNotifs, onOpen: () => push("notifications") }}>
    <div className={`tai ${dark ? "dark" : ""}`} style={brandPrimaryColor ? { "--primary": brandPrimaryColor } : undefined}>
      <style>{TOKENS}</style>
      <div className="tai-app-outer">
        {/* Global Top Header matching Screenshot 1 & 2 */}
        <LearnerHeader
          user={user}
          credits={credits}
          onBuyCredits={() => push("creditsCheckout", { mode: "credits" })}
          onOpenNotifications={() => push("notifications")}
          unreadNotifs={unreadNotifs}
          onOpenDashboardSwitcher={
            (onSwitchToPlatform || (userRoles && userRoles.length > 0))
              ? () => setSwitcherOpen(true)
              : undefined
          }
          hasPlatformRole={!!onSwitchToPlatform}
          onProfile={() => push("settings")}
          onSignOut={handleSignOut}
          brandLogoUrl={brandLogoUrl}
          dark={dark}
          go={handleSidebarNav}
          active={screen}
          searchComponent={
            <div className="tai-header-search">
              <Search size={15} color="var(--text-3)" />
              <input
                placeholder="Search..."
                value={courseSearch}
                onChange={(e) => {
                  setCourseSearch(e.target.value);
                  if (screen !== "courses") {
                    setShowMyCoursesOnly(false);
                    goTab("courses");
                  }
                }}
              />
            </div>
          }
        />

        <div className="tai-desktop-shell">
          <DesktopSidebar
            activeScreen={screen}
            currentTab={showMyCoursesOnly ? "myCourses" : communityTab}
            go={handleSidebarNav}
            onProfile={() => push("settings")}
            onOpenDashboardSwitcher={
              (onSwitchToPlatform || (userRoles && userRoles.length > 0))
                ? () => setSwitcherOpen(true)
                : undefined
            }
            onSignOut={handleSignOut}
            brandLogoUrl={brandLogoUrl}
            user={user}
            unreadNotifs={unreadNotifs}
          />

          <div className="tai-app">
            <div className="tai-body">
              {screen === "home" && (
                <HomeScreen
                  user={user} courses={courses} coursesLoading={coursesLoading}
                  unreadNotifs={unreadNotifs} weeklyGoal={weeklyGoal}
                  session={session} showToast={showToast}
                  push={push} goTab={goTab}
                  goToMyCourses={() => { setShowMyCoursesOnly(true); goTab("courses"); }}
                  cohort={cohortMembershipQuery.data?.cohort || null}
                  cohortLoading={cohortMembershipQuery.loading}
                />
              )}
              {screen === "courses" && (
                <CoursesScreen
                  courses={courses.map(c => ({ ...c, applicationStatus: myApplicationForCourse(c.id)?.status || null }))}
                  coursesLoading={coursesLoading}
                  courseSearch={courseSearch} setCourseSearch={setCourseSearch}
                  courseLevelFilter={courseLevelFilter} setCourseLevelFilter={setCourseLevelFilter}
                  courseSourceTab={courseSourceTab} setCourseSourceTab={setCourseSourceTab}
                  showMyCoursesOnly={showMyCoursesOnly} setShowMyCoursesOnly={setShowMyCoursesOnly}
                  push={push} handleEnroll={handleEnroll} handleRequestJoin={handleRequestJoin}
                  onToggleBookmark={handleToggleBookmark}
                />
              )}
              {screen === "courseDetail" && (
                <CourseDetailScreen
                  course={courseById(params.id)}
                  lessons={lessonsForCurrentCourse()}
                  isEnrolled={courseById(params.id)?.enrolled}
                  courseLessonsQuery={courseLessonsQuery}
                  courseNotesQuery={courseNotesQuery}
                  courseDiscussionQuery={courseDiscussionQuery}
                  courseReviewsQuery={courseReviewsQuery}
                  session={session}
                  completedLessonIds={completedLessonIds}
                  discussionInput={discussionInput} setDiscussionInput={setDiscussionInput}
                  newNoteText={newNoteText} setNewNoteText={setNewNoteText}
                  params={params} setParams={setParams}
                  push={push} back={back} showToast={showToast}
                  enrollInCourse={enrollInCourse} enrollmentsQuery={enrollmentsQuery} handleEnroll={handleEnroll}
                  myApplication={myApplicationForCourse(params.id)} handleRequestJoin={handleRequestJoin}
                  addCourseNote={addCourseNote} postCourseDiscussionMessage={postCourseDiscussionMessage}
                  assessmentQuery={assessmentQuery} assessmentQuestionsQuery={assessmentQuestionsQuery}
                  myAssessmentAttemptQuery={myAssessmentAttemptQuery} handleSubmitAssessment={handleSubmitAssessment}
                  certificateQuery={certificateQuery} myCertificateQuery={myCertificateQuery} handleRequestCertificate={handleRequestCertificate}
                  orgBrandingQuery={orgBrandingQuery}
                />
              )}
              {screen === "lesson" && (
                <LessonScreen
                  course={courseById(params.id)}
                  lessons={lessonsForCurrentCourse()}
                  lessonId={params.lessonId}
                  session={session}
                  lessonNotesQuery={lessonNotesQuery}
                  noteInputText={noteInputText} setNoteInputText={setNoteInputText}
                  back={back} push={push} showToast={showToast}
                  markLessonComplete={markLessonComplete} enrollmentsQuery={enrollmentsQuery}
                  lessonProgressQuery={lessonProgressQuery}
                  completedLessonIds={completedLessonIds} setCompletedLessonIds={setCompletedLessonIds}
                  addLessonNote={addLessonNote}
                />
              )}
              {screen === "ai" && (
                <AIQuizScreen
                  orgId={orgId}
                  aiTab={aiTab} setAiTab={setAiTab}
                  activeQuizSource={activeQuizSource} setActiveQuizSource={setActiveQuizSource}
                  quizGenTopic={quizGenTopic} setQuizGenTopic={setQuizGenTopic}
                  quizGenDifficulty={quizGenDifficulty} setQuizGenDifficulty={setQuizGenDifficulty}
                  quizGenQuestionCount={quizGenQuestionCount} setQuizGenQuestionCount={setQuizGenQuestionCount}
                  quizGenerating={quizGenerating} setQuizGenerating={setQuizGenerating}
                  quizGenError={quizGenError} setQuizGenError={setQuizGenError}
                  aiQuiz={aiQuiz} setAiQuiz={setAiQuiz}
                  quizTopic={quizTopic} setQuizTopic={setQuizTopic}
                  quizStage={quizStage} setQuizStage={setQuizStage}
                  quizIndex={quizIndex} setQuizIndex={setQuizIndex}
                  quizAnswers={quizAnswers} setQuizAnswers={setQuizAnswers}
                  quizSelected={quizSelected} setQuizSelected={setQuizSelected}
                  quizShowHint={quizShowHint} setQuizShowHint={setQuizShowHint}
                  quizResult={quizResult} setQuizResult={setQuizResult}
                  quizSubmitting={quizSubmitting} setQuizSubmitting={setQuizSubmitting}
                  quizzesQuery={quizzesQuery} selectedQuizQuestionsQuery={selectedQuizQuestionsQuery}
                  quizAttemptsQuery={quizAttemptsQuery} quizHistory={quizHistory} weakAreas={weakAreas}
                  session={session} showToast={showToast} submitQuizAnswers={submitQuizAnswers}
                  generateAIQuiz={generateAIQuiz} awardAIQuizCompletionPoints={awardAIQuizCompletionPoints}
                  credits={credits} consumeCredit={consumeCredit} onBuyCredits={() => push("creditsCheckout", { mode: "credits" })}
                  coachMessages={coachMessagesQuery.data || []} coachMessagesLoading={coachMessagesQuery.loading}
                  coachInput={coachInput} setCoachInput={setCoachInput} coachSending={coachSending}
                  onSendCoachMessage={handleSendCoachMessage}
                />
              )}
              {screen === "community" && (
                <CommunityScreen
                  communityTab={communityTab} setCommunityTab={setCommunityTab}
                  posts={posts} newPostText={newPostText} setNewPostText={setNewPostText}
                  expandedPost={expandedPost} setExpandedPost={setExpandedPost}
                  replyInput={replyInput} setReplyInput={setReplyInput}
                  studyGroupsQuery={studyGroupsQuery} joinedGroupIds={joinedGroupIds} myGroupIdsQuery={myGroupIdsQuery}
                  communityPeopleQuery={communityPeopleQuery}
                  memberStatsQuery={memberStatsQuery} activityFeedQuery={activityFeedQuery}
                  user={user} session={session} showToast={showToast} postsQuery={postsQuery}
                  createCommunityPost={createCommunityPost} togglePostReaction={togglePostReaction} addPostComment={addPostComment}
                  joinStudyGroup={joinStudyGroup} leaveStudyGroup={leaveStudyGroup}
                  fetchStudyGroupMembers={fetchStudyGroupMembers}
                  cohortMembershipQuery={cohortMembershipQuery} cohortPostsQuery={cohortPostsQuery}
                  leaderboardQuery={leaderboardQuery}
                  leaderboardEnabled={leaderboardEnabled}
                  upcomingSessionsQuery={upcomingSessionsQuery}
                  enrollmentsQuery={enrollmentsQuery}
                  cohortResourcesQuery={cohortResourcesQuery}
                  push={push} goTab={goTab}
                  initialExpandedPostId={params.postId}
                />
              )}
              {screen === "cohort" && (
                <CohortScreen
                  cohort={cohortMembershipQuery.data?.cohort || null}
                  cohortMembershipQuery={cohortMembershipQuery}
                  cohortPostsQuery={cohortPostsQuery}
                  cohortResourcesQuery={cohortResourcesQuery}
                  cohortSessionsQuery={cohortSessionsQuery}
                  cohortCoursesQuery={cohortCoursesQuery}
                  cohortMembersQuery={cohortMembersQuery}
                  session={session} showToast={showToast} back={back}
                />
              )}
              {screen === "mentors" && (
                <MentorsScreen
                  mentorsList={mentorsList} requestingSession={requestingSession} setRequestingSession={setRequestingSession}
                  sessionMentorChoice={sessionMentorChoice} setSessionMentorChoice={setSessionMentorChoice}
                  sessionTopicInput={sessionTopicInput} setSessionTopicInput={setSessionTopicInput}
                  sessionRequestSent={sessionRequestSent} setSessionRequestSent={setSessionRequestSent}
                  session={session} showToast={showToast} bookMentorshipSession={bookMentorshipSession}
                  upcomingSessionsQuery={upcomingSessionsQuery}
                  mentorAvailabilityQuery={mentorAvailabilityQuery}
                  bookingDay={bookingDay} setBookingDay={setBookingDay}
                  bookingTime={bookingTime} setBookingTime={setBookingTime}
                  initialSelectedMentorId={params.mentorId}
                />
              )}
              {screen === "messages" && (
                <MessagesScreen
                  activeMentorThread={activeMentorThread} setActiveMentorThread={setActiveMentorThread}
                  messageInput={messageInput} setMessageInput={setMessageInput}
                  messageThreads={messageThreads} threadsLoading={messageThreadsQuery.loading}
                  conversationMessages={conversationQuery.data || []} conversationLoading={conversationQuery.loading}
                  session={session} user={user} back={back} showToast={showToast}
                  handleSendMessage={handleSendMessage}
                />
              )}
              {screen === "notifications" && (
                <NotificationsScreen
                  notifications={notifications} markAllNotificationsRead={markAllNotificationsRead}
                  markOneNotificationRead={markOneNotificationRead} back={back}
                />
              )}
              {screen === "settings" && (
                <ProfileScreen
                  user={user} dark={dark} setDark={setDark} signOut={handleSignOut} back={back} push={push}
                  onOpenDashboardSwitcher={() => setSwitcherOpen(true)}
                  credits={credits} onBuyCredits={() => push("creditsCheckout", { mode: "credits" })}
                  session={session} onAvatarUploaded={handleAvatarUploaded} showToast={showToast}
                  gamificationEnabled={gamificationEnabled}
                  weeklyGoal={weeklyGoal} setWeeklyGoal={setWeeklyGoal}
                />
              )}
              {screen === "achievements" && (
                <AchievementsScreen
                  user={user}
                  achievements={achievementsQuery.data || []}
                  streakActivity={streakActivityQuery.data || []}
                  back={back}
                  session={session} showToast={showToast}
                  credits={credits} consumeCredit={consumeCredit} onBuyCredits={() => push("creditsCheckout", { mode: "credits" })}
                />
              )}
              {screen === "creditsCheckout" && (
                <CreditsCheckoutScreen
                  session={session} params={params} back={back} showToast={showToast}
                />
              )}
              {screen === "paymentCallback" && (
                <PaymentCallbackScreen
                  addCredits={addCredits} enrollmentsQuery={enrollmentsQuery} goTab={goTab} showToast={showToast}
                />
              )}
              {screen === "bookmarks" && (
                <BookmarksScreen push={push} back={back} showToast={showToast} session={session} />
              )}
              {screen === "myProgress" && (
                <MyProgressScreen user={user} courses={courses} push={push} back={back} session={session} showToast={showToast} />
              )}
              {screen === "learningPaths" && (
                <LearningPathsView push={push} back={back} />
              )}
              {screen === "schedule" && (
                <ScheduleView push={push} back={back} />
              )}
            </div>

            <BottomNav active={activeTabKey} go={goTab} />

            {toast && <div className="tai-toast anim-pop"><CheckCircle2 size={15} />{toast}</div>}
          </div>
        </div>
      </div>
      {switcherOpen && (
        <DashboardSwitcher
          currentDashboard={DASHBOARDS.LEARNER}
          availableDashboards={getAvailableDashboards(userRoles)}
          roleLabel={userRoles.includes("super_admin") ? "Super Admin" : userRoles.length > 1 ? "Admin" : "Learner"}
          onSwitch={(key) => {
            setSwitcherOpen(false);
            if (key === DASHBOARDS.LEARNER) return;
            onSwitchDashboard ? onSwitchDashboard(key) : (onSwitchToPlatform && onSwitchToPlatform());
          }}
          onClose={() => setSwitcherOpen(false)}
        />
      )}
    </div>
    </NotificationBellContext.Provider>
  );
}
