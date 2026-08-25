import React, { useState } from "react";
import { TopBar, Tag, ProgressBar } from "../components/LearnerUI.jsx";
import { 
  Map, Award, BookOpen, Clock, CheckCircle2, Star, 
  Users, ArrowRight, ChevronRight, Layers, 
  ShieldCheck, Filter, Search, Play, Check, X, Laptop,
  Compass, Zap
} from "lucide-react";
import { PortalModal } from "../../components/common/PortalModal.jsx";
import { isMockDataEnabled } from "../../lib/mockDataManager.js";

const TRACK_CATEGORIES = [
  { id: "all", label: "All Learning Pathways" },
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
    badgeColor: "#2563EB",
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
        description: "Eye-tracking ergonomics, depth layers, glassmorphism materials, and gesture canvas."
      },
      {
        id: "course-fullstack-ai",
        step: 3,
        title: "Autonomous Agents & Generative UI Pipelines",
        duration: "12 Hours",
        status: "upcoming",
        instructor: "Alex Rivera",
        instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 16,
        description: "Function-calling schemas, dynamic generative component streaming, and model evaluations."
      },
      {
        id: "course-prompt-pro",
        step: 4,
        title: "Capstone: Production Spatial AI Interface",
        duration: "8 Hours",
        status: "upcoming",
        instructor: "Astrid Larsson",
        instructorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 12,
        description: "End-to-end portfolio case study reviewed and certified by senior industry mentors."
      }
    ]
  },
  {
    id: "track-fullstack-agent-eng",
    title: "Full-Stack AI Agent & Systems Engineering",
    category: "engineering",
    categoryLabel: "Full-Stack & Web Dev",
    provider: "Train AI Engineering Consortium",
    badge: "ENGINEERING DIPLOMA",
    badgeColor: "#059669",
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80",
    description: "Architect production agent systems, LangChain / LlamaIndex graphs, real-time vector embeddings, and zero-latency microservices with automated evaluation suites.",
    progress: 0,
    isEnrolled: false,
    totalHours: "64 Hours",
    coursesCount: 4,
    rating: 4.95,
    reviews: "2,840",
    enrolledCount: "11.6k",
    targetRole: "Lead AI Engineer / Agent Platform Architect",
    skills: ["LangChain", "FastAPI", "Pinecone / Qdrant", "Python 3.12", "Evals & Guardrails"],
    courses: [
      {
        id: "course-fullstack-ai",
        step: 1,
        title: "Full-Stack AI Application Engineering",
        duration: "26 Hours",
        status: "upcoming",
        instructor: "Alex Rivera",
        instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 32,
        description: "FastAPI endpoints, streaming SSE, Postgres pgvector, and React client architecture."
      },
      {
        id: "course-prompt-pro",
        step: 2,
        title: "Advanced Prompt Engineering & Chain-of-Thought",
        duration: "12 Hours",
        status: "upcoming",
        instructor: "Elena Rostova",
        instructorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 16,
        description: "Few-shot prompting, self-consistency sampling, and automated red-teaming benchmarks."
      },
      {
        id: "course-cloud-devops",
        step: 3,
        title: "Deploying Multi-Agent Graphs to Kubernetes",
        duration: "14 Hours",
        status: "upcoming",
        instructor: "Elena Rostova",
        instructorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 18,
        description: "Containerization, auto-scaling HPA, distributed Redis queues, and canary rollouts."
      },
      {
        id: "course-spatial-ui",
        step: 4,
        title: "Capstone: Autonomous Customer Support Agent Platform",
        duration: "12 Hours",
        status: "upcoming",
        instructor: "Alex Rivera",
        instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 14,
        description: "Production capstone deployment featuring live telemetry, SLA tracking, and synthetic evals."
      }
    ]
  },
  {
    id: "track-cloud-ai-ops",
    title: "Cloud Infrastructure, Kubernetes & AI DevOps",
    category: "cloud",
    categoryLabel: "Cloud & DevOps",
    provider: "Train AI Cloud Systems",
    badge: "CLOUD ARCHITECT CERTIFICATE",
    badgeColor: "#D97706",
    image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80",
    description: "Master enterprise cloud engineering, Terraform infrastructure-as-code, high-throughput GPU model serving, and zero-trust IAM security architectures.",
    progress: 0,
    isEnrolled: false,
    totalHours: "52 Hours",
    coursesCount: 3,
    rating: 4.88,
    reviews: "1,980",
    enrolledCount: "9.1k",
    targetRole: "Senior Cloud Architect / MLOps Platform Lead",
    skills: ["Kubernetes", "Terraform", "Docker", "vLLM Serving", "CI/CD Pipelines"],
    courses: [
      {
        id: "course-cloud-devops",
        step: 1,
        title: "Cloud Native Microservices & Kubernetes",
        duration: "20 Hours",
        status: "upcoming",
        instructor: "Elena Rostova",
        instructorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 22,
        description: "GKE clusters, Helm chart deployments, ingress controllers, and service meshes."
      },
      {
        id: "course-fullstack-ai",
        step: 2,
        title: "High-Throughput Model Serving & GPU Orchestration",
        duration: "16 Hours",
        status: "upcoming",
        instructor: "Alex Rivera",
        instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 18,
        description: "vLLM, TensorRT-LLM, batching optimization, and Ray distributed compute."
      },
      {
        id: "course-prompt-pro",
        step: 3,
        title: "Observability, Telemetry & SRE for AI Workloads",
        duration: "16 Hours",
        status: "upcoming",
        instructor: "Marcus Wright",
        instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        lessonsCount: 16,
        description: "OpenTelemetry, Grafana dashboards, zero-downtime rolling updates."
      }
    ]
  }
];

export function LearningPathsScreen({ push, back, pathsQuery, pathEnrollmentsQuery, session, showToast }) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTrack, setSelectedTrack] = useState(null);

  const rawPaths = pathsQuery?.data || [];
  const realTracks = rawPaths.map((p, idx) => {
    const isEnrolled = (pathEnrollmentsQuery?.data || []).some(e => e.learning_path_id === p.id);
    return {
      id: p.id,
      title: p.title || "Learning Pathway",
      category: p.category || "ai",
      categoryLabel: p.category || "Learning Pathway",
      provider: p.provider || "Train AI Academy",
      badge: p.badge_title || "PROFESSIONAL CERTIFICATE",
      badgeColor: idx % 2 === 0 ? "#2563EB" : "#2563EB",
      image: p.cover_image_url || "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=80",
      description: p.description || "Master core competencies, practical workflows, and real-world project deliverables.",
      progress: isEnrolled ? 25 : 0,
      isEnrolled: isEnrolled,
      totalHours: `${p.estimated_hours || 32} Hours`,
      coursesCount: p.courses_count || p.courses?.length || 3,
      rating: p.rating || 4.9,
      reviews: "420",
      enrolledCount: `${p.enrolled_count || 1.2}k`,
      targetRole: p.target_role || "Specialist",
      skills: p.skills || ["Core Fundamentals", "Architecture", "Hands-on Projects"],
      courses: (p.courses || []).map((c, cIdx) => ({
        id: c.course_id || c.id || `c-${cIdx}`,
        step: cIdx + 1,
        title: c.title || "Core Course",
        duration: `${c.hours || 10} Hours`,
        status: cIdx === 0 && isEnrolled ? "in_progress" : "upcoming",
        instructor: c.instructor || "Instructor",
        instructorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        lessonsCount: c.lessons_count || 12,
        description: c.description || "In-depth curriculum modules and assessments."
      }))
    };
  });

  const allTracks = realTracks.length > 0 ? realTracks : (isMockDataEnabled() ? LEARNING_TRACKS : []);

  const filteredTracks = allTracks.filter(track => {
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
      {/* =========================================================================
          LEARNING PATHS HERO BANNER (Adaptive Liquid Glass)
          ========================================================================= */}      <div
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
          <h1 className="tai-hero-title" style={{ fontSize: "clamp(22px, 3vw, 28px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 8px", lineHeight: 1.2 }}>
            Learning Paths &amp; Learning Pathways
          </h1>
          <p className="tai-hero-desc" style={{ fontSize: 13.5, margin: 0, maxWidth: 640, lineHeight: 1.5 }}>
            Master job-ready competencies through sequenced, multi-course roadmaps. Complete progressive capstones and earn verified industry certificates.
          </p>

          {/* Quick Metrics */}
          <div className="tai-row tai-gap16 tai-mt20" style={{ flexWrap: "wrap" }}>
            <div className="tai-hero-subcard" style={{ padding: "10px 16px", borderRadius: 10 }}>
              <div style={{ fontSize: 10.5, color: "#94A3B8", fontWeight: 700 }}>ACTIVE ENROLLED TRACKS</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#34D399" }}>2 In Progress</div>
            </div>
            <div className="tai-hero-subcard" style={{ padding: "10px 16px", borderRadius: 10 }}>
              <div style={{ fontSize: 10.5, color: "#94A3B8", fontWeight: 700 }}>TOTAL CURRICULUM</div>
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
                    boxShadow: isSelected ? "0 4px 12px rgba(37, 99, 235, 0.25)" : "none"
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

      {/* Learning Pathways Cards Grid */}
      <div className="tai-col tai-gap20 anim-stagger">
        {filteredTracks.length === 0 && (
          <div className="tai-card" style={{ textAlign: "center", padding: "48px 24px", borderRadius: 10 }}>
            <Map size={36} color="var(--text-3)" style={{ margin: "0 auto 12px", opacity: 0.6 }} />
            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>
              {searchQuery || selectedCategory !== "all" ? "No learning paths match your filter" : "No learning paths available"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4, maxWidth: 440, margin: "4px auto 0" }}>
              {searchQuery || selectedCategory !== "all" ? "Try selecting a different category or clearing your search term." : "Career roadmaps and Learning Pathways created by administrators will appear here."}
            </div>
          </div>
        )}

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
                <div style={{ fontSize: 12, color: "#DBEAFE", fontWeight: 700 }}>
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
