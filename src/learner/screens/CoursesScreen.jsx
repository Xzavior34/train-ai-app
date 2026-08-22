import React, { useState, useEffect } from "react";
import { TopBar, CourseCard, ProgressBar, Tag } from "../components/LearnerUI.jsx";
import {
  Search, Play, Clock, Sparkles, Video, Eye,
  ArrowRight, ExternalLink, Bookmark, CheckCircle2,
  Calendar, Layers, Filter, X, Star, Award, Users,
  BookOpen, ChevronRight, ChevronLeft, TrendingUp, ShieldCheck, Heart,
  Flame, Zap, Laptop, FileText, Check
} from "lucide-react";
import { PortalModal } from "../../components/common/PortalModal.jsx";
import { isMockDataEnabled, subscribeToMockDataChanges } from "../../lib/mockDataManager.js";

const CATEGORIES = [
  { id: "all", label: "All Topics" },
  { id: "ai", label: "AI & Prompt Engineering" },
  { id: "design", label: "UI/UX & Design Systems" },
  { id: "engineering", label: "Full-Stack & Web Dev" },
  { id: "data", label: "Data Science & Python" },
  { id: "cloud", label: "Cloud & DevOps" },
  { id: "product", label: "Product & Strategy" },
];

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
    badgeBg: "linear-gradient(135deg, #4F46E5, #7C3AED)",
    description: "Master modern AI design workflows, generative prototyping, vector tokens, and spatial interfaces with direct industry credentialing.",
    skills: ["Figma AI", "Design Systems", "Spatial UI", "Token Architecture", "UX Research"],
    image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=80"
  },
  {
    id: "spec-2",
    title: "Full-Stack Generative AI Application Engineering",
    provider: "Train AI Engineering Labs • Anthropic",
    coursesCount: 5,
    months: "4 Months (8 hrs/week)",
    rating: 4.9,
    reviews: "2,890",
    level: "Advanced",
    badge: "CAREER TRACK",
    badgeBg: "linear-gradient(135deg, #059669, #10B981)",
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
    badgeColor: "#4F46E5"
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
    badgeColor: "#7C3AED"
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

function groupByStatus(enrolledCourses) {
  const inProgress = [];
  const notStarted = [];
  const completed = [];
  for (const c of enrolledCourses) {
    const p = c.progress ?? 0;
    if (p >= 100) completed.push(c);
    else if (p > 0) inProgress.push(c);
    else notStarted.push(c);
  }
  return { inProgress, notStarted, completed };
}

function CourseGroup({ label, items, push, onToggleBookmark, onEnroll }) {
  if (items.length === 0) return null;
  return (
    <div className="tai-mt16">
      <div className="tai-row tai-between" style={{ marginBottom: 10 }}>
        <div className="tai-title-sm" style={{ fontSize: 16, fontWeight: 800, color: "var(--text)" }}>{label}</div>
        <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 700 }}>{items.length} Course{items.length === 1 ? "" : "s"}</span>
      </div>
      <div className="tai-col tai-gap14">
        {items.map((c) => (
          <CourseCard
            key={c.id}
            course={c}
            onClick={() => push("courseDetail", { id: c.id })}
            onToggleBookmark={onToggleBookmark}
            onEnroll={onEnroll}
          />
        ))}
      </div>
    </div>
  );
}

export function CoursesScreen({
  courses = [], coursesLoading, courseSearch = "", setCourseSearch,
  courseLevelFilter = "all", setCourseLevelFilter, courseSourceTab = "all", setCourseSourceTab,
  showMyCoursesOnly = false, setShowMyCoursesOnly, push, handleEnroll, handleRequestJoin,
  onToggleBookmark
}) {
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

  function handleCardAction(courseId) {
    const course = allAvailableCourses.find(c => c.id === courseId);
    if (course?.requiresApproval) return handleRequestJoin && handleRequestJoin(courseId);
    if (handleEnroll) return handleEnroll(courseId);
  }

  const defaultCourses = [
    {
      id: "course-figma-ai",
      title: "Master Design Systems in Figma with AI",
      category: "UI/UX & Design Systems",
      level: "Intermediate",
      description: "Build robust, scalable enterprise design systems using Figma variables, token architecture, auto-layout 5.0, and generative AI UI plugins.",
      instructor: "Astrid Larsson",
      instructorRole: "Lead Design Systems Architect",
      instructorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
      rating: 4.9,
      reviewsCount: 1840,
      studentsCount: "12.4k",
      hours: 18,
      lessonsCount: 24,
      projectsCount: 4,
      isBestseller: true,
      hasCertificate: true,
      enrolled: true,
      assigned: true,
      source: "assigned",
      partner: "Figma Official",
      progress: 72,
      coverImageUrl: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80"
    },
    {
      id: "course-fullstack-ai",
      title: "Full-Stack AI Application Engineering",
      category: "Full-Stack & Web Dev",
      level: "Advanced",
      description: "Architect and deploy end-to-end multi-agent applications with Python FastAPI backends, LangChain orchestration, and React 19.",
      instructor: "Alex Rivera",
      instructorRole: "Principal AI Engineer",
      instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
      rating: 4.9,
      reviewsCount: 2150,
      studentsCount: "18.2k",
      hours: 26,
      lessonsCount: 32,
      projectsCount: 6,
      isBestseller: true,
      hasCertificate: true,
      enrolled: false,
      assigned: false,
      source: "internal",
      isInternal: true,
      progress: 0,
      coverImageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80"
    },
    {
      id: "course-prompt-pro",
      title: "Prompt Engineering & LLM Architecture",
      category: "AI & Prompt Engineering",
      level: "Beginner",
      description: "Master zero-shot, few-shot, chain-of-thought prompting, function calling schemas, and automated model evaluations.",
      instructor: "Elena Rostova",
      instructorRole: "AI Alignment Lead",
      instructorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
      rating: 4.8,
      reviewsCount: 980,
      studentsCount: "8.6k",
      hours: 12,
      lessonsCount: 16,
      projectsCount: 3,
      isTrending: true,
      hasCertificate: true,
      enrolled: true,
      assigned: true,
      source: "assigned",
      partner: "Anthropic / OpenAI",
      progress: 100,
      coverImageUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80"
    },
    {
      id: "course-cloud-devops",
      title: "Cloud Native Microservices & Kubernetes",
      category: "Cloud & DevOps",
      level: "Intermediate",
      description: "Containerize scalable services with Docker, manage Kubernetes clusters on Google Cloud, and set up automated CI/CD deployment pipelines.",
      instructor: "David Vance",
      instructorRole: "DevOps Infrastructure Lead",
      instructorAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
      rating: 4.9,
      reviewsCount: 1420,
      studentsCount: "9.3k",
      hours: 22,
      lessonsCount: 28,
      projectsCount: 5,
      hasCertificate: true,
      enrolled: false,
      assigned: false,
      source: "partner",
      partner: "Google Cloud",
      progress: 0,
      coverImageUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80"
    },
    {
      id: "course-spatial-ui",
      title: "Spatial Computing & VisionOS Design Foundations",
      category: "UI/UX & Design Systems",
      level: "Advanced",
      description: "Design immersive 3D spatial user experiences, depth layering, eye-tracking ergonomics, and glassmorphism interface tokens.",
      instructor: "Sarah Connor",
      instructorRole: "Spatial Experience Designer",
      instructorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
      rating: 5.0,
      reviewsCount: 640,
      studentsCount: "4.1k",
      hours: 14,
      lessonsCount: 18,
      projectsCount: 3,
      isTrending: true,
      hasCertificate: true,
      enrolled: false,
      assigned: false,
      source: "partner",
      partner: "Apple VisionOS",
      progress: 0,
      coverImageUrl: "https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?w=800&auto=format&fit=crop&q=80"
    },
    {
      id: "course-product-metrics",
      title: "Data-Driven Product Management & Growth",
      category: "Product & Strategy",
      level: "Intermediate",
      description: "Leverage cohort analytics, A/B experimentation, retention mechanics, and product-led growth loops to scale digital platforms.",
      instructor: "Marcus Wright",
      instructorRole: "VP of Product Strategy",
      instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
      rating: 4.8,
      reviewsCount: 1120,
      studentsCount: "7.8k",
      hours: 16,
      lessonsCount: 20,
      projectsCount: 4,
      hasCertificate: true,
      enrolled: false,
      assigned: false,
      source: "internal",
      isInternal: true,
      progress: 0,
      coverImageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80"
    },
    {
      id: "course-python-data",
      title: "Data Science, Pandas & Predictive Machine Learning",
      category: "Data Science & Python",
      level: "Intermediate",
      description: "Perform exploratory data analysis, feature engineering, predictive regression modeling, and statistical visualizations in Jupyter.",
      instructor: "Dr. Maya Lin",
      instructorRole: "Senior Data Scientist",
      instructorAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80",
      rating: 4.9,
      reviewsCount: 1680,
      studentsCount: "11.5k",
      hours: 24,
      lessonsCount: 26,
      projectsCount: 5,
      isBestseller: true,
      hasCertificate: true,
      enrolled: false,
      assigned: false,
      source: "partner",
      partner: "NumPy & SciPy Foundation",
      progress: 0,
      coverImageUrl: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80"
    },
    {
      id: "course-rag-graphs",
      title: "Enterprise RAG, Vector Search & Knowledge Graphs",
      category: "AI & Prompt Engineering",
      level: "Advanced",
      description: "Build semantic search indices, hybrid BM25 / vector retrieval, re-ranking pipelines, and graph-augmented generative answer engines.",
      instructor: "Alex Rivera",
      instructorRole: "Principal AI Engineer",
      instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
      rating: 5.0,
      reviewsCount: 890,
      studentsCount: "6.2k",
      hours: 20,
      lessonsCount: 22,
      projectsCount: 4,
      isTrending: true,
      hasCertificate: true,
      enrolled: false,
      assigned: false,
      source: "internal",
      isInternal: true,
      progress: 0,
      coverImageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80"
    },
    {
      id: "course-motion-ui",
      title: "Micro-Interactions, Motion Design & UI Prototyping",
      category: "UI/UX & Design Systems",
      level: "Beginner",
      description: "Craft buttery-smooth physics-based gestures, spring easing curves, interactive micro-animations, and After Effects UI handoffs.",
      instructor: "Astrid Larsson",
      instructorRole: "Lead Design Systems Architect",
      instructorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
      rating: 4.9,
      reviewsCount: 1350,
      studentsCount: "8.9k",
      hours: 14,
      lessonsCount: 18,
      projectsCount: 3,
      hasCertificate: true,
      enrolled: false,
      assigned: false,
      source: "partner",
      partner: "Lottie & MotionLab",
      progress: 0,
      coverImageUrl: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=800&auto=format&fit=crop&q=80"
    }
  ];

  const allAvailableCourses = (() => {
    if (!mockEnabled) {
      return courses || [];
    }
    if (courses && courses.length > 0) {
      return courses.map((c, idx) => {
        const fallback = defaultCourses[idx % defaultCourses.length];
        return {
          ...fallback,
          ...c,
          coverImageUrl: c.coverImageUrl || fallback.coverImageUrl,
          rating: c.rating || fallback.rating,
          reviewsCount: c.reviewsCount || fallback.reviewsCount,
          studentsCount: c.studentsCount || fallback.studentsCount,
          hours: c.hours || fallback.hours,
          lessonsCount: c.lessonsCount || fallback.lessonsCount,
          instructor: c.instructor || fallback.instructor,
          instructorRole: c.instructorRole || fallback.instructorRole,
          instructorAvatar: c.instructorAvatar || fallback.instructorAvatar
        };
      });
    }
    return defaultCourses;
  })();

  const enrolledList = allAvailableCourses.filter(c => c.enrolled);

  // "My Courses" Mode
  if (showMyCoursesOnly) {
    const { inProgress, notStarted, completed } = groupByStatus(enrolledList);
    return (
      <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <TopBar title="My Courses & Enrolled Tracks" sub="Every course assigned to you, and where you left off" />
        
        <div className="tai-row tai-between tai-mt14" style={{ fontSize: 13, color: "var(--text-2)", alignItems: "center" }}>
          <span style={{ fontWeight: 700 }}>{enrolledList.length} course{enrolledList.length === 1 ? "" : "s"} total enrolled</span>
          <button
            className="tai-btn tai-btn-outline tai-btn-sm"
            onClick={() => setShowMyCoursesOnly(false)}
          >
            ← Browse Full Catalog
          </button>
        </div>

        {coursesLoading && <div className="tai-card tai-empty">Loading your courses...</div>}
        {!coursesLoading && enrolledList.length === 0 && (
          <div className="tai-card tai-empty" style={{ padding: "40px 20px", textAlign: "center" }}>
            <BookOpen size={32} color="var(--primary)" style={{ margin: "0 auto 12px" }} />
            <h3 style={{ fontSize: 17, fontWeight: 800, color: "var(--text)", margin: "0 0 6px" }}>No Courses Enrolled Yet</h3>
            <p style={{ fontSize: 13, color: "var(--text-3)", maxWidth: 360, margin: "0 auto 16px" }}>
              Explore the catalog to discover masterclasses in AI, UX, Cloud, and Engineering.
            </p>
            <button className="tai-btn tai-btn-primary" onClick={() => setShowMyCoursesOnly(false)}>
              Explore Course Catalog →
            </button>
          </div>
        )}

        <CourseGroup label="In Progress (Continue Learning)" items={inProgress} push={push} onToggleBookmark={toggleLocalBookmark} onEnroll={handleCardAction} />
        <CourseGroup label="Assigned & Not Started" items={notStarted} push={push} onToggleBookmark={toggleLocalBookmark} onEnroll={handleCardAction} />
        <CourseGroup label="Completed Masterclasses" items={completed} push={push} onToggleBookmark={toggleLocalBookmark} onEnroll={handleCardAction} />
      </div>
    );
  }

  // Catalog Browse Mode
  const EXTERNAL_COURSE_LIMIT = 5;

  const filteredCatalogUnsorted = allAvailableCourses.filter(c => {
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
      const matchPartner = c.partner?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchCat && !matchInst && !matchPartner) return false;
    }
    if (selectedCategory !== "all") {
      const catObj = CATEGORIES.find(cat => cat.id === selectedCategory);
      if (catObj && !c.category?.toLowerCase().includes(catObj.label.split(" ")[0].toLowerCase())) {
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

  const filteredCatalog = courseSourceTab === "partners"
    ? filteredCatalogUnsorted.slice(0, EXTERNAL_COURSE_LIMIT)
    : filteredCatalogUnsorted;

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      {/* Top Header */}
      <TopBar
        title="Course Catalog & Masterclasses"
        sub="Explore curated curriculum, industry specializations, and studio sessions"
      />

      {/* Filter Tabs & Search Bar Strip */}
      <div className="tai-card" style={{ padding: "16px 18px", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)" }}>
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
              const isActive = courseSourceTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCourseSourceTab(tab.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 16px",
                    borderRadius: 12,
                    border: isActive ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                    background: isActive ? "var(--primary)" : "var(--surface-2)",
                    color: isActive ? "#FFFFFF" : "var(--text)",
                    fontWeight: isActive ? 800 : 600,
                    fontSize: 13,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    boxShadow: isActive ? "0 4px 12px rgba(79, 70, 229, 0.25)" : "none"
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

          {/* Search + Sort */}
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
                  borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--surface-2)",
                  fontSize: 13.5, color: "var(--text)", outline: "none"
                }}
              />
            </div>

            <div className="tai-row tai-gap10" style={{ flexShrink: 0 }}>
              <button
                className="tai-btn tai-btn-outline tai-btn-sm"
                onClick={() => setShowMyCoursesOnly(true)}
                style={{ height: 42, padding: "0 16px", borderRadius: 12, fontWeight: 700, whiteSpace: "nowrap" }}
              >
                My Enrolled ({enrolledList.length}) →
              </button>
            </div>
          </div>

          {/* Categories Pills */}
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

      {/* Courses Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
        {filteredCatalog.length === 0 ? (
          <div className="tai-card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "48px 24px", borderRadius: 20 }}>
            <div style={{ width: 60, height: 60, borderRadius: 20, background: "var(--primary-tint)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
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
                setCourseSourceTab("all");
                setCourseSearch("");
                setSelectedCategory("all");
              }}
            >
              Browse All Courses →
            </button>
          </div>
        ) : (
          filteredCatalog.map((course) => {
            const isEnrolled = course.enrolled;
            const isCompleted = course.progress === 100;
            const isBookmarked = !!bookmarkedIds[course.id];

            return (
              <div
                key={course.id}
                className="tai-card-hover"
                onClick={() => push("courseDetail", { id: course.id })}
                style={{
                  background: "var(--surface)",
                  borderRadius: 18,
                  border: "1px solid var(--border)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  cursor: "pointer",
                  boxShadow: "0 2px 10px rgba(15,23,42,0.04)"
                }}
              >
                {/* Thumbnail Image */}
                <div style={{ position: "relative", height: 165, width: "100%", overflow: "hidden" }}>
                  <img
                    src={course.coverImageUrl}
                    alt={course.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(15,23,42,0.7) 0%, transparent 60%)" }} />

                  {/* Badges */}
                  <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
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
                      position: "absolute", top: 12, right: 12,
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
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 5, background: "rgba(255,255,255,0.3)" }}>
                      <div style={{ height: "100%", width: `${course.progress || 0}%`, background: isCompleted ? "#10B981" : "#4F46E5" }} />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div style={{ padding: "18px 20px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: ".03em", marginBottom: 6 }}>
                      {course.category}
                    </div>

                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 8px", color: "var(--text)", lineHeight: 1.35 }}>
                      {course.title}
                    </h3>

                    <p style={{ fontSize: 12.5, color: "var(--text-3)", margin: "0 0 14px", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {course.description}
                    </p>

                    <div className="tai-row tai-gap8" style={{ marginBottom: 12 }}>
                      <img
                        src={course.instructorAvatar}
                        alt={course.instructor}
                        style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }}
                      />
                      <div style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>
                        {course.instructor}
                      </div>
                    </div>

                    <div className="tai-row tai-gap8" style={{ fontSize: 12, marginBottom: 16 }}>
                      <div className="tai-row tai-gap4" style={{ fontWeight: 800, color: "var(--text)" }}>
                        <Star size={14} fill="#F59E0B" color="#F59E0B" />
                        <span>{course.rating}</span>
                      </div>
                      <span style={{ color: "var(--text-3)" }}>({course.reviewsCount || 0})</span>
                      <span style={{ color: "var(--text-3)" }}>•</span>
                      <span style={{ color: "var(--text-3)", fontWeight: 600 }}>{course.studentsCount || "0"} learners</span>
                    </div>
                  </div>

                  <div>
                    <div className="tai-row" style={{ padding: "10px 0", borderTop: "1px solid var(--border)", fontSize: 11.5, color: "var(--text-3)", fontWeight: 600, gap: 6, flexWrap: "wrap" }}>
                      <span>{course.hours} Total Hours</span>
                      <span>•</span>
                      <span>{course.lessonsCount} Modules</span>
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

      {/* Specializations & Workshops Section */}
      {mockEnabled && (
        <>
          <div>
            <div className="tai-row tai-between" style={{ marginBottom: 16 }}>
              <div>
                <div className="tai-row tai-gap8">
                  <Award size={20} color="var(--primary)" />
                  <h2 style={{ fontSize: 19, fontWeight: 900, letterSpacing: "-0.02em", margin: 0, color: "var(--text)" }}>
                    Professional Certificates &amp; Specializations
                  </h2>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-3)", margin: "4px 0 0" }}>
                  Comprehensive multi-course career tracks accredited by Train AI
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
                    borderRadius: 18,
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
                      View Track Details →
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
                    borderRadius: 16,
                    border: "1px solid var(--border)",
                    overflow: "hidden",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column"
                  }}
                >
                  <div style={{ position: "relative", height: 140, width: "100%", overflow: "hidden" }}>
                    <img src={rec.thumbnail} alt={rec.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
        </>
      )}

      {/* Video Player Modal */}
      {activeRecording && (
        <PortalModal isOpen={true} onClose={() => setActiveRecording(null)} title={activeRecording.title}>
          <div style={{ padding: "6px 0" }}>
            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, background: "#000", borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
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

            <div style={{ background: "var(--surface-2)", padding: 14, borderRadius: 12, marginBottom: 16 }}>
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
