import React, { useState } from "react";
import { TopBar, StatCard, Avatar, Tag, ProgressBar, ToastContext } from "../components/PlatformUI.jsx";
import { Users, Target, AlertTriangle, Gauge, PieChart, StickyNote } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchDirectReports, fetchTeamSkillSnapshot, fetchNotesForDepartment, addDepartmentFeedbackNote } from "../../lib/api/platform.js";

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
      />
      <div className="ta-content">
        <div className="ta-grid ta-grid-4">
          {kpis.map((k) => <StatCard key={k.label} stat={k} />)}
        </div>
        {readinessScore !== null && (
          <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: -8, marginBottom: 8 }}>
            Readiness score = average course completion ({avgCompletion}%), reduced for overdue compliance items ({totalOverdue} across the team). Not a predictive score - a summary of what's directly measurable today.
          </div>
        )}

        <div className="ta-card ta-mt20">
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

        <div className="ta-card ta-mt20">
          <div className="ta-row ta-gap8"><PieChart size={16} color="var(--primary)" /><div className="ta-title">Team skill snapshot</div></div>
          <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>
            Completion by course category across your team - the closest real signal to a skill breakdown without a dedicated skills taxonomy in the product yet.
          </div>
          <div className="ta-col ta-gap8 ta-mt12">
            {skillSnapshotQuery.loading && <div className="ta-empty">Loading...</div>}
            {!skillSnapshotQuery.loading && (skillSnapshotQuery.data || []).length === 0 && <div className="ta-empty">No course activity to summarize yet.</div>}
            {(skillSnapshotQuery.data || []).map((s) => (
              <div key={s.category}>
                <div className="ta-row ta-between" style={{ fontSize: 12.5 }}>
                  <span style={{ fontWeight: 600 }}>{s.category}</span>
                  <span>{s.avgProgress}% avg ({s.learnerCount} enrollments)</span>
                </div>
                <ProgressBar value={s.avgProgress} />
              </div>
            ))}
          </div>
        </div>

        {department && (
          <div className="ta-card ta-mt20">
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
                  <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 4 }}>{n.user_profiles?.display_name || "Manager"} - {new Date(n.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
