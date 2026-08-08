import React, { useState, useContext } from "react";
import { TopBar, Tag, ToastContext, Switch } from "../components/PlatformUI.jsx";
import { Plus, ArrowLeft, Save, Trash2, Map as MapIcon, GripVertical, X } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchLearningPathsAdmin, createLearningPath, updateLearningPath,
  deleteLearningPath, togglePublishLearningPath, fetchCourses,
} from "../../lib/api/platform.js";

// Admin Learning Paths - per the product brief: "Learning Paths are
// primarily an Admin feature, not a learner feature. Admins organize:
// Tracks, Cohorts, Assigned learning journeys." The backend for this
// (createLearningPath / updateLearningPath / fetchLearningPathsAdmin in
// lib/api/platform.js) already existed, fully written, but had no admin
// screen anywhere in the app - the only place a path was ever visible was
// the learner-facing page, which the brief has since had removed. Without
// this screen, Learning Paths had no interface at all, learner or admin.
const LEVELS = ["beginner", "intermediate", "advanced"];

export function LearningPathsScreen({ orgId, orgSelector, setScreen }) {
  const showToast = useContext(ToastContext);
  const pathsQuery = useSupabaseQuery(async () => fetchLearningPathsAdmin(), []);
  const coursesQuery = useSupabaseQuery(async () => fetchCourses(), []);
  const paths = pathsQuery.data || [];
  const courses = coursesQuery.data || [];

  const [editingId, setEditingId] = useState(null); // null = list view, "new" = create, uuid = edit
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("beginner");
  const [selectedCourseIds, setSelectedCourseIds] = useState([]);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditingId("new");
    setTitle(""); setDescription(""); setLevel("beginner"); setSelectedCourseIds([]);
  }

  function openEdit(path) {
    setEditingId(path.id);
    setTitle(path.title || "");
    setDescription(path.description || "");
    setLevel(path.level || "beginner");
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
      const payload = { title: title.trim(), description: description.trim(), level, courseIds: selectedCourseIds };
      if (editingId === "new") {
        await createLearningPath(payload, orgId, null);
        showToast("Learning path created!");
      } else {
        await updateLearningPath(editingId, payload);
        showToast("Learning path updated!");
      }
      pathsQuery.refetch();
      closeEditor();
    } catch (err) {
      showToast(err?.message || "Could not save the learning path.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(path) {
    try {
      await deleteLearningPath(path.id);
      showToast(`"${path.title}" deleted.`);
      pathsQuery.refetch();
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

  // ---- Editor (create/edit) ----
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
            <input className="ta-input ta-mt6" style={{ width: "100%" }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Data Analytics Foundations" />

            <div className="ta-label ta-mt16">Description</div>
            <textarea className="ta-input ta-mt6" style={{ width: "100%", minHeight: 70 }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this journey prepares a learner for" />

            <div className="ta-label ta-mt16">Level</div>
            <div className="ta-row ta-gap8 ta-mt6">
              {LEVELS.map((l) => (
                <div key={l} className={`ta-pill ${level === l ? "ta-pill-active" : "ta-pill-inactive"}`} style={{ textTransform: "capitalize", cursor: "pointer" }} onClick={() => setLevel(l)}>
                  {l}
                </div>
              ))}
            </div>

            <div className="ta-label ta-mt16">Courses in this path ({selectedCourseIds.length} selected)</div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginBottom: 8 }}>
              Selected courses run in the order shown below. Use the arrows to reorder.
            </div>

            {selectedCourseIds.length > 0 && (
              <div className="ta-col ta-gap6 ta-mt6">
                {selectedCourseIds.map((cid, idx) => {
                  const course = courses.find((c) => c.id === cid);
                  return (
                    <div key={cid} className="ta-row ta-between" style={{ padding: "8px 10px", background: "var(--surface-2)", borderRadius: 10 }}>
                      <div className="ta-row ta-gap8">
                        <GripVertical size={14} color="var(--text-3)" />
                        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{idx + 1}. {course?.title || "Unknown course"}</span>
                      </div>
                      <div className="ta-row ta-gap6">
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
                <div key={c.id} className="ta-row ta-between" style={{ padding: "6px 10px", cursor: "pointer" }} onClick={() => toggleCourseSelected(c.id)}>
                  <span style={{ fontSize: 12.5 }}>{c.title}</span>
                  <Plus size={14} color="var(--primary)" />
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
      <div className="ta-content">
        <button className="ta-btn ta-btn-primary" onClick={openCreate}><Plus size={15} /> New Learning Path</button>

        <div className="ta-col ta-gap12 ta-mt16">
          {pathsQuery.loading && <div className="ta-empty">Loading learning paths...</div>}
          {!pathsQuery.loading && paths.length === 0 && (
            <div className="ta-empty">
              <MapIcon size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
              <div>No learning paths yet. Create one to guide learners through an ordered set of courses.</div>
            </div>
          )}
          {paths.map((p) => (
            <div key={p.id} className="ta-card">
              <div className="ta-row ta-between">
                <div>
                  <div className="ta-row ta-gap8">
                    <div className="ta-title" style={{ fontSize: 15 }}>{p.title}</div>
                    <Tag tone={p.isPublished ? "success" : "default"}>{p.isPublished ? "Published" : "Draft"}</Tag>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>{p.description || "No description"}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 6, textTransform: "capitalize" }}>
                    {p.level} · {p.courseIds.length} course{p.courseIds.length === 1 ? "" : "s"}
                    {p.courseTitles.length > 0 && `: ${p.courseTitles.join(" → ")}`}
                  </div>
                </div>
                <div className="ta-row ta-gap8" style={{ flexShrink: 0 }}>
                  <Switch on={p.isPublished} onChange={() => handleTogglePublish(p)} />
                  <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => openEdit(p)}>Edit</button>
                  <button className="ta-iconbtn" onClick={() => handleDelete(p)} aria-label="Delete"><Trash2 size={15} color="var(--danger)" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
