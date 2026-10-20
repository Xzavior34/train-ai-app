// Browser fixture: production components, isolated fake data, no remote services.
import { build } from 'esbuild';
import fs from 'node:fs';
import http from 'node:http';
const mock = `
const courses=[{id:'c1',title:'AI foundations',progress:35,status:'in_progress'},{id:'c2',title:'Responsible AI',progress:0,status:'assigned'}];
export async function fetchMentorActiveCohorts(){return [{id:'fixture-cohort',name:'AI Foundations cohort'}]}
export async function fetchInstructorCohortWorkspace(){return {cohort:{id:'fixture-cohort',name:'AI Foundations cohort',organization_id:'fixture-org'},members:[{id:'m1',user_id:'fixture-learner',display_name:'Alex Learner',cohort_role:'learner'}],resources:[],sessions:[]}}
export async function fetchMemberLearningTrack(){return {enrollments:courses,tracks:[],avgProgress:18,completedCount:0}}
export async function addCohortResource(){return {}}
export async function createCohortSession(){return {}}
export async function fetchCurrentUserProfile(){return null}
export async function fetchOrgMembers(){return []}
export async function fetchUsersInOrg(){return []}
export async function fetchCourses(){return []}
export async function fetchCohorts(){return []}
`;
fs.mkdirSync('scripts/audit/.generated',{recursive:true});
await build({entryPoints:['scripts/audit/instructor-preview.jsx'],bundle:true,outfile:'scripts/audit/.generated/instructor-preview.js',format:'esm',logLevel:'error',plugins:[{name:'isolated-fixture',setup(b){
  b.onLoad({filter:/[\\/]lib[\\/]api[\\/]platform\.js$/},()=>({contents:mock,loader:'js'}));
  b.onLoad({filter:/[\\/]lib[\\/]useAssignmentRefresh\.js$/},()=>({contents:'export function useAssignmentRefresh(){}',loader:'js'}));
  b.onLoad({filter:/[\\/]lib[\\/]supabaseClient\.js$/},()=>({contents:'export const supabase=null;',loader:'js'}));
  b.onLoad({filter:/[\\/]services[\\/]authService\.js$/},()=>({contents:'export async function performGlobalSignOut(){}',loader:'js'}));
}}]});
const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Instructor and admin local verification</title></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>';
http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?fs.readFileSync('scripts/audit/.generated/instructor-preview.js'):html)}).listen(5187,'127.0.0.1',()=>console.log('Isolated browser fixture ready at http://127.0.0.1:5187'));
