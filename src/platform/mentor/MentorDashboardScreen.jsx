import { LoadingSkeleton } from "./../../components/common/PageLoadingBoundary.jsx";
import { useAssignmentRefresh } from "../../lib/useAssignmentRefresh.js";
import React, { useState, useContext } from "react";
import { TopBar, StatCard, Tag, ToastContext } from "../components/PlatformUI.jsx";
import { AnalysisNotesCard } from "../components/AnalysisNotesCard.jsx";
import { 
  Users, Layers, CheckCircle2, Calendar, Radio, Star,
  ArrowRight, Video, Clock, AlertTriangle,
  CheckSquare, Square, MessageSquare, ExternalLink, Plus,
  TrendingUp, BookOpen, Brain, DollarSign
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchMentorSessions, fetchMentorEarnings } from "../../lib/api/schemaHelper.js";
import { fetchMentorActiveCohorts, fetchMyLearnerActivityAlerts } from "../../lib/api/platform.js";
import { isMockDataEnabled } from "../../lib/mockDataManager.js";

export function MentorDashboardScreen({ mentorId, currentUserId, profileQuery, orgId, orgSelector, onNavigate }) {
  const showToast = useContext(ToastContext);
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [tasks, setTasks] = useState(isMockDataEnabled() ? [
    { id: 1, text: "Grade pending coursework submissions", done: false, priority: "high" },
    { id: 2, text: "Prepare Workshop Asset Kit for upcoming cohort", done: true, priority: "normal" },
    { id: 3, text: "1:1 Clarification session with struggling learners", done: false, priority: "high" },
    { id: 4, text: "Upload latest study materials & syllabus templates to Resources", done: false, priority: "normal" }
  ] : []);

  const aiActionRunning = false;

  const sessionsQuery = useSupabaseQuery(async () => mentorId ? fetchMentorSessions(mentorId) : [], [mentorId]);
  const activeCohortsQuery = useSupabaseQuery(async () => currentUserId ? fetchMentorActiveCohorts(currentUserId) : [], [currentUserId]);
  useAssignmentRefresh(currentUserId, activeCohortsQuery.refetch);
  const earningsQuery = useSupabaseQuery(async () => mentorId ? fetchMentorEarnings(mentorId) : [], [mentorId]);
  const riskQuery = useSupabaseQuery(async () => currentUserId ? fetchMyLearnerActivityAlerts() : [], [currentUserId]);
  
  const mentorSessions = sessionsQuery.data || [];
  const activeCohorts = activeCohortsQuery.data || [];
  const activeLearnerCount = new Set(mentorSessions.map((s) => s.learner_id).filter(Boolean)).size;
  const cohortsEndingSoonCount = activeCohorts.filter((c) => c.ends_at && new Date(c.ends_at).getTime() - Date.now() < 14 * 86400000).length;
  
  const ratedSessions = mentorSessions.filter((s) => typeof s.rating === "number");
  const avgRating = ratedSessions.length
    ? (ratedSessions.reduce((sum, s) => sum + s.rating, 0) / ratedSessions.length).toFixed(1)
    : null;
  const earningsRows = earningsQuery.data || [];
  const totalEarnings = earningsRows.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const pendingSessionCount = mentorSessions.filter(s => s.status === "pending" || s.status === "scheduled" || s.status === "requested").length;

  const toggleTask = (id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const handleRunAiSession = () => onNavigate?.("schedule");

  const studentRisks = (riskQuery.data || []).map(r => ({
    name: r.name || r.user_name || "Learner",
    role: r.course_title || "Enrolled Learner",
    risk: r.risk === "high" ? "High Risk" : "Needs Attention",
    riskTone: r.risk === "high" ? "danger" : "warning",
    lastActive: r.days === "N/A" ? "Inactive" : `${r.days}d ago`,
    avatar: r.avatar || null
  }));

  const activeLiveSession = mentorSessions.find(s => s.status === "in_progress" || s.status === "live") || null;
  const upcomingMentorSessions = mentorSessions.filter(s => s.status === "scheduled" || s.status === "pending" || s.status === "requested" || s.status === "confirmed");

  const mentorName = profileQuery?.data?.display_name || "Instructor";

  return (
    <div className="ta-fade">
      <TopBar 
        title={`Hello, ${mentorName}`} 
        sub="Track learner engagement, review cohort progress, and launch live sessions." 
        orgSelector={orgSelector}
        onNavigate={onNavigate}
      />

      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        
        <div className="ta-hero-banner ta-hero-dark anim-fluid-entrance">
          <div className="tai-glow-cobalt" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">
                Instructor Live Studio &amp; Pacing
              </h1>
              <p className="ta-hero-desc">
                Review student submissions, host office hours, launch interactive clarification sessions, and message struggling learners.
              </p>
            </div>

            <div className="ta-hero-actions">
              <button
                className="ta-btn ta-btn-primary"
                onClick={handleRunAiSession}
                disabled={aiActionRunning}
                style={{
                  background: "#2563EB", color: "#FFFFFF", fontWeight: 800,
                  boxShadow: "0 4px 16px rgba(37, 99, 235, 0.4)", display: "flex", alignItems: "center", gap: 8
                }}
              >
                <TrendingUp size={15} /> {aiActionRunning ? "Analyzing Cohort Gaps..." : "Run Cohort Clarification"}
              </button>
            </div>
          </div>
        </div>

        {/* Top 4 Balanced KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 16 }}>
          <div className="ta-card" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Active Learners</span>
              <Users size={18} color="#2563EB" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>{sessionsQuery.loading ? "…" : activeLearnerCount}</div>
            <div className="ta-row ta-gap6 ta-mt8" style={{ fontSize: 12, color: "var(--text-2)" }}>
              <span>Across all your sessions</span>
            </div>
          </div>

          <div className="ta-card" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Active Cohorts</span>
              <Layers size={18} color="#10B981" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>{activeCohortsQuery.loading ? "…" : String(activeCohorts.length).padStart(2, "0")}</div>
            <div className="ta-row ta-gap6 ta-mt8" style={{ fontSize: 12, color: "var(--text-2)" }}>
              <span>{cohortsEndingSoonCount} finishing soon</span>
            </div>
          </div>

          <div className="ta-card" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Pending Sessions</span>
              <CheckCircle2 size={18} color="#F59E0B" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>
              {sessionsQuery.loading ? "…" : String(pendingSessionCount).padStart(2, "0")}
            </div>
            <div className="ta-row ta-gap6 ta-mt8" style={{ fontSize: 12, color: "#F59E0B" }}>
              <span>{pendingSessionCount} upcoming session{pendingSessionCount === 1 ? "" : "s"}</span>
            </div>
          </div>

          <div className="ta-card" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Session Completion</span>
              <TrendingUp size={18} color="#2563EB" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>
              {sessionsQuery.loading ? "…" : mentorSessions.length ? `${Math.round((mentorSessions.filter(s => s.status === "completed").length / mentorSessions.length) * 100)}%` : "0%"}
            </div>
            <div className="ta-row ta-gap6 ta-mt8" style={{ fontSize: 12, color: "var(--success)" }}>
              <span>{mentorSessions.filter(s => s.status === "completed").length} of {mentorSessions.length || 0} completed</span>
            </div>
          </div>

          <div className="ta-card" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Instructor Rating</span>
              <Star size={18} color="#F59E0B" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>{sessionsQuery.loading ? "…" : (avgRating ?? "N/A")}</div>
            <div className="ta-row ta-gap6 ta-mt8" style={{ fontSize: 12, color: "var(--text-2)" }}>
              <span>Across rated sessions</span>
            </div>
          </div>

          <div className="ta-card" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Total Earnings</span>
              <DollarSign size={18} color="#10B981" />
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
            
            {/* Today's Tasks */}
            <div className="ta-card" style={{ padding: 22 }}>
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
                      borderRadius: 8, 
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

            {/* Batch Progress */}
            <div className="ta-card" style={{ padding: 22 }}>
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
                {activeCohortsQuery.loading && <div className="ta-empty"><LoadingSkeleton label="Loading your cohorts..." rows={3} /></div>}
                {activeCohortsQuery.error && <div className="ta-empty" role="alert">{activeCohortsQuery.error} <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={activeCohortsQuery.refetch}>Retry</button></div>}
                {!activeCohortsQuery.loading && !activeCohortsQuery.error && activeCohorts.length === 0 && (
                  <div className="ta-empty">You're not assigned to any active cohorts yet.</div>
                )}
                {activeCohorts.map(c => {
                  const endingSoon = c.ends_at && new Date(c.ends_at).getTime() - Date.now() < 14 * 86400000;
                  return (
                    <div key={c.id} style={{ padding: "14px 16px", borderRadius: 8, background: "var(--surface-3)" }}>
                      <div className="ta-row ta-between">
                        <div className="ta-row ta-gap8" style={{ minWidth: 0 }}>
                          <BookOpen size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                            <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                              {c.starts_at ? new Date(c.starts_at).toLocaleDateString() : "No start date"}{c.ends_at ? ` - ${new Date(c.ends_at).toLocaleDateString()}` : ""}
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
            <div className="ta-card" style={{ padding: 22, 
              background: "var(--surface-2)",
              border: "1px solid var(--border)" }}>
              <div className="ta-row ta-gap8" style={{ color: "#2563EB", fontWeight: 700, fontSize: 14 }}>
                <Brain size={18} />
                <span>Cohort Diagnostic &amp; Recommendations</span>
              </div>
              
              <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 10, lineHeight: 1.55 }}>
                {studentRisks.length > 0 ? (
                  <>
                    Based on recent activity, <strong>{studentRisks.length} learner{studentRisks.length === 1 ? "" : "s"}</strong> currently need extra support. We recommend scheduling a targeted clarification workshop or 1:1 check-in.
                  </>
                ) : (
                  <>
                    No inactivity alerts for your assigned cohorts. Open your schedule to arrange a check-in.
                  </>
                )}
              </div>


              <div className="ta-row ta-gap10 ta-mt16" style={{ flexWrap: "wrap" }}>
                <button 
                  className="ta-btn ta-btn-primary ta-btn-sm" 
                  disabled={aiActionRunning}
                  onClick={handleRunAiSession}
                >
                  {aiActionRunning ? "Scheduling workshop..." : "Schedule clarification workshop"}
                </button>
                <button 
                  className="ta-btn ta-btn-outline ta-btn-sm"
                  onClick={() => onNavigate?.("cohorts")}
                >
                  Open cohort resources
                </button>
              </div>
            </div>

          </div>

          {/* Right Column: Learner Activity Alerts & My Schedule */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* Learner Activity Alerts */}
            <div className="ta-card" style={{ padding: 22 }}>
              <div className="ta-row ta-between" style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="ta-title" style={{ fontSize: 16 }}>Learner Activity Alerts</div>
                  <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Inactivity signals for learners in your assigned cohorts</div>
                </div>
                {studentRisks.length > 0 && <Tag tone="danger">{studentRisks.filter(s => s.riskTone === "danger").length} High Risk</Tag>}
              </div>

              <div className="ta-col ta-gap12 ta-mt16 anim-stagger">
                {riskQuery.loading && <div className="ta-empty"><LoadingSkeleton label="Loading learner activity..." rows={3} /></div>}
                {riskQuery.error && <div className="ta-empty" role="alert">{riskQuery.error} <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={riskQuery.refetch}>Retry</button></div>}
                {!riskQuery.loading && !riskQuery.error && studentRisks.length === 0 && (
                  <div className="ta-empty" style={{ padding: "16px 8px" }}>
                    No inactivity alerts for your assigned cohorts.
                  </div>
                )}
                {studentRisks.map(s => (
                  <div key={s.name} className="ta-row ta-between" style={{ padding: "10px 12px", borderRadius: 8, background: "var(--surface-3)", flexWrap: "wrap", gap: 10 }}>
                    <div className="ta-row ta-gap10" style={{ minWidth: 0, flex: "1 1 160px" }}>
                      {s.avatar ? <img
                        src={s.avatar}
                        alt={s.name}
                        style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover", border: "1px solid var(--border)", flexShrink: 0 }}
                      /> : <span aria-hidden="true" style={{ width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: 10, background: "var(--surface-3)" }}>{s.name.slice(0, 1).toUpperCase()}</span>}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.role} • {s.lastActive}</div>
                      </div>
                    </div>

                    <div className="ta-row ta-gap8" style={{ flexShrink: 0 }}>
                      <Tag tone={s.riskTone}>{s.risk}</Tag>
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
            <div className="ta-card" style={{ padding: 22 }}>
              <div className="ta-row ta-between" style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="ta-title" style={{ fontSize: 16 }}>My Schedule</div>
                  <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Interactive live sessions & critiques</div>
                </div>
                <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => onNavigate && onNavigate("schedule")}>
                  Full calendar
                </button>
              </div>

              {/* Adaptive Liquid Glass Live Stream Card */}
              {activeLiveSession && (
                <div style={{ 
                  marginTop: 16,
                  padding: 16, 
                  borderRadius: 12, 
                  background: "var(--surface)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  boxShadow: "inset 0 1px 0 var(--glass-specular), 0 8px 24px -6px rgba(0,0,0,0.12)"
                }}>
                  <div className="ta-row ta-between">
                    <div className="ta-row ta-gap6" style={{ background: "rgba(239, 68, 68, 0.12)", padding: "3px 8px", borderRadius: 4, color: "#EF4444", fontSize: 10.5, fontWeight: 700, border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                      <Radio size={11} className="anim-pulse" /> LIVE NOW
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>Studio Session</span>
                  </div>

                  <div style={{ fontSize: 14.5, fontWeight: 800, marginTop: 10, lineHeight: 1.35, color: "var(--text)" }}>
                    {activeLiveSession.title || "Live Mentorship Studio"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 3 }}>
                    {activeLiveSession.description || "Cohort Batch interactive review session"}
                  </div>

                  <div className="ta-row ta-between ta-mt14">
                    {activeLiveSession.meeting_url ? (
                      <button
                        className="ta-btn ta-btn-primary ta-btn-sm"
                        style={{ background: "#2563EB", border: "none", color: "#FFFFFF", fontWeight: 700, borderRadius: 6 }}
                        onClick={() => window.open(activeLiveSession.meeting_url, "_blank")}
                      >
                        <Video size={13} /> Join Session
                      </button>
                    ) : (
                      <span style={{ fontSize: 11.5, color: "var(--text-3)", fontStyle: "italic" }}>No meeting link set</span>
                    )}
                  </div>
                </div>
              )}

              {/* Upcoming sessions timeline */}
              <div className="ta-col ta-gap10 ta-mt16">
                {upcomingMentorSessions.length === 0 && !activeLiveSession && (
                  <div className="ta-empty" style={{ padding: "16px 8px" }}>
                    No sessions scheduled today.
                  </div>
                )}
                {upcomingMentorSessions.slice(0, 3).map((sess) => (
                  <div key={sess.id} className="ta-row ta-between" style={{ padding: "10px 12px", borderRadius: 8, background: "var(--surface-3)", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, overflowWrap: "break-word" }}>{sess.title || "1-on-1 Mentorship"}</div>
                      <div className="ta-row ta-gap6" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                        <Clock size={11} /> {sess.scheduled_at ? new Date(sess.scheduled_at).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "Scheduled"}
                      </div>
                    </div>
                    {sess.meeting_url ? (
                      <button
                        className="ta-btn ta-btn-primary ta-btn-sm"
                        style={{ padding: "3px 8px", fontSize: 11 }}
                        onClick={() => window.open(sess.meeting_url, "_blank")}
                      >
                        <Video size={12} /> Launch
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--text-3)", fontStyle: "italic" }}>No link set</span>
                    )}
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
