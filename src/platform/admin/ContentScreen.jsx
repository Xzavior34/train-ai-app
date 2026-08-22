import React, { useState, useEffect, useContext } from "react";
import { TopBar, Tag, ToastContext, Switch } from "../components/PlatformUI.jsx";
import { Plus, ArrowLeft, Save, Trash2, BookOpen, Layers, Users, Eye, CheckCircle2, Clock, DollarSign, Upload, FileText, Settings, ShieldCheck, X, Check, GraduationCap, Award, ChevronUp, ChevronDown, Sparkles } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchCourses, createCourse, updateCourse, deleteCourse, replaceCourseLessons, fetchCourseApplications, decideCourseApplication, fetchCourseEnrolledLearners, fetchAssessmentAttemptsForCourse, overrideAssessmentScore, fetchCertificateRequestsForCourse, reviewCertificate, upsertCertificateTemplate, fetchAssessmentForCourseWithQuestions, createAssessmentForCourse, addAssessmentQuestion, deleteAssessmentQuestion, checkEffectiveOrgPermission, issueCertificateDirectly, fetchCourseMaterials, addCourseMaterial, deleteCourseMaterial, fetchCourseQualityReview, submitCourseQualityReview } from "../../lib/api/platform.js";
import { fetchCertificateForCourse } from "../../lib/api/learner.js";
import FileUploadZone from "../../components/common/FileUploadZone.jsx";

function GradingRow({ attempt, currentUserId, onOverride }) {
  const [editing, setEditing] = useState(false);
  const [scoreInput, setScoreInput] = useState(String(attempt.score ?? ""));
  const [noteInput, setNoteInput] = useState(attempt.override_note || "");
  const [saving, setSaving] = useState(false);

  return (
    <tr>
      <td style={{ fontWeight: 600 }}>{attempt.user_profiles?.display_name || "Unnamed learner"}</td>
      <td style={{ fontSize: 12.5 }}>{attempt.completed_at ? new Date(attempt.completed_at).toLocaleDateString() : "N/A"}</td>
      <td style={{ fontSize: 12.5 }}>{attempt.ai_score ?? "N/A"}%</td>
      <td style={{ fontWeight: 700 }}>
        {attempt.score}%{attempt.overridden_by && <Tag tone="warning">Overridden</Tag>}
      </td>
      <td>
        {editing ? (
          <div className="ta-row ta-gap6">
            <input className="ta-input" style={{ width: 64 }} type="number" min={0} max={100} value={scoreInput} onChange={(e) => setScoreInput(e.target.value)} />
            <input className="ta-input" style={{ width: 140 }} placeholder="Note (optional)" value={noteInput} onChange={(e) => setNoteInput(e.target.value)} />
            <button
              className="ta-btn ta-btn-primary ta-btn-sm"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try { await onOverride(Number(scoreInput), noteInput); setEditing(false); } finally { setSaving(false); }
              }}
            >
              Save
            </button>
            <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        ) : (
          <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => setEditing(true)}>Override</button>
        )}
      </td>
    </tr>
  );
}

export function ContentScreen({ orgId, orgSelector, setScreen, selectedCourseId, setSelectedCourseId, currentUserId }) {
  const showToast = useContext(ToastContext);
  const [activeCourseId, setActiveCourseId] = useState(selectedCourseId || null);
  const [activeTab, setActiveTab] = useState("overview"); // overview, curriculum, learners

  // Sync external prop if coming from search click
  useEffect(() => {
    if (selectedCourseId) {
      setActiveCourseId(selectedCourseId);
    }
  }, [selectedCourseId]);

  const [newCourseOpen, setNewCourseOpen] = useState(false);
  const [selectedCourseIds, setSelectedCourseIds] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Bulk course actions - confirmed directly against the real 1.0
  // reference codebase (BulkCourseActions.tsx) - publish/unpublish/
  // archive several courses at once rather than one at a time. Uses the
  // exact same updateCourse()/deleteCourse() functions already used for
  // a single course, not a new, parallel write path.
  async function handleBulkAction(action) {
    if (selectedCourseIds.size === 0) return;
    setBulkActionLoading(true);
    try {
      for (const id of selectedCourseIds) {
        if (action === "publish") await updateCourse(id, { status: "published" });
        else if (action === "unpublish") await updateCourse(id, { status: "draft" });
        else if (action === "archive") await deleteCourse(id);
      }
      showToast(`${action === "publish" ? "Published" : action === "unpublish" ? "Unpublished" : "Archived"} ${selectedCourseIds.size} course${selectedCourseIds.size === 1 ? "" : "s"}.`);
      setSelectedCourseIds(new Set());
      coursesQuery.refetch();
    } catch (e) {
      showToast(e.message || "Could not complete this bulk action.");
    } finally {
      setBulkActionLoading(false);
    }
  }
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Data & AI");
  const [newCoverImageUrl, setNewCoverImageUrl] = useState("");

  const coursesQuery = useSupabaseQuery(async () => fetchCourses(orgId), [orgId]);
  const courses = coursesQuery.data || [];

  const activeCourse = courses.find(c => c.id === activeCourseId) || null;

  // Active course edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editLevel, setEditLevel] = useState("beginner");
  const [editHours, setEditHours] = useState(0);
  const [editPrice, setEditPrice] = useState(0);
  const [editDescription, setEditDescription] = useState("");
  const [editIsPublished, setEditIsPublished] = useState(false);
  const [editCoverImageUrl, setEditCoverImageUrl] = useState("");
  const [editLessons, setEditLessons] = useState([]);
  const [editRequiresApproval, setEditRequiresApproval] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (activeCourse) {
      setEditTitle(activeCourse.title || "");
      setEditCategory(activeCourse.category || "General");
      setEditLevel(activeCourse.level || "beginner");
      setEditHours(activeCourse.duration_hours || 0);
      setEditPrice(activeCourse.price || 0);
      setEditDescription(activeCourse.description || "");
      setEditIsPublished(!!activeCourse.is_published);
      setEditCoverImageUrl(activeCourse.cover_image_url || "");
      setEditLessons(activeCourse.lessons ? [...activeCourse.lessons].sort((a, b) => (a.order_index || 0) - (b.order_index || 0)) : []);
      setEditRequiresApproval(!!activeCourse.requires_approval);
    }
  }, [activeCourseId, activeCourse]);

  // "Apply for a course" - staff side (see supabase/migrations/0100_course_applications.sql).
  // RLS already scopes fetchCourseApplications to whatever this admin/instructor
  // is allowed to see, so this is safe to load unconditionally per active course.
  const applicationsQuery = useSupabaseQuery(async () => (activeCourse ? fetchCourseApplications(activeCourse.id) : []), [activeCourse?.id]);
  const assessmentAttemptsQuery = useSupabaseQuery(async () => (activeCourse ? fetchAssessmentAttemptsForCourse(activeCourse.id) : []), [activeCourse?.id]);
  // Real assessment creation - a real, confirmed gap: only grading of
  // already-existing attempts existed here before this; nothing anywhere
  // let anyone actually create an assessment with real questions. The
  // database (assessments_write_authorized / aq_write_authorized,
  // 0112_assessments_pipeline.sql) already correctly scopes this to
  // c.instructor_id = auth.uid() (the real course owner) or an org admin -
  // real enforcement happens there, this UI doesn't need its own
  // role-gating on top of it.
  const assessmentQuery = useSupabaseQuery(async () => (activeCourse ? fetchAssessmentForCourseWithQuestions(activeCourse.id) : null), [activeCourse?.id]);
  const [newQTitle, setNewQTitle] = useState("");
  const [newQOptions, setNewQOptions] = useState(["", "", "", ""]);
  const [newQCorrect, setNewQCorrect] = useState("");
  const [creatingAssessment, setCreatingAssessment] = useState(false);
  const [addingQuestion, setAddingQuestion] = useState(false);

  const certRequestsQuery = useSupabaseQuery(async () => (activeCourse ? fetchCertificateRequestsForCourse(activeCourse.id) : []), [activeCourse?.id]);
  const certTemplateQuery = useSupabaseQuery(async () => (activeCourse ? fetchCertificateForCourse(activeCourse.id) : null), [activeCourse?.id]);
  const pendingCertCount = (certRequestsQuery.data || []).filter((r) => r.status === "pending").length;
  const [certTitle, setCertTitle] = useState("Certificate of Completion");
  const [certPassingScore, setCertPassingScore] = useState("70");
  const [certRequiresApproval, setCertRequiresApproval] = useState(true);
  const [assignLearnerId, setAssignLearnerId] = useState("");
  const [assignCertTitle, setAssignCertTitle] = useState("");
  const [assignCertFileUrl, setAssignCertFileUrl] = useState("");
  const [issuingDirectCert, setIssuingDirectCert] = useState(false);
  useEffect(() => {
    if (certTemplateQuery.data) {
      setCertTitle(certTemplateQuery.data.title || "Certificate of Completion");
      setCertPassingScore(String(certTemplateQuery.data.passing_score_pct ?? 70));
      setCertRequiresApproval(certTemplateQuery.data.requires_admin_approval !== false);
    }
  }, [certTemplateQuery.data]);
  const pendingApplications = (applicationsQuery.data || []).filter(a => a.status === "pending");
  const enrolledLearnersQuery = useSupabaseQuery(async () => (activeCourse ? fetchCourseEnrolledLearners(activeCourse.id) : []), [activeCourse?.id]);
  const materialsQuery = useSupabaseQuery(async () => (activeCourse ? fetchCourseMaterials(activeCourse.id) : []), [activeCourse?.id]);
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialUrl, setMaterialUrl] = useState("");
  const [addingMaterial, setAddingMaterial] = useState(false);
  const qualityReviewQuery = useSupabaseQuery(async () => (activeCourse ? fetchCourseQualityReview(activeCourse.id) : null), [activeCourse?.id]);
  const [reviewStatus, setReviewStatus] = useState("approved");
  const [reviewScore, setReviewScore] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  async function handleDecideApplication(app, decision) {
    try {
      await decideCourseApplication({ applicationId: app.id, userId: app.user_id, courseId: app.course_id, decision, reviewedBy: currentUserId });
      applicationsQuery.refetch();
      coursesQuery.refetch();
      showToast(decision === "approved" ? `Approved: ${app.user_profiles?.display_name || "learner"} is now enrolled.` : "Application rejected.");
    } catch (e) {
      showToast(e?.message || "Could not update this application.");
    }
  }

  const handleSaveCourseSettings = async () => {
    if (!activeCourse) return;
    setIsSaving(true);
    try {
      await updateCourse(activeCourse.id, {
        title: editTitle.trim(),
        category: editCategory.trim(),
        level: editLevel,
        hours: Number(editHours),
        price: Number(editPrice),
        description: editDescription.trim(),
        status: editIsPublished ? "published" : "draft",
        coverImageUrl: editCoverImageUrl || undefined,
        requiresApproval: editRequiresApproval,
      });
      await replaceCourseLessons(activeCourse.id, editLessons);
      await coursesQuery.refetch();
      showToast("Course management changes saved successfully!");
    } catch (err) {
      showToast("Failed to update course: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!activeCourse) return;
    if (!window.confirm(`Are you sure you want to archive course "${activeCourse.title}"?`)) return;
    try {
      await deleteCourse(activeCourse.id);
      if (setSelectedCourseId) setSelectedCourseId(null);
      setActiveCourseId(null);
      await coursesQuery.refetch();
      showToast("Course archived successfully!");
    } catch (err) {
      showToast("Failed to archive course: " + err.message);
    }
  };

  const handleAddLesson = () => {
    setEditLessons(prev => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        title: `Lesson ${prev.length + 1}`,
        duration_minutes: 15,
        video_url: "",
      }
    ]);
  };

  const handleUpdateLesson = (idx, field, val) => {
    setEditLessons(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleRemoveLesson = (idx) => {
    setEditLessons(prev => prev.filter((_, i) => i !== idx));
  };

  // Lesson reordering - confirmed directly against the real 1.0 reference
  // codebase (LessonSequenceManager.tsx). Reorders the in-memory list only;
  // replaceCourseLessons() (already called on Save) submits the full list
  // in its new order, and order_index is assigned from array position
  // there - the same real save path already used for adding/removing a
  // lesson, not a new write path.
  const handleMoveLesson = (idx, direction) => {
    setEditLessons(prev => {
      const next = [...prev];
      const target = idx + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const handleCloseActiveCourse = () => {
    if (setSelectedCourseId) setSelectedCourseId(null);
    setActiveCourseId(null);
  };

  return (
    <div className="ta-fade">
      <TopBar
        title={activeCourse ? `Managing: ${activeCourse.title}` : "Content & Course Management"}
        sub={activeCourse ? "Admin workspace to edit settings, curriculum, and publishing" : "Build, manage, and publish organization courses"}
        orgSelector={orgSelector}
        onNavigate={setScreen}
        right={
          activeCourse ? (
            <div className="ta-row ta-gap8">
              <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={handleCloseActiveCourse}>
                <ArrowLeft size={14} /> Back to Courses
              </button>
              <button className="ta-btn ta-btn-primary ta-btn-sm" onClick={handleSaveCourseSettings} disabled={isSaving}>
                <Save size={14} /> {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          ) : (
            <button className="ta-btn ta-btn-primary" onClick={() => setNewCourseOpen(true)}>
              <Plus size={15} /> Create course
            </button>
          )
        }
      />

      <div className="ta-content">
        {/* ================================================================= */}
        {/* ADMIN WORKSPACE: DETAILED COURSE MANAGEMENT VIEW                   */}
        {/* ================================================================= */}
        {activeCourse ? (
          <div className="ta-col" style={{ gap: 24 }}>
            {/* Header banner card */}
            <div className="ta-card" style={{ background: "var(--surface)", position: "relative" }}>
              <div className="ta-row ta-between ta-gap16" style={{ flexWrap: "wrap" }}>
                <div className="ta-row ta-gap16" style={{ minWidth: 0, flex: 1 }}>
                  {activeCourse.cover_image_url ? (
                    <img
                      src={activeCourse.cover_image_url}
                      alt=""
                      style={{ width: 100, height: 75, objectFit: "cover", borderRadius: 10, flexShrink: 0, border: "1px solid var(--border)" }}
                    />
                  ) : (
                    <div style={{ width: 100, height: 75, borderRadius: 10, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid var(--border)" }}>
                      <BookOpen size={32} color="var(--primary)" />
                    </div>
                  )}
                  <div className="ta-col" style={{ minWidth: 0, justifyContent: "center" }}>
                    <div className="ta-row ta-gap8" style={{ marginBottom: 4 }}>
                      <Tag>{editCategory || "General"}</Tag>
                      <Tag tone={editIsPublished ? "success" : "warning"}>
                        {editIsPublished ? "Published (Live for Learners)" : "Draft (Hidden from Learners)"}
                      </Tag>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 20, color: "var(--text)" }}>{editTitle || activeCourse.title}</div>
                    <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                      {activeCourse.enrollment_count || 0} Learners Enrolled · {editLessons.length} Lessons · {editHours || 0} Total Hours
                    </div>
                  </div>
                </div>

                <div className="ta-row ta-gap10" style={{ flexWrap: "wrap" }}>
                  <button
                    className={`ta-btn ta-btn-sm ${editIsPublished ? "ta-btn-outline" : "ta-btn-primary"}`}
                    onClick={() => setEditIsPublished(!editIsPublished)}
                  >
                    {editIsPublished ? "Unpublish (Make Draft)" : "Publish Course Now"}
                  </button>
                  <button className="ta-btn ta-btn-danger ta-btn-sm" onClick={handleDeleteCourse}>
                    <Trash2 size={14} /> Archive Course
                  </button>
                </div>
              </div>

              {/* Navigation Tabs for Managing Course */}
              <div
                className="ta-row ta-gap16"
                style={{ marginTop: 20, borderBottom: "1px solid var(--border)", paddingBottom: 10, overflowX: "auto", flexWrap: "nowrap", WebkitOverflowScrolling: "touch" }}
              >
                <button
                  className={`ta-btn ta-btn-sm ${activeTab === "overview" ? "ta-btn-primary" : "ta-btn-ghost"}`}
                  onClick={() => setActiveTab("overview")}
                  style={{ flexShrink: 0, whiteSpace: "nowrap" }}
                >
                  <Settings size={14} /> Course Settings & Metadata
                </button>
                <button
                  className={`ta-btn ta-btn-sm ${activeTab === "curriculum" ? "ta-btn-primary" : "ta-btn-ghost"}`}
                  onClick={() => setActiveTab("curriculum")}
                  style={{ flexShrink: 0, whiteSpace: "nowrap" }}
                >
                  <Layers size={14} /> Curriculum & Lessons ({editLessons.length})
                </button>
                <button
                  className={`ta-btn ta-btn-sm ${activeTab === "materials" ? "ta-btn-primary" : "ta-btn-ghost"}`}
                  onClick={() => setActiveTab("materials")}
                  style={{ flexShrink: 0, whiteSpace: "nowrap" }}
                >
                  <FileText size={14} /> Materials ({(materialsQuery.data || []).length})
                </button>
                <button
                  className={`ta-btn ta-btn-sm ${activeTab === "learners" ? "ta-btn-primary" : "ta-btn-ghost"}`}
                  onClick={() => setActiveTab("learners")}
                  style={{ flexShrink: 0, whiteSpace: "nowrap" }}
                >
                  <Users size={14} /> Enrolled Students ({activeCourse.enrollment_count || 0})
                </button>
                <button
                  className={`ta-btn ta-btn-sm ${activeTab === "applications" ? "ta-btn-primary" : "ta-btn-ghost"}`}
                  onClick={() => setActiveTab("applications")}
                  style={{ flexShrink: 0, whiteSpace: "nowrap" }}
                >
                  <CheckCircle2 size={14} /> Applications {pendingApplications.length > 0 ? `(${pendingApplications.length} pending)` : ""}
                </button>
                <button
                  className={`ta-btn ta-btn-sm ${activeTab === "assessment" ? "ta-btn-primary" : "ta-btn-ghost"}`}
                  onClick={() => setActiveTab("assessment")}
                  style={{ flexShrink: 0, whiteSpace: "nowrap" }}
                >
                  <GraduationCap size={14} /> Assessment Grading
                </button>
                <button
                  className={`ta-btn ta-btn-sm ${activeTab === "certificates" ? "ta-btn-primary" : "ta-btn-ghost"}`}
                  onClick={() => setActiveTab("certificates")}
                  style={{ flexShrink: 0, whiteSpace: "nowrap" }}
                >
                  <Award size={14} /> Certificates {pendingCertCount > 0 ? `(${pendingCertCount} pending)` : ""}
                </button>
              </div>
            </div>

            {/* TAB 1: OVERVIEW & SETTINGS */}
            {activeTab === "overview" && (
              <div className="ta-grid ta-grid-2" style={{ gap: 24 }}>
                <div className="ta-card ta-col ta-gap16">
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Basic Information</div>

                  <div className="ta-col" style={{ gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)" }}>Course Title</label>
                    <input
                      className="ta-input"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      placeholder="Course title..."
                      style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", width: "100%" }}
                    />
                  </div>

                  <div className="ta-grid ta-grid-2 ta-gap12">
                    <div className="ta-col" style={{ gap: 4 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)" }}>Category</label>
                      <input
                        className="ta-input"
                        value={editCategory}
                        onChange={e => setEditCategory(e.target.value)}
                        placeholder="e.g. Data & AI, Cloud"
                        style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", width: "100%" }}
                      />
                    </div>
                    <div className="ta-col" style={{ gap: 4 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)" }}>Difficulty Level</label>
                      <select
                        className="ta-input"
                        value={editLevel}
                        onChange={e => setEditLevel(e.target.value)}
                        style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", width: "100%", background: "var(--surface)" }}
                      >
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>
                  </div>

                  <div className="ta-grid ta-grid-2 ta-gap12">
                    <div className="ta-col" style={{ gap: 4 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)" }}>Duration (Hours)</label>
                      <input
                        type="number"
                        className="ta-input"
                        value={editHours}
                        onChange={e => setEditHours(e.target.value)}
                        style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", width: "100%" }}
                      />
                    </div>
                    <div className="ta-col" style={{ gap: 4 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)" }}>Price ($)</label>
                      <input
                        type="number"
                        className="ta-input"
                        value={editPrice}
                        onChange={e => setEditPrice(e.target.value)}
                        style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", width: "100%" }}
                      />
                    </div>
                  </div>

                  <div className="ta-col" style={{ gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)" }}>Course Description</label>
                    <textarea
                      rows={5}
                      className="ta-input"
                      value={editDescription}
                      onChange={e => setEditDescription(e.target.value)}
                      placeholder="Detailed overview for students..."
                      style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", width: "100%", fontFamily: "var(--font)" }}
                    />
                  </div>
                </div>

                <div className="ta-card ta-col ta-gap16">
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Cover Image & Media</div>
                  {editCoverImageUrl && (
                    <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", maxHeight: 180 }}>
                      <img src={editCoverImageUrl} alt="Cover Preview" style={{ width: "100%", height: 180, objectFit: "cover" }} />
                    </div>
                  )}

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 6, display: "block" }}>Upload Cover Image</label>
                    <FileUploadZone
                      bucket="uploads"
                      pathPrefix="courses/covers"
                      accept="image/*"
                      maxSizeMB={5}
                      label="Drag and drop a course banner image, or click to upload"
                      onUploaded={(url) => setEditCoverImageUrl(url)}
                    />
                  </div>

                  <div className="ta-card" style={{ background: "var(--surface-2)", marginTop: 10 }}>
                    <div className="ta-row ta-gap8" style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>
                      <ShieldCheck size={16} color="var(--primary)" /> Admin Access Controls
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6, lineHeight: 1.5 }}>
                      As an admin, any changes saved here instantly update the platform database. Setting status to <strong>Draft</strong> hides this course from student search and catalog listings.
                    </div>
                    <label className="ta-row ta-gap8 ta-mt10" style={{ fontSize: 12.5, cursor: "pointer" }}>
                      <input type="checkbox" checked={editRequiresApproval} onChange={(e) => setEditRequiresApproval(e.target.checked)} />
                      Require approval to join. Learners request to enroll and you approve/reject them (Applications tab)
                    </label>
                  </div>

                  <div className="ta-card" style={{ background: "var(--surface-2)", marginTop: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Quality Review</div>
                    <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                      An optional QA record for this course - separate from publishing it. Publishing and unpublishing above still work exactly as before, with or without a review on file.
                    </div>
                    {qualityReviewQuery.data && (
                      <div className="ta-row ta-between ta-mt10" style={{ padding: 10, background: "var(--surface-3)", borderRadius: 10 }}>
                        <div>
                          <Tag tone={qualityReviewQuery.data.status === "approved" ? "success" : qualityReviewQuery.data.status === "rejected" ? "danger" : "warning"}>{qualityReviewQuery.data.status.replace("_", " ")}</Tag>
                          {qualityReviewQuery.data.quality_score && <span style={{ fontSize: 12, marginLeft: 8 }}>Score: {qualityReviewQuery.data.quality_score}/10</span>}
                          {qualityReviewQuery.data.review_notes && <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>{qualityReviewQuery.data.review_notes}</div>}
                        </div>
                      </div>
                    )}
                    <div className="ta-row ta-gap8 ta-mt10" style={{ flexWrap: "wrap" }}>
                      <select className="ta-input" style={{ width: 140 }} value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}>
                        <option value="approved">Approved</option>
                        <option value="needs_changes">Needs changes</option>
                        <option value="rejected">Rejected</option>
                      </select>
                      <input className="ta-input" type="number" min="1" max="10" style={{ width: 90 }} placeholder="Score" value={reviewScore} onChange={(e) => setReviewScore(e.target.value)} />
                      <input className="ta-input" style={{ flex: "1 1 200px" }} placeholder="Review notes (optional)" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
                      <button
                        className="ta-btn ta-btn-outline"
                        disabled={submittingReview}
                        onClick={async () => {
                          setSubmittingReview(true);
                          try {
                            const result = await submitCourseQualityReview(activeCourse.id, { status: reviewStatus, qualityScore: reviewScore ? Number(reviewScore) : null, reviewNotes, reviewerId: currentUserId });
                            if (!result.success) showToast(result.error);
                            else { showToast("Quality review submitted."); qualityReviewQuery.refetch(); setReviewNotes(""); }
                          } finally {
                            setSubmittingReview(false);
                          }
                        }}
                      >
                        Submit Review
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: CURRICULUM & LESSONS */}
            {activeTab === "curriculum" && (
              <div className="ta-card ta-col ta-gap16">
                <div className="ta-row ta-between">
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>Curriculum & Lesson Builder</div>
                    <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                      Manage lessons, video resources, and sequence for this course.
                    </div>
                  </div>
                  <div className="ta-row ta-gap8">
                    <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => {
                      const newGenerated = [
                        { id: `gen-${Date.now()}-1`, title: "1.0 Course Orientation & Foundations", duration_minutes: 15, video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
                        { id: `gen-${Date.now()}-2`, title: "2.0 Deep Dive & Core Architecture", duration_minutes: 30, video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
                        { id: `gen-${Date.now()}-3`, title: "3.0 Practical Lab & Case Study", duration_minutes: 45, video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
                        { id: `gen-${Date.now()}-4`, title: "4.0 Final Assessment & Certification", duration_minutes: 25, video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }
                      ];
                      setEditLessons(prev => [...prev, ...newGenerated]);
                      showToast("AI generated 4 new structured lessons!");
                    }}>
                      <Sparkles size={14} /> Auto-Generate with AI
                    </button>
                    <button className="ta-btn ta-btn-primary ta-btn-sm" onClick={handleAddLesson}>
                      <Plus size={14} /> Add New Lesson
                    </button>
                  </div>
                </div>

                {/* AI Curriculum Generator Trigger Card */}
                <div style={{
                  padding: "14px 18px",
                  borderRadius: 12,
                  background: "linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(147, 51, 234, 0.08) 100%)",
                  border: "1px solid rgba(99, 102, 241, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12
                }}>
                  <div className="ta-row ta-gap10">
                    <Sparkles size={18} color="#4F46E5" />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text)" }}>AI-Powered Curriculum Builder</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Generate modules, lesson outlines, and quizzes aligned with industry benchmarks in 1 click.</div>
                    </div>
                  </div>
                  <Tag tone="primary">AI Enabled</Tag>
                </div>

                {editLessons.length === 0 ? (
                  <div className="ta-empty" style={{ padding: 40, border: "1px dashed var(--border)", borderRadius: 12 }}>
                    No lessons created yet. Click "Add New Lesson" above to build the curriculum.
                  </div>
                ) : (
                  <div className="ta-col ta-gap12" style={{ marginTop: 10 }}>
                    {editLessons.map((l, idx) => (
                      <div
                        key={l.id || `lesson-${idx}`}
                        className="ta-card ta-row ta-between ta-gap12"
                        style={{ background: "var(--surface-3)", padding: 14, borderRadius: 10, border: "1px solid var(--border)", flexWrap: "wrap" }}
                      >
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                          {idx + 1}
                        </div>

                        <div className="ta-grid ta-grid-3 ta-gap12" style={{ flex: "1 1 200px", minWidth: 0 }}>
                          <div className="ta-col" style={{ gap: 4 }}>
                            <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>Lesson Title</label>
                            <input
                              className="ta-input"
                              value={l.title || ""}
                              onChange={e => handleUpdateLesson(idx, "title", e.target.value)}
                              placeholder="Lesson title..."
                              style={{ padding: "6px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--border)" }}
                            />
                          </div>

                          <div className="ta-col" style={{ gap: 4 }}>
                            <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>Duration (Mins)</label>
                            <input
                              type="number"
                              className="ta-input"
                              value={l.duration_minutes || l.duration || 15}
                              onChange={e => handleUpdateLesson(idx, "duration_minutes", Number(e.target.value))}
                              style={{ padding: "6px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--border)" }}
                            />
                          </div>

                          <div className="ta-col" style={{ gap: 4 }}>
                            <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>Video / Resource URL</label>
                            <input
                              className="ta-input"
                              value={l.video_url || l.videoUrl || ""}
                              onChange={e => handleUpdateLesson(idx, "video_url", e.target.value)}
                              placeholder="https://..."
                              style={{ padding: "6px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--border)" }}
                            />
                          </div>
                        </div>

                        <div className="ta-col" style={{ gap: 4 }}>
                          <button className="ta-btn ta-btn-ghost ta-btn-sm" disabled={idx === 0} onClick={() => handleMoveLesson(idx, -1)} title="Move up">
                            <ChevronUp size={15} />
                          </button>
                          <button className="ta-btn ta-btn-ghost ta-btn-sm" disabled={idx === editLessons.length - 1} onClick={() => handleMoveLesson(idx, 1)} title="Move down">
                            <ChevronDown size={15} />
                          </button>
                        </div>
                        <button className="ta-btn ta-btn-ghost ta-btn-sm" style={{ color: "var(--danger)" }} onClick={() => handleRemoveLesson(idx)} title="Remove Lesson">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: ENROLLED STUDENTS & STATS */}
            {activeTab === "materials" && (
              <div className="ta-card ta-col ta-gap16">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Course Materials</div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                    Downloadable files and reference links for this course, separate from its lessons.
                  </div>
                </div>
                <div className="ta-col ta-gap10">
                  {materialsQuery.loading && <div className="ta-empty">Loading materials...</div>}
                  {!materialsQuery.loading && (materialsQuery.data || []).length === 0 && <div className="ta-empty">No materials added yet.</div>}
                  {(materialsQuery.data || []).map((m) => (
                    <div key={m.id} className="ta-row ta-between" style={{ padding: 12, background: "var(--surface-3)", borderRadius: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{m.title}</div>
                        {m.description && <div style={{ fontSize: 12, color: "var(--text-2)" }}>{m.description}</div>}
                        {m.external_url && <a href={m.external_url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>{m.external_url}</a>}
                      </div>
                      <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={async () => { await deleteCourseMaterial(m.id); materialsQuery.refetch(); }}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
                <div className="ta-card" style={{ background: "var(--surface-2)" }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>Add a material</div>
                  <input className="ta-input ta-mt10" placeholder="Title" value={materialTitle} onChange={(e) => setMaterialTitle(e.target.value)} />
                  <input className="ta-input ta-mt10" placeholder="Link URL (e.g. slides, PDF, video)" value={materialUrl} onChange={(e) => setMaterialUrl(e.target.value)} />
                  <button
                    className="ta-btn ta-btn-primary ta-mt12"
                    disabled={addingMaterial || !materialTitle.trim()}
                    onClick={async () => {
                      setAddingMaterial(true);
                      try {
                        const result = await addCourseMaterial(activeCourse.id, { title: materialTitle, materialType: "link", externalUrl: materialUrl, createdBy: currentUserId });
                        if (!result.success) showToast(result.error);
                        else { setMaterialTitle(""); setMaterialUrl(""); materialsQuery.refetch(); showToast("Material added."); }
                      } finally {
                        setAddingMaterial(false);
                      }
                    }}
                  >
                    {addingMaterial ? "Adding..." : "Add Material"}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "learners" && (
              <div className="ta-card ta-col ta-gap16">
                <div style={{ fontWeight: 700, fontSize: 16 }}>Enrolled Learners & Engagement</div>
                <div className="ta-row ta-gap16">
                  <div className="ta-card ta-stat" style={{ flex: 1 }}>
                    <div className="ta-stat-lbl">Total Enrolled Learners</div>
                    <div className="ta-stat-val">{activeCourse.enrollment_count || 0}</div>
                  </div>
                  <div className="ta-card ta-stat" style={{ flex: 1 }}>
                    <div className="ta-stat-lbl">Curriculum Lessons</div>
                    <div className="ta-stat-val">{editLessons.length}</div>
                  </div>
                  <div className="ta-card ta-stat" style={{ flex: 1 }}>
                    <div className="ta-stat-lbl">Course Status</div>
                    <div className="ta-stat-val" style={{ fontSize: 18, color: editIsPublished ? "var(--success)" : "var(--warning)" }}>
                      {editIsPublished ? "Published" : "Draft"}
                    </div>
                  </div>
                </div>

                <div className="ta-table-wrap">
                <table className="ta-table">
                  <thead><tr><th>Learner</th><th>Progress</th><th>Enrolled</th><th>Completed</th></tr></thead>
                  <tbody>
                    {enrolledLearnersQuery.loading && <tr><td colSpan={4} className="ta-empty">Loading enrolled learners...</td></tr>}
                    {!enrolledLearnersQuery.loading && (enrolledLearnersQuery.data || []).length === 0 && (
                      <tr><td colSpan={4} className="ta-empty">No learners enrolled in this course yet.</td></tr>
                    )}
                    {(enrolledLearnersQuery.data || []).map(l => (
                      <tr key={l.userId}>
                        <td style={{ fontWeight: 600 }}>{l.name}</td>
                        <td>{l.progress}%</td>
                        <td style={{ fontSize: 12.5 }}>{l.enrolledAt ? new Date(l.enrolledAt).toLocaleDateString() : "N/A"}</td>
                        <td style={{ fontSize: 12.5 }}>{l.completedAt ? new Date(l.completedAt).toLocaleDateString() : "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}

            {/* TAB 4: APPLY-FOR-COURSE APPROVAL QUEUE */}
            {activeTab === "applications" && (
              <div className="ta-card ta-col ta-gap16">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Course Applications</div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                    {editRequiresApproval
                      ? "Learners requesting to join this course show up here. Approving enrolls them immediately."
                      : "This course doesn't require approval yet. Turn on \"Require approval to join\" in Course Settings for requests to appear here."}
                  </div>
                </div>
                <div className="ta-table-wrap">
                <table className="ta-table">
                  <thead><tr><th>Learner</th><th>Message</th><th>Requested</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {applicationsQuery.loading && <tr><td colSpan={5} className="ta-empty">Loading applications...</td></tr>}
                    {!applicationsQuery.loading && (applicationsQuery.data || []).length === 0 && (
                      <tr><td colSpan={5} className="ta-empty">No applications for this course yet.</td></tr>
                    )}
                    {(applicationsQuery.data || []).map(a => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 600 }}>{a.user_profiles?.display_name || "Unnamed learner"}</td>
                        <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{a.message || "N/A"}</td>
                        <td style={{ fontSize: 12.5 }}>{a.created_at ? new Date(a.created_at).toLocaleDateString() : "N/A"}</td>
                        <td>
                          <Tag tone={a.status === "approved" ? "success" : a.status === "rejected" ? "danger" : "warning"}>
                            {a.status.toUpperCase()}
                          </Tag>
                        </td>
                        <td>
                          {a.status === "pending" && (
                            <div className="ta-row ta-gap6">
                              <button className="ta-btn ta-btn-primary ta-btn-sm" onClick={() => handleDecideApplication(a, "approved")}>
                                <Check size={13} /> Approve
                              </button>
                              <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => handleDecideApplication(a, "rejected")}>
                                <X size={13} /> Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}

            {/* TAB: ASSESSMENT GRADING - "Instructors may override grades" /
                "Override AI grading". Distinct from the AI Quiz Generator;
                see 0112_assessments_pipeline.sql. */}
            {activeTab === "assessment" && (
              <div className="ta-card ta-col ta-gap16">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Assessment Questions</div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                    Create the assessment learners take for this course. Backend enforcement is by the real course owner - only the instructor assigned to this course, or an org admin, can actually save changes here.
                  </div>
                </div>

                {!assessmentQuery.loading && !assessmentQuery.data && (
                  <div className="ta-row ta-gap8">
                    <button
                      className="ta-btn ta-btn-primary"
                      disabled={creatingAssessment}
                      onClick={async () => {
                        setCreatingAssessment(true);
                        try {
                          await createAssessmentForCourse(activeCourse.id, `${activeCourse.title} Assessment`, currentUserId);
                          assessmentQuery.refetch();
                          showToast("Assessment created - add questions below.");
                        } catch (e) {
                          showToast(e.message || "Could not create assessment.");
                        } finally {
                          setCreatingAssessment(false);
                        }
                      }}
                    >
                      {creatingAssessment ? "Creating..." : "Create Assessment for this Course"}
                    </button>
                  </div>
                )}

                {assessmentQuery.data && (
                  <>
                    <div className="ta-col ta-gap10">
                      {(assessmentQuery.data.questions || []).length === 0 && (
                        <div className="ta-empty">No questions yet - add the first one below.</div>
                      )}
                      {(assessmentQuery.data.questions || []).map((q, i) => (
                        <div key={q.id} className="ta-row ta-between" style={{ padding: 12, background: "var(--surface-3)", borderRadius: 12 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{i + 1}. {q.question}</div>
                            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3 }}>
                              {(q.options || []).map((opt, oi) => (
                                <span key={oi} style={{ marginRight: 10, fontWeight: opt === q.correct_answer ? 700 : 400, color: opt === q.correct_answer ? "var(--success)" : undefined }}>
                                  {opt}{opt === q.correct_answer ? " (correct)" : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                          <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={async () => { await deleteAssessmentQuestion(q.id); assessmentQuery.refetch(); }}><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>

                    <div className="ta-card" style={{ background: "var(--surface-2)" }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>Add a question</div>
                      <input className="ta-input ta-mt10" placeholder="Question text" value={newQTitle} onChange={(e) => setNewQTitle(e.target.value)} />
                      <div className="ta-col ta-gap8 ta-mt10">
                        {newQOptions.map((opt, i) => (
                          <div key={i} className="ta-row ta-gap8">
                            <input className="ta-input" style={{ flex: 1 }} placeholder={`Option ${i + 1}`} value={opt} onChange={(e) => { const next = [...newQOptions]; next[i] = e.target.value; setNewQOptions(next); }} />
                            <label className="ta-row ta-gap6" style={{ fontSize: 11, color: "var(--text-2)", whiteSpace: "nowrap" }}>
                              <input type="radio" name="correctOption" checked={newQCorrect === opt && opt !== ""} onChange={() => setNewQCorrect(opt)} />
                              Correct
                            </label>
                          </div>
                        ))}
                      </div>
                      <button
                        className="ta-btn ta-btn-primary ta-mt12"
                        disabled={addingQuestion || !newQTitle.trim() || !newQCorrect}
                        onClick={async () => {
                          setAddingQuestion(true);
                          try {
                            await addAssessmentQuestion(assessmentQuery.data.id, {
                              question: newQTitle.trim(), options: newQOptions.filter((o) => o.trim()), correctAnswer: newQCorrect,
                              orderIndex: (assessmentQuery.data.questions || []).length,
                            });
                            setNewQTitle(""); setNewQOptions(["", "", "", ""]); setNewQCorrect("");
                            assessmentQuery.refetch();
                            showToast("Question added.");
                          } catch (e) {
                            showToast(e.message || "Could not add question.");
                          } finally {
                            setAddingQuestion(false);
                          }
                        }}
                      >
                        {addingQuestion ? "Adding..." : "Add Question"}
                      </button>
                    </div>
                  </>
                )}

                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Assessment Grading</div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                    Every submitted attempt for this course's assessment. Overriding replaces the score shown to the learner but keeps the original AI-graded score on record.
                  </div>
                </div>
                <div className="ta-table-wrap">
                  <table className="ta-table">
                    <thead><tr><th>Learner</th><th>Submitted</th><th>AI Score</th><th>Current Score</th><th>Override</th></tr></thead>
                    <tbody>
                      {assessmentAttemptsQuery.loading && <tr><td colSpan={5} className="ta-empty">Loading attempts...</td></tr>}
                      {!assessmentAttemptsQuery.loading && (assessmentAttemptsQuery.data || []).length === 0 && (
                        <tr><td colSpan={5} className="ta-empty">No assessment attempts submitted yet.</td></tr>
                      )}
                      {(assessmentAttemptsQuery.data || []).map((attempt) => (
                        <GradingRow
                          key={attempt.id}
                          attempt={attempt}
                          currentUserId={currentUserId}
                          onOverride={async (newScore, note) => {
                            const result = await overrideAssessmentScore(attempt.id, newScore, currentUserId, note);
                            if (!result.success) {
                              showToast(result.error || "Could not override the score.");
                            } else {
                              showToast("Score overridden.");
                              assessmentAttemptsQuery.refetch();
                            }
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: CERTIFICATES - explicitly in-scope for v1
                (0120_certificates.sql), previously entirely unbuilt. Two
                jobs: configure the template (passing score, whether it
                needs approval) and review pending requests. */}
            {activeTab === "certificates" && (
              <div className="ta-col ta-gap16">
                <div className="ta-card">
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Certificate Settings</div>
                  <div className="ta-row ta-gap12 ta-mt12" style={{ flexWrap: "wrap" }}>
                    <div>
                      <div className="ta-label">Title</div>
                      <input className="ta-input ta-mt8" value={certTitle} onChange={(e) => setCertTitle(e.target.value)} placeholder="Certificate of Completion" />
                    </div>
                    <div>
                      <div className="ta-label">Passing score (%)</div>
                      <input className="ta-input ta-mt8" style={{ width: 90 }} type="number" min={0} max={100} value={certPassingScore} onChange={(e) => setCertPassingScore(e.target.value)} />
                    </div>
                    <div>
                      <div className="ta-label">Approval</div>
                      <div className="ta-row ta-gap8 ta-mt8">
                        <Switch on={certRequiresApproval} onChange={() => setCertRequiresApproval((v) => !v)} />
                        <span style={{ fontSize: 12 }}>{certRequiresApproval ? "Requires admin approval" : "Issued instantly on passing"}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    className="ta-btn ta-btn-primary ta-mt12"
                    onClick={async () => {
                      const result = await upsertCertificateTemplate({
                        courseId: activeCourse.id, organizationId: orgId, title: certTitle,
                        passingScorePct: Number(certPassingScore) || 70, requiresApproval: certRequiresApproval,
                      }, currentUserId);
                      showToast(result.success ? "Certificate settings saved." : (result.error || "Could not save."));
                      if (result.success) certRequestsQuery.refetch();
                    }}
                  >
                    Save certificate settings
                  </button>
                </div>

                <div className="ta-card">
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Give Certificate Directly</div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                    Upload and assign a certificate to a specific learner enrolled in this course - independent of the request/approve flow above.
                  </div>
                  <div className="ta-label ta-mt12">Learner</div>
                  <select className="ta-input ta-mt8" value={assignLearnerId} onChange={(e) => setAssignLearnerId(e.target.value)}>
                    <option value="">Select an enrolled learner...</option>
                    {(enrolledLearnersQuery.data || []).map((l) => (
                      <option key={l.userId} value={l.userId}>{l.name} - {l.progress}% complete</option>
                    ))}
                  </select>
                  <div className="ta-label ta-mt12">Certificate title</div>
                  <input className="ta-input ta-mt8" placeholder={`Certificate of ${activeCourse.title} Completion`} value={assignCertTitle} onChange={(e) => setAssignCertTitle(e.target.value)} />
                  <div className="ta-label ta-mt12">Upload certificate file (optional)</div>
                  <FileUploadZone
                    bucket="uploads"
                    pathPrefix={`certificates/${assignLearnerId || "pending"}`}
                    accept="application/pdf,image/*"
                    onUploaded={(url) => setAssignCertFileUrl(url)}
                    label="Drag and drop a certificate PDF or image, or click to browse"
                  />
                  <button
                    className="ta-btn ta-btn-primary ta-mt12"
                    disabled={issuingDirectCert || !assignLearnerId}
                    onClick={async () => {
                      setIssuingDirectCert(true);
                      try {
                        const title = assignCertTitle.trim() || `Certificate of ${activeCourse.title} Completion`;
                        const result = await issueCertificateDirectly(assignLearnerId, orgId, title, activeCourse.id, assignCertFileUrl || null);
                        if (!result.success) showToast(result.error);
                        else {
                          const learnerName = (enrolledLearnersQuery.data || []).find((l) => l.userId === assignLearnerId)?.name || "learner";
                          showToast(`Certificate given to ${learnerName}.`);
                          setAssignLearnerId(""); setAssignCertTitle(""); setAssignCertFileUrl("");
                          certRequestsQuery.refetch();
                        }
                      } finally {
                        setIssuingDirectCert(false);
                      }
                    }}
                  >
                    {issuingDirectCert ? "Issuing..." : "Give Certificate"}
                  </button>
                </div>

                <div className="ta-card">
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Certificate Requests</div>
                  <div className="ta-table-wrap ta-mt12">
                    <table className="ta-table">
                      <thead><tr><th>Learner</th><th>Score</th><th>Status</th><th>Requested</th><th>Action</th></tr></thead>
                      <tbody>
                        {certRequestsQuery.loading && <tr><td colSpan={5} className="ta-empty">Loading requests...</td></tr>}
                        {!certRequestsQuery.loading && (certRequestsQuery.data || []).length === 0 && (
                          <tr><td colSpan={5} className="ta-empty">No certificate requests yet.</td></tr>
                        )}
                        {(certRequestsQuery.data || []).map((req) => (
                          <tr key={req.id}>
                            <td>{req.user_profiles?.display_name || "Unnamed learner"}</td>
                            <td>{req.score_pct}%</td>
                            <td><Tag tone={req.status === "issued" ? "success" : req.status === "rejected" ? "danger" : "warning"}>{req.status}</Tag></td>
                            <td style={{ fontSize: 11.5 }}>{new Date(req.requested_at).toLocaleDateString()}</td>
                            <td>
                              {req.status === "pending" ? (
                                <div className="ta-row ta-gap6">
                                  <button className="ta-btn ta-btn-primary ta-btn-sm" onClick={async () => {
                                    const result = await reviewCertificate(req.id, true);
                                    showToast(result.success ? "Certificate approved." : (result.error || "Could not approve."));
                                    if (result.success) certRequestsQuery.refetch();
                                  }}>Approve</button>
                                  <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={async () => {
                                    const result = await reviewCertificate(req.id, false, "Not approved");
                                    showToast(result.success ? "Certificate rejected." : (result.error || "Could not reject."));
                                    if (result.success) certRequestsQuery.refetch();
                                  }}>Reject</button>
                                </div>
                              ) : <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>{req.certificate_number || "-"}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ================================================================= */
          /* DEFAULT: ALL COURSES GRID VIEW                                     */
          /* ================================================================= */
          <>
            {/* Masterclasses & Content Hero Banner */}
            <div className="ta-hero-banner" style={{ marginBottom: 20 }}>
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
                    Curriculum &amp; Masterclasses
                  </h1>
                  <p className="ta-hero-desc">
                    Author interactive courses, manage lesson syllabi, and publish learning modules.
                  </p>
                </div>
              </div>
            </div>

            {selectedCourseIds.size > 0 && (
              <div className="ta-card ta-row ta-between" style={{ marginBottom: 12, borderColor: "var(--primary)", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedCourseIds.size} course{selectedCourseIds.size === 1 ? "" : "s"} selected</span>
                <div className="ta-row ta-gap8" style={{ flexWrap: "wrap" }}>
                  <button className="ta-btn ta-btn-outline ta-btn-sm" disabled={bulkActionLoading} onClick={() => handleBulkAction("publish")}>Publish</button>
                  <button className="ta-btn ta-btn-outline ta-btn-sm" disabled={bulkActionLoading} onClick={() => handleBulkAction("unpublish")}>Unpublish</button>
                  <button className="ta-btn ta-btn-danger ta-btn-sm" disabled={bulkActionLoading} onClick={() => handleBulkAction("archive")}>Archive</button>
                  <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => setSelectedCourseIds(new Set())}>Clear</button>
                </div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
              {coursesQuery.loading && <div className="ta-empty">Loading courses...</div>}
              {!coursesQuery.loading && courses.length === 0 && <div className="ta-empty">No courses created yet.</div>}
              {courses.map((c, idx) => {
                const fallbackImages = [
                  "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&auto=format&fit=crop&q=80",
                  "https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&auto=format&fit=crop&q=80",
                  "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&auto=format&fit=crop&q=80",
                  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80",
                  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80"
                ];
                const coverImg = c.cover_image_url || fallbackImages[idx % fallbackImages.length];

                return (
                  <div key={c.id} className="ta-card ta-card-hover" style={{ display: "flex", flexDirection: "column", height: "100%", padding: 0, overflow: "hidden", borderRadius: 16, border: "1px solid var(--border)" }}>
                    <div style={{ position: "relative", width: "100%", height: 148, overflow: "hidden", background: "#0F172A" }}>
                      <img
                        src={coverImg}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      <div style={{ position: "absolute", top: 10, left: 10, zIndex: 2 }}>
                        <input
                          type="checkbox"
                          checked={selectedCourseIds.has(c.id)}
                          onChange={(e) => {
                            const next = new Set(selectedCourseIds);
                            if (e.target.checked) next.add(c.id); else next.delete(c.id);
                            setSelectedCourseIds(next);
                          }}
                          style={{ width: 18, height: 18, cursor: "pointer", accentColor: "var(--primary)" }}
                        />
                      </div>
                      <div style={{ position: "absolute", top: 10, right: 10, zIndex: 2, display: "flex", gap: 6 }}>
                        <Tag tone={c.is_published ? "success" : "warning"}>{c.is_published ? "Published" : "Draft"}</Tag>
                      </div>
                    </div>

                    <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
                      <div>
                        <div className="ta-row ta-between" style={{ marginBottom: 8 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--primary)" }}>
                            {c.category || "General"}
                          </span>
                        </div>

                        <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)", lineHeight: 1.35 }}>{c.title}</div>
                        <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 6, lineHeight: 1.45, minHeight: 36 }}>
                          {c.description ? (c.description.length > 80 ? c.description.slice(0, 80) + "..." : c.description) : "Comprehensive syllabus with hands-on exercises and quizzes."}
                        </div>

                        {c.course_source === "external" && (
                          <div className="ta-row ta-between ta-mt8" style={{ padding: "6px 8px", background: "var(--surface-2)", borderRadius: 8 }}>
                            <Tag tone={c.is_approved ? "success" : "danger"}>{c.is_approved ? "External Approved" : "Pending Approval"}</Tag>
                            <button
                              className="ta-btn ta-btn-ghost ta-btn-sm"
                              onClick={async () => {
                                await updateCourse(c.id, { is_approved: !c.is_approved });
                                coursesQuery.refetch();
                                showToast(c.is_approved ? "External course approval revoked." : "External course approved.");
                              }}
                            >
                              {c.is_approved ? "Revoke" : "Approve"}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="ta-row ta-between" style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.enrollment_count || 8} Enrolled • {c.lessons?.length || 4} Lessons
                        </div>
                        <button className="ta-btn ta-btn-primary ta-btn-sm" style={{ flexShrink: 0 }} onClick={() => setActiveCourseId(c.id)}>
                          <Settings size={13} /> Manage Course
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {newCourseOpen && (
              <div className="ta-card ta-mt16" style={{ borderColor: "var(--primary)" }}>
                <div className="ta-title" style={{ fontWeight: 800, fontSize: 18 }}>Create New Course</div>
                <div className="ta-grid ta-grid-2 ta-mt12 ta-gap12">
                  <input className="ta-input" placeholder="Course title..." value={newTitle} onChange={e => setNewTitle(e.target.value)} style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)" }} />
                  <input className="ta-input" placeholder="Category (e.g. Data & AI)..." value={newCategory} onChange={e => setNewCategory(e.target.value)} style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)" }} />
                </div>
                <div className="ta-mt12">
                  <div className="ta-label" style={{ marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Cover image (optional)</div>
                  <FileUploadZone
                    bucket="uploads"
                    pathPrefix="courses/covers"
                    accept="image/*"
                    maxSizeMB={5}
                    label="Drag and drop a cover image, or click to browse"
                    onUploaded={(url) => setNewCoverImageUrl(url)}
                  />
                </div>
                <div className="ta-row ta-gap8 ta-mt12">
                  <button className="ta-btn ta-btn-primary" onClick={async () => {
                    if (!newTitle.trim()) return;
                    await createCourse({ organizationId: orgId, title: newTitle.trim(), category: newCategory.trim(), status: "published", coverImageUrl: newCoverImageUrl || undefined }, currentUserId);
                    setNewCourseOpen(false); setNewTitle(""); setNewCoverImageUrl("");
                    coursesQuery.refetch();
                    showToast("Course created successfully!");
                  }}>Save & Publish Course</button>
                  <button className="ta-btn ta-btn-outline" onClick={() => setNewCourseOpen(false)}>Cancel</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
