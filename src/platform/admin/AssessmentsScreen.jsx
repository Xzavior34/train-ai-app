import React, { useState } from "react";
import { TopBar, Tag } from "../components/PlatformUI.jsx";
import { CheckSquare, ChevronRight, ArrowRight } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchCourses, fetchAssessmentAttemptsForCourse } from "../../lib/api/platform.js";

// Real Assessments & Grading view. Previously the "Assessments" nav item
// (both Admin's "Assessments & Quizzes" and Instructor's "Assessments &
// Grading") rendered the exact same ComplianceScreen as "Learner Progress" -
// a nav alias with no real assessment content of its own. The actual
// assessment-grading feature (fetchAssessmentAttemptsForCourse /
// overrideAssessmentScore, backed by 0112_assessments_pipeline.sql) was
// already fully built, just buried inside ContentScreen's per-course
// builder with no way to discover it. This screen is the missing front
// door: a course-by-course summary of assessment attempts, linking into the
// existing (working) per-course grading UI rather than re-implementing it.
export function AssessmentsScreen({ orgId, orgSelector, setScreen, setSelectedCourseId, scope = "admin" }) {
  const coursesQuery = useSupabaseQuery(async () => fetchCourses(), []);
  const courses = (coursesQuery.data || []).filter((c) => c.is_published);
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div className="ta-fade">
      <TopBar
        title="Assessments & Grading"
        sub="Every course's assessment attempts, at a glance - open a course to review and override scores."
        orgSelector={orgSelector}
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {coursesQuery.loading && <div className="ta-empty">Loading courses...</div>}
        {!coursesQuery.loading && courses.length === 0 && (
          <div className="ta-empty">No published courses yet - assessments live inside a course's builder once one exists.</div>
        )}
        {courses.map((course) => (
          <AssessmentCourseRow
            key={course.id}
            course={course}
            expanded={expandedId === course.id}
            onToggle={() => setExpandedId(expandedId === course.id ? null : course.id)}
            onOpenGrading={() => {
              setSelectedCourseId?.(course.id);
              setScreen?.(scope === "mentor" ? "content" : "coursebuilder");
            }}
          />
        ))}
      </div>
    </div>
  );
}

function AssessmentCourseRow({ course, expanded, onToggle, onOpenGrading }) {
  const attemptsQuery = useSupabaseQuery(async () => (expanded ? fetchAssessmentAttemptsForCourse(course.id) : []), [expanded, course.id]);
  const attempts = attemptsQuery.data || [];
  const scores = attempts.map((a) => a.score).filter((s) => typeof s === "number");
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  return (
    <div className="ta-card" style={{ padding: 0, overflow: "hidden" }}>
      <div
        className="ta-row ta-between"
        style={{ padding: "16px 18px", cursor: "pointer", alignItems: "center", gap: 12, flexWrap: "wrap" }}
        onClick={onToggle}
      >
        <div className="ta-row ta-gap10" style={{ minWidth: 0 }}>
          <CheckSquare size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", overflowWrap: "break-word" }}>{course.title}</div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Click to view submitted attempts</div>
          </div>
        </div>
        <ChevronRight size={16} color="var(--text-3)" style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
      </div>

      {expanded && (
        <div style={{ padding: "0 18px 18px", borderTop: "1px solid var(--border)" }}>
          {attemptsQuery.loading && <div className="ta-empty" style={{ marginTop: 12 }}>Loading attempts...</div>}
          {!attemptsQuery.loading && attempts.length === 0 && (
            <div className="ta-empty" style={{ marginTop: 12 }}>No assessment attempts submitted yet for this course.</div>
          )}
          {!attemptsQuery.loading && attempts.length > 0 && (
            <>
              <div className="ta-row ta-gap12 ta-mt12" style={{ flexWrap: "wrap" }}>
                <Tag tone="primary">{attempts.length} attempt{attempts.length === 1 ? "" : "s"}</Tag>
                {avgScore !== null && <Tag tone={avgScore >= 70 ? "success" : "warning"}>Avg score: {avgScore}%</Tag>}
              </div>
              <div className="ta-col ta-gap8 ta-mt12">
                {attempts.slice(0, 5).map((a) => (
                  <div key={a.id} className="ta-row ta-between" style={{ fontSize: 12.5, padding: "8px 10px", background: "var(--surface-3)", borderRadius: 8 }}>
                    <span style={{ fontWeight: 700 }}>{a.user_profiles?.display_name || "Learner"}</span>
                    <span style={{ color: "var(--text-2)" }}>{typeof a.score === "number" ? `${a.score}%` : "Ungraded"}</span>
                  </div>
                ))}
                {attempts.length > 5 && (
                  <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>+ {attempts.length - 5} more</div>
                )}
              </div>
            </>
          )}
          <button className="ta-btn ta-btn-primary ta-btn-sm ta-mt12" onClick={onOpenGrading}>
            Open Grading <ArrowRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
