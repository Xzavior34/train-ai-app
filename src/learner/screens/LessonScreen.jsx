import React, { useState } from "react";
import { TopBar } from "../components/LearnerUI.jsx";
import { Play, CheckCircle2, ChevronRight, PlusCircle } from "lucide-react";

export function LessonScreen({
  course, lessons, lessonId, session, lessonNotesQuery, noteInputText, setNoteInputText,
  back, push, showToast, markLessonComplete, enrollmentsQuery, lessonProgressQuery,
  completedLessonIds, setCompletedLessonIds, addLessonNote
}) {
  const [playing, setPlaying] = useState(false);
  const [progressSec, setProgressSec] = useState(120);
  const currentLessonIndex = lessons.findIndex(l => l.id === lessonId);
  const lesson = lessons[currentLessonIndex] || lessons[0];
  const nextLesson = lessons[currentLessonIndex + 1];

  async function handleMarkDone() {
    if (!session?.user?.id || !lesson) return;
    await markLessonComplete(session.user.id, lesson.id, course?.id);
    setCompletedLessonIds(prev => new Set([...prev, `${course?.id}-${lesson.id}`]));
    enrollmentsQuery.refetch();
    lessonProgressQuery.refetch();
    showToast("Lesson completed! +50 XP");
  }

  return (
    <div className="tai-fade-in">
      <TopBar title={lesson?.title || "Lesson"} sub={course?.title} onBack={back} />
      <div className="tai-card" style={{ padding: 0, overflow: "hidden", background: "#000", position: "relative", height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#fff", textAlign: "center" }}>
          <button className="tai-iconbtn" style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--primary)", color: "#fff", border: "none", margin: "0 auto" }} onClick={() => setPlaying(v => !v)}>
            <Play size={28} />
          </button>
          <div style={{ fontSize: 13, marginTop: 10 }}>{playing ? "Playing video..." : "Tap to play video lesson"}</div>
        </div>
      </div>

      <div className="tai-card tai-mt12">
        <div className="tai-row tai-between">
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{lesson?.title}</div>
            <div className="tai-body-text tai-mt6">{lesson?.duration} minutes</div>
          </div>
          <button className="tai-btn tai-btn-ghost tai-btn-sm" onClick={handleMarkDone}>
            <CheckCircle2 size={15} /> Mark complete
          </button>
        </div>
      </div>

      <div className="tai-card tai-mt12">
        <div className="tai-title-sm">Lesson notes</div>
        <div className="tai-row tai-gap8 tai-mt10">
          <input className="tai-input" placeholder="Note at 2:00..." value={noteInputText} onChange={e => setNoteInputText(e.target.value)} />
          <button className="tai-btn tai-btn-primary tai-btn-sm" disabled={!noteInputText.trim()} onClick={async () => {
            if (!noteInputText.trim() || !session?.user?.id || !lesson) return;
            await addLessonNote({ userId: session.user.id, lessonId: lesson.id, timestampSeconds: progressSec, content: noteInputText.trim() });
            setNoteInputText("");
            lessonNotesQuery.refetch();
            showToast("Note added");
          }}>
            <PlusCircle size={14} /> Add
          </button>
        </div>
        {lessonNotesQuery.loading && <div className="tai-empty">Loading notes...</div>}
        {(lessonNotesQuery.data || []).map(n => (
          <div key={n.id} className="tai-card tai-mt10" style={{ background: "var(--surface-3)" }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--primary)" }}>{Math.floor(n.timestamp_seconds / 60)}:{(n.timestamp_seconds % 60).toString().padStart(2, "0")}</div>
            <div className="tai-body-text tai-mt4">{n.content}</div>
          </div>
        ))}
      </div>

      {nextLesson && (
        <button className="tai-btn tai-btn-primary tai-mt16" style={{ width: "100%" }} onClick={() => push("lesson", { id: course.id, lessonId: nextLesson.id })}>
          Next lesson: {nextLesson.title} <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}
