import React, { useState, useCallback, useEffect } from "react";
import { TopBar } from "../components/LearnerUI.jsx";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchLeaderboard, fetchLeaderboardForPeriod } from "../../lib/api/learner.js";
import { LeaderboardPanel } from "../components/LeaderboardPanel.jsx";

import { Trophy, ShieldAlert } from "lucide-react";

export function LeaderboardScreen({ back, user = {}, orgId: propOrgId, leaderboardQuery, session, gamificationStatsQuery, leaderboardEnabled = true }) {
  const userId = session?.user?.id || null;
  const orgId = propOrgId || user?.organization_id || null;

  const defaultLeaderboardQuery = useSupabaseQuery(async () => {
    if (leaderboardQuery || !leaderboardEnabled) return null;
    return fetchLeaderboard(100, orgId);
  }, [leaderboardQuery, leaderboardEnabled, orgId]);

  const activeQuery = leaderboardQuery || defaultLeaderboardQuery;
  const activeData = leaderboardQuery?.data || activeQuery.data || [];
  const activeLoading = activeQuery.loading;

  const [period, setPeriod] = useState("all");
  const [periodRows, setPeriodRows] = useState([]);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const loadPeriodLeaderboard = useCallback((periodKey) => {
    if (periodKey === "all" || periodKey === "custom" || !leaderboardEnabled) return;
    setPeriodLoading(true);
    const now = new Date();
    const start = new Date(now);
    if (periodKey === "week") start.setDate(now.getDate() - 7);
    else start.setDate(now.getDate() - 30);
    return fetchLeaderboardForPeriod(start.toISOString(), now.toISOString(), 50, orgId)
      .then((rows) => setPeriodRows(rows || []))
      .finally(() => setPeriodLoading(false));
  }, [leaderboardEnabled, orgId]);

  // Custom calendar-style range: only queries once the learner has picked
  // both a real start and end date - no default/mock range is assumed.
  const loadCustomRangeLeaderboard = useCallback((start, end) => {
    if (!start || !end || !leaderboardEnabled) return;
    setPeriodLoading(true);
    const startISO = new Date(`${start}T00:00:00`).toISOString();
    const endISO = new Date(`${end}T23:59:59`).toISOString();
    return fetchLeaderboardForPeriod(startISO, endISO, 50, orgId)
      .then((rows) => setPeriodRows(rows || []))
      .finally(() => setPeriodLoading(false));
  }, [leaderboardEnabled, orgId]);

  useEffect(() => {
    if (period === "all" || period === "custom" || !leaderboardEnabled) return;
    loadPeriodLeaderboard(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, leaderboardEnabled]);

  useEffect(() => {
    if (period !== "custom") return;
    loadCustomRangeLeaderboard(customStart, customEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customStart, customEnd]);

  if (!leaderboardEnabled) {
    return (
      <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <TopBar
          title="Leaderboard"
          sub="Rankings and competitive points"
          onBack={back}
        />
        <div className="tai-card" style={{ padding: 32, textAlign: "center", background: "var(--surface)", borderRadius: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Trophy size={24} color="var(--text-3)" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Leaderboard Disabled</div>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 6, maxWidth: 420, margin: "6px auto 0", lineHeight: 1.5 }}>
            Rankings and leaderboards are currently disabled by your organization administrator.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <TopBar
        title="Leaderboard"
        sub="Ranking based on lesson progress, quizzes, and streak consistency"
        onBack={back}
      />

      <LeaderboardPanel
        rows={period === "all" ? activeData : periodRows}
        loading={period === "all" ? activeLoading : periodLoading}
        onRefresh={() => {
          if (period === "all") return activeQuery.refetch?.();
          if (period === "custom") return loadCustomRangeLeaderboard(customStart, customEnd);
          return loadPeriodLeaderboard(period);
        }}
        currentUserId={userId}
        userStats={gamificationStatsQuery?.data || {}}
        period={period}
        onPeriodChange={setPeriod}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
      />
    </div>
  );
}

export default LeaderboardScreen;
