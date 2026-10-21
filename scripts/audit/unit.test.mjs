import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {validateDemoInput} from '../../supabase/functions/_shared/demoValidation.js';
import {normalizeCreditBalance} from '../../src/learner/utils/creditBalance.js';
const valid={fullName:'  Fixture Prospect  ',workEmail:'  PERSON@example.invalid ',phoneNumber:'+234 800 123 4567',organizationName:'Fixture Academy',teamSize:'10-50',orgType:'Academy',scheduledDate:'2026-10-26',scheduledTime:'10:00 AM'};
test('Demo normalization preserves international contacts and marks them unverified',()=>{const result=validateDemoInput(valid);assert.equal(result.input.workEmail,'person@example.invalid');assert.equal(result.input.fullName,'Fixture Prospect');assert.equal(result.contactVerification,'unverified');});
test('Demo invalid email, missing fields, rollover dates, controls and spam are rejected',()=>{for(const patch of [{workEmail:'not-an-email'},{fullName:''},{phoneNumber:'abc'},{scheduledDate:'2026-02-31'},{workEmail:'x@example.invalid\r\nBcc:y@example.invalid'},{website:'spam'},{fullName:'x'.repeat(161)}])assert(validateDemoInput({...valid,...patch}).error);});
test('Zero credits remain zero and suspended org funds are unavailable',()=>{assert.deepEqual(normalizeCreditBalance({personal_balance:0,organization_balance:0}),{organizationBalance:0,personalBalance:0});assert.deepEqual(normalizeCreditBalance({personal_balance:3,org_balance:200,org_suspended:true}),{organizationBalance:0,personalBalance:3});assert.throws(()=>normalizeCreditBalance({error:'unavailable'}));});
async function quizEndpoint({authorized,providerFails=false,providerThrows=false,validAssessment=false,invalidQuestions=false}) {
 let handler,calls=0,refunds=0;
 const client={from:()=>({insert:()=>({select:()=>({single:async()=>({data:{id:'fixture-attempt'}})})})}),auth:{getUser:async()=>({data:{user:{id:'fixture-user'}}})},rpc:async name=>{
 if(name==='consume_ai_credits')return {data:{authorized,transaction_id:authorized?'fixture-charge':null}};
 if(name==='refund_ai_credits'){refunds++;return {data:{refunded:true}};} throw Error('Unexpected RPC');
 }};
 const source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/ai-generate-quiz/index.ts','utf8').replace('import { createClient } from "npm:@supabase/supabase-js@2";','const createClient=globalThis.testCreateClient;'));
 vm.runInNewContext(source,{Deno:{env:{get:()=> 'fixture-config'},serve:fn=>{handler=fn}},testCreateClient:()=>client,Response,Request,console:{error:()=>{}},fetch:async()=>{calls++;if(providerThrows)throw Error('fixture provider unavailable');return new Response(JSON.stringify(validAssessment?{choices:[{message:{content:JSON.stringify({assessment:{title:'Fixture quiz',questions:[{id:'q1',question:'Fixture question',options:invalidQuestions?[]:['A','B','C','D'],correctAnswer:0}]}})}}]}:{error:'fixture'}),{status:providerFails?503:200});}});
 const response=await handler(new Request('http://localhost/fixture',{method:'POST',headers:{Authorization:'Bearer fixture','Content-Type':'application/json'},body:JSON.stringify({topic:'Fixture',questionCount:3})}));
 return {response,calls,refunds};
}
test('Exhausted AI requests never call the provider',async()=>{const r=await quizEndpoint({authorized:false});assert.equal(r.response.status,402);assert.equal(r.calls,0);assert.equal(r.refunds,0);});
test('Provider failures and thrown errors refund the charged request',async()=>{for(const options of [{providerFails:true},{providerThrows:true}]){const r=await quizEndpoint({authorized:true,...options});assert(r.response.status>=500);assert.equal(r.calls,1);assert.equal(r.refunds,1);}});
test('Migration versions are unique',()=>{const versions=fs.readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).map(x=>x.split('_')[0]);assert.equal(new Set(versions).size,versions.length);});

test('Successful AI quiz persists an attempt and does not refund',async()=>{const r=await quizEndpoint({authorized:true,validAssessment:true});assert.equal(r.response.status,200);assert.equal(r.refunds,0);assert.equal((await r.response.json()).assessment.attempt_id,'fixture-attempt');});
test('Malformed generated questions are refunded instead of inventing answer options',async()=>{const r=await quizEndpoint({authorized:true,validAssessment:true,invalidQuestions:true});assert.equal(r.response.status,502);assert.equal(r.refunds,1);});


test('Instructor workspace routing follows trusted roles without admin fallback',async()=>{
 const {defaultWorkspaceForRoles,getAllowedWorkspaces,resolveViewMode,getAvailableDashboards}=await import('../../src/lib/roleRouting.js');
 assert.equal(defaultWorkspaceForRoles(['mentor','learner']),'mentor');
 assert.equal(defaultWorkspaceForRoles(['manager']),'manager');
 assert.equal(defaultWorkspaceForRoles(['learner']),null);
 assert.equal(defaultWorkspaceForRoles([]),null);
 assert.deepEqual(getAllowedWorkspaces(['mentor']),['mentor']);
 assert.equal(resolveViewMode(['mentor']),'platform');
 assert(!getAvailableDashboards(['learner'],'trainailtd@gmail.com').includes('owner'));
 assert(getAvailableDashboards(['super_admin'],'someone@example.invalid').includes('owner'));
});

test('Role lookup uses the authenticated RPC and falls back during schema-cache drift',async()=>{
 const source=fs.readFileSync('src/services/authService.js','utf8');
 const fn=source.slice(source.indexOf('export async function fetchMyRoles'),source.indexOf('async function fetchDemoRoles')).replace('export ','');
 let calls=0;
 const context={supabase:{rpc:async name=>{assert.equal(name,'get_my_workspace_roles');calls++;return {data:['mentor']};}}};
 vm.createContext(context);vm.runInContext(fn,context);
 assert.equal((await context.fetchMyRoles()).join(','),'mentor');assert.equal(calls,1);
 context.supabase={
  rpc:async()=>({error:{code:'PGRST202',message:'Could not find get_my_workspace_roles in the schema cache'}}),
  auth:{getUser:async()=>({data:{user:{id:'fixture-user'}}})},
  from:table=>({select:()=>({eq:()=>table==='user_roles'
   ? Promise.resolve({data:[{role:'admin'},{role:'learner'}],error:null})
   : {maybeSingle:async()=>({data:{role:'admin'},error:null})}})}),
 };
 assert.equal((await context.fetchMyRoles()).join(','),'admin,learner');
 context.supabase.rpc=async()=>({error:new Error('Role lookup unavailable')});
 await assert.rejects(context.fetchMyRoles(),/Role lookup unavailable/);
});
