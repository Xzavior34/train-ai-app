import { supabase } from "../../supabaseClient.js";

/**
 * Live queries for the instructor (mentor) dashboard.
 *
 * These exist because nothing in lib/api/ batched the per-course reads the
 * instructor Overview needs: the existing helpers
 * (fetchAssessmentAttemptsForCourse / fetchCertificateRequestsForCourse in
 * platform.js) are single-course reads used by the admin ContentScreen, and
 * the dashboard needs one number across every course this instructor owns.
 */

/**
 * Real "Pending Reviews" for an instructor, replacing a hardcoded "05".
 *
 * Two real sources, both scoped to the courses whose `instructor_id` is this
 * user (courses.instructor_id references user_profiles(id), see
 * 0001_init_schema.sql):
 *  - assessment_attempts with no score yet, i.e. attempts a human still has
 *    to grade. Attempts scored by check_assessment_answers already carry a
 *    score, so this is genuinely only the ungraded ones - it is legitimately
 *    0 on a fully auto-graded course, and that zero is shown as-is.
 *  - certificates with status 'pending', the same definition ContentScreen's
 *    certificate review tab uses.
 *
 * There is no assignments/submissions table anywhere in the schema, so the
 * old caption's "3 assignments" has no source and is not reproduced here.
 */
export async function fetchInstructorPendingReviews(instructorUserId) {
  const empty = { ungradedAttempts: 0, pendingCertificates: 0, total: 0 };
  if (!supabase || !instructorUserId) return empty;

  const { data: courseRows, error: coursesError } = await supabase
    .from("courses")
    .select("id")
    .eq("instructor_id", instructorUserId);
  if (coursesError) { console.warn("Instructor courses fetch warning:", coursesError); return empty; }
  const courseIds = (courseRows || []).map((c) => c.id);
  if (!courseIds.length) return empty;

  // assessment_attempts has no course_id - it links to an assessment, which
  // links to the course - so the attempt query needs the assessment ids first.
  const { data: assessmentRows } = await supabase
    .from("assessments")
    .select("id")
    .in("course_id", courseIds);
  const assessmentIds = (assessmentRows || []).map((a) => a.id);

  const [attemptsResult, certsResult] = await Promise.all([
    assessmentIds.length
      ? supabase
          .from("assessment_attempts")
          .select("id", { count: "exact", head: true })
          .in("assessment_id", assessmentIds)
          .is("score", null)
      : Promise.resolve({ count: 0 }),
    supabase
      .from("certificates")
      .select("id", { count: "exact", head: true })
      .in("course_id", courseIds)
      .eq("status", "pending"),
  ]);

  const ungradedAttempts = attemptsResult?.count || 0;
  const pendingCertificates = certsResult?.count || 0;
  return { ungradedAttempts, pendingCertificates, total: ungradedAttempts + pendingCertificates };
}
