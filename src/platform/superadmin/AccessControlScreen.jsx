import React, { useContext, useState } from "react";
import { TopBar, Avatar, Tag, Switch, ToastContext } from "../components/PlatformUI.jsx";
import { ShieldCheck, UserCheck } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchSuperAdmins, grantSuperAdminByUserId, revokeSuperAdmin, fetchGlobalPermissionMatrix, setGlobalPermission } from "../../lib/api/platform.js";

// Fixed role/permission universe for the RBAC matrix below. These match the
// real `app_role` enum in the shared schema (learner, mentor, admin,
// super_admin, hr, manager) and the permission_key values the reference
// train-ai-ltd-main admin console already uses against the same real
// `role_permissions_matrix` table — not invented for this app. The matrix
// starts blank for any role/permission pair with no row yet; toggling a
// switch upserts one via setGlobalPermission.
const RBAC_ROLES = ["super_admin", "admin", "hr", "manager", "mentor", "learner"];
const RBAC_PERMISSIONS = [
  { key: "manage_users", label: "Manage users" },
  { key: "manage_courses", label: "Manage courses" },
  { key: "manage_cohorts", label: "Manage cohorts" },
  { key: "manage_compliance", label: "Manage compliance" },
  { key: "view_analytics", label: "View analytics" },
];

function RolesPermissionsMatrix() {
  const showToast = useContext(ToastContext);
  const matrixQuery = useSupabaseQuery(async () => fetchGlobalPermissionMatrix(), []);
  const [pending, setPending] = useState(null); // `${role}:${key}` currently saving
  const rows = matrixQuery.data || [];

  const isAllowed = (role, key) => rows.find(r => r.role === role && r.permission_key === key)?.allowed ?? false;

  async function toggle(role, key) {
    const cellId = `${role}:${key}`;
    const current = isAllowed(role, key);
    setPending(cellId);
    try {
      await setGlobalPermission(role, key, !current);
      await matrixQuery.refetch();
      showToast(`${current ? "Revoked" : "Granted"} "${key.replace(/_/g, " ")}" for ${role.replace(/_/g, " ")}.`);
    } catch (e) {
      showToast(e.message || "Could not update permission.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="ta-card ta-mt16">
      <div className="ta-title">Roles & Permissions Matrix</div>
      <div className="ta-body ta-mt6">Backed by role_permissions_matrix — applies platform-wide, across every organization.</div>
      <div style={{ overflowX: "auto" }}>
        <table className="ta-table ta-mt12">
          <thead>
            <tr>
              <th>Permission</th>
              {RBAC_ROLES.map(r => <th key={r} style={{ textAlign: "center", textTransform: "capitalize" }}>{r.replace(/_/g, " ")}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrixQuery.loading && <tr><td colSpan={RBAC_ROLES.length + 1} className="ta-empty">Loading permission matrix...</td></tr>}
            {!matrixQuery.loading && RBAC_PERMISSIONS.map(p => (
              <tr key={p.key}>
                <td style={{ fontWeight: 600 }}>{p.label}</td>
                {RBAC_ROLES.map(role => (
                  <td key={role} style={{ textAlign: "center" }}>
                    <div style={{ display: "inline-flex", opacity: pending === `${role}:${p.key}` ? 0.5 : 1 }}>
                      <Switch on={isAllowed(role, p.key)} onChange={() => (pending ? null : toggle(role, p.key))} />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AccessControlScreen() {
  const showToast = useContext(ToastContext);
  const superAdminsQuery = useSupabaseQuery(async () => fetchSuperAdmins(), []);
  const superAdmins = superAdminsQuery.data || [];

  return (
    <div className="ta-fade">
      <TopBar title="Access Control" sub="Super Admin roster & role-based permissions" />
      <div className="ta-content">
        <div className="ta-card">
          <div className="ta-title">Super Admin Roster</div>
          <table className="ta-table ta-mt12">
            <thead><tr><th>User</th><th>Role</th><th>Actions</th></tr></thead>
            <tbody>
              {superAdminsQuery.loading && <tr><td colSpan={3} className="ta-empty">Loading super admins...</td></tr>}
              {!superAdminsQuery.loading && superAdmins.length === 0 && <tr><td colSpan={3} className="ta-empty">No super admins found.</td></tr>}
              {superAdmins.map(sa => (
                <tr key={sa.userId}>
                  <td><div className="ta-row ta-gap10"><Avatar initials={sa.initials || "SA"} size={32} /><span style={{ fontWeight: 600 }}>{sa.name || "Super Admin"}</span></div></td>
                  <td><Tag tone="danger">Super Admin</Tag></td>
                  <td>
                    <button className="ta-btn ta-btn-danger ta-btn-sm" onClick={async () => {
                      await revokeSuperAdmin(sa.userId);
                      superAdminsQuery.refetch();
                      showToast("Super admin rights revoked.");
                    }}>Revoke</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <RolesPermissionsMatrix />
      </div>
    </div>
  );
}
