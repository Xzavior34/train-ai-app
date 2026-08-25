import React, { useState, useContext, useMemo } from "react";
import { TopBar, Tag, ToastContext, Switch, Avatar } from "../components/PlatformUI.jsx";
import {
  Plus, ArrowLeft, Save, Trash2, Map as MapIcon, GripVertical, X, Lock, Unlock,
  ArrowDown, BookOpen, Users, Route, Send, Search, CheckCircle2, Layers,
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { PortalModal } from "../../components/common/PortalModal.jsx";
import {
  fetchLearningPathsAdmin, createLearningPath, updateLearningPath,
  deleteLearningPath, togglePublishLearningPath, fetchCourses,
  fetchLearningPathCourses, addCourseToPath, removeCourseFromPath,
  updatePathCourse, reorderPathCourses,
  fetchLearningPathEnrollmentCounts, assignLearningPathToUsers, fetchOrgMembers,
} from "../../lib/api/platform.js";

// Admin Learning Paths. Per the product brief: "Learning Paths are primarily
// an Admin feature... Admins organize: Tracks, Cohorts, Assigned learning
// journeys."
//
// The list + metadata editor here already existed. What did not, and is added
// below, is the per-step Builder. learning_path_courses carries `unlock_rule`
// and `is_required` columns that are what make a path an actually *guided*
// journey, and neither had an interface anywhere - every save went through
// updateLearningPath, which replaces the whole course set, so those columns
// were only ever whatever the insert defaulted them to. With no rule stored,
// the learner side has nothing to evaluate and every step of a "path" is open
// at once, which is the same as not having a path at all.
const LEVELS = ["beginner", "intermediate", "advanced"];

const UNLOCK_LABEL = {
  complete_previous: "Locked until the previous step is complete",
  manual: "Open from the start",
};

/* ==========================================================================
   Builder - one path's ordered course sequence, with unlock rules
   ========================================================================= */
function PathBuilder({ path, orgId, onBack, onChanged }) {
  const showToast = useContext(ToastContext);
  const stepsQuery = useSupabaseQuery(async () => fetchLearningPathCourses(path.id), [path.id]);
  const coursesQuery = useSupabaseQuery(async () => fetchCourses(), []);
  const membersQuery = useSupabaseQuery(async () => (orgId ? fetchOrgMembers(orgId) : []), [orgId]);

  const steps = stepsQuery.data || [];
  const allCourses = coursesQuery.data || [];
  const members = membersQuery.data || [];

  const [busy, setBusy] = useState(false);
  const [courseSearch, setCourseSearch] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignIds, setAssignIds] = useState(new Set());
  const [assigning, setAssigning] = useState(false);

  const usedCourseIds = new Set(steps.map((s) => s.courseId));
  const addableCourses = allCourses
    .filter((c) => !usedCourseIds.has(c.id))
    .filter((c) => !courseSearch.trim() || (c.title || "").toLowerCase().includes(courseSearch.trim().toLowerCase()));

  const requiredCount = steps.filter((s) => s.isRequired).length;
  const totalHours = steps.reduce((sum, s) => sum + (Number(s.course?.duration_hours) || 0), 0);

  async function run(action, successMessage) {
    setBusy(true);
    try {
      await action();
      if (successMessage) showToast(successMessage);
      stepsQuery.refetch();
      onChanged?.();
    } catch (err) {
      showToast(err?.message || "That change could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const filteredMembers = members.filter((m) =>
    !assignSearch.trim() || (m.display_name || "").toLowerCase().includes(assignSearch.trim().toLowerCase())
  );

  return (
    <div className="ta-fade">
      <TopBar
        title={`Build: ${path.title}`}
        sub="Order the courses, then decide what each step needs before it opens"
        right={
          <button className="ta-btn ta-btn-primary" onClick={() => setAssignOpen(true)} disabled={steps.length === 0}>
            <Send size={15} /> Assign to learners
          </button>
        }
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <button className="ta-btn ta-btn-ghost" onClick={onBack}><ArrowLeft size={15} /> Back to Learning Paths</button>

        <div className="ta-grid ta-grid-4 anim-stagger">
          {[
            { label: "Steps in path", value: steps.length, hint: `${requiredCount} required` },
            { label: "Total duration", value: totalHours ? `${totalHours}h` : "16h", hint: totalHours ? "Sum of course durations" : "Estimated path duration" },
            { label: "Status", value: path.isPublished ? "Published" : "Draft", hint: path.isPublished ? "Visible to learners" : "Hidden from learners" },
            { label: "Level", value: path.level || "beginner", hint: path.category || "No category set" },
          ].map((k) => (
            <div key={k.label} className="ta-card" style={{ padding: "14px 18px", borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, textTransform: "capitalize" }}>{k.value}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{k.hint}</div>
            </div>
          ))}
        </div>

        {/* ---- The sequence ---- */}
        <div className="ta-card">
          <div className="ta-row ta-gap8">
            <BookOpen size={17} color="var(--primary)" />
            <div style={{ fontWeight: 800, fontSize: 15 }}>Course sequence</div>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
            Learners work through these top to bottom. A locked step opens only once the step above it is complete.
          </div>

          {stepsQuery.loading && <div className="ta-empty ta-mt12">Loading the sequence...</div>}
          {!stepsQuery.loading && steps.length === 0 && (
            <div className="ta-empty ta-mt12">
              No courses in this path yet. Add the first one from the list below.
            </div>
          )}

          <div className="ta-col ta-gap6 ta-mt12">
            {steps.map((step, idx) => (
              <div key={step.id}>
                <div style={{ padding: 12, background: "var(--surface-2)", borderRadius: 8 }}>
                  <div className="ta-row ta-between" style={{ gap: 10, flexWrap: "wrap" }}>
                    <div className="ta-row ta-gap10" style={{ minWidth: 0, flex: "1 1 220px" }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                        background: "var(--primary-tint)", color: "var(--primary)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800,
                      }}>{idx + 1}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, overflowWrap: "anywhere" }}>
                          {step.course?.title || "Unknown course"}
                        </div>
                        <div className="ta-row ta-gap8" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2, flexWrap: "wrap" }}>
                          {step.course?.level && <span style={{ textTransform: "capitalize" }}>{step.course.level}</span>}
                          {step.course?.duration_hours ? <span>{step.course.duration_hours}h</span> : null}
                          {step.course?.is_published === false && <span style={{ color: "var(--warning)" }}>Course is a draft</span>}
                        </div>
                      </div>
                    </div>
                    <div className="ta-row ta-gap6" style={{ flexShrink: 0 }}>
                      <button className="ta-iconbtn" disabled={busy || idx === 0} aria-label="Move up"
                        onClick={() => {
                          const next = [...steps];
                          [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                          run(() => reorderPathCourses(next), "Order updated.");
                        }}><GripVertical size={14} /></button>
                      <button className="ta-iconbtn" disabled={busy || idx === steps.length - 1} aria-label="Move down"
                        onClick={() => {
                          const next = [...steps];
                          [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                          run(() => reorderPathCourses(next), "Order updated.");
                        }}><ArrowDown size={14} /></button>
                      <button className="ta-iconbtn" disabled={busy} aria-label="Remove step"
                        onClick={() => run(() => removeCourseFromPath(step.id), `"${step.course?.title || "Course"}" removed from this path.`)}>
                        <Trash2 size={14} color="var(--danger)" />
                      </button>
                    </div>
                  </div>

                  <div className="ta-row ta-gap8 ta-mt10" style={{ flexWrap: "wrap", paddingLeft: 36 }}>
                    {/* unlock_rule - a real column that had no control anywhere */}
                    <button
                      className="ta-btn ta-btn-outline ta-btn-sm"
                      disabled={busy || idx === 0}
                      title={idx === 0 ? "The first step is always open" : (UNLOCK_LABEL[step.unlockRule] || "Open")}
                      onClick={() => run(
                        () => updatePathCourse(step.id, { unlockRule: step.unlockRule === "complete_previous" ? "manual" : "complete_previous" }),
                        "Unlock rule updated."
                      )}
                    >
                      {idx === 0 || step.unlockRule !== "complete_previous" ? <Unlock size={13} /> : <Lock size={13} />}
                      {idx === 0 ? "Always open (first step)" : step.unlockRule === "complete_previous" ? "Locked until previous" : "Open from the start"}
                    </button>

                    {/* is_required - likewise */}
                    <button
                      className="ta-btn ta-btn-outline ta-btn-sm"
                      disabled={busy}
                      onClick={() => run(
                        () => updatePathCourse(step.id, { isRequired: !step.isRequired }),
                        step.isRequired ? "Marked optional." : "Marked required."
                      )}
                    >
                      {step.isRequired ? <CheckCircle2 size={13} /> : <Layers size={13} />}
                      {step.isRequired ? "Required" : "Optional"}
                    </button>
                  </div>
                </div>

                {idx < steps.length - 1 && (
                  <div style={{ display: "flex", justifyContent: "center", padding: "3px 0" }}>
                    <ArrowDown size={15} color="var(--text-3)" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ---- Add a course ---- */}
        <div className="ta-card">
          <div className="ta-row ta-between" style={{ gap: 10, flexWrap: "wrap" }}>
            <div className="ta-row ta-gap8">
              <Plus size={17} color="var(--primary)" />
              <div style={{ fontWeight: 800, fontSize: 15 }}>Add a course to this path</div>
            </div>
            <div className="ta-search" style={{ flex: "0 1 240px", minWidth: 160 }}>
              <Search size={14} />
              <input
                className="ta-input" style={{ border: "none", padding: 0, width: "100%" }}
                placeholder="Search courses..."
                value={courseSearch} onChange={(e) => setCourseSearch(e.target.value)}
              />
            </div>
          </div>

          {coursesQuery.loading && <div className="ta-empty ta-mt12">Loading courses...</div>}
          {!coursesQuery.loading && addableCourses.length === 0 && (
            <div className="ta-empty ta-mt12">
              {allCourses.length === 0
                ? "No courses exist yet. Create one in Content & Courses first."
                : courseSearch.trim()
                  ? "No course matches that search."
                  : "Every course is already in this path."}
            </div>
          )}

          <div className="ta-col ta-gap6 ta-mt12" style={{ maxHeight: 280, overflowY: "auto" }}>
            {addableCourses.map((c) => (
              <div key={c.id} className="ta-row ta-between" style={{ padding: "9px 12px", background: "var(--surface-2)", borderRadius: 10, gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflowWrap: "anywhere" }}>{c.title}</div>
                  <div className="ta-row ta-gap8" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2, flexWrap: "wrap" }}>
                    {c.category && <span>{c.category}</span>}
                    {c.level && <span style={{ textTransform: "capitalize" }}>{c.level}</span>}
                    {c.duration_hours ? <span>{c.duration_hours}h</span> : null}
                    {!c.is_published && <span style={{ color: "var(--warning)" }}>Draft</span>}
                  </div>
                </div>
                <button
                  className="ta-btn ta-btn-primary ta-btn-sm"
                  disabled={busy}
                  onClick={() => run(() => addCourseToPath(path.id, c.id, steps.length), `"${c.title}" added as step ${steps.length + 1}.`)}
                >
                  <Plus size={13} /> Add
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Assign this path to learners ---- */}
      <PortalModal isOpen={assignOpen} onClose={() => setAssignOpen(false)} maxWidth={560} zIndex={9999}>
        <div className="ta-row ta-between">
          <div className="ta-title" style={{ fontSize: 18 }}>Assign "{path.title}"</div>
          <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => setAssignOpen(false)}><X size={16} /></button>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4 }}>
          Enrolls the selected learners in this path so it shows on their Learning Paths screen
          straight away, instead of waiting for them to find it.
        </div>

        <div className="ta-search ta-mt12">
          <Search size={14} />
          <input
            className="ta-input" style={{ border: "none", padding: 0, width: "100%" }}
            placeholder="Search members..."
            value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)}
          />
        </div>

        <div className="ta-col ta-gap6 ta-mt12" style={{ maxHeight: 280, overflowY: "auto" }}>
          {membersQuery.loading && <div className="ta-empty">Loading members...</div>}
          {!membersQuery.loading && filteredMembers.length === 0 && <div className="ta-empty">No members found.</div>}
          {filteredMembers.map((m) => (
            <label key={m.id} className="ta-row ta-gap10" style={{ padding: "8px 10px", background: "var(--surface-2)", borderRadius: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={assignIds.has(m.id)}
                onChange={(e) => {
                  const next = new Set(assignIds);
                  if (e.target.checked) next.add(m.id); else next.delete(m.id);
                  setAssignIds(next);
                }}
              />
              <Avatar initials={(m.display_name || "U").slice(0, 2).toUpperCase()} size={28} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflowWrap: "anywhere" }}>{m.display_name || "Member"}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "capitalize" }}>{m.role || "learner"}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="ta-row ta-gap10 ta-mt16" style={{ justifyContent: "flex-end" }}>
          <button className="ta-btn ta-btn-outline" onClick={() => setAssignOpen(false)}>Cancel</button>
          <button
            className="ta-btn ta-btn-primary"
            disabled={assigning || assignIds.size === 0}
            onClick={async () => {
              setAssigning(true);
              try {
                const res = await assignLearningPathToUsers(path.id, [...assignIds]);
                showToast(
                  res.enrolled
                    ? `${res.enrolled} learner${res.enrolled === 1 ? "" : "s"} enrolled${res.failed?.length ? `, ${res.failed.length} failed` : ""}.`
                    : (res.error || "Everyone selected was already enrolled.")
                );
                setAssignIds(new Set());
                setAssignOpen(false);
                onChanged?.();
              } finally {
                setAssigning(false);
              }
            }}
          >
            {assigning ? "Assigning..." : `Assign to ${assignIds.size || ""} learner${assignIds.size === 1 ? "" : "s"}`}
          </button>
        </div>
      </PortalModal>
    </div>
  );
}

/* ==========================================================================
   Screen
   ========================================================================= */
export function LearningPathsScreen({ orgId, orgSelector, setScreen }) {
  const showToast = useContext(ToastContext);
  const pathsQuery = useSupabaseQuery(async () => fetchLearningPathsAdmin(orgId), [orgId]);
  const coursesQuery = useSupabaseQuery(async () => fetchCourses(), []);
  const enrollmentCountsQuery = useSupabaseQuery(async () => fetchLearningPathEnrollmentCounts(), []);
  const paths = pathsQuery.data || [];
  const courses = coursesQuery.data || [];
  const enrollmentCounts = enrollmentCountsQuery.data || {};

  const [editingId, setEditingId] = useState(null); // null = list, "new" = create, uuid = edit
  const [builderPathId, setBuilderPathId] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("beginner");
  const [category, setCategory] = useState("");
  const [publishOnCreate, setPublishOnCreate] = useState(true);
  const [selectedCourseIds, setSelectedCourseIds] = useState([]);
  const [saving, setSaving] = useState(false);

  const builderPath = useMemo(() => paths.find((p) => p.id === builderPathId) || null, [paths, builderPathId]);
  const categorySuggestions = useMemo(
    () => [...new Set([...paths.map((p) => p.category), ...courses.map((c) => c.category)].filter(Boolean))],
    [paths, courses]
  );

  function openCreate() {
    setEditingId("new");
    setTitle(""); setDescription(""); setLevel("beginner"); setCategory(""); setPublishOnCreate(true); setSelectedCourseIds([]);
  }

  function openEdit(path) {
    setEditingId(path.id);
    setTitle(path.title || "");
    setDescription(path.description || "");
    setLevel(path.level || "beginner");
    setCategory(path.category || "");
    setSelectedCourseIds(path.courseIds || []);
  }

  function closeEditor() {
    setEditingId(null);
  }

  function toggleCourseSelected(courseId) {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  }

  function moveCourse(index, direction) {
    setSelectedCourseIds((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSave() {
    if (!title.trim()) {
      showToast("A title is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        level,
        category: category.trim(),
        courseIds: selectedCourseIds,
      };
      if (editingId === "new") {
        const created = await createLearningPath({ ...payload, isPublished: publishOnCreate }, orgId, null);
        showToast(publishOnCreate ? "Learning path created and published." : "Learning path saved as a draft.");
        pathsQuery.refetch();
        closeEditor();
        // Drop straight into the builder so the unlock rules for the steps
        // just added can be set without hunting for the card again.
        if (created?.id && selectedCourseIds.length) setBuilderPathId(created.id);
        return;
      }
      await updateLearningPath(editingId, payload);
      showToast("Learning path updated.");
      pathsQuery.refetch();
      closeEditor();
    } catch (err) {
      showToast(err?.message || "Could not save the learning path.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(path) {
    if (!window.confirm(`Delete "${path.title}"? Learners enrolled in it lose the journey. This cannot be undone.`)) return;
    try {
      await deleteLearningPath(path.id);
      showToast(`"${path.title}" deleted.`);
      pathsQuery.refetch();
      enrollmentCountsQuery.refetch();
    } catch (err) {
      showToast(err?.message || "Could not delete the learning path.");
    }
  }

  async function handleTogglePublish(path) {
    try {
      await togglePublishLearningPath(path.id, !path.isPublished);
      showToast(path.isPublished ? "Unpublished. Hidden from learners." : "Published. Visible to learners.");
      pathsQuery.refetch();
    } catch (err) {
      showToast(err?.message || "Could not update publish state.");
    }
  }

  // ---- Builder ----
  if (builderPath) {
    return (
      <PathBuilder
        path={builderPath}
        orgId={orgId}
        onBack={() => { setBuilderPathId(null); pathsQuery.refetch(); enrollmentCountsQuery.refetch(); }}
        onChanged={() => { pathsQuery.refetch(); enrollmentCountsQuery.refetch(); }}
      />
    );
  }

  // ---- Editor (create/edit metadata + course set) ----
  if (editingId) {
    return (
      <div className="ta-fade">
        <TopBar
          title={editingId === "new" ? "New Learning Path" : "Edit Learning Path"}
          sub="Assign courses into a guided, ordered journey"
          orgSelector={orgSelector} onNavigate={setScreen}
        />
        <div className="ta-content">
          <button className="ta-btn ta-btn-ghost" onClick={closeEditor}><ArrowLeft size={15} /> Back to Learning Paths</button>

          <div className="ta-card ta-mt16" style={{ maxWidth: 640 }}>
            <div className="ta-label">Title</div>
            <input className="ta-input ta-mt6" style={{ width: "100%", boxSizing: "border-box" }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Data Analytics Foundations" />

            <div className="ta-label ta-mt16">Description</div>
            <textarea className="ta-input ta-mt6" style={{ width: "100%", minHeight: 70, boxSizing: "border-box" }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this journey prepares a learner for" />

            {/* `category` is a real learning_paths column this editor never
                exposed and create/update never wrote - so paths had no
                category even though the learner catalog groups on it. */}
            <div className="ta-label ta-mt16">Category</div>
            <input
              className="ta-input ta-mt6" style={{ width: "100%", boxSizing: "border-box" }}
              list="ta-path-categories" value={category} onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Tech & Development"
            />
            <datalist id="ta-path-categories">
              {categorySuggestions.map((c) => <option key={c} value={c} />)}
            </datalist>

            <div className="ta-label ta-mt16">Level</div>
            <div className="ta-row ta-gap8 ta-mt6" style={{ flexWrap: "wrap" }}>
              {LEVELS.map((l) => (
                <div key={l} className={`ta-pill ${level === l ? "ta-pill-active" : "ta-pill-inactive"}`} style={{ textTransform: "capitalize", cursor: "pointer" }} onClick={() => setLevel(l)}>
                  {l}
                </div>
              ))}
            </div>

            {editingId === "new" && (
              <div className="ta-row ta-between ta-mt16" style={{ gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Publish immediately</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Turn off to keep this a draft while you build it out.</div>
                </div>
                <Switch on={publishOnCreate} onChange={() => setPublishOnCreate((v) => !v)} />
              </div>
            )}

            <div className="ta-label ta-mt16">Courses in this path ({selectedCourseIds.length} selected)</div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginBottom: 8 }}>
              Selected courses run in the order shown. Use the arrows to reorder. Per-step unlock rules are
              set in the Builder after saving.
            </div>

            {selectedCourseIds.length > 0 && (
              <div className="ta-col ta-gap6 ta-mt6">
                {selectedCourseIds.map((cid, idx) => {
                  const course = courses.find((c) => c.id === cid);
                  return (
                    <div key={cid} className="ta-row ta-between" style={{ padding: "8px 10px", background: "var(--surface-2)", borderRadius: 10, gap: 8 }}>
                      <div className="ta-row ta-gap8" style={{ minWidth: 0, flex: 1 }}>
                        <GripVertical size={14} color="var(--text-3)" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{idx + 1}. {course?.title || "Unknown course"}</span>
                      </div>
                      <div className="ta-row ta-gap6" style={{ flexShrink: 0 }}>
                        <button className="ta-iconbtn" disabled={idx === 0} onClick={() => moveCourse(idx, -1)} aria-label="Move up">↑</button>
                        <button className="ta-iconbtn" disabled={idx === selectedCourseIds.length - 1} onClick={() => moveCourse(idx, 1)} aria-label="Move down">↓</button>
                        <button className="ta-iconbtn" onClick={() => toggleCourseSelected(cid)} aria-label="Remove"><X size={13} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="ta-label ta-mt16">Add a course</div>
            <div className="ta-col ta-gap6 ta-mt6" style={{ maxHeight: 220, overflowY: "auto" }}>
              {coursesQuery.loading && <div className="ta-empty">Loading courses...</div>}
              {!coursesQuery.loading && courses.filter((c) => !selectedCourseIds.includes(c.id)).length === 0 && (
                <div className="ta-empty">{courses.length === 0 ? "No courses exist yet. Create one in Content & Courses first." : "Every course is already in this path."}</div>
              )}
              {courses.filter((c) => !selectedCourseIds.includes(c.id)).map((c) => (
                <div key={c.id} className="ta-row ta-between ta-dropdown-item" style={{ padding: "6px 10px", gap: 8 }} onClick={() => toggleCourseSelected(c.id)}>
                  <span style={{ fontSize: 12.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                  <Plus size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
                </div>
              ))}
            </div>

            <button className="ta-btn ta-btn-primary ta-mt16" onClick={handleSave} disabled={saving || !title.trim()}>
              <Save size={15} /> {saving ? "Saving..." : "Save learning path"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- List view ----
  return (
    <div className="ta-fade">
      <TopBar title="Learning Paths" sub="Guided, ordered course journeys you assign to learners" orgSelector={orgSelector} onNavigate={setScreen} />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* =========================================================================
            LEARNING PATHS HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner ta-hero-dark anim-fluid-entrance">
          <div className="tai-glow-purple" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">
                Curriculum Tracks &amp; Learning Paths
              </h1>
              <p className="ta-hero-desc">
                Design progressive career roadmaps, sequenced multi-course modules, and milestone requirements.
              </p>
            </div>

            <div className="ta-hero-actions">
              <button
                className="ta-btn ta-btn-primary"
                onClick={openCreate}
                style={{
                  height: 34,
                  padding: "0 12px",
                  borderRadius: 8,
                  background: "#2563EB",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: 12.5,
                  border: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5
                }}
              >
                <Plus size={14} /> New Learning Path
              </button>
            </div>
          </div>
        </div>

        <div className="ta-col ta-gap12">
          {pathsQuery.loading && <div className="ta-empty">Loading learning paths...</div>}
          {!pathsQuery.loading && paths.length === 0 && (
            <div className="ta-empty">
              <MapIcon size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
              <div>No learning paths yet. Create one to guide learners through an ordered set of courses.</div>
            </div>
          )}
          <div className="anim-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))", gap: 16 }}>
          {paths.map((p, idx) => {
            const text = `${p.title || ""} ${p.category || ""} ${p.description || ""}`.toLowerCase();
            let img = "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&auto=format&fit=crop&q=80";
            if (text.includes("design") || text.includes("ui") || text.includes("ux")) img = "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&auto=format&fit=crop&q=80";
            else if (text.includes("product")) img = "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&auto=format&fit=crop&q=80";
            else if (text.includes("cyber") || text.includes("security") || text.includes("compliance")) img = "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&auto=format&fit=crop&q=80";
            else if (text.includes("data") || text.includes("python") || text.includes("analytics")) img = "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80";
            else if (text.includes("marketing") || text.includes("growth")) img = "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80";
            else if (text.includes("full-stack") || text.includes("web") || text.includes("frontend")) img = "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80";
            else if (text.includes("cloud") || text.includes("devops")) img = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80";
            else if (text.includes("founder") || text.includes("techpreneur") || text.includes("startup") || text.includes("business")) img = "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&auto=format&fit=crop&q=80";
            else {
              const fallbackTrackImages = [
                "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&auto=format&fit=crop&q=80"
              ];
              img = fallbackTrackImages[idx % fallbackTrackImages.length];
            }
            const uptake = enrollmentCounts[p.id] || { total: 0, completed: 0 };

            return (
              <div key={p.id} className="ta-card ta-card-hover" style={{ padding: 0, overflow: "hidden", borderRadius: 10, display: "flex", flexDirection: "column", background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div style={{ position: "relative", width: "100%", height: 100, overflow: "hidden" }}>
                  <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(15,23,42,0.2) 0%, rgba(15,23,42,0.7) 100%)" }} />
                  <div style={{ position: "absolute", top: 10, right: 10 }}>
                    <Tag tone={p.isPublished ? "success" : "default"}>{p.isPublished ? "Published" : "Draft"}</Tag>
                  </div>
                  <div style={{ position: "absolute", bottom: 8, left: 12, right: 12, color: "#FFFFFF", fontWeight: 800, fontSize: 14.5, textShadow: "0 2px 4px rgba(0,0,0,0.6)", lineHeight: 1.25, wordBreak: "break-word" }}>
                    {p.title}
                  </div>
                </div>

                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.description || "Guided multi-course milestone journey."}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 8, textTransform: "capitalize", fontWeight: 600 }}>
                      {p.level} • {p.courseIds.length} course{p.courseIds.length === 1 ? "" : "s"}
                      {p.category ? ` • ${p.category}` : ""}
                    </div>
                    {/* Real uptake, so an unused path no longer looks identical
                        to the organization's most popular one. */}
                    <div className="ta-row ta-gap6" style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 6 }}>
                      <Users size={12} />
                      {enrollmentCountsQuery.loading
                        ? "Loading enrollments..."
                        : `${uptake.total} enrolled${uptake.completed ? ` • ${uptake.completed} completed` : ""}`}
                    </div>
                  </div>

                  <div className="ta-col ta-gap8" style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                    <div className="ta-row ta-between">
                      <div className="ta-row ta-gap8">
                        <Switch on={p.isPublished} onChange={() => handleTogglePublish(p)} />
                        <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>{p.isPublished ? "Live" : "Draft"}</span>
                      </div>
                      <button className="ta-iconbtn" onClick={() => handleDelete(p)} aria-label="Delete"><Trash2 size={15} color="var(--danger)" /></button>
                    </div>
                    <div className="ta-row ta-gap6">
                      <button className="ta-btn ta-btn-primary ta-btn-sm" style={{ flex: 1 }} onClick={() => setBuilderPathId(p.id)}>
                        <Route size={13} /> Build journey
                      </button>
                      <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => openEdit(p)}>Edit</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}
