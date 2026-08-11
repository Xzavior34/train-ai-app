import React, { useContext, useState } from "react";
import { TopBar, Avatar, Tag, Switch, ToastContext } from "../components/PlatformUI.jsx";
import { ShieldCheck, UserCheck, Eye, Search } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchSuperAdmins, grantSuperAdminByUserId, revokeSuperAdmin, fetchGlobalPermissionMatrix, setGlobalPermission, searchUsersForImpersonation, viewUserAsSuperAdmin, findUserIdByEmail } from "../../lib/api/platform.js";

// Fixed role/permission universe for the RBAC matrix below. These match the
// real `app_role` enum in the shared schema and the permission_key values
// the reference train-ai-ltd-main admin console already uses against the
// same real `role_permissions_matrix` table - not invented for this app.
// HR removed from this list on confirmation that it is not an organization
// role (Admin/Manager/Instructor is the full set) - the enum value itself
// stays defined at the database level (removing it is invasive for no real
// benefit once it's simply unused), but nothing in the application surfaces
// it as an assignable role anymore. The matrix starts blank for any
// role/permission pair with no row yet; toggling a switch upserts one via
// setGlobalPermission.
const RBAC_ROLES = ["super_admin", "admin", "manager", "mentor", "learner"];
// Display label only - the underlying platform_role enum value stays
// 'mentor' (RLS, has_role(), and every permission check key off it), but
// the role is called "Instructor" everywhere a person actually reads it.
const ROLE_DISPLAY_LABEL = { mentor: "Instructor" };
const roleLabel = (r) => ROLE_DISPLAY_LABEL[r] || r.replace(/_/g, " ");
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
      <div className="ta-body ta-mt6">Backed by role_permissions_matrix. Applies platform-wide, across every organization.</div>
      <div style={{ overflowX: "auto" }}>
        <table className="ta-table ta-mt12">
          <thead>
            <tr>
              <th>Permission</th>
              {RBAC_ROLES.map(r => <th key={r} style={{ textAlign: "center", textTransform: "capitalize" }}>{roleLabel(r)}</th>)}
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

// Platform Owner impersonation ("view as") - audited, read-only. See
// 0113_super_admin_impersonation.sql for the full design rationale
// (why this isn't real session forgery, and why every call is logged
// before any data comes back).
function ImpersonationPanel() {
  const showToast = useContext(ToastContext);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [reason, setReason] = useState("");
  const [viewing, setViewing] = useState(null); // { profile, enrollments, ai_conversations } | null
  const [loadingView, setLoadingView] = useState(false);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      setResults(await searchUsersForImpersonation(query));
    } finally {
      setSearching(false);
    }
  }

  async function handleView(user) {
    if (!reason.trim()) {
      showToast("A reason is required. This is logged to the audit trail.");
      return;
    }
    setLoadingView(true);
    try {
      const result = await viewUserAsSuperAdmin(user.id, reason.trim());
      if (!result.success) {
        showToast(result.error || "Could not view this user.");
      } else {
        setViewing(result.data);
      }
    } finally {
      setLoadingView(false);
    }
  }

  return (
    <div className="ta-card ta-mt16">
      <div className="ta-row ta-between">
        <div className="ta-title">Impersonation / View As</div>
        <Tag tone="warning"><Eye size={12} /> Every view is logged</Tag>
      </div>
      <div className="ta-body ta-mt6">
        Read-only snapshot of a user's profile, enrollments, and AI Coach conversations. For troubleshooting, not for taking action as them. Every call writes an audit log entry first, unconditionally.
      </div>

      {!viewing ? (
        <>
          <div className="ta-row ta-gap8 ta-mt12">
            <input className="ta-input" style={{ flex: 1 }} placeholder="Search by name..." value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
            <button className="ta-btn ta-btn-primary" onClick={handleSearch} disabled={searching}><Search size={14} /> Search</button>
          </div>
          <input className="ta-input ta-mt8" style={{ width: "100%" }} placeholder="Reason for viewing (required, logged)" value={reason} onChange={(e) => setReason(e.target.value)} />

          {results.length > 0 && (
            <div className="ta-col ta-gap6 ta-mt12">
              {results.map((u) => (
                <div key={u.id} className="ta-row ta-between" style={{ padding: "8px 10px", background: "var(--surface-2)", borderRadius: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{u.display_name || "Unnamed user"} <Tag>{u.role}</Tag></span>
                  <button className="ta-btn ta-btn-ghost ta-btn-sm" disabled={loadingView} onClick={() => handleView(u)}>View</button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="ta-mt12">
          <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => { setViewing(null); setReason(""); }}>← Back to search</button>
          <div className="ta-card ta-mt10">
            <div style={{ fontWeight: 700 }}>{viewing.profile?.display_name}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>{viewing.profile?.role} · last active {viewing.profile?.last_active_at ? new Date(viewing.profile.last_active_at).toLocaleDateString() : "N/A"}</div>
          </div>
          <div className="ta-card ta-mt10">
            <div style={{ fontWeight: 700, fontSize: 13 }}>Enrollments ({(viewing.enrollments || []).length})</div>
            {(viewing.enrollments || []).map((e, i) => (
              <div key={i} style={{ fontSize: 12, marginTop: 6 }}>{e.course_id}: {e.progress_percentage ?? 0}%</div>
            ))}
          </div>
          <div className="ta-card ta-mt10">
            <div style={{ fontWeight: 700, fontSize: 13 }}>AI Coach conversations ({(viewing.ai_conversations || []).length})</div>
            {(viewing.ai_conversations || []).map((c) => (
              <div key={c.conversation_id} className="ta-col ta-gap4 ta-mt8" style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                {(c.messages || []).map((m, i) => (
                  <div key={i} style={{ fontSize: 12 }}><b>{m.role}:</b> {m.content}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AccessControlScreen() {
  const showToast = useContext(ToastContext);
  const superAdminsQuery = useSupabaseQuery(async () => fetchSuperAdmins(), []);
  const superAdmins = superAdminsQuery.data || [];
  const [grantEmail, setGrantEmail] = useState("");
  const [granting, setGranting] = useState(false);

  async function handleGrant() {
    if (!grantEmail.trim()) return;
    setGranting(true);
    try {
      const userId = await findUserIdByEmail(grantEmail.trim());
      if (!userId) {
        showToast(`No account found for ${grantEmail.trim()} - they need to sign up first.`);
        return;
      }
      const result = await grantSuperAdminByUserId(userId);
      if (!result.success) {
        showToast(result.error || "Could not grant Super Admin.");
      } else {
        showToast(`Super Admin granted to ${grantEmail.trim()}.`);
        setGrantEmail("");
        superAdminsQuery.refetch();
      }
    } catch (e) {
      showToast(e?.message || "Could not grant Super Admin.");
    } finally {
      setGranting(false);
    }
  }

  return (
    <div className="ta-fade">
      <TopBar title="Access Control" sub="Super Admin roster & role-based permissions" />
      <div className="ta-content">
        <div className="ta-card">
          <div className="ta-row ta-between">
            <div className="ta-title">Super Admin Roster</div>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>
            Super Admin can only be granted to a real, existing @trainailtd.com account - enforced by the database itself, not just this form.
          </div>
          <div className="ta-row ta-gap8 ta-mt12">
            <input
              className="ta-input" style={{ flex: 1 }}
              placeholder="name@trainailtd.com"
              value={grantEmail}
              onChange={(e) => setGrantEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGrant()}
            />
            <button className="ta-btn ta-btn-primary" disabled={granting || !grantEmail.trim()} onClick={handleGrant}>
              {granting ? "Granting..." : "Grant Super Admin"}
            </button>
          </div>
          <div className="ta-table-wrap">
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
        </div>

        <RolesPermissionsMatrix />
        <ImpersonationPanel />
      </div>
    </div>
  );
}
