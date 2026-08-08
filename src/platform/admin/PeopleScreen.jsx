import React, { useState, useContext } from "react";
import { TopBar, Avatar, Tag, ToastContext } from "../components/PlatformUI.jsx";
import { UserPlus, Search, Check, X, ShieldAlert, Download, Trash2, FileText, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchOrgMembers, fetchMentorApplications, fetchPendingInvitations, createInvitation, revokeInvitation, decideMentorApplication, updateOrgMemberStatus, fetchOrgLearnerProgressOverview } from "../../lib/api/platform.js";
import { fetchAllDSARRequests, updateDSARRequestStatus, exportUserData, deleteUserCascade } from "../../lib/api/gdprService.js";

const PACE_META = {
  ahead: { label: "Ahead", tone: "success", Icon: ArrowUpRight },
  on_pace: { label: "On pace", tone: "default", Icon: Minus },
  behind: { label: "Behind", tone: "danger", Icon: ArrowDownRight },
  not_started: { label: "Not started", tone: "warning", Icon: Minus },
};

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

export function PeopleScreen({ orgId, orgSelector, setScreen }) {
  const showToast = useContext(ToastContext);
  const [tab, setTab] = useState("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("learner");
  const [search, setSearch] = useState("");
  const [progressSort, setProgressSort] = useState("pace"); // "pace" | "name"

  const membersQuery = useSupabaseQuery(async () => orgId ? fetchOrgMembers(orgId) : [], [orgId]);
  const applicationsQuery = useSupabaseQuery(async () => orgId ? fetchMentorApplications(orgId) : [], [orgId]);
  const invitationsQuery = useSupabaseQuery(async () => orgId ? fetchPendingInvitations(orgId) : [], [orgId]);
  const progressQuery = useSupabaseQuery(async () => orgId ? fetchOrgLearnerProgressOverview(orgId) : [], [orgId]);
  // DSAR requests have no org_id column in the schema - this queue is
  // platform-wide by design, not scoped to the current org.
  const dsarQuery = useSupabaseQuery(async () => fetchAllDSARRequests(), []);

  const members = membersQuery.data || [];
  const applications = applicationsQuery.data || [];
  const invitations = invitationsQuery.data || [];
  const dsarRequests = dsarQuery.data || [];
  const pendingDsarCount = dsarRequests.filter(r => r.status === "pending").length;
  const progressRows = progressQuery.data || [];
  const behindCount = progressRows.filter(r => r.pace === "behind").length;

  // Behind sorts first by default - that's the point of this tab (surface
  // who needs attention without opening each learner's record).
  const paceOrder = { behind: 0, not_started: 1, on_pace: 2, ahead: 3 };
  const sortedProgressRows = [...progressRows].sort((a, b) => {
    if (progressSort === "name") return a.name.localeCompare(b.name);
    return (paceOrder[a.pace] ?? 9) - (paceOrder[b.pace] ?? 9);
  });

  const filteredMembers = members.filter(m =>
    m.display_name?.toLowerCase().includes(search.toLowerCase()) ||
    m.role?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="ta-fade">
      <TopBar
        title="People & Access" sub="Directory, instructor applications & invitations"
        orgSelector={orgSelector}
        onNavigate={setScreen}
        right={<button className="ta-btn ta-btn-primary" onClick={() => setInviteOpen(true)}><UserPlus size={15} /> Invite user</button>}
      />
      <div className="ta-content">
        <div className="ta-tabs">
          {[{ k: "all", label: "Directory" }, { k: "progress", label: `Progress${behindCount > 0 ? ` (${behindCount} behind)` : ""}` }, { k: "applications", label: `Applications (${applications.length})` }, { k: "invites", label: `Pending Invites (${invitations.length})` }, { k: "dsar", label: `Data Requests (${pendingDsarCount})` }].map(t => (
            <div key={t.k} className={`ta-tab ${tab === t.k ? "active" : ""}`} onClick={() => setTab(t.k)}>{t.label}</div>
          ))}
        </div>

        {tab === "all" && (
          <div className="ta-card ta-mt16">
            <div className="ta-row ta-between mb-4">
              <div className="ta-search"><Search size={14} /><input className="ta-input" style={{ border: "none", padding: 0 }} placeholder="Search members..." value={search} onChange={e => setSearch(e.target.value)} /></div>
            </div>
            <div className="ta-table-wrap">
            <table className="ta-table">
              <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {membersQuery.loading && <tr><td colSpan={4} className="ta-empty">Loading members...</td></tr>}
                {!membersQuery.loading && filteredMembers.length === 0 && <tr><td colSpan={4} className="ta-empty">No members found.</td></tr>}
                {filteredMembers.map(m => (
                  <tr key={m.user_id}>
                    <td><div className="ta-row ta-gap10"><Avatar initials={(m.display_name || "U").slice(0, 2).toUpperCase()} size={32} /><span style={{ fontWeight: 600 }}>{m.display_name || "User"}</span></div></td>
                    <td><Tag>{m.role || "learner"}</Tag></td>
                    <td><Tag tone={m.status === "active" ? "success" : "warning"}>{m.status || "active"}</Tag></td>
                    <td>
                      <div className="ta-row ta-gap6">
                        <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={async () => {
                          // m is a raw user_profiles row (fetchOrgMembers does a plain
                          // select("*") on that table) - the real auth uid is its
                          // `user_id` column (user_profiles.id is a separate internal
                          // PK). organization_members.user_id (a different table's own
                          // column) is what updateOrgMemberStatus filters by internally.
                          // Also pass orgId - updateOrgMemberStatus(userId, organizationId,
                          // status) was being called with the status in the organizationId slot.
                          await updateOrgMemberStatus(m.user_id, orgId, m.status === "active" ? "suspended" : "active");
                          membersQuery.refetch();
                          showToast(`Status updated for ${m.display_name}`);
                        }}>
                          {m.status === "active" ? "Suspend" : "Activate"}
                        </button>
                        <button className="ta-btn ta-btn-outline ta-btn-sm" title="Download this user's data as JSON" onClick={async () => {
                          try {
                            await downloadUserDataExport(m.user_id, m.display_name || m.user_id);
                            showToast(`Data export downloaded for ${m.display_name || "user"}`);
                          } catch (e) {
                            showToast(e?.message || "Could not export this user's data");
                          }
                        }}>
                          <Download size={13} /> Export
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

        {tab === "progress" && (
          <div className="ta-card ta-mt16">
            <div className="ta-row ta-between mb-4">
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
                <thead><tr><th>Learner</th><th>Department</th><th>Assigned</th><th>Completed</th><th>Avg. progress</th><th>Pace</th></tr></thead>
                <tbody>
                  {progressQuery.loading && <tr><td colSpan={6} className="ta-empty">Loading learner progress...</td></tr>}
                  {!progressQuery.loading && sortedProgressRows.length === 0 && <tr><td colSpan={6} className="ta-empty">No learners in this organization yet.</td></tr>}
                  {sortedProgressRows.map(r => {
                    const meta = PACE_META[r.pace] || PACE_META.on_pace;
                    return (
                      <tr key={r.id}>
                        <td><div className="ta-row ta-gap10"><Avatar initials={r.initials} size={32} /><span style={{ fontWeight: 600 }}>{r.name}</span></div></td>
                        <td>{r.department}</td>
                        <td>{r.assignedCount}</td>
                        <td>{r.completedCount}</td>
                        <td>{r.assignedCount > 0 ? `${r.avgProgress}%` : "N/A"}</td>
                        <td><Tag tone={meta.tone} icon={meta.Icon}>{meta.label}</Tag></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "applications" && (
          <div className="ta-card ta-mt16">
            <div className="ta-table-wrap">
            <table className="ta-table">
              <thead><tr><th>Applicant</th><th>Title</th><th>Hourly rate</th><th>Actions</th></tr></thead>
              <tbody>
                {applicationsQuery.loading && <tr><td colSpan={4} className="ta-empty">Loading applications...</td></tr>}
                {!applicationsQuery.loading && applications.length === 0 && <tr><td colSpan={4} className="ta-empty">No pending instructor applications.</td></tr>}
                {applications.map(a => (
                  <tr key={a.id}>
                    <td><div className="ta-row ta-gap10"><Avatar initials={(a.display_name || "A").slice(0, 2).toUpperCase()} size={32} /><span style={{ fontWeight: 600 }}>{a.display_name}</span></div></td>
                    <td>{a.title}</td>
                    <td>${a.hourly_rate}/hr</td>
                    <td>
                      <div className="ta-row ta-gap6">
                        <button className="ta-btn ta-btn-primary ta-btn-sm" onClick={async () => {
                          await decideMentorApplication(a.id, "approved");
                          applicationsQuery.refetch();
                          showToast("Application approved!");
                        }}><Check size={14} /> Approve</button>
                        <button className="ta-btn ta-btn-danger ta-btn-sm" onClick={async () => {
                          await decideMentorApplication(a.id, "rejected");
                          applicationsQuery.refetch();
                          showToast("Application rejected.");
                        }}><X size={14} /> Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {tab === "invites" && (
          <div className="ta-card ta-mt16">
            <div className="ta-table-wrap">
            <table className="ta-table">
              <thead><tr><th>Email</th><th>Role</th><th>Sent</th><th>Actions</th></tr></thead>
              <tbody>
                {invitationsQuery.loading && <tr><td colSpan={4} className="ta-empty">Loading invitations...</td></tr>}
                {!invitationsQuery.loading && invitations.length === 0 && <tr><td colSpan={4} className="ta-empty">No pending invitations.</td></tr>}
                {invitations.map(i => (
                  <tr key={i.id}>
                    <td>{i.email}</td>
                    <td><Tag>{i.role}</Tag></td>
                    <td>{new Date(i.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="ta-btn ta-btn-danger ta-btn-sm" onClick={async () => {
                        await revokeInvitation(i.id);
                        invitationsQuery.refetch();
                        showToast("Invitation revoked.");
                      }}>Revoke</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {tab === "dsar" && (
          <div className="ta-card ta-mt16">
            <div className="ta-row ta-between mb-4">
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
                    <td><span style={{ fontWeight: 600 }}>{r.email || r.user_id}</span></td>
                    <td><Tag>{r.request_type}</Tag></td>
                    <td><Tag tone={r.status === "pending" ? "warning" : r.status === "completed" ? "success" : "danger"}>{r.status}</Tag></td>
                    <td>{r.requested_at ? new Date(r.requested_at).toLocaleDateString() : "N/A"}</td>
                    <td>
                      {r.status !== "pending" ? (
                        <span style={{ fontSize: 12, color: "var(--text-2)" }}>Resolved</span>
                      ) : (
                        <div className="ta-row ta-gap6">
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

        {inviteOpen && (
          <div className="ta-card ta-mt16" style={{ borderColor: "var(--primary)" }}>
            <div className="ta-title">Invite New User</div>
            <div className="ta-grid ta-grid-2 ta-mt12">
              <input className="ta-input" placeholder="User email address..." value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
              <select className="ta-input" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                <option value="learner">Learner</option>
                <option value="mentor">Instructor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="ta-row ta-gap8 ta-mt12">
              <button className="ta-btn ta-btn-primary" onClick={async () => {
                if (!inviteEmail.trim() || !orgId) return;
                await createInvitation({ organizationId: orgId, email: inviteEmail.trim(), role: inviteRole });
                setInviteOpen(false); setInviteEmail("");
                invitationsQuery.refetch();
                showToast("Invitation sent!");
              }}>Send invitation</button>
              <button className="ta-btn ta-btn-outline" onClick={() => setInviteOpen(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
