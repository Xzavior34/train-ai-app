import React, { useState, useContext, useEffect } from "react";
import { TopBar, ToastContext, Switch } from "../components/PlatformUI.jsx";
import { Plus } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchPlatformSettings, upsertPlatformSetting } from "../../lib/api/platform.js";

import { Database, Trash2, RefreshCw, CheckCircle2, Server } from "lucide-react";
import { isMockDataEnabled, setMockDataEnabled, purgeAllMockData, restoreMockData, subscribeToMockDataChanges } from "../../lib/mockDataManager.js";
import { SUPABASE_PROJECTS } from "../../services/supabaseClient.js";

const PROJECT_LABELS = {
  [SUPABASE_PROJECTS.SARA_FOUNDATION]: "Sara Foundation",
  [SUPABASE_PROJECTS.DIGITAL_TRAINING]: "Digital Training Org (+ Super Admin)",
  [SUPABASE_PROJECTS.B2B]: "B2B Organizations",
};

// Real `platform_settings` table (setting_key unique, setting_value text,
// setting_type, description, is_public) - see 0004_community_gamification_admin.sql:638
// and the ps_write_super_admin RLS policy in 0006_rls_policies.sql (super
// admin only, which is exactly who reaches this screen).
const ALLOW_REGISTRATION_KEY = "allow_self_registration";

export function PlatformSettingsScreen({ activeProject, projectSessionStatus, onSwitchProject }) {
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

  const [mockDataActive, setMockDataActive] = useState(() => isMockDataEnabled());
  useEffect(() => {
    return subscribeToMockDataChanges((enabled) => setMockDataActive(enabled));
  }, []);

  function handleToggleMockData(enabled) {
    setMockDataEnabled(enabled);
    setMockDataActive(enabled);
    showToast(enabled ? "Mock / Demo data enabled" : "Real database mode active (Mock data disabled)");
  }

  function handlePurgeAllMock() {
    if (window.confirm("Are you sure you want to purge all mock data? The entire platform will switch to live Supabase database records only.")) {
      purgeAllMockData();
      setMockDataActive(false);
      showToast("All mock data purged! Real database mode is now live.");
    }
  }

  function handleRestoreMock() {
    restoreMockData();
    setMockDataActive(true);
    showToast("Demo & mock masterclasses restored for testing.");
  }

  return (
    <div className="ta-fade">
      <TopBar title="Platform Settings" sub="Global system configuration" />
      <div className="ta-content" style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        {settingsQuery.loading && <div className="ta-empty">Loading platform settings...</div>}
        {settingsQuery.error && <div className="ta-empty">Couldn't load platform settings: {settingsQuery.error}</div>}

        {!settingsQuery.loading && (
          <>
            {/* Database & Mock Data Management Card */}
            <div className="ta-card" style={{ border: "1.5px solid var(--primary-light, #818CF8)", background: "var(--surface)", borderRadius: 10 }}>
              <div className="ta-row ta-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <div className="ta-row ta-gap10">
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Database size={18} color="var(--primary)" />
                  </div>
                  <div>
                    <div className="ta-title" style={{ fontSize: 16, fontWeight: 800 }}>Database &amp; Mock Data Management</div>
                    <div className="ta-sub" style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                      Control demo sandbox data vs live production database records
                    </div>
                  </div>
                </div>

                <span style={{
                  fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 8,
                  background: mockDataActive ? "var(--warning-bg, #FEF3C7)" : "var(--success-bg, #DCFCE7)",
                  color: mockDataActive ? "var(--warning, #D97706)" : "var(--success, #16A34A)",
                  border: `1px solid ${mockDataActive ? "var(--warning-border, #FDE68A)" : "var(--success-border, #BBF7D0)"}`
                }}>
                  {mockDataActive ? "DEMO MODE (MOCK ACTIVE)" : "LIVE DATABASE MODE"}
                </span>
              </div>

              {/* Active Supabase Multi-Project Switcher */}
              {onSwitchProject && (
                <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em" }}>
                      Active Supabase Project
                    </div>
                  </div>
                  <div className="ta-row ta-gap8" style={{ flexWrap: "wrap" }}>
                    {Object.values(SUPABASE_PROJECTS).map((key) => {
                      const status = projectSessionStatus?.[key];
                      const isActive = key === activeProject;
                      return (
                        <button
                          key={key}
                          className={isActive ? "ta-btn ta-btn-primary ta-btn-sm" : "ta-btn ta-btn-outline ta-btn-sm"}
                          style={{ padding: "6px 12px", fontSize: 12, borderRadius: 8 }}
                          onClick={() => !isActive && onSwitchProject(key)}
                          title={
                            status === "not_configured" ? "No real project connected yet - demo mode"
                            : status === "authenticated" ? "You have an active session here"
                            : "Configured, but you are not signed in here yet"
                          }
                        >
                          {PROJECT_LABELS[key]}
                          {status === "not_configured" && " (demo)"}
                          {status === "no_session" && " (not signed in)"}
                        </button>
                      );
                    })}
                  </div>
                  {projectSessionStatus?.[activeProject] === "no_session" && (
                    <div style={{ fontSize: 11.5, color: "var(--warning, #D97706)", marginTop: 8, lineHeight: 1.4 }}>
                      This project is configured, but you don't have a session here yet - sign in with an account that has
                      super_admin access in this specific project to see its real data.
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <div className="ta-row ta-between" style={{ alignItems: "center" }}>
                  <div style={{ minWidth: 0, flex: 1, paddingRight: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>Include Mock &amp; Demo Masterclasses</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4, lineHeight: 1.5 }}>
                      When enabled, fallback masterclasses with YouTube video tutorials, interactive transcripts, and demo Q&amp;A threads are shown for prototyping.
                    </div>
                  </div>
                  <Switch on={mockDataActive} onChange={() => handleToggleMockData(!mockDataActive)} />
                </div>

                <div className="ta-row ta-gap10 ta-mt20" style={{ flexWrap: "wrap" }}>
                  <button
                    className="ta-btn ta-btn-danger"
                    style={{ fontWeight: 700, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
                    onClick={handlePurgeAllMock}
                  >
                    <Trash2 size={15} /> Purge All Mock Data (Leave Only Real DB)
                  </button>

                  <button
                    className="ta-btn ta-btn-outline"
                    style={{ fontWeight: 700, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
                    onClick={handleRestoreMock}
                  >
                    <RefreshCw size={14} /> Restore Demo Data
                  </button>
                </div>
              </div>
            </div>

            <div className="ta-card" style={{ borderRadius: 10 }}>
              <div className="ta-title">Global Feature Flags</div>
              <div className="ta-row ta-between ta-mt16">
                <span>Allow self-registration</span>
                <Switch on={allowRegistration} onChange={() => setAllowRegistration((v) => !v)} />
              </div>
              <button className="ta-btn ta-btn-primary ta-mt16" onClick={handleSaveRegistrationFlag} disabled={saving}>
                {saving ? "Saving..." : "Save global settings"}
              </button>
            </div>

            <div className="ta-card ta-mt20" style={{ borderRadius: 10 }}>
              <div className="ta-row ta-between">
                <div className="ta-title">Other settings</div>
                <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => setFormOpen((v) => !v)}>
                  <Plus size={13} /> New setting
                </button>
              </div>

              {formOpen && (
                <div className="ta-col ta-gap10 ta-mt16 anim-slide-down">
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

              <div className="ta-col ta-gap10 ta-mt16 anim-stagger">
                {otherSettings.length === 0 && !formOpen && (
                  <div className="ta-empty">No other platform settings configured yet.</div>
                )}
                {otherSettings.map((row) => (
                  <div key={row.setting_key} className="ta-row ta-between ta-gap10" style={{ flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{row.setting_key}</div>
                      {row.description && <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>{row.description}</div>}
                    </div>
                    <input
                      className="ta-input"
                      style={{ width: 160, flexShrink: 0 }}
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
