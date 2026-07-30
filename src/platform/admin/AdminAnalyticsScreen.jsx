import React from "react";
import { TopBar, ProgressBar, Tag, exportRowsAsCsv } from "../components/PlatformUI.jsx";
import { Download } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchOrgDashboardStats,
  fetchEnrollmentTrend,
  fetchRetentionStats,
  fetchFeatureAdoption,
} from "../../lib/api/platform.js";

export function AdminAnalyticsScreen({ orgId, orgSelector, setScreen }) {
  const statsQuery = useSupabaseQuery(async () => orgId ? fetchOrgDashboardStats(orgId) : null, [orgId]);
  const trendQuery = useSupabaseQuery(async () => orgId ? fetchEnrollmentTrend(orgId, 6) : [], [orgId]);
  const retentionQuery = useSupabaseQuery(async () => orgId ? fetchRetentionStats(orgId) : null, [orgId]);
  const adoptionQuery = useSupabaseQuery(async () => orgId ? fetchFeatureAdoption(orgId) : null, [orgId]);

  const trend = trendQuery.data || [];
  const maxEnrollments = Math.max(1, ...trend.map(t => t.enrollments));
  const retention = retentionQuery.data;
  const adoption = adoptionQuery.data;

  function handleExport() {
    if (!trend.length) return;
    exportRowsAsCsv("analytics-export.csv", trend.map(t => ({
      month: t.month,
      enrollments: t.enrollments,
      completions: t.completions,
      completionRate: t.enrollments ? Math.round((t.completions / t.enrollments) * 100) : 0,
    })));
  }

  return (
    <div className="ta-fade">
      <TopBar
        title="Analytics Hub" sub="Enrollment growth, retention & feature adoption — computed from live org data"
        orgSelector={orgSelector}
        onNavigate={setScreen}
        right={<button className="ta-btn ta-btn-outline" onClick={handleExport} disabled={!trend.length}><Download size={15} /> Export CSV</button>}
      />
      <div className="ta-content">
        <div className="ta-grid ta-grid-4">
          <div className="ta-card" style={{ background: "var(--surface-3)", textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--primary)" }}>{statsQuery.data?.completionRate || 0}%</div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Overall completion rate</div>
          </div>
          <div className="ta-card" style={{ background: "var(--surface-3)" }}>
            <div className="ta-row ta-between" style={{ fontSize: 12, marginBottom: 6 }}><span>Active learners</span><span style={{ fontWeight: 700 }}>{statsQuery.data?.activeStudents || 0}</span></div>
            <ProgressBar value={statsQuery.data?.completionRate || 0} />
          </div>
          <div className="ta-card" style={{ background: "var(--surface-3)" }}>
            <div className="ta-row ta-between" style={{ fontSize: 12, marginBottom: 6 }}><span>30-day retention</span><span style={{ fontWeight: 700 }}>{retention?.retention30Pct ?? 0}%</span></div>
            <ProgressBar value={retention?.retention30Pct ?? 0} />
            <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 4 }}>{retention?.active30 ?? 0} of {retention?.totalUsers ?? 0} users active in last 30 days</div>
          </div>
          <div className="ta-card" style={{ background: "var(--surface-3)" }}>
            <div className="ta-row ta-between" style={{ fontSize: 12, marginBottom: 6 }}><span>7-day retention</span><span style={{ fontWeight: 700 }}>{retention?.retention7Pct ?? 0}%</span></div>
            <ProgressBar value={retention?.retention7Pct ?? 0} />
            <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 4 }}>{retention?.active7 ?? 0} of {retention?.totalUsers ?? 0} users active in last 7 days</div>
          </div>
        </div>

        <div className="ta-grid ta-grid-2 ta-mt16">
          <div className="ta-card">
            <div className="ta-label">Enrollment & completion trend (last 6 months)</div>
            {trendQuery.loading && <div className="ta-empty">Loading trend...</div>}
            {!trendQuery.loading && !trend.some(t => t.enrollments > 0) && (
              <div className="ta-empty">No enrollments recorded yet for this organization.</div>
            )}
            {!trendQuery.loading && trend.some(t => t.enrollments > 0) && (
              <>
                <div className="ta-row ta-gap6" style={{ alignItems: "flex-end", height: 140, marginTop: 16 }}>
                  {trend.map((t, i) => (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                      <div style={{ position: "relative", width: "100%", height: `${Math.max(3, (t.enrollments / maxEnrollments) * 100)}%`, background: "var(--grad)", borderRadius: "6px 6px 0 0" }}>
                        <div style={{ position: "absolute", bottom: 0, width: "100%", height: `${t.enrollments ? (t.completions / t.enrollments) * 100 : 0}%`, background: "var(--success)", opacity: 0.55, borderRadius: "0 0 6px 6px" }} />
                      </div>
                      <span style={{ fontSize: 10, color: "var(--text-3)" }}>{t.month}</span>
                    </div>
                  ))}
                </div>
                <div className="ta-row ta-gap12 ta-mt12" style={{ fontSize: 11, color: "var(--text-2)" }}>
                  <span className="ta-row ta-gap6"><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--grad)", display: "inline-block" }} /> Enrollments</span>
                  <span className="ta-row ta-gap6"><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--success)", opacity: 0.55, display: "inline-block" }} /> Completed</span>
                </div>
              </>
            )}
          </div>
          <div className="ta-card">
            <div className="ta-label">Feature adoption</div>
            <div className="ta-body" style={{ marginTop: 4, marginBottom: 4 }}>Share of org users with at least one recorded interaction</div>
            {adoptionQuery.loading && <div className="ta-empty">Loading adoption stats...</div>}
            {!adoptionQuery.loading && (!adoption || adoption.totalUsers === 0) && <div className="ta-empty">No users in this organization yet.</div>}
            {!adoptionQuery.loading && adoption && adoption.totalUsers > 0 && (
              <div className="ta-col ta-gap12 ta-mt12">
                <div>
                  <div className="ta-row ta-between" style={{ fontSize: 12.5, marginBottom: 6 }}>
                    <span>Gamification (points/streaks)</span>
                    <span style={{ fontWeight: 700 }}>{adoption.gamificationPct}%</span>
                  </div>
                  <ProgressBar value={adoption.gamificationPct} />
                </div>
                <div>
                  <div className="ta-row ta-between" style={{ fontSize: 12.5, marginBottom: 6 }}>
                    <span>Community posts</span>
                    <span style={{ fontWeight: 700 }}>{adoption.communityPct}%</span>
                  </div>
                  <ProgressBar value={adoption.communityPct} />
                </div>
                <div>
                  <div className="ta-row ta-between" style={{ fontSize: 12.5, marginBottom: 6 }}>
                    <span>Booked a mentor session</span>
                    <span style={{ fontWeight: 700 }}>{adoption.mentorSessionsPct}%</span>
                  </div>
                  <ProgressBar value={adoption.mentorSessionsPct} />
                </div>
                <Tag>{adoption.totalUsers} total users in organization</Tag>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
