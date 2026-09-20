import React, { useState, useMemo } from "react";
import { TopBar, Tag, ProgressBar } from "../components/LearnerUI.jsx";
import {
  Map as MapIcon, Compass, BookOpen, CheckCircle2, Lock, Unlock,
  Play, ArrowRight, Trophy, Clock, Layers, Award, Sparkles,
  ChevronRight, Users, ShieldCheck, AlertCircle, RefreshCw, X, Check, ExternalLink
} from "lucide-react";
import { enrollInLearningPath, leaveLearningPath } from "../../lib/api/learner.js";

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
          liveCourse
        };
      });

      const totalSteps = pathCourses.length;
      const completedSteps = pathCourses.filter(s => s.isCompleted).length;
      const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
      const isPathCompleted = totalSteps > 0 && completedSteps === totalSteps;
      const currentStep = pathCourses.find(s => !s.isCompleted && !s.isLocked) || pathCourses[0] || null;

      return {
        ...path,
        isEnrolled,
        enrollment,
        courses: pathCourses,
        totalSteps,
        completedSteps,
        progressPercentage,
        isPathCompleted,
        currentStep
      };
    });
  }, [paths, enrolledPathIds, enrollments, courseMap]);

  // Filter paths by active tab
  const myPaths = enrichedPaths.filter(p => p.isEnrolled);
  const explorePaths = enrichedPaths;

  // Selected path for the detailed roadmap view (defaults to first enrolled path, or first overall)
  const activePath = useMemo(() => {
    if (selectedPathId) {
      return enrichedPaths.find(p => p.id === selectedPathId) || enrichedPaths[0] || null;
    }
    return myPaths[0] || enrichedPaths[0] || null;
  }, [enrichedPaths, selectedPathId, myPaths]);

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
      showToast?.("Enrolled in learning path! Your guided roadmap is ready.");
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
    if (!window.confirm(`Are you sure you want to leave the "${title}" path? Your course progress will be preserved.`)) return;

    setBusyPathId(pathId);
    try {
      const res = await leaveLearningPath(session.user.id, pathId);
      if (res.success) {
        pathEnrollmentsQuery?.refetch?.();
        showToast?.("Removed from learning path.");
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
      showToast?.(`Locked: Complete "${step.prerequisiteTitle}" first.`);
      return;
    }
    push("courseDetail", { id: step.id });
  }

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <TopBar
        title="Learning Paths"
        sub="Curated, step-by-step career journeys designed to take you from foundational concepts to production mastery"
        onBack={back}
      />

      {/* Hero Banner */}
      <div
        className="tai-card tai-hero-card tai-hero-dark anim-fluid-entrance"
        style={{
          borderRadius: 14,
          padding: "clamp(18px, 2.5vw, 24px)",
          position: "relative",
          overflow: "hidden",
          width: "100%",
          boxSizing: "border-box"
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
            background: "radial-gradient(circle, rgba(37, 99, 235, 0.28) 0%, transparent 70%)",
            pointerEvents: "none"
          }}
        />

        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <h1 style={{ fontSize: "clamp(20px, 2.5vw, 26px)", fontWeight: 900, color: "#FFFFFF", margin: 0 }}>
                  Guided Career Pathways
                </h1>
                <span style={{ background: "var(--primary, #2563EB)", color: "#FFFFFF", padding: "3px 10px", borderRadius: 6, fontWeight: 800, fontSize: 11.5, border: "1px solid rgba(255, 255, 255, 0.25)" }}>
                  {myPaths.length} Enrolled {myPaths.length === 1 ? "Path" : "Paths"}
                </span>
              </div>
              <p style={{ fontSize: 13.5, color: "#F8FAFC", margin: 0, fontWeight: 500, lineHeight: 1.45 }}>
                Follow structured curriculums with sequential unlocking, prerequisite enforcement, and verified milestone credentials.
              </p>
            </div>

            {/* Tab Switcher */}
            <div className="tai-row tai-gap8">
              <button
                className={`tai-btn ${activeTab === "my-paths" ? "tai-btn-primary" : "tai-btn-outline"}`}
                style={{ height: 36, padding: "0 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 700 }}
                onClick={() => setActiveTab("my-paths")}
              >
                <Compass size={14} /> My Pathways ({myPaths.length})
              </button>
              <button
                className={`tai-btn ${activeTab === "explore" ? "tai-btn-primary" : "tai-btn-outline"}`}
                style={{ height: 36, padding: "0 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 700 }}
                onClick={() => setActiveTab("explore")}
              >
                <MapIcon size={14} /> Explore All Paths ({explorePaths.length})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 20 }}>
        
        {/* Left Column: List of Paths */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
            {activeTab === "my-paths" ? "Your Enrolled Pathways" : "Available Learning Paths"}
          </div>

          {activeTab === "my-paths" && myPaths.length === 0 && (
            <div className="tai-card" style={{ padding: 24, textAlign: "center", borderRadius: 12, border: "1px solid var(--border)" }}>
              <Compass size={36} color="var(--primary)" style={{ margin: "0 auto 10px" }} />
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>No Enrolled Pathways Yet</div>
              <p style={{ fontSize: 12.5, color: "var(--text-3)", marginBottom: 16, lineHeight: 1.5 }}>
                Enroll in a guided learning path to follow a step-by-step curriculum and earn certified career badges.
              </p>
              <button
                className="tai-btn tai-btn-primary"
                style={{ height: 34, padding: "0 18px", fontSize: 12.5, borderRadius: 8, margin: "0 auto" }}
                onClick={() => setActiveTab("explore")}
              >
                Browse Available Paths →
              </button>
            </div>
          )}

          {((activeTab === "my-paths" ? myPaths : explorePaths) || []).map((p) => {
            const isSelected = activePath?.id === p.id;
            return (
              <div
                key={p.id}
                onClick={() => setSelectedPathId(p.id)}
                className="tai-card"
                style={{
                  padding: 16,
                  borderRadius: 12,
                  border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border)",
                  background: isSelected ? "rgba(37, 99, 235, 0.04)" : "var(--surface)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                      <Tag tone={p.isPathCompleted ? "success" : p.isEnrolled ? "primary" : "neutral"}>
                        {p.isPathCompleted ? "Completed" : p.isEnrolled ? "In Progress" : "Available"}
                      </Tag>
                      {p.level && <span style={{ fontSize: 11, color: "var(--text-3)" }}>• {p.level}</span>}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", lineHeight: 1.3 }}>
                      {p.title}
                    </div>
                  </div>

                  {p.isPathCompleted ? (
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#10B981", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Trophy size={14} />
                    </div>
                  ) : (
                    <ChevronRight size={18} color={isSelected ? "var(--primary)" : "var(--text-3)"} />
                  )}
                </div>

                {p.description && (
                  <p style={{ fontSize: 12, color: "var(--text-2)", margin: 0, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {p.description}
                  </p>
                )}

                {/* Progress bar if enrolled */}
                {p.isEnrolled ? (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                      <span style={{ color: "var(--text-3)" }}>Progress ({p.completedSteps}/{p.totalSteps} Courses)</span>
                      <span style={{ color: "var(--primary)" }}>{p.progressPercentage}%</span>
                    </div>
                    <ProgressBar progress={p.progressPercentage} height={5} />
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5, color: "var(--text-3)", paddingTop: 4, borderTop: "1px solid var(--border)" }}>
                    <span>{p.totalSteps} Courses in Track</span>
                    <span style={{ color: "var(--primary)", fontWeight: 700 }}>View Roadmap →</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Column: Detailed Interactive Roadmap */}
        {activePath ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="tai-card" style={{ padding: 20, borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)" }}>
              
              {/* Path Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Tag tone={activePath.isPathCompleted ? "success" : activePath.isEnrolled ? "primary" : "neutral"}>
                      {activePath.isPathCompleted ? "Pathway Mastered" : activePath.isEnrolled ? "Active Journey" : "Catalog Path"}
                    </Tag>
                    <span style={{ fontSize: 12, color: "var(--text-3)" }}>{activePath.totalSteps} Courses • Guided Progression</span>
                  </div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px 0", color: "var(--text)" }}>
                    {activePath.title}
                  </h2>
                  <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>
                    {activePath.description || "Follow this sequenced curriculum to build verified competencies."}
                  </p>
                </div>

                {/* Enrollment Button */}
                <div>
                  {activePath.isEnrolled ? (
                    <button
                      className="tai-btn tai-btn-outline tai-btn-sm"
                      style={{ height: 32, fontSize: 11.5, color: "var(--danger)", borderColor: "rgba(239, 68, 68, 0.3)" }}
                      onClick={() => handleLeave(activePath.id, activePath.title)}
                      disabled={busyPathId === activePath.id}
                    >
                      Leave Path
                    </button>
                  ) : (
                    <button
                      className="tai-btn tai-btn-primary"
                      style={{ height: 36, padding: "0 18px", fontSize: 12.5, fontWeight: 700 }}
                      onClick={() => handleEnroll(activePath.id)}
                      disabled={busyPathId === activePath.id}
                    >
                      {busyPathId === activePath.id ? "Enrolling…" : "Enroll in this Path"}
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Summary Strip */}
              {activePath.isEnrolled && (
                <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--surface-2)", marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase" }}>Curriculum Progress</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: "var(--text)", marginTop: 2 }}>
                      {activePath.completedSteps} of {activePath.totalSteps} Courses Completed ({activePath.progressPercentage}%)
                    </div>
                  </div>

                  {activePath.isPathCompleted ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#10B981", fontWeight: 700, fontSize: 13 }}>
                      <CheckCircle2 size={16} /> All Requirements Met!
                    </div>
                  ) : activePath.currentStep ? (
                    <button
                      className="tai-btn tai-btn-primary tai-btn-sm"
                      style={{ height: 32, padding: "0 14px", fontSize: 12, fontWeight: 700 }}
                      onClick={() => handleOpenCourse(activePath.currentStep)}
                    >
                      <Play size={12} /> {activePath.currentStep.isStarted ? "Resume Step" : "Start Step"} {activePath.currentStep.stepNumber}
                    </button>
                  ) : null}
                </div>
              )}

              {/* Interactive Roadmap Steps */}
              <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  Course Roadmap &amp; Prerequisites
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {activePath.courses.map((step, idx) => {
                    const isLast = idx === activePath.courses.length - 1;
                    return (
                      <div key={step.id || idx} style={{ position: "relative" }}>
                        {/* Connecting vertical line */}
                        {!isLast && (
                          <div
                            style={{
                              position: "absolute",
                              left: 19,
                              top: 44,
                              bottom: -16,
                              width: 2,
                              background: step.isCompleted ? "#10B981" : "var(--border)",
                              zIndex: 0
                            }}
                          />
                        )}

                        <div
                          className="tai-card"
                          style={{
                            position: "relative",
                            zIndex: 1,
                            borderRadius: 12,
                            border: step.isCompleted
                              ? "1px solid rgba(16, 185, 129, 0.3)"
                              : step.isLocked
                              ? "1px dashed var(--border)"
                              : "1px solid var(--border)",
                            background: step.isCompleted
                              ? "rgba(16, 185, 129, 0.03)"
                              : step.isLocked
                              ? "var(--surface-3)"
                              : "var(--surface)",
                            padding: 14,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: 12,
                            opacity: step.isLocked ? 0.75 : 1
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                            {/* Step Indicator Badge */}
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: "50%",
                                background: step.isCompleted
                                  ? "#10B981"
                                  : step.isLocked
                                  ? "var(--surface-2)"
                                  : "var(--primary)",
                                color: step.isLocked ? "var(--text-3)" : "#FFFFFF",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 800,
                                fontSize: 13,
                                flexShrink: 0,
                                border: step.isLocked ? "1px solid var(--border)" : "none"
                              }}
                            >
                              {step.isCompleted ? (
                                <Check size={18} strokeWidth={2.5} />
                              ) : step.isLocked ? (
                                <Lock size={15} />
                              ) : (
                                step.stepNumber
                              )}
                            </div>

                            {/* Course Info */}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>
                                  Step {step.stepNumber} {step.isRequired ? "• Required" : "• Elective"}
                                </span>
                                {step.level && <span style={{ fontSize: 11, color: "var(--text-3)" }}>• {step.level}</span>}
                                {step.hours && <span style={{ fontSize: 11, color: "var(--text-3)" }}>• {step.hours} hrs</span>}
                              </div>

                              <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", lineHeight: 1.3 }}>
                                {step.title}
                              </div>

                              {/* Locked prerequisite warning */}
                              {step.isLocked && step.prerequisiteTitle && (
                                <div style={{ fontSize: 11.5, color: "#D97706", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                  <Lock size={11} /> Locked until you finish Step {idx}: "{step.prerequisiteTitle}"
                                </div>
                              )}

                              {/* Progress bar if in progress */}
                              {step.isStarted && (
                                <div style={{ marginTop: 6, maxWidth: 220 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 700, marginBottom: 2 }}>
                                    <span style={{ color: "var(--text-3)" }}>Course Progress</span>
                                    <span style={{ color: "var(--primary)" }}>{step.progress}%</span>
                                  </div>
                                  <ProgressBar progress={step.progress} height={4} />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Step Action Button */}
                          <div style={{ flexShrink: 0 }}>
                            {step.isCompleted ? (
                              <button
                                className="tai-btn tai-btn-outline tai-btn-sm"
                                style={{ height: 30, fontSize: 11.5, color: "#10B981", borderColor: "rgba(16, 185, 129, 0.4)" }}
                                onClick={() => handleOpenCourse(step)}
                              >
                                Review Course
                              </button>
                            ) : step.isLocked ? (
                              <button
                                className="tai-btn tai-btn-outline tai-btn-sm"
                                style={{ height: 30, fontSize: 11.5, opacity: 0.6, cursor: "not-allowed" }}
                                disabled
                                title={`Complete Step ${idx} first`}
                              >
                                <Lock size={12} /> Locked
                              </button>
                            ) : (
                              <button
                                className="tai-btn tai-btn-primary tai-btn-sm"
                                style={{ height: 30, padding: "0 14px", fontSize: 11.5, fontWeight: 700 }}
                                onClick={() => handleOpenCourse(step)}
                              >
                                <Play size={11} /> {step.isStarted ? "Resume" : "Start"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        ) : null}

      </div>
    </div>
  );
}
