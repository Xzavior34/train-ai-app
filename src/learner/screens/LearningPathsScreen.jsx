import React, { useState } from "react";
import { TopBar, Tag, ProgressBar } from "../components/LearnerUI.jsx";
import { 
  Map, Award, BookOpen, Clock, CheckCircle2, Star, 
  Users, ArrowRight, ChevronRight, Layers, 
  ShieldCheck, Filter, Search, Play, Check, X, Laptop,
  Compass, Zap
} from "lucide-react";
import { PortalModal } from "../../components/common/PortalModal.jsx";

const TRACK_CATEGORIES = [
  { id: "all", label: "All Career Tracks" },
  { id: "ai", label: "AI & Machine Learning" },
  { id: "design", label: "UI/UX & Spatial Design" },
  { id: "engineering", label: "Full-Stack & Web Dev" },
  { id: "cloud", label: "Cloud & DevOps" },
  { id: "product", label: "Product & Strategy" }
];

export const LEARNING_TRACKS = [
  {
    id: "track-ai-product-eng",
    title: "AI Product Design & Spatial Systems Specialization",
    category: "design",
    categoryLabel: "UI/UX & Spatial Design",
    provider: "Train AI Academy • Apple & Figma Partner",
    badge: "PROFESSIONAL CERTIFICATE",
    badgeColor: "#4F46E5",
    image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=80",
    description: "Master modern AI design workflows, generative prototyping, vector token pipelines, and visionOS spatial interface design with direct industry certification.",
    progress: 68,
    isEnrolled: true,
    totalHours: "48 Hours",
    coursesCount: 4,
    rating: 4.9,
    reviews: "3,420",
    enrolledCount: "14.2k",
    targetRole: "Senior AI Product Designer / Spatial Experience Architect",
    skills: ["Figma AI", "Design Tokens", "VisionOS Ergonomics", "Spatial Three.js", "Generative UI"],
    courses: [
      {
        id: "course-figma-ai",
        step: 1,
        title: "Master Design Systems in Figma with AI",
        duration: "14 Hours",
        status: "completed",
        instructor: "Astrid Larsson",
        instructorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 24,
        description: "Variables 2.0, token aliases, auto-layout 5.0, and AI layout plugins."
      },
      {
        id: "course-spatial-ui",
        step: 2,
        title: "Spatial Computing & VisionOS Design Foundations",
        duration: "14 Hours",
        status: "in_progress",
        instructor: "Sarah Connor",
        instructorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 18,
        description: "Depth hierarchies, spatial audio, glassmorphism tokens, and eye-tracking UX."
      },
      {
        id: "course-prompt-pro",
        step: 3,
        title: "Generative AI UI Prototyping & Dynamic Interfaces",
        duration: "10 Hours",
        status: "upcoming",
        instructor: "Elena Rostova",
        instructorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 16,
        description: "Zero-shot UI prompt schemas, component generation, and real-time state hydration."
      },
      {
        id: "course-fullstack-ai",
        step: 4,
        title: "Capstone: Production Enterprise Spatial Design System",
        duration: "10 Hours",
        status: "upcoming",
        instructor: "Alex Rivera",
        instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 12,
        description: "Deliver an end-to-end multi-platform design token system evaluated by staff architects."
      }
    ]
  },
  {
    id: "track-fullstack-ai-eng",
    title: "Full-Stack Generative AI Application Architect",
    category: "ai",
    categoryLabel: "AI & Machine Learning",
    provider: "Train AI Engineering Labs • Anthropic & OpenAI",
    badge: "CAREER TRACK",
    badgeColor: "#059669",
    image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80",
    description: "Build, evaluate, and scale production-grade multi-agent applications with Python FastAPI backends, LangChain orchestration, vector embeddings, and React 19.",
    progress: 25,
    isEnrolled: true,
    totalHours: "56 Hours",
    coursesCount: 4,
    rating: 4.9,
    reviews: "2,890",
    enrolledCount: "18.6k",
    targetRole: "Principal AI Engineer / LLM Systems Architect",
    skills: ["LangChain", "Vector Databases", "FastAPI", "React 19", "Autonomous Agents", "RAG"],
    courses: [
      {
        id: "course-prompt-pro",
        step: 1,
        title: "Prompt Engineering & Multi-Modal Foundation Models",
        duration: "12 Hours",
        status: "completed",
        instructor: "Elena Rostova",
        instructorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 16,
        description: "Zero-shot, chain-of-thought, function calling JSON schemas, and automated evals."
      },
      {
        id: "course-fullstack-ai",
        step: 2,
        title: "Full-Stack AI Application Engineering with React 19",
        duration: "20 Hours",
        status: "in_progress",
        instructor: "Alex Rivera",
        instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 32,
        description: "FastAPI REST/WebSocket gateways, Supabase pgvector, and responsive client state."
      },
      {
        id: "course-cloud-devops",
        step: 3,
        title: "Enterprise RAG, Vector Search & Knowledge Graphs",
        duration: "12 Hours",
        status: "upcoming",
        instructor: "David Vance",
        instructorAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 18,
        description: "Hierarchical chunking, re-ranking models, hybrid lexical/dense search."
      },
      {
        id: "course-product-metrics",
        step: 4,
        title: "Capstone: Autonomous Multi-Agent Copilot Deployment",
        duration: "12 Hours",
        status: "upcoming",
        instructor: "Marcus Wright",
        instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 14,
        description: "Deploy a production-grade multi-agent workflow with observability & tracing."
      }
    ]
  },
  {
    id: "track-cloud-devops-mlops",
    title: "Cloud Infrastructure, Kubernetes & AI MLOps",
    category: "cloud",
    categoryLabel: "Cloud & DevOps",
    provider: "Train AI Cloud Labs • Google Cloud Certified",
    badge: "INDUSTRY ACCREDITED",
    badgeColor: "#D97706",
    image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80",
    description: "Architect resilient cloud-native infrastructure, Kubernetes clusters, GPU inference pipelines, automated CI/CD releases, and telemetry observability.",
    progress: 0,
    isEnrolled: false,
    totalHours: "42 Hours",
    coursesCount: 3,
    rating: 4.8,
    reviews: "1,420",
    enrolledCount: "9.3k",
    targetRole: "Lead MLOps Engineer / Cloud DevOps Architect",
    skills: ["Kubernetes", "Docker", "GPU Autoscaling", "Prometheus / Grafana", "CI/CD Pipelines"],
    courses: [
      {
        id: "course-cloud-devops",
        step: 1,
        title: "Cloud Native Microservices & Docker Containerization",
        duration: "16 Hours",
        status: "upcoming",
        instructor: "David Vance",
        instructorAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 22,
        description: "Multi-stage Docker builds, image hardening, and container orchestration."
      },
      {
        id: "course-fullstack-ai",
        step: 2,
        title: "Kubernetes Clustering & GPU Inference Workloads",
        duration: "14 Hours",
        status: "upcoming",
        instructor: "Alex Rivera",
        instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 18,
        description: "Horizontal Pod Autoscalers, Helm charts, and low-latency Triton GPU serving."
      },
      {
        id: "course-product-metrics",
        step: 3,
        title: "Telemetry, Distributed Tracing & Continuous Deployment",
        duration: "12 Hours",
        status: "upcoming",
        instructor: "Marcus Wright",
        instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 16,
        description: "OpenTelemetry, Grafana dashboards, zero-downtime rolling updates."
      }
    ]
  },
  {
    id: "track-product-ai-strategy",
    title: "AI Product Management, Growth & Data Strategy",
    category: "product",
    categoryLabel: "Product & Strategy",
    provider: "Train AI Executive Education",
    badge: "EXECUTIVE CERTIFICATE",
    badgeColor: "#7C3AED",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80",
    description: "Lead AI product transformations, leverage experimentation flywheels, calculate model ROI, and design retention mechanics for AI-powered platforms.",
    progress: 0,
    isEnrolled: false,
    totalHours: "38 Hours",
    coursesCount: 3,
    rating: 4.9,
    reviews: "1,120",
    enrolledCount: "7.8k",
    targetRole: "VP of Product / AI Growth Director",
    skills: ["AI Roadmapping", "Cohort Retention", "A/B Experimentation", "Product-Led Growth", "Model ROI"],
    courses: [
      {
        id: "course-product-metrics",
        step: 1,
        title: "Data-Driven Product Management & Growth Flywheels",
        duration: "14 Hours",
        status: "upcoming",
        instructor: "Marcus Wright",
        instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 20,
        description: "Cohort retention analysis, pirate metrics (AARRR), and growth experiments."
      },
      {
        id: "course-prompt-pro",
        step: 2,
        title: "Evaluating AI Features, Cost Economics & Latency Budgets",
        duration: "12 Hours",
        status: "upcoming",
        instructor: "Elena Rostova",
        instructorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 16,
        description: "Token economics, model distillation tradeoffs, and guardrail architectures."
      },
      {
        id: "course-figma-ai",
        step: 3,
        title: "Capstone: Enterprise AI Product Strategy Pitch",
        duration: "12 Hours",
        status: "upcoming",
        instructor: "Astrid Larsson",
        instructorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 14,
        description: "Comprehensive product requirements document (PRD) and business case."
      }
    ]
  }
];

export function LearningPathsScreen({ push, back }) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTrack, setSelectedTrack] = useState(null);

  const filteredTracks = LEARNING_TRACKS.filter(track => {
    const matchesCategory = selectedCategory === "all" || track.category === selectedCategory;
    const matchesSearch = searchQuery === "" ||
      track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      {/* =========================================================================
          LEARNING PATHS HERO BANNER
          ========================================================================= */}
      <div
        style={{
          position: "relative",
          borderRadius: 10,
          overflow: "hidden",
          background: "#0F172A",
          color: "#FFFFFF",
          padding: "clamp(16px, 2.5vw, 24px)",
          boxShadow: "0 4px 16px rgba(15, 23, 42, 0.2)",
          border: "1px solid #1E293B"
        }}
      >
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="tai-row tai-gap10" style={{ flexWrap: "wrap", marginBottom: 10 }}>
            <span style={{
              background: "rgba(99, 102, 241, 0.35)", color: "#E0E7FF",
              border: "1px solid rgba(165, 180, 252, 0.5)",
              fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99,
              display: "inline-flex", alignItems: "center", gap: 6, letterSpacing: "0.03em"
            }}>
              <Compass size={13} color="#A5B4FC" /> CAREER ROADMAPS &amp; SPECIALIZATIONS
            </span>
            <span style={{
              background: "rgba(16, 185, 129, 0.28)", color: "#A7F3D0",
              border: "1px solid rgba(16, 185, 129, 0.5)",
              fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99
            }}>
              ACCREDITED CERTIFICATE INCLUDED
            </span>
          </div>

          <h1 style={{ fontSize: "clamp(22px, 3vw, 30px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 8px", color: "#FFFFFF" }}>
            Learning Paths &amp; Career Tracks
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", margin: 0, maxWidth: 640, lineHeight: 1.5 }}>
            Master job-ready competencies through sequenced, multi-course roadmaps. Complete progressive capstones and earn verified industry certificates.
          </p>

          {/* Quick Metrics */}
          <div className="tai-row tai-gap16 tai-mt20" style={{ flexWrap: "wrap" }}>
            <div style={{ background: "rgba(255,255,255,0.1)", padding: "8px 14px", borderRadius: 8, backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>ACTIVE ENROLLED TRACKS</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#34D399" }}>2 In Progress</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.1)", padding: "8px 14px", borderRadius: 8, backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>TOTAL CURRICULUM</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#FFFFFF" }}>180+ Hours • 14 Courses</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar Strip */}
      <div className="tai-card" style={{ padding: "14px 18px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          
          {/* Categories Pills */}
          <div className="tai-scrollx tai-gap6" style={{ paddingBottom: 2 }}>
            {TRACK_CATEGORIES.map(cat => {
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
                    boxShadow: isSelected ? "0 4px 12px rgba(79, 70, 229, 0.25)" : "none"
                  }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="tai-row tai-gap8" style={{ flex: "1 1 240px", maxWidth: 320, minWidth: 200, position: "relative" }}>
            <Search size={15} color="var(--text-3)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Search tracks by skill, title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%", height: 38, paddingLeft: 36, paddingRight: 12,
                borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--surface-2)",
                fontSize: 13, color: "var(--text)", outline: "none"
              }}
            />
          </div>

        </div>
      </div>

      {/* Career Tracks Cards Grid */}
      <div className="tai-col tai-gap20 anim-stagger">
        {filteredTracks.map((track) => (
          <div
            key={track.id}
            className="tai-card tai-card-hover"
            style={{
              padding: 0,
              borderRadius: 10,
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
                  {track.coursesCount} Course Series
                </span>
              </div>

              <div style={{ position: "absolute", bottom: 12, left: 16, right: 16 }} className="tai-row tai-between">
                <div style={{ fontSize: 12, color: "#E0E7FF", fontWeight: 700 }}>
                  {track.provider}
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

                {track.isEnrolled && (
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
                  Curriculum Sequence ({track.coursesCount} Milestone Modules)
                </div>

                {track.courses.map((course, idx) => (
                  <div
                    key={course.id || idx}
                    className="tai-row tai-between"
                    style={{
                      padding: "10px 14px",
                      background: course.status === "in_progress" ? "var(--primary-tint, #EFF6FF)" : "var(--surface-2)",
                      borderRadius: 8,
                      border: course.status === "in_progress" ? "1.5px solid var(--primary)" : "1px solid var(--border)"
                    }}
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
                        {course.status === "completed" ? "COMPLETED" : course.status === "in_progress" ? "IN PROGRESS" : "UPCOMING"}
                      </Tag>
                    </div>
                  </div>
                ))}
              </div>

              {/* Card Footer Actions */}
              <div className="tai-row tai-between tai-mt18" style={{ paddingTop: 14, borderTop: "1px solid var(--border)", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                <div className="tai-row tai-gap6" style={{ fontSize: 12.5, color: "var(--text-3)", fontWeight: 600 }}>
                  <ShieldCheck size={16} color="#10B981" />
                  <span>Target Outcome: <strong>{track.targetRole}</strong></span>
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
                    onClick={() => {
                      const firstActiveCourse = track.courses.find(c => c.status === "in_progress") || track.courses[0];
                      push("courseDetail", { id: firstActiveCourse.id });
                    }}
                  >
                    {track.isEnrolled ? "Continue Track →" : "Start Learning Path →"}
                  </button>
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>

      {/* Detailed Track Modal */}
      {selectedTrack && (
        <PortalModal isOpen={true} onClose={() => setSelectedTrack(null)} title={selectedTrack.title}>
          <div style={{ padding: "6px 0" }}>
            <div style={{ position: "relative", height: 140, borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
              <img src={selectedTrack.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(15,23,42,0.85) 0%, transparent 60%)" }} />
              <div style={{ position: "absolute", bottom: 12, left: 14, right: 14, color: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#A5B4FC" }}>{selectedTrack.provider}</div>
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
                    <span style={{ fontWeight: 800, fontSize: 13, color: "var(--text)" }}>Module {i + 1}: {c.title}</span>
                    <Tag tone="primary">{c.duration}</Tag>
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
                  push("courseDetail", { id: targetCourse.id });
                }}
              >
                Launch Track Curriculum →
              </button>
            </div>
          </div>
        </PortalModal>
      )}

    </div>
  );
}

export default LearningPathsScreen;
