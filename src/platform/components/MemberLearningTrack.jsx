import React from "react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchMemberLearningTrack } from "../../lib/api/platform.js";
import { CheckCircle2, BookOpen, Layers, Award } from "lucide-react";
import { Tag } from "./PlatformUI.jsx";

export function MemberLearningTrack({ orgId, userId, cohortId = null, member = null, learningTrackQuery }) {
  const ownQuery = useSupabaseQuery(() => learningTrackQuery ? Promise.resolve(null) : fetchMemberLearningTrack(userId, orgId, cohortId), [userId, orgId, cohortId, !!learningTrackQuery]);
  const query = learningTrackQuery || ownQuery;

  if (query.loading) {
    return (
      <div className="ta-empty ta-mt16" role="status">
        Loading learning track & milestones...
      </div>
    );
  }

  if (query.error) {
    return (
      <div className="ta-empty ta-mt16" role="alert">
        <div>{query.error}</div>
        <button className="ta-btn ta-btn-outline ta-mt8" onClick={query.refetch}>Retry</button>
      </div>
    );
  }

  const data = query.data;
  if (data?.unavailableReason) {
    return <div className="ta-empty ta-mt16" role="status">{data.unavailableReason}</div>;
  }

  const tracks = data?.tracks || [];
  const courses = [...new Map([...tracks.flatMap(path => path.courses || []), ...(data?.enrollments || [])].map(course => [course.courseId || course.id, course])).values()];
  const completedCount = data?.completedCount ?? courses.filter((c) => c.completedAt).length;
  const avgProgress = data?.avgProgress ?? 0;

  return (
    <div className="ta-col ta-gap16 ta-mt16">
      {data?.isPreview && <div className="ta-tag">Preview data · sample learning progress</div>}
      {/* Metric summary banner */}
      <div className="ta-grid ta-grid-3 ta-gap8">
        <div className="ta-card" style={{ padding: "12px 14px", borderRadius: 10 }}>
          <div className="ta-row ta-gap6" style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>
            <BookOpen size={12} /> Total Courses
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{courses.length}</div>
        </div>
        <div className="ta-card" style={{ padding: "12px 14px", borderRadius: 10 }}>
          <div className="ta-row ta-gap6" style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>
            <CheckCircle2 size={12} color="#10B981" /> Completed
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{completedCount}</div>
        </div>
        <div className="ta-card" style={{ padding: "12px 14px", borderRadius: 10 }}>
          <div className="ta-row ta-gap6" style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>
            <Award size={12} color="var(--primary)" /> Average Progress
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{avgProgress}%</div>
        </div>
      </div>

      {/* Curriculum tracks & milestones */}
      {tracks.length > 0 && (
        <div className="ta-col ta-gap12">
          {tracks.map((path) => {
            const pathCourses = path.courses || [];
            const pathProgress = pathCourses.length
              ? Math.round(pathCourses.reduce((s, c) => s + (c.progress || 0), 0) / pathCourses.length)
              : 0;
            const isCompleted = path.status === "completed" || (pathCourses.length > 0 && pathCourses.every((c) => c.completedAt || c.progress === 100));

            return (
              <div key={path.id} className="ta-card" style={{ padding: 16, borderRadius: 10, border: "1px solid var(--border)" }}>
                <div className="ta-row ta-between" style={{ alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  <div className="ta-row ta-gap8" style={{ alignItems: "center" }}>
                    <Layers size={16} color="var(--primary)" />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{path.title}</div>
                      {path.description && <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>{path.description}</div>}
                    </div>
                  </div>
                  <div className="ta-row ta-gap8" style={{ alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{pathProgress}% Track Progress</span>
                    <Tag tone={isCompleted ? "success" : path.status === "assigned" ? "default" : "primary"}>
                      {isCompleted ? "Completed" : (path.status ? String(path.status).replace(/_/g, " ") : "In Progress")}
                    </Tag>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ width: "100%", height: 6, background: "var(--surface-3)", borderRadius: 4, overflow: "hidden", marginBottom: 16 }}>
                  <div style={{ width: `${Math.min(100, pathProgress)}%`, height: "100%", background: isCompleted ? "#10B981" : "var(--primary)", transition: "width 0.3s ease" }} />
                </div>

                {/* Milestones list */}
                <div className="ta-col ta-gap8">
                  {pathCourses.map((course, idx) => {
                    const stepNum = (course.orderIndex != null ? course.orderIndex : idx) + 1;
                    const courseDone = course.completedAt || course.progress === 100;
                    return (
                      <div
                        key={course.id || idx}
                        className="ta-row ta-between"
                        style={{
                          padding: "10px 12px",
                          background: "var(--surface-2)",
                          borderRadius: 8,
                          gap: 12,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <div className="ta-row ta-gap10" style={{ alignItems: "center", minWidth: 0, flex: "1 1 240px" }}>
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              background: courseDone ? "#10B981" : course.progress > 0 ? "var(--primary)" : "var(--surface-3)",
                              color: "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 11,
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {courseDone ? <CheckCircle2 size={14} color="#fff" /> : stepNum}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, overflowWrap: "anywhere" }}>{course.title}</div>
                            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                              {course.category || "Curriculum Milestone"}
                              {course.completedAt ? ` • Completed ${new Date(course.completedAt).toLocaleDateString()}` : course.progress > 0 ? " • In Progress" : " • Next in sequence"}
                            </div>
                          </div>
                        </div>

                        <div className="ta-row ta-gap8" style={{ alignItems: "center", flexShrink: 0 }}>
                          <div style={{ width: 80, height: 5, background: "var(--surface-3)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(100, course.progress || 0)}%`, height: "100%", background: courseDone ? "#10B981" : "var(--primary)" }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 34, textAlign: "right" }}>{course.progress || 0}%</span>
                          {courseDone ? (
                            <Tag tone="success">Done</Tag>
                          ) : course.progress > 0 ? (
                            <Tag tone="primary">In progress</Tag>
                          ) : (
                            <Tag tone="default">Assigned</Tag>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Enrolled Courses list */}
      <div className="ta-card" style={{ padding: 16, borderRadius: 10, border: "1px solid var(--border)" }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12 }}>
          {tracks.length > 0 ? "All Assigned Coursework" : "Assigned Courses & Modules"}
        </div>
        {courses.length === 0 && (
          <div className="ta-empty" style={{ padding: "16px 0" }}>No standalone courses assigned outside curriculum tracks.</div>
        )}
        <div className="ta-col ta-gap8">
          {courses.map((course) => {
            const isDone = course.completedAt || course.progress === 100;
            return (
              <div
                key={course.id || course.courseId}
                style={{
                  padding: "10px 12px",
                  background: "var(--surface-2)",
                  borderRadius: 8,
                }}
              >
                <div className="ta-row ta-between" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflowWrap: "anywhere" }}>{course.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                      {course.category || "General"}
                      {course.completedAt
                        ? ` • Completed ${new Date(course.completedAt).toLocaleDateString()}`
                        : course.enrolledAt
                        ? ` • Enrolled ${new Date(course.enrolledAt).toLocaleDateString()}`
                        : ""}
                    </div>
                  </div>
                  <div className="ta-row ta-gap8" style={{ alignItems: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{course.progress || 0}%</span>
                    {isDone ? (
                      <Tag tone="success">Completed</Tag>
                    ) : course.progress > 0 ? (
                      <Tag tone="primary">In Progress</Tag>
                    ) : (
                      <Tag tone="default">Assigned</Tag>
                    )}
                  </div>
                </div>
                <div style={{ width: "100%", height: 5, background: "var(--surface-3)", borderRadius: 4, overflow: "hidden", marginTop: 8 }}>
                  <div style={{ width: `${Math.min(100, course.progress || 0)}%`, height: "100%", background: isDone ? "#10B981" : "var(--primary)" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
