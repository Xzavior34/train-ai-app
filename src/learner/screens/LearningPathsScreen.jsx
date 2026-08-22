import React, { useState, useMemo, useEffect, useRef } from "react";
import { TopBar, Tag, ProgressBar } from "../components/LearnerUI.jsx";
import {
  Map as MapIcon, Route, Lock, CheckCircle2, PlayCircle, Trophy, Clock, BookOpen,
  ChevronDown, ChevronUp, Plus, X, Compass, Sparkles, ArrowRight, LogOut,
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  resolvePathProgress, enrollInLearningPath, leaveLearningPath, syncLearningPathProgress,
  fetchAvailableTracks, fetchMyTracks, addMyTrack, removeMyTrack,
} from "../../lib/api/learner.js";

const STEP_TONE = {
  completed: { bg: "var(--success-bg)", fg: "var(--success)", label: "Completed" },
  in_progress: { bg: "var(--primary-tint)", fg: "var(--primary)", label: "In progress" },
  available: { bg: "var(--surface-2)", fg: "var(--text-2)", label: "Available" },
  locked: { bg: "var(--surface-2)", fg: "var(--text-3)", label: "Locked" },
};

function PathCard({ path, enrollment, enrollments, onEnroll, onLeave, onOpenCourse, busy }) {
  const [open, setOpen] = useState(false);
  const resolved = useMemo(() => resolvePathProgress(path, enrollments), [path, enrollments]);
  const isEnrolled = !!enrollment;
  const isComplete = resolved.total > 0 && resolved.completedCount === resolved.total;

  return (
    <div className="tai-card" style={{ padding: 20, background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0, flex: "1 1 260px" }}>
          <div className="tai-row tai-gap6" style={{ flexWrap: "wrap" }}>
            {path.category && <Tag tone="primary">{path.category}</Tag>}
            <Tag>{path.level}</Tag>
            {isComplete && <Tag tone="success">Completed</Tag>}
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: "var(--text)", margin: "10px 0 4px", overflowWrap: "anywhere" }}>
            {path.title}
          </h3>
          <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5, overflowWrap: "anywhere" }}>
            {path.description || "A guided, ordered journey through this organization's courses."}
          </div>
          <div className="tai-row tai-gap12 tai-mt10" style={{ flexWrap: "wrap", fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>
            <span className="tai-row tai-gap6"><BookOpen size={13} /> {resolved.total} course{resolved.total === 1 ? "" : "s"}</span>
            {resolved.totalHours > 0 && <span className="tai-row tai-gap6"><Clock size={13} /> {resolved.totalHours}h total</span>}
            {isEnrolled && <span className="tai-row tai-gap6"><CheckCircle2 size={13} /> {resolved.completedCount} of {resolved.total} done</span>}
          </div>
        </div>

        {isEnrolled && (
          <div style={{ textAlign: "right", minWidth: 150 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--primary)" }}>{resolved.overallProgress}% complete</div>
            <div style={{ width: 150, marginTop: 6 }}><ProgressBar value={resolved.overallProgress} height={7} /></div>
          </div>
        )}
      </div>

      {isEnrolled && isComplete && (
        <div className="tai-row tai-gap8 tai-mt12" style={{ padding: "10px 12px", background: "var(--success-bg)", color: "var(--success)", borderRadius: 12, fontWeight: 700, fontSize: 13 }}>
          <Trophy size={16} /> Journey complete. Every course in this path is finished.
        </div>
      )}

      {resolved.total === 0 && (
        <div className="tai-mt12" style={{ fontSize: 12.5, color: "var(--text-3)" }}>
          No courses have been added to this path yet.
        </div>
      )}

      {resolved.total > 0 && (
        <>
          <button
            className="tai-btn tai-btn-ghost tai-btn-sm tai-mt12"
            onClick={() => setOpen((v) => !v)}
            style={{ paddingLeft: 0 }}
          >
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {open ? "Hide roadmap" : `View roadmap (${resolved.total} steps)`}
          </button>

          {open && (
            <div className="tai-mt12" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {resolved.steps.map((step, idx) => {
                const tone = STEP_TONE[step.status] || STEP_TONE.locked;
                const canOpen = step.isUnlocked;
                return (
                  <div
                    key={step.pathCourseId || step.id}
                    className="tai-card"
                    style={{
                      padding: "12px 14px",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      opacity: step.isUnlocked ? 1 : 0.7,
                    }}
                  >
                    <div className="tai-row tai-between" style={{ gap: 10, flexWrap: "wrap" }}>
                      <div className="tai-row tai-gap10" style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: tone.bg,
                            color: tone.fg,
                            display: "grid",
                            placeItems: "center",
                            fontSize: 12,
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {step.isCompleted ? <CheckCircle2 size={16} /> : !step.isUnlocked ? <Lock size={14} /> : idx + 1}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", overflowWrap: "anywhere" }}>
                            {step.title}
                          </div>
                          <div className="tai-row tai-gap8" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2, flexWrap: "wrap" }}>
                            {step.hours ? <span>{step.hours}h</span> : null}
                            {step.level ? <span style={{ textTransform: "capitalize" }}>{step.level}</span> : null}
                            {!step.isRequired && <span>Optional</span>}
                            {step.unlockRule === "manual" && <span>Open anytime</span>}
                          </div>
                        </div>
                      </div>
                      <div className="tai-row tai-gap10" style={{ flexShrink: 0 }}>
                        {step.progress > 0 && !step.isCompleted && (
                          <div style={{ width: 70 }}><ProgressBar value={step.progress} height={5} /></div>
                        )}
                        <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", color: tone.fg, letterSpacing: 0.3 }}>
                          {tone.label}
                        </span>
                        {clickable && <ArrowRight size={13} color="var(--text-3)" />}
                      </div>
                    </div>
                    {idx < resolved.steps.length - 1 && (
                      <div style={{ display: "flex", justifyContent: "center", padding: "2px 0" }}>
                        <ChevronDown size={14} color="var(--text-3)" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="tai-row tai-between tai-mt16" style={{ paddingTop: 12, borderTop: "1px solid var(--border-subtle)", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 600 }}>
          {isEnrolled
            ? resolved.nextStep ? `Up next: ${resolved.nextStep.title}` : "Nothing left to unlock"
            : "Enroll to track your progress through this path"}
        </span>
        <div className="tai-row tai-gap8">
          {isEnrolled && (
            <button className="tai-btn tai-btn-ghost tai-btn-sm" disabled={busy} onClick={() => onLeave(path)} title="Leave this path">
              <LogOut size={13} /> Leave
            </button>
          )}
          {isEnrolled ? (
            <button
              className="tai-btn tai-btn-primary tai-btn-sm"
              disabled={!resolved.nextStep}
              onClick={() => resolved.nextStep && onOpenCourse(resolved.nextStep.id)}
            >
              <PlayCircle size={14} /> {resolved.completedCount > 0 ? "Continue path" : "Start first course"}
            </button>
          ) : (
            <button className="tai-btn tai-btn-primary tai-btn-sm" disabled={busy || resolved.total === 0} onClick={() => onEnroll(path)}>
              <Route size={14} /> Start this journey
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TracksTab({ userId, showToast, onOpenCourses }) {
  const availableQuery = useSupabaseQuery(async () => fetchAvailableTracks(), []);
  const myTracksQuery = useSupabaseQuery(async () => (userId ? fetchMyTracks(userId) : []), [userId]);
  const available = availableQuery.data || [];
  const myTracks = myTracksQuery.data || [];
  const [customTrack, setCustomTrack] = useState("");
  const [busy, setBusy] = useState(false);

  const followed = new Set(myTracks.map((t) => (t || "").toLowerCase()));
  const addable = available.filter((t) => !followed.has(t.name.toLowerCase()));

  async function handleAdd(name) {
    if (!userId) { showToast("Sign in to add a track."); return; }
    setBusy(true);
    try {
      const res = await addMyTrack(userId, name);
      showToast(res.success ? `${name} added to your tracks.` : res.error);
      if (res.success) myTracksQuery.refetch();
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(name) {
    setBusy(true);
    try {
      const res = await removeMyTrack(userId, name);
      showToast(res.success ? `${name} removed from your tracks.` : res.error);
      if (res.success) myTracksQuery.refetch();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tai-col tai-gap16">
      <div className="tai-card" style={{ padding: 20 }}>
        <div className="tai-row tai-gap8">
          <Compass size={17} color="var(--primary)" />
          <div style={{ fontWeight: 800, fontSize: 15 }}>My tracks</div>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4 }}>
          Tracks shape your recommendations and the focus area shown on your home screen. Add as many as you like.
        </div>

        {myTracksQuery.loading && <div className="tai-mt12" style={{ fontSize: 12.5, color: "var(--text-3)" }}>Loading your tracks...</div>}
        {!myTracksQuery.loading && myTracks.length === 0 && (
          <div className="tai-mt12" style={{ fontSize: 12.5, color: "var(--text-3)" }}>
            You're not following any track yet. Add one below and your recommendations start following it.
          </div>
        )}
        {myTracks.length > 0 && (
          <div className="tai-row tai-gap8 tai-mt12" style={{ flexWrap: "wrap" }}>
            {myTracks.map((t) => (
              <span
                key={t}
                className="tai-row tai-gap6"
                style={{
                  background: "var(--primary-tint)", color: "var(--primary)", borderRadius: 999,
                  padding: "6px 8px 6px 12px", fontSize: 12.5, fontWeight: 700,
                }}
              >
                {t}
                <button
                  className="tai-iconbtn"
                  disabled={busy}
                  onClick={() => handleRemove(t)}
                  aria-label={`Remove ${t}`}
                  style={{ width: 20, height: 20, background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="tai-card" style={{ padding: 20 }}>
        <div className="tai-row tai-gap8">
          <Sparkles size={17} color="var(--primary)" />
          <div style={{ fontWeight: 800, fontSize: 15 }}>Add a track</div>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4 }}>
          Every track below is backed by real published courses in the catalog.
        </div>

        {availableQuery.loading && <div className="tai-mt12" style={{ fontSize: 12.5, color: "var(--text-3)" }}>Loading tracks...</div>}
        {!availableQuery.loading && available.length === 0 && (
          <div className="tai-mt12" style={{ fontSize: 12.5, color: "var(--text-3)" }}>
            No tracks are available yet. Tracks come from course categories, so they appear here once courses are published with one.
          </div>
        )}
        {!availableQuery.loading && available.length > 0 && addable.length === 0 && (
          <div className="tai-mt12" style={{ fontSize: 12.5, color: "var(--text-3)" }}>
            You're following every available track.
          </div>
        )}

        {addable.length > 0 && (
          <div className="tai-col tai-gap8 tai-mt12">
            {addable.map((t) => (
              <div key={t.name} className="tai-row tai-between" style={{ padding: "10px 12px", background: "var(--surface-3)", borderRadius: 12, gap: 10, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{t.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>
                    {t.courses} course{t.courses === 1 ? "" : "s"}{t.hours ? ` • ${t.hours}h of content` : ""}
                  </div>
                  {(t.courseTitles || []).length > 0 && (
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3, overflowWrap: "anywhere" }}>
                      {t.courseTitles.slice(0, 3).join(" • ")}{t.courseTitles.length > 3 ? " • ..." : ""}
                    </div>
                  )}
                </div>
                <button className="tai-btn tai-btn-primary tai-btn-sm" disabled={busy} onClick={() => handleAdd(t.name)}>
                  <Plus size={13} /> Add track
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="tai-mt16" style={{ paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>Or name your own</div>
          <div className="tai-row tai-gap8 tai-mt8" style={{ flexWrap: "wrap" }}>
            <input
              className="tai-input"
              style={{ flex: "1 1 200px", minWidth: 0 }}
              placeholder="e.g. Machine Learning Ops"
              value={customTrack}
              onChange={(e) => setCustomTrack(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && customTrack.trim()) { handleAdd(customTrack.trim()); setCustomTrack(""); } }}
            />
            <button
              className="tai-btn tai-btn-outline tai-btn-sm"
              disabled={busy || !customTrack.trim()}
              onClick={() => { handleAdd(customTrack.trim()); setCustomTrack(""); }}
            >
              <Plus size={13} /> Add
            </button>
          </div>
        </div>

        <button className="tai-btn tai-btn-ghost tai-btn-sm tai-mt12" onClick={onOpenCourses} style={{ paddingLeft: 0 }}>
          Browse the course catalog <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}

export function LearningPathsScreen({
  session, push, back, showToast,
  pathsQuery, pathEnrollmentsQuery, enrollments = [],
}) {
  const userId = session?.user?.id || null;
  const [tab, setTab] = useState("paths");
  const [busy, setBusy] = useState(false);

  const paths = pathsQuery?.data || [];
  const pathEnrollments = pathEnrollmentsQuery?.data || [];
  const enrollmentByPath = useMemo(
    () => Object.fromEntries(pathEnrollments.map((e) => [e.path_id, e])),
    [pathEnrollments]
  );

  // Keep each enrolled path's stored row in step with the learner's real
  // course completions. Nothing did this before, so current_course_index and
  // status stayed frozen at their insert-time values forever. Guarded by a
  // ref so a re-render never turns this into a write loop.
  const syncedRef = useRef({});
  useEffect(() => {
    if (!userId || !paths.length) return;
    for (const path of paths) {
      const enrollment = enrollmentByPath[path.id];
      if (!enrollment) continue;
      const resolved = resolvePathProgress(path, enrollments);
      if (!resolved.total) continue;
      const isComplete = resolved.completedCount === resolved.total;
      const nextIndex = isComplete
        ? resolved.total
        : resolved.steps.findIndex((s) => !s.isCompleted);
      const signature = `${nextIndex}:${isComplete}`;
      const alreadyStored = `${enrollment.current_course_index}:${enrollment.status === "completed"}`;
      if (signature === alreadyStored) continue;
      if (syncedRef.current[path.id] === signature) continue;
      syncedRef.current[path.id] = signature;
      syncLearningPathProgress(userId, path.id, { currentIndex: nextIndex, isComplete });
    }
  }, [userId, paths, enrollments, enrollmentByPath]);

  async function handleEnroll(path) {
    if (!userId) { showToast("Sign in to start a learning path."); return; }
    setBusy(true);
    try {
      await enrollInLearningPath(userId, path.id);
      showToast(`You've started "${path.title}".`);
      pathEnrollmentsQuery?.refetch?.();
    } catch (e) {
      showToast(e?.message || "Could not start this path.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave(path) {
    if (!userId) return;
    setBusy(true);
    try {
      const res = await leaveLearningPath(userId, path.id);
      showToast(res.success ? `You've left "${path.title}".` : res.error);
      if (res.success) {
        delete syncedRef.current[path.id];
        pathEnrollmentsQuery?.refetch?.();
      }
    } finally {
      setBusy(false);
    }
  }

  const enrolledCount = paths.filter((p) => enrollmentByPath[p.id]).length;

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <TopBar
        title="Learning Paths & Tracks"
        sub="Guided, ordered course journeys plus the tracks you choose to follow"
        onBack={back}
      />

      <div className="tai-row tai-gap8" style={{ flexWrap: "wrap" }}>
        {[
          { k: "paths", label: `Learning paths${paths.length ? ` (${paths.length})` : ""}` },
          { k: "tracks", label: "My tracks" },
        ].map((t) => (
          <button
            key={t.k}
            className={`tai-btn tai-btn-sm ${tab === t.k ? "tai-btn-primary" : "tai-btn-outline"}`}
            onClick={() => setTab(t.k)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "paths" && (
        <div className="tai-col tai-gap16">
          {enrolledCount > 0 && (
            <div style={{ fontSize: 12.5, color: "var(--text-3)", fontWeight: 600 }}>
              You're enrolled in {enrolledCount} of {paths.length} path{paths.length === 1 ? "" : "s"}.
            </div>
          )}

          {pathsQuery?.loading && (
            <div className="tai-card" style={{ padding: 24, textAlign: "center", fontSize: 13, color: "var(--text-3)" }}>
              Loading learning paths...
            </div>
          )}

          {!pathsQuery?.loading && paths.length === 0 && (
            <div className="tai-card" style={{ padding: 32, textAlign: "center" }}>
              <MapIcon size={30} color="var(--text-3)" style={{ opacity: 0.5 }} />
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10 }}>No learning paths published yet</div>
              <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 4 }}>
                Your organization's admins build these. In the meantime, pick a track below or browse the catalog.
              </div>
              <button className="tai-btn tai-btn-outline tai-btn-sm tai-mt12" onClick={() => setTab("tracks")}>
                <Compass size={14} /> Choose a track instead
              </button>
            </div>
          )}

          {paths.map((path) => (
            <PathCard
              key={path.id}
              path={path}
              enrollment={enrollmentByPath[path.id]}
              enrollments={enrollments}
              onEnroll={handleEnroll}
              onLeave={handleLeave}
              onOpenCourse={(courseId) => push("courseDetail", { id: courseId })}
              busy={busy}
            />
          ))}
        </div>
      )}

      {tab === "tracks" && (
        <TracksTab userId={userId} showToast={showToast} onOpenCourses={() => push("courses")} />
      )}
    </div>
  );
}

export default LearningPathsScreen;
