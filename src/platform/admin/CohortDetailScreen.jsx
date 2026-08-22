import React, { useState, useContext } from "react";
import { TopBar, Tag, ProgressBar, Avatar, ToastContext } from "../components/PlatformUI.jsx";
import { ArrowLeft, Plus, Trash2, Megaphone, BookOpen, Settings as SettingsIcon } from "lucide-react";
import FileUploadZone from "../../components/common/FileUploadZone.jsx";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchCohortDetail, updateCohort, addCohortMember, removeCohortMember,
  createCohortPost, assignCohortLearnerCourse, removeCohortLearnerCourse,
  fetchUsersInOrg, fetchCourses,
  addCohortResource, deleteCohortResource, createCohortSession, deleteCohortSession,
  bulkAddCohortMembersByEmail,
} from "../../lib/api/platform.js";

// Cohort detail/space - reached from CohortsScreen by clicking a cohort card.
// TrainAIPlatformApp has no existing "push with a param" navigation pattern
// (its screens are a flat `screenByWorkspace` map keyed by workspace); this
// follows the same convention it already uses for lifting derived state to
// the top (e.g. `mentorId` resolved once in TrainAIPlatformApp and handed
// down as a prop) - the selected cohort id is lifted to TrainAIPlatformApp
// as `selectedCohortId` and this screen is rendered for a dedicated
// "cohort-detail" screen value, with `onBack` returning to "cohorts".
export function CohortDetailScreen({ orgId, cohortId, currentUserId, onBack, orgSelector, setScreen }) {
  const showToast = useContext(ToastContext);
  const [tab, setTab] = useState("members");

  const detailQuery = useSupabaseQuery(async () => (cohortId ? fetchCohortDetail(cohortId) : null), [cohortId]);
  const orgUsersQuery = useSupabaseQuery(async () => (orgId ? fetchUsersInOrg(orgId) : []), [orgId]);
  const coursesQuery = useSupabaseQuery(async () => fetchCourses(), []);

  const detail = detailQuery.data;
  const cohort = detail?.cohort || null;
  const members = detail?.members || [];
  const posts = detail?.posts || [];
  const learnerCourses = detail?.learnerCourses || [];
  const resources = detail?.resources || [];
  const sessions = detail?.sessions || [];

  const orgUsers = orgUsersQuery.data || [];
  const courses = coursesQuery.data || [];

  const memberUserIds = new Set(members.map((m) => m.user_id));
  const availableUsers = orgUsers.filter((u) => !memberUserIds.has(u.id));

  // --- Settings (name / description / dates) ---
  const [editingSettings, setEditingSettings] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [startsInput, setStartsInput] = useState("");
  const [endsInput, setEndsInput] = useState("");

  function openSettings() {
    setNameInput(cohort?.name || "");
    setDescInput(cohort?.description || "");
    setStartsInput(cohort?.starts_at ? cohort.starts_at.slice(0, 10) : "");
    setEndsInput(cohort?.ends_at ? cohort.ends_at.slice(0, 10) : "");
    setEditingSettings(true);
  }

  async function saveSettings() {
    if (!cohortId) return;
    await updateCohort(cohortId, {
      name: nameInput.trim() || cohort?.name,
      description: descInput.trim() || null,
      starts_at: startsInput || null,
      ends_at: endsInput || null,
    });
    setEditingSettings(false);
    detailQuery.refetch();
    showToast("Cohort settings updated");
  }

  // --- Members ---
  const [addUserId, setAddUserId] = useState("");
  const [bulkEmails, setBulkEmails] = useState("");
  const [bulkAdding, setBulkAdding] = useState(false);
  async function handleAddMember() {
    if (!addUserId || !cohortId) return;
    await addCohortMember({ cohortId, userId: addUserId, addedBy: currentUserId });
    setAddUserId("");
    detailQuery.refetch();
    showToast("Member added to cohort");
  }

  async function handleRemoveMember(memberRowId, name) {
    await removeCohortMember(memberRowId);
    detailQuery.refetch();
    showToast(`${name} removed from cohort`);
  }

  // --- Course assignments ---
  const [assignUserId, setAssignUserId] = useState("");
  const [assignCourseId, setAssignCourseId] = useState("");
  async function handleAssignCourse() {
    if (!assignUserId || !assignCourseId || !cohortId) return;
    await assignCohortLearnerCourse({ cohortId, userId: assignUserId, courseId: assignCourseId, assignedBy: currentUserId });
    setAssignUserId("");
    setAssignCourseId("");
    detailQuery.refetch();
    showToast("Course assigned");
  }

  async function handleRemoveAssignment(id) {
    await removeCohortLearnerCourse(id);
    detailQuery.refetch();
    showToast("Assignment removed");
  }

  // --- Activity feed ---
  const [postText, setPostText] = useState("");
  const [postAnnouncement, setPostAnnouncement] = useState(false);
  async function handlePost() {
    if (!postText.trim() || !cohortId || !currentUserId) return;
    await createCohortPost({ cohortId, authorId: currentUserId, content: postText, isAnnouncement: postAnnouncement });
    setPostText("");
    setPostAnnouncement(false);
    detailQuery.refetch();
    showToast("Posted to cohort");
  }

  // --- Resources ---
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  async function handleAddResource() {
    if (!resourceTitle.trim() || !cohortId || !currentUserId) return;
    await addCohortResource({ cohortId, title: resourceTitle, externalUrl: resourceUrl, createdBy: currentUserId });
    setResourceTitle("");
    setResourceUrl("");
    detailQuery.refetch();
    showToast("Resource added");
  }
  async function handleDeleteResource(id, title) {
    await deleteCohortResource(id);
    detailQuery.refetch();
    showToast(`"${title}" removed`);
  }

  // --- Sessions ---
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionStartsAt, setSessionStartsAt] = useState("");
  async function handleScheduleSession() {
    if (!sessionTitle.trim() || !sessionStartsAt || !cohortId || !currentUserId) return;
    await createCohortSession({ cohortId, title: sessionTitle, startsAt: new Date(sessionStartsAt).toISOString(), createdBy: currentUserId });
    setSessionTitle("");
    setSessionStartsAt("");
    detailQuery.refetch();
    showToast("Session scheduled");
  }
  async function handleDeleteSession(id, title) {
    await deleteCohortSession(id);
    detailQuery.refetch();
    showToast(`"${title}" removed`);
  }

  if (!cohortId) return <div className="ta-empty">No cohort selected.</div>;

  return (
    <div className="ta-fade">
      <div className="ta-content" style={{ paddingBottom: 0 }}>
        <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={onBack}>
          <ArrowLeft size={14} /> Back to cohorts
        </button>
      </div>
      <TopBar
        title={cohort?.name || "Cohort"}
        sub={cohort ? `${cohort.starts_at ? new Date(cohort.starts_at).toLocaleDateString() : "TBD"} to ${cohort.ends_at ? new Date(cohort.ends_at).toLocaleDateString() : "TBD"}` : "Loading..."}
        orgSelector={orgSelector}
        onNavigate={setScreen}
        right={cohort && <button className="ta-btn ta-btn-outline" onClick={openSettings}><SettingsIcon size={15} /> Settings</button>}
      />
      <div className="ta-content">
        {detailQuery.loading && <div className="ta-empty">Loading cohort...</div>}
        {!detailQuery.loading && !cohort && <div className="ta-empty">Cohort not found.</div>}

        {editingSettings && (
          <div className="ta-card ta-mt16" style={{ borderColor: "var(--primary)" }}>
            <div className="ta-title">Cohort settings</div>
            <div className="ta-label ta-mt12">Cohort banner</div>
            <div className="ta-row ta-gap12" style={{ alignItems: "center" }}>
              {(cohort?.banner_url) && <img src={cohort.banner_url} alt="" style={{ width: 100, height: 56, objectFit: "cover", borderRadius: 8 }} />}
              <FileUploadZone
                bucket="uploads"
                pathPrefix={`cohort-banners/${cohortId}`}
                accept="image/*"
                onUploaded={async (url) => {
                  await updateCohort(cohortId, { banner_url: url });
                  detailQuery.refetch();
                  showToast("Cohort banner updated.");
                }}
                label="Upload a banner image"
              />
            </div>
            <div className="ta-grid ta-grid-2 ta-mt12">
              <div>
                <div className="ta-label">Name</div>
                <input className="ta-input ta-mt8" style={{ width: "100%" }} value={nameInput} onChange={(e) => setNameInput(e.target.value)} />
              </div>
              <div>
                <div className="ta-label">Description</div>
                <input className="ta-input ta-mt8" style={{ width: "100%" }} value={descInput} onChange={(e) => setDescInput(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <div className="ta-label">Starts</div>
                <input type="date" className="ta-input ta-mt8" style={{ width: "100%" }} value={startsInput} onChange={(e) => setStartsInput(e.target.value)} />
              </div>
              <div>
                <div className="ta-label">Ends</div>
                <input type="date" className="ta-input ta-mt8" style={{ width: "100%" }} value={endsInput} onChange={(e) => setEndsInput(e.target.value)} />
              </div>
            </div>
            <div className="ta-row ta-gap8 ta-mt12">
              <button className="ta-btn ta-btn-primary" onClick={saveSettings}>Save settings</button>
              <button className="ta-btn ta-btn-outline" onClick={() => setEditingSettings(false)}>Cancel</button>
            </div>
          </div>
        )}

        {cohort && (
          <>
            <div className="ta-tabs ta-mt16">
              {[
                { k: "members", label: `Members (${members.length})` },
                { k: "courses", label: `Course assignments (${learnerCourses.length})` },
                { k: "assignedlearner", label: "Assigned to Learner" },
                { k: "progressmatrix", label: "Progress Matrix" },
                { k: "activity", label: `Activity (${posts.length})` },
                { k: "resources", label: "Resources & sessions" },
              ].map((t) => (
                <div key={t.k} className={`ta-tab ${tab === t.k ? "active" : ""}`} onClick={() => setTab(t.k)}>{t.label}</div>
              ))}
            </div>

            {tab === "members" && (
              <div className="ta-card ta-mt16">
                <div className="ta-row ta-gap8" style={{ flexWrap: "wrap" }}>
                  <select className="ta-input" style={{ flex: 1, minWidth: 200 }} value={addUserId} onChange={(e) => setAddUserId(e.target.value)}>
                    <option value="">Add a member from org...</option>
                    {availableUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <button className="ta-btn ta-btn-primary ta-btn-sm" onClick={handleAddMember} disabled={!addUserId}><Plus size={14} /> Add</button>
                </div>
                <div className="ta-mt12">
                  <div className="ta-label">Bulk add by email</div>
                  <textarea
                    className="ta-input ta-mt8" style={{ width: "100%", minHeight: 60 }}
                    placeholder="one@example.com, two@example.com"
                    value={bulkEmails} onChange={(e) => setBulkEmails(e.target.value)}
                  />
                  <button
                    className="ta-btn ta-btn-primary ta-mt8"
                    disabled={bulkAdding || !bulkEmails.trim()}
                    onClick={async () => {
                      setBulkAdding(true);
                      try {
                        const result = await bulkAddCohortMembersByEmail(cohortId, bulkEmails, currentUserId);
                        if (result.added.length) { showToast(`Added ${result.added.length} member${result.added.length === 1 ? "" : "s"}.`); detailQuery.refetch(); }
                        if (result.failed.length) showToast(`Could not add: ${result.failed.map((f) => f.email).join(", ")}`);
                        if (result.added.length) setBulkEmails("");
                      } finally {
                        setBulkAdding(false);
                      }
                    }}
                  >
                    {bulkAdding ? "Adding..." : "Add members"}
                  </button>
                </div>
                <div className="ta-table-wrap">
                <table className="ta-table ta-mt16">
                  <thead><tr><th>Member</th><th>Progress</th><th>Added</th><th></th></tr></thead>
                  <tbody>
                    {members.length === 0 && <tr><td colSpan={4} className="ta-empty">No members in this cohort yet.</td></tr>}
                    {members.map((m) => {
                      const name = m.user_profiles?.display_name || "Unnamed user";
                      return (
                        <tr key={m.id}>
                          <td><div className="ta-row ta-gap10"><Avatar initials={name.slice(0, 2).toUpperCase()} size={30} /><span style={{ fontWeight: 600 }}>{name}</span></div></td>
                          <td><div className="ta-row ta-gap8" style={{ width: 130 }}><ProgressBar value={m.progress} /><span style={{ fontSize: 12 }}>{m.progress}%</span></div></td>
                          <td>{m.added_at ? new Date(m.added_at).toLocaleDateString() : "N/A"}</td>
                          <td><button className="ta-btn ta-btn-danger ta-btn-sm" onClick={() => handleRemoveMember(m.id, name)}><Trash2 size={13} /> Remove</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            )}

            {tab === "courses" && (
              <div className="ta-card ta-mt16">
                <div className="ta-row ta-gap8" style={{ flexWrap: "wrap" }}>
                  <select className="ta-input" style={{ flex: 1, minWidth: 180 }} value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
                    <option value="">Select member...</option>
                    {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.user_profiles?.display_name || m.user_id}</option>)}
                  </select>
                  <select className="ta-input" style={{ flex: 1, minWidth: 180 }} value={assignCourseId} onChange={(e) => setAssignCourseId(e.target.value)}>
                    <option value="">Select course...</option>
                    {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                  <button className="ta-btn ta-btn-primary ta-btn-sm" onClick={handleAssignCourse} disabled={!assignUserId || !assignCourseId}><BookOpen size={14} /> Assign</button>
                </div>
                <div className="ta-table-wrap">
                <table className="ta-table ta-mt16">
                  <thead><tr><th>Member</th><th>Course</th><th>Assigned</th><th></th></tr></thead>
                  <tbody>
                    {learnerCourses.length === 0 && <tr><td colSpan={4} className="ta-empty">No courses assigned yet.</td></tr>}
                    {learnerCourses.map((lc) => (
                      <tr key={lc.id}>
                        <td>{lc.user_profiles?.display_name || "Unnamed user"}</td>
                        <td>{lc.courses?.title || "Unknown course"}</td>
                        <td>{lc.assigned_at ? new Date(lc.assigned_at).toLocaleDateString() : "N/A"}</td>
                        <td><button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => handleRemoveAssignment(lc.id)}><Trash2 size={13} /> Unassign</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}

            {tab === "assignedlearner" && (
              <div className="ta-card ta-mt16">
                <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 12 }}>
                  Every course assignment, grouped by learner rather than by course.
                </div>
                {members.length === 0 && <div className="ta-empty">No members in this cohort yet.</div>}
                <div className="ta-col ta-gap12">
                  {members.map((m) => {
                    const name = m.user_profiles?.display_name || "Unnamed user";
                    const assignedToThisLearner = learnerCourses.filter((lc) => lc.user_id === m.user_id);
                    return (
                      <div key={m.user_id} style={{ padding: 12, background: "var(--surface-3)", borderRadius: 12 }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{name}</div>
                        {assignedToThisLearner.length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>No courses assigned yet.</div>}
                        {assignedToThisLearner.map((lc) => (
                          <div key={lc.id} className="ta-row ta-between" style={{ fontSize: 12.5, marginTop: 6, gap: 8, flexWrap: "wrap" }}>
                            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lc.courses?.title || "Unknown course"}</span>
                            <span style={{ color: "var(--text-2)", flexShrink: 0 }}>{lc.assigned_at ? new Date(lc.assigned_at).toLocaleDateString() : "N/A"}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === "progressmatrix" && (
              <div className="ta-card ta-mt16">
                <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 12 }}>
                  Each learner's progress across every course assigned to them in this cohort.
                </div>
                {members.length === 0 && <div className="ta-empty">No members in this cohort yet.</div>}
                {members.length > 0 && (
                  <div className="ta-table-wrap">
                    <table className="ta-table">
                      <thead>
                        <tr>
                          <th>Learner</th>
                          {[...new Set(learnerCourses.map((lc) => lc.courses?.title).filter(Boolean))].map((title) => (
                            <th key={title}>{title}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((m) => {
                          const courseTitles = [...new Set(learnerCourses.map((lc) => lc.courses?.title).filter(Boolean))];
                          return (
                            <tr key={m.user_id}>
                              <td>{m.user_profiles?.display_name || "Unnamed user"}</td>
                              {courseTitles.map((title) => {
                                const assignment = learnerCourses.find((lc) => lc.user_id === m.user_id && lc.courses?.title === title);
                                return <td key={title}>{assignment ? `${assignment.progress ?? 0}%` : <span style={{ color: "var(--text-3)" }}>Not assigned</span>}</td>;
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === "activity" && (
              <div className="ta-card ta-mt16">
                <textarea
                  className="ta-input"
                  style={{ width: "100%", minHeight: 70, fontFamily: "inherit" }}
                  placeholder="Post an update to this cohort..."
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                />
                <div className="ta-row ta-between ta-mt8">
                  <label className="ta-row ta-gap6" style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                    <input type="checkbox" checked={postAnnouncement} onChange={(e) => setPostAnnouncement(e.target.checked)} /> Pin as announcement
                  </label>
                  <button className="ta-btn ta-btn-primary ta-btn-sm" onClick={handlePost} disabled={!postText.trim()}><Megaphone size={14} /> Post</button>
                </div>
                <div className="ta-mt16" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {posts.length === 0 && <div className="ta-empty">No posts yet.</div>}
                  {posts.map((p) => (
                    <div key={p.id} className="ta-card" style={{ padding: 14 }}>
                      <div className="ta-row ta-between">
                        <div className="ta-row ta-gap8">
                          <Avatar initials={(p.user_profiles?.display_name || "U").slice(0, 2).toUpperCase()} size={26} />
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{p.user_profiles?.display_name || "Unknown"}</span>
                        </div>
                        {p.is_announcement && <Tag tone="warning">Announcement</Tag>}
                      </div>
                      <div className="ta-body ta-mt8">{p.content}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>{new Date(p.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "resources" && (
              <div className="ta-grid ta-grid-2 ta-mt16">
                <div className="ta-card">
                  <div className="ta-title">Resources</div>
                  <div className="ta-row ta-gap8 ta-mt12" style={{ flexWrap: "wrap" }}>
                    <input className="ta-input" style={{ flex: 1, minWidth: 140 }} placeholder="Resource title" value={resourceTitle} onChange={(e) => setResourceTitle(e.target.value)} />
                    <input className="ta-input" style={{ flex: 1, minWidth: 140 }} placeholder="URL (optional)" value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} />
                    <button className="ta-btn ta-btn-primary ta-btn-sm" onClick={handleAddResource} disabled={!resourceTitle.trim()}><Plus size={14} /> Add</button>
                  </div>
                  {resources.length === 0 && <div className="ta-empty ta-mt12">No resources shared yet.</div>}
                  {resources.map((r) => (
                    <div key={r.id} className="ta-row ta-between ta-mt12" style={{ fontSize: 13, gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                      <div className="ta-row ta-gap8" style={{ flexShrink: 0 }}>
                        {r.external_url && <a href={r.external_url} target="_blank" rel="noreferrer" style={{ color: "var(--primary)" }}>Open</a>}
                        <button className="ta-btn ta-btn-danger ta-btn-sm" onClick={() => handleDeleteResource(r.id, r.title)}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="ta-card">
                  <div className="ta-title">Sessions</div>
                  <div className="ta-row ta-gap8 ta-mt12" style={{ flexWrap: "wrap" }}>
                    <input className="ta-input" style={{ flex: 1, minWidth: 140 }} placeholder="Session title" value={sessionTitle} onChange={(e) => setSessionTitle(e.target.value)} />
                    <input type="datetime-local" className="ta-input" style={{ flex: 1, minWidth: 160 }} value={sessionStartsAt} onChange={(e) => setSessionStartsAt(e.target.value)} />
                    <button className="ta-btn ta-btn-primary ta-btn-sm" onClick={handleScheduleSession} disabled={!sessionTitle.trim() || !sessionStartsAt}><Plus size={14} /> Schedule</button>
                  </div>
                  {sessions.length === 0 && <div className="ta-empty ta-mt12">No sessions scheduled.</div>}
                  {sessions.map((s) => (
                    <div key={s.id} className="ta-row ta-between ta-mt12" style={{ fontSize: 13, gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                      <div className="ta-row ta-gap8" style={{ flexShrink: 0, flexWrap: "wrap" }}>
                        <span style={{ color: "var(--text-2)" }}>{s.starts_at ? new Date(s.starts_at).toLocaleString() : "N/A"}</span>
                        <button className="ta-btn ta-btn-danger ta-btn-sm" onClick={() => handleDeleteSession(s.id, s.title)}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
