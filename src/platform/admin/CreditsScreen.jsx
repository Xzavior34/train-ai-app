import React, { useState, useContext, useMemo } from "react";
import { TopBar, Tag, Avatar, ToastContext, exportRowsAsCsv } from "../components/PlatformUI.jsx";
import {
  CreditCard, Zap, Loader2, Search, TrendingUp, AlertTriangle,
  Users, CheckCircle2, ShieldAlert, ArrowUpDown, ChevronDown,
  Download, Activity, Clock, Layers, Filter, Eye, X, RefreshCw
} from "lucide-react";
import { PortalModal } from "../../components/common/PortalModal.jsx";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchOrgAllUsersAICreditMonitoring,
  startOrgCreditsPurchasePayment, orgCreditUnitPrice,
  fetchOrgFeatures,
} from "../../lib/api/organizations.js";
import { fetchOrganizationById } from "../../lib/api/platform.js";
import { orgHasFeature, minTierLabelFor } from "../../lib/tierFeatures.js";
import { getUserLocationCurrency } from "../../lib/locationCurrency.js";

const OPERATION_LABELS = {
  ai_chat_message: "AI Coach Chat",
  quiz_generation: "AI Quiz Generation",
  ai_insight: "AI Insight",
  ai_recommendation: "AI Recommendation",
  sara_foundation_initial_grant: "Initial Grant",
  payment_reference: "Credit Purchase",
  ai_general: "AI Operation",
};

export function CreditsScreen({ orgId, orgSelector, userEmail }) {
  const showToast = useContext(ToastContext);

  // Authoritative full monitoring query (queries all members, credit accounts, and transactions in parallel)
  const monitoringQuery = useSupabaseQuery(
    async () => (orgId ? fetchOrgAllUsersAICreditMonitoring(orgId) : null),
    [orgId]
  );

  const monitoring = monitoringQuery.data || {
    orgSummary: { balance: 0, lifetime_credited: 0, lifetime_consumed: 0 },
    users: [],
    stats: {
      totalMembers: 0,
      orgPoolBalance: 0,
      totalPersonalCredits: 0,
      totalCombinedCredits: 0,
      totalConsumed: 0,
      activeConsumersCount: 0,
      zeroUsageCount: 0,
      depletedCount: 0,
    },
  };

  const users = monitoring.users || [];
  const stats = monitoring.stats;
  const orgSummary = monitoring.orgSummary;

  const orgQuery = useSupabaseQuery(async () => (orgId ? fetchOrganizationById(orgId) : null), [orgId]);
  const featuresQuery = useSupabaseQuery(async () => (orgId ? fetchOrgFeatures(orgId, ["analytics_export"]) : null), [orgId]);
  const orgTier = orgQuery.data?.subscription_tier || "starter";
  const canExport = featuresQuery.data ? !!featuresQuery.data.analytics_export : orgHasFeature(orgTier, "analytics_export");

  // Local state for UI controls
  const userLoc = useMemo(() => getUserLocationCurrency(), []);
  const [quantity, setQuantity] = useState(500);
  const [starting, setStarting] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'active' | 'ready' | 'depleted'
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortBy, setSortBy] = useState("consumed_desc");
  const [selectedUser, setSelectedUser] = useState(null);

  const currency = userLoc.currency;
  const provider = userLoc.provider;
  const unitPrice = orgCreditUnitPrice(currency);
  const totalPrice = Math.max(0, Number(quantity) || 0) * unitPrice;
  const symbol = userLoc.symbol;

  async function handleBuy() {
    if (!orgId || !userEmail) {
      showToast?.("Missing organization or admin email.");
      return;
    }
    setStarting(true);
    try {
      const res = await startOrgCreditsPurchasePayment({ orgId, credits: quantity, email: userEmail, provider });
      if (!res.success) {
        showToast?.(res.error || "Could not start payment.");
        setStarting(false);
      }
    } catch (e) {
      showToast?.(e?.message || "Could not start payment.");
      setStarting(false);
    }
  }

  // Filtered and sorted workforce list
  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => {
        // Tab filtering
        if (activeTab === "active" && u.totalConsumed <= 0) return false;
        if (activeTab === "ready" && (u.totalConsumed > 0 || u.effectiveBalance === 0)) return false;
        if (activeTab === "depleted" && u.effectiveBalance > 20) return false;

        // Role filtering
        if (roleFilter !== "all" && (u.role || "learner") !== roleFilter) return false;

        // Text search
        if (search.trim()) {
          const term = search.trim().toLowerCase();
          const matchName = (u.displayName || "").toLowerCase().includes(term);
          const matchRole = (u.role || "").toLowerCase().includes(term);
          const matchDept = (u.department || "").toLowerCase().includes(term);
          if (!matchName && !matchRole && !matchDept) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "consumed_desc") return b.totalConsumed - a.totalConsumed;
        if (sortBy === "consumed_asc") return a.totalConsumed - b.totalConsumed;
        if (sortBy === "left_desc") return b.effectiveBalance - a.effectiveBalance;
        if (sortBy === "left_asc") return a.effectiveBalance - b.effectiveBalance;
        if (sortBy === "events_desc") return b.eventCount - a.eventCount;
        if (sortBy === "name_asc") return (a.displayName || "").localeCompare(b.displayName || "");
        return 0;
      });
  }, [users, activeTab, roleFilter, search, sortBy]);

  // Export filtered rows to CSV
  function handleExportCsv() {
    if (!canExport) {
      showToast?.(`Data downloads require the ${minTierLabelFor("analytics_export")} plan or higher.`);
      return;
    }
    if (!filteredUsers.length) {
      showToast?.("No member rows to export.");
      return;
    }
    const rows = filteredUsers.map((u) => ({
      "Member Name": u.displayName,
      "Role": u.role,
      "Department": u.department || "N/A",
      "Personal Credits Left": u.personalBalance,
      "Org Pool Balance": u.orgPoolBalance,
      "Effective Credits Left": u.effectiveBalance,
      "Credits Consumed": u.totalConsumed,
      "Total AI Calls": u.eventCount,
      "Last AI Interaction": u.lastAiUsedAt ? new Date(u.lastAiUsedAt).toLocaleString() : "Never",
      "Status": u.status,
    }));
    exportRowsAsCsv(`workforce-ai-credits-monitoring-${orgId || "org"}.csv`, rows);
    showToast?.(`Exported ${rows.length} workforce AI credit records to CSV.`);
  }

  return (
    <div className="ta-fade">
      <TopBar
        title="AI Credits & Usage Monitor"
        sub="Monitor workforce AI consumption, track remaining balances, and manage organization pool credits"
        orgSelector={orgSelector}
      />

      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Hero Banner with High-Level Workforce KPI Metrics */}
        <div className="ta-hero-banner anim-fluid-entrance">
          <div className="tai-glow-amber" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(59, 130, 246, 0.2)", padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: "#93C5FD", marginBottom: 8 }}>
                <ShieldCheck size={12} />
                <span>Workforce AI Governance</span>
              </div>
              <h1 className="ta-hero-title">Workforce AI Credits &amp; Balances</h1>
              <p className="ta-hero-desc">
                Live audit of all {stats.totalMembers.toLocaleString()} members across your organization. Monitor individual AI activity and verify how much credits each user has left to draw upon.
              </p>
            </div>

            <div className="ta-hero-actions credits-hero-metrics">
              {/* Org Pool Card */}
              <div className="tai-hero-subcard credits-subcard">
                <div className="credits-subcard-title">Org Pool Balance</div>
                <div className="credits-subcard-value" style={{ color: "#60A5FA" }}>
                  {monitoringQuery.loading ? "..." : (orgSummary.balance ?? 0).toLocaleString()}
                </div>
                <div className="credits-subcard-sub">Shared Pool Remaining</div>
              </div>

              {/* Total Personal Credits Left across workforce */}
              <div className="tai-hero-subcard credits-subcard">
                <div className="credits-subcard-title">Workforce Personal</div>
                <div className="credits-subcard-value" style={{ color: "#34D399" }}>
                  {monitoringQuery.loading ? "..." : (stats.totalPersonalCredits ?? 0).toLocaleString()}
                </div>
                <div className="credits-subcard-sub">Held Across {stats.totalMembers} Users</div>
              </div>

              {/* Combined Total Available */}
              <div className="tai-hero-subcard credits-subcard">
                <div className="credits-subcard-title">Total Credits Left</div>
                <div className="credits-subcard-value" style={{ color: "#FBBF24" }}>
                  {monitoringQuery.loading ? "..." : (stats.totalCombinedCredits ?? 0).toLocaleString()}
                </div>
                <div className="credits-subcard-sub">Pool + Personal Remaining</div>
              </div>

              {/* Total Consumed */}
              <div className="tai-hero-subcard credits-subcard">
                <div className="credits-subcard-title">Total Consumed</div>
                <div className="credits-subcard-value" style={{ color: "#F87171" }}>
                  {monitoringQuery.loading ? "..." : (stats.totalConsumed ?? 0).toLocaleString()}
                </div>
                <div className="credits-subcard-sub">{stats.activeConsumersCount} Active Consumers</div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Up Organization Credits & Allocation Rules Grid */}
        <div className="ta-grid ta-grid-2 anim-stagger">
          {/* Buy AI Credits */}
          <div className="ta-card">
            <div className="ta-row ta-gap8" style={{ alignItems: "center", marginBottom: 4 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CreditCard size={17} color="var(--primary)" />
              </div>
              <div>
                <div className="ta-label" style={{ margin: 0, fontSize: 14 }}>Top Up Organization Pool Credits</div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>Shared by all learners when individual credits reach 0</div>
              </div>
            </div>

            <p className="ta-body" style={{ marginTop: 8, marginBottom: 14, fontSize: 12.5 }}>
              Credits purchased here enter your organization's shared pool. Users automatically consume shared pool credits when generating quizzes, asking AI Coach questions, or running AI learning insights.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label className="ta-label" style={{ display: "block", marginBottom: 6 }}>Number of Credits</label>
                <input
                  type="number"
                  min={50}
                  step={50}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)",
                    background: "var(--surface-2)", color: "var(--text)", fontSize: 14, fontWeight: 700,
                  }}
                />
              </div>

              <div>
                <label className="ta-label" style={{ display: "block", marginBottom: 6 }}>Billed In</label>
                <div style={{
                  padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)",
                  background: "var(--surface-2)", color: "var(--text)", fontSize: 12.5, fontWeight: 700,
                  display: "flex", alignItems: "center", height: 42, boxSizing: "border-box"
                }}>
                  {userLoc.name} ({currency} • {symbol})
                </div>
              </div>
            </div>

            <div className="ta-row ta-between" style={{ padding: "10px 14px", background: "var(--surface-2)", borderRadius: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>Total Charge ({quantity || 0} credits @ {symbol}{unitPrice}/credit)</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: "var(--text)" }}>{symbol}{totalPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>

            <button
              className="ta-btn ta-btn-primary"
              disabled={starting || !quantity || Number(quantity) <= 0}
              onClick={handleBuy}
              style={{ width: "100%", height: 42, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {starting ? <Loader2 size={15} className="ta-spin" /> : <Zap size={15} />}
              {starting ? "Connecting to payment gateway..." : `Pay ${symbol}${totalPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} with ${provider === "stripe" ? "Stripe" : "Paystack"}`}
            </button>
          </div>

          {/* AI Credit Governance & Allocation Rules */}
          <div className="ta-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div className="ta-row ta-gap8" style={{ alignItems: "center", marginBottom: 6 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Layers size={17} color="var(--success)" />
                </div>
                <div>
                  <div className="ta-label" style={{ margin: 0, fontSize: 14 }}>Workforce AI Metering Rules</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>How credits are deducted and allocated</div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                <div className="ta-row ta-gap8" style={{ alignItems: "flex-start", background: "var(--surface-2)", padding: "10px 12px", borderRadius: 8 }}>
                  <CheckCircle2 size={15} color="var(--success)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.4 }}>
                    <strong>Personal Credits First:</strong> Each user automatically starts with their personal grant (e.g. 10 initial credits). AI usage deducts from personal credits first.
                  </div>
                </div>

                <div className="ta-row ta-gap8" style={{ alignItems: "flex-start", background: "var(--surface-2)", padding: "10px 12px", borderRadius: 8 }}>
                  <CheckCircle2 size={15} color="var(--primary)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.4 }}>
                    <strong>Shared Org Pool Fallback:</strong> If a user's personal balance reaches 0, their AI interactions automatically draw from the organization's shared pool.
                  </div>
                </div>

                <div className="ta-row ta-gap8" style={{ alignItems: "flex-start", background: "var(--surface-2)", padding: "10px 12px", borderRadius: 8 }}>
                  <ShieldAlert size={15} color="var(--warning)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.4 }}>
                    <strong>Hard Cutoff When Depleted:</strong> When both personal balance and organization pool balance reach 0, all AI features are hard gated to protect against unauthorized costs.
                  </div>
                </div>
              </div>
            </div>

            <div className="ta-row ta-between" style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
              <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>Need an offline audit?</span>
              <button
                className="ta-btn ta-btn-outline"
                onClick={handleExportCsv}
                style={{ fontSize: 12, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Download size={13} />
                <span>Export Workforce CSV ({filteredUsers.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Workforce AI Usage & Remaining Balances Hub */}
        <div className="ta-card" style={{ padding: "18px 20px" }}>
          <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div>
              <div className="ta-row ta-gap8" style={{ alignItems: "center" }}>
                <Users size={17} color="var(--primary)" />
                <div className="ta-label" style={{ margin: 0, fontSize: 15 }}>Workforce AI Usage &amp; Remaining Balances</div>
              </div>
              <div className="ta-body" style={{ marginTop: 4, fontSize: 12 }}>
                {monitoringQuery.loading
                  ? "Loading workforce credit accounts..."
                  : `Showing ${filteredUsers.length} of ${users.length} members · ${stats.totalConsumed.toLocaleString()} credits used total`}
              </div>
            </div>

            <div className="ta-row ta-gap8" style={{ flexWrap: "wrap", alignItems: "center", width: "100%", maxWidth: "100%" }}>
              {/* Search Bar */}
              <div className="ta-search" style={{ flex: "1 1 180px", minWidth: 140, maxWidth: "100%" }}>
                <Search size={14} color="var(--text-3)" />
                <input
                  type="text"
                  placeholder="Search by name or role..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              {/* Role Filter Dropdown */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{
                  padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)",
                  background: "var(--surface)", color: "var(--text)", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", outline: "none", flex: "1 1 auto"
                }}
              >
                <option value="all">All Roles</option>
                <option value="learner">Learners</option>
                <option value="mentor">Instructors</option>
                <option value="admin">Admins</option>
                <option value="manager">Managers</option>
              </select>

              {/* Sort By Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)",
                  background: "var(--surface)", color: "var(--text)", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", outline: "none", flex: "1 1 auto"
                }}
              >
                <option value="consumed_desc">Sort: Most Credits Used</option>
                <option value="consumed_asc">Sort: Least Credits Used</option>
                <option value="left_desc">Sort: Most Credits Left</option>
                <option value="left_asc">Sort: Lowest Credits Left</option>
                <option value="events_desc">Sort: Most AI Calls</option>
                <option value="name_asc">Sort: Name (A-Z)</option>
              </select>

              {/* Refresh */}
              <button
                className="ta-btn ta-btn-outline"
                onClick={() => monitoringQuery.refetch?.()}
                title="Refresh ledger"
                style={{ padding: "6px 10px", flexShrink: 0 }}
              >
                <RefreshCw size={13} className={monitoringQuery.loading ? "ta-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="ta-tabs" style={{ marginBottom: 16 }}>
            <div
              className={`ta-tab ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              All Members ({users.length})
            </div>
            <div
              className={`ta-tab ${activeTab === "active" ? "active" : ""}`}
              onClick={() => setActiveTab("active")}
            >
              Active Consumers ({stats.activeConsumersCount})
            </div>
            <div
              className={`ta-tab ${activeTab === "ready" ? "active" : ""}`}
              onClick={() => setActiveTab("ready")}
            >
              Full Balance Unused ({stats.zeroUsageCount})
            </div>
            <div
              className={`ta-tab ${activeTab === "depleted" ? "active" : ""}`}
              onClick={() => setActiveTab("depleted")}
            >
              Low / Depleted (≤ 20 Credits) ({stats.depletedCount})
            </div>
          </div>

          {/* Table Loading State */}
          {monitoringQuery.loading && (
            <div className="ta-empty" style={{ padding: "40px 20px" }}>
              <Loader2 size={24} className="ta-spin" style={{ margin: "0 auto 12px", color: "var(--primary)" }} />
              <div>Auditing workforce AI credit accounts...</div>
            </div>
          )}

          {/* Empty State */}
          {!monitoringQuery.loading && filteredUsers.length === 0 && (
            <div className="ta-empty" style={{ padding: "40px 20px" }}>
              <AlertTriangle size={24} style={{ margin: "0 auto 8px", color: "var(--text-3)" }} />
              <div style={{ fontWeight: 700, marginBottom: 4 }}>No members found</div>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                {users.length === 0
                  ? "No user profiles found in this organization."
                  : "No member matches the current search and filter settings."}
              </div>
            </div>
          )}

          {/* Workforce Monitoring Data Table */}
          {!monitoringQuery.loading && filteredUsers.length > 0 && (
            <div className="ta-table-wrap" style={{ overflowX: "auto", borderRadius: 12, border: "1px solid var(--border)", WebkitOverflowScrolling: "touch" }}>
              <table className="ta-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
                <thead>
                  <tr style={{ background: "var(--surface-2)", textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-3)" }}>
                    <th style={{ padding: "12px 16px" }}>Member</th>
                    <th style={{ padding: "12px 16px" }}>Credits Left (Remaining)</th>
                    <th style={{ padding: "12px 16px" }}>AI Usage (Consumed)</th>
                    <th style={{ padding: "12px 16px" }}>AI Activity</th>
                    <th style={{ padding: "12px 16px" }}>Access Status</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const initials = (u.displayName || "U")
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();

                    const isDepleted = u.effectiveBalance === 0;
                    const isLow = u.effectiveBalance > 0 && u.effectiveBalance <= 20;
                    const hasSharedPool = u.orgPoolBalance > 0;

                    return (
                      <tr key={u.userId} style={{ borderBottom: "1px solid var(--border)" }}>
                        {/* Member Identity Column */}
                        <td style={{ padding: "12px 16px" }}>
                          <div className="ta-row ta-gap10" style={{ alignItems: "center" }}>
                            <Avatar src={u.avatarUrl} initials={initials} size={34} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {u.displayName}
                              </div>
                              <div className="ta-row ta-gap6" style={{ marginTop: 2, alignItems: "center" }}>
                                <span style={{ fontSize: 10.5, textTransform: "capitalize", padding: "1px 6px", borderRadius: 4, background: "var(--surface-2)", color: "var(--text-2)", fontWeight: 600 }}>
                                  {u.role || "learner"}
                                </span>
                                {u.department && (
                                  <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>• {u.department}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Credits Left (Remaining Balance) Column */}
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <div className="ta-row ta-gap6" style={{ alignItems: "center" }}>
                              <span style={{
                                fontSize: 14,
                                fontWeight: 900,
                                color: isDepleted ? "var(--danger)" : isLow ? "var(--warning)" : "var(--success)"
                              }}>
                                {u.effectiveBalance.toLocaleString()} credits left
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                              {u.personalBalance} personal
                              {hasSharedPool ? ` + ${u.orgPoolBalance} pool` : " remaining"}
                            </div>
                          </div>
                        </td>

                        {/* Credits Used (Consumed) Column */}
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: u.totalConsumed > 0 ? "var(--text)" : "var(--text-3)" }}>
                              {u.totalConsumed > 0 ? `${u.totalConsumed.toLocaleString()} credits used` : "0 credits used"}
                            </div>
                            {/* Feature Operation Chips */}
                            {u.totalConsumed > 0 && (
                              <div className="ta-row ta-gap4" style={{ flexWrap: "wrap" }}>
                                {Object.entries(u.operations || {}).map(([key, count]) => (
                                  <span key={key} style={{ fontSize: 9.5, background: "var(--surface-2)", padding: "1px 5px", borderRadius: 4, color: "var(--text-2)", fontWeight: 600 }}>
                                    {count} {key.replace(/^ai_/, "").replace(/_/g, " ")}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* AI Activity (Event count & timestamp) Column */}
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                              {u.eventCount > 0 ? `${u.eventCount} AI call${u.eventCount === 1 ? "" : "s"}` : "No AI calls yet"}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                              {u.lastAiUsedAt ? `Last active ${new Date(u.lastAiUsedAt).toLocaleDateString()}` : "Unused"}
                            </div>
                          </div>
                        </td>

                        {/* Access Status Column */}
                        <td style={{ padding: "12px 16px" }}>
                          {isDepleted ? (
                            <Tag tone="danger" icon={ShieldAlert}>Depleted (0 left)</Tag>
                          ) : isLow ? (
                            <Tag tone="warning" icon={AlertTriangle}>Low ({u.effectiveBalance} left)</Tag>
                          ) : u.totalConsumed > 0 ? (
                            <Tag tone="primary" icon={TrendingUp}>Active Consumer</Tag>
                          ) : (
                            <Tag tone="success" icon={CheckCircle2}>Full Credits ({u.personalBalance})</Tag>
                          )}
                        </td>

                        {/* Inspect / Ledger Action */}
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          <button
                            className="ta-btn ta-btn-outline"
                            onClick={() => setSelectedUser(u)}
                            style={{ padding: "5px 10px", fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 5 }}
                          >
                            <Eye size={12} />
                            <span>Details</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Member AI Credit Inspection Modal */}
      {selectedUser && (
        <PortalModal
          isOpen={true}
          onClose={() => setSelectedUser(null)}
          title="Member AI Credit & Usage Audit"
          maxWidth={620}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Header User Card */}
            <div className="ta-row ta-between" style={{ alignItems: "center", background: "var(--surface-2)", padding: "12px 16px", borderRadius: 12 }}>
              <div className="ta-row ta-gap12" style={{ alignItems: "center" }}>
                <Avatar
                  src={selectedUser.avatarUrl}
                  initials={(selectedUser.displayName || "U").slice(0, 2).toUpperCase()}
                  size={42}
                />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>{selectedUser.displayName}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)", textTransform: "capitalize" }}>
                    {selectedUser.role || "Learner"} {selectedUser.department ? `• ${selectedUser.department}` : ""}
                  </div>
                </div>
              </div>

              {selectedUser.effectiveBalance === 0 ? (
                <Tag tone="danger" icon={ShieldAlert}>Depleted (0 Credits)</Tag>
              ) : selectedUser.effectiveBalance <= 2 ? (
                <Tag tone="warning" icon={AlertTriangle}>Low Balance</Tag>
              ) : (
                <Tag tone="success" icon={CheckCircle2}>Active Balance</Tag>
              )}
            </div>

            {/* Balances Breakdown Tiles */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              <div style={{ background: "var(--surface-3)", border: "1px solid var(--border)", padding: "10px 12px", borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>Personal Balance Left</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: selectedUser.personalBalance === 0 ? "var(--danger)" : "var(--success)", marginTop: 2 }}>
                  {selectedUser.personalBalance.toLocaleString()}
                </div>
                <div style={{ fontSize: 9.5, color: "var(--text-3)" }}>Individual account</div>
              </div>

              <div style={{ background: "var(--surface-3)", border: "1px solid var(--border)", padding: "10px 12px", borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>Org Pool Available</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#60A5FA", marginTop: 2 }}>
                  {selectedUser.orgPoolBalance.toLocaleString()}
                </div>
                <div style={{ fontSize: 9.5, color: "var(--text-3)" }}>Shared across org</div>
              </div>

              <div style={{ background: "var(--surface-3)", border: "1px solid var(--border)", padding: "10px 12px", borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>Total Effective Left</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: selectedUser.effectiveBalance === 0 ? "var(--danger)" : "#FBBF24", marginTop: 2 }}>
                  {selectedUser.effectiveBalance.toLocaleString()}
                </div>
                <div style={{ fontSize: 9.5, color: "var(--text-3)" }}>Draw power</div>
              </div>
            </div>

            {/* Lifetime Usage Stats */}
            <div className="ta-row ta-between" style={{ padding: "10px 14px", background: "var(--surface-2)", borderRadius: 10, fontSize: 12.5 }}>
              <div>
                <span style={{ color: "var(--text-3)" }}>Lifetime Credited: </span>
                <strong>{selectedUser.lifetimeCredited.toLocaleString()} credits</strong>
              </div>
              <div>
                <span style={{ color: "var(--text-3)" }}>Lifetime Consumed: </span>
                <strong style={{ color: "var(--primary)" }}>{selectedUser.totalConsumed.toLocaleString()} credits</strong>
              </div>
              <div>
                <span style={{ color: "var(--text-3)" }}>AI Calls: </span>
                <strong>{selectedUser.eventCount}</strong>
              </div>
            </div>

            {/* Feature Usage Breakdown */}
            <div>
              <div className="ta-label" style={{ marginBottom: 6, fontSize: 12 }}>Feature Consumption Breakdown</div>
              {Object.keys(selectedUser.operations || {}).length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-3)", padding: "8px 0" }}>No AI feature usage recorded yet for this member.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                  {Object.entries(selectedUser.operations || {}).map(([op, count]) => (
                    <div key={op} className="ta-row ta-between" style={{ padding: "8px 12px", borderRadius: 8, background: "var(--surface-2)", fontSize: 12 }}>
                      <span style={{ color: "var(--text-2)", fontWeight: 600 }}>{OPERATION_LABELS[op] || op}</span>
                      <strong style={{ color: "var(--primary)" }}>{count} call{count === 1 ? "" : "s"}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Transaction Ledger */}
            <div>
              <div className="ta-label" style={{ marginBottom: 6, fontSize: 12 }}>Recent Credit Transactions</div>
              {(!selectedUser.recentTransactions || selectedUser.recentTransactions.length === 0) ? (
                <div style={{ fontSize: 12, color: "var(--text-3)", padding: "8px 0" }}>No transactions found for this user.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {selectedUser.recentTransactions.map((tx) => {
                    const isConsumption = tx.transaction_type === "consumption";
                    return (
                      <div key={tx.id} className="ta-row ta-between" style={{ padding: "8px 12px", borderRadius: 8, background: "var(--surface-2)", fontSize: 12, alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--text)" }}>
                            {OPERATION_LABELS[tx.reference_type] || tx.reference_type || tx.transaction_type}
                          </div>
                          <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                            {new Date(tx.created_at).toLocaleString()}
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <span style={{
                            fontWeight: 800,
                            color: isConsumption ? "var(--danger)" : "var(--success)"
                          }}>
                            {isConsumption ? `-${Math.abs(tx.amount)}` : `+${tx.amount}`} credit{Math.abs(tx.amount) === 1 ? "" : "s"}
                          </span>
                          {tx.balance_after !== undefined && (
                            <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>Balance: {tx.balance_after}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="ta-row ta-end" style={{ marginTop: 8 }}>
              <button
                className="ta-btn ta-btn-primary"
                onClick={() => setSelectedUser(null)}
                style={{ padding: "8px 18px", fontSize: 13 }}
              >
                Close Audit
              </button>
            </div>
          </div>
        </PortalModal>
      )}
    </div>
  );
}

export default CreditsScreen;
