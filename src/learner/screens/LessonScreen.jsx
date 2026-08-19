import React, { useState } from "react";
import { TopBar } from "../components/LearnerUI.jsx";
import { Play, CheckCircle2, ChevronRight, PlusCircle, ThumbsUp, ThumbsDown } from "lucide-react";
import { submitLessonFeedback } from "../../lib/api/learner.js";

export function LessonScreen({
  course, lessons, lessonId, session, lessonNotesQuery, noteInputText, setNoteInputText,
  back, push, showToast, markLessonComplete, enrollmentsQuery, lessonProgressQuery,
  completedLessonIds, setCompletedLessonIds, addLessonNote
}) {
  const [playing, setPlaying] = useState(false);
  const [progressSec, setProgressSec] = useState(120);
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  const [feedbackConfidence, setFeedbackConfidence] = useState(null);
  const [feedbackHelpful, setFeedbackHelpful] = useState(null);
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
    setShowFeedbackPrompt(true);
  }

  async function handleSubmitFeedback() {
    if (feedbackConfidence === null || feedbackHelpful === null || !session?.user?.id || !lesson) { setShowFeedbackPrompt(false); return; }
    const result = await submitLessonFeedback(session.user.id, lesson.id, course?.id, { confidence: feedbackConfidence, helpful: feedbackHelpful });
    if (!result.success) showToast(result.error);
    setShowFeedbackPrompt(false);
    setFeedbackConfidence(null);
    setFeedbackHelpful(null);
  }

  return (
    <div className="tai-fade-in">
      <TopBar title={lesson?.title || "Lesson"} sub={course?.title} onBack={back} />

      {showFeedbackPrompt && (
        <div className="tai-card tai-mt10" style={{ padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>Quick check - how confident do you feel?</div>
          <div className="tai-row tai-gap6 tai-mt8" style={{ flexWrap: "wrap" }}>
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                className={`tai-btn tai-btn-sm ${feedbackConfidence === v ? "tai-btn-primary" : "tai-btn-outline"}`}
                onClick={() => setFeedbackConfidence(v)}
              >
                {v}
              </button>
            ))}
          </div>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginTop: 10 }}>Was this lesson helpful?</div>
          <div className="tai-row tai-gap8 tai-mt8">
            <button className={`tai-btn tai-btn-sm ${feedbackHelpful === true ? "tai-btn-primary" : "tai-btn-outline"}`} onClick={() => setFeedbackHelpful(true)}>
              <ThumbsUp size={14} /> Yes
            </button>
            <button className={`tai-btn tai-btn-sm ${feedbackHelpful === false ? "tai-btn-primary" : "tai-btn-outline"}`} onClick={() => setFeedbackHelpful(false)}>
              <ThumbsDown size={14} /> Not really
            </button>
          </div>
          <div className="tai-row tai-gap8 tai-mt12">
            <button className="tai-btn tai-btn-primary" disabled={feedbackConfidence === null || feedbackHelpful === null} onClick={handleSubmitFeedback}>Submit</button>
            <button className="tai-btn tai-btn-ghost" onClick={() => setShowFeedbackPrompt(false)}>Skip</button>
          </div>
        </div>
      )}
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
