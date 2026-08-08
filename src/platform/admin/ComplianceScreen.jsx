import React, { useContext, useState } from "react";
import { TopBar, Tag, ToastContext, ProgressBar, StatCard, exportRowsAsCsv } from "../components/PlatformUI.jsx";
import { ShieldCheck, RefreshCw, Download, AlertTriangle, CheckCircle2, Clock, Plus, X, Search, Trash2 } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchComplianceAssignments, refreshComplianceStatus, assignComplianceCourse, removeComplianceAssignment, fetchUsersInOrg, fetchCourses } from "../../lib/api/platform.js";

export function ComplianceScreen({ orgId, orgSelector, setScreen, currentUserId }) {
  const showToast = useContext(ToastContext);
  const [filter, setFilter] = useState("all");
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
        title="Compliance & Certification"
        sub="Mandatory training tracking & policy audit management"
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
      <div className="ta-content">
        <div className="ta-grid ta-grid-4">
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
                        <div className="ta-col ta-gap4" style={{ width: 140 }}>
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
      </div>

      {showAssignModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(10,12,25,.55)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={closeAssignModal}
        >
          <div className="ta-card" style={{ maxWidth: 480, width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            <div className="ta-row ta-between">
              <div style={{ fontWeight: 800, fontSize: 15 }}>Assign course to learners</div>
              <button className="ta-iconbtn" onClick={closeAssignModal} aria-label="Close"><X size={16} /></button>
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

              <div className="ta-row ta-gap10">
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11.5, color: "var(--text-2)", display: "block", marginBottom: 4 }}>Type</label>
                  <select className="ta-input" style={{ width: "100%" }} value={assignType} onChange={(e) => setAssignType(e.target.value)}>
                    <option value="mandatory">Mandatory</option>
                    <option value="recommended">Recommended</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
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
          </div>
        </div>
      )}
    </div>
  );
}
