import React, { useState } from "react";
import { TopBar, StatCard, Tag, exportRowsAsCsv, ProgressBar } from "../components/PlatformUI.jsx";
import {
  Building2, Users, Layers, Activity, Download, Clock, Sparkles,
  Globe, TrendingUp, TrendingDown, Megaphone, ShieldCheck, Zap,
  Server, Database, ArrowUpRight, CheckCircle2, ChevronRight, Plus,
  DollarSign, BarChart2, Radio, Play
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { DEMO_MODE } from "../../lib/demoMode.js";
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

// Illustrative six-month series and AI feature split, kept ONLY as the
// no-database preview of these two charts. Both used to render
// unconditionally against a live database: the growth array carried invented
// enrollment/revenue figures plus a hardcoded `heightPct` per bar that was
// not derived from its own numbers, and the AI split invented "10,240 calls"
// at 55% for features nobody had necessarily called. Real equivalents are
// fetchPlatformEnrollmentTrend / fetchPlatformAIUsageByFeature.
const DEMO_MONTHLY_GROWTH = [
  { month: "Feb 26", enrollments: 1240, completions: 620, revenue: 14200 },
  { month: "Mar 26", enrollments: 1890, completions: 940, revenue: 18900 },
  { month: "Apr 26", enrollments: 2420, completions: 1210, revenue: 24500 },
  { month: "May 26", enrollments: 3150, completions: 1570, revenue: 31200 },
  { month: "Jun 26", enrollments: 3980, completions: 1990, revenue: 38700 },
  { month: "Jul 26", enrollments: 4620, completions: 2310, revenue: 46800 },
];

const DEMO_AI_BREAKDOWN = [
  { feature: "ai_coach", count: 10240, pct: 55 },
  { feature: "ai_quiz", count: 4820, pct: 26 },
  { feature: "code_diagnostics", count: 3390, pct: 19 },
];

// Rotating series colours for the AI feature bars. Previously each invented
// row carried its own colour; the real feature list is whatever
// ai_usage_events contains, so colour is assigned by position instead.
const AI_SERIES_COLORS = ["#6366F1", "#EC4899", "#10B981", "#F59E0B", "#0EA5E9"];

// ai_usage_events.feature stores machine keys ("ai_coach"). Display names for
// the ones this platform writes; anything else is title-cased from its key
// rather than relabelled into a product name that may not exist.
const AI_FEATURE_LABELS = {
  ai_coach: "AI Neural Coach",
  ai_quiz: "Adaptive Assessment & Quiz Generator",
  quiz_generator: "Adaptive Assessment & Quiz Generator",
  unattributed: "Unattributed calls",
};

function aiFeatureLabel(key) {
  return AI_FEATURE_LABELS[key] || String(key).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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
  const trendQuery = useSupabaseQuery(async () => fetchPlatformEnrollmentTrend(6), []);
  const aiByFeatureQuery = useSupabaseQuery(async () => fetchPlatformAIUsageByFeature(), []);
  const lessonCountQuery = useSupabaseQuery(async () => fetchPlatformLessonCount(), []);

  const aiUsage = aiUsageQuery.data;
  const websiteStats = websiteStatsQuery.data;
  const stats = statsQuery.data;
  const orgs = orgsQuery.data || [];
  const activity = activityQuery.data || [];

  // Growth chart series. With a database this is the real month-by-month
  // enrollment/completion count from course_enrollments; the illustrative
  // array only stands in when there is no database at all.
  const growthSeries = DEMO_MODE ? DEMO_MONTHLY_GROWTH : (trendQuery.data || []);
  // Bar heights used to come from a hardcoded `heightPct` per row. They are
  // now scaled off the largest value in whichever series is being displayed,
  // so the bars actually represent the numbers printed above them.
  const growthMax = Math.max(
    1,
    ...growthSeries.map((r) => (activeChartMetric === "revenue" ? (r.revenue || 0) : activeChartMetric === "completions" ? (r.completions || 0) : (r.enrollments || 0)))
  );

  // AI feature split from the real `feature` column on ai_usage_events.
  const aiBreakdown = DEMO_MODE ? DEMO_AI_BREAKDOWN : (aiByFeatureQuery.data || []);

  // Tier mix for the Total Organizations card footer, which was the literal
  // "3 Enterprise, 2 Growth". subscription_tier is a real column on
  // organizations and fetchAllOrganizationsWithUserCounts already loaded it
  // on this screen, so this is just a count of what is actually there.
  const tierMix = Object.entries(
    orgs.reduce((acc, o) => {
      const tier = (o.subscription_tier || "unassigned").toLowerCase();
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .map(([tier, count]) => `${count} ${tier.charAt(0).toUpperCase()}${tier.slice(1)}`)
    .join(", ");

  function handleExportPlatformReport() {
    if (!orgs.length) return;
    exportRowsAsCsv("platform-tenant-report.csv", orgs.map(o => ({
      organization: o.name,
      usersCount: o.user_count || 0,
      // Neither of these defaulted honestly: an org with no tier was
      // exported as "growth" and one with no status as "active".
      tier: o.subscription_tier || "",
      createdAt: new Date(o.created_at).toLocaleDateString(),
      status: o.status || "",
    })));
  }

  // fetchPlatformOverviewStats supplies all four of these as real counts.
  // They previously used `||` against literals (5900 / 48 / 4120 / 5), so a
  // genuinely empty platform rendered as 5,900 users and 4,120 weekly
  // actives. `??` means a real zero is shown as zero; the literals are gone
  // rather than kept as a fallback, because fetchPlatformOverviewStats
  // already returns its own demo figures when no database is connected.
  const effectiveTotalUsers = stats?.totalUsers ?? 0;
  const effectiveTotalOrgs = stats?.organizations ?? orgs.length;
  const effectiveTotalCourses = stats?.totalCourses ?? 0;
  const effectiveActiveInWeek = stats?.activeInWeek ?? 0;

  return (
    <div className="ta-fade" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
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

      {/* =========================================================================
          EXECUTIVE HERO TELEMETRY BANNER
          ========================================================================= */}
      <div className="ta-hero-banner">
        {/* Background Network Tech Photo with Overlay */}
        <img
          src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1400&auto=format&fit=crop&q=85"
          alt=""
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", opacity: 0.28, zIndex: 0
          }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(100deg, rgba(15,23,42,0.96) 0%, rgba(30,27,75,0.85) 60%, rgba(15,23,42,0.7) 100%)",
          zIndex: 0
        }} />

        <div className="ta-hero-inner">
          <div className="ta-hero-text">
            <div className="ta-row ta-gap10" style={{ flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{
                background: "rgba(99, 102, 241, 0.35)", color: "#E0E7FF",
                border: "1px solid rgba(165, 180, 252, 0.5)",
                fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99,
                display: "inline-flex", alignItems: "center", gap: 6, letterSpacing: "0.03em"
              }}>
                <Server size={13} color="#A5B4FC" /> ENTERPRISE MULTI-TENANT CLUSTER
              </span>
              {/* "99.98% UPTIME • GLOBAL EDGE" stated an SLA figure nothing
                  measures - there is no uptime history table and no edge
                  telemetry anywhere in this app. The Platform Health card
                  further down this same page does the honest version of this
                  via checkPlatformHealth(), so the badge only renders with no
                  database connected. */}
              {DEMO_MODE && (
              <span style={{
                background: "rgba(16, 185, 129, 0.28)", color: "#A7F3D0",
                border: "1px solid rgba(16, 185, 129, 0.5)",
                fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99,
                display: "inline-flex", alignItems: "center", gap: 5
              }}>
                <Radio size={11} color="#34D399" /> 99.98% UPTIME • GLOBAL EDGE
              </span>
              )}
              {!DEMO_MODE && healthQuery.data && (
              <span style={{
                background: healthQuery.data.ok ? "rgba(16, 185, 129, 0.28)" : "rgba(239, 68, 68, 0.28)", color: healthQuery.data.ok ? "#A7F3D0" : "#FCA5A5",
                border: healthQuery.data.ok ? "1px solid rgba(16, 185, 129, 0.5)" : "1px solid rgba(239, 68, 68, 0.5)",
                fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99,
                display: "inline-flex", alignItems: "center", gap: 5
              }}>
                <Radio size={11} color={healthQuery.data.ok ? "#34D399" : "#F87171"} /> {healthQuery.data.ok ? "DATABASE REACHABLE" : "DATABASE UNREACHABLE"}
              </span>
              )}
            </div>

            <h1 className="ta-hero-title">
              Train AI Platform Overview
            </h1>
            <p className="ta-hero-desc">
              Active orchestration across {effectiveTotalOrgs} tenant institutions, powering {effectiveTotalUsers.toLocaleString()} enrolled learners with real-time AI tutor inference.
            </p>
          </div>

          <div className="ta-hero-actions">
            {/* "AI Speed 18ms avg" was invented - nothing records inference
                latency. checkPlatformHealth() does return a real round-trip
                latencyMs for this database, which is the one infrastructure
                number this page can honestly report, so the badge now shows
                that and is labelled for what it measures. */}
            {DEMO_MODE ? (
              <div style={{ background: "rgba(255,255,255,0.1)", padding: "8px 14px", borderRadius: 12, backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)", textAlign: "center" }}>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>AI Speed</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#34D399" }}>18ms avg</div>
              </div>
            ) : (
              <div style={{ background: "rgba(255,255,255,0.1)", padding: "8px 14px", borderRadius: 12, backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)", textAlign: "center" }}>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>DB Round Trip</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#34D399" }}>
                  {healthQuery.loading ? "..." : healthQuery.data?.latencyMs != null ? `${healthQuery.data.latencyMs}ms` : "-"}
                </div>
              </div>
            )}
            {/* "WebSockets 428 Live" - no realtime connection count is tracked
                anywhere, so this only renders with no database connected. */}
            {DEMO_MODE && (
            <div style={{ background: "rgba(255,255,255,0.1)", padding: "8px 14px", borderRadius: 12, backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)", textAlign: "center" }}>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>WebSockets</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#FBBF24" }}>428 Live</div>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          TOP 4 EXECUTIVE METRIC CARDS WITH SPARKLINE GROWTH
          ========================================================================= */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        
        {/* Card 1 */}
        <div className="ta-card" style={{ padding: "20px 22px", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="ta-row ta-between">
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Total Organizations</span>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(99, 102, 241, 0.12)", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Building2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text)", marginTop: 10, letterSpacing: "-0.02em" }}>
            {effectiveTotalOrgs}
          </div>
          <div className="ta-row ta-between" style={{ fontSize: 12, marginTop: 10, gap: 8, flexWrap: "wrap" }}>
            {/* "+20% QoQ" had no source - nothing snapshots historic org
                counts, so no quarter-over-quarter delta can be computed. */}
            {DEMO_MODE && (
            <span className="ta-row" style={{ gap: 4, color: "var(--success)", fontWeight: 700 }}>
              <TrendingUp size={14} /> +20% QoQ
            </span>
            )}
            {/* Was the literal "3 Enterprise, 2 Growth". Real counts of
                organizations.subscription_tier across the tenant list. */}
            <span style={{ color: "var(--text-3)" }}>
              {orgsQuery.loading ? "Loading tiers..." : tierMix || "No tenants yet"}
            </span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="ta-card" style={{ padding: "20px 22px", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="ta-row ta-between">
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Total Platform Users</span>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(79, 70, 229, 0.12)", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text)", marginTop: 10, letterSpacing: "-0.02em" }}>
            {effectiveTotalUsers.toLocaleString()}
          </div>
          <div className="ta-row ta-between" style={{ fontSize: 12, marginTop: 10, gap: 8, flexWrap: "wrap" }}>
            {/* "+14.2% MoM" had no source - user_profiles carries no signup
                history snapshot to diff month over month. */}
            {DEMO_MODE && (
            <span className="ta-row" style={{ gap: 4, color: "var(--success)", fontWeight: 700 }}>
              <TrendingUp size={14} /> +14.2% MoM
            </span>
            )}
            {/* Was the literal "4.8k active learners". This is the real 7-day
                active count fetchPlatformOverviewStats already returns. */}
            <span style={{ color: "var(--text-3)" }}>
              {effectiveActiveInWeek.toLocaleString()} active in last 7d
            </span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="ta-card" style={{ padding: "20px 22px", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="ta-row ta-between">
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Published Courses</span>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(16, 185, 129, 0.12)", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Layers size={18} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text)", marginTop: 10, letterSpacing: "-0.02em" }}>
            {effectiveTotalCourses}
          </div>
          <div className="ta-row ta-between" style={{ fontSize: 12, marginTop: 10, gap: 8, flexWrap: "wrap" }}>
            {/* "100% Accredited" is an accreditation claim with no backing -
                courses has no accreditation column at all. */}
            {DEMO_MODE && (
            <span className="ta-row" style={{ gap: 4, color: "var(--primary)", fontWeight: 700 }}>
              <CheckCircle2 size={14} /> 100% Accredited
            </span>
            )}
            {/* Was the literal "140 Total Modules". Real published-lesson
                count across published courses (fetchPlatformLessonCount). */}
            <span style={{ color: "var(--text-3)" }}>
              {DEMO_MODE ? "140 Total Modules" : lessonCountQuery.loading ? "Counting modules..." : `${(lessonCountQuery.data ?? 0).toLocaleString()} Total Modules`}
            </span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="ta-card" style={{ padding: "20px 22px", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="ta-row ta-between">
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Weekly Active Users (7d)</span>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(245, 158, 11, 0.12)", color: "#D97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Activity size={18} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text)", marginTop: 10, letterSpacing: "-0.02em" }}>
            {effectiveActiveInWeek.toLocaleString()}
          </div>
          <div className="ta-row ta-between" style={{ fontSize: 12, marginTop: 10, gap: 8, flexWrap: "wrap" }}>
            {/* "69.8% Engagement" and "4.2 avg hrs / learner" were both
                literals. There is no engagement metric and no per-learner
                study-hours table anywhere in the schema, so neither can be
                computed; the honest version of this card is the share of all
                users who were active in the last 7 days, which
                fetchPlatformOverviewStats already supplies both halves of. */}
            {DEMO_MODE ? (
              <>
                <span className="ta-row" style={{ gap: 4, color: "var(--success)", fontWeight: 700 }}>
                  <TrendingUp size={14} /> 69.8% Engagement
                </span>
                <span style={{ color: "var(--text-3)" }}>4.2 avg hrs / learner</span>
              </>
            ) : (
              <>
                <span className="ta-row" style={{ gap: 4, color: "var(--success)", fontWeight: 700 }}>
                  <TrendingUp size={14} /> {effectiveTotalUsers > 0 ? `${Math.round((effectiveActiveInWeek / effectiveTotalUsers) * 100)}% of all users` : "No users yet"}
                </span>
                <span style={{ color: "var(--text-3)" }}>of {effectiveTotalUsers.toLocaleString()} total</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          ANALYTICS VISUALIZATION & AI CONSUMPTION SPLIT
          ========================================================================= */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
        
        {/* Multi-Month Growth Chart */}
        <div className="ta-card" style={{ padding: 24, borderRadius: 18 }}>
          <div className="ta-row ta-between" style={{ paddingBottom: 16, borderBottom: "1px solid var(--border)", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div className="ta-title" style={{ fontSize: 16 }}>Platform Growth &amp; Enrollment Trajectory</div>
              <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Monthly active seats and course enrollments</div>
            </div>
            {/* The "ARR / MRR ($)" series is gone with a database connected:
                there is no revenue, invoice or subscription-amount table on
                this platform at all, so every figure it showed was invented.
                "Completions" replaces it because course_enrollments.completed_at
                is real and the trend query already returns it. */}
            <div className="ta-row ta-gap6">
              {(DEMO_MODE ? ["enrollments", "revenue"] : ["enrollments", "completions"]).map(m => (
                <button
                  key={m}
                  onClick={() => setActiveChartMetric(m)}
                  style={{
                    padding: "4px 10px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                    background: activeChartMetric === m ? "var(--primary)" : "var(--surface-3)",
                    color: activeChartMetric === m ? "#FFFFFF" : "var(--text-2)",
                    border: "none", transition: "all .15s ease"
                  }}
                >
                  {m === "enrollments" ? "Enrollments" : m === "completions" ? "Completions" : "ARR / MRR ($)"}
                </button>
              ))}
            </div>
          </div>

          {/* Bar Chart Visualization */}
          {trendQuery.loading && !DEMO_MODE ? (
            <div className="ta-empty" style={{ height: 210, display: "flex", alignItems: "center", justifyContent: "center" }}>Loading enrollment trend...</div>
          ) : growthSeries.length === 0 ? (
            <div className="ta-empty" style={{ height: 210, display: "flex", alignItems: "center", justifyContent: "center" }}>No course enrollments recorded in the last 6 months.</div>
          ) : (
          <div style={{ height: 210, display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingTop: 30, paddingBottom: 10, gap: 12, overflowX: "auto" }}>
            {growthSeries.map((item, idx) => {
              const raw = activeChartMetric === "revenue" ? (item.revenue || 0) : activeChartMetric === "completions" ? (item.completions || 0) : (item.enrollments || 0);
              const val = activeChartMetric === "revenue" ? `$${(raw / 1000).toFixed(1)}k` : raw;
              return (
                <div key={item.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)", marginBottom: 6 }}>
                    {val}
                  </div>
                  <div
                    style={{
                      width: "100%", maxWidth: 36,
                      height: `${Math.round((raw / growthMax) * 100)}%`,
                      background: idx === growthSeries.length - 1
                        ? "linear-gradient(180deg, #4F46E5 0%, #6366F1 100%)"
                        : "linear-gradient(180deg, rgba(99, 102, 241, 0.4) 0%, rgba(99, 102, 241, 0.15) 100%)",
                      borderRadius: "6px 6px 0 0",
                      transition: "all 0.3s ease"
                    }}
                  />
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 8, fontWeight: 600 }}>
                    {item.month.slice(0, 3)}
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* AI Engine Activity & Consumption Matrix */}
        <div className="ta-card" style={{ padding: 24, borderRadius: 18 }}>
          <div className="ta-row ta-between" style={{ paddingBottom: 16, borderBottom: "1px solid var(--border)", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div className="ta-title" style={{ fontSize: 16 }}>AI Inference Engine Telemetry</div>
              <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Gemini 2.5 Flash query distribution</div>
            </div>
            {/* Was `aiUsage?.total || "18,450"`, so a platform with no AI
                calls at all advertised 18,450 of them. fetchAIUsageStats is a
                real count over ai_usage_events and was already fetched here;
                `??` lets a genuine zero through. */}
            <Tag tone="primary"><Activity size={12} /> {aiUsageQuery.loading ? "..." : (aiUsage?.total ?? 0).toLocaleString()} Total Calls</Tag>
          </div>

          <div className="ta-col ta-gap16 anim-stagger" style={{ marginTop: 18 }}>
            {aiByFeatureQuery.loading && !DEMO_MODE && <div className="ta-empty">Loading AI usage breakdown...</div>}
            {!aiByFeatureQuery.loading && aiBreakdown.length === 0 && (
              <div className="ta-empty">No AI calls recorded yet.</div>
            )}
            {aiBreakdown.map((b, idx) => {
              const color = AI_SERIES_COLORS[idx % AI_SERIES_COLORS.length];
              return (
              <div key={b.feature}>
                <div className="ta-row ta-between" style={{ fontSize: 13, marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: "var(--text)" }}>{aiFeatureLabel(b.feature)}</span>
                  <span style={{ fontWeight: 800, color }}>{b.pct}% ({b.count.toLocaleString()} calls)</span>
                </div>
                <div style={{ width: "100%", height: 8, background: "var(--surface-3)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ width: `${b.pct}%`, height: "100%", background: color, borderRadius: 99 }} />
                </div>
              </div>
              );
            })}

            {/* Average prompt latency and inference error rate were the
                literals "340 ms" and "< 0.01%". ai_usage_events records that a
                call happened, not how long it took or whether it failed, and
                there is no provider-telemetry table - so neither figure can be
                derived and this panel only renders with no database. */}
            {DEMO_MODE && (
            <div style={{ background: "var(--surface-3)", padding: 14, borderRadius: 12, marginTop: 8 }}>
              <div className="ta-row ta-between" style={{ fontSize: 12.5 }}>
                <span style={{ color: "var(--text-2)", fontWeight: 600 }}>Average Prompt Response Latency:</span>
                <span style={{ color: "var(--success)", fontWeight: 800 }}>340 ms</span>
              </div>
              <div className="ta-row ta-between" style={{ fontSize: 12.5, marginTop: 6 }}>
                <span style={{ color: "var(--text-2)", fontWeight: 600 }}>Inference Error Rate:</span>
                <span style={{ color: "var(--text)", fontWeight: 800 }}>&lt; 0.01%</span>
              </div>
            </div>
            )}

            {/* Real, derivable AI volume the card can show instead: the 7- and
                30-day windows fetchAIUsageStats already returns. */}
            {!DEMO_MODE && aiUsage && (
            <div style={{ background: "var(--surface-3)", padding: 14, borderRadius: 12, marginTop: 8 }}>
              <div className="ta-row ta-between" style={{ fontSize: 12.5 }}>
                <span style={{ color: "var(--text-2)", fontWeight: 600 }}>Calls in last 7 days:</span>
                <span style={{ color: "var(--success)", fontWeight: 800 }}>{(aiUsage.last7d ?? 0).toLocaleString()}</span>
              </div>
              <div className="ta-row ta-between" style={{ fontSize: 12.5, marginTop: 6 }}>
                <span style={{ color: "var(--text-2)", fontWeight: 600 }}>Calls in last 30 days:</span>
                <span style={{ color: "var(--text)", fontWeight: 800 }}>{(aiUsage.last30d ?? 0).toLocaleString()}</span>
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          TENANT ORGANIZATIONS TABLE & AUDIT STREAM
          ========================================================================= */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
        
        {/* Tenant Table */}
        <div className="ta-card" style={{ padding: 24, borderRadius: 18 }}>
          <div className="ta-row ta-between" style={{ paddingBottom: 16, borderBottom: "1px solid var(--border)", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div className="ta-title" style={{ fontSize: 16 }}>Tenant Organizations</div>
              <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Multi-tenant seat allocations &amp; statuses</div>
            </div>
            {/* Counted every row as "Active" regardless of status. */}
            <Tag tone="primary">{orgs.filter((o) => o.status === "active").length} Active Tenants</Tag>
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
                      {/* Was `o.user_count || 120`, so an organization with no
                          members showed 120 learners. fetchAllOrganizationsWithUserCounts
                          returns the real user_profiles count per org. */}
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{o.user_count ?? 0} learners</div>
                    </td>
                    <td>
                      {/* An org with no subscription_tier set was labelled
                          GROWTH. Unset is now shown as unset. */}
                      <Tag tone={o.subscription_tier === "enterprise" ? "primary" : "neutral"}>
                        {o.subscription_tier ? o.subscription_tier.toUpperCase() : "—"}
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
        <div className="ta-card" style={{ padding: 24, borderRadius: 18 }}>
          <div className="ta-row ta-between" style={{ paddingBottom: 16, borderBottom: "1px solid var(--border)", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div className="ta-title" style={{ fontSize: 16 }}>Live Platform Audit Stream</div>
              <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Real-time events from safe_admin_audit_log</div>
            </div>
            <Tag tone={activityQuery.loading ? "neutral" : activity.length > 0 ? "success" : "neutral"}>
              {activityQuery.loading ? "Loading" : activity.length > 0 ? "Streaming" : "Idle"}
            </Tag>
          </div>

          {/* This card is labelled "Real-time events from safe_admin_audit_log"
              but fell back to five invented events ("Sara Foundation
              provisioned 45 new learner seats...") whenever the real log came
              back empty - a fabricated audit trail under a real table's name.
              fetchRecentPlatformActivity was already wired; an empty log is
              now reported as empty. */}
          <div className="ta-col ta-gap12 anim-stagger" style={{ marginTop: 14 }}>
            {activityQuery.error && (
              <div className="ta-empty">Couldn't load recent activity: {activityQuery.error}</div>
            )}
            {activityQuery.loading && <div className="ta-empty">Loading audit events...</div>}
            {!activityQuery.loading && !activityQuery.error && activity.length === 0 && (
              <div className="ta-empty">No administrative events recorded yet.</div>
            )}
            {activity.slice(0, 5).map((a, i) => (
              <div key={i} className="ta-row ta-between" style={{ padding: "10px 12px", background: "var(--surface-3)", borderRadius: 12, border: "1px solid var(--border)" }}>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>

        <div className="ta-card" style={{ padding: 24, borderRadius: 18 }}>
          <div className="ta-row ta-gap8" style={{ paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
            <Activity size={16} color={healthQuery.data?.ok ? "var(--success)" : "var(--danger)"} />
            <div className="ta-title" style={{ fontSize: 16 }}>Platform Health</div>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 10 }}>
            A real, live check against this database, run when this page loads - not a fabricated uptime percentage.
          </div>
          <div className="ta-row ta-gap10" style={{ marginTop: 14, flexWrap: "wrap" }}>
            <Tag tone={healthQuery.data?.ok ? "success" : "danger"}>{healthQuery.loading ? "Checking..." : healthQuery.data?.ok ? "Database reachable" : "Database unreachable"}</Tag>
            {healthQuery.data?.latencyMs != null && <span style={{ fontSize: 12, color: "var(--text-2)" }}>{healthQuery.data.latencyMs}ms round trip</span>}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 8 }}>
            Last checked: {healthQuery.data?.checkedAt ? new Date(healthQuery.data.checkedAt).toLocaleTimeString() : "-"}
          </div>
        </div>

        <div className="ta-card" style={{ padding: 24, borderRadius: 18 }}>
          <div className="ta-row ta-gap8" style={{ paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
            <TrendingDown size={16} color="var(--danger)" />
            <div className="ta-title" style={{ fontSize: 16 }}>Churn</div>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 10 }}>
            Built from the real organization suspension history (admin_audit_log).
          </div>
          <div className="ta-row ta-gap16" style={{ marginTop: 14 }}>
            <div><div style={{ fontSize: 22, fontWeight: 800 }}>{churnQuery.data?.suspendedLast30d ?? 0}</div><div style={{ fontSize: 11, color: "var(--text-2)" }}>Suspended, last 30d</div></div>
            <div><div style={{ fontSize: 22, fontWeight: 800 }}>{churnQuery.data?.suspendedLast90d ?? 0}</div><div style={{ fontSize: 11, color: "var(--text-2)" }}>Suspended, last 90d</div></div>
            <div><div style={{ fontSize: 22, fontWeight: 800 }}>{churnQuery.data?.totalActive ?? 0}</div><div style={{ fontSize: 11, color: "var(--text-2)" }}>Currently active</div></div>
          </div>
        </div>

        <div className="ta-card" style={{ padding: 24, borderRadius: 18 }}>
          <div className="ta-row ta-gap8" style={{ paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
            <Megaphone size={16} color="var(--primary)" />
            <div className="ta-title" style={{ fontSize: 16 }}>Campaign Attribution</div>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 10 }}>
            Demo requests and organisation inquiries, grouped by the real utm_campaign/utm_source captured at signup.
          </div>
          <div className="ta-col ta-gap6" style={{ marginTop: 14 }}>
            {(campaignQuery.data || []).length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)" }}>No campaign-tagged leads yet.</div>}
            {(campaignQuery.data || []).slice(0, 5).map((c) => (
              <div key={c.campaign} className="ta-row ta-between" style={{ fontSize: 12.5 }}>
                <span>{c.campaign}</span>
                <span style={{ fontWeight: 700 }}>{c.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* fetchWebsitePerformanceStats was already being fetched on this
            screen and its result assigned to `websiteStats`, which nothing
            then referenced - a real query whose output was discarded while
            invented figures rendered elsewhere on the page. It aggregates
            genuine demo_requests and organization_inquiries rows, so it is
            rendered rather than removed. */}
        <div className="ta-card" style={{ padding: 24, borderRadius: 18 }}>
          <div className="ta-row ta-gap8" style={{ paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
            <Globe size={16} color="var(--primary)" />
            <div className="ta-title" style={{ fontSize: 16 }}>Website Conversion</div>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 10 }}>
            Real Book a Demo and Organisation Inquiry submissions from the public site.
          </div>
          {websiteStatsQuery.loading ? (
            <div className="ta-empty ta-mt12">Loading website stats...</div>
          ) : (
            <div className="ta-col ta-gap6" style={{ marginTop: 14 }}>
              <div className="ta-row ta-between" style={{ fontSize: 12.5 }}>
                <span style={{ color: "var(--text-2)" }}>Demo requests (all time)</span>
                <span style={{ fontWeight: 700 }}>{websiteStats?.demoRequestsTotal ?? 0}</span>
              </div>
              <div className="ta-row ta-between" style={{ fontSize: 12.5 }}>
                <span style={{ color: "var(--text-2)" }}>Demo requests (last 30d)</span>
                <span style={{ fontWeight: 700 }}>{websiteStats?.demoRequestsLast30d ?? 0}</span>
              </div>
              <div className="ta-row ta-between" style={{ fontSize: 12.5 }}>
                <span style={{ color: "var(--text-2)" }}>Unactioned demo requests</span>
                <span style={{ fontWeight: 700 }}>{websiteStats?.demoRequestsNew ?? 0}</span>
              </div>
              <div className="ta-row ta-between" style={{ fontSize: 12.5 }}>
                <span style={{ color: "var(--text-2)" }}>Organisation inquiries (all time)</span>
                <span style={{ fontWeight: 700 }}>{websiteStats?.inquiriesTotal ?? 0}</span>
              </div>
              <div className="ta-row ta-between" style={{ fontSize: 12.5 }}>
                <span style={{ color: "var(--text-2)" }}>Organisation inquiries (last 30d)</span>
                <span style={{ fontWeight: 700 }}>{websiteStats?.inquiriesLast30d ?? 0}</span>
              </div>
              <div className="ta-row ta-between" style={{ fontSize: 12.5 }}>
                <span style={{ color: "var(--text-2)" }}>Unactioned inquiries</span>
                <span style={{ fontWeight: 700 }}>{websiteStats?.inquiriesNew ?? 0}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
