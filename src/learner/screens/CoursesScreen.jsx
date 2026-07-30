import React from "react";
import { TopBar, CourseCard } from "../components/LearnerUI.jsx";
import { Search, Map as MapIcon, ChevronRight } from "lucide-react";

export function CoursesScreen({
  courses, coursesLoading, courseSearch, setCourseSearch,
  courseLevelFilter, setCourseLevelFilter, courseSourceTab, setCourseSourceTab,
  showBookmarkedOnly, setShowBookmarkedOnly, push, handleEnroll, handleRequestJoin
}) {
  function handleCardAction(courseId) {
    const course = courses.find(c => c.id === courseId);
    if (course?.requiresApproval) return handleRequestJoin && handleRequestJoin(courseId);
    return handleEnroll(courseId);
  }
  const filteredCourses = courses.filter((c) => {
    if (courseSearch.trim()) {
      const q = courseSearch.toLowerCase();
      const matchTitle = c.title.toLowerCase().includes(q);
      const matchCat = c.category.toLowerCase().includes(q);
      if (!matchTitle && !matchCat) return false;
    }
    if (courseLevelFilter !== "all" && c.level !== courseLevelFilter) return false;
    if (courseSourceTab !== "all" && c.source !== courseSourceTab) return false;
    if (showBookmarkedOnly && !c.enrolled) return false;
    return true;
  });

  return (
    <div className="tai-fade-in">
      <TopBar title="Course Catalog" sub="Explore courses & structured paths" />

      <div
        className="tai-card tai-mt10"
        style={{ cursor: "pointer", background: "var(--grad)", color: "#fff", border: "none" }}
        onClick={() => push("paths")}
      >
        <div className="tai-row tai-between">
          <div className="tai-row tai-gap12">
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MapIcon size={22} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Learning Paths</div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>Guided multi-course career tracks</div>
            </div>
          </div>
          <ChevronRight size={20} />
        </div>
      </div>

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
        {["all", "internal", "external"].map((src) => (
          <div
            key={src}
            className={`tai-pill ${courseSourceTab === src ? "tai-pill-active" : "tai-pill-inactive"}`}
            onClick={() => setCourseSourceTab(src)}
            style={{ textTransform: "capitalize" }}
          >
            {src === "all" ? "All Courses" : src === "internal" ? "Internal" : "External Partners"}
          </div>
        ))}
      </div>

      <div className="tai-scrollx tai-mt8">
        {["all", "beginner", "intermediate", "advanced"].map((lvl) => (
          <div
            key={lvl}
            className={`tai-pill ${courseLevelFilter === lvl ? "tai-pill-active" : "tai-pill-inactive"}`}
            onClick={() => setCourseLevelFilter(lvl)}
            style={{ textTransform: "capitalize" }}
          >
            {lvl === "all" ? "All Levels" : lvl}
          </div>
        ))}
      </div>

      <div className="tai-row tai-between tai-mt14" style={{ fontSize: 12.5, color: "var(--text-2)" }}>
        <span>Showing {filteredCourses.length} courses</span>
        <span
          className="tai-link"
          onClick={() => setShowBookmarkedOnly((v) => !v)}
          style={{ fontSize: 12.5 }}
        >
          {showBookmarkedOnly ? "Show all" : "My enrolled"}
        </span>
      </div>

      {coursesLoading && <div className="tai-empty">Loading catalog...</div>}
      {!coursesLoading && filteredCourses.length === 0 && (
        <div className="tai-empty">No courses found matching criteria.</div>
      )}

      <div className="tai-col tai-gap12 tai-mt10">
        {filteredCourses.map((c) => (
          <CourseCard
            key={c.id}
            course={c}
            onClick={() => push("courseDetail", { id: c.id })}
            onEnroll={handleCardAction}
          />
        ))}
      </div>
    </div>
  );
}
