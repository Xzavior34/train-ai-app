import { supabase } from "../../supabaseClient.js";

/**
 * All of a learner's course notes in one round trip.
 *
 * Why this exists: `fetchCourseNotes(userId, courseId)` in lib/api/learner.js
 * is per-course, but the Bookmarks screen's "Study Notes" tab is a library
 * view across every course a learner has ever written a note in - it has no
 * single course id to key off. Previously that tab rendered a hardcoded note,
 * so nothing read course_notes from this screen at all.
 *
 * Selects `*` and resolves course titles separately rather than embedding
 * `courses(title)`, so it does not depend on a declared FK being present for
 * PostgREST to auto-embed.
 */
export async function fetchAllMyCourseNotes(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("course_notes")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) {
    console.warn("Could not fetch course notes:", error);
    return [];
  }
  return data || [];
}

/**
 * All of a learner's lesson notes in one round trip, with lesson titles.
 *
 * Same reason as fetchAllMyCourseNotes: `fetchLessonNotes(userId, lessonId)`
 * needs a lesson id, but the Bookmarks screen's "Study Notes" tab is a
 * cross-course library with no single lesson to key off, so lesson_notes was
 * never read there at all.
 *
 * Ordered by timestamp_seconds because that is the only ordering column
 * fetchLessonNotes uses and therefore the only one confirmed to exist on this
 * table. Lesson titles/course ids are resolved with a second query rather
 * than a PostgREST embed, so this does not depend on a declared FK.
 */
export async function fetchAllMyLessonNotes(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("lesson_notes")
    .select("*")
    .eq("user_id", userId)
    .order("timestamp_seconds", { ascending: true });
  if (error) {
    console.warn("Could not fetch lesson notes:", error);
    return [];
  }
  const rows = data || [];
  const lessonIds = [...new Set(rows.map((r) => r.lesson_id).filter(Boolean))];
  if (lessonIds.length === 0) return rows;
  const { data: lessons, error: lessonError } = await supabase
    .from("lessons")
    .select("id, title, course_id")
    .in("id", lessonIds);
  if (lessonError) {
    console.warn("Could not resolve lesson titles for notes:", lessonError);
    return rows;
  }
  const byId = new Map((lessons || []).map((l) => [l.id, l]));
  return rows.map((r) => ({
    ...r,
    lesson_title: byId.get(r.lesson_id)?.title || null,
    course_id: byId.get(r.lesson_id)?.course_id || null,
  }));
}

/**
 * Deletes one of the learner's own notes.
 *
 * The Bookmarks screen offered a "remove note" button that only filtered a
 * local useState array, so the note reappeared on the next render pass. There
 * was no delete in lib/api/learner.js for either notes table (only fetch and
 * insert), so these are the writes that make that button real. Scoped by
 * user_id as well as id so a note id belonging to somebody else cannot be
 * removed even where RLS is not enforced on these tables.
 */
export async function deleteCourseNote(noteId, userId) {
  if (!supabase || !noteId || !userId) return;
  const { error } = await supabase.from("course_notes").delete().eq("id", noteId).eq("user_id", userId);
  if (error) throw error;
}

export async function deleteLessonNote(noteId, userId) {
  if (!supabase || !noteId || !userId) return;
  const { error } = await supabase.from("lesson_notes").delete().eq("id", noteId).eq("user_id", userId);
  if (error) throw error;
}
