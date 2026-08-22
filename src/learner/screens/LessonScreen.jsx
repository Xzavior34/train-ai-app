import React, { useState, useEffect, useRef } from "react";
import { TopBar, ProgressBar, Tag, Avatar } from "../components/LearnerUI.jsx";
import {
  Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize2, Minimize2,
  CheckCircle2, ChevronRight, ChevronLeft, PlusCircle, ThumbsUp, ThumbsDown,
  Clock, Video, BookOpen, Sparkles, Download, Share2, HelpCircle, FileText,
  Code2, Award, Star, MessageSquare, Send, Search, Check, X, ShieldCheck,
  Bookmark, Heart, Layers, RefreshCw, PanelRightClose, PanelRightOpen,
  Sliders, ExternalLink, Bot, Terminal, Copy, Paperclip
} from "lucide-react";
import { submitLessonFeedback } from "../../lib/api/learner.js";
import { getYouTubeEmbedId, isMockDataEnabled } from "../../lib/mockDataManager.js";

// Industry-Standard Interactive Chapters
const DEFAULT_CHAPTERS = [
  { time: "00:00", seconds: 0, title: "Introduction & Architecture Overview" },
  { time: "03:45", seconds: 225, title: "Design Tokens & Variable Configuration" },
  { time: "08:15", seconds: 495, title: "Building Production Multi-Agent Workflows" },
  { time: "13:30", seconds: 810, title: "Vector Embeddings & RAG Optimization" },
  { time: "17:20", seconds: 1040, title: "Edge Deployment & Performance Benchmark" },
  { time: "21:05", seconds: 1265, title: "Summary, Capstone & Next Action Items" }
];

// Interactive Synchronized Video Transcript Lines
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

// Downloadable Lesson Assets & Resources
const LESSON_RESOURCES = [
  { id: "res-1", title: "Starter Code Repository (GitHub)", type: "GitHub Repo", size: "ZIP • 4.2 MB", icon: Code2, url: "https://github.com" },
  { id: "res-2", title: "Complete Figma Design Tokens & Variables Kit", type: "Figma File", size: "FIG • 18.5 MB", icon: Layers, url: "https://figma.com" },
  { id: "res-3", title: "Masterclass Slide Deck & Architecture Diagrams", type: "PDF Document", size: "PDF • 8.1 MB", icon: FileText, url: "#" },
  { id: "res-4", title: "AI Prompt Engineering & Function Schemas Cheat Sheet", type: "Quick Reference", size: "PDF • 2.4 MB", icon: Sparkles, url: "#" }
];

// Lesson Q&A Discussions
const INITIAL_QA_THREADS = [
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
  completedLessonIds, setCompletedLessonIds, addLessonNote
}) {
  // Video Player States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(145);
  const [totalDurationSec] = useState(1320); // 22:00 mins
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

  // Q&A States
  const [qaThreads, setQaThreads] = useState(INITIAL_QA_THREADS);
  const [newQuestionTitle, setNewQuestionTitle] = useState("");
  const [newQuestionContent, setNewQuestionContent] = useState("");
  const [showQuestionComposer, setShowQuestionComposer] = useState(false);
  const [qaSearch, setQaSearch] = useState("");

  // Feedback Prompt
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackConfidence, setFeedbackConfidence] = useState(4);
  const [feedbackHelpful, setFeedbackHelpful] = useState(true);

  // Normalize current lesson
  const rawLessons = lessons && lessons.length > 0 ? lessons : [
    { id: "l-1", title: "1. Foundations of Spatial Systems & Multi-Agent AI", duration: 18, module: "Module 1: Foundations" },
    { id: "l-2", title: "2. Structuring Design Tokens with Figma Variables", duration: 22, module: "Module 1: Foundations" },
    { id: "l-3", title: "3. Vector Databases & pgvector Index Architectures", duration: 26, module: "Module 2: Core Engineering" },
    { id: "l-4", title: "4. Building Autonomous Function Calling Agents", duration: 32, module: "Module 2: Core Engineering" },
    { id: "l-5", title: "5. Production Deployment, Caching & Performance Benchmark", duration: 24, module: "Module 3: Production & Scaling" },
    { id: "l-6", title: "6. Final Capstone Project & Portfolio Submission", duration: 40, module: "Module 4: Capstone" }
  ];

  const currentLessonIndex = rawLessons.findIndex(l => l.id === lessonId);
  const lesson = rawLessons[currentLessonIndex >= 0 ? currentLessonIndex : 0] || rawLessons[0];
  const nextLesson = rawLessons[currentLessonIndex + 1];
  const prevLesson = currentLessonIndex > 0 ? rawLessons[currentLessonIndex - 1] : null;
  const isCompleted = lesson && completedLessonIds.has(`${course?.id}-${lesson.id}`);

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

  // Handle AI Tutor Query
  function handleSendAiMessage(customPrompt) {
    const query = customPrompt || aiInput.trim();
    if (!query) return;

    const userMsg = { id: `msg-${Date.now()}`, sender: "user", text: query };
    setAiChatMessages(prev => [...prev, userMsg]);
    if (!customPrompt) setAiInput("");
    setAiThinking(true);

    setTimeout(() => {
      let replyText = `Great question! In this section of the lesson (${formatTime(currentTimeSec)}), the key takeaway is ensuring your state variables are fully decoupled from asynchronous render loops. This prevents race conditions when multiple agent functions resolve out-of-order.`;
      if (query.toLowerCase().includes("summar")) {
        replyText = `**Key Takeaways for this Lesson:**\n\n1. **Decoupled Architecture**: Separate prompt reasoning from execution engines.\n2. **Vector Indexing**: Use HNSW with Supabase pgvector for sub-200ms semantic lookups.\n3. **Resilience**: Implement token-bucket throttling and exponential backoff retry hooks.`;
      } else if (query.toLowerCase().includes("code") || query.toLowerCase().includes("example")) {
        replyText = `Here is the production implementation pattern demonstrated in Chapter ${activeChapterIndex + 1}:\n\n\`\`\`javascript\nconst agentResponse = await executeAutonomousWorkflow({\n  model: "gemini-1.5-pro",\n  tools: [vectorSearchTool, databaseTool],\n  maxSteps: 5,\n  timeoutMs: 8000\n});\n\`\`\``;
      }
      setAiChatMessages(prev => [...prev, { id: `msg-${Date.now() + 1}`, sender: "ai", text: replyText }]);
      setAiThinking(false);
    }, 900);
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

  // Handle New Q&A Question
  function handlePostQuestion() {
    if (!newQuestionTitle.trim()) return;
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
  const courseProgressPercent = Math.round((completedCount / rawLessons.length) * 100);

  // Group lessons by module for Coursera/Udemy style curriculum drawer
  const groupedModules = rawLessons.reduce((acc, l) => {
    const mod = l.module || "Module 1: Foundations & Architecture";
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(l);
    return acc;
  }, {});

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: 1400, margin: "0 auto", boxSizing: "border-box" }}>
      
      {/* =========================================================================
          TOP INDUSTRY-STANDARD COURSE HEADER / APP BAR
          ========================================================================= */}
      <div className="tai-card" style={{
        padding: "12px 18px", borderRadius: 16,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12, background: "var(--surface)", border: "1px solid var(--border)"
      }}>
        <div className="tai-row tai-gap12" style={{ minWidth: 0, flex: "1 1 300px" }}>
          <button
            className="tai-btn tai-btn-outline tai-btn-sm"
            onClick={back}
            style={{ borderRadius: 10, flexShrink: 0 }}
          >
            <ChevronLeft size={16} /> Course Overview
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: ".04em" }}>
              {course?.category || "Masterclass Track"} • Lesson {currentLessonIndex + 1} of {rawLessons.length}
            </div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {course?.title || "AI Product Architecture Masterclass"}
            </div>
          </div>
        </div>

        {/* Course Progress & Action Badges */}
        <div className="tai-row tai-gap14" style={{ alignItems: "center", flexShrink: 0 }}>
          <div className="tai-row tai-gap10" style={{ alignItems: "center" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>COURSE PROGRESS</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--primary)" }}>{courseProgressPercent}% Completed</div>
            </div>
            <div style={{ width: 64, height: 6, background: "var(--surface-3)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${courseProgressPercent}%`, height: "100%", background: "var(--primary-gradient, linear-gradient(135deg, #4F46E5, #6366F1))", borderRadius: 99 }} />
            </div>
          </div>

          <button
            className="tai-iconbtn"
            style={{ borderRadius: 10, width: 36, height: 36 }}
            onClick={() => setSidebarOpen(v => !v)}
            title={sidebarOpen ? "Hide Course Curriculum" : "Show Course Curriculum"}
          >
            {sidebarOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          </button>
        </div>
      </div>

      {/* =========================================================================
          MAIN CINEMA VIDEO & EXPANDABLE CURRICULUM LAYOUT
          ========================================================================= */}
      <div style={{
        display: "grid",
        gridTemplateColumns: sidebarOpen && !isTheatreMode ? "minmax(0, 1fr) 360px" : "1fr",
        gap: 20,
        alignItems: "start",
        transition: "all 0.3s ease"
      }}>
        
        {/* Left Column: Widescreen Video Player & Interactive Tabs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>

          {/* Video Player Cinema Box */}
          <div className="tai-card" style={{
            padding: 0,
            overflow: "hidden",
            position: "relative",
            borderRadius: 22,
            background: "#080C16",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow: "0 24px 60px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)"
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
                position: "absolute", top: 16, left: 16, zIndex: 10,
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(10, 14, 26, 0.75)", backdropFilter: "blur(8px)",
                padding: "6px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)"
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 8px #10B981" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF" }}>{lesson?.title}</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>• {videoQuality}</span>
              </div>
            </div>

            {/* Cinema Video Control Bar Overlay */}
            <div style={{
              background: "#0D1322",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              padding: "12px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 10
            }}>
              {/* Interactive Scrub Progress Bar */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: 6,
                  background: "rgba(255, 255, 255, 0.15)",
                  borderRadius: 99,
                  cursor: "pointer"
                }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickPercent = (e.clientX - rect.left) / rect.width;
                  setCurrentTimeSec(Math.round(clickPercent * totalDurationSec));
                }}
              >
                <div style={{
                  width: `${(currentTimeSec / totalDurationSec) * 100}%`,
                  height: "100%",
                  background: "var(--primary-gradient, linear-gradient(90deg, #4F46E5, #818CF8))",
                  borderRadius: 99,
                  position: "relative"
                }}>
                  <div style={{
                    position: "absolute", right: -5, top: -4,
                    width: 14, height: 14, borderRadius: "50%",
                    background: "#FFFFFF", boxShadow: "0 0 10px rgba(79, 70, 229, 0.8)"
                  }} />
                </div>
              </div>

              {/* Bottom Cinema Controls (Play/Pause, Chapter, Speed, Volume, Next/Prev) */}
              <div className="tai-row tai-between" style={{ alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div className="tai-row tai-gap10" style={{ alignItems: "center" }}>
                  <button
                    className="tai-iconbtn"
                    style={{ background: "var(--primary)", color: "#fff", border: "none", width: 38, height: 38, borderRadius: "50%" }}
                    onClick={() => setIsPlaying(v => !v)}
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} fill="#fff" style={{ marginLeft: 2 }} />}
                  </button>

                  <button
                    className="tai-iconbtn"
                    style={{ color: "rgba(255,255,255,0.8)", width: 34, height: 34, borderRadius: 8 }}
                    onClick={() => setCurrentTimeSec(Math.max(0, currentTimeSec - 10))}
                    title="Rewind 10s"
                  >
                    <RotateCcw size={16} />
                  </button>

                  <button
                    className="tai-iconbtn"
                    style={{ color: "rgba(255,255,255,0.8)", width: 34, height: 34, borderRadius: 8 }}
                    onClick={() => setCurrentTimeSec(Math.min(totalDurationSec, currentTimeSec + 10))}
                    title="Forward 10s"
                  >
                    <RotateCw size={16} />
                  </button>

                  <button
                    className="tai-iconbtn"
                    style={{ color: "rgba(255,255,255,0.8)", width: 34, height: 34, borderRadius: 8 }}
                    onClick={() => setIsMuted(v => !v)}
                  >
                    {isMuted ? <VolumeX size={17} color="#EF4444" /> : <Volume2 size={17} />}
                  </button>

                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#FFFFFF", fontVariantNumeric: "tabular-nums" }}>
                    {formatTime(currentTimeSec)} <span style={{ color: "rgba(255,255,255,0.5)" }}>/ {formatTime(totalDurationSec)}</span>
                  </span>
                </div>

                {/* Right Video Controls (Speed, Quality, Theatre Mode, Fullscreen) */}
                <div className="tai-row tai-gap10" style={{ alignItems: "center" }}>
                  {/* Speed Selector */}
                  <div style={{ position: "relative" }}>
                    <button
                      className="tai-btn tai-btn-sm"
                      style={{
                        background: "rgba(255,255,255,0.08)", color: "#FFFFFF",
                        border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700
                      }}
                      onClick={() => setShowSpeedMenu(v => !v)}
                    >
                      {playbackSpeed}x
                    </button>
                    {showSpeedMenu && (
                      <div className="tai-card anim-slide-down" style={{
                        position: "absolute", bottom: 36, right: 0, width: 90, padding: 4, zIndex: 100,
                        background: "#1E293B", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10
                      }}>
                        {[0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((spd) => (
                          <div
                            key={spd}
                            style={{
                              padding: "6px 8px", borderRadius: 6, fontSize: 12, color: playbackSpeed === spd ? "#818CF8" : "#FFFFFF",
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
                      border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700
                    }}
                    onClick={() => setVideoQuality(v => v === "1080p HD" ? "720p" : "1080p HD")}
                  >
                    {videoQuality}
                  </button>

                  {/* Theatre Mode Toggle */}
                  <button
                    className="tai-iconbtn"
                    style={{ color: "rgba(255,255,255,0.8)", width: 34, height: 34, borderRadius: 8 }}
                    onClick={() => setIsTheatreMode(v => !v)}
                    title={isTheatreMode ? "Exit Theatre Mode" : "Theatre Mode"}
                  >
                    <Maximize2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Lesson Controls Bar (Prev Lesson • Mark Complete • Next Lesson) */}
          <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 12 }}>
            <button
              className="tai-btn tai-btn-outline"
              disabled={!prevLesson}
              onClick={() => prevLesson && push("lesson", { id: course?.id, lessonId: prevLesson.id })}
              style={{ flex: "1 1 160px", padding: "12px 18px", borderRadius: 14, opacity: prevLesson ? 1 : 0.4 }}
            >
              <ChevronLeft size={16} /> Previous Lesson
            </button>

            <button
              className={`tai-btn ${isCompleted ? "tai-btn-outline" : "tai-btn-primary"}`}
              style={{
                flex: "2 1 240px", padding: "12px 22px", borderRadius: 14, fontSize: 14.5, fontWeight: 800,
                boxShadow: isCompleted ? "none" : "0 6px 20px rgba(79, 70, 229, 0.35)"
              }}
              onClick={handleMarkDone}
            >
              <CheckCircle2 size={18} color={isCompleted ? "var(--success)" : "#FFFFFF"} />
              {isCompleted ? "Completed • Tap to Review (+50 XP)" : "✓ Mark Lesson as Complete (+50 XP)"}
            </button>

            <button
              className="tai-btn tai-btn-outline"
              disabled={!nextLesson}
              onClick={() => nextLesson && push("lesson", { id: course?.id, lessonId: nextLesson.id })}
              style={{ flex: "1 1 160px", padding: "12px 18px", borderRadius: 14, opacity: nextLesson ? 1 : 0.4 }}
            >
              Next Lesson <ChevronRight size={16} />
            </button>
          </div>

          {/* Interactive Multi-Tab Workspace Tabs (Coursera / Udemy Standard) */}
          <div className="tai-scrollx tai-gap8" style={{ borderBottom: "1.5px solid var(--border)", paddingBottom: 6, marginTop: 6, width: "100%", boxSizing: "border-box" }}>
            {[
              { id: "overview", label: "Overview & Objectives", icon: BookOpen },
              { id: "ai-tutor", label: "AI Tutor & Practice", icon: Bot, badge: "AI COACH" },
              { id: "notes", label: `Notes (${lessonNotesQuery?.data?.length || 0})`, icon: FileText },
              { id: "qa", label: `Q&A (${qaThreads.length})`, icon: MessageSquare },
              { id: "transcript", label: "Transcript", icon: Terminal },
              { id: "resources", label: `Resources (${LESSON_RESOURCES.length})`, icon: Paperclip },
              { id: "reviews", label: "Feedback & Reviews", icon: Star }
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
                    gap: 6,
                    padding: "9px 16px",
                    borderRadius: 12,
                    border: "none",
                    background: isActive ? "var(--primary)" : "transparent",
                    color: isActive ? "#FFFFFF" : "var(--text-2)",
                    fontWeight: isActive ? 800 : 600,
                    fontSize: 13,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    transition: "all 0.15s ease",
                    boxShadow: isActive ? "0 4px 14px rgba(79, 70, 229, 0.28)" : "none"
                  }}
                >
                  <Icon size={15} />
                  <span>{tabItem.label}</span>
                  {tabItem.badge && (
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 6,
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
            <div className="tai-card anim-slide-down" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: "var(--text)", margin: "0 0 10px" }}>
                  {lesson?.title}
                </h2>
                <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.6, margin: 0 }}>
                  In this comprehensive masterclass module, you will learn the foundational architecture for building resilient multi-agent AI systems, configuring design tokens with vector variables, and optimizing sub-second query performance in production environments.
                </p>
              </div>

              {/* Learning Objectives Checklist */}
              <div className="tai-card" style={{ background: "var(--surface-3)", padding: 18, borderRadius: 16 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--primary)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 12 }}>
                  What You'll Master in this Lesson
                </div>
                <div className="tai-col tai-gap10">
                  {[
                    "Architecting asynchronous function calling with schema validation.",
                    "Configuring Figma variables & vector tokens for design system automation.",
                    "Setting up Supabase pgvector with HNSW similarity index scoring.",
                    "Implementing exponential backoff and jittered retry hooks for multi-agent reliability."
                  ].map((obj, idx) => (
                    <div key={idx} className="tai-row tai-gap10" style={{ alignItems: "flex-start", fontSize: 13.5, color: "var(--text)", fontWeight: 600 }}>
                      <CheckCircle2 size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                      <span>{obj}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Instructor Bio Card */}
              <div className="tai-row tai-between" style={{ padding: "16px 20px", background: "var(--surface-2)", borderRadius: 16, flexWrap: "wrap", gap: 14 }}>
                <div className="tai-row tai-gap12" style={{ minWidth: 0 }}>
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80"
                    alt="Instructor"
                    style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)" }}>Astrid Larsson</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>Lead AI Systems Architect • Former Staff Designer</div>
                  </div>
                </div>

                <button
                  className="tai-btn tai-btn-outline tai-btn-sm"
                  onClick={() => { setActiveTab("qa"); setShowQuestionComposer(true); }}
                  style={{ borderRadius: 10 }}
                >
                  <MessageSquare size={14} /> Ask Astrid a Question
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: AI LEARNING TUTOR & PRACTICE */}
          {activeTab === "ai-tutor" && (
            <div className="tai-card anim-slide-down" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="tai-row tai-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <div className="tai-row tai-gap8">
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Bot size={18} color="var(--primary)" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)" }}>AI Learning Coach</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>Grounded in current timestamp ({formatTime(currentTimeSec)}) & lesson syllabus</div>
                  </div>
                </div>

                <Tag tone="primary">ACTIVE TUTOR</Tag>
              </div>

              {/* Quick AI Prompt Pills */}
              <div className="tai-scrollx tai-gap8" style={{ paddingBottom: 2, width: "100%", boxSizing: "border-box" }}>
                {[
                  "💡 Summarize this chapter",
                  "💻 Show a code implementation example",
                  "❓ Quiz me on this lesson's key concepts",
                  "🔍 Explain the vector embedding trade-offs"
                ].map((prompt, idx) => (
                  <button
                    key={idx}
                    className="tai-btn tai-btn-outline tai-btn-sm"
                    style={{ fontSize: 12, borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0 }}
                    onClick={() => handleSendAiMessage(prompt.replace(/^[^\w\s]+\s*/, ""))}
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* AI Chat Conversation Thread */}
              <div style={{
                maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column",
                gap: 12, padding: "10px 0", boxSizing: "border-box"
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
                      maxWidth: "80%",
                      padding: "12px 16px",
                      borderRadius: 16,
                      background: msg.sender === "user" ? "var(--primary)" : "var(--surface-3)",
                      color: msg.sender === "user" ? "#FFFFFF" : "var(--text)",
                      fontSize: 13.5,
                      lineHeight: 1.55,
                      whiteSpace: "pre-wrap"
                    }}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {aiThinking && (
                  <div className="tai-row tai-gap8" style={{ fontSize: 13, color: "var(--text-3)", padding: "8px 0" }}>
                    <RefreshCw size={14} className="anim-spin" /> AI Tutor is synthesizing an explanation...
                  </div>
                )}
              </div>

              {/* AI Chat Input Form */}
              <div className="tai-row tai-gap10">
                <input
                  className="tai-input"
                  placeholder="Ask a question about this timestamp or concept..."
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSendAiMessage(); }}
                  style={{ flex: 1 }}
                />
                <button
                  className="tai-btn tai-btn-primary"
                  disabled={!aiInput.trim() || aiThinking}
                  onClick={() => handleSendAiMessage()}
                >
                  <Send size={15} /> Ask AI
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: LESSON NOTES & TIMESTAMPS */}
          {activeTab === "notes" && (
            <div className="tai-card anim-slide-down" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="tai-row tai-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>Personal Study Notes</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Notes are automatically anchored to the video timeline</div>
                </div>

                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)", background: "var(--primary-tint)", padding: "4px 10px", borderRadius: 8 }}>
                  {lessonNotesQuery?.data?.length || 0} Notes Saved
                </span>
              </div>

              {/* Add Note Input Bar */}
              <div className="tai-row tai-gap10">
                <div style={{
                  padding: "0 12px", height: 44, borderRadius: 12, background: "var(--surface-3)",
                  display: "flex", alignItems: "center", fontSize: 12.5, fontWeight: 800, color: "var(--primary)"
                }}>
                  {formatTime(currentTimeSec)}
                </div>
                <input
                  className="tai-input"
                  placeholder={`Add a note at ${formatTime(currentTimeSec)}...`}
                  value={noteInputText}
                  onChange={e => setNoteInputText(e.target.value)}
                  style={{ flex: 1 }}
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
                >
                  <PlusCircle size={15} /> Save Note
                </button>
              </div>

              {/* Render Notes List */}
              {lessonNotesQuery?.loading && <div className="tai-empty">Loading your notes...</div>}
              {(!lessonNotesQuery?.data || lessonNotesQuery.data.length === 0) && !lessonNotesQuery?.loading && (
                <div className="tai-card" style={{ background: "var(--surface-2)", padding: "32px 20px", textAlign: "center" }}>
                  <FileText size={28} color="var(--text-3)" style={{ margin: "0 auto 10px" }} />
                  <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>No notes for this lesson yet</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 4 }}>Type a note above to bookmark important moments with timestamps.</div>
                </div>
              )}

              {(lessonNotesQuery?.data || []).map(n => (
                <div key={n.id} className="tai-card tai-card-hover" style={{ background: "var(--surface-3)", padding: 14, borderRadius: 14 }}>
                  <div className="tai-row tai-between" style={{ marginBottom: 6 }}>
                    <span
                      onClick={() => setCurrentTimeSec(n.timestamp_seconds)}
                      style={{ fontSize: 12, fontWeight: 800, color: "var(--primary)", cursor: "pointer", background: "var(--primary-tint)", padding: "2px 8px", borderRadius: 6 }}
                      title="Jump video to this timestamp"
                    >
                      ▶ {Math.floor(n.timestamp_seconds / 60)}:{(n.timestamp_seconds % 60).toString().padStart(2, "0")}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>Lesson {currentLessonIndex + 1}</span>
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.5 }}>
                    {n.content}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: Q&A DISCUSSION & COMMUNITY */}
          {activeTab === "qa" && (
            <div className="tai-card anim-slide-down" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>Lesson Q&A Discussion</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Ask questions and learn from instructors and fellow students</div>
                </div>

                <button
                  className="tai-btn tai-btn-primary tai-btn-sm"
                  onClick={() => setShowQuestionComposer(v => !v)}
                >
                  <PlusCircle size={15} /> Ask a New Question
                </button>
              </div>

              {/* Question Composer */}
              {showQuestionComposer && (
                <div className="tai-card" style={{ background: "var(--surface-3)", padding: 18, borderRadius: 16 }}>
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text)", marginBottom: 10 }}>Ask a Question linked to {formatTime(currentTimeSec)}</div>
                  <input
                    className="tai-input"
                    placeholder="Question title (e.g. How does vector similarity work here?)"
                    value={newQuestionTitle}
                    onChange={(e) => setNewQuestionTitle(e.target.value)}
                    style={{ marginBottom: 10 }}
                  />
                  <textarea
                    className="tai-input"
                    placeholder="Provide more context or paste error snippets..."
                    rows={3}
                    value={newQuestionContent}
                    onChange={(e) => setNewQuestionContent(e.target.value)}
                    style={{ marginBottom: 12 }}
                  />
                  <div className="tai-row tai-gap10" style={{ justifyContent: "flex-end" }}>
                    <button className="tai-btn tai-btn-outline tai-btn-sm" onClick={() => setShowQuestionComposer(false)}>Cancel</button>
                    <button className="tai-btn tai-btn-primary tai-btn-sm" disabled={!newQuestionTitle.trim()} onClick={handlePostQuestion}>Post Question</button>
                  </div>
                </div>
              )}

              {/* Q&A List */}
              <div className="tai-col tai-gap14">
                {qaThreads.map((thread) => (
                  <div key={thread.id} className="tai-card tai-card-hover" style={{ background: "var(--surface-2)", padding: 18, borderRadius: 16 }}>
                    <div className="tai-row tai-between" style={{ alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                      <div className="tai-row tai-gap10" style={{ minWidth: 0 }}>
                        <img src={thread.avatar} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>{thread.title}</div>
                          <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>{thread.author} • {thread.role} • {thread.time} • at {thread.timestamp}</div>
                        </div>
                      </div>

                      <button
                        className="tai-btn tai-btn-sm"
                        style={{
                          background: thread.upvoted ? "var(--primary)" : "var(--surface)",
                          color: thread.upvoted ? "#FFFFFF" : "var(--text)",
                          border: "1px solid var(--border)", borderRadius: 8, padding: "4px 10px", flexShrink: 0
                        }}
                        onClick={() => handleToggleUpvote(thread.id)}
                      >
                        <ThumbsUp size={13} /> {thread.upvotes}
                      </button>
                    </div>

                    <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5, margin: "0 0 12px" }}>
                      {thread.content}
                    </p>

                    {/* Instructor Verified Answer Box */}
                    {thread.answers.map(ans => (
                      <div key={ans.id} style={{ background: "var(--surface)", borderLeft: "3.5px solid var(--primary)", padding: "12px 14px", borderRadius: "0 12px 12px 0", marginTop: 8 }}>
                        <div className="tai-row tai-gap8" style={{ marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, background: "var(--primary-tint)", color: "var(--primary)", padding: "2px 6px", borderRadius: 4 }}>
                            INSTRUCTOR ANSWER
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{ans.author}</span>
                          <span style={{ fontSize: 11, color: "var(--text-3)" }}>{ans.time}</span>
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 }}>
                          {ans.text}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: SYNCHRONIZED TRANSCRIPT */}
          {activeTab === "transcript" && (
            <div className="tai-card anim-slide-down" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>Interactive Video Transcript</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Click any line to jump video playback directly to that timestamp</div>
                </div>

                <div className="tai-row tai-gap8" style={{ position: "relative", minWidth: 200 }}>
                  <Search size={14} color="var(--text-3)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    type="text"
                    placeholder="Search transcript..."
                    value={transcriptSearch}
                    onChange={(e) => setTranscriptSearch(e.target.value)}
                    style={{ width: "100%", height: 36, paddingLeft: 30, paddingRight: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-3)", fontSize: 12, color: "var(--text)", outline: "none" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto" }}>
                {DEFAULT_TRANSCRIPT
                  .filter(line => !transcriptSearch || line.text.toLowerCase().includes(transcriptSearch.toLowerCase()))
                  .map((line, idx) => {
                    const isCurrent = currentTimeSec >= line.seconds && (idx === DEFAULT_TRANSCRIPT.length - 1 || currentTimeSec < DEFAULT_TRANSCRIPT[idx + 1].seconds);
                    return (
                      <div
                        key={line.time}
                        onClick={() => setCurrentTimeSec(line.seconds)}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          background: isCurrent ? "var(--primary-tint)" : "var(--surface-2)",
                          border: isCurrent ? "1px solid var(--primary-light)" : "1px solid transparent",
                          cursor: "pointer",
                          display: "flex",
                          gap: 12,
                          alignItems: "flex-start",
                          transition: "all 0.15s ease"
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 800, color: isCurrent ? "var(--primary)" : "var(--text-3)", fontVariantNumeric: "tabular-nums", flexShrink: 0, marginTop: 1 }}>
                          {line.time}
                        </span>
                        <div style={{ fontSize: 13, color: isCurrent ? "var(--text)" : "var(--text-2)", lineHeight: 1.5, fontWeight: isCurrent ? 700 : 400 }}>
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
            <div className="tai-card anim-slide-down" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>Lesson Resources &amp; Starter Kits</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Download files, template repositories, and cheatsheets for this lesson</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
                {LESSON_RESOURCES.map((res) => {
                  const Icon = res.icon;
                  return (
                    <div key={res.id} className="tai-card tai-card-hover" style={{ background: "var(--surface-2)", padding: 16, borderRadius: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <div className="tai-row tai-gap10" style={{ marginBottom: 8 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Icon size={18} color="var(--primary)" />
                          </div>
                          <div>
                            <span style={{ fontSize: 10, fontWeight: 800, color: "var(--primary)", textTransform: "uppercase" }}>{res.type}</span>
                            <div style={{ fontSize: 11, color: "var(--text-3)" }}>{res.size}</div>
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text)", lineHeight: 1.4 }}>
                          {res.title}
                        </div>
                      </div>

                      <button
                        className="tai-btn tai-btn-outline tai-btn-sm"
                        style={{ marginTop: 14, width: "100%", borderRadius: 8 }}
                        onClick={() => showToast?.(`Downloading ${res.title}...`)}
                      >
                        <Download size={14} /> Download Asset
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 7: FEEDBACK & REVIEWS */}
          {activeTab === "reviews" && (
            <div className="tai-card anim-slide-down" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>Lesson Feedback &amp; Rating</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Help instructors improve learning outcomes and curriculum clarity</div>
              </div>

              <div className="tai-card" style={{ background: "var(--surface-3)", padding: 20, borderRadius: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", marginBottom: 8 }}>Rate this lesson</div>
                <div className="tai-row tai-gap8" style={{ marginBottom: 16 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2 }}
                      onClick={() => setFeedbackRating(star)}
                    >
                      <Star size={24} fill={feedbackRating >= star ? "#F59E0B" : "none"} color="#F59E0B" />
                    </button>
                  ))}
                </div>

                <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", marginBottom: 8 }}>How confident are you with this lesson's concepts?</div>
                <div className="tai-row tai-gap8" style={{ flexWrap: "wrap", marginBottom: 16 }}>
                  {[
                    { val: 1, label: "1 (Struggling)" },
                    { val: 2, label: "2 (Needs Review)" },
                    { val: 3, label: "3 (Good)" },
                    { val: 4, label: "4 (Confident)" },
                    { val: 5, label: "5 (Mastered)" }
                  ].map(item => (
                    <button
                      key={item.val}
                      className={`tai-btn tai-btn-sm ${feedbackConfidence === item.val ? "tai-btn-primary" : "tai-btn-outline"}`}
                      style={{ borderRadius: 8 }}
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
            padding: "18px 16px",
            borderRadius: 20,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            position: "sticky",
            top: 20,
            maxHeight: "calc(100vh - 40px)",
            overflowY: "auto"
          }}>
            <div className="tai-row tai-between" style={{ paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>Course Content</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{completedCount} of {rawLessons.length} lessons completed</div>
              </div>

              <button
                className="tai-iconbtn"
                style={{ width: 30, height: 30 }}
                onClick={() => setSidebarOpen(false)}
                title="Collapse sidebar"
              >
                <X size={15} />
              </button>
            </div>

            {/* Curriculum Search Filter */}
            <div style={{ position: "relative", width: "100%" }}>
              <Search size={14} color="var(--text-3)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
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
              {Object.entries(groupedModules).map(([moduleName, moduleLessons], modIdx) => (
                <div key={moduleName} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {/* Module Section Header */}
                  <div style={{
                    fontSize: 11.5, fontWeight: 800, color: "var(--primary)",
                    textTransform: "uppercase", letterSpacing: ".04em", padding: "4px 2px"
                  }}>
                    {moduleName}
                  </div>

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
                              <div className="tai-row tai-gap8" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                                <span className="tai-row tai-gap4"><Clock size={11} /> {les.duration || 20}m</span>
                                <span>•</span>
                                <span>Video &amp; Code</span>
                              </div>
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
