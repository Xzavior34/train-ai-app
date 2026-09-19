import React from "react";
import { Trophy, RefreshCw, Zap, Crown, Medal, Award } from "lucide-react";
import { Avatar, initialsOf } from "./LearnerUI.jsx";

const FALLBACK_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=140&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=140&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=140&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=140&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=140&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=140&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=140&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=140&auto=format&fit=crop&q=80"
];

function resolveAvatar(l, index = 0) {
  if (l?.avatar && typeof l.avatar === "string" && l.avatar.startsWith("http")) return l.avatar;
  if (l?.avatar_url && typeof l.avatar_url === "string" && l.avatar_url.startsWith("http")) return l.avatar_url;
  if (l?.avatarUrl && typeof l.avatarUrl === "string" && l.avatarUrl.startsWith("http")) return l.avatarUrl;
  return FALLBACK_AVATARS[index % FALLBACK_AVATARS.length];
}

export function LeaderboardPanel({
  rows = [],
  loading = false,
  onRefresh,
  currentUserId,
  userStats = {},
  period = "all",
  onPeriodChange,
  customStart = "",
  customEnd = "",
  onCustomStartChange,
  onCustomEndChange,
}) {

  const learners = rows.map((r, i) => ({
    id: r.user_id || r.id || `l-${i}`,
    rank: i + 1,
    name: r.display_name || r.name || "Learner",
    avatar: resolveAvatar(r, i),
    initials: initialsOf(r.display_name || r.name || "Learner"),
    points: r.total_points ?? r.period_points ?? r.points ?? r.xp ?? 0,
    streak: r.streak_days ?? r.streak ?? 0,
    level: r.current_level ?? r.level ?? Math.max(1, Math.floor(((r.total_points ?? r.points ?? 0) / 2000) + 1)),
    lessonsCompleted: r.lessons_completed ?? r.lessonsCompleted ?? (r.completed_lessons?.length || 0),
    coursesCompleted: r.courses_completed ?? r.completed_courses ?? 0,
    isCurrentUser: r.user_id === currentUserId || r.id === currentUserId || r.you || false,
  }));

  const myIndex = learners.findIndex((l) => l.isCurrentUser);
  const myEntry = myIndex >= 0 ? learners[myIndex] : null;
  const myRank = myIndex >= 0 ? myIndex + 1 : (learners.length ? learners.length + 1 : 1);
  const myPoints = myEntry?.points ?? userStats.total_points ?? 0;
  const myLevel = myEntry?.level ?? userStats.current_level ?? 1;

  const pointsToNext = myIndex > 0 ? (learners[myIndex - 1]?.points || myPoints) - myPoints : 0;

  const first = learners[0] || null;
  const second = learners[1] || null;
  const third = learners[2] || null;
  const restLearners = learners.slice(3);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 1. HERO BANNER: Leaderboard & Top 3 Champions (Adaptive Liquid Glass) */}
      <div
        className="tai-card tai-hero-card anim-fluid-entrance"
        style={{
          borderRadius: 14,
          padding: "clamp(18px, 2.5vw, 24px)",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {/* Decorative ambient radial glow */}
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(37, 99, 235, 0.25) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Top Hero Row: Title + Period Filter + Refresh */}
        <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
          <div style={{ minWidth: 0, flex: "1 1 260px" }}>
            <div className="tai-row tai-gap8" style={{ alignItems: "center", marginBottom: 4 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "var(--primary-tint)",
                  border: "1px solid rgba(37, 99, 235, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Trophy size={18} color="var(--primary)" />
              </div>
              <h1 className="tai-hero-title" style={{ fontSize: "clamp(20px, 2.5vw, 24px)", fontWeight: 900, letterSpacing: "-0.025em", margin: 0, lineHeight: 1.2 }}>
                Leaderboard &amp; Top Achievers
              </h1>
            </div>
            <p className="tai-hero-desc" style={{ fontSize: 13, margin: 0, lineHeight: 1.45 }}>
              {learners.length} learners competing •{" "}
              {period === "week"
                ? "This week"
                : period === "month"
                ? "This month"
                : period === "custom"
                ? (customStart && customEnd ? `${customStart} to ${customEnd}` : "Pick a date range")
                : "All time"}{" "}
              ranking
            </p>
          </div>

          <div className="tai-row tai-gap8" style={{ alignItems: "center", flexWrap: "wrap" }}>
            {onPeriodChange && (
              <div
                className="tai-row"
                style={{
                  display: "inline-flex",
                  background: "var(--surface-3)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 2,
                }}
              >
                {[
                  { key: "all", label: "All Time" },
                  { key: "week", label: "This Week" },
                  { key: "month", label: "This Month" },
                  { key: "custom", label: "Custom" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => onPeriodChange(opt.key)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      border: "none",
                      background: period === opt.key ? "var(--primary)" : "transparent",
                      color: period === opt.key ? "#FFFFFF" : "var(--text-2)",
                      fontWeight: 700,
                      fontSize: 11.5,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {onPeriodChange && period === "custom" && (
              <div
                className="tai-row tai-gap6"
                style={{
                  alignItems: "center",
                  background: "var(--surface-3)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "4px 8px",
                }}
              >
                <input
                  type="date"
                  value={customStart}
                  max={customEnd || undefined}
                  onChange={(e) => onCustomStartChange?.(e.target.value)}
                  aria-label="Range start date"
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--text)",
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: "3px 2px",
                  }}
                />
                <span style={{ color: "var(--text-3)", fontSize: 11 }}>to</span>
                <input
                  type="date"
                  value={customEnd}
                  min={customStart || undefined}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => onCustomEndChange?.(e.target.value)}
                  aria-label="Range end date"
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--text)",
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: "3px 2px",
                  }}
                />
              </div>
            )}

            <button
              onClick={onRefresh}
              className="tai-btn tai-btn-outline tai-btn-sm"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <RefreshCw size={13} className={loading ? "anim-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Top 3 Champions Podium directly inside the Hero Banner */}
        {learners.length > 0 && (
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
              gap: 12,
              alignItems: "stretch",
              marginTop: 4,
            }}
          >
            {/* 2nd Place (Silver) */}
            <div
              className="tai-hero-subcard"
              style={{
                borderRadius: 12,
                padding: "14px 12px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                position: "relative",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div style={{ position: "relative" }}>
                <Avatar
                  size={54}
                  src={second?.avatar}
                  initials={second?.initials}
                  style={{ border: "2.5px solid #94A3B8" }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "#94A3B8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFFFFF",
                    fontSize: 11,
                    fontWeight: 900,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                  }}
                >
                  #2
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                  {second?.name || "—"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>2nd Place Contender</div>
              </div>
              <div style={{ fontWeight: 900, fontSize: 14, color: "var(--primary)", background: "var(--primary-tint)", padding: "3px 10px", borderRadius: 999 }}>
                {second?.points?.toLocaleString() || 0} pts
              </div>
            </div>

            {/* 1st Place (Gold Champion) */}
            <div
              className="tai-hero-subcard"
              style={{
                borderRadius: 12,
                padding: "16px 14px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                position: "relative",
                justifyContent: "space-between",
                gap: 8,
                border: "1.5px solid rgba(245, 158, 11, 0.4)",
                background: "rgba(245, 158, 11, 0.08)",
                boxShadow: "0 8px 24px -6px rgba(245, 158, 11, 0.2)",
              }}
            >
              <div style={{ position: "relative" }}>
                <Avatar
                  size={62}
                  src={first?.avatar}
                  initials={first?.initials}
                  style={{ border: "3px solid #F59E0B", boxShadow: "0 0 14px rgba(245, 158, 11, 0.45)" }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "#F59E0B",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFFFFF",
                    fontSize: 11.5,
                    fontWeight: 900,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                  }}
                >
                  <Crown size={14} />
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 14, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 170 }}>
                  {first?.name || "—"}
                </div>
                <div style={{ fontSize: 11, color: "#D97706", fontWeight: 800 }}>🏆 Champion</div>
              </div>
              <div style={{ fontWeight: 900, fontSize: 15, color: "#D97706", background: "rgba(245, 158, 11, 0.16)", border: "1px solid rgba(245, 158, 11, 0.3)", padding: "4px 12px", borderRadius: 999 }}>
                {first?.points?.toLocaleString() || 0} pts
              </div>
            </div>

            {/* 3rd Place (Bronze) */}
            <div
              className="tai-hero-subcard"
              style={{
                borderRadius: 12,
                padding: "14px 12px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                position: "relative",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div style={{ position: "relative" }}>
                <Avatar
                  size={54}
                  src={third?.avatar}
                  initials={third?.initials}
                  style={{ border: "2.5px solid #EA580C" }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "#EA580C",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFFFFF",
                    fontSize: 11,
                    fontWeight: 900,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                  }}
                >
                  #3
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                  {third?.name || "—"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>3rd Place Achiever</div>
              </div>
              <div style={{ fontWeight: 900, fontSize: 14, color: "var(--primary)", background: "var(--primary-tint)", padding: "3px 10px", borderRadius: 999 }}>
                {third?.points?.toLocaleString() || 0} pts
              </div>
            </div>
          </div>
        )}

        {/* Your Rank Live Highlight Row inside Hero */}
        <div
          className="tai-hero-subcard"
          style={{
            position: "relative",
            zIndex: 1,
            borderRadius: 10,
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div className="tai-row tai-gap10" style={{ alignItems: "center" }}>
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "var(--primary)",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              #{myRank}
            </span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text)" }}>Your Standing</div>
              <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>
                {myPoints.toLocaleString()} pts • Level {myLevel}
              </div>
            </div>
          </div>

          {pointsToNext > 0 ? (
            <div
              className="tai-row tai-gap6"
              style={{ color: "var(--primary)", fontSize: 12, fontWeight: 800, alignItems: "center" }}
            >
              <Zap size={13} fill="var(--primary)" />
              <span>{pointsToNext.toLocaleString()} pts to reach rank #{myRank - 1}</span>
            </div>
          ) : (
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#059669" }}>
              ✨ Leading the board!
            </div>
          )}
        </div>
      </div>

      {/* 4. Ranked List (From #4 downwards) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {restLearners.map((r) => (
          <div
            key={r.id}
            className="tai-card tai-card-hover"
            style={{
              background: r.isCurrentUser ? "var(--primary-tint)" : "var(--glass-surface)",
              borderRadius: 14,
              border: r.isCurrentUser ? "1.5px solid rgba(37, 99, 235, 0.35)" : "1px solid var(--glass-border)",
              padding: "14px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "var(--glass-shadow)",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            {/* Left: Rank, Avatar & Info */}
            <div className="tai-row tai-gap14" style={{ alignItems: "center", minWidth: 0, flex: "1 1 240px" }}>
              <span style={{ fontSize: 14.5, fontWeight: 900, color: "var(--text-3)", minWidth: 30 }}>
                #{r.rank}
              </span>

              <Avatar size={42} src={r.avatar} initials={r.initials} />

              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.name} {r.isCurrentUser && <span style={{ color: "var(--primary)", fontSize: 11.5 }}>(You)</span>}
                </div>

                <div className="tai-row tai-gap10" style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2, alignItems: "center" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    🔥 {r.streak}d
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    📖 {r.lessonsCompleted}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    🎯 {r.coursesCompleted}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Points & Level */}
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: "var(--text)" }}>
                {r.points?.toLocaleString()}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 700, marginTop: 1 }}>
                Lvl {r.level}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LeaderboardPanel;
