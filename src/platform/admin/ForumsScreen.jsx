import React, { useState, useContext } from "react";
import { TopBar, Tag, ToastContext } from "../components/PlatformUI.jsx";
import { ArrowLeft, Plus, Trash2, Pencil, MessageSquare } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchAllForumCategories, createForumCategory, updateForumCategory, deleteForumCategory,
  fetchForumThreadsForModeration, deleteForumPost, fetchCourses,
} from "../../lib/api/platform.js";

// Admin forum management - categories (real `forums` table) with
// create/edit/delete, and a drill-down into a category's threads (real
// `forum_posts`, top-level rows where parent_post_id is null) with a delete
// action per thread for moderation. See lib/api/platform.js for the exact
// confirmed columns and the RLS this is built against
// (forums_write_authorized / fp_delete_own_or_moderator in
// 0009_forum_rls_gapfill.sql). Drill-down is handled as internal state here
// (not a second top-level screen) since it's just a filtered view of the
// same data, mirroring how ModerationScreen is a single flat screen.
export function ForumsScreen({ orgSelector, setScreen }) {
  const showToast = useContext(ToastContext);
  const categoriesQuery = useSupabaseQuery(async () => fetchAllForumCategories(), []);
  const coursesQuery = useSupabaseQuery(async () => fetchCourses(), []);
  const categories = categoriesQuery.data || [];
  const courses = coursesQuery.data || [];

  const [selectedForumId, setSelectedForumId] = useState(null);
  const selectedForum = categories.find((c) => c.id === selectedForumId) || null;

  const threadsQuery = useSupabaseQuery(async () => (selectedForumId ? fetchForumThreadsForModeration(selectedForumId) : []), [selectedForumId]);
  const threads = threadsQuery.data || [];

  // --- Create / edit category ---
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState("");

  function openCreate() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setCourseId("");
    setFormOpen(true);
  }
  function openEdit(cat) {
    setEditingId(cat.id);
    setTitle(cat.title || "");
    setDescription(cat.description || "");
    setCourseId(cat.course_id || "");
    setFormOpen(true);
  }
  async function handleSaveCategory() {
    if (!title.trim()) return;
    if (editingId) {
      await updateForumCategory(editingId, { title: title.trim(), description: description.trim() || null });
      showToast("Category updated");
    } else {
      await createForumCategory({ title: title.trim(), description: description.trim() || null, courseId: courseId || null });
      showToast("Category created");
    }
    setFormOpen(false);
    categoriesQuery.refetch();
  }
  async function handleDeleteCategory(id, catTitle) {
    await deleteForumCategory(id);
    if (selectedForumId === id) setSelectedForumId(null);
    categoriesQuery.refetch();
    showToast(`"${catTitle}" and its threads removed`);
  }

  async function handleDeleteThread(id) {
    await deleteForumPost(id);
    threadsQuery.refetch();
    categoriesQuery.refetch();
    showToast("Thread removed");
  }

  return (
    <div className="ta-fade">
      {selectedForum && (
        <div style={{ padding: "16px clamp(16px, 4vw, 32px) 0" }}>
          <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => setSelectedForumId(null)}>
            <ArrowLeft size={14} /> Back to categories
          </button>
        </div>
      )}
      <TopBar
        title={selectedForum ? selectedForum.title : "Forums"}
        sub={selectedForum ? "Moderate threads in this category" : "Manage discussion categories and moderate threads"}
        orgSelector={orgSelector}
        onNavigate={setScreen}
        right={!selectedForum && <button className="ta-btn ta-btn-primary" onClick={openCreate}><Plus size={15} /> New category</button>}
      />
      <div className="ta-content">
        {!selectedForum && (
          <>
            {formOpen && (
              <div className="ta-card" style={{ borderColor: "var(--primary)" }}>
                <div className="ta-title">{editingId ? "Edit category" : "New category"}</div>
                <div className="ta-grid ta-grid-2 ta-mt12">
                  <div>
                    <div className="ta-label">Title</div>
                    <input className="ta-input ta-mt8" style={{ width: "100%" }} value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div>
                    <div className="ta-label">Course (optional. Leave blank for a general category)</div>
                    <select className="ta-input ta-mt8" style={{ width: "100%" }} value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={!!editingId}>
                      <option value="">General (no course)</option>
                      {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div className="ta-label">Description</div>
                    <input className="ta-input ta-mt8" style={{ width: "100%" }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
                  </div>
                </div>
                <div className="ta-row ta-gap8 ta-mt12">
                  <button className="ta-btn ta-btn-primary" onClick={handleSaveCategory} disabled={!title.trim()}>Save category</button>
                  <button className="ta-btn ta-btn-outline" onClick={() => setFormOpen(false)}>Cancel</button>
                </div>
              </div>
            )}

            <div className="ta-grid ta-grid-3 ta-mt16 anim-stagger">
              {categoriesQuery.loading && <div className="ta-empty">Loading forum categories...</div>}
              {!categoriesQuery.loading && categories.length === 0 && <div className="ta-empty">No forum categories yet. Create one to get started.</div>}
              {categories.map((cat) => (
                <div key={cat.id} className="ta-card ta-card-hover" style={{ cursor: "pointer" }} onClick={() => setSelectedForumId(cat.id)}>
                  <div className="ta-row ta-between">
                    <Tag tone={cat.is_general ? undefined : "success"}>{cat.is_general ? "General" : (cat.courses?.title || "Course")}</Tag>
                    <span style={{ fontSize: 12, color: "var(--text-2)" }}>{cat.thread_count} thread{cat.thread_count === 1 ? "" : "s"}</span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 16, marginTop: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.title}</div>
                  {cat.description && <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{cat.description}</div>}
                  <div className="ta-row ta-gap8 ta-mt12">
                    <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedForumId(cat.id); }}><MessageSquare size={13} /> View threads</button>
                    <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={(e) => { e.stopPropagation(); openEdit(cat); }}><Pencil size={13} /></button>
                    <button className="ta-btn ta-btn-danger ta-btn-sm" onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id, cat.title); }}><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {selectedForum && (
          <div className="ta-card">
            <div className="ta-title">Threads</div>
            <div className="ta-table-wrap">
            <table className="ta-table ta-mt16">
              <thead><tr><th>Author</th><th>Content</th><th>Replies</th><th>Posted</th><th></th></tr></thead>
              <tbody>
                {threadsQuery.loading && <tr><td colSpan={5} className="ta-empty">Loading threads...</td></tr>}
                {!threadsQuery.loading && threads.length === 0 && <tr><td colSpan={5} className="ta-empty">No threads in this category yet.</td></tr>}
                {threads.map((t) => (
                  <tr key={t.id}>
                    <td>{t.user_profiles?.display_name || "Unknown"}</td>
                    <td style={{ maxWidth: 340 }}><div style={{ fontSize: 13 }}>{t.content ? t.content.slice(0, 140) : ""}</div></td>
                    <td>{t.reply_count}</td>
                    <td>{t.created_at ? new Date(t.created_at).toLocaleDateString() : "N/A"}</td>
                    <td><button className="ta-btn ta-btn-danger ta-btn-sm" onClick={() => handleDeleteThread(t.id)}><Trash2 size={13} /> Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
