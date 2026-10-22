import React, { useState, useCallback, useEffect, useRef } from "react";
import { TopBar } from "../components/LearnerUI.jsx";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchLeaderboard, fetchLeaderboardForPeriod } from "../../lib/api/learner.js";
import { LeaderboardPanel } from "../components/LeaderboardPanel.jsx";

export function LeaderboardScreen({ back, user = {}, leaderboardQuery, session, gamificationStatsQuery }) {
  const userId = session?.user?.id || null;

  const defaultLeaderboardQuery = useSupabaseQuery(async () => {
    if (leaderboardQuery) return null;
    return fetchLeaderboard(100);
  }, [leaderboardQuery]);

  const activeQuery = leaderboardQuery || defaultLeaderboardQuery;
  const activeData = activeQuery.data || [];
  const activeLoading = activeQuery.loading;

  const [period, setPeriod] = useState("all");
  const [periodRows, setPeriodRows] = useState([]);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [periodError, setPeriodError] = useState(null);
  const requestId = useRef(0);

  const loadPeriodLeaderboard = useCallback((periodKey) => {
    if (periodKey === "all") return;
    const id = ++requestId.current;
    setPeriodLoading(true);
    setPeriodError(null);
    const now = new Date();
    const start = new Date(now);
    if (periodKey === "week") start.setDate(now.getDate() - 7);
    else start.setDate(now.getDate() - 30);
    return fetchLeaderboardForPeriod(start.toISOString(), now.toISOString())
      .then((rows) => { if (id === requestId.current) setPeriodRows(rows); })
      .catch(() => { if (id === requestId.current) { setPeriodRows([]); setPeriodError("Could not load rankings. Please retry."); } })
      .finally(() => { if (id === requestId.current) setPeriodLoading(false); });
  }, []);

  useEffect(() => {
    if (period !== "all") loadPeriodLeaderboard(period);
    return () => { requestId.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <TopBar
        title="Leaderboard"
        sub="Ranking based on lesson progress, quizzes, and streak consistency"
        onBack={back}
      />

      {(period === "all" ? activeQuery.error : periodError) && (
        <div role="alert" className="tai-card" style={{ padding: 16 }}>
          {period === "all" ? "Could not load rankings. Please retry." : periodError}
          <button type="button" onClick={() => period === "all" ? activeQuery.refetch?.() : loadPeriodLeaderboard(period)}>Retry</button>
        </div>
      )}
      <LeaderboardPanel
        rows={period === "all" ? activeData : periodRows}
        loading={period === "all" ? activeLoading : periodLoading}
        onRefresh={() => period === "all" ? activeQuery.refetch?.() : loadPeriodLeaderboard(period)}
        currentUserId={userId}
        userStats={gamificationStatsQuery?.data || {}}
        period={period}
        onPeriodChange={setPeriod}
      />
    </div>
  );
}

export default LeaderboardScreen;
