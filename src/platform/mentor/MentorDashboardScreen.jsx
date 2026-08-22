import React, { useState, useContext } from "react";
import { TopBar, StatCard, Tag, ToastContext } from "../components/PlatformUI.jsx";
import { AnalysisNotesCard } from "../components/AnalysisNotesCard.jsx";
import { 
  Users, Layers, CheckCircle2, Calendar, Radio, Star, 
  Sparkles, ArrowRight, Video, Clock, AlertTriangle, 
  CheckSquare, Square, MessageSquare, ExternalLink, Plus,
  TrendingUp, BookOpen, Brain
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchMentorSessions, fetchMentorEarnings } from "../../lib/api/schemaHelper.js";
import { fetchMentorActiveCohorts } from "../../lib/api/platform.js";

export function MentorDashboardScreen({ mentorId, currentUserId, profileQuery, orgId, onNavigate }) {
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
  const mentorSessions = sessionsQuery.data || [];
  const activeCohorts = activeCohortsQuery.data || [];
  const activeLearnerCount = new Set(mentorSessions.map((s) => s.learner_id).filter(Boolean)).size;
  const cohortsEndingSoonCount = activeCohorts.filter((c) => c.ends_at && new Date(c.ends_at).getTime() - Date.now() < 14 * 86400000).length;

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

  const studentRisks = [
    { name: "Fatima Diallo", role: "UI Design Fellow", risk: "High Risk", riskTone: "danger", lastActive: "12 days ago", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" },
    { name: "Liam Torres", role: "AI Engineering Track", risk: "Needs Attention", riskTone: "warning", lastActive: "8 days ago", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80" },
    { name: "Priya Nair", role: "Product Design", risk: "Needs Attention", riskTone: "warning", lastActive: "4 days ago", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80" },
    { name: "Amara Chen", role: "Generative AI Scholar", risk: "On Track", riskTone: "success", lastActive: "Just now", avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80" },
    { name: "Marcus Webb", role: "Spatial Systems", risk: "On Track", riskTone: "success", lastActive: "1 hour ago", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80" }
  ];

  const mentorName = profileQuery?.data?.display_name || "Hazel";

  return (
    <div className="ta-fade">
      <TopBar 
        title={`Hello, ${mentorName}`} 
        sub="Track learner engagement, review cohort progress, and launch live sessions." 
        right={
          <div style={{ position: "relative" }}>
            <button className="ta-btn ta-btn-primary" onClick={() => setQuickActionOpen(v => !v)}>
              <Plus size={15} /> Quick action
            </button>
            {quickActionOpen && (
              <div className="ta-card anim-slide-down" style={{ position: "absolute", top: 48, right: 0, width: 220, padding: 8, zIndex: 50 }}>
                {[
                  { label: "🔴 Start Live Workshop", go: () => window.open("https://meet.google.com/new", "_blank") },
                  { label: "💬 Message at-risk students", go: () => onNavigate && onNavigate("messages") },
                  { label: "📝 Grade Submissions", go: () => onNavigate && onNavigate("mentees") },
                  { label: "📅 Schedule 1:1 Session", go: () => onNavigate && onNavigate("schedule") }
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
                  4 ACTIVE COHORTS UNDER MENTORSHIP
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
              <button
                className="ta-btn ta-btn-primary"
                onClick={handleRunAiSession}
                disabled={aiActionRunning}
                style={{
                  background: "#4F46E5", color: "#FFFFFF", fontWeight: 800,
                  boxShadow: "0 4px 16px rgba(79, 70, 229, 0.4)", display: "flex", alignItems: "center", gap: 8
                }}
              >
                <TrendingUp size={15} /> {aiActionRunning ? "Analyzing Cohort Gaps..." : "Run Cohort Clarification"}
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
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>05</div>
            <div className="ta-row ta-gap6 ta-mt8" style={{ fontSize: 12, color: "#F59E0B" }}>
              <span>3 assignments, 2 reviews</span>
            </div>
          </div>

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
        </div>

        {/* Asymmetric 2-Column Main Workspace */}
        <div className="ta-sidebar-layout">

          {/* Left Column: Tasks, Batch Progress & AI Learning Insights */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
            
            {/* Today's Tasks */}
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
            <div className="ta-card" style={{ padding: 22, borderRadius: 16 }}>
              <div className="ta-row ta-between" style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="ta-title" style={{ fontSize: 16 }}>Student Risk Monitor</div>
                  <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Learners needing academic or attendance support</div>
                </div>
                <Tag tone="danger">2 High Risk</Tag>
              </div>

              <div className="ta-col ta-gap12 ta-mt16 anim-stagger">
                {studentRisks.map(s => (
                  <div key={s.name} className="ta-row ta-between" style={{ padding: "10px 12px", borderRadius: 12, background: "var(--surface-3)", flexWrap: "wrap", gap: 10 }}>
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

              {/* Dark Live Hero Stream Card */}
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
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>60 mins • 28 joined</span>
                </div>

                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 12, lineHeight: 1.35 }}>
                  Spatial UI & Design Systems Critique
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
                  Cohort Batch 4 interactive portfolio review session
                </div>

                <div className="ta-row ta-between ta-mt16">
                  <button 
                    className="ta-btn ta-btn-primary" 
                    style={{ background: "#4F46E5", border: "none", color: "#FFFFFF", fontWeight: 700 }}
                    onClick={() => window.open("https://meet.google.com/demo-room-ai", "_blank")}
                  >
                    <Video size={14} /> Join Studio
                  </button>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Room #082</span>
                </div>
              </div>

              {/* Upcoming sessions timeline */}
              <div className="ta-col ta-gap10 ta-mt16">
                <div className="ta-row ta-between" style={{ padding: "10px 12px", borderRadius: 12, background: "var(--surface-3)", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, overflowWrap: "break-word" }}>Cloud Architecture Masterclass</div>
                    <div className="ta-row ta-gap6" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                      <Clock size={11} /> Tomorrow • 3:00 PM (45m)
                    </div>
                  </div>
                  <Tag tone="primary">Upcoming</Tag>
                </div>

                <div className="ta-row ta-between" style={{ padding: "10px 12px", borderRadius: 12, background: "var(--surface-3)", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, overflowWrap: "break-word" }}>Generative AI Prompts Workshop</div>
                    <div className="ta-row ta-gap6" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                      <Clock size={11} /> Friday • 5:00 PM (90m)
                    </div>
                  </div>
                  <Tag tone="default">Scheduled</Tag>
                </div>
              </div>
            </div>

          </div>

        </div>

        <AnalysisNotesCard authorId={currentUserId} organizationId={orgId} />
      </div>
    </div>
  );
}
