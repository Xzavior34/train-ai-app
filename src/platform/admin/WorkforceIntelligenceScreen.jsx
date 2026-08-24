import React, { useState, useContext } from "react";
import { TopBar, StatCard, ProgressBar, Tag, ToastContext, Avatar } from "../components/PlatformUI.jsx";
import { 
  Brain, Sparkles, ClipboardCheck, AlertTriangle, Bot, 
  TrendingUp, CheckCircle2, Circle, ArrowRight, UserCheck, 
  Award, ShieldCheck, ChevronRight, Zap, Target, BookOpen
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchWorkforceIntelligence,
  // The learner-inspection half of this screen used to run entirely off
  // DEMO_LEARNERS from lib/api/demoData.js - imported unconditionally, with no
  // !supabase guard - so the "Inspect Learner" picker listed invented people and
  // every figure keyed off them was fiction, sitting next to the real
  // fetchWorkforceIntelligence numbers at the top and bottom of the same page.
  fetchOrgLearnerProgressOverview,
  fetchUserDetailForAdmin,
  fetchOrgSkillGapsDetail,
} from "../../lib/api/platform.js";
import { DEMO_MODE } from "../../lib/demoMode.js";

// Bar colours only - the palette is presentational and cycles over whatever real
// course categories come back.
const SKILL_FILLS = ["#4F46E5", "#6366F1", "#8B5CF6", "#EC4899", "#10B981", "#F59E0B"];

export function WorkforceIntelligenceScreen({ orgId, orgSelector }) {
  const showToast = useContext(ToastContext);
  const [selectedLearnerId, setSelectedLearnerId] = useState("");
  const wiQuery = useSupabaseQuery(async () => (orgId ? fetchWorkforceIntelligence(orgId) : null), [orgId]);
  const wi = wiQuery.data;

  // Real roster for the picker: the same per-learner progress overview the
  // People screen's Progress tab uses.
  const learnersQuery = useSupabaseQuery(async () => (orgId ? fetchOrgLearnerProgressOverview(orgId) : []), [orgId]);
  const learners = learnersQuery.data || [];
  // Real per-category completion per learner. Exported by platform.js and
  // previously only used by ComplianceScreen.
  const skillGapsQuery = useSupabaseQuery(async () => (orgId ? fetchOrgSkillGapsDetail(orgId) : []), [orgId]);
  const skillGaps = skillGapsQuery.data || [];

  const effectiveLearnerId = selectedLearnerId || learners[0]?.id || "";
  const currentLearner = learners.find((l) => l.id === effectiveLearnerId) || null;

  // Per-learner record for the selected person - name, email, enrollments,
  // real average progress.
  const detailQuery = useSupabaseQuery(
    async () => (effectiveLearnerId && orgId ? fetchUserDetailForAdmin(effectiveLearnerId, orgId) : null),
    [effectiveLearnerId, orgId]
  );
  const detail = detailQuery.data;
  const learnerName = detail?.profile?.display_name || currentLearner?.name || "Learner";
  const learnerInitials = (learnerName || "U").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  // Skill rows for the selected learner: real course categories, real average
  // progress in each. There is no role-baseline/"target level" table anywhere in
  // the schema, so no target is shown - a category is either a completed strength
  // or an open gap, which is what the data actually says.
  const learnerSkills = skillGaps.find((s) => s.learnerId === effectiveLearnerId);
  const skillRows = [
    ...(learnerSkills?.completedSkills || []).map((s) => ({ skill: s.category, level: s.avgProgress, gap: false })),
    ...(learnerSkills?.gapSkills || []).map((s) => ({ skill: s.category, level: s.avgProgress, gap: true })),
  ];
  const weakestGap = (learnerSkills?.gapSkills || []).slice().sort((a, b) => a.avgProgress - b.avgProgress)[0] || null;
  const strongestSkill = (learnerSkills?.completedSkills || []).slice().sort((a, b) => b.avgProgress - a.avgProgress)[0] || null;

  // Real export of the selected learner's own record, replacing a button that
  // only toasted "exported as PDF" and produced no file.
  function handleExportDevelopmentPlan() {
    if (!currentLearner) return;
    const rows = [
      ["Learner", learnerName],
      ["Department", currentLearner.department || ""],
      ["Courses assigned", String(currentLearner.assignedCount)],
      ["Courses completed", String(currentLearner.completedCount)],
      ["Average progress %", String(currentLearner.avgProgress)],
      [],
      ["Category", "Average progress %", "Status"],
      ...skillRows.map((s) => [s.skill, String(s.level), s.gap ? "Gap" : "Completed"]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `development-plan-${learnerName.replace(/\s+/g, "-").toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${learnerName}'s development plan as CSV.`);
  }

  // Career ladder levels: no table in the schema describes job levels, tracks or
  // per-level readiness, so this roadmap only renders with no database
  // connected (see lib/demoMode.js).
  const careerSteps = [
    { title: "Junior UI Designer", status: "completed", progress: 100, tag: "Completed" },
    { title: "Middle UI Designer", status: "active", progress: 68, tag: "Current Track" },
    { title: "Senior UI Designer", status: "upcoming", progress: 0, tag: "Target Goal" },
    { title: "Head of Design / Architect", status: "locked", progress: 0, tag: "Long-term" },
  ];

  // Promotion criteria and their scores ("96/100", "74% (Pass: 80%)") have no
  // backing table either - nothing records per-criterion evaluation - so this
  // checklist is demo-only as well.
  const promotionCriteria = [
    { id: 1, text: "Design System Token Audit & Component Contribution", done: true, score: "96/100" },
    { id: 2, text: "Lead 2 Peer UI Reviews & Mentorship Critiques", done: true, score: "2/2 Completed" },
    { id: 3, text: "Pass Advanced Spatial & Generative UI Assessment", done: false, score: "74% (Pass: 80%)" },
    { id: 4, text: "Conduct Qualitative UX Research Case Study", done: false, score: "Pending submission" }
  ];

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
        <div style={{
          borderRadius: 20,
          background: "linear-gradient(135deg, rgba(15,23,42,0.94) 0%, rgba(30,27,75,0.88) 100%)",
          color: "#FFFFFF",
          padding: "clamp(18px, 3vw, 26px)",
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.35)",
          border: "1px solid rgba(99, 102, 241, 0.4)",
          position: "relative",
          overflow: "hidden"
        }}>
          <img
            src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=1400&auto=format&fit=crop&q=85"
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

          <div className="ta-row ta-between" style={{ position: "relative", zIndex: 1, flexWrap: "wrap", gap: 16, alignItems: "center" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 style={{ fontSize: "clamp(20px, 2.5vw, 26px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 6px", color: "#FFFFFF" }}>
                Workforce Intelligence &amp; Skill Radar
              </h1>
              <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.85)", margin: 0, maxWidth: 620, lineHeight: 1.4 }}>
                Map enterprise competencies, skill gaps, and automated upskilling paths.
              </p>
            </div>
          </div>
        </div>

        {/* Top 4 KPI Metrics */}
        <div className="ta-grid ta-grid-4 anim-stagger">
          <div className="ta-card" style={{ padding: 18, borderRadius: 16 }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Workforce Readiness</span>
              <Brain size={18} color="#4F46E5" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>{wi.readinessScore}%</div>
            <div style={{ fontSize: 11.5, color: "var(--success)", marginTop: 4 }}>&nbsp;</div>
          </div>

          <div className="ta-card" style={{ padding: 18, borderRadius: 16 }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Avg Course Completion</span>
              <ClipboardCheck size={18} color="#10B981" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>{wi.avgCompletion}%</div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>Across all active tracks</div>
          </div>

          <div className="ta-card" style={{ padding: 18, borderRadius: 16 }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Compliance Rate</span>
              <ShieldCheck size={18} color="#F59E0B" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>{wi.complianceRate === null ? "N/A" : `${wi.complianceRate}%`}</div>
            <div style={{ fontSize: 11.5, color: "var(--success)", marginTop: 4 }}>Audit ready</div>
          </div>

          <div className="ta-card" style={{ padding: 18, borderRadius: 16 }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>AI Coach Queries (7d)</span>
              <Bot size={18} color="#8B5CF6" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>{wi.aiUsageCount7d}</div>
            <div style={{ fontSize: 11.5, color: "var(--primary)", marginTop: 4 }}>Active learning adoption</div>
          </div>
        </div>

        {/* Learner Selector Bar. The picker listed DEMO_LEARNERS and the header
            showed their invented name, email and status even with a live database.
            It now lists the organization's real learners
            (fetchOrgLearnerProgressOverview) and the header reads from that
            learner's own record (fetchUserDetailForAdmin). */}
        <div className="ta-card" style={{ padding: 16, borderRadius: 14, background: "var(--surface-2)" }}>
          <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 12 }}>
            <div className="ta-row ta-gap10">
              <Avatar
                initials={learnerInitials}
                size={44}
                src={detail?.profile?.avatar_url || undefined}
                style={{ borderRadius: 12, border: "2px solid var(--primary)" }}
              />
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>
                  {learnersQuery.loading ? "Loading learners..." : (currentLearner ? learnerName : "No learners yet")}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                  {/* Email is deliberately not shown: user_profiles has no email
                      column, so the only honest identifiers here are the real
                      department and enrollment figures. */}
                  {currentLearner
                    ? `${currentLearner.department} • ${currentLearner.assignedCount} course${currentLearner.assignedCount === 1 ? "" : "s"} assigned • ${currentLearner.assignedCount > 0 ? `${currentLearner.avgProgress}% avg progress` : "no progress yet"}`
                    : "This organization has no learners to inspect."}
                </div>
              </div>
            </div>

            <div className="ta-row ta-gap8" style={{ flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-2)" }}>Inspect Learner:</span>
              <select
                className="ta-input"
                style={{ minWidth: "min(200px, 100%)", flex: "1 1 auto", padding: "6px 12px", borderRadius: 8 }}
                value={effectiveLearnerId}
                onChange={(e) => setSelectedLearnerId(e.target.value)}
                disabled={learners.length === 0}
              >
                {learners.length === 0 && <option value="">No learners in this organization</option>}
                {learners.map(l => (
                  <option key={l.id} value={l.id}>{l.name} ({l.department})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 4-Tier Career Path Progression Visual. Job levels, the "Track: Product
            Design & AI" badge and the per-level "% met" figures have no source in
            the schema - there is no career-ladder table - so the whole roadmap
            only renders with no database connected. */}
        {DEMO_MODE && (
        <div className="ta-card" style={{ padding: 22, borderRadius: 16 }}>
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
        )}

        {/* Skill Profile Radar / Matrix & Promotion Criteria Checklist */}
        <div className="ta-sidebar-layout">

          {/* Skill Profile Breakdown */}
          <div className="ta-card" style={{ padding: 22, borderRadius: 16 }}>
            <div className="ta-row ta-between" style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
              <div>
                <div className="ta-title" style={{ fontSize: 16 }}>Skill Profile & Radar Assessment</div>
                <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Average completion per course category for this learner</div>
              </div>
              {/* Was a literal "91% Readiness" - which contradicted the real
                  {wi.readinessScore}% rendered in the KPI row above. This is the
                  selected learner's own real average progress. */}
              <Tag tone="success">
                {currentLearner && currentLearner.assignedCount > 0 ? `${currentLearner.avgProgress}% avg progress` : "N/A"}
              </Tag>
            </div>

            {/* Visual Skill Matrix with Colored Progress Bars. The six skills and
                their levels were literals (UX Design 92 vs "target" 85, etc). Real
                course categories and real average progress now, from
                fetchOrgSkillGapsDetail. Role baselines/"target %" have no table in
                the schema, so a category is shown as a completed strength or an
                open gap instead of against an invented target. */}
            <div className="ta-col ta-gap14 ta-mt16">
              {skillGapsQuery.loading && <div className="ta-empty">Loading skill profile...</div>}
              {!skillGapsQuery.loading && skillRows.length === 0 && (
                <div className="ta-empty">
                  {currentLearner ? "No course enrollments for this learner yet, so there is no skill data to show." : "Select a learner to see their skill profile."}
                </div>
              )}
              {skillRows.map((s, idx) => (
                <div key={s.skill}>
                  <div className="ta-row ta-between" style={{ fontSize: 13, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>{s.skill}</span>
                    <span style={{ color: "var(--text-2)", fontSize: 12 }}>
                      <strong style={{ color: s.gap ? "var(--danger)" : "var(--success)" }}>{s.level}%</strong> {s.gap ? "gap" : "completed"}
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 8, background: "var(--surface-2)", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ width: `${s.level}%`, height: "100%", background: SKILL_FILLS[idx % SKILL_FILLS.length], borderRadius: 6, transition: "width 0.4s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Promotion Criteria & AI Recommendation */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* Promotion Criteria Checklist. The four criteria, their tick marks
                and their scores ("96/100", "2/4 Completed") are literals with no
                table behind them - nothing in the schema records promotion
                requirements or their evaluation - so this only renders with no
                database connected. */}
            {DEMO_MODE && (
            <div className="ta-card" style={{ padding: 22, borderRadius: 16 }}>
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
            )}

            {/* Growth Recommendation Card */}
            <div className="ta-card" style={{ 
              padding: 22, 
              borderRadius: 16, 
              background: "var(--surface-2)",
              border: "1px solid var(--border)"
            }}>
              <div className="ta-row ta-gap8" style={{ color: "#4F46E5", fontWeight: 700, fontSize: 14 }}>
                <Brain size={18} />
                <span>Skill Growth Recommendation</span>
              </div>

              {/* This prose named fixed skills and percentages ("Design Systems
                  (94%)", "UX Research (62%)") for whoever was selected. It is now
                  derived from that learner's real strongest completed category and
                  weakest open gap, and says so plainly when there is nothing to
                  derive it from. */}
              <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 10, lineHeight: 1.55 }}>
                {!currentLearner && "Select a learner to see where their course completion is strongest and weakest."}
                {currentLearner && skillRows.length === 0 && `${learnerName} has no course enrollments yet, so there is nothing to compare.`}
                {currentLearner && skillRows.length > 0 && (
                  <>
                    {learnerName}
                    {strongestSkill ? <> is furthest along in <strong>{strongestSkill.category} ({strongestSkill.avgProgress}%)</strong></> : " has not completed any course category yet"}
                    {weakestGap ? <>, and has the most ground left in <strong>{weakestGap.category} ({weakestGap.avgProgress}%)</strong>.</> : ", with no open category gaps."}
                  </>
                )}
              </div>

              <div className="ta-row ta-gap10 ta-mt16" style={{ flexWrap: "wrap" }}>
                {/* "Assign Recommended Module" only flipped a local flag and
                    showed a success banner - it wrote nothing anywhere. Real
                    assignment needs a specific course and an acting admin id,
                    neither of which this screen has; it is done from Compliance &
                    Assignments. Kept visible only with no database connected so
                    the demo walkthrough still reads, rather than offering a live
                    button that silently does nothing. */}
                {DEMO_MODE && (
                  <button
                    className="ta-btn ta-btn-primary ta-btn-sm"
                    onClick={() => showToast("Demo only - assign a course from Compliance & Assignments.")}
                  >
                    Assign Recommended Module →
                  </button>
                )}
                {/* Used to toast "exported as PDF" and produce no file. Now
                    downloads this learner's real record as CSV. */}
                <button
                  className="ta-btn ta-btn-outline ta-btn-sm"
                  disabled={!currentLearner}
                  onClick={handleExportDevelopmentPlan}
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
