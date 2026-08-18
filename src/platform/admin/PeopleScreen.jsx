import React, { useState, useContext } from "react";
import { TopBar, Avatar, Tag, ToastContext } from "../components/PlatformUI.jsx";
import { UserPlus, Search, Check, X, ShieldAlert, Download, Trash2, FileText, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchOrgMembers, fetchPendingInvitations, createInvitation, revokeInvitation, updateOrgMemberStatus, fetchOrgLearnerProgressOverview, issueCertificateDirectly, fetchOrgInstructorsMonitor } from "../../lib/api/platform.js";
import FileUploadZone from "../../components/common/FileUploadZone.jsx";
import { Award } from "lucide-react";
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
  const [certModalUser, setCertModalUser] = useState(null);
  const [certTitle, setCertTitle] = useState("");
  const [certFileUrl, setCertFileUrl] = useState("");
  const [issuingCert, setIssuingCert] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkEmails, setBulkEmails] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState(new Set());
  const [bulkOffboarding, setBulkOffboarding] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("learner");
  const [search, setSearch] = useState("");
  const [progressSort, setProgressSort] = useState("pace"); // "pace" | "name"

  const membersQuery = useSupabaseQuery(async () => orgId ? fetchOrgMembers(orgId) : [], [orgId]);
  const instructorsQuery = useSupabaseQuery(async () => orgId ? fetchOrgInstructorsMonitor(orgId) : [], [orgId]);
  const invitationsQuery = useSupabaseQuery(async () => orgId ? fetchPendingInvitations(orgId) : [], [orgId]);
  const progressQuery = useSupabaseQuery(async () => orgId ? fetchOrgLearnerProgressOverview(orgId) : [], [orgId]);
  // DSAR requests have no org_id column in the schema - this queue is
  // platform-wide by design, not scoped to the current org.
  const dsarQuery = useSupabaseQuery(async () => fetchAllDSARRequests(), []);

  const members = membersQuery.data || [];
  const instructors = instructorsQuery.data || [];
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
          {[{ k: "all", label: "Directory" }, { k: "progress", label: `Progress${behindCount > 0 ? ` (${behindCount} behind)` : ""}` }, { k: "applications", label: `Instructor Monitor (${instructors.length})` }, { k: "invites", label: `Pending Invites (${invitations.length})` }, { k: "dsar", label: `Data Requests (${pendingDsarCount})` }].map(t => (
            <div key={t.k} className={`ta-tab ${tab === t.k ? "active" : ""}`} onClick={() => setTab(t.k)}>{t.label}</div>
          ))}
        </div>

        {tab === "all" && (
          <div className="ta-card ta-mt16">
            <div className="ta-row ta-between mb-4">
              <div className="ta-search"><Search size={14} /><input className="ta-input" style={{ border: "none", padding: 0 }} placeholder="Search members..." value={search} onChange={e => setSearch(e.target.value)} /></div>
              {selectedMemberIds.size > 0 && (
                <div className="ta-row ta-gap8">
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>{selectedMemberIds.size} selected</span>
                  <button
                    className="ta-btn ta-btn-danger ta-btn-sm"
                    disabled={bulkOffboarding}
                    onClick={async () => {
                      // Bulk offboarding - PRD 8.3 "bulk onboarding/offboarding
                      // (Inviting or removing learners to the organisation)."
                      // Only onboarding (bulk invite, PeopleScreen's invite modal)
                      // was built before this - offboarding was a real, separate
                      // gap. Loops the exact same authorization-checked
                      // updateOrgMemberStatus() call used for a single suspend,
                      // not a separate bulk-specific code path.
                      setBulkOffboarding(true);
                      let succeeded = 0;
                      for (const userId of selectedMemberIds) {
                        try {
                          await updateOrgMemberStatus(userId, orgId, "suspended");
                          succeeded++;
                        } catch { /* continue with the rest */ }
                      }
                      setBulkOffboarding(false);
                      setSelectedMemberIds(new Set());
                      membersQuery.refetch();
                      showToast(`${succeeded} member${succeeded === 1 ? "" : "s"} offboarded (suspended).`);
                    }}
                  >
                    {bulkOffboarding ? "Offboarding..." : `Offboard ${selectedMemberIds.size} selected`}
                  </button>
                </div>
              )}
            </div>
            <div className="ta-table-wrap">
            <table className="ta-table">
              <thead><tr><th style={{ width: 32 }}><input type="checkbox" checked={filteredMembers.length > 0 && selectedMemberIds.size === filteredMembers.length} onChange={(e) => setSelectedMemberIds(e.target.checked ? new Set(filteredMembers.map((m) => m.id)) : new Set())} /></th><th>Name</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {membersQuery.loading && <tr><td colSpan={5} className="ta-empty">Loading members...</td></tr>}
                {!membersQuery.loading && filteredMembers.length === 0 && <tr><td colSpan={5} className="ta-empty">No members found.</td></tr>}
                {filteredMembers.map(m => (
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
                    <td><div className="ta-row ta-gap10"><Avatar initials={(m.display_name || "U").slice(0, 2).toUpperCase()} size={32} /><span style={{ fontWeight: 600 }}>{m.display_name || "User"}</span></div></td>
                    <td><Tag>{m.role || "learner"}</Tag></td>
                    <td><Tag tone={m.status === "active" ? "success" : "warning"}>{m.status || "active"}</Tag></td>
                    <td>
                      <div className="ta-row ta-gap6">
                        <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={async () => {
                          // m is a raw user_profiles row (fetchOrgMembers does a plain
                          // select("*") on that table) - user_profiles.id IS the real
                          // auth uid directly (confirmed against the actual schema,
                          // no separate user_id column exists on this specific table).
                          // organization_members.user_id (a different table's own
                          // column) is what updateOrgMemberStatus filters by internally.
                          // Also pass orgId - updateOrgMemberStatus(userId, organizationId,
                          // status) was being called with the status in the organizationId slot.
                          await updateOrgMemberStatus(m.id, orgId, m.status === "active" ? "suspended" : "active");
                          membersQuery.refetch();
                          showToast(`Status updated for ${m.display_name}`);
                        }}>
                          {m.status === "active" ? "Suspend" : "Activate"}
                        </button>
                        <button className="ta-btn ta-btn-outline ta-btn-sm" title="Download this user's data as JSON" onClick={async () => {
                          try {
                            await downloadUserDataExport(m.id, m.display_name || m.id);
                            showToast(`Data export downloaded for ${m.display_name || "user"}`);
                          } catch (e) {
                            showToast(e?.message || "Could not export this user's data");
                          }
                        }}>
                          <Download size={13} /> Export
                        </button>
                        <button className="ta-btn ta-btn-outline ta-btn-sm" title="Issue a certificate directly to this person" onClick={() => { setCertModalUser(m); setCertTitle(""); setCertFileUrl(""); }}>
                          <Award size={13} /> Give Certificate
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
                <thead><tr><th>Learner</th><th>Department</th><th>Assigned</th><th>Completed</th><th>Pending</th><th>Avg. progress</th><th>Pace</th></tr></thead>
                <tbody>
                  {progressQuery.loading && <tr><td colSpan={7} className="ta-empty">Loading learner progress...</td></tr>}
                  {!progressQuery.loading && sortedProgressRows.length === 0 && <tr><td colSpan={7} className="ta-empty">No learners in this organization yet.</td></tr>}
                  {sortedProgressRows.map(r => {
                    const meta = PACE_META[r.pace] || PACE_META.on_pace;
                    return (
                      <tr key={r.id}>
                        <td><div className="ta-row ta-gap10"><Avatar initials={r.initials} size={32} /><span style={{ fontWeight: 600 }}>{r.name}</span></div></td>
                        <td>{r.department}</td>
                        <td>{r.assignedCount}</td>
                        <td>{r.completedCount}</td>
                        <td>{Math.max(0, r.assignedCount - r.completedCount)}</td>
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
              <thead><tr><th>Instructor</th><th>Status</th><th>Sessions Completed</th><th>Rating</th></tr></thead>
              <tbody>
                {instructorsQuery.loading && <tr><td colSpan={4} className="ta-empty">Loading instructors...</td></tr>}
                {!instructorsQuery.loading && instructors.length === 0 && <tr><td colSpan={4} className="ta-empty">No instructors in this organization yet - assign one from Directory.</td></tr>}
                {instructors.map(m => (
                  <tr key={m.id}>
                    <td><div className="ta-row ta-gap10"><Avatar initials={(m.display_name || "I").slice(0, 2).toUpperCase()} size={32} /><span style={{ fontWeight: 600 }}>{m.display_name}</span></div></td>
                    <td><Tag tone={m.is_active ? "success" : "warning"}>{m.is_active ? "Active" : "Inactive"}</Tag></td>
                    <td>{m.sessions_completed ?? 0}</td>
                    <td>{m.rating ? `${m.rating}/5` : "No ratings yet"}</td>
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
            <div className="ta-row ta-between">
              <div className="ta-title">{bulkMode ? "Bulk Invite Users" : "Invite New User"}</div>
              <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => setBulkMode((v) => !v)}>
                {bulkMode ? "Switch to single invite" : "Switch to bulk invite"}
              </button>
            </div>
            {!bulkMode ? (
              <>
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
              </>
            ) : (
              <>
                <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>
                  One email per line - PRD "bulk onboarding/offboarding," confirmed unbuilt before this. Each one goes through the exact same real invitation flow as a single invite (createInvitation, same authorization checks) - just looped, not a separate/weaker code path.
                </div>
                <textarea className="ta-input ta-mt12" rows={6} placeholder={"jane@company.com\nbob@company.com\n..."} value={bulkEmails} onChange={(e) => setBulkEmails(e.target.value)} />
                <select className="ta-input ta-mt8" style={{ width: 200 }} value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                  <option value="learner">Learner</option>
                  <option value="mentor">Instructor</option>
                  <option value="admin">Admin</option>
                </select>
                <div className="ta-row ta-gap8 ta-mt12">
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
                    {bulkSubmitting ? "Sending..." : `Send ${bulkEmails.split("\n").filter((e) => e.trim().includes("@")).length} invitations`}
                  </button>
                  <button className="ta-btn ta-btn-outline" onClick={() => setInviteOpen(false)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {certModalUser && (
        <div className="ta-card ta-mt16" style={{ borderColor: "var(--primary)", maxWidth: 480 }}>
          <div className="ta-row ta-between">
            <div className="ta-title">Give Certificate to {certModalUser.display_name || "this person"}</div>
            <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => setCertModalUser(null)}><X size={14} /></button>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
            Issues a certificate directly - independent of the request/approve flow, doesn't require an existing course.
          </div>
          <div className="ta-label ta-mt16">Certificate title</div>
          <input className="ta-input ta-mt6" placeholder="e.g. Outstanding Contribution Award" value={certTitle} onChange={(e) => setCertTitle(e.target.value)} />
          <div className="ta-label ta-mt16">Upload certificate file (optional)</div>
          <FileUploadZone
            bucket="uploads"
            pathPrefix={`certificates/${certModalUser.user_id}`}
            accept="application/pdf,image/*"
            onUploaded={(url) => setCertFileUrl(url)}
            label="Drag and drop a certificate PDF or image, or click to browse"
          />
          <div className="ta-row ta-gap8 ta-mt20">
            <button
              className="ta-btn ta-btn-primary"
              disabled={issuingCert || !certTitle.trim()}
              onClick={async () => {
                setIssuingCert(true);
                try {
                  const result = await issueCertificateDirectly(certModalUser.user_id, orgId, certTitle.trim(), null, certFileUrl || null);
                  if (!result.success) showToast(result.error);
                  else { showToast(`Certificate issued to ${certModalUser.display_name}.`); setCertModalUser(null); }
                } finally {
                  setIssuingCert(false);
                }
              }}
            >
              {issuingCert ? "Issuing..." : "Issue Certificate"}
            </button>
            <button className="ta-btn ta-btn-outline" onClick={() => setCertModalUser(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
