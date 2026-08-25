import React, { useState, useEffect, useContext, useMemo } from "react";
import { TopBar, Avatar, Tag, ToastContext, Switch } from "../components/PlatformUI.jsx";
import {
  UserPlus, Search, X, Download, Trash2, FileText, ArrowUpRight, ArrowDownRight,
  Minus, Award, Eye, Pencil, ShieldCheck, Layers, UserMinus, RefreshCw, Link2,
  BookOpen, GraduationCap, MoreHorizontal, Save, CheckCircle2,
  Mail, TrendingUp, AlertTriangle,
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchOrgMembers, fetchPendingInvitations, createInvitation, revokeInvitation,
  updateOrgMemberStatus, fetchOrgLearnerProgressOverview, issueCertificateDirectly,
  fetchOrgInstructorsMonitor, bulkImportUsers, parseUserImportCsv, fetchCohorts,
  // Everything below is new - the directory previously had no way to open a
  // member's record, edit them, change their role, move them between cohorts,
  // remove them from the organization, or resend an invitation.
  updateUserPlatformRole, updateUserProfileAsAdmin, removeOrgMember,
  fetchUserDetailForAdmin, resendInvitation, buildInvitationLink,
  assignMemberToCohort, removeMemberFromCohort, fetchOrgPeopleKpis,
  // Instructor Applications and Privileges & Roles, both of which the zip has
  // under People. fetchMentorApplications/decideMentorApplication existed in
  // the API and were called by nothing at all; the role permission matrix
  // lived only on a separate top-level screen.
  fetchMentorApplications, decideMentorApplication,
  fetchOrgRolePermissions, setOrgRolePermission,
  ORG_RBAC_ROLES, ORG_RBAC_PERMISSIONS,
} from "../../lib/api/platform.js";
import FileUploadZone from "../../components/common/FileUploadZone.jsx";
import { PortalModal } from "../../components/common/PortalModal.jsx";
import { fetchAllDSARRequests, updateDSARRequestStatus, exportUserData, deleteUserCascade } from "../../lib/api/gdprService.js";

const PACE_META = {
  ahead: { label: "Ahead", tone: "success", Icon: ArrowUpRight },
  on_pace: { label: "On pace", tone: "default", Icon: Minus },
  behind: { label: "Behind", tone: "danger", Icon: ArrowDownRight },
  not_started: { label: "Not started", tone: "warning", Icon: Minus },
};

const PLATFORM_ROLES = [
  { value: "learner", label: "Learner" },
  { value: "mentor", label: "Instructor" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
];

const ROLE_LABEL = Object.fromEntries(PLATFORM_ROLES.map((r) => [r.value, r.label]));

// Shared by both the per-row "Export data" action in the Directory tab and
// the DSAR queue below - triggers a browser download of exportUserData's
// JSON bundle for the given user, no server round trip needed beyond the read.
async function downloadUserDataExport(userId, label) {
  const data = await exportUserData(userId);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dsar-export-${label || userId}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Directory export. Distinct from the DSAR per-user JSON bundle above: this is
// the roster an admin actually asks for - one row per member with the columns
// on screen - and nothing in this screen could produce it before.
function downloadDirectoryCsv(rows, progressByMemberId) {
  const header = ["Name", "Email", "Role", "Status", "Cohort", "Avg progress %", "Department", "Last active"];
  const body = rows.map((m) => [
    m.display_name || "",
    m.email || "",
    ROLE_LABEL[m.role] || m.role || "",
    m.status || "",
    m.cohort_name || "",
    Object.prototype.hasOwnProperty.call(progressByMemberId, m.id) ? String(progressByMemberId[m.id]) : "",
    m.department || "",
    m.last_active_at ? new Date(m.last_active_at).toISOString().slice(0, 10) : "",
  ]);
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [header, ...body].map((r) => r.map(escape).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `people-directory-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ==========================================================================
   Member record drawer - the whole of one member, in one place
   ========================================================================= */
function MemberDetailModal({ member, orgId, cohorts, onClose, onChanged, showToast }) {
  const detailQuery = useSupabaseQuery(
    async () => (member ? fetchUserDetailForAdmin(member.id, orgId) : null),
    [member?.id, orgId]
  );
  const detail = detailQuery.data;

  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ displayName: "", department: "", school: "", bio: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [role, setRole] = useState(member?.role || "learner");
  const [savingRole, setSavingRole] = useState(false);
  const [cohortId, setCohortId] = useState("");
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!member) return;
    setTab("overview");
    setEditing(false);
    setRole(member.role || "learner");
    setCohortId("");
    setForm({
      displayName: member.display_name || "",
      department: member.department || "",
      school: member.school || "",
      bio: member.bio || "",
    });
  }, [member?.id]);

  if (!member) return null;

  async function handleSaveProfile() {
    setSavingProfile(true);
    try {
      const res = await updateUserProfileAsAdmin(member.id, form);
      if (!res.success) { showToast(res.error); return; }
      showToast(`${form.displayName || "Member"}'s profile updated.`);
      setEditing(false);
      detailQuery.refetch();
      onChanged?.();
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveRole() {
    if (role === (member.role || "learner")) { showToast("That's already their role."); return; }
    setSavingRole(true);
    try {
      const res = await updateUserPlatformRole(member.id, role, orgId);
      showToast(res.success ? `Role changed to ${ROLE_LABEL[role] || role}.` : res.error);
      if (res.success) { detailQuery.refetch(); onChanged?.(); }
    } finally {
      setSavingRole(false);
    }
  }

  async function handleAssignCohort() {
    if (!cohortId) return;
    setBusy(true);
    try {
      const res = await assignMemberToCohort(member.id, cohortId, null);
      const name = cohorts.find((c) => c.id === cohortId)?.name || "cohort";
      showToast(res.success ? (res.alreadyMember ? `Already in ${name}.` : `Moved to ${name}.`) : res.error);
      if (res.success) { setCohortId(""); detailQuery.refetch(); onChanged?.(); }
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveCohort(cohort) {
    setBusy(true);
    try {
      const res = await removeMemberFromCohort(member.id, cohort.id);
      showToast(res.success ? `Removed from ${cohort.name}.` : res.error);
      if (res.success) { detailQuery.refetch(); onChanged?.(); }
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveFromOrg() {
    if (!window.confirm(`Remove ${member.display_name || "this member"} from the organization? Their account and learning history are kept - they just lose access to this workspace.`)) return;
    setBusy(true);
    try {
      const res = await removeOrgMember(member.id, orgId);
      showToast(res.success ? `${member.display_name || "Member"} removed from the organization.` : res.error);
      if (res.success) { onChanged?.(); onClose(); }
    } finally {
      setBusy(false);
    }
  }

  const initials = (member.display_name || "U").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <PortalModal isOpen={Boolean(member)} onClose={onClose} maxWidth={720} zIndex={9999}>
      <div className="ta-row ta-between" style={{ gap: 10 }}>
        <div className="ta-row ta-gap12" style={{ minWidth: 0 }}>
          <Avatar initials={initials} size={44} src={member.avatar_url || undefined} />
          <div style={{ minWidth: 0 }}>
            <div className="ta-title" style={{ fontSize: 18, overflowWrap: "anywhere" }}>{member.display_name || "Member"}</div>
            <div className="ta-row ta-gap8" style={{ fontSize: 12, color: "var(--text-2)", flexWrap: "wrap" }}>
              <span style={{ overflowWrap: "anywhere" }}>{member.email || "No email on file"}</span>
              <Tag>{ROLE_LABEL[member.role] || member.role || "learner"}</Tag>
              <Tag tone={member.status === "suspended" ? "danger" : "success"}>{member.status || "active"}</Tag>
            </div>
          </div>
        </div>
        <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </div>

      <div className="ta-tabs ta-mt16">
        {[
          { k: "overview", label: "Overview" },
          { k: "learning", label: `Learning${detail?.enrollments?.length ? ` (${detail.enrollments.length})` : ""}` },
          { k: "access", label: "Role & access" },
        ].map((t) => (
          <div key={t.k} className={`ta-tab ${tab === t.k ? "active" : ""}`} onClick={() => setTab(t.k)}>{t.label}</div>
        ))}
      </div>

      {detailQuery.loading && <div className="ta-empty ta-mt16">Loading this member's record...</div>}

      {!detailQuery.loading && tab === "overview" && (
        <div className="ta-mt16">
          <div className="ta-grid ta-grid-4 ta-gap8">
            {[
              { label: "Enrolled", value: detail?.enrollments?.length ?? 0, Icon: BookOpen },
              { label: "Completed", value: detail?.completedCount ?? 0, Icon: CheckCircle2 },
              { label: "Avg progress", value: detail?.enrollments?.length ? `${detail.avgProgress}%` : "0%", Icon: TrendingUp },
              { label: "Certificates", value: detail?.certificates?.length ?? 0, Icon: GraduationCap },
            ].map((k) => {
              const Icon = k.Icon;
              return (
                <div key={k.label} className="ta-card" style={{ padding: "12px 14px", borderRadius: 10 }}>
                  <div className="ta-row ta-gap6" style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>
                    <Icon size={12} /> {k.label}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{k.value}</div>
                </div>
              );
            })}
          </div>

          <div className="ta-card ta-mt12" style={{ padding: 16 }}>
            <div className="ta-row ta-between" style={{ gap: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Profile</div>
              {!editing ? (
                <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => setEditing(true)}><Pencil size={13} /> Edit</button>
              ) : (
                <div className="ta-row ta-gap6">
                  <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                  <button className="ta-btn ta-btn-primary ta-btn-sm" disabled={savingProfile} onClick={handleSaveProfile}>
                    <Save size={13} /> {savingProfile ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>

            {!editing ? (
              <div className="ta-col ta-gap6 ta-mt12" style={{ fontSize: 12.5 }}>
                {[
                  ["Display name", member.display_name || "Not set"],
                  ["Department", detail?.profile?.department || member.department || "Not set"],
                  ["School", detail?.profile?.school || member.school || "Not set"],
                  ["Cohort", detail?.cohorts?.length ? detail.cohorts.map((c) => c.name).join(", ") : "Not in a cohort"],
                  ["Joined", detail?.membership?.joined_at ? new Date(detail.membership.joined_at).toLocaleDateString() : (detail?.profile?.created_at ? new Date(detail.profile.created_at).toLocaleDateString() : "Unknown")],
                  ["Last active", member.last_active_at ? new Date(member.last_active_at).toLocaleString() : "Unknown"],
                  ["Points", detail?.stats?.total_points != null ? String(detail.stats.total_points) : "No points yet"],
                ].map(([label, value]) => (
                  <div key={label} className="ta-row ta-between" style={{ gap: 10 }}>
                    <span style={{ color: "var(--text-3)" }}>{label}</span>
                    <span style={{ fontWeight: 600, textAlign: "right", overflowWrap: "anywhere" }}>{value}</span>
                  </div>
                ))}
                {detail?.profile?.bio && (
                  <div className="ta-mt8" style={{ color: "var(--text-2)", overflowWrap: "anywhere" }}>{detail.profile.bio}</div>
                )}
              </div>
            ) : (
              <div className="ta-mt12">
                <div className="ta-label">Display name</div>
                <input className="ta-input ta-mt6" style={{ width: "100%", boxSizing: "border-box" }} value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
                <div className="ta-grid ta-grid-2 ta-gap12 ta-mt12">
                  <div>
                    <div className="ta-label">Department</div>
                    <input className="ta-input ta-mt6" style={{ width: "100%", boxSizing: "border-box" }} value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} placeholder="e.g. Operations" />
                  </div>
                  <div>
                    <div className="ta-label">School</div>
                    <input className="ta-input ta-mt6" style={{ width: "100%", boxSizing: "border-box" }} value={form.school} onChange={(e) => setForm((f) => ({ ...f, school: e.target.value }))} />
                  </div>
                </div>
                <div className="ta-label ta-mt12">Bio</div>
                <textarea className="ta-input ta-mt6" style={{ width: "100%", minHeight: 70, boxSizing: "border-box" }} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
              </div>
            )}
          </div>

          {(detail?.compliance || []).length > 0 && (
            <div className="ta-card ta-mt12" style={{ padding: 16 }}>
              <div className="ta-row ta-gap8"><AlertTriangle size={15} color="var(--warning)" /><div style={{ fontWeight: 800, fontSize: 14 }}>Assigned & compliance</div></div>
              <div className="ta-col ta-gap6 ta-mt10">
                {detail.compliance.map((c) => (
                  <div key={c.id} className="ta-row ta-between" style={{ gap: 10, fontSize: 12.5, padding: "7px 10px", background: "var(--surface-2)", borderRadius: 8 }}>
                    <span style={{ overflowWrap: "anywhere" }}>{c.title}</span>
                    <span className="ta-row ta-gap8" style={{ flexShrink: 0 }}>
                      {c.dueAt && <span style={{ color: "var(--text-3)", fontSize: 11 }}>due {new Date(c.dueAt).toLocaleDateString()}</span>}
                      <Tag tone={c.status === "completed" ? "success" : c.status === "overdue" ? "danger" : "warning"}>{c.status}</Tag>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!detailQuery.loading && tab === "learning" && (
        <div className="ta-mt16">
          <div className="ta-card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Course enrollments</div>
            {(detail?.enrollments || []).length === 0 && (
              <div className="ta-empty ta-mt10">This member isn't enrolled in any course yet.</div>
            )}
            <div className="ta-col ta-gap6 ta-mt10">
              {(detail?.enrollments || []).map((e) => (
                <div key={e.id} style={{ padding: "9px 12px", background: "var(--surface-2)", borderRadius: 10 }}>
                  <div className="ta-row ta-between" style={{ gap: 10, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflowWrap: "anywhere" }}>{e.title}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                        {e.category || "Uncategorised"}
                        {e.enrolledAt ? ` • enrolled ${new Date(e.enrolledAt).toLocaleDateString()}` : ""}
                      </div>
                    </div>
                    <div className="ta-row ta-gap8" style={{ flexShrink: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{e.progress}%</span>
                      {e.completedAt ? <Tag tone="success">Completed</Tag> : <Tag tone={e.progress >= 40 ? "default" : "warning"}>In progress</Tag>}
                    </div>
                  </div>
                  <div style={{ width: "100%", height: 5, background: "var(--surface-3)", borderRadius: 4, overflow: "hidden", marginTop: 8 }}>
                    <div style={{ width: `${Math.min(100, e.progress)}%`, height: "100%", background: e.completedAt ? "#10B981" : "var(--primary)" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ta-card ta-mt12" style={{ padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Certificates</div>
            {(detail?.certificates || []).length === 0 && <div className="ta-empty ta-mt10">No certificates issued yet.</div>}
            <div className="ta-col ta-gap6 ta-mt10">
              {(detail?.certificates || []).map((c) => (
                <div key={c.id} className="ta-row ta-between" style={{ gap: 10, fontSize: 12.5, padding: "7px 10px", background: "var(--surface-2)", borderRadius: 8 }}>
                  <span className="ta-row ta-gap8" style={{ minWidth: 0 }}>
                    <GraduationCap size={13} color="var(--primary)" style={{ flexShrink: 0 }} />
                    <span style={{ overflowWrap: "anywhere" }}>{c.title || c.certificate_title || "Certificate"}</span>
                  </span>
                  {c.issued_at && <span style={{ color: "var(--text-3)", fontSize: 11, flexShrink: 0 }}>{new Date(c.issued_at).toLocaleDateString()}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!detailQuery.loading && tab === "access" && (
        <div className="ta-mt16">
          <div className="ta-card" style={{ padding: 16 }}>
            <div className="ta-row ta-gap8"><ShieldCheck size={15} color="var(--primary)" /><div style={{ fontWeight: 800, fontSize: 14 }}>Platform role</div></div>
            <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
              Controls which dashboard this member lands on and what they can reach. Written to both
              user_profiles and user_roles so routing and permissions stay in step.
            </div>
            <div className="ta-row ta-gap8 ta-mt12" style={{ flexWrap: "wrap" }}>
              <select className="ta-input" style={{ flex: "1 1 180px", minWidth: 0 }} value={role} onChange={(e) => setRole(e.target.value)}>
                {PLATFORM_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <button className="ta-btn ta-btn-primary" disabled={savingRole} onClick={handleSaveRole}>
                {savingRole ? "Saving..." : "Update role"}
              </button>
            </div>
            {(detail?.roles || []).length > 0 && (
              <div className="ta-row ta-gap6 ta-mt10" style={{ flexWrap: "wrap" }}>
                <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>Currently held:</span>
                {detail.roles.map((r) => <Tag key={r}>{ROLE_LABEL[r] || r}</Tag>)}
              </div>
            )}
          </div>

          <div className="ta-card ta-mt12" style={{ padding: 16 }}>
            <div className="ta-row ta-gap8"><Layers size={15} color="var(--primary)" /><div style={{ fontWeight: 800, fontSize: 14 }}>Cohort</div></div>
            {(detail?.cohorts || []).length > 0 ? (
              <div className="ta-row ta-gap6 ta-mt10" style={{ flexWrap: "wrap" }}>
                {detail.cohorts.map((c) => (
                  <span key={c.id} className="ta-row ta-gap6" style={{ background: "var(--primary-tint)", color: "var(--primary)", borderRadius: 999, padding: "5px 8px 5px 12px", fontSize: 12, fontWeight: 700 }}>
                    {c.name}
                    <button className="ta-iconbtn" disabled={busy} onClick={() => handleRemoveCohort(c)} aria-label={`Remove from ${c.name}`} style={{ width: 18, height: 18, background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 8 }}>Not in a cohort.</div>
            )}
            <div className="ta-row ta-gap8 ta-mt12" style={{ flexWrap: "wrap" }}>
              <select className="ta-input" style={{ flex: "1 1 180px", minWidth: 0 }} value={cohortId} onChange={(e) => setCohortId(e.target.value)}>
                <option value="">Move to a cohort...</option>
                {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button className="ta-btn ta-btn-outline" disabled={busy || !cohortId} onClick={handleAssignCohort}>Assign</button>
            </div>
            {cohorts.length === 0 && (
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 8 }}>
                No cohorts exist in this organization yet - create one in Cohorts & Batches first.
              </div>
            )}
          </div>

          <div className="ta-card ta-mt12" style={{ padding: 16, borderColor: "var(--danger)" }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Organization membership</div>
            <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
              Suspending keeps the record and blocks access. Removing takes them out of this workspace
              entirely while keeping their account and learning history intact.
            </div>
            <div className="ta-row ta-gap8 ta-mt12" style={{ flexWrap: "wrap" }}>
              <button
                className="ta-btn ta-btn-outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const next = member.status === "active" ? "suspended" : "active";
                    await updateOrgMemberStatus(member.id, orgId, next);
                    showToast(`${member.display_name || "Member"} ${next === "suspended" ? "suspended" : "reactivated"}.`);
                    onChanged?.();
                  } catch (e) {
                    showToast(e?.message || "Could not change their status.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {member.status === "active" ? "Suspend member" : "Reactivate member"}
              </button>
              <button className="ta-btn ta-btn-danger" disabled={busy} onClick={handleRemoveFromOrg}>
                <UserMinus size={14} /> Remove from organization
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalModal>
  );
}

/* ==========================================================================
   Screen
   ========================================================================= */
export function PeopleScreen({ orgId, orgSelector, setScreen, currentUserId }) {
  const showToast = useContext(ToastContext);
  const [tab, setTab] = useState("all");
  const [certModalUser, setCertModalUser] = useState(null);
  const [certTitle, setCertTitle] = useState("");
  const [certFileUrl, setCertFileUrl] = useState("");
  const [issuingCert, setIssuingCert] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkEmails, setBulkEmails] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkCohortId, setBulkCohortId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("learner");
  const [search, setSearch] = useState("");
  const [cohortFilter, setCohortFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [progressSort, setProgressSort] = useState("pace"); // "pace" | "name"
  const [detailMember, setDetailMember] = useState(null);
  // Row actions live in a portal action sheet, not an absolutely-positioned
  // dropdown: .ta-table-wrap is overflow-x:auto, which makes it a scroll
  // container and clips absolute children, so an in-table dropdown would have
  // been cut off (and unreachable on the last rows).
  const [actionsMember, setActionsMember] = useState(null);
  const [invitingBusy, setInvitingBusy] = useState(null);

  const membersQuery = useSupabaseQuery(async () => orgId ? fetchOrgMembers(orgId) : [], [orgId]);
  const cohortsQuery = useSupabaseQuery(async () => orgId ? fetchCohorts(orgId) : [], [orgId]);
  const instructorsQuery = useSupabaseQuery(async () => orgId ? fetchOrgInstructorsMonitor(orgId) : [], [orgId]);
  const invitationsQuery = useSupabaseQuery(async () => orgId ? fetchPendingInvitations(orgId) : [], [orgId]);
  const progressQuery = useSupabaseQuery(async () => orgId ? fetchOrgLearnerProgressOverview(orgId) : [], [orgId]);
  const kpisQuery = useSupabaseQuery(async () => orgId ? fetchOrgPeopleKpis(orgId) : null, [orgId]);
  // Instructor applications: mentors rows in this org that aren't active yet.
  const applicationsQuery = useSupabaseQuery(async () => orgId ? fetchMentorApplications(orgId) : [], [orgId]);
  const rolePermsQuery = useSupabaseQuery(async () => orgId ? fetchOrgRolePermissions(orgId) : [], [orgId]);
  // DSAR requests have no org_id column in the schema - this queue is
  // platform-wide by design, not scoped to the current org.
  const dsarQuery = useSupabaseQuery(async () => fetchAllDSARRequests(), []);

  const members = membersQuery.data || [];
  const instructors = instructorsQuery.data || [];
  const invitations = invitationsQuery.data || [];
  const dsarRequests = dsarQuery.data || [];
  const kpis = kpisQuery.data;
  const applications = applicationsQuery.data || [];
  const rolePerms = rolePermsQuery.data || [];
  // org_role_permission_settings only stores rows that have been explicitly
  // set. An absent row means "not yet decided", which the matrix shows as off
  // rather than pretending a default was chosen.
  const permLookup = Object.fromEntries(rolePerms.map((r) => [`${r.role}:${r.permission_key}`, !!r.allowed]));
  const pendingDsarCount = dsarRequests.filter(r => r.status === "pending").length;
  const progressRows = progressQuery.data || [];
  const behindCount = progressRows.filter(r => r.pace === "behind").length;
  // Directory's "Course Progress" column reuses the real per-learner progress
  // already fetched for the Progress tab (fetchOrgLearnerProgressOverview)
  // rather than a second, fabricated number. There is still no real
  // attendance/session-checkin data anywhere in the schema, so that column
  // stays honestly blank ("N/A") instead of inventing one.
  const progressByMemberId = Object.fromEntries(progressRows.map(r => [r.id, r.avgProgress]));

  // Behind sorts first by default - that's the point of this tab (surface
  // who needs attention without opening each learner's record).
  const paceOrder = { behind: 0, not_started: 1, on_pace: 2, ahead: 3 };
  const sortedProgressRows = [...progressRows].sort((a, b) => {
    if (progressSort === "name") return a.name.localeCompare(b.name);
    return (paceOrder[a.pace] ?? 9) - (paceOrder[b.pace] ?? 9);
  });

  const cohorts = cohortsQuery.data || [];
  const filteredMembers = useMemo(() => members.filter(m => {
    const needle = search.trim().toLowerCase();
    const matchesSearch = !needle
      || (m.display_name || "").toLowerCase().includes(needle)
      || (m.email || "").toLowerCase().includes(needle)
      || (m.role || "").toLowerCase().includes(needle)
      || (m.department || "").toLowerCase().includes(needle);
    if (!matchesSearch) return false;
    if (roleFilter !== "all" && (m.role || "learner") !== roleFilter) return false;
    if (statusFilter !== "all" && (m.status || "active") !== statusFilter) return false;
    if (cohortFilter === "none") return !m.cohort_name;
    if (cohortFilter !== "all") return m.cohort_name === cohortFilter;
    return true;
  }), [members, search, roleFilter, statusFilter, cohortFilter]);

  const selectedMembers = members.filter((m) => selectedMemberIds.has(m.id));

  function refreshDirectory() {
    membersQuery.refetch();
    kpisQuery.refetch();
    progressQuery.refetch();
    cohortsQuery.refetch();
  }

  async function runBulk(label, fn) {
    setBulkBusy(true);
    let succeeded = 0, failed = 0;
    for (const member of selectedMembers) {
      try {
        const res = await fn(member);
        if (res && res.success === false) failed++; else succeeded++;
      } catch {
        failed++;
      }
    }
    setBulkBusy(false);
    setSelectedMemberIds(new Set());
    refreshDirectory();
    showToast(`${label}: ${succeeded} succeeded${failed ? `, ${failed} failed` : ""}.`);
  }

  return (
    <div className="ta-fade">
      <TopBar
        title="People & Access" sub="Directory, member records, roles & invitations"
        orgSelector={orgSelector}
        onNavigate={setScreen}
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* =========================================================================
            PEOPLE & ACCESS HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner anim-fluid-entrance">
          <div className="tai-glow-emerald" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">
                Member &amp; Role Management
              </h1>
              <p className="ta-hero-desc">
                Invite instructors, manage role permissions, and track organization student seat allocations.
              </p>
            </div>

            <div className="ta-hero-actions">
              <button
                className="ta-btn ta-btn-primary"
                style={{
                  height: 36,
                  padding: "0 14px",
                  borderRadius: 8,
                  background: "#2563EB",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: 12.5,
                  border: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}
                onClick={() => setInviteOpen(true)}
              >
                <UserPlus size={14} /> Invite User
              </button>
            </div>
          </div>
        </div>

        <div className="ta-tabs">
          {[
            { k: "all", label: `Users (${members.length})` },
            { k: "progress", label: `Progress${behindCount > 0 ? ` (${behindCount} behind)` : ""}` },
            { k: "mentorapps", label: `Instructor Applications (${applications.length})` },
            { k: "applications", label: `Instructor Monitor (${instructors.length})` },
            { k: "privileges", label: "Privileges & Roles" },
            { k: "invites", label: `Invitations (${invitations.length})` },
            { k: "dsar", label: `Data Requests (${pendingDsarCount})` },
          ].map(t => (
            <div key={t.k} className={`ta-tab ${tab === t.k ? "active" : ""}`} onClick={() => setTab(t.k)}>{t.label}</div>
          ))}
        </div>

        {tab === "all" && (
          <div className="ta-col ta-gap16">
            {/* KPI row */}
            <div className="ta-grid ta-grid-4 anim-stagger">
              <div className="ta-card" style={{ padding: "14px 18px", borderRadius: 10 }}>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>Total Members</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", marginTop: 4 }}>{kpis?.totalMembers ?? members.length}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                  {kpis ? `${kpis.activeMembers} active • ${kpis.suspendedMembers} suspended` : `${invitations.length} invite${invitations.length === 1 ? "" : "s"} pending`}
                </div>
              </div>
              <div className="ta-card" style={{ padding: "14px 18px", borderRadius: 10 }}>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>At Risk Learners</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: behindCount > 0 ? "#EF4444" : "var(--text)", marginTop: 4 }}>{behindCount}</div>
                <div style={{ fontSize: 11, color: behindCount > 0 ? "#EF4444" : "var(--text-3)", marginTop: 2 }}>{behindCount > 0 ? "Needs intervention" : "All learners on pace"}</div>
              </div>
              <div className="ta-card" style={{ padding: "14px 18px", borderRadius: 10 }}>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>Avg. Course Progress</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#10B981", marginTop: 4 }}>
                  {kpisQuery.loading ? "..." : `${kpis?.avgCompletion ?? 0}%`}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Across every enrollment</div>
              </div>
              <div className="ta-card" style={{ padding: "14px 18px", borderRadius: 10 }}>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>Point Earners</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#2563EB", marginTop: 4 }}>
                  {kpisQuery.loading ? "..." : (kpis?.topAchievers ?? 0)}
                </div>
                <div style={{ fontSize: 11, color: "var(--primary)", marginTop: 2 }}>Members with points on the board</div>
              </div>
            </div>

            <div className="ta-card" style={{ padding: 20 }}>
              <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                <div className="ta-row ta-gap12" style={{ flex: "1 1 260px", minWidth: 0, flexWrap: "wrap" }}>
                  <div className="ta-search" style={{ flex: "1 1 180px", minWidth: 0, width: "auto" }}>
                    <Search size={14} />
                    <input
                      className="ta-input"
                      style={{ border: "none", padding: 0, width: "100%" }}
                      placeholder="Search by name, email, role or department..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>
                  <select className="ta-input" style={{ width: "auto", minWidth: 130, flex: "0 1 160px" }} value={cohortFilter} onChange={(e) => setCohortFilter(e.target.value)}>
                    <option value="all">All Cohorts</option>
                    <option value="none">Not in a cohort</option>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  <select className="ta-input" style={{ width: "auto", minWidth: 120, flex: "0 1 150px" }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                    <option value="all">All roles</option>
                    {PLATFORM_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <select className="ta-input" style={{ width: "auto", minWidth: 120, flex: "0 1 150px" }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="all">Any status</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>

                <button
                  className="ta-btn ta-btn-outline ta-btn-sm"
                  onClick={() => {
                    if (!filteredMembers.length) { showToast("Nothing to export with these filters."); return; }
                    downloadDirectoryCsv(filteredMembers, progressByMemberId);
                    showToast(`Exported ${filteredMembers.length} member${filteredMembers.length === 1 ? "" : "s"} to CSV.`);
                  }}
                >
                  <Download size={13} /> Export CSV
                </button>
              </div>

              {/* Bulk bar - suspend was the only bulk action that existed. */}
              {selectedMemberIds.size > 0 && (
                <div className="ta-row ta-gap8" style={{ flexWrap: "wrap", padding: "10px 12px", background: "var(--primary-tint)", borderRadius: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>{selectedMemberIds.size} selected</span>
                  <button className="ta-btn ta-btn-outline ta-btn-sm" disabled={bulkBusy}
                    onClick={() => runBulk("Reactivated", (m) => updateOrgMemberStatus(m.id, orgId, "active"))}>
                    Activate
                  </button>
                  <button className="ta-btn ta-btn-danger ta-btn-sm" disabled={bulkBusy}
                    onClick={() => runBulk("Suspended", (m) => updateOrgMemberStatus(m.id, orgId, "suspended"))}>
                    {bulkBusy ? "Working..." : "Suspend"}
                  </button>
                  <select className="ta-input ta-btn-sm" style={{ width: "auto", minWidth: 150 }} value={bulkCohortId} onChange={(e) => setBulkCohortId(e.target.value)}>
                    <option value="">Move to cohort...</option>
                    {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button className="ta-btn ta-btn-outline ta-btn-sm" disabled={bulkBusy || !bulkCohortId}
                    onClick={() => {
                      const target = bulkCohortId;
                      runBulk(`Moved to ${cohorts.find((c) => c.id === target)?.name || "cohort"}`, (m) => assignMemberToCohort(m.id, target, null));
                      setBulkCohortId("");
                    }}>
                    Assign cohort
                  </button>
                  <select
                    className="ta-input ta-btn-sm" style={{ width: "auto", minWidth: 150 }}
                    value=""
                    onChange={(e) => {
                      const nextRole = e.target.value;
                      if (!nextRole) return;
                      runBulk(`Role set to ${ROLE_LABEL[nextRole] || nextRole}`, (m) => updateUserPlatformRole(m.id, nextRole, orgId));
                    }}
                  >
                    <option value="">Change role to...</option>
                    {PLATFORM_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => setSelectedMemberIds(new Set())}>Clear</button>
                </div>
              )}

              <div className="ta-table-wrap">
                <table className="ta-table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}>
                        <input
                          type="checkbox"
                          checked={filteredMembers.length > 0 && selectedMemberIds.size === filteredMembers.length}
                          onChange={(e) => setSelectedMemberIds(e.target.checked ? new Set(filteredMembers.map((m) => m.id)) : new Set())}
                        />
                      </th>
                      <th style={{ minWidth: 180 }}>Member</th>
                      <th>Role</th>
                      <th>Cohort / Track</th>
                      <th>Attendance</th>
                      <th style={{ minWidth: 150 }}>Course Progress</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {membersQuery.loading && <tr><td colSpan={8} className="ta-empty">Loading members...</td></tr>}
                    {!membersQuery.loading && filteredMembers.length === 0 && <tr><td colSpan={8} className="ta-empty">No members match your filters.</td></tr>}
                    {filteredMembers.map((m) => {
                      const hasProgress = Object.prototype.hasOwnProperty.call(progressByMemberId, m.id);
                      const progress = hasProgress ? progressByMemberId[m.id] : 0;
                      const attendance = null; // no real attendance/session-checkin data exists in the schema yet
                      const riskTone = !hasProgress ? "default" : progress >= 70 ? "success" : progress >= 40 ? "warning" : "danger";
                      const riskLabel = !hasProgress ? "No enrollments" : progress >= 70 ? "On Track" : progress >= 40 ? "Needs Attention" : "High Risk";
                      const initials = (m.display_name || "U").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

                      return (
                        <tr key={m.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedMemberIds.has(m.id)}
                              onChange={(e) => {
                                const next = new Set(selectedMemberIds);
                                if (e.target.checked) next.add(m.id); else next.delete(m.id);
                                setSelectedMemberIds(next);
                              }}
                            />
                          </td>
                          <td style={{ minWidth: 180 }}>
                            <div className="ta-row ta-gap10" style={{ cursor: "pointer", alignItems: "center" }} onClick={() => setDetailMember(m)}>
                              <Avatar initials={initials} size={34} src={m.avatar_url || undefined} />
                              <div style={{ minWidth: 130, flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text)", whiteSpace: "normal", wordBreak: "break-word" }}>{m.display_name || "Member"}</div>
                                <div style={{ fontSize: 11, color: "var(--text-3)", whiteSpace: "normal", wordBreak: "break-all" }}>{m.email || "No email on file"}</div>
                              </div>
                            </div>
                          </td>
                          <td><Tag>{ROLE_LABEL[m.role] || m.role || "learner"}</Tag></td>
                          <td>
                            <span style={{ fontSize: 12.5, fontWeight: 500, color: m.cohort_name ? "var(--text)" : "var(--text-3)" }}>
                              {m.cohort_name || "Not in a cohort"}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600, fontSize: 12.5, color: "var(--text-3)" }}>
                              {attendance != null ? `${attendance}%` : "—"}
                            </span>
                          </td>
                          <td>
                            <div style={{ width: "100%", maxWidth: 140 }}>
                              <div className="ta-row ta-between" style={{ fontSize: 11, marginBottom: 4 }}>
                                <span>Overall</span>
                                <span style={{ fontWeight: 700 }}>{hasProgress ? `${progress}%` : `${m.overallProgress ? Math.round(m.overallProgress) : 0}%`}</span>
                              </div>
                              <div style={{ width: "100%", height: 6, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden" }}>
                                <div style={{ width: `${hasProgress ? progress : (m.overallProgress || 0)}%`, height: "100%", background: riskTone === "success" ? "#10B981" : riskTone === "warning" ? "#F59E0B" : "#EF4444", borderRadius: 4 }} />
                              </div>
                            </div>
                          </td>
                          <td><Tag tone={riskTone}>{riskLabel}</Tag></td>
                          <td style={{ textAlign: "right" }}>
                            <div className="ta-row ta-gap6" style={{ justifyContent: "flex-end" }}>
                              <button className="ta-btn ta-btn-outline ta-btn-sm" title="Open member record" onClick={() => setDetailMember(m)}>
                                <Eye size={13} />
                              </button>
                              <button
                                className="ta-btn ta-btn-outline ta-btn-sm"
                                title="More actions"
                                onClick={() => setActionsMember(m)}
                              >
                                <MoreHorizontal size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "progress" && (
          <div className="ta-card">
            <div className="ta-row ta-between" style={{ marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                Every learner in this organization, every assigned course, and a pace indicator. Sorted with learners who need attention first.
              </div>
              <select className="ta-input" style={{ width: "auto" }} value={progressSort} onChange={e => setProgressSort(e.target.value)}>
                <option value="pace">Sort: pace (behind first)</option>
                <option value="name">Sort: name</option>
              </select>
            </div>
            <div className="ta-table-wrap">
              <table className="ta-table">
                <thead><tr><th>Learner</th><th>Department</th><th>Assigned</th><th>Completed</th><th>Pending</th><th>Avg. progress</th><th>Pace</th></tr></thead>
                <tbody>
                  {progressQuery.loading && <tr><td colSpan={7} className="ta-empty">Loading learner progress...</td></tr>}
                  {!progressQuery.loading && sortedProgressRows.length === 0 && <tr><td colSpan={7} className="ta-empty">No learners in this organization yet.</td></tr>}
                  {sortedProgressRows.map(r => {
                    const meta = PACE_META[r.pace] || PACE_META.on_pace;
                    const memberRow = members.find((m) => m.id === r.id);
                    return (
                      <tr key={r.id}>
                        <td>
                          <div
                            className="ta-row ta-gap10"
                            style={{ cursor: memberRow ? "pointer" : "default" }}
                            onClick={() => memberRow && setDetailMember(memberRow)}
                          >
                            <Avatar initials={r.initials} size={32} />
                            <span style={{ fontWeight: 600 }}>{r.name}</span>
                          </div>
                        </td>
                        <td>{r.department}</td>
                        <td>{r.assignedCount}</td>
                        <td>{r.completedCount}</td>
                        <td>{Math.max(0, r.assignedCount - r.completedCount)}</td>
                        <td>{r.avgProgress || 0}%</td>
                        <td><Tag tone={meta.tone} icon={meta.Icon}>{meta.label}</Tag></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "mentorapps" && (
          <div className="ta-card">
            <div style={{ fontSize: 12.5, color: "var(--text-2)", marginBottom: 14 }}>
              <UserPlus size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
              Instructor records in this organization that aren't active yet. Approving flips the mentor
              row to active, which is what actually lists them to learners and lets them be assigned
              sessions. The schema has no separate "is_approved" flag, so `is_active` is the real gate.
            </div>
            <div className="ta-table-wrap">
              <table className="ta-table">
                <thead><tr><th>Applicant</th><th>Specialization</th><th>Rate</th><th>Submitted</th><th style={{ textAlign: "right" }}>Decision</th></tr></thead>
                <tbody>
                  {applicationsQuery.loading && <tr><td colSpan={5} className="ta-empty">Loading applications...</td></tr>}
                  {!applicationsQuery.loading && applications.length === 0 && (
                    <tr><td colSpan={5} className="ta-empty">
                      No pending instructor applications. Every instructor record in this organization is already active.
                    </td></tr>
                  )}
                  {applications.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div className="ta-row ta-gap10">
                          <Avatar initials={(a.display_name || "A").slice(0, 2).toUpperCase()} size={32} src={a.user_profiles?.avatar_url || undefined} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, overflowWrap: "anywhere" }}>{a.display_name || "Applicant"}</div>
                            <div style={{ fontSize: 11, color: "var(--text-3)" }}>Awaiting approval</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ overflowWrap: "anywhere" }}>{a.specialization || a.expertise || "Not stated"}</td>
                      <td>{a.hourly_rate ? Number(a.hourly_rate).toLocaleString() : "Not set"}</td>
                      <td>{a.created_at ? new Date(a.created_at).toLocaleDateString() : "N/A"}</td>
                      <td style={{ textAlign: "right" }}>
                        <div className="ta-row ta-gap6" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <button
                            className="ta-btn ta-btn-primary ta-btn-sm"
                            onClick={async () => {
                              try {
                                await decideMentorApplication(a.id, true);
                                showToast(`${a.display_name || "Applicant"} approved as an instructor.`);
                                applicationsQuery.refetch();
                                instructorsQuery.refetch();
                              } catch (e) {
                                showToast(e?.message || "Could not approve this application.");
                              }
                            }}
                          >
                            <CheckCircle2 size={13} /> Approve
                          </button>
                          <button
                            className="ta-btn ta-btn-outline ta-btn-sm"
                            onClick={async () => {
                              if (!window.confirm(`Decline ${a.display_name || "this applicant"}? Their record stays inactive.`)) return;
                              try {
                                await decideMentorApplication(a.id, false);
                                showToast("Application left inactive.");
                                applicationsQuery.refetch();
                              } catch (e) {
                                showToast(e?.message || "Could not update this application.");
                              }
                            }}
                          >
                            <X size={13} /> Decline
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

        {tab === "privileges" && (
          <div className="ta-card">
            <div className="ta-row ta-gap8">
              <ShieldCheck size={17} color="var(--primary)" />
              <div style={{ fontWeight: 800, fontSize: 15 }}>Privileges &amp; roles</div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4 }}>
              What each role in this organization is allowed to do. Toggles write straight to
              org_role_permission_settings, which is what the runtime permission checks read - so a
              change here takes effect for those members immediately. Individual members' roles are
              changed from their own record in the Users tab.
            </div>

            {rolePermsQuery.loading && <div className="ta-empty ta-mt12">Loading permissions...</div>}

            {!rolePermsQuery.loading && (
              <div className="ta-table-wrap ta-mt12">
                <table className="ta-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 240 }}>Permission</th>
                      {ORG_RBAC_ROLES.map((r) => (
                        <th key={r} style={{ textAlign: "center", textTransform: "capitalize" }}>
                          {r === "mentor" ? "Instructor" : r}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ORG_RBAC_PERMISSIONS.map((perm) => (
                      <tr key={perm.key}>
                        <td style={{ fontSize: 12.5, fontWeight: 600, overflowWrap: "anywhere" }}>{perm.label}</td>
                        {ORG_RBAC_ROLES.map((role) => {
                          const allowed = !!permLookup[`${role}:${perm.key}`];
                          return (
                            <td key={role} style={{ textAlign: "center" }}>
                              <div style={{ display: "inline-flex" }}>
                                <Switch
                                  on={allowed}
                                  onChange={async () => {
                                    const res = await setOrgRolePermission(orgId, role, perm.key, !allowed, currentUserId);
                                    if (res && res.success === false) { showToast(res.error); return; }
                                    showToast(`${perm.label}: ${!allowed ? "granted to" : "revoked from"} ${role === "mentor" ? "instructors" : `${role}s`}.`);
                                    rolePermsQuery.refetch();
                                  }}
                                />
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="ta-mt12" style={{ fontSize: 11.5, color: "var(--text-3)" }}>
              Admins and owners are deliberately not listed - they hold full organization access by
              definition, and a toggle that could lock an admin out of their own workspace would be a
              way to break the account, not a feature.
            </div>
          </div>
        )}

        {tab === "applications" && (
          <div className="ta-card">
            <div className="ta-table-wrap">
            <table className="ta-table">
              <thead><tr><th>Instructor</th><th>Status</th><th>Sessions Completed</th><th>Rating</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
              <tbody>
                {instructorsQuery.loading && <tr><td colSpan={5} className="ta-empty">Loading instructors...</td></tr>}
                {!instructorsQuery.loading && instructors.length === 0 && <tr><td colSpan={5} className="ta-empty">No instructors in this organization yet - promote one from the Users tab.</td></tr>}
                {instructors.map(m => {
                  const memberRow = members.find((x) => x.id === m.user_id);
                  return (
                    <tr key={m.id}>
                      <td><div className="ta-row ta-gap10"><Avatar initials={(m.display_name || "I").slice(0, 2).toUpperCase()} size={32} /><span style={{ fontWeight: 600 }}>{m.display_name}</span></div></td>
                      <td><Tag tone={m.is_active ? "success" : "warning"}>{m.is_active ? "Active" : "Inactive"}</Tag></td>
                      <td>{m.sessions_completed ?? 0}</td>
                      <td>{m.rating ? `${m.rating}/5` : "No ratings yet"}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="ta-btn ta-btn-outline ta-btn-sm"
                          disabled={!memberRow}
                          title={memberRow ? "Open their member record" : "No directory record found for this instructor"}
                          onClick={() => memberRow && setDetailMember(memberRow)}
                        >
                          <Eye size={13} /> Record
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {tab === "invites" && (
          <div className="ta-card">
            <div style={{ fontSize: 12.5, color: "var(--text-2)", marginBottom: 14 }}>
              <Mail size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
              Resending cancels the stale invite and issues a fresh 7-day token, which is what actually
              re-sends the email. Copy link is the fallback for when email delivery isn't configured.
            </div>
            <div className="ta-table-wrap">
            <table className="ta-table">
              <thead><tr><th>Email</th><th>Role</th><th>Sent</th><th>Expires</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
              <tbody>
                {invitationsQuery.loading && <tr><td colSpan={5} className="ta-empty">Loading invitations...</td></tr>}
                {!invitationsQuery.loading && invitations.length === 0 && <tr><td colSpan={5} className="ta-empty">No pending invitations.</td></tr>}
                {invitations.map(i => (
                  <tr key={i.id}>
                    <td style={{ overflowWrap: "anywhere" }}>{i.email}</td>
                    <td><Tag>{ROLE_LABEL[i.role] || i.role}</Tag></td>
                    <td>{new Date(i.created_at).toLocaleDateString()}</td>
                    <td>
                      {i.expires_at
                        ? <span style={{ color: new Date(i.expires_at) < new Date() ? "var(--danger)" : "var(--text-2)" }}>
                            {new Date(i.expires_at).toLocaleDateString()}
                          </span>
                        : "N/A"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="ta-row ta-gap6" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <button
                          className="ta-btn ta-btn-outline ta-btn-sm"
                          disabled={invitingBusy === i.id}
                          title="Cancel this invite and send a fresh one"
                          onClick={async () => {
                            setInvitingBusy(i.id);
                            try {
                              const res = await resendInvitation(i);
                              showToast(res.success ? `Invitation resent to ${i.email}.` : res.error);
                              invitationsQuery.refetch();
                            } finally {
                              setInvitingBusy(null);
                            }
                          }}
                        >
                          <RefreshCw size={13} /> {invitingBusy === i.id ? "Sending..." : "Resend"}
                        </button>
                        <button
                          className="ta-btn ta-btn-outline ta-btn-sm"
                          title="Copy the invite link to share directly"
                          onClick={async () => {
                            const link = buildInvitationLink(i);
                            if (!link) { showToast("This invitation has no token to link to."); return; }
                            try {
                              await navigator.clipboard.writeText(link);
                              showToast("Invite link copied to your clipboard.");
                            } catch {
                              window.prompt("Copy this invite link:", link);
                            }
                          }}
                        >
                          <Link2 size={13} /> Copy link
                        </button>
                        <button className="ta-btn ta-btn-danger ta-btn-sm" onClick={async () => {
                          await revokeInvitation(i.id);
                          invitationsQuery.refetch();
                          showToast("Invitation revoked.");
                        }}>Revoke</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {tab === "dsar" && (
          <div className="ta-card">
            <div className="ta-row ta-between" style={{ marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                <FileText size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                GDPR data-subject-access requests submitted by learners (export, erasure & rectification). Platform-wide. Not filtered by organization.
              </div>
              <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => dsarQuery.refetch()}>Refresh</button>
            </div>
            <div className="ta-table-wrap">
            <table className="ta-table">
              <thead><tr><th>User / Email</th><th>Type</th><th>Status</th><th>Requested</th><th>Actions</th></tr></thead>
              <tbody>
                {dsarQuery.loading && <tr><td colSpan={5} className="ta-empty">Loading data requests...</td></tr>}
                {!dsarQuery.loading && dsarRequests.length === 0 && <tr><td colSpan={5} className="ta-empty">No data requests submitted yet.</td></tr>}
                {dsarRequests.map(r => (
                  <tr key={r.id}>
                    <td><span style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{r.email || r.user_id}</span></td>
                    <td><Tag>{r.request_type}</Tag></td>
                    <td><Tag tone={r.status === "pending" ? "warning" : r.status === "completed" ? "success" : "danger"}>{r.status}</Tag></td>
                    <td>{r.requested_at ? new Date(r.requested_at).toLocaleDateString() : "N/A"}</td>
                    <td>
                      {r.status !== "pending" ? (
                        <span style={{ fontSize: 12, color: "var(--text-2)" }}>Resolved</span>
                      ) : (
                        <div className="ta-row ta-gap6" style={{ flexWrap: "wrap" }}>
                          {r.request_type === "export" && (
                            <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={async () => {
                              try {
                                await downloadUserDataExport(r.user_id, r.email || r.user_id);
                                await updateDSARRequestStatus(r.id, "completed");
                                dsarQuery.refetch();
                                showToast(`Export downloaded for ${r.email || r.user_id}`);
                              } catch (e) {
                                showToast(e?.message || "Could not complete this export request");
                              }
                            }}><Download size={13} /> Export</button>
                          )}
                          {r.request_type === "erasure" && (
                            <button className="ta-btn ta-btn-danger ta-btn-sm" onClick={async () => {
                              // deleteUserCascade is destructive & immediate - only ever run
                              // from here, by an admin, after they've reviewed the request,
                              // never directly from learner-facing UI.
                              if (!window.confirm(`Permanently erase all data for ${r.email || r.user_id}? This cannot be undone.`)) return;
                              try {
                                const res = await deleteUserCascade(r.user_id);
                                await updateDSARRequestStatus(r.id, res.success ? "completed" : "failed", res.success ? undefined : JSON.stringify(res.details));
                                dsarQuery.refetch();
                                showToast(res.success ? `Data erased for ${r.email || r.user_id}` : "Erasure partially failed. Check logs");
                              } catch (e) {
                                showToast(e?.message || "Could not complete this erasure request");
                              }
                            }}><Trash2 size={13} /> Erase data</button>
                          )}
                          <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={async () => {
                            await updateDSARRequestStatus(r.id, "rejected");
                            dsarQuery.refetch();
                            showToast("Request dismissed.");
                          }}><X size={13} /> Dismiss</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        <PortalModal
          isOpen={inviteOpen}
          onClose={() => setInviteOpen(false)}
          maxWidth={540}
          zIndex={9999}
        >
          <div className="ta-row ta-between">
            <div className="ta-title" style={{ fontSize: 18 }}>{bulkMode ? "Bulk Invite Users" : "Invite New User"}</div>
            <div className="ta-row ta-gap8">
              <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => setBulkMode((v) => !v)}>
                {bulkMode ? "Single invite" : "Bulk invite"}
              </button>
              <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => setInviteOpen(false)}><X size={16} /></button>
            </div>
          </div>
          {!bulkMode ? (
            <>
              <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 6, marginBottom: 14 }}>
                Invite a new member to join your organization workspace.
              </p>
              <div className="ta-grid ta-grid-2 ta-mt12">
                <div>
                  <div className="ta-label">Email Address</div>
                  <input className="ta-input ta-mt6" style={{ width: "100%", boxSizing: "border-box" }} placeholder="user@company.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} autoFocus />
                </div>
                <div>
                  <div className="ta-label">Role</div>
                  <select className="ta-input ta-mt6" style={{ width: "100%", boxSizing: "border-box" }} value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                    {PLATFORM_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="ta-row ta-gap10 ta-mt20" style={{ justifyContent: "flex-end" }}>
                <button className="ta-btn ta-btn-outline" onClick={() => setInviteOpen(false)}>Cancel</button>
                <button className="ta-btn ta-btn-primary" onClick={async () => {
                  if (!inviteEmail.trim() || !orgId) return;
                  try {
                    await createInvitation({ organizationId: orgId, email: inviteEmail.trim(), role: inviteRole });
                    setInviteOpen(false); setInviteEmail("");
                    invitationsQuery.refetch();
                    showToast("Invitation sent successfully!");
                  } catch (e) {
                    showToast(e?.message || "Could not send that invitation.");
                  }
                }}>Send Invitation</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 8 }}>
                Enter one email per line. Each user receives an automated onboarding invitation.
              </div>
              <textarea className="ta-input ta-mt10" rows={5} placeholder={"jane@company.com\nbob@company.com\n..."} value={bulkEmails} onChange={(e) => setBulkEmails(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} />
              <div className="ta-mt10">
                <div className="ta-label">Assign Role</div>
                <select className="ta-input ta-mt6" style={{ width: "100%", boxSizing: "border-box" }} value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                  {PLATFORM_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="ta-row ta-gap10 ta-mt16" style={{ justifyContent: "flex-end" }}>
                <button className="ta-btn ta-btn-outline" onClick={() => setInviteOpen(false)}>Cancel</button>
                <button
                  className="ta-btn ta-btn-primary"
                  disabled={bulkSubmitting}
                  onClick={async () => {
                    const emails = bulkEmails.split("\n").map((e) => e.trim()).filter((e) => e && e.includes("@"));
                    if (!emails.length || !orgId) return;
                    setBulkSubmitting(true);
                    let succeeded = 0, failed = 0;
                    for (const email of emails) {
                      try {
                        await createInvitation({ organizationId: orgId, email, role: inviteRole });
                        succeeded++;
                      } catch {
                        failed++;
                      }
                    }
                    setBulkSubmitting(false);
                    setInviteOpen(false); setBulkEmails(""); setBulkMode(false);
                    invitationsQuery.refetch();
                    showToast(`${succeeded} invitation${succeeded === 1 ? "" : "s"} sent${failed > 0 ? `, ${failed} failed` : ""}.`);
                  }}
                >
                  {bulkSubmitting ? "Sending..." : `Send ${bulkEmails.split("\n").filter((e) => e.trim().includes("@")).length} Invitations`}
                </button>
              </div>

              <div className="ta-mt16" style={{ paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Or Import CSV File</div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                  CSV with "email" and optional "role" columns.
                </div>
                <input
                  type="file" accept=".csv,text/csv" className="ta-mt8"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !orgId) return;
                    const text = await file.text();
                    const rows = parseUserImportCsv(text);
                    if (!rows.length) { showToast("No valid rows found in this CSV."); return; }
                    setBulkSubmitting(true);
                    try {
                      const result = await bulkImportUsers(rows, orgId, null);
                      showToast(`${result.succeeded.length} invited${result.failed.length > 0 ? `, ${result.failed.length} failed (${result.failed.slice(0, 3).map((f) => f.email).join(", ")}${result.failed.length > 3 ? "..." : ""})` : ""}.`);
                      invitationsQuery.refetch();
                      setInviteOpen(false); setBulkMode(false);
                    } finally {
                      setBulkSubmitting(false);
                      e.target.value = "";
                    }
                  }}
                />
              </div>
            </>
          )}
        </PortalModal>
      </div>

      {/* Row actions, as a portal sheet so nothing can clip it */}
      <PortalModal isOpen={Boolean(actionsMember)} onClose={() => setActionsMember(null)} maxWidth={420} zIndex={10000}>
        {actionsMember && (
          <>
            <div className="ta-row ta-between" style={{ gap: 10 }}>
              <div className="ta-row ta-gap10" style={{ minWidth: 0 }}>
                <Avatar
                  initials={(actionsMember.display_name || "U").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  size={34}
                  src={actionsMember.avatar_url || undefined}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, overflowWrap: "anywhere" }}>{actionsMember.display_name || "Member"}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)", overflowWrap: "anywhere" }}>{actionsMember.email || "No email on file"}</div>
                </div>
              </div>
              <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => setActionsMember(null)} aria-label="Close"><X size={16} /></button>
            </div>

            <div className="ta-col ta-gap6 ta-mt16">
              {[
                {
                  label: "Open member record", Icon: Eye,
                  run: () => setDetailMember(actionsMember),
                },
                {
                  label: "Award certificate", Icon: Award,
                  run: () => { setCertModalUser(actionsMember); setCertTitle(""); setCertFileUrl(""); },
                },
                {
                  label: actionsMember.status === "active" ? "Suspend member" : "Reactivate member",
                  Icon: ShieldCheck,
                  run: async () => {
                    try {
                      await updateOrgMemberStatus(actionsMember.id, orgId, actionsMember.status === "active" ? "suspended" : "active");
                      refreshDirectory();
                      showToast(`Status updated for ${actionsMember.display_name || "member"}.`);
                    } catch (e) {
                      showToast(e?.message || "Could not change their status.");
                    }
                  },
                },
                {
                  label: "Download their data", Icon: Download,
                  run: async () => {
                    try {
                      await downloadUserDataExport(actionsMember.id, actionsMember.display_name || actionsMember.id);
                      showToast(`Data export downloaded for ${actionsMember.display_name || "user"}.`);
                    } catch (e) {
                      showToast(e?.message || "Could not export this user's data.");
                    }
                  },
                },
                {
                  label: "Remove from organization", Icon: UserMinus, danger: true,
                  run: async () => {
                    if (!window.confirm(`Remove ${actionsMember.display_name || "this member"} from the organization?`)) return;
                    const res = await removeOrgMember(actionsMember.id, orgId);
                    showToast(res.success ? `${actionsMember.display_name || "Member"} removed.` : res.error);
                    if (res.success) refreshDirectory();
                  },
                },
              ].map((action) => {
                const Icon = action.Icon;
                return (
                  <div
                    key={action.label}
                    className="ta-row ta-gap10 ta-dropdown-item"
                    style={{
                      padding: "11px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                      borderRadius: 10, background: "var(--surface-2)",
                      color: action.danger ? "var(--danger)" : "var(--text)",
                    }}
                    onClick={() => { const target = actionsMember; setActionsMember(null); action.run(target); }}
                  >
                    <Icon size={15} /> {action.label}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </PortalModal>

      {/* Full member record */}
      <MemberDetailModal
        member={detailMember}
        orgId={orgId}
        cohorts={cohorts}
        onClose={() => setDetailMember(null)}
        onChanged={refreshDirectory}
        showToast={showToast}
      />

      <PortalModal
        isOpen={Boolean(certModalUser)}
        onClose={() => setCertModalUser(null)}
        maxWidth={500}
        zIndex={9999}
      >
        {certModalUser && (
          <>
            <div className="ta-row ta-between">
              <div className="ta-title" style={{ fontSize: 18 }}>Issue Certificate to {certModalUser.display_name || "Member"}</div>
              <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => setCertModalUser(null)}><X size={16} /></button>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4 }}>
              Issues a direct verified credential to this member's portfolio.
            </div>
            <div className="ta-label ta-mt16">Certificate Title</div>
            <input className="ta-input ta-mt6" style={{ width: "100%", boxSizing: "border-box" }} placeholder="e.g. Outstanding Contribution Award" value={certTitle} onChange={(e) => setCertTitle(e.target.value)} autoFocus />
            <div className="ta-label ta-mt16">Upload Certificate Document (Optional)</div>
            <div className="ta-mt6">
              <FileUploadZone
                bucket="uploads"
                pathPrefix={`certificates/${certModalUser.user_id || certModalUser.id}`}
                accept="application/pdf,image/*"
                onUploaded={(url) => setCertFileUrl(url)}
                label="Drag and drop certificate PDF or image, or click to browse"
              />
            </div>
            <div className="ta-row ta-gap10 ta-mt20" style={{ justifyContent: "flex-end" }}>
              <button className="ta-btn ta-btn-outline" onClick={() => setCertModalUser(null)}>Cancel</button>
              <button
                className="ta-btn ta-btn-primary"
                disabled={issuingCert || !certTitle.trim()}
                onClick={async () => {
                  setIssuingCert(true);
                  try {
                    const result = await issueCertificateDirectly(certModalUser.user_id || certModalUser.id, orgId, certTitle.trim(), null, certFileUrl || null);
                    if (!result.success) showToast(result.error);
                    else { showToast(`Certificate issued to ${certModalUser.display_name}.`); setCertModalUser(null); }
                  } finally {
                    setIssuingCert(false);
                  }
                }}
              >
                {issuingCert ? "Issuing..." : "Issue Certificate"}
              </button>
            </div>
          </>
        )}
      </PortalModal>
    </div>
  );
}
