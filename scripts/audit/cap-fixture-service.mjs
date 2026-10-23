const options = [
  { id: "o1", track: "Code", skill: "Frontend development", is_active: true },
  { id: "o2", track: "Code", skill: "Backend development", is_active: true },
];
let state;
function persist() {
  sessionStorage.setItem("cap_fixture_state", JSON.stringify(state));
}
function snapshot() {
  if (!state)
    state = JSON.parse(sessionStorage.getItem("cap_fixture_state") || "null");
  if (!state)
    state = {
      cohort: { name: "CAP Cohort 3" },
      teams: [],
      checkins: [],
      intentions: [],
      skillOptions: options,
      members: [
        { user_id: "learner", name: "Saved Learner", cohort_role: "learner" },
        {
          user_id: "mentor",
          name: "Assigned Instructor",
          cohort_role: "instructor",
        },
      ],
    };
  return structuredClone({
    ...state,
    members: state.members.map(m=>({...m,profile_goal:m.user_id==="learner" ? state.globalGoal : null})),
    canManage: mode() === "admin",
    isAdmin: mode() === "admin",
  });
}
function mode() {
  return new URLSearchParams(location.search).get("cap_role");
}
function check() {
  if (globalThis.__capFailSave)
    throw Error("Saved record could not be updated");
}
export async function fetchCapWorkspace() {
  if (globalThis.__capFailLoad) throw Error("CAP load failed");
  return snapshot();
}
export async function fetchCapTeams() {
  return snapshot().teams;
}
export async function canManageCapCohort() {
  return mode() === "admin";
}
export async function saveCapLearningGoal(cohortId, track, specific_skill) {
  check();
  snapshot();
  state.intentions = [
    {
      user_id: "learner",
      track,
      specific_skill,
      review_status: "Not submitted",
    },
  ];
  persist();
}
export async function saveCapProblem(
  cohortId,
  problem_title,
  problem_statement,
) {
  check();
  snapshot();
  state.intentions = [
    {
      ...state.intentions[0],
      user_id: "learner",
      problem_title,
      problem_statement,
      review_status: "Submitted",
    },
  ];
  persist();
}
export async function reviewCapProblem(
  cohortId,
  userId,
  review_status,
  review_feedback,
) {
  check();
  state.intentions[0] = {
    ...state.intentions[0],
    review_status,
    review_feedback,
  };
  persist();
}
export async function saveCapSkillOption(
  cohortId,
  track,
  skill,
  is_active = true,
) {
  check();
  const o = state.skillOptions.find(
    (o) => o.track === track && o.skill === skill,
  );
  if (o) o.is_active = is_active;
  else
    state.skillOptions.push({ id: "o" + Date.now(), track, skill, is_active });
  persist();
}
export async function saveCapTeam(team) {
  check();
  snapshot();
  if (team.id) {
    state.teams = state.teams.map((t) =>
      t.id === team.id ? { ...t, ...team } : t,
    );
  } else
    state.teams.push({
      ...team,
      id: "saved-team",
      phase: "LEARN",
      demo_day_status: "Draft",
      final_score: null,
      members:
        mode() === "admin"
          ? []
          : [{ user_id: "learner", name: "Saved Learner", role: team.role }],
    });
  persist();
}
export async function joinCapTeam({ teamId, userId, role }) {
  check();
  state.teams[0].members.push({ user_id: userId, name: "Saved Learner", role });
  persist();
}
export async function removeCapTeamMember(teamId, userId) {
  check();
  state.teams[0].members = state.teams[0].members.filter(
    (m) => m.user_id !== userId,
  );
  persist();
}
export async function saveCapCheckin(teamId, v) {
  check();
  state.checkins.push({
    id: "saved-checkin",
    team_name: state.teams[0].name,
    mentor_name: "Actual admin",
    checkin_date: v.date,
    notes: v.notes,
    progress_rating: v.rating,
    is_private_admin: v.private,
  });
  persist();
}
export async function updateDemoDayReview() {}
export async function fetchMemberLearningInterests() {
  return [];
}

export async function fetchMyLearningGoal(){snapshot();return state.globalGoal || null;}
export async function saveMyLearningGoal(track,skill){check();snapshot();state.globalGoal={track,skill,updatedAt:new Date().toISOString()};persist();return state.globalGoal;}
