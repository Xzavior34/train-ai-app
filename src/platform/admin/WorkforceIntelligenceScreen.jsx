import React, { useState, useContext } from "react";
import { TopBar, StatCard, ProgressBar, Tag, ToastContext } from "../components/PlatformUI.jsx";
import { 
  Brain, Sparkles, ClipboardCheck, AlertTriangle, Bot, 
  TrendingUp, CheckCircle2, Circle, ArrowRight, UserCheck, 
  Award, ShieldCheck, ChevronRight, Zap, Target, BookOpen
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchWorkforceIntelligence } from "../../lib/api/platform.js";
import { DEMO_LEARNERS } from "../../lib/api/demoData.js";

export function WorkforceIntelligenceScreen({ orgId, orgSelector }) {
  const showToast = useContext(ToastContext);
  const [selectedLearnerId, setSelectedLearnerId] = useState("demo-learner-1");
  const [assignSuccess, setAssignSuccess] = useState(false);
  const wiQuery = useSupabaseQuery(async () => (orgId ? fetchWorkforceIntelligence(orgId) : null), [orgId]);
  const wi = wiQuery.data;

  const currentLearner = DEMO_LEARNERS.find(l => l.id === selectedLearnerId) || DEMO_LEARNERS[0];

  const careerSteps = [
    { title: "Junior UI Designer", status: "completed", progress: 100, tag: "Completed" },
    { title: "Middle UI Designer", status: "active", progress: 68, tag: "Current Track" },
    { title: "Senior UI Designer", status: "upcoming", progress: 0, tag: "Target Goal" },
    { title: "Head of Design / Architect", status: "locked", progress: 0, tag: "Long-term" },
  ];

  const skillProfile = [
    { skill: "UX Design", level: 92, target: 85, fill: "#4F46E5" },
    { skill: "Design Systems", level: 94, target: 90, fill: "#6366F1" },
    { skill: "Prototyping", level: 88, target: 80, fill: "#8B5CF6" },
    { skill: "UX Research", level: 62, target: 80, fill: "#EC4899" },
    { skill: "Leadership", level: 75, target: 70, fill: "#10B981" },
    { skill: "Communication", level: 85, target: 80, fill: "#F59E0B" }
  ];

  const promotionCriteria = [
    { id: 1, text: "Design System Token Audit & Component Contribution", done: true, score: "96/100" },
    { id: 2, text: "Lead 2 Peer UI Reviews & Mentorship Critiques", done: true, score: "2/2 Completed" },
    { id: 3, text: "Pass Advanced Spatial & Generative UI Assessment", done: false, score: "74% (Pass: 80%)" },
    { id: 4, text: "Conduct Qualitative UX Research Case Study", done: false, score: "Pending submission" }
  ];

  const handleAssignModule = () => {
    setAssignSuccess(true);
    setTimeout(() => setAssignSuccess(false), 4000);
  };

  return (
    <div className="ta-fade">
      <TopBar 
        title="Workforce Intelligence & Growth" 
        sub="Readiness analytics, promotion criteria, skill profiles, and career progression." 
        orgSelector={orgSelector} 
      />
      
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {wiQuery.loading && <div className="ta-card ta-empty">Loading workforce intelligence...</div>}
        {!wiQuery.loading && (!wi || wi.learnerCount === 0) && (
          <div className="ta-card ta-empty">No learners in this organization yet - readiness and skill data will appear once there's real activity to summarize.</div>
        )}
        {!wiQuery.loading && wi && wi.learnerCount > 0 && (
        <>
        {/* =========================================================================
            WORKFORCE INTELLIGENCE HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner">
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">Workforce Intelligence &amp; Skill Radar</h1>
              <p className="ta-hero-desc">Map enterprise competencies, skill gaps, and automated upskilling paths.</p>
            </div>
          </div>
        </div>

        {/* Top 4 KPI Metrics */}
        <div className="ta-grid ta-grid-4 anim-stagger">
          <div className="ta-card" style={{ padding: 18 }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Workforce Readiness</span>
              <Brain size={18} color="#4F46E5" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>{wi.readinessScore}%</div>
            <div style={{ fontSize: 11.5, color: "var(--success)", marginTop: 4 }}>&nbsp;</div>
          </div>

          <div className="ta-card" style={{ padding: 18 }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Avg Course Completion</span>
              <ClipboardCheck size={18} color="#10B981" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>{wi.avgCompletion}%</div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>Across all active tracks</div>
          </div>

          <div className="ta-card" style={{ padding: 18 }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Compliance Rate</span>
              <ShieldCheck size={18} color="#F59E0B" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>{wi.complianceRate === null ? "N/A" : `${wi.complianceRate}%`}</div>
            <div style={{ fontSize: 11.5, color: "var(--success)", marginTop: 4 }}>Audit ready</div>
          </div>

          <div className="ta-card" style={{ padding: 18 }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>AI Coach Queries (7d)</span>
              <Bot size={18} color="#8B5CF6" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>{wi.aiUsageCount7d}</div>
            <div style={{ fontSize: 11.5, color: "var(--primary)", marginTop: 4 }}>Active learning adoption</div>
          </div>
        </div>

        {/* Learner Selector Bar */}
        <div className="ta-card" style={{ padding: 16, borderRadius: 14, background: "var(--surface-2)" }}>
          <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 12 }}>
            <div className="ta-row ta-gap10">
              <img 
                src={currentLearner.avatar} 
                alt={currentLearner.name}
                style={{ width: 44, height: 44, borderRadius: 12, objectFit: "cover", border: "2px solid var(--primary)" }}
              />
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>{currentLearner.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-3)" }}>{currentLearner.email} • {currentLearner.status}</div>
              </div>
            </div>

            <div className="ta-row ta-gap8" style={{ flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-2)" }}>Inspect Learner:</span>
              <select
                className="ta-input"
                style={{ minWidth: "min(200px, 100%)", flex: "1 1 auto", padding: "6px 12px", borderRadius: 8 }}
                value={selectedLearnerId}
                onChange={(e) => setSelectedLearnerId(e.target.value)}
              >
                {DEMO_LEARNERS.map(l => (
                  <option key={l.id} value={l.id}>{l.name} ({l.status})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 4-Tier Career Path Progression Visual */}
        <div className="ta-card" style={{ padding: 22 }}>
          <div className="ta-row ta-between" style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div className="ta-title" style={{ fontSize: 16 }}>Career Path Progression</div>
              <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Target competency roadmap and promotion track</div>
            </div>
            <Tag tone="primary">Track: Product Design & AI</Tag>
          </div>

          <div className="anim-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 20 }}>
            {careerSteps.map((step, idx) => (
              <div 
                key={step.title} 
                style={{ 
                  padding: 16, 
                  borderRadius: 14, 
                  background: step.status === "active" ? "rgba(99, 102, 241, 0.08)" : "var(--surface-3)",
                  border: step.status === "active" ? "2px solid #4F46E5" : "1px solid var(--border)",
                  position: "relative"
                }}
              >
                <div className="ta-row ta-between">
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)" }}>LEVEL {idx + 1}</span>
                  <Tag tone={step.status === "completed" ? "success" : step.status === "active" ? "primary" : "default"}>
                    {step.tag}
                  </Tag>
                </div>

                <div style={{ fontSize: 14, fontWeight: 800, marginTop: 10, color: "var(--text)" }}>
                  {step.title}
                </div>

                <div className="ta-mt12">
                  <ProgressBar value={step.progress} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6, textAlign: "right" }}>
                  {step.progress}% met
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Skill Profile Radar / Matrix & Promotion Criteria Checklist */}
        <div className="ta-sidebar-layout">

          {/* Skill Profile Breakdown */}
          <div className="ta-card" style={{ padding: 22 }}>
            <div className="ta-row ta-between" style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
              <div>
                <div className="ta-title" style={{ fontSize: 16 }}>Skill Profile & Radar Assessment</div>
                <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Current measured level vs role baseline</div>
              </div>
              <Tag tone="success">91% Readiness</Tag>
            </div>

            {/* Visual Skill Matrix with Colored Progress Bars */}
            <div className="ta-col ta-gap14 ta-mt16">
              {skillProfile.map(s => (
                <div key={s.skill}>
                  <div className="ta-row ta-between" style={{ fontSize: 13, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>{s.skill}</span>
                    <span style={{ color: "var(--text-2)", fontSize: 12 }}>
                      <strong style={{ color: s.level >= s.target ? "var(--success)" : "var(--danger)" }}>{s.level}%</strong> / target {s.target}%
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 8, background: "var(--surface-2)", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ width: `${s.level}%`, height: "100%", background: s.fill, borderRadius: 6, transition: "width 0.4s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Promotion Criteria & AI Recommendation */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* Promotion Criteria Checklist */}
            <div className="ta-card" style={{ padding: 22 }}>
              <div className="ta-row ta-between" style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="ta-title" style={{ fontSize: 16 }}>Promotion Criteria</div>
                  <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Requirements for next level evaluation</div>
                </div>
                <Tag tone="warning">2/4 Completed</Tag>
              </div>

              <div className="ta-col ta-gap12 ta-mt16">
                {promotionCriteria.map(c => (
                  <div 
                    key={c.id} 
                    style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: 12, 
                      padding: "12px 14px", 
                      borderRadius: 12, 
                      background: "var(--surface-3)",
                      border: c.done ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid var(--border)"
                    }}
                  >
                    {c.done ? (
                      <CheckCircle2 size={18} color="#10B981" style={{ flexShrink: 0 }} />
                    ) : (
                      <Circle size={18} color="var(--text-3)" style={{ flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{c.text}</div>
                      <div style={{ fontSize: 11, color: c.done ? "var(--success)" : "var(--text-3)", marginTop: 2 }}>{c.score}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Growth Recommendation Card */}
            <div className="ta-card" style={{ padding: 22, 
              background: "var(--surface-2)",
              border: "1px solid var(--border)" }}>
              <div className="ta-row ta-gap8" style={{ color: "#4F46E5", fontWeight: 700, fontSize: 14 }}>
                <Brain size={18} />
                <span>Skill Growth Recommendation</span>
              </div>

              <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 10, lineHeight: 1.55 }}>
                {currentLearner.name} demonstrates exceptional mastery in <strong>Design Systems (94%)</strong> and <strong>Prototyping (88%)</strong>, but is currently below the target in <strong>UX Research (62%)</strong>.
              </div>

              {assignSuccess && (
                <div className="ta-card ta-mt12 anim-pop" style={{ background: "rgba(16, 185, 129, 0.1)", borderColor: "#10B981", padding: 10 }}>
                  <div className="ta-row ta-gap8" style={{ color: "#10B981", fontSize: 12.5, fontWeight: 600 }}>
                    <CheckCircle2 size={15} /> Assigned "UX Research Practical Case Study" to {currentLearner.name}'s path!
                  </div>
                </div>
              )}

              <div className="ta-row ta-gap10 ta-mt16" style={{ flexWrap: "wrap" }}>
                <button 
                  className="ta-btn ta-btn-primary ta-btn-sm"
                  onClick={handleAssignModule}
                >
                  Assign Recommended Module →
                </button>
                <button 
                  className="ta-btn ta-btn-outline ta-btn-sm"
                  onClick={() => showToast(`Growth profile exported as PDF for ${currentLearner.name}`)}
                >
                  Export Development Plan
                </button>
              </div>
            </div>

          </div>

        </div>

        <div className="ta-card">
          <div className="ta-row ta-gap8"><Sparkles size={16} color="var(--primary)" /><div className="ta-title">Skill gaps by department</div></div>
          <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>
            Real course-category completion, broken down by department - the lowest scores are the closest thing this data supports to "where the gaps are."
          </div>
          <div className="ta-col ta-gap10 ta-mt12">
            {wi.departmentBreakdown.length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)" }}>No department data yet.</div>}
            {wi.departmentBreakdown.map((d) => (
              <div key={d.department}>
                <div className="ta-row ta-between" style={{ fontSize: 12.5 }}>
                  <span style={{ fontWeight: 600 }}>{d.department}</span>
                  <span>{d.avgProgress}% avg ({d.count} enrollments)</span>
                </div>
                <ProgressBar value={d.avgProgress} />
              </div>
            ))}
          </div>
        </div>

        <div className="ta-card">
          <div className="ta-row ta-gap8"><ClipboardCheck size={16} color="var(--primary)" /><div className="ta-title">Completion by course category</div></div>
          <div className="ta-col ta-gap10 ta-mt12">
            {wi.categoryBreakdown.length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)" }}>No course activity yet.</div>}
            {wi.categoryBreakdown.map((c) => (
              <div key={c.category}>
                <div className="ta-row ta-between" style={{ fontSize: 12.5 }}>
                  <span style={{ fontWeight: 600 }}>{c.category}</span>
                  <span>{c.avgProgress}% avg ({c.count} enrollments)</span>
                </div>
                <ProgressBar value={c.avgProgress} />
              </div>
            ))}
          </div>
        </div>
        </>
        )}

      </div>
    </div>
  );
}
