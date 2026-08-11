import React from "react";
import { Trophy } from "lucide-react";
import { Avatar } from "../LearnerUI.jsx";

const MEDALS = ["🥇", "🥈", "🥉"];

// Compact leaderboard-position card. Reuses the same `fetchLeaderboard()` /
// `get_leaderboard_with_profiles` RPC result the app already fetches
// (`leaderboardQuery` in useLearnerData) - no second query, no new "weekly
// league" table invented. That RPC returns all-time totals (no week_start
// window), so this is deliberately labelled "Leaderboard standing" rather
// than "This week's top learners" - the shared schema does have real
// `weekly_leagues`/`league_members` tables, but wiring up real weekly
// league join/promotion mechanics is a materially bigger feature (its own
// join-or-create RPC, promotion/demotion logic, weekly reset) than a small
// presentational nudge card, so it's intentionally out of scope here; this
// card only presents data that's genuinely already available.
export function WeeklyLeagueCard({ rows = [], loading }) {
  if (loading) return null;

  // Previously returned null with zero rows - meaning "Rank" effectively
  // didn't exist at all wherever there was no leaderboard data yet (a
  // brand new org, or demo mode), rather than looking like an intentional,
  // present section. A real empty state instead, so the feature is always
  // visible when enabled, even before there's anything to rank.
  if (!rows.length) {
    return (
      <div className="tai-card tai-mt12">
        <div className="tai-row tai-gap10">
          <div className="tai-iconbtn" style={{ background: "#FDF4DC", border: "none", color: "#B8860B" }}>
            <Trophy size={16} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Rank</div>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 8 }}>
          No ranking data yet - complete lessons and assessments to appear on the leaderboard.
        </div>
      </div>
    );
  }

  const top = rows.slice(0, 5);
  const you = rows.find((r) => r.you);
  const youInTop = top.some((r) => r.you);

  return (
    <div className="tai-card tai-mt12">
      <div className="tai-row tai-gap10">
        <div className="tai-iconbtn" style={{ background: "#FDF4DC", border: "none", color: "#B8860B" }}>
          <Trophy size={16} />
        </div>
        <div>
          <div className="tai-label">Leaderboard standing</div>
          <div style={{ fontSize: 12, color: "var(--text-2)" }}>All-time points across all learners</div>
        </div>
      </div>

      <div className="tai-col tai-gap8 tai-mt12">
        {top.map((r, idx) => (
          <div
            key={r.rank}
            className="tai-row tai-gap10"
            style={{ padding: "6px 8px", borderRadius: 10, background: r.you ? "var(--surface-2)" : "transparent" }}
          >
            <span style={{ width: 22, textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--text-2)" }}>
              {MEDALS[idx] || `#${r.rank}`}
            </span>
            <Avatar initials={r.initials} size={26} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: r.you ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {r.you ? "You" : r.name}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>{(r.points || 0).toLocaleString()}</span>
          </div>
        ))}

        {you && !youInTop && (
          <div className="tai-row tai-gap10" style={{ padding: "6px 8px", borderRadius: 10, background: "var(--surface-2)", borderTop: "1px dashed var(--border)", marginTop: 4 }}>
            <span style={{ width: 22, textAlign: "center", fontSize: 12, fontWeight: 700, color: "var(--text-2)" }}>#{you.rank}</span>
            <Avatar initials={you.initials} size={26} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700 }}>You</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>{(you.points || 0).toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
