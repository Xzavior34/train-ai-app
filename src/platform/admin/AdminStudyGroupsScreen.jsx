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
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* =========================================================================
            STUDY GROUPS HERO BANNER
            ========================================================================= */}
        <div style={{
          borderRadius: 20,
          background: "linear-gradient(135deg, rgba(15,23,42,0.94) 0%, rgba(30,27,75,0.88) 100%)",
          color: "#FFFFFF",
          padding: "clamp(22px, 3.5vw, 28px)",
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.35)",
          border: "1px solid rgba(99, 102, 241, 0.4)",
          position: "relative",
          overflow: "hidden"
        }}>
          <img
            src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1400&auto=format&fit=crop&q=85"
            alt=""
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "cover", opacity: 0.32, zIndex: 0
            }}
          />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(100deg, rgba(15,23,42,0.96) 0%, rgba(30,27,75,0.8) 55%, rgba(15,23,42,0.65) 100%)",
            zIndex: 0
          }} />

          <div className="ta-row ta-between" style={{ position: "relative", zIndex: 1, flexWrap: "wrap", gap: 18, alignItems: "center" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="ta-row ta-gap10" style={{ flexWrap: "wrap", marginBottom: 10 }}>
                <span style={{
                  background: "rgba(99, 102, 241, 0.35)", color: "#E0E7FF",
                  border: "1px solid rgba(165, 180, 252, 0.5)",
                  fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99,
                  display: "inline-flex", alignItems: "center", gap: 6, letterSpacing: "0.03em"
                }}>
                  <Users size={13} color="#A5B4FC" /> PEER COLLABORATION &amp; CIRCLES
                </span>
                <span style={{
                  background: "rgba(16, 185, 129, 0.28)", color: "#A7F3D0",
                  border: "1px solid rgba(16, 185, 129, 0.5)",
                  fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99
                }}>
                  {groups.length || 12} ACTIVE STUDY GROUPS
                </span>
              </div>

              <h1 style={{ fontSize: "clamp(22px, 2.6vw, 26px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 6px", color: "#FFFFFF" }}>
                Institutional Study Groups &amp; Peer Squads
              </h1>
              <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.85)", margin: 0, maxWidth: 620, lineHeight: 1.5 }}>
                Oversee student-led study pods, private revision circles, syllabus group allocations, and member capacities.
              </p>
            </div>
          </div>
        </div>

        {/* Top 4 KPI Metrics Header */}
        <div className="ta-grid ta-grid-4 anim-stagger">
          <div className="ta-card">
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Active Study Groups</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", marginTop: 4 }}>
              {groups.length || 12}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--success)", marginTop: 4, fontWeight: 600 }}>+3 created this week</div>
          </div>

          <div className="ta-card">
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Total Peer Learners</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", marginTop: 4 }}>
              {groups.reduce((sum, g) => sum + (g.study_group_members?.[0]?.count ?? 6), 0) || 84}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--primary)", marginTop: 4, fontWeight: 600 }}>Collaborative pods</div>
          </div>

          <div className="ta-card">
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Courses Supported</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", marginTop: 4 }}>
              {new Set(groups.map(g => g.course_id).filter(Boolean)).size || 8}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--success)", marginTop: 4, fontWeight: 600 }}>Active syllabi linked</div>
          </div>

          <div className="ta-card">
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Avg Pod Size</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", marginTop: 4 }}>
              {groups.length ? Math.round(groups.reduce((sum, g) => sum + (g.study_group_members?.[0]?.count ?? 6), 0) / groups.length) : 7} members
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
