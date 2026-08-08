import React from "react";
import { Avatar, ProgressBar } from "../components/LearnerUI.jsx";
import { AIRecommendationsCard } from "../components/AIRecommendationsCard.jsx";
import { Bell, GraduationCap, Play, BookOpen, Users, Zap, ChevronRight, Layers } from "lucide-react";

// Deliberately minimal - per product feedback the previous home screen
// stacked ~10 cards (gamification, skill mastery, retention nudges, two
// separate course-recommendation stacks, quick-access shortcuts, daily
// challenge...) and felt "way too busy". This screen now shows only:
// notifications + a one-line weekly goal, the one active course + a link to
// it, the learner's cohort + a link to it, a link to the community, one AI
// recommendation + a link to the AI section, and one quick link each to the
// other 3 sections (courses / AI / community). Everything else (streaks,
// achievements, full recommendation lists, gamification) still exists - it
// lives on its own screen (Courses, AI, Community, Achievements) rather than
// all being crammed onto Home.
export function HomeScreen({
  user = {}, courses = [], coursesLoading, unreadNotifs = 0, weeklyGoal = 5,
  session, push, goTab, goToMyCourses, cohort = null, cohortLoading = false,
}) {
  const enrolledCourses = (courses || []).filter(c => c.enrolled);
  const continueCourse = enrolledCourses.find(c => c.progress < 100) || null;
  const otherAssignedCount = Math.max(0, enrolledCourses.length - (continueCourse ? 1 : 0));

  const goal = weeklyGoal || 5;
  const done = user?.weeklyDone || 0;
  const goalPercent = Math.min(100, Math.round((done / goal) * 100));

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Greeting + notifications */}
      <div className="tai-topbar" style={{ paddingBottom: 6 }}>
        <div className="tai-row tai-gap12" style={{ cursor: "pointer" }} onClick={() => push("settings")}>
          <Avatar initials={user?.initials || "L"} size={44} />
          <div>
            <div style={{ fontSize: 12.5, color: "var(--text-2)", fontWeight: 500 }}>Good morning</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{(user?.name || "Learner").split(" ")[0]}</div>
          </div>
        </div>
        <div className="tai-row tai-gap8">
          <button className="tai-iconbtn" onClick={() => push("notifications")} style={{ position: "relative" }}>
            <Bell size={17} />
            {unreadNotifs > 0 && <span className="anim-pulse-dot" style={{ position: "absolute", top: 6, right: 7, width: 7, height: 7, borderRadius: "50%", background: "var(--danger)" }} />}
          </button>
        </div>
      </div>

      {/* One-line weekly goal */}
      <div className="tai-card" style={{ padding: 14 }}>
        <div className="tai-row tai-between" style={{ fontSize: 13, fontWeight: 700 }}>
          <span>This week's goal: {done} of {goal} lessons</span>
          <span className="tai-link" onClick={() => push("settings")} style={{ fontSize: 12 }}>Edit</span>
        </div>
        <div className="tai-mt8"><ProgressBar value={goalPercent} height={6} /></div>
      </div>

      {/* Active course */}
      {coursesLoading ? (
        <div className="tai-empty">Loading your courses...</div>
      ) : continueCourse ? (
        <div className="tai-card" style={{ background: "var(--grad)", color: "#fff", border: "none", padding: 20 }}>
          <div className="tai-row tai-between">
            <div className="tai-label" style={{ color: "rgba(255,255,255,.8)" }}>Your active course</div>
            {otherAssignedCount > 0 && (
              <span
                onClick={goToMyCourses}
                style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", opacity: .9, cursor: "pointer", textDecoration: "underline" }}
              >
                +{otherAssignedCount} more assigned
              </span>
            )}
          </div>
          <div className="tai-row tai-gap12 tai-mt10">
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <GraduationCap size={26} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 16.5 }}>{continueCourse.title}</div>
              <div style={{ fontSize: 12.5, opacity: .85 }}>{continueCourse.progress}% complete</div>
            </div>
          </div>
          <button className="tai-btn tai-mt16" style={{ width: "100%", background: "rgba(255,255,255,.18)", color: "#fff" }}
            onClick={() => push("courseDetail", { id: continueCourse.id })}>
            <Play size={15} /> Continue learning
          </button>
        </div>
      ) : (
        <div className="tai-card" style={{ textAlign: "center", padding: 20 }}>
          <div className="tai-body-text">
            {enrolledCourses.length > 0
              ? `You've completed all ${enrolledCourses.length} of your assigned courses.`
              : "No active course yet. Browse the catalog to get started."}
          </div>
          {enrolledCourses.length > 0 ? (
            <button className="tai-btn tai-btn-primary tai-mt12" style={{ width: "100%" }} onClick={goToMyCourses}>
              <BookOpen size={16} /> See my courses
            </button>
          ) : (
            <button className="tai-btn tai-btn-primary tai-mt12" style={{ width: "100%" }} onClick={() => goTab("courses")}>
              <BookOpen size={16} /> Browse courses
            </button>
          )}
        </div>
      )}

      {/* Cohort */}
      <div className="tai-card" style={{ cursor: cohort ? "pointer" : "default", padding: 16 }} onClick={() => { if (cohort) push("cohort"); }}>
        <div className="tai-row tai-between">
          <div className="tai-row tai-gap10">
            <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Layers size={18} color="var(--primary)" />
            </div>
            <div>
              <div className="tai-label">Your cohort</div>
              {cohortLoading ? (
                <div style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 2 }}>Loading...</div>
              ) : cohort ? (
                <div style={{ fontWeight: 700, fontSize: 14.5, marginTop: 2 }}>{cohort.name}</div>
              ) : (
                <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 2 }}>Not part of a cohort yet</div>
              )}
            </div>
          </div>
          {cohort && <ChevronRight size={18} color="var(--text-3)" />}
        </div>
      </div>

      {/* Community link */}
      <div className="tai-card" style={{ cursor: "pointer", padding: 16 }} onClick={() => goTab("community")}>
        <div className="tai-row tai-between">
          <div className="tai-row tai-gap10">
            <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Users size={18} color="var(--primary)" />
            </div>
            <div>
              <div className="tai-label">Community</div>
              <div style={{ fontWeight: 700, fontSize: 14.5, marginTop: 2 }}>Study groups, forums & posts</div>
            </div>
          </div>
          <ChevronRight size={18} color="var(--text-3)" />
        </div>
      </div>

      {/* One AI recommendation + link to AI section */}
      <AIRecommendationsCard user={user} courses={courses} session={session} goTab={goTab} maxItems={1} showSeeAll />

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
