import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
const org = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002";
const admin = "20000000-0000-4000-8000-000000000001",
  learner = "20000000-0000-4000-8000-000000000002",
  foreign = "20000000-0000-4000-8000-000000000003",
  suspended = "20000000-0000-4000-8000-000000000004";
const cohort = "30000000-0000-4000-8000-000000000001";
try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
 create table organizations(id uuid primary key);insert into organizations values('${org}'),('${other}');
 create table user_profiles(id uuid primary key,display_name text);insert into user_profiles values('${admin}','Admin'),('${learner}','Learner'),('${foreign}','Other learner'),('${suspended}','Suspended');
 create table user_roles(user_id uuid,role text);create table organization_members(organization_id uuid,user_id uuid,role text,status text);
 insert into organization_members values('${org}','${admin}','admin','active'),('${org}','${learner}','member','active'),('${other}','${foreign}','member','active'),('${org}','${suspended}','member','suspended');
 create table cohorts(id uuid primary key,organization_id uuid,name text);insert into cohorts values('${cohort}','${org}','Training');
 create table cohort_members(cohort_id uuid,user_id uuid,cohort_role text);insert into cohort_members values('${cohort}','${learner}','learner'),('${cohort}','${suspended}','learner'),('${cohort}','${admin}','instructor');
 create table courses(id uuid primary key default gen_random_uuid(),organization_id uuid,instructor_id uuid,title text,description text,category text,level text,duration_hours numeric,price numeric,is_published boolean,is_approved boolean,course_source text,course_link text,cover_image_url text,archived_at timestamptz);
 create table lessons(id uuid default gen_random_uuid(),course_id uuid references courses(id),title text,description text,video_url text,duration_minutes int,order_index int,is_published boolean);
 create table course_enrollments(user_id uuid,course_id uuid,progress_percentage numeric default 0,unique(user_id,course_id));
 create table cohort_courses(cohort_id uuid,course_id uuid,unique(cohort_id,course_id));
 create table cohort_learner_courses(cohort_id uuid,user_id uuid,course_id uuid,assigned_by uuid);
 create table ai_credit_accounts(id uuid primary key default gen_random_uuid(),organization_id uuid,account_type text,owner_user_id uuid,balance int,lifetime_consumed int default 0,updated_at timestamptz default now());
 create table ai_credit_transactions(id uuid primary key default gen_random_uuid(),organization_id uuid,account_id uuid,user_id uuid,transaction_type text,amount int,balance_before int,balance_after int,reference_type text,reference_id text,metadata jsonb);
 insert into ai_credit_accounts(organization_id,account_type,balance) values('${org}','organization',50),('${other}','organization',100);`);
  const helper = fs
    .readFileSync(
      "supabase/migrations/202610200006_instructor_assignment_and_member_tracking.sql",
      "utf8",
    )
    .match(
      /create or replace function public.can_administer_organization\([\s\S]*?\$\$;/i,
    )[0];
  await db.exec(helper);
  const sql = fs.readFileSync(
    "supabase/migrations/202610260001_youtube_course_discovery.sql",
    "utf8",
  );
  await db.exec(sql);
  await db.exec(sql);
  const creditSql=fs.readFileSync('supabase/migrations/202610260002_admin_discovery_organization_credits.sql','utf8');
  await db.exec(creditSql);await db.exec(creditSql);
  const actor = async (id, role = "authenticated") => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("set role " + role);
  };
  await actor(learner);
  await assert.rejects(db.query('select get_youtube_discovery_credit_balance($1)',[org]),/admin access/i);
  await assert.rejects(
    db.query("select begin_youtube_course_search($1,$2,$3)", [
      org,
      "Product management",
      "beginner",
    ]),
    /admin access/i,
  );
  await actor(admin);
  await assert.rejects(
    db.query("select begin_youtube_course_search($1,$2,$3)", [
      other,
      "Product management",
      "beginner",
    ]),
    /admin access/i,
  );
  const search = (
    await db.query("select begin_youtube_course_search($1,$2,$3) id", [
      org,
      "Product management for beginners",
      "beginner",
    ])
  ).rows[0].id;
  assert.equal((await db.query('select get_youtube_discovery_credit_balance($1) balance',[org])).rows[0].balance,50);
  await assert.rejects(db.query('select get_youtube_discovery_credit_balance($1)',[other]),/admin access/i);
  const charge=(await db.query('select consume_youtube_discovery_credits($1) result',[search])).rows[0].result;
  assert.equal(charge.authorized,true);assert.equal(charge.consumed_from,'organization');assert.equal(charge.organization_balance,49);
  await assert.rejects(db.query('select consume_youtube_discovery_credits($1)',[search]),/already been charged/i);
  await actor(learner);await assert.rejects(db.query('select consume_youtube_discovery_credits($1)',[search]),/admin access/i);
  await db.exec('reset role');assert.equal((await db.query("select balance from ai_credit_accounts where organization_id=$1",[other])).rows[0].balance,100);
  assert.equal((await db.query('select count(*)::int n from ai_credit_transactions')).rows[0].n,1);
  await db.exec("update ai_credit_accounts set balance=0 where organization_id='"+org+"'");
  await actor(admin);const unfunded=(await db.query('select begin_youtube_course_search($1,$2,$3) id',[org,'AI automation course','beginner'])).rows[0].id;
  assert.equal((await db.query('select consume_youtube_discovery_credits($1) result',[unfunded])).rows[0].result.authorized,false);
  await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from ai_credit_transactions')).rows[0].n,1);await actor(admin);
  await assert.rejects(
    db.exec(
      `insert into youtube_course_suggestions(search_id,organization_id,video_id,title,channel_title,duration_seconds,reason,category,level,rank) values('${search}','${org}','ABCDEFGHIJK','Fake','Fake',1,'Fake','Fake','beginner',1)`,
    ),
    /permission denied/i,
  );
  await db.exec("reset role");
  const make = async (video, verified = "now()") =>
    (
      await db.query(
        `insert into youtube_course_suggestions(search_id,organization_id,video_id,title,description,channel_title,duration_seconds,reason,category,level,rank,verified_at) values($1,$2,$3,'Product Management','Description','Course creator',7200,'Suitable foundations','Product Management','beginner',1,${verified}) returning id`,
        [search, org, video],
      )
    ).rows[0].id;
  const suggestion = await make("ABCDEFGHIJK"),
    stale = await make("BCDEFGHIJKL", "now()-interval '2 days'");
  await actor(learner);
  assert.equal(
    (await db.query("select * from youtube_course_suggestions")).rows.length,
    0,
  );
  await assert.rejects(
    db.query("select review_youtube_course_suggestion($1,$2)", [
      suggestion,
      "accept",
    ]),
    /admin access/i,
  );
  await actor("", "anon");
  await assert.rejects(
    db.query("select review_youtube_course_suggestion($1,$2)", [
      suggestion,
      "accept",
    ]),
    /permission denied/i,
  );
  await actor(admin);
  await assert.rejects(
    db.query("select review_youtube_course_suggestion($1,$2)", [
      stale,
      "accept",
    ]),
    /expired/i,
  );
  await db.query("select review_youtube_course_suggestion($1,$2)", [
    suggestion,
    "reject",
  ]);
  await db.query("select review_youtube_course_suggestion($1,$2)", [
    suggestion,
    "restore",
  ]);
  const course = (
    await db.query("select review_youtube_course_suggestion($1,$2) id", [
      suggestion,
      "accept",
    ])
  ).rows[0].id;
  assert.equal(
    (
      await db.query("select review_youtube_course_suggestion($1,$2) id", [
        suggestion,
        "accept",
      ])
    ).rows[0].id,
    course,
  );
  await db.exec("reset role");
  let rows = (await db.query("select * from courses")).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].is_published, false);
  assert.equal(
    rows[0].course_link,
    "https://www.youtube.com/watch?v=ABCDEFGHIJK",
  );
  assert.equal((await db.query("select * from lessons")).rows.length, 1);
  await actor(admin);
  await assert.rejects(
    db.query("select publish_assign_youtube_course($1,$2)", [
      course,
      [foreign],
    ]),
    /active members/i,
  );
  await assert.rejects(
    db.query("select publish_assign_youtube_course($1,$2)", [
      course,
      [suspended],
    ]),
    /active members/i,
  );
  await assert.rejects(
    db.query("select publish_assign_youtube_course($1,$2)", [course, []]),
    /at least one/i,
  );
  await db.exec("reset role");
  assert.equal(
    (await db.query("select is_published from courses")).rows[0].is_published,
    false,
  );
  await actor(admin);
  assert.equal(
    (
      await db.query("select publish_assign_youtube_course($1,$2,$3) n", [
        course,
        [],
        cohort,
      ])
    ).rows[0].n,
    1,
  );
  await db.query("select publish_assign_youtube_course($1,$2,$3)", [
    course,
    [],
    cohort,
  ]);
  await db.exec("reset role");
  assert.equal(
    (await db.query("select * from cohort_learner_courses")).rows.length,
    1,
  );
  assert.equal(
    (await db.query("select * from course_enrollments")).rows.length,
    1,
  );
  await db.exec("update course_enrollments set progress_percentage=75");
  await actor(admin);
  await db.query("select publish_assign_youtube_course($1,$2)", [
    course,
    [learner],
  ]);
  await db.exec("reset role");
  assert.equal(
    Number(
      (await db.query("select progress_percentage from course_enrollments"))
        .rows[0].progress_percentage,
    ),
    75,
  );
  await actor(admin);
  const targets = (
    await db.query("select get_youtube_course_assignment_targets($1) d", [org])
  ).rows[0].d;
  assert.deepEqual(
    targets.learners.map((l) => l.id),
    [learner],
  );
  for (let i = 0; i < 8; i++)
    await db.query("select begin_youtube_course_search($1,$2,$3)", [
      org,
      "Product management",
      "beginner",
    ]);
  await assert.rejects(
    db.query("select begin_youtube_course_search($1,$2,$3)", [
      org,
      "Product management",
      "beginner",
    ]),
    /limit reached/i,
  );
  console.log(
    "YouTube database checks passed: isolated admin access, RLS, drafts, real lessons, reversible reviews, expiry, atomic assignment, tenant isolation, suspended learners, deduplication, progress preservation, search limits and migration replay.",
  );
} finally {
  await db.close();
}
