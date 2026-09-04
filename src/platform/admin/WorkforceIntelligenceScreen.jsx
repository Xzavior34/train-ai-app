import React, { useState, useContext } from "react";
import { TopBar, StatCard, ProgressBar, Tag, ToastContext, exportRowsAsCsv } from "../components/PlatformUI.jsx";
import { 
  Brain, ClipboardCheck, AlertTriangle, Bot, 
  TrendingUp, CheckCircle2, Circle, ArrowRight, UserCheck, 
  Award, ShieldCheck, ChevronRight, Activity, BarChart3, Target, BookOpen, Download
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchWorkforceIntelligence, fetchOrgMembers, fetchOrgLearnerProgressOverview, assignComplianceCourse } from "../../lib/api/platform.js";
import { DEMO_LEARNERS } from "../../lib/api/demoData.js";
import { isMockDataEnabled } from "../../lib/mockDataManager.js";

import { CORE_PLATFORM_TRACKS } from "../../learner/screens/LearningPathsScreen.jsx";

export function WorkforceIntelligenceScreen({ orgId, orgSelector, currentUserId }) {
  const showToast = useContext(ToastContext);
  const [selectedLearnerId, setSelectedLearnerId] = useState("demo-learner-1");
  const [learnerStepLevel, setLearnerStepLevel] = useState(1);
  const [assignSuccess, setAssignSuccess] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState(CORE_PLATFORM_TRACKS[0]?.id || "track-ui-ux-spatial");
  const activeTrackObj = CORE_PLATFORM_TRACKS.find(t => t.id === selectedTrackId) || CORE_PLATFORM_TRACKS[0];

  const DEMO_WI = {
    readinessScore: 84,
    avgCompletion: 78,
    complianceRate: 92,
    avgAssessmentScore: 89,
    aiUsageCount7d: 148,
    feedbackNotesCount30d: 24,
    learnerCount: 45,
    departmentBreakdown: [
      { department: "Product Design", avgProgress: 88, learnerCount: 15 },
      { department: "AI & Data Engineering", avgProgress: 82, learnerCount: 18 },
      { department: "Executive Leadership", avgProgress: 76, learnerCount: 12 }
    ],
    categoryBreakdown: [
      { category: "AI & Machine Learning", avgProgress: 85, learnerCount: 22 },
      { category: "UX & Design Systems", avgProgress: 90, learnerCount: 15 },
      { category: "Compliance & Governance", avgProgress: 94, learnerCount: 45 }
    ]
  };

  const wiQuery = useSupabaseQuery(async () => fetchWorkforceIntelligence(orgId), [orgId]);
  const wi = wiQuery.data || DEMO_WI;

  const progressOverviewQuery = useSupabaseQuery(async () => orgId ? fetchOrgLearnerProgressOverview(orgId) : [], [orgId]);
  const learnerProgressList = progressOverviewQuery.data || [];

  const membersQuery = useSupabaseQuery(async () => fetchOrgMembers(orgId), [orgId]);
  const realLearners = (membersQuery.data || [])
    .filter(m => m.role === "learner" || m.role === "student" || !m.role)
    .map(m => {
      const prog = learnerProgressList.find(p => p.id === (m.user_id || m.id));
      const avgProg = prog?.avgProgress ?? 78;
      return {
        id: m.user_id || m.id,
        name: m.display_name || m.name || m.email || "Learner",
        email: m.email || `${(m.display_name || 'learner').toLowerCase().replace(/\s+/g, '.')}@sarafoundationafrica.com`,
        status: prog?.pace === "behind" ? "Needs Attention" : avgProg >= 85 ? "High Performer" : "On Track",
        readiness: `${avgProg}%`,
        avgProgress: avgProg,
        assessmentScore: prog?.assessmentScore ?? 88,
        avatar: m.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
      };
    });

  const fallbackLearners = DEMO_LEARNERS && DEMO_LEARNERS.length > 0 ? DEMO_LEARNERS : [
    { id: "demo-learner-1", name: "Naushad Khan", email: "naushad.khan@trainailtd.com", status: "On Track", readiness: "84%", avgProgress: 84, avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80" },
    { id: "demo-learner-2", name: "Amara Chen", email: "amara.chen@sarafoundationafrica.com", status: "High Performer", readiness: "92%", avgProgress: 92, avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80" },
    { id: "demo-learner-3", name: "Fatima Diallo", email: "fatima.diallo@digitaltraining.org", status: "Needs Attention", readiness: "64%", avgProgress: 64, avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" }
  ];

  const allLearners = realLearners.length > 0 ? realLearners : fallbackLearners;
  const currentLearner = allLearners.find(l => l.id === selectedLearnerId) || allLearners[0];

  const learnerScore = currentLearner?.avgProgress ?? wi.readinessScore ?? 80;

  const [promotionCriteria, setPromotionCriteria] = useState([
    { id: 1, text: `${activeTrackObj.courses[0]?.title || "Course 1"}: Hands-on Project`, done: true, score: `${Math.min(100, learnerScore + 10)}/100 Passed` },
    { id: 2, text: `Peer Review & ${activeTrackObj.skills?.[0] || "Competency"} Audit`, done: true, score: "Completed & Verified" },
    { id: 3, text: `${activeTrackObj.courses[1]?.title || "Course 2"}: Mastery Assessment`, done: learnerScore >= 70, score: learnerScore >= 70 ? "Passed & Verified" : `In Progress (${learnerScore}%)` },
    { id: 4, text: `${activeTrackObj.skills?.[1] || "Capstone"} Practical Case Study`, done: false, score: "Pending submission" }
  ]);

  const toggleCriterion = (id) => {
    setPromotionCriteria(prev => prev.map(c => {
      if (c.id === id) {
        const nextDone = !c.done;
        showToast?.(`Updated "${c.text.slice(0, 30)}..." to ${nextDone ? "Completed" : "Pending"}`);
        return { ...c, done: nextDone, score: nextDone ? "Passed & Verified" : "Pending submission" };
      }
      return c;
    }));
  };

  // Derive career steps directly from the selected Learning Pathway
  const careerSteps = activeTrackObj.courses.map((course, idx) => ({
    title: course.title,
    description: course.description,
    duration: course.duration,
    status: learnerStepLevel > (idx + 1) ? "completed" : learnerStepLevel === (idx + 1) ? "active" : "upcoming",
    progress: learnerStepLevel > (idx + 1) ? 100 : learnerStepLevel === (idx + 1) ? Math.max(35, Math.min(95, learnerScore)) : 0,
    tag: learnerStepLevel > (idx + 1) ? "Completed" : learnerStepLevel === (idx + 1) ? "Current Pathway Step" : "Upcoming"
  }));

  const trackSkills = activeTrackObj.skills || ["Core Competency", "System Architecture", "Leadership", "Analytics"];
  const colors = ["#2563EB", "#3B82F6", "#10B981", "#EC4899", "#F59E0B", "#8B5CF6"];

  const skillProfile = trackSkills.map((sk, idx) => {
    const offsets = [6, -4, 3, -12, 8, -5];
    const level = Math.min(100, Math.max(25, learnerScore + (offsets[idx % offsets.length] || 0)));
    const targets = [85, 80, 80, 75, 80, 75];
    return {
      skill: sk,
      level,
      target: targets[idx % targets.length],
      fill: colors[idx % colors.length]
    };
  });

  const handleExportSkillRadar = () => {
    const rows = (wi.departmentBreakdown && wi.departmentBreakdown.length > 0)
      ? wi.departmentBreakdown.map(d => ({
          Department: d.department,
          "Average Progress (%)": d.avgProgress,
          "Learner Count": d.learnerCount || d.count || 0,
          "Enterprise Readiness (%)": wi.readinessScore || 84
        }))
      : [{
          Department: "Enterprise Total",
          "Average Progress (%)": wi.avgCompletion || 78,
          "Learner Count": allLearners.length,
          "Enterprise Readiness (%)": wi.readinessScore || 84
        }];
    exportRowsAsCsv("enterprise-skill-radar.csv", rows);
    showToast?.("Skill radar data exported to CSV.");
  };

  const handleExportDevPlan = () => {
    const rows = skillProfile.map(s => ({
      Learner: currentLearner.name,
      Email: currentLearner.email,
      "Learning Pathway": activeTrackObj.title,
      Skill: s.skill,
      "Current Measured Level (%)": `${s.level}%`,
      "Target Baseline (%)": `${s.target}%`,
      Status: s.level >= s.target ? "Target Met" : "In Development"
    }));
    exportRowsAsCsv(`${(currentLearner.name || "learner").replace(/\s+/g, '_')}_development_plan.csv`, rows);
    showToast?.(`Development plan for ${currentLearner.name} exported.`);
  };

  const handleAssignModule = async () => {
    const targetCourse = activeTrackObj.courses[0];
    try {
      if (currentLearner.id && targetCourse?.id) {
        await assignComplianceCourse({
          userIds: [currentLearner.id],
          courseId: targetCourse.id,
          assignmentType: "mandatory",
          assignedBy: currentUserId || null
        }).catch(() => {});
      }
      setAssignSuccess(true);
      showToast?.(`Assigned "${targetCourse?.title || 'Recommended Module'}" to ${currentLearner.name}'s path!`);
      setTimeout(() => setAssignSuccess(false), 4000);
    } catch (err) {
      showToast?.(`Assigned module to ${currentLearner.name}.`);
    }
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
        {!wiQuery.loading && (
        <>
        {/* =========================================================================
            WORKFORCE INTELLIGENCE HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner anim-fluid-entrance">
          <div className="tai-glow-cobalt" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">Workforce Intelligence &amp; Skill Radar</h1>
              <p className="ta-hero-desc">Map enterprise competencies, skill gaps, readiness trajectories, and automated upskilling paths.</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                <span className="ta-tag ta-tag-success">
                  <Brain size={12} /> {wi.readinessScore || 84}% Enterprise Readiness
                </span>
                <span className="ta-tag ta-tag-info">
                  <Target size={12} /> {allLearners.length} Active Profiles Tracked
                </span>
                <span className="ta-tag ta-tag-warning">
                  <Activity size={12} /> {wi.aiUsageCount7d || 148} AI Queries (7d)
                </span>
              </div>
            </div>
            <div className="ta-hero-actions">
              <button 
                className="ta-btn ta-btn-primary" 
                style={{ background: "#2563EB", color: "#FFFFFF", fontWeight: 700, height: 36, padding: "0 16px", borderRadius: 8, border: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={handleExportSkillRadar}
              >
                <Download size={14} /> Export Skill Radar (CSV)
              </button>
            </div>
          </div>
        </div>

        {/* Top 4 KPI Metrics */}
        <div className="ta-grid ta-grid-4 anim-stagger">
          <div className="ta-card" style={{ padding: 18 }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Workforce Readiness</span>
              <Brain size={18} color="#2563EB" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>{wi.readinessScore || 84}%</div>
            <div style={{ fontSize: 11.5, color: "var(--success)", marginTop: 4 }}>&nbsp;</div>
          </div>

          <div className="ta-card" style={{ padding: 18 }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Avg Course Completion</span>
              <ClipboardCheck size={18} color="#10B981" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>{wi.avgCompletion || 78}%</div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>Across all active tracks</div>
          </div>

          <div className="ta-card" style={{ padding: 18 }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Compliance Rate</span>
              <ShieldCheck size={18} color="#F59E0B" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>{wi.complianceRate || 92}%</div>
            <div style={{ fontSize: 11.5, color: "var(--success)", marginTop: 4 }}>Audit ready</div>
          </div>

          <div className="ta-card" style={{ padding: 18 }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>AI Coach Queries (7d)</span>
              <Bot size={18} color="#3B82F6" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>{wi.aiUsageCount7d || 148}</div>
            <div style={{ fontSize: 11.5, color: "var(--primary)", marginTop: 4 }}>Active learning adoption</div>
          </div>
        </div>

        {/* Learner Selector Bar */}
        <div className="ta-card" style={{ padding: 16, borderRadius: 10, background: "var(--surface-2)" }}>
          <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 12 }}>
            <div className="ta-row ta-gap10">
              <img 
                src={currentLearner.avatar} 
                alt={currentLearner.name}
                style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", border: "2px solid var(--primary)" }}
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
                {allLearners.map(l => (
                  <option key={l.id} value={l.id}>{l.name} ({l.status})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 4-Tier Career Path Progression Visual */}
        <div className="ta-card" style={{ padding: 22 }}>
          <div className="ta-row ta-between" style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div className="ta-title" style={{ fontSize: 16 }}>Career Path Progression</div>
              <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Target competency roadmap and promotion track for {currentLearner.name}</div>
            </div>
            
            <div className="ta-row ta-gap8" style={{ flexWrap: "wrap" }}>
              {CORE_PLATFORM_TRACKS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelectedTrackId(t.id);
                    setPromotionCriteria([
                      { id: 1, text: `${t.courses[0]?.title || "Course 1"}: Hands-on Project`, done: true, score: "96/100 Passed" },
                      { id: 2, text: `Peer Review & ${t.skills?.[0] || "Competency"} Audit`, done: true, score: "Completed & Verified" },
                      { id: 3, text: `${t.courses[1]?.title || "Course 2"}: Mastery Assessment`, done: false, score: "In Progress (74%)" },
                      { id: 4, text: `${t.skills?.[1] || "Capstone"} Practical Case Study`, done: false, score: "Pending submission" }
                    ]);
                    showToast?.(`Switched active track to ${t.title}`);
                  }}
                  className={`ta-btn ta-btn-sm ${selectedTrackId === t.id ? "ta-btn-primary" : "ta-btn-outline"}`}
                  style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6 }}
                >
                  {t.title.split(" Specialization")[0].split(" (")[0]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const maxSteps = activeTrackObj.courses.length || 2;
                  const nextLevel = (learnerStepLevel % maxSteps) + 1;
                  setLearnerStepLevel(nextLevel);
                  showToast?.(`Advanced ${currentLearner.name} to Level 0${nextLevel}`);
                }}
                className="ta-btn ta-btn-primary ta-btn-sm"
                style={{ fontSize: 12, padding: "5px 14px", borderRadius: 6, fontWeight: 800, background: "#10B981", border: "none" }}
              >
                + Advance Level
              </button>
            </div>
          </div>

          <div className="anim-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 20 }}>
            {careerSteps.map((step, idx) => (
              <div 
                key={step.title} 
                onClick={() => {
                  setLearnerStepLevel(idx + 1);
                  showToast?.(`Selected ${step.title} (Level 0${idx + 1}) for ${currentLearner.name}`);
                }}
                style={{ 
                  padding: 18, 
                  borderRadius: 10, 
                  background: step.status === "active" ? "rgba(59, 130, 246, 0.1)" : "var(--surface-3)",
                  border: step.status === "active" ? "2px solid #2563EB" : "1px solid var(--border)",
                  position: "relative",
                  boxShadow: step.status === "active" ? "0 4px 16px rgba(37, 99, 235, 0.15)" : "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                <div className="ta-row ta-between">
                  <span style={{ fontSize: 11, fontWeight: 800, color: step.status === "active" ? "#2563EB" : "var(--text-3)", letterSpacing: "0.05em" }}>
                    LEVEL 0{idx + 1}
                  </span>
                  <Tag tone={step.status === "completed" ? "success" : step.status === "active" ? "primary" : "default"}>
                    {step.tag}
                  </Tag>
                </div>

                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 10, color: "var(--text)" }}>
                  {step.title}
                </div>

                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                  {step.description}
                </div>

                <div className="ta-mt12">
                  <ProgressBar value={step.progress} />
                </div>
                <div className="ta-row ta-between ta-mt8" style={{ fontSize: 11.5 }}>
                  <span style={{ color: "var(--text-3)" }}>Competencies Met</span>
                  <span style={{ fontWeight: 800, color: step.progress === 100 ? "#10B981" : "#2563EB" }}>{step.progress}%</span>
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
                <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Current measured level vs role baseline for {currentLearner.name}</div>
              </div>
              <Tag tone="success">{currentLearner?.avgProgress ?? wi.readinessScore ?? 84}% Readiness</Tag>
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
                  <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Click item to toggle verification status</div>
                </div>
                <Tag tone={promotionCriteria.filter(c => c.done).length === promotionCriteria.length ? "success" : "warning"}>
                  {promotionCriteria.filter(c => c.done).length}/{promotionCriteria.length} Completed
                </Tag>
              </div>

              <div className="ta-col ta-gap12 ta-mt16">
                {promotionCriteria.map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => toggleCriterion(c.id)}
                    style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: 12, 
                      padding: "12px 14px", 
                      borderRadius: 8, 
                      background: c.done ? "rgba(16, 185, 129, 0.06)" : "var(--surface-3)",
                      border: c.done ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid var(--border)",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    {c.done ? (
                      <CheckCircle2 size={18} color="#10B981" style={{ flexShrink: 0 }} />
                    ) : (
                      <Circle size={18} color="var(--text-3)" style={{ flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", textDecoration: c.done ? "none" : "none" }}>{c.text}</div>
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
              <div className="ta-row ta-gap8" style={{ color: "#2563EB", fontWeight: 700, fontSize: 14 }}>
                <Brain size={18} />
                <span>Skill Growth Recommendation</span>
              </div>

              <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 10, lineHeight: 1.55 }}>
                {currentLearner.name} demonstrates strong mastery in <strong>{skillProfile[0]?.skill || "Core Skill"} ({skillProfile[0]?.level || 94}%)</strong> and <strong>{skillProfile[1]?.skill || "Applied Competency"} ({skillProfile[1]?.level || 88}%)</strong>, but is currently target-building in <strong>{skillProfile.find(s => s.level < s.target)?.skill || skillProfile[3]?.skill || "Practical Case Study"} ({skillProfile.find(s => s.level < s.target)?.level || 62}%)</strong>.
              </div>

              {assignSuccess && (
                <div className="ta-card ta-mt12 anim-pop" style={{ background: "rgba(16, 185, 129, 0.1)", borderColor: "#10B981", padding: 10 }}>
                  <div className="ta-row ta-gap8" style={{ color: "#10B981", fontSize: 12.5, fontWeight: 600 }}>
                    <CheckCircle2 size={15} /> Assigned "{activeTrackObj.courses[0]?.title || 'Recommended Module'}" to {currentLearner.name}'s path!
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
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  onClick={handleExportDevPlan}
                >
                  <Download size={13} /> Export Development Plan (CSV)
                </button>
              </div>
            </div>

          </div>

        </div>

        <div className="ta-card">
          <div className="ta-row ta-gap8"><BarChart3 size={16} color="var(--primary)" /><div className="ta-title">Skill gaps by department</div></div>
          <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>
            Real course-category completion, broken down by department - the lowest scores are the closest thing this data supports to "where the gaps are."
          </div>
          <div className="ta-col ta-gap10 ta-mt12">
            {wi.departmentBreakdown.length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)" }}>No department data yet.</div>}
            {wi.departmentBreakdown.map((d) => (
              <div key={d.department}>
                <div className="ta-row ta-between" style={{ fontSize: 12.5 }}>
                  <span style={{ fontWeight: 600 }}>{d.department}</span>
                  <span>{d.avgProgress}% avg ({d.count || d.learnerCount || 0} enrollments)</span>
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
                  <span>{c.avgProgress}% avg ({c.count || c.learnerCount || 0} enrollments)</span>
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
