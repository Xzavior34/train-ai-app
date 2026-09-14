import React, { useState } from "react";
import { Trophy, RefreshCw, Zap, Quote, Crown, Medal, Award } from "lucide-react";
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

const MOTIVATION_QUOTES = [
  {
    quote: "Education is not preparation for life; education is life itself.",
    author: "John Dewey",
  },
  {
    quote: "The more that you read, the more things you will know. The more that you learn, the more places you'll go.",
    author: "Dr. Seuss",
  },
  {
    quote: "Live as if you were to die tomorrow. Learn as if you were to live forever.",
    author: "Mahatma Gandhi",
  },
  {
    quote: "Learning is not attained by chance, it must be sought for with ardor and attended to with diligence.",
    author: "Abigail Adams",
  },
  {
    quote: "Success is the sum of small efforts, repeated day in and day out.",
    author: "Robert Collier",
  }
];

export function LeaderboardPanel({
  rows = [],
  loading = false,
  onRefresh,
  currentUserId,
  userStats = {}
}) {
  const [quoteIndex] = useState(() => Math.floor(Math.random() * MOTIVATION_QUOTES.length));
  const dailyQuote = MOTIVATION_QUOTES[quoteIndex] || MOTIVATION_QUOTES[0];

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
      {/* 1. Header Card with Live Standings & Your Rank */}
      <div
        className="tai-card"
        style={{
          padding: "20px 22px",
          background: "var(--glass-surface)",
          border: "1px solid var(--glass-border)",
          borderRadius: 16,
          boxShadow: "var(--glass-shadow)",
        }}
      >
        <div className="tai-row tai-between" style={{ alignItems: "flex-start", marginBottom: 16 }}>
          <div className="tai-row tai-gap12" style={{ alignItems: "center" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "#2563EB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 2px 8px rgba(37, 99, 235, 0.35)",
              }}
            >
              <Trophy size={22} color="#FFFFFF" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "var(--text)" }}>
                Leaderboard
              </h2>
              <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 2 }}>
                {learners.length} learners competing • Live updates
              </div>
            </div>
          </div>

          <button
            onClick={onRefresh}
            className="tai-btn tai-btn-outline tai-btn-sm"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 700,
            }}
          >
            <RefreshCw size={13} className={loading ? "anim-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Your Rank Highlight Row */}
        <div
          className="tai-row tai-between"
          style={{
            background: "var(--primary-tint)",
            border: "1px solid rgba(37, 99, 235, 0.25)",
            borderRadius: 12,
            padding: "12px 18px",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div className="tai-row tai-gap12" style={{ alignItems: "center" }}>
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "#2563EB",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              #{myRank}
            </span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>Your rank</div>
              <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 1 }}>
                {myPoints.toLocaleString()} pts • Level {myLevel}
              </div>
            </div>
          </div>

          {pointsToNext > 0 && (
            <div
              className="tai-row tai-gap6"
              style={{ color: "var(--primary)", fontSize: 13, fontWeight: 800, alignItems: "center" }}
            >
              <Zap size={14} fill="var(--primary)" />
              <span>{pointsToNext.toLocaleString()} pts to rank #{myRank - 1}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Daily Motivation Card */}
      <div
        className="tai-card"
        style={{
          padding: "16px 20px",
          background: "var(--glass-surface)",
          border: "1px solid var(--glass-border)",
          borderRadius: 14,
          boxShadow: "var(--glass-shadow)",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Quote size={26} color="#9333EA" style={{ transform: "rotate(180deg)", flexShrink: 0 }} />
        <div>
          <div style={{ fontStyle: "italic", fontSize: 13.5, color: "#7C3AED", fontWeight: 700, lineHeight: 1.5 }}>
            "{dailyQuote.quote} - {dailyQuote.author}"
          </div>
          <div style={{ fontSize: 12, color: "#A855F7", fontWeight: 700, marginTop: 4 }}>
            Daily Motivation
          </div>
        </div>
      </div>

      {/* 3. Top 3 Podium (Left: 2nd, Center: 1st, Right: 3rd) */}
      {learners.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16,
            alignItems: "flex-end",
            marginTop: 6,
          }}
        >
          {/* 2nd Place (Left) */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }}>
            <div style={{ position: "relative", marginBottom: 8 }}>
              <Avatar
                size={66}
                src={second?.avatar}
                initials={second?.initials}
                style={{ border: "2.5px solid #94A3B8" }}
              />
              <div
                style={{
                  position: "absolute",
                  top: -2,
                  right: -4,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "#94A3B8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                }}
              >
                <Medal size={13} />
              </div>
            </div>

            <div
              style={{
                fontWeight: 800,
                fontSize: 13,
                color: "var(--text)",
                textAlign: "center",
                marginBottom: 8,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                width: "100%",
                padding: "0 4px",
              }}
            >
              {second?.name || "—"}
            </div>

            <div
              style={{
                width: "100%",
                height: 120,
                background: "#8F9CAE",
                borderTopLeftRadius: 14,
                borderTopRightRadius: 14,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                boxShadow: "0 4px 10px rgba(143, 156, 174, 0.25)",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 900 }}>{second?.points?.toLocaleString() || 0}</div>
              <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.9, marginTop: 1 }}>pts</div>
            </div>
          </div>

          {/* 1st Place (Center - Elevated & Golden Yellow) */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }}>
            <div style={{ position: "relative", marginBottom: 8 }}>
              <Avatar
                size={76}
                src={first?.avatar}
                initials={first?.initials}
                style={{
                  border: "3.5px solid #F59E0B",
                  boxShadow: "0 0 16px rgba(245, 158, 11, 0.4)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "#F59E0B",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                }}
              >
                <Crown size={15} />
              </div>
            </div>

            <div
              style={{
                fontWeight: 900,
                fontSize: 13.5,
                color: "var(--text)",
                textAlign: "center",
                marginBottom: 8,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                width: "100%",
                padding: "0 4px",
              }}
            >
              {first?.name || "—"}
            </div>

            <div
              style={{
                width: "100%",
                height: 155,
                background: "#F59E0B",
                borderTopLeftRadius: 14,
                borderTopRightRadius: 14,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                boxShadow: "0 6px 16px rgba(245, 158, 11, 0.35)",
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 900 }}>{first?.points?.toLocaleString() || 0}</div>
              <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.9, marginTop: 1 }}>pts</div>
            </div>
          </div>

          {/* 3rd Place (Right - Orange) */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }}>
            <div style={{ position: "relative", marginBottom: 8 }}>
              <Avatar
                size={66}
                src={third?.avatar}
                initials={third?.initials}
                style={{ border: "2.5px solid #EA580C" }}
              />
              <div
                style={{
                  position: "absolute",
                  top: -2,
                  right: -4,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "#EA580C",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                }}
              >
                <Award size={13} />
              </div>
            </div>

            <div
              style={{
                fontWeight: 800,
                fontSize: 13,
                color: "var(--text)",
                textAlign: "center",
                marginBottom: 8,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                width: "100%",
                padding: "0 4px",
              }}
            >
              {third?.name || "—"}
            </div>

            <div
              style={{
                width: "100%",
                height: 110,
                background: "#F97316",
                borderTopLeftRadius: 14,
                borderTopRightRadius: 14,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                boxShadow: "0 4px 10px rgba(249, 115, 22, 0.25)",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 900 }}>{third?.points?.toLocaleString() || 0}</div>
              <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.9, marginTop: 1 }}>pts</div>
            </div>
          </div>
        </div>
      )}

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
