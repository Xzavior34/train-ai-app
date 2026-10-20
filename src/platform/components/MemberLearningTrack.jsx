import React from "react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchMemberLearningTrack } from "../../lib/api/platform.js";

export function MemberLearningTrack({ orgId, userId, cohortId = null }) {
  const query = useSupabaseQuery(() => fetchMemberLearningTrack(userId, orgId, cohortId), [userId, orgId, cohortId]);
  if (query.loading) return <div className="ta-empty" role="status">Loading learning track...</div>;
  if (query.error) return <div className="ta-empty" role="alert">{query.error} <button className="ta-btn ta-btn-outline" onClick={query.refetch}>Retry</button></div>;
  const data = query.data;
  const courses = data?.enrollments || [];
  return <div className="ta-col ta-gap12 ta-mt16">
    <div><strong>Learning track</strong><p>{data?.completedCount || 0} completed · {data?.avgProgress || 0}% average progress</p></div>
    {(data?.tracks || []).map(path => <div key={path.id} className="ta-card" style={{ padding: 16 }}>
      <strong>{path.title}</strong><p>{path.status?.replaceAll("_", " ")}</p>
      {(path.courses || []).map(course => <p key={course.id}>{course.orderIndex + 1}. {course.title} — {course.progress}%</p>)}
    </div>)}
    {!courses.length && <div className="ta-empty">No courses or learning paths assigned yet.</div>}
    {courses.map(course => <div key={course.id} className="ta-card" style={{ padding: 16 }}>
      <div className="ta-row ta-between ta-gap10"><strong>{course.title}</strong><span>{course.progress}%</span></div>
      <progress aria-label={`${course.title} progress`} value={course.progress} max="100" style={{ width: "100%", marginTop: 8 }} />
      <div style={{ fontSize: 12, marginTop: 6 }}>{course.status === "assigned" ? "Assigned · not started" : course.completedAt ? `Completed ${new Date(course.completedAt).toLocaleDateString()}` : "In progress"}</div>
    </div>)}
  </div>;
}
