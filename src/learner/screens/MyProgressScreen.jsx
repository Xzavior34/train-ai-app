import React, { useState, useMemo } from "react";
import { TopBar, Avatar, Tag, ProgressBar, StatTile } from "../components/LearnerUI.jsx";
import { DEMO_MODE, liveOr } from "../../lib/demoMode.js";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchMyStreakActivity } from "../../lib/api/learner.js";
import {
  BarChart3, BookOpen, Clock, Trophy, Flame, GraduationCap, CheckCircle2,
  Calendar, ArrowRight, Play, Star, Sparkles, Target, Award, ShieldCheck,
  TrendingUp, Check, ExternalLink
} from "lucide-react";

// Illustrative course/skill/hours content, kept ONLY for the no-database
// case. Every number on this screen used to come from these arrays even
// though a real catalog, real enrolments and real streak rows existed - the
// `courses` prop was passed in and then ignored entirely.
const DEMO_ENROLLED_COURSES = [
  {
    id: "course-figma-ai",
    title: "Master Design Systems in Figma with Generative AI",
    category: "Design & UX",
    instructor: "Astrid Larsson",
    totalLessons: 24,
    completedLessons: 11,
    progress: 46,
    status: "in_progress",
    lastActive: "Today at 10:15 AM",
    nextLesson: "Module 3: Semantic Color Tokens & Figma Variables",
    coverImageUrl: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80"
  },
  {
    id: "course-fullstack-ai",
    title: "Full-Stack AI Application Engineering & LLM APIs",
    category: "AI & Engineering",
    instructor: "Dr. Elena Vance",
    totalLessons: 32,
    completedLessons: 6,
    progress: 19,
    status: "in_progress",
    lastActive: "Yesterday",
    nextLesson: "Module 2: Structured Outputs & Function Calling in Node.js",
    coverImageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80"
  },
  {
    id: "course-foundations",
    title: "AI Product Management & Strategy Foundations",
    category: "Product & Strategy",
    instructor: "Marcus Wright",
    totalLessons: 16,
    completedLessons: 16,
    progress: 100,
    status: "completed",
    certificateId: "TAI-PM-2026-4412",
    coverImageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80"
  }
];

// Per-day study HOURS have no backing anywhere in the schema
// (streak_tracking records lessons_completed / points_earned per day, never
// minutes spent), so this bar-chart data is demo-only.
const DEMO_WEEKLY_BREAKDOWN = [
  { day: "Mon", label: "2.5h", heightPct: 75 },
  { day: "Tue", label: "1.8h", heightPct: 54 },
  { day: "Wed", label: "4.2h", heightPct: 100, active: true },
  { day: "Thu", label: "2.1h", heightPct: 63 },
  { day: "Fri", label: "3.0h", heightPct: 88 },
  { day: "Sat", label: "1.2h", heightPct: 36 },
  { day: "Sun", label: "1.8h", heightPct: 54 },
];

// Per-skill mastery percentages: nothing in the schema scores a learner
// against a named skill, so the whole competency card is demo-only.
const DEMO_SKILLS_OVERVIEW = [
  { name: "Design Tokens & Variables", mastery: 92, status: "Proficient" },
  { name: "Prompt Engineering & RAG", mastery: 85, status: "Advanced" },
  { name: "Full-Stack AI Integrations", mastery: 74, status: "Intermediate" },
  { name: "Spatial Interface Design", mastery: 68, status: "In Progress" },
];

export function MyProgressScreen({ user = {}, courses = [], push, back, session, showToast }) {
  const [filterStatus, setFilterStatus] = useState("all"); // "all" | "in_progress" | "completed"
  const userId = session?.user?.id;

  // The weekly chart previously read a literal array. streak_tracking is the
  // only real per-day log the learner app has, so the live chart plots
  // lessons completed per day from it.
  const activityQuery = useSupabaseQuery(
    async () => (userId ? fetchMyStreakActivity(userId, 14) : []),
    [userId]
  );

  // Real enrolled courses come from the `courses` prop, which already carries
  // enrolment state and progress_percentage per course (see useLearnerData).
  // Fields the courses table has no column for (instructor, "next lesson",
  // last-studied time, credential id) are absent and guarded in the markup.
  const liveEnrolledCourses = useMemo(() => (
    (courses || [])
      .filter((c) => c.enrolled)
      .map((c) => {
        const totalLessons = c.lessons ?? 0;
        const progress = Math.round(c.progress ?? 0);
        return {
          id: c.id,
          title: c.title,
          category: c.category,
          instructor: c.instructor || null,
          totalLessons,
          completedLessons: Math.round((progress / 100) * totalLessons),
          progress,
          status: progress >= 100 ? "completed" : "in_progress",
          coverImageUrl: c.coverImageUrl || null,
        };
      })
  ), [courses]);

  const enrolledCourses = liveOr(liveEnrolledCourses, DEMO_ENROLLED_COURSES);

  // Lessons completed per day for the last 7 days, normalised against the
  // week's own peak so low volumes still render a readable bar.
  const liveWeeklyBreakdown = useMemo(() => {
    const byDate = new Map(
      (activityQuery.data || []).map((r) => [String(r.activity_date).slice(0, 10), r])
    );
    const today = new Date();
    const days = [];
    let peak = 0;
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const lessons = byDate.get(key)?.lessons_completed ?? 0;
      if (lessons > peak) peak = lessons;
      days.push({
        day: d.toLocaleDateString(undefined, { weekday: "short" }),
        lessons,
        label: String(lessons),
        active: i === 0,
      });
    }
    return days.map((d) => ({ ...d, heightPct: peak > 0 ? Math.round((d.lessons / peak) * 100) : 0 }));
  }, [activityQuery.data]);

  const weeklyBreakdown = liveOr(liveWeeklyBreakdown, DEMO_WEEKLY_BREAKDOWN);

  const filteredCourses = enrolledCourses.filter(c => {
    if (filterStatus === "in_progress") return c.status === "in_progress";
    if (filterStatus === "completed") return c.status === "completed";
    return true;
  });

  const inProgressCount = enrolledCourses.filter(c => c.status === "in_progress").length;
  const completedCount = enrolledCourses.filter(c => c.status === "completed").length;

  // Weekly sprint: real weekly_lesson_goal from the profile and real
  // lessons_completed from user_gamification_stats (both already resolved
  // onto `user`). Previously hardcoded as "17 / 20" and a fixed 85% bar.
  const weeklyGoal = user.weeklyGoal ?? 0;
  const weeklyDone = user.weeklyDone ?? 0;
  const weeklyPercent = weeklyGoal > 0 ? Math.min(100, Math.round((weeklyDone / weeklyGoal) * 100)) : 0;
  const weeklyRemaining = Math.max(0, weeklyGoal - weeklyDone);

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* =========================================================================
          HERO BANNER: My Learning Journey & Weekly Milestone
          ========================================================================= */}
      <div style={{
        borderRadius: 20,
        background: "linear-gradient(135deg, rgba(15, 23, 42, 0.92) 0%, rgba(30, 27, 75, 0.85) 100%)",
        color: "#FFFFFF",
        padding: "clamp(18px, 3vw, 26px)",
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.35)",
        border: "1px solid rgba(99, 102, 241, 0.4)",
        position: "relative",
        overflow: "hidden"
      }}>
        {/* Background Stock Photo with Overlay */}
        <img
          src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1400&auto=format&fit=crop&q=85"
          alt=""
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", opacity: 0.38, zIndex: 0
          }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(100deg, rgba(15,23,42,0.95) 0%, rgba(30,27,75,0.78) 55%, rgba(15,23,42,0.6) 100%)",
          zIndex: 0
        }} />

        <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: "clamp(20px, 2.5vw, 26px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 6px", color: "#FFFFFF", textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
              My Learning Progress
            </h1>
            {/* "16.6 study hours logged" was invented - hours studied are not
                tracked anywhere - so with a database only the real active
                course count and real weekly lesson tally are stated. */}
            <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.85)", margin: 0, maxWidth: 620, lineHeight: 1.4 }}>
              {DEMO_MODE
                ? `16.6 study hours logged across ${inProgressCount} active courses this week.`
                : `${inProgressCount} active ${inProgressCount === 1 ? "course" : "courses"} • ${weeklyDone} ${weeklyDone === 1 ? "lesson" : "lessons"} completed this week.`}
            </p>
          </div>

          <div style={{ textAlign: "right", flexShrink: 0, background: "rgba(255,255,255,0.1)", padding: "8px 14px", borderRadius: 12, backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)" }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#FFFFFF" }}>{weeklyDone} / {weeklyGoal} Lessons Done</div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>{weeklyPercent}% Sprint Met</div>
          </div>
        </div>

        {/* Weekly Goal Progress Bar (High-Contrast Hero Feature) */}
        <div style={{
          position: "relative", zIndex: 1, marginTop: 16,
          background: "rgba(255,255,255,0.12)", backdropFilter: "blur(10px)",
          padding: "12px 16px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.22)"
        }}>
          <div className="tai-row tai-between" style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: "#FFFFFF" }}>
            <span>
              Weekly Sprint Progress ({weeklyPercent}% Target Met)
            </span>
            <span style={{ color: "#FDE68A", fontSize: 12.5, fontWeight: 700 }}>
              {weeklyRemaining} of {weeklyGoal} lessons remaining
            </span>
          </div>
          <div style={{ height: 10, borderRadius: 99, background: "rgba(0,0,0,0.35)", overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)" }}>
            <div style={{ width: `${weeklyPercent}%`, height: "100%", background: "linear-gradient(90deg, #34D399 0%, #6366F1 100%)", borderRadius: 99, boxShadow: "0 0 12px rgba(52, 211, 153, 0.6)" }} />
          </div>
        </div>
      </div>

      {/* =========================================================================
          KEY STAT TILES STRIP
          ========================================================================= */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <div className="tai-card" style={{ padding: 18, borderRadius: 16 }}>
          <div className="tai-row tai-gap10">
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BookOpen size={18} color="var(--primary)" />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>{inProgressCount} Active</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Courses in Progress</div>
            </div>
          </div>
        </div>

        <div className="tai-card" style={{ padding: 18, borderRadius: 16 }}>
          <div className="tai-row tai-gap10">
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(16, 185, 129, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <GraduationCap size={18} color="#10B981" />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>{completedCount}</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Completed Courses</div>
            </div>
          </div>
        </div>

        {/* "24.7 hrs" total learning time: nothing records time spent, so this
            tile only exists in the no-database case. */}
        {DEMO_MODE && (
          <div className="tai-card" style={{ padding: 18, borderRadius: 16 }}>
            <div className="tai-row tai-gap10">
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(245, 158, 11, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Clock size={18} color="#F59E0B" />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>24.7 hrs</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Total Learning Time</div>
              </div>
            </div>
          </div>
        )}

        <div className="tai-card" style={{ padding: 18, borderRadius: 16 }}>
          <div className="tai-row tai-gap10">
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(139, 92, 246, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Flame size={18} color="#8B5CF6" />
            </div>
            <div>
              {/* `|| 8` hid a real zero-day streak. */}
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>{user.streak ?? 0} Days</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Active Study Streak</div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ANALYTICS: 2-COLUMN STUDY TIME & SKILL RADAR
          ========================================================================= */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: 20 }}>

        {/* Weekly Learning Bar Chart */}
        <div className="tai-card" style={{ padding: 22, borderRadius: 18 }}>
          <div className="tai-row tai-between" style={{ marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 2px", color: "var(--text)" }}>
                {DEMO_MODE ? "Study Time Distribution" : "Daily Learning Activity"}
              </h3>
              <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>
                {DEMO_MODE
                  ? "Daily hours logged over the last 7 days"
                  : "Lessons completed per day over the last 7 days"}
              </div>
            </div>
            {/* "+38% vs Avg" was never computed from anything. */}
            {DEMO_MODE && (
              <span className="tai-tag" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10B981", fontWeight: 700 }}>
                +38% vs Avg
              </span>
            )}
          </div>

          {!DEMO_MODE && activityQuery.loading ? (
            <div style={{ height: 150, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-3)", borderRadius: 14, fontSize: 12.5, color: "var(--text-3)" }}>
              Loading your activity…
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: 150, padding: "16px 8px 8px", background: "var(--surface-3)", borderRadius: 14 }}>
              {weeklyBreakdown.map((d, i) => (
                <div key={`${d.day}-${i}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)" }}>{d.label}</span>
                  <div
                    style={{
                      width: 24, height: `${d.heightPct}%`,
                      background: d.active ? "#4F46E5" : "rgba(99, 102, 241, 0.35)",
                      borderRadius: "6px 6px 2px 2px"
                    }}
                  />
                  <span style={{ fontSize: 11.5, fontWeight: d.active ? 800 : 600, color: d.active ? "var(--primary)" : "var(--text-3)" }}>{d.day}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Skill Mastery Breakdown - no table scores a learner against a named
            skill, so the whole card is limited to the no-database case. */}
        {DEMO_MODE && (
          <div className="tai-card" style={{ padding: 22, borderRadius: 18 }}>
            <div className="tai-row tai-between" style={{ marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 2px", color: "var(--text)" }}>
                  Skill Competency Tracker
                </h3>
                <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>
                  Mastery levels based on completed coursework &amp; quizzes
                </div>
              </div>
            </div>

            <div className="tai-col tai-gap12">
              {DEMO_SKILLS_OVERVIEW.map((s, idx) => (
                <div key={idx}>
                  <div className="tai-row tai-between" style={{ fontSize: 12.5, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: "var(--text)" }}>{s.name}</span>
                    <span style={{ fontWeight: 800, color: "var(--primary)" }}>{s.mastery}% ({s.status})</span>
                  </div>
                  <ProgressBar value={s.mastery} height={6} />
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* =========================================================================
          COURSES IN PROGRESS: DETAILED CARDS & NEXT UP ACTIONS
          ========================================================================= */}
      <div className="tai-col tai-gap16">
        <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 10 }}>
          <div className="tai-row tai-gap8">
            <BookOpen size={20} color="var(--primary)" />
            <h2 style={{ fontSize: 18, fontWeight: 900, color: "var(--text)", margin: 0 }}>
              Enrolled Courses &amp; Syllabi Breakdown
            </h2>
          </div>

          {/* Status Filter Tabs */}
          <div className="tai-row tai-gap6" style={{ flexWrap: "wrap" }}>
            {[
              { k: "all", label: `All (${enrolledCourses.length})` },
              { k: "in_progress", label: `In Progress (${inProgressCount})` },
              { k: "completed", label: `Completed (${completedCount})` },
            ].map(t => (
              <div
                key={t.k}
                className={`tai-pill ${filterStatus === t.k ? "tai-pill-active" : "tai-pill-inactive"}`}
                onClick={() => setFilterStatus(t.k)}
              >
                {t.label}
              </div>
            ))}
          </div>
        </div>

        {/* An empty real enrolment list is the truth and must be shown as
            such, rather than being replaced by sample courses. */}
        {filteredCourses.length === 0 ? (
          <div className="tai-card" style={{ textAlign: "center", padding: "48px 24px", borderRadius: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--primary-tint)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <BookOpen size={28} color="var(--primary)" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", margin: "0 0 6px" }}>
              {enrolledCourses.length === 0 ? "No Enrolled Courses Yet" : "Nothing Matches This Filter"}
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-3)", maxWidth: 420, margin: "0 auto 20px", lineHeight: 1.5 }}>
              {enrolledCourses.length === 0
                ? "Enrol in a course from the catalog and your syllabus progress will appear here."
                : "Try a different status filter to see the rest of your enrolments."}
            </p>
            <button
              className="tai-btn tai-btn-primary"
              style={{ padding: "10px 22px", borderRadius: 12, fontWeight: 800 }}
              onClick={() => { setFilterStatus("all"); push?.("courses"); }}
            >
              Browse Courses Catalog →
            </button>
          </div>
        ) : (
        <div className="tai-col tai-gap20 anim-stagger">
          {filteredCourses.map(course => {
            const isCompleted = course.progress === 100;
            return (
              <div
                key={course.id}
                className="tai-card tai-card-hover"
                style={{ padding: "clamp(16px, 4vw, 24px) clamp(16px, 4vw, 26px)", borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border)" }}
                onClick={() => push("courseDetail", { id: course.id })}
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", justifyContent: "space-between" }}>

                  {/* Left: Course Image & Information with Generous Spacing */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center", flex: "1 1 360px", minWidth: 0 }}>
                    <div style={{ width: 130, height: 92, borderRadius: 14, overflow: "hidden", flexShrink: 0, boxShadow: "0 4px 12px rgba(15,23,42,0.08)", border: "1px solid var(--border)" }}>
                      {/* courses.cover_image_url is nullable - fall back to a
                          plain tint rather than a stock photo. */}
                      {course.coverImageUrl ? (
                        <img
                          src={course.coverImageUrl}
                          alt={course.title}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                      ) : (
                        <div style={{ width: "100%", height: "100%", background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <BookOpen size={22} color="var(--primary)" />
                        </div>
                      )}
                    </div>

                    <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                      <div className="tai-row tai-gap8" style={{ marginBottom: 6, flexWrap: "wrap" }}>
                        <Tag tone={isCompleted ? "success" : "primary"}>{course.category}</Tag>
                        {isCompleted && (
                          <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--success)", background: "rgba(16, 185, 129, 0.1)", padding: "2px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Check size={12} /> Certified
                          </span>
                        )}
                      </div>

                      <h3 style={{ fontSize: 16.5, fontWeight: 800, color: "var(--text)", margin: "0 0 6px", lineHeight: 1.4 }}>
                        {course.title}
                      </h3>

                      <div className="tai-row tai-gap12" style={{ fontSize: 12.5, color: "var(--text-3)", flexWrap: "wrap" }}>
                        {/* No instructor avatar exists on courses - use the
                            shared initials Avatar, and skip the row entirely
                            when there is no instructor name at all. */}
                        {course.instructor && (
                          <>
                            <div className="tai-row tai-gap6">
                              <Avatar initials={course.instructor.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()} size={20} />
                              <span>{course.instructor}</span>
                            </div>
                            <span>•</span>
                          </>
                        )}
                        <span>{course.completedLessons} / {course.totalLessons} Lessons Done</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Dedicated Progress Bar & Resume Action Panel */}
                  <div style={{ flex: "1 1 300px", background: "var(--surface-3)", padding: "16px 20px", borderRadius: 14, border: "1px solid var(--border)" }}>
                    <div className="tai-row tai-between" style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>
                      <span style={{ color: "var(--text-2)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>
                        {isCompleted ? "Course Completed • 100%" : `Next: ${course.nextLesson || "Continue Lesson"}`}
                      </span>
                      <span style={{ color: isCompleted ? "var(--success)" : "var(--primary)", fontWeight: 800, background: isCompleted ? "rgba(16, 185, 129, 0.12)" : "var(--primary-tint)", padding: "2px 8px", borderRadius: 6 }}>
                        {course.progress}%
                      </span>
                    </div>

                    <ProgressBar value={course.progress} height={9} />

                    <div className="tai-row tai-between" style={{ marginTop: 14, alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                      {/* course_enrollments carries neither a credential id nor
                          a last-studied timestamp, so this caption renders only
                          when there is something real to put in it. */}
                      <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                        {isCompleted && course.certificateId ? `Verified ID: ${course.certificateId}` : ""}
                        {!isCompleted && course.lastActive ? `Last studied: ${course.lastActive}` : ""}
                      </span>

                      <button
                        className="tai-btn tai-btn-primary tai-btn-sm"
                        style={{ padding: "8px 18px", borderRadius: 10, fontWeight: 700 }}
                        onClick={(e) => { e.stopPropagation(); push("courseDetail", { id: course.id }); }}
                      >
                        {isCompleted ? "Review Syllabus →" : "Resume Lesson →"}
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

    </div>
  );
}
