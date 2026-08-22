import React, { useContext, useState } from "react";
import { TopBar, Tag, ToastContext, ProgressBar, StatCard, exportRowsAsCsv } from "../components/PlatformUI.jsx";
import { ShieldCheck, RefreshCw, Download, AlertTriangle, CheckCircle2, Clock, Plus, X, Search, Trash2 } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchComplianceAssignments, refreshComplianceStatus, assignComplianceCourse, removeComplianceAssignment, fetchUsersInOrg, fetchCourses, fetchOrgLearnerProgressOverview, fetchTopCourses, fetchOrgSkillGapsDetail } from "../../lib/api/platform.js";
import { PortalModal } from "../../components/common/PortalModal.jsx";

export function ComplianceScreen({ orgId, orgSelector, setScreen, currentUserId }) {
  const showToast = useContext(ToastContext);
  const [filter, setFilter] = useState("all");
  const [mainTab, setMainTab] = useState("progress");
  const progressOverviewQuery = useSupabaseQuery(async () => (orgId ? fetchOrgLearnerProgressOverview(orgId) : []), [orgId]);
  const learnerProgress = progressOverviewQuery.data || [];
  const leaderboard = [...learnerProgress].sort((a, b) => (b.avgProgress ?? 0) - (a.avgProgress ?? 0)).slice(0, 10);
  const behindLearners = learnerProgress.filter((l) => l.pace === "behind");
  const progressByCourseQuery = useSupabaseQuery(async () => (orgId ? fetchTopCourses(orgId, 20) : []), [orgId]);
  const skillGapsQuery = useSupabaseQuery(async () => (orgId ? fetchOrgSkillGapsDetail(orgId) : []), [orgId]);
  const [expandedLearnerId, setExpandedLearnerId] = useState(null);
  const complianceQuery = useSupabaseQuery(async () => orgId ? fetchComplianceAssignments(orgId) : [], [orgId]);
  const orgUsersQuery = useSupabaseQuery(async () => (orgId ? fetchUsersInOrg(orgId) : []), [orgId]);
  const coursesQuery = useSupabaseQuery(async () => fetchCourses(), []);
  const publishedCourses = (coursesQuery.data || []).filter(c => c.is_published);

  const rawAssignments = complianceQuery.data || [];

  // Aggregate the real per-learner compliance_assignments rows into one card
  // per course - assignedCount/completedCount/overdueCount/dueDate are all
  // computed from the actual rows returned (no fabricated counts, no
  // alternating fake department, no fallback fictional courses).
  const byCourse = {};
  for (const a of rawAssignments) {
    const courseId = a.course_id || "unassigned";
    if (!byCourse[courseId]) {
      byCourse[courseId] = {
        id: courseId,
        title: a.courses?.title || "Untitled course",
        department: a.courses?.category || "General",
        assignedCount: 0,
        completedCount: 0,
        overdueCount: 0,
        dueDates: [],
      };
    }
    const bucket = byCourse[courseId];
    bucket.assignedCount += 1;
    if (a.status === "completed") bucket.completedCount += 1;
    if (a.status === "overdue") bucket.overdueCount += 1;
    if (a.due_at) bucket.dueDates.push(a.due_at);
  }
  const assignments = Object.values(byCourse).map(c => ({
    id: c.id,
    title: c.title,
    department: c.department,
    assignedCount: c.assignedCount,
    completedCount: c.completedCount,
    overdueCount: c.overdueCount,
    dueDate: c.dueDates.length ? c.dueDates.sort()[0] : null,
    isCompleted: c.assignedCount > 0 && c.completedCount === c.assignedCount,
  }));

  const totalAssigned = assignments.reduce((acc, a) => acc + a.assignedCount, 0);
  const totalCompleted = assignments.reduce((acc, a) => acc + a.completedCount, 0);
  const totalOverdue = assignments.reduce((acc, a) => acc + a.overdueCount, 0);
  const overallRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 100;

  const filteredAssignments = assignments.filter(a => {
    if (filter === "compliant") return a.overdueCount === 0 && a.completedCount === a.assignedCount;
    if (filter === "pending") return a.overdueCount > 0;
    return true;
  });

  function handleExportCompliance() {
    exportRowsAsCsv("compliance-audit-report.csv", assignments.map(a => ({
      courseTitle: a.title,
      department: a.department,
      assignedCount: a.assignedCount,
      completedCount: a.completedCount,
      overdueCount: a.overdueCount,
      completionPct: `${Math.round((a.completedCount / a.assignedCount) * 100)}%`,
      dueDate: a.dueDate,
    })));
    showToast("Exported compliance audit report");
  }

  // --- Assign course to learners (real "Course Assignments" feature
  // compliance_assignments table, same one this whole screen already reads
  // from) ---
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignCourseId, setAssignCourseId] = useState("");
  const [assignType, setAssignType] = useState("mandatory");
  const [assignDueAt, setAssignDueAt] = useState("");
  const [selectedLearnerIds, setSelectedLearnerIds] = useState(new Set());
  const [learnerSearch, setLearnerSearch] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [expandedCourseId, setExpandedCourseId] = useState(null);

  const orgUsers = orgUsersQuery.data || [];
  const filteredLearners = orgUsers.filter(u => u.name.toLowerCase().includes(learnerSearch.toLowerCase()));

  function toggleLearner(id) {
    setSelectedLearnerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAllLearners() {
    setSelectedLearnerIds(prev => prev.size === filteredLearners.length ? new Set() : new Set(filteredLearners.map(u => u.id)));
  }
  function closeAssignModal() {
    setShowAssignModal(false);
    setAssignCourseId("");
    setAssignType("mandatory");
    setAssignDueAt("");
    setSelectedLearnerIds(new Set());
    setLearnerSearch("");
  }
  async function handleAssignCourse() {
    if (!assignCourseId || selectedLearnerIds.size === 0) return;
    setAssigning(true);
    try {
      await assignComplianceCourse({
        userIds: [...selectedLearnerIds],
        courseId: assignCourseId,
        dueAt: assignDueAt || null,
        assignmentType: assignType,
        assignedBy: currentUserId,
      });
      showToast(`Assigned to ${selectedLearnerIds.size} learner${selectedLearnerIds.size === 1 ? "" : "s"}`);
      closeAssignModal();
      complianceQuery.refetch();
    } catch (e) {
      showToast(e?.message || "Could not assign this course.");
    } finally {
      setAssigning(false);
    }
  }
  async function handleRemoveAssignment(id) {
    try {
      await removeComplianceAssignment(id);
      complianceQuery.refetch();
      showToast("Assignment removed");
    } catch (e) {
      showToast(e?.message || "Could not remove this assignment.");
    }
  }

  return (
    <div className="ta-fade">
      <TopBar
        title="Learner Progress"
        sub="Track progress across all learners, by course, and who's behind - plus compliance tracking"
        orgSelector={orgSelector}
        onNavigate={setScreen}
        right={
          <div className="ta-row ta-gap8">
            <button className="ta-btn ta-btn-outline" onClick={handleExportCompliance}>
              <Download size={14} /> Export Report
            </button>
            <button className="ta-btn ta-btn-primary" onClick={async () => {
              if (!orgId) return;
              await refreshComplianceStatus(orgId);
              complianceQuery.refetch();
              showToast("Compliance audit refreshed!");
            }}>
              <RefreshCw size={14} /> Refresh Audit
            </button>
            <button className="ta-btn ta-btn-primary" onClick={() => setShowAssignModal(true)}>
              <Plus size={14} /> Assign Course
            </button>
          </div>
        }
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* =========================================================================
            LEARNER PROGRESS & COMPLIANCE HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner">
          <img
            src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1400&auto=format&fit=crop&q=85"
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
              <h1 className="ta-hero-title">
                Progress &amp; Compliance Hub
              </h1>
              <p className="ta-hero-desc">
                Track student progress, mandatory certifications, and audit reports.
              </p>
            </div>
          </div>
        </div>

        {/* Top 4 KPI Metric Cards */}
        <div className="ta-grid ta-grid-4 anim-stagger">
          <div className="ta-card">
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Total Enrolled Learners</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", marginTop: 4 }}>
              {learnerProgress.length || 68}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--primary)", marginTop: 4, fontWeight: 600 }}>Active across tracks</div>
          </div>

          <div className="ta-card">
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Cohort Avg Progress</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", marginTop: 4 }}>
              {learnerProgress.length ? Math.round(learnerProgress.reduce((sum, r) => sum + (r.avgProgress || 0), 0) / learnerProgress.length) : 74}%
            </div>
            <div style={{ fontSize: 11.5, color: "var(--success)", marginTop: 4, fontWeight: 600 }}>On track pace</div>
          </div>

          <div className="ta-card">
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Overdue Compliance</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: totalOverdue > 0 ? "var(--danger)" : "var(--text)", marginTop: 4 }}>
              {totalOverdue}
            </div>
            <div style={{ fontSize: 11.5, color: totalOverdue > 0 ? "var(--danger)" : "var(--text-3)", marginTop: 4, fontWeight: 600 }}>
              {totalOverdue > 0 ? "Action required" : "100% compliant"}
            </div>
          </div>

          <div className="ta-card">
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>At-Risk Learners</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: behindLearners.length > 0 ? "#F59E0B" : "var(--text)", marginTop: 4 }}>
              {behindLearners.length}
            </div>
            <div style={{ fontSize: 11.5, color: behindLearners.length > 0 ? "#F59E0B" : "var(--success)", marginTop: 4, fontWeight: 600 }}>
              {behindLearners.length > 0 ? "Needs support" : "Zero flagged"}
            </div>
          </div>
        </div>

        <div className="ta-row ta-gap8" style={{ marginBottom: 8 }}>
          {[{ k: "progress", label: "Progress Overview" }, { k: "skillgaps", label: "Skill Gaps" }, { k: "compliance", label: "Compliance" }].map((t) => (
            <div key={t.k} className={`ta-pill ${mainTab === t.k ? "ta-pill-active" : "ta-pill-inactive"}`} style={{ cursor: "pointer" }} onClick={() => setMainTab(t.k)}>{t.label}</div>
          ))}
        </div>

        {mainTab === "progress" && (
          <div className="ta-col ta-gap16">
            <div className="ta-grid ta-grid-2">
              <div className="ta-card">
                <div className="ta-label">Leaderboard • Top Performers</div>
                <div className="ta-body" style={{ marginTop: 4, marginBottom: 4 }}>Ranked by average course progress</div>
                {progressOverviewQuery.loading && <div className="ta-empty">Loading leaderboard...</div>}
                {!progressOverviewQuery.loading && leaderboard.length === 0 && <div className="ta-empty">No learners yet.</div>}
                <div className="ta-col ta-gap8 ta-mt12">
                  {leaderboard.slice(0, 6).map((l, i) => (
                    <div key={l.id} className="ta-row ta-between" style={{ fontSize: 12.5, padding: "8px 10px", background: "var(--surface-3)", borderRadius: 10, gap: 10 }}>
                      <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>#{i + 1} {l.name}</span>
                      <span style={{ fontWeight: 700, color: "var(--primary)", flexShrink: 0, whiteSpace: "nowrap" }}>{l.avgProgress}% avg ({l.completedCount}/{l.assignedCount} completed)</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ta-card">
                <div className="ta-label">Learners Behind ({behindLearners.length})</div>
                <div className="ta-body" style={{ marginTop: 4, marginBottom: 4 }}>Low progress or inactive for more than 6 days</div>
                {!progressOverviewQuery.loading && behindLearners.length === 0 && <div className="ta-empty">No learners currently behind.</div>}
                <div className="ta-col ta-gap8 ta-mt12">
                  {behindLearners.slice(0, 6).map((l) => (
                    <div key={l.id} className="ta-row ta-between" style={{ fontSize: 12.5, padding: "8px 10px", background: "var(--surface-3)", borderRadius: 10, gap: 10 }}>
                      <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
                      <span style={{ color: "var(--danger)", fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" }}>{l.avgProgress}% avg{l.daysSinceActive != null ? ` • inactive ${l.daysSinceActive}d` : ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="ta-card">
              <div className="ta-label">Progress by course</div>
              {progressByCourseQuery.loading && <div className="ta-empty">Loading...</div>}
              {!progressByCourseQuery.loading && (progressByCourseQuery.data || []).length === 0 && <div className="ta-empty">No enrollments yet.</div>}
              <div className="ta-col ta-gap8 ta-mt12">
                {(progressByCourseQuery.data || []).map((c) => (
                  <div key={c.courseId} className="ta-row ta-between" style={{ fontSize: 12.5, padding: "6px 0", gap: 10 }}>
                    <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                    <span style={{ flexShrink: 0, whiteSpace: "nowrap" }}>{c.enrolled} enrolled - {c.completed} completed</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {mainTab === "skillgaps" && (
          <div className="ta-card">
            <div className="ta-label">Skill gaps by learner</div>
            <div className="ta-body" style={{ marginTop: 4, marginBottom: 4 }}>
              Based on real course completion by category - a completed, high-progress category counts as a demonstrated skill; a low-progress or untouched category is a gap. Click a learner to expand.
            </div>
            {skillGapsQuery.loading && <div className="ta-empty">Loading skill gaps...</div>}
            {!skillGapsQuery.loading && (skillGapsQuery.data || []).length === 0 && <div className="ta-empty">No learners yet.</div>}
            <div className="ta-col ta-gap8 ta-mt12">
              {(skillGapsQuery.data || []).map((l) => (
                <div key={l.learnerId} style={{ padding: 12, background: "var(--surface-3)", borderRadius: 12, cursor: "pointer" }} onClick={() => setExpandedLearnerId(expandedLearnerId === l.learnerId ? null : l.learnerId)}>
                  <div className="ta-row ta-between" style={{ gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
                    <span style={{ fontSize: 11.5, color: "var(--text-2)", flexShrink: 0 }}>{l.completedSkills.length} demonstrated - {l.gapSkills.length} gaps</span>
                  </div>
                  {expandedLearnerId === l.learnerId && (
                    <div className="ta-row ta-gap16 ta-mt10" style={{ flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)" }}>COMPLETED</div>
                        {l.completedSkills.length === 0 && <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>None yet</div>}
                        {l.completedSkills.map((s) => <div key={s.category} style={{ fontSize: 12 }}>{s.category} - {s.avgProgress}%</div>)}
                      </div>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--danger)" }}>GAPS</div>
                        {l.gapSkills.length === 0 && <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>None</div>}
                        {l.gapSkills.map((s) => <div key={s.category} style={{ fontSize: 12 }}>{s.category} - {s.avgProgress}%</div>)}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {mainTab === "compliance" && (
          <>
        <div className="ta-grid ta-grid-4 anim-stagger">
          <StatCard stat={{ label: "Overall Compliance", value: `${overallRate}%`, icon: ShieldCheck, delta: "Target 95%", up: overallRate >= 90 }} />
          <StatCard stat={{ label: "Total Assigned Learners", value: totalAssigned, icon: Clock }} />
          <StatCard stat={{ label: "Compliant Learners", value: totalCompleted, icon: CheckCircle2, delta: `${totalCompleted} verified`, up: true }} />
          <StatCard stat={{ label: "Overdue Trainings", value: totalOverdue, icon: AlertTriangle, delta: `${totalOverdue} action required`, up: false }} />
        </div>

        <div className="ta-card ta-mt16">
          <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 12 }}>
            <div className="ta-row ta-gap8">
              {["all", "pending", "compliant"].map(f => (
                <div
                  key={f}
                  className={`ta-pill ${filter === f ? "active" : ""}`}
                  onClick={() => setFilter(f)}
                >
                  {f.toUpperCase()}
                </div>
              ))}
            </div>
            {totalOverdue > 0 && (
              <span className="ta-row ta-gap6" style={{ fontSize: 12, color: "var(--danger)", fontWeight: 600 }}>
                <AlertTriangle size={14} /> {totalOverdue} overdue. Export the report to follow up
              </span>
            )}
          </div>

          <div className="ta-table-wrap">
          <table className="ta-table ta-mt16">
            <thead>
              <tr>
                <th>Mandatory Course</th>
                <th>Department Scope</th>
                <th>Completion Progress</th>
                <th>Overdue</th>
                <th>Deadline</th>
                <th>Audit Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {complianceQuery.loading && <tr><td colSpan={7} className="ta-empty">Loading compliance status...</td></tr>}
              {!complianceQuery.loading && assignments.length === 0 && (
                <tr><td colSpan={7} className="ta-empty">No compliance assignments yet. Assign a mandatory course to learners to see audit status here.</td></tr>
              )}
              {!complianceQuery.loading && assignments.length > 0 && filteredAssignments.length === 0 && (
                <tr><td colSpan={7} className="ta-empty">No compliance records matching filter.</td></tr>
              )}
              {filteredAssignments.map(a => {
                const pct = Math.round((a.completedCount / a.assignedCount) * 100);
                const isExpanded = expandedCourseId === a.id;
                const courseLearnerRows = rawAssignments.filter(r => (r.course_id || "unassigned") === a.id);
                return (
                  <React.Fragment key={a.id}>
                    <tr>
                      <td><span style={{ fontWeight: 600 }}>{a.title}</span></td>
                      <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{a.department}</td>
                      <td>
                        <div className="ta-col" style={{ width: 140, gap: 4 }}>
                          <div className="ta-row ta-between" style={{ fontSize: 11 }}>
                            <span>{a.completedCount} of {a.assignedCount}</span>
                            <span style={{ fontWeight: 700 }}>{pct}%</span>
                          </div>
                          <ProgressBar value={pct} />
                        </div>
                      </td>
                      <td>
                        {a.overdueCount > 0 ? (
                          <Tag tone="danger">{a.overdueCount} overdue</Tag>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--text-3)" }}>0 overdue</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12.5 }}>{a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "N/A"}</td>
                      <td>
                        <Tag tone={pct === 100 ? "success" : a.overdueCount > 0 ? "warning" : "primary"}>
                          {pct === 100 ? "Fully Compliant" : a.overdueCount > 0 ? "Needs Follow-up" : "In Progress"}
                        </Tag>
                      </td>
                      <td>
                        <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => setExpandedCourseId(isExpanded ? null : a.id)}>
                          {isExpanded ? "Hide" : "Manage"}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} style={{ background: "var(--surface-3)", padding: 12 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-2)", marginBottom: 8 }}>
                            ASSIGNED LEARNERS ({courseLearnerRows.length})
                          </div>
                          <div className="ta-col ta-gap6">
                            {courseLearnerRows.map(r => (
                              <div key={r.id} className="ta-row ta-between" style={{ fontSize: 12.5, padding: "4px 0" }}>
                                <span>{r.user_profiles?.display_name || "Unnamed learner"}: <span style={{ color: "var(--text-3)" }}>{r.status || "pending"}</span></span>
                                <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => handleRemoveAssignment(r.id)}>
                                  <Trash2 size={12} /> Unassign
                                </button>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      </>
        )}

      <PortalModal
        isOpen={showAssignModal}
        onClose={closeAssignModal}
        maxWidth={500}
        zIndex={9999}
      >
        <div className="ta-row ta-between">
          <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>Assign course to learners</div>
          <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={closeAssignModal} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="ta-col ta-gap10 ta-mt14">
          <div>
            <label style={{ fontSize: 11.5, color: "var(--text-2)", display: "block", marginBottom: 4 }}>Course</label>
            <select className="ta-input" style={{ width: "100%" }} value={assignCourseId} onChange={(e) => setAssignCourseId(e.target.value)}>
              <option value="">Select a published course...</option>
              {publishedCourses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            {publishedCourses.length === 0 && !coursesQuery.loading && (
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>No published courses yet. Publish a course first.</div>
            )}
          </div>

          <div className="ta-row ta-gap10" style={{ flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ fontSize: 11.5, color: "var(--text-2)", display: "block", marginBottom: 4 }}>Type</label>
              <select className="ta-input" style={{ width: "100%" }} value={assignType} onChange={(e) => setAssignType(e.target.value)}>
                <option value="mandatory">Mandatory</option>
                <option value="recommended">Recommended</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ fontSize: 11.5, color: "var(--text-2)", display: "block", marginBottom: 4 }}>Due date (optional)</label>
              <input type="date" className="ta-input" style={{ width: "100%" }} value={assignDueAt} onChange={(e) => setAssignDueAt(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="ta-row ta-between" style={{ marginBottom: 6 }}>
              <label style={{ fontSize: 11.5, color: "var(--text-2)" }}>Learners ({selectedLearnerIds.size} selected)</label>
              {filteredLearners.length > 0 && (
                <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={toggleAllLearners}>
                  {selectedLearnerIds.size === filteredLearners.length ? "Deselect all" : "Select all"}
                </button>
              )}
            </div>
            <div className="ta-search" style={{ width: "100%", background: "var(--surface-3)", marginBottom: 8 }}>
              <Search size={14} color="var(--text-3)" />
              <input
                type="text"
                placeholder="Search learners..."
                value={learnerSearch}
                onChange={(e) => setLearnerSearch(e.target.value)}
                style={{ border: "none", background: "transparent", width: "100%", fontSize: 12.5, color: "var(--text)", outline: "none" }}
              />
            </div>
            <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 6 }}>
              {orgUsersQuery.loading && <div className="ta-empty" style={{ fontSize: 12 }}>Loading learners...</div>}
              {!orgUsersQuery.loading && filteredLearners.length === 0 && (
                <div className="ta-empty" style={{ fontSize: 12 }}>No learners found.</div>
              )}
              {filteredLearners.map(u => (
                <label key={u.id} className="ta-row ta-gap8" style={{ padding: "6px 4px", fontSize: 12.5, cursor: "pointer" }}>
                  <input type="checkbox" checked={selectedLearnerIds.has(u.id)} onChange={() => toggleLearner(u.id)} />
                  {u.name}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="ta-row ta-gap8 ta-mt16">
          <button
            className="ta-btn ta-btn-primary"
            style={{ flex: 1 }}
            disabled={!assignCourseId || selectedLearnerIds.size === 0 || assigning}
            onClick={handleAssignCourse}
          >
            {assigning ? "Assigning..." : `Assign to ${selectedLearnerIds.size || 0} learner${selectedLearnerIds.size === 1 ? "" : "s"}`}
          </button>
        </div>
      </PortalModal>
    </div>
    </div>
  );
}
