import React from "react";
import { Avatar, ProgressBar, Tag } from "../components/LearnerUI.jsx";
import { AIRecommendationsCard } from "../components/AIRecommendationsCard.jsx";
import {
  BookOpen, Users, Zap, ChevronRight, Target,
  BarChart3, Video, Code2, Bookmark, Award, Trophy,
  GraduationCap, HelpCircle, Compass, Flame, Star, ShieldCheck,
  Calendar, Clock, Play, ArrowRight, CheckCircle2, Layers, Plus
} from "lucide-react";

export function HomeScreen({
  user = {}, courses = [], coursesLoading, unreadNotifs = 0, weeklyGoal = 5,
  session, push, goTab, goToMyCourses, cohort = null, cohortLoading = false,
  achievements = [], showToast,
  learningPathsQuery, pathEnrollmentsQuery
}) {
  const enrolledCourses = (courses || []).filter(c => c.enrolled);
  const continueCourse = enrolledCourses.find(c => c.progress < 100) || enrolledCourses[0] || null;
  const otherEnrolledCourses = enrolledCourses.filter(c => c.id !== continueCourse?.id);

  // Active Enrolled Learning Pathway (Admin Assigned / Enrolled)
  const enrolledPathIds = new Set(
    (pathEnrollmentsQuery?.data || []).map(e => e.path_id || e.learning_path_id || e.id)
  );
  const activePathway = (learningPathsQuery?.data || []).find(p => enrolledPathIds.has(p.id)) || null;

  const completedCourses = enrolledCourses.filter(c => (c.progress || 0) >= 100);
  const avgProgress = enrolledCourses.length
    ? Math.round(enrolledCourses.reduce((sum, c) => sum + (c.progress || 0), 0) / enrolledCourses.length)
    : 0;

  const goal = weeklyGoal || 5;
  const done = user?.weeklyDone || 0;
  const goalPercent = Math.min(100, Math.round((done / goal) * 100));
  const userFirstName = (user?.name || "Learner").split(" ")[0];

  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const currentDayIndex = (new Date().getDay() + 6) % 7; // 0 = Mon, 6 = Sun

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      
      {/* =========================================================================
          HERO BANNER: High-Functionality Command Center & Interactive Sprint Studio
          ========================================================================= */}
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
            background: "radial-gradient(circle, rgba(37, 99, 235, 0.25) 0%, transparent 70%)",
            pointerEvents: "none"
          }}
        />

        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          
          {/* Top Row: Personalized Greeting + Live KPIs */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <h1 className="tai-hero-title" style={{ fontSize: "clamp(20px, 2.5vw, 26px)", fontWeight: 900, letterSpacing: "-0.025em", margin: 0, lineHeight: 1.2, color: "#FFFFFF" }}>
                  Welcome back, {userFirstName || "Learner"}
                </h1>
                <span
                  style={{ background: "#2563EB", color: "#FFFFFF", padding: "3px 10px", borderRadius: 6, fontWeight: 800, fontSize: 11.5, letterSpacing: "0.02em", border: "1px solid rgba(255, 255, 255, 0.25)", display: "inline-flex", alignItems: "center", cursor: "pointer" }}
                  onClick={() => push("learningPaths")}
                  title="View Learning Pathways"
                >
                  {activePathway?.title ? `Pathway: ${activePathway.title}` : (continueCourse?.category || "UI/UX Design Track")}
                </span>
              </div>
              <p className="tai-hero-desc" style={{ fontSize: 13.5, margin: 0, color: "#F8FAFC", fontWeight: 500, lineHeight: 1.45 }}>
                {done >= goal ? "Outstanding! You've completed your weekly sprint target." : `${done} of ${goal} weekly lessons completed. Keep up your active pace!`}
              </p>
            </div>

            {/* Quick KPI Interactive Counters */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.12)",
                  border: "1px solid rgba(255, 255, 255, 0.22)",
                  padding: "6px 12px",
                  borderRadius: 99,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12.5,
                  fontWeight: 800,
                  color: "#FFFFFF",
                  cursor: "pointer"
                }}
                onClick={() => push("achievements")}
                title="Active Study Streak"
              >
                <Flame size={15} color="#FB923C" />
                <span>{user?.streak || 1} <span style={{ fontSize: 11, opacity: 0.9, fontWeight: 700 }}>Days</span></span>
              </div>

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.12)",
                  border: "1px solid rgba(255, 255, 255, 0.22)",
                  padding: "6px 12px",
                  borderRadius: 99,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12.5,
                  fontWeight: 800,
                  color: "#FFFFFF",
                  cursor: "pointer"
                }}
                onClick={() => push("leaderboard")}
                title="Total Earned XP"
              >
                <Zap size={15} color="#FBBF24" />
                <span>{user?.totalPoints || 1250} <span style={{ fontSize: 11, opacity: 0.9, fontWeight: 700 }}>XP</span></span>
              </div>

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.12)",
                  border: "1px solid rgba(255, 255, 255, 0.22)",
                  padding: "6px 12px",
                  borderRadius: 99,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12.5,
                  fontWeight: 800,
                  color: "#FFFFFF",
                  cursor: "pointer"
                }}
                onClick={() => push("creditsCheckout")}
                title="AI Credits"
              >
                <Plus size={15} color="#60A5FA" />
                <span>{user?.credits ?? 10} <span style={{ fontSize: 11, opacity: 0.9, fontWeight: 700 }}>Credits</span></span>
              </div>
            </div>
          </div>

          {/* Interactive Mid Grid: Active Continue Course + 7-Day Sprint Tracker */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 14 }}>
            
            {/* Active Sprint Action Card */}
            {continueCourse ? (
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.07)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 12
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <img
                    src={continueCourse.coverImageUrl || "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&auto=format&fit=crop&q=80"}
                    alt={continueCourse.title}
                    style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid rgba(255,255,255,0.2)" }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, color: "#93C5FD", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Continue Active Course
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#FFFFFF", wordBreak: "break-word", lineHeight: 1.35, marginBottom: 4 }}>
                      {continueCourse.title}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
                      {continueCourse.progress || 0}% completed • {continueCourse.category || "General"}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    className="tai-btn tai-btn-primary"
                    style={{
                      flex: 1,
                      padding: "8px 14px",
                      borderRadius: 8,
                      fontSize: 12.5,
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6
                    }}
                    onClick={() => push("courseDetail", { id: continueCourse.id })}
                  >
                    <Play size={13} fill="#FFFFFF" />
                    <span>Resume ({continueCourse.progress || 0}%)</span>
                  </button>

                  <button
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      background: "rgba(255, 255, 255, 0.1)",
                      border: "1px solid rgba(255, 255, 255, 0.18)",
                      color: "#FFFFFF",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 5
                    }}
                    onClick={() => push("ai")}
                  >
                    <Zap size={13} color="#60A5FA" />
                    <span>AI Coach</span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.07)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: 12,
                  padding: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: "#FFFFFF" }}>Explore Curated Courses</div>
                  <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>Browse verified certifications and learning paths.</div>
                </div>
                <button className="tai-btn tai-btn-primary" onClick={() => goTab("courses")} style={{ padding: "8px 14px", fontSize: 12 }}>
                  Browse →
                </button>
              </div>
            )}

            {/* 7-Day Sprint Pace Tracker */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.07)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 12,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 10
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#DBEAFE" }}>
                  <Target size={14} color="#60A5FA" />
                  <span>Weekly Sprint ({done}/{goal} Lessons)</span>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: "#34D399" }}>
                  {goalPercent}% Goal
                </span>
              </div>

              {/* 7 Day Pills */}
              <div style={{ display: "flex", gap: 6, justifyContent: "space-between" }}>
                {daysOfWeek.map((day, idx) => {
                  const isPastOrToday = idx <= currentDayIndex;
                  const isToday = idx === currentDayIndex;
                  const isMet = isPastOrToday && (done > idx || (idx === 0 && (user.streak || 1) > 0));
                  return (
                    <div
                      key={day}
                      style={{
                        flex: 1,
                        textAlign: "center",
                        padding: "6px 2px",
                        borderRadius: 8,
                        background: isMet ? "rgba(16, 185, 129, 0.25)" : isToday ? "rgba(59, 130, 246, 0.3)" : "rgba(255, 255, 255, 0.05)",
                        border: isToday ? "1.5px solid #60A5FA" : isMet ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(255, 255, 255, 0.1)"
                      }}
                    >
                      <div style={{ fontSize: 9.5, fontWeight: 800, color: isToday ? "#93C5FD" : isMet ? "#A7F3D0" : "rgba(255,255,255,0.4)" }}>
                        {day}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 900, marginTop: 2, color: isMet ? "#34D399" : isToday ? "#FFFFFF" : "rgba(255,255,255,0.3)" }}>
                        {isMet ? "✓" : isToday ? "•" : "-"}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mini goal progress bar */}
              <div style={{ height: 5, borderRadius: 99, background: "rgba(255, 255, 255, 0.12)", overflow: "hidden" }}>
                <div style={{ width: `${goalPercent}%`, height: "100%", background: "linear-gradient(90deg, #10B981 0%, #059669 100%)", borderRadius: 99 }} />
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* =========================================================================
          BALANCED 2-COLUMN DASHBOARD GRID
          ========================================================================= */}
      <div className="tai-dashboard-grid" style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
        
        {/* =========================================================================
            LEFT COLUMN: Active Curriculum, Cohort Space & Saved Library
            ========================================================================= */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0, width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
          
          {/* 1. Track Curriculum & Enrolled Modules (Compact Non-redundant Roadmap) */}
          {coursesLoading ? (
            <div className="tai-card" style={{ padding: 20, textAlign: "center" }}>
              <div className="tai-body-text" style={{ color: "var(--text-2)", fontWeight: 600 }}>Loading your courses...</div>
            </div>
          ) : enrolledCourses.length === 0 ? (
            <div className="tai-card" style={{ padding: 22, textAlign: "center", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="tai-title-sm" style={{ marginBottom: 6, color: "var(--text)" }}>Explore Your Career Curriculum</div>
              <div className="tai-body-text" style={{ color: "var(--text-2)", fontSize: 13 }}>
                Enroll in verified tracks and courses to start building your AI and design credentials.
              </div>
              <button className="tai-btn tai-btn-primary tai-mt12" style={{ width: "100%", fontWeight: 800 }} onClick={() => goTab("courses")}>
                <BookOpen size={16} /> Browse Course Catalog
              </button>
            </div>
          ) : (
            <div className="tai-card" style={{ padding: 18, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", width: "100%", boxSizing: "border-box" }}>
              <div className="tai-row tai-between" style={{ marginBottom: 12, alignItems: "center" }}>
                <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(37, 99, 235, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Layers size={17} color="var(--primary)" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>
                      {activePathway?.title ? `Roadmap: ${activePathway.title}` : "Curriculum Roadmap"}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-2)", fontWeight: 600 }}>
                      {completedCourses.length} of {enrolledCourses.length} Track Modules Complete
                    </div>
                  </div>
                </div>
                <span className="tai-link" style={{ fontSize: 12, fontWeight: 800 }} onClick={() => activePathway ? push("learningPaths") : goTab("courses")}>
                  {activePathway ? "View Pathway →" : `All Courses (${enrolledCourses.length}) →`}
                </span>
              </div>

              {/* Overall Track Progress Snapshot */}
              <div style={{ background: "var(--surface-3)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 12 }}>
                <div className="tai-row tai-between" style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 5 }}>
                  <span style={{ color: "var(--text)" }}>Track Mastery Progress</span>
                  <span style={{ color: "var(--primary)", fontWeight: 800 }}>{avgProgress}% Completed</span>
                </div>
                <ProgressBar value={avgProgress} height={6} />
              </div>

              {/* Curated 3 Next Modules (Non-redundant, excluding current hero course) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(otherEnrolledCourses.length > 0 ? otherEnrolledCourses.slice(0, 3) : enrolledCourses.slice(0, 3)).map((c, idx) => {
                  const isFinished = (c.progress || 0) >= 100;
                  const iconColors = ["#2563EB", "#059669", "#D97706", "#7C3AED"];
                  const modColor = iconColors[idx % iconColors.length];
                  
                  return (
                    <div
                      key={c.id}
                      className="tai-row tai-between"
                      style={{
                        padding: "10px 12px",
                        background: "var(--surface-3)",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                        gap: 10,
                        alignItems: "center",
                        transition: "all 0.15s ease"
                      }}
                      onClick={() => push("courseDetail", { id: c.id })}
                    >
                      <div className="tai-row tai-gap10" style={{ minWidth: 0, flex: 1, alignItems: "center" }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: `rgba(37, 99, 235, 0.1)`,
                            border: `1px solid rgba(37, 99, 235, 0.2)`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0
                          }}
                        >
                          <BookOpen size={16} color="var(--primary)" />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="tai-row tai-gap6" style={{ alignItems: "center", marginBottom: 2 }}>
                            {isFinished ? (
                              <span style={{ fontSize: 10, fontWeight: 800, color: "#059669", background: "rgba(16, 185, 129, 0.15)", padding: "1px 6px", borderRadius: 4 }}>
                                Completed ✓
                              </span>
                            ) : (c.progress || 0) > 0 ? (
                              <span style={{ fontSize: 10, fontWeight: 800, color: "var(--primary)", background: "rgba(37, 99, 235, 0.15)", padding: "1px 6px", borderRadius: 4 }}>
                                In Progress
                              </span>
                            ) : (
                              <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-3)", background: "var(--surface)", padding: "1px 6px", borderRadius: 4 }}>
                                Up Next
                              </span>
                            )}
                            <span style={{ fontSize: 11, color: "var(--text-2)", fontWeight: 600 }}>{c.category || "Design"}</span>
                          </div>
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {c.title}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: isFinished ? "#059669" : "var(--primary)" }}>
                          {c.progress || 0}%
                        </div>
                        <div style={{ fontSize: 10.5, color: "var(--text-3)", fontWeight: 600 }}>
                          {isFinished ? "Verified" : "Start →"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Clean Footer Link */}
              <div style={{ marginTop: 10, textAlign: "center" }}>
                <button
                  className="tai-btn tai-btn-outline"
                  style={{ width: "100%", padding: "7px 12px", fontSize: 11.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  onClick={() => goTab("courses")}
                >
                  <span>Explore Full {enrolledCourses.length}-Course Curriculum</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* 2. Cohort Sprint & Milestone Card */}
          {cohortLoading ? (
            <div className="tai-card tai-empty" style={{ padding: 24, fontSize: 13, borderRadius: 12 }}>
              Loading cohort sprint data...
            </div>
          ) : !cohort ? (
            <div className="tai-card" style={{ padding: 16, borderRadius: 12, border: "1px solid var(--border)" }}>
              <div className="tai-row tai-gap10">
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Users size={17} color="var(--primary)" />
                </div>
                <div>
                  <div className="tai-label">Your cohort</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 2 }}>Not part of a cohort yet</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="tai-card" style={{
              padding: "16px",
              borderRadius: 12,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              position: "relative",
              overflow: "hidden",
              width: "100%",
              boxSizing: "border-box"
            }}>
              <div className="tai-row tai-between" style={{ alignItems: "center", marginBottom: 12 }}>
                <div className="tai-row tai-gap10" style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(59, 130, 246, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Users size={17} color="var(--primary)" />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", lineHeight: 1.35, wordBreak: "break-word" }}>
                      {cohort?.name || "Q1 Onboarding Cohort"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>
                      Sprint 5 of 12
                    </div>
                  </div>
                </div>
                <Tag tone="primary">Sprint 5</Tag>
              </div>

              <div style={{ background: "var(--surface)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 12 }}>
                <div className="tai-row tai-between" style={{ fontSize: 11, fontWeight: 700, marginBottom: 5 }}>
                  <span style={{ color: "var(--text-2)" }}>Curriculum Milestone</span>
                  <span style={{ color: "var(--primary)" }}>42% Completed</span>
                </div>
                <div style={{ height: 6, background: "var(--surface-3)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: "42%", height: "100%", background: "var(--primary, #2563EB)", borderRadius: 3 }} />
                </div>
              </div>

              <div className="tai-row tai-between" style={{ alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                  68 enrolled peers • Next: Tomorrow 10:00 AM
                </div>
                <button
                  className="tai-btn tai-btn-primary tai-btn-sm"
                  style={{ padding: "6px 14px", fontSize: 12, fontWeight: 700, flexShrink: 0, borderRadius: 6 }}
                  onClick={() => push("cohort")}
                >
                  Enter Cohort Space →
                </button>
              </div>
            </div>
          )}
          {/* =========================================================================
              LEFT CARD 2: Course Progress & Quick Milestone Switcher
              ========================================================================= */}
          <div className="tai-card" style={{ padding: 18, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", width: "100%", boxSizing: "border-box" }}>
            <div className="tai-row tai-between" style={{ marginBottom: 12, alignItems: "center" }}>
              <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(37, 99, 235, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <BarChart3 size={17} color="var(--primary)" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>Progress &amp; Milestones</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                    {completedCourses.length} of {enrolledCourses.length} Courses Completed
                  </div>
                </div>
              </div>
              <span className="tai-link" style={{ fontSize: 12, fontWeight: 800 }} onClick={() => push("myProgress")}>Details →</span>
            </div>

            {/* 4-Metric Grid Snapshot */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div style={{ background: "var(--surface-3)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 10.5, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase" }}>Total XP</div>
                <div style={{ fontSize: 17, fontWeight: 900, color: "var(--text)", marginTop: 2 }}>{user?.totalPoints || 1250}</div>
              </div>
              <div style={{ background: "var(--surface-3)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 10.5, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase" }}>Study Streak</div>
                <div style={{ fontSize: 17, fontWeight: 900, color: "#EA580C", marginTop: 2 }}>{user?.streak || 8} Days</div>
              </div>
              <div style={{ background: "var(--surface-3)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 10.5, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase" }}>Lessons Done</div>
                <div style={{ fontSize: 17, fontWeight: 900, color: "#059669", marginTop: 2 }}>{user?.completedLessonsCount || 4} Lessons</div>
              </div>
              <div style={{ background: "var(--surface-3)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 10.5, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase" }}>Total Hours</div>
                <div style={{ fontSize: 17, fontWeight: 900, color: "var(--primary)", marginTop: 2 }}>14.5 Hrs</div>
              </div>
            </div>

            {/* Progress Actions */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                className="tai-btn tai-btn-outline"
                style={{ width: "100%", padding: "7px 10px", fontSize: 11.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                onClick={() => push("myProgress")}
              >
                <BarChart3 size={13} color="var(--primary)" />
                <span>Analytics</span>
              </button>
              <button
                className="tai-btn tai-btn-outline"
                style={{ width: "100%", padding: "7px 10px", fontSize: 11.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                onClick={() => push("achievements")}
              >
                <GraduationCap size={13} color="#059669" />
                <span>Certificates</span>
              </button>
            </div>
          </div>

          {/* =========================================================================
              LEFT CARD 3: Saved Bookmarks & Pinned Quick Links
              ========================================================================= */}
          <div className="tai-card" style={{ padding: 18, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", width: "100%", boxSizing: "border-box" }}>
            <div className="tai-row tai-between" style={{ marginBottom: 12, alignItems: "center" }}>
              <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(37, 99, 235, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Bookmark size={17} color="var(--primary)" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>Saved Bookmarks</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>Quick access to your saved resources</div>
                </div>
              </div>
              <span className="tai-link" style={{ fontSize: 12, fontWeight: 800 }} onClick={() => push("bookmarks")}>View All →</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {[
                { title: "Spatial Computing & VisionOS Design Foundations", type: "Course", meta: "3 Lessons", icon: BookOpen },
                { title: "Variables 2.0 & Token Architecture Deep Dive", type: "Lesson", meta: "Figma AI", icon: Play },
                { title: "UX Career Growth & Portfolio Reviews with Astrid", type: "Mentor AMA", meta: "Recording", icon: Video }
              ].map((item, idx) => {
                const ItemIcon = item.icon;
                return (
                  <div
                    key={idx}
                    className="tai-row tai-between"
                    style={{
                      padding: "8px 10px",
                      background: "var(--surface-3)",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      cursor: "pointer",
                      gap: 8,
                      alignItems: "center"
                    }}
                    onClick={() => push("bookmarks")}
                  >
                    <div className="tai-row tai-gap8" style={{ minWidth: 0, flex: 1, alignItems: "center" }}>
                      <ItemIcon size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", wordBreak: "break-word", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 2 }}>{item.type} • {item.meta}</div>
                      </div>
                    </div>
                    <ChevronRight size={14} color="var(--text-3)" style={{ flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>

            <button
              className="tai-btn tai-btn-outline"
              style={{ width: "100%", padding: "7px 12px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              onClick={() => push("bookmarks")}
            >
              <span>Explore Bookmarked Library</span>
              <ChevronRight size={14} />
            </button>
          </div>

        </div>

        {/* =========================================================================
            RIGHT COLUMN: Quick Shortcuts, Achievements, Analytics & AI Insights
            ========================================================================= */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0, width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
          
          {/* 1. Quick Hub Links: Learning Paths, Leaderboard, Instructors, AI Quiz */}
          <div className="tai-card" style={{ padding: 16, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", width: "100%", boxSizing: "border-box" }}>
            <div className="tai-row tai-between" style={{ marginBottom: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text)" }}>Quick Access</div>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>Learner shortcuts</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, width: "100%", boxSizing: "border-box" }}>
              <div className="tai-card-hover" style={{ cursor: "pointer", padding: "10px 3px", textAlign: "center", background: "var(--surface-3)", borderRadius: 8, border: "1px solid var(--border)", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }} onClick={() => push("learningPaths")}>
                <Compass size={18} color="var(--primary)" style={{ margin: "0 auto" }} />
                <div style={{ fontWeight: 800, fontSize: 10.5, marginTop: 4, color: "var(--text)", wordBreak: "break-word", lineHeight: 1.2 }}>Paths</div>
              </div>
              <div className="tai-card-hover" style={{ cursor: "pointer", padding: "10px 3px", textAlign: "center", background: "var(--surface-3)", borderRadius: 8, border: "1px solid var(--border)", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }} onClick={() => push("leaderboard")}>
                <Trophy size={18} color="var(--primary)" style={{ margin: "0 auto" }} />
                <div style={{ fontWeight: 800, fontSize: 10.5, marginTop: 4, color: "var(--text)", wordBreak: "break-word", lineHeight: 1.2 }}>Rankings</div>
              </div>
              <div className="tai-card-hover" style={{ cursor: "pointer", padding: "10px 3px", textAlign: "center", background: "var(--surface-3)", borderRadius: 8, border: "1px solid var(--border)", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }} onClick={() => push("mentors")}>
                <GraduationCap size={18} color="var(--primary)" style={{ margin: "0 auto" }} />
                <div style={{ fontWeight: 800, fontSize: 10.5, marginTop: 4, color: "var(--text)", wordBreak: "break-word", lineHeight: 1.2 }}>Instructors</div>
              </div>
              <div className="tai-card-hover" style={{ cursor: "pointer", padding: "10px 3px", textAlign: "center", background: "var(--surface-3)", borderRadius: 8, border: "1px solid var(--border)", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }} onClick={() => push("aiQuiz")}>
                <HelpCircle size={18} color="var(--primary)" style={{ margin: "0 auto" }} />
                <div style={{ fontWeight: 800, fontSize: 10.5, marginTop: 4, color: "var(--text)", wordBreak: "break-word", lineHeight: 1.2 }}>AI Quiz</div>
              </div>
            </div>
          </div>

          {/* 2. Dedicated Achievements & Milestone Badges Card */}
          <div className="tai-card" style={{ padding: 18, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", width: "100%", boxSizing: "border-box" }}>
            <div className="tai-row tai-between" style={{ marginBottom: 12, alignItems: "center" }}>
              <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(37, 99, 235, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Award size={18} color="var(--primary)" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>Achievements &amp; Badges</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                    {(achievements?.length || 4)} Unlocked • Level {user?.level || 1}
                  </div>
                </div>
              </div>
              <span className="tai-link" style={{ fontSize: 12, fontWeight: 700 }} onClick={() => push("achievements")}>View All →</span>
            </div>

            {/* Streak & XP Highlight Banner */}
            <div style={{
              background: "linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(245, 158, 11, 0.08) 100%)",
              borderRadius: 10,
              padding: "10px 12px",
              border: "1px solid rgba(37, 99, 235, 0.15)",
              marginBottom: 12
            }}>
              <div className="tai-row tai-between" style={{ alignItems: "center", marginBottom: 6 }}>
                <div className="tai-row tai-gap6" style={{ alignItems: "center" }}>
                  <Flame size={15} color="#EA580C" />
                  <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text)" }}>
                    {user?.streak || 8}-Day Streak
                  </span>
                </div>
                <span style={{ background: "rgba(245, 158, 11, 0.15)", color: "#B45309", padding: "3px 8px", borderRadius: 6, fontWeight: 800, fontSize: 11, border: "1px solid rgba(245, 158, 11, 0.35)", display: "inline-flex", alignItems: "center" }}>
                  {user?.totalPoints || 1250} Total XP
                </span>
              </div>

              {/* Level XP Bar */}
              <div style={{ fontSize: 11, color: "var(--text-2)", fontWeight: 600, marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                <span>Level {user?.level || 1} Progress</span>
                <span style={{ fontWeight: 800, color: "var(--primary)" }}>{Math.round(((user?.totalPoints || 1250) % 500) / 5)}%</span>
              </div>
              <ProgressBar value={((user?.totalPoints || 1250) % 500) / 5} height={5} />
            </div>

            {/* Badges Preview Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 12, width: "100%", boxSizing: "border-box" }}>
              {[
                { title: "First Step", xp: 50, icon: Star },
                { title: `${user?.streak || 8}d Streak`, xp: 100, icon: Flame },
                { title: "Quiz Master", xp: 150, icon: Award }
              ].map((badge, idx) => {
                const BadgeIcon = badge.icon;
                return (
                  <div
                    key={idx}
                    className="tai-card-hover"
                    style={{
                      padding: "8px 4px",
                      borderRadius: 8,
                      background: "var(--surface-3)",
                      border: "1px solid var(--border)",
                      textAlign: "center",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      flex: 1,
                      minWidth: 0
                    }}
                    onClick={() => push("achievements")}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(37, 99, 235, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 4px" }}>
                      <BadgeIcon size={14} color="var(--primary)" />
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {badge.title}
                    </div>
                    <div style={{ fontSize: 9.5, color: "#10B981", fontWeight: 700, marginTop: 1 }}>
                      +{badge.xp} XP
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              className="tai-btn tai-btn-outline"
              style={{ width: "100%", padding: "7px 12px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              onClick={() => push("achievements")}
            >
              <Award size={14} color="var(--primary)" />
              <span>Claim Streak Rewards &amp; Badges</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* 3. AI Coach Insights & Recommendations */}
          <AIRecommendationsCard user={user} courses={courses} session={session} goTab={goTab} maxItems={1} showSeeAll />

        </div>
      </div>
    </div>
  );
}
