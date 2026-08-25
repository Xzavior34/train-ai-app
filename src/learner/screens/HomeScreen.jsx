import React, { useState } from "react";
import { Avatar, ProgressBar, Tag, CourseThumb } from "../components/LearnerUI.jsx";
import { AIRecommendationsCard } from "../components/AIRecommendationsCard.jsx";
import { fetchAIInsights } from "../../lib/api/schemaHelper.js";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { isMockDataEnabled } from "../../lib/mockDataManager.js";
import {
  Bell, GraduationCap, Play, BookOpen, Users, Zap, ChevronRight, Layers, Trophy, Clock, Flame, Target,
  Calendar, CheckCircle2, TrendingUp, BarChart3, AlertCircle, ArrowUpRight, Video, Award, Star, Palette, Lock, Radio,
  Bookmark
} from "lucide-react";

const STOCK_COURSES = [
  {
    id: "stock-1",
    title: "Master Design Systems in Figma with AI",
    category: "Design & UX",
    hours: 6,
    lessons: 14,
    rating: 4.9,
    enrolled: false,
    image: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "stock-2",
    title: "Full-Stack AI Application Engineering",
    category: "AI & Engineering",
    hours: 12,
    lessons: 22,
    rating: 4.8,
    enrolled: false,
    image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "stock-3",
    title: "Cloud Infrastructure & Microservices",
    category: "DevOps & Cloud",
    hours: 8,
    lessons: 16,
    rating: 4.9,
    enrolled: false,
    image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80"
  }
];

export function HomeScreen({
  user = {}, courses = [], coursesLoading, unreadNotifs = 0, weeklyGoal = 5,
  session, push, goTab, goToMyCourses, cohort = null, cohortLoading = false,
}) {
  const enrolledCourses = (courses || []).filter(c => c.enrolled);
  // Only fall back to another enrolled course, never an unenrolled catalog
  // item - showing "Continue learning" progress/CTA for a course the
  // learner isn't even enrolled in was a real bug, not a display choice.
  const continueCourse = enrolledCourses.find(c => c.progress < 100) || enrolledCourses[0] || null;
  const otherAssignedCount = Math.max(0, enrolledCourses.length - (continueCourse ? 1 : 0));

  const goal = weeklyGoal || 5;
  const done = user?.weeklyDone || 0;
  const goalPercent = Math.min(100, Math.round((done / goal) * 100));
  const userFirstName = (user?.name || "Learner").split(" ")[0];

  const [activeDayIndex, setActiveDayIndex] = useState(2); // Wednesday active

  const WEEK_DAYS = [
    { day: "Mon", hours: 2.5, height: "65%" },
    { day: "Tue", hours: 1.8, height: "45%" },
    { day: "Wed", hours: 4.5, height: "100%", active: true },
    { day: "Thu", hours: 2.2, height: "55%" },
    { day: "Fri", hours: 3.1, height: "78%" },
    { day: "Sat", hours: 1.4, height: "35%" },
    { day: "Sun", hours: 2.0, height: "50%" },
  ];

  const ASSIGNMENTS = [
    { id: 1, title: "UX Audit Report", module: "Module 4 • UX Research", due: "Due Tomorrow, 05:00 PM", status: "Pending", tone: "danger" },
    { id: 2, title: "Mobile App Wireframe", module: "Module 3 • Prototyping", due: "Due Friday, 11:59 PM", status: "In Progress", tone: "warning" },
    { id: 3, title: "Create Design Tokens", module: "Module 2 • Design System", due: "Completed Yesterday", status: "Completed", tone: "success" },
  ];

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
      </div>

      {/* My Progress & Bookmarks - real navigation screens that exist
          elsewhere in the app but had dropped out of Home's links. */}
      <div className="tai-grid2" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="tai-card tai-card-hover" style={{ cursor: "pointer", padding: 16 }} onClick={() => push("myProgress")}>
          <div className="tai-row tai-between">
            <div className="tai-row tai-gap10">
              <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <BarChart3 size={18} color="var(--primary)" />
              </div>
              <div>
                <div className="tai-label">My Progress</div>
                <div style={{ fontWeight: 700, fontSize: 14.5, marginTop: 2 }}>Detailed breakdown</div>
              </div>
            </div>
            <ChevronRight size={18} color="var(--text-3)" />
          </div>
        </div>

        <div className="tai-card tai-card-hover" style={{ cursor: "pointer", padding: 16 }} onClick={() => push("bookmarks")}>
          <div className="tai-row tai-between">
            <div className="tai-row tai-gap10">
              <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Bookmark size={18} color="var(--primary)" />
              </div>
              <div>
                <div className="tai-label">Bookmarks</div>
                <div style={{ fontWeight: 700, fontSize: 14.5, marginTop: 2 }}>Saved lessons & snippets</div>
              </div>
            </div>
            <ChevronRight size={18} color="var(--text-3)" />
          </div>
        </div>
      </div>

      {/* Quick links to the other 3 sections */}
      <div style={{ marginTop: 4 }}>
        <div className="tai-title-sm" style={{ marginBottom: 10 }}>Jump to</div>
        <div className="tai-grid2" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <div className="tai-card" style={{ cursor: "pointer", padding: 14, textAlign: "center" }} onClick={() => goTab("courses")}>
            <BookOpen size={20} color="var(--primary)" style={{ margin: "0 auto" }} />
            <div style={{ fontWeight: 700, fontSize: 12.5, marginTop: 6 }}>Courses</div>
          </div>
          <div className="tai-card" style={{ cursor: "pointer", padding: 14, textAlign: "center" }} onClick={() => goTab("ai")}>
            <Zap size={20} color="var(--primary)" style={{ margin: "0 auto" }} />
            <div style={{ fontWeight: 700, fontSize: 12.5, marginTop: 6 }}>AI Coach</div>
          </div>
          <div className="tai-card" style={{ cursor: "pointer", padding: 14, textAlign: "center" }} onClick={() => goTab("community")}>
            <Users size={20} color="var(--primary)" style={{ margin: "0 auto" }} />
            <div style={{ fontWeight: 700, fontSize: 12.5, marginTop: 6 }}>Community</div>
          </div>
        </div>
      </div>
    </div>
  );
}
