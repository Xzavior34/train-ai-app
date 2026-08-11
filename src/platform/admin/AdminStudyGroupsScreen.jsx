import React from "react";
import { TopBar, Tag } from "../components/PlatformUI.jsx";
import { Users, BookOpen } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchAllStudyGroupsForOrg } from "../../lib/api/schemaHelper.js";

// Admin-wide Study Groups - confirmed directly: "Admins should be able to
// see and access all study groups." Previously there was no admin-facing
// view of study groups at all - only individual learners could see groups
// they'd joined. Org-scoped (a real cross-tenant leak in the underlying
// RLS was found and fixed while building this - see
// 0127_suspend_instructor_payouts.sql).
export function AdminStudyGroupsScreen({ orgId, orgSelector }) {
  const groupsQuery = useSupabaseQuery(async () => (orgId ? fetchAllStudyGroupsForOrg(orgId) : []), [orgId]);
  const groups = groupsQuery.data || [];

  return (
    <div className="ta-fade">
      <TopBar title="Study Groups" sub="Every study group in your organization" orgSelector={orgSelector} />
      <div className="ta-content">
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
                {groups.map((g) => (
                  <tr key={g.id}>
                    <td><div className="ta-row ta-gap8"><Users size={14} color="var(--primary)" /><span style={{ fontWeight: 600 }}>{g.name}</span></div></td>
                    <td>{g.courses?.title ? <div className="ta-row ta-gap6"><BookOpen size={12} /><span>{g.courses.title}</span></div> : <span style={{ color: "var(--text-3)" }}>No linked course</span>}</td>
                    <td>{g.study_group_members?.[0]?.count ?? 0} / {g.max_members || "-"}</td>
                    <td><Tag tone={g.is_private ? "warning" : "success"}>{g.is_private ? "Private" : "Open"}</Tag></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
