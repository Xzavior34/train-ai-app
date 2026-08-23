import React, { useState } from "react";
import { Zap, ArrowRight, X } from "lucide-react";

function dismissKey(userId) {
  return `trainai_comeback_dismissed:${userId}:${new Date().toISOString().split("T")[0]}`;
}

function isDismissedToday(userId) {
  try {
    return sessionStorage.getItem(dismissKey(userId)) === "1";
  } catch {
    return false;
  }
}

// "Welcome back" nudge for a learner who's been away a while. `lastActiveAt`
// comes straight from `user_gamification_stats.updated_at` - the real
// timestamp column this app's gamification row already carries and that
// `useLearnerData` already fetches on every screen (no redundant query added
// here; `streak_tracking.activity_date` would be an equally real signal but
// that table is only queried on the Achievements screen today, so reusing
// the already-loaded stats row avoids firing a second query just for Home).
// Dismissal is remembered for the rest of the day via sessionStorage so it
// doesn't reappear on every tab switch, but comes back tomorrow if still
// relevant.
export function ComebackBanner({ userId, daysAway, course, onContinue, onBrowse }) {
  const [dismissed, setDismissed] = useState(() => (userId ? isDismissedToday(userId) : false));

  if (!daysAway || daysAway < 2 || dismissed) return null;

  function dismiss() {
    if (userId) {
      try { sessionStorage.setItem(dismissKey(userId), "1"); } catch { /* best-effort */ }
    }
    setDismissed(true);
  }

  return (
    <div
      className="tai-card tai-mt12"
      style={{
        background: "var(--surface)",
        color: "var(--text)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        position: "relative",
        overflow: "hidden",
        boxShadow: "inset 0 1px 0 var(--glass-specular), 0 8px 24px -6px rgba(0,0,0,0.12)"
      }}
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          position: "absolute", top: 12, right: 12, border: "1px solid var(--border)",
          background: "var(--surface-2)", borderRadius: 8, cursor: "pointer", color: "var(--text-3)",
          width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center"
        }}
      >
        <X size={13} />
      </button>
      <div className="tai-row tai-gap12">
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--primary-tint)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Zap size={18} color="var(--primary)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)" }}>Welcome back!</div>
          <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 2, lineHeight: 1.4 }}>
            {course
              ? <>It's been {daysAway} days. You're {Math.round(course.progress || 0)}% through "{course.title}". Pick up right where you left off.</>
              : <>It's been {daysAway} days since your last lesson. Ready to jump back in?</>}
          </div>
        </div>
      </div>
      <button
        className="tai-btn tai-btn-primary tai-mt12"
        style={{ width: "100%", borderRadius: 8 }}
        onClick={course ? onContinue : onBrowse}
      >
        {course ? "Continue learning" : "Browse courses"} <ArrowRight size={15} />
      </button>
    </div>
  );
}
