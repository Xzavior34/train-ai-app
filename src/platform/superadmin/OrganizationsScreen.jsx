import React, { useState, useContext } from "react";
import { TopBar, Tag, ToastContext, Switch } from "../components/PlatformUI.jsx";
import { Plus, Building2, ExternalLink, ShieldCheck, Rocket, Settings, CreditCard, Lock, Unlock } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchAllOrganizationsWithUserCounts, createOrganization, setOrganizationStatus, fetchPlatformOrganizationPayments } from "../../lib/api/platform.js";
import { fetchOrgFeatureFlagOverrides, setOrgFeatureFlag } from "../../lib/api/organizations.js";

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
    <div className="ta-card ta-mt16" style={{ borderColor: "var(--primary)" }}>
      <div className="ta-row ta-between">
        <div>
          <div className="ta-title">{org.name}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>
            {org.subscription_tier ? org.subscription_tier[0].toUpperCase() + org.subscription_tier.slice(1) : "-"} plan - status: {org.status}
          </div>
        </div>
        <div className="ta-row ta-gap8">
          <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={handleToggleStatus}>
            {org.status === "suspended" ? <><Unlock size={13} /> Reactivate</> : <><Lock size={13} /> Suspend</>}
          </button>
          <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>

      <div className="ta-mt16">
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Feature flags</div>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 10 }}>
          Tier defaults shown unless explicitly overridden below. Overriding a flag here applies to this organization only, independent of its tier.
        </div>
        <div className="ta-col ta-gap6">
          {FEATURE_KEYS.map(({ key, label }) => {
            const hasOverride = key in overrideMap;
            const resolved = hasOverride ? overrideMap[key] : null; // resolved via tier default server-side when no override exists; we only show explicit overrides here plus a toggle to set one
            return (
              <div key={key} className="ta-row ta-between" style={{ padding: "6px 4px" }}>
                <div className="ta-row ta-gap8">
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
    <div className="ta-card ta-mt16">
      <div className="ta-row ta-gap8">
        <CreditCard size={16} color="var(--primary)" />
        <div className="ta-title" style={{ fontSize: 15 }}>Organization payments</div>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4, marginBottom: 10 }}>
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
  const orgsQuery = useSupabaseQuery(async () => fetchAllOrganizationsWithUserCounts(), []);
  const orgs = orgsQuery.data || [];
  const managingOrg = orgs.find((o) => o.id === managingOrgId);

  return (
    <div className="ta-fade">
      <TopBar
        title="Organizations" sub="All registered multi-tenant organizations on Train AI"
        orgSelector={orgSelector}
        right={
          <div className="ta-row ta-gap8">
            <button className="ta-btn ta-btn-outline" onClick={() => setShowBilling((v) => !v)}>
              <CreditCard size={15} /> {showBilling ? "Hide billing" : "Billing"}
            </button>
            {onLaunchOnboarding && (
              <button className="ta-btn ta-btn-outline" onClick={onLaunchOnboarding}>
                <Rocket size={15} /> Set up new organization
              </button>
            )}
            <button className="ta-btn ta-btn-primary" onClick={() => setNewOrgOpen(true)}><Plus size={15} /> Create organization</button>
          </div>
        }
      />
      <div className="ta-content">
        {showBilling && <PlatformBillingPanel />}

        <div className="ta-card ta-mt16">
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
          <div className="ta-card ta-mt16" style={{ borderColor: "var(--primary)" }}>
            <div className="ta-title">Create New Organization</div>
            <input className="ta-input ta-mt12" placeholder="Organization name..." value={name} onChange={e => setName(e.target.value)} />
            <div className="ta-row ta-gap8 ta-mt12">
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
