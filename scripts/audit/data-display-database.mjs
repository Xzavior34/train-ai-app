// Functional data-shape checks in the isolated PostgreSQL fixture. All changes roll back.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
const local=JSON.parse(fs.readFileSync('docs/audit/local-test-cluster.json','utf8'));
if(local.port!==55439||!local.database?.startsWith('trainai_audit_'))throw Error('Isolated fixture required');
const db=new Client({host:'127.0.0.1',port:local.port,user:'audit_owner',database:local.database});
await db.connect();const results=[];
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});console.log('PASS',name);}catch(e){results.push({name,status:'FAIL',message:e.message});throw e;}}
const org=randomUUID(),admin=randomUUID(),learner=randomUUID(),course=randomUUID(),path=randomUUID();
try{
 await db.query('begin');
 await db.query(fs.readFileSync('supabase/migrations/202610210002_member_learning_track_display.sql','utf8'));
 await db.query("insert into organizations(id,name,slug,status) values($1,'Data display fixture',$2,'trial')",[org,'data-'+org]);
 for(const id of [admin,learner])await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{}')",[id,id+'@example.invalid']);
 await db.query("insert into organization_members(organization_id,user_id,role,status) values($1,$2,'admin','active'),($1,$3,'member','active')",[org,admin,learner]);
 await db.query("insert into user_roles(user_id,role) values($1,'admin') on conflict do nothing",[admin]);
 await db.query("insert into courses(id,title,organization_id,is_published) values($1,'Shared saved course',null,true)",[course]);
 await db.query("insert into course_enrollments(course_id,user_id,progress_percentage) values($1,$2,100)",[course,learner]);
 await db.query("insert into learning_paths(id,title,organization_id,is_published) values($1,'Shared saved path',null,true)",[path]);
 await db.query("insert into learning_path_courses(path_id,course_id,order_index) values($1,$2,0)",[path,course]);
 await db.query("insert into learning_path_enrollments(path_id,user_id,status) values($1,$2,'in_progress')",[path,learner]);
 await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[admin]);
 await db.query('set local role authenticated');
 const setup=(await db.query('select auth.uid() uid,can_administer_organization($1) allowed,(select status from organization_members where organization_id=$1 and user_id=$2) learner_status',[org,learner])).rows[0];
 if(!setup.allowed||setup.learner_status!=='active') throw new Error('Incomplete data-display test fixture: '+JSON.stringify(setup));
 const data=(await db.query('select get_member_learning_track($1,$2) data',[org,learner])).rows[0].data;
 await check('Saved shared-catalog course appears once in member tracking',async()=>{assert.equal(data.enrollments.length,1);assert.equal(data.enrollments[0].id,course);assert.equal(data.enrollments[0].title,'Shared saved course');});
 await check('A course at 100 percent is counted and displayed as completed',async()=>{assert.equal(data.completedCount,1);assert.equal(data.avgProgress,100);assert.equal(data.enrollments[0].status,'completed');});
 await check('Saved shared learning path retains its course order and progress',async()=>{assert.equal(data.tracks.length,1);assert.equal(data.tracks[0].id,path);assert.equal(data.tracks[0].courses[0].orderIndex,0);assert.equal(data.tracks[0].courses[0].progress,100);});
}finally{await db.query('rollback').catch(()=>{});await db.end();fs.writeFileSync('docs/audit/data-display-database-results.json',JSON.stringify(results,null,2));}
