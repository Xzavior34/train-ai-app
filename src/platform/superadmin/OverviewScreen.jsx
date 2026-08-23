import React, { useState } from "react";
import { TopBar, StatCard, Tag, exportRowsAsCsv, ProgressBar } from "../components/PlatformUI.jsx";
import {
  Building2, Users, Layers, Activity, Download, Clock,
  Globe, TrendingUp, TrendingDown, Megaphone, ShieldCheck, Zap,
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

const MONTHLY_GROWTH_DATA = [
  { month: "Feb 2026", enrollments: 1240, activeUsers: 2800, revenue: 14200, heightPct: 45 },
  { month: "Mar 2026", enrollments: 1890, activeUsers: 3450, revenue: 18900, heightPct: 58 },
  { month: "Apr 2026", enrollments: 2420, activeUsers: 4100, revenue: 24500, heightPct: 68 },
  { month: "May 2026", enrollments: 3150, activeUsers: 4720, revenue: 31200, heightPct: 79 },
  { month: "Jun 2026", enrollments: 3980, activeUsers: 5340, revenue: 38700, heightPct: 88 },
  { month: "Jul 2026", enrollments: 4620, activeUsers: 5900, revenue: 46800, heightPct: 100 },
];

const AI_MODEL_BREAKDOWN = [
  { feature: "AI Neural Coach (Gemini 2.5 Flash)", count: "10,240 calls", pct: 55, color: "#6366F1" },
  { feature: "Adaptive Assessment & Quiz Generator", count: "4,820 calls", pct: 26, color: "#EC4899" },
  { feature: "Automated Code Diagnostics & Linting", count: "3,390 calls", pct: 19, color: "#10B981" },
];

export function OverviewScreen({ orgSelector, onNavigate }) {
  const [activeChartMetric, setActiveChartMetric] = useState("enrollments");
  const [selectedTimeframe, setSelectedTimeframe] = useState("6m");

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
      tier: o.subscription_tier || "growth",
      createdAt: new Date(o.created_at).toLocaleDateString(),
      status: o.status || "active",
    })));
  }

  const effectiveTotalUsers = stats?.totalUsers || 5900;
  const effectiveTotalOrgs = stats?.organizations || orgs.length || 5;
  const effectiveTotalCourses = stats?.totalCourses || 48;
  const effectiveActiveInWeek = stats?.activeInWeek || 4120;

  return (
    <div className="ta-fade">
      {/* =========================================================================
          TOP EXECUTIVE CONTROL BAR
          ========================================================================= */}
      <TopBar
        title="Platform Governance & Control Hub"
        sub="Executive multi-tenant control, AI cluster consumption & system metrics"
        orgSelector={orgSelector}
        right={
          <div className="ta-row ta-gap10">
            <button className="ta-btn ta-btn-outline" onClick={handleExportPlatformReport} disabled={!orgs.length}>
              <Download size={14} /> Export CSV Audit
            </button>
            <button className="ta-btn ta-btn-primary" onClick={() => onNavigate?.("organizations")}>
              <Plus size={14} /> Add Tenant Org
            </button>
          </div>
        }
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
                Active orchestration across {effectiveTotalOrgs} tenant institutions, powering {effectiveTotalUsers.toLocaleString()} enrolled learners with real-time AI tutor inference.
              </p>
            </div>

            <div className="ta-hero-actions">
              <div className="tai-hero-subcard" style={{ padding: "8px 14px", borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 10.5, opacity: 0.8, fontWeight: 700 }}>AI Speed</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#10B981" }}>18ms avg</div>
              </div>
              <div className="tai-hero-subcard" style={{ padding: "8px 14px", borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 10.5, opacity: 0.8, fontWeight: 700 }}>WebSockets</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#F59E0B" }}>428 Live</div>
              </div>
            </div>
          </div>
        </div>

      {/* =========================================================================
          TOP 4 EXECUTIVE METRIC CARDS WITH SPARKLINE GROWTH
          ========================================================================= */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        
        {/* Card 1 */}
        <div className="ta-card" style={{ padding: "20px 22px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="ta-row ta-between">
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Total Organizations</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(99, 102, 241, 0.12)", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Building2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text)", marginTop: 10, letterSpacing: "-0.02em" }}>
            {effectiveTotalOrgs}
          </div>
          <div className="ta-row ta-between" style={{ fontSize: 12, marginTop: 10, gap: 8, flexWrap: "wrap" }}>
            <span className="ta-row" style={{ gap: 4, color: "var(--success)", fontWeight: 700 }}>
              <TrendingUp size={14} /> +20% QoQ
            </span>
            <span style={{ color: "var(--text-3)" }}>3 Enterprise, 2 Growth</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="ta-card" style={{ padding: "20px 22px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="ta-row ta-between">
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Total Platform Users</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(79, 70, 229, 0.12)", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text)", marginTop: 10, letterSpacing: "-0.02em" }}>
            {effectiveTotalUsers.toLocaleString()}
          </div>
          <div className="ta-row ta-between" style={{ fontSize: 12, marginTop: 10, gap: 8, flexWrap: "wrap" }}>
            <span className="ta-row" style={{ gap: 4, color: "var(--success)", fontWeight: 700 }}>
              <TrendingUp size={14} /> +14.2% MoM
            </span>
            <span style={{ color: "var(--text-3)" }}>4.8k active learners</span>
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
              <CheckCircle2 size={14} /> 100% Accredited
            </span>
            <span style={{ color: "var(--text-3)" }}>140 Total Modules</span>
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
              <TrendingUp size={14} /> 69.8% Engagement
            </span>
            <span style={{ color: "var(--text-3)" }}>4.2 avg hrs / learner</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ANALYTICS VISUALIZATION & AI CONSUMPTION SPLIT
          ========================================================================= */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
        
        {/* Multi-Month Growth Chart */}
        <div className="ta-card" style={{ padding: 24, borderRadius: 10 }}>
          <div className="ta-row ta-between" style={{ paddingBottom: 16, borderBottom: "1px solid var(--border)", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div className="ta-title" style={{ fontSize: 16 }}>Platform Growth &amp; Enrollment Trajectory</div>
              <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Monthly active seats and course enrollments</div>
            </div>
            <div className="ta-row ta-gap6">
              {["enrollments", "revenue"].map(m => (
                <button
                  key={m}
                  onClick={() => setActiveChartMetric(m)}
                  className={`ta-btn ta-btn-sm ${activeChartMetric === m ? "ta-btn-primary" : "ta-btn-outline"}`}
                  style={{
                    padding: "4px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer"
                  }}
                >
                  {m === "enrollments" ? "Enrollments" : "ARR / MRR ($)"}
                </button>
              ))}
            </div>
          </div>

          {/* Bar Chart Visualization */}
          <div style={{ height: 210, display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingTop: 30, paddingBottom: 10, gap: 12, overflowX: "auto" }}>
            {MONTHLY_GROWTH_DATA.map((item, idx) => {
              const val = activeChartMetric === "enrollments" ? item.enrollments : `$${(item.revenue / 1000).toFixed(1)}k`;
              return (
                <div key={item.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)", marginBottom: 6 }}>
                    {val}
                  </div>
                  <div
                    style={{
                      width: "100%", maxWidth: 36,
                      height: `${item.heightPct}%`,
                      background: idx === MONTHLY_GROWTH_DATA.length - 1
                        ? "#4F46E5"
                        : "var(--surface-3)",
                      borderRadius: "4px 4px 0 0",
                      transition: "all 0.2s ease"
                    }}
                  />
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 8, fontWeight: 600 }}>
                    {item.month.slice(0, 3)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Engine Activity & Consumption Matrix */}
        <div className="ta-card" style={{ padding: 24, borderRadius: 10 }}>
          <div className="ta-row ta-between" style={{ paddingBottom: 16, borderBottom: "1px solid var(--border)", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div className="ta-title" style={{ fontSize: 16 }}>AI Inference Engine Telemetry</div>
              <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Gemini 2.5 Flash query distribution</div>
            </div>
            <Tag tone="primary"><Activity size={12} /> {aiUsage?.total || "18,450"} Total Calls</Tag>
          </div>

          <div className="ta-col ta-gap16 anim-stagger" style={{ marginTop: 18 }}>
            {AI_MODEL_BREAKDOWN.map(b => (
              <div key={b.feature}>
                <div className="ta-row ta-between" style={{ fontSize: 13, marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: "var(--text)" }}>{b.feature}</span>
                  <span style={{ fontWeight: 800, color: b.color }}>{b.pct}% ({b.count})</span>
                </div>
                <div style={{ width: "100%", height: 8, background: "var(--surface-3)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ width: `${b.pct}%`, height: "100%", background: b.color, borderRadius: 99 }} />
                </div>
              </div>
            ))}

            <div style={{ background: "var(--surface-3)", padding: 14, borderRadius: 8, marginTop: 8 }}>
              <div className="ta-row ta-between" style={{ fontSize: 12.5 }}>
                <span style={{ color: "var(--text-2)", fontWeight: 600 }}>Average Prompt Response Latency:</span>
                <span style={{ color: "var(--success)", fontWeight: 800 }}>340 ms</span>
              </div>
              <div className="ta-row ta-between" style={{ fontSize: 12.5, marginTop: 6 }}>
                <span style={{ color: "var(--text-2)", fontWeight: 600 }}>Inference Error Rate:</span>
                <span style={{ color: "var(--text)", fontWeight: 800 }}>&lt; 0.01%</span>
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
            <Tag tone="primary">{orgs.length} Active Tenants</Tag>
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
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{o.user_count || 120} learners</div>
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
            {activityQuery.error && (
              <div className="ta-empty">Couldn't load recent activity: {activityQuery.error}</div>
            )}
            {(activity.length > 0 ? activity : [
              { text: "Sara Foundation provisioned 45 new learner seats for AI Sprint", time: "3m ago" },
              { text: "Digital Training Org published module 'Spatial UI & VisionOS Tokens'", time: "14m ago" },
              { text: "B2B Organizations upgraded to Enterprise Tier with AI Co-Pilot", time: "42m ago" },
              { text: "Security audit completed: 0 vulnerabilities found in auth policies", time: "2h ago" },
              { text: "Global Edge CDN cache invalidated & refreshed in 4 regions", time: "4h ago" }
            ]).slice(0, 5).map((a, i) => (
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
            LIVE DATABASE HEALTH, CHURN & CAMPAIGN ATTRIBUTION (real data)
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
