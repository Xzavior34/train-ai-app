import React, { useState, useMemo } from "react";
import { TopBar, Tag, Avatar, ProgressBar } from "../components/LearnerUI.jsx";
import {
  Trophy, Medal, Crown, Flame, Award, ArrowUp, ArrowDown, Minus, ArrowLeft,
  Search, Filter, Users, TrendingUp, ChevronRight, CheckCircle2
} from "lucide-react";
import { isMockDataEnabled } from "../../lib/mockDataManager.js";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchLeaderboardForPeriod, fetchMyCohortLeaderboard } from "../../lib/api/learner.js";

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

export function LeaderboardScreen({ back, user = {}, leaderboardQuery, session, push }) {
  const [timeframe, setTimeframe] = useState("all"); // "all" | "month" | "week" | "cohort" | "custom"
  const [searchQuery, setSearchQuery] = useState("");
  const [rangeStart, setRangeStart] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [rangeEnd, setRangeEnd] = useState(() => new Date().toISOString().slice(0, 10));

  const userId = session?.user?.id || null;

  // "This Week"/"This Month" resolve to a real [start, end) window computed
  // client-side; "Custom" uses the two date pickers below. "All Time" and
  // "My Cohort" don't need a window at all - they hit different queries.
  const periodWindow = useMemo(() => {
    const now = new Date();
    if (timeframe === "week") {
      const start = new Date(now); start.setDate(start.getDate() - 7);
      return { start: start.toISOString(), end: now.toISOString() };
    }
    if (timeframe === "month") {
      const start = new Date(now); start.setMonth(start.getMonth() - 1);
      return { start: start.toISOString(), end: now.toISOString() };
    }
    if (timeframe === "custom" && rangeStart && rangeEnd) {
      return { start: new Date(rangeStart).toISOString(), end: new Date(new Date(rangeEnd).getTime() + 86400000).toISOString() };
    }
    return null;
  }, [timeframe, rangeStart, rangeEnd]);

  const periodQuery = useSupabaseQuery(async () => {
    if (!periodWindow) return null;
    return fetchLeaderboardForPeriod(periodWindow.start, periodWindow.end, 50);
  }, [periodWindow?.start, periodWindow?.end]);

  const cohortQuery = useSupabaseQuery(async () => {
    if (timeframe !== "cohort" || !userId) return null;
    return fetchMyCohortLeaderboard(userId, 50);
  }, [timeframe, userId]);

  // Real source for the current tab. "All Time" reuses the shared
  // all-time top-50 query every other screen already draws from
  // (lib/hooks/useLearnerData.js); the other tabs hit their own query above.
  const activeData = timeframe === "week" || timeframe === "month" || timeframe === "custom"
    ? periodQuery.data
    : timeframe === "cohort"
      ? cohortQuery.data
      : leaderboardQuery?.data;
  const activeLoading = timeframe === "week" || timeframe === "month" || timeframe === "custom"
    ? periodQuery.loading
    : timeframe === "cohort"
      ? cohortQuery.loading
      : leaderboardQuery?.loading;

  const rawLearners = (activeData || []).map((l, i) => ({
    id: l.user_id || `l-${i}`,
    rank: i + 1,
    name: l.display_name || l.name || "Learner",
    role: l.role || "Specialist",
    cohort: l.cohort_name || "Active Batch",
    avatar: resolveAvatar(l, i),
    xp: l.total_points || l.period_points || l.points || l.xp || 0,
    streak: l.streak || l.streak_days || 0,
    completedCourses: l.completed_courses || l.completedCourses || 0,
    badgesCount: l.badges_count || l.badgesCount || Math.max(0, Math.floor((l.total_points || l.period_points || 0) / 400)),
    isCurrentUser: l.user_id === userId || l.you || false
  }));

  const learners = rawLearners.map((l, i) => ({
    ...l,
    avatar: l.avatar || resolveAvatar(l, i)
  }));

  const filteredLearners = learners.filter(l =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const myEntry = learners.find(l => l.isCurrentUser) || null;

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          className="tai-btn tai-btn-outline tai-btn-sm"
          onClick={() => (back ? back() : push ? push("community") : null)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 8, fontWeight: 700 }}
        >
          <ArrowLeft size={15} /> ← Back to Community
        </button>
      </div>

      <TopBar
        title="Weekly Leaderboard & League"
        sub="Compete with learners across your cohort & track XP standing"
        onBack={back}
      />

      {/* =========================================================================
          CONTROLS: Timeframe Tabs & Search Filter
          ========================================================================= */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div className="tai-row tai-gap8" style={{ overflowX: "auto", paddingBottom: 2 }}>
          {[
            { k: "all", label: "All Time" },
            { k: "week", label: "This Week" },
            { k: "month", label: "This Month" },
            { k: "cohort", label: "My Cohort" },
            { k: "custom", label: "Custom Range" },
          ].map(tf => (
            <button
              key={tf.k}
              className="tai-btn"
              onClick={() => setTimeframe(tf.k)}
              style={{
                background: timeframe === tf.k ? "#2563EB" : "var(--surface)",
                color: timeframe === tf.k ? "#FFFFFF" : "var(--text-2)",
                border: "1px solid var(--border)",
                padding: "7px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700,
                cursor: "pointer"
              }}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", minWidth: 200, flex: 1, maxWidth: 340 }}>
          <Search size={14} color="var(--text-3)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            className="tai-input"
            placeholder="Search learners..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 32, padding: "8px 12px 8px 32px", fontSize: 12.5 }}
          />
        </div>
      </div>

      {timeframe === "custom" && (
        <div className="tai-card" style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)" }}>From</label>
            <input type="date" className="tai-input" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} style={{ padding: "6px 10px", fontSize: 12.5 }} />
          </div>
          <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)" }}>To</label>
            <input type="date" className="tai-input" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} style={{ padding: "6px 10px", fontSize: 12.5 }} />
          </div>
          <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>Ranked by lessons completed, quizzes taken, and daily rewards claimed within this range.</span>
        </div>
      )}

      {activeLoading && (
        <div className="tai-card" style={{ padding: 24, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
          Loading standings...
        </div>
      )}
      {!activeLoading && learners.length === 0 && (
        <div className="tai-card" style={{ padding: 24, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
          {timeframe === "cohort"
            ? "You're not in a cohort yet, so there's no cohort leaderboard to show."
            : "No activity recorded in this range yet. Complete a lesson or quiz to appear here."}
        </div>
      )}
      {!activeLoading && learners.length > 0 && (
      <>

      {/* =========================================================================
          TOP 3 PODIUM HERO SECTION (Adaptive Liquid Glass)
          ========================================================================= */}
      <div
        className="tai-card tai-hero-card anim-fluid-entrance"
        style={{
          borderRadius: 14,
          padding: "clamp(20px, 3vw, 28px)",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -40,
            left: "50%",
            transform: "translateX(-50%)",
            width: 260,
            height: 160,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(245, 158, 11, 0.22) 0%, transparent 70%)",
            pointerEvents: "none"
          }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <h2 className="tai-hero-title" style={{ fontSize: "clamp(20px, 2.8vw, 26px)", fontWeight: 900, margin: "0 0 4px", letterSpacing: "-0.02em" }}>
              Hall of Fame &amp; Top Performers
            </h2>
            <p className="tai-hero-desc" style={{ fontSize: 13, margin: 0 }}>
              Top 3 learners earn bonus mystery boxes and exclusive certification badges.
            </p>
          </div>

          {/* 3-Column Podium Display */}
          <div style={{
            display: "flex", justifyContent: "center", alignItems: "flex-end",
            gap: "clamp(10px, 2.5vw, 24px)", paddingBottom: 10, flexWrap: "wrap"
          }}>
            {/* 2nd Place (Silver) */}
            {learners[1] && (
              <div className="tai-hero-subcard" style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                flex: "1 1 110px", maxWidth: 140, textAlign: "center", order: 1,
                padding: "14px 10px", borderRadius: 12
              }}>
                <div style={{ position: "relative", marginBottom: 6 }}>
                  <Avatar
                    size={52}
                    src={learners[1].avatar}
                    initials={learners[1].name?.[0] || "L"}
                    style={{
                      borderRadius: "50%",
                      border: "3px solid #94A3B8",
                      boxShadow: "0 4px 12px rgba(148, 163, 184, 0.4)"
                    }}
                  />
                  <span style={{
                    position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)",
                    background: "#94A3B8", color: "#FFFFFF", fontWeight: 900, fontSize: 11,
                    width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    2
                  </span>
                </div>
                <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text)", marginTop: 4 }}>{learners[1].name}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>{learners[1].role}</div>
                <div style={{
                  background: "rgba(148, 163, 184, 0.2)", color: "#FFFFFF",
                  fontWeight: 800, fontSize: 11.5, padding: "2px 8px", borderRadius: 99,
                  marginTop: 6, border: "1px solid rgba(148, 163, 184, 0.4)"
                }}>
                  {learners[1].xp.toLocaleString()} XP
                </div>
              </div>
            )}

            {/* 1st Place (Gold - Elevated) */}
            {learners[0] && (
              <div className="tai-hero-subcard" style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                flex: "1 1 130px", maxWidth: 160, textAlign: "center", order: 2,
                transform: "translateY(-8px)",
                padding: "16px 12px", borderRadius: 14,
                border: "2px solid rgba(245, 158, 11, 0.5)",
                boxShadow: "0 8px 24px -4px rgba(245, 158, 11, 0.35)"
              }}>
                <div style={{ position: "relative", marginBottom: 6 }}>
                  <Crown size={22} color="#F59E0B" style={{ position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)", filter: "drop-shadow(0 0 6px rgba(245, 158, 11, 0.6))" }} />
                  <Avatar
                    size={66}
                    src={learners[0].avatar}
                    initials={learners[0].name?.[0] || "L"}
                    style={{
                      borderRadius: "50%",
                      border: "3.5px solid #F59E0B",
                      boxShadow: "0 0 20px rgba(245, 158, 11, 0.4)"
                    }}
                  />
                  <span style={{
                    position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)",
                    background: "#F59E0B", color: "#FFFFFF", fontWeight: 900, fontSize: 12,
                    width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    1
                  </span>
                </div>
                <div style={{ fontWeight: 900, fontSize: 14.5, color: "var(--text)", marginTop: 4 }}>{learners[0].name}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>{learners[0].role}</div>
                <div style={{
                  background: "rgba(245, 158, 11, 0.25)", color: "#FBBF24",
                  fontWeight: 900, fontSize: 12, padding: "3px 10px", borderRadius: 99,
                  marginTop: 6, border: "1px solid rgba(245, 158, 11, 0.5)"
                }}>
                  {learners[0].xp.toLocaleString()} XP
                </div>
              </div>
            )}

            {/* 3rd Place (Bronze) */}
            {learners[2] && (
              <div className="tai-hero-subcard" style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                flex: "1 1 110px", maxWidth: 140, textAlign: "center", order: 3,
                padding: "14px 10px", borderRadius: 12
              }}>
                <div style={{ position: "relative", marginBottom: 6 }}>
                  <Avatar
                    size={52}
                    src={learners[2].avatar}
                    initials={learners[2].name?.[0] || "L"}
                    style={{
                      borderRadius: "50%",
                      border: "3px solid #D97706",
                      boxShadow: "0 4px 12px rgba(217, 119, 6, 0.3)"
                    }}
                  />
                  <span style={{
                    position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)",
                    background: "#D97706", color: "#FFFFFF", fontWeight: 900, fontSize: 11,
                    width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    3
                  </span>
                </div>
                <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text)", marginTop: 4 }}>{learners[2].name}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>{learners[2].role}</div>
                <div style={{
                  background: "rgba(217, 119, 6, 0.2)", color: "#FBBF24",
                  fontWeight: 800, fontSize: 11.5, padding: "2px 8px", borderRadius: 99,
                  marginTop: 6, border: "1px solid rgba(217, 119, 6, 0.4)"
                }}>
                  {learners[2].xp.toLocaleString()} XP
                </div>
              </div>
            )}
          </div>
        </div>
      </div>


      {/* =========================================================================
          STICKY CURRENT USER RANK BAR
          ========================================================================= */}
      {myEntry && (
      <div className="tai-card" style={{
        background: "rgba(37, 99, 235, 0.05)",
        border: "1px solid rgba(37, 99, 235, 0.2)",
        padding: "10px 14px", borderRadius: 8
      }}>
        <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 10 }}>
          <div className="tai-row tai-gap10">
            <span style={{
              width: 30, height: 30, borderRadius: 8, background: "#2563EB", color: "#FFFFFF",
              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12
            }}>
              #{myEntry.rank}
            </span>
            <Avatar size={32} src={myEntry.avatar} initials={myEntry.name?.[0] || "L"} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)" }}>{myEntry.name} (You)</div>
              <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                {learners.length > 1 ? `Rank ${myEntry.rank} of ${learners.length} in this view` : "Only learner in this view"}
              </div>
            </div>
          </div>

          <div className="tai-row tai-gap12">
            <span className="tai-row tai-gap4" style={{ fontSize: 12, fontWeight: 700, color: "#EA580C" }}>
              <Flame size={14} /> {myEntry.streak}d
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 900, color: "var(--primary)" }}>
              {myEntry.xp.toLocaleString()} XP
            </span>
          </div>
        </div>
      </div>
      )}

      {/* =========================================================================
          FULL RANKINGS TABLE
          ========================================================================= */}
      <div className="tai-card" style={{ padding: 0, overflow: "hidden", borderRadius: 10 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)", color: "var(--text-3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                <th style={{ padding: "10px 14px", width: 50 }}>Rank</th>
                <th style={{ padding: "10px 14px" }}>Learner</th>
                <th style={{ padding: "10px 14px" }}>Batch</th>
                <th style={{ padding: "10px 14px" }}>Streak</th>
                <th style={{ padding: "10px 14px" }}>Badges</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>Total XP</th>
              </tr>
            </thead>
            <tbody>
              {filteredLearners.map((l, idx) => {
                const isTop3 = l.rank <= 3;
                const rankColor = l.rank === 1 ? "#F59E0B" : l.rank === 2 ? "#94A3B8" : l.rank === 3 ? "#D97706" : "var(--text-2)";
                return (
                  <tr
                    key={l.id || idx}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: l.isCurrentUser ? "rgba(37, 99, 235, 0.05)" : "transparent",
                      transition: "background .15s ease"
                    }}
                  >
                    <td style={{ padding: "10px 14px", fontWeight: 900, color: rankColor, fontSize: isTop3 ? 14 : 12.5 }}>
                      {l.rank === 1 ? "🥇 1" : l.rank === 2 ? "🥈 2" : l.rank === 3 ? "🥉 3" : `#${l.rank}`}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div className="tai-row tai-gap8">
                        <Avatar
                          size={32}
                          src={l.avatar || resolveAvatar(l, idx)}
                          initials={l.name?.[0] || "L"}
                          style={{ borderRadius: "50%", flexShrink: 0 }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 13 }}>
                            {l.name} {l.isCurrentUser && <span style={{ color: "var(--primary)", fontSize: 11 }}>(You)</span>}
                          </div>
                          <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>{l.role}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text-2)", fontSize: 11.5 }}>
                      {l.cohort}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span className="tai-row tai-gap4" style={{ fontWeight: 700, color: "#EA580C", fontSize: 11.5 }}>
                        <Flame size={13} /> {l.streak}d
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span className="tai-row tai-gap4" style={{ fontWeight: 700, color: "#3B82F6", fontSize: 11.5 }}>
                        <Award size={13} /> {l.badgesCount}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: "var(--primary)", fontSize: 13 }}>
                      {l.xp.toLocaleString()} XP
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
