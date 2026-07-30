import React from "react";
import { Avatar, ProgressBar, CourseCard } from "../components/LearnerUI.jsx";
import { GamificationCard } from "../components/GamificationCard.jsx";
import { ComebackBanner } from "../components/retention/ComebackBanner.jsx";
import { DailyLoginReward } from "../components/retention/DailyLoginReward.jsx";
import { AlmostThereNudge } from "../components/retention/AlmostThereNudge.jsx";
import { DailyChallengeCard } from "../components/retention/DailyChallengeCard.jsx";
import { SkillMasteryCard } from "../components/SkillMasteryCard.jsx";
import { RecommendedCoursesCard } from "../components/RecommendedCoursesCard.jsx";
import { AIRecommendationsCard } from "../components/AIRecommendationsCard.jsx";
import { Bell, GraduationCap, Play, BookOpen, Users, MessageSquare } from "lucide-react";

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export function HomeScreen({ user = {}, courses = [], coursesLoading, unreadNotifs = 0, weeklyGoal = 5, achievements = [], session, onGamificationRefetch, push, goTab, showToast }) {
  const enrolledCourses = (courses || []).filter(c => c.enrolled);
  const continueCourse = enrolledCourses.find(c => c.progress < 100) || (courses || [])[0] || null;
  const almostThereCourse = enrolledCourses
    .filter(c => c.progress > 0 && c.progress < 100)
    .sort((a, b) => b.progress - a.progress)[0];
  const recommended = (courses || []).filter(c => !c.enrolled && c.category === user?.track).slice(0, 2);

  const goal = weeklyGoal || 5;
  const done = user?.weeklyDone || 0;
  const goalPercent = Math.min(100, Math.round((done / goal) * 100));

  const daysAway = daysSince(user?.lastActiveAt);
  const hasHistory = (user?.totalPoints || 0) > 0 || (user?.lessonsCompleted || 0) > 0;
  const showComeback = daysAway !== null && daysAway >= 3 && hasHistory;

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 1. Prioritized Top Header & Learner Greeting */}
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

      {/* 2. Primary Hero Action Card: Resume Learning / Browse Catalog */}
      {coursesLoading ? (
        <div className="tai-empty">Loading your courses...</div>
      ) : continueCourse ? (
        <div className="tai-card" style={{ background: "var(--grad)", color: "#fff", border: "none", padding: 20 }}>
          <div className="tai-label" style={{ color: "rgba(255,255,255,.8)" }}>Resume course</div>
          <div className="tai-row tai-gap12 tai-mt10">
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <GraduationCap size={26} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 16.5 }}>{continueCourse.title}</div>
              <div style={{ fontSize: 12.5, opacity: .85 }}>{continueCourse.tagline}</div>
            </div>
          </div>
          <button className="tai-btn tai-mt16" style={{ width: "100%", background: "rgba(255,255,255,.18)", color: "#fff" }}
            onClick={() => push("courseDetail", { id: continueCourse.id })}>
            <Play size={15} /> Continue learning
          </button>
        </div>
      ) : (
        <div className="tai-card" style={{ textAlign: "center", padding: 20 }}>
          <div className="tai-body-text">No courses yet — browse the catalog to get started.</div>
          <button className="tai-btn tai-btn-primary tai-mt12" style={{ width: "100%" }} onClick={() => goTab("courses")}>
            <BookOpen size={16} /> Browse courses
          </button>
        </div>
      )}

      {/* 3. Daily Rewards & Retention Nudge Banners */}
      {showComeback ? (
        <ComebackBanner
          userId={session?.user?.id}
          daysAway={daysAway}
          course={almostThereCourse}
          onContinue={() => push("courseDetail", { id: almostThereCourse.id })}
          onBrowse={() => goTab("courses")}
        />
      ) : (
        <DailyLoginReward session={session} onClaimed={onGamificationRefetch} />
      )}

      <AlmostThereNudge
        userId={session?.user?.id}
        user={user}
        achievements={achievements}
        onView={() => push("achievements")}
      />

      {/* 4. Gamification & Skill Progress Cluster */}
      <GamificationCard
        level={user?.level || 1}
        totalPoints={user?.totalPoints || 0}
        streak={user?.streak || 0}
        streakFreezes={user?.streakFreezes || 0}
        achievements={achievements}
        onViewAchievements={() => push("achievements")}
      />

      <div className="tai-card">
        <div className="tai-row tai-between">
          <div className="tai-title-sm">Weekly lesson goal</div>
          <span className="tai-link" onClick={() => push("settings")}>Edit</span>
        </div>
        <div className="tai-row tai-between tai-mt10" style={{ fontSize: 13, color: "var(--text-2)" }}>
          <span>{done} of {goal} lessons</span>
          <span>{goalPercent}%</span>
        </div>
        <div className="tai-mt8"><ProgressBar value={goalPercent} /></div>
      </div>

      <SkillMasteryCard courses={courses} />

      {/* 5. Thumb-Reachable Quick Access Shortcuts */}
      <div style={{ marginTop: 4 }}>
        <div className="tai-row tai-between" style={{ marginBottom: 10 }}>
          <div className="tai-title-sm">Quick access</div>
        </div>
        <div className="tai-grid2">
          <div className="tai-card" style={{ cursor: "pointer", padding: 16 }} onClick={() => push("mentors")}>
            <Users size={20} color="var(--primary)" />
            <div style={{ fontWeight: 700, fontSize: 13.5, marginTop: 8 }}>1-on-1 Mentorship</div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 2 }}>Book expert session</div>
          </div>
          <div className="tai-card" style={{ cursor: "pointer", padding: 16 }} onClick={() => push("messages")}>
            <MessageSquare size={20} color="var(--primary)" />
            <div style={{ fontWeight: 700, fontSize: 13.5, marginTop: 8 }}>Messages</div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 2 }}>Chat with mentor</div>
          </div>
        </div>
      </div>

      {/* 6. Course Progress & Recommendations Stack */}
      {almostThereCourse && (
        <div style={{ marginTop: 4 }}>
          <div className="tai-row tai-between" style={{ marginBottom: 10 }}>
            <div className="tai-title-sm">Almost there</div>
          </div>
          <CourseCard course={almostThereCourse} onClick={() => push("courseDetail", { id: almostThereCourse.id })} />
        </div>
      )}

      <div style={{ marginTop: 4 }}>
        <div className="tai-row tai-between" style={{ marginBottom: 10 }}>
          <div className="tai-title-sm">Recommended for {user.track}</div>
          <span className="tai-link" onClick={() => goTab("courses")}>See all</span>
        </div>
        {!coursesLoading && recommended.length === 0 && <div className="tai-empty">No recommendations yet.</div>}
        <div className="tai-col tai-gap10">
          {recommended.map(c => (
            <CourseCard key={c.id} course={c} onClick={() => push("courseDetail", { id: c.id })} />
          ))}
        </div>
      </div>

      <AIRecommendationsCard
        user={user}
        courses={courses}
        session={session}
        goTab={goTab}
      />

      <RecommendedCoursesCard
        courses={courses}
        onOpenCourse={(id) => push("courseDetail", { id })}
        onSeeAll={() => goTab("courses")}
      />

      <DailyChallengeCard session={session} goTab={goTab} showToast={showToast} />
    </div>
  );
}
