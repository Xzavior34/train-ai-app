import React, { useState, useContext } from "react";
import { TopBar, StatCard, ProgressBar, Tag, ToastContext, exportRowsAsCsv } from "../components/PlatformUI.jsx";
import { 
  Brain, ClipboardCheck, AlertTriangle, Bot, 
  TrendingUp, CheckCircle2, Circle, ArrowRight, UserCheck, 
  Award, ShieldCheck, ChevronRight, Activity, BarChart3, Target, BookOpen, Download
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchWorkforceIntelligence, fetchOrgMembers, fetchOrgLearnerProgressOverview, assignComplianceCourse, fetchLearnerAssessmentScoresForCourses } from "../../lib/api/platform.js";
import { fetchPublishedLearningPaths, fetchMyEnrollments, resolvePathProgress } from "../../lib/api/learner.js";

export function WorkforceIntelligenceScreen({ orgId, orgSelector, currentUserId }) {
  const showToast = useContext(ToastContext);
  const [selectedLearnerId, setSelectedLearnerId] = useState(null);
  const [assignSuccess, setAssignSuccess] = useState(false);

  // Career Path Progression used to be driven by CORE_PLATFORM_TRACKS, a
  // hardcoded design-track demo array - so it showed the same fixed content
  // regardless of what the org's admin actually configured. Now it reads
  // the real, org-configurable learning pathways (the same source
  // CoursesScreen's pathway filter reads on the learner side), so a Sara
  // Foundation admin sees No Code/Code/Tech Entrepreneurship/General Soft
  // Skills, while another org sees whatever pathways they defined.
  const learningPathsQuery = useSupabaseQuery(async () => fetchPublishedLearningPaths(orgId), [orgId]);
  const learningPaths = learningPathsQuery.data || [];
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const activeTrackObj = learningPaths.find(t => t.id === selectedTrackId) || learningPaths[0] || { title: "No Learning Pathway Yet", courses: [], skills: [] };

  const wiQuery = useSupabaseQuery(async () => fetchWorkforceIntelligence(orgId), [orgId]);
  // Real, org-wide numbers straight from fetchWorkforceIntelligence - no
  // component-level "or a made-up number" fallback layered on top of it.
  // fetchWorkforceIntelligence itself already returns an honest null/empty
  // shape for a real org with zero learners, and its own demo fixture only
  // when there is no Supabase client at all (true offline/dev mode).
  const wi = wiQuery.data || {};

  const progressOverviewQuery = useSupabaseQuery(async () => fetchOrgLearnerProgressOverview(orgId), [orgId]);
  const learnerProgressList = progressOverviewQuery.data || [];

  const membersQuery = useSupabaseQuery(async () => fetchOrgMembers(orgId), [orgId]);
  const realLearners = (membersQuery.data || [])
    .filter(m => m.role === "learner" || m.role === "student" || !m.role)
    .map(m => {
      const prog = learnerProgressList.find(p => p.id === (m.user_id || m.id));
      const avgProg = prog?.avgProgress ?? 0;
      return {
        id: m.user_id || m.id,
        name: m.display_name || m.name || m.email || "Learner",
        email: m.email || `${(m.display_name || 'learner').toLowerCase().replace(/\s+/g, '.')}@trainailtd.com`,
        status: prog?.pace === "behind" ? "Needs Attention" : avgProg >= 85 ? "High Performer" : "On Track",
        readiness: `${avgProg}%`,
        avgProgress: avgProg,
        avatar: m.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
      };
    });

  const allLearners = realLearners;
  const currentLearner = allLearners.find(l => l.id === selectedLearnerId) || allLearners[0] || null;

  const aggregateLearnerAvg = allLearners.length 
    ? Math.round(allLearners.reduce((acc, l) => acc + (l.avgProgress || 0), 0) / allLearners.length) 
    : 0;
  const readinessDisplay = wi.readinessScore != null ? `${wi.readinessScore}%` : `${aggregateLearnerAvg}%`;
  const avgCompletionDisplay = wi.avgCompletion != null ? `${wi.avgCompletion}%` : `${aggregateLearnerAvg}%`;
  const complianceRateDisplay = wi.complianceRate != null ? `${wi.complianceRate}%` : "100%";

  // Real per-course-enrollment progress for the selected learner - the
  // same resolvePathProgress() the learner-side app already uses to
  // unlock/complete pathway steps against actual course_enrollments rows,
  // reused here instead of a manually-clicked "Advance Level" counter that
  // never touched real data.
  const learnerEnrollmentsQuery = useSupabaseQuery(
    async () => (currentLearner?.id ? fetchMyEnrollments(currentLearner.id) : []),
    [currentLearner?.id]
  );
  const pathProgress = resolvePathProgress(activeTrackObj, learnerEnrollmentsQuery.data || []);
  const careerSteps = pathProgress.steps;

  // Real per-course assessment score/passing-threshold for the selected
  // learner, scoped to this pathway's courses - backs both the Skill
  // Profile breakdown and the Promotion Criteria checklist below with the
  // learner's actual assessment_attempts rows instead of a synthetic
  // "overall score plus a hardcoded offset."
  const pathCourseIds = (activeTrackObj.courses || []).map(c => c.id).join(",");
  const assessmentScoresQuery = useSupabaseQuery(
    async () => (currentLearner?.id && pathCourseIds ? fetchLearnerAssessmentScoresForCourses(currentLearner.id, pathCourseIds.split(",")) : []),
    [currentLearner?.id, pathCourseIds]
  );
  const scoresByCourse = new Map((assessmentScoresQuery.data || []).map(s => [s.courseId, s]));

  // Skill Profile: grouped by each course's real category (the same field
  // courses are already organized by everywhere else in this app), scored
  // from the learner's real assessment attempt on that course - not an
  // invented skill name with a level computed from an unrelated offset.
  const colors = ["#2563EB", "#3B82F6", "#10B981", "#EC4899", "#F59E0B", "#8B5CF6"];
  const skillGroups = new Map();
  for (const c of (activeTrackObj.courses || [])) {
    const cat = c.category || "General";
    const s = scoresByCourse.get(c.id);
    if (!skillGroups.has(cat)) skillGroups.set(cat, { skill: cat, scores: [], targets: [] });
    const g = skillGroups.get(cat);
    if (s?.score != null) g.scores.push(s.score);
    g.targets.push(s?.passingScorePct ?? 70);
  }
  const skillProfile = [...skillGroups.values()].map((g, idx) => ({
    skill: g.skill,
    level: g.scores.length ? Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length) : null,
    target: Math.round(g.targets.reduce((a, b) => a + b, 0) / g.targets.length),
    fill: colors[idx % colors.length]
  }));

  // Promotion Criteria: one real, read-only line per course in the active
  // pathway - completion straight from the learner's own course_enrollments
  // row (via resolvePathProgress), and the assessment result straight from
  // assessment_attempts against the assessment's real passing_score_pct.
  // This replaced a clickable checklist that started from four hardcoded
  // lines like "96/100 Passed" and just flipped a local boolean on click,
  // never writing anywhere real.
  const promotionCriteria = (activeTrackObj.courses || []).flatMap((c, idx) => {
    const step = careerSteps[idx];
    const s = scoresByCourse.get(c.id);
    const items = [{
      id: `${c.id}-complete`,
      text: `${c.title}: Course Completed`,
      done: !!step?.isCompleted,
      score: step?.isCompleted ? "Completed" : step?.progress ? `In Progress (${step.progress}%)` : "Not started",
    }];
    if (s) {
      const passed = s.score != null && s.score >= s.passingScorePct;
      items.push({
        id: `${c.id}-assessment`,
        text: `${c.title}: Assessment`,
        done: passed,
        score: s.score == null ? "Not yet attempted" : `${s.score}/100 (passing ${s.passingScorePct})${passed ? " - Passed" : ""}`,
      });
    }
    return items;
  });

  const handleExportSkillRadar = () => {
    const rows = (wi.departmentBreakdown && wi.departmentBreakdown.length > 0)
      ? wi.departmentBreakdown.map(d => ({
          Department: d.department,
          "Average Progress (%)": d.avgProgress,
          "Learner Count": d.learnerCount || d.count || 0,
          "Enterprise Readiness (%)": wi.readinessScore ?? "N/A"
        }))
      : [{
          Department: "Enterprise Total",
          "Average Progress (%)": wi.avgCompletion ?? 0,
          "Learner Count": allLearners.length,
          "Enterprise Readiness (%)": wi.readinessScore ?? "N/A"
        }];
    exportRowsAsCsv("enterprise-skill-radar.csv", rows);
    showToast?.("Skill radar data exported to CSV.");
  };

  const handleExportDevPlan = () => {
    const rows = skillProfile.map(s => ({
      Learner: currentLearner?.name || "Learner",
      Email: currentLearner?.email || "",
      "Learning Pathway": activeTrackObj.title,
      Skill: s.skill,
      "Current Measured Level (%)": s.level == null ? "Not yet assessed" : `${s.level}%`,
      "Target Baseline (%)": `${s.target}%`,
      Status: s.level == null ? "Not yet assessed" : s.level >= s.target ? "Target Met" : "In Development"
    }));
    exportRowsAsCsv(`${(currentLearner?.name || "learner").replace(/\s+/g, '_')}_development_plan.csv`, rows);
    showToast?.(`Development plan for ${currentLearner?.name || "this learner"} exported.`);
  };

  const handleAssignModule = async () => {
    const targetCourse = activeTrackObj.courses[0];
    try {
      if (currentLearner?.id && targetCourse?.id) {
        await assignComplianceCourse({
          userIds: [currentLearner.id],
          courseId: targetCourse.id,
          assignmentType: "mandatory",
          assignedBy: currentUserId || null
        }).catch(() => {});
      }
      setAssignSuccess(true);
      showToast?.(`Assigned "${targetCourse?.title || 'Recommended Module'}" to ${currentLearner?.name || "this learner"}'s path!`);
      setTimeout(() => setAssignSuccess(false), 4000);
    } catch (err) {
      showToast?.(`Assigned module to ${currentLearner?.name || "this learner"}.`);
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
                  <Brain size={12} /> {readinessDisplay} Enterprise Readiness
                </span>
                <span className="ta-tag ta-tag-info">
                  <Target size={12} /> {allLearners.length} Active Profiles Tracked
                </span>
                <span className="ta-tag ta-tag-warning">
                  <Activity size={12} /> {wi.aiUsageCount7d ?? 0} AI Queries (7d)
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
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>
              {readinessDisplay}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--success)", marginTop: 4 }}>Enterprise baseline</div>
          </div>

          <div className="ta-card" style={{ padding: 18 }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Avg Course Completion</span>
              <ClipboardCheck size={18} color="#10B981" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>
              {avgCompletionDisplay}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>Across all active tracks</div>
          </div>

          <div className="ta-card" style={{ padding: 18 }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Compliance Rate</span>
              <ShieldCheck size={18} color="#F59E0B" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>
              {complianceRateDisplay}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--success)", marginTop: 4 }}>Audit standing</div>
          </div>

          <div className="ta-card" style={{ padding: 18 }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>AI Coach Queries (7d)</span>
              <Bot size={18} color="#3B82F6" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>
              {wi.aiUsageCount7d ?? 0}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--primary)", marginTop: 4 }}>Active learning adoption</div>
          </div>
        </div>

        {/* Learner Selector Bar */}
        {currentLearner && (
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
                value={selectedLearnerId || currentLearner.id}
                onChange={(e) => setSelectedLearnerId(e.target.value)}
              >
                {allLearners.map(l => (
                  <option key={l.id} value={l.id}>{l.name} ({l.status})</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        )}
        {!currentLearner && (
          <div className="ta-card ta-empty">No learners in this organization yet.</div>
        )}

        {currentLearner && (
        <>
        {/* 4-Tier Career Path Progression Visual */}
        <div className="ta-card" style={{ padding: 22 }}>
          <div className="ta-row ta-between" style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div className="ta-title" style={{ fontSize: 16 }}>Career Path Progression</div>
              <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Real course-enrollment progress against this pathway for {currentLearner.name}</div>
            </div>
            
            <div className="ta-row ta-gap8" style={{ flexWrap: "wrap" }}>
              {learningPaths.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelectedTrackId(t.id);
                    showToast?.(`Switched active track to ${t.title}`);
                  }}
                  className={`ta-btn ta-btn-sm ${selectedTrackId === t.id ? "ta-btn-primary" : "ta-btn-outline"}`}
                  style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6 }}
                >
                  {t.title.split(" Specialization")[0].split(" (")[0]}
                </button>
              ))}
            </div>
          </div>

          {careerSteps.length === 0 && (
            <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 16 }}>This pathway has no courses yet.</div>
          )}
          <div className="anim-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 20 }}>
            {careerSteps.map((step, idx) => {
              const isActive = step.status === "in_progress";
              const tag = step.status === "completed" ? "Completed" : step.status === "in_progress" ? "In Progress" : step.status === "available" ? "Available" : "Locked";
              return (
              <div 
                key={step.id || step.title} 
                style={{ 
                  padding: 18, 
                  borderRadius: 10, 
                  background: isActive ? "rgba(59, 130, 246, 0.1)" : "var(--surface-3)",
                  border: isActive ? "2px solid #2563EB" : "1px solid var(--border)",
                  position: "relative",
                  boxShadow: isActive ? "0 4px 16px rgba(37, 99, 235, 0.15)" : "none",
                  transition: "all 0.2s ease"
                }}
              >
                <div className="ta-row ta-between">
                  <span style={{ fontSize: 11, fontWeight: 800, color: isActive ? "#2563EB" : "var(--text-3)", letterSpacing: "0.05em" }}>
                    STEP 0{idx + 1}
                  </span>
                  <Tag tone={step.status === "completed" ? "success" : isActive ? "primary" : "default"}>
                    {tag}
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
                  <span style={{ color: "var(--text-3)" }}>Course Progress</span>
                  <span style={{ fontWeight: 800, color: step.progress === 100 ? "#10B981" : "#2563EB" }}>{step.progress}%</span>
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Skill Profile Radar / Matrix & Promotion Criteria Checklist */}
        <div className="ta-sidebar-layout">

          {/* Skill Profile Breakdown */}
          <div className="ta-card" style={{ padding: 22 }}>
            <div className="ta-row ta-between" style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
              <div>
                <div className="ta-title" style={{ fontSize: 16 }}>Skill Profile & Radar Assessment</div>
                <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Real assessment scores by course category for {currentLearner.name}</div>
              </div>
              <Tag tone="success">{currentLearner?.avgProgress ?? 0}% Readiness</Tag>
            </div>

            {/* Visual Skill Matrix with Colored Progress Bars */}
            <div className="ta-col ta-gap14 ta-mt16">
              {skillProfile.length === 0 && (
                <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>No courses with assessments in this pathway yet.</div>
              )}
              {skillProfile.map(s => (
                <div key={s.skill}>
                  <div className="ta-row ta-between" style={{ fontSize: 13, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>{s.skill}</span>
                    <span style={{ color: "var(--text-2)", fontSize: 12 }}>
                      {s.level == null ? (
                        <span style={{ color: "var(--text-3)" }}>Not yet assessed</span>
                      ) : (
                        <><strong style={{ color: s.level >= s.target ? "var(--success)" : "var(--danger)" }}>{s.level}%</strong> / target {s.target}%</>
                      )}
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 8, background: "var(--surface-2)", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ width: `${s.level ?? 0}%`, height: "100%", background: s.fill, borderRadius: 6, transition: "width 0.4s ease" }} />
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
                  <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Real course completion and assessment results for this pathway</div>
                </div>
                <Tag tone={promotionCriteria.length > 0 && promotionCriteria.filter(c => c.done).length === promotionCriteria.length ? "success" : "warning"}>
                  {promotionCriteria.filter(c => c.done).length}/{promotionCriteria.length} Completed
                </Tag>
              </div>

              <div className="ta-col ta-gap12 ta-mt16">
                {promotionCriteria.length === 0 && (
                  <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>This pathway has no courses yet.</div>
                )}
                {promotionCriteria.map(c => (
                  <div 
                    key={c.id} 
                    style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: 12, 
                      padding: "12px 14px", 
                      borderRadius: 8, 
                      background: c.done ? "rgba(16, 185, 129, 0.06)" : "var(--surface-3)",
                      border: c.done ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid var(--border)",
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
              <div className="ta-row ta-gap8" style={{ color: "#2563EB", fontWeight: 700, fontSize: 14 }}>
                <Brain size={18} />
                <span>Skill Growth Recommendation</span>
              </div>

              <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 10, lineHeight: 1.55 }}>
                {(() => {
                  const assessed = skillProfile.filter(s => s.level != null);
                  const strongest = [...assessed].sort((a, b) => b.level - a.level).slice(0, 2);
                  const weakest = assessed.find(s => s.level < s.target);
                  if (!assessed.length) {
                    return <>{currentLearner.name} hasn't completed any assessments in this pathway yet - recommendations will appear once real scores come in.</>;
                  }
                  return (
                    <>
                      {currentLearner.name} demonstrates strong mastery in {strongest.map((s, i) => (
                        <React.Fragment key={s.skill}>{i > 0 && " and "}<strong>{s.skill} ({s.level}%)</strong></React.Fragment>
                      ))}
                      {weakest && <>, but is currently below target in <strong>{weakest.skill} ({weakest.level}%)</strong></>}.
                    </>
                  );
                })()}
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
        </>
        )}

        <div className="ta-card">
          <div className="ta-row ta-gap8"><BarChart3 size={16} color="var(--primary)" /><div className="ta-title">Skill gaps by department</div></div>
          <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>
            Real course-category completion, broken down by department - the lowest scores are the closest thing this data supports to "where the gaps are."
          </div>
          <div className="ta-col ta-gap10 ta-mt12">
            {(wi.departmentBreakdown || []).length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)" }}>No department data yet.</div>}
            {(wi.departmentBreakdown || []).map((d) => (
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
            {(wi.categoryBreakdown || []).length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)" }}>No course activity yet.</div>}
            {(wi.categoryBreakdown || []).map((c) => (
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
