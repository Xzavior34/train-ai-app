import React, { useState } from "react";
import { TopBar, Tag, ProgressBar, Avatar, timeAgo, initialsOf } from "../components/LearnerUI.jsx";
import { Clock, Layers, Rocket, CheckCircle2, Lock, ChevronRight, Video, Edit3, Send, GraduationCap } from "lucide-react";

function CourseCoverImage({ course, children }) {
  const [errored, setErrored] = useState(false);
  return (
    <div style={{
      position: "relative", width: "100%", padding: 16, borderRadius: "var(--radius)", overflow: "hidden",
      background: `linear-gradient(135deg, ${course.grad[0]}, ${course.grad[1]})`,
      minHeight: 140, display: "flex", flexDirection: "column", justifyContent: "space-between",
    }}>
      {!errored && (
        <img
          src={`https://picsum.photos/seed/${course.id}/600/240`}
          alt=""
          onError={() => setErrored(true)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.2, display: "block" }}
        />
      )}
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

export function CourseDetailScreen({
  course, lessons, isEnrolled, courseLessonsQuery, courseNotesQuery, courseDiscussionQuery,
  session, completedLessonIds, discussionInput, setDiscussionInput,
  newNoteText, setNewNoteText, params, setParams, push, back, showToast, enrollInCourse,
  enrollmentsQuery, handleEnroll, addCourseNote, postCourseDiscussionMessage,
  assessmentQuery, assessmentQuestionsQuery, myAssessmentAttemptQuery, handleSubmitAssessment,
  myApplication, handleRequestJoin
}) {
  if (!course) return <div className="tai-empty">Course not found.</div>;
  const tab = params._tab || "lessons";
  const setTabLocal = (t) => setParams(p => ({ ...p, _tab: t }));

  return (
    <div className="tai-fade-in">
      <TopBar title={course.title} onBack={back} />
      <div className="tai-card" style={{ padding: 0, border: "none", overflow: "hidden", color: "#fff" }}>
        <CourseCoverImage course={course}>
          <div className="tai-row tai-between">
            <Tag>{course.category}</Tag>
            {course.mandatory && <Tag tone="warning">Mandatory</Tag>}
          </div>
          <div style={{ fontWeight: 800, fontSize: 17, marginTop: 10 }}>{course.tagline}</div>
          <div className="tai-row tai-gap16 tai-mt12" style={{ fontSize: 12.5, opacity: 0.9 }}>
            <span className="tai-row tai-gap6"><Clock size={13} />{course.hours}h</span>
            <span className="tai-row tai-gap6"><Layers size={13} />{course.lessons} lessons</span>
          </div>
        </CourseCoverImage>
      </div>

      {isEnrolled ? (
        <div className="tai-card tai-mt12">
          <div className="tai-row tai-between" style={{ fontSize: 13, color: "var(--text-2)" }}>
            <span>Your progress</span><span>{course.progress}%</span>
          </div>
          <div className="tai-mt8"><ProgressBar value={course.progress} /></div>
        </div>
      ) : course.requiresApproval ? (
        <div className="tai-card tai-mt12">
          {myApplication?.status === "pending" ? (
            <div className="tai-row tai-gap8" style={{ fontSize: 13, color: "var(--text-2)" }}>
              <Clock size={16} /> Your request to join is pending review by the course instructor.
            </div>
          ) : (
            <>
              {myApplication?.status === "rejected" && (
                <div className="tai-row tai-gap8 tai-mt8" style={{ fontSize: 12.5, color: "var(--danger, #e5484d)" }}>
                  Your previous request was not approved. You can request again below.
                </div>
              )}
              <button
                className="tai-btn tai-btn-primary tai-mt8" style={{ width: "100%" }}
                onClick={async () => {
                  if (!session?.user?.id || !handleRequestJoin) return;
                  await handleRequestJoin(course.id);
                }}
              >
                <Send size={16} /> {myApplication?.status === "rejected" ? "Request to Join Again" : "Request to Join This Course"}
              </button>
            </>
          )}
        </div>
      ) : (
        <button
          className="tai-btn tai-btn-primary tai-mt12" style={{ width: "100%" }}
          onClick={async () => {
            if (!session?.user?.id) return;
            if (handleEnroll) {
              await handleEnroll(course.id);
              return;
            }
            // Fallback if handleEnroll wasn't wired in (shouldn't happen).
            await enrollInCourse(session.user.id, course.id);
            enrollmentsQuery.refetch();
            showToast(`Enrolled in ${course.title}`);
          }}
        >
          <Rocket size={16} /> {course.price > 0 ? `Enroll: $${course.price}` : "Enroll in this course"}
        </button>
      )}

      <div className="tai-row tai-gap8 tai-mt16">
        {["lessons", "notes", "discussion", ...(assessmentQuery?.data ? ["assessment"] : [])].map((t) => (
          <div key={t} className={`tai-pill ${tab === t ? "tai-pill-active" : "tai-pill-inactive"}`} onClick={() => setTabLocal(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </div>
        ))}
      </div>

      {tab === "lessons" && (
        <div className="tai-mt16">
          {courseLessonsQuery.loading && <div className="tai-empty">Loading lessons...</div>}
          {!courseLessonsQuery.loading && lessons.length === 0 && <div className="tai-empty">No lessons available for this course yet.</div>}
          {lessons.length > 0 && (
            <>
              <div className="tai-row tai-between">
                <div className="tai-label">Module progress</div>
                <div className="tai-label">{lessons.filter(l => l.completed || completedLessonIds.has(`${course.id}-${l.id}`)).length}/{lessons.length} lessons</div>
              </div>
              <div className="tai-mt8"><ProgressBar value={(lessons.filter(l => l.completed || completedLessonIds.has(`${course.id}-${l.id}`)).length / lessons.length) * 100} /></div>
              <div className="tai-col tai-gap10 tai-mt16 anim-stagger">
                {lessons.map((l, i) => {
                  const isDone = l.completed || completedLessonIds.has(`${course.id}-${l.id}`);
                  const prevDone = i === 0 || lessons[i - 1].completed || completedLessonIds.has(`${course.id}-${lessons[i - 1].id}`);
                  const locked = !isDone && !l.current && i > 0 && !prevDone;
                  return (
                    <div key={l.id} className="tai-card" style={{ cursor: locked ? "default" : "pointer", opacity: locked ? 0.55 : 1 }}
                      onClick={() => !locked && push("lesson", { id: course.id, lessonId: l.id })}>
                      <div className="tai-row tai-between">
                        <div className="tai-row tai-gap12">
                          <Tag>{String(i + 1).padStart(2, "0")}</Tag>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{l.title}</div>
                            <div className="tai-row tai-gap8 tai-mt8" style={{ fontSize: 11.5, color: "var(--text-2)" }}>
                              <span className="tai-row tai-gap6"><Clock size={12} />{l.duration} min</span>
                              <span className="tai-row tai-gap6"><Video size={12} />Video</span>
                            </div>
                          </div>
                        </div>
                        {isDone ? <CheckCircle2 size={19} color="var(--success)" />
                          : locked ? <Lock size={17} color="var(--text-3)" />
                          : <div className="tai-iconbtn" style={{ background: "var(--primary)", color: "#fff", width: 34, height: 34 }}><ChevronRight size={16} /></div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "notes" && (
        <div className="tai-mt16">
          <textarea className="tai-input" rows={3} placeholder="Add a course note..." value={newNoteText} onChange={e => setNewNoteText(e.target.value)} />
          <button
            className="tai-btn tai-btn-primary tai-mt10"
            disabled={!newNoteText.trim()}
            onClick={async () => {
              if (!newNoteText.trim() || !session?.user?.id) return;
              await addCourseNote({ userId: session.user.id, courseId: course.id, content: newNoteText.trim() });
              setNewNoteText("");
              courseNotesQuery.refetch();
              showToast("Note saved");
            }}
          ><Edit3 size={14} /> Save note</button>
          {courseNotesQuery.loading && <div className="tai-empty">Loading notes...</div>}
          {!courseNotesQuery.loading && (courseNotesQuery.data || []).length === 0 && (
            <div className="tai-empty">Your saved notes for this course will appear here.</div>
          )}
          {(courseNotesQuery.data || []).map(n => (
            <div key={n.id} className="tai-card tai-mt10">
              <div className="tai-body-text">{n.content}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>{timeAgo(n.updated_at)}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "discussion" && (
        <div className="tai-mt16 tai-col tai-gap10">
          {courseDiscussionQuery.loading && <div className="tai-empty">Loading discussion...</div>}
          {!courseDiscussionQuery.loading && (courseDiscussionQuery.data?.messages || []).length === 0 && (
            <div className="tai-empty">No questions yet. Be the first to ask.</div>
          )}
          {(courseDiscussionQuery.data?.messages || []).map((m) => (
            <div key={m.id} className="tai-card anim-pop">
              <div className="tai-row tai-gap10">
                <Avatar initials={m.sender_id === session?.user?.id ? "YOU" : initialsOf(m.user_profiles?.display_name)} size={30} />
                <div style={{ fontWeight: 700, fontSize: 13 }}>{m.sender_id === session?.user?.id ? "You" : (m.user_profiles?.display_name || "Learner")}</div>
              </div>
              <div className="tai-body-text tai-mt8">{m.content}</div>
            </div>
          ))}
          <div className="tai-row tai-gap8">
            <input
              className="tai-input" placeholder="Ask a question about this course..." value={discussionInput}
              onChange={e => setDiscussionInput(e.target.value)}
              onKeyDown={async e => {
                if (e.key === "Enter" && discussionInput.trim() && session?.user?.id && courseDiscussionQuery.data?.discussion) {
                  await postCourseDiscussionMessage({ discussionId: courseDiscussionQuery.data.discussion.id, senderId: session.user.id, content: discussionInput.trim() });
                  setDiscussionInput(""); showToast("Question posted");
                  courseDiscussionQuery.refetch();
                }
              }}
            />
            <button
              className="tai-iconbtn" style={{ background: "var(--primary)", color: "#fff" }}
              onClick={async () => {
                if (!discussionInput.trim() || !session?.user?.id || !courseDiscussionQuery.data?.discussion) return;
                await postCourseDiscussionMessage({ discussionId: courseDiscussionQuery.data.discussion.id, senderId: session.user.id, content: discussionInput.trim() });
                setDiscussionInput(""); showToast("Question posted");
                courseDiscussionQuery.refetch();
              }}
            ><Send size={16} /></button>
          </div>
        </div>
      )}

      {tab === "assessment" && (
        <AssessmentTab
          assessment={assessmentQuery?.data}
          questionsQuery={assessmentQuestionsQuery}
          myAttemptQuery={myAssessmentAttemptQuery}
          onSubmit={handleSubmitAssessment}
        />
      )}
    </div>
  );
}

// Distinct from the AI Quiz Generator's practice-quiz UI elsewhere - this is
// the instructor-authored, graded Assessment tied to course completion and
// certificates (see 0112_assessments_pipeline.sql). Server-scored via
// check_assessment_answers(); this component never sees a correct answer,
// only the resulting score.
function AssessmentTab({ assessment, questionsQuery, myAttemptQuery, onSubmit }) {
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const questions = questionsQuery?.data || [];
  const myAttempt = myAttemptQuery?.data;

  if (questionsQuery?.loading || myAttemptQuery?.loading) {
    return <div className="tai-mt16 tai-empty">Loading assessment...</div>;
  }

  if (myAttempt) {
    return (
      <div className="tai-mt16 tai-card">
        <div className="tai-row tai-gap8">
          <CheckCircle2 size={18} color="var(--success)" />
          <div style={{ fontWeight: 700 }}>Assessment submitted</div>
        </div>
        <div className="tai-mt10" style={{ fontSize: 22, fontWeight: 800 }}>{myAttempt.score}%</div>
        {myAttempt.overridden_by ? (
          <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>
            Reviewed and adjusted by your instructor{myAttempt.override_note ? `: "${myAttempt.override_note}"` : "."}
          </div>
        ) : (
          <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>Auto-graded.</div>
        )}
      </div>
    );
  }

  if (questions.length === 0) {
    return <div className="tai-mt16 tai-empty">This assessment doesn't have any questions yet.</div>;
  }

  return (
    <div className="tai-mt16 tai-col tai-gap16">
      <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>{assessment?.title || "Assessment"}: {questions.length} question{questions.length === 1 ? "" : "s"}</div>
      {questions.map((q, idx) => (
        <div key={q.id} className="tai-card">
          <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 10 }}>{idx + 1}. {q.question}</div>
          <div className="tai-col tai-gap8">
            {(q.options || []).map((opt) => (
              <label key={opt} className="tai-row tai-gap8" style={{ cursor: "pointer", fontSize: 13 }}>
                <input
                  type="radio" name={q.id} value={opt}
                  checked={answers[q.id] === opt}
                  onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
      ))}
      <button
        className="tai-btn tai-btn-primary"
        disabled={submitting || Object.keys(answers).length < questions.length}
        onClick={async () => {
          setSubmitting(true);
          try { await onSubmit(answers); } finally { setSubmitting(false); }
        }}
      >
        {submitting ? "Submitting..." : "Submit assessment"}
      </button>
    </div>
  );
}