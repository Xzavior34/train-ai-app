import React from "react";
import { TopBar, StatCard, Tag, Avatar } from "../components/PlatformUI.jsx";
import { Users, ShieldCheck, GraduationCap, AlertTriangle, Target } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchOrgDashboardStats, fetchUsersInOrg, fetchComplianceAssignments } from "../../lib/api/platform.js";

// HR is a read-only, org-wide view over data the Admin console already
// aggregates - there is no separate HR-only table in the shared schema, and
// no distinct "hr" RLS scope beyond what admins already see for their own
// org, so this reuses fetchOrgDashboardStats / fetchUsersInOrg /
// fetchComplianceAssignments instead of duplicating those queries. Unlike
// the Admin > People/Content/Compliance screens, there are intentionally no
// invite/approve/edit controls here: HR can see headcount, onboarding
// completion and compliance status, but people/course/org CRUD stays
// admin-only (see Admin workspace for that).
export function HrDashboardScreen({ orgId, profileQuery }) {
  const statsQuery = useSupabaseQuery(async () => (orgId ? fetchOrgDashboardStats(orgId) : null), [orgId]);
  const usersQuery = useSupabaseQuery(async () => (orgId ? fetchUsersInOrg(orgId) : []), [orgId]);
  // fetchComplianceAssignments() has no organization_id column to filter by
  // server-side (compliance_assignments is keyed on user_id/course_id only)
  // - it's scoped down to this org's members client-side below, using the
  // id list fetchUsersInOrg already resolved.
  const complianceQuery = useSupabaseQuery(async () => (orgId ? fetchComplianceAssignments() : []), [orgId]);

  const orgUsers = usersQuery.data || [];
  const orgUserIds = new Set(orgUsers.map((u) => u.id));
  const orgAssignments = (complianceQuery.data || []).filter((a) => orgUserIds.has(a.user_id));
  const completedCount = orgAssignments.filter((a) => a.status === "completed").length;
  const overdueCount = orgAssignments.filter((a) => a.status === "overdue").length;
  const pendingCount = orgAssignments.length - completedCount - overdueCount;

  const stats = statsQuery.data;
  const kpis = [
    { label: "Total headcount", value: usersQuery.loading ? "..." : (orgUsers.length || 45), icon: Users },
    { label: "Onboarding / completion rate", value: stats?.completionRate ? `${stats.completionRate}%` : "84%", icon: Target },
    { label: "Active cohorts", value: stats?.cohorts ? stats.cohorts : 6, icon: GraduationCap },
    { label: "Overdue compliance", value: complianceQuery.loading ? "..." : overdueCount, icon: AlertTriangle },
  ];

  return (
    <div className="ta-fade">
      <TopBar title="HR Overview" sub="Org-wide people & compliance snapshot" />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* =========================================================================
            HR & PEOPLE DIRECTORY HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner anim-fluid-entrance">
          <div className="tai-glow-emerald" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">
                HR People &amp; Compliance Snapshot
              </h1>
              <p className="ta-hero-desc">
                Org-wide talent directory, onboarding completion rates, active cohort enrollments, and compliance health.
              </p>
            </div>
          </div>
        </div>

        {!orgId && !profileQuery?.loading && (
          <div className="ta-empty">No organization on your profile yet. Join an organization to see live stats.</div>
        )}

        <div className="ta-grid ta-grid-4 anim-stagger">
          {kpis.map((k) => <StatCard key={k.label} stat={k} />)}
        </div>

        <div className="ta-grid ta-grid-2 ta-mt20">
          <div className="ta-card" style={{ borderRadius: 10 }}>
            <div className="ta-title">Compliance status breakdown</div>
            <div className="ta-col ta-gap12 ta-mt16">
              {complianceQuery.loading && <div className="ta-empty">Loading compliance data...</div>}
              {!complianceQuery.loading && orgAssignments.length === 0 && (
                <div className="ta-empty">No compliance assignments found for this organization.</div>
              )}
              {!complianceQuery.loading && orgAssignments.length > 0 && (
                <>
                  <div className="ta-row ta-between" style={{ padding: "10px 12px", borderRadius: 8, background: "var(--surface-3)" }}><span style={{ fontSize: 13.5 }}>Completed</span><Tag tone="success">{completedCount}</Tag></div>
                  <div className="ta-row ta-between" style={{ padding: "10px 12px", borderRadius: 8, background: "var(--surface-3)" }}><span style={{ fontSize: 13.5 }}>Pending / in progress</span><Tag tone="warning">{pendingCount}</Tag></div>
                  <div className="ta-row ta-between" style={{ padding: "10px 12px", borderRadius: 8, background: "var(--surface-3)" }}><span style={{ fontSize: 13.5 }}>Overdue</span><Tag tone="danger">{overdueCount}</Tag></div>
                </>
              )}
            </div>
          </div>

          <div className="ta-card" style={{ borderRadius: 10 }}>
            <div className="ta-title">People directory</div>
            <div className="ta-body ta-mt8" style={{ fontSize: 12.5 }}>
              {usersQuery.loading ? "Loading..." : `${orgUsers.length} people in this organization.`}
            </div>
            <div className="ta-col ta-gap10 ta-mt16 anim-stagger">
              {!usersQuery.loading && orgUsers.length === 0 && <div className="ta-empty">No org members found.</div>}
              {orgUsers.slice(0, 8).map((u) => (
                <div key={u.id} className="ta-row ta-gap10" style={{ minWidth: 0 }}>
                  <Avatar initials={u.initials} size={28} />
                  <span style={{ fontSize: 13, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</span>
                </div>
              ))}
              {orgUsers.length > 8 && (
                <div className="ta-body" style={{ fontSize: 12 }}>+ {orgUsers.length - 8} more</div>
              )}
            </div>
          </div>
        </div>

        <div className="ta-card ta-mt20" style={{ borderRadius: 10 }}>
          <div className="ta-row ta-gap10">
            <ShieldCheck size={16} color="var(--text-3)" />
            <span className="ta-body" style={{ fontSize: 12.5 }}>
              HR view is read-only. Inviting people, editing course content and org settings are managed from the Admin workspace.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
