import assert from "node:assert/strict";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
const { PGlite } = process.env.PGLITE_MODULE
  ? await import(pathToFileURL(process.env.PGLITE_MODULE).href)
  : await import("@electric-sql/pglite");
const db = new PGlite();
const org = "10000000-0000-4000-8000-000000000001";
const cohort = "20000000-0000-4000-8000-000000000001";
const second = "20000000-0000-4000-8000-000000000002";
const learner = "30000000-0000-4000-8000-000000000001";
const unassigned = "30000000-0000-4000-8000-000000000002";
const suspended = "30000000-0000-4000-8000-000000000003";
const admin = "30000000-0000-4000-8000-000000000004";
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
    create table organizations(id uuid primary key); insert into organizations values('${org}');
    create table cohorts(id uuid primary key, organization_id uuid,name text);
    create table cohort_members(id uuid default gen_random_uuid(),cohort_id uuid,user_id uuid,cohort_role text,added_at timestamptz default now());
    create table organization_members(organization_id uuid,user_id uuid,status text,role text);
    create table user_roles(user_id uuid,role text);
    create table user_personalization(user_id uuid primary key,data jsonb,updated_at timestamptz default now());
    create table user_profiles(id uuid primary key, display_name text,avatar_url text,role text,email text);
    insert into cohorts values('${cohort}','${org}','CAP Cohort 3'),('${second}','${org}','FLIP');
    insert into organization_members values('${org}','${learner}','active','member'),('${org}','${unassigned}','active','member'),('${org}','${suspended}','suspended','member'),('${org}','${admin}','active','admin');
    insert into cohort_members(cohort_id,user_id,cohort_role) values('${cohort}','${learner}','learner'),('${second}','${learner}','instructor'),('${cohort}','${suspended}','learner');
    insert into user_profiles values('${learner}','Assigned Learner',null,'mentor','private@example.invalid');`);
  const helpers = fs.readFileSync(
    "supabase/migrations/202610200006_instructor_assignment_and_member_tracking.sql",
    "utf8",
  );
  for (const name of [
    "can_administer_organization",
    "can_read_cohort_workspace",
    "is_assigned_cohort_instructor",
  ]) {
    const fn = helpers.match(
      new RegExp(
        "create or replace function public\\." + name + "\\([\\s\\S]*?\\$\\$;",
        "i",
      ),
    )?.[0];
    assert.ok(fn, name);
    await db.exec(fn);
  }
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/202610230001_cohort_assignment_read_models.sql",
      "utf8",
    ),
  );
  const actor = async (id) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("set role authenticated");
  };
  await db.exec(
    `insert into user_profiles(id,display_name,role) values('${admin}','Administrator','admin'),('${suspended}','Suspended','learner'),('${unassigned}','Unassigned','learner');`,
  );
  const mentor = "30000000-0000-4000-8000-000000000005";
  const foreignAdmin = "30000000-0000-4000-8000-000000000006";
  const otherOrg = "10000000-0000-4000-8000-000000000002";
  await db.exec(
    `insert into organizations values ('${otherOrg}');insert into user_profiles(id,display_name,role) values('${mentor}','Assigned Mentor','mentor'),('${foreignAdmin}','Other Admin','admin');insert into organization_members values('${org}','${mentor}','active','member'),('${otherOrg}','${foreignAdmin}','active','admin');insert into cohort_members(cohort_id,user_id,cohort_role) values('${cohort}','${mentor}','instructor');insert into user_roles values('${mentor}','mentor');`,
  );
  await db.exec(
    `insert into user_personalization values ('${learner}','{"learningTracks":["Software Engineering (Full Stack, Frontend, Backend)"],"goalDescription":"Private irrelevant field"}');`,
  );
  const migration = fs.readFileSync(
    "supabase/migrations/202610230002_cap_workspace_and_specific_skills.sql",
    "utf8",
  );
  await db.exec(migration);
  await db.exec(migration);
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/202610230003_profile_learning_goal.sql",
      "utf8",
    ),
  );
  await actor(learner);
  const call = async (name, args = []) =>
    (
      await db.query(
        "select to_jsonb(" +
          name +
          "(" +
          args.map((_, i) => "$" + (i + 1)).join(",") +
          ")) as data",
        args,
      )
    ).rows[0].data;
  let workspace = await call("get_cap_workspace", [cohort]);
  assert.equal(workspace.canManage, false);
  assert.equal(workspace.teams.length, 0);
  await call("save_my_cap_learning_goal", [
    cohort,
    "Code",
    "Frontend development",
  ]);
  await call("save_my_cap_problem", [
    cohort,
    "Real problem",
    "Actual learner problem statement",
  ]);
  assert.equal(
    (await call("get_cap_workspace", [cohort])).intentions[0].review_status,
    "Submitted",
  );
  const team = await call("register_my_cap_team", [
    cohort,
    "Real team",
    "Real project",
    "Real problem",
    ["React"],
    "Frontend developer",
  ]);
  assert.equal(
    (await call("get_cap_workspace", [cohort])).teams[0].members[0].user_id,
    learner,
  );
  await assert.rejects(
    call("update_cap_team", [team.id, { final_score: 100 }]),
    /Only assigned staff/,
  );
  await assert.rejects(
    call("update_cap_team", [team.id, { phase: "LAUNCH" }]),
    /Only assigned staff/,
  );
  await assert.rejects(
    call("update_cap_team", [team.id, { demo_url: "javascript:alert(1)" }]),
    /http or https/,
  );
  await call("update_cap_team", [
    team.id,
    { demo_url: "https://example.invalid/demo" },
  ]);
  await assert.rejects(
    call("review_cap_problem", [cohort, learner, "Reviewed", "Not allowed"]),
    /Assigned staff/,
  );
  await assert.rejects(
    db.query("update cap_teams set final_score=100 where id=$1", [team.id]),
    /permission denied/,
  );
  await actor(admin);
  workspace = await call("get_cap_workspace", [cohort]);
  assert.equal(workspace.canManage, true);
  assert.equal(workspace.isAdmin, true);
  const goals = await call("get_member_learning_interests", [
    org,
    learner,
    null,
  ]);
  assert.equal(goals[0].track, "Code");
  assert.equal(goals[0].specificSkill, "Frontend development");
  assert.equal(goals[1].kind, "registration");
  assert.ok(!JSON.stringify(goals).includes("Private irrelevant field"));
  assert.equal(
    workspace.members.find((m) => m.user_id === learner).registration_tracks[0],
    "Software Engineering (Full Stack, Frontend, Backend)",
  );
  await call("update_cap_team", [
    team.id,
    {
      phase: "LAUNCH",
      final_score: 100,
      demo_day_status: "Featured",
      judges_feedback: "Actual review",
    },
  ]);
  await call("review_cap_problem", [
    cohort,
    learner,
    "Reviewed",
    "Actual staff feedback",
  ]);
  await call("save_cap_checkin", [
    team.id,
    "2026-10-23",
    "Private actual note",
    4,
    "Blocker",
    "Next action",
    null,
    true,
  ]);
  await assert.rejects(
    call("set_cap_team_member", [team.id, unassigned, "Developer", false]),
    /active members/,
  );
  await call("save_cap_skill_option", [
    cohort,
    "Code",
    "Frontend development",
    false,
  ]);
  await actor(learner);
  await assert.rejects(
    call("save_my_cap_learning_goal", [cohort, "Code", "Frontend development"]),
    /available track/,
  );
  workspace = await call("get_cap_workspace", [cohort]);
  assert.equal(workspace.checkins.length, 0);
  assert.equal(workspace.teams[0].final_score, 100);
  assert.equal(workspace.intentions[0].specific_skill, "Frontend development");
  await call("save_my_cap_problem", [
    cohort,
    "Updated",
    "Updated learner problem",
  ]);
  assert.equal(
    (await call("get_cap_workspace", [cohort])).intentions[0].review_status,
    "Submitted",
  );
  await actor(mentor);
  assert.equal((await call("get_cap_workspace", [cohort])).canManage, true);
  assert.equal(
    (await call("get_member_learning_interests", [org, learner, cohort]))[0]
      .specificSkill,
    "Frontend development",
  );
  await assert.rejects(
    call("save_cap_checkin", [
      team.id,
      "2026-10-23",
      "Private note",
      4,
      "",
      "",
      null,
      true,
    ]),
    /Only organization admins/,
  );
  await assert.rejects(
    call("save_cap_skill_option", [cohort, "Code", "Unexpected skill", true]),
    /admin access/,
  );
  await call("save_cap_checkin", [
    team.id,
    "2026-10-23",
    "Public mentor note",
    4,
    "",
    "",
    null,
    false,
  ]);
  await actor(foreignAdmin);
  await assert.rejects(call("get_cap_workspace", [cohort]), /Cohort access/);
  await assert.rejects(
    call("update_cap_team", [team.id, { final_score: 100 }]),
    /Team access/,
  );
  await actor(learner);
  await call("save_my_learning_goal", ["Code", "Frontend development"]);
  assert.equal(
    (await call("get_my_learning_goal")).skill,
    "Frontend development",
  );
  await actor(admin);
  const allGoals = await call("get_member_learning_interests", [
    org,
    learner,
    null,
  ]);
  assert.equal(
    allGoals.find((g) => g.cohort === "Profile learning goal").specificSkill,
    "Frontend development",
  );
  await db.exec("reset role");
  assert.equal(
    (
      await db.query("select data from user_personalization where user_id=$1", [
        learner,
      ])
    ).rows[0].data.goalDescription,
    "Private irrelevant field",
  );
  await actor(unassigned);
  await assert.rejects(call("get_cap_workspace", [cohort]), /Cohort access/);
  await assert.rejects(
    call("get_member_learning_interests", [org, learner, null]),
    /admin access/,
  );
  await actor(suspended);
  await assert.rejects(call("get_cap_workspace", [cohort]), /Cohort access/);
  await db.exec("reset role; set role anon");
  await assert.rejects(
    call("get_cap_workspace", [cohort]),
    /permission denied/,
  );
  console.log(
    "PASS: CAP persistence, exact learning goals, reviews, 100-point scores, private check-ins and scoped admin controls",
  );
} finally {
  await db.close();
}
