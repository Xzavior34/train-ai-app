import React, { useState } from "react";
import { Avatar, ProgressBar, Tag, CourseThumb } from "../components/LearnerUI.jsx";
import { AIRecommendationsCard } from "../components/AIRecommendationsCard.jsx";
import { fetchAIInsights } from "../../lib/api/schemaHelper.js";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  Bell, GraduationCap, Play, BookOpen, Users, Zap, ChevronRight, Layers, Trophy, Clock, Sparkles, Flame, Target,
  Calendar, CheckCircle2, TrendingUp, BarChart3, AlertCircle, ArrowUpRight, Video, Award, Star, Palette, Lock, Radio
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
  const continueCourse = enrolledCourses.find(c => c.progress < 100) || enrolledCourses[0] || courses[0] || null;
  const otherAssignedCount = Math.max(0, enrolledCourses.length - (continueCourse ? 1 : 0));

  const goal = weeklyGoal || 5;
  const done = user?.weeklyDone || 3;
  const goalPercent = Math.min(100, Math.round((done / goal) * 100));
  const userFirstName = (user?.name || "Evelyn").split(" ")[0];

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
      <div style={{
        borderRadius: 20,
        background: "linear-gradient(135deg, rgba(15,23,42,0.94) 0%, rgba(30,27,75,0.88) 100%)",
        color: "#FFFFFF",
        padding: "clamp(18px, 3vw, 26px)",
        boxShadow: "0 14px 34px -6px rgba(15, 23, 42, 0.4)",
        border: "1px solid rgba(99, 102, 241, 0.4)",
        position: "relative",
        overflow: "hidden"
      }}>
        {/* Background Stock Photo with Overlay */}
        <img
          src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1400&auto=format&fit=crop&q=85"
          alt=""
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", opacity: 0.35, zIndex: 0
          }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(100deg, rgba(15,23,42,0.96) 0%, rgba(30,27,75,0.82) 55%, rgba(15,23,42,0.65) 100%)",
          zIndex: 0
        }} />

        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 style={{ fontSize: "clamp(20px, 2.5vw, 26px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 6px", color: "#FFFFFF", textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
                Welcome back, {userFirstName || "Learner"}
              </h1>
              <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.85)", margin: 0, maxWidth: 620, lineHeight: 1.45 }}>
                {done} of {goal} weekly lessons done. Continue in <strong style={{ color: "#A5B4FC" }}>{continueCourse?.title || "AI Fundamentals"}</strong>.
              </p>
            </div>

            {continueCourse && (
              <button
                className="tai-btn"
                style={{
                  background: "#4F46E5", color: "#FFFFFF", fontWeight: 800,
                  padding: "10px 20px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)", fontSize: 13,
                  boxShadow: "0 4px 14px rgba(79, 70, 229, 0.4)",
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
          <div style={{
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(10px)",
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(255, 255, 255, 0.15)"
          }}>
            <div className="tai-row tai-between" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#FFFFFF" }}>
              <span className="tai-row tai-gap6">
                <Target size={13} color="#818CF8" />
                <span>Weekly Sprint Goal ({done}/{goal})</span>
              </span>
              <span style={{ color: "#34D399", fontWeight: 800 }}>{goalPercent}% Completed</span>
            </div>

            <div style={{
              height: 8,
              borderRadius: 99,
              background: "rgba(255, 255, 255, 0.18)",
              overflow: "hidden",
              padding: 1,
              border: "1px solid rgba(255, 255, 255, 0.15)"
            }}>
              <div style={{
                width: `${goalPercent}%`,
                height: "100%",
                background: "linear-gradient(90deg, #10B981 0%, #34D399 50%, #6366F1 100%)",
                borderRadius: 99,
                boxShadow: "0 0 10px rgba(16, 185, 129, 0.7)",
                transition: "width 0.4s ease"
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Responsive Layout (Main LMS Track vs Right Side Info Hub) */}
      <div className="tai-dashboard-grid">
        
        {/* LEFT COLUMN: Continue Learning, Career Track, Recommendations, Chart, Assignments, Study Rooms */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          
          {/* Continue Learning Banner */}
          {continueCourse && (
            <div className="tai-card tai-card-hover" style={{ padding: 0, overflow: "hidden", borderRadius: 16, border: "1px solid var(--border)", width: "100%", boxSizing: "border-box" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="tai-row tai-gap8" style={{ fontWeight: 700, fontSize: 14 }}>
                  <BookOpen size={16} color="var(--primary)" />
                  <span>Continue learning</span>
                </div>
                <span className="tai-link" style={{ fontSize: 12 }} onClick={() => goTab("courses")}>My courses</span>
              </div>

              <div style={{ padding: "14px 16px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", boxSizing: "border-box", width: "100%" }}>
                <img 
                  src={continueCourse.coverImageUrl || "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&auto=format&fit=crop&q=80"}
                  alt={continueCourse.title}
                  style={{ width: 64, height: 50, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
                />
                <div style={{ flex: "1 1 140px", minWidth: 0 }}>
                  <div className="tai-row tai-between">
                    <Tag tone="primary">{continueCourse.category || "Technology"}</Tag>
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>12 hrs</span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {continueCourse.title}
                  </div>
                  <div className="tai-mt6">
                    <div className="tai-row tai-between" style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>
                      <span>Progress</span>
                      <span style={{ fontWeight: 700, color: "var(--primary)" }}>{continueCourse.progress || 50}%</span>
                    </div>
                    <ProgressBar value={continueCourse.progress || 50} height={5} />
                  </div>
                </div>
                <button 
                  className="tai-btn tai-btn-primary tai-btn-sm"
                  style={{ padding: "7px 14px", fontSize: 12, fontWeight: 700, flexShrink: 0 }}
                  onClick={() => push("courseDetail", { id: continueCourse.id })}
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* Q1 Onboarding Cohort Banner */}
          <div className="tai-card" style={{
            padding: "16px",
            borderRadius: 16,
            background: "linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(99, 102, 241, 0.06) 100%)",
            border: "1.5px solid rgba(99, 102, 241, 0.35)",
            position: "relative",
            overflow: "hidden",
            width: "100%",
            boxSizing: "border-box"
          }}>
            <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
              <div className="tai-row tai-gap10" style={{ flex: "1 1 180px", minWidth: 0 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(99, 102, 241, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Users size={18} color="var(--primary)" />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="tai-row tai-gap8" style={{ alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>
                      {cohort?.name || "Q1 Onboarding Cohort"}
                    </span>
                    <Tag tone="primary">Sprint 5 of 12</Tag>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>
                    68 enrolled peers • Next: Tomorrow 10:00 AM
                  </div>
                </div>
              </div>

              <button
                className="tai-btn tai-btn-primary tai-btn-sm"
                style={{ padding: "7px 14px", fontSize: 12, fontWeight: 700, flexShrink: 0 }}
                onClick={() => push("cohort")}
              >
                Enter Cohort Space →
              </button>
            </div>

            <div style={{ background: "var(--surface-3)", padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)" }}>
              <div className="tai-row tai-between" style={{ fontSize: 11, fontWeight: 700, marginBottom: 5 }}>
                <span style={{ color: "var(--text-2)" }}>Curriculum Milestone</span>
                <span style={{ color: "var(--primary)" }}>42% Completed</span>
              </div>
              <div style={{ height: 6, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: "42%", height: "100%", background: "var(--grad)", borderRadius: 99 }} />
              </div>
            </div>
          </div>

          {/* Achievements: Your Level, Streak & Badges Spotlight Card */}
          <div className="tai-card tai-card-hover" style={{
            padding: 20, borderRadius: 16,
            background: "linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(99, 102, 241, 0.05) 100%)",
            border: "1.5px solid rgba(99, 102, 241, 0.35)",
            boxShadow: "0 8px 24px -4px rgba(79, 70, 229, 0.12)"
          }}>
            <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
              <div className="tai-row tai-gap10">
                <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(79, 70, 229, 0.3)" }}>
                  <Award size={22} color="#FFFFFF" />
                </div>
                <div>
                  <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
                    <span style={{ fontWeight: 900, fontSize: 16, color: "var(--text)" }}>
                      Achievements &amp; Skill Mastery
                    </span>
                    <Tag tone="warning">Level {user?.level || 2}</Tag>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                    Senior Specialist • {(user?.totalPoints || 4520).toLocaleString()} XP earned
                  </div>
                </div>
              </div>

              <button
                className="tai-btn tai-btn-primary tai-btn-sm"
                style={{ padding: "8px 16px", fontSize: 12.5, fontWeight: 800 }}
                onClick={() => push("achievements")}
              >
                View Full Achievements →
              </button>
            </div>

            {/* Level & XP Meter */}
            <div style={{ background: "var(--surface)", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", marginBottom: 14 }}>
              <div className="tai-row tai-between" style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
                <span style={{ color: "var(--text)" }}>Level {user?.level || 2} Progression</span>
                <span style={{ color: "var(--primary)" }}>{(user?.totalPoints || 4520).toLocaleString()} / 5,000 XP (480 XP to Level 3)</span>
              </div>
              <div style={{ height: 8, background: "var(--surface-3)", borderRadius: 99, overflow: "hidden", border: "1px solid var(--border)" }}>
                <div style={{ width: "90%", height: "100%", background: "var(--grad)", borderRadius: 99 }} />
              </div>
            </div>

            {/* Streak & Badges Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
              <div style={{ padding: "10px 12px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
                <div className="tai-row tai-gap6" style={{ fontSize: 11, fontWeight: 700, color: "#EA580C", marginBottom: 2 }}>
                  <Flame size={14} color="#EA580C" />
                  <span>{user?.streak || 8}-Day Streak</span>
                </div>
                <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>Active learner pace</div>
              </div>

              <div style={{ padding: "10px 12px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
                <div className="tai-row tai-gap6" style={{ fontSize: 11, fontWeight: 700, color: "#6366F1", marginBottom: 2 }}>
                  <Palette size={14} color="#6366F1" />
                  <span>Figma Master</span>
                </div>
                <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>Unlocked sprint 4</div>
              </div>

              <div style={{ padding: "10px 12px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
                <div className="tai-row tai-gap6" style={{ fontSize: 11, fontWeight: 700, color: "#10B981", marginBottom: 2 }}>
                  <Zap size={14} color="#10B981" />
                  <span>Prompt Pro</span>
                </div>
                <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>AI Quiz 100% score</div>
              </div>

              <div style={{ padding: "10px 12px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
                <div className="tai-row tai-gap6" style={{ fontSize: 11, fontWeight: 700, color: "#D97706", marginBottom: 2 }}>
                  <Trophy size={14} color="#D97706" />
                  <span>#4 Leaderboard</span>
                </div>
                <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>Top 5% of cohort</div>
              </div>
            </div>
          </div>

          {/* Career Path & Skill Growth Progression */}
          <div className="tai-card" style={{ padding: 20, borderRadius: 16, background: "linear-gradient(135deg, rgba(79, 70, 229, 0.05) 0%, rgba(99, 102, 241, 0.05) 100%)", border: "1px solid rgba(99, 102, 241, 0.25)" }}>
            <div className="tai-row tai-between">
              <div>
                <div className="tai-row tai-gap8" style={{ fontWeight: 800, fontSize: 14.5, color: "var(--primary)" }}>
                  <TrendingUp size={16} />
                  <span>Your Career Roadmap • UX & AI Designer</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                  Current Level: <strong>Junior Designer</strong> (Next: <em>Middle UI Designer</em> in 4 modules)
                </div>
              </div>
              <Tag tone="primary">Level 2 of 4</Tag>
            </div>

            <div className="tai-row tai-between tai-mt14" style={{ gap: 8, overflowX: "auto" }}>
              {[
                { title: "Junior UI", status: "Completed", icon: CheckCircle2, active: true, tone: "var(--success)" },
                { title: "Design Tokens", status: "In Progress", icon: Zap, active: true, tone: "var(--primary)" },
                { title: "Spatial UI", status: "Next Up", icon: Lock, active: false, tone: "var(--text-3)" },
                { title: "Senior Lead", status: "Locked", icon: Lock, active: false, tone: "var(--text-3)" }
              ].map((step, idx) => {
                const StepIcon = step.icon;
                return (
                  <div key={idx} style={{ flex: 1, minWidth: 80, padding: "8px 10px", background: step.active ? "var(--surface)" : "var(--surface-3)", borderRadius: 10, border: "1px solid var(--border)", textAlign: "center" }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 2 }}>
                      <StepIcon size={16} color={step.tone} />
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: "var(--text)" }}>{step.title}</div>
                    <div style={{ fontSize: 9.5, color: "var(--text-3)", marginTop: 2 }}>{step.status}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recommended Courses For You Grid */}
          <div className="tai-card" style={{ padding: 20, borderRadius: 16 }}>
            <div className="tai-row tai-between" style={{ marginBottom: 14 }}>
              <div className="tai-row tai-gap8" style={{ fontWeight: 700, fontSize: 14 }}>
                <Sparkles size={16} color="var(--primary)" />
                <span>Recommended Courses</span>
              </div>
              <span className="tai-link" style={{ fontSize: 12 }} onClick={() => goTab("courses")}>View Catalog</span>
            </div>

            <div className="anim-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
              {STOCK_COURSES.map((sc) => (
                <div
                  key={sc.id}
                  className="tai-card-hover"
                  style={{
                    borderRadius: 14,
                    overflow: "hidden",
                    background: "var(--surface-3)",
                    border: "1px solid var(--border)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    transition: "all .2s cubic-bezier(.16,1,.3,1)"
                  }}
                  onClick={() => goTab("courses")}
                >
                  <div style={{ height: 110, position: "relative" }}>
                    <img src={sc.image} alt={sc.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{ position: "absolute", top: 8, left: 8 }}>
                      <Tag>{sc.category}</Tag>
                    </div>
                  </div>
                  <div style={{ padding: 12, flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", lineHeight: 1.3 }}>{sc.title}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>
                        {sc.hours} hours • {sc.lessons} lessons
                      </div>
                    </div>
                    <div className="tai-row tai-between tai-mt10" style={{ paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                      <span className="tai-row tai-gap4" style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)" }}>
                        <Star size={12} fill="var(--primary)" color="var(--primary)" /> {sc.rating}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)" }}>Explore →</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Learning Activity Chart */}
          <div className="tai-card" style={{ padding: 20, borderRadius: 16 }}>
            <div className="tai-row tai-between" style={{ marginBottom: 16 }}>
              <div>
                <div className="tai-title-sm" style={{ fontSize: 14 }}>Learning Activity</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Weekly study hours &amp; performance</div>
              </div>
              <span className="tai-tag" style={{ background: "rgba(79, 70, 229, 0.1)", color: "#4F46E5", fontWeight: 700, fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <TrendingUp size={12} /> 4.5h Peak Study
              </span>
            </div>

            {/* Bar Chart Visualization */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: 120, padding: "0 10px 10px", borderBottom: "1px solid var(--border)" }}>
              {WEEK_DAYS.map((d, i) => (
                <div key={d.day} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: d.active ? "var(--primary)" : "var(--text-3)" }}>
                    {d.hours}h
                  </div>
                  <div
                    style={{
                      width: 22, height: d.height, borderRadius: "6px 6px 2px 2px",
                      background: d.active ? "var(--grad)" : "var(--surface-2)",
                      boxShadow: d.active ? "0 4px 12px rgba(79, 70, 229, 0.35)" : "none",
                      cursor: "pointer", transition: "all .16s ease"
                    }}
                    onClick={() => setActiveDayIndex(i)}
                  />
                  <div style={{ fontSize: 11, fontWeight: 600, color: d.active ? "var(--text)" : "var(--text-3)" }}>
                    {d.day}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assignment Tracker Section */}
          <div className="tai-card" style={{ padding: 20, borderRadius: 16 }}>
            <div className="tai-row tai-between" style={{ marginBottom: 14 }}>
              <div>
                <div className="tai-title-sm">Assignment Tracker</div>
                <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 2 }}>Tasks and deliverables for your enrolled courses</div>
              </div>
              <span className="tai-tag" style={{ background: "var(--primary-tint)", color: "var(--primary)" }}>
                3 Active
              </span>
            </div>

            <div className="tai-col tai-gap10">
              {ASSIGNMENTS.map((a) => (
                <div
                  key={a.id}
                  className="tai-row tai-between"
                  style={{
                    padding: "12px 14px", background: "var(--surface-3)", borderRadius: 12,
                    border: "1px solid var(--border)", cursor: "pointer", transition: "all .16s ease"
                  }}
                  onClick={() => goToMyCourses()}
                >
                  <div className="tai-row tai-gap12">
                    <div style={{
                      width: 34, height: 34, borderRadius: 10,
                      background: a.tone === "danger" ? "var(--danger-bg)" : a.tone === "warning" ? "var(--warning-bg)" : "var(--success-bg)",
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      <BookOpen size={16} color={a.tone === "danger" ? "var(--danger)" : a.tone === "warning" ? "var(--warning)" : "var(--success)"} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text)" }}>{a.title}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>{a.module} • {a.due}</div>
                    </div>
                  </div>

                  <Tag tone={a.tone}>{a.status}</Tag>
                </div>
              ))}
            </div>
          </div>

          {/* Peer Study Groups & Virtual Audio Lounge */}
          <div className="tai-card" style={{ padding: 20, borderRadius: 16 }}>
            <div className="tai-row tai-between" style={{ marginBottom: 12 }}>
              <div className="tai-row tai-gap8">
                <Users size={16} color="var(--primary)" />
                <span style={{ fontWeight: 700, fontSize: 14 }}>Active Study Lounges</span>
              </div>
              <span className="tai-link" style={{ fontSize: 12 }} onClick={() => goTab("community")}>All groups →</span>
            </div>

            <div className="tai-col tai-gap10">
              {[
                { name: "Figma UI Critique Room", peers: 6, topic: "Design Systems", active: true },
                { name: "Full-Stack AI Engineering Lab", peers: 4, topic: "LangChain & APIs", active: true }
              ].map((grp, idx) => (
                <div key={idx} className="tai-row tai-between" style={{ padding: "10px 12px", background: "var(--surface-3)", borderRadius: 12, border: "1px solid var(--border)" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{grp.name}</div>
                    <div className="tai-row tai-gap6" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                      <span>{grp.topic}</span>
                      <span>•</span>
                      <span className="tai-row tai-gap4" style={{ color: "var(--success)", fontWeight: 700 }}>
                        <Radio size={11} /> {grp.peers} active now
                      </span>
                    </div>
                  </div>
                  <button className="tai-btn tai-btn-primary tai-btn-sm" style={{ padding: "6px 12px", fontSize: 11.5 }} onClick={() => goTab("community")}>
                    Join Room
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Streak Days, Today's Schedule, Leaderboard, Mentor 1:1, Badges */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          
          {/* Achievements: Your Level, Streak & Badges */}
          <div className="tai-card" style={{ padding: 20, borderRadius: 16, background: "linear-gradient(135deg, rgba(79, 70, 229, 0.05) 0%, rgba(99, 102, 241, 0.05) 100%)", border: "1px solid rgba(99, 102, 241, 0.3)" }}>
            <div className="tai-row tai-between" style={{ marginBottom: 12 }}>
              <div className="tai-row tai-gap6" style={{ fontWeight: 800, fontSize: 14 }}>
                <Award size={18} color="var(--primary)" />
                <span>Your Level &amp; Badges</span>
              </div>
              <span className="tai-link" style={{ fontSize: 12, fontWeight: 700 }} onClick={() => push("achievements")}>
                View All →
              </span>
            </div>

            {/* Level & XP Meter */}
            <div style={{ background: "var(--surface)", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6, fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
                <span style={{ color: "var(--text)" }}>Level {user?.level || 2} • Senior Specialist</span>
                <span style={{ color: "var(--primary)", flexShrink: 0 }}>{(user?.totalPoints || 4520).toLocaleString()} / 5,000 XP</span>
              </div>
              <div style={{ height: 6, background: "var(--surface-3)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: "90%", height: "100%", background: "var(--grad)", borderRadius: 99 }} />
              </div>
            </div>

            {/* Streak Tracker */}
            <div style={{ marginBottom: 14 }}>
              <div className="tai-row tai-between" style={{ marginBottom: 8 }}>
                <div className="tai-row tai-gap6" style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                  <Flame size={15} color="#F59E0B" />
                  <span>{user?.streak || 8} Day Learning Streak</span>
                </div>
                <Tag tone="warning">Active</Tag>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => {
                  const isActive = idx < 5;
                  return (
                    <div 
                      key={idx}
                      style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: isActive ? "#F59E0B" : "var(--surface-3)",
                        color: isActive ? "#fff" : "var(--text-3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 800, fontSize: 11,
                        boxShadow: isActive ? "0 2px 6px rgba(245, 158, 11, 0.3)" : "none"
                      }}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Earned Badges Row */}
            <div className="tai-row tai-between" style={{ gap: 6 }}>
              {[
                { name: "Figma Master", icon: Palette, color: "#6366F1", bg: "#EEF2FF" },
                { name: "Prompt Pro", icon: Zap, color: "#10B981", bg: "#ECFDF5" },
                { name: "7-Day Streak", icon: Flame, color: "#F59E0B", bg: "#FFFBEB" }
              ].map((b, idx) => {
                const BadgeIcon = b.icon;
                return (
                  <div key={idx} style={{ flex: 1, padding: "8px 4px", background: "var(--surface)", borderRadius: 10, textAlign: "center", border: "1px solid var(--border)" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: b.bg, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 2 }}>
                      <BadgeIcon size={14} color={b.color} />
                    </div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text)" }}>{b.name}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Today's Schedule Card */}
          <div className="tai-card" style={{ padding: 20, borderRadius: 16 }}>
            <div className="tai-row tai-between" style={{ marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Today's Schedule</div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>Wednesday, 12 March 2024</div>
              </div>
              <Calendar size={16} color="var(--primary)" />
            </div>

            <div className="tai-col tai-gap10">
              <div style={{ padding: "10px 12px", background: "var(--surface-3)", borderRadius: 12, border: "1px solid var(--border)" }}>
                <div className="tai-row tai-between">
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)" }}>08:30 AM • PREVIEW</span>
                  <button 
                    style={{ background: "#4F46E5", color: "#fff", border: "none", padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    onClick={() => window.open("https://meet.google.com/new", "_blank")}
                  >
                    Join meeting
                  </button>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginTop: 6 }}>
                  How to success in Marketing
                </div>
              </div>

              <div
                style={{ padding: "10px 12px", background: "var(--surface-3)", borderRadius: 12, border: "1px solid var(--border)", cursor: "pointer", transition: "all .16s ease" }}
                onClick={() => goToMyCourses()}
              >
                <div className="tai-row tai-between">
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#EF4444" }}>10:00 AM • DEADLINE</span>
                  <Tag tone="danger">Deadline</Tag>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginTop: 6 }}>
                  Marketing Campaign Capstone Due
                </div>
              </div>

              <div
                style={{ padding: "10px 12px", background: "var(--surface-3)", borderRadius: 12, border: "1px solid var(--border)", cursor: "pointer", transition: "all .16s ease" }}
                onClick={() => goTab("community")}
              >
                <div className="tai-row tai-between">
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)" }}>11:30 AM • PREVIEW</span>
                  <Tag tone="primary">Workshop</Tag>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginTop: 6 }}>
                  UI/UX Design Systems Architecture
                </div>
              </div>
            </div>
          </div>

          {/* Book 1:1 Mentor Session */}
          <div className="tai-card" style={{ padding: 20, borderRadius: 16 }}>
            <div className="tai-row tai-between" style={{ marginBottom: 12 }}>
              <div className="tai-row tai-gap6" style={{ fontWeight: 700, fontSize: 13.5 }}>
                <GraduationCap size={16} color="var(--primary)" />
                <span>Mentor Office Hours</span>
              </div>
              <span className="tai-link" style={{ fontSize: 12 }} onClick={() => push("mentors")}>Book</span>
            </div>

            <div className="tai-col tai-gap8">
              {[
                { name: "Astrid Larsson", title: "Principal Design Mentor", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80", time: "Available Today 4 PM" },
                { name: "Alex Rivera", title: "AI Lead Instructor", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80", time: "Available Tomorrow" }
              ].map((m, idx) => (
                <div key={idx} className="tai-row tai-between" style={{ padding: "8px 10px", background: "var(--surface-3)", borderRadius: 10 }}>
                  <div className="tai-row tai-gap8">
                    <img src={m.avatar} alt={m.name} style={{ width: 32, height: 32, borderRadius: 10, objectFit: "cover" }} />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700 }}>{m.name}</div>
                      <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>{m.time}</div>
                    </div>
                  </div>
                  <button className="tai-btn tai-btn-outline tai-btn-sm" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => push("mentors")}>
                    1:1 Call
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Leaderboard Card */}
          <div className="tai-card" style={{ padding: 20, borderRadius: 16 }}>
            <div className="tai-row tai-between" style={{ marginBottom: 12 }}>
              <div className="tai-row tai-gap6" style={{ fontWeight: 700, fontSize: 13.5 }}>
                <Trophy size={16} color="#F59E0B" />
                <span>Leaderboard</span>
              </div>
              <span className="tai-link" style={{ fontSize: 12 }} onClick={() => push("leaderboard")}>View All</span>
            </div>

            <div className="tai-col tai-gap8">
              {[
                { name: "Anna Marie", xp: "1,512 XP", rank: 1, avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" },
                { name: "David Vance", xp: "1,380 XP", rank: 2, avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80" },
                { name: "Elena Rostova", xp: "1,220 XP", rank: 3, avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80" }
              ].map((s) => (
                <div key={s.name} className="tai-row tai-between" style={{ padding: "6px 10px", background: "var(--surface-3)", borderRadius: 10 }}>
                  <div className="tai-row tai-gap10">
                    <span style={{ fontSize: 12, fontWeight: 800, color: s.rank === 1 ? "#F59E0B" : "var(--text-3)" }}>#{s.rank}</span>
                    <img src={s.avatar} alt={s.name} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>{s.xp}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Badges & Achievements Milestone */}
          <div className="tai-card" style={{ padding: 20, borderRadius: 16 }}>
            <div className="tai-row tai-between" style={{ marginBottom: 12 }}>
              <div className="tai-row tai-gap6" style={{ fontWeight: 700, fontSize: 13.5 }}>
                <Award size={16} color="#8B5CF6" />
                <span>Earned Badges</span>
              </div>
              <span className="tai-link" style={{ fontSize: 12 }} onClick={() => push("achievements")}>All</span>
            </div>

            <div className="tai-row tai-between anim-stagger" style={{ gap: 8 }}>
              {[
                { name: "Figma Master", icon: Palette, color: "#6366F1", bg: "#EEF2FF" },
                { name: "Prompt Pro", icon: Zap, color: "#10B981", bg: "#ECFDF5" },
                { name: "7-Day Streak", icon: Flame, color: "#F59E0B", bg: "#FFFBEB" }
              ].map((b, idx) => {
                const BadgeIcon = b.icon;
                return (
                  <div key={idx} style={{ flex: 1, padding: "10px 6px", background: "var(--surface-3)", borderRadius: 10, textAlign: "center", border: "1px solid var(--border)", transition: "transform .15s ease" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: b.bg, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                      <BadgeIcon size={16} color={b.color} />
                    </div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text)" }}>{b.name}</div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
