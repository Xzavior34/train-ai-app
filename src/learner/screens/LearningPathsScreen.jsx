import React, { useState, useMemo } from "react";
import { TopBar, Tag, ProgressBar } from "../components/LearnerUI.jsx";
import {
  Map as MapIcon, Compass, BookOpen, CheckCircle2, Lock, Unlock,
  Play, ArrowRight, Trophy, Clock, Layers, Award,
  ChevronRight, Users, ShieldCheck, AlertCircle, RefreshCw, X, Check,
  ExternalLink, Sparkles, Flame, Zap, Cpu, Code2, Database, Briefcase,
  GraduationCap, Target, ArrowUpRight, Search, Star, Milestone
} from "lucide-react";
import { enrollInLearningPath, leaveLearningPath } from "../../lib/api/learner.js";

// Helper: Assign domain icons, colors and target career outcomes to learning paths
function getTrackTheme(title = "", category = "") {
  const t = (title + " " + category).toLowerCase();
  if (t.includes("ai") || t.includes("machine learning") || t.includes("prompt") || t.includes("llm") || t.includes("gpt")) {
    return {
      icon: Sparkles,
      color: "#6366F1",
      gradient: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
      bgSubtle: "rgba(99, 102, 241, 0.08)",
      borderSubtle: "rgba(99, 102, 241, 0.25)",
      accentText: "#4F46E5",
      domain: "Artificial Intelligence",
      targetRole: "AI Specialist & Solutions Architect"
    };
  }
  if (t.includes("code") || t.includes("engineer") || t.includes("dev") || t.includes("software") || t.includes("react") || t.includes("stack")) {
    return {
      icon: Code2,
      color: "#2563EB",
      gradient: "linear-gradient(135deg, #2563EB 0%, #0284C7 100%)",
      bgSubtle: "rgba(37, 99, 235, 0.08)",
      borderSubtle: "rgba(37, 99, 235, 0.25)",
      accentText: "#2563EB",
      domain: "Software Engineering",
      targetRole: "Full-Stack Engineer"
    };
  }
  if (t.includes("data") || t.includes("analytics") || t.includes("sql") || t.includes("python") || t.includes("science")) {
    return {
      icon: Database,
      color: "#10B981",
      gradient: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
      bgSubtle: "rgba(16, 185, 129, 0.08)",
      borderSubtle: "rgba(16, 185, 129, 0.25)",
      accentText: "#059669",
      domain: "Data & Analytics",
      targetRole: "Data & Intelligence Analyst"
    };
  }
  if (t.includes("lead") || t.includes("manage") || t.includes("product") || t.includes("business") || t.includes("agile")) {
    return {
      icon: Briefcase,
      color: "#F59E0B",
      gradient: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
      bgSubtle: "rgba(245, 158, 11, 0.08)",
      borderSubtle: "rgba(245, 158, 11, 0.25)",
      accentText: "#D97706",
      domain: "Leadership & Strategy",
      targetRole: "Technical Product & Team Lead"
    };
  }
  return {
    icon: Compass,
    color: "#0EA5E9",
    gradient: "linear-gradient(135deg, #0EA5E9 0%, #2563EB 100%)",
    bgSubtle: "rgba(14, 165, 233, 0.08)",
    borderSubtle: "rgba(14, 165, 233, 0.25)",
    accentText: "#0284C7",
    domain: "Core Competency",
    targetRole: "Certified Domain Practitioner"
  };
}

export function LearningPathsScreen({
  user = {},
  courses = [],
  learningPathsQuery,
  pathEnrollmentsQuery,
  push,
  back,
  showToast,
  session
}) {
  const [activeTab, setActiveTab] = useState("my-paths"); // 'my-paths' | 'explore'
  const [selectedPathId, setSelectedPathId] = useState(null);
  const [busyPathId, setBusyPathId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("All");

  const paths = learningPathsQuery?.data || [];
  const enrollments = pathEnrollmentsQuery?.data || [];
  const enrolledPathIds = useMemo(() => new Set(enrollments.map(e => e.path_id || e.learning_path_id || e.id)), [enrollments]);

  // Map courses by ID for quick lookup of real learner progress
  const courseMap = useMemo(() => {
    const map = new Map();
    (courses || []).forEach(c => map.set(c.id, c));
    return map;
  }, [courses]);

  // Enrich each path with real learner progress across its courses
  const enrichedPaths = useMemo(() => {
    return paths.map(path => {
      const isEnrolled = enrolledPathIds.has(path.id);
      const enrollment = enrollments.find(e => (e.path_id || e.learning_path_id || e.id) === path.id);
      const theme = getTrackTheme(path.title, path.category);

      const pathCourses = (path.courses || []).map((step, idx) => {
        const liveCourse = courseMap.get(step.id) || {};
        const progress = liveCourse.progress || 0;
        const isCompleted = progress >= 100;
        const isStarted = progress > 0 && progress < 100;

        // Evaluate unlock rules:
        // Rule: 'complete_previous' - Step 0 is always open. Step N is locked if Step N-1 is not 100% complete.
        let isLocked = false;
        let prerequisiteTitle = null;
        if (idx > 0 && step.unlockRule === "complete_previous") {
          const prevStep = path.courses[idx - 1];
          const prevLive = courseMap.get(prevStep.id) || {};
          if ((prevLive.progress || 0) < 100) {
            isLocked = true;
            prerequisiteTitle = prevStep.title || "the previous course";
          }
        }

        return {
          ...step,
          coverImageUrl: liveCourse.coverImageUrl || step.coverImageUrl,
          progress,
          isCompleted,
          isStarted,
          isLocked,
          prerequisiteTitle,
          stepNumber: idx + 1,
          liveCourse,
          estimatedHours: step.hours || liveCourse.duration_hours || 2,
          xpReward: (step.hours || liveCourse.duration_hours || 2) * 250
        };
      });

      const totalSteps = pathCourses.length;
      const completedSteps = pathCourses.filter(s => s.isCompleted).length;
      const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
      const isPathCompleted = totalSteps > 0 && completedSteps === totalSteps;
      const currentStep = pathCourses.find(s => !s.isCompleted && !s.isLocked) || pathCourses[0] || null;
      const totalEstimatedHours = pathCourses.reduce((acc, c) => acc + (c.estimatedHours || 2), 0);
      const totalXpRewards = pathCourses.reduce((acc, c) => acc + (c.xpReward || 500), 0);

      return {
        ...path,
        theme,
        isEnrolled,
        enrollment,
        courses: pathCourses,
        totalSteps,
        completedSteps,
        progressPercentage,
        isPathCompleted,
        currentStep,
        totalEstimatedHours,
        totalXpRewards
      };
    });
  }, [paths, enrolledPathIds, enrollments, courseMap]);

  // Filter paths by active tab and search/category
  const myPaths = useMemo(() => enrichedPaths.filter(p => p.isEnrolled), [enrichedPaths]);

  const explorePaths = useMemo(() => {
    return enrichedPaths.filter(p => {
      const matchesSearch = !searchQuery.trim() ||
        p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.theme.domain.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategoryFilter === "All" || p.theme.domain === selectedCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [enrichedPaths, searchQuery, selectedCategoryFilter]);

  // Selected path for the detailed roadmap view
  const activePath = useMemo(() => {
    if (selectedPathId) {
      return enrichedPaths.find(p => p.id === selectedPathId) || enrichedPaths[0] || null;
    }
    return myPaths[0] || enrichedPaths[0] || null;
  }, [enrichedPaths, selectedPathId, myPaths]);

  // Metrics for the Hero Section
  const totalCompletedMilestones = useMemo(() => {
    return myPaths.reduce((acc, p) => acc + p.completedSteps, 0);
  }, [myPaths]);

  const totalPossibleMilestones = useMemo(() => {
    return myPaths.reduce((acc, p) => acc + p.totalSteps, 0);
  }, [myPaths]);

  const totalEarnedTrackXP = useMemo(() => {
    return myPaths.reduce((acc, p) => {
      return acc + p.courses.filter(c => c.isCompleted).reduce((sum, c) => sum + (c.xpReward || 500), 0);
    }, 0);
  }, [myPaths]);

  const availableCategories = useMemo(() => {
    const set = new Set(enrichedPaths.map(p => p.theme.domain));
    return ["All", ...Array.from(set)];
  }, [enrichedPaths]);

  // Handle Enrollment
  async function handleEnroll(pathId) {
    if (!session?.user?.id) {
      showToast?.("Please sign in to enroll in a learning path.");
      return;
    }
    setBusyPathId(pathId);
    try {
      await enrollInLearningPath(session.user.id, pathId);
      pathEnrollmentsQuery?.refetch?.();
      showToast?.("🎉 Enrolled in learning path! Your guided roadmap is active.");
      setSelectedPathId(pathId);
      setActiveTab("my-paths");
    } catch (e) {
      showToast?.(e?.message || "Could not enroll in this path.");
    } finally {
      setBusyPathId(null);
    }
  }

  // Handle Leaving a Path
  async function handleLeave(pathId, title) {
    if (!session?.user?.id) return;
    if (!window.confirm(`Are you sure you want to pause your enrollment in "${title}"? Your individual course progress and certificates will remain fully saved.`)) return;

    setBusyPathId(pathId);
    try {
      const res = await leaveLearningPath(session.user.id, pathId);
      if (res.success) {
        pathEnrollmentsQuery?.refetch?.();
        showToast?.("Removed from active learning path.");
      } else {
        showToast?.(res.error || "Could not leave path.");
      }
    } finally {
      setBusyPathId(null);
    }
  }

  // Jump into a course from the roadmap
  function handleOpenCourse(step) {
    if (step.isLocked) {
      showToast?.(`🔒 Locked: Complete Step ${step.stepNumber - 1} ("${step.prerequisiteTitle}") first.`);
      return;
    }
    push("courseDetail", { id: step.id });
  }

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <TopBar
        title="Guided Career Pathways"
        sub="Sequenced curriculums with milestone unlocking, prerequisite enforcement, and verified graduation credentials"
        onBack={back}
      />

      {/* =========================================================================
          CREATIVE HERO LAUNCHPAD: High-Impact Glassmorphic Quest Banner
          ========================================================================= */}
      <div
        style={{
          borderRadius: 16,
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #0F172A 100%)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          padding: "clamp(20px, 3vw, 28px)",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 12px 36px -6px rgba(15, 23, 42, 0.4)",
          color: "#FFFFFF"
        }}
      >
        {/* Ambient Glows */}
        <div
          style={{
            position: "absolute",
            top: -60,
            right: -40,
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99, 102, 241, 0.35) 0%, transparent 70%)",
            pointerEvents: "none"
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -60,
            left: "20%",
            width: 260,
            height: 260,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(37, 99, 235, 0.25) 0%, transparent 70%)",
            pointerEvents: "none"
          }}
        />

        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Top Row: Title, Subtitle and Segmented Tabs */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div style={{ maxWidth: 640 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <span
                  style={{
                    background: "rgba(99, 102, 241, 0.2)",
                    border: "1px solid rgba(99, 102, 241, 0.4)",
                    color: "#A5B4FC",
                    fontSize: 11,
                    fontWeight: 800,
                    padding: "3px 10px",
                    borderRadius: 20,
                    textTransform: "uppercase",
                    letterSpacing: ".05em",
                    display: "flex",
                    alignItems: "center",
                    gap: 5
                  }}
                >
                  <Target size={12} /> Career Competency Engine
                </span>
                <span style={{ fontSize: 12, color: "#94A3B8" }}>• Prerequisite Verified</span>
              </div>

              <h1 style={{ fontSize: "clamp(22px, 3vw, 28px)", fontWeight: 900, color: "#FFFFFF", margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
                Master Your Career Roadmap
              </h1>
              <p style={{ fontSize: 13.5, color: "#CBD5E1", margin: 0, lineHeight: 1.5, fontWeight: 400 }}>
                Structured multi-course journeys engineered for deep industry readiness. Complete sequential milestones to unlock advanced stages and earn verifiable career credentials.
              </p>
            </div>

            {/* Segmented Pill Switcher */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 12,
                padding: 4,
                display: "flex",
                gap: 4
              }}
            >
              <button
                style={{
                  background: activeTab === "my-paths" ? "var(--primary, #2563EB)" : "transparent",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.18s ease",
                  boxShadow: activeTab === "my-paths" ? "0 2px 10px rgba(37, 99, 235, 0.4)" : "none"
                }}
                onClick={() => setActiveTab("my-paths")}
              >
                <Compass size={14} /> My Journey ({myPaths.length})
              </button>
              <button
                style={{
                  background: activeTab === "explore" ? "var(--primary, #2563EB)" : "transparent",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.18s ease",
                  boxShadow: activeTab === "explore" ? "0 2px 10px rgba(37, 99, 235, 0.4)" : "none"
                }}
                onClick={() => setActiveTab("explore")}
              >
                <MapIcon size={14} /> Explore All ({enrichedPaths.length})
              </button>
            </div>
          </div>

          {/* Bottom Row: Quick Stats Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                backdropFilter: "blur(8px)",
                borderRadius: 10,
                padding: "12px 14px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "rgba(255,255,255,0.7)", fontSize: 11.5, fontWeight: 600 }}>
                <span>Active Tracks</span>
                <Milestone size={14} color="#60A5FA" />
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#FFFFFF", marginTop: 4 }}>
                {myPaths.length} <span style={{ fontSize: 12, fontWeight: 500, color: "#94A3B8" }}>Enrolled</span>
              </div>
            </div>

            <div
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                backdropFilter: "blur(8px)",
                borderRadius: 10,
                padding: "12px 14px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "rgba(255,255,255,0.7)", fontSize: 11.5, fontWeight: 600 }}>
                <span>Milestones Mastered</span>
                <CheckCircle2 size={14} color="#34D399" />
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#FFFFFF", marginTop: 4 }}>
                {totalCompletedMilestones} <span style={{ fontSize: 12, fontWeight: 500, color: "#94A3B8" }}>/ {totalPossibleMilestones || 0} Steps</span>
              </div>
            </div>

            <div
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                backdropFilter: "blur(8px)",
                borderRadius: 10,
                padding: "12px 14px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "rgba(255,255,255,0.7)", fontSize: 11.5, fontWeight: 600 }}>
                <span>Track XP Unlocked</span>
                <Zap size={14} color="#FBBF24" />
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#FCD34D", marginTop: 4 }}>
                +{totalEarnedTrackXP.toLocaleString()} <span style={{ fontSize: 12, fontWeight: 500, color: "#94A3B8" }}>XP</span>
              </div>
            </div>

            <div
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                backdropFilter: "blur(8px)",
                borderRadius: 10,
                padding: "12px 14px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "rgba(255,255,255,0.7)", fontSize: 11.5, fontWeight: 600 }}>
                <span>Career Credentials</span>
                <Award size={14} color="#C084FC" />
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#FFFFFF", marginTop: 4 }}>
                {myPaths.filter(p => p.isPathCompleted).length} <span style={{ fontSize: 12, fontWeight: 500, color: "#94A3B8" }}>Certifications</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          EXPLORE FILTERS BAR (Rendered in Explore Tab)
          ========================================================================= */}
      {activeTab === "explore" && (
        <div
          className="tai-card"
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12
          }}
        >
          {/* Search Box */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface-2)", borderRadius: 8, padding: "6px 12px", flex: 1, minWidth: 200, maxWidth: 360, border: "1px solid var(--border)" }}>
            <Search size={14} color="var(--text-3)" />
            <input
              type="text"
              placeholder="Search pathways, roles, or skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: "none", background: "transparent", outline: "none", fontSize: 12.5, width: "100%", color: "var(--text)" }}
            />
            {searchQuery && (
              <X size={13} style={{ cursor: "pointer", color: "var(--text-3)" }} onClick={() => setSearchQuery("")} />
            )}
          </div>

          {/* Category Filter Pills */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {availableCategories.map((cat) => (
              <button
                key={cat}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: 11.5,
                  fontWeight: 700,
                  border: selectedCategoryFilter === cat ? "1px solid var(--primary, #2563EB)" : "1px solid var(--border)",
                  background: selectedCategoryFilter === cat ? "var(--primary-tint, rgba(37, 99, 235, 0.1))" : "var(--surface-2)",
                  color: selectedCategoryFilter === cat ? "var(--primary, #2563EB)" : "var(--text-2)",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
                onClick={() => setSelectedCategoryFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          MAIN INTERACTIVE DUAL-COLUMN WORKSPACE
          ========================================================================= */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 20, alignItems: "start" }}>
        
        {/* -----------------------------------------------------------------------
            LEFT COLUMN: Interactive Pathway Cards List
            ----------------------------------------------------------------------- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
              {activeTab === "my-paths" ? (
                <>
                  <Compass size={16} color="var(--primary)" /> Your Enrolled Pathways
                </>
              ) : (
                <>
                  <MapIcon size={16} color="var(--primary)" /> Available Learning Pathways ({explorePaths.length})
                </>
              )}
            </div>
            <span style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 600 }}>Click card to preview roadmap</span>
          </div>

          {/* Empty State for My Paths */}
          {activeTab === "my-paths" && myPaths.length === 0 && (
            <div
              className="tai-card"
              style={{
                padding: "36px 24px",
                textAlign: "center",
                borderRadius: 14,
                border: "1px dashed var(--border)",
                background: "var(--surface)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12
              }}
            >
              <div style={{ width: 54, height: 54, borderRadius: "50%", background: "rgba(37, 99, 235, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
                <Compass size={28} />
              </div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>No Active Pathways Enrolled</div>
              <p style={{ fontSize: 13, color: "var(--text-3)", maxWidth: 320, margin: 0, lineHeight: 1.5 }}>
                Follow structured paths crafted by industry experts to master role competencies step-by-step.
              </p>
              <button
                className="tai-btn tai-btn-primary"
                style={{ padding: "0 20px", height: 36, fontSize: 13, fontWeight: 700, borderRadius: 8, marginTop: 6 }}
                onClick={() => setActiveTab("explore")}
              >
                Browse All Pathways →
              </button>
            </div>
          )}

          {/* Empty State for Explore Filter */}
          {activeTab === "explore" && explorePaths.length === 0 && (
            <div className="tai-card" style={{ padding: 28, textAlign: "center", borderRadius: 12, border: "1px dashed var(--border)" }}>
              <Search size={32} color="var(--text-3)" style={{ margin: "0 auto 8px" }} />
              <div style={{ fontWeight: 800, fontSize: 14 }}>No pathways matched your search</div>
              <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>Try clearing search filters to see all available curriculums.</p>
              <button className="tai-btn tai-btn-outline tai-btn-sm" style={{ marginTop: 10 }} onClick={() => { setSearchQuery(""); setSelectedCategoryFilter("All"); }}>
                Reset Filters
              </button>
            </div>
          )}

          {/* Render Pathway Cards */}
          {((activeTab === "my-paths" ? myPaths : explorePaths) || []).map((p) => {
            const isSelected = activePath?.id === p.id;
            const ThemeIcon = p.theme.icon;

            return (
              <div
                key={p.id}
                onClick={() => setSelectedPathId(p.id)}
                className="tai-card tai-card-hover"
                style={{
                  padding: 16,
                  borderRadius: 14,
                  border: isSelected
                    ? `2px solid ${p.theme.color}`
                    : "1px solid var(--border)",
                  background: isSelected
                    ? (document.documentElement.classList.contains("dark") ? "rgba(37, 99, 235, 0.12)" : "rgba(37, 99, 235, 0.03)")
                    : "var(--surface)",
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  boxShadow: isSelected
                    ? `0 8px 24px -4px ${p.theme.color}25`
                    : "var(--shadow-card)",
                  position: "relative",
                  overflow: "hidden"
                }}
              >
                {/* Left Accent Stripe */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: 4,
                    background: p.theme.gradient,
                    opacity: isSelected ? 1 : 0.4
                  }}
                />

                {/* Card Top Row: Domain Icon, Title, Status */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingLeft: 6 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: p.theme.bgSubtle,
                        border: `1px solid ${p.theme.borderSubtle}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: p.theme.color,
                        flexShrink: 0
                      }}
                    >
                      <ThemeIcon size={18} />
                    </div>

                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            color: p.theme.color,
                            background: p.theme.bgSubtle,
                            padding: "2px 8px",
                            borderRadius: 4,
                            textTransform: "uppercase",
                            letterSpacing: ".04em"
                          }}
                        >
                          {p.theme.domain}
                        </span>
                        {p.level && (
                          <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>• {p.level}</span>
                        )}
                      </div>

                      <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", lineHeight: 1.3 }}>
                        {p.title}
                      </div>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  {p.isPathCompleted ? (
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: "#10B981",
                        color: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)"
                      }}
                      title="Pathway Completed!"
                    >
                      <Trophy size={13} />
                    </div>
                  ) : (
                    <ChevronRight
                      size={18}
                      color={isSelected ? p.theme.color : "var(--text-3)"}
                      style={{
                        transform: isSelected ? "translateX(2px)" : "none",
                        transition: "transform 0.15s ease",
                        flexShrink: 0,
                        marginTop: 4
                      }}
                    />
                  )}
                </div>

                {/* Description */}
                {p.description && (
                  <p
                    style={{
                      fontSize: 12.5,
                      color: "var(--text-2)",
                      margin: "0 0 0 6px",
                      lineHeight: 1.45,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden"
                    }}
                  >
                    {p.description}
                  </p>
                )}

                {/* Metrics Badges Strip */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 6, fontSize: 11.5, color: "var(--text-3)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Layers size={13} /> {p.totalSteps} Stages
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Clock size={13} /> ~{p.totalEstimatedHours}h
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#D97706", fontWeight: 700 }}>
                    <Zap size={13} /> +{p.totalXpRewards} XP
                  </span>
                </div>

                {/* Progress bar or Quick Action */}
                <div style={{ paddingLeft: 6 }}>
                  {p.isEnrolled ? (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                        <span style={{ color: "var(--text-3)" }}>Curriculum Progress ({p.completedSteps}/{p.totalSteps})</span>
                        <span style={{ color: p.theme.color, fontWeight: 800 }}>{p.progressPercentage}%</span>
                      </div>
                      <ProgressBar progress={p.progressPercentage} height={6} color={p.theme.color} />
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 600 }}>Includes Certificate</span>
                      <span style={{ fontSize: 12, color: p.theme.color, fontWeight: 800, display: "flex", alignItems: "center", gap: 4 }}>
                        Explore Roadmap <ArrowRight size={13} />
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* -----------------------------------------------------------------------
            RIGHT COLUMN: Interactive Subway Quest Roadmap & Milestone Hub
            ----------------------------------------------------------------------- */}
        {activePath ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            
            {/* Active Pathway Detail Card */}
            <div
              className="tai-card"
              style={{
                borderRadius: 16,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                overflow: "hidden",
                boxShadow: "var(--shadow-card)"
              }}
            >
              {/* Header Hero Strip */}
              <div
                style={{
                  background: activePath.theme.gradient,
                  padding: "20px 22px",
                  color: "#FFFFFF",
                  position: "relative",
                  overflow: "hidden"
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: -20,
                    right: -20,
                    width: 140,
                    height: 140,
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.12)",
                    pointerEvents: "none"
                  }}
                />

                <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span
                        style={{
                          background: "rgba(255, 255, 255, 0.2)",
                          backdropFilter: "blur(4px)",
                          padding: "3px 10px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: ".04em"
                        }}
                      >
                        {activePath.theme.domain}
                      </span>
                      <span style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.8)", fontWeight: 600 }}>
                        {activePath.totalSteps} Milestones • {activePath.totalEstimatedHours} Hours
                      </span>
                    </div>

                    <h2 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 6px 0", color: "#FFFFFF" }}>
                      {activePath.title}
                    </h2>
                    
                    <div style={{ fontSize: 12.5, color: "rgba(255, 255, 255, 0.9)", display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                      <Target size={14} /> Target Outcome: {activePath.theme.targetRole}
                    </div>
                  </div>

                  {/* Enrollment Button / Leave Path */}
                  <div>
                    {activePath.isEnrolled ? (
                      <button
                        className="tai-btn"
                        style={{
                          background: "rgba(255, 255, 255, 0.18)",
                          backdropFilter: "blur(6px)",
                          border: "1px solid rgba(255, 255, 255, 0.3)",
                          color: "#FFFFFF",
                          height: 32,
                          padding: "0 12px",
                          fontSize: 11.5,
                          borderRadius: 8,
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                        onClick={() => handleLeave(activePath.id, activePath.title)}
                        disabled={busyPathId === activePath.id}
                      >
                        Leave Path
                      </button>
                    ) : (
                      <button
                        className="tai-btn"
                        style={{
                          background: "#FFFFFF",
                          color: activePath.theme.accentText,
                          height: 36,
                          padding: "0 18px",
                          fontSize: 13,
                          borderRadius: 8,
                          fontWeight: 800,
                          cursor: "pointer",
                          border: "none",
                          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                          display: "flex",
                          alignItems: "center",
                          gap: 6
                        }}
                        onClick={() => handleEnroll(activePath.id)}
                        disabled={busyPathId === activePath.id}
                      >
                        <Sparkles size={14} />
                        {busyPathId === activePath.id ? "Enrolling…" : "Enroll in Pathway"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress & Next Step Launch Hub */}
              <div style={{ padding: "20px 22px", borderBottom: "1px solid var(--border)" }}>
                <p style={{ fontSize: 13.5, color: "var(--text-2)", margin: "0 0 16px 0", lineHeight: 1.5 }}>
                  {activePath.description || "Follow this sequenced curriculum to build verified competencies."}
                </p>

                {activePath.isEnrolled ? (
                  <div
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: "16px 18px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 14
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                        Pathway Completion Status
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 900, color: "var(--text)", marginTop: 2 }}>
                        {activePath.completedSteps} of {activePath.totalSteps} Milestones Complete ({activePath.progressPercentage}%)
                      </div>
                      <div style={{ width: 220, marginTop: 8 }}>
                        <ProgressBar progress={activePath.progressPercentage} height={6} color={activePath.theme.color} />
                      </div>
                    </div>

                    {activePath.isPathCompleted ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "8px 14px", borderRadius: 8, color: "#10B981", fontWeight: 800, fontSize: 13 }}>
                        <Award size={18} /> Pathway Fully Completed!
                      </div>
                    ) : activePath.currentStep ? (
                      <button
                        className="tai-btn tai-btn-primary"
                        style={{
                          height: 38,
                          padding: "0 18px",
                          fontSize: 13,
                          fontWeight: 800,
                          borderRadius: 8,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          boxShadow: "0 4px 14px rgba(37, 99, 235, 0.3)"
                        }}
                        onClick={() => handleOpenCourse(activePath.currentStep)}
                      >
                        <Play size={13} /> {activePath.currentStep.isStarted ? "Resume Step" : "Launch Step"} {activePath.currentStep.stepNumber}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div
                    style={{
                      background: activePath.theme.bgSubtle,
                      border: `1px solid ${activePath.theme.borderSubtle}`,
                      borderRadius: 12,
                      padding: "14px 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 12
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Award size={20} color={activePath.theme.color} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Ready to start this curriculum?</div>
                        <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>Enroll to track progress, unlock sequential prerequisites, and earn verified credentials.</div>
                      </div>
                    </div>
                    <button
                      className="tai-btn tai-btn-primary tai-btn-sm"
                      style={{ fontWeight: 700, padding: "0 16px" }}
                      onClick={() => handleEnroll(activePath.id)}
                      disabled={busyPathId === activePath.id}
                    >
                      Start Pathway →
                    </button>
                  </div>
                )}
              </div>

              {/* =================================================================
                  INTERACTIVE MILESTONE TIMELINE (Subway / Quest Map)
                  ================================================================= */}
              <div style={{ padding: "22px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 6 }}>
                    <Layers size={15} color="var(--primary)" /> Milestone Sequence &amp; Prerequisites
                  </div>
                  <span style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 600 }}>Sequential Unlocking</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {activePath.courses.map((step, idx) => {
                    const isLast = idx === activePath.courses.length - 1;
                    const isCurrentActive = !step.isCompleted && !step.isLocked;

                    return (
                      <div key={step.id || idx} style={{ position: "relative" }}>
                        {/* Connecting Line between nodes */}
                        {!isLast && (
                          <div
                            style={{
                              position: "absolute",
                              left: 20,
                              top: 48,
                              bottom: -18,
                              width: 3,
                              background: step.isCompleted
                                ? "#10B981"
                                : isCurrentActive
                                ? `linear-gradient(to bottom, #10B981 0%, var(--border) 100%)`
                                : "var(--border)",
                              zIndex: 0,
                              borderRadius: 2
                            }}
                          />
                        )}

                        {/* Step Card */}
                        <div
                          className="tai-card"
                          style={{
                            position: "relative",
                            zIndex: 1,
                            borderRadius: 12,
                            border: step.isCompleted
                              ? "1px solid rgba(16, 185, 129, 0.35)"
                              : isCurrentActive
                              ? `2px solid var(--primary, #2563EB)`
                              : "1px solid var(--border)",
                            background: step.isCompleted
                              ? "rgba(16, 185, 129, 0.03)"
                              : isCurrentActive
                              ? (document.documentElement.classList.contains("dark") ? "rgba(37, 99, 235, 0.12)" : "rgba(37, 99, 235, 0.04)")
                              : step.isLocked
                              ? "var(--surface-2)"
                              : "var(--surface)",
                            padding: "16px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: 14,
                            boxShadow: isCurrentActive ? "0 4px 20px -2px rgba(37, 99, 235, 0.18)" : "none",
                            opacity: step.isLocked ? 0.75 : 1
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, minWidth: 0, flex: 1 }}>
                            
                            {/* Step Node Indicator */}
                            <div
                              style={{
                                width: 42,
                                height: 42,
                                borderRadius: "50%",
                                background: step.isCompleted
                                  ? "#10B981"
                                  : isCurrentActive
                                  ? "var(--primary, #2563EB)"
                                  : step.isLocked
                                  ? "var(--surface-3)"
                                  : "var(--surface-2)",
                                color: step.isLocked ? "var(--text-3)" : "#FFFFFF",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 900,
                                fontSize: 14,
                                flexShrink: 0,
                                border: step.isLocked ? "1px solid var(--border)" : "none",
                                boxShadow: step.isCompleted
                                  ? "0 2px 10px rgba(16, 185, 129, 0.35)"
                                  : isCurrentActive
                                  ? "0 2px 12px rgba(37, 99, 235, 0.4)"
                                  : "none"
                              }}
                            >
                              {step.isCompleted ? (
                                <Check size={20} strokeWidth={3} />
                              ) : step.isLocked ? (
                                <Lock size={16} />
                              ) : (
                                step.stepNumber
                              )}
                            </div>

                            {/* Course Details */}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 800,
                                    textTransform: "uppercase",
                                    letterSpacing: ".04em",
                                    color: step.isCompleted ? "#10B981" : isCurrentActive ? "var(--primary)" : "var(--text-3)"
                                  }}
                                >
                                  Stage {step.stepNumber} • {step.isRequired ? "Mandatory" : "Elective"}
                                </span>
                                {step.level && <span style={{ fontSize: 11, color: "var(--text-3)" }}>• {step.level}</span>}
                                <span style={{ fontSize: 11, color: "var(--text-3)" }}>• ~{step.estimatedHours} hrs</span>
                                <span style={{ fontSize: 11, color: "#D97706", fontWeight: 700 }}>• +{step.xpReward} XP</span>
                                
                                {isCurrentActive && (
                                  <span style={{ background: "var(--primary)", color: "#FFFFFF", fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 10, textTransform: "uppercase" }}>
                                    Current Focus
                                  </span>
                                )}
                              </div>

                              <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", lineHeight: 1.3 }}>
                                {step.title}
                              </div>

                              {/* Locked prerequisite warning */}
                              {step.isLocked && step.prerequisiteTitle && (
                                <div style={{ fontSize: 11.5, color: "#D97706", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                  <Lock size={12} /> Prerequisite: Complete Stage {idx} ("{step.prerequisiteTitle}")
                                </div>
                              )}

                              {/* Progress bar if started */}
                              {step.isStarted && (
                                <div style={{ marginTop: 8, maxWidth: 240 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, fontWeight: 700, marginBottom: 2 }}>
                                    <span style={{ color: "var(--text-3)" }}>Stage Progress</span>
                                    <span style={{ color: "var(--primary)" }}>{step.progress}%</span>
                                  </div>
                                  <ProgressBar progress={step.progress} height={4} />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Step CTA Button */}
                          <div style={{ flexShrink: 0 }}>
                            {step.isCompleted ? (
                              <button
                                className="tai-btn tai-btn-outline tai-btn-sm"
                                style={{ height: 32, fontSize: 12, fontWeight: 700, color: "#10B981", borderColor: "rgba(16, 185, 129, 0.4)", borderRadius: 8 }}
                                onClick={() => handleOpenCourse(step)}
                              >
                                Review Stage
                              </button>
                            ) : step.isLocked ? (
                              <button
                                className="tai-btn tai-btn-outline tai-btn-sm"
                                style={{ height: 32, fontSize: 12, opacity: 0.6, cursor: "not-allowed", borderRadius: 8 }}
                                disabled
                                title={`Complete Stage ${idx} first`}
                              >
                                <Lock size={12} /> Locked
                              </button>
                            ) : (
                              <button
                                className="tai-btn tai-btn-primary tai-btn-sm"
                                style={{ height: 32, padding: "0 16px", fontSize: 12.5, fontWeight: 800, borderRadius: 8, display: "flex", alignItems: "center", gap: 5 }}
                                onClick={() => handleOpenCourse(step)}
                              >
                                <Play size={12} /> {step.isStarted ? "Resume" : "Start"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ===============================================================
                    GRADUATION & CAREER CREDENTIAL CAPSTONE NODE
                    =============================================================== */}
                <div
                  style={{
                    marginTop: 20,
                    borderRadius: 14,
                    background: "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.05) 100%)",
                    border: "1px dashed rgba(245, 158, 11, 0.4)",
                    padding: "16px 18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                        color: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        boxShadow: "0 4px 12px rgba(245, 158, 11, 0.35)"
                      }}
                    >
                      <GraduationCap size={22} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
                        Pathway Graduation &amp; Verified Credential <Star size={14} color="#F59E0B" fill="#F59E0B" />
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                        Unlocks an accredited verifiable certificate, shareable digital credential badge, and automatic skills profile boost upon completing all {activePath.totalSteps} stages.
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: 11.5, fontWeight: 800, color: "#D97706", background: "rgba(245, 158, 11, 0.15)", padding: "4px 10px", borderRadius: 6 }}>
                    {activePath.isPathCompleted ? "Credential Awarded ✓" : "Milestone Capstone"}
                  </div>
                </div>

              </div>

            </div>
          </div>
        ) : null}

      </div>
    </div>
  );
}
