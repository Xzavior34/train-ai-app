import React, { useState, useEffect } from "react";
import { TopBar, CourseCard, ProgressBar, Tag } from "../components/LearnerUI.jsx";
import {
  Search, Play, Clock, Video, Eye,
  ArrowRight, ExternalLink, Bookmark, CheckCircle2,
  Calendar, Layers, Filter, X, Award, Users,
  BookOpen, ChevronRight, ChevronLeft, TrendingUp, ShieldCheck, Heart,
  Flame, Laptop, FileText, Check, Compass, Map, Target, GraduationCap, BarChart3
} from "lucide-react";
import { PortalModal } from "../../components/common/PortalModal.jsx";
import { isMockDataEnabled, subscribeToMockDataChanges } from "../../lib/mockDataManager.js";

const TRACK_DEFINITIONS = {
  design: {
    id: "design",
    name: "UI/UX & Design Systems",
    category: "design",
    description: "Master modern UI/UX architecture, spatial interfaces, design tokens, Figma auto-layout 5.0, and AI-accelerated design workflows.",
    targetRole: "Senior Product Designer / UI/UX Architect",
    skills: ["Figma AI", "Design Tokens", "Spatial UX", "Design Systems", "Interactive Prototyping"],
    keywords: ["design", "ux", "ui", "figma", "spatial", "visual", "prototyping"]
  },
  ai: {
    id: "ai",
    name: "AI & Prompt Engineering",
    category: "ai",
    description: "Architect LLM-powered applications, prompt optimization pipelines, autonomous agents, and multi-modal neural workflows.",
    targetRole: "AI Application Specialist / Prompt Engineer",
    skills: ["Prompt Systems", "Vector Search", "LLM APIs", "Autonomous Agents", "RAG"],
    keywords: ["ai", "prompt", "llm", "neural", "agent", "gpt", "gemini"]
  },
  engineering: {
    id: "engineering",
    name: "Full-Stack & Web Dev",
    category: "engineering",
    description: "Build robust full-stack web applications with React 19, TypeScript, PostgreSQL, microservices, and serverless infrastructure.",
    targetRole: "Full-Stack Software Engineer",
    skills: ["React 19", "Node.js", "PostgreSQL", "REST & GraphQL", "DevOps"],
    keywords: ["full-stack", "engineering", "web", "react", "node", "javascript", "code"]
  },
  data: {
    id: "data",
    name: "Data Science & Python",
    category: "data",
    description: "Analyze complex datasets, build predictive machine learning models, and deploy scalable data analytics pipelines in Python.",
    targetRole: "Data Scientist / ML Engineer",
    skills: ["Python", "Pandas", "Scikit-Learn", "Data Viz", "Statistical Modeling"],
    keywords: ["data", "python", "machine learning", "analytics", "statistics"]
  },
  cloud: {
    id: "cloud",
    name: "Cloud & DevOps",
    category: "cloud",
    description: "Deploy scalable cloud infrastructure, Kubernetes clusters, CI/CD automated deployment pipelines, and GPU workloads.",
    targetRole: "Cloud / DevOps Engineer",
    skills: ["Kubernetes", "Docker", "CI/CD", "AWS/GCP", "Infrastructure as Code"],
    keywords: ["cloud", "devops", "kubernetes", "docker", "infrastructure"]
  }
};

const CATEGORIES = [
  { id: "all", label: "All Topics" },
  { id: "ai", label: "AI & Prompt Engineering" },
  { id: "design", label: "UI/UX & Design Systems" },
  { id: "engineering", label: "Full-Stack & Web Dev" },
  { id: "data", label: "Data Science & Python" },
  { id: "cloud", label: "Cloud & DevOps" },
  { id: "product", label: "Product & Strategy" },
  { id: "business", label: "Tech-Preneur & Business" }
];

const CURATED_STOCK_PHOTOS = [
  "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80", // Design systems
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80", // Abstract AI 3D
  "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80", // Code & prompt eng
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80", // Cloud & devops
  "https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?w=800&auto=format&fit=crop&q=80", // Spatial visionOS
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80", // Analytics & growth
  "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80", // Python data science
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80", // Microchip & AI RAG
  "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=800&auto=format&fit=crop&q=80", // UI prototyping
  "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&auto=format&fit=crop&q=80", // Design thinking
  "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&auto=format&fit=crop&q=80", // Tech-preneurship
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80", // Business opportunity
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80", // Teamwork
  "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&auto=format&fit=crop&q=80", // Presentation
  "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=80", // Cyber tech
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&auto=format&fit=crop&q=80"  // Workspace
];

function getSafeCoverImage(course, idx = 0) {
  if (course?.coverImageUrl && course.coverImageUrl.startsWith("http") && !course.coverImageUrl.includes("picsum.photos")) {
    return course.coverImageUrl;
  }
  if (course?.image && course.image.startsWith("http") && !course.image.includes("picsum.photos")) {
    return course.image;
  }
  const title = (course?.title || "").toLowerCase();
  if (title.includes("design think") || title.includes("ux") || title.includes("figma")) {
    return CURATED_STOCK_PHOTOS[9];
  }
  if (title.includes("entrepreneur") || title.includes("business") || title.includes("venture")) {
    return CURATED_STOCK_PHOTOS[10];
  }
  if (title.includes("opportunity") || title.includes("market") || title.includes("strategy")) {
    return CURATED_STOCK_PHOTOS[11];
  }
  if (title.includes("ai") || title.includes("prompt") || title.includes("llm")) {
    return CURATED_STOCK_PHOTOS[2];
  }
  if (title.includes("full-stack") || title.includes("react") || title.includes("web")) {
    return CURATED_STOCK_PHOTOS[1];
  }
  if (title.includes("cloud") || title.includes("devops") || title.includes("kubernetes")) {
    return CURATED_STOCK_PHOTOS[3];
  }
  if (title.includes("data") || title.includes("python") || title.includes("machine")) {
    return CURATED_STOCK_PHOTOS[6];
  }
  return CURATED_STOCK_PHOTOS[idx % CURATED_STOCK_PHOTOS.length];
}

const SPECIALIZATIONS = [
  {
    id: "spec-1",
    title: "AI Product Design & Spatial Systems Professional Certificate",
    provider: "Train AI Academy • Figma Partner",
    coursesCount: 4,
    months: "3 Months (6 hrs/week)",
    rating: 4.9,
    reviews: "3,420",
    level: "Intermediate",
    badge: "PROFESSIONAL CERTIFICATE",
    badgeBg: "#2563EB",
    description: "Master modern AI design workflows, generative prototyping, vector tokens, and spatial interfaces with direct industry credentialing.",
    skills: ["Figma AI", "Design Systems", "Spatial UI", "Token Architecture", "UX Research"],
    image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=80"
  },
  {
    id: "spec-2",
    title: "Full-Stack Generative AI Application Engineering",
    provider: "Train AI Engineering Labs • Anthropic Partner",
    coursesCount: 4,
    months: "4 Months (8 hrs/week)",
    rating: 4.95,
    reviews: "2,890",
    level: "Advanced",
    badge: "ENGINEERING TRACK",
    badgeBg: "#059669",
    description: "Build production-ready multi-modal AI agents, vector database backends, RAG pipelines, and reactive enterprise apps.",
    skills: ["LangChain", "Vector DBs", "FastAPI", "React 19", "OpenAI / Gemini APIs"],
    image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80"
  }
];

const RECENT_RECORDINGS = [
  {
    id: "rec-1",
    title: "UI/UX Principles & Spatial Component Hierarchies",
    date: "18 Nov 2024",
    duration: "45 mins",
    views: "1.4k views",
    instructor: "Sarah Jenkins",
    role: "Staff Product Designer",
    thumbnail: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=600&auto=format&fit=crop&q=80",
    videoUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    badge: "UI/UX MASTERCLASS",
    badgeColor: "#2563EB"
  },
  {
    id: "rec-2",
    title: "Accelerating Design Systems With AI & Figma Variables",
    date: "14 Nov 2024",
    duration: "1 hr 10m",
    views: "2.8k views",
    instructor: "Alex Rivera",
    role: "Lead AI Design Engineer",
    thumbnail: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=600&auto=format&fit=crop&q=80",
    videoUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    badge: "UX + AI TOKENS",
    badgeColor: "#2563EB"
  },
  {
    id: "rec-3",
    title: "Building Production Multi-Agent Systems in Python",
    date: "10 Nov 2024",
    duration: "52 mins",
    views: "3.2k views",
    instructor: "Elena Rostova",
    role: "Principal AI Scientist",
    thumbnail: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&auto=format&fit=crop&q=80",
    videoUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    badge: "ENGINEERING",
    badgeColor: "#2563EB"
  },
  {
    id: "rec-4",
    title: "Interactive Micro-Interactions & Prototyping Workshop",
    date: "4 Nov 2024",
    duration: "38 mins",
    views: "1.9k views",
    instructor: "Marcus Vance",
    role: "Lead Motion Designer",
    thumbnail: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80",
    videoUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    badge: "PROTOTYPING",
    badgeColor: "#059669"
  }
];

export function CoursesScreen({
  user = {},
  courses = [], coursesLoading, courseSearch = "", setCourseSearch,
  courseLevelFilter = "all", setCourseLevelFilter, courseSourceTab = "all", setCourseSourceTab,
  showMyCoursesOnly = false, setShowMyCoursesOnly, push, handleEnroll, handleRequestJoin,
  onToggleBookmark
}) {
  const [activeTrackKey, setActiveTrackKey] = useState(() => {
    const raw = (user?.track || "").toLowerCase();
    if (raw.includes("ai") || raw.includes("prompt") || raw.includes("machine")) return "ai";
    if (raw.includes("stack") || raw.includes("engineer") || raw.includes("web") || raw.includes("react")) return "engineering";
    if (raw.includes("data") || raw.includes("python")) return "data";
    if (raw.includes("cloud") || raw.includes("devops")) return "cloud";
    return "design"; // default UI/UX & Design Systems
  });
  const [activeRecording, setActiveRecording] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("popular");
  const [activeSpecialization, setActiveSpecialization] = useState(null);
  const [bookmarkedIds, setBookmarkedIds] = useState({});
  const [mockEnabled, setMockEnabled] = useState(() => isMockDataEnabled());

  useEffect(() => {
    return subscribeToMockDataChanges((enabled) => setMockEnabled(enabled));
  }, []);

  function toggleLocalBookmark(e, courseId) {
    if (e && e.stopPropagation) e.stopPropagation();
    setBookmarkedIds(prev => ({ ...prev, [courseId]: !prev[courseId] }));
    onToggleBookmark?.(courseId);
  }

  // Enrich any database or mock courses with clean stock photos and instructors
  const allAvailableCourses = (courses && courses.length > 0 ? courses : []).map((c, idx) => {
    const fallbackImage = getSafeCoverImage(c, idx);
    return {
      ...c,
      coverImageUrl: c.coverImageUrl || c.image || fallbackImage,
      rating: c.rating || (4.8 + ((idx % 3) * 0.1)).toFixed(1),
      reviewsCount: c.reviewsCount || (840 + idx * 120),
      studentsCount: c.studentsCount || `${(4.2 + idx * 1.5).toFixed(1)}k`,
      hours: c.hours || (12 + (idx % 4) * 4),
      lessonsCount: c.lessonsCount || (16 + (idx % 3) * 6),
      instructor: c.instructor || (idx % 3 === 0 ? "Astrid Larsson" : idx % 3 === 1 ? "Alex Rivera" : "Elena Rostova"),
      instructorRole: c.instructorRole || "Lead Curriculum Specialist",
      instructorAvatar: c.instructorAvatar || (idx % 2 === 0 ? "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80" : "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80")
    };
  });

  const enrolledList = allAvailableCourses.filter(c => c.enrolled);

  const activeTrack = TRACK_DEFINITIONS[activeTrackKey] || TRACK_DEFINITIONS.design;

  // Resolve courses in learner's real track
  const matchedTrackCourses = allAvailableCourses.filter(c => {
    const text = `${c.title || ""} ${c.category || ""} ${c.description || ""} ${c.tagline || ""}`.toLowerCase();
    return activeTrack.keywords.some(kw => text.includes(kw));
  });

  // Ensure 3-4 structured curriculum items for the roadmap
  const trackCourses = matchedTrackCourses.length >= 2
    ? matchedTrackCourses
    : allAvailableCourses.slice(0, 4);

  const completedTrackCourses = trackCourses.filter(c => (c.progress || 0) >= 100);
  const inProgressTrackCourses = trackCourses.filter(c => (c.progress || 0) > 0 && (c.progress || 0) < 100);
  const remainingTrackCourses = trackCourses.filter(c => (c.progress || 0) < 100);
  const trackOverallProgress = trackCourses.length 
    ? Math.round(trackCourses.reduce((sum, c) => sum + (c.progress || 0), 0) / trackCourses.length) 
    : 0;

  const nextCourseToTake = inProgressTrackCourses[0] || remainingTrackCourses[0] || trackCourses[0];

  // Filtering logic
  const filteredCatalogUnsorted = allAvailableCourses.filter(c => {
    if (showMyCoursesOnly && !c.enrolled) return false;
    if (courseSourceTab === "assigned") {
      if (!c.assigned && !c.enrolled && c.source !== "assigned") return false;
    }
    if (courseSourceTab === "internal") {
      if (!c.isInternal && c.source !== "internal") return false;
    }
    if (courseSourceTab === "partners") {
      if (!c.partner && c.source !== "partner") return false;
    }
    if (courseSourceTab === "bookmarks" && !bookmarkedIds[c.id]) return false;
    if (courseSearch && courseSearch.trim()) {
      const q = courseSearch.toLowerCase();
      const matchTitle = c.title?.toLowerCase().includes(q);
      const matchDesc = c.description?.toLowerCase().includes(q);
      const matchCat = c.category?.toLowerCase().includes(q);
      const matchInst = c.instructor?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchCat && !matchInst) return false;
    }
    if (selectedCategory !== "all") {
      const catObj = CATEGORIES.find(cat => cat.id === selectedCategory);
      if (catObj && !c.category?.toLowerCase().includes(catObj.label.split(" ")[0].toLowerCase()) && !c.title?.toLowerCase().includes(catObj.label.split(" ")[0].toLowerCase())) {
        return false;
      }
    }
    return true;
  }).sort((a, b) => {
    const aBm = !!bookmarkedIds[a.id];
    const bBm = !!bookmarkedIds[b.id];
    if (aBm === bBm) return 0;
    return aBm ? -1 : 1;
  });

  const filteredCatalog = filteredCatalogUnsorted;

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      {/* =========================================================================
          REAL LEARNING TRACK PROGRESS HERO CARD
          ========================================================================= */}
      <div
        className="tai-card tai-hero-card tai-hero-dark anim-fluid-entrance"
        style={{
          position: "relative",
          borderRadius: 14,
          overflow: "hidden",
          padding: "clamp(20px, 2.8vw, 28px)",
          transition: "all 0.3s ease"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(37, 99, 235, 0.25) 0%, transparent 70%)",
            pointerEvents: "none"
          }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 24, alignItems: "stretch", position: "relative", zIndex: 1 }}>
          
          {/* Left Column: Track Details, Real Progress, & Pathway Curriculum Roadmap */}
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            
            {/* Pathway Header & Track Switcher Tabs */}
            <div className="tai-row tai-between" style={{ marginBottom: 14, alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div className="tai-row tai-gap8" style={{ alignItems: "center", flexWrap: "wrap" }}>
                <span
                  style={{
                    background: "rgba(37, 99, 235, 0.2)",
                    color: "#93C5FD",
                    border: "1px solid rgba(96, 165, 250, 0.35)",
                    borderRadius: 6,
                    padding: "3px 10px",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5
                  }}
                >
                  <Map size={12} />
                  <span>ACTIVE PATHWAY • {activeTrack.name.toUpperCase()}</span>
                </span>
                <span style={{ fontSize: 11.5, color: "#94A3B8" }}>
                  {completedTrackCourses.length}/{trackCourses.length} Courses Complete ({trackOverallProgress}%)
                </span>
              </div>

              {/* Quick Switch Track Pills */}
              <div className="tai-row tai-gap6" style={{ alignItems: "center", flexWrap: "wrap" }}>
                {Object.values(TRACK_DEFINITIONS).map(td => {
                  const isSel = td.id === activeTrackKey;
                  return (
                    <button
                      key={td.id}
                      onClick={() => setActiveTrackKey(td.id)}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        border: isSel ? "1px solid #60A5FA" : "1px solid rgba(255,255,255,0.12)",
                        background: isSel ? "rgba(37, 99, 235, 0.35)" : "rgba(255,255,255,0.05)",
                        color: isSel ? "#FFFFFF" : "#94A3B8",
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                      }}
                    >
                      {td.id === "design" ? "UI/UX" : td.id === "ai" ? "AI Eng" : td.id === "engineering" ? "Full-Stack" : td.id === "data" ? "Data" : "Cloud"}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title & Description */}
            <h1 className="tai-fade-in tai-hero-title" style={{ fontSize: "clamp(20px, 2.5vw, 26px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 8px", lineHeight: 1.25, color: "#FFFFFF" }}>
              {activeTrack.name} Learning Pathway
            </h1>
            <p className="tai-fade-in tai-hero-desc" style={{ fontSize: 13, margin: "0 0 16px", lineHeight: 1.45, color: "#CBD5E1", maxWidth: 640 }}>
              {activeTrack.description}
            </p>

            {/* Real Track Progress Meter Bar */}
            <div className="tai-hero-subcard" style={{ padding: "12px 14px", borderRadius: 10, marginBottom: 16, border: "1px solid rgba(255,255,255,0.12)" }}>
              <div className="tai-row tai-between" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#DBEAFE" }}>
                <span>Pathway Completion Rate</span>
                <span style={{ color: trackOverallProgress === 100 ? "#34D399" : "#60A5FA", fontWeight: 800 }}>
                  {trackOverallProgress}% • {remainingTrackCourses.length === 0 ? "Pathway Completed!" : `${remainingTrackCourses.length} course${remainingTrackCourses.length === 1 ? "" : "s"} left`}
                </span>
              </div>
              <div style={{ height: 7, borderRadius: 99, background: "rgba(255, 255, 255, 0.12)", overflow: "hidden" }}>
                <div style={{ width: `${Math.max(4, trackOverallProgress)}%`, height: "100%", background: trackOverallProgress === 100 ? "#10B981" : "#2563EB", borderRadius: 99, transition: "width 0.4s ease" }} />
              </div>
            </div>

            {/* Curriculum Roadmap — Courses Required to Finish Path */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                Required Courses to Complete Pathway:
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                {trackCourses.map((tc, idx) => {
                  const isDone = (tc.progress || 0) >= 100;
                  const isInProgress = (tc.progress || 0) > 0 && !isDone;
                  const isNext = tc.id === nextCourseToTake?.id && !isDone;
                  return (
                    <div
                      key={tc.id || idx}
                      onClick={() => push("courseDetail", { id: tc.id })}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: isNext ? "rgba(37, 99, 235, 0.22)" : isDone ? "rgba(16, 185, 129, 0.1)" : "rgba(255, 255, 255, 0.05)",
                        border: isNext ? "1.5px solid #3B82F6" : isDone ? "1px solid rgba(16, 185, 129, 0.35)" : "1px solid rgba(255, 255, 255, 0.1)",
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                      }}
                      title={`Click to open ${tc.title}`}
                    >
                      <div className="tai-row tai-between" style={{ marginBottom: 3 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: isDone ? "#34D399" : isNext ? "#93C5FD" : "#94A3B8" }}>
                          Course {idx + 1}
                        </span>
                        {isDone ? (
                          <span style={{ fontSize: 10, fontWeight: 800, color: "#34D399", display: "flex", alignItems: "center", gap: 3 }}>
                            <CheckCircle2 size={11} /> Done
                          </span>
                        ) : isInProgress ? (
                          <span style={{ fontSize: 10, fontWeight: 800, color: "#60A5FA" }}>{tc.progress}%</span>
                        ) : isNext ? (
                          <span style={{ fontSize: 10, fontWeight: 800, color: "#93C5FD" }}>Next Up</span>
                        ) : (
                          <span style={{ fontSize: 10, color: "#64748B" }}>Required</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {tc.title}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action CTAs */}
            <div className="tai-row tai-gap10" style={{ flexWrap: "wrap", marginTop: "auto" }}>
              {nextCourseToTake && (
                <button
                  className="tai-btn tai-btn-primary"
                  style={{
                    padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                    display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer"
                  }}
                  onClick={() => push("courseDetail", { id: nextCourseToTake.id })}
                >
                  <span>{(nextCourseToTake.progress || 0) > 0 ? `Resume: ${nextCourseToTake.title.slice(0, 22)}...` : `Start: ${nextCourseToTake.title.slice(0, 22)}...`}</span>
                  <ArrowRight size={14} />
                </button>
              )}

              <button
                className="tai-btn"
                style={{
                  background: "rgba(255,255,255,0.08)", color: "#FFFFFF", fontWeight: 700,
                  padding: "9px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", fontSize: 13,
                  display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer"
                }}
                onClick={() => push("learningPaths")}
              >
                <Map size={13} />
                <span>Explore All Learning Pathways</span>
              </button>
            </div>

          </div>

          {/* Right Column: Track Credential & Milestone Summary (Desktop view) */}
          <div className="tai-desktop-only" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", background: "rgba(15, 23, 42, 0.65)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", padding: 18 }}>
            <div>
              <div className="tai-row tai-between" style={{ marginBottom: 12 }}>
                <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(37, 99, 235, 0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Award size={17} color="#60A5FA" />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#FFFFFF" }}>Verified Pathway Credential</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>Industry recognized certificate</div>
                  </div>
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: trackOverallProgress === 100 ? "#34D399" : "#60A5FA", background: trackOverallProgress === 100 ? "rgba(16,185,129,0.15)" : "rgba(37,99,235,0.15)", padding: "2px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)" }}>
                  {trackOverallProgress === 100 ? "Unlocked" : `${completedTrackCourses.length}/${trackCourses.length} Met`}
                </span>
              </div>

              <div style={{ fontSize: 12, color: "#E2E8F0", marginBottom: 12, lineHeight: 1.4 }}>
                Target Outcome: <strong style={{ color: "#FFFFFF" }}>{activeTrack.targetRole}</strong>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", marginBottom: 6 }}>Key Competencies Covered:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {activeTrack.skills.map((sk, i) => (
                    <span key={i} style={{ fontSize: 10.5, background: "rgba(255,255,255,0.08)", color: "#E2E8F0", padding: "2px 7px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.08)" }}>
                      {sk}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ fontSize: 11.5, color: "#94A3B8", marginBottom: 10, lineHeight: 1.4 }}>
                {remainingTrackCourses.length === 0
                  ? "All courses completed! Your verified certificate is ready to download."
                  : `Finish the remaining ${remainingTrackCourses.length} course${remainingTrackCourses.length === 1 ? "" : "s"} to claim your verified certificate.`}
              </div>
              <button
                className="tai-btn tai-btn-outline"
                style={{ width: "100%", padding: "7px 12px", fontSize: 12, fontWeight: 700, color: "#FFFFFF", borderColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                onClick={() => push("achievements")}
              >
                <span>View My Certificates &amp; Credentials</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* =========================================================================
          FILTER STRIP & SEARCH CONTROL
          ========================================================================= */}
      <div className="tai-card" style={{ padding: "16px 18px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="tai-col tai-gap14">
          
          {/* Source Tabs */}
          <div className="tai-scrollx tai-gap8" style={{ paddingBottom: 2 }}>
            {[
              { id: "all", label: "All Courses", count: allAvailableCourses.length },
              { id: "assigned", label: "Assigned to Me", count: allAvailableCourses.filter(c => c.assigned || c.enrolled || c.source === "assigned").length },
              { id: "internal", label: "Internal Courses", count: allAvailableCourses.filter(c => c.isInternal || c.source === "internal").length },
              { id: "partners", label: "External Partners", count: allAvailableCourses.filter(c => c.partner || c.source === "partner").length },
              { id: "bookmarks", label: "Bookmarked", count: Object.values(bookmarkedIds).filter(Boolean).length }
            ].map((tab) => {
              const isActive = !showMyCoursesOnly && courseSourceTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setShowMyCoursesOnly(false); setCourseSourceTab(tab.id); }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: isActive ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                    background: isActive ? "var(--primary)" : "var(--surface-2)",
                    color: isActive ? "#FFFFFF" : "var(--text)",
                    fontWeight: isActive ? 800 : 600,
                    fontSize: 13,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    boxShadow: isActive ? "0 4px 12px rgba(37, 99, 235, 0.25)" : "none"
                  }}
                >
                  <span>{tab.label}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 800, padding: "2px 7px", borderRadius: 99,
                    background: isActive ? "rgba(255,255,255,0.25)" : "var(--surface)",
                    color: isActive ? "#FFFFFF" : "var(--text-3)"
                  }}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search + Enrolled Toggle */}
          <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 12 }}>
            <div className="tai-row tai-gap10" style={{ flex: "1 1 260px", position: "relative" }}>
              <Search size={16} color="var(--text-3)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Search masterclasses, skills, instructors, or certifications..."
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                style={{
                  width: "100%", height: 42, paddingLeft: 42, paddingRight: 14,
                  borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--surface-2)",
                  fontSize: 13.5, color: "var(--text)", outline: "none"
                }}
              />
            </div>

            <div className="tai-row tai-gap10" style={{ flexShrink: 0 }}>
              <button
                className="tai-btn tai-btn-outline tai-btn-sm"
                onClick={() => setShowMyCoursesOnly(!showMyCoursesOnly)}
                style={{
                  height: 42, padding: "0 16px", borderRadius: 8, fontWeight: 700, whiteSpace: "nowrap",
                  background: showMyCoursesOnly ? "var(--primary-tint)" : "transparent",
                  borderColor: showMyCoursesOnly ? "var(--primary)" : "var(--border)",
                  color: showMyCoursesOnly ? "var(--primary)" : "var(--text)"
                }}
              >
                {showMyCoursesOnly ? "Show Full Catalog" : `My Enrolled (${enrolledList.length}) →`}
              </button>
            </div>
          </div>

          {/* Topics Category Pills */}
          <div className="tai-scrollx tai-gap6" style={{ paddingBottom: 2 }}>
            {CATEGORIES.map(cat => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    padding: "6px 13px",
                    borderRadius: 99,
                    border: isActive ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                    background: isActive ? "var(--primary-tint)" : "var(--surface)",
                    color: isActive ? "var(--primary)" : "var(--text-2)",
                    fontWeight: isActive ? 800 : 600,
                    fontSize: 12,
                    cursor: "pointer",
                    whiteSpace: "nowrap"
                  }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* =========================================================================
          COURSE CARDS GRID (With Guaranteed Stock Photo Fallbacks & Zero Glitches)
          ========================================================================= */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
        {filteredCatalog.length === 0 ? (
          <div className="tai-card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "48px 24px", borderRadius: 10 }}>
            <div style={{ width: 60, height: 60, borderRadius: 10, background: "var(--primary-tint)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <BookOpen size={26} color="var(--primary)" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", margin: "0 0 6px" }}>
              {courseSourceTab === "bookmarks" ? "No Bookmarked Courses Yet" : "No Courses Found Matching Criteria"}
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-3)", maxWidth: 400, margin: "0 auto 16px" }}>
              Try adjusting your search keyword or switching category tabs to browse all courses.
            </p>
            <button
              className="tai-btn tai-btn-primary"
              onClick={() => {
                setShowMyCoursesOnly(false);
                setCourseSourceTab("all");
                setCourseSearch("");
                setSelectedCategory("all");
              }}
            >
              Browse All Courses →
            </button>
          </div>
        ) : (
          filteredCatalog.map((course, idx) => {
            const isEnrolled = course.enrolled;
            const isCompleted = course.progress === 100;
            const isBookmarked = !!bookmarkedIds[course.id];
            const safeCover = getSafeCoverImage(course, idx);

            return (
              <div
                key={course.id || idx}
                className="tai-card-hover"
                onClick={() => push("courseDetail", { id: course.id })}
                style={{
                  background: "var(--surface)",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  cursor: "pointer",
                  boxShadow: "0 2px 10px rgba(15,23,42,0.04)"
                }}
              >
                {/* Thumbnail Image with Dark Gradient Overlay & Error Handler */}
                <div style={{ position: "relative", height: 165, width: "100%", overflow: "hidden", background: "#0F172A" }}>
                  <img
                    src={safeCover}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = CURATED_STOCK_PHOTOS[idx % CURATED_STOCK_PHOTOS.length];
                    }}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(15,23,42,0.72) 0%, transparent 60%)" }} />

                  {/* Badges */}
                  <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6, flexWrap: "wrap", zIndex: 1 }}>
                    {course.isBestseller && (
                      <span style={{ background: "#F59E0B", color: "#FFFFFF", fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 6 }}>
                        BESTSELLER
                      </span>
                    )}
                    {course.isTrending && (
                      <span style={{ background: "#10B981", color: "#FFFFFF", fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 6 }}>
                        TRENDING
                      </span>
                    )}
                    <span style={{ background: "rgba(15,23,42,0.75)", backdropFilter: "blur(4px)", color: "#FFFFFF", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>
                      {course.level || "Intermediate"}
                    </span>
                  </div>

                  {/* Bookmark Button */}
                  <button
                    onClick={(e) => toggleLocalBookmark(e, course.id)}
                    style={{
                      position: "absolute", top: 12, right: 12, zIndex: 2,
                      width: 32, height: 32, borderRadius: "50%",
                      background: "rgba(15,23,42,0.65)", backdropFilter: "blur(4px)",
                      border: "none", display: "flex", alignItems: "center", justifyContent: "center",
                      color: isBookmarked ? "#EF4444" : "#FFFFFF", cursor: "pointer"
                    }}
                    title={isBookmarked ? "Remove Bookmark" : "Save Course"}
                  >
                    <Heart size={15} fill={isBookmarked ? "#EF4444" : "none"} />
                  </button>

                  {/* Progress Line */}
                  {isEnrolled && (
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 5, background: "rgba(255,255,255,0.3)", zIndex: 1 }}>
                      <div style={{ height: "100%", width: `${course.progress || 0}%`, background: isCompleted ? "#10B981" : "#2563EB" }} />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div style={{ padding: "18px 20px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>
                      {course.category || "TECH-PRENEUR"}
                    </div>

                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 8px", color: "var(--text)", lineHeight: 1.35 }}>
                      {course.title}
                    </h3>

                    <p style={{ fontSize: 12.5, color: "var(--text-3)", margin: "0 0 14px", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {course.description || "Master core competencies through hands-on learning modules, real-world case studies, and assessments."}
                    </p>

                    <div className="tai-row tai-gap8" style={{ marginBottom: 12 }}>
                      <img
                        src={course.instructorAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80"}
                        alt=""
                        style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }}
                      />
                      <div style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>
                        {course.instructor || "Astrid Larsson"}
                      </div>
                    </div>

                    <div className="tai-row tai-gap8" style={{ fontSize: 12, marginBottom: 16 }}>
                      <div className="tai-row tai-gap4" style={{ fontWeight: 800, color: "var(--text)" }}>
                        <Star size={14} fill="#F59E0B" color="#F59E0B" />
                        <span>{course.rating || "4.9"}</span>
                      </div>
                      <span style={{ color: "var(--text-3)" }}>({course.reviewsCount || 840})</span>
                      <span style={{ color: "var(--text-3)" }}>•</span>
                      <span style={{ color: "var(--text-3)", fontWeight: 600 }}>{course.studentsCount || "4.2k"} learners</span>
                    </div>
                  </div>

                  <div>
                    <div className="tai-row" style={{ padding: "10px 0", borderTop: "1px solid var(--border)", fontSize: 11.5, color: "var(--text-3)", fontWeight: 600, gap: 6, flexWrap: "wrap" }}>
                      <span>{course.hours || 12} Total Hours</span>
                      <span>•</span>
                      <span>{course.lessonsCount || 16} Modules</span>
                      <span>•</span>
                      <span>{course.hasCertificate ? "Verified Certificate" : "Audited"}</span>
                    </div>

                    {isEnrolled ? (
                      <div className="tai-row tai-between tai-mt8" style={{ alignItems: "center" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: isCompleted ? "var(--success)" : "var(--primary)" }}>
                          {isCompleted ? "Completed ✓" : `${course.progress}% Completed`}
                        </div>
                        <button
                          className="tai-btn tai-btn-primary tai-btn-sm"
                          style={{ padding: "8px 16px", borderRadius: 10 }}
                          onClick={(e) => { e.stopPropagation(); push("courseDetail", { id: course.id }); }}
                        >
                          {isCompleted ? "Review Material" : "Continue Lesson →"}
                        </button>
                      </div>
                    ) : (
                      <button
                        className="tai-btn tai-btn-primary tai-btn-sm tai-mt8"
                        style={{ width: "100%", padding: "9px 0", borderRadius: 10, fontWeight: 700 }}
                        onClick={(e) => { e.stopPropagation(); push("courseDetail", { id: course.id }); }}
                      >
                        Explore Syllabus &amp; Enroll →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* =========================================================================
          SPECIALIZATIONS & LIVE WORKSHOP STUDIO REPLAYS
          ========================================================================= */}
      <div>
        <div className="tai-row tai-between" style={{ marginBottom: 16 }}>
          <div>
            <div className="tai-row tai-gap8">
              <Award size={20} color="var(--primary)" />
              <h2 style={{ fontSize: 19, fontWeight: 900, letterSpacing: "-0.02em", margin: 0, color: "var(--text)" }}>
                Learning Pathways
              </h2>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-3)", margin: "4px 0 0" }}>
              Instructor-assigned multi-course learning pathways
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {SPECIALIZATIONS.map((spec) => (
            <div
              key={spec.id}
              className="tai-card tai-card-hover"
              onClick={() => setActiveSpecialization(spec)}
              style={{
                background: "var(--surface)",
                borderRadius: 10,
                border: "1px solid var(--border)",
                padding: 22,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 4px 16px rgba(15,23,42,0.04)",
                cursor: "pointer"
              }}
            >
              <div>
                <div className="tai-row tai-between" style={{ marginBottom: 12 }}>
                  <span style={{ background: spec.badgeBg, color: "#fff", fontSize: 10.5, fontWeight: 800, padding: "3px 10px", borderRadius: 6 }}>
                    {spec.badge}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)" }}>
                    {spec.coursesCount} Course Series
                  </span>
                </div>

                <h3 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 8px", color: "var(--text)", lineHeight: 1.3 }}>
                  {spec.title}
                </h3>

                <p style={{ fontSize: 13, color: "var(--text-3)", margin: "0 0 16px", lineHeight: 1.5 }}>
                  {spec.description}
                </p>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
                  {spec.skills.map((skill, idx) => (
                    <span key={idx} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-2)", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="tai-row tai-between" style={{ paddingTop: 14, borderTop: "1px solid var(--border)", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div className="tai-col">
                  <span style={{ fontSize: 11, color: "var(--text-3)" }}>Duration: {spec.months}</span>
                  <span className="tai-row tai-gap4" style={{ fontSize: 12, fontWeight: 800, color: "var(--text)" }}>
                    <Star size={13} fill="#F59E0B" color="#F59E0B" /> {spec.rating} ({spec.reviews})
                  </span>
                </div>

                <button
                  className="tai-btn tai-btn-outline tai-btn-sm"
                  style={{ fontWeight: 700 }}
                  onClick={(e) => { e.stopPropagation(); setActiveSpecialization(spec); }}
                >
                  View Pathway →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="tai-row tai-between" style={{ marginBottom: 16 }}>
          <div>
            <div className="tai-row tai-gap8">
              <Video size={20} color="var(--primary)" />
              <h2 style={{ fontSize: 19, fontWeight: 900, letterSpacing: "-0.02em", margin: 0, color: "var(--text)" }}>
                Live Workshop &amp; Studio Replays
              </h2>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-3)", margin: "4px 0 0" }}>
              Watch recorded breakdowns and live session workshops
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
          {RECENT_RECORDINGS.map((rec) => (
            <div
              key={rec.id}
              className="tai-card tai-card-hover"
              onClick={() => setActiveRecording(rec)}
              style={{
                background: "var(--surface)",
                borderRadius: 10,
                border: "1px solid var(--border)",
                overflow: "hidden",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column"
              }}
            >
              <div style={{ position: "relative", height: 140, width: "100%", overflow: "hidden" }}>
                <img src={rec.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                    <Play size={15} color="var(--primary)" fill="var(--primary)" style={{ marginLeft: 2 }} />
                  </div>
                </div>
                <span style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.8)", color: "#fff", fontSize: 10.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>
                  {rec.duration}
                </span>
              </div>

              <div style={{ padding: 14, flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <h4 style={{ fontSize: 13.5, fontWeight: 800, margin: "0 0 4px", color: "var(--text)", lineHeight: 1.35 }}>
                    {rec.title}
                  </h4>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                    {rec.instructor} • {rec.role}
                  </div>
                </div>

                <div className="tai-row tai-between" style={{ marginTop: 10, fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>
                  <span>{rec.date}</span>
                  <span>{rec.views}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Video Player Modal */}
      {activeRecording && (
        <PortalModal isOpen={true} onClose={() => setActiveRecording(null)} title={activeRecording.title}>
          <div style={{ padding: "6px 0" }}>
            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, background: "#000", borderRadius: 8, overflow: "hidden", marginBottom: 14 }}>
              <iframe
                title={activeRecording.title}
                src={activeRecording.videoUrl}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                Instructor: <strong>{activeRecording.instructor}</strong> ({activeRecording.role})
              </div>
              <button
                className="tai-btn tai-btn-primary tai-btn-sm"
                onClick={() => { setActiveRecording(null); push("courseDetail", { id: "course-figma-ai" }); }}
              >
                Enroll in Track →
              </button>
            </div>
          </div>
        </PortalModal>
      )}

      {/* Specialization Modal */}
      {activeSpecialization && (
        <PortalModal isOpen={true} onClose={() => setActiveSpecialization(null)} title={activeSpecialization.title}>
          <div style={{ padding: "6px 0" }}>
            <p style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.55, margin: "0 0 16px" }}>
              {activeSpecialization.description}
            </p>

            <div style={{ background: "var(--surface-2)", padding: 14, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 8 }}>
                Competencies Covered ({activeSpecialization.skills.length})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {activeSpecialization.skills.map((s, idx) => (
                  <span key={idx} style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text)", background: "var(--surface)", padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)" }}>
                    ✓ {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="tai-row tai-between" style={{ alignItems: "center", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>Duration: <strong>{activeSpecialization.months}</strong></span>
              <button
                className="tai-btn tai-btn-primary tai-btn-sm"
                onClick={() => { setActiveSpecialization(null); push("courseDetail", { id: "course-figma-ai" }); }}
              >
                Enroll in Specialization →
              </button>
            </div>
          </div>
        </PortalModal>
      )}

    </div>
  );
}

export default CoursesScreen;
