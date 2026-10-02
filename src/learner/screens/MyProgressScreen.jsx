import React, { useState } from "react";
import { TopBar, Avatar, Tag, ProgressBar, StatTile } from "../components/LearnerUI.jsx";
import {
  BarChart3, BookOpen, Clock, Trophy, Flame, GraduationCap, CheckCircle2,
  Calendar, ArrowRight, Play, Star, Target, Award, ShieldCheck,
  TrendingUp, Check, ExternalLink
} from "lucide-react";
import { isMockDataEnabled } from "../../lib/mockDataManager.js";

const COURSE_UNIQUE_THUMBNAILS = {
  "course-figma-ai": "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80",
  "course-spatial-ui": "https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?w=800&auto=format&fit=crop&q=80",
  "course-fullstack-ai": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80",
  "course-prompt-pro": "https://images.unsplash.com/photo-1677442136019-21780efad99a?w=800&auto=format&fit=crop&q=80",
  "course-cloud-devops": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80",
  "course-data-python": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80",
  "course-product-analytics": "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80",
  "course-compliance-101": "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=80",
  "course-techpreneur-business": "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&auto=format&fit=crop&q=80",
  "course-techpreneur-experimentation": "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&auto=format&fit=crop&q=80",
  "course-foundations": "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&auto=format&fit=crop&q=80"
};

export function MyProgressScreen({ user = {}, courses = [], push, back, session, showToast }) {
  const [filterStatus, setFilterStatus] = useState("all"); // "all" | "in_progress" | "completed"

  const enrolledFromDb = (courses || [])
    .filter(c => c.enrolled || c.progress > 0)
    .map((c) => {
      const isDone = (c.progress || 0) >= 100;
      return {
        id: c.id,
        title: c.title,
        category: c.category || "Professional Track",
        instructor: c.instructor || "Instructor",
        instructorAvatar: c.instructorAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        totalLessons: c.lessons || 12,
        completedLessons: Math.round(((c.progress || 0) / 100) * (c.lessons || 12)),
        totalHours: c.hours || 10,
        hoursSpent: Math.round(((c.progress || 0) / 100) * (c.hours || 10) * 10) / 10,
        progress: c.progress || 0,
        status: isDone ? "completed" : "in_progress",
        lastActive: "Recent",
        nextLesson: isDone ? "All modules completed" : "Continue current module",
        coverImageUrl: (c.id && COURSE_UNIQUE_THUMBNAILS[c.id]) || c.coverImageUrl || c.image || "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80"
      };
    });

  const allProgressCourses = enrolledFromDb;

  const filteredCourses = allProgressCourses.filter(c => {
    if (filterStatus === "in_progress") return c.status === "in_progress";
    if (filterStatus === "completed") return c.status === "completed";
    return true;
  });

  const inProgressCount = allProgressCourses.filter(c => c.status === "in_progress").length;
  const completedCount = allProgressCourses.filter(c => c.status === "completed").length;

  // Derive category mastery dynamically
  const categoriesMap = {};
  (courses || []).forEach(c => {
    const cat = c.category || "General";
    if (!categoriesMap[cat]) {
      categoriesMap[cat] = { totalProgress: 0, count: 0 };
    }
    categoriesMap[cat].totalProgress += (c.progress || 0);
    categoriesMap[cat].count += 1;
  });

  const dynamicSkills = Object.entries(categoriesMap).map(([name, data]) => {
    const avg = Math.round(data.totalProgress / (data.count || 1));
    const status = avg >= 90 ? "Expert" : avg >= 75 ? "Proficient" : avg >= 40 ? "Intermediate" : avg > 0 ? "In Progress" : "Not Started";
    return { name, mastery: avg, status };
  });

  const skillsOverview = dynamicSkills.length > 0 ? dynamicSkills : [
    { name: "Curriculum Track", mastery: user.mastery || 0, status: (user.mastery || 0) >= 70 ? "Proficient" : "In Progress" }
  ];

  const weeklyDone = user.weeklyDone || 0;
  const weeklyGoal = user.weeklyGoal || 5;
  const weeklyPct = weeklyGoal > 0 ? Math.min(100, Math.round((weeklyDone / weeklyGoal) * 100)) : 0;
  const weeklyRemaining = Math.max(0, weeklyGoal - weeklyDone);

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      {/* =========================================================================
          HERO BANNER: My Learning Journey & Weekly Milestone
          ========================================================================= */}
      <div
        className="tai-card tai-hero-card anim-fluid-entrance"
        style={{
          borderRadius: 14,
          padding: "clamp(18px, 2.5vw, 24px)",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="tai-hero-title" style={{ fontSize: "clamp(20px, 2.5vw, 25px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 4px", lineHeight: 1.2 }}>
              My Learning Progress
            </h1>
            <p className="tai-hero-desc" style={{ fontSize: 13, margin: 0, maxWidth: 620, lineHeight: 1.45 }}>
              {user.totalHours || 0} study hours logged across {inProgressCount} active course{inProgressCount === 1 ? "" : "s"}.
            </p>
          </div>

          <div className="tai-hero-subcard" style={{ textAlign: "right", flexShrink: 0, padding: "10px 16px", borderRadius: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#34D399" }}>{weeklyDone} / {weeklyGoal} Lessons Done</div>
            <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>{weeklyPct}% Sprint Met</div>
          </div>
        </div>

        {/* Weekly Goal Progress Bar */}
        <div className="tai-hero-subcard" style={{
          position: "relative", zIndex: 1, marginTop: 16,
          padding: "12px 16px", borderRadius: 10
        }}>
          <div className="tai-row tai-between" style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>
            <span>Weekly Sprint Progress ({weeklyPct}% Target Met)</span>
            <span style={{ color: "#34D399", fontSize: 12, fontWeight: 700 }}>
              {weeklyRemaining} of {weeklyGoal} lessons remaining
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: "var(--surface-3)", overflow: "hidden" }}>
            <div style={{ width: `${weeklyPct}%`, height: "100%", background: "#10B981", borderRadius: 99, transition: "width 0.4s ease" }} />
          </div>
        </div>
      </div>

      {/* =========================================================================
          KEY STAT TILES STRIP
          ========================================================================= */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <div className="tai-card" style={{ padding: 18, borderRadius: 10 }}>
          <div className="tai-row tai-gap10">
            <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BookOpen size={18} color="var(--primary)" />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>{inProgressCount} Active</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Courses in Progress</div>
            </div>
          </div>
        </div>

        <div className="tai-card" style={{ padding: 18, borderRadius: 10 }}>
          <div className="tai-row tai-gap10">
            <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(16, 185, 129, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <GraduationCap size={18} color="#10B981" />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>{completedCount}</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Completed Courses</div>
            </div>
          </div>
        </div>

        <div className="tai-card" style={{ padding: 18, borderRadius: 10 }}>
          <div className="tai-row tai-gap10">
            <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(245, 158, 11, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={18} color="#F59E0B" />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>{user.totalHours || 0} hrs</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Total Learning Time</div>
            </div>
          </div>
        </div>

        <div className="tai-card" style={{ padding: 18, borderRadius: 10 }}>
          <div className="tai-row tai-gap10">
            <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(139, 92, 246, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Flame size={18} color="#3B82F6" />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>{user.streak || 0} Days</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Active Study Streak</div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ANALYTICS: 2-COLUMN STUDY TIME & SKILL RADAR
          ========================================================================= */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: 20 }}>

        {/* Study Time Overview Card */}
        <div className="tai-card" style={{ padding: 22, borderRadius: 10 }}>
          <div className="tai-row tai-between" style={{ marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 2px", color: "var(--text)" }}>
                Study Time Overview
              </h3>
              <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>
                {user.totalHours || 0} total learning hours logged
              </div>
            </div>
            <span className="tai-tag" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10B981", fontWeight: 700 }}>
              Active
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-3)", padding: "14px 16px", borderRadius: 8 }}>
              <span style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 600 }}>Weekly Completed Lessons</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>{weeklyDone} / {weeklyGoal}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-3)", padding: "14px 16px", borderRadius: 8 }}>
              <span style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 600 }}>Total Curriculum Lessons Done</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>{user.lessonsCompleted || 0}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-3)", padding: "14px 16px", borderRadius: 8 }}>
              <span style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 600 }}>Overall Curriculum Mastery</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: "var(--primary)" }}>{user.mastery || 0}%</span>
            </div>
          </div>
        </div>

        {/* Competency Mastery Overview */}
        <div className="tai-card" style={{ padding: 22, borderRadius: 10 }}>
          <div className="tai-row tai-between" style={{ marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 2px", color: "var(--text)" }}>
                Target Skills Mastery
              </h3>
              <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>
                Evaluated from enrolled courses &amp; tracks
              </div>
            </div>
            <span className="tai-tag" style={{ background: "rgba(37, 99, 235, 0.1)", color: "var(--primary)", fontWeight: 700 }}>
              Level {user.level || 1}
            </span>
          </div>

          <div className="tai-col tai-gap14">
            {skillsOverview.map(skill => (
              <div key={skill.name}>
                <div className="tai-row tai-between" style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>
                  <span style={{ color: "var(--text)" }}>{skill.name}</span>
                  <div className="tai-row tai-gap6">
                    <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>{skill.status}</span>
                    <span style={{ color: "var(--primary)", fontWeight: 800 }}>{skill.mastery}%</span>
                  </div>
                </div>
                <ProgressBar value={skill.mastery} height={7} />
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* =========================================================================
          COURSE BREAKDOWN: STATUS TABS & EXPANDED SYLLABUS CARDS
          ========================================================================= */}
      <div>
        <div className="tai-row tai-between" style={{ marginBottom: 16, flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: "var(--text)", margin: 0 }}>
              Enrolled Courses &amp; Modules
            </h2>
          </div>

          {/* Status Filter Tabs */}
          <div className="tai-row tai-gap6" style={{ flexWrap: "wrap" }}>
            {[
              { k: "all", label: `All (${allProgressCourses.length})` },
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

        <div className="tai-col tai-gap20 anim-stagger">
          {filteredCourses.length === 0 && (
            <div className="tai-card" style={{ textAlign: "center", padding: "clamp(32px, 5vw, 48px) 20px", borderRadius: 10 }}>
              <BookOpen size={36} color="var(--text-3)" style={{ margin: "0 auto 12px", opacity: 0.6 }} />
              <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>
                {filterStatus === "completed" ? "No completed courses yet" : filterStatus === "in_progress" ? "No courses in progress" : "No enrolled courses yet"}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4, maxWidth: 440, margin: "4px auto 16px" }}>
                {filterStatus === "all" ? "Explore the course catalog to enroll in courses and track your skill growth." : "Browse available courses to continue learning."}
              </div>
              <button
                className="tai-btn tai-btn-primary"
                onClick={() => push("courses")}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: "0 auto" }}
              >
                <span>Browse Courses</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}

          {filteredCourses.map(course => {
            const isCompleted = course.progress === 100;
            return (
              <div
                key={course.id}
                className="tai-card tai-card-hover"
                style={{ padding: "clamp(16px, 4vw, 24px) clamp(16px, 4vw, 26px)", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)" }}
                onClick={() => push("courseDetail", { id: course.id })}
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", justifyContent: "space-between" }}>
                  
                  {/* Left: Course Image & Information with Generous Spacing */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center", flex: "1 1 360px", minWidth: 0 }}>
                    <div style={{ width: 130, height: 92, borderRadius: 8, overflow: "hidden", flexShrink: 0, boxShadow: "0 4px 12px rgba(15,23,42,0.08)", border: "1px solid var(--border)" }}>
                      <img
                        src={course.coverImageUrl}
                        alt={course.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
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
                        <div className="tai-row tai-gap6">
                          <img src={course.instructorAvatar} alt={course.instructor} style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />
                          <span>{course.instructor}</span>
                        </div>
                        <span>•</span>
                        <span>{course.completedLessons} / {course.totalLessons} Lessons Done</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Dedicated Progress Bar & Resume Action Panel */}
                  <div style={{ flex: "1 1 300px", background: "var(--surface-3)", padding: "16px 20px", borderRadius: 8, border: "1px solid var(--border)" }}>
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
                      <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                        {isCompleted ? `Verified ID: ${course.certificateId || `TAI-${(course.id || "").slice(-6).toUpperCase()}-${new Date().getFullYear()}`}` : `Last studied: ${course.lastActive || "Recently"}`}
                      </span>

                      <button
                        className="tai-btn tai-btn-primary tai-btn-sm"
                        style={{ padding: "8px 18px", borderRadius: 8, fontWeight: 700 }}
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
      </div>

    </div>
  );
}
