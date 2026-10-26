import { supabase } from "../supabaseClient.js";
function connected() {
  if (!supabase)
    throw new Error("Course discovery requires a connected admin workspace.");
  return supabase;
}
async function invoke(body) {
  const { data, error } = await connected().functions.invoke(
    "youtube-course-discovery",
    { body },
  );
  if (error) {
    let detail;
    try {
      detail = await error.context?.json();
    } catch {}
    throw new Error(
      detail?.error ||
        "Could not reach course discovery. Please retry or ask the platform owner to check the connection.",
    );
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const discoveryStatus = (organizationId) =>
  invoke({ action: "status", organizationId });
export const searchYouTubeCourses = (organizationId, prompt, level) =>
  invoke({ action: "search", organizationId, prompt, level });
export async function listYouTubeSuggestions(organizationId) {
  const { data, error } = await connected()
    .from("youtube_course_suggestions")
    .select("*,youtube_course_searches(prompt)")
    .eq("organization_id", organizationId)
    .order("verified_at", { ascending: false })
    .order("rank")
    .limit(100);
  if (error) throw error;
  return data || [];
}
export async function reviewYouTubeSuggestion(organizationId, id, decision) {
  if (decision === "accept")
    return invoke({ action: "accept", organizationId, suggestionId: id });
  const { error } = await connected().rpc("review_youtube_course_suggestion", {
    p_id: id,
    p_decision: decision,
  });
  if (error) throw error;
}
export async function youTubeAssignmentTargets(organizationId) {
  const { data, error } = await connected().rpc(
    "get_youtube_course_assignment_targets",
    { p_org_id: organizationId },
  );
  if (error) throw error;
  return data;
}
export async function publishAssignYouTubeCourse(courseId, userIds, cohortId) {
  const { data, error } = await connected().rpc(
    "publish_assign_youtube_course",
    {
      p_course_id: courseId,
      p_user_ids: userIds,
      p_cohort_id: cohortId || null,
    },
  );
  if (error) throw error;
  return data;
}
