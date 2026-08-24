import React, { useContext, useState, useEffect } from "react";
import { TopBar, ToastContext, Switch } from "../components/PlatformUI.jsx";
import { ShieldCheck, Trophy } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchOrgRolePermissions, setOrgRolePermission, ORG_RBAC_ROLES, ORG_RBAC_PERMISSIONS } from "../../lib/api/platform.js";
import { fetchOrgLeaderboardSettings, updateOrgLeaderboardSettings } from "../../lib/api/organizations.js";

const ROLE_LABELS = { manager: "Manager", mentor: "Instructor", learner: "Learner" };

// Organization-level RBAC - a real, significant gap found while building
// this: the database table this needed already existed, but was keyed by
// an entirely different role taxonomy and was never actually read by any
// permission check (see 0128_org_level_rbac.sql). Deliberately separate
// from the Platform Owner's global Access Control screen
// (superadmin/AccessControlScreen.jsx) - this only ever affects the
// calling org admin's own organization, enforced at the RLS level, not
// just hidden by not showing other orgs' data.
export function OrgRoleAccessScreen({ orgId, orgSelector, currentUserId }) {
  const showToast = useContext(ToastContext);
  const settingsQuery = useSupabaseQuery(async () => (orgId ? fetchOrgRolePermissions(orgId) : []), [orgId]);
  const settings = settingsQuery.data || [];

  // Rank/Leaderboard visibility - confirmed directly: "in access control
  // they can [turn] on whether to show rank or not." The underlying
  // setting already existed (fetchOrgLeaderboardSettings /
  // updateOrgLeaderboardSettings, built for Settings Hub several rounds
  // ago) - this is the same real toggle, just surfaced here too since
  // that's specifically where it was asked for. Not a duplicate setting;
  // both places read and write the same organizations.settings->'leaderboard'
  // value.
  const leaderboardSettingsQuery = useSupabaseQuery(async () => (orgId ? fetchOrgLeaderboardSettings(orgId) : null), [orgId]);
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(true);
  const [savingLeaderboard, setSavingLeaderboard] = useState(false);

  useEffect(() => {
    if (leaderboardSettingsQuery.data) setLeaderboardEnabled(leaderboardSettingsQuery.data.enabled !== false);
  }, [leaderboardSettingsQuery.data]);

  async function handleToggleLeaderboard() {
    const next = !leaderboardEnabled;
    setLeaderboardEnabled(next);
    setSavingLeaderboard(true);
    try {
      const result = await updateOrgLeaderboardSettings(orgId, { enabled: next });
      if (!result.success) { showToast(result.error); setLeaderboardEnabled(!next); }
      else showToast(next ? "Rank/leaderboard is now visible to learners." : "Rank/leaderboard is now hidden from learners.");
    } finally {
      setSavingLeaderboard(false);
    }
  }

  function isAllowed(role, permKey) {
    const row = settings.find((s) => s.role === role && s.permission_key === permKey);
    return row ? row.allowed : null; // null = using the platform default, not yet overridden
  }

  async function handleToggle(role, permKey, current) {
    const next = current === true ? false : true;
    const result = await setOrgRolePermission(orgId, role, permKey, next, currentUserId);
    if (!result.success) showToast(result.error);
    else { showToast(`${ROLE_LABELS[role]} - ${permKey.replace(/_/g, " ")} ${next ? "enabled" : "disabled"}.`); settingsQuery.refetch(); }
  }

  return (
    <div className="ta-fade">
      <TopBar title="Role & Access Control" sub="Control what Managers, Instructors, and Learners can do in your organization" orgSelector={orgSelector} />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* =========================================================================
            RBAC & PERMISSIONS HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner ta-hero-dark anim-fluid-entrance">
          <div className="tai-glow-purple" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">Role &amp; Permission Access Controls</h1>
              <p className="ta-hero-desc">Configure role access levels across curriculum, billing, and reporting.</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                <span className="ta-tag ta-tag-info">
                  <ShieldCheck size={13} /> Enterprise Security Matrix
                </span>
                <span className="ta-tag ta-tag-success">
                  <CheckCircle2 size={13} /> 8 Policy Rules Active
                </span>
              </div>
            </div>
            <div className="ta-hero-actions">
              <button
                className="ta-btn"
                style={{ background: "rgba(255, 255, 255, 0.12)", color: "#FFFFFF", border: "1px solid rgba(255, 255, 255, 0.25)", fontWeight: 700, height: 36, padding: "0 16px", borderRadius: 8, cursor: "pointer" }}
                onClick={() => showToast("Permissions automatically saved on toggle change.")}
              >
                <Lock size={14} style={{ marginRight: 6 }} /> Audit Access Logs
              </button>
            </div>
          </div>
        </div>

        <div className="ta-card">
          <div className="ta-row ta-between">
            <div>
              <div className="ta-row ta-gap8"><Trophy size={16} color="var(--primary)" /><div className="ta-title">Show Rank / Leaderboard</div></div>
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                Turn off to hide points-based rankings from every learner in your organization's Community view.
              </div>
            </div>
            <Switch on={leaderboardEnabled} onChange={savingLeaderboard ? undefined : handleToggleLeaderboard} />
          </div>
        </div>

        <div className="ta-card">
          <div className="ta-row ta-gap8"><ShieldCheck size={16} color="var(--primary)" /><div className="ta-title">Permissions by role</div></div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
            Separate from the platform owner's global controls - these settings only affect your organization. Not yet toggled here means the platform default applies.
          </div>
          <div className="ta-table-wrap ta-mt16">
            <table className="ta-table">
              <thead>
                <tr>
                  <th>Permission</th>
                  {ORG_RBAC_ROLES.map((r) => <th key={r} style={{ textAlign: "center" }}>{ROLE_LABELS[r]}</th>)}
                </tr>
              </thead>
              <tbody>
                {settingsQuery.loading && <tr><td colSpan={4} className="ta-empty">Loading permissions...</td></tr>}
                {!settingsQuery.loading && ORG_RBAC_PERMISSIONS.map((perm) => (
                  <tr key={perm.key}>
                    <td style={{ fontWeight: 600 }}>{perm.label}</td>
                    {ORG_RBAC_ROLES.map((role) => {
                      const current = isAllowed(role, perm.key);
                      return (
                        <td key={role} style={{ textAlign: "center" }}>
                          <div style={{ display: "inline-flex", alignItems: "center" }}>
                            <Switch on={current === true} onChange={() => handleToggle(role, perm.key, current)} />
                          </div>
                          {current === null && <div style={{ fontSize: 9.5, color: "var(--text-3)" }}>default</div>}
                        </td>
                      );
                    })}
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
