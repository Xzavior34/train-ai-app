import React, { useState, useMemo } from "react";
import { TopBar, Avatar, Tag } from "../components/LearnerUI.jsx";
import {
  Trophy, Crown, Flame, Award, ArrowUp, Sparkles, Quote,
  RefreshCw, BookOpen, GraduationCap, Zap, CheckCircle2, MessageCircle
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchLeaderboard, fetchLeaderboardForPeriod, fetchMyCohortLeaderboard } from "../../lib/api/learner.js";

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

const MOTIVATION_QUOTES = [
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
  },
  {
    quote: "An investment in knowledge pays the best interest.",
    author: "Benjamin Franklin",
  }
];

function resolveAvatar(l, index = 0) {
  if (l?.avatar && typeof l.avatar === "string" && l.avatar.startsWith("http")) return l.avatar;
  if (l?.avatar_url && typeof l.avatar_url === "string" && l.avatar_url.startsWith("http")) return l.avatar_url;
  if (l?.avatarUrl && typeof l.avatarUrl === "string" && l.avatarUrl.startsWith("http")) return l.avatarUrl;
  return FALLBACK_AVATARS[index % FALLBACK_AVATARS.length];
}

export function LeaderboardScreen({ back, user = {}, leaderboardQuery, session, push, showToast }) {
  const [timeframe, setTimeframe] = useState("all"); // "all" | "cohort" | "week"
  const [cheeredIds, setCheeredIds] = useState({});

  const userId = session?.user?.id || null;

  const defaultLeaderboardQuery = useSupabaseQuery(async () => {
    if (leaderboardQuery) return null;
    return fetchLeaderboard(50);
  }, [leaderboardQuery]);

  const cohortQuery = useSupabaseQuery(async () => {
    if (timeframe !== "cohort" || !userId) return null;
    return fetchMyCohortLeaderboard(userId, 50);
  }, [timeframe, userId]);

  const weekQuery = useSupabaseQuery(async () => {
    if (timeframe !== "week") return null;
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return fetchLeaderboardForPeriod(start.toISOString(), now.toISOString(), 50);
  }, [timeframe]);

  const activeData = timeframe === "cohort"
    ? cohortQuery.data
    : timeframe === "week"
      ? weekQuery.data
      : (leaderboardQuery?.data || defaultLeaderboardQuery.data);

  const activeLoading = timeframe === "cohort"
    ? cohortQuery.loading
    : timeframe === "week"
      ? weekQuery.loading
      : (leaderboardQuery ? leaderboardQuery.loading : defaultLeaderboardQuery.loading);

  const refetchActive = () => {
    if (timeframe === "cohort") cohortQuery.refetch?.();
    else if (timeframe === "week") weekQuery.refetch?.();
    else if (leaderboardQuery) leaderboardQuery.refetch?.();
    else defaultLeaderboardQuery.refetch?.();
  };

  const learners = useMemo(() => {
    return (activeData || []).map((l, i) => ({
      id: l.user_id || `l-${i}`,
      rank: i + 1,
      name: l.display_name || l.name || "Learner",
      role: l.role || "Specialist",
      cohort: l.cohort_name || l.school || "Active Batch",
      avatar: resolveAvatar(l, i),
      xp: l.total_points || l.period_points || l.points || l.xp || 0,
      streak: l.streak || l.streak_days || 0,
      level: l.current_level || l.level || Math.max(1, Math.floor((l.total_points || l.xp || 0) / 2000) + 1),
      lessonsCompleted: l.lessons_completed || 0,
      coursesCompleted: l.completed_courses || l.courses_completed || 0,
      isCurrentUser: l.user_id === userId || l.you || false
    }));
  }, [activeData, userId]);

  const top3 = learners.slice(0, 3);
  const restLearners = learners.slice(3);
  const myEntry = learners.find(l => l.isCurrentUser) || null;
  const myRankIndex = learners.findIndex(l => l.isCurrentUser);
  const nextRankPoints = myRankIndex > 0 ? (learners[myRankIndex - 1]?.xp || 0) - (myEntry?.xp || 0) : 0;

  // Random quote of the day
  const [quoteIndex] = useState(() => Math.floor(Math.random() * MOTIVATION_QUOTES.length));
  const dailyQuote = MOTIVATION_QUOTES[quoteIndex] || MOTIVATION_QUOTES[0];

  const handleCheer = (learnerId, name) => {
    setCheeredIds(prev => ({ ...prev, [learnerId]: true }));
    showToast?.(`👏 Sent a cheer to ${name}!`);
  };

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Top Bar with Clean Header */}
      <TopBar
        title="Leaderboard & Rankings"
        sub="Community rankings based on XP, course progress, and active study streaks"
        onBack={back}
      />

      {/* =========================================================================
          HERO HEADER & CONTROLS CARD
          ========================================================================= */}
      <div
        className="tai-card"
        style={{
          padding: "20px 22px",
          background: "var(--glass-surface)",
          border: "1px solid var(--glass-border)",
          borderRadius: 16,
          boxShadow: "var(--glass-shadow)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14
        }}
      >
        <div className="tai-row tai-gap12" style={{ alignItems: "center" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "rgba(245, 158, 11, 0.15)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}
          >
            <Trophy size={24} color="#D97706" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "var(--text)" }}>
              Live Standings
            </h2>
            <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 2 }}>
              {learners.length} learners participating • Updated live
            </div>
          </div>
        </div>

        {/* Filter Pills & Refresh */}
        <div className="tai-row tai-gap8" style={{ alignItems: "center", flexWrap: "wrap" }}>
          {[
            { id: "all", label: "All Time" },
            { id: "week", label: "This Week" },
            { id: "cohort", label: "My Cohort" }
          ].map(tf => {
            const isActive = timeframe === tf.id;
            return (
              <button
                key={tf.id}
                onClick={() => setTimeframe(tf.id)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: `1px solid ${isActive ? "var(--primary)" : "var(--border)"}`,
                  background: isActive ? "var(--primary)" : "var(--surface-2)",
                  color: isActive ? "#FFFFFF" : "var(--text-2)",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
              >
                {tf.label}
              </button>
            );
          })}

          <button
            className="tai-btn tai-btn-ghost tai-btn-sm"
            onClick={refetchActive}
            title="Refresh Leaderboard"
            style={{ padding: "6px 10px", borderRadius: 8 }}
          >
            <RefreshCw size={14} className={activeLoading ? "anim-spin" : ""} />
          </button>
        </div>
      </div>

      {/* =========================================================================
          DAILY MOTIVATION QUOTE WIDGET (Exact 1.0 Design)
          ========================================================================= */}
      <div
        className="tai-card"
        style={{
          padding: "18px 20px",
          background: "var(--glass-surface)",
          border: "1px solid var(--glass-border)",
          borderRadius: 14,
          boxShadow: "var(--glass-shadow)",
          display: "flex",
          alignItems: "flex-start",
          gap: 14
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "rgba(37, 99, 235, 0.12)",
            border: "1px solid rgba(37, 99, 235, 0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}
        >
          <Quote size={18} color="var(--primary)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontStyle: "italic", color: "var(--text)", lineHeight: 1.55 }}>
            "{dailyQuote.quote}"
          </p>
          <div className="tai-row tai-between" style={{ alignItems: "center", marginTop: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)" }}>
              — {dailyQuote.author}
            </span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: 999,
                background: "var(--primary-tint)",
                color: "var(--primary)",
                border: "1px solid rgba(37, 99, 235, 0.25)"
              }}
            >
              ✨ Daily Motivation
            </span>
          </div>
        </div>
      </div>

      {activeLoading && (
        <div className="tai-card" style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
          Loading standings...
        </div>
      )}

      {!activeLoading && learners.length === 0 && (
        <div className="tai-card" style={{ padding: 36, textAlign: "center" }}>
          <Trophy size={28} color="var(--text-3)" style={{ margin: "0 auto 8px" }} />
          <div style={{ fontWeight: 800, fontSize: 14 }}>
            {timeframe === "cohort" ? "You're not currently in a cohort space." : "No leaderboard records found."}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>
            Complete lessons or quizzes to record points and climb the ranks!
          </div>
        </div>
      )}

      {!activeLoading && learners.length > 0 && (
        <>
          {/* =========================================================================
              3-PERSON PODIUM (1st elevated in middle, 2nd silver left, 3rd bronze right)
              ========================================================================= */}
          {top3.length > 0 && (
            <div
              className="tai-card anim-fluid-entrance"
              style={{
                padding: "clamp(20px, 3vw, 28px)",
                background: "var(--glass-surface)",
                border: "1px solid var(--glass-border)",
                borderRadius: 16,
                boxShadow: "var(--glass-shadow)",
                position: "relative",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -50,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 280,
                  height: 180,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(245, 158, 11, 0.22) 0%, transparent 70%)",
                  pointerEvents: "none"
                }}
              />

              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 4px", color: "var(--text)" }}>
                  Top Performers
                </h3>
                <p style={{ fontSize: 12.5, color: "var(--text-3)", margin: 0 }}>
                  Leading learners across active tracks and study engagement
                </p>
              </div>

              {/* Podium Display */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "flex-end",
                  gap: "clamp(12px, 3vw, 28px)",
                  paddingBottom: 6,
                  flexWrap: "wrap"
                }}
              >
                {/* 2nd Place (Silver) */}
                {top3[1] && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      flex: "1 1 120px",
                      maxWidth: 160,
                      textAlign: "center",
                      order: 1,
                      padding: "16px 12px",
                      borderRadius: 14,
                      background: "var(--surface-2)",
                      border: "1.5px solid rgba(148, 163, 184, 0.4)",
                      boxShadow: "0 4px 14px rgba(148, 163, 184, 0.15)"
                    }}
                  >
                    <div style={{ position: "relative", marginBottom: 8 }}>
                      <Avatar
                        size={56}
                        src={top3[1].avatar}
                        initials={top3[1].name?.[0] || "L"}
                        style={{
                          borderRadius: "50%",
                          border: "3px solid #94A3B8",
                          boxShadow: "0 4px 12px rgba(148, 163, 184, 0.4)"
                        }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          bottom: -6,
                          left: "50%",
                          transform: "translateX(-50%)",
                          background: "#94A3B8",
                          color: "#FFFFFF",
                          fontWeight: 900,
                          fontSize: 11,
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
                        }}
                      >
                        2
                      </span>
                    </div>

                    <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>
                      {top3[1].name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                      Level {top3[1].level}
                    </div>
                    <div
                      style={{
                        background: "rgba(148, 163, 184, 0.15)",
                        color: "var(--text)",
                        fontWeight: 900,
                        fontSize: 12,
                        padding: "3px 10px",
                        borderRadius: 99,
                        marginTop: 8,
                        border: "1px solid rgba(148, 163, 184, 0.3)"
                      }}
                    >
                      {top3[1].xp.toLocaleString()} pts
                    </div>
                  </div>
                )}

                {/* 1st Place (Gold - Elevated in Middle) */}
                {top3[0] && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      flex: "1 1 140px",
                      maxWidth: 180,
                      textAlign: "center",
                      order: 2,
                      transform: "translateY(-10px)",
                      padding: "20px 14px",
                      borderRadius: 16,
                      background: "var(--surface-2)",
                      border: "2px solid rgba(245, 158, 11, 0.6)",
                      boxShadow: "0 8px 24px -4px rgba(245, 158, 11, 0.35)"
                    }}
                  >
                    <div style={{ position: "relative", marginBottom: 8 }}>
                      <Crown
                        size={24}
                        color="#F59E0B"
                        style={{
                          position: "absolute",
                          top: -20,
                          left: "50%",
                          transform: "translateX(-50%)",
                          filter: "drop-shadow(0 0 6px rgba(245, 158, 11, 0.6))"
                        }}
                      />
                      <Avatar
                        size={68}
                        src={top3[0].avatar}
                        initials={top3[0].name?.[0] || "L"}
                        style={{
                          borderRadius: "50%",
                          border: "3.5px solid #F59E0B",
                          boxShadow: "0 0 20px rgba(245, 158, 11, 0.4)"
                        }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          bottom: -6,
                          left: "50%",
                          transform: "translateX(-50%)",
                          background: "#F59E0B",
                          color: "#FFFFFF",
                          fontWeight: 900,
                          fontSize: 12,
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
                        }}
                      >
                        1
                      </span>
                    </div>

                    <div style={{ fontWeight: 900, fontSize: 14.5, color: "var(--text)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>
                      {top3[0].name}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>
                      Level {top3[0].level} • 🥇 Champion
                    </div>
                    <div
                      style={{
                        background: "rgba(245, 158, 11, 0.2)",
                        color: "#D97706",
                        fontWeight: 900,
                        fontSize: 13,
                        padding: "4px 12px",
                        borderRadius: 99,
                        marginTop: 8,
                        border: "1px solid rgba(245, 158, 11, 0.5)"
                      }}
                    >
                      {top3[0].xp.toLocaleString()} pts
                    </div>
                  </div>
                )}

                {/* 3rd Place (Bronze) */}
                {top3[2] && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      flex: "1 1 120px",
                      maxWidth: 160,
                      textAlign: "center",
                      order: 3,
                      padding: "16px 12px",
                      borderRadius: 14,
                      background: "var(--surface-2)",
                      border: "1.5px solid rgba(217, 119, 6, 0.4)",
                      boxShadow: "0 4px 14px rgba(217, 119, 6, 0.15)"
                    }}
                  >
                    <div style={{ position: "relative", marginBottom: 8 }}>
                      <Avatar
                        size={56}
                        src={top3[2].avatar}
                        initials={top3[2].name?.[0] || "L"}
                        style={{
                          borderRadius: "50%",
                          border: "3px solid #D97706",
                          boxShadow: "0 4px 12px rgba(217, 119, 6, 0.3)"
                        }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          bottom: -6,
                          left: "50%",
                          transform: "translateX(-50%)",
                          background: "#D97706",
                          color: "#FFFFFF",
                          fontWeight: 900,
                          fontSize: 11,
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
                        }}
                      >
                        3
                      </span>
                    </div>

                    <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>
                      {top3[2].name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                      Level {top3[2].level}
                    </div>
                    <div
                      style={{
                        background: "rgba(217, 119, 6, 0.15)",
                        color: "var(--text)",
                        fontWeight: 900,
                        fontSize: 12,
                        padding: "3px 10px",
                        borderRadius: 99,
                        marginTop: 8,
                        border: "1px solid rgba(217, 119, 6, 0.3)"
                      }}
                    >
                      {top3[2].xp.toLocaleString()} pts
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              YOUR RANK HIGHLIGHT CARD
              ========================================================================= */}
          {myEntry && (
            <div
              className="tai-card"
              style={{
                padding: "16px 20px",
                background: "var(--primary-tint)",
                border: "1px solid rgba(37, 99, 235, 0.3)",
                borderRadius: 14,
                boxShadow: "var(--glass-shadow)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12
              }}
            >
              <div className="tai-row tai-gap12" style={{ alignItems: "center" }}>
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "var(--primary)",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: 14
                  }}
                >
                  #{myEntry.rank}
                </span>
                <Avatar size={40} src={myEntry.avatar} initials={myEntry.name?.[0] || "Y"} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>
                    {myEntry.name} (You)
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 1 }}>
                    {myEntry.xp.toLocaleString()} pts • Level {myEntry.level} {myEntry.streak > 0 && `• 🔥 ${myEntry.streak}d streak`}
                  </div>
                </div>
              </div>

              {nextRankPoints > 0 && (
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--primary)" }}>
                  ⚡ {nextRankPoints.toLocaleString()} pts to rank #{myEntry.rank - 1}
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              FULL RANKED LIST (Clean 1.0 Presentation - No complex table)
              ========================================================================= */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {learners.map((l) => {
              const isTop3 = l.rank <= 3;
              const rankBadgeColor =
                l.rank === 1 ? "#F59E0B" : l.rank === 2 ? "#94A3B8" : l.rank === 3 ? "#D97706" : "var(--text-3)";
              const rankBadgeBg =
                l.rank === 1 ? "rgba(245, 158, 11, 0.15)" : l.rank === 2 ? "rgba(148, 163, 184, 0.15)" : l.rank === 3 ? "rgba(217, 119, 6, 0.15)" : "var(--surface-2)";

              return (
                <div
                  key={l.id}
                  className="tai-card tai-card-hover"
                  style={{
                    padding: "14px 18px",
                    background: l.isCurrentUser ? "var(--primary-tint)" : "var(--glass-surface)",
                    border: l.isCurrentUser ? "1.5px solid rgba(37, 99, 235, 0.35)" : "1px solid var(--glass-border)",
                    borderRadius: 14,
                    boxShadow: "var(--glass-shadow)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap"
                  }}
                >
                  {/* Left: Rank & Profile */}
                  <div className="tai-row tai-gap12" style={{ alignItems: "center", minWidth: 0, flex: "1 1 240px" }}>
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: rankBadgeBg,
                        color: rankBadgeColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 900,
                        fontSize: 12.5,
                        flexShrink: 0
                      }}
                    >
                      {l.rank === 1 ? "🥇" : l.rank === 2 ? "🥈" : l.rank === 3 ? "🥉" : `#${l.rank}`}
                    </span>

                    <Avatar size={38} src={l.avatar} initials={l.name?.[0] || "L"} />

                    <div style={{ minWidth: 0 }}>
                      <div className="tai-row tai-gap6" style={{ alignItems: "center" }}>
                        <span style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {l.name}
                        </span>
                        {l.isCurrentUser && (
                          <span style={{ fontSize: 10.5, fontWeight: 800, color: "var(--primary)", background: "rgba(37, 99, 235, 0.15)", padding: "1px 6px", borderRadius: 4 }}>
                            YOU
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 1 }}>
                        Level {l.level} • {l.cohort}
                      </div>
                    </div>
                  </div>

                  {/* Right: Stats & Functional Cheer Button */}
                  <div className="tai-row tai-gap14" style={{ alignItems: "center", flexShrink: 0 }}>
                    {l.streak > 0 && (
                      <span className="tai-row tai-gap4" style={{ fontSize: 12, fontWeight: 700, color: "#EA580C" }}>
                        <Flame size={14} /> {l.streak}d
                      </span>
                    )}

                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 900,
                        color: "var(--primary)",
                        background: "var(--surface-2)",
                        padding: "4px 10px",
                        borderRadius: 8,
                        border: "1px solid var(--border)"
                      }}
                    >
                      {l.xp.toLocaleString()} pts
                    </span>

                    {!l.isCurrentUser && (
                      <button
                        className="tai-btn tai-btn-ghost tai-btn-sm"
                        onClick={() => handleCheer(l.id, l.name)}
                        style={{
                          padding: "5px 10px",
                          fontSize: 11.5,
                          borderRadius: 8,
                          color: cheeredIds[l.id] ? "var(--primary)" : "var(--text-3)"
                        }}
                      >
                        {cheeredIds[l.id] ? "👏 Cheered" : "👏 Cheer"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default LeaderboardScreen;
