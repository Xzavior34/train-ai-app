import React, { useState, useContext } from "react";
import { TopBar, ToastContext, Tag } from "../components/PlatformUI.jsx";
import { Percent, RefreshCw, Save, X, Settings, CheckCircle2, Loader2 } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchAllOrgCommissions, setOrgCommission } from "../../lib/api/revenue.js";

export function CommissionConfigScreen({ orgSelector }) {
  const showToast = useContext(ToastContext);

  const commissionsQuery = useSupabaseQuery(async () => fetchAllOrgCommissions(), []);
  const commissions = commissionsQuery.data || [];

  const [editingOrgId, setEditingOrgId] = useState(null);
  const [editPct, setEditPct] = useState("");
  const [editFee, setEditFee] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit(org) {
    setEditingOrgId(org.org_id);
    setEditPct(String(org.commission_percent));
    setEditFee(String(org.fixed_fee_minor || 0));
  }

  function cancelEdit() {
    setEditingOrgId(null);
    setEditPct("");
    setEditFee("");
  }

  async function handleSave(org) {
    const pct = Number(editPct);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      showToast("Commission must be between 0 and 100%.");
      return;
    }
    setSaving(true);
    try {
      const res = await setOrgCommission(org.org_id, pct, Number(editFee) || 0);
      if (res.success) {
        showToast(`Commission updated for ${org.org_name}.`);
        setEditingOrgId(null);
        commissionsQuery.refetch();
      } else {
        showToast(res.error || "Could not update commission.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ta-fade">
      <TopBar
        title="Commission Config"
        sub="Set your platform's revenue share per organization"
        orgSelector={orgSelector}
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Hero */}
        <div className="ta-hero-banner anim-fluid-entrance">
          <div className="tai-glow-emerald" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">Platform Commission Settings</h1>
              <p className="ta-hero-desc">
                Configure your revenue share per organization. When a learner pays for a course, the platform deducts this commission before the net amount is credited to the organization.
              </p>
            </div>
            <div className="ta-hero-actions">
              <button
                className="ta-btn ta-btn-outline"
                style={{ height: 36, padding: "0 14px", borderRadius: 8, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={() => commissionsQuery.refetch()}
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Info card */}
        <div className="ta-card" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", padding: "12px 16px" }}>
          <div className="ta-row ta-gap8">
            <Settings size={14} color="var(--text-3)" style={{ marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.6 }}>
              <strong>Default commission is 10%</strong> for organizations without a custom configuration. Commission is computed as:
              <br /><code style={{ fontSize: 11 }}>platform_fee = floor(gross × commission%) + fixed_fee</code>
              <br />Changes take effect on the <em>next</em> transaction — historical transactions always retain the rate that was active when they occurred.
            </span>
          </div>
        </div>

        {/* Commission Table */}
        <div className="ta-card" style={{ borderRadius: 10 }}>
          <div className="ta-row ta-between" style={{ marginBottom: 14 }}>
            <div className="ta-label" style={{ margin: 0 }}>Organization commission rates</div>
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>{commissions.length} organizations</div>
          </div>

          <div className="ta-table-wrap">
            <table className="ta-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Commission %</th>
                  <th>Fixed Fee (cents)</th>
                  <th>Currency</th>
                  <th>Config</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {commissionsQuery.loading && (
                  <tr><td colSpan={6} className="ta-empty">Loading…</td></tr>
                )}
                {!commissionsQuery.loading && commissions.length === 0 && (
                  <tr><td colSpan={6} className="ta-empty">No organizations found.</td></tr>
                )}
                {commissions.map((org) => (
                  <tr key={org.org_id}>
                    <td style={{ fontWeight: 700 }}>{org.org_name}</td>
                    <td>
                      {editingOrgId === org.org_id ? (
                        <input
                          className="ta-input"
                          style={{ width: 80, padding: "4px 8px", fontSize: 13 }}
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={editPct}
                          onChange={(e) => setEditPct(e.target.value)}
                        />
                      ) : (
                        <strong>{org.commission_percent}%</strong>
                      )}
                    </td>
                    <td>
                      {editingOrgId === org.org_id ? (
                        <input
                          className="ta-input"
                          style={{ width: 100, padding: "4px 8px", fontSize: 13 }}
                          type="number"
                          min="0"
                          placeholder="e.g. 50"
                          value={editFee}
                          onChange={(e) => setEditFee(e.target.value)}
                        />
                      ) : (
                        org.fixed_fee_minor ? `¢${org.fixed_fee_minor}` : "None"
                      )}
                    </td>
                    <td>{org.currency}</td>
                    <td>
                      {org.has_custom_config
                        ? <Tag tone="success">Custom</Tag>
                        : <Tag tone="warning">Default 10%</Tag>}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {editingOrgId === org.org_id ? (
                        <div className="ta-row ta-gap6" style={{ justifyContent: "flex-end" }}>
                          <button
                            className="ta-btn ta-btn-primary ta-btn-sm"
                            disabled={saving}
                            onClick={() => handleSave(org)}
                          >
                            {saving ? <Loader2 size={12} className="ta-spin" /> : <Save size={12} />} Save
                          </button>
                          <button
                            className="ta-btn ta-btn-outline ta-btn-sm"
                            disabled={saving}
                            onClick={cancelEdit}
                          >
                            <X size={12} /> Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className="ta-btn ta-btn-outline ta-btn-sm"
                          onClick={() => startEdit(org)}
                        >
                          <Percent size={12} /> Edit
                        </button>
                      )}
                    </td>
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

export default CommissionConfigScreen;
