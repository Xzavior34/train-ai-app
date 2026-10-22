import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const org = '10000000-0000-4000-8000-000000000001';
const otherOrg = '10000000-0000-4000-8000-000000000002';
const user = '20000000-0000-4000-8000-000000000001';
const otherUser = '20000000-0000-4000-8000-000000000002';
const bundle = await build({stdin:{contents:`export * from './src/lib/api/platform.js'; export {fetchPublishedCourses,fetchPublishedLearningPaths} from './src/lib/api/learner.js'; export {getReferralSignupsRoster,getLinkClicksRoster} from './src/lib/api/organizations.js'; import React from 'react'; import {renderToString} from 'react-dom/server'; import {MemberLearningTrack} from './src/platform/components/MemberLearningTrack.jsx';import {CoursesScreen} from './src/learner/screens/CoursesScreen.jsx';export const renderTrack=data=>renderToString(React.createElement(MemberLearningTrack,{learningTrackQuery:{data,loading:false,error:null}}));export const renderEmptyCourses=()=>renderToString(React.createElement(CoursesScreen,{courses:[],coursesLoading:false}));`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',write:false,packages:'external',logLevel:'silent',plugins:[{name:'connected-fixture',setup(b){b.onResolve({filter:/(?:^|[\\/])supabaseClient\.js$/},()=>({path:'client',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export const supabase=globalThis.fixtureClient;export const activeProject='organization_db'; export const isSupabaseConfigured=true; export const PROJECT_CONFIGURED={}; export const SUPABASE_PROJECTS={ORGANIZATION_DB:'organization_db',SARA_FOUNDATION:'sara_foundation'};export const getSupabaseClientForProject=()=>supabase; export function setActiveSupabaseProject(){};export const resolveProjectForSignIn=()=> 'organization_db'; export const resolveProjectForSignUp=resolveProjectForSignIn;export const fallbackProjectForSignIn=()=>null;`}));}}]});

function fixture({tables={},failTable=null,rpcData=null,rpcError=null}={}) {
 const calls=[];const storage=new Map();
 const db={organizations:[{id:org,slug:'saved-org',name:'Saved Organization'}],...tables};
 const client={
  rpc:async(name,args)=>{calls.push({rpc:name,args});return {data:rpcData,error:rpcError};},
  from(table){const query={table,filters:[],head:false,single:false};
   const chain={select(fields,options){query.fields=fields;query.head=!!options?.head;return chain;},eq(column,value){query.filters.push({column,value,type:'eq'});return chain;},in(column,value){query.filters.push({column,value,type:'in'});return chain;},or(expression){query.or=expression;return chain;},is(){return chain;},not(){return chain;},order(){return chain;},limit(){return chain;},maybeSingle(){query.single=true;return chain;},then(resolve,reject){
    calls.push(query);
    if(table===failTable)return Promise.resolve({data:null,count:null,error:{message:'fixture database unavailable'}}).then(resolve,reject);
    let rows=(db[table]||[]).filter(row=>query.filters.every(f=>f.type==='eq'?row[f.column]===f.value:f.value.includes(row[f.column])));
    if(query.or?.startsWith('organization_id.eq.')) {const id=query.or.split(',')[0].slice('organization_id.eq.'.length);rows=rows.filter(row=>row.organization_id===id||row.organization_id==null);}
    return Promise.resolve({data:query.head?null:query.single?(rows[0]||null):rows,count:rows.length,error:null}).then(resolve,reject);
   }};return chain;
  }
 };
 const context={fixtureClient:client,module:{exports:{}},require,console:{warn(){},error(){}},URL,URLSearchParams,Date,Map,Set,setTimeout,clearTimeout,localStorage:{getItem:key=>storage.get(key)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},window:{location:{origin:'http://localhost'},dispatchEvent(){}},Event};
 vm.createContext(context);vm.runInContext(bundle.outputFiles[0].text,context);
 return {api:context.module.exports,calls,storage};
}

test('Connected member directory ignores local sample signups and visitors',async()=>{
 const f=fixture();f.storage.set('trainai_referral_signups_roster_v1',JSON.stringify([{id:'user-dt-learner-priya',organization_id:org,email:'sample@example.invalid'}]));
 assert.equal(f.api.getReferralSignupsRoster(org).length,0);assert.equal(f.api.getLinkClicksRoster(org).length,0);
 assert.equal((await f.api.fetchOrgMembers(org)).length,0);
});
test('Screenshot sample learner never reaches a UUID database call',async()=>{
 const f=fixture();const data=await f.api.fetchMemberLearningTrack('user-dt-learner-priya',org);
 assert.match(data.unavailableReason,/no saved learning record/);assert.equal(f.calls.length,0);
});
test('Saved learner progress is loaded with the selected organization and cohort',async()=>{
 const saved={enrollments:[{id:'saved-course',title:'Actual course',progress:37}],tracks:[],avgProgress:37};const f=fixture({rpcData:saved});
 assert.equal((await f.api.fetchMemberLearningTrack(user,org)).enrollments[0].progress,37);
 assert.equal(f.calls[0].rpc,'get_member_learning_track');assert.equal(f.calls[0].args.p_user_id,user);assert.equal(f.calls[0].args.p_org_id,org);
});
test('Invalid organization and cohort selections do not become UUID errors',async()=>{
 const f=fixture();await assert.rejects(f.api.fetchMemberLearningTrack(user,'demo-org-id'),/saved organization/);await assert.rejects(f.api.fetchMemberLearningTrack(user,org,'demo-cohort'),/saved cohort/);assert.equal(f.calls.length,0);
});
test('Saved directory uses membership roles, excludes unrelated profiles, and does not invent email addresses',async()=>{
 const f=fixture({tables:{user_profiles:[{id:user,display_name:'Registered Member',role:'admin',organization_id:org},{id:otherUser,display_name:'Other Member',organization_id:null}],organization_members:[{user_id:user,organization_id:org,role:'member',status:'active'}]}});
 const rows=await f.api.fetchOrgMembers(org);assert.equal(rows.length,1);assert.equal(rows[0].id,user);assert.equal(rows[0].role,'learner');assert.equal(rows[0].email,null);
});
test('An unresolved organization does not display another organizations roster',async()=>{
 const f=fixture();await assert.rejects(f.api.fetchOrgMembers('unknown-org'),/selected organization/);assert.ok(!f.calls.some(c=>c.table==='user_profiles'));
});
test('Dashboard preserves zero values instead of supplying sample totals',async()=>{
 const f=fixture();const stats=await f.api.fetchOrgDashboardStats(org);for(const value of Object.values(stats))assert.equal(value,0);
});
test('Dashboard completion totals exclude enrollments outside the selected learner roster',async()=>{
 const f=fixture({tables:{user_profiles:[{id:user,organization_id:org,role:'learner'}],organization_members:[{user_id:user,organization_id:org,role:'member',status:'active'}],course_enrollments:[{user_id:user,progress_percentage:0},{user_id:otherUser,progress_percentage:100,completed_at:'2026-01-01'}],cohorts:[{id:'c',organization_id:otherOrg}]}});
 const stats=await f.api.fetchOrgDashboardStats(org);assert.equal(stats.totalMembers,1);assert.equal(stats.activeStudents,1);assert.equal(stats.completionRate,0);assert.equal(stats.avgCompletedCourses,0);assert.equal(stats.cohorts,0);
});
test('Courses remain empty when the connected catalog is empty',async()=>{const f=fixture();assert.equal((await f.api.fetchPublishedCourses(org)).length,0);});
test('Course loading resolves a saved slug and surfaces database failures',async()=>{
 const f=fixture({tables:{courses:[{id:'actual',organization_id:org,is_published:true}]}});assert.equal((await f.api.fetchPublishedCourses('saved-org'))[0].id,'actual');
 const failed=fixture({failTable:'courses'});await assert.rejects(failed.api.fetchPublishedCourses(org),/Could not load courses/);
});
test('Empty published learning paths do not create fictional career tracks',async()=>{const f=fixture();assert.equal((await f.api.fetchPublishedLearningPaths(org)).length,0);});
test('Admin learning path errors do not return sample paths',async()=>{const f=fixture({failTable:'learning_paths'});await assert.rejects(f.api.fetchLearningPathsAdmin(org),/Could not load learning paths/);});
test('Batched record lookups surface failed chunks instead of silently dropping records',async()=>{const f=fixture({failTable:'course_enrollments'});await assert.rejects(f.api.safeInQuery('course_enrollments','*','user_id',Array.from({length:35},(_,i)=>String(i))),error=>error.message==='fixture database unavailable');});
test('A failed learning record is not replaced by fictional progress',async()=>{const f=fixture({rpcError:{message:'fixture failure'}});await assert.rejects(f.api.fetchMemberLearningTrack(user,org),/Could not load this member/);assert.equal(f.calls.length,1);});
test('Learning track renders saved progress and does not call a path-only record empty',()=>{const f=fixture();const html=f.api.renderTrack({tracks:[{id:'path',title:'Saved Path',courses:[{id:'course',title:'Saved Course',progress:37}]}],enrollments:[],avgProgress:37});assert.match(html,/Saved Path/);assert.match(html,/Saved Course/);assert.match(html,/37/);assert.doesNotMatch(html,/No courses or learning paths assigned/);});
test('Empty connected course screen never claims all learning is complete',()=>{const f=fixture();const html=f.api.renderEmptyCourses();assert.match(html,/No courses available yet/);assert.doesNotMatch(html,/All lessons complete|Complete Material|Live Workshop/);});
