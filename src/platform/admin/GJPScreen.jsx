import React from "react";
import { TopBar, Tag } from "../components/PlatformUI.jsx";
import { Briefcase } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchGJPApplicants } from "../../lib/api/platform.js";

// GJP (Graduate Job Placement) has no dedicated table in the shared schema —
// it's a real aggregate over user_profiles rows that have a `school` set
// (see fetchGJPApplicants in lib/api/platform.js), joined with recent
// activity for a status proxy. This screen previously rendered `a.role`,
// which fetchGJPApplicants never returns, so every row silently fell back to
// the hardcoded "AI Engineer" — every applicant appeared to be targeting the
// same fake role. Replaced with the applicant's real school/department/level
// and application date, all real columns.
export function GJPScreen({ orgId, orgSelector, setScreen }) {
  const gjpQuery = useSupabaseQuery(async () => orgId ? fetchGJPApplicants(orgId) : [], [orgId]);
  const applicants = gjpQuery.data || [];

  return (
    <div className="ta-fade">
      <TopBar title="Graduation Job Placement (GJP)" sub="Career readiness & candidate placement" orgSelector={orgSelector} onNavigate={setScreen} />
      <div className="ta-content">
        <div className="ta-card">
          <div className="ta-row ta-gap8">
            <Briefcase size={16} color="var(--text-3)" />
            <span className="ta-body" style={{ fontSize: 12.5 }}>
              Applicants are org members with a school on file — the closest real signal available for GJP candidates in this schema.
            </span>
          </div>
          <table className="ta-table ta-mt16">
            <thead><tr><th>Applicant</th><th>School</th><th>Department / Level</th><th>Applied</th><th>Status</th></tr></thead>
            <tbody>
              {gjpQuery.loading && <tr><td colSpan={5} className="ta-empty">Loading GJP applicants...</td></tr>}
              {gjpQuery.error && <tr><td colSpan={5} className="ta-empty">Couldn't load GJP applicants: {gjpQuery.error}</td></tr>}
              {!gjpQuery.loading && !gjpQuery.error && applicants.length === 0 && (
                <tr><td colSpan={5} className="ta-empty">No GJP placement candidates yet.</td></tr>
              )}
              {applicants.map(a => (
                <tr key={a.id}>
                  <td><span style={{ fontWeight: 600 }}>{a.name}</span></td>
                  <td>{a.school || "—"}</td>
                  <td>{[a.department, a.level].filter(Boolean).join(" · ") || "—"}</td>
                  <td style={{ fontSize: 12, color: "var(--text-2)" }}>{a.applied}</td>
                  <td><Tag tone={a.status === "active" ? "success" : "warning"}>{a.status}</Tag></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
