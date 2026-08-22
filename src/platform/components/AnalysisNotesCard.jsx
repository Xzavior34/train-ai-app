import React, { useState, useContext } from "react";
import { ToastContext } from "./PlatformUI.jsx";
import { StickyNote, Trash2 } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchMyAnalysisNotes, addAnalysisNote, deleteAnalysisNote } from "../../lib/api/platform.js";

// General analysis notes - "there should be a place where instructors,
// admin or managers can add notes. This notes will be relevant for their
// analysis... once done, you can share with Emmanuel." One shared
// component used across Admin, Instructor, and Manager dashboards rather
// than three separate implementations of the same thing.
export function AnalysisNotesCard({ authorId, organizationId }) {
  const showToast = useContext(ToastContext);
  const notesQuery = useSupabaseQuery(async () => (authorId ? fetchMyAnalysisNotes(authorId) : []), [authorId]);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!newNote.trim()) return;
    setSaving(true);
    try {
      const result = await addAnalysisNote(authorId, organizationId, newNote);
      if (!result.success) showToast(result.error);
      else { setNewNote(""); notesQuery.refetch(); showToast("Note saved."); }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ta-card ta-mt20">
      <div className="ta-row ta-gap8"><StickyNote size={16} color="var(--primary)" /><div className="ta-title">My Notes</div></div>
      <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
        Your own running notes for analysis - visible to you and your org admin, not posted anywhere public.
      </div>
      <textarea
        className="ta-input ta-mt12" rows={3} placeholder="Add a note..."
        value={newNote} onChange={(e) => setNewNote(e.target.value)}
      />
      <button className="ta-btn ta-btn-primary ta-mt10" disabled={saving || !newNote.trim()} onClick={handleAdd}>
        {saving ? "Saving..." : "Add Note"}
      </button>
      <div className="ta-col ta-gap8 ta-mt16">
        {notesQuery.loading && <div className="ta-empty">Loading notes...</div>}
        {!notesQuery.loading && (notesQuery.data || []).length === 0 && <div className="ta-empty">No notes yet.</div>}
        {(notesQuery.data || []).map((n) => (
          <div key={n.id} className="ta-row ta-between" style={{ padding: 12, background: "var(--surface-3)", borderRadius: 12, alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, overflowWrap: "break-word", wordBreak: "break-word" }}>{n.note_text}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>{new Date(n.created_at).toLocaleString()}</div>
            </div>
            <button
              className="ta-btn ta-btn-ghost ta-btn-sm"
              style={{ flexShrink: 0 }}
              onClick={async () => {
                const result = await deleteAnalysisNote(n.id);
                if (!result.success) showToast(result.error);
                else notesQuery.refetch();
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
