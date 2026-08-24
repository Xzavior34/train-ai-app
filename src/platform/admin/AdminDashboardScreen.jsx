import React, { useState, useContext } from "react";
import { TopBar, StatCard, ProgressBar, Tag, ToastContext, Avatar } from "../components/PlatformUI.jsx";
import { DEMO_MODE } from "../../lib/demoMode.js";
import { AnalysisNotesCard } from "../components/AnalysisNotesCard.jsx";
import { Plus, Users, Layers, BookOpen, Target, UserCheck, Mail, Flag, MoreHorizontal, AlertTriangle, ChevronRight, Star, CalendarClock, Lock, Radio, Brain } from "lucide-react";
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
      label: "Active learners",
      value: statsQuery.data.activeStudents,
      icon: Users,
      sub: `${totalUsers} total members across teams`,
    },
    { label: "Ongoing cohorts", value: statsQuery.data.cohorts, icon: Layers, sub: "Synchronous learning batches" },
    { label: "Published courses", value: statsQuery.data.courses, icon: BookOpen, sub: `${statsQuery.data.mentors} active instructors` },
    { label: "Completion rate", value: `${statsQuery.data.completionRate}%`, icon: Target, sub: "Milestone trajectory" },
  ] : [];

  // The "Live Studio" card below used to be an entirely invented in-progress
  // session (fixed title, "Studio 1", "08:30 AM", 24 learners online, a named
  // instructor with a stock headshot). sessionsQuery is the real
  // fetchUpcomingOrgSessions read this component already performed for the
  // Upcoming sessions list; a genuinely live session wins, otherwise the next
  // scheduled one, and with neither the card does not render at all.
  const sessions = sessionsQuery.data || [];
  const featuredSession = sessions.find((s) => s.status === "live" || s.status === "live_now") || sessions[0] || null;
  const featuredIsLive = featuredSession ? (featuredSession.status === "live" || featuredSession.status === "live_now") : false;
  const featuredMentor = featuredSession ? (featuredSession.mentor || featuredSession.mentor_name || "Instructor") : "";
  const featuredWhen = featuredSession
    ? (featuredSession.time || (featuredSession.scheduled_at ? new Date(featuredSession.scheduled_at).toLocaleString() : "Time not set"))
    : "";
  // Real join link where one is stored on the row. The button previously opened
  // https://meet.google.com/new - a brand new empty meeting, not this session.
  const featuredJoinUrl = featuredSession ? (featuredSession.room_url || featuredSession.join_url || null) : null;
  // "12 learners showed low confidence" was a literal repeated in the card and
  // in its toast. This is the real count of learners the risk query flagged.
  const atRiskCount = (riskQuery.data || []).length;

  const todaysTasks = tasksQuery.data ? [
    { label: "Instructor applications to review", count: tasksQuery.data.mentorApplications, icon: UserCheck, tone: "primary", go: "people" },
    { label: "Pending invitations", count: tasksQuery.data.pendingInvitations, icon: Mail, tone: "warning", go: "people" },
    { label: "Content awaiting moderation", count: tasksQuery.data.moderationQueue, icon: Flag, tone: "danger", go: "moderation" },
  ] : [];

  return (
    <div className="ta-fade">
      <TopBar
        title={orgQuery.data?.name || "Dashboard"}
        sub={`Admin workspace • ${profileQuery.data?.display_name || "Admin"}`}
        orgSelector={orgSelector}
        profileQuery={profileQuery}
        onNavigate={setScreen}
        right={
          <div style={{ position: "relative" }}>
            <button
              className="ta-btn ta-btn-primary"
              onClick={() => setQuickActionOpen(v => !v)}
              style={{
                background: "var(--grad)",
                color: "#FFFFFF",
                fontWeight: 700,
                boxShadow: "0 4px 14px rgba(79, 70, 229, 0.32)"
              }}
            >
              <Plus size={15} /> Quick action
            </button>
            {quickActionOpen && (
              <>
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 190 }}
                  onClick={() => setQuickActionOpen(false)}
                />
                <div
                  className="ta-card anim-slide-down"
                  style={{
                    position: "absolute",
                    top: 48,
                    right: 0,
                    width: 220,
                    maxWidth: "calc(100vw - 32px)",
                    padding: "8px 6px",
                    zIndex: 200,
                    boxShadow: "0 14px 36px -8px rgba(15,23,42,0.3)",
                    border: "1px solid var(--border)",
                    background: "var(--surface)"
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="ta-dropdown-item ta-row ta-gap10" style={{ padding: "9px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }} onClick={() => { setScreen("content"); setQuickActionOpen(false); }}>
                    <BookOpen size={15} color="var(--primary)" />
                    <span>Create Masterclass</span>
                  </div>
                  <div className="ta-dropdown-item ta-row ta-gap10" style={{ padding: "9px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }} onClick={() => { setScreen("cohorts"); setQuickActionOpen(false); }}>
                    <Layers size={15} color="var(--primary)" />
                    <span>Create Cohort</span>
                  </div>
                  <div className="ta-dropdown-item ta-row ta-gap10" style={{ padding: "9px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }} onClick={() => { setScreen("people"); setQuickActionOpen(false); }}>
                    <Users size={15} color="var(--primary)" />
                    <span>Invite Members</span>
                  </div>
                </div>
              </>
            )}
          </div>
        }
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {!orgId && !profileQuery.loading && (
          <div className="ta-empty">No organization on your profile yet. Join or create one to see live stats.</div>
        )}

        {/* =========================================================================
            ADMIN DASHBOARD HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner">
          {/* Background Stock Photo with Overlay */}
          <img
            src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1400&auto=format&fit=crop&q=85"
            alt=""
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "cover", opacity: 0.35, zIndex: 0
            }}
          />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(100deg, rgba(15,23,42,0.96) 0%, rgba(30,27,75,0.82) 55%, rgba(15,23,42,0.65) 100%)",
            zIndex: 0
          }} />

          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">
                Welcome back, {profileQuery.data?.display_name || "Admin"}
              </h1>
              <p className="ta-hero-desc">
                Monitor active learner cohorts, completion rates, and curriculum deployments.
              </p>
            </div>

            <div className="ta-hero-actions">
              <button
                className="ta-btn ta-btn-primary"
                onClick={() => setScreen("content")}
                style={{
                  background: "#4F46E5", color: "#FFFFFF", fontWeight: 800,
                  boxShadow: "0 4px 14px rgba(79, 70, 229, 0.4)"
                }}
              >
                + Create Masterclass
              </button>
            </div>
          </div>
        </div>

        {/* Primary 4-Card KPI Grid Composition */}
        {statsQuery.loading ? (
          <div className="ta-empty">Loading organization stats...</div>
        ) : (
          <div className="ta-grid ta-grid-4 anim-stagger">
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
                        borderRadius: 12,
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
                  <div key={c.name} style={{ background: "var(--surface-3)", padding: 12, borderRadius: 12, border: "1px solid var(--border)", cursor: "pointer", transition: "all 0.15s ease" }} onClick={() => setScreen("cohorts")}>
                    <div className="ta-row ta-between" style={{ fontSize: 13, marginBottom: 8, gap: 10 }}>
                      <span style={{ fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                      <span style={{ color: "var(--primary)", fontWeight: 700, flexShrink: 0 }}>{c.progress}%</span>
                    </div>
                    <ProgressBar value={c.progress} />
                  </div>
                ))}
              </div>
            </div>

            {/* Recent activity. This card was badged "Live" over four hardcoded
                people with stock avatars and timestamps that never moved, while
                the real fetchOrgActivityLog result this component already fetches
                (activityLogQuery) was only rendered further down the page. It now
                shows the five most recent real entries from that same query.
                Those rows are audit records of admin actions - they carry no per
                person avatar, so no image is synthesized for them. */}
            <div className="ta-card">
              <div className="ta-row ta-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="ta-title">Recent Activity Stream</div>
                  <div className="ta-sub" style={{ marginTop: 2, fontSize: 12 }}>Most recent recorded actions in this organization</div>
                </div>
                <Tag tone="primary">{(activityLogQuery.data || []).length}</Tag>
              </div>

              <div className="ta-col ta-gap12 ta-mt16 anim-stagger">
                {activityLogQuery.loading && <div className="ta-empty">Loading activity...</div>}
                {!activityLogQuery.loading && (activityLogQuery.data || []).length === 0 && (
                  <div className="ta-empty">No recorded activity in this organization yet.</div>
                )}
                {(activityLogQuery.data || []).slice(0, 5).map((act) => (
                  <div key={act.id} className="ta-row ta-between" style={{ padding: "8px 10px", background: "var(--surface-3)", borderRadius: 10, border: "1px solid var(--border)" }}>
                    <div className="ta-row ta-gap10" style={{ minWidth: 0, flex: 1, marginRight: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Radio size={13} color="var(--primary)" />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.3 }}>{act.text}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, flexShrink: 0 }}>{act.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Side Monitoring Panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Live Studio Hero Card - real session from sessionsQuery, hidden
                entirely when this organization has no live or upcoming session
                rather than showing an invented one. */}
            {featuredSession && (
            <div className="ta-card" style={{
              background: "linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,27,75,0.92) 100%)",
              color: "#FFFFFF",
              padding: 20,
              borderRadius: 16,
              border: "1px solid rgba(99, 102, 241, 0.4)",
              boxShadow: "0 10px 24px -4px rgba(15, 23, 42, 0.35)",
              position: "relative",
              overflow: "hidden"
            }}>
              <img
                src="https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&auto=format&fit=crop&q=80"
                alt=""
                style={{
                  position: "absolute", inset: 0, width: "100%", height: "100%",
                  objectFit: "cover", opacity: 0.22, zIndex: 0
                }}
              />
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(105deg, rgba(15,23,42,0.95) 0%, rgba(30,27,75,0.78) 100%)",
                zIndex: 0
              }} />

              <div style={{ position: "relative", zIndex: 1 }}>
                <div className="ta-row ta-between">
                  <span className="ta-tag" style={{ background: featuredIsLive ? "rgba(239, 68, 68, 0.25)" : "rgba(99, 102, 241, 0.25)", color: featuredIsLive ? "#FCA5A5" : "#C7D2FE", border: featuredIsLive ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(99,102,241,0.4)", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <Radio size={12} color={featuredIsLive ? "#F87171" : "#A5B4FC"} /> {featuredIsLive ? "LIVE NOW" : "NEXT SESSION"} • {featuredWhen}
                  </span>
                </div>

              <div style={{ fontWeight: 800, fontSize: 16, marginTop: 12 }}>{featuredSession.title}</div>
              {/* Room name and "24 learners online" have no source column
                  anywhere in the schema - mentorship_sessions stores no room or
                  attendee count - so that subtitle is only shown with no
                  database connected. */}
              {DEMO_MODE && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
                  Batch 04 live cohort review with Lead Instructors &amp; 24 learners online.
                </div>
              )}

              <div className="ta-row ta-between ta-mt16">
                <div className="ta-row ta-gap8">
                  <Avatar
                    initials={featuredMentor.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    size={32}
                    style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.4)" }}
                  />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>{featuredMentor}</div>
                    <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.65)" }}>Session instructor</div>
                  </div>
                </div>
                {featuredJoinUrl && (
                  <button
                    className="ta-btn ta-btn-primary ta-btn-sm"
                    style={{ background: "#4F46E5", border: "none" }}
                    onClick={() => window.open(featuredJoinUrl, "_blank")}
                  >
                    Join Studio →
                  </button>
                )}
              </div>
            </div>
          </div>
            )}

            {/* Cohort Diagnostic Insights Card */}
            <div className="ta-card" style={{
              padding: 20,
              borderRadius: 16,
              background: "var(--surface-2)",
              border: "1px solid var(--border)"
            }}>
              <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 8 }}>
                <div className="ta-row ta-gap8" style={{ color: "#4F46E5", fontWeight: 700, fontSize: 13.5, minWidth: 0 }}>
                  <Brain size={16} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Cohort Diagnostic Insights</span>
                </div>
                <Tag tone="warning">Early Alert</Tag>
              </div>

              {/* The count was a literal 12, repeated in the CTA's toast. It is
                  now the real number of learners fetchStudentRiskList flagged as
                  inactive for this organization. */}
              <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 10, lineHeight: 1.5 }}>
                {riskQuery.loading
                  ? "Checking learner activity..."
                  : atRiskCount === 0
                    ? <>No learners are currently flagged as falling behind.</>
                    : <><strong>{atRiskCount} learner{atRiskCount === 1 ? "" : "s"}</strong> {atRiskCount === 1 ? "has" : "have"} gone inactive and may need a check-in.</>}
              </div>

              {/* Per-topic confidence has no source anywhere in the schema -
                  nothing records which topics a learner struggled with - so these
                  three topic strings only render with no database connected. */}
              {DEMO_MODE && (
              <div className="ta-col ta-gap6 ta-mt8">
                {["Spatial permissions", "Advanced component properties", "Responsive behavior"].map((item, idx) => (
                  <div key={idx} className="ta-row ta-gap6" style={{ fontSize: 12, color: "var(--text)", padding: "4px 8px", background: "var(--surface-3)", borderRadius: 6 }}>
                    <span style={{ color: "#EF4444", fontWeight: 700 }}>•</span> {item}
                  </div>
                ))}
              </div>
              )}

              {/* The old button claimed it had "scheduled an automated
                  reinforcement workshop for the 12 struggling learners" - it
                  scheduled nothing and there is no API that could. It now goes to
                  the place where these learners can actually be worked with. */}
              <button
                className="ta-btn ta-btn-primary ta-btn-sm ta-mt12"
                style={{ width: "100%" }}
                onClick={() => setScreen("people")}
              >
                Review flagged learners →
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
                {/* The avatar URL used to be built by adding idx*5000 to a
                    hardcoded Unsplash photo id, so each real at-risk learner got
                    a different (mostly 404) stock photo. Real avatar where the
                    row carries one, shared initials Avatar otherwise. */}
                {(riskQuery.data || []).map((s) => (
                  <div key={s.name} className="ta-row ta-between" style={{ padding: "10px 12px", background: "var(--surface-3)", borderRadius: 12, border: "1px solid var(--border)", cursor: "pointer", transition: "all 0.15s ease", gap: 10, flexWrap: "wrap" }} onClick={() => setScreen("people")}>
                    <div className="ta-row ta-gap10" style={{ minWidth: 0 }}>
                      <Avatar
                        initials={s.initials || (s.name || "U").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                        size={34}
                        src={s.avatar || undefined}
                        style={{ borderRadius: 10, border: "1px solid var(--border)" }}
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
                {/* Same index-derived stock-photo URLs as the risk list above -
                    replaced with the row's real avatar or initials. */}
                {(mentorsQuery.data || []).map((m) => (
                  <div key={m.name} className="ta-row ta-between" style={{ padding: "10px 12px", background: "var(--surface-3)", borderRadius: 12, border: "1px solid var(--border)", cursor: "pointer", transition: "all 0.15s ease", gap: 10, flexWrap: "wrap" }} onClick={() => setScreen("people")}>
                    <div className="ta-row ta-gap10" style={{ minWidth: 0 }}>
                      <Avatar
                        initials={m.initials || (m.name || "I").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                        size={32}
                        src={m.avatar || undefined}
                        style={{ borderRadius: 10, border: "1px solid var(--border)" }}
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
                  <div key={i} className="ta-row ta-between" style={{ padding: "10px 12px", background: "var(--surface-3)", borderRadius: 12, border: "1px solid var(--border)" }}>
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
