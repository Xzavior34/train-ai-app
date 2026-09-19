import React, { useState, useContext, useMemo } from "react";
import { TopBar, Tag, ToastContext, Switch } from "../components/PlatformUI.jsx";
import {
  Plus, Building2, ExternalLink, ShieldCheck, Rocket, Settings, CreditCard,
  Lock, Unlock, LayoutGrid, List, Users, Search, Edit3, Trash2, Layers, MapPin, CheckCircle2
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchAllOrganizationsWithUserCounts,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  setOrganizationStatus,
  fetchPlatformOrganizationPayments
} from "../../lib/api/platform.js";
import { fetchOrgFeatureFlagOverrides, setOrgFeatureFlag, fetchOrgSeatsSummary } from "../../lib/api/organizations.js";

const FEATURE_KEYS = [
  { key: "learner_view", label: "Learner view" },
  { key: "instructor_view", label: "Instructor view" },
  { key: "manager_view", label: "Manager view" },
  { key: "admin_view", label: "Admin view" },
  { key: "ai_intelligence_layer", label: "AI Intelligence Layer" },
  { key: "ai_intelligence_advanced", label: "AI Intelligence Layer (Advanced)" },
  { key: "sso", label: "SSO" },
  { key: "api_integrations", label: "API integrations" },
  { key: "analytics_export", label: "Analytics export" },
  { key: "multi_department_breakdown", label: "Multi-department breakdown" },
  { key: "custom_branding", label: "Custom branding" },
];

const TIERS = ["free", "starter", "growth", "enterprise"];

function OrgManagePanel({ org, onClose, showToast, refetchOrgs, currentUserId }) {
  const overridesQuery = useSupabaseQuery(async () => fetchOrgFeatureFlagOverrides(org.id), [org.id]);
  const overrides = overridesQuery.data || [];
  const overrideMap = Object.fromEntries(overrides.map((o) => [o.feature_key, o.enabled]));
  const seatsSummaryQuery = useSupabaseQuery(async () => fetchOrgSeatsSummary(org.id), [org.id]);
  const seats = seatsSummaryQuery.data || { purchased: 0, used: 0, available: 0 };

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(org.name);
  const [editTier, setEditTier] = useState(org.subscription_tier || "growth");
  const [editMaxUsers, setEditMaxUsers] = useState(org.max_users || 100);
  const [savingEdit, setSavingEdit] = useState(false);

  async function handleToggleStatus() {
    const next = org.status === "suspended" ? "active" : "suspended";
    const result = await setOrganizationStatus(org.id, next);
    if (!result.success) {
      showToast(result.error || "Could not update status.");
    } else {
      showToast(next === "suspended" ? `${org.name} suspended.` : `${org.name} reactivated.`);
      refetchOrgs();
    }
  }

  async function handleSaveEdit() {
    if (!editName.trim()) {
      showToast("Organization name is required.");
      return;
    }
    setSavingEdit(true);
    try {
      await updateOrganization(org.id, {
        name: editName.trim(),
        subscription_tier: editTier,
        max_users: parseInt(editMaxUsers, 10) || 100,
      });
      showToast("Organization details updated successfully!");
      setIsEditing(false);
      refetchOrgs();
    } catch (err) {
      showToast(err.message || "Failed to update organization.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleToggleFeature(featureKey, currentResolved) {
    const result = await setOrgFeatureFlag(org.id, featureKey, !currentResolved, currentUserId);
    if (!result.success) {
      showToast(result.error || "Could not update this feature flag.");
    } else {
      overridesQuery.refetch();
    }
  }

  return (
    <div className="ta-card ta-mt16 ta-fade" style={{ borderColor: "var(--primary)", borderRadius: 12 }}>
      <div className="ta-row ta-between" style={{ gap: 10, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div className="ta-title" style={{ wordBreak: "break-word", fontSize: 18, fontWeight: 800 }}>{org.name}</div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
            <span style={{ textTransform: "capitalize", fontWeight: 700 }}>{org.subscription_tier || "Growth"}</span> plan • status: <Tag tone={org.status === "active" ? "success" : org.status === "suspended" ? "danger" : "warning"}>{org.status}</Tag>
          </div>
        </div>
        <div className="ta-row ta-gap8" style={{ flexShrink: 0 }}>
          <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => setIsEditing((v) => !v)}>
            <Edit3 size={13} /> {isEditing ? "Cancel Edit" : "Edit Org"}
          </button>
          <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={handleToggleStatus}>
            {org.status === "suspended" ? <><Unlock size={13} /> Reactivate</> : <><Lock size={13} /> Suspend</>}
          </button>
          <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>

      {isEditing && (
        <div className="ta-card ta-mt12 ta-fade" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Edit Organization Properties</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>ORGANIZATION NAME</label>
              <input className="ta-input" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>SUBSCRIPTION PLAN</label>
              <select className="ta-input" value={editTier} onChange={(e) => setEditTier(e.target.value)}>
                {TIERS.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>MAX SEATS / USERS</label>
              <input className="ta-input" type="number" value={editMaxUsers} onChange={(e) => setEditMaxUsers(e.target.value)} />
            </div>
          </div>
          <div className="ta-row ta-gap8 ta-mt12">
            <button className="ta-btn ta-btn-primary ta-btn-sm" disabled={savingEdit} onClick={handleSaveEdit}>
              {savingEdit ? "Saving..." : "Save Changes"}
            </button>
            <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => setIsEditing(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="ta-mt16">
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Seats &amp; Capacity</div>
        <div className="ta-row ta-gap16">
          <div><div style={{ fontSize: 16, fontWeight: 800 }}>{seats.purchased || org.max_users || 0}</div><div style={{ fontSize: 10.5, color: "var(--text-2)" }}>Purchased/Limit</div></div>
          <div><div style={{ fontSize: 16, fontWeight: 800 }}>{seats.used || org.user_count || 0}</div><div style={{ fontSize: 10.5, color: "var(--text-2)" }}>Used</div></div>
          <div><div style={{ fontSize: 16, fontWeight: 800, color: seats.available > 0 ? "var(--success)" : "var(--danger)" }}>{seats.available}</div><div style={{ fontSize: 10.5, color: "var(--text-2)" }}>Available</div></div>
        </div>
        {org.status === "active" && seats.available <= 0 && (
          <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>This organization has reached its seat limit.</div>
        )}
      </div>

      <div className="ta-mt16">
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Feature flags</div>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 10 }}>
          Tier defaults shown unless explicitly overridden below. Overriding a flag here applies to this organization only, independent of its tier.
        </div>
        <div className="ta-col ta-gap6">
          {FEATURE_KEYS.map(({ key, label }) => {
            const hasOverride = key in overrideMap;
            const resolved = hasOverride ? overrideMap[key] : null;
            return (
              <div key={key} className="ta-row ta-between" style={{ padding: "6px 4px", gap: 8 }}>
                <div className="ta-row ta-gap8" style={{ minWidth: 0, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5 }}>{label}</span>
                  {hasOverride && <Tag tone="warning">Override</Tag>}
                </div>
                <Switch
                  on={hasOverride ? resolved : false}
                  onChange={() => handleToggleFeature(key, hasOverride ? resolved : false)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PlatformBillingPanel() {
  const paymentsQuery = useSupabaseQuery(async () => fetchPlatformOrganizationPayments(50), []);
  const payments = paymentsQuery.data || [];
  return (
    <div className="ta-card ta-mt16 ta-fade">
      <div className="ta-row ta-gap8">
        <CreditCard size={16} color="var(--primary)" />
        <div className="ta-title" style={{ fontSize: 15 }}>Organization payments</div>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 6, marginBottom: 10 }}>
        Every organization subscription activation across the platform, from the audit log.
      </div>
      <div className="ta-table-wrap">
        <table className="ta-table">
          <thead><tr><th>Organization</th><th>Tier</th><th>Provider</th><th>Reference</th><th>When</th></tr></thead>
          <tbody>
            {paymentsQuery.loading && <tr><td colSpan={5} className="ta-empty">Loading payments...</td></tr>}
            {!paymentsQuery.loading && payments.length === 0 && <tr><td colSpan={5} className="ta-empty">No organization payments recorded yet.</td></tr>}
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{p.target_identifier}</td>
                <td style={{ textTransform: "capitalize" }}>{p.metadata?.tier}</td>
                <td style={{ textTransform: "capitalize" }}>{p.metadata?.provider}</td>
                <td style={{ fontSize: 11 }}>{p.metadata?.reference}</td>
                <td style={{ fontSize: 11.5 }}>{new Date(p.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function OrganizationsScreen({ orgSelector, onSwitchToOrgWorkspace, onLaunchOnboarding, currentUserId }) {
  const showToast = useContext(ToastContext);
  const [newOrgOpen, setNewOrgOpen] = useState(false);
  const [name, setName] = useState("");
  const [newTier, setNewTier] = useState("growth");
  const [newMaxUsers, setNewMaxUsers] = useState(100);
  const [managingOrgId, setManagingOrgId] = useState(null);
  const [showBilling, setShowBilling] = useState(false);
  const [viewMode, setViewMode] = useState("grid"); // grid | table

  // Filters and Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at_desc");

  const orgsQuery = useSupabaseQuery(async () => fetchAllOrganizationsWithUserCounts(), []);
  const orgs = orgsQuery.data || [];

  const filteredOrgs = useMemo(() => {
    let result = [...orgs];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((o) => (o.name || "").toLowerCase().includes(q) || (o.id || "").toLowerCase().includes(q));
    }

    if (statusFilter !== "all") {
      result = result.filter((o) => (o.status || "").toLowerCase() === statusFilter);
    }

    if (tierFilter !== "all") {
      result = result.filter((o) => (o.subscription_tier || "").toLowerCase() === tierFilter);
    }

    result.sort((a, b) => {
      if (sortBy === "name_asc") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "name_desc") return (b.name || "").localeCompare(a.name || "");
      if (sortBy === "users_desc") return (b.user_count || 0) - (a.user_count || 0);
      if (sortBy === "courses_desc") return (b.course_count || 0) - (a.course_count || 0);
      if (sortBy === "created_at_asc") return new Date(a.created_at) - new Date(b.created_at);
      return new Date(b.created_at) - new Date(a.created_at);
    });

    return result;
  }, [orgs, searchQuery, statusFilter, tierFilter, sortBy]);

  const managingOrg = orgs.find((o) => o.id === managingOrgId);

  return (
    <div className="ta-fade">
      <TopBar
        title="Organizations" sub="All registered multi-tenant organizations on Train AI"
        orgSelector={orgSelector}
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* =========================================================================
            ORGANIZATIONS HERO BANNER
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
          <div className="tai-glow-purple" />

          <div className="ta-hero-inner" style={{ position: "relative", zIndex: 1 }}>
            <div className="ta-hero-text">
              <h1 className="ta-hero-title" style={{ fontSize: "clamp(20px, 2.5vw, 25px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 4px", lineHeight: 1.2 }}>
                Multi-Tenant Organizations Directory
              </h1>
              <p className="ta-hero-desc" style={{ fontSize: 13, margin: 0, maxWidth: 680, lineHeight: 1.5 }}>
                Manage institutional subscriptions, seat quotas, custom feature flag overrides, and cross-tenant SSO settings across {orgs.length} tenant{orgs.length === 1 ? "" : "s"}.
              </p>
            </div>

            <div className="ta-hero-actions" style={{ flexWrap: "wrap", gap: 8 }}>
              <button
                className="ta-btn ta-btn-outline"
                style={{ height: 36, padding: "0 12px", borderRadius: 8, fontSize: 12.5, color: "#FFFFFF", borderColor: "rgba(255,255,255,0.2)", display: "inline-flex", alignItems: "center", gap: 5 }}
                onClick={() => setShowBilling((v) => !v)}
              >
                <CreditCard size={13} /> {showBilling ? "Hide Billing" : "Billing"}
              </button>
              <button
                className="ta-btn ta-btn-primary"
                style={{ height: 36, padding: "0 14px", borderRadius: 8, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={() => setNewOrgOpen(true)}
              >
                <Plus size={14} /> Create Organization
              </button>
            </div>
          </div>
        </div>

        {showBilling && <PlatformBillingPanel />}

        {/* =========================================================================
            SEARCH, FILTER, SORT, VIEW CONTROLS TOOLBAR
            ========================================================================= */}
        <div className="ta-card" style={{ padding: "14px 18px", borderRadius: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            {/* Search Input */}
            <div className="ta-search" style={{ flex: "1 1 240px", maxWidth: 360, width: "auto" }}>
              <Search size={15} color="var(--text-3)" />
              <input
                style={{ border: "none", outline: "none", background: "transparent", color: "var(--text)", width: "100%", fontSize: 13 }}
                placeholder="Search organizations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter & Sort Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <select
                className="ta-input"
                style={{ height: 34, fontSize: 12.5, padding: "0 8px", width: "auto" }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="trial">Trial</option>
              </select>

              <select
                className="ta-input"
                style={{ height: 34, fontSize: 12.5, padding: "0 8px", width: "auto" }}
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
              >
                <option value="all">All Plans</option>
                <option value="enterprise">Enterprise</option>
                <option value="growth">Growth</option>
                <option value="starter">Starter</option>
                <option value="free">Free</option>
              </select>

              <select
                className="ta-input"
                style={{ height: 34, fontSize: 12.5, padding: "0 8px", width: "auto" }}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="created_at_desc">Newest First</option>
                <option value="created_at_asc">Oldest First</option>
                <option value="name_asc">Name (A-Z)</option>
                <option value="name_desc">Name (Z-A)</option>
                <option value="users_desc">Most Members</option>
                <option value="courses_desc">Most Courses</option>
              </select>

              {/* View Mode Toggle */}
              <div style={{ display: "flex", background: "var(--surface-2)", borderRadius: 8, padding: 2, border: "1px solid var(--border)" }}>
                <button
                  onClick={() => setViewMode("grid")}
                  style={{
                    border: "none", background: viewMode === "grid" ? "var(--surface)" : "transparent",
                    color: viewMode === "grid" ? "var(--primary)" : "var(--text-3)",
                    padding: "4px 8px", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center"
                  }}
                  title="Grid View"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  style={{
                    border: "none", background: viewMode === "table" ? "var(--surface)" : "transparent",
                    color: viewMode === "table" ? "var(--primary)" : "var(--text-3)",
                    padding: "4px 8px", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center"
                  }}
                  title="Table View"
                >
                  <List size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            VIEW MODE: CARD GRID
            ========================================================================= */}
        {viewMode === "grid" ? (
          <div>
            {orgsQuery.loading && <div className="ta-empty">Loading organizations...</div>}
            {!orgsQuery.loading && filteredOrgs.length === 0 && (
              <div className="ta-empty">No organizations found matching your search filters.</div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 18 }} className="anim-stagger">
              {filteredOrgs.map((o) => (
                <div
                  key={o.id}
                  className="ta-card ta-card-hover"
                  style={{
                    padding: 20,
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 16,
                    background: "var(--surface)"
                  }}
                >
                  <div>
                    {/* Top Row: Org Icon, Name, and Status */}
                    <div className="ta-row ta-between" style={{ alignItems: "flex-start", marginBottom: 12, gap: 10 }}>
                      <div className="ta-row ta-gap12" style={{ minWidth: 0, flex: "1 1 auto" }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: 8,
                          background: "var(--primary-tint)", color: "var(--primary)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          border: "1px solid rgba(59, 130, 246, 0.2)", flexShrink: 0
                        }}>
                          <Building2 size={22} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 15.5, color: "var(--text)", wordBreak: "break-word", lineHeight: 1.25 }}>{o.name}</div>
                          <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>ID: {o.id.slice(0, 12)}...</div>
                        </div>
                      </div>
                      <Tag tone={o.status === "active" ? "success" : o.status === "suspended" ? "danger" : "warning"}>
                        {o.status}
                      </Tag>
                    </div>

                    {/* Stats Metric Strip */}
                    <div style={{
                      display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8,
                      background: "var(--surface-2)", padding: "10px 12px", borderRadius: 8, marginBottom: 12
                    }}>
                      <div>
                        <div style={{ fontSize: 10.5, color: "var(--text-3)", fontWeight: 700 }}>MEMBERS</div>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--text)", marginTop: 2 }}>
                          {o.user_count || 0}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, color: "var(--text-3)", fontWeight: 700 }}>COURSES</div>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--text)", marginTop: 2 }}>
                          {o.course_count || 0}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, color: "var(--text-3)", fontWeight: 700 }}>TIER</div>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--primary)", marginTop: 2, textTransform: "capitalize" }}>
                          {o.subscription_tier || "Growth"}
                        </div>
                      </div>
                    </div>

                    {/* Isolation Badge */}
                    <div className="ta-row ta-gap6" style={{ fontSize: 11.5, color: "var(--text-2)", fontWeight: 600 }}>
                      <ShieldCheck size={14} color="#10B981" />
                      <span>Dedicated RLS schema isolation • Strict Multi-Tenancy</span>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="ta-row ta-between" style={{ paddingTop: 14, borderTop: "1px solid var(--border)", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                      Created {new Date(o.created_at).toLocaleDateString()}
                    </span>
                    <div className="ta-row ta-gap8">
                      <button
                        className="ta-btn ta-btn-outline ta-btn-sm"
                        onClick={() => {
                          orgSelector?.onSelectOrg?.(o.id);
                          onSwitchToOrgWorkspace?.();
                          showToast(`Switched Super Admin context to ${o.name}`);
                        }}
                      >
                        <ExternalLink size={13} /> View
                      </button>
                      <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => setManagingOrgId(o.id)}>
                        <Settings size={13} /> Manage
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* =========================================================================
              VIEW MODE: TABLE
              ========================================================================= */
          <div className="ta-card">
            <div className="ta-table-wrap">
              <table className="ta-table">
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Members</th>
                    <th>Courses</th>
                    <th>Cohorts</th>
                    <th>Tier</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Isolation Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orgsQuery.loading && <tr><td colSpan={9} className="ta-empty">Loading organizations...</td></tr>}
                  {!orgsQuery.loading && filteredOrgs.length === 0 && <tr><td colSpan={9} className="ta-empty">No organizations found.</td></tr>}
                  {filteredOrgs.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <div className="ta-row ta-gap10">
                          <Building2 size={18} color="var(--primary)" />
                          <div>
                            <div style={{ fontWeight: 600 }}>{o.name}</div>
                            <div style={{ fontSize: 11, color: "var(--text-3)" }}>ID: {o.id.slice(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td>{o.user_count || 0} users</td>
                      <td>{o.course_count || 0} courses</td>
                      <td>{o.cohort_count || 0} cohorts</td>
                      <td style={{ textTransform: "capitalize" }}>{o.subscription_tier || "Growth"}</td>
                      <td><Tag tone={o.status === "active" ? "success" : o.status === "suspended" ? "danger" : "warning"}>{o.status}</Tag></td>
                      <td>{new Date(o.created_at).toLocaleDateString()}</td>
                      <td><Tag tone="success"><ShieldCheck size={12} /> Isolated</Tag></td>
                      <td>
                        <div className="ta-row ta-gap6">
                          <button
                            className="ta-btn ta-btn-outline ta-btn-sm"
                            onClick={() => {
                              orgSelector?.onSelectOrg?.(o.id);
                              onSwitchToOrgWorkspace?.();
                              showToast(`Switched Super Admin context to ${o.name}`);
                            }}
                          >
                            <ExternalLink size={13} /> View
                          </button>
                          <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => setManagingOrgId(o.id)}>
                            <Settings size={13} /> Manage
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {managingOrg && (
          <OrgManagePanel
            org={managingOrg}
            onClose={() => setManagingOrgId(null)}
            showToast={showToast}
            refetchOrgs={orgsQuery.refetch}
            currentUserId={currentUserId}
          />
        )}

        {newOrgOpen && (
          <div className="ta-card ta-mt16 ta-fade" style={{ borderColor: "var(--border)", borderRadius: 10 }}>
            <div className="ta-title">Create New Organization</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>ORGANIZATION NAME</label>
                <input className="ta-input" placeholder="e.g. Apex Learning Academy" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>SUBSCRIPTION TIER</label>
                <select className="ta-input" value={newTier} onChange={(e) => setNewTier(e.target.value)}>
                  {TIERS.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>MAX SEATS / CAPACITY</label>
                <input className="ta-input" type="number" value={newMaxUsers} onChange={(e) => setNewMaxUsers(e.target.value)} />
              </div>
            </div>
            <div className="ta-row ta-gap8 ta-mt16" style={{ flexWrap: "wrap" }}>
              <button className="ta-btn ta-btn-primary" onClick={async () => {
                if (!name.trim()) return;
                try {
                  await createOrganization({
                    name: name.trim(),
                    subscription_tier: newTier,
                    max_users: parseInt(newMaxUsers, 10) || 100,
                    createdBy: currentUserId,
                  });
                  setNewOrgOpen(false);
                  setName("");
                  orgsQuery.refetch();
                  showToast("Organization created!");
                } catch (e) {
                  showToast(e?.message || "Failed to create organization.");
                }
              }}>Save organization</button>
              <button className="ta-btn ta-btn-outline" onClick={() => setNewOrgOpen(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
