import React, { useState, useContext } from "react";
import { TopBar, StatCard, Tag, ToastContext, Avatar } from "../components/PlatformUI.jsx";
import { DEMO_MODE } from "../../lib/demoMode.js";
import { AnalysisNotesCard } from "../components/AnalysisNotesCard.jsx";
import {
  Users, Layers, CheckCircle2, Calendar, Radio, Star,
  Sparkles, ArrowRight, Video, Clock, AlertTriangle,
  CheckSquare, Square, MessageSquare, ExternalLink, Plus,
  TrendingUp, BookOpen, Brain, DollarSign
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchMentorSessions, fetchMentorEarnings } from "../../lib/api/schemaHelper.js";
import { fetchMentorActiveCohorts, fetchStudentRiskList } from "../../lib/api/platform.js";
import { fetchInstructorPendingReviews } from "../../lib/api/live/mentorLive.js";

export function MentorDashboardScreen({ mentorId, currentUserId, profileQuery, orgId, onNavigate }) {
  const showToast = useContext(ToastContext);
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  // Sample task list. There is no tasks table anywhere in the schema, and
  // fetchTodaysTasks(organizationId) in platform.js is an admin-side counter
  // of mentor applications / pending invitations / moderation items, not a
  // per-instructor to-do list - so nothing can back this. The Add button also
  // only ever pushed to local state and was lost on reload. Kept as sample
  // content, rendered only when no database is connected (see the DEMO_MODE
  // guard on the card below).
  const [tasks, setTasks] = useState([
    { id: 1, text: "Grade Module 3 UI & Wireframe Submissions (8 pending)", done: false, priority: "high" },
    { id: 2, text: "Prepare Figma Workshop Asset Kit for Batch 4", done: true, priority: "normal" },
    { id: 3, text: "1:1 Clarification session with Fatima Diallo", done: false, priority: "high" },
    { id: 4, text: "Upload Spatial UI Design System template to Resources", done: false, priority: "normal" }
  ]);

  const sessionsQuery = useSupabaseQuery(async () => mentorId ? fetchMentorSessions(mentorId) : [], [mentorId]);
  const activeCohortsQuery = useSupabaseQuery(async () => currentUserId ? fetchMentorActiveCohorts(currentUserId) : [], [currentUserId]);
  const earningsQuery = useSupabaseQuery(async () => mentorId ? fetchMentorEarnings(mentorId) : [], [mentorId]);
  // Real learners flagged as inactive in this organization, replacing six
  // hardcoded people ("Fatima Diallo / UI Design Fellow / 12 days ago") each
  // with their own stock Unsplash headshot. Same query the admin dashboard's
  // risk monitor uses.
  const riskQuery = useSupabaseQuery(async () => orgId ? fetchStudentRiskList(orgId) : [], [orgId]);
  // Real pending-review count for the KPI card that used to read "05".
  const pendingReviewsQuery = useSupabaseQuery(async () => currentUserId ? fetchInstructorPendingReviews(currentUserId) : null, [currentUserId]);
  const mentorSessions = sessionsQuery.data || [];
  const activeCohorts = activeCohortsQuery.data || [];
  const activeLearnerCount = new Set(mentorSessions.map((s) => s.learner_id).filter(Boolean)).size;
  const cohortsEndingSoonCount = activeCohorts.filter((c) => c.ends_at && new Date(c.ends_at).getTime() - Date.now() < 14 * 86400000).length;
  // fetchMentorEarnings returns raw mentor_earnings rows, not a pre-aggregated
  // {total, pending} object - sum them here (restored from the earlier
  // reference dashboard, which computed real rating/earnings stats).
  const ratedSessions = mentorSessions.filter((s) => typeof s.rating === "number");
  const avgRating = ratedSessions.length
    ? (ratedSessions.reduce((sum, s) => sum + s.rating, 0) / ratedSessions.length).toFixed(1)
    : null;
  const earningsRows = earningsQuery.data || [];
  const totalEarnings = earningsRows.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const toggleTask = (id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const studentRisks = riskQuery.data || [];
  const highRiskCount = studentRisks.filter((s) => s.risk === "high").length;

  // The "My Schedule" card below was entirely literal: a LIVE NOW hero for
  // "Spatial UI & Design Systems Critique" whose Join button opened
  // https://meet.google.com/demo-room-ai, plus two fixed upcoming rows. The
  // real rows were already being fetched here (sessionsQuery) and used only
  // for a learner count and a rating average. mentorship_sessions carries
  // title / scheduled_at / duration_minutes / meeting_url / status, which is
  // exactly what this card shows.
  const liveSession = mentorSessions.find((s) => s.status === "live" || s.status === "live_now" || s.status === "in_progress") || null;
  const upcomingSessions = mentorSessions
    .filter((s) => s !== liveSession && s.scheduled_at && new Date(s.scheduled_at).getTime() >= Date.now() && s.status !== "cancelled" && s.status !== "completed")
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
    .slice(0, 3);

  const pendingReviews = pendingReviewsQuery.data;

  // Generic fallback: the old default greeted "Hazel", an unrelated
  // real-sounding name, until the real profile loaded.
  const mentorName = profileQuery?.data?.display_name || "Instructor";

  return (
    <div className="ta-fade">
      <TopBar 
        title={`Hello, ${mentorName}`} 
        sub="Track learner engagement, review cohort progress, and launch live sessions." 
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
                    width: 230,
                    maxWidth: "calc(100vw - 32px)",
                    padding: "8px 6px",
                    zIndex: 200,
                    boxShadow: "0 14px 36px -8px rgba(15,23,42,0.3)",
                    border: "1px solid var(--border)",
                    background: "var(--surface)"
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  {[
                    { label: "🔴 Start Live Workshop", go: () => window.open("https://meet.google.com/new", "_blank") },
                    { label: "💬 Message at-risk students", go: () => onNavigate && onNavigate("messages") },
                    { label: "📝 Grade Submissions", go: () => onNavigate && onNavigate("mentees") },
                    { label: "📅 Schedule 1:1 Session", go: () => onNavigate && onNavigate("schedule") }
                  ].map(a => (
                    <div
                      key={a.label}
                      className="ta-dropdown-item"
                      style={{ padding: "9px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                      onClick={() => { a.go(); setQuickActionOpen(false); }}
                    >
                      {a.label}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        }
      />

      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        
        {/* =========================================================================
            INSTRUCTOR WORKSPACE HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner">
          <img
            src="https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1400&auto=format&fit=crop&q=85"
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
                  <BookOpen size={13} color="#A5B4FC" /> INSTRUCTOR STUDIO
                </span>
                <span style={{
                  background: "rgba(16, 185, 129, 0.28)", color: "#A7F3D0",
                  border: "1px solid rgba(16, 185, 129, 0.5)",
                  fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99
                }}>
                  {/* Was a hardcoded "4" while the real count was already in
                      scope from fetchMentorActiveCohorts. */}
                  {activeCohortsQuery.loading ? "…" : activeCohorts.length} ACTIVE COHORT{activeCohorts.length === 1 ? "" : "S"} UNDER MENTORSHIP
                </span>
              </div>

              <h1 className="ta-hero-title">
                Instructor Live Studio &amp; Pacing
              </h1>
              <p className="ta-hero-desc">
                Review student submissions, host office hours, launch interactive clarification sessions, and message struggling learners.
              </p>
            </div>

            <div className="ta-hero-actions">
              {/* This button used to run a setTimeout that wrote nothing and
                  then reported a scheduled workshop. It now goes to the
                  learners list, where cohort progress can actually be worked
                  with. */}
              <button
                className="ta-btn ta-btn-primary"
                onClick={() => onNavigate && onNavigate("mentees")}
                style={{
                  background: "#4F46E5", color: "#FFFFFF", fontWeight: 800,
                  boxShadow: "0 4px 16px rgba(79, 70, 229, 0.4)", display: "flex", alignItems: "center", gap: 8
                }}
              >
                <TrendingUp size={15} /> Review learner progress
              </button>
            </div>
          </div>
        </div>

        {/* Top 4 Balanced KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <div className="ta-card" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16 }}>
            <div className="ta-row ta-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Active Learners</span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(99, 102, 241, 0.12)", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users size={18} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>{sessionsQuery.loading ? "…" : activeLearnerCount}</div>
            <div className="ta-row ta-gap6 ta-mt8" style={{ fontSize: 12, color: "var(--text-2)" }}>
              <span>Across all your sessions</span>
            </div>
          </div>

          <div className="ta-card" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16 }}>
            <div className="ta-row ta-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Active Cohorts</span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(16, 185, 129, 0.12)", color: "#10B981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Layers size={18} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>{activeCohortsQuery.loading ? "…" : String(activeCohorts.length).padStart(2, "0")}</div>
            <div className="ta-row ta-gap6 ta-mt8" style={{ fontSize: 12, color: "var(--text-2)" }}>
              <span>{cohortsEndingSoonCount} finishing soon</span>
            </div>
          </div>

          <div className="ta-card" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16 }}>
            <div className="ta-row ta-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Pending Reviews</span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(245, 158, 11, 0.12)", color: "#F59E0B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle2 size={18} />
              </div>
            </div>
            {/* Was a literal "05 / 3 assignments, 2 reviews". Real counts of
                ungraded assessment attempts and pending certificate requests
                across the courses this instructor owns - see
                fetchInstructorPendingReviews. Zero is shown as zero. */}
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>
              {pendingReviewsQuery.loading ? "…" : String(pendingReviews?.total ?? 0).padStart(2, "0")}
            </div>
            <div className="ta-row ta-gap6 ta-mt8" style={{ fontSize: 12, color: "#F59E0B" }}>
              <span>
                {pendingReviewsQuery.loading
                  ? "Checking your courses..."
                  : `${pendingReviews?.ungradedAttempts ?? 0} ungraded attempts, ${pendingReviews?.pendingCertificates ?? 0} certificate requests`}
              </span>
            </div>
          </div>

          {/* A mentor-scoped engagement rate and a "vs last batch" delta have
              no source anywhere in the schema - nothing records per-instructor
              engagement or a previous batch's figure - so this card only
              renders with no database connected. */}
          {DEMO_MODE && (
          <div className="ta-card" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16 }}>
            <div className="ta-row ta-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Engagement Rate</span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(139, 92, 246, 0.12)", color: "#8B5CF6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <TrendingUp size={18} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>89%</div>
            <div className="ta-row ta-gap6 ta-mt8" style={{ fontSize: 12, color: "var(--success)" }}>
              <span>+4% vs last batch</span>
            </div>
          </div>
          )}

          <div className="ta-card" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16 }}>
            <div className="ta-row ta-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Instructor Rating</span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(245, 158, 11, 0.12)", color: "#F59E0B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Star size={18} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>{sessionsQuery.loading ? "…" : (avgRating ?? "N/A")}</div>
            <div className="ta-row ta-gap6 ta-mt8" style={{ fontSize: 12, color: "var(--text-2)" }}>
              <span>Across rated sessions</span>
            </div>
          </div>

          <div className="ta-card" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16 }}>
            <div className="ta-row ta-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Total Earnings</span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(16, 185, 129, 0.12)", color: "#10B981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <DollarSign size={18} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>{earningsQuery.loading ? "…" : `$${totalEarnings.toFixed(2)}`}</div>
            <div className="ta-row ta-gap6 ta-mt8" style={{ fontSize: 12, color: "var(--text-2)" }}>
              <span>Lifetime instructor earnings</span>
            </div>
          </div>
        </div>

        {/* Asymmetric 2-Column Main Workspace */}
        <div className="ta-sidebar-layout">

          {/* Left Column: Tasks, Batch Progress & AI Learning Insights */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
            
            {/* Today's Tasks - no tasks table exists, and the Add button never
                persisted anything, so this whole card is sample content and
                only renders with no database connected (see the state above). */}
            {DEMO_MODE && (
            <div className="ta-card" style={{ padding: 22, borderRadius: 16 }}>
              <div className="ta-row ta-between" style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="ta-title" style={{ fontSize: 16 }}>Today's Tasks</div>
                  <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>{tasks.filter(t => !t.done).length} priority tasks remaining</div>
                </div>
                <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => setTasks(t => [...t, { id: Date.now(), text: "Review new forum queries", done: false, priority: "normal" }])}>
                  <Plus size={14} /> Add
                </button>
              </div>

              <div className="ta-col ta-gap12 ta-mt16 anim-stagger">
                {tasks.map(t => (
                  <div 
                    key={t.id} 
                    onClick={() => toggleTask(t.id)}
                    style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: 12, 
                      padding: "12px 14px", 
                      borderRadius: 12, 
                      background: t.done ? "var(--surface-2)" : "var(--surface-3)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      opacity: t.done ? 0.65 : 1
                    }}
                  >
                    {t.done ? (
                      <CheckCircle2 size={18} color="#10B981" style={{ flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 18, height: 18, borderRadius: 6, border: "2px solid var(--text-3)", flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: 13, textDecoration: t.done ? "line-through" : "none", color: "var(--text)", flex: 1, fontWeight: t.done ? 400 : 500 }}>
                      {t.text}
                    </span>
                    {t.priority === "high" && !t.done && (
                      <Tag tone="danger">High</Tag>
                    )}
                  </div>
                ))}
              </div>
            </div>
            )}

            {/* Batch Progress */}
            <div className="ta-card" style={{ padding: 22, borderRadius: 16 }}>
              <div className="ta-row ta-between" style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="ta-title" style={{ fontSize: 16 }}>Batch Progress</div>
                  <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Active cohorts under your instruction</div>
                </div>
                <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => onNavigate && onNavigate("cohorts")}>
                  View all
                </button>
              </div>

              <div className="ta-col ta-gap16 ta-mt16 anim-stagger">
                {activeCohortsQuery.loading && <div className="ta-empty">Loading your cohorts...</div>}
                {!activeCohortsQuery.loading && activeCohorts.length === 0 && (
                  <div className="ta-empty">You're not assigned to any active cohorts yet.</div>
                )}
                {activeCohorts.map(c => {
                  const endingSoon = c.ends_at && new Date(c.ends_at).getTime() - Date.now() < 14 * 86400000;
                  return (
                    <div key={c.id} style={{ padding: "14px 16px", borderRadius: 12, background: "var(--surface-3)" }}>
                      <div className="ta-row ta-between">
                        <div className="ta-row ta-gap8" style={{ minWidth: 0 }}>
                          <BookOpen size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                            <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                              {c.starts_at ? new Date(c.starts_at).toLocaleDateString() : "No start date"}{c.ends_at ? ` – ${new Date(c.ends_at).toLocaleDateString()}` : ""}
                            </div>
                          </div>
                        </div>
                        <Tag tone={endingSoon ? "warning" : "primary"}>{endingSoon ? "Finishing soon" : "Active"}</Tag>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cohort Diagnostic Insights & Action Plan */}
            <div className="ta-card" style={{ 
              padding: 22, 
              borderRadius: 16, 
              background: "var(--surface-2)",
              border: "1px solid var(--border)"
            }}>
              <div className="ta-row ta-gap8" style={{ color: "#4F46E5", fontWeight: 700, fontSize: 14 }}>
                <Brain size={18} />
                <span>Cohort Diagnostic &amp; Recommendations</span>
              </div>
              
              {/* Per-module topic gap analysis ("32% of students in Module 3
                  struggled with RAG Architecture and Vector Embeddings") has no
                  source: nothing records which topic a learner struggled with,
                  and no exported function produces this statistic. It only
                  renders with no database connected. */}
              {DEMO_MODE && (
                <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 10, lineHeight: 1.55 }}>
                  Based on recent quiz submissions and assignment grading, <strong>32% of students</strong> in <em>Module 3</em> struggled with <strong>RAG Architecture and Vector Embeddings</strong>. We recommend scheduling a targeted 30-minute clarification workshop.
                </div>
              )}

              {/* Real replacement: the count of learners fetchStudentRiskList
                  flagged as inactive in this organization. */}
              {!DEMO_MODE && (
                <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 10, lineHeight: 1.55 }}>
                  {riskQuery.loading
                    ? "Checking learner activity..."
                    : studentRisks.length === 0
                      ? <>No learners in your organization are currently flagged as falling behind.</>
                      : <><strong>{studentRisks.length} learner{studentRisks.length === 1 ? "" : "s"}</strong> {studentRisks.length === 1 ? "has" : "have"} gone inactive and may need a clarification session or a direct check-in.</>}
                </div>
              )}

              {/* Both buttons previously reported completed work that never
                  happened - one showed "Workshop scheduled and invitations
                  broadcasted to 24 affected learners" from a setTimeout that
                  wrote nothing, the other toasted that a study guide had been
                  "generated and synced". They now go to the screens where those
                  things are actually done. */}
              <div className="ta-row ta-gap10 ta-mt16" style={{ flexWrap: "wrap" }}>
                <button
                  className="ta-btn ta-btn-primary ta-btn-sm"
                  onClick={() => onNavigate && onNavigate("schedule")}
                >
                  Schedule a clarification session
                </button>
                <button
                  className="ta-btn ta-btn-outline ta-btn-sm"
                  onClick={() => onNavigate && onNavigate("mentees")}
                >
                  Review flagged learners
                </button>
              </div>
            </div>

          </div>

          {/* Right Column: Student Risk Monitor & My Schedule */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* Student Risk Monitor */}
            <div className="ta-card" style={{ padding: 22, borderRadius: 16 }}>
              <div className="ta-row ta-between" style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="ta-title" style={{ fontSize: 16 }}>Student Risk Monitor</div>
                  <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Learners needing academic or attendance support</div>
                </div>
                {/* Was a hardcoded "2 High Risk"; now the real number of rows
                    the risk query flagged as high risk. */}
                <Tag tone="danger">{highRiskCount} High Risk</Tag>
              </div>

              <div className="ta-col ta-gap12 ta-mt16 anim-stagger">
                {riskQuery.loading && <div className="ta-empty">Loading learner activity...</div>}
                {!riskQuery.loading && studentRisks.length === 0 && (
                  <div className="ta-empty">No learners are flagged as needing support right now.</div>
                )}
                {studentRisks.map(s => (
                  <div key={s.name} className="ta-row ta-between" style={{ padding: "10px 12px", borderRadius: 12, background: "var(--surface-3)", flexWrap: "wrap", gap: 10 }}>
                    <div className="ta-row ta-gap10" style={{ minWidth: 0, flex: "1 1 160px" }}>
                      {/* Each row previously carried a stock Unsplash headshot
                          for a hardcoded person. Real avatar where the row has
                          one, shared initials Avatar otherwise. */}
                      <Avatar
                        initials={s.initials || (s.name || "U").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                        size={38}
                        src={s.avatar || undefined}
                        style={{ borderRadius: 10, border: "1px solid var(--border)", flexShrink: 0 }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                        {/* Track/role labels ("UI Design Fellow") were invented;
                            days inactive comes from the real last_active_at the
                            risk query reads. */}
                        <div style={{ fontSize: 11, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.days === "N/A" ? "No recent activity" : `${s.days} days inactive`}
                        </div>
                      </div>
                    </div>

                    <div className="ta-row ta-gap8" style={{ flexShrink: 0 }}>
                      <Tag tone={s.risk === "high" ? "danger" : "warning"}>{s.risk === "high" ? "High Risk" : "Needs Attention"}</Tag>
                      <button 
                        className="ta-btn ta-btn-ghost ta-btn-sm" 
                        title="Send direct message"
                        onClick={() => onNavigate && onNavigate("messages")}
                        style={{ padding: "4px 8px" }}
                      >
                        <MessageSquare size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* My Schedule & Live Session Card */}
            <div className="ta-card" style={{ padding: 22, borderRadius: 16 }}>
              <div className="ta-row ta-between" style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="ta-title" style={{ fontSize: 16 }}>My Schedule</div>
                  <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Interactive live sessions & critiques</div>
                </div>
                <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => onNavigate && onNavigate("schedule")}>
                  Full calendar
                </button>
              </div>

              {/* Dark Live Hero Stream Card - a real in-progress session from
                  sessionsQuery. Hidden entirely when nothing is live rather
                  than showing an invented session. */}
              {liveSession && (
              <div style={{
                marginTop: 16,
                padding: 18,
                borderRadius: 14,
                background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)",
                color: "#FFFFFF",
                boxShadow: "0 8px 24px rgba(49, 46, 129, 0.25)"
              }}>
                <div className="ta-row ta-between">
                  <div className="ta-row ta-gap6" style={{ background: "rgba(239, 68, 68, 0.2)", padding: "4px 10px", borderRadius: 20, color: "#FCA5A5", fontSize: 11, fontWeight: 700 }}>
                    <Radio size={12} className="anim-pulse" /> LIVE NOW
                  </div>
                  {/* Real duration_minutes. The "28 joined" half had no source -
                      mentorship_sessions stores no attendee count. */}
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
                    {liveSession.duration_minutes ? `${liveSession.duration_minutes} mins` : "Duration not set"}{DEMO_MODE ? " • 28 joined" : ""}
                  </span>
                </div>

                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 12, lineHeight: 1.35 }}>
                  {liveSession.title || "Untitled session"}
                </div>
                {liveSession.learner_name && (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
                    Session with {liveSession.learner_name}
                  </div>
                )}

                <div className="ta-row ta-between ta-mt16">
                  {/* Only rendered when the row carries a real meeting_url. The
                      old button always opened a fixed demo Google Meet room. */}
                  {liveSession.meeting_url && (
                    <button
                      className="ta-btn ta-btn-primary"
                      style={{ background: "#4F46E5", border: "none", color: "#FFFFFF", fontWeight: 700 }}
                      onClick={() => window.open(liveSession.meeting_url, "_blank")}
                    >
                      <Video size={14} /> Join Studio
                    </button>
                  )}
                  {/* No room number column exists anywhere in the schema. */}
                  {DEMO_MODE && (
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Room #082</span>
                  )}
                </div>
              </div>
              )}

              {/* Upcoming sessions timeline - real future mentorship_sessions
                  rows, replacing two literal entries. */}
              <div className="ta-col ta-gap10 ta-mt16">
                {sessionsQuery.loading && <div className="ta-empty">Loading your sessions...</div>}
                {!sessionsQuery.loading && !liveSession && upcomingSessions.length === 0 && (
                  <div className="ta-empty">No live or upcoming sessions scheduled.</div>
                )}
                {upcomingSessions.map(s => (
                  <div key={s.id} className="ta-row ta-between" style={{ padding: "10px 12px", borderRadius: 12, background: "var(--surface-3)", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, overflowWrap: "break-word" }}>{s.title || "Untitled session"}</div>
                      <div className="ta-row ta-gap6" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                        <Clock size={11} /> {new Date(s.scheduled_at).toLocaleString()}{s.duration_minutes ? ` (${s.duration_minutes}m)` : ""}
                      </div>
                    </div>
                    <Tag tone={s.status === "confirmed" ? "primary" : "default"}>{s.status || "scheduled"}</Tag>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

        <AnalysisNotesCard authorId={currentUserId} organizationId={orgId} />
      </div>
    </div>
  );
}
