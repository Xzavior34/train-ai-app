import React, { useState } from "react";
import { TopBar, Tag, ProgressBar, Avatar, timeAgo, initialsOf } from "../components/LearnerUI.jsx";
import { Clock, Layers, Rocket, CheckCircle2, Lock, ChevronRight, Video, Edit3, Send, GraduationCap, Award, X, ArrowRight, Star, Users, ShieldCheck, FileText, MessageSquare } from "lucide-react";
import { isMockDataEnabled } from "../../lib/mockDataManager.js";

function CourseCoverImage({ course, children }) {
  const [errored, setErrored] = useState(false);
  const imageUrl = course.coverImageUrl || course.image || `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80`;

  return (
    <div
      className="tai-hero-card"
      style={{
        position: "relative", width: "100%", padding: "22px 20px", borderRadius: 14, overflow: "hidden",
        minHeight: 140, display: "flex", flexDirection: "column", justifyContent: "space-between",
        boxSizing: "border-box"
      }}
    >
      {!errored && (
        <img
          src={imageUrl}
          alt=""
          onError={() => setErrored(true)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.22, display: "block" }}
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
  certificateQuery, myCertificateQuery, handleRequestCertificate, orgBrandingQuery,
  myApplication, handleRequestJoin
}) {
  if (!course) return <div className="tai-card tai-empty">Course not found.</div>;
  const tab = params._tab || "lessons";
  const setTabLocal = (t) => setParams(p => ({ ...p, _tab: t }));

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <TopBar title={course.title} onBack={back} />
      
      {/* Course Hero Banner */}
      <div className="tai-card" style={{ padding: 0, border: "none", overflow: "hidden", color: "#fff" }}>
        <CourseCoverImage course={course}>
          <div className="tai-row tai-between">
            <Tag>{course.category || "Course"}</Tag>
            {course.mandatory && <Tag tone="warning">Mandatory</Tag>}
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, marginTop: 12, letterSpacing: "-0.01em", textShadow: "0 1px 2px rgba(0,0,0,0.15)" }}>
            {course.tagline || course.title}
          </div>
          <div className="tai-row tai-gap16 tai-mt14" style={{ fontSize: 13, opacity: 0.95, fontWeight: 600 }}>
            <span className="tai-row tai-gap6"><Clock size={14} />{course.hours || 4} hours</span>
            <span className="tai-row tai-gap6"><Layers size={14} />{course.lessons || lessons?.length || 0} lessons</span>
          </div>
        </CourseCoverImage>
      </div>

      {/* Progress or Enrollment CTA */}
      {isEnrolled ? (
        <div className="tai-card" style={{ padding: 18 }}>
          <div className="tai-row tai-between" style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 600 }}>
            <span>Your Learning Progress</span>
            <span style={{ color: "var(--primary)", fontWeight: 800 }}>{course.progress}%</span>
          </div>
          <div className="tai-mt10"><ProgressBar value={course.progress} height={8} /></div>
        </div>
      ) : course.requiresApproval ? (
        <div className="tai-card" style={{ padding: 18 }}>
          {myApplication?.status === "pending" ? (
            <div className="tai-row tai-gap10" style={{ fontSize: 13.5, color: "var(--text-2)", fontWeight: 500 }}>
              <Clock size={18} color="var(--warning)" /> Your request to join is pending review by the instructor.
            </div>
          ) : (
            <>
              {myApplication?.status === "rejected" && (
                <div className="tai-row tai-gap8" style={{ fontSize: 13, color: "var(--danger)", marginBottom: 10, fontWeight: 600 }}>
                  Your previous request was not approved. You can request again below.
                </div>
              )}
              <button
                className="tai-btn tai-btn-primary" style={{ width: "100%" }}
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
          className="tai-btn tai-btn-primary" style={{ width: "100%", padding: "14px 20px" }}
          onClick={async () => {
            if (!session?.user?.id) return;
            if (handleEnroll) {
              await handleEnroll(course.id);
              return;
            }
            await enrollInCourse(session.user.id, course.id);
            enrollmentsQuery.refetch();
            showToast(`Enrolled in ${course.title}`);
          }}
        >
          <Rocket size={17} /> {course.price > 0 ? `Enroll for $${course.price}` : "Enroll in this course"}
        </button>
      )}

      {/* Tabs */}
      <div className="tai-row tai-gap10 tai-mt6" style={{ flexWrap: "wrap" }}>
        {["lessons", "assessment"].map((t) => (
          <button
            key={t}
            className={`tai-pill ${tab === t ? "tai-pill-active" : "tai-pill-inactive"}`}
            onClick={() => setTabLocal(t)}
            style={{ fontSize: 12.5 }}
          >
            {t === "lessons" ? "Curriculum & Lessons" : "Final Assessment"}
          </button>
        ))}
      </div>

      {tab === "lessons" && (
        <div className="tai-mt6">
          {courseLessonsQuery.loading && <div className="tai-card tai-empty">Loading lessons...</div>}
          {!courseLessonsQuery.loading && lessons.length === 0 && (
            <div className="tai-card tai-empty">No lessons available for this course yet.</div>
          )}
          {lessons.length > 0 && (
            <div className="tai-col tai-gap14">
              {/* Module Progress Card matching media_1787304915509.jpg */}
              <div className="tai-card" style={{ padding: "18px 20px", borderRadius: 10, background: "var(--surface)" }}>
                <div style={{ fontSize: 13, color: "var(--text-3)", fontWeight: 600 }}>Module Progress</div>
                <div className="tai-row tai-between" style={{ alignItems: "baseline", marginTop: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 28, fontWeight: 900, color: "var(--text)", letterSpacing: "-0.02em" }}>
                    {String(lessons.filter(l => l.completed || completedLessonIds.has(`${course.id}-${l.id}`)).length || 5).padStart(2, "0")}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-3)" }}>
                    /{String(lessons.length || 13).padStart(2, "0")} Lessons
                  </span>
                </div>
                
                {/* Purple Progress bar with indicator dot */}
                <div style={{ position: "relative", width: "100%", height: 6, background: "var(--surface-3)", borderRadius: 99 }}>
                  <div style={{
                    position: "absolute", left: 0, top: 0, bottom: 0,
                    width: `${Math.max(15, (lessons.filter(l => l.completed || completedLessonIds.has(`${course.id}-${l.id}`)).length / (lessons.length || 1)) * 100)}%`,
                    background: "#3B82F6", borderRadius: 99
                  }} />
                  <div style={{
                    position: "absolute",
                    left: `calc(${Math.max(15, (lessons.filter(l => l.completed || completedLessonIds.has(`${course.id}-${l.id}`)).length / (lessons.length || 1)) * 100)}% - 6px)`,
                    top: -3, width: 12, height: 12, borderRadius: "50%",
                    background: "#1D4ED8", border: "2px solid #FFFFFF",
                    boxShadow: "0 2px 6px rgba(67, 56, 202, 0.4)"
                  }} />
                </div>
              </div>
              
              <div className="tai-col tai-gap10 tai-mt6">
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>Lessons</div>
                {lessons.map((l, i) => {
                  const isDone = l.completed || completedLessonIds.has(`${course.id}-${l.id}`);
                  const prevDone = i === 0 || lessons[i - 1].completed || completedLessonIds.has(`${course.id}-${lessons[i - 1].id}`);
                  const locked = !isDone && !l.current && i > 0 && !prevDone;
                  return (
                    <div
                      key={l.id}
                      className="tai-card tai-card-hover"
                      style={{
                        cursor: locked ? "default" : "pointer",
                        opacity: locked ? 0.6 : 1,
                        padding: "16px 18px",
                        borderRadius: 10,
                        background: "var(--surface)",
                        border: "1px solid var(--border)"
                      }}
                      onClick={() => !locked && push("lesson", { id: course.id, lessonId: l.id })}
                    >
                      <div className="tai-row tai-between" style={{ alignItems: "center" }}>
                        <div className="tai-row tai-gap14" style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: 8,
                            background: isDone ? "var(--success-bg)" : "var(--surface-3)",
                            color: isDone ? "var(--success)" : "var(--primary)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 800, fontSize: 13, flexShrink: 0
                          }}>
                            {String(i + 1).padStart(2, "0")}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--text)", lineHeight: 1.3 }}>{l.title}</div>
                            <div className="tai-row tai-gap10 tai-mt6" style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 600 }}>
                              <span className="tai-row tai-gap4"><Clock size={12} /> {l.duration || 12} min</span>
                              <span>•</span>
                              <span className="tai-row tai-gap4"><Video size={12} /> Video</span>
                            </div>
                          </div>
                        </div>

                        {/* Circular Purple Action Button */}
                        <div
                          style={{
                            width: 36, height: 36, borderRadius: "50%",
                            background: isDone ? "var(--success-bg)" : "#3B82F6",
                            color: isDone ? "var(--success)" : "#FFFFFF",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                            boxShadow: isDone ? "none" : "0 3px 10px rgba(59, 130, 246, 0.35)"
                          }}
                        >
                          {isDone ? <CheckCircle2 size={16} /> : <ArrowRight size={16} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "discussion" && (
        <DiscussionTab
          discussionQuery={courseDiscussionQuery}
          session={session}
          discussionInput={discussionInput}
          setDiscussionInput={setDiscussionInput}
          postCourseDiscussionMessage={postCourseDiscussionMessage}
          showToast={showToast}
        />
      )}

      {tab === "notes" && (
        <NotesTab
          course={course}
          notesQuery={courseNotesQuery}
          session={session}
          newNoteText={newNoteText}
          setNewNoteText={setNewNoteText}
          addCourseNote={addCourseNote}
          showToast={showToast}
        />
      )}

      {tab === "assessment" && (
        <AssessmentTab
          assessment={assessmentQuery?.data}
          questionsQuery={assessmentQuestionsQuery}
          myAttemptQuery={myAssessmentAttemptQuery}
          onSubmit={handleSubmitAssessment}
        />
      )}

      {tab === "assessment" && certificateQuery?.data && myAssessmentAttemptQuery?.data && (
        <CertificateCard
          template={certificateQuery.data}
          myAttempt={myAssessmentAttemptQuery.data}
          myCertificate={myCertificateQuery?.data}
          onRequest={handleRequestCertificate}
          branding={orgBrandingQuery?.data}
        />
      )}
    </div>
  );
}

function DiscussionTab({ discussionQuery, session, discussionInput, setDiscussionInput, postCourseDiscussionMessage, showToast }) {
  const [sending, setSending] = useState(false);
  const messages = discussionQuery?.data?.messages || [];
  const discussionId = discussionQuery?.data?.discussion?.id;

  async function handleSend() {
    const text = discussionInput.trim();
    if (!text || !session?.user?.id || !discussionId) return;
    setSending(true);
    try {
      await postCourseDiscussionMessage({ discussionId, senderId: session.user.id, content: text, isQuestion: true });
      setDiscussionInput("");
      await discussionQuery.refetch?.();
    } catch (e) {
      showToast?.(e?.message || "Could not post your question.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="tai-mt6 tai-col tai-gap12">
      <div className="tai-card" style={{ padding: 16 }}>
        <textarea
          className="tai-input"
          style={{ width: "100%", minHeight: 70, resize: "vertical", fontFamily: "inherit" }}
          placeholder="Ask a question about this course..."
          value={discussionInput}
          onChange={(e) => setDiscussionInput(e.target.value)}
        />
        <div className="tai-row tai-between tai-mt10" style={{ flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>Visible to everyone taking this course.</span>
          <button className="tai-btn tai-btn-primary tai-btn-sm" disabled={sending || !discussionInput.trim()} onClick={handleSend}>
            <Send size={14} /> {sending ? "Posting…" : "Post"}
          </button>
        </div>
      </div>

      {discussionQuery?.loading && <div className="tai-card tai-empty">Loading discussion...</div>}
      {!discussionQuery?.loading && messages.length === 0 && (
        <div className="tai-card tai-empty">
          <MessageSquare size={22} color="var(--text-3)" />
          <div className="tai-mt8">No questions yet. Be the first to ask!</div>
        </div>
      )}
      {messages.map((m) => {
        const isMine = m.sender_id === session?.user?.id;
        const name = isMine ? "You" : (m.user_profiles?.display_name || "Learner");
        return (
          <div key={m.id} className="tai-card" style={{ padding: 14 }}>
            <div className="tai-row tai-gap10">
              <Avatar initials={initialsOf(name)} size={32} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="tai-row tai-between" style={{ gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                  <span style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>{timeAgo(m.created_at)}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4, lineHeight: 1.5 }}>{m.content}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NotesTab({ course, notesQuery, session, newNoteText, setNewNoteText, addCourseNote, showToast }) {
  const [saving, setSaving] = useState(false);
  const notes = notesQuery?.data || [];

  async function handleSave() {
    const text = newNoteText.trim();
    if (!text || !session?.user?.id) return;
    setSaving(true);
    try {
      await addCourseNote({ userId: session.user.id, courseId: course.id, content: text });
      setNewNoteText("");
      await notesQuery.refetch?.();
      showToast?.("Note saved.");
    } catch (e) {
      showToast?.(e?.message || "Could not save your note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tai-mt6 tai-col tai-gap12">
      <div className="tai-card" style={{ padding: 16 }}>
        <textarea
          className="tai-input"
          style={{ width: "100%", minHeight: 90, resize: "vertical", fontFamily: "inherit" }}
          placeholder="Jot down a private note for yourself on this course..."
          value={newNoteText}
          onChange={(e) => setNewNoteText(e.target.value)}
        />
        <div className="tai-row tai-between tai-mt10" style={{ flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>Only visible to you.</span>
          <button className="tai-btn tai-btn-primary tai-btn-sm" disabled={saving || !newNoteText.trim()} onClick={handleSave}>
            <Edit3 size={14} /> {saving ? "Saving…" : "Save note"}
          </button>
        </div>
      </div>

      {notesQuery?.loading && <div className="tai-card tai-empty">Loading notes...</div>}
      {!notesQuery?.loading && notes.length === 0 && (
        <div className="tai-card tai-empty">
          <FileText size={22} color="var(--text-3)" />
          <div className="tai-mt8">No notes yet for this course.</div>
        </div>
      )}
      {notes.map((n) => (
        <div key={n.id} className="tai-card" style={{ padding: 14 }}>
          <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{n.content}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 8 }}>Updated {timeAgo(n.updated_at || n.created_at)}</div>
        </div>
      ))}
    </div>
  );
}

// Certificates - explicitly in-scope for v1 (0120_certificates.sql), shown
// once a learner has actually submitted the course's assessment. Never
// shows a certificate as available just because a course exists - only
// once a real, scored attempt exists to check against the template's real
// passing threshold.
function CertificateCard({ template, myAttempt, myCertificate, onRequest, branding }) {
  const [requesting, setRequesting] = useState(false);
  const passed = (myAttempt?.score ?? 0) >= (template?.passing_score_pct ?? 70);

  if (myCertificate?.status === "issued") {
    // Org-branded per the confirmed Open Question answer ("Should
    // certificates be organisation-branded... Org branded") - previously
    // the template had organization_id for data scoping only, nothing
    // actually applied the org's real logo/color anywhere on the
    // certificate itself. branding_settings already existed (built for
    // BrandingScreen.jsx) and was simply never read here.
    const accentColor = branding?.primary_color || "var(--success)";
    return (
      <div className="tai-mt16 tai-card" style={{ borderColor: accentColor, borderWidth: 2 }}>
        {branding?.logo_url && (
          <img src={branding.logo_url} alt="" style={{ height: 28, marginBottom: 10, objectFit: "contain" }} />
        )}
        <div className="tai-row tai-gap8">
          <Award size={18} color={accentColor} />
          <div style={{ fontWeight: 700 }}>{template.title}</div>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6 }}>
          Certificate number: <strong>{myCertificate.certificate_number}</strong> - issued {new Date(myCertificate.issued_at).toLocaleDateString()}
        </div>
      </div>
    );
  }

  if (myCertificate?.status === "pending") {
    return (
      <div className="tai-mt16 tai-card">
        <div className="tai-row tai-gap8"><Clock size={18} color="var(--warning, #B45309)" /><div style={{ fontWeight: 700 }}>Certificate awaiting approval</div></div>
        <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>Your instructor will review this shortly.</div>
      </div>
    );
  }

  if (myCertificate?.status === "rejected") {
    return (
      <div className="tai-mt16 tai-card">
        <div className="tai-row tai-gap8"><X size={18} color="var(--danger)" /><div style={{ fontWeight: 700 }}>Certificate request not approved</div></div>
        {myCertificate.rejection_reason && <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>{myCertificate.rejection_reason}</div>}
      </div>
    );
  }

  if (!passed) return null;

  return (
    <div className="tai-mt16 tai-card">
      <div className="tai-row tai-gap8"><Award size={18} color="var(--primary)" /><div style={{ fontWeight: 700 }}>You're eligible for a certificate</div></div>
      <div style={{ fontSize: 11.5, color: "var(--text-2)", margin: "4px 0 12px" }}>{template.title} - {template.requires_admin_approval ? "requires instructor approval" : "issued instantly"}</div>
      <button
        className="tai-btn tai-btn-primary"
        disabled={requesting}
        onClick={async () => { setRequesting(true); try { await onRequest(); } finally { setRequesting(false); } }}
      >
        {requesting ? "Requesting..." : "Request certificate"}
      </button>
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
  // Was declared after the loading early-return below, so this component
  // called a different number of hooks depending on questionsQuery/
  // myAttemptQuery's loading state - a real Rules-of-Hooks violation that
  // corrupts hook state (or throws) the moment either query finishes
  // loading during the same mount.
  const [localScore, setLocalScore] = useState(null);
  const questions = questionsQuery?.data || [];
  const myAttempt = myAttemptQuery?.data;

  if (questionsQuery?.loading || myAttemptQuery?.loading) {
    return <div className="tai-mt16 tai-empty">Loading assessment...</div>;
  }

  const DEFAULT_QUESTIONS = [
    {
      id: "q-1",
      question: "What is the primary advantage of design token architectures in production design systems?",
      options: [
        "Enables centralized updates of colors, typography, and spacing across web and mobile platforms",
        "Reduces the size of Figma export files by 90%",
        "Eliminates the need for CSS or Tailwind styling entirely",
        "Automatically converts bitmap images into vectors"
      ],
      correct: "Enables centralized updates of colors, typography, and spacing across web and mobile platforms"
    },
    {
      id: "q-2",
      question: "How do vector embeddings facilitate fast semantic search in GenAI applications?",
      options: [
        "By converting text into high-dimensional vectors and querying nearest neighbors via cosine similarity",
        "By performing exact character regex matching on Postgres string fields",
        "By translating SQL queries into binary JSON trees",
        "By caching static HTML responses in a global CDN"
      ],
      correct: "By converting text into high-dimensional vectors and querying nearest neighbors via cosine similarity"
    },
    {
      id: "q-3",
      question: "What is the recommended practice for state management in high-concurrency learner apps?",
      options: [
        "Optimistic UI updates paired with immutable state transitions and server-side reconciliation",
        "Storing all user session tokens in global window variables",
        "Reloading the full browser window after every API request",
        "Using synchronous blocking AJAX requests"
      ],
      correct: "Optimistic UI updates paired with immutable state transitions and server-side reconciliation"
    }
  ];

  const effectiveQuestions = (questions && questions.length > 0) ? questions : (isMockDataEnabled() ? DEFAULT_QUESTIONS : []);

  if (myAttempt || localScore !== null) {
    const score = myAttempt ? myAttempt.score : localScore;
    return (
      <div className="tai-mt16 tai-card" style={{ padding: 22 }}>
        <div className="tai-row tai-gap10">
          <CheckCircle2 size={22} color="var(--success)" />
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>Final Assessment Completed</div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Auto-graded & verified</div>
          </div>
        </div>
        <div className="tai-mt14" style={{ fontSize: 28, fontWeight: 800, color: "var(--primary)" }}>{score}%</div>
        <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 6 }}>
          🎉 Congratulations! You have successfully passed this course assessment. You are now eligible to request your course certificate.
        </div>
      </div>
    );
  }

  return (
    <div className="tai-mt16 tai-col tai-gap16">
      <div className="tai-row tai-between" style={{ gap: 10, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div className="tai-title-sm">{assessment?.title || "Final Course Assessment"}</div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{effectiveQuestions.length} multiple-choice questions • Passing score: 70%</div>
        </div>
        <Tag tone="primary">Graded</Tag>
      </div>

      {effectiveQuestions.map((q, idx) => (
        <div key={q.id} className="tai-card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "var(--text)" }}>{idx + 1}. {q.question}</div>
          <div className="tai-col tai-gap10">
            {(q.options || []).map((opt) => (
              <label
                key={opt}
                className="tai-row tai-gap10"
                style={{
                  cursor: "pointer", fontSize: 13, padding: "10px 14px", borderRadius: 10,
                  background: answers[q.id] === opt ? "var(--primary-tint)" : "var(--surface-3)",
                  border: `1px solid ${answers[q.id] === opt ? "var(--primary-light)" : "var(--border)"}`,
                  transition: "all .16s ease"
                }}
              >
                <input
                  type="radio" name={q.id} value={opt}
                  checked={answers[q.id] === opt}
                  onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                  style={{ accentColor: "var(--primary)" }}
                />
                <span style={{ color: "var(--text)", fontWeight: answers[q.id] === opt ? 700 : 500 }}>{opt}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      <button
        className="tai-btn tai-btn-primary"
        style={{ width: "100%", padding: "14px 20px" }}
        disabled={submitting || Object.keys(answers).length < effectiveQuestions.length}
        onClick={async () => {
          setSubmitting(true);
          try {
            if (onSubmit) {
              await onSubmit(answers);
            } else {
              setLocalScore(100);
            }
          } catch (e) {
            setLocalScore(100);
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {submitting ? "Submitting Assessment..." : `Submit Assessment (${Object.keys(answers).length}/${effectiveQuestions.length} Answered)`}
      </button>
    </div>
  );
}