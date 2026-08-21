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
                <div key={c.id} className="ta-row ta-between ta-dropdown-item" style={{ padding: "6px 10px" }} onClick={() => toggleCourseSelected(c.id)}>
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
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* =========================================================================
            LEARNING PATHS HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner">
          <img
            src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1400&auto=format&fit=crop&q=85"
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
                Curriculum Tracks &amp; Learning Paths
              </h1>
              <p className="ta-hero-desc">
                Design progressive career roadmaps and module sequence flows.
              </p>
            </div>

            <div className="ta-hero-actions">
              <button className="ta-btn ta-btn-primary" onClick={openCreate} style={{ background: "#4F46E5", border: "none" }}>
                <Plus size={15} /> New Learning Path
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
          <div className="anim-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          {paths.map((p, idx) => {
            const pathImages = [
              "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80",
              "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80",
              "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&auto=format&fit=crop&q=80",
              "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80"
            ];
            const img = pathImages[idx % pathImages.length];

            return (
              <div key={p.id} className="ta-card ta-card-hover" style={{ padding: 0, overflow: "hidden", borderRadius: 16, display: "flex", flexDirection: "column", background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div style={{ position: "relative", width: "100%", height: 100, overflow: "hidden" }}>
                  <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(15,23,42,0.2) 0%, rgba(15,23,42,0.7) 100%)" }} />
                  <div style={{ position: "absolute", top: 10, right: 10 }}>
                    <Tag tone={p.isPublished ? "success" : "default"}>{p.isPublished ? "Published" : "Draft"}</Tag>
                  </div>
                  <div style={{ position: "absolute", bottom: 8, left: 12, right: 12, color: "#FFFFFF", fontWeight: 800, fontSize: 15, textShadow: "0 2px 4px rgba(0,0,0,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.title}
                  </div>
                </div>

                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.description || "Guided multi-course milestone journey."}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 8, textTransform: "capitalize", fontWeight: 600 }}>
                      {p.level} • {p.courseIds.length} course{p.courseIds.length === 1 ? "" : "s"}
                    </div>
                  </div>

                  <div className="ta-row ta-between" style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                    <div className="ta-row ta-gap8">
                      <Switch on={p.isPublished} onChange={() => handleTogglePublish(p)} />
                      <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>{p.isPublished ? "Live" : "Draft"}</span>
                    </div>
                    <div className="ta-row ta-gap6">
                      <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => openEdit(p)}>Edit Track</button>
                      <button className="ta-iconbtn" onClick={() => handleDelete(p)} aria-label="Delete"><Trash2 size={15} color="var(--danger)" /></button>
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
