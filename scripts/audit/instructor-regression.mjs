import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
const local = JSON.parse(fs.readFileSync('docs/audit/local-test-cluster.json', 'utf8'));
if (local.port !== 55439 || !local.database?.startsWith('trainai_audit_')) throw Error('Isolated fixture required');
const config = { host: '127.0.0.1', port: local.port, user: 'audit_owner', database: local.database };
const db = new Client(config); await db.connect();
const results = [];
async function check(name, fn) {
  try { await fn(); results.push({ name, status: 'PASS' }); console.log('PASS', name); }
  catch (e) { results.push({ name, status: 'FAIL', message: e.message }); console.log('FAIL', name, e.message); }
}
async function actor(id, fn) {
  const c = new Client(config); await c.connect();
  try {
    await c.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)", [id]);
    await c.query('set role authenticated'); return await fn(c);
  } finally { await c.end(); }
}
const ids = Object.fromEntries(['admin','teacher','learner','otherAdmin','outsider','empty','organization','otherOrg','cohort','otherCohort','course','individualCourse','unrelatedCourse','path'].map(key => [key, randomUUID()]));
const { admin, teacher, learner, otherAdmin, outsider, empty, organization, otherOrg, cohort, otherCohort, course, individualCourse, unrelatedCourse, path } = ids;
try {
  await db.query("insert into organizations(id,name,slug,status) values($1,'Teaching fixture',$3,'trial'),($2,'Other fixture',$4,'trial')", [organization, otherOrg, organization, otherOrg]);
  for (const id of [admin, teacher, learner, otherAdmin, outsider, empty]) await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{\"display_name\":\"Fixture member\"}')", [id, id+'@example.invalid']);
  for (const [id, org, role] of [[admin,organization,'admin'],[teacher,organization,'member'],[learner,organization,'member'],[empty,organization,'member'],[otherAdmin,otherOrg,'admin'],[outsider,otherOrg,'member']]) await db.query("insert into organization_members(organization_id,user_id,role,status) values($1,$2,$3,'active')", [org,id,role]);
  await db.query("insert into user_roles(user_id,role) values($1,'admin'),($2,'admin') on conflict do nothing", [admin,otherAdmin]);
  await db.query("insert into cohorts(id,organization_id,name,created_by) values($1,$3,'Teaching cohort',$4),($2,$3,'Other same organization cohort',$4)", [cohort,otherCohort,organization,admin]);
  await db.query("insert into cohort_members(cohort_id,user_id) values($1,$3),($2,$4),($1,$4)", [cohort,otherCohort,learner,teacher]);
  for (const [id,title,org] of [[course,'Whole cohort course',organization],[individualCourse,'Individual course',organization],[unrelatedCourse,'Private other organization course',otherOrg]]) await db.query('insert into courses(id,title,organization_id) values($1,$2,$3)', [id,title,org]);
  await db.query('insert into cohort_courses(cohort_id,course_id) values($1,$2)', [cohort,course]);
  await db.query('insert into cohort_learner_courses(cohort_id,user_id,course_id,assigned_by) values($1,$2,$3,$4)', [cohort,learner,individualCourse,admin]);
  await db.query('insert into course_enrollments(user_id,course_id,progress_percentage) values($1,$2,35),($1,$3,90)', [learner,individualCourse,unrelatedCourse]);
  await db.query("insert into learning_paths(id,title,organization_id) values($1,'Assigned learning path',$2)", [path,organization]);
  await db.query('insert into learning_path_courses(path_id,course_id,order_index) values($1,$2,0)', [path,individualCourse]);
  await db.query('insert into learning_path_enrollments(user_id,path_id,current_course_index) values($1,$2,4)', [learner,path]);

  await check('Organization admin atomically promotes and assigns an instructor', () => actor(admin, async c => {
    assert.equal((await c.query('select assign_cohort_instructor($1,$2) x',[cohort,teacher])).rows[0].x.success,true);
    assert.equal((await db.query("select cohort_role from cohort_members where cohort_id=$1 and user_id=$2",[cohort,teacher])).rows[0].cohort_role,'instructor');
    assert.equal((await db.query("select is_active and is_approved ready from mentors where user_id=$1",[teacher])).rows[0].ready,true);
  }));
  await check('Instructor roles are own, authoritative and exclude administrator', () => actor(teacher,async c => {
    const roles=(await c.query('select get_my_workspace_roles() roles')).rows[0].roles;
    assert(roles.includes('mentor')); assert(!roles.includes('admin')); assert(!roles.includes('super_admin'));
  }));
  await check('Only explicit teaching assignments appear; learner membership is insufficient', () => actor(teacher,async c => {
    assert.deepEqual((await c.query('select id from list_my_instructor_cohorts()')).rows.map(x=>x.id),[cohort]);
    assert.equal((await c.query('select can_teach_cohort($1) allowed',[otherCohort])).rows[0].allowed,false);
    await assert.rejects(c.query('select get_instructor_cohort_workspace($1)',[otherCohort]));
  }));
  await check('Instructor cannot assign, self-promote or edit organization member roles', () => actor(teacher,async c => {
    await assert.rejects(c.query('select assign_cohort_instructor($1,$2)',[otherCohort,teacher]));
    assert.equal((await c.query("update cohort_members set cohort_role='instructor' where cohort_id=$1 and user_id=$2",[otherCohort,teacher])).rowCount,0);
    await assert.rejects(c.query("select set_organization_member_role($1,$2,'admin')",[organization,teacher]));
  }));
  await check('Foreign organization admin and foreign assignee are denied',async () => {
    await actor(otherAdmin,c=>assert.rejects(c.query('select assign_cohort_instructor($1,$2)',[cohort,outsider])));
    await actor(admin,c=>assert.rejects(c.query('select assign_cohort_instructor($1,$2)',[cohort,outsider])));
  });
  await check('Admin track includes whole-cohort and individual coursework with genuine progress', () => actor(admin,async c => {
    const track=(await c.query('select get_member_learning_track($1,$2) x',[organization,learner])).rows[0].x;
    assert.equal(track.enrollments.length,2);
    assert.equal(track.enrollments.find(x=>x.id===course).status,'assigned');
    assert.equal(track.enrollments.find(x=>x.id===course).progress,0);
    assert.equal(track.enrollments.find(x=>x.id===individualCourse).progress,35);
    assert.equal(track.tracks[0].courses[0].progress,35); // Index 4 must never invent completion.
    assert(!JSON.stringify(track).includes(unrelatedCourse));
  }));
  await check('Empty member record stays empty', () => actor(admin,async c => {
    const track=(await c.query('select get_member_learning_track($1,$2) x',[organization,empty])).rows[0].x;
    assert.deepEqual(track.enrollments,[]); assert.deepEqual(track.tracks,[]);
  }));
  await check('Instructor sees only assigned cohort learning, without global private metadata', () => actor(teacher,async c => {
    const track=(await c.query('select get_member_learning_track($1,$2,$3) x',[organization,learner,cohort])).rows[0].x;
    assert.equal(track.enrollments.length,2); assert.deepEqual(track.tracks,[]); assert.equal(track.membership,null); assert.equal(track.stats,null);
    await assert.rejects(c.query('select get_member_learning_track($1,$2)',[organization,learner]));
    await assert.rejects(c.query('select get_member_learning_track($1,$2,$3)',[organization,empty,cohort]));
  }));
  await check('Learners and foreign admins cannot read another learner record',async () => {
    await actor(learner,c=>assert.rejects(c.query('select get_member_learning_track($1,$2)',[organization,teacher])));
    await actor(otherAdmin,c=>assert.rejects(c.query('select get_member_learning_track($1,$2)',[organization,learner])));
  });
  await check('Assigned instructor can manage resources and sessions only in assigned cohort', () => actor(teacher,async c => {
    await c.query("insert into cohort_resources(cohort_id,created_by,title,resource_type) values($1,$2,'Teaching material','link')",[cohort,teacher]);
    await assert.rejects(c.query("insert into cohort_resources(cohort_id,created_by,title,resource_type) values($1,$2,'Denied','link')",[otherCohort,teacher]));
    await c.query("insert into cohort_sessions(cohort_id,created_by,title,starts_at) values($1,$2,'Lesson',now())",[cohort,teacher]);
    await assert.rejects(c.query("insert into cohort_sessions(cohort_id,created_by,title,starts_at) values($1,$2,'Denied',now())",[otherCohort,teacher]));
  }));
  await check('Assignment removal immediately revokes teaching on an existing session', () => actor(teacher,async c => {
    assert.equal((await c.query('select can_teach_cohort($1) x',[cohort])).rows[0].x,true);
    await db.query('delete from cohort_members where cohort_id=$1 and user_id=$2',[cohort,teacher]);
    assert.equal((await c.query('select can_teach_cohort($1) x',[cohort])).rows[0].x,false);
    await assert.rejects(c.query('select get_instructor_cohort_workspace($1)',[cohort]));
    assert.equal((await c.query('select * from cohort_resources where cohort_id=$1',[cohort])).rowCount,0);
    await assert.rejects(c.query('select get_member_learning_track($1,$2,$3)',[organization,learner,cohort]));
  }));
  await check('Reassignment restores only the selected cohort', () => actor(admin,async c => {
    await c.query('select assign_cohort_instructor($1,$2)',[otherCohort,teacher]);
    await actor(teacher,async t => assert.deepEqual((await t.query('select id from list_my_instructor_cohorts()')).rows.map(x=>x.id),[otherCohort]));
  }));
  await check('Inactive organization membership removes teaching access',async () => {
    await db.query("update organization_members set status='suspended' where organization_id=$1 and user_id=$2",[organization,teacher]);
    await actor(teacher,async c=>assert.equal((await c.query('select id from list_my_instructor_cohorts()')).rowCount,0));
  });
  await check('Admin can inspect suspended members while their teaching access stays revoked', () => actor(admin,async c => {
    const track=(await c.query('select get_member_learning_track($1,$2) x',[organization,teacher])).rows[0].x;
    assert.equal(track.membership.status,'suspended');
  }));
  await check('Admin role picker atomically updates both stores without granting admin', () => actor(admin,async c => {
    await c.query("select set_organization_member_role($1,$2,'mentor')",[organization,empty]);
    assert.equal((await db.query('select role from user_profiles where id=$1',[empty])).rows[0].role,'mentor');
    await actor(empty,async t=>assert((await t.query('select get_my_workspace_roles() roles')).rows[0].roles.includes('mentor')));
    await assert.rejects(c.query("select set_organization_member_role($1,$2,'admin')",[organization,empty]));
  }));
} finally {
  fs.writeFileSync('docs/audit/instructor-test-results.json',JSON.stringify(results,null,2));
  await db.end();
}
if (results.some(x=>x.status==='FAIL')) process.exitCode=1;
