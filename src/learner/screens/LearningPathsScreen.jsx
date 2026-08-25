import React, { useState } from "react";
import { TopBar, Tag, ProgressBar } from "../components/LearnerUI.jsx";
import { 
  Map, Award, BookOpen, Clock, CheckCircle2, 
  Users, ArrowRight, ChevronRight, Layers, 
  ShieldCheck, Filter, Search, Play, Check, X, Laptop,
  Compass, Star, Sparkles, CheckSquare, Zap, BookMarked
} from "lucide-react";
import { PortalModal } from "../../components/common/PortalModal.jsx";
import { enrollInLearningPath, leaveLearningPath } from "../../lib/api/learner.js";

const TRACK_TAXONOMY_CATEGORIES = [
  { id: "all", label: "All Learning Pathways" },
  { id: "no_code", label: "No Code Track" },
  { id: "code", label: "Code Track" },
  { id: "techpreneur", label: "Techpreneur Track" },
  { id: "design", label: "UI/UX & Spatial Design" },
  { id: "frontend", label: "Frontend Engineering" },
  { id: "backend", label: "Backend Engineering" },
  { id: "data", label: "Data Analytics & Python" },
  { id: "product", label: "Product & Strategy" },
  { id: "cyber", label: "Cybersecurity & Compliance" }
];

export const CORE_PLATFORM_TRACKS = [
  // 1. NO CODE TRACK: UI/UX Design
  {
    id: "track-ui-ux-spatial",
    title: "UI/UX Design Systems & Spatial Computing Specialization",
    trackCategory: "no_code",
    category: "design",
    categoryLabel: "UI/UX Design (No Code)",
    provider: "Train AI Academy • Figma & VisionOS Partner",
    badge: "PROFESSIONAL DESIGN CERTIFICATE",
    badgeColor: "#2563EB",
    image: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80",
    description: "Master modern AI design workflows, enterprise design token pipelines in Figma, responsive auto-layout, and spatial VisionOS interface architecture.",
    totalHours: "32 Hours",
    rating: 4.95,
    reviews: "3,420",
    enrolledCount: "14.2k",
    targetRole: "Senior UI/UX Designer / Spatial Experience Architect",
    skills: ["Figma AI", "Design Tokens", "VisionOS Ergonomics", "Glassmorphism UI", "Design Systems"],
    courses: [
      {
        id: "course-figma-ai",
        step: 1,
        title: "Master Design Systems in Figma with AI",
        duration: "18 Hours",
        instructor: "Astrid Larsson",
        instructorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 4,
        description: "Variables 2.0, token aliases, auto-layout 5.0, and AI layout generation."
      },
      {
        id: "course-spatial-ui",
        step: 2,
        title: "Spatial Computing & VisionOS Design Foundations",
        duration: "14 Hours",
        instructor: "Sarah Connor",
        instructorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 3,
        description: "Eye-tracking ergonomics, depth layers, glassmorphism materials, and gesture canvas."
      }
    ]
  },

  // 2. NO CODE TRACK: Product Management
  {
    id: "track-product-mgmt",
    title: "Product Management & Strategic Roadmapping Specialization",
    trackCategory: "no_code",
    category: "product",
    categoryLabel: "Product Management (No Code)",
    provider: "Train AI Product Council",
    badge: "EXECUTIVE PRODUCT DIPLOMA",
    badgeColor: "#059669",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&auto=format&fit=crop&q=80",
    description: "Formulate product visions, agile sprint delivery architectures, user research synthesis, and data-driven OKR prioritization for hyper-growth teams.",
    totalHours: "36 Hours",
    rating: 4.9,
    reviews: "2,180",
    enrolledCount: "8.9k",
    targetRole: "Product Manager / Strategic Lead",
    skills: ["Product Strategy", "Agile & Scrum", "User Journey Mapping", "OKR Roadmaps", "Data Analytics"],
    courses: [
      {
        id: "course-product-analytics",
        step: 1,
        title: "Product Analytics 101 & Metric Architecture",
        duration: "16 Hours",
        instructor: "Elena Rostova",
        instructorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 4,
        description: "Cohort retention analysis, conversion funnels, and feature telemetry frameworks."
      },
      {
        id: "course-prompt-pro",
        step: 2,
        title: "AI-Augmented Product Roadmapping & Prototyping",
        duration: "20 Hours",
        instructor: "Alex Rivera",
        instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 4,
        description: "Rapid generative PRD authoring, user story breakdown, and prompt-driven prototyping."
      }
    ]
  },

  // 3. NO CODE TRACK: Cybersecurity & Compliance
  {
    id: "track-cybersecurity-compliance",
    title: "Cybersecurity, Cloud Governance & Data Protection Specialization",
    trackCategory: "no_code",
    category: "cyber",
    categoryLabel: "Cybersecurity (No Code)",
    provider: "Train AI Security Council",
    badge: "CERTIFIED SECURITY SPECIALIST",
    badgeColor: "#DC2626",
    image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=80",
    description: "Implement zero-trust security postures, workplace data privacy protocols, GDPR/SOC2 compliance standards, and risk mitigation strategies.",
    totalHours: "28 Hours",
    rating: 4.88,
    reviews: "1,640",
    enrolledCount: "7.4k",
    targetRole: "Cybersecurity Analyst / Compliance Officer",
    skills: ["Zero-Trust Architecture", "Data Privacy", "SOC2 Compliance", "Threat Assessment", "Policy Design"],
    courses: [
      {
        id: "course-compliance-101",
        step: 1,
        title: "Workplace Compliance & Data Protection 101",
        duration: "12 Hours",
        instructor: "David Vance",
        instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 3,
        description: "Enterprise confidentiality, ethical governance, and information security safeguards."
      },
      {
        id: "course-cloud-devops",
        step: 2,
        title: "Cloud Infrastructure Security & Access Controls",
        duration: "16 Hours",
        instructor: "Elena Rostova",
        instructorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 3,
        description: "IAM roles, encryption in transit & at rest, and automated vulnerability scanning."
      }
    ]
  },

  // 4. NO CODE TRACK: Data Analytics
  {
    id: "track-data-analytics-bi",
    title: "Data Analytics, Business Intelligence & Insights Specialization",
    trackCategory: "no_code",
    category: "data",
    categoryLabel: "Data Analyst (No Code)",
    provider: "Train AI Intelligence Group",
    badge: "DATA ANALYST CERTIFICATE",
    badgeColor: "#D97706",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80",
    description: "Extract actionable business insights, design executive dashboard visualizations, analyze predictive trends, and make high-impact data decisions.",
    totalHours: "34 Hours",
    rating: 4.92,
    reviews: "2,450",
    enrolledCount: "10.8k",
    targetRole: "Business Intelligence Analyst / Data Specialist",
    skills: ["Dashboard Design", "Predictive Analytics", "KPI Dashboards", "Statistical Modeling", "Data Insights"],
    courses: [
      {
        id: "course-data-python",
        step: 1,
        title: "Python Data Science, Analytics & Visualizations",
        duration: "20 Hours",
        instructor: "David Kim",
        instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 3,
        description: "Data wrangling, statistical distributions, and exploratory analytics charting."
      },
      {
        id: "course-product-analytics",
        step: 2,
        title: "Executive Business Metrics & Insights Dashboards",
        duration: "14 Hours",
        instructor: "Astrid Larsson",
        instructorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 3,
        description: "Strategic KPI reporting, cohort trends, and cross-functional visualization."
      }
    ]
  },

  // 5. NO CODE TRACK: Digital Marketing
  {
    id: "track-digital-marketing-growth",
    title: "Digital Marketing, SEO & Growth Engineering Specialization",
    trackCategory: "no_code",
    category: "marketing",
    categoryLabel: "Digital Marketing (No Code)",
    provider: "Train AI Growth Labs",
    badge: "GROWTH MARKETING CERTIFICATE",
    badgeColor: "#8B5CF6",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80",
    description: "Engineer high-converting multi-channel acquisition funnels, optimize search engine visibility, orchestrate viral content campaigns, and maximize ROI.",
    totalHours: "30 Hours",
    rating: 4.87,
    reviews: "1,420",
    enrolledCount: "6.2k",
    targetRole: "Growth Marketer / Digital Campaign Strategist",
    skills: ["SEO Strategy", "Funnel Optimization", "Content Marketing", "Performance Ads", "Conversion Rate"],
    courses: [
      {
        id: "course-product-analytics",
        step: 1,
        title: "Growth Funnel Optimization & Analytics",
        duration: "14 Hours",
        instructor: "Elena Rostova",
        instructorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 3,
        description: "Attribution models, CAC/LTV economics, and A/B split testing."
      },
      {
        id: "course-prompt-pro",
        step: 2,
        title: "AI-Powered Content Marketing & Multi-Channel Campaigns",
        duration: "16 Hours",
        instructor: "Alex Rivera",
        instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 3,
        description: "Programmatic SEO copywriting, generative ad creatives, and distribution automation."
      }
    ]
  },

  // 6. CODE TRACK: Full-Stack AI Application Engineering
  {
    id: "track-fullstack-ai-engineering",
    title: "Full-Stack AI Application & Systems Engineering Specialization",
    trackCategory: "code",
    category: "engineering",
    categoryLabel: "Full-Stack (Code)",
    provider: "Train AI Engineering Consortium",
    badge: "FULL-STACK AI DIPLOMA",
    badgeColor: "#059669",
    image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
    description: "Architect full-stack applications with React 19, Python FastAPI backend services, LangChain multi-agent systems, and pgvector retrieval-augmented generation.",
    totalHours: "64 Hours",
    rating: 4.97,
    reviews: "3,890",
    enrolledCount: "16.4k",
    targetRole: "Full-Stack AI Engineer / Agent Platform Architect",
    skills: ["React 19", "FastAPI", "pgvector", "LangChain / Multi-Agent", "PostgreSQL"],
    courses: [
      {
        id: "course-fullstack-ai",
        step: 1,
        title: "Full-Stack AI Application Engineering",
        duration: "26 Hours",
        instructor: "Alex Rivera",
        instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 4,
        description: "FastAPI streaming endpoints, pgvector vector search, and React realtime UI."
      },
      {
        id: "course-prompt-pro",
        step: 2,
        title: "Prompt Engineering & LLM Architecture",
        duration: "12 Hours",
        instructor: "Elena Rostova",
        instructorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 3,
        description: "Function-calling schemas, few-shot prompting, and automated model evaluations."
      },
      {
        id: "course-cloud-devops",
        step: 3,
        title: "Cloud Native Microservices & Kubernetes Deployment",
        duration: "26 Hours",
        instructor: "David Vance",
        instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 3,
        description: "Docker multi-stage builds, Kubernetes pod orchestration, and CI/CD pipelines."
      }
    ]
  },

  // 7. CODE TRACK: Frontend Engineering
  {
    id: "track-frontend-engineering",
    title: "Modern Frontend Web Engineering Specialization",
    trackCategory: "code",
    category: "frontend",
    categoryLabel: "Frontend (Code)",
    provider: "Train AI Web Platform Group",
    badge: "FRONTEND ENGINEER CERTIFICATE",
    badgeColor: "#2563EB",
    image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80",
    description: "Master React component trees, responsive CSS architecture, state management, web performance optimization, and accessible interactive interfaces.",
    totalHours: "42 Hours",
    rating: 4.91,
    reviews: "2,760",
    enrolledCount: "12.1k",
    targetRole: "Senior Frontend Engineer / UI Architect",
    skills: ["React", "JavaScript ES6+", "HTML5/CSS3", "Design Systems", "Web Performance"],
    courses: [
      {
        id: "course-figma-ai",
        step: 1,
        title: "Master Design Systems in Figma with AI",
        duration: "18 Hours",
        instructor: "Astrid Larsson",
        instructorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 4,
        description: "Design-to-code pipelines, variable token exports, and component architecture."
      },
      {
        id: "course-fullstack-ai",
        step: 2,
        title: "React 19 Realtime Client & Interface Engineering",
        duration: "24 Hours",
        instructor: "Alex Rivera",
        instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 4,
        description: "Server Actions, hooks, optimistic UI state, and responsive layouts."
      }
    ]
  },

  // 8. CODE TRACK: Backend & Cloud Engineering
  {
    id: "track-backend-cloud-engineering",
    title: "Backend Services & Cloud Infrastructure Specialization",
    trackCategory: "code",
    category: "backend",
    categoryLabel: "Backend (Code)",
    provider: "Train AI Cloud Systems",
    badge: "BACKEND CLOUD CERTIFICATE",
    badgeColor: "#475569",
    image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80",
    description: "Design scalable REST & WebSocket APIs, manage high-concurrency databases, write optimized SQL queries, and deploy Dockerized microservices.",
    totalHours: "48 Hours",
    rating: 4.93,
    reviews: "1,940",
    enrolledCount: "9.5k",
    targetRole: "Backend Software Engineer / Cloud Developer",
    skills: ["Python FastAPI", "Node.js", "PostgreSQL", "Docker", "Kubernetes"],
    courses: [
      {
        id: "course-fullstack-ai",
        step: 1,
        title: "FastAPI Backend Architecture & PostgreSQL",
        duration: "26 Hours",
        instructor: "Alex Rivera",
        instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 4,
        description: "Async request pipelines, database connection pools, and API authentication."
      },
      {
        id: "course-cloud-devops",
        step: 2,
        title: "Cloud Native Microservices & Kubernetes",
        duration: "22 Hours",
        instructor: "David Vance",
        instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 3,
        description: "Containerization, cluster ingress, load balancing, and production logging."
      }
    ]
  },

  // 9. TECHPRENEUR TRACK: Founders Program
  {
    id: "track-techpreneur-founders",
    title: "Founders Program: Venture Building & Tech-Preneurship",
    trackCategory: "techpreneur",
    category: "techpreneur",
    categoryLabel: "Founders Program (Techpreneur)",
    provider: "Train AI Venture Accelerator",
    badge: "VENTURE FOUNDER DIPLOMA",
    badgeColor: "#D97706",
    image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&auto=format&fit=crop&q=80",
    description: "From idea validation to MVP launch: master entrepreneurial experimentation, customer discovery, venture business model design, and investor pitch preparation.",
    totalHours: "38 Hours",
    rating: 4.98,
    reviews: "2,890",
    enrolledCount: "13.4k",
    targetRole: "Startup Founder / Chief Executive Officer / Tech Entrepreneur",
    skills: ["Idea Validation", "Venture Building", "Customer Discovery", "Pitch Deck Design", "Business Models"],
    courses: [
      {
        id: "course-techpreneur-business",
        step: 1,
        title: "Recognizing a Business Opportunity & Market Fit",
        duration: "18 Hours",
        instructor: "Astrid Larsson",
        instructorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 4,
        description: "Market sizing, competitive moat analysis, unit economics, and customer interviews."
      },
      {
        id: "course-techpreneur-experimentation",
        step: 2,
        title: "Entrepreneurial Experimentation & MVP Launch",
        duration: "20 Hours",
        instructor: "Alex Rivera",
        instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 4,
        description: "Lean MVP builds, beta tester acquisition, pricing experiments, and investor pitching."
      }
    ]
  }
];

export function LearningPathsScreen({
  user,
  courses = [],
  session,
  push,
  back,
  showToast,
  pathsQuery,
  pathEnrollmentsQuery,
  enrollments = [],
  enrollInCourse,
  enrollmentsQuery
}) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMyEnrolledOnly, setShowMyEnrolledOnly] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [enrollingPathId, setEnrollingPathId] = useState(null);

  // Map of course progress by course ID for real progress calculation
  const courseProgressMap = new Map();
  (enrollments || []).forEach(e => {
    courseProgressMap.set(e.course_id, e.progress_percentage || 0);
  });
  (courses || []).forEach(c => {
    if (c.progress != null && !courseProgressMap.has(c.id)) {
      courseProgressMap.set(c.id, c.progress);
    }
  });

  // DB-enrolled path IDs
  const enrolledPathIds = new Set(
    (pathEnrollmentsQuery?.data || []).map(e => e.path_id || e.learning_path_id || e.id)
  );

  // Parse DB paths if available from platform admin
  const dbPaths = (pathsQuery?.data || []).map((p, idx) => {
    const isEnrolled = enrolledPathIds.has(p.id);
    const pathCourses = (p.courses || []).map((c, cIdx) => {
      const prog = courseProgressMap.get(c.id) || 0;
      return {
        id: c.id,
        step: cIdx + 1,
        title: c.title || "Course",
        duration: `${c.hours || 12} Hours`,
        status: prog >= 100 ? "completed" : prog > 0 ? "in_progress" : "upcoming",
        progress: prog,
        instructor: c.instructor || "Curriculum Specialist",
        instructorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        lessonsCount: c.lessons_count || 12,
        description: c.description || "Core milestone curriculum."
      };
    });

    const completedCount = pathCourses.filter(c => c.status === "completed").length;
    const progress = pathCourses.length > 0 ? Math.round((completedCount / pathCourses.length) * 100) : 0;

    return {
      id: p.id,
      title: p.title || "Custom Pathway",
      trackCategory: "code",
      category: p.category || "engineering",
      categoryLabel: p.category ? `${p.category} Specialization` : "Professional Pathway",
      provider: "Train AI Academy",
      badge: "PROFESSIONAL DIPLOMA",
      badgeColor: "#2563EB",
      image: p.cover_image_url || "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80",
      description: p.description || "Master industry competencies and build production deliverables.",
      totalHours: `${p.courses?.reduce((sum, c) => sum + (c.hours || 10), 0) || 30} Hours`,
      rating: 4.9,
      reviews: "420",
      enrolledCount: "2.5k",
      targetRole: "Industry Specialist",
      skills: ["Production Workflow", "Architecture", "Hands-on Capstone"],
      isEnrolled,
      progress,
      courses: pathCourses
    };
  });

  // Calculate live progress & status for CORE_PLATFORM_TRACKS
  const coreTracksWithLiveState = CORE_PLATFORM_TRACKS.map(track => {
    const isEnrolled = enrolledPathIds.has(track.id);
    const liveCourses = track.courses.map((c, idx) => {
      const prog = courseProgressMap.get(c.id) || 0;
      return {
        ...c,
        progress: prog,
        status: prog >= 100 ? "completed" : prog > 0 ? "in_progress" : idx === 0 && isEnrolled ? "in_progress" : "upcoming"
      };
    });

    const completedCount = liveCourses.filter(c => c.status === "completed").length;
    const calculatedProgress = liveCourses.length > 0 ? Math.round((completedCount / liveCourses.length) * 100) : 0;

    return {
      ...track,
      isEnrolled,
      progress: calculatedProgress,
      courses: liveCourses
    };
  });

  // Combine DB custom pathways with core platform tracks
  const allTracks = [...coreTracksWithLiveState, ...dbPaths];

  // Filtering
  const filteredTracks = allTracks.filter(track => {
    if (showMyEnrolledOnly && !track.isEnrolled && track.progress === 0) return false;

    if (selectedCategory !== "all") {
      if (selectedCategory === "no_code" && track.trackCategory !== "no_code") return false;
      if (selectedCategory === "code" && track.trackCategory !== "code") return false;
      if (selectedCategory === "techpreneur" && track.trackCategory !== "techpreneur") return false;
      if (!["no_code", "code", "techpreneur"].includes(selectedCategory) && track.category !== selectedCategory) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = track.title.toLowerCase().includes(q);
      const matchDesc = track.description.toLowerCase().includes(q);
      const matchRole = track.targetRole?.toLowerCase().includes(q);
      const matchSkill = track.skills?.some(s => s.toLowerCase().includes(q));
      if (!matchTitle && !matchDesc && !matchRole && !matchSkill) return false;
    }

    return true;
  });

  async function handleEnrollPathway(track) {
    if (!session?.user?.id) {
      showToast?.("Please sign in to enroll in this pathway.");
      return;
    }

    setEnrollingPathId(track.id);
    try {
      // 1. Sync with Supabase & Local Cache
      await enrollInLearningPath(session.user.id, track.id);
      pathEnrollmentsQuery?.refetch();

      // 2. Automatically enroll in the first course of the track if needed
      const firstCourse = track.courses[0];
      if (firstCourse && enrollInCourse) {
        try {
          await enrollInCourse(firstCourse.id);
          enrollmentsQuery?.refetch();
        } catch {}
      }

      showToast?.(`🎉 Successfully enrolled in ${track.title}!`);

      // 3. Navigate to the first active course
      if (firstCourse) {
        push("courseDetail", { id: firstCourse.id });
      }
    } catch (e) {
      showToast?.(e?.message || "Could not complete enrollment.");
    } finally {
      setEnrollingPathId(null);
    }
  }

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      {/* =========================================================================
          LEARNING PATHWAYS HERO BANNER
          ========================================================================= */}
      <div
        className="tai-card tai-hero-card tai-hero-dark anim-fluid-entrance"
        style={{
          position: "relative",
          borderRadius: 14,
          overflow: "hidden",
          padding: "clamp(18px, 2.5vw, 24px)"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 180,
            height: 180,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59, 130, 246, 0.22) 0%, transparent 70%)",
            pointerEvents: "none"
          }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="tai-row tai-gap6" style={{ marginBottom: 8 }}>
            <span style={{ background: "rgba(59, 130, 246, 0.2)", border: "1px solid rgba(59, 130, 246, 0.4)", color: "#93C5FD", fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 99 }}>
              OFFICIAL CAREER ROADMAPS
            </span>
          </div>

          <h1 className="tai-hero-title" style={{ fontSize: "clamp(22px, 3vw, 28px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 8px", lineHeight: 1.2 }}>
            Learning Pathways &amp; Career Specializations
          </h1>
          <p className="tai-hero-desc" style={{ fontSize: 13.5, margin: 0, maxWidth: 660, lineHeight: 1.5 }}>
            Master job-ready competencies through sequenced, multi-course roadmaps. Complete progressive capstones across <strong>Code</strong>, <strong>No Code</strong>, and <strong>Techpreneur</strong> tracks to earn verified certificates.
          </p>

          {/* Quick Track Summary Strip */}
          <div className="tai-row tai-gap14 tai-mt20" style={{ flexWrap: "wrap" }}>
            <div className="tai-hero-subcard" style={{ padding: "10px 16px", borderRadius: 10 }}>
              <div style={{ fontSize: 10.5, color: "#94A3B8", fontWeight: 700 }}>AVAILABLE SPECIALIZATIONS</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#FFFFFF" }}>{allTracks.length} Guided Pathways</div>
            </div>
            <div className="tai-hero-subcard" style={{ padding: "10px 16px", borderRadius: 10 }}>
              <div style={{ fontSize: 10.5, color: "#94A3B8", fontWeight: 700 }}>CURRICULUM COVERAGE</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#34D399" }}>Code • No-Code • Techpreneur</div>
            </div>
            <div className="tai-hero-subcard" style={{ padding: "10px 16px", borderRadius: 10 }}>
              <div style={{ fontSize: 10.5, color: "#94A3B8", fontWeight: 700 }}>INDUSTRY OUTCOME</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#60A5FA" }}>Verified Certificate Included</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar Strip */}
      <div className="tai-card" style={{ padding: "14px 18px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          
          {/* Categories Pills */}
          <div className="tai-scrollx tai-gap6" style={{ paddingBottom: 2 }}>
            {TRACK_TAXONOMY_CATEGORIES.map(cat => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 99,
                    border: isSelected ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                    background: isSelected ? "var(--primary)" : "var(--surface)",
                    color: isSelected ? "#FFFFFF" : "var(--text)",
                    fontWeight: isSelected ? 800 : 600,
                    fontSize: 12.5,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    boxShadow: isSelected ? "0 4px 12px rgba(37, 99, 235, 0.25)" : "none"
                  }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Search + My Enrolled Toggle */}
          <div className="tai-row tai-gap10" style={{ flex: "1 1 280px", maxWidth: 440, minWidth: 220 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={15} color="var(--text-3)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Search pathways by skill, title, role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%", height: 38, paddingLeft: 36, paddingRight: 12,
                  borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--surface-2)",
                  fontSize: 13, color: "var(--text)", outline: "none"
                }}
              />
            </div>

            <button
              className="tai-btn tai-btn-outline tai-btn-sm"
              onClick={() => setShowMyEnrolledOnly(!showMyEnrolledOnly)}
              style={{
                height: 38, padding: "0 12px", borderRadius: 8, fontWeight: 700, whiteSpace: "nowrap",
                background: showMyEnrolledOnly ? "var(--primary-tint)" : "transparent",
                borderColor: showMyEnrolledOnly ? "var(--primary)" : "var(--border)",
                color: showMyEnrolledOnly ? "var(--primary)" : "var(--text)"
              }}
            >
              {showMyEnrolledOnly ? "All Tracks" : "My Enrolled"}
            </button>
          </div>

        </div>
      </div>

      {/* Learning Pathways Cards Grid */}
      <div className="tai-col tai-gap20 anim-stagger">
        {filteredTracks.length === 0 ? (
          <div className="tai-card" style={{ textAlign: "center", padding: "48px 24px", borderRadius: 10 }}>
            <Map size={36} color="var(--text-3)" style={{ margin: "0 auto 12px", opacity: 0.6 }} />
            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>
              No learning pathways found
            </div>
            <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4, maxWidth: 440, margin: "4px auto 14px" }}>
              Try clearing your search query or selecting "All Learning Pathways" to browse the full curriculum.
            </div>
            <button
              className="tai-btn tai-btn-primary tai-btn-sm"
              onClick={() => {
                setSelectedCategory("all");
                setSearchQuery("");
                setShowMyEnrolledOnly(false);
              }}
            >
              Browse All Pathways →
            </button>
          </div>
        ) : (
          filteredTracks.map((track) => (
            <div
              key={track.id}
              className="tai-card tai-card-hover"
              style={{
                padding: 0,
                borderRadius: 12,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                overflow: "hidden",
                boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.05)"
              }}
            >
              {/* Top Banner with Stock Cover Image */}
              <div style={{ position: "relative", height: 160, width: "100%", overflow: "hidden" }}>
                <img
                  src={track.image}
                  alt={track.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.4) 60%, transparent 100%)" }} />

                <div style={{ position: "absolute", top: 14, left: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ background: track.badgeColor, color: "#FFFFFF", fontSize: 10.5, fontWeight: 800, padding: "4px 10px", borderRadius: 6, letterSpacing: ".03em" }}>
                    {track.badge}
                  </span>
                  <span style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", color: "#FFFFFF", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6 }}>
                    {track.courses.length} Course Milestone Series
                  </span>
                  <span style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", color: "#93C5FD", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6 }}>
                    {track.categoryLabel}
                  </span>
                </div>

                <div style={{ position: "absolute", bottom: 12, left: 16, right: 16 }} className="tai-row tai-between">
                  <div style={{ fontSize: 12, color: "#DBEAFE", fontWeight: 700 }}>
                    {track.provider} • {track.totalHours}
                  </div>
                  <div className="tai-row tai-gap6" style={{ color: "#FDE68A", fontSize: 12, fontWeight: 800 }}>
                    <Star size={13} fill="#F59E0B" color="#F59E0B" /> {track.rating} ({track.reviews} ratings)
                  </div>
                </div>
              </div>

              {/* Track Content Body */}
              <div style={{ padding: "20px 24px" }}>
                
                <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <h3 style={{ fontSize: 19, fontWeight: 900, color: "var(--text)", margin: "0 0 6px", lineHeight: 1.3 }}>
                      {track.title}
                    </h3>
                    <p style={{ fontSize: 13.5, color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>
                      {track.description}
                    </p>
                  </div>

                  {(track.isEnrolled || track.progress > 0) && (
                    <div style={{ textAlign: "right", minWidth: 140 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--primary)" }}>{track.progress}% Track Progress</div>
                      <div style={{ width: 140, marginTop: 6 }}>
                        <ProgressBar value={track.progress} height={7} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Skills Tags */}
                <div className="tai-row tai-gap6 tai-mt14" style={{ flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--text-3)", marginRight: 4 }}>Skills Covered:</span>
                  {track.skills.map((skill, idx) => (
                    <span key={idx} style={{ background: "var(--surface-2)", color: "var(--text-2)", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)" }}>
                      {skill}
                    </span>
                  ))}
                </div>

                {/* Step-by-Step Curriculum Roadmap */}
                <div className="tai-col tai-gap8 tai-mt16" style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
                    Curriculum Sequence ({track.courses.length} Milestone Courses)
                  </div>

                  {track.courses.map((course, idx) => (
                    <div
                      key={course.id || idx}
                      className="tai-row tai-between"
                      style={{
                        padding: "10px 14px",
                        background: course.status === "in_progress" ? "var(--primary-tint, #EFF6FF)" : "var(--surface-2)",
                        borderRadius: 8,
                        border: course.status === "in_progress" ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                        cursor: "pointer"
                      }}
                      onClick={() => push("courseDetail", { id: course.id })}
                    >
                      <div className="tai-row tai-gap12" style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: course.status === "completed" ? "#10B981" : course.status === "in_progress" ? "var(--primary)" : "var(--surface-3)",
                          color: course.status === "upcoming" ? "var(--text-3)" : "#FFFFFF",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, flexShrink: 0
                        }}>
                          {course.status === "completed" ? <Check size={14} /> : idx + 1}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {course.title}
                          </div>
                          <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 1 }}>
                            {course.instructor} • {course.lessonsCount} lessons • {course.duration}
                          </div>
                        </div>
                      </div>

                      <div className="tai-row tai-gap10" style={{ flexShrink: 0 }}>
                        <Tag tone={course.status === "completed" ? "success" : course.status === "in_progress" ? "primary" : "default"}>
                          {course.status === "completed" ? "COMPLETED" : course.status === "in_progress" ? "IN PROGRESS" : "AVAILABLE"}
                        </Tag>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Card Footer Actions */}
                <div className="tai-row tai-between tai-mt18" style={{ paddingTop: 14, borderTop: "1px solid var(--border)", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                  <div className="tai-row tai-gap6" style={{ fontSize: 12.5, color: "var(--text-3)", fontWeight: 600 }}>
                    <ShieldCheck size={16} color="#10B981" />
                    <span>Target Role: <strong>{track.targetRole}</strong></span>
                  </div>

                  <div className="tai-row tai-gap10">
                    <button
                      className="tai-btn tai-btn-outline tai-btn-sm"
                      onClick={() => setSelectedTrack(track)}
                    >
                      View Syllabus Details
                    </button>
                    
                    <button
                      className="tai-btn tai-btn-primary tai-btn-sm"
                      style={{ padding: "8px 18px", fontWeight: 800 }}
                      disabled={enrollingPathId === track.id}
                      onClick={() => {
                        if (!track.isEnrolled) {
                          handleEnrollPathway(track);
                        } else {
                          const firstActiveCourse = track.courses.find(c => c.status === "in_progress") || track.courses[0];
                          push("courseDetail", { id: firstActiveCourse.id });
                        }
                      }}
                    >
                      {enrollingPathId === track.id
                        ? "Enrolling..."
                        : track.isEnrolled
                        ? (track.progress >= 100 ? "Review Completed Track →" : "Continue Track →")
                        : "Start Learning Path →"}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          ))
        )}
      </div>

      {/* Detailed Track Syllabus Modal */}
      {selectedTrack && (
        <PortalModal isOpen={true} onClose={() => setSelectedTrack(null)} title={selectedTrack.title}>
          <div style={{ padding: "6px 0" }}>
            <div style={{ position: "relative", height: 140, borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
              <img src={selectedTrack.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(15,23,42,0.85) 0%, transparent 60%)" }} />
              <div style={{ position: "absolute", bottom: 12, left: 14, right: 14, color: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#93C5FD" }}>{selectedTrack.provider}</div>
                <div style={{ fontSize: 16, fontWeight: 900 }}>{selectedTrack.title}</div>
              </div>
            </div>

            <p style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.5, margin: "0 0 16px" }}>
              {selectedTrack.description}
            </p>

            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", marginBottom: 8 }}>Included Courses:</div>
            <div className="tai-col tai-gap8" style={{ maxHeight: 260, overflowY: "auto" }}>
              {selectedTrack.courses.map((c, i) => (
                <div
                  key={c.id || i}
                  style={{ padding: "10px 12px", background: "var(--surface-2)", borderRadius: 10, border: "1px solid var(--border)" }}
                >
                  <div className="tai-row tai-between">
                    <span style={{ fontWeight: 800, fontSize: 13, color: "var(--text)" }}>Course {i + 1}: {c.title}</span>
                    <Tag tone={c.status === "completed" ? "success" : "primary"}>{c.duration}</Tag>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>{c.description}</div>
                </div>
              ))}
            </div>

            <div className="tai-row tai-between tai-mt20" style={{ paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <button className="tai-btn tai-btn-outline tai-btn-sm" onClick={() => setSelectedTrack(null)}>Close</button>
              <button
                className="tai-btn tai-btn-primary tai-btn-sm"
                onClick={() => {
                  const targetCourse = selectedTrack.courses.find(c => c.status === "in_progress") || selectedTrack.courses[0];
                  setSelectedTrack(null);
                  if (!selectedTrack.isEnrolled) {
                    handleEnrollPathway(selectedTrack);
                  } else {
                    push("courseDetail", { id: targetCourse.id });
                  }
                }}
              >
                {selectedTrack.isEnrolled ? "Continue Curriculum →" : "Enroll & Start Course →"}
              </button>
            </div>
          </div>
        </PortalModal>
      )}

    </div>
  );
}

export default LearningPathsScreen;
ngPathsScreen;
