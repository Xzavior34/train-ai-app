import React from "react";
import { ProgressBar } from "./LearnerUI.jsx";
import { Trophy, Flame, Snowflake, Award, BookOpen, Users, ChevronRight, Lock } from "lucide-react";
import { ACHIEVEMENT_CATALOG } from "../achievementCatalog.js";

const CATALOG_BY_ID = new Map(ACHIEVEMENT_CATALOG.map((a) => [a.id, a]));

// Same level formula the shared backend's own gamification UI uses: level N
// starts at (N-1)*500 points and ends just before N*500 points.
function levelProgress(level, totalPoints) {
  const lvl = level || 1;
  const floor = (lvl - 1) * 500;
  const ceiling = lvl * 500;
  const percent = ceiling > floor ? Math.max(0, Math.min(100, Math.round(((totalPoints - floor) / (ceiling - floor)) * 100))) : 0;
  return { floor, ceiling, percent };
}

function iconForCategory(category) {
  if (category === "streak") return Flame;
  if (category === "mastery") return Trophy;
  if (category === "social") return Users;
  if (category === "completion") return BookOpen;
  return Award;
}

// Compact gamification summary: level/XP progress, streak + freezes, and a
// row of earned achievement badges. Fields all come straight from the real
// `user_gamification_stats` row (current_level, total_points, streak_days,
// streak_freezes_available) and `user_achievements` rows (achievement_id,
// achievement_title, achievement_icon) - nothing here is invented.
export function GamificationCard({ level = 1, totalPoints = 0, streak = 0, streakFreezes = 0, achievements = [], onViewAchievements }) {
  const { ceiling, percent } = levelProgress(level, totalPoints);
  const earnedCount = achievements.length;
  const preview = achievements.slice(0, 5);

  return (
    <div className="tai-card tai-mt12" style={{ borderRadius: 10 }}>
      <div className="tai-row tai-between">
        <div className="tai-row tai-gap10">
          <div className="tai-iconbtn" style={{ background: "#4F46E5", border: "none", color: "#fff", borderRadius: 8 }}>
            <Trophy size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Level {level}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>{totalPoints.toLocaleString()} / {ceiling.toLocaleString()} XP</div>
          </div>
        </div>
        <div className="tai-row tai-gap6" style={{ fontSize: 12.5, color: "var(--text-2)" }}>
          <Flame size={15} color="var(--warning)" />
          <span style={{ fontWeight: 700, color: "var(--text)" }}>{streak}</span>
          <span>day{streak === 1 ? "" : "s"}</span>
          {streakFreezes > 0 && (
            <span className="tai-row tai-gap4" style={{ marginLeft: 6 }} title={`${streakFreezes} streak freeze${streakFreezes === 1 ? "" : "s"} available`}>
              <Snowflake size={13} color="var(--primary)" />
              {streakFreezes}
            </span>
          )}
        </div>
      </div>

      <div className="tai-mt10"><ProgressBar value={percent} /></div>

      <hr className="tai-divider" />

      <div className="tai-row tai-between">
        <span className="tai-label">Achievements</span>
        {onViewAchievements && (
          <span className="tai-link" onClick={onViewAchievements}>
            View all <ChevronRight size={13} />
          </span>
        )}
      </div>

      {earnedCount === 0 ? (
        <div className="tai-row tai-gap8 tai-mt10" style={{ fontSize: 12.5, color: "var(--text-2)" }}>
          <Lock size={15} color="var(--text-3)" />
          <span>Complete a lesson to earn your first badge.</span>
        </div>
      ) : (
        <div className="tai-row tai-gap10 tai-mt10" style={{ flexWrap: "wrap" }}>
          {preview.map((a) => {
            const Icon = iconForCategory(CATALOG_BY_ID.get(a.achievement_id)?.category);
            return (
              <div
                key={a.id}
                title={a.achievement_title || "Achievement"}
                className="tai-row"
                style={{
                  width: 38, height: 38, borderRadius: 8, background: "var(--surface-2)",
                  alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}
              >
                <Icon size={17} color="var(--primary)" />
              </div>
            );
          })}
          {earnedCount > preview.length && (
            <div className="tai-row" style={{
              width: 38, height: 38, borderRadius: 8, background: "var(--surface-3)",
              alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700, color: "var(--text-2)", flexShrink: 0,
            }}>
              +{earnedCount - preview.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
