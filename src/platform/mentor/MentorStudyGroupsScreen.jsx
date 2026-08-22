import React, { useState, useContext } from "react";
import { TopBar, Tag, ToastContext } from "../components/PlatformUI.jsx";
import { Users, BookOpen, X, StickyNote } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchMyManagedStudyGroups, fetchStudyGroupMembers, removeStudyGroupMember, updateStudyGroupDetails, createStudyGroup } from "../../lib/api/schemaHelper.js";

// Instructor study group management - a real, direct question ("How will
// instructor manage study group") with a real, confirmed answer of "there
// was no way at all" before this: no nav entry, no screen. Built here,
// scoped correctly to groups the instructor is actually a member of (via
// the real RLS fix in 0127_suspend_instructor_payouts.sql, which also
// caught and fixed a genuine infinite-recursion bug between study_groups'
// and study_group_members' policies - found only by running a real UPDATE
// against a real database, not from reading either policy alone).
export function MentorStudyGroupsScreen({ mentorId, orgId, orgSelector }) {
  const showToast = useContext(ToastContext);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const groupsQuery = useSupabaseQuery(async () => (mentorId ? fetchMyManagedStudyGroups(mentorId) : []), [mentorId]);
  const groups = groupsQuery.data || [];
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  const membersQuery = useSupabaseQuery(async () => (selectedGroupId ? fetchStudyGroupMembers(selectedGroupId) : []), [selectedGroupId]);
  const members = membersQuery.data || [];

  const [description, setDescription] = useState("");

  return (
    <div className="ta-fade">
      <TopBar title="My Study Groups" sub="Groups you're a member of and help facilitate" orgSelector={orgSelector} />
      <div className="ta-content">
        <div className="ta-row ta-gap16" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
          <div className="ta-card" style={{ flex: 1, minWidth: "min(300px, 100%)" }}>
            <div className="ta-title">Your groups ({groups.length})</div>
            <div className="ta-col ta-gap8 ta-mt12 anim-stagger">
              {groupsQuery.loading && <div className="ta-empty">Loading your study groups...</div>}
              {!groupsQuery.loading && groups.length === 0 && (
                <div className="ta-empty">You're not in any study group yet - create one below.</div>
              )}
              {groups.map((g) => (
                <div
                  key={g.id}
                  className="ta-card-hover"
                  onClick={() => { setSelectedGroupId(g.id); setDescription(g.description || ""); }}
                  style={{ cursor: "pointer", padding: "10px 12px", borderRadius: 8, background: selectedGroupId === g.id ? "var(--primary-tint, #EFF6FF)" : "var(--surface-2)", transition: "all .2s ease" }}
                >
                  <div className="ta-row ta-gap8"><Users size={14} color="var(--primary)" /><span style={{ fontWeight: 600, fontSize: 13.5 }}>{g.name}</span></div>
                  {g.courses?.title && <div className="ta-row ta-gap6" style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 2 }}><BookOpen size={11} /><span>{g.courses.title}</span></div>}
                </div>
              ))}
            </div>
            <div className="ta-row ta-gap8 ta-mt16" style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <input className="ta-input" style={{ flex: 1 }} placeholder="New group name" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
              <button
                className="ta-btn ta-btn-primary"
                disabled={creatingGroup || !newGroupName.trim() || !orgId}
                onClick={async () => {
                  setCreatingGroup(true);
                  try {
                    await createStudyGroup({ organizationId: orgId, name: newGroupName.trim(), createdBy: mentorId });
                    setNewGroupName("");
                    groupsQuery.refetch();
                    showToast("Study group created.");
                  } catch (e) {
                    showToast(e.message || "Could not create study group.");
                  } finally {
                    setCreatingGroup(false);
                  }
                }}
              >
                Create
              </button>
            </div>
          </div>

          {selectedGroup && (
            <div className="ta-card" style={{ flex: 1, minWidth: "min(320px, 100%)" }}>
              <div className="ta-title">{selectedGroup.name}</div>

              <div className="ta-label ta-mt12">Description</div>
              <textarea
                className="ta-input ta-mt6" style={{ width: "100%", resize: "vertical" }} rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
                onBlur={async () => {
                  const result = await updateStudyGroupDetails(selectedGroup.id, { description });
                  if (!result.success) showToast(result.error);
                  else { showToast("Study group updated."); groupsQuery.refetch(); }
                }}
              />
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>Saves automatically when you click away.</div>

              <div className="ta-row ta-gap8" style={{ marginTop: 16 }}><StickyNote size={14} color="var(--primary)" /><div style={{ fontWeight: 700, fontSize: 13.5 }}>Members ({members.length})</div></div>
              <div className="ta-col ta-gap8 ta-mt10 anim-stagger">
                {membersQuery.loading && <div className="ta-empty">Loading members...</div>}
                {!membersQuery.loading && members.length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)" }}>No members yet.</div>}
                {members.map((m) => (
                  <div key={m.user_id} className="ta-row ta-between" style={{ background: "var(--surface-2)", padding: "8px 10px", borderRadius: 8, gap: 8 }}>
                    <div style={{ minWidth: 0, overflow: "hidden" }}>
                      <div style={{ fontWeight: 600, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.display_name}</div>
                      <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>{m.role === "lead" ? "Group Lead" : "Member"}</div>
                    </div>
                    {m.user_id !== mentorId && (
                      <button
                        className="ta-btn ta-btn-ghost ta-btn-sm"
                        title="Remove from group"
                        onClick={async () => {
                          const result = await removeStudyGroupMember(selectedGroup.id, m.user_id);
                          if (!result.success) showToast(result.error);
                          else { showToast(`${m.display_name} removed.`); membersQuery.refetch(); }
                        }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
