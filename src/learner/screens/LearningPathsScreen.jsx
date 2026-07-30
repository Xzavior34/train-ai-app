import React from "react";
import { TopBar, ProgressBar } from "../components/LearnerUI.jsx";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";

// Real `learning_paths` / `learning_path_courses` / `learning_path_enrollments`
// tables (see fetchPublishedLearningPaths in lib/api/learner.js). Fills a
// real gap: CoursesScreen.jsx's "Learning Paths" card already pushed to
// `screen === "paths"`, but nothing rendered for it — this is that screen.
export function LearningPathsScreen({
  paths = [],
  pathEnrollments = [],
  courseById,
  back,
  push,
  session,
  enrollInLearningPath,
  pathEnrollmentsQuery,
  showToast,
}) {
  const enrolledPathIds = new Set(pathEnrollments.map((e) => e.path_id));
  const [enrollingId, setEnrollingId] = React.useState(null);

  async function handleStart(pathId) {
    if (!session?.user?.id) return;
    setEnrollingId(pathId);
    try {
      await enrollInLearningPath(session.user.id, pathId);
      pathEnrollmentsQuery.refetch();
      showToast("Enrolled in learning path!");
    } catch (e) {
      showToast(e?.message || "Couldn't enroll — please try again.");
    } finally {
      setEnrollingId(null);
    }
  }

  return (
    <div className="tai-fade-in">
      <TopBar title="Learning Paths" sub="Guided multi-course career tracks" onBack={back} />

      {!paths.length && (
        <div className="tai-empty tai-mt10">No learning paths have been published yet.</div>
      )}

      <div className="tai-col tai-gap12 tai-mt10">
        {paths.map((p) => {
          const total = p.courses.length;
          const done = p.courses.filter((c) => courseById(c.id)?.progress === 100).length;
          const pct = total ? Math.round((done / total) * 100) : 0;
          const isEnrolled = enrolledPathIds.has(p.id);

          return (
            <div key={p.id} className="tai-card">
              <div className="tai-row tai-between">
                <div style={{ fontWeight: 800, fontSize: 15 }}>{p.title}</div>
                <span className="tai-pill tai-pill-inactive" style={{ textTransform: "capitalize" }}>{p.level}</span>
              </div>
              {p.description && (
                <div className="tai-body-text tai-mt6" style={{ color: "var(--text-2)" }}>{p.description}</div>
              )}
              <div className="tai-mt10" style={{ fontSize: 12, color: "var(--text-2)" }}>
                {total} course{total === 1 ? "" : "s"} · {done} completed
              </div>
              <div className="tai-mt8"><ProgressBar value={pct} /></div>

              {total > 0 && (
                <div className="tai-col tai-gap6 tai-mt12">
                  {p.courses.map((c, i) => {
                    const course = courseById(c.id);
                    const complete = course?.progress === 100;
                    return (
                      <div
                        key={c.id}
                        className="tai-row tai-between"
                        style={{ cursor: course ? "pointer" : "default", padding: "6px 0" }}
                        onClick={() => course && push("courseDetail", { id: c.id })}
                      >
                        <div className="tai-row tai-gap8">
                          {complete ? <CheckCircle2 size={16} color="var(--success)" /> : <Circle size={16} color="var(--text-3)" />}
                          <span style={{ fontSize: 13 }}>{i + 1}. {c.title}</span>
                        </div>
                        {course && <ChevronRight size={14} color="var(--text-3)" />}
                      </div>
                    );
                  })}
                </div>
              )}

              {!isEnrolled && (
                <button
                  className="tai-btn tai-btn-primary tai-mt12"
                  style={{ width: "100%" }}
                  disabled={enrollingId === p.id}
                  onClick={() => handleStart(p.id)}
                >
                  {enrollingId === p.id ? "Starting..." : "Start this path"}
                </button>
              )}
              {isEnrolled && pct === 100 && (
                <div className="tai-mt12" style={{ fontSize: 12.5, color: "var(--success)", fontWeight: 700 }}>
                  Path complete!
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
