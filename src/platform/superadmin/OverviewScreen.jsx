import React, { useState, useMemo } from "react";
import { TopBar, StatCard, Tag, exportRowsAsCsv, ProgressBar } from "../components/PlatformUI.jsx";
import {
  Building2, Users, Layers, Activity, Download, Clock,
  Globe, TrendingUp, TrendingDown, Megaphone, ShieldCheck,
  Server, Database, ArrowUpRight, CheckCircle2, ChevronRight, Plus,
  DollarSign, BarChart2, Radio, Play
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchPlatformOverviewStats,
  fetchAllOrganizationsWithUserCounts,
  fetchRecentPlatformActivity,
  fetchAIUsageStats,
  fetchWebsitePerformanceStats,
  fetchChurnSummary,
  fetchCampaignAttribution,
  checkPlatformHealth
} from "../../lib/api/platform.js";
import {
  fetchPlatformEnrollmentTrend,
  fetchPlatformAIUsageByFeature,
  fetchPlatformLessonCount
} from "../../lib/api/live/ownerLive.js";

const FEATURE_COLORS = ["#3B82F6", "#EC4899", "#10B981", "#8B5CF6", "#F59E0B", "#06B6D4"];

export function OverviewScreen({ orgSelector, onNavigate }) {
  const [activeChartMetric, setActiveChartMetric] = useState("enrollments");

  const statsQuery = useSupabaseQuery(async () => fetchPlatformOverviewStats(), []);
  const orgsQuery = useSupabaseQuery(async () => fetchAllOrganizationsWithUserCounts(), []);
  const activityQuery = useSupabaseQuery(async () => fetchRecentPlatformActivity(8), []);
  const aiUsageQuery = useSupabaseQuery(async () => fetchAIUsageStats(), []);
  const websiteStatsQuery = useSupabaseQuery(async () => fetchWebsitePerformanceStats(), []);
  const churnQuery = useSupabaseQuery(async () => fetchChurnSummary(), []);
  const campaignQuery = useSupabaseQuery(async () => fetchCampaignAttribution(), []);
  const healthQuery = useSupabaseQuery(async () => checkPlatformHealth(), []);
  const enrollmentTrendQuery = useSupabaseQuery(async () => fetchPlatformEnrollmentTrend(6), []);
  const aiFeatureUsageQuery = useSupabaseQuery(async () => fetchPlatformAIUsageByFeature(), []);
  const lessonCountQuery = useSupabaseQuery(async () => fetchPlatformLessonCount(), []);

  const aiUsage = aiUsageQuery.data;
  const websiteStats = websiteStatsQuery.data;
  const stats = statsQuery.data;
  const orgs = orgsQuery.data || [];
  const activity = activityQuery.data || [];
  const trendData = enrollmentTrendQuery.data || [];
  const aiFeatures = aiFeatureUsageQuery.data || [];
  const lessonCount = lessonCountQuery.data || 0;

  function handleExportPlatformReport() {
    if (!orgs.length) return;
    exportRowsAsCsv("platform-tenant-report.csv", orgs.map(o => ({
      organization: o.name,
      usersCount: o.user_count || 0,
      tier: o.subscription_tier || "growth",
      createdAt: new Date(o.created_at).toLocaleDateString(),
      status: o.status || "active",
    })));
  }

  const effectiveTotalUsers = stats?.totalUsers ?? orgs.reduce((sum, o) => sum + (o.user_count || 0), 0);
  const effectiveTotalOrgs = stats?.organizations ?? orgs.length;
  const effectiveTotalCourses = stats?.totalCourses ?? 0;
  const effectiveActiveInWeek = stats?.activeInWeek ?? 0;

  const enterpriseCount = orgs.filter(o => (o.subscription_tier || "").toLowerCase() === "enterprise").length;
  const otherTiersCount = orgs.length - enterpriseCount;

  const maxTrendValue = useMemo(() => {
    if (!trendData.length) return 1;
    const values = trendData.map(d => activeChartMetric === "enrollments" ? (d.enrollments || 0) : (d.completions || 0));
    return Math.max(...values, 1);
  }, [trendData, activeChartMetric]);

  return (
    <div className="ta-fade">
      {/* =========================================================================
          TOP EXECUTIVE CONTROL BAR
          ========================================================================= */}
      <TopBar
        title="Superadmin Dashboard"
        sub="System telemetry, multi-tenant directory, and global platform controls"
        orgSelector={orgSelector}
        onNavigate={onNavigate}
      />

      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* =========================================================================
            EXECUTIVE HERO TELEMETRY BANNER
            ========================================================================= */}
        <div
          className="ta-card ta-hero-banner ta-hero-dark anim-fluid-entrance"
          style={{
            borderRadius: 14,
            padding: "clamp(18px, 2.5vw, 24px)",
            position: "relative",
            overflow: "hidden"
          }}
        >
          <div className="tai-glow-cobalt" />

          <div className="ta-hero-inner" style={{ position: "relative", zIndex: 1 }}>
            <div className="ta-hero-text">
              <h1 className="ta-hero-title" style={{ fontSize: "clamp(20px, 2.5vw, 25px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 4px", lineHeight: 1.2 }}>
                Train AI Platform Overview
              </h1>
              <p className="ta-hero-desc" style={{ fontSize: 13, margin: 0, maxWidth: 680, lineHeight: 1.5 }}>
                Active orchestration across {effectiveTotalOrgs} tenant institution{effectiveTotalOrgs === 1 ? "" : "s"}, supporting {effectiveTotalUsers.toLocaleString()} enrolled learner{effectiveTotalUsers === 1 ? "" : "s"} with live Supabase database backing.
              </p>
            </div>

            <div className="ta-hero-actions">
              <div className="tai-hero-subcard" style={{ padding: "8px 14px", borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 10.5, opacity: 0.8, fontWeight: 700 }}>Database Health</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: healthQuery.data?.ok ? "#10B981" : "#EF4444" }}>
                  {healthQuery.loading ? "Checking..." : healthQuery.data?.ok ? (healthQuery.data.latencyMs != null ? `${healthQuery.data.latencyMs}ms` : "Connected") : "Degraded"}
                </div>
              </div>
              <div className="tai-hero-subcard" style={{ padding: "8px 14px", borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 10.5, opacity: 0.8, fontWeight: 700 }}>Active Tenants</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "var(--primary-light, #3B82F6)" }}>{effectiveTotalOrgs}</div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            TOP 4 EXECUTIVE METRIC CARDS
            ========================================================================= */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          
          {/* Card 1 */}
          <div className="ta-card" style={{ padding: "20px 22px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Total Organizations</span>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(59, 130, 246, 0.12)", color: "var(--primary, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Building2 size={18} />
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text)", marginTop: 10, letterSpacing: "-0.02em" }}>
              {effectiveTotalOrgs}
            </div>
            <div className="ta-row ta-between" style={{ fontSize: 12, marginTop: 10, gap: 8, flexWrap: "wrap" }}>
              <span className="ta-row" style={{ gap: 4, color: "var(--success)", fontWeight: 700 }}>
                <TrendingUp size={14} /> Live Directory
              </span>
              <span style={{ color: "var(--text-3)" }}>
                {enterpriseCount} Enterprise{otherTiersCount > 0 ? `, ${otherTiersCount} other` : ""}
              </span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="ta-card" style={{ padding: "20px 22px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Total Platform Users</span>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(37, 99, 235, 0.12)", color: "var(--primary, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users size={18} />
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text)", marginTop: 10, letterSpacing: "-0.02em" }}>
              {effectiveTotalUsers.toLocaleString()}
            </div>
            <div className="ta-row ta-between" style={{ fontSize: 12, marginTop: 10, gap: 8, flexWrap: "wrap" }}>
              <span className="ta-row" style={{ gap: 4, color: "var(--success)", fontWeight: 700 }}>
                <CheckCircle2 size={14} /> Registered Members
              </span>
              <span style={{ color: "var(--text-3)" }}>Across all tenants</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="ta-card" style={{ padding: "20px 22px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Published Courses</span>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(16, 185, 129, 0.12)", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Layers size={18} />
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text)", marginTop: 10, letterSpacing: "-0.02em" }}>
              {effectiveTotalCourses}
            </div>
            <div className="ta-row ta-between" style={{ fontSize: 12, marginTop: 10, gap: 8, flexWrap: "wrap" }}>
              <span className="ta-row" style={{ gap: 4, color: "var(--primary)", fontWeight: 700 }}>
                <CheckCircle2 size={14} /> Published
              </span>
              <span style={{ color: "var(--text-3)" }}>{lessonCount} Total Lessons</span>
            </div>
          </div>

          {/* Card 4 */}
          <div className="ta-card" style={{ padding: "20px 22px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Weekly Active Users (7d)</span>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(245, 158, 11, 0.12)", color: "#D97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Activity size={18} />
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text)", marginTop: 10, letterSpacing: "-0.02em" }}>
              {effectiveActiveInWeek.toLocaleString()}
            </div>
            <div className="ta-row ta-between" style={{ fontSize: 12, marginTop: 10, gap: 8, flexWrap: "wrap" }}>
              <span className="ta-row" style={{ gap: 4, color: "var(--success)", fontWeight: 700 }}>
                <TrendingUp size={14} />
                {effectiveTotalUsers > 0 ? `${Math.min(100, Math.round((effectiveActiveInWeek / effectiveTotalUsers) * 100))}% Active` : "0% Active"}
              </span>
              <span style={{ color: "var(--text-3)" }}>Active last 7 days</span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            ANALYTICS VISUALIZATION & AI CONSUMPTION SPLIT
            ========================================================================= */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 24 }}>
          
          {/* Multi-Month Growth Chart (Live DB backed) */}
          <div className="ta-card" style={{ padding: 24, borderRadius: 10 }}>
            <div className="ta-row ta-between" style={{ paddingBottom: 16, borderBottom: "1px solid var(--border)", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div className="ta-title" style={{ fontSize: 16 }}>Platform Enrollment Trajectory</div>
                <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Monthly course enrollments and completions across all tenants</div>
              </div>
              <div className="ta-row ta-gap6">
                {[
                  { key: "enrollments", label: "Enrollments" },
                  { key: "completions", label: "Completions" },
                ].map(m => (
                  <button
                    key={m.key}
                    onClick={() => setActiveChartMetric(m.key)}
                    className={`ta-btn ta-btn-sm ${activeChartMetric === m.key ? "ta-btn-primary" : "ta-btn-outline"}`}
                    style={{
                      padding: "4px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer"
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bar Chart Visualization */}
            {enrollmentTrendQuery.loading && (
              <div className="ta-empty" style={{ padding: "40px 0" }}>Loading enrollment trend telemetry...</div>
            )}
            {!enrollmentTrendQuery.loading && trendData.length === 0 && (
              <div className="ta-empty" style={{ padding: "40px 0" }}>No enrollment records recorded across tenants yet.</div>
            )}
            {!enrollmentTrendQuery.loading && trendData.length > 0 && (
              <div style={{ height: 210, display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingTop: 30, paddingBottom: 10, gap: 12, overflowX: "auto" }}>
                {trendData.map((item, idx) => {
                  const val = activeChartMetric === "enrollments" ? (item.enrollments || 0) : (item.completions || 0);
                  const heightPct = Math.max(val > 0 ? Math.round((val / maxTrendValue) * 100) : 6, 6);
                  return (
                    <div key={item.month || idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)", marginBottom: 6 }}>
                        {val}
                      </div>
                      <div
                        style={{
                          width: "100%", maxWidth: 36,
                          height: `${heightPct}%`,
                          background: idx === trendData.length - 1
                            ? "var(--primary, #2563EB)"
                            : "var(--surface-3)",
                          borderRadius: "4px 4px 0 0",
                          transition: "all 0.2s ease"
                        }}
                      />
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 8, fontWeight: 600 }}>
                        {item.month}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI Engine Activity & Consumption Matrix */}
          <div className="ta-card" style={{ padding: 24, borderRadius: 10 }}>
            <div className="ta-row ta-between" style={{ paddingBottom: 16, borderBottom: "1px solid var(--border)", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div className="ta-title" style={{ fontSize: 16 }}>AI Inference Engine Telemetry</div>
                <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Breakdown by active AI feature from ai_usage_events</div>
              </div>
              <Tag tone="primary"><Activity size={12} /> {aiUsage?.total ?? 0} Total Calls</Tag>
            </div>

            <div className="ta-col ta-gap16 anim-stagger" style={{ marginTop: 18 }}>
              {aiFeatureUsageQuery.loading && (
                <div className="ta-empty" style={{ padding: "20px 0" }}>Loading AI telemetry...</div>
              )}
              {!aiFeatureUsageQuery.loading && aiFeatures.length === 0 && (
                <div className="ta-empty" style={{ padding: "20px 0" }}>No AI usage events logged in this database yet.</div>
              )}
              {!aiFeatureUsageQuery.loading && aiFeatures.map((b, i) => {
                const color = FEATURE_COLORS[i % FEATURE_COLORS.length];
                return (
                  <div key={b.feature}>
                    <div className="ta-row ta-between" style={{ fontSize: 13, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, color: "var(--text)", textTransform: "capitalize" }}>{b.feature.replace(/_/g, " ")}</span>
                      <span style={{ fontWeight: 800, color }}>{b.pct}% ({b.count} calls)</span>
                    </div>
                    <div style={{ width: "100%", height: 8, background: "var(--surface-3)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ width: `${b.pct}%`, height: "100%", background: color, borderRadius: 99 }} />
                    </div>
                  </div>
                );
              })}

              <div style={{ background: "var(--surface-3)", padding: 14, borderRadius: 8, marginTop: 8 }}>
                <div className="ta-row ta-between" style={{ fontSize: 12.5 }}>
                  <span style={{ color: "var(--text-2)", fontWeight: 600 }}>Database Ping Round-Trip:</span>
                  <span style={{ color: "var(--success)", fontWeight: 800 }}>
                    {healthQuery.data?.latencyMs != null ? `${healthQuery.data.latencyMs} ms` : "Online"}
                  </span>
                </div>
                <div className="ta-row ta-between" style={{ fontSize: 12.5, marginTop: 6 }}>
                  <span style={{ color: "var(--text-2)", fontWeight: 600 }}>AI Calls (Last 7 Days):</span>
                  <span style={{ color: "var(--text)", fontWeight: 800 }}>{aiUsage?.last7d ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            TENANT ORGANIZATIONS TABLE & AUDIT STREAM
            ========================================================================= */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          
          {/* Tenant Table */}
          <div className="ta-card" style={{ padding: 24, borderRadius: 10 }}>
            <div className="ta-row ta-between" style={{ paddingBottom: 16, borderBottom: "1px solid var(--border)", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div className="ta-title" style={{ fontSize: 16 }}>Tenant Organizations</div>
                <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Multi-tenant seat allocations &amp; statuses</div>
              </div>
              <div className="ta-row ta-gap8">
                <button
                  className="ta-btn ta-btn-outline ta-btn-sm"
                  onClick={handleExportPlatformReport}
                  disabled={!orgs.length}
                >
                  <Download size={13} /> Export CSV
                </button>
                <Tag tone="primary">{orgs.length} Active Tenants</Tag>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="ta-table ta-mt12">
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Active Seats</th>
                    <th>Tier</th>
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
                        <div className="ta-row ta-gap10" style={{ minWidth: 0 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--surface-3)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "var(--primary)", flexShrink: 0 }}>
                            <Building2 size={16} />
                          </div>
                          <div style={{ minWidth: 0, overflow: "hidden" }}>
                            <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</div>
                            <div style={{ fontSize: 11, color: "var(--text-3)" }}>ID: {o.id.slice(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{o.user_count || 0} learners</div>
                      </td>
                      <td>
                        <Tag tone={o.subscription_tier === "enterprise" ? "primary" : "neutral"}>
                          {o.subscription_tier ? o.subscription_tier.toUpperCase() : "GROWTH"}
                        </Tag>
                      </td>
                      <td>
                        <Tag tone={o.status === "active" ? "success" : "warning"}>
                          {o.status || "active"}
                        </Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Real-time Audit Stream */}
          <div className="ta-card" style={{ padding: 24, borderRadius: 10 }}>
            <div className="ta-row ta-between" style={{ paddingBottom: 16, borderBottom: "1px solid var(--border)", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div className="ta-title" style={{ fontSize: 16 }}>Live Platform Audit Stream</div>
                <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Real-time events from safe_admin_audit_log</div>
              </div>
              <Tag tone="success">Streaming</Tag>
            </div>

            <div className="ta-col ta-gap12 anim-stagger" style={{ marginTop: 14 }}>
              {activityQuery.loading && (
                <div className="ta-empty">Loading recent activity...</div>
              )}
              {activityQuery.error && (
                <div className="ta-empty">Couldn't load recent activity: {activityQuery.error}</div>
              )}
              {!activityQuery.loading && !activityQuery.error && activity.length === 0 && (
                <div className="ta-empty">No platform audit activity logged yet.</div>
              )}
              {activity.slice(0, 6).map((a, i) => (
                <div key={i} className="ta-row ta-between" style={{ padding: "10px 12px", background: "var(--surface-3)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div className="ta-row ta-gap10" style={{ minWidth: 0, flex: 1 }}>
                    <Clock size={14} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.text}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700, flexShrink: 0, marginLeft: 10 }}>
                    {a.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* =========================================================================
            LIVE DATABASE HEALTH, CHURN & CAMPAIGN ATTRIBUTION
            ========================================================================= */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>

          <div className="ta-card" style={{ padding: "20px 22px", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-gap8" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
              <Activity size={16} color={healthQuery.data?.ok ? "var(--success)" : "var(--danger)"} />
              <div className="ta-title" style={{ fontSize: 15, fontWeight: 800 }}>Platform Health</div>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 10, lineHeight: 1.4 }}>
              Live Supabase database telemetry check on page boot.
            </div>
            <div className="ta-row ta-gap10" style={{ marginTop: 14, flexWrap: "wrap" }}>
              <Tag tone={healthQuery.data?.ok ? "success" : "danger"}>{healthQuery.loading ? "Checking..." : healthQuery.data?.ok ? "Database reachable" : "Database unreachable"}</Tag>
              {healthQuery.data?.latencyMs != null && <span style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>{healthQuery.data.latencyMs}ms round trip</span>}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 8 }}>
              Last checked: {healthQuery.data?.checkedAt ? new Date(healthQuery.data.checkedAt).toLocaleTimeString() : "-"}
            </div>
          </div>

          <div className="ta-card" style={{ padding: "20px 22px", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-gap8" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
              <TrendingDown size={16} color="var(--danger)" />
              <div className="ta-title" style={{ fontSize: 15, fontWeight: 800 }}>Tenant Churn History</div>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 10, lineHeight: 1.4 }}>
              Aggregated from real admin audit log events.
            </div>
            <div className="ta-row ta-gap16" style={{ marginTop: 14 }}>
              <div><div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>{churnQuery.data?.suspendedLast30d ?? 0}</div><div style={{ fontSize: 11, color: "var(--text-3)" }}>Suspended, 30d</div></div>
              <div><div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>{churnQuery.data?.suspendedLast90d ?? 0}</div><div style={{ fontSize: 11, color: "var(--text-3)" }}>Suspended, 90d</div></div>
              <div><div style={{ fontSize: 20, fontWeight: 800, color: "var(--success)" }}>{churnQuery.data?.totalActive ?? 0}</div><div style={{ fontSize: 11, color: "var(--text-3)" }}>Active Tenants</div></div>
            </div>
          </div>

          <div className="ta-card" style={{ padding: "20px 22px", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-gap8" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
              <Megaphone size={16} color="var(--primary)" />
              <div className="ta-title" style={{ fontSize: 15, fontWeight: 800 }}>Campaign Attribution</div>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 10, lineHeight: 1.4 }}>
              UTM tracking grouped by campaign source.
            </div>
            <div className="ta-col ta-gap6" style={{ marginTop: 14 }}>
              {(campaignQuery.data || []).length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)" }}>No campaign-tagged leads yet.</div>}
              {(campaignQuery.data || []).slice(0, 5).map((c) => (
                <div key={c.campaign} className="ta-row ta-between" style={{ fontSize: 12.5 }}>
                  <span style={{ color: "var(--text)", fontWeight: 500 }}>{c.campaign}</span>
                  <span style={{ fontWeight: 700, color: "var(--primary)" }}>{c.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
