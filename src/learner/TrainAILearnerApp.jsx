import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../lib/useAuth.js";
import { useLearnerData } from "./hooks/useLearnerData.js";
import { TOKENS, BottomNav, DesktopSidebar, timeAgo } from "./components/LearnerUI.jsx";
import { SearchBar } from "./components/SearchBar.jsx";
import { HomeScreen } from "./screens/HomeScreen.jsx";
import { CoursesScreen } from "./screens/CoursesScreen.jsx";
import { CourseDetailScreen } from "./screens/CourseDetailScreen.jsx";
import { LessonScreen } from "./screens/LessonScreen.jsx";
import { AIQuizScreen } from "./screens/AIQuizScreen.jsx";
import { CommunityScreen } from "./screens/CommunityScreen.jsx";
import { MentorsScreen } from "./screens/MentorsScreen.jsx";
import { MessagesScreen } from "./screens/MessagesScreen.jsx";
import { NotificationsScreen } from "./screens/NotificationsScreen.jsx";
import { ProfileScreen } from "./screens/ProfileScreen.jsx";
import { AchievementsScreen } from "./screens/AchievementsScreen.jsx";
import { CreditsCheckoutScreen } from "./screens/CreditsCheckoutScreen.jsx";
import { PaymentCallbackScreen } from "./screens/PaymentCallbackScreen.jsx";
import { LearningPathsScreen } from "./screens/LearningPathsScreen.jsx";
import { useCredits } from "./hooks/useCredits.js";
import { useSupabaseQuery } from "../lib/useSupabaseQuery.js";
import { enrollInCourse, markLessonComplete, addCourseNote, postCourseDiscussionMessage, addLessonNote, markNotificationRead, submitQuizAnswers, enrollInLearningPath, fetchSafeQuizQuestions, awardAIQuizCompletionPoints, requestCourseApplication, fetchMyCourseApplications } from "../lib/api/learner.js";
import {
  createCommunityPost, addPostComment, togglePostReaction, bookMentorshipSession, sendMentorMessage,
  joinStudyGroup, leaveStudyGroup, fetchStudyGroupMessages, sendStudyGroupMessage, fetchStudyGroupMembers, fetchMentorAvailability,
  fetchForumThreads, fetchForumThread, createForumThread, createForumReply, voteForumPost,
  addCohortPostReply, toggleCohortPostReaction, generateAIQuiz,
  fetchMentorMessageThreads, fetchMentorMessageThread, markMentorMessagesRead
} from "../lib/api/schemaHelper.js";
import { updateUserAvatar, fetchOrgBranding, createCohortPost } from "../lib/api/platform.js";
import { CheckCircle2 } from "lucide-react";

// Paystack/Stripe redirect the browser back to this same page (no router in
// this app) with either ?reference=/?trxref= (Paystack) or ?session_id=
// (Stripe) on the query string. If present at boot, land straight on the
// payment callback screen instead of "home" so PaymentCallbackScreen can
// verify the transaction — this is the whole "no-router landing" story.
function initialScreenFromLocation() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reference") || params.get("trxref") || params.get("session_id")) {
      return "paymentCallback";
    }
  } catch {
    // window/URLSearchParams unavailable (e.g. SSR) — fall through to home
  }
  return "home";
}

export default function TrainAILearnerApp({ isActive = true, onSwitchToPlatform } = {}) {
  const { session, signOut } = useAuth();
  const [dark, setDark] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  function showToast(message) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
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
    myGroupIdsQuery, communityPeopleQuery, forumCategoriesQuery, activityFeedQuery, memberStatsQuery, notificationsQuery, upcomingSessionsQuery, mentorsQuery,
    cohortMembershipQuery, cohortPostsQuery,
    gamificationStatsQuery, achievementsQuery, streakActivityQuery, leaderboardQuery, enrollmentsQuery, lessonProgressQuery,
    userProfileQuery, learningPathsQuery, pathEnrollmentsQuery,
  } = learnerData;

  // Per-organization white-label branding (real `branding_settings` table —
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
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);
  const [courseLevelFilter, setCourseLevelFilter] = useState("all");
  const [courseSourceTab, setCourseSourceTab] = useState("all");
  const [courseSearch, setCourseSearch] = useState("");

  const [aiTab, setAiTab] = useState("quiz");
  const [quizTopic, setQuizTopic] = useState(null);
  const [quizStage, setQuizStage] = useState("setup");
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSelected, setQuizSelected] = useState(null);
  const [quizShowHint, setQuizShowHint] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const [quizSubmitting, setQuizSubmitting] = useState(false);

  // Which quiz source is currently selected/being taken: the real
  // pre-authored `quizzes` bank ("bank"), or an in-memory AI-generated quiz
  // ("ai") that has no row in the DB at all. quizSourceMode drives the
  // setup-stage toggle; activeQuizSource is fixed the moment a quiz is
  // actually started (so switching the toggle mid-attempt doesn't yank the
  // questions out from under an in-progress quiz).
  const [quizSourceMode, setQuizSourceMode] = useState("bank");
  const [activeQuizSource, setActiveQuizSource] = useState("bank");
  const [quizGenTopic, setQuizGenTopic] = useState("");
  const [quizGenDifficulty, setQuizGenDifficulty] = useState("medium");
  const [quizGenQuestionCount, setQuizGenQuestionCount] = useState(5);
  const [quizGenerating, setQuizGenerating] = useState(false);
  const [quizGenError, setQuizGenError] = useState(null);
  // The generated quiz itself, normalized to { title, description,
  // estimatedTime, difficulty, questions: [{ id, question_text, options,
  // correctAnswer, explanation, points }] } — see generateAIQuiz in
  // schemaHelper.js for the raw edge-function response this comes from.
  const [aiQuiz, setAiQuiz] = useState(null);

  useEffect(() => {
    if (!quizTopic && quizzesQuery.data && quizzesQuery.data.length > 0) {
      setQuizTopic(quizzesQuery.data[0].id);
    }
  }, [quizzesQuery.data]);

  // Real question rows for whichever pre-authored quiz is selected (the
  // `safe_quiz_questions` view — no correct-answer column, scoring for these
  // happens server-side via the check_quiz_answers RPC in submitQuizAnswers).
  // This previously didn't exist at all: AIQuizScreen destructured
  // `selectedQuizQuestionsQuery` from useLearnerData()'s return value, but
  // that hook never defined or returned any such query, so the destructure
  // silently produced `undefined` and `selectedQuizQuestionsQuery.data` threw
  // a TypeError the instant the AI Quiz screen rendered — the pre-authored
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
      .map(w => ({ ...w, note: `Average quiz score is ${w.mastery}% — worth another pass.` }));
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
    // their own post's pending/rejected badge — other learners will simply
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
    name: m.user_profiles?.display_name || "Mentor",
    title: m.title || "Mentor",
    tagline: m.tagline || "",
    rate: m.hourly_rate || 0,
    rating: m.rating || 0,
    sessions: m.total_sessions || 0,
    years: m.years_of_experience || 0,
    languages: m.languages || [],
    specializations: m.specializations || [],
    // NOTE: the real `mentors` table has no `is_approved` column (only
    // `is_active`, which fetchAllMentors already filters on) — `is_approved`
    // was always undefined here, so every mentor silently rendered as
    // unverified regardless of status.
    verified: m.is_active,
    autoAccept: m.auto_accept_bookings,
    waitlist: false,
    bio: m.bio || "",
  }));

  const [messageInput, setMessageInput] = useState("");
  const [activeMentorThread, setActiveMentorThread] = useState(null);

  // Direct Messages — was previously a non-functional shell: conversationMessages
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
          name: counterpartProfile?.display_name || "Mentor",
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
      setActiveMentorThread({ counterpartId: params.recipientId, name: params.recipientName || "Mentor" });
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
  // to book — used to constrain the booking form to the mentor's actual
  // weekly recurring slots instead of letting a session get requested for
  // any arbitrary time (previously this booked "tomorrow, same time" no
  // matter what, regardless of whether the mentor was even available then).
  const mentorAvailabilityQuery = useSupabaseQuery(async () => {
    if (!sessionMentorChoice?.id) return [];
    return fetchMentorAvailability(sessionMentorChoice.id);
  }, [sessionMentorChoice?.id]);

  const activeTabKey = ["home", "courses", "ai", "community"].includes(screen) ? screen
    : ["courseDetail", "lesson", "paths", "pathDetail"].includes(screen) ? "courses"
    : ["insights"].includes(screen) ? "ai"
    : ["postDetail", "mentors", "mentorDetail"].includes(screen) ? "community"
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

  // "Apply for a course" — for courses flagged requires_approval, this
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
      showToast("Request sent — you'll be enrolled once it's approved.");
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
      showToast("Couldn't save your new photo — please try again.");
    }
  }

  return (
    <div className={`tai ${dark ? "dark" : ""}`} style={brandPrimaryColor ? { "--primary": brandPrimaryColor } : undefined}>
      <style>{TOKENS}</style>
      <div className="tai-app-outer">
        <div className="tai-desktop-shell">
          <DesktopSidebar
            active={activeTabKey}
            go={goTab}
            onProfile={() => push("settings")}
            profileActive={screen === "settings"}
            onSwitchToPlatform={onSwitchToPlatform}
            brandLogoUrl={brandLogoUrl}
          />

          <div className="tai-app">
            <div className="tai-body">
              {!["lesson", "creditsCheckout", "paymentCallback"].includes(screen) && (
                <SearchBar
                  courses={courses}
                  mentors={mentorsList}
                  posts={posts}
                  onOpenCourse={(courseId) => push("courseDetail", { id: courseId })}
                  onOpenMentor={(mentorId) => push("mentors", { mentorId })}
                  onOpenPost={(postId) => { setCommunityTab("posts"); push("community", { postId }); }}
                />
              )}
              {screen === "home" && (
                <HomeScreen
                  user={user} courses={courses} coursesLoading={coursesLoading}
                  unreadNotifs={unreadNotifs} weeklyGoal={weeklyGoal}
                  achievements={achievementsQuery.data || []}
                  session={session} onGamificationRefetch={gamificationStatsQuery.refetch}
                  push={push} goTab={goTab} showToast={showToast}
                />
              )}
              {screen === "courses" && (
                <CoursesScreen
                  courses={courses.map(c => ({ ...c, applicationStatus: myApplicationForCourse(c.id)?.status || null }))}
                  coursesLoading={coursesLoading}
                  courseSearch={courseSearch} setCourseSearch={setCourseSearch}
                  courseLevelFilter={courseLevelFilter} setCourseLevelFilter={setCourseLevelFilter}
                  courseSourceTab={courseSourceTab} setCourseSourceTab={setCourseSourceTab}
                  showBookmarkedOnly={showBookmarkedOnly} setShowBookmarkedOnly={setShowBookmarkedOnly}
                  push={push} handleEnroll={handleEnroll} handleRequestJoin={handleRequestJoin}
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
                  aiTab={aiTab} setAiTab={setAiTab}
                  quizSourceMode={quizSourceMode} setQuizSourceMode={setQuizSourceMode}
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
                  fetchStudyGroupMessages={fetchStudyGroupMessages} sendStudyGroupMessage={sendStudyGroupMessage} fetchStudyGroupMembers={fetchStudyGroupMembers}
                  forumCategoriesQuery={forumCategoriesQuery}
                  fetchForumThreads={fetchForumThreads} fetchForumThread={fetchForumThread}
                  createForumThread={createForumThread} createForumReply={createForumReply} voteForumPost={voteForumPost}
                  cohortMembershipQuery={cohortMembershipQuery} cohortPostsQuery={cohortPostsQuery}
                  createCohortPost={createCohortPost} addCohortPostReply={addCohortPostReply} toggleCohortPostReaction={toggleCohortPostReaction}
                  push={push} goTab={goTab}
                  initialExpandedPostId={params.postId}
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
                  conversationMessages={[]} conversationLoading={false}
                  session={session} user={user} back={back} showToast={showToast} sendMentorMessage={sendMentorMessage}
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
                  user={user} dark={dark} setDark={setDark} signOut={signOut} back={back} push={push}
                  onSwitchToPlatform={onSwitchToPlatform}
                  credits={credits} onBuyCredits={() => push("creditsCheckout", { mode: "credits" })}
                  session={session} onAvatarUploaded={handleAvatarUploaded} showToast={showToast}
                />
              )}
              {screen === "achievements" && (
                <AchievementsScreen
                  user={user}
                  achievements={achievementsQuery.data || []}
                  streakActivity={streakActivityQuery.data || []}
                  back={back}
                  session={session}
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
              {screen === "paths" && (
                <LearningPathsScreen
                  paths={learningPathsQuery.data || []}
                  pathEnrollments={pathEnrollmentsQuery.data || []}
                  courseById={courseById}
                  back={back}
                  push={push}
                  session={session}
                  enrollInLearningPath={enrollInLearningPath}
                  pathEnrollmentsQuery={pathEnrollmentsQuery}
                  showToast={showToast}
                />
              )}
            </div>

            <BottomNav active={activeTabKey} go={goTab} />

            {toast && <div className="tai-toast anim-pop"><CheckCircle2 size={15} />{toast}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
