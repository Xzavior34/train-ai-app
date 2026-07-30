import React from "react";
import { TopBar, StatCard, Avatar, Tag, ProgressBar } from "../components/PlatformUI.jsx";
import { Users, Target, AlertTriangle } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchDirectReports } from "../../lib/api/platform.js";

// "My Team" is scoped to this manager's real direct reports, not the whole
// org — user_profiles.manager_id (added alongside the is_manager_of() RLS
// helper / compliance_manager_read_reports policy in the shared schema) is
// the real reports-to relationship, so this filters by it instead of
// showing org-wide data. If a manager has no reports linked yet (manager_id
// is set by an admin on the report's own profile — there's no self-serve
// way for a manager to claim reports from here), the table just says so.
export function ManagerDashboardScreen({ userId, profileQuery }) {
  const reportsQuery = useSupabaseQuery(async () => (userId ? fetchDirectReports(userId) : []), [userId]);
  const reports = reportsQuery.data || [];

  const totalOverdue = reports.reduce((sum, r) => sum + r.overdue, 0);
  const avgCompletion = reports.length
    ? Math.round((reports.reduce((sum, r) => sum + (r.enrolled ? r.completed / r.enrolled : 0), 0) / reports.length) * 100)
    : 0;

  const kpis = [
    { label: "Direct reports", value: reportsQuery.loading ? "—" : reports.length, icon: Users },
    { label: "Avg. course completion", value: reportsQuery.loading ? "—" : `${avgCompletion}%`, icon: Target },
    { label: "Overdue compliance items", value: reportsQuery.loading ? "—" : totalOverdue, icon: AlertTriangle },
  ];

  return (
    <div className="ta-fade">
      <TopBar
        title={`My Team${profileQuery?.data?.display_name ? ` — ${profileQuery.data.display_name}` : ""}`}
        sub="Progress and compliance for your direct reports"
      />
      <div className="ta-content">
        <div className="ta-grid ta-grid-3">
          {kpis.map((k) => <StatCard key={k.label} stat={k} />)}
        </div>

        <div className="ta-card ta-mt20">
          <div className="ta-row ta-between">
            <div className="ta-title">Direct reports ({reports.length})</div>
          </div>
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
    </div>
  );
}
