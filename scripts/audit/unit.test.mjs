import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {validateDemoInput} from '../../supabase/functions/_shared/demoValidation.js';
import {normalizeCreditBalance} from '../../src/learner/utils/creditBalance.js';
import {checkWorkspaceAccess} from '../../src/lib/workspaceAccess.js';
import {sharePendingRead} from '../../src/lib/pendingReads.js';

test('Concurrent reads share work only within the same account, tenant and client', async () => {
  const client = {}, otherClient = {};
  let calls = 0, finish;
  const read = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  const first = sharePendingRead(client, 'user-a:org-a', read);
  const same = sharePendingRead(client, 'user-a:org-a', read);
  assert.equal(first, same);
  await Promise.resolve(); assert.equal(calls, 1); finish('members');
  assert.equal(await same, 'members');
  await sharePendingRead(client, 'user-a:org-a', async () => { calls++; });
  await Promise.all([
    sharePendingRead(client, 'user-b:org-a', async () => { calls++; }),
    sharePendingRead(client, 'user-a:org-b', async () => { calls++; }),
    sharePendingRead(otherClient, 'user-a:org-a', async () => { calls++; }),
  ]);
  assert.equal(calls, 5);
  await assert.rejects(sharePendingRead(client, 'failed', async () => { throw Error('offline'); }), /offline/);
  assert.equal(await sharePendingRead(client, 'failed', async () => 'recovered'), 'recovered');
});

test('Workspace checks recover from temporary network failures without retrying access denials', async () => {
  const waits = [];
  let calls = 0;
  const roles = await checkWorkspaceAccess(async () => {
    if (++calls < 3) throw new TypeError('Failed to fetch');
    return ['admin'];
  }, { wait: async ms => waits.push(ms) });
  assert.deepEqual(roles, ['admin']);
  assert.deepEqual(waits, [400, 1200]);
  for (const error of [{ message: 'Permission denied', status: 403 }, { message: 'JWT expired', status: 401 }]) {
    calls = 0;
    await assert.rejects(checkWorkspaceAccess(async () => { calls++; throw error; }, { wait: async () => {} }));
    assert.equal(calls, 1);
  }
  calls = 0;
  await assert.rejects(checkWorkspaceAccess(async () => { calls++; throw new TypeError('Failed to fetch'); }, { wait: async () => {} }), /Failed to fetch/);
  assert.equal(calls, 3);
});
const valid={fullName:'  Fixture Prospect  ',workEmail:'  PERSON@example.invalid ',phoneNumber:'+234 800 123 4567',organizationName:'Fixture Academy',teamSize:'10-50',orgType:'Academy',scheduledDate:'2026-10-26',scheduledTime:'10:00 AM'};
test('Post reactions validate identity and propagate database failures', async () => {
  const file = fs.readFileSync('src/lib/api/schemaHelper.js', 'utf8');
  const source = file.slice(file.indexOf('export async function togglePostReaction('), file.indexOf('// Delete a community post')).replace('export async function', 'async function');
  for (const operation of ['lookup', 'insert', 'delete']) {
    const failure = new Error('fixture ' + operation + ' denied');
    const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: operation === 'delete' ? { id: 'reaction' } : null, error: operation === 'lookup' ? failure : null }), insert: async () => ({ error: failure }), delete: () => ({ eq: async () => ({ error: failure }) }) };
    const context = { supabase: { from: () => chain } };
    vm.createContext(context); vm.runInContext(source + '; globalThis.toggle = togglePostReaction;', context);
    await assert.rejects(context.toggle({ postId: 'post', userId: 'user' }), new RegExp(operation + ' denied'));
    await assert.rejects(context.toggle({ postId: 'post' }), /Sign in/);
  }
});
async function insightsEndpoint({ authorized = true, failQuery = false, providerFails = false, scores = [], apiKey = true } = {}) {
  let handler, calls = 0, charges = 0, refunds = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'fixture-user' } } }) },
    from: table => {
      const query = { select: () => query, not: () => query, eq: () => query,
        then: resolve => Promise.resolve({ data: table === 'course_enrollments' ? [{}] : table === 'quiz_attempts' ? scores.map(score => ({ score })) : [], error: failQuery ? { message: 'fixture schema mismatch' } : null }).then(resolve) };
      return query;
    },
    rpc: async name => { if (name === 'consume_ai_credits') { charges++; return { data: { authorized, transaction_id: authorized ? 'charge' : null } }; } refunds++; return { data: {} }; },
  };
  const source = stripTypeScriptTypes(fs.readFileSync('supabase/functions/ai-insights/index.ts', 'utf8').replace('import { createClient } from "npm:@supabase/supabase-js@2";', 'const createClient = globalThis.testCreateClient;'));
  vm.runInNewContext(source, { Deno: { env: { get: key => key === 'OPENAI_API_KEY' && !apiKey ? null : 'fixture' }, serve: fn => { handler = fn; } }, testCreateClient: () => client, Response, Request, console: { error: () => {} }, fetch: async () => { calls++; return new Response(JSON.stringify({ choices: [{ message: { content: 'Real provider summary' } }] }), { status: providerFails ? 503 : 200 }); } });
  const response = await handler(new Request('http://localhost/fixture', { headers: { Authorization: 'Bearer fixture' } }));
  return { response, body: await response.json(), calls, charges, refunds };
}
test('Insights never invent an assessment score and include real quiz results', async () => {
  const empty = await insightsEndpoint(); assert.equal(empty.body.stats.averageScore, null);
  const scored = await insightsEndpoint({ scores: [null, 60, 100] }); assert.equal(scored.body.stats.averageScore, 80); assert.equal(scored.charges, 1);
});
test('Insights query and provider configuration failures do not spend credits', async () => {
  for (const options of [{ failQuery: true }, { apiKey: false }]) {
    const result = await insightsEndpoint(options); assert.equal(result.response.status, 503); assert.equal(result.calls, 0); assert.equal(result.charges, 0);
  }
});
test('Insights respect insufficient credits and refund failed generation', async () => {
  const denied = await insightsEndpoint({ authorized: false }); assert.equal(denied.response.status, 402); assert.equal(denied.calls, 0);
  const failed = await insightsEndpoint({ providerFails: true }); assert.equal(failed.response.status, 502); assert.equal(failed.refunds, 1);
});
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
 assert(getAvailableDashboards(['super_admin'],'trainailtd@gmail.com').includes('owner'));
 assert(!getAvailableDashboards(['super_admin'],'someone@example.invalid').includes('owner'));
 assert(!getAvailableDashboards(['admin','super_admin'],'info@sarafoundationafrica.com').includes('owner'));
 assert.deepEqual(getAvailableDashboards(['admin'],'info@sarafoundationafrica.com'),['learner','organisation']);
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
