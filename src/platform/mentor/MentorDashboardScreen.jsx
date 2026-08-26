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
import { fetchMentorActiveCohorts } from "../../lib/api/platform.js";
import { isMockDataEnabled } from "../../lib/mockDataManager.js";

export function MentorDashboardScreen({ mentorId, currentUserId, profileQuery, orgId, orgSelector, onNavigate }) {
  const showToast = useContext(ToastContext);
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [tasks, setTasks] = useState([
    { id: 1, text: "Grade Module 3 UI & Wireframe Submissions (8 pending)", done: false, priority: "high" },
    { id: 2, text: "Prepare Figma Workshop Asset Kit for Batch 4", done: true, priority: "normal" },
    { id: 3, text: "1:1 Clarification session with Fatima Diallo", done: false, priority: "high" },
    { id: 4, text: "Upload Spatial UI Design System template to Resources", done: false, priority: "normal" }
  ]);

  const [aiActionRunning, setAiActionRunning] = useState(false);
  const [aiActionSuccess, setAiActionSuccess] = useState(false);

  const sessionsQuery = useSupabaseQuery(async () => mentorId ? fetchMentorSessions(mentorId) : [], [mentorId]);
  const activeCohortsQuery = useSupabaseQuery(async () => currentUserId ? fetchMentorActiveCohorts(currentUserId) : [], [currentUserId]);
  const earningsQuery = useSupabaseQuery(async () => mentorId ? fetchMentorEarnings(mentorId) : [], [mentorId]);
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

  const handleRunAiSession = () => {
    setAiActionRunning(true);
    setTimeout(() => {
      setAiActionRunning(false);
      setAiActionSuccess(true);
      setTimeout(() => setAiActionSuccess(false), 4000);
    }, 1200);
  };

  const defaultStudentRisks = [
    { name: "Fatima Diallo", role: "UI Design Fellow", risk: "High Risk", riskTone: "danger", lastActive: "12 days ago", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" },
    { name: "Liam Torres", role: "AI Engineering Track", risk: "Needs Attention", riskTone: "warning", lastActive: "8 days ago", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80" },
    { name: "Priya Nair", role: "Product Design", risk: "Needs Attention", riskTone: "warning", lastActive: "4 days ago", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80" },
    { name: "Amara Chen", role: "Generative AI Scholar", risk: "On Track", riskTone: "success", lastActive: "Just now", avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80" },
    { name: "Marcus Webb", role: "Spatial Systems", risk: "On Track", riskTone: "success", lastActive: "1 hour ago", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80" }
  ];
  const studentRisks = isMockDataEnabled() ? defaultStudentRisks : [];

  const activeLiveSession = mentorSessions.find(s => s.status === "in_progress" || s.status === "live") || null;
  const upcomingMentorSessions = mentorSessions.filter(s => s.status === "scheduled" || s.status === "pending");

  const mentorName = profileQuery?.data?.display_name || "Hazel";

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
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(59, 130, 246, 0.12)", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users size={18} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>{sessionsQuery.loading ? "…" : activeLearnerCount}</div>
            <div className="ta-row ta-gap6 ta-mt8" style={{ fontSize: 12, color: "var(--text-2)" }}>
              <span>Across all your sessions</span>
            </div>
          </div>

          <div className="ta-card" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
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

          <div className="ta-card" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Pending Reviews</span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(245, 158, 11, 0.12)", color: "#F59E0B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle2 size={18} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>05</div>
            <div className="ta-row ta-gap6 ta-mt8" style={{ fontSize: 12, color: "#F59E0B" }}>
              <span>3 assignments, 2 reviews</span>
            </div>
          </div>

          <div className="ta-card" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Engagement Rate</span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(59, 130, 246, 0.12)", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <TrendingUp size={18} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>89%</div>
            <div className="ta-row ta-gap6 ta-mt8" style={{ fontSize: 12, color: "var(--success)" }}>
              <span>+4% vs last batch</span>
            </div>
          </div>

          <div className="ta-card" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
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

          <div className="ta-card" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
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
                {activeCohortsQuery.loading && <div className="ta-empty">Loading your cohorts...</div>}
                {!activeCohortsQuery.loading && activeCohorts.length === 0 && (
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
            <div className="ta-card" style={{ padding: 22, 
              background: "var(--surface-2)",
              border: "1px solid var(--border)" }}>
              <div className="ta-row ta-gap8" style={{ color: "#2563EB", fontWeight: 700, fontSize: 14 }}>
                <Brain size={18} />
                <span>Cohort Diagnostic &amp; Recommendations</span>
              </div>
              
              <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 10, lineHeight: 1.55 }}>
                Based on recent quiz submissions and assignment grading, <strong>32% of students</strong> in <em>Module 3</em> struggled with <strong>RAG Architecture and Vector Embeddings</strong>. We recommend scheduling a targeted 30-minute clarification workshop.
              </div>

              {aiActionSuccess && (
                <div className="ta-card ta-mt12 anim-pop" style={{ background: "rgba(16, 185, 129, 0.1)", borderColor: "#10B981", padding: 10 }}>
                  <div className="ta-row ta-gap8" style={{ color: "#10B981", fontSize: 12.5, fontWeight: 600 }}>
                    <CheckCircle2 size={15} /> Workshop scheduled and invitations broadcasted to 24 affected learners.
                  </div>
                </div>
              )}

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
                  onClick={() => showToast("Diagnostic study guide generated and synced to student resource library.")}
                >
                  Generate study guide
                </button>
              </div>
            </div>

          </div>

          {/* Right Column: Student Risk Monitor & My Schedule */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* Student Risk Monitor */}
            <div className="ta-card" style={{ padding: 22 }}>
              <div className="ta-row ta-between" style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="ta-title" style={{ fontSize: 16 }}>Student Risk Monitor</div>
                  <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Learners needing academic or attendance support</div>
                </div>
                {studentRisks.length > 0 && <Tag tone="danger">{studentRisks.filter(s => s.riskTone === "danger").length} High Risk</Tag>}
              </div>

              <div className="ta-col ta-gap12 ta-mt16 anim-stagger">
                {studentRisks.length === 0 && (
                  <div className="ta-empty" style={{ padding: "16px 8px" }}>
                    All learners in your assigned cohorts are currently in good academic standing.
                  </div>
                )}
                {studentRisks.map(s => (
                  <div key={s.name} className="ta-row ta-between" style={{ padding: "10px 12px", borderRadius: 8, background: "var(--surface-3)", flexWrap: "wrap", gap: 10 }}>
                    <div className="ta-row ta-gap10" style={{ minWidth: 0, flex: "1 1 160px" }}>
                      <img
                        src={s.avatar}
                        alt={s.name}
                        style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover", border: "1px solid var(--border)", flexShrink: 0 }}
                      />
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
                    <button 
                      className="ta-btn ta-btn-primary ta-btn-sm" 
                      style={{ background: "#2563EB", border: "none", color: "#FFFFFF", fontWeight: 700, borderRadius: 6 }}
                      onClick={() => window.open(activeLiveSession.meeting_url || "https://meet.google.com/new", "_blank")}
                    >
                      <Video size={13} /> Join Studio
                    </button>
                    <span style={{ fontSize: 11, color: "#64748B" }}>Room #{activeLiveSession.id ? activeLiveSession.id.slice(0, 6) : "082"}</span>
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
                    <button
                      className="ta-btn ta-btn-primary ta-btn-sm"
                      style={{ padding: "3px 8px", fontSize: 11 }}
                      onClick={() => window.open(sess.meeting_url || "https://meet.google.com/new", "_blank")}
                    >
                      <Video size={12} /> Launch
                    </button>
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
