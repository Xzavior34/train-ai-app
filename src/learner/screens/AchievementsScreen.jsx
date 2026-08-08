import React from "react";
import { TopBar, StatTile, ProgressBar } from "../components/LearnerUI.jsx";
import { ACHIEVEMENT_CATALOG, getAchievementProgress } from "../achievementCatalog.js";
import { AIInsightsCard } from "../components/AIInsightsCard.jsx";
import { Trophy, Flame, Snowflake, Award, BookOpen, Users, GraduationCap, CheckCircle2 } from "lucide-react";

function iconForCategory(category) {
  if (category === "streak") return Flame;
  if (category === "mastery") return Trophy;
  if (category === "social") return Users;
  if (category === "completion") return BookOpen;
  return Award;
}

function levelProgress(level, totalPoints) {
  const lvl = level || 1;
  const floor = (lvl - 1) * 500;
  const ceiling = lvl * 500;
  const percent = ceiling > floor ? Math.max(0, Math.min(100, Math.round(((totalPoints - floor) / (ceiling - floor)) * 100))) : 0;
  return { floor, ceiling, percent };
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function AchievementsScreen({ user = {}, achievements = [], streakActivity = [], back, session, credits, consumeCredit, onBuyCredits }) {
  const { ceiling, percent } = levelProgress(user.level, user.totalPoints || 0);
  const earnedIds = new Set(achievements.map((a) => a.achievement_id));
  const locked = ACHIEVEMENT_CATALOG.filter((def) => !earnedIds.has(def.id));

  return (
    <div className="tai-fade-in">
      <TopBar title="Achievements" sub={`Level ${user.level || 1} • ${(user.totalPoints || 0).toLocaleString()} XP`} onBack={back} />

      <div className="tai-card" style={{ background: "var(--grad)", color: "#fff", border: "none" }}>
        <div className="tai-row tai-between">
          <div className="tai-row tai-gap10">
            <Trophy size={22} />
            <div style={{ fontWeight: 800, fontSize: 18 }}>Level {user.level || 1}</div>
          </div>
          <div style={{ fontSize: 12.5, opacity: 0.9 }}>{(user.totalPoints || 0).toLocaleString()} / {ceiling.toLocaleString()} XP</div>
        </div>
        <div className="tai-mt10">
          <div className="tai-progress-track" style={{ height: 8, background: "rgba(255,255,255,.25)" }}>
            <div style={{ width: `${percent}%`, height: 8, borderRadius: 99, background: "#fff" }} />
          </div>
        </div>
        <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 6 }}>{Math.max(0, ceiling - (user.totalPoints || 0)).toLocaleString()} XP to level {(user.level || 1) + 1}</div>
      </div>

      <div className="tai-row tai-gap12 tai-mt12">
        <StatTile icon={BookOpen} value={user.lessonsCompleted || 0} label="Lessons done" />
        <StatTile icon={GraduationCap} value={user.coursesCompleted || 0} label="Courses done" />
        <StatTile icon={Users} value={user.sessionsCompleted || 0} label="Sessions" />
      </div>

      <div className="tai-card tai-mt12" style={{ borderColor: "var(--warning)", background: "var(--warning-bg)" }}>
        <div className="tai-row tai-between">
          <div className="tai-row tai-gap10">
            <Flame size={20} color="var(--warning)" />
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{user.streak || 0} day streak</div>
              <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Keep learning daily to grow it</div>
            </div>
          </div>
          {user.streakFreezes > 0 && (
            <div className="tai-row tai-gap4" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--primary)" }}>
              <Snowflake size={15} />
              {user.streakFreezes}
            </div>
          )}
        </div>
      </div>

      <AIInsightsCard session={session} credits={credits} consumeCredit={consumeCredit} onBuyCredits={onBuyCredits} />

      {streakActivity.length > 0 && (
        <>
          <div className="tai-title-sm tai-mt20">Recent activity</div>
          <div className="tai-card tai-mt10">
            {streakActivity.map((row, i) => (
              <div key={row.id || i} className="tai-row tai-between" style={{ padding: "7px 0", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{formatDate(row.activity_date)}</span>
                <div className="tai-row tai-gap10" style={{ fontSize: 12.5 }}>
                  <span>{row.lessons_completed || 0} lesson{row.lessons_completed === 1 ? "" : "s"}</span>
                  <span style={{ fontWeight: 700, color: "var(--primary)" }}>+{row.points_earned || 0} XP</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="tai-row tai-between tai-mt20">
        <div className="tai-title-sm">Earned ({achievements.length})</div>
      </div>
      {achievements.length === 0 ? (
        <div className="tai-empty">No badges yet. Complete a lesson or quiz to earn your first one.</div>
      ) : (
        <div className="tai-col tai-gap10 tai-mt10">
          {achievements.map((a) => {
            const def = ACHIEVEMENT_CATALOG.find((d) => d.id === a.achievement_id);
            const Icon = iconForCategory(def?.category);
            return (
              <div key={a.id} className="tai-card">
                <div className="tai-row tai-gap12">
                  <div className="tai-iconbtn" style={{ background: "var(--success-bg)", border: "none", color: "var(--success)" }}>
                    <Icon size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="tai-row tai-between">
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{a.achievement_title || "Achievement"}</div>
                      <CheckCircle2 size={16} color="var(--success)" />
                    </div>
                    {a.achievement_description && (
                      <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>{a.achievement_description}</div>
                    )}
                    <div className="tai-row tai-gap10 tai-mt8" style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                      {a.points_awarded ? <span style={{ color: "var(--primary)", fontWeight: 700 }}>+{a.points_awarded} XP</span> : null}
                      {a.earned_at && <span>Earned {formatDate(a.earned_at)}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="tai-row tai-between tai-mt20">
        <div className="tai-title-sm">Locked ({locked.length})</div>
      </div>
      <div className="tai-col tai-gap10 tai-mt10">
        {locked.map((def) => {
          const Icon = iconForCategory(def.category);
          const { current, threshold, percent: p } = getAchievementProgress(def, user);
          return (
            <div key={def.id} className="tai-card" style={{ opacity: 0.6 }}>
              <div className="tai-row tai-gap12">
                <div className="tai-iconbtn" style={{ background: "var(--surface-2)", border: "none", color: "var(--text-3)" }}>
                  <Icon size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{def.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>{def.description}</div>
                  <div className="tai-mt8"><ProgressBar value={p} height={6} /></div>
                  <div className="tai-row tai-between tai-mt8" style={{ fontSize: 11, color: "var(--text-3)" }}>
                    <span>{Math.min(current, threshold)} / {threshold}</span>
                    <span>+{def.points} XP on unlock</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
