import React, { useState } from "react";
import { Sparkles, ArrowRight, X } from "lucide-react";

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
// comes straight from `user_gamification_stats.updated_at` — the real
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
      style={{ background: "var(--grad)", color: "#fff", border: "none", position: "relative", overflow: "hidden" }}
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{ position: "absolute", top: 10, right: 10, border: "none", background: "rgba(255,255,255,.18)", borderRadius: 8, cursor: "pointer", color: "#fff", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <X size={13} />
      </button>
      <div className="tai-row tai-gap12">
        <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Sparkles size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Welcome back!</div>
          <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 2 }}>
            {course
              ? <>It's been {daysAway} days — you're {Math.round(course.progress || 0)}% through "{course.title}". Pick up right where you left off.</>
              : <>It's been {daysAway} days since your last lesson — ready to jump back in?</>}
          </div>
        </div>
      </div>
      <button
        className="tai-btn tai-mt12"
        style={{ width: "100%", background: "rgba(255,255,255,.18)", color: "#fff" }}
        onClick={course ? onContinue : onBrowse}
      >
        {course ? "Continue learning" : "Browse courses"} <ArrowRight size={15} />
      </button>
    </div>
  );
}
