import React, { useContext, useState } from "react";
import { TopBar, Tag, Switch, ToastContext } from "../components/PlatformUI.jsx";
import { Plug, Plus, Activity, Lock } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchOrgIntegrations, toggleOrgIntegration, createOrgIntegration, fetchIntegrationDispatchLog, fetchOrganizationById } from "../../lib/api/platform.js";
import { orgHasFeature, minTierLabelFor } from "../../lib/tierFeatures.js";
import { fetchOrgFeatures } from "../../lib/api/organizations.js";

// Real `org_integrations` table (0001_init_schema.sql:172) columns are
// organization_id, kind, name, webhook_url, events, enabled, created_by,
// created_at - this screen previously read `i.category` and `i.is_enabled`,
// neither of which exist (the real columns are `kind` and `enabled`), so the
// toggle silently always read `undefined` as false and every click set
// `enabled` to true regardless of prior state. There was also no way to
// actually create an integration despite createOrgIntegration already
// existing in lib/api/platform.js. Both are fixed below, plus the real
// integration_dispatch_log is now shown so admins can see whether webhook
// deliveries actually succeeded.
const EVENT_OPTIONS = ["enrollment.created", "course.completed", "user.invited", "compliance.overdue"];

export function IntegrationsScreen({ orgId, userId, orgSelector, setScreen, isPlatformOwner }) {
  const showToast = useContext(ToastContext);
  const integrationsQuery = useSupabaseQuery(async () => orgId ? fetchOrgIntegrations(orgId) : [], [orgId]);
  const integrations = integrationsQuery.data || [];
  const logQuery = useSupabaseQuery(async () => orgId ? fetchIntegrationDispatchLog(orgId, 10) : [], [orgId]);
  const log = logQuery.data || [];
  const orgQuery = useSupabaseQuery(async () => orgId ? fetchOrganizationById(orgId) : null, [orgId]);
  // "Organization Tiers... Higher tiers unlock: ... additional management
  // features" - per the agreed Starter/Growth/Enterprise breakdown,
  // integrations (webhooks/API) are an Enterprise-tier feature. See
  // lib/tierFeatures.js.
  const orgTier = orgQuery.data?.subscription_tier || "starter";
  const featuresQuery = useSupabaseQuery(async () => orgId ? fetchOrgFeatures(orgId, ["api_integrations"]) : null, [orgId]);
  const canUseIntegrations = isPlatformOwner || (featuresQuery.data ? !!featuresQuery.data.api_integrations : orgHasFeature(orgTier, "integrations"));

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [events, setEvents] = useState([]);
  const [creating, setCreating] = useState(false);

  function toggleEvent(ev) {
    setEvents((prev) => prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]);
  }

  async function handleCreate() {
    if (!name.trim() || !webhookUrl.trim() || !orgId) return;
    setCreating(true);
    try {
      await createOrgIntegration({ organizationId: orgId, name: name.trim(), webhookUrl: webhookUrl.trim(), events, createdBy: userId });
      showToast(`"${name.trim()}" integration added`);
      setFormOpen(false);
      setName("");
      setWebhookUrl("");
      setEvents([]);
      integrationsQuery.refetch();
    } catch (err) {
      showToast(err.message || "Could not create integration");
    } finally {
      setCreating(false);
    }
  }

  if (orgId && !orgQuery.loading && !canUseIntegrations) {
    return (
      <div className="ta-fade">
        <TopBar title="Integrations" sub="Connect webhooks for platform events" orgSelector={orgSelector} onNavigate={setScreen} />
        <div className="ta-content">
          <div className="ta-card" style={{ textAlign: "center", padding: 40 }}>
            <Lock size={28} style={{ opacity: 0.4, marginBottom: 12 }} />
            <div style={{ fontWeight: 700, fontSize: 15 }}>Integrations is an {minTierLabelFor("integrations")}-plan feature</div>
            <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 6 }}>
              This organization is on the {orgTier[0].toUpperCase() + orgTier.slice(1)} plan. Upgrade to {minTierLabelFor("integrations")} to connect webhooks and use the API.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ta-fade">
      <TopBar
        title="Integrations"
        sub="Connect webhooks for platform events"
        orgSelector={orgSelector}
        onNavigate={setScreen}
        right={<button className="ta-btn ta-btn-primary" onClick={() => setFormOpen((v) => !v)}><Plus size={15} /> New webhook</button>}
      />
      <div className="ta-content">
        {formOpen && (
          <div className="ta-card" style={{ borderColor: "var(--primary)" }}>
            <div className="ta-title">New webhook integration</div>
            <div className="ta-grid ta-grid-2 ta-mt12">
              <div>
                <div className="ta-label">Name</div>
                <input className="ta-input ta-mt8" style={{ width: "100%" }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Slack notifications" />
              </div>
              <div>
                <div className="ta-label">Webhook URL</div>
                <input className="ta-input ta-mt8" style={{ width: "100%" }} value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://..." />
              </div>
            </div>
            <div className="ta-mt12">
              <div className="ta-label">Trigger on events</div>
              <div className="ta-row ta-gap8 ta-mt8" style={{ flexWrap: "wrap" }}>
                {EVENT_OPTIONS.map((ev) => {
                  const active = events.includes(ev);
                  return (
                    <span
                      key={ev}
                      onClick={() => toggleEvent(ev)}
                      className="ta-tag"
                      style={{
                        cursor: "pointer",
                        background: active ? "var(--success-bg)" : "var(--surface-2)",
                        color: active ? "var(--success)" : "var(--text-2)",
                        userSelect: "none",
                      }}
                    >
                      {ev}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="ta-row ta-gap8 ta-mt16">
              <button className="ta-btn ta-btn-primary" onClick={handleCreate} disabled={creating || !name.trim() || !webhookUrl.trim()}>
                {creating ? "Saving..." : "Save integration"}
              </button>
              <button className="ta-btn ta-btn-outline" onClick={() => setFormOpen(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="ta-grid ta-grid-3 ta-mt16">
          {integrationsQuery.loading && <div className="ta-empty">Loading integrations...</div>}
          {integrationsQuery.error && <div className="ta-empty">Couldn't load integrations: {integrationsQuery.error}</div>}
          {!integrationsQuery.loading && !integrationsQuery.error && integrations.length === 0 && (
            <div className="ta-empty">No integrations configured yet. Add a webhook above.</div>
          )}
          {integrations.map(i => (
            <div key={i.id} className="ta-card">
              <div className="ta-row ta-between">
                <div className="ta-row ta-gap10">
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Plug size={16} color="var(--primary)" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{i.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>{i.kind || "webhook"}</div>
                  </div>
                </div>
                <Switch on={!!i.enabled} onChange={async () => {
                  await toggleOrgIntegration(i.id, !i.enabled);
                  integrationsQuery.refetch();
                  showToast(`${i.name} ${!i.enabled ? "enabled" : "disabled"}`);
                }} />
              </div>
              {i.events?.length > 0 && (
                <div className="ta-row ta-gap6 ta-mt10" style={{ flexWrap: "wrap" }}>
                  {i.events.map((ev) => <Tag key={ev}>{ev}</Tag>)}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="ta-card ta-mt20">
          <div className="ta-row ta-gap8">
            <Activity size={16} color="var(--text-3)" />
            <div className="ta-title" style={{ margin: 0 }}>Recent dispatch log</div>
          </div>
          <div className="ta-table-wrap">
          <table className="ta-table ta-mt12">
            <thead><tr><th>Integration</th><th>Event</th><th>Status</th><th>When</th></tr></thead>
            <tbody>
              {logQuery.loading && <tr><td colSpan={4} className="ta-empty">Loading dispatch log...</td></tr>}
              {!logQuery.loading && log.length === 0 && <tr><td colSpan={4} className="ta-empty">No webhook deliveries recorded yet.</td></tr>}
              {log.map((l) => (
                <tr key={l.id}>
                  <td>{l.org_integrations?.name || "N/A"}</td>
                  <td>{l.event || "N/A"}</td>
                  <td><Tag tone={l.status === "success" ? "success" : "danger"}>{l.status || (l.http_status ? `HTTP ${l.http_status}` : "unknown")}</Tag></td>
                  <td style={{ fontSize: 12, color: "var(--text-2)" }}>{l.created_at ? new Date(l.created_at).toLocaleString() : "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}
