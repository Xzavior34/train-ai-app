import { supabase } from "../../supabaseClient.js";
import { fetchProfilesByUserIds } from "../schemaHelper.js";

/**
 * Batched reads the learner catalog/lesson screens needed and nothing else
 * supplied.
 *
 * Why a new file: CoursesScreen and LessonScreen were showing an instructor
 * name, avatar, rating, review count and student count that came from a
 * hardcoded sample array indexed by list position - every real course
 * inherited a stranger's headshot and a 4.9/1,840-review reputation. The
 * values themselves are all in the database (courses.instructor_id ->
 * user_profiles, course_reviews, course_enrollments), but the shapes the
 * learner hook hands to the screens drop instructor_id, and there was no
 * batched enrollment-count read at all (fetchCourseEnrolledLearners in
 * lib/api/platform.js is one course per call). These fill exactly those
 * gaps; existing api modules are owned elsewhere and left untouched.
 *
 * Every function returns an empty map with no database configured, so the
 * callers fall through to their own DEMO_MODE branches rather than getting
 * invented numbers from here.
 */

/**
 * courses.instructor_id -> the instructor's real profile, keyed by course id.
 * A course with no instructor_id, or an instructor with no profile row, is
 * simply absent from the map: callers must render nothing rather than
 * substituting a name.
 */
export async function fetchCourseInstructors(courseIds) {
  if (!supabase) return {};
  const ids = [...new Set((courseIds || []).filter(Boolean))];
  if (!ids.length) return {};

  const { data, error } = await supabase
    .from("courses")
    .select("id, instructor_id")
    .in("id", ids);
  if (error) {
    console.warn("Course instructors fetch warning:", error);
    return {};
  }

  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.instructor_id));
  const byCourse = {};
  for (const row of rows) {
    const profile = row.instructor_id ? profiles[row.instructor_id] : null;
    if (!profile) continue;
    byCourse[row.id] = {
      userId: row.instructor_id,
      name: profile.display_name || null,
      avatarUrl: profile.avatar_url || null,
    };
  }
  return byCourse;
}

/** Convenience single-course form of fetchCourseInstructors, for LessonScreen. */
export async function fetchCourseInstructor(courseId) {
  if (!courseId) return null;
  const map = await fetchCourseInstructors([courseId]);
  return map[courseId] || null;
}

/**
 * Real enrolled-learner counts per course, keyed by course id. Counted
 * client-side from the returned course_id column - the same approach
 * lib/api/platform.js already uses for its per-course enrollment rollups -
 * so one request covers the whole catalog page instead of one per card.
 * A course with no enrollments is absent from the map, which the callers
 * read as a truthful zero.
 */
export async function fetchCourseEnrollmentCounts(courseIds) {
  if (!supabase) return {};
  const ids = [...new Set((courseIds || []).filter(Boolean))];
  if (!ids.length) return {};

  const { data, error } = await supabase
    .from("course_enrollments")
    .select("course_id")
    .in("course_id", ids);
  if (error) {
    console.warn("Course enrollment counts fetch warning:", error);
    return {};
  }

  const counts = {};
  for (const row of data || []) {
    counts[row.course_id] = (counts[row.course_id] || 0) + 1;
  }
  return counts;
}
