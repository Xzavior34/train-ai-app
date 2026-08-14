import React, { useContext } from "react";
import { TopBar, ToastContext } from "../components/PlatformUI.jsx";
import { ShieldCheck } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchOrgRolePermissions, setOrgRolePermission, ORG_RBAC_ROLES, ORG_RBAC_PERMISSIONS } from "../../lib/api/platform.js";

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
      <div className="ta-content">
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
                          <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={current === true}
                              onChange={() => handleToggle(role, perm.key, current)}
                            />
                          </label>
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
