import React, { useState, useContext, useMemo } from "react";
import { ToastContext, Switch } from "../components/PlatformUI.jsx";
import { PortalModal } from "../../components/common/PortalModal.jsx";
import FileUploadZone from "../../components/common/FileUploadZone.jsx";
import { createCourse, replaceCourseLessons } from "../../lib/api/platform.js";
import {
  X, ChevronLeft, ChevronRight, CheckCircle2, Plus, Trash2, ArrowUp, ArrowDown,
  BookOpen, ListOrdered, ShieldCheck, Rocket, Wand2,
} from "lucide-react";

/**
 * Course Builder - a guided popup wizard for creating a course.
 *
 * Replaces the inline "Create New Course" card that used to sit at the bottom
 * of the course list. That card collected a title, a category and a cover
 * image, then wrote the course straight out as published - so level, duration,
 * price, description, whether the course was mandatory, its compliance due
 * window, whether it needed approval to join, and its entire curriculum were
 * all unreachable at creation time and had to be filled in afterwards through
 * a separate edit screen. Every one of those is a real column on `courses`
 * (or a real `lessons` row) that createCourse/replaceCourseLessons already
 * accepted.
 *
 * Four steps, all writing real data on submit:
 *   1. Details    - title, description, category, level, duration, price, cover
 *   2. Curriculum - ordered lessons (lessons table, via replaceCourseLessons)
 *   3. Access     - mandatory + compliance due window, approval-to-join
 *   4. Review     - full summary, then publish now or save as a draft
 */

const STEPS = [
  { key: "details", label: "Details", Icon: BookOpen },
  { key: "curriculum", label: "Curriculum", Icon: ListOrdered },
  { key: "access", label: "Access", Icon: ShieldCheck },
  { key: "review", label: "Review", Icon: Rocket },
];

const LEVELS = ["beginner", "intermediate", "advanced"];

const EMPTY_FORM = {
  title: "",
  description: "",
  category: "Data & AI",
  level: "beginner",
  hours: "",
  price: "",
  coverImageUrl: "",
  mandatory: false,
  complianceDueDays: "",
  requiresApproval: false,
  publishNow: true,
};

export function CourseBuilderWizard({ isOpen, onClose, orgId, currentUserId, onCreated, categorySuggestions = [] }) {
  const showToast = useContext(ToastContext);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [lessons, setLessons] = useState([]);
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const categories = useMemo(() => {
    const base = ["Data & AI", "Design & UX", "Leadership", "Compliance", "Engineering", "Product"];
    const merged = [...new Set([...categorySuggestions.filter(Boolean), ...base])];
    return merged;
  }, [categorySuggestions]);

  function reset() {
    setStep(0);
    setForm(EMPTY_FORM);
    setLessons([]);
  }

  function handleClose() {
    if (saving) return;
    reset();
    onClose?.();
  }

  function addLesson() {
    setLessons((prev) => [...prev, { title: "", duration: "", videoUrl: "" }]);
  }

  function updateLesson(index, patch) {
    setLessons((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function removeLesson(index) {
    setLessons((prev) => prev.filter((_, i) => i !== index));
  }

  function moveLesson(index, direction) {
    setLessons((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const namedLessons = lessons.filter((l) => l.title.trim());
  const canAdvance = step !== 0 || form.title.trim().length > 0;

  async function handleSubmit() {
    if (!form.title.trim()) { showToast("A course title is required."); return; }
    setSaving(true);
    try {
      const course = await createCourse({
        organizationId: orgId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        level: form.level,
        hours: form.hours === "" ? null : Number(form.hours),
        price: form.price === "" ? 0 : Number(form.price),
        mandatory: form.mandatory,
        // Only meaningful for a mandatory course - sending a due window for a
        // non-mandatory one would put a deadline on the compliance queue for
        // a course that never enters it.
        complianceDueDays: form.mandatory && form.complianceDueDays !== "" ? Number(form.complianceDueDays) : null,
        requiresApproval: form.requiresApproval,
        status: form.publishNow ? "published" : "draft",
        coverImageUrl: form.coverImageUrl || undefined,
      }, currentUserId);

      if (namedLessons.length && course?.id) {
        await replaceCourseLessons(course.id, namedLessons.map((l) => ({
          title: l.title.trim(),
          duration: l.duration === "" ? null : Number(l.duration),
          videoUrl: l.videoUrl.trim() || null,
        })));
      }

      showToast(
        form.publishNow
          ? `"${form.title.trim()}" published${namedLessons.length ? ` with ${namedLessons.length} lesson${namedLessons.length === 1 ? "" : "s"}` : ""}.`
          : `"${form.title.trim()}" saved as a draft.`
      );
      onCreated?.(course);
      reset();
      onClose?.();
    } catch (err) {
      showToast("Could not create this course: " + (err?.message || "unknown error"));
    } finally {
      setSaving(false);
    }
  }

  const totalMinutes = namedLessons.reduce((sum, l) => sum + (Number(l.duration) || 0), 0);

  return (
    <PortalModal isOpen={isOpen} onClose={handleClose} maxWidth={720} zIndex={9999}>
      <div className="ta-row ta-between" style={{ gap: 10 }}>
        <div className="ta-row ta-gap10" style={{ minWidth: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Wand2 size={18} color="var(--primary)" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="ta-title" style={{ fontSize: 18 }}>Course Builder</div>
            <div style={{ fontSize: 12, color: "var(--text-2)" }}>
              Step {step + 1} of {STEPS.length} — {STEPS[step].label}
            </div>
          </div>
        </div>
        <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={handleClose} aria-label="Close"><X size={16} /></button>
      </div>

      {/* Step rail - clickable backwards, so a reviewer on the last step can
          jump straight back to the field they want to fix instead of paging. */}
      <div className="ta-row ta-gap6 ta-mt16" style={{ flexWrap: "wrap" }}>
        {STEPS.map((s, i) => {
          const Icon = s.Icon;
          const done = i < step;
          const active = i === step;
          return (
            <button
              key={s.key}
              onClick={() => { if (i < step) setStep(i); }}
              disabled={i > step}
              className="ta-row ta-gap6"
              style={{
                flex: "1 1 120px", minWidth: 0, padding: "8px 10px", borderRadius: 10,
                border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                background: active ? "var(--primary-tint)" : done ? "var(--surface-2)" : "transparent",
                color: active ? "var(--primary)" : done ? "var(--text)" : "var(--text-3)",
                cursor: i < step ? "pointer" : "default", fontSize: 12, fontWeight: 700,
              }}
            >
              {done ? <CheckCircle2 size={14} /> : <Icon size={14} />}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* ---------------- Step 1: Details ---------------- */}
      {step === 0 && (
        <div className="ta-mt16">
          <div className="ta-label">Course title *</div>
          <input
            className="ta-input ta-mt6" style={{ width: "100%", boxSizing: "border-box" }}
            placeholder="e.g. Applied Machine Learning for Analysts"
            value={form.title} onChange={(e) => set("title", e.target.value)} autoFocus
          />

          <div className="ta-label ta-mt16">Description</div>
          <textarea
            className="ta-input ta-mt6" style={{ width: "100%", minHeight: 80, boxSizing: "border-box" }}
            placeholder="What a learner will be able to do by the end of this course"
            value={form.description} onChange={(e) => set("description", e.target.value)}
          />

          <div className="ta-grid ta-grid-2 ta-gap12 ta-mt16">
            <div>
              <div className="ta-label">Category</div>
              <input
                className="ta-input ta-mt6" style={{ width: "100%", boxSizing: "border-box" }}
                list="ta-course-categories" placeholder="e.g. Data & AI"
                value={form.category} onChange={(e) => set("category", e.target.value)}
              />
              <datalist id="ta-course-categories">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                Categories double as the learner-facing tracks, so reuse an existing one where it fits.
              </div>
            </div>
            <div>
              <div className="ta-label">Level</div>
              <div className="ta-row ta-gap6 ta-mt6" style={{ flexWrap: "wrap" }}>
                {LEVELS.map((l) => (
                  <div
                    key={l}
                    className={`ta-pill ${form.level === l ? "ta-pill-active" : "ta-pill-inactive"}`}
                    style={{ textTransform: "capitalize", cursor: "pointer" }}
                    onClick={() => set("level", l)}
                  >
                    {l}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="ta-grid ta-grid-2 ta-gap12 ta-mt16">
            <div>
              <div className="ta-label">Estimated duration (hours)</div>
              <input
                className="ta-input ta-mt6" style={{ width: "100%", boxSizing: "border-box" }}
                type="number" min="0" step="0.5" placeholder="e.g. 6"
                value={form.hours} onChange={(e) => set("hours", e.target.value)}
              />
            </div>
            <div>
              <div className="ta-label">Price</div>
              <input
                className="ta-input ta-mt6" style={{ width: "100%", boxSizing: "border-box" }}
                type="number" min="0" placeholder="0 for free"
                value={form.price} onChange={(e) => set("price", e.target.value)}
              />
            </div>
          </div>

          <div className="ta-label ta-mt16">Cover image (optional)</div>
          <div className="ta-mt6">
            <FileUploadZone
              bucket="uploads"
              pathPrefix="courses/covers"
              accept="image/*"
              maxSizeMB={5}
              label="Drag and drop a cover image, or click to browse"
              onUploaded={(url) => set("coverImageUrl", url)}
            />
          </div>
          {form.coverImageUrl && (
            <div className="ta-row ta-gap8 ta-mt8" style={{ fontSize: 12, color: "var(--success)" }}>
              <CheckCircle2 size={14} /> Cover image uploaded
            </div>
          )}
        </div>
      )}

      {/* ---------------- Step 2: Curriculum ---------------- */}
      {step === 1 && (
        <div className="ta-mt16">
          <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
            Add lessons in the order learners take them. These are written to the real
            lessons table on save — you can keep editing them later from Manage Course.
            Leaving this empty creates the course shell only.
          </div>

          {lessons.length === 0 && (
            <div className="ta-empty ta-mt12">No lessons yet. Add your first one below.</div>
          )}

          <div className="ta-col ta-gap8 ta-mt12">
            {lessons.map((lesson, idx) => (
              <div key={idx} className="ta-card" style={{ padding: 12, background: "var(--surface-2)" }}>
                <div className="ta-row ta-between" style={{ gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-3)" }}>Lesson {idx + 1}</div>
                  <div className="ta-row ta-gap6">
                    <button className="ta-iconbtn" disabled={idx === 0} onClick={() => moveLesson(idx, -1)} aria-label="Move up"><ArrowUp size={13} /></button>
                    <button className="ta-iconbtn" disabled={idx === lessons.length - 1} onClick={() => moveLesson(idx, 1)} aria-label="Move down"><ArrowDown size={13} /></button>
                    <button className="ta-iconbtn" onClick={() => removeLesson(idx)} aria-label="Remove lesson"><Trash2 size={13} color="var(--danger)" /></button>
                  </div>
                </div>
                <input
                  className="ta-input ta-mt8" style={{ width: "100%", boxSizing: "border-box" }}
                  placeholder="Lesson title"
                  value={lesson.title} onChange={(e) => updateLesson(idx, { title: e.target.value })}
                />
                <div className="ta-grid ta-grid-2 ta-gap8 ta-mt8">
                  <input
                    className="ta-input" style={{ width: "100%", boxSizing: "border-box" }}
                    type="number" min="0" placeholder="Minutes"
                    value={lesson.duration} onChange={(e) => updateLesson(idx, { duration: e.target.value })}
                  />
                  <input
                    className="ta-input" style={{ width: "100%", boxSizing: "border-box" }}
                    placeholder="Video URL (optional)"
                    value={lesson.videoUrl} onChange={(e) => updateLesson(idx, { videoUrl: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>

          <button className="ta-btn ta-btn-outline ta-mt12" onClick={addLesson}>
            <Plus size={15} /> Add lesson
          </button>

          {namedLessons.length > 0 && (
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 10 }}>
              {namedLessons.length} lesson{namedLessons.length === 1 ? "" : "s"} ready
              {totalMinutes > 0 ? ` • ${totalMinutes} minutes of content` : ""}
              {lessons.length !== namedLessons.length ? ` • ${lessons.length - namedLessons.length} untitled row${lessons.length - namedLessons.length === 1 ? "" : "s"} will be skipped` : ""}
            </div>
          )}
        </div>
      )}

      {/* ---------------- Step 3: Access & compliance ---------------- */}
      {step === 2 && (
        <div className="ta-mt16">
          <div className="ta-card" style={{ padding: 14 }}>
            <div className="ta-row ta-between" style={{ gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>Mandatory course</div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                  Appears in the compliance queue for assigned learners and is tracked for overdue status.
                </div>
              </div>
              <Switch on={form.mandatory} onChange={() => set("mandatory", !form.mandatory)} />
            </div>
            {form.mandatory && (
              <div className="ta-mt12">
                <div className="ta-label">Default due window (days from assignment)</div>
                <input
                  className="ta-input ta-mt6" style={{ width: "100%", boxSizing: "border-box" }}
                  type="number" min="1" placeholder="e.g. 30"
                  value={form.complianceDueDays} onChange={(e) => set("complianceDueDays", e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="ta-card ta-mt12" style={{ padding: 14 }}>
            <div className="ta-row ta-between" style={{ gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>Require approval to join</div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                  Learners apply instead of enrolling instantly. Applications land in this course's Applications tab.
                </div>
              </div>
              <Switch on={form.requiresApproval} onChange={() => set("requiresApproval", !form.requiresApproval)} />
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Step 4: Review & publish ---------------- */}
      {step === 3 && (
        <div className="ta-mt16">
          <div className="ta-card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 15, overflowWrap: "anywhere" }}>{form.title.trim() || "Untitled course"}</div>
            {form.description.trim() && (
              <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 6, overflowWrap: "anywhere" }}>{form.description.trim()}</div>
            )}
            <div className="ta-col ta-gap6 ta-mt12" style={{ fontSize: 12.5 }}>
              {[
                ["Category", form.category.trim() || "Uncategorised"],
                ["Level", form.level],
                ["Duration", form.hours === "" ? "Not set" : `${form.hours}h`],
                ["Price", form.price === "" || Number(form.price) === 0 ? "Free" : String(form.price)],
                ["Lessons", namedLessons.length ? `${namedLessons.length}${totalMinutes ? ` (${totalMinutes} min)` : ""}` : "None yet"],
                ["Mandatory", form.mandatory ? `Yes${form.complianceDueDays ? ` • due in ${form.complianceDueDays} days` : ""}` : "No"],
                ["Approval to join", form.requiresApproval ? "Required" : "Not required"],
                ["Cover image", form.coverImageUrl ? "Uploaded" : "None"],
              ].map(([label, value]) => (
                <div key={label} className="ta-row ta-between" style={{ gap: 10 }}>
                  <span style={{ color: "var(--text-3)" }}>{label}</span>
                  <span style={{ fontWeight: 600, textAlign: "right", overflowWrap: "anywhere", textTransform: label === "Level" ? "capitalize" : "none" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="ta-card ta-mt12" style={{ padding: 14 }}>
            <div className="ta-row ta-between" style={{ gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>Publish immediately</div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                  Turn this off to save as a draft. Drafts are invisible to learners until published.
                </div>
              </div>
              <Switch on={form.publishNow} onChange={() => set("publishNow", !form.publishNow)} />
            </div>
          </div>

          {namedLessons.length === 0 && (
            <div className="ta-mt12" style={{ fontSize: 12, color: "var(--warning)" }}>
              This course has no lessons yet. That's fine — it will be created as a shell you can add lessons to from Manage Course.
            </div>
          )}
        </div>
      )}

      {/* ---------------- Footer nav ---------------- */}
      <div className="ta-row ta-between ta-mt20" style={{ gap: 10, paddingTop: 14, borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
        <button
          className="ta-btn ta-btn-outline"
          onClick={() => (step === 0 ? handleClose() : setStep((s) => s - 1))}
          disabled={saving}
        >
          {step === 0 ? "Cancel" : <><ChevronLeft size={15} /> Back</>}
        </button>

        {step < STEPS.length - 1 ? (
          <button className="ta-btn ta-btn-primary" disabled={!canAdvance} onClick={() => setStep((s) => s + 1)}>
            Next <ChevronRight size={15} />
          </button>
        ) : (
          <button className="ta-btn ta-btn-primary" disabled={saving || !form.title.trim()} onClick={handleSubmit}>
            <CheckCircle2 size={15} /> {saving ? "Creating..." : form.publishNow ? "Create & publish" : "Save as draft"}
          </button>
        )}
      </div>
    </PortalModal>
  );
}

export default CourseBuilderWizard;
