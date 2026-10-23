import { supabase } from "../supabaseClient.js";

async function rpc(name, args) {
  if (!supabase)
    throw new Error("Connect to your workspace to save CAP records.");
  const { data, error } = await supabase.rpc(name, args);
  if (error)
    throw new Error(error.message || "The CAP request failed. Please retry.", {
      cause: error,
    });
  return data;
}
export async function fetchCapWorkspace(cohortId) {
  if (!supabase)
    return {
      teams: [],
      checkins: [],
      intentions: [],
      members: [],
      skillOptions: [],
      canManage: false,
      isAdmin: false,
    };
  if (!cohortId) throw new Error("Select an enrolled cohort.");
  const data = await rpc("get_cap_workspace", { p_cohort_id: cohortId });
  if (
    !data ||
    !["teams", "checkins", "intentions", "members", "skillOptions"].every(
      (key) => Array.isArray(data[key]),
    )
  )
    throw new Error("The CAP workspace could not be loaded. Please retry.");
  return data;
}
export async function fetchCapTeams(cohortId) {
  return (await fetchCapWorkspace(cohortId)).teams || [];
}
export async function canManageCapCohort(cohortId) {
  if (!supabase || !cohortId) return false;
  return (
    (await rpc("can_manage_cap_cohort", { p_cohort_id: cohortId })) === true
  );
}
export async function saveCapTeam(team) {
  const data = team.id
    ? await rpc("update_cap_team", {
        p_team_id: team.id,
        p_patch: Object.fromEntries(
          Object.entries(team).filter(([k]) =>
            [
              "name",
              "project_title",
              "problem_statement",
              "technologies",
              "github_url",
              "demo_url",
              "presentation_url",
              "demo_video_url",
              "screenshot_url",
              "mentor_id",
              "phase",
              "demo_day_status",
              "final_score",
              "judges_feedback",
              "mentor_feedback",
              "is_archived",
            ].includes(k),
          ),
        ),
      })
    : await rpc("register_my_cap_team", {
        p_cohort_id: team.cohort_id,
        p_name: team.name,
        p_project_title: team.project_title,
        p_problem_statement: team.problem_statement || "",
        p_technologies: team.technologies || [],
        p_role: team.role || "Team member",
      });
  return { success: true, data };
}
export async function joinCapTeam({ teamId, userId, role }) {
  await rpc("set_cap_team_member", {
    p_team_id: teamId,
    p_user_id: userId,
    p_role: role,
    p_remove: false,
  });
  return { success: true };
}
export async function removeCapTeamMember(teamId, userId) {
  return rpc("set_cap_team_member", {
    p_team_id: teamId,
    p_user_id: userId,
    p_role: "Team member",
    p_remove: true,
  });
}
export async function updateDemoDayReview(
  teamId,
  { demoDayStatus, finalScore, judgesFeedback, mentorFeedback },
) {
  return saveCapTeam({
    id: teamId,
    demo_day_status: demoDayStatus,
    final_score: finalScore,
    judges_feedback: judgesFeedback,
    mentor_feedback: mentorFeedback,
  });
}
export async function saveCapLearningGoal(cohortId, track, skill) {
  return rpc("save_my_cap_learning_goal", {
    p_cohort_id: cohortId,
    p_track: track,
    p_skill: skill,
  });
}
export async function saveCapProblem(cohortId, title, statement) {
  return rpc("save_my_cap_problem", {
    p_cohort_id: cohortId,
    p_title: title,
    p_statement: statement,
  });
}
export async function reviewCapProblem(cohortId, userId, status, feedback) {
  return rpc("review_cap_problem", {
    p_cohort_id: cohortId,
    p_user_id: userId,
    p_status: status,
    p_feedback: feedback,
  });
}
export async function saveCapSkillOption(
  cohortId,
  track,
  skill,
  active = true,
) {
  return rpc("save_cap_skill_option", {
    p_cohort_id: cohortId,
    p_track: track,
    p_skill: skill,
    p_active: active,
  });
}
export async function saveCapCheckin(teamId, values) {
  return rpc("save_cap_checkin", {
    p_team_id: teamId,
    p_checkin_date: values.date,
    p_notes: values.notes,
    p_rating: Number(values.rating),
    p_blockers: values.blockers || "",
    p_actions: values.actions || "",
    p_next_date: values.nextDate || null,
    p_private: !!values.private,
  });
}
export async function fetchMemberLearningInterests(
  orgId,
  userId,
  cohortId = null,
) {
  return rpc("get_member_learning_interests", {
    p_org_id: orgId,
    p_user_id: userId,
    p_cohort_id: cohortId,
  });
}

export async function fetchMyLearningGoal() { return supabase ? rpc("get_my_learning_goal") : null; }
export async function saveMyLearningGoal(track,skill) { return rpc("save_my_learning_goal",{p_track:track,p_skill:skill}); }
