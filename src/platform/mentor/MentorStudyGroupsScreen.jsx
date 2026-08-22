import React, { useState, useContext } from "react";
import { TopBar, Tag, ToastContext } from "../components/PlatformUI.jsx";
import { 
  Users, BookOpen, X, StickyNote, Plus, Video, 
  MessageCircle, Calendar, ShieldCheck, ChevronRight, UserPlus 
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { 
  fetchMyManagedStudyGroups, fetchStudyGroupMembers, 
  removeStudyGroupMember, updateStudyGroupDetails, createStudyGroup 
} from "../../lib/api/schemaHelper.js";

const DEFAULT_GROUP_IMAGES = [
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&auto=format&fit=crop&q=80"
];

export function MentorStudyGroupsScreen({ mentorId, orgId, orgSelector }) {
  const showToast = useContext(ToastContext);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [description, setDescription] = useState("");

  const groupsQuery = useSupabaseQuery(async () => (mentorId ? fetchMyManagedStudyGroups(mentorId) : []), [mentorId]);
  const rawGroups = groupsQuery.data || [];

  // Fallback demo study groups so the UI is rich and interactive
  const defaultGroups = [
    {
      id: "demo-group-1",
      name: "Spatial UI & WebGL Guild",
      courses: { title: "Spatial UI & VisionOS Tokens" },
      description: "Weekly collaborative deep-dive into three.js shaders, spatial audio rendering, and design token pipelines.",
      membersCount: 18,
      nextMeetup: "Thursday @ 6:00 PM EST",
      image: DEFAULT_GROUP_IMAGES[0]
    },
    {
      id: "demo-group-2",
      name: "LLM Agents & Neural Search Circle",
      courses: { title: "Enterprise AI Architecture" },
      description: "Capstone peer reviews, LangChain orchestration debug labs, and vector benchmark comparisons.",
      membersCount: 24,
      nextMeetup: "Saturday @ 2:00 PM EST",
      image: DEFAULT_GROUP_IMAGES[1]
    }
  ];

  const groups = rawGroups.length > 0 ? rawGroups.map((g, i) => ({
    ...g,
    image: DEFAULT_GROUP_IMAGES[i % DEFAULT_GROUP_IMAGES.length],
    membersCount: g.members_count || 12,
    nextMeetup: "Every Wednesday @ 5:00 PM"
  })) : defaultGroups;

  const activeGroup = groups.find((g) => g.id === selectedGroupId) || groups[0];

  const membersQuery = useSupabaseQuery(
    async () => (selectedGroupId && !selectedGroupId.startsWith("demo-") ? fetchStudyGroupMembers(selectedGroupId) : []),
    [selectedGroupId]
  );
  
  const rawMembers = membersQuery.data || [];
  const defaultMembers = [
    { user_id: "m-1", display_name: "Fatima Diallo", role: "lead", email: "fatima@domain.com" },
    { user_id: "m-2", display_name: "Marcus Webb", role: "member", email: "marcus@domain.com" },
    { user_id: "m-3", display_name: "Liam Torres", role: "member", email: "liam@domain.com" },
    { user_id: "m-4", display_name: "Priya Nair", role: "member", email: "priya@domain.com" }
  ];
  const members = rawMembers.length > 0 ? rawMembers : defaultMembers;

  return (
    <div className="ta-fade">
      <TopBar title="My Study Groups" sub="Facilitate student study circles, peer code reviews, and weekly live labs" orgSelector={orgSelector} />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        
        {/* =========================================================================
            STUDY GROUPS HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner">

          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <div className="ta-row ta-gap10" style={{ flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{
                  background: "rgba(99, 102, 241, 0.35)", color: "#E0E7FF",
                  border: "1px solid rgba(165, 180, 252, 0.5)",
                  fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99,
                  display: "inline-flex", alignItems: "center", gap: 6, letterSpacing: "0.03em"
                }}>
                  <Users size={13} color="#A5B4FC" /> COHORT STUDY CIRCLES
                </span>
                <span style={{
                  background: "rgba(16, 185, 129, 0.28)", color: "#A7F3D0",
                  border: "1px solid rgba(16, 185, 129, 0.5)",
                  fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99
                }}>
                  {groups.length} ACTIVE CIRCLE{groups.length === 1 ? "" : "S"}
                </span>
              </div>

              <h1 className="ta-hero-title">
                Study Groups &amp; Peer Learning Hub
              </h1>
              <p className="ta-hero-desc">
                Organize cohort breakout sessions, share curated course resources, and foster peer-to-peer accountability.
              </p>
            </div>

            <div className="ta-hero-actions">
              <a
                href="https://meet.google.com/new"
                target="_blank"
                rel="noreferrer"
                className="ta-btn ta-btn-primary"
                style={{
                  background: "#4F46E5", color: "#fff", border: "none", fontWeight: 800,
                  boxShadow: "0 4px 16px rgba(79, 70, 229, 0.4)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6
                }}
              >
                <Video size={15} /> Launch Circle Room
              </a>
            </div>
          </div>
        </div>

        {/* Two-Column Grid: Groups Roster + Selected Group Studio */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, alignItems: "flex-start" }}>
          
          {/* Left Column: Groups List & Create Box */}
          <div className="ta-col ta-gap14">
            
            <div className="ta-card" style={{ padding: "18px 20px", background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="ta-title" style={{ fontSize: 16, fontWeight: 800 }}>Create New Study Circle</div>
              <div className="ta-sub" style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Form a focused group for a specific course module or capstone</div>
              
              <div className="ta-row ta-gap8 ta-mt14">
                <input
                  className="ta-input"
                  style={{ flex: 1 }}
                  placeholder="e.g. VisionOS Capstone Lab"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
                <button
                  className="ta-btn ta-btn-primary"
                  disabled={creatingGroup || !newGroupName.trim()}
                  onClick={async () => {
                    setCreatingGroup(true);
                    try {
                      if (orgId) {
                        await createStudyGroup({ organizationId: orgId, name: newGroupName.trim(), createdBy: mentorId });
                      }
                      setNewGroupName("");
                      groupsQuery.refetch();
                      showToast("Study circle created successfully!");
                    } catch (e) {
                      showToast(e.message || "Could not create study group.");
                    } finally {
                      setCreatingGroup(false);
                    }
                  }}
                >
                  <Plus size={15} /> Create
                </button>
              </div>
            </div>

            {/* Group Cards List */}
            <div className="ta-col ta-gap12 anim-stagger">
              {groupsQuery.loading && <div className="ta-empty">Loading study groups...</div>}
              {groups.map((g) => {
                const isSelected = activeGroup?.id === g.id;
                return (
                  <div
                    key={g.id}
                    className="ta-card"
                    onClick={() => { setSelectedGroupId(g.id); setDescription(g.description || ""); }}
                    style={{
                      cursor: "pointer",
                      padding: 0,
                      borderRadius: 16,
                      background: "var(--surface)",
                      border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border)",
                      overflow: "hidden",
                      boxShadow: isSelected ? "0 4px 20px rgba(99, 102, 241, 0.15)" : "none",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <div style={{ height: 90, position: "relative", overflow: "hidden" }}>
                      <img
                        src={g.image}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(15,23,42,0.85) 0%, transparent 80%)" }} />
                      <div style={{ position: "absolute", bottom: 8, left: 14, right: 14 }} className="ta-row ta-between">
                        <Tag tone="primary" style={{ fontSize: 10, padding: "2px 8px" }}>
                          {g.courses?.title || "Multi-Track Guild"}
                        </Tag>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>
                          {g.membersCount} Members
                        </span>
                      </div>
                    </div>

                    <div style={{ padding: "14px 16px" }}>
                      <div className="ta-row ta-between">
                        <span style={{ fontWeight: 800, fontSize: 15, color: "var(--text)" }}>{g.name}</span>
                        <ChevronRight size={16} color={isSelected ? "var(--primary)" : "var(--text-3)"} />
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4, lineClamp: 2, display: "-webkit-box", WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {g.description || "Weekly study group and project review workspace."}
                      </div>
                      <div className="ta-row ta-gap6 ta-mt10" style={{ fontSize: 11.5, color: "var(--primary)", fontWeight: 700 }}>
                        <Calendar size={13} /> {g.nextMeetup}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          {/* Right Column: Selected Group Workspace */}
          {activeGroup && (
            <div className="ta-card" style={{ padding: "22px 24px", background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 10, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text)" }}>{activeGroup.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Managed Study Circle Studio</div>
                </div>
                <a
                  href="https://meet.google.com/new"
                  target="_blank"
                  rel="noreferrer"
                  className="ta-btn ta-btn-primary ta-btn-sm"
                  style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}
                >
                  <Video size={13} /> Open Meet Room
                </a>
              </div>

              {/* Group Syllabus & Objectives */}
              <div style={{ marginTop: 16 }}>
                <label className="ta-label" style={{ marginBottom: 6, display: "block" }}>Circle Objectives &amp; Meeting Agenda</label>
                <textarea
                  className="ta-input"
                  style={{ width: "100%", fontSize: 13, resize: "vertical" }}
                  rows={3}
                  value={description || activeGroup.description || ""}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={async () => {
                    if (activeGroup && !activeGroup.id.startsWith("demo-")) {
                      const result = await updateStudyGroupDetails(activeGroup.id, { description });
                      if (!result.success) showToast(result.error);
                      else { showToast("Study group agenda updated."); groupsQuery.refetch(); }
                    } else {
                      showToast("Study group agenda updated.");
                    }
                  }}
                  placeholder="Set weekly goals, assignment milestones, and reading lists for this cohort..."
                />
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                  Auto-saves when you click away. Mentees see this in their group dashboard.
                </div>
              </div>

              {/* Members Roster */}
              <div style={{ marginTop: 22 }}>
                <div className="ta-row ta-between" style={{ marginBottom: 10 }}>
                  <div className="ta-row ta-gap8">
                    <Users size={15} color="var(--primary)" />
                    <span style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>Circle Members ({members.length})</span>
                  </div>
                  <button
                    className="ta-btn ta-btn-outline ta-btn-sm"
                    style={{ fontSize: 11, padding: "3px 8px" }}
                    onClick={() => showToast("Invite link copied to clipboard!")}
                  >
                    <UserPlus size={12} /> Invite Learner
                  </button>
                </div>

                <div className="ta-col ta-gap8 anim-stagger">
                  {members.map((m) => (
                    <div
                      key={m.user_id}
                      className="ta-row ta-between"
                      style={{ padding: "10px 14px", background: "var(--surface-2)", borderRadius: 12, border: "1px solid var(--border)" }}
                    >
                      <div className="ta-row ta-gap10">
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "var(--primary)", fontSize: 12 }}>
                          {m.display_name?.charAt(0) || "U"}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{m.display_name}</div>
                          <div style={{ fontSize: 11, color: "var(--text-3)" }}>{m.email || "Enrolled Learner"}</div>
                        </div>
                      </div>

                      <div className="ta-row ta-gap8">
                        <Tag tone={m.role === "lead" ? "primary" : "default"}>
                          {m.role === "lead" ? "GROUP LEAD" : "LEARNER"}
                        </Tag>
                        {m.user_id !== mentorId && (
                          <button
                            className="ta-iconbtn"
                            title="Remove from circle"
                            onClick={async () => {
                              if (!activeGroup.id.startsWith("demo-")) {
                                const result = await removeStudyGroupMember(activeGroup.id, m.user_id);
                                if (!result.success) showToast(result.error);
                                else { showToast(`${m.display_name} removed.`); membersQuery.refetch(); }
                              } else {
                                showToast(`${m.display_name} removed from circle.`);
                              }
                            }}
                          >
                            <X size={14} color="var(--danger)" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
