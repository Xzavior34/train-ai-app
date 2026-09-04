import React from "react";
import { Tag } from "../components/LearnerUI.jsx";
import { AIRecommendationsCard } from "../components/AIRecommendationsCard.jsx";
import {
  BookOpen, Users, ChevronRight, Zap,
  BarChart3, Bookmark,
  GraduationCap, HelpCircle, ShieldCheck, Play
} from "lucide-react";

export function HomeScreen({
  user = {}, courses = [], coursesLoading, unreadNotifs = 0, weeklyGoal = 5,
  session, push, goTab, goToMyCourses, cohort = null, cohortLoading = false,
  achievements = [], showToast,
  learningPathsQuery, pathEnrollmentsQuery,
  complianceAssignmentsQuery
}) {
  const enrolledCourses = (courses || []).filter(c => c.enrolled);
  const continueCourse = enrolledCourses.find(c => c.progress < 100) || enrolledCourses[0] || null;

  // Active Enrolled Learning Pathway (Admin Assigned / Enrolled)
  const enrolledPathIds = new Set(
    (pathEnrollmentsQuery?.data || []).map(e => e.path_id || e.learning_path_id || e.id)
  );
  const activePathway = (learningPathsQuery?.data || []).find(p => enrolledPathIds.has(p.id)) || null;

  // Active Mandatory Compliance Assignments
  const complianceAssignmentsList = complianceAssignmentsQuery?.data || [];
  const pendingComplianceAssignments = complianceAssignmentsList.filter(a => a.status !== "completed");

  const completedCourses = enrolledCourses.filter(c => (c.progress || 0) >= 100);
  const userFirstName = (user?.name || "Learner").split(" ")[0];

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
                  title="Customize or switch Learning Pathway"
                >
                  {activePathway?.title ? `Pathway: ${activePathway.title}` : (continueCourse?.category ? `${continueCourse.category} Track` : "Customize Learning Pathway ⚙️")}
                </span>
              </div>
              <p className="tai-hero-desc" style={{ fontSize: 13.5, margin: 0, color: "#F8FAFC", fontWeight: 500, lineHeight: 1.45 }}>
                {continueCourse ? `Pick up where you left off in ${continueCourse.title}.` : "Explore your courses to get started."}
              </p>
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

          </div>

        </div>
      </div>

      {/* Mandatory Compliance Alert Card */}
      {pendingComplianceAssignments.length > 0 && (
        <div
          className="tai-card anim-fluid-entrance"
          style={{
            borderRadius: 12,
            padding: "16px 20px",
            background: "linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(249, 115, 22, 0.06) 100%)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 14
          }}
        >
          <div className="tai-row tai-gap12" style={{ minWidth: 240, flex: 1, alignItems: "center" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(239, 68, 68, 0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ShieldCheck size={20} color="#DC2626" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10.5, fontWeight: 900, background: "#DC2626", color: "#FFFFFF", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.03em" }}>
                  MANDATORY COMPLIANCE
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>
                  {pendingComplianceAssignments[0].courses?.title || "Workplace Compliance Module"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 3 }}>
                Assigned by Administrator • {pendingComplianceAssignments[0].due_at ? `Due by ${new Date(pendingComplianceAssignments[0].due_at).toLocaleDateString()}` : "Action Required"}
                {pendingComplianceAssignments.length > 1 && ` (+${pendingComplianceAssignments.length - 1} more assigned)`}
              </div>
            </div>
          </div>

          <button
            className="tai-btn tai-btn-primary tai-btn-sm"
            style={{ padding: "8px 16px", fontWeight: 800, background: "#DC2626", borderColor: "#DC2626" }}
            onClick={() => push("courseDetail", { id: pendingComplianceAssignments[0].course_id || pendingComplianceAssignments[0].courses?.id })}
          >
            Start Compliance Module →
          </button>
        </div>
      )}

      {/* =========================================================================
          BALANCED 2-COLUMN DASHBOARD GRID
          ========================================================================= */}
      <div className="tai-dashboard-grid" style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
        
        {/* =========================================================================
            LEFT COLUMN: Active Curriculum, Cohort Space & Saved Library
            ========================================================================= */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0, width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
          
          {/* Cohort Sprint & Milestone Card */}
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
                <div style={{ fontSize: 10.5, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase" }}>Courses Completed</div>
                <div style={{ fontSize: 17, fontWeight: 900, color: "var(--text)", marginTop: 2 }}>{completedCourses.length}</div>
              </div>
              <div style={{ background: "var(--surface-3)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 10.5, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase" }}>Certificates Earned</div>
                <div style={{ fontSize: 17, fontWeight: 900, color: "#059669", marginTop: 2 }}>{completedCourses.length}</div>
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
                { title: "Spatial Computing & VisionOS Design Foundations", type: "Course", meta: "3 Lessons", icon: BookOpen }
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
              <div className="tai-card-hover" style={{ cursor: "pointer", padding: "10px 3px", textAlign: "center", background: "var(--surface-3)", borderRadius: 8, border: "1px solid var(--border)", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }} onClick={() => goTab("courses")}>
                <BookOpen size={18} color="var(--primary)" style={{ margin: "0 auto" }} />
                <div style={{ fontWeight: 800, fontSize: 10.5, marginTop: 4, color: "var(--text)", wordBreak: "break-word", lineHeight: 1.2 }}>Assigned Courses</div>
              </div>
              <div className="tai-card-hover" style={{ cursor: "pointer", padding: "10px 3px", textAlign: "center", background: "var(--surface-3)", borderRadius: 8, border: "1px solid var(--border)", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }} onClick={() => push("aiQuiz")}>
                <HelpCircle size={18} color="var(--primary)" style={{ margin: "0 auto" }} />
                <div style={{ fontWeight: 800, fontSize: 10.5, marginTop: 4, color: "var(--text)", wordBreak: "break-word", lineHeight: 1.2 }}>AI Quiz Generator</div>
              </div>
              <div className="tai-card-hover" style={{ cursor: "pointer", padding: "10px 3px", textAlign: "center", background: "var(--surface-3)", borderRadius: 8, border: "1px solid var(--border)", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }} onClick={() => push("studyGroup")}>
                <Users size={18} color="var(--primary)" style={{ margin: "0 auto" }} />
                <div style={{ fontWeight: 800, fontSize: 10.5, marginTop: 4, color: "var(--text)", wordBreak: "break-word", lineHeight: 1.2 }}>Study Group</div>
              </div>
              <div className="tai-card-hover" style={{ cursor: "pointer", padding: "10px 3px", textAlign: "center", background: "var(--surface-3)", borderRadius: 8, border: "1px solid var(--border)", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }} onClick={() => push("mentors")}>
                <GraduationCap size={18} color="var(--primary)" style={{ margin: "0 auto" }} />
                <div style={{ fontWeight: 800, fontSize: 10.5, marginTop: 4, color: "var(--text)", wordBreak: "break-word", lineHeight: 1.2 }}>Instructors</div>
              </div>
            </div>
          </div>

          {/* AI Coach Insights & Recommendations */}
          <AIRecommendationsCard user={user} courses={courses} session={session} goTab={goTab} maxItems={1} showSeeAll />

        </div>
      </div>
    </div>
  );
}
