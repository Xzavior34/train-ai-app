import React, { useState } from "react";
import { TopBar, Avatar, Tag, initialsOf } from "../components/LearnerUI.jsx";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { Users, Plus, ChevronRight, MessageSquare, X, Check } from "lucide-react";

// Study Group - join/create a group and see its roster + instructor updates.
// Deliberately NOT a peer chat: study_group_messages insert is restricted to
// instructors/admins only (see supabase/migrations/0126_no_learner_to_learner_messaging.sql,
// confirmed directly: "learners should not message learners at all, only
// instructors"). Learners can read the thread (instructor announcements/
// updates) but there is no compose box here - and for the same reason,
// "add people" isn't an add-by-picker action (sgm_write_own only lets a
// learner insert their OWN membership row); anyone in the org can find and
// self-join a group from the list below, which is how membership grows.
export function StudyGroupScreen({
  studyGroupsQuery = {}, myGroupIdsQuery = {}, joinStudyGroup, leaveStudyGroup, createStudyGroup,
  fetchStudyGroupMembers, fetchStudyGroupMessages, orgId,
  session, showToast = () => {}, back, push, params = {},
}) {
  const [selectedGroupId, setSelectedGroupId] = useState(params?.groupId || null);
  const [creating, setCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const groups = studyGroupsQuery.data || [];
  const myGroupIds = new Set(myGroupIdsQuery.data || []);
  const selectedGroup = groups.find(g => g.id === selectedGroupId) || null;

  const membersQuery = useSupabaseQuery(
    () => (selectedGroupId && fetchStudyGroupMembers ? fetchStudyGroupMembers(selectedGroupId) : Promise.resolve([])),
    [selectedGroupId]
  );
  const messagesQuery = useSupabaseQuery(
    () => (selectedGroupId && fetchStudyGroupMessages ? fetchStudyGroupMessages(selectedGroupId) : Promise.resolve([])),
    [selectedGroupId]
  );

  async function handleJoin(groupId) {
    try {
      await joinStudyGroup?.({ studyGroupId: groupId, userId: session?.user?.id });
      showToast?.("Joined study group!");
      myGroupIdsQuery.refetch?.();
      studyGroupsQuery.refetch?.();
    } catch (err) {
      showToast?.(err?.message || "Could not join group");
    }
  }

  async function handleLeave(groupId) {
    try {
      await leaveStudyGroup?.({ studyGroupId: groupId, userId: session?.user?.id });
      showToast?.("Left study group.");
      myGroupIdsQuery.refetch?.();
      studyGroupsQuery.refetch?.();
      if (selectedGroupId === groupId) setSelectedGroupId(null);
    } catch (err) {
      showToast?.(err?.message || "Could not leave group");
    }
  }

  async function handleCreate() {
    if (!newGroupName.trim()) {
      showToast?.("Give your study group a name.");
      return;
    }
    setSaving(true);
    try {
      const group = await createStudyGroup?.({
        organizationId: orgId,
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        createdBy: session?.user?.id,
      });
      showToast?.("Study group created!");
      setNewGroupName(""); setNewGroupDesc(""); setCreating(false);
      studyGroupsQuery.refetch?.();
      myGroupIdsQuery.refetch?.();
      if (group?.id) setSelectedGroupId(group.id);
    } catch (err) {
      showToast?.(err?.message || "Could not create group");
    } finally {
      setSaving(false);
    }
  }

  // -------------------------------------------------------------------
  // Group detail view
  // -------------------------------------------------------------------
  if (selectedGroup) {
    const members = membersQuery.data || [];
    const isMember = myGroupIds.has(selectedGroup.id);
    return (
      <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <TopBar title={selectedGroup.name} sub={selectedGroup.description || "Study Group"} onBack={() => setSelectedGroupId(null)} />

        <div className="tai-card" style={{ padding: 18, borderRadius: 12, border: "1px solid var(--border)" }}>
          <div className="tai-row tai-between" style={{ alignItems: "center", marginBottom: 12 }}>
            <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
              <Users size={16} color="var(--primary)" />
              <span style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)" }}>People ({members.length})</span>
            </div>
            {isMember ? (
              <button className="tai-btn tai-btn-outline tai-btn-sm" onClick={() => handleLeave(selectedGroup.id)}>Leave Group</button>
            ) : (
              <button className="tai-btn tai-btn-primary tai-btn-sm" onClick={() => handleJoin(selectedGroup.id)}>Join Group</button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {members.map(m => (
              <div key={m.user_id} className="tai-row tai-between" style={{ padding: "8px 10px", background: "var(--surface-3)", borderRadius: 8, alignItems: "center" }}>
                <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
                  <Avatar size={28} initials={initialsOf(m.user_profiles?.display_name || m.user_profiles?.full_name || "Member")} src={m.user_profiles?.avatar_url} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{m.user_profiles?.display_name || m.user_profiles?.full_name || "Member"}</span>
                </div>
                {m.role === "lead" && <Tag tone="primary">Lead</Tag>}
              </div>
            ))}
            {members.length === 0 && (
              <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>No members yet.</div>
            )}
          </div>
        </div>

        <div className="tai-card" style={{ padding: 18, borderRadius: 12, border: "1px solid var(--border)" }}>
          <div className="tai-row tai-gap8" style={{ alignItems: "center", marginBottom: 12 }}>
            <MessageSquare size={16} color="var(--primary)" />
            <span style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)" }}>Updates from your instructor</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(messagesQuery.data || []).map(msg => (
              <div key={msg.id} style={{ padding: "10px 12px", background: "var(--surface-3)", borderRadius: 8 }}>
                <div className="tai-row tai-gap8" style={{ alignItems: "center", marginBottom: 4 }}>
                  <Avatar size={22} initials={initialsOf(msg.user_profiles?.display_name || "Instructor")} src={msg.user_profiles?.avatar_url} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{msg.user_profiles?.display_name || "Instructor"}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-2)" }}>{msg.message}</div>
              </div>
            ))}
            {(messagesQuery.data || []).length === 0 && (
              <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>No updates posted yet. Your instructor can post announcements here for the whole group.</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------
  // Group list view
  // -------------------------------------------------------------------
  const myGroups = groups.filter(g => myGroupIds.has(g.id));
  const otherGroups = groups.filter(g => !myGroupIds.has(g.id));

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          className="tai-btn tai-btn-outline tai-btn-sm"
          onClick={() => (back ? back() : push ? push("community") : null)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 8, fontWeight: 700 }}
        >
          ← Back to Community
        </button>
      </div>

      <TopBar title="Study Groups" sub="Find and join a group in your organization" />

      <div className="tai-row tai-between" style={{ alignItems: "center" }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>Your Groups</div>
        <button className="tai-btn tai-btn-primary tai-btn-sm" onClick={() => setCreating(v => !v)}>
          <Plus size={14} /> Create Study Group
        </button>
      </div>

      {creating && (
        <div className="tai-card" style={{ padding: 16, borderRadius: 12, border: "1px solid var(--border)" }}>
          <input
            className="tai-input" style={{ width: "100%", boxSizing: "border-box", marginBottom: 10 }}
            placeholder="Group name" value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
          />
          <textarea
            className="tai-input" style={{ width: "100%", boxSizing: "border-box", minHeight: 60, marginBottom: 10, fontFamily: "inherit" }}
            placeholder="What's this group focused on? (optional)" value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)}
          />
          <div className="tai-row tai-gap8">
            <button className="tai-btn tai-btn-primary tai-btn-sm" disabled={saving} onClick={handleCreate}>
              <Check size={14} /> {saving ? "Creating..." : "Create"}
            </button>
            <button className="tai-btn tai-btn-outline tai-btn-sm" onClick={() => setCreating(false)}><X size={14} /> Cancel</button>
          </div>
        </div>
      )}

      {myGroups.length === 0 ? (
        <div className="tai-card tai-empty" style={{ padding: 20, borderRadius: 12, fontSize: 13, color: "var(--text-2)" }}>
          You haven't joined a study group yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {myGroups.map(g => (
            <div key={g.id} className="tai-card tai-card-hover" style={{ padding: 14, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }} onClick={() => setSelectedGroupId(g.id)}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)" }}>{g.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>{g.study_group_members?.[0]?.count || 0} members{g.courses?.title ? ` • ${g.courses.title}` : ""}</div>
              </div>
              <ChevronRight size={16} color="var(--text-3)" />
            </div>
          ))}
        </div>
      )}

      <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", marginTop: 8 }}>Discover Groups</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {otherGroups.map(g => (
          <div key={g.id} className="tai-card" style={{ padding: 14, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0, cursor: "pointer" }} onClick={() => setSelectedGroupId(g.id)}>
              <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)" }}>{g.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>{g.study_group_members?.[0]?.count || 0} members</div>
            </div>
            <button className="tai-btn tai-btn-outline tai-btn-sm" style={{ flexShrink: 0 }} onClick={() => handleJoin(g.id)}>Join</button>
          </div>
        ))}
        {otherGroups.length === 0 && groups.length > 0 && (
          <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>You're already in every available group.</div>
        )}
      </div>
    </div>
  );
}

export default StudyGroupScreen;
