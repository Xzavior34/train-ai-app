import React, { useState, useContext, useEffect } from "react";
import { TopBar, ToastContext } from "../components/PlatformUI.jsx";
import { Plus } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchPlatformSettings, upsertPlatformSetting } from "../../lib/api/platform.js";

// Real `platform_settings` table (setting_key unique, setting_value text,
// setting_type, description, is_public) — see 0004_community_gamification_admin.sql:638
// and the ps_write_super_admin RLS policy in 0006_rls_policies.sql (super
// admin only, which is exactly who reaches this screen). Previously this
// screen only held a local useState checkbox that never read or wrote this
// table — "Save global settings" just fired a toast. Now every toggle here
// reads its current value from a real row and Save persists it via
// upsertPlatformSetting.
const ALLOW_REGISTRATION_KEY = "allow_self_registration";

export function PlatformSettingsScreen() {
  const showToast = useContext(ToastContext);
  const settingsQuery = useSupabaseQuery(async () => fetchPlatformSettings(), []);
  const settings = settingsQuery.data || [];

  const registrationRow = settings.find((s) => s.setting_key === ALLOW_REGISTRATION_KEY);
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (registrationRow) setAllowRegistration(registrationRow.setting_value !== "false");
  }, [registrationRow?.setting_value]);

  async function handleSaveRegistrationFlag() {
    setSaving(true);
    try {
      await upsertPlatformSetting({
        key: ALLOW_REGISTRATION_KEY,
        value: String(allowRegistration),
        type: "boolean",
        description: "Whether new users can self-register on the platform",
        isPublic: true,
      });
      showToast("Platform settings saved");
      settingsQuery.refetch();
    } catch (err) {
      showToast(err.message || "Could not save setting");
    } finally {
      setSaving(false);
    }
  }

  // --- Generic key/value settings management (every other row in the table) ---
  const otherSettings = settings.filter((s) => s.setting_key !== ALLOW_REGISTRATION_KEY);
  const [formOpen, setFormOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleAddSetting() {
    if (!newKey.trim()) return;
    setCreating(true);
    try {
      await upsertPlatformSetting({ key: newKey.trim(), value: newValue, type: "string", description: newDescription.trim() || "" });
      showToast("Setting saved");
      setFormOpen(false);
      setNewKey("");
      setNewValue("");
      setNewDescription("");
      settingsQuery.refetch();
    } catch (err) {
      showToast(err.message || "Could not save setting");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateSettingValue(row, value) {
    try {
      await upsertPlatformSetting({ key: row.setting_key, value, type: row.setting_type || "string", description: row.description || "", isPublic: row.is_public });
      showToast(`"${row.setting_key}" updated`);
      settingsQuery.refetch();
    } catch (err) {
      showToast(err.message || "Could not save setting");
    }
  }

  return (
    <div className="ta-fade">
      <TopBar title="Platform Settings" sub="Global system configuration" />
      <div className="ta-content">
        {settingsQuery.loading && <div className="ta-empty">Loading platform settings...</div>}
        {settingsQuery.error && <div className="ta-empty">Couldn't load platform settings: {settingsQuery.error}</div>}

        {!settingsQuery.loading && (
          <>
            <div className="ta-card" style={{ maxWidth: 600 }}>
              <div className="ta-title">Global Feature Flags</div>
              <div className="ta-row ta-between ta-mt16">
                <span>Allow self-registration</span>
                <input type="checkbox" checked={allowRegistration} onChange={(e) => setAllowRegistration(e.target.checked)} />
              </div>
              <button className="ta-btn ta-btn-primary ta-mt16" onClick={handleSaveRegistrationFlag} disabled={saving}>
                {saving ? "Saving..." : "Save global settings"}
              </button>
            </div>

            <div className="ta-card ta-mt20" style={{ maxWidth: 600 }}>
              <div className="ta-row ta-between">
                <div className="ta-title">Other settings</div>
                <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => setFormOpen((v) => !v)}>
                  <Plus size={13} /> New setting
                </button>
              </div>

              {formOpen && (
                <div className="ta-col ta-gap10 ta-mt16">
                  <input className="ta-input" placeholder="Setting key (e.g. max_upload_size_mb)" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
                  <input className="ta-input" placeholder="Value" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
                  <input className="ta-input" placeholder="Description (optional)" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
                  <div className="ta-row ta-gap8">
                    <button className="ta-btn ta-btn-primary ta-btn-sm" onClick={handleAddSetting} disabled={creating || !newKey.trim()}>
                      {creating ? "Saving..." : "Save"}
                    </button>
                    <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => setFormOpen(false)}>Cancel</button>
                  </div>
                </div>
              )}

              <div className="ta-col ta-gap10 ta-mt16">
                {otherSettings.length === 0 && !formOpen && (
                  <div className="ta-empty">No other platform settings configured yet.</div>
                )}
                {otherSettings.map((row) => (
                  <div key={row.setting_key} className="ta-row ta-between ta-gap10">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{row.setting_key}</div>
                      {row.description && <div style={{ fontSize: 12, color: "var(--text-2)" }}>{row.description}</div>}
                    </div>
                    <input
                      className="ta-input"
                      style={{ width: 160 }}
                      defaultValue={row.setting_value || ""}
                      onBlur={(e) => { if (e.target.value !== (row.setting_value || "")) handleUpdateSettingValue(row, e.target.value); }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
