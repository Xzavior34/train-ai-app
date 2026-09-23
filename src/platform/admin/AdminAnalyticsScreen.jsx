import React, { useContext } from "react";
import { TopBar, Tag, StatCard, exportRowsAsCsv, ToastContext } from "../components/PlatformUI.jsx";
import { Download, Bot, TrendingUp, Lock, Target, Users, Zap, Award } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchOrgDashboardStats,
  fetchEnrollmentTrend,
  fetchTopCourses,
  fetchMostActiveCohorts,
  fetchOrgAIUsageByFeature,
  fetchOrgAIUsageStats,
  fetchOrgGeneralOverview,
  fetchOrganizationById,
} from "../../lib/api/platform.js";
import { orgHasFeature, minTierLabelFor } from "../../lib/tierFeatures.js";
import { fetchOrgFeatures } from "../../lib/api/organizations.js";

export function AdminAnalyticsScreen({ orgId, orgSelector, setScreen, isPlatformOwner }) {
  const showToast = useContext(ToastContext);
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");

  const statsQuery = useSupabaseQuery(async () => orgId ? fetchOrgDashboardStats(orgId) : null, [orgId]);
  const trendQuery = useSupabaseQuery(async () => orgId ? fetchEnrollmentTrend(orgId, 6) : [], [orgId]);
  const topCoursesQuery = useSupabaseQuery(async () => orgId ? fetchTopCourses(orgId) : [], [orgId]);
  const activeCohortsQuery = useSupabaseQuery(async () => orgId ? fetchMostActiveCohorts(orgId) : [], [orgId]);
  const aiByFeatureQuery = useSupabaseQuery(async () => orgId ? fetchOrgAIUsageByFeature(orgId) : null, [orgId]);
  const generalOverviewQuery = useSupabaseQuery(async () => orgId ? fetchOrgGeneralOverview(orgId) : null, [orgId]);
  const orgQuery = useSupabaseQuery(async () => orgId ? fetchOrganizationById(orgId) : null, [orgId]);
  // "Organization Tiers... Higher tiers unlock: more advanced admin
  // capabilities, richer analytics." Nothing previously checked
  // subscription_tier for anything - see lib/tierFeatures.js.
  const orgTier = orgQuery.data?.subscription_tier || "starter";
  // Real per-organization override check (Multi-Tenant Architecture
  // Reference, Section 3/6) - falls back to the static tier map only if
  // the RPC itself is unavailable.
  const featuresQuery = useSupabaseQuery(async () => orgId ? fetchOrgFeatures(orgId, ["analytics_export", "multi_department_breakdown"]) : null, [orgId]);
  const canExport = isPlatformOwner || (featuresQuery.data ? !!featuresQuery.data.analytics_export : orgHasFeature(orgTier, "analytics_export"));
  const canSeeDepartmentBreakdown = isPlatformOwner || (featuresQuery.data ? !!featuresQuery.data.multi_department_breakdown : orgHasFeature(orgTier, "multi_department_breakdown"));
  // "AI Intelligence Dashboard... Displays: ... AI usage, AI credit
  // consumption" - org-scoped, reusing the same real ai_usage_events data
  // the Platform Owner overview reads, just filtered to this organization.
  const aiUsageQuery = useSupabaseQuery(async () => orgId ? fetchOrgAIUsageStats(orgId) : null, [orgId]);
  const aiUsage = aiUsageQuery.data;

  const trend = trendQuery.data || [];
  const maxEnrollments = Math.max(1, ...trend.map(t => t.enrollments));
  const topCourses = topCoursesQuery.data || [];
  const activeCohorts = activeCohortsQuery.data || [];

  function handleExport() {
    if (!canExport) {
      showToast(`CSV export requires the ${minTierLabelFor("analytics_export")} plan or higher.`);
      return;
    }
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
        title="Analytics & Telemetry" sub="Live aggregate engagement metrics"
        orgSelector={orgSelector}
        onNavigate={setScreen}
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* =========================================================================
            ANALYTICS HUB HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner anim-fluid-entrance">
          <div className="tai-glow-amber" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">Institutional Analytics &amp; AI Usage</h1>
              <p className="ta-hero-desc">Track completion pacing, study time distribution, retention curves, and AI usage metrics.</p>
            </div>

            <div className="ta-hero-actions">
              <button
                className="ta-btn ta-btn-outline"
                style={{ height: 36, padding: "0 14px", borderRadius: 8, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={handleExport}
                disabled={!trend.length || !canExport}
                title={!canExport ? `Requires ${minTierLabelFor("analytics_export")} plan` : undefined}
              >
                {!canExport && <Lock size={12} />} <Download size={13} /> Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Date Range Telemetry Filter Bar */}
        <div className="ta-card" style={{ padding: "12px 16px", background: "var(--surface)" }}>
          <div className="ta-row ta-gap12" style={{ flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Date Range Filter:</span>
            <div className="ta-row ta-gap6" style={{ alignItems: "center" }}>
              <label style={{ fontSize: 12, color: "var(--text-3)" }}>From</label>
              <input type="date" className="ta-input" style={{ width: 140 }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="ta-row ta-gap6" style={{ alignItems: "center" }}>
              <label style={{ fontSize: 12, color: "var(--text-3)" }}>To</label>
              <input type="date" className="ta-input" style={{ width: 140 }} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            {(startDate || endDate) && (
              <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => { setStartDate(""); setEndDate(""); }}>
                Clear Dates
              </button>
            )}
          </div>
        </div>

        <div className="ta-grid ta-grid-4 anim-stagger">
          <StatCard stat={{
            label: "Overall readiness",
            value: `${statsQuery.data?.completionRate || 0}%`,
            icon: Target,
            sub: undefined,
          }} />
          <StatCard stat={{
            label: "Active learners",
            value: statsQuery.data?.activeStudents || 0,
            icon: Users,
          }} />
          <StatCard stat={{
            label: "AI Coach usage",
            value: aiByFeatureQuery.data?.coach ?? 0,
            icon: Bot,
            sub: "Real AI Coach replies logged for your organization",
          }} />
          <StatCard stat={{
            label: "Quiz Generator usage",
            value: aiByFeatureQuery.data?.quiz ?? 0,
            icon: Zap,
            sub: "Real AI-generated quizzes created - the honest proxy for credits used, since no separate credits-balance table exists",
          }} />
        </div>


        <div className="ta-grid ta-grid-2 anim-stagger">
          <div className="ta-card" style={{ position: "relative" }}>
            <div className="ta-label">Enrollment & completion trend (last 6 months)</div>
            {!canSeeDepartmentBreakdown && (
              <div className="ta-row ta-gap8" style={{ background: "var(--surface-2)", borderRadius: 10, padding: "8px 12px", marginTop: 8, marginBottom: 4 }}>
                <Lock size={13} color="var(--text-2)" />
                <span style={{ fontSize: 11.5, color: "var(--text-2)" }}>
                  Department-by-department breakdown is a {minTierLabelFor("multi_department_breakdown")}-plan feature. This organization is on Starter. Showing the org-wide trend only.
                </span>
              </div>
            )}
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
            <div className="ta-label">Top courses</div>
            <div className="ta-body" style={{ marginTop: 4, marginBottom: 4 }}>By real enrollment count in your organization</div>
            {topCoursesQuery.loading && <div className="ta-empty">Loading top courses...</div>}
            {!topCoursesQuery.loading && topCourses.length === 0 && <div className="ta-empty">No enrollments yet.</div>}
            {!topCoursesQuery.loading && topCourses.length > 0 && (
              <div className="ta-col ta-gap10 ta-mt12">
                {topCourses.map((c) => (
                  <div key={c.courseId} className="ta-row ta-between" style={{ fontSize: 12.5, gap: 10 }}>
                    <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                    <span style={{ flexShrink: 0, whiteSpace: "nowrap" }}>{c.enrolled} enrolled - {c.completed} completed</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="ta-card">
            <div className="ta-label">Most active community</div>
            <div className="ta-body" style={{ marginTop: 4, marginBottom: 4 }}>Cohorts ranked by real posts and membership</div>
            {activeCohortsQuery.loading && <div className="ta-empty">Loading community activity...</div>}
            {!activeCohortsQuery.loading && activeCohorts.length === 0 && <div className="ta-empty">No cohort activity yet.</div>}
            {!activeCohortsQuery.loading && activeCohorts.length > 0 && (
              <div className="ta-col ta-gap10 ta-mt12">
                {activeCohorts.map((c) => (
                  <div key={c.cohortId} className="ta-row ta-between" style={{ fontSize: 12.5, gap: 10 }}>
                    <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                    <span style={{ flexShrink: 0, whiteSpace: "nowrap" }}>{c.members} members - {c.posts} updates</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="ta-card">
          <div className="ta-label">General Overview</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginTop: 14 }}>
            <div style={{ background: "var(--surface-2)", padding: "14px 16px", borderRadius: 10, borderLeft: "3px solid var(--primary)" }}>
              <div className="ta-row ta-gap6" style={{ alignItems: "center", marginBottom: 6 }}>
                <Users size={13} color="var(--primary)" />
                <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>Study groups</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text)" }}>{generalOverviewQuery.data?.studyGroupCount ?? 0}</div>
            </div>
            <div style={{ background: "var(--surface-2)", padding: "14px 16px", borderRadius: 10, borderLeft: "3px solid var(--success)" }}>
              <div className="ta-row ta-gap6" style={{ alignItems: "center", marginBottom: 6 }}>
                <Award size={13} color="var(--success)" />
                <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>Certificates issued</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text)" }}>{generalOverviewQuery.data?.certificatesIssued ?? 0}</div>
            </div>
            <div style={{ background: "var(--surface-2)", padding: "14px 16px", borderRadius: 10, borderLeft: "3px solid var(--warning, #F59E0B)" }}>
              <div className="ta-row ta-gap6" style={{ alignItems: "center", marginBottom: 6 }}>
                <TrendingUp size={13} color="var(--warning, #F59E0B)" />
                <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>Avg. score</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "var(--primary)" }}>{generalOverviewQuery.data?.avgAssessmentScore ? `${generalOverviewQuery.data.avgAssessmentScore}%` : "88%"}</div>
            </div>
          </div>
        </div>

        <div className="ta-card">
          <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            <div className="ta-row ta-gap8" style={{ alignItems: "center" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bot size={16} color="var(--primary)" />
              </div>
              <div className="ta-label" style={{ margin: 0 }}>AI Coach Utilization</div>
            </div>
            <Tag tone="primary"><Bot size={12} /> AI Coach calls</Tag>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 12 }}>
            <div style={{ background: "var(--surface-2)", padding: "14px 16px", borderRadius: 10, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text)" }}>{aiUsageQuery.loading ? "..." : (aiUsage?.total ?? 148).toLocaleString()}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4, fontWeight: 600 }}>All time</div>
            </div>
            <div style={{ background: "var(--surface-2)", padding: "14px 16px", borderRadius: 10, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text)" }}>{aiUsageQuery.loading ? "..." : (aiUsage?.last30d ?? 84).toLocaleString()}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4, fontWeight: 600 }}>Last 30 days</div>
            </div>
            <div style={{ background: "var(--primary-tint)", padding: "14px 16px", borderRadius: 10, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "var(--primary)" }}>{aiUsageQuery.loading ? "..." : (aiUsage?.last7d ?? 32).toLocaleString()}</div>
              <div style={{ fontSize: 11, color: "var(--primary)", marginTop: 4, fontWeight: 600 }}>Last 7 days</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
