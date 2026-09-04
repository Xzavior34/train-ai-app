import React, { useContext, useState } from "react";
import { TopBar, Tag, ToastContext } from "../components/PlatformUI.jsx";
import { Users, BookOpen, ChevronRight, Trash2 } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchAllStudyGroupsForOrg, fetchStudyGroupMembers, removeStudyGroupMember } from "../../lib/api/schemaHelper.js";

// Admin-wide Study Groups - confirmed directly: "Admins should be able to
// see and access all study groups." Previously there was no admin-facing
// view of study groups at all - only individual learners could see groups
// they'd joined. Org-scoped (a real cross-tenant leak in the underlying
// RLS was found and fixed while building this - see
// 0127_suspend_instructor_payouts.sql).
export function AdminStudyGroupsScreen({ orgId, orgSelector }) {
  const showToast = useContext(ToastContext);
  const groupsQuery = useSupabaseQuery(async () => (orgId ? fetchAllStudyGroupsForOrg(orgId) : []), [orgId]);
  const groups = groupsQuery.data || [];
  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const membersQuery = useSupabaseQuery(async () => (expandedGroupId ? fetchStudyGroupMembers(expandedGroupId) : []), [expandedGroupId]);

  async function handleRemoveMember(groupId, userId) {
    try {
      await removeStudyGroupMember(groupId, userId);
      membersQuery.refetch();
      groupsQuery.refetch();
      showToast("Removed from the group.");
    } catch (e) {
      showToast(e?.message || "Could not remove this member.");
    }
  }

  return (
    <div className="ta-fade">
      <TopBar title="Study Groups" sub="Every study group in your organization" orgSelector={orgSelector} />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* =========================================================================
            STUDY GROUPS HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner anim-fluid-entrance">
          <div className="tai-glow-cyan" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">Peer Circles &amp; Study Groups</h1>
              <p className="ta-hero-desc">Oversee student study circles, mentor pairings, and collaborative rooms.</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                <span className="ta-tag ta-tag-info">
                  <Users size={13} /> {groups.length} Active Pods
                </span>
                <span className="ta-tag ta-tag-success">
                  <BookOpen size={13} /> Syllabi Linked
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Top 4 KPI Metrics Header */}
        <div className="ta-grid ta-grid-4 anim-stagger">
          <div className="ta-card">
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Active Study Groups</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", marginTop: 4 }}>
              {groups.length}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4, fontWeight: 600 }}>In your organization</div>
          </div>

          <div className="ta-card">
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Total Peer Learners</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", marginTop: 4 }}>
              {groups.reduce((sum, g) => sum + (g.study_group_members?.[0]?.count ?? 0), 0)}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--primary)", marginTop: 4, fontWeight: 600 }}>Collaborative pods</div>
          </div>

          <div className="ta-card">
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Courses Supported</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", marginTop: 4 }}>
              {new Set(groups.map(g => g.course_id).filter(Boolean)).size}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--success)", marginTop: 4, fontWeight: 600 }}>Active syllabi linked</div>
          </div>

          <div className="ta-card">
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Avg Pod Size</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", marginTop: 4 }}>
              {groups.length ? Math.round(groups.reduce((sum, g) => sum + (g.study_group_members?.[0]?.count ?? 0), 0) / groups.length) : 0} members
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4, fontWeight: 600 }}>Optimal peer capacity</div>
          </div>
        </div>

        <div className="ta-card">
          <div className="ta-title">All study groups ({groups.length})</div>
          <div className="ta-table-wrap">
            <table className="ta-table ta-mt16">
              <thead>
                <tr><th>Name</th><th>Linked course</th><th>Members</th><th>Visibility</th></tr>
              </thead>
              <tbody>
                {groupsQuery.loading && <tr><td colSpan={4} className="ta-empty">Loading study groups...</td></tr>}
                {!groupsQuery.loading && groups.length === 0 && (
                  <tr><td colSpan={4} className="ta-empty">No study groups in this organization yet - learners create these themselves as they self-organize.</td></tr>
                )}
                {groups.map((g) => {
                  const isOpen = expandedGroupId === g.id;
                  return (
                    <React.Fragment key={g.id}>
                      <tr style={{ cursor: "pointer" }} onClick={() => setExpandedGroupId(isOpen ? null : g.id)}>
                        <td><div className="ta-row ta-gap8"><Users size={14} color="var(--primary)" /><span style={{ fontWeight: 600 }}>{g.name}</span></div></td>
                        <td>{g.courses?.title ? <div className="ta-row ta-gap6"><BookOpen size={12} /><span>{g.courses.title}</span></div> : <span style={{ color: "var(--text-3)" }}>No linked course</span>}</td>
                        <td>{g.study_group_members?.[0]?.count ?? 0} / {g.max_members || "-"}</td>
                        <td className="ta-row ta-between" style={{ alignItems: "center" }}>
                          <Tag tone={g.is_private ? "warning" : "success"}>{g.is_private ? "Private" : "Open"}</Tag>
                          <ChevronRight size={14} color="var(--text-3)" style={{ transform: isOpen ? "rotate(90deg)" : "none" }} />
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={4} style={{ background: "var(--surface-3)", padding: 14 }}>
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-2)", marginBottom: 8 }}>MEMBERS</div>
                            {membersQuery.loading && <div className="ta-empty">Loading members...</div>}
                            {!membersQuery.loading && (membersQuery.data || []).length === 0 && <div className="ta-empty">No members yet.</div>}
                            <div className="ta-col ta-gap6">
                              {(membersQuery.data || []).map((m) => (
                                <div key={m.user_id || m.id} className="ta-row ta-between" style={{ fontSize: 12.5, padding: "4px 0" }}>
                                  <span>{m.user_profiles?.display_name || m.name || "Learner"}</span>
                                  <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => handleRemoveMember(g.id, m.user_id || m.id)}>
                                    <Trash2 size={12} /> Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
