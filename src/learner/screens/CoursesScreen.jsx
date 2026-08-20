import React from "react";
import { TopBar, CourseCard } from "../components/LearnerUI.jsx";
import { Search } from "lucide-react";

// Backlog item: "Learner Progress Revamp" - previously the only place a
// learner's progress showed at all was Home's single "active course" card
// (HomeScreen.jsx picks exactly one in-progress course and shows nothing
// else - deliberately, to keep Home uncluttered, but that left every other
// assigned course invisible). "My enrolled" here used to just filter the
// catalog to `enrolled` courses with no status grouping - same flat list,
// same problem, just without the search chrome. Fixed: My Courses now
// groups every assigned course by status (in progress, not started,
// completed) so the full learning history is visible in one place, not
// just the single most recent course.
function groupByStatus(enrolledCourses) {
  const inProgress = [];
  const notStarted = [];
  const completed = [];
  for (const c of enrolledCourses) {
    const p = c.progress ?? 0;
    if (p >= 100) completed.push(c);
    else if (p > 0) inProgress.push(c);
    else notStarted.push(c);
  }
  return { inProgress, notStarted, completed };
}

function CourseGroup({ label, items, push, onToggleBookmark }) {
  if (items.length === 0) return null;
  return (
    <div className="tai-mt16">
      <div className="tai-row tai-between" style={{ marginBottom: 8 }}>
        <div className="tai-title-sm">{label}</div>
        <span style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>{items.length}</span>
      </div>
      <div className="tai-col tai-gap12">
        {items.map((c) => (
          <CourseCard key={c.id} course={c} onClick={() => push("courseDetail", { id: c.id })} onToggleBookmark={onToggleBookmark} />
        ))}
      </div>
    </div>
  );
}

export function CoursesScreen({
  courses, coursesLoading, courseSearch, setCourseSearch,
  courseLevelFilter, setCourseLevelFilter, courseSourceTab, setCourseSourceTab,
  showMyCoursesOnly, setShowMyCoursesOnly, push, handleEnroll, handleRequestJoin,
  onToggleBookmark
}) {
  function handleCardAction(courseId) {
    const course = courses.find(c => c.id === courseId);
    if (course?.requiresApproval) return handleRequestJoin && handleRequestJoin(courseId);
    return handleEnroll(courseId);
  }

  // "My Courses" mode: every assigned course, grouped by status, no catalog
  // search/filter chrome - this is the learner's complete learning history,
  // not a filtered browse view.
  if (showMyCoursesOnly) {
    const enrolledCourses = courses.filter((c) => c.enrolled);
    const { inProgress, notStarted, completed } = groupByStatus(enrolledCourses);
    return (
      <div className="tai-fade-in">
        <TopBar title="My Courses" sub="Every course assigned to you, and where you left off" />
        <div className="tai-row tai-between tai-mt14" style={{ fontSize: 12.5, color: "var(--text-2)" }}>
          <span>{enrolledCourses.length} course{enrolledCourses.length === 1 ? "" : "s"} total</span>
          <span className="tai-link" onClick={() => setShowMyCoursesOnly(false)} style={{ fontSize: 12.5 }}>
            Browse catalog
          </span>
        </div>

        {coursesLoading && <div className="tai-empty">Loading your courses...</div>}
        {!coursesLoading && enrolledCourses.length === 0 && (
          <div className="tai-empty">
            No courses assigned yet. Browse the catalog to enroll in your first one.
          </div>
        )}

        <CourseGroup label="Continue learning" items={inProgress} push={push} onToggleBookmark={onToggleBookmark} />
        <CourseGroup label="Not started yet" items={notStarted} push={push} onToggleBookmark={onToggleBookmark} />
        <CourseGroup label="Completed" items={completed} push={push} onToggleBookmark={onToggleBookmark} />
      </div>
    );
  }

  const filteredCourses = courses.filter((c) => {
    if (courseSearch.trim()) {
      const q = courseSearch.toLowerCase();
      const matchTitle = c.title.toLowerCase().includes(q);
      const matchCat = c.category.toLowerCase().includes(q);
      if (!matchTitle && !matchCat) return false;
    }
    if (courseLevelFilter !== "all" && c.level !== courseLevelFilter) return false;
    if (courseSourceTab !== "all" && courseSourceTab !== "assigned" && c.source !== courseSourceTab) return false;
    if (courseSourceTab === "assigned" && !c.enrolled) return false;
    return true;
  }).sort((a, b) => {
    // Course UI brief: "Bookmarked courses appear first." Stable otherwise
    // - only bookmark status affects order, nothing is re-sorted within
    // each group.
    if (!!a.isBookmarked === !!b.isBookmarked) return 0;
    return a.isBookmarked ? -1 : 1;
  });

  // Course brief: "External Courses... Recommend only around 3-5 carefully
  // selected external courses based on learner needs... No marketplace
  // experience." An unbounded external catalog is exactly the marketplace
  // experience this is meant to avoid - capped here rather than only in
  // whatever content an admin happens to upload, since nothing else in the
  // pipeline enforces this.
  const EXTERNAL_COURSE_LIMIT = 5;
  const visibleCourses = courseSourceTab === "external"
    ? filteredCourses.slice(0, EXTERNAL_COURSE_LIMIT)
    : filteredCourses;

  return (
    <div className="tai-fade-in">
      <TopBar title="Course Catalog" sub="Explore your assigned and available courses" />

      <div className="tai-row tai-gap10 tai-mt16">
        <div className="tai-row" style={{ flex: 1, position: "relative" }}>
          <Search size={16} color="var(--text-3)" style={{ position: "absolute", left: 12 }} />
          <input
            className="tai-input"
            style={{ paddingLeft: 36 }}
            placeholder="Search courses..."
            value={courseSearch}
            onChange={(e) => setCourseSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="tai-scrollx tai-mt12">
        {["all", "assigned", "internal", "external"].map((src) => (
          <div
            key={src}
            className={`tai-pill ${courseSourceTab === src ? "tai-pill-active" : "tai-pill-inactive"}`}
            onClick={() => setCourseSourceTab(src)}
            style={{ textTransform: "capitalize" }}
          >
            {src === "all" ? "All Courses" : src === "internal" ? "Internal" : src === "external" ? "External Partners" : "Assigned to Me"}
          </div>
        ))}
      </div>

      <div className="tai-mt8">
        <select
          className="tai-input"
          value={courseLevelFilter}
          onChange={(e) => setCourseLevelFilter(e.target.value)}
          style={{ textTransform: "capitalize" }}
        >
          {["all", "beginner", "intermediate", "advanced"].map((lvl) => (
            <option key={lvl} value={lvl} style={{ textTransform: "capitalize" }}>
              {lvl === "all" ? "All Levels" : lvl.charAt(0).toUpperCase() + lvl.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="tai-row tai-between tai-mt14" style={{ fontSize: 12.5, color: "var(--text-2)" }}>
        <span>
          Showing {visibleCourses.length} course{visibleCourses.length === 1 ? "" : "s"}
          {courseSourceTab === "external" && filteredCourses.length > EXTERNAL_COURSE_LIMIT ? " (curated selection)" : ""}
        </span>
        <span
          className="tai-link"
          onClick={() => setShowMyCoursesOnly(true)}
          style={{ fontSize: 12.5 }}
        >
          My courses
        </span>
      </div>

      {coursesLoading && <div className="tai-empty">Loading catalog...</div>}
      {!coursesLoading && visibleCourses.length === 0 && (
        <div className="tai-empty">No courses found matching criteria.</div>
      )}

      <div className="tai-col tai-gap12 tai-mt10">
        {visibleCourses.map((c) => (
          <CourseCard
            key={c.id}
            course={c}
            onClick={() => push("courseDetail", { id: c.id })}
            onEnroll={handleCardAction}
            onToggleBookmark={onToggleBookmark}
          />
        ))}
      </div>
    </div>
  );
}
