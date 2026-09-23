import React, { useState, useContext } from "react";
import { TopBar, StatCard, ProgressBar, Tag, ToastContext, exportRowsAsCsv, Avatar } from "../components/PlatformUI.jsx";
import { 
  Brain, ClipboardCheck, AlertTriangle, Bot, 
  TrendingUp, CheckCircle2, Circle, ArrowRight, UserCheck, 
  Award, ShieldCheck, ChevronRight, Activity, BarChart3, Target, BookOpen, Download,
  ExternalLink, Eye, Filter, PlusCircle, ArrowUpRight, Lock, Zap
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { orgHasFeature, minTierLabelFor, getTierDisplayName } from "../../lib/tierFeatures.js";
import { fetchOrgFeatures } from "../../lib/api/organizations.js";
import { 
  fetchWorkforceIntelligence, 
  fetchOrgMembers, 
  fetchOrgLearnerProgressOverview, 
  assignComplianceCourse, 
  fetchLearnerAssessmentScoresForCourses,
  createInAppNotificationsForUsers,
  fetchOrganizationById
} from "../../lib/api/platform.js";
import { 
  fetchPublishedLearningPaths, 
  fetchMyEnrollments, 
  resolvePathProgress,
  enrollInCourse
} from "../../lib/api/learner.js";

export function WorkforceIntelligenceScreen({ orgId, orgSelector, currentUserId, setScreen, setSelectedCourseId, isPlatformOwner = false }) {
  const showToast = useContext(ToastContext);
  const orgQuery = useSupabaseQuery(async () => (orgId ? fetchOrganizationById(orgId) : null), [orgId]);
  const featuresQuery = useSupabaseQuery(async () => (orgId ? fetchOrgFeatures(orgId) : null), [orgId]);
  const orgTier = orgQuery.data?.subscription_tier || "starter";
  const canUseWorkforce = isPlatformOwner || (featuresQuery.data ? !!featuresQuery.data.ai_intelligence_advanced : orgHasFeature(orgTier, "ai_intelligence_advanced"));

  const [selectedLearnerId, setSelectedLearnerId] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [assignSuccess, setAssignSuccess] = useState(null);
  const [assigningCourseId, setAssigningCourseId] = useState(null);
  const [selectedCourseToAssign, setSelectedCourseToAssign] = useState("");

  // Career Path Progression used to be driven by CORE_PLATFORM_TRACKS, a
  // hardcoded design-track demo array - so it showed the same fixed content
  // regardless of what the org's admin actually configured. Now it reads
  // the real, org-configurable learning pathways (the same source
  // CoursesScreen's pathway filter reads on the learner side), so a Sara
  // Foundation admin sees No Code/Code/Tech Entrepreneurship/General Soft
  // Skills, while another org sees whatever pathways they defined.
  const learningPathsQuery = useSupabaseQuery(async () => fetchPublishedLearningPaths(orgId), [orgId]);
  const rawLearningPaths = learningPathsQuery.data || [];
  // This used to fall back to a fabricated "AI & Machine Learning Track"
  // with three made-up courses whenever an org had zero published learning
  // paths - every brand-new org silently saw fake pathway content that
  // didn't exist in their catalog. Falling back to a real, honestly-empty
  // placeholder instead (0 courses) keeps every downstream .courses/.title
  // access below working without a null-check rewrite, while making the
  // "no pathways configured yet" empty state visible instead of hidden
  // behind fake data (same HAS_DATABASE/liveOr convention used elsewhere -
  // an empty real result is never papered over with fabricated content).
  const NO_PATHWAY_PLACEHOLDER = {
    id: "no-pathway-configured",
    title: "No Learning Pathways Yet",
    description: "This organization hasn't published a learning pathway yet. Create one in Learning Paths to see career-progression tracking here.",
    category: null,
    courses: [],
  };
  const learningPaths = rawLearningPaths.length > 0 ? rawLearningPaths : [NO_PATHWAY_PLACEHOLDER];
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const activeTrackObj = (learningPaths.find(t => t.id === selectedTrackId && t.courses?.length > 0)) || learningPaths.find(t => t.courses?.length > 0) || learningPaths[0] || NO_PATHWAY_PLACEHOLDER;

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
        email: m.email || "",
        department: m.department || "General",
        status: prog?.pace === "behind" ? "Needs Attention" : avgProg >= 85 ? "High Performer" : "On Track",
        readiness: `${avgProg}%`,
        avgProgress: avgProg,
        avatar: m.avatar_url || null
      };
    });

  const departments = ["all", ...new Set(realLearners.map(l => l.department).filter(Boolean))];
  const allLearners = selectedDepartment === "all" 
    ? realLearners 
    : realLearners.filter(l => l.department === selectedDepartment);
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
  const promotionCriteria = (activeTrackObj.courses || []).flatMap((c, idx) => {
    const step = careerSteps[idx];
    const s = scoresByCourse.get(c.id);
    const items = [{
      id: `${c.id}-complete`,
      courseId: c.id,
      courseTitle: c.title,
      text: `${c.title}: Course Completed`,
      done: !!step?.isCompleted,
      score: step?.isCompleted ? "Completed" : step?.progress ? `In Progress (${step.progress}%)` : "Not started",
      isCourseCompletion: true,
    }];
    if (s) {
      const passed = s.score != null && s.score >= s.passingScorePct;
      items.push({
        id: `${c.id}-assessment`,
        courseId: c.id,
        courseTitle: c.title,
        text: `${c.title}: Assessment`,
        done: passed,
        score: s.score == null ? "Not yet attempted" : `${s.score}/100 (passing ${s.passingScorePct})${passed ? " - Passed" : ""}`,
        isCourseCompletion: false,
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

  // Smart recommended target course:
  // First incomplete course in the active pathway, or fallback to first course
  const firstIncompleteIdx = (activeTrackObj.courses || []).findIndex((c, idx) => !careerSteps[idx]?.isCompleted);
  const firstIncompleteCourse = firstIncompleteIdx !== -1 ? activeTrackObj.courses[firstIncompleteIdx] : (activeTrackObj.courses?.[0] || null);
  const targetCourse = (activeTrackObj.courses || []).find(c => c.id === selectedCourseToAssign) || firstIncompleteCourse;

  const handleAssignModule = async (courseToAssign = targetCourse) => {
    if (!currentLearner?.id || !courseToAssign?.id) {
      showToast?.("No course or learner selected to assign.");
      return;
    }
    setAssigningCourseId(courseToAssign.id);
    try {
      // 1. Assign to compliance_assignments (mandatory training)
      await assignComplianceCourse({
        userIds: [currentLearner.id],
        courseId: courseToAssign.id,
        assignmentType: "mandatory",
        assignedBy: currentUserId || null
      });

      // 2. Formally enroll learner in course_enrollments
      await enrollInCourse(currentLearner.id, courseToAssign.id).catch(err => {
        console.warn("Auto-enrollment notice:", err);
      });

      // 3. Dispatch real in-app notification to learner in real_notifications
      await createInAppNotificationsForUsers([currentLearner.id], {
        title: `New Module Assigned: ${courseToAssign.title}`,
        message: `Your organization administrator assigned you to "${courseToAssign.title}" as part of your "${activeTrackObj.title}" pathway.`,
        actionUrl: "/courses"
      }).catch(err => {
        console.warn("Notification dispatch notice:", err);
      });

      // 4. Refetch all queries so UI updates immediately across the board
      learnerEnrollmentsQuery.refetch();
      wiQuery.refetch();
      progressOverviewQuery.refetch();

      setAssignSuccess(courseToAssign.title);
      showToast?.(`Assigned "${courseToAssign.title}" to ${currentLearner.name}!`);
      setTimeout(() => setAssignSuccess(null), 5000);
    } catch (err) {
      console.error("Failed to assign module:", err);
      showToast?.(err?.message || `Failed to assign module to ${currentLearner.name}.`);
    } finally {
      setAssigningCourseId(null);
    }
  };

  if (orgId && !orgQuery.loading && !canUseWorkforce) {
    return (
      <div className="ta-fade">
        <TopBar 
          title="Workforce Intelligence & Growth" 
          sub="Readiness analytics, promotion criteria, skill profiles, and career progression." 
          orgSelector={orgSelector} 
        />
        <div className="ta-content">
          <div className="ta-card" style={{ textAlign: "center", padding: "48px 24px", maxWidth: 640, margin: "20px auto" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(59, 130, 246, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Lock size={26} color="var(--primary)" />
            </div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text)" }}>
              Workforce Intelligence is an {minTierLabelFor("ai_intelligence_advanced")} Feature
            </div>
            <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 8, lineHeight: 1.5 }}>
              Your organization is currently on the <strong>{getTierDisplayName(orgTier)}</strong> plan. Upgrade to <strong>{minTierLabelFor("ai_intelligence_advanced")}</strong> to unlock enterprise skill gap radars, promotion criteria checklists, department readiness analytics, and automated upskilling paths.
            </div>
            <div style={{ marginTop: 20, display: "flex", justifyContent: "center", gap: 10 }}>
              <button
                className="ta-btn ta-btn-primary"
                onClick={() => setScreen?.("settings")}
                style={{ padding: "10px 20px", display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <Zap size={14} /> Upgrade to {minTierLabelFor("ai_intelligence_advanced")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
        {/* =========================================================================
            WORKFORCE INTELLIGENCE HERO BANNER WITH INTEGRATED KPI METRIC CARDS
            ========================================================================= */}
        <div className="ta-hero-banner anim-fluid-entrance" style={{ borderRadius: 14, overflow: "hidden", padding: "20px 22px" }}>
          <div className="tai-glow-cobalt" />
          <div className="ta-hero-inner" style={{ marginBottom: 18 }}>
            <div className="ta-hero-text">
              <h1 className="ta-hero-title" style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Workforce Intelligence &amp; Skill Radar</h1>
              <p className="ta-hero-desc" style={{ marginTop: 6, fontSize: 13, color: "rgba(255, 255, 255, 0.85)" }}>Map enterprise competencies, skill gaps, readiness trajectories, and automated upskilling paths.</p>
            </div>
            <div className="ta-hero-actions">
              <button 
                className="ta-btn ta-btn-primary" 
                style={{ background: "var(--primary, #2563EB)", color: "#FFFFFF", fontWeight: 700, height: 36, padding: "0 16px", borderRadius: 8, border: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={handleExportSkillRadar}
              >
                <Download size={14} /> Export Skill Radar (CSV)
              </button>
            </div>
          </div>

          {/* Neatly & Visibly Displayed Integrated Hero Metric Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, position: "relative", zIndex: 1 }}>
            <div 
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 12,
                padding: "14px 16px",
                cursor: setScreen ? "pointer" : "default"
              }}
              onClick={() => setScreen?.("analytics")}
              title={setScreen ? "Click to view Enterprise Analytics" : undefined}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "rgba(255, 255, 255, 0.8)", fontSize: 12, fontWeight: 600 }}>
                <span>Workforce Readiness</span>
                <Brain size={16} color="#60A5FA" />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#FFFFFF", marginTop: 6 }}>
                {readinessDisplay}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, marginTop: 4, color: "#34D399" }}>
                <span>Enterprise baseline</span>
                {setScreen && <ArrowUpRight size={13} color="rgba(255, 255, 255, 0.6)" />}
              </div>
            </div>

            <div 
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 12,
                padding: "14px 16px",
                cursor: setScreen ? "pointer" : "default"
              }}
              onClick={() => setScreen?.("compliance")}
              title={setScreen ? "Click to view Course Compliance Tracker" : undefined}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "rgba(255, 255, 255, 0.8)", fontSize: 12, fontWeight: 600 }}>
                <span>Avg Course Completion</span>
                <ClipboardCheck size={16} color="#34D399" />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#FFFFFF", marginTop: 6 }}>
                {avgCompletionDisplay}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, marginTop: 4, color: "rgba(255, 255, 255, 0.7)" }}>
                <span>Across all active tracks</span>
                {setScreen && <ArrowUpRight size={13} color="rgba(255, 255, 255, 0.6)" />}
              </div>
            </div>

            <div 
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 12,
                padding: "14px 16px",
                cursor: setScreen ? "pointer" : "default"
              }}
              onClick={() => setScreen?.("compliance")}
              title={setScreen ? "Click to view Compliance & Mandatory Training" : undefined}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "rgba(255, 255, 255, 0.8)", fontSize: 12, fontWeight: 600 }}>
                <span>Compliance Rate</span>
                <ShieldCheck size={16} color="#FBBF24" />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#FFFFFF", marginTop: 6 }}>
                {complianceRateDisplay}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, marginTop: 4, color: "#34D399" }}>
                <span>Audit standing</span>
                {setScreen && <ArrowUpRight size={13} color="rgba(255, 255, 255, 0.6)" />}
              </div>
            </div>

            <div 
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 12,
                padding: "14px 16px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "rgba(255, 255, 255, 0.8)", fontSize: 12, fontWeight: 600 }}>
                <span>AI Coach Queries (7d)</span>
                <Bot size={16} color="#93C5FD" />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#FFFFFF", marginTop: 6 }}>
                {wi.aiUsageCount7d ?? 0}
              </div>
              <div style={{ fontSize: 11.5, color: "#60A5FA", marginTop: 4 }}>
                Active learning adoption
              </div>
            </div>
          </div>
        </div>

        {/* Learner Selector Bar with Department Filter */}
        {currentLearner && (
        <div className="ta-card" style={{ padding: 16, borderRadius: 10, background: "var(--surface-2)" }}>
          <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 12 }}>
            <div className="ta-row ta-gap10">
              <Avatar 
                src={currentLearner.avatar} 
                initials={(currentLearner.name || "L").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                size={44}
                style={{ borderRadius: 8, fontSize: 16, fontWeight: 700, border: "2px solid var(--primary)" }}
              />
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>
                  {currentLearner.name}
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", marginLeft: 8, padding: "2px 8px", background: "var(--surface-3)", borderRadius: 12 }}>
                    {currentLearner.department}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                  {currentLearner.email ? `${currentLearner.email} • ` : ""}{currentLearner.status}
                </div>
              </div>
            </div>

            <div className="ta-row ta-gap8" style={{ flexWrap: "wrap" }}>
              {departments.length > 2 && (
                <div className="ta-row ta-gap6">
                  <Filter size={14} color="var(--text-3)" />
                  <select
                    className="ta-input"
                    style={{ padding: "6px 10px", fontSize: 12, borderRadius: 8 }}
                    value={selectedDepartment}
                    onChange={(e) => {
                      setSelectedDepartment(e.target.value);
                      setSelectedLearnerId(null);
                    }}
                  >
                    <option value="all">All Departments ({realLearners.length})</option>
                    {departments.filter(d => d !== "all").map(dept => (
                      <option key={dept} value={dept}>{dept} ({realLearners.filter(l => l.department === dept).length})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="ta-row ta-gap6">
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-2)" }}>Learner:</span>
                <select
                  className="ta-input"
                  style={{ minWidth: "min(200px, 100%)", flex: "1 1 auto", padding: "6px 12px", borderRadius: 8 }}
                  value={selectedLearnerId || currentLearner.id}
                  onChange={(e) => setSelectedLearnerId(e.target.value)}
                >
                  {allLearners.map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l.department} • {l.status})</option>
                  ))}
                </select>
              </div>

              {setScreen && (
                <button
                  className="ta-btn ta-btn-outline ta-btn-sm"
                  style={{ padding: "6px 12px", fontSize: 12, borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 5 }}
                  onClick={() => setScreen("people")}
                  title="Manage users in People screen"
                >
                  <UserCheck size={13} /> People Directory →
                </button>
              )}
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
              {setScreen && (
                <button
                  type="button"
                  onClick={() => setScreen("paths")}
                  className="ta-btn ta-btn-outline ta-btn-sm"
                  style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 5 }}
                >
                  <BookOpen size={13} /> Manage Pathways →
                </button>
              )}
            </div>
          </div>

          {careerSteps.length === 0 && (
            <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 16 }}>
              This pathway has no courses yet. {setScreen && <button className="ta-btn ta-btn-outline ta-btn-xs" style={{ marginLeft: 8 }} onClick={() => setScreen("paths")}>Add Courses in Learning Paths</button>}
            </div>
          )}
          <div className="anim-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 20 }}>
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
                  border: isActive ? "2px solid var(--primary, #2563EB)" : "1px solid var(--border)",
                  position: "relative",
                  boxShadow: isActive ? "0 4px 16px rgba(37, 99, 235, 0.15)" : "none",
                  transition: "all 0.2s ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between"
                }}
              >
                <div>
                  <div className="ta-row ta-between">
                    <span style={{ fontSize: 11, fontWeight: 800, color: isActive ? "var(--primary, #2563EB)" : "var(--text-3)", letterSpacing: "0.05em" }}>
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
                    <span style={{ fontWeight: 800, color: step.progress === 100 ? "#10B981" : "var(--primary, #2563EB)" }}>{step.progress}%</span>
                  </div>
                </div>

                {/* Step Action Buttons */}
                <div className="ta-row ta-gap8 ta-mt14" style={{ flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                  {step.status !== "completed" && (
                    <button
                      className="ta-btn ta-btn-primary ta-btn-xs"
                      style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}
                      disabled={assigningCourseId === step.id}
                      onClick={() => {
                        const stepCourse = (activeTrackObj.courses || []).find(c => c.id === step.id) || { id: step.id, title: step.title };
                        handleAssignModule(stepCourse);
                      }}
                      title={`Assign "${step.title}" to ${currentLearner.name}`}
                    >
                      <PlusCircle size={12} /> {assigningCourseId === step.id ? "Assigning..." : "Assign to Learner"}
                    </button>
                  )}
                  {setScreen && (
                    <button
                      className="ta-btn ta-btn-outline ta-btn-xs"
                      style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}
                      onClick={() => {
                        if (setSelectedCourseId) setSelectedCourseId(step.id);
                        setScreen("content");
                      }}
                      title={`Open "${step.title}" in Course Content / Builder`}
                    >
                      <ExternalLink size={12} /> View Course
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Skill Profile Radar / Matrix & Promotion Criteria Checklist */}
        <div className="ta-sidebar-layout">

          {/* Left Column: Skill Profile, Department Skill Gaps, Category Completion */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>

            {/* Skill Profile Breakdown */}
            <div className="ta-card" style={{ padding: 22 }}>
              <div className="ta-row ta-between" style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div className="ta-title" style={{ fontSize: 16 }}>Skill Profile & Radar Assessment</div>
                  <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Real assessment scores by course category for {currentLearner.name}</div>
                </div>
                <div className="ta-row ta-gap8">
                  <Tag tone="success">{currentLearner?.avgProgress ?? 0}% Readiness</Tag>
                  {setScreen && (
                    <button 
                      className="ta-btn ta-btn-outline ta-btn-xs" 
                      style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}
                      onClick={() => setScreen("assessments")}
                      title="View Assessments Screen"
                    >
                      <ClipboardCheck size={12} /> Assessments →
                    </button>
                  )}
                </div>
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

            {/* Skill gaps by department */}
            <div className="ta-card" style={{ padding: 22 }}>
              <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 8 }}>
                <div className="ta-row ta-gap8">
                  <BarChart3 size={16} color="var(--primary)" />
                  <div className="ta-title" style={{ fontSize: 16 }}>Skill gaps by department</div>
                </div>
                {selectedDepartment !== "all" && (
                  <button 
                    className="ta-btn ta-btn-outline ta-btn-xs" 
                    style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6 }}
                    onClick={() => setSelectedDepartment("all")}
                  >
                    Clear Filter ({selectedDepartment})
                  </button>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>
                Real course-category completion, broken down by department. Click any department to filter the inspected learner profiles above.
              </div>
              <div className="ta-col ta-gap10 ta-mt12">
                {(wi.departmentBreakdown || []).length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)" }}>No department data yet.</div>}
                {(wi.departmentBreakdown || []).map((d) => (
                  <div 
                    key={d.department} 
                    className="ta-card-hover"
                    style={{ 
                      padding: "8px 10px", 
                      borderRadius: 6, 
                      cursor: "pointer",
                      background: selectedDepartment === d.department ? "var(--surface-3)" : "transparent",
                      border: selectedDepartment === d.department ? "1px solid var(--primary)" : "1px solid transparent"
                    }}
                    onClick={() => {
                      setSelectedDepartment(d.department);
                      const firstInDept = realLearners.find(l => l.department === d.department);
                      if (firstInDept) setSelectedLearnerId(firstInDept.id);
                      showToast?.(`Filtered to ${d.department} department`);
                    }}
                    title={`Click to filter learners to ${d.department}`}
                  >
                    <div className="ta-row ta-between" style={{ fontSize: 12.5 }}>
                      <span style={{ fontWeight: 600 }}>{d.department}</span>
                      <span>{d.avgProgress}% avg ({d.count || d.learnerCount || 0} enrollments)</span>
                    </div>
                    <ProgressBar value={d.avgProgress} />
                  </div>
                ))}
              </div>
            </div>

            {/* Completion by course category */}
            <div className="ta-card" style={{ padding: 22 }}>
              <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 8 }}>
                <div className="ta-row ta-gap8">
                  <ClipboardCheck size={16} color="var(--primary)" />
                  <div className="ta-title" style={{ fontSize: 16 }}>Completion by course category</div>
                </div>
                {setScreen && (
                  <button 
                    className="ta-btn ta-btn-outline ta-btn-xs" 
                    style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}
                    onClick={() => setScreen("content")}
                  >
                    <BookOpen size={12} /> Manage Course Content →
                  </button>
                )}
              </div>
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

          </div>

          {/* Right Column: Promotion Criteria & AI Recommendation */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
            
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
                    {!c.done && c.isCourseCompletion && (
                      <button
                        className="ta-btn ta-btn-primary ta-btn-xs"
                        style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, flexShrink: 0 }}
                        disabled={assigningCourseId === c.courseId}
                        onClick={() => {
                          const target = (activeTrackObj.courses || []).find(crs => crs.id === c.courseId) || { id: c.courseId, title: c.courseTitle };
                          handleAssignModule(target);
                        }}
                        title={`Assign ${c.courseTitle} to ${currentLearner.name}`}
                      >
                        {assigningCourseId === c.courseId ? "Assigning..." : "Assign"}
                      </button>
                    )}
                    {!c.done && !c.isCourseCompletion && setScreen && (
                      <button
                        className="ta-btn ta-btn-outline ta-btn-xs"
                        style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, flexShrink: 0 }}
                        onClick={() => setScreen("assessments")}
                        title="Review or configure assessments"
                      >
                        Assessments →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Growth Recommendation Card */}
            <div className="ta-card" style={{ padding: 22, 
              background: "var(--surface-2)",
              border: "1px solid var(--border)" }}>
              <div className="ta-row ta-between">
                <div className="ta-row ta-gap8" style={{ color: "var(--primary, #2563EB)", fontWeight: 700, fontSize: 14 }}>
                  <Brain size={18} />
                  <span>Skill Growth Recommendation</span>
                </div>
                {targetCourse && (
                  <Tag tone="primary">Target: {targetCourse.title}</Tag>
                )}
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

              {/* Course Selector Dropdown for Admin Custom Assignment */}
              {(activeTrackObj.courses || []).length > 0 && (
                <div className="ta-mt12" style={{ background: "var(--surface-3)", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
                    Select Module to Assign:
                  </div>
                  <div className="ta-row ta-gap8" style={{ flexWrap: "wrap" }}>
                    <select
                      className="ta-input"
                      style={{ flex: "1 1 200px", padding: "6px 10px", fontSize: 12.5, borderRadius: 6 }}
                      value={selectedCourseToAssign || (targetCourse?.id || "")}
                      onChange={(e) => setSelectedCourseToAssign(e.target.value)}
                    >
                      {(activeTrackObj.courses || []).map((c, idx) => {
                        const step = careerSteps[idx];
                        const isRec = c.id === firstIncompleteCourse?.id;
                        return (
                          <option key={c.id} value={c.id}>
                            {isRec ? "⭐ [Recommended] " : ""}{c.title} ({step?.isCompleted ? "Completed" : step?.progress ? `${step.progress}%` : "Not Started"})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              )}

              {assignSuccess && (
                <div className="ta-card ta-mt12 anim-pop" style={{ background: "rgba(16, 185, 129, 0.1)", borderColor: "#10B981", padding: 10 }}>
                  <div className="ta-row ta-gap8" style={{ color: "#10B981", fontSize: 12.5, fontWeight: 600 }}>
                    <CheckCircle2 size={15} /> Assigned "{assignSuccess}" to {currentLearner.name}! Notification dispatched to learner.
                  </div>
                </div>
              )}

              <div className="ta-row ta-gap10 ta-mt16" style={{ flexWrap: "wrap" }}>
                <button 
                  className="ta-btn ta-btn-primary ta-btn-sm"
                  disabled={!targetCourse || assigningCourseId === targetCourse.id}
                  onClick={() => handleAssignModule(targetCourse)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <PlusCircle size={14} /> {assigningCourseId === targetCourse?.id ? "Assigning..." : `Assign "${targetCourse?.title || 'Recommended Module'}" →`}
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
        </>
        )}

      </div>
    </div>
  );
}
