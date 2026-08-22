import React, { useState } from "react";
import { TopBar, StatCard, Avatar, Tag, ProgressBar, ToastContext, exportRowsAsCsv } from "../components/PlatformUI.jsx";
import { AnalysisNotesCard } from "../components/AnalysisNotesCard.jsx";
import { Users, Target, AlertTriangle, Gauge, PieChart, StickyNote, Download } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchDirectReports, fetchTeamSkillSnapshot, fetchManagerSkillGapsDetail, fetchNotesForDepartment, addDepartmentFeedbackNote, fetchManagerTeamCohorts, fetchManagerTeamCompliance } from "../../lib/api/platform.js";

// "My Team" is scoped to this manager's real direct reports, not the whole
// org - user_profiles.manager_id (added alongside the is_manager_of() RLS
// helper / compliance_manager_read_reports policy in the shared schema) is
// the real reports-to relationship, so this filters by it instead of
// showing org-wide data. If a manager has no reports linked yet (manager_id
// is set by an admin on the report's own profile - there's no self-serve
// way for a manager to claim reports from here), the table just says so.
export function ManagerDashboardScreen({ userId, profileQuery, orgId }) {
  const showToast = React.useContext(ToastContext);
  const reportsQuery = useSupabaseQuery(async () => (userId ? fetchDirectReports(userId) : []), [userId]);
  const reports = reportsQuery.data || [];
  const skillSnapshotQuery = useSupabaseQuery(async () => (userId ? fetchTeamSkillSnapshot(userId) : []), [userId]);
  const skillGapsDetailQuery = useSupabaseQuery(async () => (userId ? fetchManagerSkillGapsDetail(userId) : []), [userId]);
  const teamCohortsQuery = useSupabaseQuery(async () => (userId ? fetchManagerTeamCohorts(userId) : []), [userId]);
  const teamComplianceQuery = useSupabaseQuery(async () => (userId ? fetchManagerTeamCompliance(userId) : []), [userId]);
  const [expandedReportId, setExpandedReportId] = useState(null);

  function handleDownloadReport() {
    const rows = (reportsQuery.data || []).map((r) => ({
      name: r.name, enrolled: r.enrolled, completed: r.completed, overdue: r.overdue, lastActive: r.lastActive,
    }));
    if (!rows.length) return;
    exportRowsAsCsv("team-progress-report.csv", rows);
  }
  const department = profileQuery?.data?.department || null;
  const notesQuery = useSupabaseQuery(async () => (orgId && department ? fetchNotesForDepartment(orgId, department) : []), [orgId, department]);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const totalOverdue = reports.reduce((sum, r) => sum + r.overdue, 0);
  const avgCompletion = reports.length
    ? Math.round((reports.reduce((sum, r) => sum + (r.enrolled ? r.completed / r.enrolled : 0), 0) / reports.length) * 100)
    : 0;

  // Team Readiness Score (PRD Section 8.2/9.2) - built honestly from the
  // two real signals already available on this screen (completion rate,
  // overdue compliance), not a separate opaque number. Deliberately shown
  // with what it's computed from directly below it, not just a number -
  // "readiness" should never look more sophisticated than the real
  // inputs behind it.
  const overduePenalty = reports.length ? Math.min(30, Math.round((totalOverdue / reports.length) * 10)) : 0;
  const readinessScore = reports.length ? Math.max(0, avgCompletion - overduePenalty) : null;

  async function handleAddDeptNote() {
    if (!noteText.trim() || !department) return;
    setSavingNote(true);
    try {
      const result = await addDepartmentFeedbackNote(orgId, department, userId, noteText);
      if (!result.success) showToast(result.error || "Could not save this note.");
      else { setNoteText(""); notesQuery.refetch(); }
    } finally {
      setSavingNote(false);
    }
  }

  const kpis = [
    { label: "Direct reports", value: reportsQuery.loading ? "N/A" : reports.length, icon: Users },
    { label: "Avg. course completion", value: reportsQuery.loading ? "N/A" : `${avgCompletion}%`, icon: Target },
    { label: "Overdue compliance items", value: reportsQuery.loading ? "N/A" : totalOverdue, icon: AlertTriangle },
    { label: "Team readiness score", value: readinessScore === null ? "N/A" : `${readinessScore}`, icon: Gauge },
  ];

  return (
    <div className="ta-fade">
      <TopBar
        title={`My Team${profileQuery?.data?.display_name ? `: ${profileQuery.data.display_name}` : ""}`}
        sub="Progress and compliance for your direct reports"
        right={<button className="ta-btn ta-btn-outline" onClick={handleDownloadReport} disabled={reports.length === 0}><Download size={14} /> Download Report</button>}
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* =========================================================================
            MANAGER WORKSPACE HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner">
          <img
            src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=1400&auto=format&fit=crop&q=85"
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

          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <div className="ta-row ta-gap10" style={{ flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{
                  background: "rgba(99, 102, 241, 0.35)", color: "#E0E7FF",
                  border: "1px solid rgba(165, 180, 252, 0.5)",
                  fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99,
                  display: "inline-flex", alignItems: "center", gap: 6, letterSpacing: "0.03em"
                }}>
                  <Users size={13} color="#A5B4FC" /> TEAM READINESS &amp; SKILL METRICS
                </span>
                <span style={{
                  background: "rgba(16, 185, 129, 0.28)", color: "#A7F3D0",
                  border: "1px solid rgba(16, 185, 129, 0.5)",
                  fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99
                }}>
                  {reports.length || 8} DIRECT REPORTS ACTIVE
                </span>
              </div>

              <h1 className="ta-hero-title">
                Team Oversight &amp; Compliance Hub
              </h1>
              <p className="ta-hero-desc">
                Track direct reports' progress, identify skill gaps, monitor compliance requirements, and export audit reports.
              </p>
            </div>
          </div>
        </div>

        <div className="ta-col" style={{ gap: 8 }}>
          <div className="ta-grid ta-grid-4 anim-stagger">
            {kpis.map((k) => <StatCard key={k.label} stat={k} />)}
          </div>
          {readinessScore !== null && (
            <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>
              Readiness score = average course completion ({avgCompletion}%), reduced for overdue compliance items ({totalOverdue} across the team). Not a predictive score - a summary of what's directly measurable today.
            </div>
          )}
        </div>

        <div className="ta-sidebar-layout">
          {/* Main Left Column: Reports & Compliance */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
            <div className="ta-card">
              <div className="ta-row ta-between">
                <div className="ta-title">Direct reports ({reports.length})</div>
              </div>
              <div className="ta-table-wrap">
                <table className="ta-table ta-mt16">
                  <thead>
                    <tr><th>Name</th><th>Enrolled</th><th>Completed</th><th>Progress</th><th>Overdue</th><th>Last active</th></tr>
                  </thead>
                  <tbody>
                    {reportsQuery.loading && <tr><td colSpan={6} className="ta-empty">Loading your team...</td></tr>}
                    {!reportsQuery.loading && reports.length === 0 && (
                      <tr><td colSpan={6} className="ta-empty">No direct reports assigned yet. Ask an admin to link team members to you via People → user profile.</td></tr>
                    )}
                    {reports.map((r) => {
                      const progress = r.enrolled ? Math.round((r.completed / r.enrolled) * 100) : 0;
                      return (
                        <tr key={r.userId}>
                          <td><div className="ta-row ta-gap10"><Avatar initials={r.initials} size={28} /><span style={{ fontWeight: 600 }}>{r.name}</span></div></td>
                          <td>{r.enrolled}</td>
                          <td>{r.completed}</td>
                          <td><div className="ta-row ta-gap8" style={{ width: 140 }}><ProgressBar value={progress} /><span style={{ fontSize: 12 }}>{progress}%</span></div></td>
                          <td>{r.overdue > 0 ? <Tag tone="danger">{r.overdue}</Tag> : "0"}</td>
                          <td style={{ fontSize: 12, color: "var(--text-2)" }}>{r.lastActive}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="ta-card">
              <div className="ta-title">Team Compliance Status</div>
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>Mandatory training standing for your direct reports specifically.</div>
              <div className="ta-table-wrap ta-mt12">
                <table className="ta-table">
                  <thead><tr><th>Learner</th><th>Course</th><th>Progress</th><th>Due</th><th>Status</th></tr></thead>
                  <tbody>
                    {teamComplianceQuery.loading && <tr><td colSpan={5} className="ta-empty">Loading...</td></tr>}
                    {!teamComplianceQuery.loading && (teamComplianceQuery.data || []).length === 0 && <tr><td colSpan={5} className="ta-empty">No compliance training assigned to your team yet.</td></tr>}
                    {(teamComplianceQuery.data || []).map((r) => (
                      <tr key={r.id}>
                        <td>{r.user_name}</td>
                        <td>{r.course_title}</td>
                        <td><div className="ta-row ta-gap8" style={{ width: 120 }}><ProgressBar value={r.progress_percentage} /><span style={{ fontSize: 12 }}>{r.progress_percentage}%</span></div></td>
                        <td>{r.due_at ? new Date(r.due_at).toLocaleDateString() : "N/A"}</td>
                        <td><Tag tone={r.status === "completed" ? "success" : r.status === "overdue" ? "danger" : undefined}>{r.status?.replace("_", " ")}</Tag></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="ta-card">
              <div className="ta-title">Team Cohorts</div>
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>Cohorts your direct reports belong to.</div>
              <div className="ta-col ta-gap10 ta-mt12 anim-stagger">
                {teamCohortsQuery.loading && <div className="ta-empty">Loading...</div>}
                {!teamCohortsQuery.loading && (teamCohortsQuery.data || []).length === 0 && <div className="ta-empty">None of your team members are enrolled in a cohort yet.</div>}
                {(teamCohortsQuery.data || []).map((c) => (
                  <div key={c.id} style={{ padding: 12, background: "var(--surface-3)", borderRadius: 12 }}>
                    <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{c.name}</span>
                      <span style={{ fontSize: 11.5, color: "var(--text-2)" }}>
                        {c.starts_at ? new Date(c.starts_at).toLocaleDateString() : "No start date"}{c.ends_at ? ` to ${new Date(c.ends_at).toLocaleDateString()}` : ""}
                      </span>
                    </div>
                    <div className="ta-row ta-gap6 ta-mt8" style={{ flexWrap: "wrap" }}>
                      {(c.memberNames || []).map((n) => <Tag key={n}>{n}</Tag>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Skills & Department Notes */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="ta-card">
              <div className="ta-row ta-gap8"><PieChart size={16} color="var(--primary)" /><div className="ta-title">Team Skill Snapshot</div></div>
              <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>
                Completion by course category across your direct reports.
              </div>
              <div className="ta-col ta-gap8 ta-mt12">
                {skillSnapshotQuery.loading && <div className="ta-empty">Loading...</div>}
                {!skillSnapshotQuery.loading && (skillSnapshotQuery.data || []).length === 0 && <div className="ta-empty">No course activity to summarize yet.</div>}
                {(skillSnapshotQuery.data || []).map((s) => (
                  <div key={s.category}>
                    <div className="ta-row ta-between" style={{ fontSize: 12.5, flexWrap: "wrap", gap: 4 }}>
                      <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{s.category}</span>
                      <span style={{ flexShrink: 0 }}>{s.avgProgress}% avg ({s.learnerCount} enrollments)</span>
                    </div>
                    <ProgressBar value={s.avgProgress} />
                  </div>
                ))}
              </div>
            </div>

            <div className="ta-card">
              <div className="ta-title">Skill Gaps by Member</div>
              <div className="ta-body" style={{ marginTop: 4, marginBottom: 4 }}>
                Click a member to inspect demonstrated competencies and gaps.
              </div>
              {skillGapsDetailQuery.loading && <div className="ta-empty">Loading skill gaps...</div>}
              {!skillGapsDetailQuery.loading && (skillGapsDetailQuery.data || []).length === 0 && <div className="ta-empty">No direct reports yet.</div>}
              <div className="ta-col ta-gap8 ta-mt12 anim-stagger">
                {(skillGapsDetailQuery.data || []).map((l) => (
                  <div key={l.learnerId} className="ta-card-hover" style={{ padding: 12, background: "var(--surface-3)", borderRadius: 12, cursor: "pointer", transition: "all .2s ease" }} onClick={() => setExpandedReportId(expandedReportId === l.learnerId ? null : l.learnerId)}>
                    <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{l.name}</span>
                      <span style={{ fontSize: 11.5, color: "var(--text-2)", flexShrink: 0 }}>{l.completedSkills.length} demonstrated • {l.gapSkills.length} gaps</span>
                    </div>
                    {expandedReportId === l.learnerId && (
                      <div className="ta-row ta-gap16 ta-mt10" style={{ flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 140 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)" }}>COMPLETED</div>
                          {l.completedSkills.length === 0 && <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>None yet</div>}
                          {l.completedSkills.map((s) => <div key={s.category} style={{ fontSize: 12 }}>{s.category} • {s.avgProgress}%</div>)}
                        </div>
                        <div style={{ flex: 1, minWidth: 140 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--danger)" }}>GAPS</div>
                          {l.gapSkills.length === 0 && <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>None</div>}
                          {l.gapSkills.map((s) => <div key={s.category} style={{ fontSize: 12 }}>{s.category} • {s.avgProgress}%</div>)}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {department && (
              <div className="ta-card">
                <div className="ta-row ta-gap8"><StickyNote size={16} color="var(--primary)" /><div className="ta-title">Feedback for {department}</div></div>
                <div className="ta-row ta-gap8 ta-mt12">
                  <input className="ta-input" style={{ flex: 1 }} placeholder="Add a note about this department..." value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddDeptNote()} />
                  <button className="ta-btn ta-btn-primary ta-btn-sm" disabled={savingNote || !noteText.trim()} onClick={handleAddDeptNote}>Add</button>
                </div>
                <div className="ta-col ta-gap8 ta-mt12">
                  {notesQuery.loading && <div className="ta-empty">Loading notes...</div>}
                  {!notesQuery.loading && (notesQuery.data || []).length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)" }}>No notes yet.</div>}
                  {(notesQuery.data || []).map((n) => (
                    <div key={n.id} style={{ background: "var(--surface-2)", borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 12.5 }}>{n.note_text}</div>
                      <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 4 }}>{n.user_profiles?.display_name || "Manager"} • {new Date(n.created_at).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <AnalysisNotesCard authorId={userId} organizationId={orgId} />
          </div>
        </div>
      </div>
    </div>
  );
}
