import React, { useEffect, useState } from "react";
import { Gift, Zap, X } from "lucide-react";
import { DAILY_LOGIN_REWARD_LADDER, fetchDailyLoginRewardState, claimDailyLoginReward } from "../../../lib/api/retention.js";

const STORAGE_PREFIX = "trainai_daily_login_seen";

function todayKey(userId) {
  return `${STORAGE_PREFIX}:${userId}:${new Date().toISOString().split("T")[0]}`;
}

function markSeenToday(userId) {
  try {
    localStorage.setItem(todayKey(userId), "1");
  } catch {
    // best-effort - never block UX on this
  }
}

function alreadySeenToday(userId) {
  try {
    return localStorage.getItem(todayKey(userId)) === "1";
  } catch {
    return false;
  }
}

// One-time-per-day "you're here, have some points" nudge. Backed by the real
// `daily_login_rewards` table (claimed_date, day_in_cycle, points_awarded,
// bonus_reward) - same table shape used elsewhere for gamification writes
// with a localStorage date-check (same pattern as ConsentBanner's
// STORAGE_KEY/POLICY_VERSION dance) layered on top purely to decide whether
// this *popup* has already been shown/dismissed today, so it doesn't flash
// back up on every navigation within the same day even after a claim.
export function DailyLoginReward({ session, onClaimed }) {
  const userId = session?.user?.id;
  const [state, setState] = useState(null); // { todayClaimed, nextDay }
  const [claiming, setClaiming] = useState(false);
  const [justClaimed, setJustClaimed] = useState(null); // rung just awarded
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    if (alreadySeenToday(userId)) {
      setDismissed(true);
      return;
    }
    let cancelled = false;
    fetchDailyLoginRewardState(userId).then((result) => {
      if (cancelled) return;
      if (result.todayClaimed) {
        // Already claimed this day from elsewhere (another tab/session)
        // nothing left to show, just remember that for the rest of today.
        markSeenToday(userId);
        setDismissed(true);
        return;
      }
      setState(result);
    });
    return () => { cancelled = true; };
  }, [userId]);

  function dismiss() {
    if (userId) markSeenToday(userId);
    setDismissed(true);
  }

  async function handleClaim() {
    if (!userId || !state || claiming) return;
    setClaiming(true);
    const rung = await claimDailyLoginReward(userId, state.nextDay);
    setClaiming(false);
    if (!rung) return;
    setJustClaimed(rung);
    markSeenToday(userId);
    if (onClaimed) onClaimed();
    setTimeout(() => setDismissed(true), 1800);
  }

  if (!userId || dismissed || !state) return null;

  return (
    <div
      className="tai-card tai-mt12"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, position: "relative" }}
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{ position: "absolute", top: 10, right: 10, border: "none", background: "transparent", cursor: "pointer", color: "var(--text-3)" }}
      >
        <X size={15} />
      </button>
      <div className="tai-row tai-gap12">
        <div className="tai-iconbtn" style={{ background: "var(--warning)", border: "none", color: "#fff" }}>
          <Gift size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14.5 }}>
            {justClaimed ? "Reward claimed!" : "Daily login reward"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
            {justClaimed
              ? `+${justClaimed.points} XP${justClaimed.bonus ? ` • ${justClaimed.bonus}` : ""}: see you tomorrow!`
              : `Day ${state.nextDay} of 7: claim your points for showing up today.`}
          </div>
        </div>
      </div>

      {!justClaimed && (
        <>
          <div className="tai-row tai-gap6 tai-mt12" style={{ flexWrap: "wrap" }}>
            {DAILY_LOGIN_REWARD_LADDER.map((rung) => {
              const isPast = rung.day < state.nextDay;
              const isToday = rung.day === state.nextDay;
              return (
                <div
                  key={rung.day}
                  title={`Day ${rung.day}: +${rung.points} XP${rung.bonus ? ` (${rung.bonus})` : ""}`}
                  style={{
                    width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9.5, fontWeight: 700, flexShrink: 0,
                    background: isToday ? "var(--warning)" : isPast ? "var(--surface-2)" : "var(--surface-3)",
                    color: isToday ? "#fff" : isPast ? "var(--primary)" : "var(--text-3)",
                    border: isToday ? "none" : "1px solid var(--border)",
                  }}
                >
                  {rung.points}
                </div>
              );
            })}
          </div>
          <button
            className="tai-btn tai-mt12"
            style={{ width: "100%", background: "var(--warning)", color: "#fff" }}
            disabled={claiming}
            onClick={handleClaim}
          >
            <Zap size={15} />
            {claiming ? "Claiming..." : `Claim +${Math.min(DAILY_LOGIN_REWARD_LADDER[state.nextDay - 1].points, 20)} XP`}
          </button>
        </>
      )}
    </div>
  );
}
