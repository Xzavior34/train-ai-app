import React, { useState, useEffect } from "react";
import { CourseCard, ProgressBar, Tag } from "../components/LearnerUI.jsx";
import {
  Search, Play, Clock, Sparkles, Video, Eye,
  ArrowRight, ExternalLink, Bookmark, CheckCircle2,
  Calendar, Layers, Filter, X, Star, Award, Users,
  BookOpen, ChevronRight, ChevronLeft, TrendingUp, ShieldCheck, Heart,
  Flame, Zap, Laptop, FileText, Check
} from "lucide-react";
import { PortalModal } from "../../components/common/PortalModal.jsx";

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
    provider: "Train AI Academy",
    partnerLogo: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80",
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
    provider: "Train AI Engineering Labs",
    partnerLogo: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=100&auto=format&fit=crop&q=80",
    coursesCount: 5,
    months: "4 Months (8 hrs/week)",
    rating: 4.9,
    reviews: "2,890",
    level: "Advanced",
    badge: "CAREER TRACK",
    badgeBg: "linear-gradient(135deg, #059669, #10B981)",
    description: "Build production-ready multi-modal AI agents, vector database backends, RAG pipelines, and reactive enterprise apps.",
    skills: ["LangChain", "Vector DBs", "FastAPI", "React", "OpenAI / Gemini APIs"],
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
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
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
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
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
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
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
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    badge: "PROTOTYPING",
    badgeColor: "#059669"
  }
];

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

  function toggleLocalBookmark(e, courseId) {
    e.stopPropagation();
    setBookmarkedIds(prev => ({ ...prev, [courseId]: !prev[courseId] }));
    onToggleBookmark?.(courseId);
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
      description: "Architect and deploy end-to-end multi-agent applications with Python FastAPI backends, LangChain orchestration, and React frontends.",
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
    }
  ];

  const allAvailableCourses = (courses && courses.length > 0) ? courses.map((c, idx) => {
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
  }) : defaultCourses;

  const enrolledList = allAvailableCourses.filter(c => c.enrolled);

  const filteredCatalog = allAvailableCourses.filter(c => {
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
      const matchPartner = c.partner?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchCat && !matchInst && !matchPartner) return false;
    }
    if (courseLevelFilter !== "all" && c.level?.toLowerCase() !== courseLevelFilter.toLowerCase()) return false;
    if (selectedCategory !== "all") {
      const catObj = CATEGORIES.find(cat => cat.id === selectedCategory);
      if (catObj && !c.category?.toLowerCase().includes(catObj.label.split(" ")[0].toLowerCase())) {
        return false;
      }
    }
    return true;
  });

  // Dynamic Moving Multi-Course Spotlight Carousel
  const SPOTLIGHT_SLIDES = [
    {
      id: "course-figma-ai",
      badge: "ENROLLED • SPRINT 5",
      badgeGradient: "linear-gradient(135deg, #10B981, #059669)",
      cohortTag: "Spring Cohort 2026",
      title: "Master Design Systems in Figma with Generative AI",
      description: "Building production design systems, auto-layout 5.0, design tokens, and AI acceleration for enterprise design teams.",
      rating: 4.9,
      reviews: "1,840 reviews",
      enrolled: "12,400+ Enrolled",
      status: "In Progress",
      progress: 72,
      lessonsRemaining: "4 lessons left",
      instructor: "Astrid Larsson",
      instructorRole: "Lead Design Systems Architect",
      instructorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
      coverImage: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80",
      cta: "Resume Lesson 14",
      action: "continue",
      lessonsText: "24 Lessons • 18 hrs"
    },
    {
      id: "course-fullstack-ai",
      badge: "ACTIVE MULTI-COURSE LEARNING",
      badgeGradient: "linear-gradient(135deg, #6366F1, #4F46E5)",
      cohortTag: "Advanced Engineering Track",
      title: "Full-Stack AI Application Engineering with React 19",
      description: "Architecting end-to-end LLM applications with vector embeddings, Supabase pgvector, FastAPI, and autonomous agents.",
      rating: 4.9,
      reviews: "2,150 reviews",
      enrolled: "8,900+ Enrolled",
      status: "In Progress",
      progress: 19,
      lessonsRemaining: "Module 2: Function Calling",
      instructor: "Alex Rivera",
      instructorRole: "Principal AI Engineer",
      instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
      coverImage: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
      cta: "Continue Module 2",
      action: "continue",
      lessonsText: "32 Lessons • 24 hrs"
    },
    {
      id: "course-spatial-ui",
      badge: "NEW MASTERCLASS SPOTLIGHT",
      badgeGradient: "linear-gradient(135deg, #EC4899, #8B5CF6)",
      cohortTag: "Executive Masterclass",
      title: "Spatial Computing & VisionOS Design Foundations",
      description: "Immersive 3D spatial user experiences, depth layering, glassmorphism tokens, and spatial ergonomics for next-gen apps.",
      rating: 5.0,
      reviews: "640 reviews",
      enrolled: "4,100+ Enrolled",
      status: "Featured Masterclass",
      progress: 0,
      lessonsRemaining: "Includes 3D Asset Kit",
      instructor: "Sarah Connor",
      instructorRole: "Spatial Experience Designer",
      instructorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
      coverImage: "https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?w=800&auto=format&fit=crop&q=80",
      cta: "Explore Masterclass",
      action: "explore",
      lessonsText: "18 Lessons • 14 hrs"
    },
    {
      id: "course-cloud-devops",
      badge: "TRENDING IN YOUR COHORT",
      badgeGradient: "linear-gradient(135deg, #F59E0B, #D97706)",
      cohortTag: "Infrastructure Batch",
      title: "Cloud Infrastructure, Kubernetes & AI Microservices",
      description: "Production CI/CD pipelines, container orchestration, edge deployment, and GPU scaling for high-throughput AI workloads.",
      rating: 4.9,
      reviews: "1,420 reviews",
      enrolled: "9,300+ Enrolled",
      status: "Recommended",
      progress: 0,
      lessonsRemaining: "Hands-on Cloud Lab",
      instructor: "Marcus Vance",
      instructorRole: "DevOps Infrastructure Lead",
      instructorAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
      coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80",
      cta: "Start Learning Path",
      action: "explore",
      lessonsText: "28 Lessons • 22 hrs"
    }
  ];

  const [activeSlide, setActiveSlide] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  useEffect(() => {
    if (isCarouselPaused) return;
    const interval = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % SPOTLIGHT_SLIDES.length);
    }, 4800);
    return () => clearInterval(interval);
  }, [isCarouselPaused]);

  const currentSpotlight = SPOTLIGHT_SLIDES[activeSlide];

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      
      {/* =========================================================================
          DYNAMIC MOVING SPOTLIGHT CAROUSEL (Multi-Course Learning Simulation)
          ========================================================================= */}
      <div
        onMouseEnter={() => setIsCarouselPaused(true)}
        onMouseLeave={() => setIsCarouselPaused(false)}
        style={{
          position: "relative",
          borderRadius: 20,
          overflow: "hidden",
          background: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #312E81 100%)",
          color: "#FFFFFF",
          padding: "clamp(18px, 3vw, 26px)",
          boxShadow: "0 14px 34px -6px rgba(15, 23, 42, 0.4)",
          border: "1px solid rgba(99, 102, 241, 0.35)",
          transition: "all 0.3s ease"
        }}
      >
        {/* Hero Background Cover Image with Dark Overlay */}
        <img
          key={currentSpotlight.id + "-bg"}
          src={currentSpotlight.coverImage}
          alt=""
          className="tai-fade-in"
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", opacity: 0.28, zIndex: 0
          }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(100deg, rgba(15,23,42,0.96) 0%, rgba(30,27,75,0.85) 55%, rgba(15,23,42,0.7) 100%)",
          zIndex: 0
        }} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, alignItems: "center", position: "relative", zIndex: 1 }}>
          
          {/* Left Column: Course details */}
          <div>
            <div className="tai-row tai-between" style={{ marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <div className="tai-row tai-gap8">
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", fontWeight: 800, background: "rgba(99, 102, 241, 0.3)", padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(99, 102, 241, 0.4)" }}>
                  {currentSpotlight.cohortTag} • {currentSpotlight.badge}
                </span>
              </div>

              {/* Slide Counter & Arrow Controls */}
              <div className="tai-row tai-gap6">
                <button
                  aria-label="Previous Slide"
                  onClick={() => setActiveSlide(prev => (prev - 1 + SPOTLIGHT_SLIDES.length) % SPOTLIGHT_SLIDES.length)}
                  style={{
                    width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)",
                    background: "rgba(255,255,255,0.1)", color: "#fff", display: "flex", alignItems: "center",
                    justifyContent: "center", cursor: "pointer", backdropFilter: "blur(6px)"
                  }}
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  aria-label="Next Slide"
                  onClick={() => setActiveSlide(prev => (prev + 1) % SPOTLIGHT_SLIDES.length)}
                  style={{
                    width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)",
                    background: "rgba(255,255,255,0.1)", color: "#fff", display: "flex", alignItems: "center",
                    justifyContent: "center", cursor: "pointer", backdropFilter: "blur(6px)"
                  }}
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

            <h1 key={currentSpotlight.id + "-title"} className="tai-fade-in" style={{ fontSize: "clamp(18px, 2.4vw, 24px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 8px", lineHeight: 1.25 }}>
              {currentSpotlight.title}
            </h1>

            <p key={currentSpotlight.id + "-desc"} className="tai-fade-in" style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", margin: "0 0 14px", lineHeight: 1.45, maxWidth: 540 }}>
              {currentSpotlight.description}
            </p>

            {/* In-Progress Track Bar if user is enrolled */}
            {currentSpotlight.progress > 0 && (
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", marginBottom: 14 }}>
                <div className="tai-row tai-between" style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 5, color: "#E0E7FF" }}>
                  <span>Active Sprint Pace</span>
                  <span style={{ color: "#34D399", fontWeight: 800 }}>{currentSpotlight.progress}% ({currentSpotlight.lessonsRemaining})</span>
                </div>
                <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.2)", overflow: "hidden" }}>
                  <div style={{ width: `${currentSpotlight.progress}%`, height: "100%", background: "linear-gradient(90deg, #10B981, #6366F1)", borderRadius: 99 }} />
                </div>
              </div>
            )}

            <div className="tai-row tai-gap12" style={{ flexWrap: "wrap", marginBottom: 16, fontSize: 12 }}>
              <div className="tai-row tai-gap4">
                <Star size={13} fill="#F59E0B" color="#F59E0B" />
                <span style={{ fontWeight: 800 }}>{currentSpotlight.rating}</span>
                <span style={{ opacity: 0.75 }}>({currentSpotlight.reviews})</span>
              </div>
              <span>•</span>
              <div className="tai-row tai-gap4">
                <Users size={13} color="#818CF8" />
                <span style={{ fontWeight: 700 }}>{currentSpotlight.enrolled}</span>
              </div>
              <span>•</span>
              <div className="tai-row tai-gap4">
                <ShieldCheck size={13} color="#34D399" />
                <span style={{ fontWeight: 700 }}>Certificate</span>
              </div>
            </div>

            <div className="tai-row tai-gap10" style={{ flexWrap: "wrap" }}>
              <button
                className="tai-btn"
                style={{
                  background: "#4F46E5", color: "#FFFFFF", fontWeight: 800,
                  padding: "10px 18px", borderRadius: 10, border: "none", fontSize: 13,
                  boxShadow: "0 6px 20px rgba(79, 70, 229, 0.4)",
                  display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer"
                }}
                onClick={() => push("courseDetail", { id: currentSpotlight.id })}
              >
                <span>{currentSpotlight.cta}</span>
                <ArrowRight size={15} />
              </button>

              <button
                className="tai-btn"
                style={{
                  background: "rgba(255,255,255,0.1)", color: "#FFFFFF", fontWeight: 700,
                  padding: "10px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", fontSize: 13,
                  display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
                  backdropFilter: "blur(8px)"
                }}
                onClick={() => setActiveRecording(RECENT_RECORDINGS[0])}
              >
                <Play size={14} fill="#fff" />
                <span>Watch Trailer</span>
              </button>
            </div>
          </div>

          {/* Right Column: Visual Cover & Multi-Track Carousel switcher (Desktop Only) */}
          <div className="tai-desktop-only" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", boxShadow: "0 12px 30px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.18)" }}>
              <img
                key={currentSpotlight.id + "-img"}
                src={currentSpotlight.coverImage}
                alt={currentSpotlight.title}
                className="tai-fade-in"
                style={{ width: "100%", height: 210, objectFit: "cover", display: "block" }}
              />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(15,23,42,0.88) 0%, transparent 60%)" }} />
              
              <div style={{ position: "absolute", bottom: 14, left: 16, right: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="tai-row tai-gap10">
                  <img
                    src={currentSpotlight.instructorAvatar}
                    alt={currentSpotlight.instructor}
                    style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid #fff", objectFit: "cover" }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{currentSpotlight.instructor}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>{currentSpotlight.instructorRole}</div>
                  </div>
                </div>

                <span style={{ background: "rgba(0,0,0,0.6)", padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, border: "1px solid rgba(255,255,255,0.2)" }}>
                  {currentSpotlight.lessonsText}
                </span>
              </div>
            </div>

            {/* Interactive Multi-Course Quick Switcher Tabs */}
            <div className="tai-scrollx tai-gap8" style={{ paddingBottom: 2, width: "100%", boxSizing: "border-box" }}>
              {SPOTLIGHT_SLIDES.map((slide, idx) => {
                const isSelected = idx === activeSlide;
                return (
                  <button
                    key={slide.id}
                    onClick={() => setActiveSlide(idx)}
                    style={{
                      flex: 1, minWidth: 120, padding: "8px 10px",
                      borderRadius: 10,
                      border: isSelected ? "1.5px solid #818CF8" : "1px solid rgba(255,255,255,0.15)",
                      background: isSelected ? "rgba(99, 102, 241, 0.3)" : "rgba(255,255,255,0.06)",
                      color: isSelected ? "#FFFFFF" : "rgba(255,255,255,0.7)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 800, color: isSelected ? "#A5B4FC" : "rgba(255,255,255,0.5)" }}>
                      TRACK {idx + 1}
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {slide.title.split(" in ")[0].split(" with ")[0]}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Carousel Dot Indicators */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          {SPOTLIGHT_SLIDES.map((_, idx) => (
            <button
              key={idx}
              aria-label={`Go to slide ${idx + 1}`}
              onClick={() => setActiveSlide(idx)}
              style={{
                width: idx === activeSlide ? 24 : 8,
                height: 8,
                borderRadius: 99,
                background: idx === activeSlide ? "#818CF8" : "rgba(255,255,255,0.3)",
                border: "none",
                cursor: "pointer",
                padding: 0,
                transition: "all 0.25s ease"
              }}
            />
          ))}
        </div>
      </div>

      <div className="tai-col tai-gap16">
        
        <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 14 }}>
          <div className="tai-row tai-gap10" style={{ flex: 1, minWidth: 260, position: "relative" }}>
            <Search size={16} color="var(--text-3)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Search 100+ courses, skills, instructors, or certifications..."
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
              style={{
                width: "100%",
                height: 44,
                paddingLeft: 42,
                paddingRight: 14,
                borderRadius: 12,
                border: "1.5px solid var(--border)",
                background: "var(--surface)",
                fontSize: 13.5,
                color: "var(--text)",
                outline: "none",
                boxShadow: "0 1px 3px rgba(15,23,42,0.03)"
              }}
            />
          </div>

          <div className="tai-row tai-gap10" style={{ flexWrap: "wrap" }}>
            <select
              value={courseLevelFilter}
              onChange={(e) => setCourseLevelFilter(e.target.value)}
              style={{
                height: 44, padding: "0 14px", borderRadius: 12,
                border: "1.5px solid var(--border)", background: "var(--surface)",
                fontSize: 13, fontWeight: 600, color: "var(--text)", cursor: "pointer", outline: "none"
              }}
            >
              <option value="all">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                height: 44, padding: "0 14px", borderRadius: 12,
                border: "1.5px solid var(--border)", background: "var(--surface)",
                fontSize: 13, fontWeight: 600, color: "var(--text)", cursor: "pointer", outline: "none"
              }}
            >
              <option value="popular">Most Popular</option>
              <option value="highest_rated">Highest Rated</option>
              <option value="newest">Newest Releases</option>
              <option value="duration">Shortest Duration</option>
            </select>
          </div>
        </div>

        <div className="tai-scrollx" style={{ paddingBottom: 4, width: "100%", boxSizing: "border-box" }}>
          {CATEGORIES.map(cat => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 99,
                  border: isActive ? "1.5px solid #4F46E5" : "1px solid var(--border)",
                  background: isActive ? "#4F46E5" : "var(--surface)",
                  color: isActive ? "#FFFFFF" : "var(--text)",
                  fontWeight: isActive ? 800 : 600,
                  fontSize: 13,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  transition: "all 0.15s ease",
                  boxShadow: isActive ? "0 4px 12px rgba(79, 70, 229, 0.25)" : "none"
                }}
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.borderColor = "var(--primary-light)"; e.currentTarget.style.color = "var(--primary)"; } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text)"; } }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        <div className="tai-row tai-between" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10, marginTop: 4, flexWrap: "wrap", gap: 10 }}>
          <div className="tai-scrollx tai-gap14" style={{ width: "100%", boxSizing: "border-box" }}>
            <span
              onClick={() => { setShowMyCoursesOnly(false); setCourseSourceTab("all"); }}
              style={{
                fontSize: 13.5, fontWeight: 800, cursor: "pointer", paddingBottom: 8, whiteSpace: "nowrap",
                color: (!showMyCoursesOnly && courseSourceTab === "all") ? "var(--primary)" : "var(--text-3)",
                borderBottom: (!showMyCoursesOnly && courseSourceTab === "all") ? "2.5px solid var(--primary)" : "none"
              }}
            >
              All Courses ({allAvailableCourses.length})
            </span>

            <span
              onClick={() => { setShowMyCoursesOnly(false); setCourseSourceTab("assigned"); }}
              style={{
                fontSize: 13.5, fontWeight: 800, cursor: "pointer", paddingBottom: 8, whiteSpace: "nowrap",
                color: courseSourceTab === "assigned" ? "var(--primary)" : "var(--text-3)",
                borderBottom: courseSourceTab === "assigned" ? "2.5px solid var(--primary)" : "none"
              }}
            >
              Assigned to Me ({allAvailableCourses.filter(c => c.assigned || c.enrolled).length})
            </span>

            <span
              onClick={() => { setShowMyCoursesOnly(false); setCourseSourceTab("internal"); }}
              style={{
                fontSize: 13.5, fontWeight: 800, cursor: "pointer", paddingBottom: 8, whiteSpace: "nowrap",
                color: courseSourceTab === "internal" ? "var(--primary)" : "var(--text-3)",
                borderBottom: courseSourceTab === "internal" ? "2.5px solid var(--primary)" : "none"
              }}
            >
              Internal Courses ({allAvailableCourses.filter(c => c.isInternal || c.source === "internal").length})
            </span>

            <span
              onClick={() => { setShowMyCoursesOnly(false); setCourseSourceTab("partners"); }}
              style={{
                fontSize: 13.5, fontWeight: 800, cursor: "pointer", paddingBottom: 8, whiteSpace: "nowrap",
                color: courseSourceTab === "partners" ? "var(--primary)" : "var(--text-3)",
                borderBottom: courseSourceTab === "partners" ? "2.5px solid var(--primary)" : "none"
              }}
            >
              External Partners ({allAvailableCourses.filter(c => c.partner || c.source === "partner").length})
            </span>

            <span
              onClick={() => { setShowMyCoursesOnly(false); setCourseSourceTab("bookmarks"); }}
              style={{
                fontSize: 13.5, fontWeight: 800, cursor: "pointer", paddingBottom: 8, whiteSpace: "nowrap",
                color: courseSourceTab === "bookmarks" ? "var(--primary)" : "var(--text-3)",
                borderBottom: courseSourceTab === "bookmarks" ? "2.5px solid var(--primary)" : "none"
              }}
            >
              Bookmarked ({Object.values(bookmarkedIds).filter(Boolean).length})
            </span>
          </div>

          <span style={{ fontSize: 12.5, color: "var(--text-3)", fontWeight: 600 }}>
            Showing {filteredCatalog.length} curated masterclasses
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
        {filteredCatalog.length === 0 ? (
          <div className="tai-card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "48px 24px", borderRadius: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--primary-tint)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              {courseSourceTab === "bookmarks" ? <Heart size={28} color="var(--primary)" /> : <BookOpen size={28} color="var(--primary)" />}
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", margin: "0 0 6px" }}>
              {courseSourceTab === "bookmarks" ? "No Bookmarked Courses Yet" : showMyCoursesOnly ? "No Active Courses in Progress" : "No Courses Match Your Filter"}
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-3)", maxWidth: 420, margin: "0 auto 18px", lineHeight: 1.5 }}>
              {courseSourceTab === "bookmarks"
                ? "Explore the masterclass catalog and click the heart icon on any course card to save it to your bookmarks for quick study."
                : "Try clearing your search keyword or switching categories to explore our full curriculum."}
            </p>
            <button
              className="tai-btn tai-btn-primary"
              style={{ padding: "10px 22px", borderRadius: 12, fontWeight: 800 }}
              onClick={() => {
                setShowMyCoursesOnly(false);
                setCourseSourceTab("all");
                setCourseSearch("");
                setSelectedCategory("all");
              }}
            >
              Browse All Masterclasses →
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
                boxShadow: "0 2px 10px rgba(15,23,42,0.03)",
                transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
              }}
            >
              <div style={{ position: "relative", height: 180, width: "100%", overflow: "hidden" }}>
                <img
                  src={course.coverImageUrl}
                  alt={course.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s ease" }}
                />
                <div style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(to top, rgba(15,23,42,0.6) 0%, transparent 60%)"
                }} />

                <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {course.isBestseller && (
                    <span style={{ background: "#F59E0B", color: "#FFFFFF", fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 6, letterSpacing: ".04em" }}>
                      BESTSELLER
                    </span>
                  )}
                  {course.isTrending && (
                    <span style={{ background: "#10B981", color: "#FFFFFF", fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 6, letterSpacing: ".04em" }}>
                      TRENDING
                    </span>
                  )}
                  <span style={{ background: "rgba(15,23,42,0.75)", backdropFilter: "blur(4px)", color: "#FFFFFF", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>
                    {course.level || "Intermediate"}
                  </span>
                </div>

                <button
                  onClick={(e) => toggleLocalBookmark(e, course.id)}
                  style={{
                    position: "absolute", top: 12, right: 12,
                    width: 32, height: 32, borderRadius: "50%",
                    background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)",
                    border: "none", display: "flex", alignItems: "center", justifyContent: "center",
                    color: isBookmarked ? "#EF4444" : "#FFFFFF", cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                  title={isBookmarked ? "Remove Bookmark" : "Save Course"}
                >
                  <Heart size={16} fill={isBookmarked ? "#EF4444" : "none"} />
                </button>

                {isEnrolled && (
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 5, background: "rgba(255,255,255,0.3)" }}>
                    <div style={{ height: "100%", width: `${course.progress || 50}%`, background: isCompleted ? "#10B981" : "#4F46E5" }} />
                  </div>
                )}
              </div>

              <div style={{ padding: "18px 20px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>
                    {course.category}
                  </div>

                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 8px", color: "var(--text)", lineHeight: 1.35 }}>
                    {course.title}
                  </h3>

                  <p style={{ fontSize: 12.5, color: "var(--text-3)", margin: "0 0 14px", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {course.description}
                  </p>

                  <div className="tai-row tai-gap8" style={{ marginBottom: 14 }}>
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
                    <span style={{ color: "var(--text-3)" }}>({course.reviewsCount || 1200})</span>
                    <span style={{ color: "var(--text-3)" }}>•</span>
                    <span style={{ color: "var(--text-3)", fontWeight: 600 }}>{course.studentsCount || "8.5k"} students</span>
                  </div>
                </div>

                <div>
                  <div className="tai-row" style={{ padding: "10px 0", borderTop: "1px solid var(--border)", fontSize: 11.5, color: "var(--text-3)", fontWeight: 600, gap: 6, flexWrap: "wrap" }}>
                    <span>{course.hours} Total Hours</span>
                    <span>•</span>
                    <span>{course.lessonsCount} Modules</span>
                    <span>•</span>
                    <span>{course.hasCertificate ? "Certificate" : "Audited"}</span>
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
        }))}
      </div>

      <div>
        <div className="tai-row tai-between" style={{ marginBottom: 16 }}>
          <div>
            <div className="tai-row tai-gap8">
              <Award size={20} color="var(--primary)" />
              <h2 style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em", margin: 0, color: "var(--text)" }}>
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
              className="tai-card-hover"
              onClick={() => setActiveSpecialization(spec)}
              style={{
                background: "var(--surface)",
                borderRadius: 18,
                border: "1px solid var(--border)",
                padding: 24,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 4px 16px rgba(15,23,42,0.04)"
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
                    <span key={idx} style={{ background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text-2)", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>
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
              <h2 style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em", margin: 0, color: "var(--text)" }}>
                Live Workshop &amp; Studio Replays
              </h2>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-3)", margin: "4px 0 0" }}>
              Missed a live studio session? Watch recorded breakdowns with full transcripts
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
          {RECENT_RECORDINGS.map((rec) => (
            <div
              key={rec.id}
              className="tai-card-hover"
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
              <div style={{ position: "relative", height: 140, width: "100%" }}>
                <img src={rec.thumbnail} alt={rec.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(15,23,42,0.7) 0%, transparent 60%)" }} />

                <span style={{ position: "absolute", top: 10, left: 10, background: rec.badgeColor, color: "#fff", fontSize: 9.5, fontWeight: 800, padding: "2px 8px", borderRadius: 6 }}>
                  {rec.badge}
                </span>

                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                    <Play size={16} color="var(--primary)" fill="var(--primary)" style={{ marginLeft: 2 }} />
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

      {/* =========================================================================
          VIDEO PLAYER MODAL (PORTAL-MOUNTED DIRECTLY ON DOCUMENT.BODY)
          ========================================================================= */}
      <PortalModal
        isOpen={Boolean(activeRecording)}
        onClose={() => setActiveRecording(null)}
        maxWidth={760}
        zIndex={9999}
        style={{ background: "#0F172A", color: "#fff", padding: 0, overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)" }}
      >
        {activeRecording && (
          <>
            <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#818CF8", textTransform: "uppercase" }}>{activeRecording.badge}</span>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: "2px 0 0", color: "#fff" }}>{activeRecording.title}</h3>
              </div>
              <button onClick={() => setActiveRecording(null)} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, background: "#000" }}>
              <iframe
                title={activeRecording.title}
                src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            <div style={{ padding: 18, background: "#1E293B", display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
              <div className="tai-row tai-gap10" style={{ minWidth: 0 }}>
                <img src={activeRecording.thumbnail} alt="" style={{ width: 34, height: 34, flexShrink: 0, borderRadius: "50%", objectFit: "cover" }} />
                <div style={{ minWidth: 0, overflow: "hidden" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeRecording.instructor}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeRecording.role} • {activeRecording.duration}</div>
                </div>
              </div>

              <button
                className="tai-btn tai-btn-primary tai-btn-sm"
                style={{ flexShrink: 0 }}
                onClick={() => { setActiveRecording(null); push("courseDetail", { id: "course-figma-ai" }); }}
              >
                Enroll in Full Track →
              </button>
            </div>
          </>
        )}
      </PortalModal>

      {/* =========================================================================
          SPECIALIZATION MODAL (PORTAL-MOUNTED DIRECTLY ON DOCUMENT.BODY)
          ========================================================================= */}
      <PortalModal
        isOpen={Boolean(activeSpecialization)}
        onClose={() => setActiveSpecialization(null)}
        maxWidth={640}
        zIndex={9999}
      >
        {activeSpecialization && (
          <>
            <div className="tai-row tai-between" style={{ marginBottom: 14 }}>
              <span style={{ background: activeSpecialization.badgeBg, color: "#fff", fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 8 }}>
                {activeSpecialization.badge}
              </span>
              <button onClick={() => setActiveSpecialization(null)} style={{ background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 10px", color: "var(--text)" }}>
              {activeSpecialization.title}
            </h2>

            <p style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.55, margin: "0 0 20px" }}>
              {activeSpecialization.description}
            </p>

            <div className="tai-card" style={{ background: "var(--surface-3)", padding: 16, borderRadius: 14, marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 8 }}>
                What You'll Master ({activeSpecialization.skills.length} Competencies)
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {activeSpecialization.skills.map((s, idx) => (
                  <span key={idx} className="tai-row tai-gap6" style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", background: "var(--surface)", padding: "4px 10px", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <Check size={13} color="var(--primary)" /> {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="tai-row tai-between" style={{ alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-3)" }}>Estimated Duration</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>{activeSpecialization.months}</div>
              </div>

              <div className="tai-row tai-gap10" style={{ flexWrap: "wrap" }}>
                <button className="tai-btn tai-btn-outline" onClick={() => setActiveSpecialization(null)}>
                  Close
                </button>
                <button
                  className="tai-btn tai-btn-primary"
                  onClick={() => {
                    setActiveSpecialization(null);
                    push("courseDetail", { id: "course-figma-ai" });
                  }}
                >
                  Enroll in Specialization →
                </button>
              </div>
            </div>
          </>
        )}
      </PortalModal>

    </div>
  );
}
