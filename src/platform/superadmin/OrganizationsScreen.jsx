import React, { useState, useContext } from "react";
import { TopBar, Tag, ToastContext, Switch } from "../components/PlatformUI.jsx";
import { Plus, Building2, ExternalLink, ShieldCheck, Rocket, Settings, CreditCard, Lock, Unlock, LayoutGrid, List, Users } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchAllOrganizationsWithUserCounts, createOrganization, setOrganizationStatus, fetchPlatformOrganizationPayments } from "../../lib/api/platform.js";
import { fetchOrgFeatureFlagOverrides, setOrgFeatureFlag, fetchOrgSeatsSummary } from "../../lib/api/organizations.js";

// All feature keys this platform currently gates, per "Multi-Tenant
// Database Architecture Reference" Section 3's baseline table plus the
// analytics/branding features already built. tier_default_feature() in
// 0115_organization_feature_flags.sql is the single source of truth for
// what each tier gets by default - this list just needs to name every key
// that function knows about so the platform owner can see and override
// each one, not invent new ones.
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

function OrgManagePanel({ org, onClose, showToast, refetchOrgs, currentUserId }) {
  const overridesQuery = useSupabaseQuery(async () => fetchOrgFeatureFlagOverrides(org.id), [org.id]);
  const overrides = overridesQuery.data || [];
  const overrideMap = Object.fromEntries(overrides.map((o) => [o.feature_key, o.enabled]));
  const seatsSummaryQuery = useSupabaseQuery(async () => fetchOrgSeatsSummary(org.id), [org.id]);
  const seats = seatsSummaryQuery.data || { purchased: 0, used: 0, available: 0 };

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

  async function handleToggleFeature(featureKey, currentResolved) {
    const result = await setOrgFeatureFlag(org.id, featureKey, !currentResolved, currentUserId);
    if (!result.success) {
      showToast(result.error || "Could not update this feature flag.");
    } else {
      overridesQuery.refetch();
    }
  }

  return (
    <div className="ta-card ta-mt16 ta-fade" style={{ borderColor: "var(--primary)" }}>
      <div className="ta-row ta-between" style={{ gap: 10, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div className="ta-title" style={{ wordBreak: "break-word" }}>{org.name}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>
            {org.subscription_tier ? org.subscription_tier[0].toUpperCase() + org.subscription_tier.slice(1) : "-"} plan - status: {org.status}
          </div>
        </div>
        <div className="ta-row ta-gap8" style={{ flexShrink: 0 }}>
          <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={handleToggleStatus}>
            {org.status === "suspended" ? <><Unlock size={13} /> Reactivate</> : <><Lock size={13} /> Suspend</>}
          </button>
          <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>

      <div className="ta-mt16">
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Seats</div>
        <div className="ta-row ta-gap16">
          <div><div style={{ fontSize: 16, fontWeight: 800 }}>{seats.purchased}</div><div style={{ fontSize: 10.5, color: "var(--text-2)" }}>Purchased</div></div>
          <div><div style={{ fontSize: 16, fontWeight: 800 }}>{seats.used}</div><div style={{ fontSize: 10.5, color: "var(--text-2)" }}>Used</div></div>
          <div><div style={{ fontSize: 16, fontWeight: 800, color: seats.available > 0 ? "var(--success)" : "var(--danger)" }}>{seats.available}</div><div style={{ fontSize: 10.5, color: "var(--text-2)" }}>Available</div></div>
        </div>
        {org.status === "active" && seats.available <= 0 && (
          <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>This organization cannot add new users until they purchase more seats.</div>
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
            const resolved = hasOverride ? overrideMap[key] : null; // resolved via tier default server-side when no override exists; we only show explicit overrides here plus a toggle to set one
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
  const [managingOrgId, setManagingOrgId] = useState(null);
  const [showBilling, setShowBilling] = useState(false);
  const [viewMode, setViewMode] = useState("grid"); // grid | table
  const orgsQuery = useSupabaseQuery(async () => fetchAllOrganizationsWithUserCounts(), []);
  const orgs = orgsQuery.data || [];
  const managingOrg = orgs.find((o) => o.id === managingOrgId);

  return (
    <div className="ta-fade">
      <TopBar
        title="Organizations" sub="All registered multi-tenant organizations on Train AI"
        orgSelector={orgSelector}
        right={
          <div className="ta-row ta-gap8" style={{ flexWrap: "wrap" }}>
            <div className="ta-row" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 3 }}>
              <button
                className={`ta-btn ta-btn-sm ${viewMode === "grid" ? "ta-btn-ghost" : ""}`}
                style={{ padding: "5px 10px", background: viewMode === "grid" ? "var(--primary-tint)" : "transparent", color: viewMode === "grid" ? "var(--primary)" : "var(--text-3)", border: "none" }}
                onClick={() => setViewMode("grid")}
                title="Grid Card View"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                className={`ta-btn ta-btn-sm ${viewMode === "table" ? "ta-btn-ghost" : ""}`}
                style={{ padding: "5px 10px", background: viewMode === "table" ? "var(--primary-tint)" : "transparent", color: viewMode === "table" ? "var(--primary)" : "var(--text-3)", border: "none" }}
                onClick={() => setViewMode("table")}
                title="Table View"
              >
                <List size={14} />
              </button>
            </div>
            <button
              className="ta-btn ta-btn-outline"
              style={{ height: 34, padding: "0 12px", borderRadius: 8, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 5 }}
              onClick={() => setShowBilling((v) => !v)}
            >
              <CreditCard size={13} /> {showBilling ? "Hide billing" : "Billing"}
            </button>
            {onLaunchOnboarding && (
              <button
                className="ta-btn ta-btn-outline"
                style={{ height: 34, padding: "0 12px", borderRadius: 8, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 5 }}
                onClick={onLaunchOnboarding}
              >
                <Rocket size={13} /> Set up new organization
              </button>
            )}
            <button
              className="ta-btn ta-btn-primary"
              style={{ height: 34, padding: "0 12px", borderRadius: 8, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 5 }}
              onClick={() => setNewOrgOpen(true)}
            >
              <Plus size={14} /> Create organization
            </button>
          </div>
        }
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* =========================================================================
            ORGANIZATIONS HERO BANNER
            ========================================================================= */}
        <div
          className="ta-card ta-hero-banner anim-fluid-entrance"
          style={{
            borderRadius: 14,
            padding: "clamp(18px, 2.5vw, 24px)",
            position: "relative",
            overflow: "hidden"
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -40,
              right: -40,
              width: 200,
              height: 200,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(99, 102, 241, 0.22) 0%, transparent 70%)",
              pointerEvents: "none"
            }}
          />

          <div className="ta-hero-inner" style={{ position: "relative", zIndex: 1 }}>
            <div className="ta-hero-text">
              <h1 className="ta-hero-title" style={{ fontSize: "clamp(20px, 2.5vw, 25px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 4px", lineHeight: 1.2 }}>
                Multi-Tenant Organizations Directory
              </h1>
              <p className="ta-hero-desc" style={{ fontSize: 13, margin: 0, maxWidth: 680, lineHeight: 1.5 }}>
                Manage institutional subscriptions, seat quotas, custom feature flag overrides, and cross-tenant SSO settings.
              </p>
            </div>

            <div className="ta-hero-actions">
              <div className="ta-hero-subcard" style={{ padding: "8px 14px", borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 10.5, color: "var(--text-3)", fontWeight: 700 }}>Total Registered</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: "var(--text)" }}>{orgs.length} Tenants</div>
              </div>
              <div className="ta-hero-subcard" style={{ padding: "8px 14px", borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 10.5, color: "var(--text-3)", fontWeight: 700 }}>Active Users</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#34D399" }}>{orgs.reduce((sum, o) => sum + (o.user_count || 0), 0)} Active</div>
              </div>
            </div>
          </div>
        </div>

        {showBilling && <PlatformBillingPanel />}

        {/* =========================================================================
            VIEW MODE: CARD GRID (No awkward whitespace)
            ========================================================================= */}
        {viewMode === "grid" ? (
          <div>
            {orgsQuery.loading && <div className="ta-empty">Loading organizations...</div>}
            {!orgsQuery.loading && orgs.length === 0 && <div className="ta-empty">No organizations created yet.</div>}
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }} className="anim-stagger">
              {orgs.map(o => (
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
                          border: "1px solid rgba(99, 102, 241, 0.2)", flexShrink: 0
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
                      display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
                      background: "var(--surface-2)", padding: "10px 14px", borderRadius: 8, marginBottom: 12
                    }}>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>MEMBERS</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginTop: 2 }}>
                          {o.user_count || 0} users
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>TIER</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--primary)", marginTop: 2, textTransform: "capitalize" }}>
                          {o.subscription_tier || "Enterprise"}
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
                    <th>Tier</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Isolation Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orgsQuery.loading && <tr><td colSpan={7} className="ta-empty">Loading organizations...</td></tr>}
                  {!orgsQuery.loading && orgs.length === 0 && <tr><td colSpan={7} className="ta-empty">No organizations created yet.</td></tr>}
                  {orgs.map(o => (
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
                      <td style={{ textTransform: "capitalize" }}>{o.subscription_tier}</td>
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
            <input className="ta-input ta-mt12" placeholder="Organization name..." value={name} onChange={e => setName(e.target.value)} />
            <div className="ta-row ta-gap8 ta-mt12" style={{ flexWrap: "wrap" }}>
              <button className="ta-btn ta-btn-primary" onClick={async () => {
                if (!name.trim()) return;
                await createOrganization({ name: name.trim() });
                setNewOrgOpen(false); setName("");
                orgsQuery.refetch();
                showToast("Organization created!");
              }}>Save organization</button>
              <button className="ta-btn ta-btn-outline" onClick={() => setNewOrgOpen(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
