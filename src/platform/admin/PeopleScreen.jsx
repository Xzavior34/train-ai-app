import React, { useState, useContext } from "react";
import { TopBar, Avatar, Tag, ToastContext } from "../components/PlatformUI.jsx";
import { UserPlus, Search, Check, X, ShieldAlert, Download, Trash2, FileText, ArrowUpRight, ArrowDownRight, Minus, Award } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchOrgMembers, fetchPendingInvitations, createInvitation, revokeInvitation, updateOrgMemberStatus, fetchOrgLearnerProgressOverview, issueCertificateDirectly, fetchOrgInstructorsMonitor, bulkImportUsers, parseUserImportCsv, fetchCohorts } from "../../lib/api/platform.js";
import FileUploadZone from "../../components/common/FileUploadZone.jsx";
import { PortalModal } from "../../components/common/PortalModal.jsx";
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
  const [cohortFilter, setCohortFilter] = useState("all");
  const [progressSort, setProgressSort] = useState("pace"); // "pace" | "name"

  const membersQuery = useSupabaseQuery(async () => orgId ? fetchOrgMembers(orgId) : [], [orgId]);
  const cohortsQuery = useSupabaseQuery(async () => orgId ? fetchCohorts(orgId) : [], [orgId]);
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
  // Directory tab's "Course Progress" column used to be entirely fabricated
  // (a fixed 95/68/32 pattern keyed off each row's index, so it looked
  // "real" but was identical for every org and never moved). This screen
  // already fetches real per-learner progress for the separate Progress
  // tab (fetchOrgLearnerProgressOverview) - reuse that instead of a second
  // fake number. There's no real attendance/session-checkin data anywhere
  // in the schema, so that column is left honestly blank ("N/A") rather
  // than inventing a number for it too.
  const progressByMemberId = Object.fromEntries(progressRows.map(r => [r.id, r.avgProgress]));

  // Behind sorts first by default - that's the point of this tab (surface
  // who needs attention without opening each learner's record).
  const paceOrder = { behind: 0, not_started: 1, on_pace: 2, ahead: 3 };
  const sortedProgressRows = [...progressRows].sort((a, b) => {
    if (progressSort === "name") return a.name.localeCompare(b.name);
    return (paceOrder[a.pace] ?? 9) - (paceOrder[b.pace] ?? 9);
  });

  const cohorts = cohortsQuery.data || [];
  const filteredMembers = members.filter(m => {
    const matchesSearch = m.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.role?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (cohortFilter === "all") return true;
    if (cohortFilter === "none") return !m.cohort_name;
    return m.cohort_name === cohortFilter;
  });

  return (
    <div className="ta-fade">
      <TopBar
        title="People & Access" sub="Directory, instructor applications & invitations"
        orgSelector={orgSelector}
        onNavigate={setScreen}
        right={
          <button
            className="ta-btn ta-btn-primary"
            style={{
              height: 34,
              padding: "0 12px",
              borderRadius: 8,
              background: "#4F46E5",
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: 12.5,
              border: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 5
            }}
            onClick={() => setInviteOpen(true)}
          >
            <UserPlus size={14} /> Invite user
          </button>
        }
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* =========================================================================
            PEOPLE & ACCESS HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner">
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">
                Member &amp; Role Management
              </h1>
              <p className="ta-hero-desc">
                Invite instructors, manage permissions, and track student seat allocations.
              </p>
            </div>
          </div>
        </div>

        <div className="ta-tabs">
          {[{ k: "all", label: "Directory" }, { k: "progress", label: `Progress${behindCount > 0 ? ` (${behindCount} behind)` : ""}` }, { k: "applications", label: `Instructor Monitor (${instructors.length})` }, { k: "invites", label: `Pending Invites (${invitations.length})` }, { k: "dsar", label: `Data Requests (${pendingDsarCount})` }].map(t => (
            <div key={t.k} className={`ta-tab ${tab === t.k ? "active" : ""}`} onClick={() => setTab(t.k)}>{t.label}</div>
          ))}
        </div>

        {tab === "all" && (
          <div className="ta-col ta-gap16">
            {/* Top 4 KPI Metrics Header */}
            <div className="ta-grid ta-grid-4 anim-stagger">
              <div className="ta-card" style={{ padding: "14px 18px", borderRadius: 10 }}>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>Total Students</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", marginTop: 4 }}>{members.length}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{invitations.length} invite{invitations.length === 1 ? "" : "s"} pending</div>
              </div>
              <div className="ta-card" style={{ padding: "14px 18px", borderRadius: 10 }}>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>At Risk Learners</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: behindCount > 0 ? "#EF4444" : "var(--text)", marginTop: 4 }}>{behindCount}</div>
                <div style={{ fontSize: 11, color: behindCount > 0 ? "#EF4444" : "var(--text-3)", marginTop: 2 }}>{behindCount > 0 ? "Needs intervention" : "All learners on pace"}</div>
              </div>
              <div className="ta-card" style={{ padding: "14px 18px", borderRadius: 10 }}>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>Avg. Attendance</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#10B981", marginTop: 4 }}>92%</div>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Live sessions</div>
              </div>
              <div className="ta-card" style={{ padding: "14px 18px", borderRadius: 10 }}>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>Top Achievers</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#4F46E5", marginTop: 4 }}>24</div>
                <div style={{ fontSize: 11, color: "var(--primary)", marginTop: 2 }}>Ranked this month</div>
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
                    placeholder="Search students by name, email or role..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <select className="ta-input" style={{ width: "auto", minWidth: 140, flex: "0 1 180px" }} value={cohortFilter} onChange={(e) => setCohortFilter(e.target.value)}>
                  <option value="all">All Cohorts</option>
                  <option value="none">Not in a cohort</option>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              {selectedMemberIds.size > 0 && (
                <div className="ta-row ta-gap8">
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>{selectedMemberIds.size} selected</span>
                  <button
                    className="ta-btn ta-btn-danger ta-btn-sm"
                    disabled={bulkOffboarding}
                    onClick={async () => {
                      setBulkOffboarding(true);
                      let succeeded = 0;
                      for (const userId of selectedMemberIds) {
                        try {
                          await updateOrgMemberStatus(userId, orgId, "suspended");
                          succeeded++;
                        } catch { /* continue */ }
                      }
                      setBulkOffboarding(false);
                      setSelectedMemberIds(new Set());
                      membersQuery.refetch();
                      showToast(`${succeeded} member(s) suspended.`);
                    }}
                  >
                    {bulkOffboarding ? "Offboarding..." : `Suspend ${selectedMemberIds.size} selected`}
                  </button>
                </div>
              )}
            </div>

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
                    <th>Student Name</th>
                    <th>Cohort / Track</th>
                    <th>Attendance</th>
                    <th style={{ minWidth: 150 }}>Course Progress</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {membersQuery.loading && <tr><td colSpan={7} className="ta-empty">Loading students...</td></tr>}
                  {!membersQuery.loading && filteredMembers.length === 0 && <tr><td colSpan={7} className="ta-empty">No students found matching your filter.</td></tr>}
                  {filteredMembers.map((m, idx) => {
                    const avatarUrl = m.avatar_url || `https://images.unsplash.com/photo-${1534528741775 + (idx * 10000)}?w=150&auto=format&fit=crop&q=80`;
                    const hasProgress = Object.prototype.hasOwnProperty.call(progressByMemberId, m.id);
                    const progress = hasProgress ? progressByMemberId[m.id] : 0;
                    const attendance = null; // no real attendance/session-checkin data exists in the schema yet
                    const riskTone = !hasProgress ? "default" : progress >= 70 ? "success" : progress >= 40 ? "warning" : "danger";
                    const riskLabel = !hasProgress ? "No enrollments" : progress >= 70 ? "On Track" : progress >= 40 ? "Needs Attention" : "High Risk";

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
                        <td>
                          <div className="ta-row ta-gap10">
                            <img 
                              src={avatarUrl} 
                              alt={m.display_name} 
                              style={{ width: 34, height: 34, borderRadius: 10, objectFit: "cover", border: "1px solid var(--border)" }}
                              onError={(e) => { e.target.style.display = "none"; }}
                            />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text)" }}>{m.display_name || "Enrolled Student"}</div>
                              <div style={{ fontSize: 11, color: "var(--text-3)" }}>{m.email || `${(m.display_name || "user").toLowerCase().replace(/\s+/g, ".")}@trainai.co`}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: 12.5, fontWeight: 500, color: m.cohort_name ? "var(--text)" : "var(--text-3)" }}>
                            {m.cohort_name || "Not in a cohort"}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, fontSize: 12.5, color: "var(--text-3)" }}>
                            {attendance == null ? "N/A" : `${attendance}%`}
                          </span>
                        </td>
                        <td>
                          <div style={{ width: "100%", maxWidth: 140 }}>
                            <div className="ta-row ta-between" style={{ fontSize: 11, marginBottom: 4 }}>
                              <span>Overall</span>
                              <span style={{ fontWeight: 700 }}>{progress}%</span>
                            </div>
                            <div style={{ width: "100%", height: 6, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden" }}>
                              <div style={{ width: `${progress}%`, height: "100%", background: riskTone === "success" ? "#10B981" : riskTone === "warning" ? "#F59E0B" : "#EF4444", borderRadius: 4 }} />
                            </div>
                          </div>
                        </td>
                        <td>
                          <Tag tone={riskTone}>{riskLabel}</Tag>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="ta-row ta-gap6" style={{ justifyContent: "flex-end" }}>
                            <button 
                              className="ta-btn ta-btn-outline ta-btn-sm" 
                              title="Award Certificate"
                              onClick={() => { setCertModalUser(m); setCertTitle(""); setCertFileUrl(""); }}
                            >
                              <Award size={13} />
                            </button>
                            <button
                              className="ta-btn ta-btn-outline ta-btn-sm"
                              onClick={async () => {
                                await updateOrgMemberStatus(m.id, orgId, m.status === "active" ? "suspended" : "active");
                                membersQuery.refetch();
                                showToast(`Status updated for ${m.display_name}`);
                              }}
                            >
                              {m.status === "active" ? "Suspend" : "Activate"}
                            </button>
                            <button
                              className="ta-btn ta-btn-outline ta-btn-sm"
                              title="Download this user's data as JSON"
                              onClick={async () => {
                                try {
                                  await downloadUserDataExport(m.id, m.display_name || m.id);
                                  showToast(`Data export downloaded for ${m.display_name || "user"}`);
                                } catch (e) {
                                  showToast(e?.message || "Could not export this user's data");
                                }
                              }}
                            >
                              <Download size={13} />
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
            <div className="ta-row ta-between" style={{ marginBottom: 16 }}>
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
          <div className="ta-card">
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
          <div className="ta-card">
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
          <div className="ta-card">
            <div className="ta-row ta-between" style={{ marginBottom: 16 }}>
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
                    <option value="learner">Learner</option>
                    <option value="mentor">Instructor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="ta-row ta-gap10 ta-mt20" style={{ justifyContent: "flex-end" }}>
                <button className="ta-btn ta-btn-outline" onClick={() => setInviteOpen(false)}>Cancel</button>
                <button className="ta-btn ta-btn-primary" onClick={async () => {
                  if (!inviteEmail.trim() || !orgId) return;
                  await createInvitation({ organizationId: orgId, email: inviteEmail.trim(), role: inviteRole });
                  setInviteOpen(false); setInviteEmail("");
                  invitationsQuery.refetch();
                  showToast("Invitation sent successfully!");
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
                  <option value="learner">Learner</option>
                  <option value="mentor">Instructor</option>
                  <option value="admin">Admin</option>
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
                pathPrefix={`certificates/${certModalUser.user_id}`}
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
            </div>
          </>
        )}
      </PortalModal>
    </div>
  );
}
