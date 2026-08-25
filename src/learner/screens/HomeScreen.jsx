import React from "react";
import { Avatar, ProgressBar, Tag } from "../components/LearnerUI.jsx";
import { AIRecommendationsCard } from "../components/AIRecommendationsCard.jsx";
import {
  BookOpen, Users, Zap, ChevronRight, Target,
  BarChart3, Video, Code2, Bookmark, Award, Trophy,
  GraduationCap, HelpCircle
} from "lucide-react";

export function HomeScreen({
  user = {}, courses = [], coursesLoading, unreadNotifs = 0, weeklyGoal = 5,
  session, push, goTab, goToMyCourses, cohort = null, cohortLoading = false,
}) {
  const enrolledCourses = (courses || []).filter(c => c.enrolled);
  const continueCourse = enrolledCourses.find(c => c.progress < 100) || enrolledCourses[0] || null;

  const completedCourses = enrolledCourses.filter(c => (c.progress || 0) >= 100);
  const avgProgress = enrolledCourses.length
    ? Math.round(enrolledCourses.reduce((sum, c) => sum + (c.progress || 0), 0) / enrolledCourses.length)
    : 0;

  const goal = weeklyGoal || 5;
  const done = user?.weeklyDone || 0;
  const goalPercent = Math.min(100, Math.round((done / goal) * 100));
  const userFirstName = (user?.name || "Learner").split(" ")[0];

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* =========================================================================
          HERO BANNER: Visually Consistent Learner Command Center
          ========================================================================= */}
      {/* =========================================================================
          HERO BANNER: Adaptive Liquid Glass Learner Command Center
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
            width: 180,
            height: 180,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59, 130, 246, 0.22) 0%, transparent 70%)",
            pointerEvents: "none"
          }}
        />

        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="tai-hero-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 className="tai-hero-title" style={{ fontSize: "clamp(20px, 2.5vw, 25px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 4px", lineHeight: 1.2 }}>
                Welcome back, {userFirstName || "Learner"}
              </h1>
              <p className="tai-hero-desc" style={{ fontSize: 13, margin: 0, maxWidth: 620, lineHeight: 1.45 }}>
                {done} of {goal} weekly lessons done. Continue in <strong style={{ color: "#93C5FD" }}>{continueCourse?.title || "AI Fundamentals"}</strong>.
              </p>
            </div>

            {continueCourse && (
              <button
                className="tai-btn tai-btn-primary"
                style={{
                  padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                  cursor: "pointer", flexShrink: 0
                }}
                onClick={() => push("courseDetail", { id: continueCourse.id })}
              >
                <span>Resume Lesson →</span>
              </button>
            )}
          </div>

          {/* Milestone Progress Bar */}
          <div className="tai-hero-subcard" style={{
            padding: "12px 16px",
            borderRadius: 10
          }}>
            <div className="tai-row tai-between" style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
              <span className="tai-row tai-gap6" style={{ color: "#DBEAFE" }}>
                <Target size={14} color="#60A5FA" />
                <span>Weekly Sprint Goal ({done}/{goal})</span>
              </span>
              <span style={{ color: "#34D399", fontWeight: 700 }}>{goalPercent}% Completed</span>
            </div>

            <div style={{
              height: 8,
              borderRadius: 99,
              background: "rgba(255, 255, 255, 0.12)",
              overflow: "hidden"
            }}>
              <div style={{
                width: `${goalPercent}%`,
                height: "100%",
                background: "linear-gradient(90deg, #10B981 0%, #059669 100%)",
                borderRadius: 99,
                transition: "width 0.4s ease"
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Responsive Layout (Main LMS Track vs Right Side Info Hub) */}
      <div className="tai-dashboard-grid" style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
        
        {/* LEFT COLUMN: Continue Learning, Career Track, Recommendations, Chart, Assignments, Study Rooms */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0, width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
          
          {/* Continue Learning Banner */}
          {coursesLoading ? (
            <div className="tai-card" style={{ padding: 20, textAlign: "center" }}>
              <div className="tai-body-text">Loading your courses...</div>
            </div>
          ) : !continueCourse ? (
            <div className="tai-card" style={{ padding: 20, textAlign: "center" }}>
              <div className="tai-body-text">
                {enrolledCourses.length > 0
                  ? `You've completed all ${enrolledCourses.length} of your assigned courses.`
                  : "No active course yet. Browse the catalog to get started."}
              </div>
              <button className="tai-btn tai-btn-primary tai-mt12" style={{ width: "100%" }} onClick={enrolledCourses.length > 0 ? goToMyCourses : () => goTab("courses")}>
                <BookOpen size={16} /> {enrolledCourses.length > 0 ? "See my courses" : "Browse courses"}
              </button>
            </div>
          ) : (
            <div className="tai-card tai-card-hover" style={{ padding: 0, overflow: "hidden", borderRadius: 10, border: "1px solid var(--border)", width: "100%", boxSizing: "border-box" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="tai-row tai-gap8" style={{ fontWeight: 700, fontSize: 13.5 }}>
                  <BookOpen size={16} color="var(--primary)" />
                  <span>Continue learning</span>
                </div>
                <span className="tai-link" style={{ fontSize: 12, fontWeight: 700 }} onClick={() => goTab("courses")}>My courses</span>
              </div>

              <div style={{ padding: "14px 16px", boxSizing: "border-box", width: "100%" }}>
                <div className="tai-row tai-gap12" style={{ alignItems: "center", marginBottom: 12 }}>
                  <img 
                    src={continueCourse.coverImageUrl || "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&auto=format&fit=crop&q=80"}
                    alt={continueCourse.title}
                    style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="tai-row tai-between" style={{ marginBottom: 3 }}>
                      <Tag tone="primary">{continueCourse.category || "Technology"}</Tag>
                      <span style={{ fontSize: 11, color: "var(--text-3)" }}>12 hrs</span>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", lineHeight: 1.35, wordBreak: "break-word" }}>
                      {continueCourse.title}
                    </div>
                  </div>
                </div>

                <div className="tai-row tai-between tai-gap12" style={{ alignItems: "center" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="tai-row tai-between" style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>
                      <span>Progress</span>
                      <span style={{ fontWeight: 700, color: "var(--primary)" }}>{continueCourse.progress || 0}%</span>
                    </div>
                    <ProgressBar value={continueCourse.progress || 0} height={6} />
                  </div>
                  <button 
                    className="tai-btn tai-btn-primary tai-btn-sm"
                    style={{ padding: "8px 18px", fontSize: 12, fontWeight: 700, flexShrink: 0 }}
                    onClick={() => push("courseDetail", { id: continueCourse.id })}
                  >
                    Continue →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Cohort Sprint & Milestone Card */}
          {cohortLoading ? (
            <div className="tai-card tai-empty" style={{ padding: 24, fontSize: 13 }}>
              Loading cohort sprint data...
            </div>
          ) : !cohort ? (
            <div className="tai-card" style={{ padding: 16, borderRadius: 10 }}>
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
            borderRadius: 10,
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


          {/* AI Insights Summary */}
          <AIRecommendationsCard user={user} courses={courses} session={session} goTab={goTab} maxItems={1} showSeeAll />

        </div>

        {/* RIGHT COLUMN: Quick Access Hub, Consolidated Learning Milestones & Saved Library */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0, width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
          
          {/* 1. Quick Hub Links: Leaderboard, Instructors, AI Quiz */}
          <div className="tai-card" style={{ padding: 16, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="tai-row tai-between" style={{ marginBottom: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text)" }}>Quick Access</div>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>Learner shortcuts</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div className="tai-card-hover" style={{ cursor: "pointer", padding: "12px 6px", textAlign: "center", background: "var(--surface-3)", borderRadius: 8, border: "1px solid var(--border)", transition: "all 0.15s ease" }} onClick={() => push("leaderboard")}>
                <Trophy size={20} color="var(--primary)" style={{ margin: "0 auto" }} />
                <div style={{ fontWeight: 800, fontSize: 11.5, marginTop: 5, color: "var(--text)" }}>Leaderboard</div>
              </div>
              <div className="tai-card-hover" style={{ cursor: "pointer", padding: "12px 6px", textAlign: "center", background: "var(--surface-3)", borderRadius: 8, border: "1px solid var(--border)", transition: "all 0.15s ease" }} onClick={() => push("mentors")}>
                <GraduationCap size={20} color="var(--primary)" style={{ margin: "0 auto" }} />
                <div style={{ fontWeight: 800, fontSize: 11.5, marginTop: 5, color: "var(--text)" }}>Instructors</div>
              </div>
              <div className="tai-card-hover" style={{ cursor: "pointer", padding: "12px 6px", textAlign: "center", background: "var(--surface-3)", borderRadius: 8, border: "1px solid var(--border)", transition: "all 0.15s ease" }} onClick={() => push("aiQuiz")}>
                <HelpCircle size={20} color="var(--primary)" style={{ margin: "0 auto" }} />
                <div style={{ fontWeight: 800, fontSize: 11.5, marginTop: 5, color: "var(--text)" }}>AI Quiz</div>
              </div>
            </div>
          </div>

          {/* 2. Unified Progress & Achievements Analytics Card */}
          <div className="tai-card" style={{ padding: 18, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="tai-row tai-between" style={{ marginBottom: 14 }}>
              <div className="tai-row tai-gap8">
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(37, 99, 235, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <BarChart3 size={17} color="var(--primary)" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>Progress &amp; Milestones</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>Analytics &amp; verified achievements</div>
                </div>
              </div>
              <span className="tai-link" style={{ fontSize: 12 }} onClick={() => push("myProgress")}>Details →</span>
            </div>

            {/* 4-Metric Grid Snapshot */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              <div style={{ background: "var(--surface-3)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>Avg Completion</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "var(--primary)", marginTop: 2 }}>{avgProgress}%</div>
              </div>
              <div style={{ background: "var(--surface-3)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>Active Courses</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text)", marginTop: 2 }}>{enrolledCourses.length}</div>
              </div>
              <div style={{ background: "var(--surface-3)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>Certificates</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "var(--success, #10B981)", marginTop: 2 }}>{completedCourses.length}</div>
              </div>
              <div style={{ background: "var(--surface-3)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>XP Points</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#F59E0B", marginTop: 2 }}>{user?.totalPoints || 1250}</div>
              </div>
            </div>

            {/* Overall Curriculum Completion Bar */}
            <div style={{ background: "var(--surface-3)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 12 }}>
              <div className="tai-row tai-between" style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 6 }}>
                <span style={{ color: "var(--text-2)" }}>Curriculum Progress</span>
                <span style={{ color: "var(--primary)" }}>{completedCourses.length} of {enrolledCourses.length || 1} Complete</span>
              </div>
              <ProgressBar value={enrolledCourses.length ? Math.round((completedCourses.length / enrolledCourses.length) * 100) : 0} height={6} />
            </div>

            <div className="tai-row tai-gap8">
              <button
                className="tai-btn tai-btn-outline"
                style={{ flex: 1, padding: "8px 10px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                onClick={() => push("myProgress")}
              >
                <span>Analytics</span>
                <ChevronRight size={13} />
              </button>
              <button
                className="tai-btn tai-btn-outline"
                style={{ flex: 1, padding: "8px 10px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                onClick={() => push("achievements")}
              >
                <Award size={13} color="var(--primary)" />
                <span>Badges</span>
              </button>
            </div>
          </div>

          {/* 3. Saved Library Card */}
          <div className="tai-card" style={{ padding: 18, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="tai-row tai-between" style={{ marginBottom: 12 }}>
              <div className="tai-row tai-gap8">
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(37, 99, 235, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Bookmark size={17} color="var(--primary)" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>Saved Library</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>Bookmarks &amp; saved lessons</div>
                </div>
              </div>
              <span className="tai-link" style={{ fontSize: 12 }} onClick={() => push("bookmarks")}>View All →</span>
            </div>

            {/* Quick Preview List of Bookmarked Items */}
            <div className="tai-col tai-gap8" style={{ marginBottom: 12 }}>
              {[
                { title: "Master Design Systems in Figma", type: "Course", icon: BookOpen, meta: "Design & UX" },
                { title: "Vector Chunking & Hybrid Search", type: "Lesson", icon: Video, meta: "Full-Stack AI" },
                { title: "Figma Variables Exporter Script", type: "Code", icon: Code2, meta: "JavaScript" }
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
                      gap: 8
                    }}
                    onClick={() => push("bookmarks")}
                  >
                    <div className="tai-row tai-gap8" style={{ minWidth: 0, flex: 1 }}>
                      <ItemIcon size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>{item.type} • {item.meta}</div>
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
      </div>
    </div>
  );
}
