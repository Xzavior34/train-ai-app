import React, { useState, useEffect, useRef } from "react";
import { TopBar, CourseCard, ProgressBar, Tag } from "../components/LearnerUI.jsx";
import {
  Search, Play, Clock, Video, Eye,
  ArrowRight, ExternalLink, Bookmark, CheckCircle2,
  Calendar, Layers, Filter, X, Award, Users,
  BookOpen, ChevronRight, ChevronLeft, TrendingUp, ShieldCheck, Heart,
  Flame, Laptop, FileText, Check, Compass, Map, Target, GraduationCap, BarChart3, Star
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

// Topic-accurate curated photography for courses across all tracks
const TOPIC_STOCK_PHOTOS = {
  figma_design_systems: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80",
  design_thinking: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&auto=format&fit=crop&q=80",
  spatial_visionos: "https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?w=800&auto=format&fit=crop&q=80",
  ui_prototyping: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=800&auto=format&fit=crop&q=80",
  fullstack_ai: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
  frontend_react: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80",
  backend_node_api: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80",
  prompt_engineering: "https://images.unsplash.com/photo-1677442136019-21780efad99a?w=800&auto=format&fit=crop&q=80",
  cloud_kubernetes: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80",
  python_data_science: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80",
  data_analyst_sql: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80",
  product_management: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&auto=format&fit=crop&q=80",
  cybersecurity_compliance: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=80",
  digital_marketing_growth: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80",
  entrepreneurship_venture: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&auto=format&fit=crop&q=80",
  business_opportunity: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&auto=format&fit=crop&q=80",
  technical_leadership: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80",
};

const CURATED_STOCK_PHOTOS = Object.values(TOPIC_STOCK_PHOTOS);

const COURSE_UNIQUE_THUMBNAILS = {
  "course-figma-ai": "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80",
  "course-spatial-ui": "https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?w=800&auto=format&fit=crop&q=80",
  "course-fullstack-ai": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80",
  "course-prompt-pro": "https://images.unsplash.com/photo-1677442136019-21780efad99a?w=800&auto=format&fit=crop&q=80",
  "course-cloud-devops": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80",
  "course-data-python": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80",
  "course-product-analytics": "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80",
  "course-compliance-101": "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=80",
  "course-techpreneur-business": "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&auto=format&fit=crop&q=80",
  "course-techpreneur-experimentation": "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&auto=format&fit=crop&q=80",
  "course-foundations": "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&auto=format&fit=crop&q=80",
  "course-design-thinking": "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&auto=format&fit=crop&q=80"
};

function getSafeCoverImage(course, idx = 0) {
  if (course?.id && COURSE_UNIQUE_THUMBNAILS[course.id]) {
    return COURSE_UNIQUE_THUMBNAILS[course.id];
  }
  if (course?.coverImageUrl && course.coverImageUrl.startsWith("http") && !course.coverImageUrl.includes("picsum.photos") && !course.coverImageUrl.includes("placeholder")) {
    return course.coverImageUrl;
  }
  if (course?.image && course.image.startsWith("http") && !course.image.includes("picsum.photos") && !course.image.includes("placeholder")) {
    return course.image;
  }
  
  const text = `${course?.title || ""} ${course?.category || ""} ${course?.tagline || ""} ${course?.description || ""}`.toLowerCase();
  
  if (text.includes("figma") || text.includes("design system") || (text.includes("ui") && text.includes("system"))) {
    return TOPIC_STOCK_PHOTOS.figma_design_systems;
  }
  if (text.includes("spatial") || text.includes("visionos") || text.includes("3d") || text.includes("realitykit")) {
    return TOPIC_STOCK_PHOTOS.spatial_visionos;
  }
  if (text.includes("design think") || text.includes("wireframe") || text.includes("user experience") || text.includes("ux research")) {
    return TOPIC_STOCK_PHOTOS.design_thinking;
  }
  if (text.includes("prototyp") || text.includes("ui design") || text.includes("ux design")) {
    return TOPIC_STOCK_PHOTOS.ui_prototyping;
  }
  if (text.includes("prompt") || text.includes("llm") || text.includes("agent") || text.includes("langchain") || text.includes("gpt")) {
    return TOPIC_STOCK_PHOTOS.prompt_engineering;
  }
  if (text.includes("full-stack") || text.includes("fullstack") || text.includes("web app")) {
    return TOPIC_STOCK_PHOTOS.fullstack_ai;
  }
  if (text.includes("react") || text.includes("frontend") || text.includes("javascript") || text.includes("html") || text.includes("css")) {
    return TOPIC_STOCK_PHOTOS.frontend_react;
  }
  if (text.includes("node") || text.includes("backend") || text.includes("fastapi") || text.includes("database") || text.includes("postgres") || text.includes("sql")) {
    return TOPIC_STOCK_PHOTOS.backend_node_api;
  }
  if (text.includes("cloud") || text.includes("kubernetes") || text.includes("docker") || text.includes("devops") || text.includes("ci/cd")) {
    return TOPIC_STOCK_PHOTOS.cloud_kubernetes;
  }
  if (text.includes("python") || text.includes("machine learning") || text.includes("pandas") || text.includes("data science")) {
    return TOPIC_STOCK_PHOTOS.python_data_science;
  }
  if (text.includes("analytics") || text.includes("data analyst") || text.includes("statistics") || text.includes("bi")) {
    return TOPIC_STOCK_PHOTOS.data_analyst_sql;
  }
  if (text.includes("security") || text.includes("cyber") || text.includes("compliance") || text.includes("protection")) {
    return TOPIC_STOCK_PHOTOS.cybersecurity_compliance;
  }
  if (text.includes("product") || text.includes("scrum") || text.includes("agile") || text.includes("roadmap")) {
    return TOPIC_STOCK_PHOTOS.product_management;
  }
  if (text.includes("marketing") || text.includes("seo") || text.includes("growth") || text.includes("funnel")) {
    return TOPIC_STOCK_PHOTOS.digital_marketing_growth;
  }
  if (text.includes("entrepreneur") || text.includes("startup") || text.includes("founder")) {
    return TOPIC_STOCK_PHOTOS.entrepreneurship_venture;
  }
  if (text.includes("business") || text.includes("opportunity") || text.includes("venture")) {
    return TOPIC_STOCK_PHOTOS.business_opportunity;
  }
  if (text.includes("leadership") || text.includes("management") || text.includes("executive")) {
    return TOPIC_STOCK_PHOTOS.technical_leadership;
  }

  const keys = Object.keys(TOPIC_STOCK_PHOTOS);
  const hash = (course?.id || course?.title || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) + idx;
  return TOPIC_STOCK_PHOTOS[keys[hash % keys.length]];
}

const SPOTLIGHT_SLIDES = [
  {
    id: "course-figma-ai",
    badge: "ENROLLED • SPRINT 5",
    badgeGradient: "#059669",
    cohortTag: "UI/UX Design Track",
    pathwayName: "UI/UX & Design Systems",
    trackKeyword: "design",
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
    lessonsText: "24 Lessons • 18 hrs",
    requiredCourses: [
      { id: "course-figma-ai", title: "Figma Design Systems & AI Tokens", progress: 72 },
      { id: "course-spatial-ui", title: "Spatial UI & Glass Ergonomics", progress: 0 },
      { id: "spec-1", title: "Interactive Micro-Interactions Lab", progress: 0 }
    ]
  },
  {
    id: "course-fullstack-ai",
    badge: "ACTIVE MULTI-COURSE LEARNING",
    badgeGradient: "#2563EB",
    cohortTag: "Full-Stack AI Track",
    pathwayName: "Full-Stack & Web Dev",
    trackKeyword: "engineering",
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
    lessonsText: "32 Lessons • 24 hrs",
    requiredCourses: [
      { id: "course-fullstack-ai", title: "Full-Stack AI with React 19", progress: 19 },
      { id: "course-figma-ai", title: "Vector Embeddings & API Services", progress: 0 },
      { id: "course-cloud-devops", title: "CI/CD & Cloud Deployment", progress: 0 }
    ]
  },
  {
    id: "course-spatial-ui",
    badge: "NEW MASTERCLASS SPOTLIGHT",
    badgeGradient: "#2563EB",
    cohortTag: "AI & Machine Learning Track",
    pathwayName: "Data & AI Systems",
    trackKeyword: "ai",
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
    lessonsText: "18 Lessons • 14 hrs",
    requiredCourses: [
      { id: "course-spatial-ui", title: "Spatial UI & VisionOS Foundations", progress: 0 },
      { id: "course-figma-ai", title: "AI Prototyping & Generative Assets", progress: 0 },
      { id: "course-fullstack-ai", title: "Multi-Agent Neural Workflows", progress: 0 }
    ]
  },
  {
    id: "course-cloud-devops",
    badge: "TRENDING IN YOUR COHORT",
    badgeGradient: "#D97706",
    cohortTag: "Cloud & Infrastructure Track",
    pathwayName: "Cloud & DevOps",
    trackKeyword: "cloud",
    title: "Cloud Infrastructure, Kubernetes & AI Microservices",
    description: "Production CI/CD pipelines, container orchestration, edge deployment, and GPU scaling for high-throughput AI workloads.",
    rating: 4.9,
    reviews: "1,420 reviews",
    enrolled: "9,300+ Enrolled",
    status: "Recommended",
    progress: 0,
    lessonsRemaining: "Hands-on Cloud Lab",
    instructor: "David Vance",
    instructorRole: "DevOps Infrastructure Lead",
    instructorAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
    coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80",
    cta: "Start Learning Path",
    action: "explore",
    lessonsText: "28 Lessons • 22 hrs",
    requiredCourses: [
      { id: "course-cloud-devops", title: "Kubernetes & AI Microservices", progress: 0 },
      { id: "course-fullstack-ai", title: "Vector DB Scaling & Cloud Ops", progress: 0 },
      { id: "course-spatial-ui", title: "GPU Optimization & Edge Labs", progress: 0 }
    ]
  }
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
  const [activeSlide, setActiveSlide] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);
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

  // Track taxonomy helper: Code Track, No Code Track, and Techpreneur Track
  function resolveUserTrackKey(userTrack) {
    const t = (userTrack || "").toLowerCase();
    if (t.includes("ui") || t.includes("ux") || t.includes("design") || t.includes("figma") || t.includes("spatial")) return "ui_ux";
    if (t.includes("product") || t.includes("pm") || t.includes("strategy")) return "product_management";
    if (t.includes("cyber") || t.includes("security") || t.includes("compliance")) return "cybersecurity";
    if (t.includes("data") || t.includes("analyst") || t.includes("python") || t.includes("science")) return "data_analyst";
    if (t.includes("marketing") || t.includes("digital") || t.includes("growth")) return "digital_marketing";
    if (t.includes("frontend") || t.includes("front-end")) return "frontend";
    if (t.includes("backend") || t.includes("back-end")) return "backend";
    if (t.includes("full") || t.includes("stack") || t.includes("engineering") || t.includes("code") || t.includes("web")) return "full_stack";
    if (t.includes("techpreneur") || t.includes("founder") || t.includes("business") || t.includes("leadership") || t.includes("venture")) return "techpreneur";
    return "ui_ux";
  }

  function getTrackDisplayName(trackKey) {
    switch (trackKey) {
      case "ui_ux": return "UI/UX Design Track";
      case "product_management": return "Product Management Track";
      case "cybersecurity": return "Cybersecurity Track";
      case "data_analyst": return "Data Analyst Track";
      case "digital_marketing": return "Digital Marketing Track";
      case "frontend": return "Frontend Engineering Track";
      case "backend": return "Backend Engineering Track";
      case "full_stack": return "Full-Stack Web Dev Track";
      case "techpreneur": return "Tech-Preneur (Founders) Track";
      default: return "Learning Track";
    }
  }

  function doesCourseMatchTrack(course, trackKey) {
    const cat = (course?.category || "").toLowerCase();
    const title = (course?.title || "").toLowerCase();
    const desc = (course?.tagline || course?.description || "").toLowerCase();
    const combined = `${cat} ${title} ${desc}`;

    switch (trackKey) {
      case "ui_ux":
        return combined.includes("design") || combined.includes("ui") || combined.includes("ux") || combined.includes("figma") || combined.includes("spatial") || combined.includes("prototyp");
      case "product_management":
        return combined.includes("product") || combined.includes("roadmap") || combined.includes("strategy") || combined.includes("scrum") || combined.includes("agile");
      case "cybersecurity":
        return combined.includes("security") || combined.includes("compliance") || combined.includes("cyber") || combined.includes("policy") || combined.includes("protocols");
      case "data_analyst":
        return combined.includes("data") || combined.includes("python") || combined.includes("analytics") || combined.includes("statistics") || combined.includes("machine learning");
      case "digital_marketing":
        return combined.includes("marketing") || combined.includes("growth") || combined.includes("seo") || combined.includes("funnel") || combined.includes("campaign");
      case "frontend":
        return (combined.includes("frontend") || combined.includes("front-end") || combined.includes("react") || combined.includes("javascript") || combined.includes("css") || combined.includes("html") || combined.includes("web")) && !combined.includes("backend");
      case "backend":
        return combined.includes("backend") || combined.includes("back-end") || combined.includes("node") || combined.includes("sql") || combined.includes("fastapi") || combined.includes("microservice") || combined.includes("postgres");
      case "full_stack":
        return combined.includes("full-stack") || combined.includes("full stack") || combined.includes("engineering") || combined.includes("web dev") || combined.includes("react 19") || combined.includes("cloud") || combined.includes("devops");
      case "techpreneur":
        return combined.includes("preneur") || combined.includes("founder") || combined.includes("leadership") || combined.includes("venture") || combined.includes("opportunity") || combined.includes("experimentation") || combined.includes("business");
      default:
        return true;
    }
  }

  // 1. Identify learner's chosen track
  const userTrackKey = resolveUserTrackKey(user?.track);
  const trackDisplayName = getTrackDisplayName(userTrackKey);

  // 2. Filter available courses for ONLY those in the learner's specific track
  const userTrackCourses = allAvailableCourses.filter(c => doesCourseMatchTrack(c, userTrackKey));
  const fallbackTrackCourses = userTrackCourses.length > 0 ? userTrackCourses : allAvailableCourses;

  // 3. Queue only UNCOMPLETED courses needed to start/continue with
  // When a course reaches 100% completion, it is automatically removed from this queue,
  // and the next uncompleted course in the track is automatically added/shown!
  const uncompletedTrackCourses = fallbackTrackCourses.filter(c => (c.progress || 0) < 100);
  const isTrackCompleted = fallbackTrackCourses.length > 0 && uncompletedTrackCourses.length === 0;

  // Build the active spotlight slides
  const dynamicSpotlightSlides = isTrackCompleted
    ? [
        {
          id: "track-mastery-complete",
          isTrackCompleted: true,
          badge: "TRACK COMPLETED • 100% CERTIFIED",
          badgeGradient: "#059669",
          cohortTag: trackDisplayName,
          pathwayName: trackDisplayName,
          title: `🎉 All ${trackDisplayName} Courses Completed!`,
          description: `Outstanding achievement! You have completed every required course in your ${trackDisplayName}. Review lessons, practice with the AI Coach, or request your official Certificate.`,
          rating: 5.0,
          reviews: "Track Mastered",
          enrolled: "Certified",
          status: "Completed",
          progress: 100,
          lessonsRemaining: "All lessons complete",
          instructor: "Train AI Academy",
          instructorRole: "Certification Board",
          instructorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
          coverImage: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80",
          cta: "Review Completed Material",
          action: "explore",
          lessonsText: `${fallbackTrackCourses.length} Courses Complete`
        }
      ]
    : uncompletedTrackCourses.map((c, idx) => ({
        id: c.id,
        badge: c.enrolled ? (c.progress > 0 ? `IN PROGRESS • ${c.progress}% DONE` : "ENROLLED • READY TO START") : `COURSE 0${idx + 1} • REQUIRED FOR TRACK`,
        badgeGradient: idx === 0 ? "#059669" : idx === 1 ? "#2563EB" : "#D97706",
        cohortTag: trackDisplayName,
        pathwayName: trackDisplayName,
        title: c.title,
        description: c.tagline || c.description || `Essential course for your ${trackDisplayName}. Master production workflows and hands-on competencies.`,
        rating: c.rating || 4.9,
        reviews: `${c.reviewsCount || 420} reviews`,
        enrolled: `${c.studentsCount || "1.2k"} Enrolled`,
        status: c.enrolled ? "In Progress" : "Required",
        progress: c.progress || 0,
        lessonsRemaining: `${c.lessons || c.lessonsCount || 12} lessons`,
        instructor: c.instructor || "Curriculum Specialist",
        instructorRole: c.instructorRole || "Lead Instructor",
        instructorAvatar: c.instructorAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        coverImage: c.coverImageUrl || c.image || getSafeCoverImage(c, idx),
        cta: c.enrolled ? (c.progress > 0 ? "Resume Lesson" : "Start Course") : "Enroll & Start Course",
        action: c.enrolled ? "continue" : "explore",
        lessonsText: `${c.lessons || c.lessonsCount || 12} Lessons • ${c.hours || 8} hrs`
      }));

  const currentSpotlight = dynamicSpotlightSlides[activeSlide % dynamicSpotlightSlides.length] || dynamicSpotlightSlides[0];
  const switcherScrollRef = useRef(null);

  // Auto-scroll the active course card into view when activeSlide changes
  useEffect(() => {
    if (!switcherScrollRef.current) return;
    const activeEl = switcherScrollRef.current.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [activeSlide]);

  // Auto-rotating Spotlight Carousel (only rotates if there are multiple active uncompleted courses in the track)
  useEffect(() => {
    if (isCarouselPaused || dynamicSpotlightSlides.length <= 1) return;
    const interval = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % dynamicSpotlightSlides.length);
    }, 4800);
    return () => clearInterval(interval);
  }, [isCarouselPaused, dynamicSpotlightSlides.length]);

  const enrolledList = allAvailableCourses.filter(c => c.enrolled);

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
          DYNAMIC MOVING SPOTLIGHT HERO CAROUSEL (LEARNER TRACK FOCUSED)
          ========================================================================= */}
      {currentSpotlight && (
        <div
          className="tai-card tai-hero-card tai-hero-dark anim-fluid-entrance"
          onMouseEnter={() => setIsCarouselPaused(true)}
          onMouseLeave={() => setIsCarouselPaused(false)}
          style={{
            position: "relative",
            borderRadius: 14,
            overflow: "hidden",
            padding: "clamp(18px, 2.5vw, 24px)",
            transition: "all 0.3s ease"
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 24, alignItems: "center", position: "relative", zIndex: 1, width: "100%", boxSizing: "border-box" }}>
            
            {/* Left Column: Spotlight details */}
            <div style={{ minWidth: 0, boxSizing: "border-box" }}>
              <div className="tai-row tai-between" style={{ marginBottom: 12, alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8" }}>
                  {trackDisplayName} • Course {(activeSlide % dynamicSpotlightSlides.length) + 1} of {dynamicSpotlightSlides.length}
                </div>

                {/* Prev / Next Controls if multiple active uncompleted courses */}
                {dynamicSpotlightSlides.length > 1 && (
                  <div className="tai-row tai-gap6" style={{ alignItems: "center" }}>
                    <button
                      aria-label="Previous Slide"
                      onClick={() => setActiveSlide(prev => (prev - 1 + dynamicSpotlightSlides.length) % dynamicSpotlightSlides.length)}
                      style={{
                        width: 28, height: 28, borderRadius: 6, border: "1px solid rgba(255,255,255,0.18)",
                        background: "rgba(255,255,255,0.08)", color: "#FFFFFF", display: "flex", alignItems: "center",
                        justifyContent: "center", cursor: "pointer", transition: "background 0.15s ease"
                      }}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      aria-label="Next Slide"
                      onClick={() => setActiveSlide(prev => (prev + 1) % dynamicSpotlightSlides.length)}
                      style={{
                        width: 28, height: 28, borderRadius: 6, border: "1px solid rgba(255,255,255,0.18)",
                        background: "rgba(255,255,255,0.08)", color: "#FFFFFF", display: "flex", alignItems: "center",
                        justifyContent: "center", cursor: "pointer", transition: "background 0.15s ease"
                      }}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>

              <h1 key={currentSpotlight.id + "-title"} className="tai-fade-in tai-hero-title" style={{ fontSize: "clamp(20px, 2.5vw, 25px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 6px", lineHeight: 1.25 }}>
                {currentSpotlight.title}
              </h1>

              <p key={currentSpotlight.id + "-desc"} className="tai-fade-in tai-hero-desc" style={{ fontSize: 13, margin: "0 0 12px", lineHeight: 1.45, maxWidth: 540 }}>
                {currentSpotlight.description}
              </p>

              {/* In-Progress Sprint Pace Meter */}
              {currentSpotlight.progress > 0 && !currentSpotlight.isTrackCompleted && (
                <div className="tai-hero-subcard" style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 12 }}>
                  <div className="tai-row tai-between" style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 6, color: "#DBEAFE" }}>
                    <span>Active Sprint Pace</span>
                    <span style={{ color: "#34D399", fontWeight: 700 }}>{currentSpotlight.progress}% ({currentSpotlight.lessonsRemaining})</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: "rgba(255, 255, 255, 0.12)", overflow: "hidden" }}>
                    <div style={{ width: `${currentSpotlight.progress}%`, height: "100%", background: "#10B981", borderRadius: 99 }} />
                  </div>
                </div>
              )}

              <div className="tai-row tai-gap12" style={{ flexWrap: "wrap", marginBottom: 14, fontSize: 12, color: "#94A3B8" }}>
                <div className="tai-row tai-gap4">
                  <Star size={13} fill="#F59E0B" color="#F59E0B" />
                  <span style={{ fontWeight: 800, color: "#fff" }}>{currentSpotlight.rating}</span>
                  <span style={{ opacity: 0.75 }}>({currentSpotlight.reviews})</span>
                </div>
                <span>•</span>
                <div className="tai-row tai-gap4">
                  <Users size={13} color="#60A5FA" />
                  <span style={{ fontWeight: 700, color: "#fff" }}>{currentSpotlight.enrolled}</span>
                </div>
                <span>•</span>
                <div className="tai-row tai-gap4">
                  <ShieldCheck size={13} color="#34D399" />
                  <span style={{ fontWeight: 700, color: "#34D399" }}>Certificate Available</span>
                </div>
              </div>

              <div className="tai-row tai-gap10" style={{ flexWrap: "wrap" }}>
                <button
                  className="tai-btn tai-btn-primary"
                  style={{
                    padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                    display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer"
                  }}
                  onClick={() => {
                    if (currentSpotlight.isTrackCompleted) {
                      setShowMyCoursesOnly(true);
                    } else {
                      push("courseDetail", { id: currentSpotlight.id });
                    }
                  }}
                >
                  <span>{currentSpotlight.cta}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>

            {/* Right Column: Visual Cover */}
            <div className="tai-desktop-only" style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 12, boxSizing: "border-box" }}>
              <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", boxShadow: "0 12px 30px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.18)" }}>
                <img
                  key={currentSpotlight.id + "-img"}
                  src={currentSpotlight.coverImage}
                  alt={currentSpotlight.title}
                  style={{ width: "100%", height: 185, objectFit: "cover", display: "block" }}
                />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(11,15,25,0.88) 0%, transparent 60%)" }} />
                
                <div style={{ position: "absolute", bottom: 12, left: 14, right: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div className="tai-row tai-gap10">
                    <img
                      src={currentSpotlight.instructorAvatar}
                      alt={currentSpotlight.instructor}
                      style={{ width: 34, height: 34, borderRadius: "50%", border: "2px solid #fff", objectFit: "cover" }}
                    />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: "#fff" }}>{currentSpotlight.instructor}</div>
                      <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.75)" }}>{currentSpotlight.instructorRole}</div>
                    </div>
                  </div>

                  <span style={{ background: "rgba(0,0,0,0.6)", padding: "3px 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 700, border: "1px solid rgba(255,255,255,0.2)" }}>
                    {currentSpotlight.lessonsText}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Full-Width Seamless Track Course Switcher Strip */}
          {dynamicSpotlightSlides.length > 1 && (
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255, 255, 255, 0.12)", position: "relative", zIndex: 1, width: "100%", boxSizing: "border-box" }}>
              <div className="tai-row tai-between" style={{ alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Track Curriculum • {dynamicSpotlightSlides.length} Courses
                </div>
                <div className="tai-row tai-gap6" style={{ alignItems: "center" }}>
                  <button
                    aria-label="Scroll Switcher Left"
                    onClick={() => {
                      if (switcherScrollRef.current) {
                        switcherScrollRef.current.scrollBy({ left: -220, behavior: "smooth" });
                      }
                    }}
                    style={{
                      width: 24, height: 24, borderRadius: 6, border: "1px solid rgba(255,255,255,0.18)",
                      background: "rgba(255,255,255,0.08)", color: "#FFFFFF", display: "flex", alignItems: "center",
                      justifyContent: "center", cursor: "pointer"
                    }}
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <button
                    aria-label="Scroll Switcher Right"
                    onClick={() => {
                      if (switcherScrollRef.current) {
                        switcherScrollRef.current.scrollBy({ left: 220, behavior: "smooth" });
                      }
                    }}
                    style={{
                      width: 24, height: 24, borderRadius: 6, border: "1px solid rgba(255,255,255,0.18)",
                      background: "rgba(255,255,255,0.08)", color: "#FFFFFF", display: "flex", alignItems: "center",
                      justifyContent: "center", cursor: "pointer"
                    }}
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>

              <div
                ref={switcherScrollRef}
                style={{
                  display: "flex",
                  gap: 10,
                  width: "100%",
                  boxSizing: "border-box",
                  overflowX: "auto",
                  scrollBehavior: "smooth",
                  WebkitOverflowScrolling: "touch",
                  padding: "2px 2px 6px",
                  scrollbarWidth: "none",
                  msOverflowStyle: "none"
                }}
              >
                {dynamicSpotlightSlides.map((slide, idx) => {
                  const isSelected = idx === (activeSlide % dynamicSpotlightSlides.length);
                  return (
                    <button
                      key={slide.id}
                      data-active={isSelected ? "true" : "false"}
                      onClick={() => setActiveSlide(idx)}
                      title={slide.title}
                      style={{
                        flex: "0 0 auto",
                        minWidth: 150,
                        maxWidth: 200,
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: isSelected ? "1.5px solid #60A5FA" : "1px solid rgba(255,255,255,0.14)",
                        background: isSelected ? "rgba(59, 130, 246, 0.35)" : "rgba(255,255,255,0.06)",
                        color: isSelected ? "#FFFFFF" : "rgba(255,255,255,0.7)",
                        cursor: "pointer",
                        textAlign: "left",
                        boxShadow: isSelected ? "0 4px 14px rgba(37, 99, 235, 0.35)" : "none",
                        transition: "all 0.2s ease"
                      }}
                    >
                      <div className="tai-row tai-between" style={{ alignItems: "center", marginBottom: 3 }}>
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 800,
                            color: isSelected ? "#93C5FD" : "rgba(255,255,255,0.5)",
                            letterSpacing: "0.04em",
                            textTransform: "uppercase"
                          }}
                        >
                          Course 0{idx + 1}
                        </span>
                        {slide.progress === 100 ? (
                          <span style={{ fontSize: 9, fontWeight: 700, color: "#34D399" }}>Done ✓</span>
                        ) : isSelected ? (
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#60A5FA" }} />
                        ) : null}
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          lineHeight: 1.3,
                          color: isSelected ? "#FFFFFF" : "rgba(255,255,255,0.9)"
                        }}
                      >
                        {slide.title}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Carousel Dot Indicators if multiple courses */}
          {dynamicSpotlightSlides.length > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14 }}>
              {dynamicSpotlightSlides.map((_, idx) => (
                <button
                  key={idx}
                  aria-label={`Slide ${idx + 1}`}
                  onClick={() => setActiveSlide(idx)}
                  style={{
                    width: idx === (activeSlide % dynamicSpotlightSlides.length) ? 24 : 7,
                    height: 7,
                    borderRadius: 99,
                    background: idx === (activeSlide % dynamicSpotlightSlides.length) ? "#60A5FA" : "rgba(255,255,255,0.22)",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    transition: "all 0.25s ease"
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

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
