import React, { useState } from "react";
import { TopBar, StatCard, ProgressBar, Tag } from "../components/PlatformUI.jsx";
import { Plus, Users, Layers, BookOpen, GraduationCap, Target, UserCheck, Mail, Flag, MoreHorizontal, AlertTriangle, ChevronRight, Star, CalendarClock, Lock } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchOrgDashboardStats, fetchTodaysTasks, fetchCohortProgressSummary, fetchStudentRiskList, fetchTopMentors, fetchUpcomingOrgSessions, fetchOrganizationById } from "../../lib/api/platform.js";

export function AdminDashboardScreen({ orgId, profileQuery, setScreen, orgSelector, isPlatformOwner }) {
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const orgQuery = useSupabaseQuery(async () => orgId ? fetchOrganizationById(orgId) : null, [orgId]);
  const statsQuery = useSupabaseQuery(async () => orgId ? fetchOrgDashboardStats(orgId) : null, [orgId]);
  const tasksQuery = useSupabaseQuery(async () => orgId ? fetchTodaysTasks(orgId) : null, [orgId]);
  const cohortProgressQuery = useSupabaseQuery(async () => orgId ? fetchCohortProgressSummary(orgId) : [], [orgId]);
  const riskQuery = useSupabaseQuery(async () => orgId ? fetchStudentRiskList(orgId) : [], [orgId]);
  const mentorsQuery = useSupabaseQuery(async () => orgId ? fetchTopMentors(orgId) : [], [orgId]);
  const sessionsQuery = useSupabaseQuery(async () => orgId ? fetchUpcomingOrgSessions(orgId) : [], [orgId]);

  // The real fix behind "organizations have to pay to see the admin
  // dashboard" - previously nothing checked this at all; self-serve
  // signup left every organization on 'trial' status forever with full
  // access. See 0114_organization_subscription_payment.sql and
  // SettingsHubScreen.jsx's Billing & Plan card, which is where this leads.
  // Platform Owner exemption: Section 4 of the Multi-Tenant Architecture
  // Reference lists "cross-tenant visibility" as a Platform Owner
  // capability with no carve-out for a tenant's payment status - the whole
  // point of this layer is to see and manage every org, including ones
  // still on a trial. Without this check, a super_admin clicking "View" on
  // a trial-status org (e.g. any of the seeded demo orgs) would hit the
  // exact same paywall a real, unpaid tenant sees - which would make it
  // impossible to review or manage a trial org before it converts.
  if (!isPlatformOwner && orgId && !orgQuery.loading && orgQuery.data && orgQuery.data.status !== "active") {
    return (
      <div className="ta-fade">
        <TopBar title="Dashboard" sub="Your organization dashboard" orgSelector={orgSelector} />
        <div className="ta-content">
          <div className="ta-card" style={{ textAlign: "center", padding: 48, maxWidth: 480, margin: "40px auto" }}>
            <Lock size={32} style={{ opacity: 0.4, marginBottom: 12 }} />
            <div style={{ fontWeight: 700, fontSize: 16 }}>Activate your organization to unlock the dashboard</div>
            <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 8, lineHeight: 1.5 }}>
              {orgQuery.data.name || "Your organization"} is on a trial with no active plan yet. Choose Starter or Growth to unlock the full admin dashboard, or talk to us about Enterprise.
            </div>
            <button className="ta-btn ta-btn-primary ta-mt16" onClick={() => setScreen && setScreen("settings")}>
              Choose a plan
            </button>
          </div>
        </div>
      </div>
    );
  }


  const totalUsers = statsQuery.data ? (statsQuery.data.activeStudents + statsQuery.data.mentors + statsQuery.data.otherUsers) : 0;
  const orgStats = statsQuery.data ? [
    {
      label: "Total users", value: totalUsers, icon: Users,
      // Real breakdown, not just a raw total - "total users, which has
      // total learners, instructors and other users (managers/other
      // admin)" - confirmed directly, built from the same real counts
      // already used by the other cards below, not a separate estimate.
      sub: `${statsQuery.data.activeStudents} learners - ${statsQuery.data.mentors} instructors - ${statsQuery.data.otherUsers} other`,
    },
    { label: "Active students", value: statsQuery.data.activeStudents, icon: Users },
    { label: "Ongoing cohorts", value: statsQuery.data.cohorts, icon: Layers },
    { label: "Total courses", value: statsQuery.data.courses, icon: BookOpen },
    { label: "Total instructors", value: statsQuery.data.mentors, icon: GraduationCap },
    { label: "Completion rate", value: `${statsQuery.data.completionRate}%`, icon: Target },
  ] : [];

  const todaysTasks = tasksQuery.data ? [
    { label: "Instructor applications to review", count: tasksQuery.data.mentorApplications, icon: UserCheck, tone: "primary", go: "people" },
    { label: "Pending invitations", count: tasksQuery.data.pendingInvitations, icon: Mail, tone: "warning", go: "people" },
    { label: "Content awaiting moderation", count: tasksQuery.data.moderationQueue, icon: Flag, tone: "danger", go: "moderation" },
  ] : [];

  return (
    <div className="ta-fade">
      <TopBar
        title={`Hello, ${profileQuery.data?.display_name?.split(" ")[0] || "there"}`}
        sub="Your organization dashboard"
        orgSelector={orgSelector}
        profileQuery={profileQuery}
        onNavigate={setScreen}
        right={
          <div style={{ position: "relative" }}>
            <button className="ta-btn ta-btn-primary" onClick={() => setQuickActionOpen(v => !v)}>
              <Plus size={15} /> Quick action
            </button>
            {quickActionOpen && (
              <div className="ta-card anim-slide-down" style={{ position: "absolute", top: 48, right: 0, width: 210, padding: 8, zIndex: 50 }}>
                {[
                  { label: "Invite a user", go: () => setScreen("people") },
                  { label: "Create a course", go: () => setScreen("content") },
                  { label: "New cohort", go: () => setScreen("cohorts") },
                ].map(a => (
                  <div key={a.label} className="ta-nav-item" onClick={() => { a.go(); setQuickActionOpen(false); }}>
                    {a.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        }
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {!orgId && !profileQuery.loading && (
          <div className="ta-empty">No organization on your profile yet. Join or create one to see live stats.</div>
        )}

        {/* Primary KPI Grid Composition */}
        {statsQuery.loading ? (
          <div className="ta-empty">Loading organization stats...</div>
        ) : (
          <div className="ta-grid ta-grid-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            {orgStats.map(s => <StatCard key={s.label} stat={s} />)}
          </div>
        )}

        {/* Asymmetric 2-Column Dashboard Layout Architecture */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 24, alignItems: "start" }}>
          {/* Main Left Workspace Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Today's Tasks Section */}
            <div className="ta-card">
              <div className="ta-row ta-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="ta-title">Today's tasks</div>
                  <div className="ta-sub" style={{ marginTop: 2, fontSize: 12 }}>Items requiring administrator action</div>
                </div>
                <MoreHorizontal size={16} color="var(--text-3)" />
              </div>
              <div className="ta-col ta-gap10 ta-mt16 anim-stagger">
                {tasksQuery.loading && <div className="ta-empty">Loading...</div>}
                {!tasksQuery.loading && todaysTasks.length === 0 && (
                  <div className="ta-empty">Nothing needs your attention today.</div>
                )}
                {todaysTasks.map(t => {
                  const Icon = t.icon;
                  return (
                    <div
                      key={t.label}
                      className="ta-row ta-between"
                      style={{
                        padding: "12px 14px",
                        background: "var(--surface-3)",
                        borderRadius: 12,
                        cursor: "pointer",
                        border: "1px solid var(--border)",
                        transition: "all 0.15s ease",
                      }}
                      onClick={() => setScreen(t.go)}
                    >
                      <div className="ta-row ta-gap12">
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)" }}>
                          <Icon size={16} color="var(--primary)" />
                        </div>
                        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t.label}</span>
                      </div>
                      <div className="ta-row ta-gap8">
                        <Tag tone={t.tone === "danger" ? "danger" : t.tone === "warning" ? "warning" : undefined}>
                          {t.count}
                        </Tag>
                        <ChevronRight size={15} color="var(--text-3)" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Batch Progress Section */}
            <div className="ta-card">
              <div className="ta-row ta-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="ta-title">Cohort progress</div>
                  <div className="ta-sub" style={{ marginTop: 2, fontSize: 12 }}>Cohort milestone & completion tracking</div>
                </div>
                <span className="ta-body" style={{ fontSize: 12 }}>All cohorts</span>
              </div>
              <div className="ta-col ta-gap16 ta-mt16 anim-stagger">
                {cohortProgressQuery.loading && <div className="ta-empty">Loading...</div>}
                {!cohortProgressQuery.loading && (cohortProgressQuery.data || []).length === 0 && (
                  <div className="ta-empty">No cohorts yet.</div>
                )}
                {(cohortProgressQuery.data || []).map(c => (
                  <div key={c.name} style={{ background: "var(--surface-3)", padding: 12, borderRadius: 12, border: "1px solid var(--border)" }}>
                    <div className="ta-row ta-between" style={{ fontSize: 13, marginBottom: 8 }}>
                      <span style={{ fontWeight: 700 }}>{c.name}</span>
                      <span style={{ color: "var(--primary)", fontWeight: 700 }}>{c.progress}%</span>
                    </div>
                    <ProgressBar value={c.progress} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Side Monitoring Panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Student Risk Monitor */}
            <div className="ta-card">
              <div className="ta-row ta-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="ta-title">Learner risk monitor</div>
                  <div className="ta-sub" style={{ marginTop: 2, fontSize: 12 }}>Early warnings & drop-off alerts</div>
                </div>
                <AlertTriangle size={16} color="var(--warning)" />
              </div>
              <div className="ta-col ta-gap12 ta-mt16 anim-stagger">
                {riskQuery.loading && <div className="ta-empty">Loading...</div>}
                {!riskQuery.loading && (riskQuery.data || []).length === 0 && (
                  <div className="ta-empty">No at-risk students right now.</div>
                )}
                {(riskQuery.data || []).map(s => (
                  <div key={s.name} className="ta-row ta-between" style={{ padding: "11px 12px", background: "var(--surface-3)", borderRadius: 12, border: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 2 }}>
                        {s.days === "N/A" ? "No recent activity on record" : `Inactive for ${s.days} day${s.days === 1 ? "" : "s"}`}
                      </div>
                    </div>
                    <Tag tone={s.risk === "high" ? "danger" : "warning"}>{s.risk}</Tag>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Mentors */}
            <div className="ta-card">
              <div className="ta-row ta-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="ta-title">Top instructors</div>
                  <div className="ta-sub" style={{ marginTop: 2, fontSize: 12 }}>Highest-rated active instructors in your org</div>
                </div>
                <Star size={16} color="var(--warning)" />
              </div>
              <div className="ta-col ta-gap12 ta-mt16 anim-stagger">
                {mentorsQuery.loading && <div className="ta-empty">Loading...</div>}
                {!mentorsQuery.loading && (mentorsQuery.data || []).length === 0 && (
                  <div className="ta-empty">No active instructors yet.</div>
                )}
                {(mentorsQuery.data || []).map(m => (
                  <div key={m.name} className="ta-row ta-between" style={{ padding: "11px 12px", background: "var(--surface-3)", borderRadius: 12, border: "1px solid var(--border)" }}>
                    <div className="ta-row ta-gap10">
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, border: "1px solid var(--border)" }}>
                        {m.initials}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-2)" }}>{m.sessions} session{m.sessions === 1 ? "" : "s"}</div>
                      </div>
                    </div>
                    <Tag tone="success"><Star size={11} /> {m.rating.toFixed(1)}</Tag>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Sessions */}
            <div className="ta-card">
              <div className="ta-row ta-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="ta-title">Upcoming sessions</div>
                  <div className="ta-sub" style={{ marginTop: 2, fontSize: 12 }}>Live & confirmed instructor sessions</div>
                </div>
                <CalendarClock size={16} color="var(--text-3)" />
              </div>
              <div className="ta-col ta-gap12 ta-mt16 anim-stagger">
                {sessionsQuery.loading && <div className="ta-empty">Loading...</div>}
                {!sessionsQuery.loading && (sessionsQuery.data || []).length === 0 && (
                  <div className="ta-empty">No upcoming sessions scheduled.</div>
                )}
                {(sessionsQuery.data || []).map((s, i) => (
                  <div key={i} className="ta-row ta-between" style={{ padding: "11px 12px", background: "var(--surface-3)", borderRadius: 12, border: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{s.title}</div>
                      <div style={{ fontSize: 11, color: "var(--text-2)" }}>{s.mentor} • {s.time}</div>
                    </div>
                    <Tag tone={s.status === "live" ? "danger" : undefined}>{s.status}</Tag>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
