import React, { useEffect, useState } from "react";
import { Target, CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { fetchOrCreateTodayChallenge, completeTodayChallenge, tabForChallengeType } from "../../../lib/api/retention.js";

// Simple daily task prompt backed by the real `daily_challenges` table
// (challenge_date, challenge_title, challenge_description, target_value,
// current_progress, points_reward, is_completed) — confirmed to exist
// alongside the other real gamification tables in the shared schema, so
// this reads/writes it directly rather than deriving a challenge purely
// from `streak_tracking` client-side. One row per learner per day
// (get-or-create on mount, same shape as the reference app's own
// useDailyChallenge hook).
export function DailyChallengeCard({ session, goTab, showToast }) {
  const userId = session?.user?.id;
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let cancelled = false;
    fetchOrCreateTodayChallenge(userId).then((result) => {
      if (!cancelled) { setChallenge(result); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [userId]);

  if (!userId || loading || !challenge) return null;

  const isDone = challenge.is_completed;

  async function handleComplete() {
    if (isDone || completing) return;
    setCompleting(true);
    const updated = await completeTodayChallenge(userId, challenge);
    setCompleting(false);
    if (updated) {
      setChallenge(updated);
      if (showToast) showToast(`+${challenge.points_reward} XP — challenge complete!`);
    }
  }

  return (
    <div
      className="tai-card tai-mt12"
      style={{
        borderColor: isDone ? "var(--success)" : "var(--warning)",
        background: isDone ? "var(--success-bg)" : "var(--warning-bg)",
      }}
    >
      <div className="tai-row tai-between">
        <div className="tai-row tai-gap10">
          <div className="tai-iconbtn" style={{ background: isDone ? "var(--success)" : "var(--warning)", border: "none", color: "#fff" }}>
            {isDone ? <CheckCircle2 size={16} /> : <Target size={16} />}
          </div>
          <div className="tai-label">Daily challenge</div>
        </div>
        <span className="tai-tag" style={{ background: "var(--surface)", color: isDone ? "var(--success)" : "var(--warning)" }}>
          <Sparkles size={11} style={{ verticalAlign: -1, marginRight: 3 }} />
          +{challenge.points_reward} XP
        </span>
      </div>

      <div style={{ fontWeight: 800, fontSize: 14.5, marginTop: 10 }}>{challenge.challenge_title}</div>
      {challenge.challenge_description && (
        <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>{challenge.challenge_description}</div>
      )}

      {isDone ? (
        <div style={{ fontSize: 12, color: "var(--success)", fontWeight: 700, marginTop: 10 }}>
          Completed today — a new challenge arrives tomorrow.
        </div>
      ) : (
        <div className="tai-row tai-gap8 tai-mt12">
          <button
            className="tai-btn tai-btn-sm"
            style={{ flex: 1, background: "var(--warning)", color: "#fff" }}
            onClick={() => goTab && goTab(tabForChallengeType(challenge.challenge_type))}
          >
            Start now <ArrowRight size={13} />
          </button>
          <button
            className="tai-btn tai-btn-sm tai-btn-outline"
            style={{ flex: 1 }}
            disabled={completing}
            onClick={handleComplete}
          >
            {completing ? "Marking..." : "Mark done"}
          </button>
        </div>
      )}
    </div>
  );
}
