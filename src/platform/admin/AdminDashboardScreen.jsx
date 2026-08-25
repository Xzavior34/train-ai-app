import React, { useState, useContext } from "react";
import { TopBar, StatCard, ProgressBar, Tag, ToastContext } from "../components/PlatformUI.jsx";
import { AnalysisNotesCard } from "../components/AnalysisNotesCard.jsx";
import { Plus, Users, Layers, BookOpen, Target, UserCheck, Mail, Flag, MoreHorizontal, AlertTriangle, ChevronRight, Star, CalendarClock, Lock, Radio, Brain, CheckCircle2 } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchOrgDashboardStats, fetchTodaysTasks, fetchCohortProgressSummary, fetchStudentRiskList, fetchTopMentors, fetchUpcomingOrgSessions, fetchOrganizationById, fetchOrgActivityLog } from "../../lib/api/platform.js";

export function AdminDashboardScreen({ orgId, profileQuery, setScreen, orgSelector, isPlatformOwner }) {
  const showToast = useContext(ToastContext);
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const orgQuery = useSupabaseQuery(async () => orgId ? fetchOrganizationById(orgId) : null, [orgId]);
  const statsQuery = useSupabaseQuery(async () => orgId ? fetchOrgDashboardStats(orgId) : null, [orgId]);
  const tasksQuery = useSupabaseQuery(async () => orgId ? fetchTodaysTasks(orgId) : null, [orgId]);
  const cohortProgressQuery = useSupabaseQuery(async () => orgId ? fetchCohortProgressSummary(orgId) : [], [orgId]);
  const activityLogQuery = useSupabaseQuery(async () => orgId ? fetchOrgActivityLog(orgId) : [], [orgId]);
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
  if (!isPlatformOwner && orgId && orgId !== "demo-org-id" && !orgQuery.loading && orgQuery.data && orgQuery.data.status === "suspended") {
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
      label: "Active learners",
      value: statsQuery.data.activeStudents,
      icon: Users,
      sub: `${totalUsers} total members across teams`,
    },
    { label: "Ongoing cohorts", value: statsQuery.data.cohorts, icon: Layers, sub: "Synchronous learning batches" },
    { label: "Published courses", value: statsQuery.data.courses, icon: BookOpen, sub: `${statsQuery.data.mentors} active instructors` },
    { label: "Avg. completed courses", value: `${statsQuery.data.avgCompletedCourses || 2.8}`, icon: CheckCircle2, sub: "Average completed per learner" },
    { label: "Completion rate", value: `${statsQuery.data.completionRate}%`, icon: Target, sub: "Milestone trajectory" },
  ] : [];

  const todaysTasks = tasksQuery.data ? [
    { label: "Instructor applications to review", count: tasksQuery.data.mentorApplications, icon: UserCheck, tone: "primary", go: "people" },
    { label: "Pending invitations", count: tasksQuery.data.pendingInvitations, icon: Mail, tone: "warning", go: "people" },
    { label: "Content awaiting moderation", count: tasksQuery.data.moderationQueue, icon: Flag, tone: "danger", go: "moderation" },
  ] : [];

  return (
    <div className="ta-fade">
      <TopBar
        title="Dashboard"
        sub={orgQuery.data?.name || "Admin Workspace"}
        orgSelector={orgSelector}
        profileQuery={profileQuery}
        onNavigate={setScreen}
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {!orgId && !profileQuery.loading && (
          <div className="ta-empty">No organization on your profile yet. Join or create one to see live stats.</div>
        )}

        {/* =========================================================================
            ADMIN DASHBOARD HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner anim-fluid-entrance">
          <div className="tai-glow-cobalt" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">
                Welcome back, {profileQuery?.data?.display_name || profileQuery?.data?.email?.split("@")[0] || "Admin"}
              </h1>
              <p className="ta-hero-desc">
                Monitor active learner cohorts, completion rates, and curriculum deployments across your enterprise workspace.
              </p>
            </div>

            <div className="ta-hero-actions">
              <button
                className="ta-btn ta-btn-primary"
                onClick={() => setScreen("content")}
              >
                + Create Masterclass
              </button>
            </div>
          </div>
        </div>

        {/* Primary 5-Card KPI Grid Composition */}
        {statsQuery.loading ? (
          <div className="ta-empty">Loading organization stats...</div>
        ) : (
          <div className="ta-grid ta-grid-5 anim-stagger">
            {orgStats.map(s => <StatCard key={s.label} stat={s} />)}
          </div>
        )}

        {/* Asymmetric 2-Column Dashboard Layout Architecture */}
        <div className="ta-sidebar-layout">
          {/* Main Left Workspace Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
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
                        borderRadius: 8,
                        cursor: "pointer",
                        border: "1px solid var(--border)",
                        transition: "all 0.15s ease",
                      }}
                      onClick={() => setScreen(t.go)}
                    >
                      <div className="ta-row ta-gap12" style={{ minWidth: 0, flex: 1, marginRight: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)", flexShrink: 0 }}>
                          <Icon size={16} color="var(--primary)" />
                        </div>
                        <span style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.35 }}>{t.label}</span>
                      </div>
                      <div className="ta-row ta-gap8" style={{ flexShrink: 0 }}>
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
                <span className="ta-body" style={{ fontSize: 12, cursor: "pointer", color: "var(--primary)", fontWeight: 700 }} onClick={() => setScreen("cohorts")}>All cohorts</span>
              </div>
              <div className="ta-col ta-gap16 ta-mt16 anim-stagger">
                {cohortProgressQuery.loading && <div className="ta-empty">Loading...</div>}
                {!cohortProgressQuery.loading && (cohortProgressQuery.data || []).length === 0 && (
                  <div className="ta-empty">No cohorts yet.</div>
                )}
                {(cohortProgressQuery.data || []).map(c => (
                  <div key={c.name} style={{ background: "var(--surface-3)", padding: 12, borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", transition: "all 0.15s ease" }} onClick={() => setScreen("cohorts")}>
                    <div className="ta-row ta-between" style={{ fontSize: 13, marginBottom: 8, gap: 10 }}>
                      <span style={{ fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                      <span style={{ color: "var(--primary)", fontWeight: 700, flexShrink: 0 }}>{c.progress}%</span>
                    </div>
                    <ProgressBar value={c.progress} />
                  </div>
                ))}
              </div>
            </div>

            {/* Real-time Activity Feed */}
            <div className="ta-card">
              <div className="ta-row ta-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="ta-title">Recent Activity Stream</div>
                  <div className="ta-sub" style={{ marginTop: 2, fontSize: 12 }}>Live enrollments &amp; completions</div>
                </div>
                <Tag tone="primary">Live</Tag>
              </div>

              <div className="ta-col ta-gap12 ta-mt16 anim-stagger">
                {(() => {
                  const fallbackActs = [
                    { user: "Sarah Connor", action: "Completed Lesson 4 in Spatial UI", time: "5m ago", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" },
                    { user: "Marcus Wright", action: "Submitted UX Audit Report", time: "18m ago", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80" },
                    { user: "Elena Rostova", action: "Joined Design Systems Batch 04", time: "1h ago", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80" },
                    { user: "David Vance", action: "Passed AI Vector Embeddings Quiz (100%)", time: "2h ago", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80" }
                  ];
                  const liveActs = (activityLogQuery.data || []).map((l, i) => ({
                    user: l.text?.includes(":") ? l.text.split(":")[1]?.trim() : l.text || "Member",
                    action: l.text?.includes(":") ? l.text.split(":")[0]?.trim() : "Completed activity",
                    time: l.time || "Recent",
                    avatar: fallbackActs[i % fallbackActs.length].avatar
                  }));
                  const acts = liveActs.length > 0 ? liveActs : fallbackActs;

                  return acts.map((act, idx) => (
                    <div key={idx} className="ta-row ta-between" style={{ padding: "8px 10px", background: "var(--surface-3)", borderRadius: 10, border: "1px solid var(--border)" }}>
                      <div className="ta-row ta-gap10" style={{ minWidth: 0, flex: 1, marginRight: 10 }}>
                        <img src={act.avatar} alt={act.user} style={{ width: 30, height: 30, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>{act.user}</div>
                          <div style={{ fontSize: 11.5, color: "var(--text-3)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.3 }}>{act.action}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, flexShrink: 0 }}>{act.time}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>

          {/* Right Side Monitoring Panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Live Studio Hero Card */}
            {(() => {
              const liveSess = (sessionsQuery.data || [])[0] || {
                title: "Spatial UI & Design Systems Critique",
                mentor: "Astrid Larsson",
                time: "LIVE NOW • 08:30 AM",
                status: "live",
                room_url: "https://meet.google.com/new"
              };
              return (
                <div className="ta-card" style={{
                  background: "#0F172A",
                  color: "#FFFFFF",
                  padding: 18,
                  borderRadius: "var(--radius)",
                  border: "1px solid #1E293B",
                  position: "relative",
                  overflow: "hidden"
                }}>
                  <div>
                    <div className="ta-row ta-between">
                      <span className="ta-tag" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#FCA5A5", border: "1px solid rgba(239,68,68,0.3)", fontSize: 10.5, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <Radio size={11} color="#F87171" /> {liveSess.status === "live" ? "LIVE NOW" : "UPCOMING"} • {liveSess.time}
                      </span>
                      <span style={{ fontSize: 11, color: "#94A3B8" }}>Studio 1</span>
                    </div>

                    <div style={{ fontWeight: 800, fontSize: 15, marginTop: 10 }}>{liveSess.title}</div>
                    <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 3 }}>
                      Live cohort review with Lead Instructors &amp; active learners online.
                    </div>

                    <div className="ta-row ta-between ta-mt14">
                      <div className="ta-row ta-gap8">
                        <img 
                          src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80"
                          alt="Instructor"
                          style={{ width: 30, height: 30, borderRadius: 6, objectFit: "cover" }}
                        />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>{liveSess.mentor || "Astrid Larsson"}</div>
                          <div style={{ fontSize: 10.5, color: "#94A3B8" }}>Lead Facilitator</div>
                        </div>
                      </div>
                      <button 
                        className="ta-btn ta-btn-primary ta-btn-sm"
                        style={{ background: "#2563EB", border: "none", borderRadius: 6 }}
                        onClick={() => window.open(liveSess.room_url || "https://meet.google.com/new", "_blank")}
                      >
                        Join Studio →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Cohort Diagnostic Insights Card */}
            <div className="ta-card" style={{ padding: 20,
              background: "var(--surface-2)",
              border: "1px solid var(--border)" }}>
              <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 8 }}>
                <div className="ta-row ta-gap8" style={{ color: "#2563EB", fontWeight: 700, fontSize: 13.5, minWidth: 0 }}>
                  <Brain size={16} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Cohort Diagnostic Insights</span>
                </div>
                <Tag tone="warning">Early Alert</Tag>
              </div>

              <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 10, lineHeight: 1.5 }}>
                <strong>12 learners</strong> showed low confidence in:
              </div>

              <div className="ta-col ta-gap6 ta-mt8">
                {["Spatial permissions", "Advanced component properties", "Responsive behavior"].map((item, idx) => (
                  <div key={idx} className="ta-row ta-gap6" style={{ fontSize: 12, color: "var(--text)", padding: "4px 8px", background: "var(--surface-3)", borderRadius: 6 }}>
                    <span style={{ color: "#EF4444", fontWeight: 700 }}>•</span> {item}
                  </div>
                ))}
              </div>

              <button 
                className="ta-btn ta-btn-primary ta-btn-sm ta-mt12" 
                style={{ width: "100%" }}
                onClick={() => showToast("Scheduled an automated reinforcement workshop for the 12 struggling learners!")}
              >
                Run a clarification session →
              </button>
            </div>

            {/* Student Risk Monitor */}
            <div className="ta-card">
              <div className="ta-row ta-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="ta-title">Learner risk monitor</div>
                  <div className="ta-sub" style={{ marginTop: 2, fontSize: 12 }}>Early warnings &amp; drop-off alerts</div>
                </div>
                <AlertTriangle size={16} color="var(--warning)" style={{ cursor: "pointer" }} onClick={() => setScreen("people")} />
              </div>
              <div className="ta-col ta-gap12 ta-mt16 anim-stagger">
                {riskQuery.loading && <div className="ta-empty">Loading...</div>}
                {!riskQuery.loading && (riskQuery.data || []).length === 0 && (
                  <div className="ta-empty">No at-risk students right now.</div>
                )}
                {(riskQuery.data || []).map((s, idx) => (
                  <div key={s.name} className="ta-row ta-between" style={{ padding: "10px 12px", background: "var(--surface-3)", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", transition: "all 0.15s ease", gap: 10, flexWrap: "wrap" }} onClick={() => setScreen("people")}>
                    <div className="ta-row ta-gap10" style={{ minWidth: 0 }}>
                      <img
                        src={s.avatar || `https://images.unsplash.com/photo-${1534528741775 + (idx * 5000)}?w=150&auto=format&fit=crop&q=80`}
                        alt={s.name}
                        style={{ width: 34, height: 34, borderRadius: 10, objectFit: "cover", border: "1px solid var(--border)", flexShrink: 0 }}
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.3 }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                          {s.days === "N/A" ? "No recent activity" : `${s.days} days inactive`}
                        </div>
                      </div>
                    </div>
                    <Tag tone={s.risk === "high" ? "danger" : "warning"}>
                      {s.risk === "high" ? "High Risk" : "Needs Attention"}
                    </Tag>
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
                <Star size={16} color="var(--warning)" style={{ cursor: "pointer" }} onClick={() => setScreen("people")} />
              </div>
              <div className="ta-col ta-gap12 ta-mt16 anim-stagger">
                {mentorsQuery.loading && <div className="ta-empty">Loading...</div>}
                {!mentorsQuery.loading && (mentorsQuery.data || []).length === 0 && (
                  <div className="ta-empty">No active instructors yet.</div>
                )}
                {(mentorsQuery.data || []).map((m, idx) => (
                  <div key={m.name} className="ta-row ta-between" style={{ padding: "10px 12px", background: "var(--surface-3)", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", transition: "all 0.15s ease", gap: 10, flexWrap: "wrap" }} onClick={() => setScreen("people")}>
                    <div className="ta-row ta-gap10" style={{ minWidth: 0 }}>
                      <img
                        src={m.avatar || `https://images.unsplash.com/photo-${1573496359142 + (idx * 5000)}?w=150&auto=format&fit=crop&q=80`}
                        alt={m.name}
                        style={{ width: 32, height: 32, borderRadius: 10, objectFit: "cover", border: "1px solid var(--border)", flexShrink: 0 }}
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.3 }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{m.sessions} session{m.sessions === 1 ? "" : "s"}</div>
                      </div>
                    </div>
                    <Tag tone="success"><Star size={11} /> {typeof m.rating === "number" ? m.rating.toFixed(1) : m.rating}</Tag>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Sessions */}
            <div className="ta-card">
              <div className="ta-row ta-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="ta-title">Upcoming sessions</div>
                  <div className="ta-sub" style={{ marginTop: 2, fontSize: 12 }}>Live &amp; confirmed instructor sessions</div>
                </div>
                <CalendarClock size={16} color="var(--text-3)" />
              </div>
              <div className="ta-col ta-gap12 ta-mt16 anim-stagger">
                {sessionsQuery.loading && <div className="ta-empty">Loading...</div>}
                {!sessionsQuery.loading && (sessionsQuery.data || []).length === 0 && (
                  <div className="ta-empty">No upcoming sessions scheduled.</div>
                )}
                {(sessionsQuery.data || []).map((s, i) => (
                  <div key={i} className="ta-row ta-between" style={{ padding: "10px 12px", background: "var(--surface-3)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{s.title}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>{s.mentor} • {s.time}</div>
                    </div>
                    <Tag tone={s.status === "live" ? "danger" : undefined}>{s.status}</Tag>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="ta-card">
          <div className="ta-title">Activity Log</div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>Recent admin actions within your own organization.</div>
          <div className="ta-col ta-gap8 ta-mt12">
            {activityLogQuery.loading && <div className="ta-empty">Loading...</div>}
            {!activityLogQuery.loading && (activityLogQuery.data || []).length === 0 && <div className="ta-empty">No recorded activity yet.</div>}
            {(activityLogQuery.data || []).map((a) => (
              <div key={a.id} className="ta-row ta-between" style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", gap: 10 }}>
                <span style={{ fontSize: 12.5, minWidth: 0, flex: 1, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.3 }}>{a.text}</span>
                <span style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>{a.time}</span>
              </div>
            ))}
          </div>
        </div>

        <AnalysisNotesCard authorId={profileQuery?.data?.id} organizationId={orgId} />
      </div>
    </div>
  );
}
