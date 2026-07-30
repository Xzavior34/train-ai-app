import React from "react";
import { CourseCard } from "./LearnerUI.jsx";
import { Compass } from "lucide-react";

// Client-side "explore something new" recommendations, derived purely from
// course/enrollment data the learner app already fetches (courses.category +
// course_enrollments via the `enrolled`/`progress` fields useLearnerData
// already merges onto each course) — no AI/LLM call. Deliberately distinct
// from HomeScreen's existing "Recommended for {track}" section (which
// matches the learner's own onboarding-selected track): this instead
// surfaces the top-rated course from each category the learner has never
// enrolled in at all, so it doesn't just repeat the same list.
export function RecommendedCoursesCard({ courses = [], onOpenCourse, onSeeAll }) {
  const triedCategories = new Set(courses.filter((c) => c.enrolled).map((c) => c.category));
  const untried = courses.filter((c) => !c.enrolled && !triedCategories.has(c.category));

  const bestPerCategory = {};
  for (const c of untried) {
    const existing = bestPerCategory[c.category];
    if (!existing || (c.rating || 0) > (existing.rating || 0)) bestPerCategory[c.category] = c;
  }
  const picks = Object.values(bestPerCategory).slice(0, 3);

  if (!picks.length) return null;

  return (
    <>
      <div className="tai-row tai-between tai-mt20">
        <div className="tai-row tai-gap8">
          <Compass size={16} color="var(--primary)" />
          <div className="tai-title-sm">Explore a new category</div>
        </div>
        {onSeeAll && <span className="tai-link" onClick={onSeeAll}>See all</span>}
      </div>
      <div className="tai-col tai-gap10 tai-mt10">
        {picks.map((c) => (
          <CourseCard key={c.id} course={c} onClick={() => onOpenCourse && onOpenCourse(c.id)} />
        ))}
      </div>
    </>
  );
}
