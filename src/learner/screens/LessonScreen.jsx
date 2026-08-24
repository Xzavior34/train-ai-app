import React, { useState } from "react";
import { TopBar, ProgressBar, Tag } from "../components/LearnerUI.jsx";
import { Play, CheckCircle2, ChevronRight, PlusCircle, ThumbsUp, ThumbsDown, Clock, Video, BookOpen, Sparkles } from "lucide-react";
import { submitLessonFeedback } from "../../lib/api/learner.js";

const DEFAULT_CHAPTERS = [
  { time: "00:00", title: "Introduction & Context" },
  { time: "04:15", title: "Core Architectural Concepts" },
  { time: "08:30", title: "Live Implementation Walkthrough" },
  { time: "12:45", title: "Edge Cases & Production Patterns" },
  { time: "16:10", title: "Summary & Actionable Takeaways" },
];

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
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);

  const currentLessonIndex = lessons.findIndex(l => l.id === lessonId);
  const lesson = lessons[currentLessonIndex] || lessons[0];
  const nextLesson = lessons[currentLessonIndex + 1];
  const isCompleted = lesson && completedLessonIds.has(`${course?.id}-${lesson.id}`);

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
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <TopBar title={course?.title || "Course"} sub={lesson?.title || "Lesson"} onBack={back} />

      <div className="tai-dashboard-grid">
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>

      {/* Video Player Card with Speaker Thumbnail */}
      <div className="tai-card" style={{
        padding: 0, overflow: "hidden", position: "relative",
        borderRadius: 20, minHeight: 240, background: "#0F172A",
        boxShadow: "0 12px 32px -4px rgba(15, 23, 42, 0.25)"
      }}>
        <img
          src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80"
          alt=""
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", opacity: playing ? 0.3 : 0.65, display: "block"
          }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to top, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.3) 60%, transparent 100%)"
        }} />

        {/* Video Overlay Controls */}
        <div style={{
          position: "relative", zIndex: 2, height: "100%", minHeight: 240,
          display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 20
        }}>
          <div className="tai-row tai-between">
            <Tag>{course?.category || "Technology"}</Tag>
            <span style={{ fontSize: 12, color: "#fff", background: "rgba(0,0,0,0.5)", padding: "3px 10px", borderRadius: 8, fontWeight: 700 }}>
              {lesson?.duration || 18} min
            </span>
          </div>

          <div style={{ textAlign: "center", margin: "auto 0" }}>
            <button
              className="tai-iconbtn"
              style={{
                width: 60, height: 60, borderRadius: "50%",
                background: "var(--grad)", color: "#fff", border: "none",
                margin: "0 auto", boxShadow: "0 4px 20px rgba(79, 70, 229, 0.5)"
              }}
              onClick={() => setPlaying(v => !v)}
            >
              <Play size={26} fill="#fff" style={{ marginLeft: 3 }} />
            </button>
            <div style={{ fontSize: 13, color: "#fff", marginTop: 10, fontWeight: 600 }}>
              {playing ? "Playing video..." : "Tap to watch lesson"}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 800, fontSize: 16.5, color: "#fff", letterSpacing: "-0.01em" }}>
              {lesson?.title}
            </div>
            <div className="tai-row tai-gap10 tai-mt6" style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
              <span>Chapter {activeChapterIndex + 1} of {DEFAULT_CHAPTERS.length}</span>
              <span>•</span>
              <span>HD 1080p</span>
            </div>
          </div>
        </div>
      </div>

      {/* Full-width Mark as Complete Action Button */}
      <button
        className={`tai-btn ${isCompleted ? "tai-btn-outline" : "tai-btn-primary"}`}
        style={{ width: "100%", padding: "14px 20px", fontSize: 15 }}
        onClick={handleMarkDone}
      >
        <CheckCircle2 size={18} color={isCompleted ? "var(--success)" : "#fff"} />
        {isCompleted ? "Completed (Tap to review again)" : "✓ Mark as Complete"}
      </button>

      {/* Feedback Prompt */}
      {showFeedbackPrompt && (
        <div className="tai-card" style={{ padding: 18, background: "var(--grad-subtle)", borderColor: "#E0E7FF" }}>
          <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text)" }}>Quick check - how confident do you feel?</div>
          <div className="tai-row tai-gap8 tai-mt10" style={{ flexWrap: "wrap" }}>
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                className={`tai-btn tai-btn-sm ${feedbackConfidence === v ? "tai-btn-primary" : "tai-btn-outline"}`}
                style={{ minWidth: 40 }}
                onClick={() => setFeedbackConfidence(v)}
              >
                {v}
              </button>
            ))}
          </div>
          <div style={{ fontWeight: 800, fontSize: 14.5, marginTop: 14, color: "var(--text)" }}>Was this lesson helpful?</div>
          <div className="tai-row tai-gap8 tai-mt10">
            <button className={`tai-btn tai-btn-sm ${feedbackHelpful === true ? "tai-btn-primary" : "tai-btn-outline"}`} onClick={() => setFeedbackHelpful(true)}>
              <ThumbsUp size={14} /> Yes
            </button>
            <button className={`tai-btn tai-btn-sm ${feedbackHelpful === false ? "tai-btn-primary" : "tai-btn-outline"}`} onClick={() => setFeedbackHelpful(false)}>
              <ThumbsDown size={14} /> Not really
            </button>
          </div>
          <div className="tai-row tai-gap10 tai-mt14">
            <button className="tai-btn tai-btn-primary tai-btn-sm" disabled={feedbackConfidence === null || feedbackHelpful === null} onClick={handleSubmitFeedback}>
              Submit Feedback
            </button>
            <button className="tai-btn tai-btn-ghost tai-btn-sm" onClick={() => setShowFeedbackPrompt(false)}>
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Lesson Notes */}
      <div className="tai-card" style={{ padding: 20 }}>
        <div className="tai-title-sm">Lesson Notes &amp; Timestamps</div>
        <div className="tai-row tai-gap10 tai-mt12">
          <input
            className="tai-input"
            placeholder="Add note at 2:00..."
            value={noteInputText}
            onChange={e => setNoteInputText(e.target.value)}
          />
          <button
            className="tai-btn tai-btn-primary tai-btn-sm"
            disabled={!noteInputText.trim()}
            onClick={async () => {
              if (!noteInputText.trim() || !session?.user?.id || !lesson) return;
              await addLessonNote({ userId: session.user.id, lessonId: lesson.id, timestampSeconds: progressSec, content: noteInputText.trim() });
              setNoteInputText("");
              lessonNotesQuery.refetch();
              showToast("Note added");
            }}
          >
            <PlusCircle size={15} /> Add
          </button>
        </div>
        {lessonNotesQuery.loading && <div className="tai-empty">Loading notes...</div>}
        {(lessonNotesQuery.data || []).map(n => (
          <div key={n.id} className="tai-card tai-mt10" style={{ background: "var(--surface-3)", padding: 12 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--primary)" }}>
              {Math.floor(n.timestamp_seconds / 60)}:{(n.timestamp_seconds % 60).toString().padStart(2, "0")}
            </div>
            <div className="tai-body-text tai-mt4">{n.content}</div>
          </div>
        ))}
      </div>

      </div>

      {/* Sidebar: Chapters checklist & next lesson */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="tai-card" style={{ padding: 20 }}>
          <div className="tai-row tai-between" style={{ marginBottom: 12 }}>
            <div className="tai-title-sm">Chapters</div>
            <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>{DEFAULT_CHAPTERS.length} sections</span>
          </div>

          <div className="tai-col tai-gap8">
            {DEFAULT_CHAPTERS.map((ch, idx) => (
              <div
                key={ch.time}
                className="tai-row tai-between"
                style={{
                  padding: "10px 14px", borderRadius: 12,
                  background: activeChapterIndex === idx ? "var(--primary-tint)" : "var(--surface-3)",
                  border: `1px solid ${activeChapterIndex === idx ? "var(--primary-light)" : "var(--border)"}`,
                  cursor: "pointer", transition: "all .16s ease"
                }}
                onClick={() => setActiveChapterIndex(idx)}
              >
                <div className="tai-row tai-gap12">
                  <span style={{
                    fontSize: 12, fontWeight: 800,
                    color: activeChapterIndex === idx ? "var(--primary)" : "var(--text-3)",
                    fontVariantNumeric: "tabular-nums"
                  }}>
                    {ch.time}
                  </span>
                  <span style={{
                    fontSize: 13.5, fontWeight: activeChapterIndex === idx ? 700 : 500,
                    color: activeChapterIndex === idx ? "var(--primary-dark)" : "var(--text)"
                  }}>
                    {ch.title}
                  </span>
                </div>
                <Play size={13} color={activeChapterIndex === idx ? "var(--primary)" : "var(--text-3)"} fill={activeChapterIndex === idx ? "var(--primary)" : "none"} />
              </div>
            ))}
          </div>
        </div>

        {nextLesson && (
          <button
            className="tai-btn tai-btn-outline"
            style={{ width: "100%", padding: "13px 20px", color: "var(--primary)", borderColor: "var(--primary-light)" }}
            onClick={() => push("lesson", { id: course.id, lessonId: nextLesson.id })}
          >
            Next Lesson: {nextLesson.title} <ChevronRight size={16} />
          </button>
        )}
      </div>

      </div>
    </div>
  );
}
