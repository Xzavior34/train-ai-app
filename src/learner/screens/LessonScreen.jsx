import React, { useState, useEffect, useRef } from "react";
import { TopBar, ProgressBar, Tag, Avatar, timeAgo, initialsOf } from "../components/LearnerUI.jsx";
import {
  Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize2, Minimize2,
  CheckCircle2, ChevronRight, ChevronLeft, PlusCircle, ThumbsUp, ThumbsDown,
  Clock, Video, BookOpen, Sparkles, Download, Share2, HelpCircle, FileText,
  Code2, Award, Star, MessageSquare, Send, Search, Check, X, ShieldCheck,
  Bookmark, Heart, Layers, RefreshCw, PanelRightClose, PanelRightOpen,
  Sliders, ExternalLink, Bot, Terminal, Copy, Paperclip
} from "lucide-react";
import {
  submitLessonFeedback, fetchLessonsForCourse,
  fetchOrCreateCourseDiscussion, fetchCourseDiscussionMessages, postCourseDiscussionMessage
} from "../../lib/api/learner.js";
import { fetchCourseMaterials } from "../../lib/api/platform.js";
import { fetchCourseInstructor } from "../../lib/api/live/learnerCourseLive.js";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { DEMO_MODE, liveOr } from "../../lib/demoMode.js";
import { getYouTubeEmbedId, isMockDataEnabled } from "../../lib/mockDataManager.js";

// Synchronized transcript lines. Case C: `lessons` has no transcript (or
// caption/VTT) column anywhere in the schema, so these lines cannot be
// anything but illustrative - and they were being presented as THE
// transcript of every lesson in the catalog. Kept for the no-database
// walkthrough; both the tab and the panel disappear once Supabase is
// configured.
// Illustrative objectives for the no-database walkthrough only. `lessons`
// stores objectives in its own `content` column; when that is empty there is
// genuinely nothing to list, so with a database connected the card is hidden
// instead of borrowing these.
const DEMO_LESSON_OBJECTIVES = [
  "Architecting asynchronous function calling with schema validation.",
  "Configuring Figma variables & vector tokens for design system automation.",
  "Setting up Supabase pgvector with HNSW similarity index scoring.",
  "Implementing exponential backoff and jittered retry hooks for multi-agent reliability.",
];

const DEFAULT_TRANSCRIPT = [
  { time: "00:00", seconds: 0, speaker: "Instructor", text: "Welcome back! In this masterclass module, we are diving deep into production-grade multi-agent AI architecture." },
  { time: "01:15", seconds: 75, speaker: "Instructor", text: "Before we write our first function call, let's examine why traditional single-prompt chains break down in enterprise applications." },
  { time: "03:45", seconds: 225, speaker: "Instructor", text: "Here we have our design tokens and variable schema. Notice how structured JSON definitions allow seamless synchronization." },
  { time: "06:20", seconds: 380, speaker: "Instructor", text: "Let's inspect the payload received from the API and observe how the latency drops under 180 milliseconds." },
  { time: "08:15", seconds: 495, speaker: "Instructor", text: "Now we connect our vector embeddings store with Supabase pgvector for sub-second similarity ranking." },
  { time: "11:40", seconds: 700, speaker: "Instructor", text: "Pay close attention to error recovery here. If an agent fails its validation schema, we execute a fallback retry hook." },
  { time: "13:30", seconds: 810, speaker: "Instructor", text: "Look at the memory allocation graph: by caching token embeddings client-side, we reduce unnecessary network roundtrips by 65%." },
  { time: "17:20", seconds: 1040, speaker: "Instructor", text: "Let's test this in our staging environment. As you can see, the build passes with zero lint or hydration warnings." },
  { time: "21:05", seconds: 1265, speaker: "Instructor", text: "That wraps up this module! Complete the quick knowledge check and check out the starter kit in the resources tab." }
];

// Downloadable assets. Real source: the `course_materials` table via
// fetchCourseMaterials(courseId) - see lib/api/platform.js. Titles, types and
// links are all real columns there; file SIZE is not stored anywhere, so the
// "ZIP • 4.2 MB" / "FIG • 18.5 MB" strings below are demo-only.
const DEMO_LESSON_RESOURCES = [
  { id: "res-1", title: "Starter Code Repository (GitHub)", type: "GitHub Repo", size: "ZIP • 4.2 MB", icon: Code2, url: "https://github.com" },
  { id: "res-2", title: "Complete Figma Design Tokens & Variables Kit", type: "Figma File", size: "FIG • 18.5 MB", icon: Layers, url: "https://figma.com" },
  { id: "res-3", title: "Masterclass Slide Deck & Architecture Diagrams", type: "PDF Document", size: "PDF • 8.1 MB", icon: FileText, url: "#" },
  { id: "res-4", title: "AI Prompt Engineering & Function Schemas Cheat Sheet", type: "Quick Reference", size: "PDF • 2.4 MB", icon: Sparkles, url: "#" }
];

// Q&A threads. Real source: the `course_discussions` table
// (fetchOrCreateCourseDiscussion / fetchCourseDiscussionMessages /
// postCourseDiscussionMessage in lib/api/learner.js), which is course-scoped
// rather than lesson-scoped and stores flat messages - no upvote column, no
// answer threading, no instructor flag. The upvote counts (24/18) and the
// verified instructor answers below therefore exist only for the
// no-database walkthrough.
const DEMO_QA_THREADS = [
  {
    id: "qa-1",
    author: "Elena Rostova",
    role: "Senior AI Engineer",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
    time: "2 days ago",
    timestamp: "08:15",
    title: "How do we handle rate-limiting when parallel agents make 10+ tool calls simultaneously?",
    content: "When spawning multiple subagents concurrently, is it better to use a leaky bucket queue or token-bucket throttling at the gateway layer?",
    upvotes: 24,
    upvoted: false,
    answersCount: 3,
    answers: [
      {
        id: "ans-1",
        author: "Astrid Larsson",
        isInstructor: true,
        role: "Instructor • Lead AI Architect",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
        time: "1 day ago",
        text: "Great question Elena! In production we recommend a token-bucket queue paired with exponential backoff and jitter. Check Chapter 4 where we cover the retry middleware pattern."
      }
    ]
  },
  {
    id: "qa-2",
    author: "David Kim",
    role: "Full-Stack Fellow",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
    time: "4 days ago",
    timestamp: "13:30",
    title: "Does pgvector index creation slow down batch inserts for 100k+ documents?",
    content: "Should we build the HNSW index before or after bulk loading the initial dataset?",
    upvotes: 18,
    upvoted: false,
    answersCount: 2,
    answers: [
      {
        id: "ans-2",
        author: "Alex Rivera",
        isInstructor: true,
        role: "Staff Engineer",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
        time: "3 days ago",
        text: "Always bulk load first without the HNSW index, then run CREATE INDEX afterwards! It's up to 10x faster."
      }
    ]
  }
];

export function LessonScreen({
  course, lessons = [], lessonId, session, lessonNotesQuery, noteInputText, setNoteInputText,
  back, push, showToast, markLessonComplete, enrollmentsQuery, lessonProgressQuery,
  completedLessonIds, setCompletedLessonIds, addLessonNote,
  // Real AI path, owned by TrainAILearnerApp so the org's AI on/off and manual
  // mode settings are honoured in one place instead of being bypassed here.
  orgAISettings, askLessonTutor
}) {
  // Video Player States
  const [isPlaying, setIsPlaying] = useState(false);
  // Started at 145s ("2:25 already watched") against a fixed 22:00 runtime on
  // every lesson. The real runtime is lessons.duration_minutes (see
  // totalDurationSec below); playback position isn't persisted anywhere, so
  // it starts at zero rather than implying progress.
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isTheatreMode, setIsTheatreMode] = useState(false);
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [activeChapterIndex, setActiveChapterIndex] = useState(1);
  const [videoQuality, setVideoQuality] = useState("1080p HD");
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  // Layout & Navigation States
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("overview"); // overview | ai-tutor | notes | qa | transcript | resources | reviews
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [curriculumSearch, setCurriculumSearch] = useState("");

  // AI Learning Coach States
  const [aiChatMessages, setAiChatMessages] = useState([
    {
      id: "msg-1",
      sender: "ai",
      text: `Hi ${session?.user?.user_metadata?.full_name?.split(" ")[0] || "there"}! I'm your AI Learning Assistant for this lesson. Ask me anything about the concepts covered, request a code explanation, or test your understanding!`
    }
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiThinking, setAiThinking] = useState(false);

  // This screen's own reads. The props it receives (`course`, `lessons`) are
  // already normalized by useLearnerData, and that mapper drops the columns
  // needed below - lessons.description/content and courses.instructor_id -
  // so each is fetched here from the real table rather than substituted with
  // a constant. Every one of these returns [] / null with no database.
  const courseId = course?.id || null;
  const userId = session?.user?.id || null;

  const lessonRowsQuery = useSupabaseQuery(
    async () => (courseId ? fetchLessonsForCourse(courseId) : []),
    [courseId]
  );
  const materialsQuery = useSupabaseQuery(
    async () => (courseId ? fetchCourseMaterials(courseId) : []),
    [courseId]
  );
  const instructorQuery = useSupabaseQuery(
    async () => (courseId ? fetchCourseInstructor(courseId) : null),
    [courseId]
  );
  const discussionQuery = useSupabaseQuery(async () => {
    if (!courseId) return [];
    const discussion = await fetchOrCreateCourseDiscussion(courseId);
    if (!discussion?.id) return [];
    return fetchCourseDiscussionMessages(discussion.id);
  }, [courseId]);

  // Q&A States
  const [postingQuestion, setPostingQuestion] = useState(false);
  const [qaThreads, setQaThreads] = useState(() => (DEMO_MODE ? DEMO_QA_THREADS : []));
  const [newQuestionTitle, setNewQuestionTitle] = useState("");
  const [newQuestionContent, setNewQuestionContent] = useState("");
  const [showQuestionComposer, setShowQuestionComposer] = useState(false);
  const [qaSearch, setQaSearch] = useState("");

  // Feedback Prompt
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackConfidence, setFeedbackConfidence] = useState(4);
  const [feedbackHelpful, setFeedbackHelpful] = useState(true);

  // Normalize current lesson. The placeholder curriculum below is a literal
  // fallback that used to hide an empty real result: a published course with
  // no `lessons` rows yet rendered six invented modules. With a database
  // connected the list stays empty and the curriculum drawer says so.
  const rawLessons = lessons && lessons.length > 0 ? lessons : (DEMO_MODE ? [
    { id: "l-1", title: "1. Foundations of Spatial Systems & Multi-Agent AI", duration: 18, module: "Module 1: Foundations" },
    { id: "l-2", title: "2. Structuring Design Tokens with Figma Variables", duration: 22, module: "Module 1: Foundations" },
    { id: "l-3", title: "3. Vector Databases & pgvector Index Architectures", duration: 26, module: "Module 2: Core Engineering" },
    { id: "l-4", title: "4. Building Autonomous Function Calling Agents", duration: 32, module: "Module 2: Core Engineering" },
    { id: "l-5", title: "5. Production Deployment, Caching & Performance Benchmark", duration: 24, module: "Module 3: Production & Scaling" },
    { id: "l-6", title: "6. Final Capstone Project & Portfolio Submission", duration: 40, module: "Module 4: Capstone" }
  ] : []);

  const currentLessonIndex = rawLessons.findIndex(l => l.id === lessonId);
  const lesson = rawLessons[currentLessonIndex >= 0 ? currentLessonIndex : 0] || rawLessons[0] || null;
  // Real runtime for THIS lesson (lessons.duration_minutes), replacing the
  // fixed 22:00 the scrub bar and time readout showed for every lesson.
  const totalDurationSec = (lesson?.duration || 0) * 60;
  const nextLesson = rawLessons[currentLessonIndex + 1];
  const prevLesson = currentLessonIndex > 0 ? rawLessons[currentLessonIndex - 1] : null;
  const isCompleted = lesson && completedLessonIds.has(`${course?.id}-${lesson.id}`);

  // The real `lessons` row behind the current lesson, for the two columns the
  // normalized prop drops: `description` (the overview paragraph, previously
  // one fixed masterclass blurb on every lesson in the catalog) and `content`
  // (the objectives list, previously four fixed bullet points). Each renders
  // only when the lesson actually has it - no placeholder copy.
  const lessonRow = (lessonRowsQuery.data || []).find((l) => l.id === lesson?.id) || null;
  const lessonDescription = lessonRow?.description || null;
  const lessonObjectives = (lessonRow?.content || "")
    .split(/\r?\n+/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);

  // Downloadable resources: real course_materials rows for this course.
  const liveResources = (materialsQuery.data || []).map((m) => ({
    id: m.id,
    title: m.title,
    type: m.material_type || "Material",
    size: null,
    icon: m.material_type === "link" ? ExternalLink : FileText,
    url: m.file_url || m.external_url || null,
  }));
  const lessonResources = liveOr(liveResources, DEMO_LESSON_RESOURCES);

  // Instructor: courses.instructor_id -> user_profiles (fetchCourseInstructor).
  // Every lesson used to be attributed to "Astrid Larsson"; when the course
  // has no instructor_id, or that profile is missing, the card renders
  // nothing instead of a name.
  const instructor = instructorQuery.data || null;

  // Format MM:SS helper
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Mark lesson complete handler
  async function handleMarkDone() {
    if (!session?.user?.id || !lesson) return;
    await markLessonComplete(session.user.id, lesson.id, course?.id);
    setCompletedLessonIds(prev => new Set([...prev, `${course?.id}-${lesson.id}`]));
    enrollmentsQuery?.refetch?.();
    lessonProgressQuery?.refetch?.();
    showToast?.("🎉 Lesson completed! +50 XP awarded");
    setShowFeedbackPrompt(true);
  }

  // Handle AI Tutor Query.
  //
  // This used to be a setTimeout that returned one of three hardcoded
  // paragraphs (about pgvector latency and token-bucket throttling) regardless
  // of the lesson, the course, or what was asked. It now goes through
  // askLessonTutor, which runs the real ai_conversations/ai_messages path via
  // the deployed ai-chat function and respects the organization's AI settings.
  async function handleSendAiMessage(customPrompt) {
    const query = customPrompt || aiInput.trim();
    if (!query || aiThinking) return;

    const userMsg = { id: `msg-${Date.now()}`, sender: "user", text: query };
    setAiChatMessages(prev => [...prev, userMsg]);
    if (!customPrompt) setAiInput("");
    setAiThinking(true);

    try {
      if (!askLessonTutor) {
        setAiChatMessages(prev => [...prev, {
          id: `msg-${Date.now() + 1}`, sender: "ai",
          text: "The AI tutor isn't available on this screen.",
        }]);
        return;
      }
      const result = await askLessonTutor({
        question: query,
        lessonTitle: lesson?.title,
        courseTitle: course?.title,
      });
      setAiChatMessages(prev => [...prev, {
        id: `msg-${Date.now() + 1}`,
        sender: "ai",
        text: result?.text || "No answer came back.",
        // Flagged so the UI can distinguish a real answer from an org-level
        // block or an instructor-will-reply message.
        notice: result?.blocked || result?.manual || result?.error || false,
      }]);
    } finally {
      setAiThinking(false);
    }
  }

  // Handle Q&A Upvote
  function handleToggleUpvote(threadId) {
    setQaThreads(prev => prev.map(t => {
      if (t.id === threadId) {
        return {
          ...t,
          upvoted: !t.upvoted,
          upvotes: t.upvoted ? t.upvotes - 1 : t.upvotes + 1
        };
      }
      return t;
    }));
  }

  // Real Q&A: flat `course_discussions` rows for this course. Author name and
  // avatar are the poster's real user_profiles row; upvotes/answers/video
  // timestamp are left null because the table has no such columns, and the
  // markup below hides those chips rather than inventing values for them.
  const realQaThreads = (discussionQuery.data || []).map((m) => ({
    id: m.id,
    author: m.user_profiles?.display_name || "Learner",
    role: m.sender_id === userId ? "You" : "Learner",
    avatarUrl: m.user_profiles?.avatar_url || null,
    time: m.created_at ? timeAgo(m.created_at) : "",
    timestamp: null,
    title: null,
    content: m.content,
    upvotes: null,
    upvoted: false,
    answers: [],
  }));
  const displayedQaThreads = liveOr(realQaThreads, qaThreads);

  // Handle New Q&A Question
  async function handlePostQuestion() {
    if (!newQuestionTitle.trim()) return;

    // With a database the question goes to the real course_discussions
    // table; the local-state branch below is the no-database walkthrough.
    if (!DEMO_MODE) {
      if (!userId || !courseId) { showToast?.("You need to be signed in to ask a question."); return; }
      setPostingQuestion(true);
      try {
        const body = [newQuestionTitle.trim(), newQuestionContent.trim()].filter(Boolean).join("\n\n");
        const discussion = await fetchOrCreateCourseDiscussion(courseId);
        await postCourseDiscussionMessage({ discussionId: discussion.id, senderId: userId, content: body });
        setNewQuestionTitle("");
        setNewQuestionContent("");
        setShowQuestionComposer(false);
        await discussionQuery.refetch?.();
        showToast?.("Question posted to the course discussion!");
      } catch (e) {
        showToast?.(e?.message || "Could not post your question.");
      } finally {
        setPostingQuestion(false);
      }
      return;
    }

    const newThread = {
      id: `qa-${Date.now()}`,
      author: session?.user?.user_metadata?.full_name || "Learner",
      role: "Learner",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
      time: "Just now",
      timestamp: formatTime(currentTimeSec),
      title: newQuestionTitle.trim(),
      content: newQuestionContent.trim() || newQuestionTitle.trim(),
      upvotes: 1,
      upvoted: true,
      answersCount: 0,
      answers: []
    };
    setQaThreads(prev => [newThread, ...prev]);
    setNewQuestionTitle("");
    setNewQuestionContent("");
    setShowQuestionComposer(false);
    showToast?.("Question posted to Q&A discussion!");
  }

  // Calculate course completion progress
  const completedCount = rawLessons.filter(l => completedLessonIds?.has(`${course?.id}-${l.id}`)).length;
  const courseProgressPercent = rawLessons.length > 0
    ? Math.round((completedCount / rawLessons.length) * 100)
    : 0;

  // Group lessons by module for Coursera/Udemy style curriculum drawer
  // `lessons` has no module/section column (only order_index), so real rows
  // group under one unlabelled heading rather than an invented
  // "Module 1: Foundations & Architecture". Only the demo lesson set carries
  // a `module` field.
  const groupedModules = rawLessons.reduce((acc, l) => {
    const mod = l.module || "";
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(l);
    return acc;
  }, {});

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%", maxWidth: 1400, margin: "0 auto", boxSizing: "border-box" }}>
      
      {/* =========================================================================
          TOP INDUSTRY-STANDARD COURSE HEADER / APP BAR
          ========================================================================= */}
      <div className="tai-card" style={{
        padding: "10px 14px", borderRadius: 16,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10, background: "var(--surface)", border: "1px solid var(--border)",
        width: "100%", boxSizing: "border-box"
      }}>
        <div className="tai-row tai-gap10" style={{ minWidth: 0, flex: 1, alignItems: "center" }}>
          <button
            className="tai-btn tai-btn-outline tai-btn-sm"
            onClick={back}
            style={{ borderRadius: 10, flexShrink: 0, padding: "6px 10px", fontSize: 12 }}
            title="Course Overview"
          >
            <ChevronLeft size={16} /> <span className="tai-header-full-text">Course Overview</span>
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            {/* Real courses.category / courses.title. The previous
                "Masterclass Track" / "AI Product Architecture Masterclass"
                fallbacks stood in for a course that failed to load. */}
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: ".04em" }}>
              {[course?.category, rawLessons.length > 0 ? `Lesson ${currentLessonIndex + 1} of ${rawLessons.length}` : null].filter(Boolean).join(" • ")}
            </div>
            <div style={{ fontWeight: 800, fontSize: "clamp(13px, 2.5vw, 15px)", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {course?.title || ""}
            </div>
          </div>
        </div>

        {/* Course Progress & Action Badges */}
        <div className="tai-row tai-gap10" style={{ alignItems: "center", flexShrink: 0 }}>
          <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9.5, color: "var(--text-3)", fontWeight: 700 }}>PROGRESS</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--primary)" }}>{courseProgressPercent}%</div>
            </div>
            <div style={{ width: 44, height: 6, background: "var(--surface-3)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${courseProgressPercent}%`, height: "100%", background: "var(--primary-gradient, linear-gradient(135deg, #4F46E5, #6366F1))", borderRadius: 99 }} />
            </div>
          </div>

          <button
            className="tai-iconbtn"
            style={{ borderRadius: 10, width: 34, height: 34 }}
            onClick={() => setSidebarOpen(v => !v)}
            title={sidebarOpen ? "Hide Course Curriculum" : "Show Course Curriculum"}
            aria-label="Toggle Curriculum"
          >
            {sidebarOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
        </div>
      </div>

      {/* =========================================================================
          MAIN CINEMA VIDEO & EXPANDABLE CURRICULUM LAYOUT
          ========================================================================= */}
      <div className={`tai-lesson-cinema-layout ${!sidebarOpen || isTheatreMode ? "tai-cinema-full" : ""}`}>
        
        {/* Left Column: Widescreen Video Player & Interactive Tabs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0, width: "100%", boxSizing: "border-box" }}>

          {/* Video Player Cinema Box */}
          <div className="tai-card" style={{
            padding: 0,
            overflow: "hidden",
            position: "relative",
            borderRadius: 20,
            background: "#080C16",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow: "0 20px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)",
            width: "100%",
            boxSizing: "border-box"
          }}>
            {/* Real 16:9 Cinema Aspect Ratio Viewport */}
            <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%", height: 0, background: "#000" }}>
              {/* Working Interactive Video Stream */}
              {(() => {
                const videoEmbedId = lesson?.youtubeVideoId || lesson?.video_url?.match(/(?:embed\/|v=|youtu\.be\/)([\w-]+)/)?.[1] || getYouTubeEmbedId(course?.id, lesson?.id);
                return (
                  <iframe
                    key={videoEmbedId}
                    title={lesson?.title || "Lesson Video"}
                    src={`https://www.youtube-nocookie.com/embed/${videoEmbedId}?autoplay=${isPlaying ? 1 : 0}&enablejsapi=1&rel=0&modestbranding=1`}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                );
              })()}

              {/* Speaker / Topic Ambient Badge Overlay */}
              <div style={{
                position: "absolute", top: 12, left: 12, zIndex: 10,
                display: "flex", alignItems: "center", gap: 6,
                background: "rgba(10, 14, 26, 0.75)", backdropFilter: "blur(8px)",
                padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)",
                maxWidth: "85%"
              }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 6px #10B981", flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lesson?.title}</span>
                <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.6)", flexShrink: 0 }}>• {videoQuality}</span>
              </div>
            </div>

            {/* Cinema Video Control Bar Overlay */}
            <div style={{
              background: "#0D1322",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              padding: "10px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              boxSizing: "border-box",
              width: "100%"
            }}>
              {/* Interactive Scrub Progress Bar */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: 5,
                  background: "rgba(255, 255, 255, 0.15)",
                  borderRadius: 99,
                  cursor: "pointer"
                }}
                onClick={(e) => {
                  if (!totalDurationSec) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickPercent = (e.clientX - rect.left) / rect.width;
                  setCurrentTimeSec(Math.round(clickPercent * totalDurationSec));
                }}
              >
                <div style={{
                  width: `${totalDurationSec > 0 ? Math.min(100, (currentTimeSec / totalDurationSec) * 100) : 0}%`,
                  height: "100%",
                  background: "var(--primary-gradient, linear-gradient(90deg, #4F46E5, #818CF8))",
                  borderRadius: 99,
                  position: "relative"
                }}>
                  <div style={{
                    position: "absolute", right: -4, top: -3.5,
                    width: 12, height: 12, borderRadius: "50%",
                    background: "#FFFFFF", boxShadow: "0 0 8px rgba(79, 70, 229, 0.8)"
                  }} />
                </div>
              </div>

              {/* Bottom Cinema Controls */}
              <div className="tai-row tai-between" style={{ alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div className="tai-row tai-gap6" style={{ alignItems: "center" }}>
                  <button
                    className="tai-iconbtn"
                    style={{ background: "var(--primary)", color: "#fff", border: "none", width: 34, height: 34, borderRadius: "50%" }}
                    onClick={() => setIsPlaying(v => !v)}
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} fill="#fff" style={{ marginLeft: 2 }} />}
                  </button>

                  <button
                    className="tai-iconbtn"
                    style={{ color: "rgba(255,255,255,0.8)", width: 30, height: 30, borderRadius: 8 }}
                    onClick={() => setCurrentTimeSec(Math.max(0, currentTimeSec - 10))}
                    title="Rewind 10s"
                  >
                    <RotateCcw size={14} />
                  </button>

                  <button
                    className="tai-iconbtn"
                    style={{ color: "rgba(255,255,255,0.8)", width: 30, height: 30, borderRadius: 8 }}
                    onClick={() => setCurrentTimeSec(Math.min(totalDurationSec, currentTimeSec + 10))}
                    title="Forward 10s"
                  >
                    <RotateCw size={14} />
                  </button>

                  <button
                    className="tai-iconbtn"
                    style={{ color: "rgba(255,255,255,0.8)", width: 30, height: 30, borderRadius: 8 }}
                    onClick={() => setIsMuted(v => !v)}
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <VolumeX size={15} color="#EF4444" /> : <Volume2 size={15} />}
                  </button>

                  {/* Runtime only shown when the lesson row actually records
                      a duration. */}
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#FFFFFF", fontVariantNumeric: "tabular-nums", marginLeft: 2 }}>
                    {formatTime(currentTimeSec)}
                    {totalDurationSec > 0 && <span style={{ color: "rgba(255,255,255,0.5)" }}> / {formatTime(totalDurationSec)}</span>}
                  </span>
                </div>

                {/* Right Video Controls */}
                <div className="tai-row tai-gap6" style={{ alignItems: "center" }}>
                  {/* Speed Selector */}
                  <div style={{ position: "relative" }}>
                    <button
                      className="tai-btn tai-btn-sm"
                      style={{
                        background: "rgba(255,255,255,0.08)", color: "#FFFFFF",
                        border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "3px 8px", fontSize: 11.5, fontWeight: 700
                      }}
                      onClick={() => setShowSpeedMenu(v => !v)}
                    >
                      {playbackSpeed}x
                    </button>
                    {showSpeedMenu && (
                      <div className="tai-card anim-slide-down" style={{
                        position: "absolute", bottom: 32, right: 0, width: 80, padding: 4, zIndex: 100,
                        background: "#1E293B", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10
                      }}>
                        {[0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((spd) => (
                          <div
                            key={spd}
                            style={{
                              padding: "5px 6px", borderRadius: 6, fontSize: 11.5, color: playbackSpeed === spd ? "#818CF8" : "#FFFFFF",
                              fontWeight: playbackSpeed === spd ? 800 : 500, cursor: "pointer", textAlign: "center"
                            }}
                            onClick={() => { setPlaybackSpeed(spd); setShowSpeedMenu(false); }}
                          >
                            {spd}x
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quality Selector */}
                  <button
                    className="tai-btn tai-btn-sm"
                    style={{
                      background: "rgba(255,255,255,0.08)", color: "#FFFFFF",
                      border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "3px 8px", fontSize: 11.5, fontWeight: 700
                    }}
                    onClick={() => setVideoQuality(v => v === "1080p HD" ? "720p" : "1080p HD")}
                  >
                    {videoQuality === "1080p HD" ? "1080p" : videoQuality}
                  </button>

                  {/* Theatre Mode Toggle */}
                  <button
                    className="tai-iconbtn"
                    style={{ color: "rgba(255,255,255,0.8)", width: 30, height: 30, borderRadius: 8 }}
                    onClick={() => setIsTheatreMode(v => !v)}
                    title={isTheatreMode ? "Exit Theatre Mode" : "Theatre Mode"}
                  >
                    <Maximize2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Lesson Controls Bar (Prev Lesson • Mark Complete • Next Lesson) */}
          <div className="tai-lesson-nav-container">
            <button
              className={`tai-btn ${isCompleted ? "tai-btn-outline" : "tai-btn-primary"} tai-lesson-nav-complete`}
              style={{
                padding: "11px 18px", borderRadius: 14, fontSize: 13.5, fontWeight: 800,
                boxShadow: isCompleted ? "none" : "0 4px 16px rgba(79, 70, 229, 0.3)"
              }}
              onClick={handleMarkDone}
            >
              <CheckCircle2 size={16} color={isCompleted ? "var(--success)" : "#FFFFFF"} />
              <span>{isCompleted ? "Completed • Tap to Review" : "✓ Mark Lesson as Complete (+50 XP)"}</span>
            </button>

            <div className="tai-lesson-nav-subrow">
              <button
                className="tai-btn tai-btn-outline"
                disabled={!prevLesson}
                onClick={() => prevLesson && push("lesson", { id: course?.id, lessonId: prevLesson.id })}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 12, opacity: prevLesson ? 1 : 0.4, fontSize: 12.5 }}
              >
                <ChevronLeft size={15} /> Prev Lesson
              </button>

              <button
                className="tai-btn tai-btn-outline"
                disabled={!nextLesson}
                onClick={() => nextLesson && push("lesson", { id: course?.id, lessonId: nextLesson.id })}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 12, opacity: nextLesson ? 1 : 0.4, fontSize: 12.5 }}
              >
                Next Lesson <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {/* Interactive Multi-Tab Workspace Tabs (Coursera / Udemy Standard) */}
          <div className="tai-scrollx tai-gap6" style={{
            borderBottom: "1.5px solid var(--border)",
            paddingBottom: 6,
            marginTop: 4,
            width: "100%",
            boxSizing: "border-box",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none"
          }}>
            {[
              { id: "overview", label: "Overview", icon: BookOpen },
              { id: "ai-tutor", label: "AI Tutor", icon: Bot, badge: "AI" },
              { id: "notes", label: `Notes (${lessonNotesQuery?.data?.length || 0})`, icon: FileText },
              // Both counts are real row counts now (course_discussions and
              // course_materials) rather than the length of a seed array.
              { id: "qa", label: `Q&A (${displayedQaThreads.length})`, icon: MessageSquare },
              // The transcript tab itself is demo-only - see DEFAULT_TRANSCRIPT.
              ...(DEMO_MODE ? [{ id: "transcript", label: "Transcript", icon: Terminal }] : []),
              { id: "resources", label: `Resources (${lessonResources.length})`, icon: Paperclip },
              { id: "reviews", label: "Feedback", icon: Star }
            ].map(tabItem => {
              const Icon = tabItem.icon;
              const isActive = activeTab === tabItem.id;
              return (
                <button
                  key={tabItem.id}
                  onClick={() => setActiveTab(tabItem.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "7px 13px",
                    borderRadius: 10,
                    border: "none",
                    background: isActive ? "var(--primary)" : "transparent",
                    color: isActive ? "#FFFFFF" : "var(--text-2)",
                    fontWeight: isActive ? 800 : 600,
                    fontSize: 12,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    transition: "all 0.15s ease",
                    boxShadow: isActive ? "0 3px 10px rgba(79, 70, 229, 0.25)" : "none"
                  }}
                >
                  <Icon size={14} />
                  <span>{tabItem.label}</span>
                  {tabItem.badge && (
                    <span style={{
                      fontSize: 9.5, fontWeight: 800, padding: "1px 5px", borderRadius: 4,
                      background: isActive ? "rgba(255,255,255,0.25)" : "var(--primary-tint)",
                      color: isActive ? "#FFFFFF" : "var(--primary)"
                    }}>
                      {tabItem.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* =========================================================================
              TAB CONTENT SECTIONS
              ========================================================================= */}

          {/* TAB 1: OVERVIEW & LEARNING OBJECTIVES */}
          {activeTab === "overview" && (
            <div className="tai-card anim-slide-down" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h2 style={{ fontSize: "clamp(16px, 2.5vw, 19px)", fontWeight: 900, color: "var(--text)", margin: "0 0 8px" }}>
                  {lesson?.title}
                </h2>
                {/* Real lessons.description for THIS lesson. */}
                {lessonRowsQuery.loading && !DEMO_MODE ? (
                  <p style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.55, margin: 0 }}>
                    Loading this lesson's overview…
                  </p>
                ) : (lessonDescription || DEMO_MODE) && (
                  <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.55, margin: 0 }}>
                    {lessonDescription || "In this comprehensive masterclass module, you will learn the foundational architecture for building resilient multi-agent AI systems, configuring design tokens with vector variables, and optimizing sub-second query performance in production environments."}
                  </p>
                )}
              </div>

              {/* Learning Objectives Checklist - the real lessons.content
                  column, one objective per line. Hidden entirely when the
                  lesson has no content rather than showing sample bullets. */}
              {(lessonObjectives.length > 0 || DEMO_MODE) && (
              <div className="tai-card" style={{ background: "var(--surface-3)", padding: 14, borderRadius: 14 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--primary)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 10 }}>
                  What You'll Master in this Lesson
                </div>
                <div className="tai-col tai-gap8">
                  {/* lessonObjectives comes from the real lessons.content column.
                      This used to fall through to four invented objectives (about
                      pgvector and retry hooks) for ANY lesson whose content was
                      empty, so a real lesson could present someone else's
                      curriculum as its own. The sample set is now demo-only, and
                      the whole card is hidden when there is nothing real to show
                      (see the guard on this block). */}
                  {(lessonObjectives.length > 0 ? lessonObjectives : DEMO_LESSON_OBJECTIVES).map((obj, idx) => (
                    <div key={idx} className="tai-row tai-gap8" style={{ alignItems: "flex-start", fontSize: 12.5, color: "var(--text)", fontWeight: 600 }}>
                      <CheckCircle2 size={15} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                      <span>{obj}</span>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* Instructor Bio Card - the course's real instructor. The
                  job-title second line has no column behind it (user_profiles
                  stores no headline), so it is demo-only, and the whole card
                  is skipped when the instructor can't be resolved. */}
              {(instructor || DEMO_MODE) && (
              <div className="tai-row tai-between" style={{ padding: "12px 14px", background: "var(--surface-2)", borderRadius: 14, flexWrap: "wrap", gap: 12 }}>
                <div className="tai-row tai-gap10" style={{ minWidth: 0, flex: "1 1 200px" }}>
                  <Avatar
                    src={instructor?.avatarUrl || null}
                    initials={initialsOf(instructor?.name || "Astrid Larsson")}
                    size={40}
                    style={{ borderRadius: "50%", flexShrink: 0 }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>{instructor?.name || "Astrid Larsson"}</div>
                    {DEMO_MODE && (
                      <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>Lead AI Systems Architect • Former Staff Designer</div>
                    )}
                  </div>
                </div>

                <button
                  className="tai-btn tai-btn-outline tai-btn-sm"
                  onClick={() => { setActiveTab("qa"); setShowQuestionComposer(true); }}
                  style={{ borderRadius: 10, padding: "7px 12px", fontSize: 12 }}
                >
                  <MessageSquare size={14} /> Ask {(instructor?.name || "Astrid Larsson").split(" ")[0]} a Question
                </button>
              </div>
              )}
            </div>
          )}

          {/* TAB 2: AI LEARNING TUTOR & PRACTICE */}
          {activeTab === "ai-tutor" && (
            <div className="tai-card anim-slide-down" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="tai-row tai-between" style={{ paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
                <div className="tai-row tai-gap8">
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Bot size={16} color="var(--primary)" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>AI Learning Coach</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>Grounded in timestamp ({formatTime(currentTimeSec)}) & syllabus</div>
                  </div>
                </div>

                <Tag tone="primary">AI TUTOR</Tag>
              </div>

              {/* Quick AI Prompt Pills */}
              <div className="tai-scrollx tai-gap6" style={{ paddingBottom: 2, width: "100%", boxSizing: "border-box" }}>
                {[
                  "💡 Summarize chapter",
                  "💻 Code example",
                  "❓ Quiz me",
                  "🔍 Vector trade-offs"
                ].map((prompt, idx) => (
                  <button
                    key={idx}
                    className="tai-btn tai-btn-outline tai-btn-sm"
                    style={{ fontSize: 11.5, borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0, padding: "5px 10px" }}
                    onClick={() => handleSendAiMessage(prompt.replace(/^[^\w\s]+\s*/, ""))}
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* AI Chat Conversation Thread */}
              <div style={{
                maxHeight: 340, overflowY: "auto", display: "flex", flexDirection: "column",
                gap: 10, padding: "6px 0", boxSizing: "border-box"
              }}>
                {aiChatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      justifyContent: msg.sender === "user" ? "flex-end" : "flex-start",
                      width: "100%"
                    }}
                  >
                    <div style={{
                      maxWidth: "88%",
                      padding: "10px 14px",
                      borderRadius: 14,
                      background: msg.sender === "user" ? "var(--primary)" : "var(--surface-3)",
                      color: msg.sender === "user" ? "#FFFFFF" : "var(--text)",
                      fontSize: 12.5,
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap"
                    }}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {aiThinking && (
                  <div className="tai-row tai-gap8" style={{ fontSize: 12, color: "var(--text-3)", padding: "6px 0" }}>
                    <RefreshCw size={13} className="anim-spin" /> AI Tutor is synthesizing an explanation...
                  </div>
                )}
              </div>

              {/* An org can switch the AI assistant off, or put it in manual
                  mode where an instructor answers instead. Both are real
                  settings (fetchOrgAISettings), so the tab says so rather than
                  offering an input that cannot produce an answer. */}
              {orgAISettings && !orgAISettings.enabled && (
                <div style={{ fontSize: 12, color: "var(--text-3)", padding: "10px 12px", background: "var(--surface-3)", borderRadius: 10, marginBottom: 8 }}>
                  Your organization has turned the AI assistant off.
                </div>
              )}
              {orgAISettings?.enabled && orgAISettings?.manual_mode && (
                <div style={{ fontSize: 12, color: "var(--text-2)", padding: "10px 12px", background: "var(--surface-3)", borderRadius: 10, marginBottom: 8 }}>
                  {orgAISettings.manual_message || "An instructor reviews these questions and will reply."}
                </div>
              )}

              {/* AI Chat Input Form */}
              <div className="tai-row tai-gap8">
                <input
                  className="tai-input"
                  disabled={orgAISettings ? !orgAISettings.enabled : false}
                  placeholder={orgAISettings && !orgAISettings.enabled ? "AI assistant is off" : "Ask a question about this lesson..."}
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSendAiMessage(); }}
                  style={{ flex: 1, padding: "9px 12px", fontSize: 12.5 }}
                />
                <button
                  className="tai-btn tai-btn-primary"
                  disabled={!aiInput.trim() || aiThinking || (orgAISettings ? !orgAISettings.enabled : false)}
                  onClick={() => handleSendAiMessage()}
                  style={{ padding: "9px 14px", fontSize: 12.5 }}
                >
                  <Send size={14} /> Ask
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: LESSON NOTES & TIMESTAMPS */}
          {activeTab === "notes" && (
            <div className="tai-card anim-slide-down" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="tai-row tai-between" style={{ paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)" }}>Personal Study Notes</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 1 }}>Notes are anchored to video timestamps</div>
                </div>

                <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--primary)", background: "var(--primary-tint)", padding: "3px 8px", borderRadius: 6 }}>
                  {lessonNotesQuery?.data?.length || 0} Saved
                </span>
              </div>

              {/* Add Note Input Bar */}
              <div className="tai-row tai-gap8" style={{ flexWrap: "wrap" }}>
                <div style={{
                  padding: "0 10px", height: 38, borderRadius: 10, background: "var(--surface-3)",
                  display: "flex", alignItems: "center", fontSize: 12, fontWeight: 800, color: "var(--primary)", flexShrink: 0
                }}>
                  {formatTime(currentTimeSec)}
                </div>
                <input
                  className="tai-input"
                  placeholder={`Add a note at ${formatTime(currentTimeSec)}...`}
                  value={noteInputText}
                  onChange={e => setNoteInputText(e.target.value)}
                  style={{ flex: "1 1 180px", padding: "8px 12px", fontSize: 12.5 }}
                />
                <button
                  className="tai-btn tai-btn-primary"
                  disabled={!noteInputText.trim()}
                  onClick={async () => {
                    if (!noteInputText.trim() || !session?.user?.id || !lesson) return;
                    await addLessonNote({ userId: session.user.id, lessonId: lesson.id, timestampSeconds: currentTimeSec, content: noteInputText.trim() });
                    setNoteInputText("");
                    lessonNotesQuery.refetch();
                    showToast?.("Note saved with timestamp!");
                  }}
                  style={{ padding: "8px 14px", fontSize: 12.5, flexShrink: 0 }}
                >
                  <PlusCircle size={14} /> Save
                </button>
              </div>

              {/* Render Notes List */}
              {lessonNotesQuery?.loading && <div className="tai-empty" style={{ padding: "20px 0" }}>Loading your notes...</div>}
              {(!lessonNotesQuery?.data || lessonNotesQuery.data.length === 0) && !lessonNotesQuery?.loading && (
                <div className="tai-card" style={{ background: "var(--surface-2)", padding: "24px 16px", textAlign: "center" }}>
                  <FileText size={24} color="var(--text-3)" style={{ margin: "0 auto 8px" }} />
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)" }}>No notes for this lesson yet</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Type a note above to bookmark important moments.</div>
                </div>
              )}

              {(lessonNotesQuery?.data || []).map(n => (
                <div key={n.id} className="tai-card tai-card-hover" style={{ background: "var(--surface-3)", padding: 12, borderRadius: 12 }}>
                  <div className="tai-row tai-between" style={{ marginBottom: 4 }}>
                    <span
                      onClick={() => setCurrentTimeSec(n.timestamp_seconds)}
                      style={{ fontSize: 11.5, fontWeight: 800, color: "var(--primary)", cursor: "pointer", background: "var(--primary-tint)", padding: "2px 6px", borderRadius: 6 }}
                      title="Jump video to this timestamp"
                    >
                      ▶ {Math.floor(n.timestamp_seconds / 60)}:{(n.timestamp_seconds % 60).toString().padStart(2, "0")}
                    </span>
                    <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>Lesson {currentLessonIndex + 1}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.45 }}>
                    {n.content}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: Q&A DISCUSSION & COMMUNITY */}
          {activeTab === "qa" && (
            <div className="tai-card anim-slide-down" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)" }}>Lesson Q&A Discussion</div>
                  {/* course_discussions is course-scoped, so say so rather
                      than implying a per-lesson thread. */}
                  <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 1 }}>
                    {DEMO_MODE ? "Ask questions and learn from instructors and peers" : "Course discussion - questions here are visible to everyone on this course"}
                  </div>
                </div>

                <button
                  className="tai-btn tai-btn-primary tai-btn-sm"
                  onClick={() => setShowQuestionComposer(v => !v)}
                  style={{ padding: "6px 12px", fontSize: 12 }}
                >
                  <PlusCircle size={14} /> Ask Question
                </button>
              </div>

              {/* Question Composer */}
              {showQuestionComposer && (
                <div className="tai-card" style={{ background: "var(--surface-3)", padding: 14, borderRadius: 14 }}>
                  {/* course_discussions has no timestamp column, so a real
                      question is not anchored to the video position. */}
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)", marginBottom: 8 }}>
                    {DEMO_MODE ? `Ask a Question linked to ${formatTime(currentTimeSec)}` : "Ask a Question"}
                  </div>
                  <input
                    className="tai-input"
                    placeholder="Question title (e.g. How does vector similarity work?)"
                    value={newQuestionTitle}
                    onChange={(e) => setNewQuestionTitle(e.target.value)}
                    style={{ marginBottom: 8, padding: "8px 12px", fontSize: 12.5 }}
                  />
                  <textarea
                    className="tai-input"
                    placeholder="Provide more context or paste code..."
                    rows={3}
                    value={newQuestionContent}
                    onChange={(e) => setNewQuestionContent(e.target.value)}
                    style={{ marginBottom: 10, padding: "8px 12px", fontSize: 12.5 }}
                  />
                  <div className="tai-row tai-gap8" style={{ justifyContent: "flex-end" }}>
                    <button className="tai-btn tai-btn-outline tai-btn-sm" onClick={() => setShowQuestionComposer(false)}>Cancel</button>
                    <button className="tai-btn tai-btn-primary tai-btn-sm" disabled={!newQuestionTitle.trim() || postingQuestion} onClick={handlePostQuestion}>{postingQuestion ? "Posting…" : "Post Question"}</button>
                  </div>
                </div>
              )}

              {/* Q&A List */}
              <div className="tai-col tai-gap10">
                {discussionQuery.loading && displayedQaThreads.length === 0 && (
                  <div className="tai-empty" style={{ padding: "20px 0" }}>Loading the discussion…</div>
                )}
                {!discussionQuery.loading && displayedQaThreads.length === 0 && (
                  <div className="tai-card" style={{ background: "var(--surface-2)", padding: "24px 16px", textAlign: "center" }}>
                    <MessageSquare size={24} color="var(--text-3)" style={{ margin: "0 auto 8px" }} />
                    <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)" }}>No questions on this course yet</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Be the first to ask one.</div>
                  </div>
                )}
                {displayedQaThreads.map((thread) => (
                  <div key={thread.id} className="tai-card tai-card-hover" style={{ background: "var(--surface-2)", padding: 14, borderRadius: 14 }}>
                    <div className="tai-row tai-between" style={{ alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                      <div className="tai-row tai-gap8" style={{ minWidth: 0, flex: 1 }}>
                        {/* Real avatar_url when the poster has one, their
                            initials otherwise. */}
                        <Avatar
                          src={thread.avatarUrl || thread.avatar || null}
                          initials={initialsOf(thread.author)}
                          size={30}
                          style={{ borderRadius: "50%", flexShrink: 0 }}
                        />
                        <div style={{ minWidth: 0 }}>
                          {thread.title && (
                            <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)", wordBreak: "break-word" }}>{thread.title}</div>
                          )}
                          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>
                            {[thread.author, thread.time, thread.timestamp ? `at ${thread.timestamp}` : null].filter(Boolean).join(" • ")}
                          </div>
                        </div>
                      </div>

                      {/* No vote column on course_discussions - the upvote
                          control is demo-only rather than a counter that
                          resets on every reload. */}
                      {thread.upvotes != null && (
                        <button
                          className="tai-btn tai-btn-sm"
                          style={{
                            background: thread.upvoted ? "var(--primary)" : "var(--surface)",
                            color: thread.upvoted ? "#FFFFFF" : "var(--text)",
                            border: "1px solid var(--border)", borderRadius: 8, padding: "3px 8px", flexShrink: 0, fontSize: 11.5
                          }}
                          onClick={() => handleToggleUpvote(thread.id)}
                        >
                          <ThumbsUp size={12} /> {thread.upvotes}
                        </button>
                      )}
                    </div>

                    <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.45, margin: "0 0 8px" }}>
                      {thread.content}
                    </p>

                    {/* Instructor Verified Answer Box */}
                    {thread.answers.map(ans => (
                      <div key={ans.id} style={{ background: "var(--surface)", borderLeft: "3px solid var(--primary)", padding: "10px 12px", borderRadius: "0 10px 10px 0", marginTop: 6 }}>
                        <div className="tai-row tai-gap6" style={{ marginBottom: 3 }}>
                          <span style={{ fontSize: 9.5, fontWeight: 800, background: "var(--primary-tint)", color: "var(--primary)", padding: "1px 5px", borderRadius: 4 }}>
                            INSTRUCTOR
                          </span>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text)" }}>{ans.author}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.45 }}>
                          {ans.text}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: SYNCHRONIZED TRANSCRIPT - Case C, demo-only. Nothing in
              the schema stores lesson transcripts, so with a database
              connected both this panel and its tab are gone rather than
              presenting one invented transcript for every lesson. */}
          {DEMO_MODE && activeTab === "transcript" && (
            <div className="tai-card anim-slide-down" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)" }}>Interactive Transcript</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 1 }}>Tap any line to jump video directly to that timestamp</div>
                </div>

                <div className="tai-row tai-gap6" style={{ position: "relative", minWidth: 160, flex: "1 1 180px" }}>
                  <Search size={13} color="var(--text-3)" style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    type="text"
                    placeholder="Search transcript..."
                    value={transcriptSearch}
                    onChange={(e) => setTranscriptSearch(e.target.value)}
                    style={{ width: "100%", height: 34, paddingLeft: 28, paddingRight: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-3)", fontSize: 11.5, color: "var(--text)", outline: "none" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 380, overflowY: "auto" }}>
                {DEFAULT_TRANSCRIPT
                  .filter(line => !transcriptSearch || line.text.toLowerCase().includes(transcriptSearch.toLowerCase()))
                  .map((line, idx) => {
                    const isCurrent = currentTimeSec >= line.seconds && (idx === DEFAULT_TRANSCRIPT.length - 1 || currentTimeSec < DEFAULT_TRANSCRIPT[idx + 1].seconds);
                    return (
                      <div
                        key={line.time}
                        onClick={() => setCurrentTimeSec(line.seconds)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          background: isCurrent ? "var(--primary-tint)" : "var(--surface-2)",
                          border: isCurrent ? "1px solid var(--primary-light)" : "1px solid transparent",
                          cursor: "pointer",
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-start",
                          transition: "all 0.15s ease"
                        }}
                      >
                        <span style={{ fontSize: 11.5, fontWeight: 800, color: isCurrent ? "var(--primary)" : "var(--text-3)", fontVariantNumeric: "tabular-nums", flexShrink: 0, marginTop: 1 }}>
                          {line.time}
                        </span>
                        <div style={{ fontSize: 12.5, color: isCurrent ? "var(--text)" : "var(--text-2)", lineHeight: 1.45, fontWeight: isCurrent ? 700 : 400 }}>
                          {line.text}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* TAB 6: DOWNLOADABLE LESSON RESOURCES */}
          {activeTab === "resources" && (
            <div className="tai-card anim-slide-down" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)" }}>Lesson Resources &amp; Starter Kits</div>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 1 }}>Download files, template repos, and cheatsheets</div>
              </div>

              {/* Real course_materials rows for this course. */}
              {materialsQuery.loading && lessonResources.length === 0 && (
                <div className="tai-empty" style={{ padding: "20px 0" }}>Loading course resources…</div>
              )}
              {!materialsQuery.loading && lessonResources.length === 0 && (
                <div className="tai-card" style={{ background: "var(--surface-2)", padding: "24px 16px", textAlign: "center" }}>
                  <Paperclip size={24} color="var(--text-3)" style={{ margin: "0 auto 8px" }} />
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)" }}>No resources attached to this course yet</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Materials your instructor uploads will appear here.</div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                {lessonResources.map((res) => {
                  const Icon = res.icon;
                  return (
                    <div key={res.id} className="tai-card tai-card-hover" style={{ background: "var(--surface-2)", padding: 14, borderRadius: 12, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <div className="tai-row tai-gap8" style={{ marginBottom: 6 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Icon size={16} color="var(--primary)" />
                          </div>
                          <div>
                            <span style={{ fontSize: 9.5, fontWeight: 800, color: "var(--primary)", textTransform: "uppercase" }}>{res.type}</span>
                            {/* course_materials stores no file size, so this
                                line is demo-only rather than an estimate. */}
                            {res.size && <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>{res.size}</div>}
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 12.5, color: "var(--text)", lineHeight: 1.35 }}>
                          {res.title}
                        </div>
                      </div>

                      {/* Opens the material's real file_url/external_url
                          instead of firing a fake "Downloading…" toast. */}
                      <button
                        className="tai-btn tai-btn-outline tai-btn-sm"
                        style={{ marginTop: 10, width: "100%", borderRadius: 8, padding: "6px 10px", fontSize: 11.5 }}
                        disabled={!res.url}
                        onClick={() => {
                          if (res.url) window.open(res.url, "_blank", "noopener");
                          else showToast?.("This material has no file or link attached.");
                        }}
                      >
                        <Download size={13} /> {res.url ? "Open Asset" : "No file attached"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 7: FEEDBACK & REVIEWS */}
          {activeTab === "reviews" && (
            <div className="tai-card anim-slide-down" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)" }}>Lesson Feedback &amp; Rating</div>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 1 }}>Help instructors improve learning outcomes and clarity</div>
              </div>

              <div className="tai-card" style={{ background: "var(--surface-3)", padding: 16, borderRadius: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text)", marginBottom: 6 }}>Rate this lesson</div>
                <div className="tai-row tai-gap6" style={{ marginBottom: 12 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2 }}
                      onClick={() => setFeedbackRating(star)}
                    >
                      <Star size={20} fill={feedbackRating >= star ? "#F59E0B" : "none"} color="#F59E0B" />
                    </button>
                  ))}
                </div>

                <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text)", marginBottom: 6 }}>How confident are you with this lesson's concepts?</div>
                <div className="tai-row tai-gap6" style={{ flexWrap: "wrap", marginBottom: 14 }}>
                  {[
                    { val: 1, label: "1 (Struggling)" },
                    { val: 2, label: "2 (Review)" },
                    { val: 3, label: "3 (Good)" },
                    { val: 4, label: "4 (Confident)" },
                    { val: 5, label: "5 (Mastered)" }
                  ].map(item => (
                    <button
                      key={item.val}
                      className={`tai-btn tai-btn-sm ${feedbackConfidence === item.val ? "tai-btn-primary" : "tai-btn-outline"}`}
                      style={{ borderRadius: 8, padding: "5px 10px", fontSize: 11.5 }}
                      onClick={() => setFeedbackConfidence(item.val)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <button
                  className="tai-btn tai-btn-primary"
                  onClick={async () => {
                    if (session?.user?.id && lesson) {
                      await submitLessonFeedback(session.user.id, lesson.id, course?.id, { rating: feedbackRating, confidence: feedbackConfidence, helpful: feedbackHelpful });
                    }
                    showToast?.("Thank you! Your feedback has been submitted.");
                  }}
                  style={{ padding: "9px 16px", fontSize: 13 }}
                >
                  Submit Lesson Review
                </button>
              </div>
            </div>
          )}

        </div>

        {/* =========================================================================
            RIGHT COLUMN: INDUSTRY-STANDARD CURRICULUM DRAWER (Udemy / Coursera)
            ========================================================================= */}
        {sidebarOpen && (
          <div className="tai-card anim-slide-down" style={{
            padding: "16px 14px",
            borderRadius: 18,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            position: "sticky",
            top: 20,
            maxHeight: "calc(100vh - 40px)",
            overflowY: "auto",
            width: "100%",
            boxSizing: "border-box"
          }}>
            <div className="tai-row tai-between" style={{ paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text)" }}>Course Content</div>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 1 }}>{completedCount} of {rawLessons.length} completed</div>
              </div>

              <button
                className="tai-iconbtn"
                style={{ width: 28, height: 28 }}
                onClick={() => setSidebarOpen(false)}
                title="Collapse sidebar"
                aria-label="Close Curriculum"
              >
                <X size={14} />
              </button>
            </div>

            {/* Curriculum Search Filter */}
            <div style={{ position: "relative", width: "100%" }}>
              <Search size={13} color="var(--text-3)" style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Search lessons..."
                value={curriculumSearch}
                onChange={(e) => setCurriculumSearch(e.target.value)}
                style={{
                  width: "100%", height: 36, paddingLeft: 30, paddingRight: 10,
                  borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-3)",
                  fontSize: 12, color: "var(--text)", outline: "none"
                }}
              />
            </div>

            {/* Modules and Lesson Items */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {rawLessons.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                  This course has no published lessons yet.
                </div>
              )}
              {Object.entries(groupedModules).map(([moduleName, moduleLessons], modIdx) => (
                <div key={moduleName} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {/* Module Section Header */}
                  {moduleName && (
                    <div style={{
                      fontSize: 11.5, fontWeight: 800, color: "var(--primary)",
                      textTransform: "uppercase", letterSpacing: ".04em", padding: "4px 2px"
                    }}>
                      {moduleName}
                    </div>
                  )}

                  {/* Lessons List in Module */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {moduleLessons
                      .filter(l => !curriculumSearch || l.title.toLowerCase().includes(curriculumSearch.toLowerCase()))
                      .map((les) => {
                        const isCurrent = les.id === lesson?.id;
                        const isDone = completedLessonIds?.has(`${course?.id}-${les.id}`);
                        return (
                          <div
                            key={les.id}
                            onClick={() => push("lesson", { id: course?.id, lessonId: les.id })}
                            style={{
                              padding: "10px 12px",
                              borderRadius: 12,
                              background: isCurrent ? "var(--primary-tint)" : "var(--surface-2)",
                              border: `1.5px solid ${isCurrent ? "var(--primary-light, #818CF8)" : "transparent"}`,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 10,
                              transition: "all 0.15s ease",
                              boxShadow: isCurrent ? "0 2px 8px rgba(79, 70, 229, 0.15)" : "none"
                            }}
                          >
                            <div style={{ marginTop: 2, flexShrink: 0 }}>
                              {isDone ? (
                                <CheckCircle2 size={16} color="var(--success, #10B981)" />
                              ) : (
                                <div style={{
                                  width: 16, height: 16, borderRadius: "50%",
                                  border: `1.5px solid ${isCurrent ? "var(--primary)" : "var(--text-3)"}`,
                                  background: isCurrent ? "var(--primary)" : "transparent"
                                }} />
                              )}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize: 13,
                                fontWeight: isCurrent ? 800 : 600,
                                color: isCurrent ? "var(--primary)" : "var(--text)",
                                lineHeight: 1.35,
                                wordBreak: "break-word"
                              }}>
                                {les.title}
                              </div>
                              {/* Real duration_minutes only - "20m" was a
                                  default standing in for lessons that record
                                  no duration. */}
                              {les.duration ? (
                                <div className="tai-row tai-gap8" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                                  <span className="tai-row tai-gap4"><Clock size={11} /> {les.duration}m</span>
                                </div>
                              ) : null}
                            </div>

                            {isCurrent && (
                              <Play size={13} color="var(--primary)" fill="var(--primary)" style={{ flexShrink: 0, marginTop: 4 }} />
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Capstone Project Certificate Unlock Card */}
            <div className="tai-card" style={{
              background: "linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%)",
              border: "1px solid rgba(99, 102, 241, 0.3)", padding: 14, borderRadius: 14
            }}>
              <div className="tai-row tai-gap8" style={{ marginBottom: 4 }}>
                <Award size={16} color="var(--primary)" />
                <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text)" }}>Official Credential</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.4 }}>
                Complete all lessons and capstone assessment to earn your verified industry certificate.
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default LessonScreen;
