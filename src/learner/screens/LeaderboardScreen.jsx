import React from "react";
import { TopBar } from "../components/LearnerUI.jsx";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchLeaderboard } from "../../lib/api/learner.js";
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

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <TopBar
        title="Leaderboard"
        sub="All-time ranking based on lesson progress, quizzes, and streak consistency"
        onBack={back}
      />

      <LeaderboardPanel
        rows={activeData}
        loading={activeLoading}
        onRefresh={() => activeQuery.refetch?.()}
        currentUserId={userId}
        userStats={gamificationStatsQuery?.data || {}}
      />
    </div>
  );
}

export default LeaderboardScreen;
