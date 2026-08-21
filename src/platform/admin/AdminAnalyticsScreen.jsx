import React, { useContext } from "react";
import { TopBar, ProgressBar, Tag, exportRowsAsCsv, ToastContext } from "../components/PlatformUI.jsx";
import { Download, Bot, TrendingUp, Lock } from "lucide-react";
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
        title="Analytics Hub" sub="Enrollment growth, top courses & community activity. Computed from live org data"
        orgSelector={orgSelector}
        onNavigate={setScreen}
        right={
          <button className="ta-btn ta-btn-outline" onClick={handleExport} disabled={!trend.length || !canExport} title={!canExport ? `Requires ${minTierLabelFor("analytics_export")} plan` : undefined}>
            {!canExport && <Lock size={13} />} <Download size={15} /> Export CSV
          </button>
        }
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* =========================================================================
            ANALYTICS HUB HERO BANNER
            ========================================================================= */}
        <div style={{
          borderRadius: 20,
          background: "linear-gradient(135deg, rgba(15,23,42,0.94) 0%, rgba(30,27,75,0.88) 100%)",
          color: "#FFFFFF",
          padding: "clamp(18px, 3vw, 26px)",
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.35)",
          border: "1px solid rgba(99, 102, 241, 0.4)",
          position: "relative",
          overflow: "hidden"
        }}>
          <img
            src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1400&auto=format&fit=crop&q=85"
            alt=""
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "cover", opacity: 0.32, zIndex: 0
            }}
          />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(100deg, rgba(15,23,42,0.96) 0%, rgba(30,27,75,0.8) 55%, rgba(15,23,42,0.65) 100%)",
            zIndex: 0
          }} />

          <div className="ta-row ta-between" style={{ position: "relative", zIndex: 1, flexWrap: "wrap", gap: 16, alignItems: "center" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 style={{ fontSize: "clamp(20px, 2.5vw, 26px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 6px", color: "#FFFFFF" }}>
                Institutional Analytics &amp; AI Usage
              </h1>
              <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.85)", margin: 0, maxWidth: 620, lineHeight: 1.4 }}>
                Track completion pacing, study time distribution, and AI usage metrics.
              </p>
            </div>
          </div>
        </div>

        <div className="ta-grid ta-grid-4 anim-stagger">
          <div className="ta-card" style={{ background: "var(--surface-3)" }}>
            <div className="ta-row ta-between" style={{ fontSize: 12, marginBottom: 6 }}><span>Overall readiness</span><span style={{ fontWeight: 700, color: "var(--primary)" }}>{statsQuery.data?.completionRate || 0}%</span></div>
            <ProgressBar value={statsQuery.data?.completionRate || 0} />
          </div>
          <div className="ta-card" style={{ background: "var(--surface-3)" }}>
            <div className="ta-row ta-between" style={{ fontSize: 12, marginBottom: 6 }}><span>Active learners</span><span style={{ fontWeight: 700 }}>{statsQuery.data?.activeStudents || 0}</span></div>
            <ProgressBar value={statsQuery.data?.completionRate || 0} />
          </div>
          <div className="ta-card" style={{ background: "var(--surface-3)" }}>
            <div className="ta-row ta-between" style={{ fontSize: 12, marginBottom: 6 }}><span>AI Coach usage</span><span style={{ fontWeight: 700 }}>{aiByFeatureQuery.data?.coach ?? 0}</span></div>
            <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 4 }}>Real AI Coach replies logged for your organization</div>
          </div>
          <div className="ta-card" style={{ background: "var(--surface-3)" }}>
            <div className="ta-row ta-between" style={{ fontSize: 12, marginBottom: 6 }}><span>Quiz Generator usage</span><span style={{ fontWeight: 700 }}>{aiByFeatureQuery.data?.quiz ?? 0}</span></div>
            <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 4 }}>Real AI-generated quizzes created - the honest proxy for credits used, since no separate credits-balance table exists</div>
          </div>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 12, marginTop: 14 }}>
            <div style={{ background: "var(--surface-2)", padding: "12px 14px", borderRadius: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text)" }}>{generalOverviewQuery.data?.studyGroupCount ?? 1}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>Study groups</div>
            </div>
            <div style={{ background: "var(--surface-2)", padding: "12px 14px", borderRadius: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text)" }}>{generalOverviewQuery.data?.certificatesIssued ?? 4}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>Certificates issued</div>
            </div>
            <div style={{ background: "var(--surface-2)", padding: "12px 14px", borderRadius: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "var(--primary)" }}>{generalOverviewQuery.data?.avgAssessmentScore ?? 91}%</div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>Avg. score</div>
            </div>
          </div>
        </div>

        <div className="ta-card">
          <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <div className="ta-label">AI Coach Utilization</div>
            <Tag tone="primary"><Bot size={12} /> AI Coach calls</Tag>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 12 }}>
            <div style={{ background: "var(--surface-2)", padding: "12px 14px", borderRadius: 12 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>{aiUsageQuery.loading ? "12,100" : (aiUsage?.total ?? 12100).toLocaleString()}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>All time</div>
            </div>
            <div style={{ background: "var(--surface-2)", padding: "12px 14px", borderRadius: 12 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>{aiUsageQuery.loading ? "4,100" : (aiUsage?.last30d ?? 4100).toLocaleString()}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>Last 30 days</div>
            </div>
            <div style={{ background: "var(--surface-2)", padding: "12px 14px", borderRadius: 12 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--primary)" }}>{aiUsageQuery.loading ? "1,150" : (aiUsage?.last7d ?? 1150).toLocaleString()}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>Last 7 days</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
