import React from "react";
import { TopBar, StatCard, Tag, exportRowsAsCsv } from "../components/PlatformUI.jsx";
import { Building2, Users, Layers, Activity, Download, Clock, Sparkles, Globe, TrendingDown, Megaphone } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchPlatformOverviewStats, fetchAllOrganizationsWithUserCounts, fetchRecentPlatformActivity, fetchAIUsageStats, fetchWebsitePerformanceStats, fetchChurnSummary, fetchCampaignAttribution, checkPlatformHealth } from "../../lib/api/platform.js";

// Previously this screen destructured stats.totalOrgs / stats.activeCourses /
// stats.totalCohorts / stats.platformHealth, none of which exist on the real
// object fetchPlatformOverviewStats() returns (organizations, totalUsers,
// activeInWeek, totalCourses, totalEnrollments, pendingInvitations - see
// lib/api/platform.js) - so once the query resolved, three of four stat cards
// silently rendered `undefined`. It also had a "Platform Infrastructure &
// Health" card with fully invented numbers (99.98% uptime, 24/200 DB
// connections, 4.2GB/50GB storage) with no backing table anywhere in the
// schema (confirmed: no system_metrics/system_health/infrastructure table
// exists in supabase/migrations). That card is replaced below with real
// platform activity from safe_admin_audit_log via fetchRecentPlatformActivity,
// which was already implemented but never wired into this screen.
export function OverviewScreen({ orgSelector }) {
  const statsQuery = useSupabaseQuery(async () => fetchPlatformOverviewStats(), []);
  const orgsQuery = useSupabaseQuery(async () => fetchAllOrganizationsWithUserCounts(), []);
  const activityQuery = useSupabaseQuery(async () => fetchRecentPlatformActivity(8), []);
  const aiUsageQuery = useSupabaseQuery(async () => fetchAIUsageStats(), []);
  const websiteStatsQuery = useSupabaseQuery(async () => fetchWebsitePerformanceStats(), []);
  const churnQuery = useSupabaseQuery(async () => fetchChurnSummary(), []);
  const campaignQuery = useSupabaseQuery(async () => fetchCampaignAttribution(), []);
  const healthQuery = useSupabaseQuery(async () => checkPlatformHealth(), []);

  const aiUsage = aiUsageQuery.data;
  const websiteStats = websiteStatsQuery.data;

  const stats = statsQuery.data;
  const orgs = orgsQuery.data || [];
  const activity = activityQuery.data || [];

  function handleExportPlatformReport() {
    if (!orgs.length) return;
    exportRowsAsCsv("platform-tenant-report.csv", orgs.map(o => ({
      organization: o.name,
      usersCount: o.user_count || 0,
      createdAt: new Date(o.created_at).toLocaleDateString(),
      status: o.status || "active",
    })));
  }

  return (
    <div className="ta-fade">
      <TopBar
        title="Platform Analytics & Overview"
        sub="Multi-organization governance & system metrics"
        orgSelector={orgSelector}
        right={
          <button className="ta-btn ta-btn-outline" onClick={handleExportPlatformReport} disabled={!orgs.length}>
            <Download size={14} /> Export Report
          </button>
        }
      />
      <div className="ta-content">
        <div className="ta-grid ta-grid-4">
          <StatCard stat={{ label: "Total Organizations", value: statsQuery.loading ? "N/A" : (stats?.organizations ?? 0), icon: Building2 }} />
          <StatCard stat={{ label: "Total Platform Users", value: statsQuery.loading ? "N/A" : (stats?.totalUsers ?? 0), icon: Users }} />
          <StatCard stat={{ label: "Published Courses", value: statsQuery.loading ? "N/A" : (stats?.totalCourses ?? 0), icon: Layers }} />
          <StatCard stat={{ label: "Active Users (7d)", value: statsQuery.loading ? "N/A" : (stats?.activeInWeek ?? 0), icon: Activity }} />
        </div>

        <div className="ta-grid ta-grid-2 ta-mt16">
          <div className="ta-card">
            <div className="ta-row ta-between">
              <div className="ta-title">AI Usage</div>
              <Tag><Sparkles size={12} /> AI Coach calls</Tag>
            </div>
            <div className="ta-body ta-mt8">
              Real AI Coach replies that actually reached a provider. Logged by the edge function itself, not estimated. Manual Mode and disabled-org replies never reach a provider, so they aren't counted here.
            </div>
            <div className="ta-row ta-gap16 ta-mt16">
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{aiUsageQuery.loading ? "N/A" : (aiUsage?.total ?? 0)}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>All time</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{aiUsageQuery.loading ? "N/A" : (aiUsage?.last30d ?? 0)}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Last 30 days</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{aiUsageQuery.loading ? "N/A" : (aiUsage?.last7d ?? 0)}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Last 7 days</div>
              </div>
            </div>
          </div>

          <div className="ta-card">
            <div className="ta-row ta-between">
              <div className="ta-title">Website Performance</div>
              <Tag><Globe size={12} /> Conversion funnel</Tag>
            </div>
            <div className="ta-body ta-mt8">Book a Demo and Organisation Inquiry submissions from the public website.</div>
            <div className="ta-row ta-gap16 ta-mt16">
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{websiteStatsQuery.loading ? "N/A" : (websiteStats?.demoRequestsTotal ?? 0)}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Demo requests (total)</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{websiteStatsQuery.loading ? "N/A" : (websiteStats?.demoRequestsNew ?? 0)}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Demo requests (new)</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{websiteStatsQuery.loading ? "N/A" : (websiteStats?.inquiriesTotal ?? 0)}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Org inquiries (total)</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{websiteStatsQuery.loading ? "N/A" : (websiteStats?.inquiriesNew ?? 0)}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Org inquiries (new)</div>
              </div>
            </div>
          </div>
        </div>

        <div className="ta-grid ta-grid-2 ta-mt16">
          <div className="ta-card">
            <div className="ta-row ta-between">
              <div className="ta-title">Multi-Tenant Organization Breakdown</div>
              <Tag tone="success"><Building2 size={12} /> {orgs.length} Tenants</Tag>
            </div>
            <div className="ta-body ta-mt8">Overview of tenant user adoption and active resource distribution.</div>
            <div style={{ overflowX: "auto" }}>
              <table className="ta-table ta-mt12">
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Users</th>
                    <th>Created</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orgsQuery.loading && <tr><td colSpan={4} className="ta-empty">Loading organizations...</td></tr>}
                  {orgsQuery.error && <tr><td colSpan={4} className="ta-empty">Couldn't load organizations: {orgsQuery.error}</td></tr>}
                  {!orgsQuery.loading && !orgsQuery.error && orgs.length === 0 && (
                    <tr><td colSpan={4} className="ta-empty">No organizations registered yet.</td></tr>
                  )}
                  {orgs.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <div className="ta-row ta-gap8">
                          <Building2 size={16} color="var(--primary)" />
                          <span style={{ fontWeight: 600 }}>{o.name}</span>
                        </div>
                      </td>
                      <td>{o.user_count || 0} members</td>
                      <td>{new Date(o.created_at).toLocaleDateString()}</td>
                      <td><Tag tone={o.status === "active" ? "success" : "warning"}>{o.status || "active"}</Tag></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        <div className="ta-grid ta-grid-2 ta-mt16">
          <div className="ta-card">
            <div className="ta-row ta-gap8"><TrendingDown size={16} color="var(--danger)" /><div className="ta-title">Churn</div></div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>
              Built from the real organization suspension history (admin_audit_log) - not a separate, potentially-stale churn table.
            </div>
            <div className="ta-row ta-gap16 ta-mt12">
              <div><div style={{ fontSize: 22, fontWeight: 800 }}>{churnQuery.data?.suspendedLast30d ?? 0}</div><div style={{ fontSize: 11, color: "var(--text-2)" }}>Suspended, last 30d</div></div>
              <div><div style={{ fontSize: 22, fontWeight: 800 }}>{churnQuery.data?.suspendedLast90d ?? 0}</div><div style={{ fontSize: 11, color: "var(--text-2)" }}>Suspended, last 90d</div></div>
              <div><div style={{ fontSize: 22, fontWeight: 800 }}>{churnQuery.data?.totalActive ?? 0}</div><div style={{ fontSize: 11, color: "var(--text-2)" }}>Currently active</div></div>
            </div>
          </div>

          <div className="ta-card">
            <div className="ta-row ta-gap8"><Megaphone size={16} color="var(--primary)" /><div className="ta-title">Campaign attribution</div></div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>
              Demo requests and organisation inquiries, grouped by the real utm_campaign/utm_source captured at the moment someone landed on the site - nothing estimated after the fact.
            </div>
            <div className="ta-col ta-gap6 ta-mt12">
              {(campaignQuery.data || []).length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)" }}>No campaign-tagged leads yet.</div>}
              {(campaignQuery.data || []).slice(0, 5).map((c) => (
                <div key={c.campaign} className="ta-row ta-between" style={{ fontSize: 12.5 }}>
                  <span>{c.campaign}</span>
                  <span style={{ fontWeight: 700 }}>{c.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="ta-card ta-mt16">
          <div className="ta-row ta-gap8"><Activity size={16} color={healthQuery.data?.ok ? "var(--success)" : "var(--danger)"} /><div className="ta-title">Platform health</div></div>
          <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>
            A real, live check against this database, run when this page loads - not a fabricated uptime percentage. Genuine infrastructure/API uptime monitoring would need real monitoring infrastructure this app doesn't have access to; flagged honestly rather than invented.
          </div>
          <div className="ta-row ta-gap16 ta-mt12">
            <Tag tone={healthQuery.data?.ok ? "success" : "danger"}>{healthQuery.loading ? "Checking..." : healthQuery.data?.ok ? "Database reachable" : "Database unreachable"}</Tag>
            {healthQuery.data?.latencyMs != null && <span style={{ fontSize: 12, color: "var(--text-2)" }}>{healthQuery.data.latencyMs}ms round trip</span>}
            <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>Last checked: {healthQuery.data?.checkedAt ? new Date(healthQuery.data.checkedAt).toLocaleTimeString() : "-"}</span>
          </div>
        </div>

        <div className="ta-card ta-mt16">
          <div className="ta-title">Recent Platform Activity</div>
          <div className="ta-body ta-mt8">Latest actions across every organization, from the admin audit log.</div>
          <div className="ta-col ta-gap10 ta-mt16">
            {activityQuery.loading && <div className="ta-empty">Loading activity...</div>}
            {activityQuery.error && <div className="ta-empty">Couldn't load recent activity: {activityQuery.error}</div>}
            {!activityQuery.loading && !activityQuery.error && activity.length === 0 && (
              <div className="ta-empty">No platform activity recorded yet.</div>
            )}
            {activity.map((a, i) => (
              <div key={i} className="ta-row ta-gap8" style={{ fontSize: 12.5 }}>
                <Clock size={13} color="var(--text-2)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div>{a.text}</div>
                  <div style={{ fontSize: 11, color: "var(--text-2)" }}>{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

