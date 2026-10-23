import { fetchCapWorkspace, saveCapCheckin } from "./capProgram.js";
export async function fetchMentorshipCheckins({
  teamId,
  mentorId,
  cohortId,
  includePrivate = false,
} = {}) {
  if (!cohortId) throw new Error("Select a cohort to view check-ins.");
  const data = (await fetchCapWorkspace(cohortId)).checkins || [];
  return data.filter(
    (c) =>
      (!teamId || c.team_id === teamId) &&
      (!mentorId || c.mentor_id === mentorId) &&
      (includePrivate || !c.is_private_admin),
  );
}
export async function createMentorCheckin(values) {
  const data = await saveCapCheckin(values.teamId, {
    date: values.checkinDate,
    notes: values.notes,
    rating: values.progressRating,
    blockers: values.issuesBlockers,
    actions: values.recommendedActions,
    nextDate: values.nextCheckinDate,
    private: values.isPrivateAdmin,
  });
  return { success: true, data };
}
