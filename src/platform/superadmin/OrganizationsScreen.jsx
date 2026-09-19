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

import { PortalModal } from "../../components/common/PortalModal.jsx";

const FEATURE_KEYS = [
  { key: "learner_view", label: "Learner view", desc: "Access to student dashboard & course player" },
  { key: "instructor_view", label: "Instructor view", desc: "Access to mentor/instructor portal" },
  { key: "manager_view", label: "Manager view", desc: "Department and team management" },
  { key: "admin_view", label: "Admin view", desc: "Institutional admin dashboard" },
  { key: "ai_intelligence_layer", label: "AI Intelligence Layer", desc: "AI Coach & Tutor integration" },
  { key: "ai_intelligence_advanced", label: "AI Intelligence Layer (Advanced)", desc: "Deep analytics & automated recommendations" },
  { key: "sso", label: "SSO", desc: "Single Sign-On (SAML / Okta / Azure AD)" },
  { key: "api_integrations", label: "API integrations", desc: "REST API & Webhooks access" },
  { key: "analytics_export", label: "Analytics export", desc: "CSV / BI direct exports" },
  { key: "multi_department_breakdown", label: "Multi-department breakdown", desc: "Sub-organization structuring" },
  { key: "custom_branding", label: "Custom branding", desc: "White-label logos and theme colors" },
];

const TIERS = ["free", "starter", "growth", "enterprise"];

function OrgManageModal({ org, isOpen, onClose, showToast, refetchOrgs, currentUserId, orgSelector, onSwitchToOrgWorkspace }) {
  const [activeTab, setActiveTab] = useState("identity"); // identity | capacity | features | danger
  const overridesQuery = useSupabaseQuery(async () => fetchOrgFeatureFlagOverrides(org?.id), [org?.id]);
  const overrides = overridesQuery.data || [];
  const overrideMap = Object.fromEntries(overrides.map((o) => [o.feature_key, o.enabled]));
  
  const seatsSummaryQuery = useSupabaseQuery(async () => fetchOrgSeatsSummary(org?.id), [org?.id]);
  const seats = seatsSummaryQuery.data || { purchased: 0, used: 0, available: 0 };

  const [editName, setEditName] = useState(org?.name || "");
  const [editTier, setEditTier] = useState(org?.subscription_tier || "growth");
  const [editMaxUsers, setEditMaxUsers] = useState(org?.max_users || 100);
  const [savingEdit, setSavingEdit] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Sync state when org changes
  React.useEffect(() => {
    if (org) {
      setEditName(org.name || "");
      setEditTier(org.subscription_tier || "growth");
      setEditMaxUsers(org.max_users || 100);
      setDeleteConfirm(false);
    }
  }, [org]);

  if (!org) return null;

  async function handleToggleStatus() {
    setStatusLoading(true);
    const next = org.status === "suspended" ? "active" : "suspended";
    const result = await setOrganizationStatus(org.id, next);
    setStatusLoading(false);
    if (!result.success) {
      showToast(result.error || "Could not update status.");
    } else {
      showToast(next === "suspended" ? `${org.name} suspended.` : `${org.name} reactivated.`);
      refetchOrgs();
    }
  }

  async function handleSaveIdentity() {
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
      showToast(`Feature flag '${featureKey}' updated.`);
      overridesQuery.refetch();
    }
  }

  async function handleDeleteOrg() {
    setDeleting(true);
    const result = await deleteOrganization(org.id);
    setDeleting(false);
    if (!result.success) {
      showToast(result.error || "Failed to delete organization. Ensure all members and records are unlinked first.");
    } else {
      showToast(`Organization '${org.name}' deleted successfully.`);
      refetchOrgs();
      onClose();
    }
  }

  const purchasedSeats = seats.purchased || org.max_users || 100;
  const usedSeats = seats.used || org.user_count || 0;
  const seatPct = Math.min(100, Math.round((usedSeats / Math.max(1, purchasedSeats)) * 100));

  return (
    <PortalModal isOpen={isOpen} onClose={onClose} maxWidth={660}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Modal Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, borderBottom: "1px solid var(--border)", paddingBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: "var(--primary-tint)", color: "var(--primary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px solid rgba(59, 130, 246, 0.2)", flexShrink: 0
            }}>
              <Building2 size={22} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", lineHeight: 1.2 }}>
                {org.name}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
                <span>ID: {org.id.slice(0, 16)}...</span>
                <span>•</span>
                <Tag tone={org.status === "active" ? "success" : org.status === "suspended" ? "danger" : "warning"}>
                  {org.status}
                </Tag>
                <Tag tone="primary" style={{ textTransform: "capitalize" }}>
                  {org.subscription_tier || "Growth"} Plan
                </Tag>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ta-btn ta-btn-ghost ta-btn-sm"
            style={{ padding: 6, borderRadius: 8 }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: "flex", gap: 6, borderBottom: "1px solid var(--border)", paddingBottom: 6, overflowX: "auto" }}>
          {[
            { id: "identity", label: "Settings & Plan", icon: Settings },
            { id: "capacity", label: "Seats & Capacity", icon: Users },
            { id: "features", label: "Feature Flags", icon: Layers },
            { id: "danger", label: "Danger Zone", icon: Lock },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`ta-btn ta-btn-sm ${isSelected ? "ta-btn-primary" : "ta-btn-ghost"}`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  borderRadius: 8, fontSize: 12.5, fontWeight: isSelected ? 700 : 500,
                  whiteSpace: "nowrap"
                }}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Settings & Plan */}
        {activeTab === "identity" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>
                  ORGANIZATION NAME
                </label>
                <input
                  className="ta-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>
                  SUBSCRIPTION PLAN
                </label>
                <select
                  className="ta-input"
                  value={editTier}
                  onChange={(e) => setEditTier(e.target.value)}
                >
                  {TIERS.map((t) => (
                    <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>
                  MAX SEATS / CAPACITY LIMIT
                </label>
                <input
                  className="ta-input"
                  type="number"
                  min="1"
                  value={editMaxUsers}
                  onChange={(e) => setEditMaxUsers(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>
                  ORGANIZATION SLUG
                </label>
                <input
                  className="ta-input"
                  disabled
                  value={org.slug || org.id}
                  style={{ opacity: 0.7, cursor: "not-allowed" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 8, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              <button
                className="ta-btn ta-btn-outline ta-btn-sm"
                onClick={() => {
                  orgSelector?.onSelectOrg?.(org.id);
                  onSwitchToOrgWorkspace?.();
                  onClose();
                  showToast(`Switched Super Admin context to ${org.name}`);
                }}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <ExternalLink size={13} /> Enter Tenant Workspace
              </button>

              <button
                className="ta-btn ta-btn-primary ta-btn-sm"
                disabled={savingEdit}
                onClick={handleSaveIdentity}
                style={{ minWidth: 120 }}
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Seats & Capacity */}
        {activeTab === "capacity" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10,
              background: "var(--surface-2)", padding: "14px 16px", borderRadius: 10, border: "1px solid var(--border)"
            }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>PURCHASED / LIMIT</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)", marginTop: 2 }}>{purchasedSeats}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>Allocated quota</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>ACTIVE MEMBERS</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "var(--primary)", marginTop: 2 }}>{usedSeats}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>Currently joined</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>AVAILABLE SEATS</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: (purchasedSeats - usedSeats) > 0 ? "var(--success)" : "var(--danger)", marginTop: 2 }}>
                  {Math.max(0, purchasedSeats - usedSeats)}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>Remaining</div>
              </div>
            </div>

            {/* Capacity Progress Bar */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                <span>Seat Utilization</span>
                <span>{seatPct}% ({usedSeats} of {purchasedSeats})</span>
              </div>
              <div style={{ width: "100%", height: 8, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  width: `${seatPct}%`,
                  height: "100%",
                  background: seatPct >= 100 ? "var(--danger)" : seatPct >= 80 ? "var(--warning)" : "var(--primary)",
                  borderRadius: 4,
                  transition: "width 0.3s ease"
                }} />
              </div>
            </div>

            <div style={{ fontSize: 12, color: "var(--text-2)", background: "var(--surface-2)", padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>💡 Quota Management</div>
              To increase or adjust seat allocation, change the "Max Seats / Capacity Limit" under the <strong>Settings &amp; Plan</strong> tab.
            </div>
          </div>
        )}

        {/* Tab 3: Feature Flags */}
        {activeTab === "features" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>
              Toggle enterprise capabilities specifically for this tenant. Overriding here overrides standard plan defaults.
            </div>

            <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 4 }}>
              {FEATURE_KEYS.map(({ key, label, desc }) => {
                const hasOverride = key in overrideMap;
                const resolved = hasOverride ? overrideMap[key] : false;
                return (
                  <div
                    key={key}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 12px", background: "var(--surface-2)", borderRadius: 8,
                      border: "1px solid var(--border)", gap: 10
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                        {hasOverride && <Tag tone="warning" style={{ fontSize: 10, padding: "1px 5px" }}>Override</Tag>}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{desc}</div>
                    </div>
                    <Switch
                      on={resolved}
                      onChange={() => handleToggleFeature(key, resolved)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 4: Danger Zone */}
        {activeTab === "danger" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Suspend / Reactivate */}
            <div style={{
              padding: 14, borderRadius: 10, border: "1px solid var(--border)",
              background: "var(--surface-2)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                  {org.status === "suspended" ? "Reactivate Organization" : "Suspend Organization"}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>
                  {org.status === "suspended"
                    ? "Restore access to dashboards, courses, and APIs for all organization members."
                    : "Immediately disable login and active sessions for all members of this organization."}
                </div>
              </div>
              <button
                className={`ta-btn ta-btn-sm ${org.status === "suspended" ? "ta-btn-primary" : "ta-btn-outline"}`}
                onClick={handleToggleStatus}
                disabled={statusLoading}
                style={{ flexShrink: 0, minWidth: 100 }}
              >
                {statusLoading ? "Updating..." : org.status === "suspended" ? <><Unlock size={13} /> Reactivate</> : <><Lock size={13} /> Suspend</>}
              </button>
            </div>

            {/* Permanent Deletion */}
            <div style={{
              padding: 14, borderRadius: 10, border: "1px solid rgba(239, 68, 68, 0.3)",
              background: "rgba(239, 68, 68, 0.05)", display: "flex", flexDirection: "column", gap: 10
            }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--danger)" }}>
                Delete Organization
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>
                Permanently delete this organization record. If this organization has active members or courses, ensure they are unlinked first.
              </div>
              {!deleteConfirm ? (
                <div>
                  <button
                    className="ta-btn ta-btn-sm"
                    style={{ background: "var(--danger)", color: "#FFF", borderColor: "var(--danger)" }}
                    onClick={() => setDeleteConfirm(true)}
                  >
                    <Trash2 size={13} /> Delete This Organization
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "var(--surface)", padding: 10, borderRadius: 8, border: "1px solid var(--danger)" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--danger)" }}>Are you absolutely sure?</span>
                  <button
                    className="ta-btn ta-btn-sm"
                    style={{ background: "var(--danger)", color: "#FFF" }}
                    disabled={deleting}
                    onClick={handleDeleteOrg}
                  >
                    {deleting ? "Deleting..." : "Yes, Delete Organization"}
                  </button>
                  <button
                    className="ta-btn ta-btn-ghost ta-btn-sm"
                    onClick={() => setDeleteConfirm(false)}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PortalModal>
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

        <OrgManageModal
          org={managingOrg}
          isOpen={!!managingOrg}
          onClose={() => setManagingOrgId(null)}
          showToast={showToast}
          refetchOrgs={orgsQuery.refetch}
          currentUserId={currentUserId}
          orgSelector={orgSelector}
          onSwitchToOrgWorkspace={onSwitchToOrgWorkspace}
        />

        <PortalModal isOpen={newOrgOpen} onClose={() => setNewOrgOpen(false)} maxWidth={560}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: "var(--primary-tint)", color: "var(--primary)",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <Plus size={18} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Create New Organization</div>
              </div>
              <button
                onClick={() => setNewOrgOpen(false)}
                className="ta-btn ta-btn-ghost ta-btn-sm"
                style={{ padding: 6, borderRadius: 8 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>
                  ORGANIZATION NAME *
                </label>
                <input
                  className="ta-input"
                  placeholder="e.g. Apex Learning Academy"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>
                    SUBSCRIPTION TIER
                  </label>
                  <select
                    className="ta-input"
                    value={newTier}
                    onChange={(e) => setNewTier(e.target.value)}
                  >
                    {TIERS.map((t) => (
                      <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>
                    MAX SEATS / CAPACITY
                  </label>
                  <input
                    className="ta-input"
                    type="number"
                    min="1"
                    value={newMaxUsers}
                    onChange={(e) => setNewMaxUsers(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <button className="ta-btn ta-btn-outline" onClick={() => setNewOrgOpen(false)}>
                Cancel
              </button>
              <button
                className="ta-btn ta-btn-primary"
                onClick={async () => {
                  if (!name.trim()) {
                    showToast("Please enter an organization name.");
                    return;
                  }
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
                    showToast("Organization created successfully!");
                  } catch (e) {
                    showToast(e?.message || "Failed to create organization.");
                  }
                }}
              >
                Create Organization
              </button>
            </div>
          </div>
        </PortalModal>
      </div>
    </div>
  );
}
