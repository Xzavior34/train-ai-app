import React, { useState } from "react";
import { Trophy, X } from "lucide-react";
import { ProgressBar } from "../LearnerUI.jsx";
import { ACHIEVEMENT_CATALOG, getAchievementProgress } from "../../achievementCatalog.js";

const CLOSE_THRESHOLD_PERCENT = 80; // "within 20%" of the next milestone

function dismissKey(userId) {
  return `trainai_almost_there_dismissed:${userId}:${new Date().toISOString().split("T")[0]}`;
}

function isDismissedToday(userId) {
  try {
    return localStorage.getItem(dismissKey(userId)) === "1";
  } catch {
    return false;
  }
}

// Same level formula GamificationCard/AchievementsScreen already use - level
// N starts at (N-1)*500 points, ends just before N*500.
function levelProgress(level, totalPoints) {
  const lvl = level || 1;
  const floor = (lvl - 1) * 500;
  const ceiling = lvl * 500;
  const percent = ceiling > floor ? Math.max(0, Math.min(100, Math.round(((totalPoints - floor) / (ceiling - floor)) * 100))) : 0;
  return { floor, ceiling, percent };
}

// Small dismissible "you're close" card. Reuses `getAchievementProgress()`
// (added in the prior gamification pass) against the real, already-loaded
// `user` stats + earned `achievements` - no new data fetch. Picks whichever
// single milestone (next level, or the closest locked achievement) the
// learner is nearest to, and only renders when that's genuinely within 20%.
export function AlmostThereNudge({ userId, user = {}, achievements = [], onView }) {
  const [dismissed, setDismissed] = useState(() => (userId ? isDismissedToday(userId) : false));

  const { ceiling, percent: levelPercent } = levelProgress(user.level, user.totalPoints || 0);
  const earnedIds = new Set(achievements.map((a) => a.achievement_id));

  let best = null;
  if (levelPercent >= CLOSE_THRESHOLD_PERCENT && levelPercent < 100) {
    best = {
      kind: "level",
      percent: levelPercent,
      title: `Level ${(user.level || 1) + 1} is close`,
      detail: `${Math.max(0, ceiling - (user.totalPoints || 0)).toLocaleString()} XP to go`,
    };
  }

  for (const def of ACHIEVEMENT_CATALOG) {
    if (earnedIds.has(def.id)) continue;
    const { current, threshold, percent } = getAchievementProgress(def, user);
    if (percent >= CLOSE_THRESHOLD_PERCENT && percent < 100 && (!best || percent > best.percent)) {
      best = {
        kind: "achievement",
        percent,
        title: `"${def.title}" is close`,
        detail: `${Math.max(0, threshold - current)} more to unlock: +${def.points} XP`,
      };
    }
  }

  if (!best || dismissed) return null;

  function dismiss() {
    if (userId) {
      try { localStorage.setItem(dismissKey(userId), "1"); } catch { /* best-effort */ }
    }
    setDismissed(true);
  }

  return (
    <div className="tai-card tai-mt12" style={{ borderColor: "var(--success)", background: "var(--success-bg)", position: "relative", cursor: onView ? "pointer" : "default" }} onClick={onView}>
      <button
        onClick={(e) => { e.stopPropagation(); dismiss(); }}
        aria-label="Dismiss"
        style={{ position: "absolute", top: 10, right: 10, border: "none", background: "transparent", cursor: "pointer", color: "var(--text-3)" }}
      >
        <X size={15} />
      </button>
      <div className="tai-row tai-gap12">
        <div className="tai-iconbtn" style={{ background: "var(--success)", border: "none", color: "#fff" }}>
          <Trophy size={17} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>{best.title}</div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>{best.detail}</div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--success)", flexShrink: 0 }}>{best.percent}%</div>
      </div>
      <div className="tai-mt10"><ProgressBar value={best.percent} height={6} /></div>
    </div>
  );
}
