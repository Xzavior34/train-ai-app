import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { build } from 'esbuild';
import { resolveMfaGate } from '../../src/lib/securityGate.js';
import { parsePublicLocation } from '../../src/lib/publicRouting.js';
import { hasRequiredMfa } from '../../supabase/functions/_shared/accountSecurity.js';
import { CREDIT_PACKAGES, creditPurchase } from '../../supabase/functions/_shared/paymentCatalog.js';
import { validatePayment, isAllowedPaymentReturn } from '../../supabase/functions/_shared/paymentValidation.js';

test('MFA requires step-up, rejects failed/malformed checks and never opens on timeout',async()=>{
 assert.equal(await resolveMfaGate(async()=>({currentLevel:'aal1',nextLevel:'aal2'})),'required');
 assert.equal(await resolveMfaGate(async()=>({currentLevel:'aal2',nextLevel:'aal2'})),'clear');
 assert.equal(await resolveMfaGate(async()=>({currentLevel:'aal1',nextLevel:'aal1'})),'clear');
 await assert.rejects(resolveMfaGate(async()=>{throw Error('offline')}),/offline/);
 await assert.rejects(resolveMfaGate(async()=>null),/verify/);
 await assert.rejects(resolveMfaGate(()=>new Promise(()=>{}),10),/timed out/);
});
const token=aal=>'fixture.'+Buffer.from(JSON.stringify({aal})).toString('base64url')+'.signature';
test('Privileged handlers require aal2 for users with a verified factor',()=>{
 const user={factors:[{status:'verified'}]};
 assert.equal(hasRequiredMfa(user,token('aal1')),false);
 assert.equal(hasRequiredMfa(user,token('aal2')),true);
 assert.equal(hasRequiredMfa(user,'malformed'),false);
 assert.equal(hasRequiredMfa({factors:[{status:'unverified'}]},token('aal1')),true);
});
test('OAuth code and public routes remain distinct, including path-based certificate routes',()=>{
 assert.equal(parsePublicLocation({pathname:'/',search:'?code=oauth-code'}).certCode,null);
 assert.equal(parsePublicLocation({pathname:'/certificate/TA%20CODE',search:''}).certCode,'TA CODE');
 assert.equal(parsePublicLocation({pathname:'/verify',search:''}).certCode,'1');
 assert.equal(parsePublicLocation({pathname:'/marketplace/',search:''}).view,'marketplace');
 assert.equal(parsePublicLocation({pathname:'/',search:'?workspace=academy'}).authMode,'signup');
 assert.equal(parsePublicLocation({pathname:'/',search:''}).certCode,null);
 assert.equal(parsePublicLocation({pathname:'/',search:'?view=book-demo'}).view,'book-demo');
});
test('Credit entitlements come from configured prices in every supported currency',()=>{
 for(const pkg of CREDIT_PACKAGES)for(const currency of ['NGN','USD','GBP','EUR']){
  const result=creditPurchase({package:pkg.id,credits_to_add:999999},pkg['price'+currency],currency);
  assert.equal(result.credits_to_add,pkg.credits);
  assert.throws(()=>creditPurchase({package:pkg.id},0.01,currency));
 }
 assert.throws(()=>creditPurchase({credits_to_add:999999},5,'USD'));
 assert.throws(()=>creditPurchase({package:'starter'},5,'XXX'));
});
test('Payment callbacks reject insecure, credential-bearing and attacker-controlled destinations',()=>{
 for(const url of ['javascript:alert(1)','http://trainailtd.com/','https://attacker.vercel.app/','https://trainailtd.com.attacker.test/','https://user:password@trainailtd.com/'])assert.equal(isAllowedPaymentReturn(url),false);
 assert.equal(isAllowedPaymentReturn('https://trainailtd.com/?reference=ref'),true);
 assert.equal(isAllowedPaymentReturn('http://127.0.0.1:5173/'),true);
});
function pricingDb({member=true,price=1000,course=true}={}){
 return {rpc:async()=>({data:{unit_amount_minor:price}}),from:table=>{
  const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:table==='organization_members'?(member?{role:'admin',user_id:'buyer'}:null):table==='courses'?(course?{id:'course',price:25,is_published:true}:null):null}),single:async()=>({data:{subscription_tier:'growth'}})};return q;
 }};
}
test('Seat and subscription quotes enforce tenant membership, quantity and server price',async()=>{
 const db=pricingDb();
 assert.equal((await validatePayment(db,'buyer','seat_purchase',20,'USD',{org_id:'org',seats:2})).seats,2);
 await assert.rejects(validatePayment(db,'buyer','seat_purchase',0.01,'USD',{org_id:'org',seats:2000}));
 await assert.rejects(validatePayment(db,'buyer','seat_purchase',10,'USD',{org_id:'org',seats:0.5}));
 await assert.rejects(validatePayment(pricingDb({member:false}),'buyer','seat_purchase',10,'USD',{org_id:'foreign',seats:1}));
 assert.equal((await validatePayment(db,'buyer','organization_subscription',10,'USD',{org_id:'org',tier:'intermediate'})).tier,'growth');
 await assert.rejects(validatePayment(db,'buyer','organization_subscription',10,'USD',{org_id:'org',tier:'enterprise'}));
});
test('Course checkout uses the actual published course price and currency',async()=>{
 assert.equal((await validatePayment(pricingDb(),'buyer','course_enrollment',25,'USD',{course_id:'course'})).course_id,'course');
 await assert.rejects(validatePayment(pricingDb(),'buyer','course_enrollment',25,'NGN',{course_id:'course'}));
 await assert.rejects(validatePayment(pricingDb({course:false}),'buyer','course_enrollment',25,'USD',{course_id:'course'}));
 await assert.rejects(validatePayment(pricingDb(),'buyer','waitlist_premium',1,'USD',{}));
});
test('Public certificate verification cannot trust cached or fabricated certificates on RPC failure',async()=>{
 const source=fs.readFileSync('src/lib/api/certificates.js','utf8');
 const body=source.slice(source.indexOf('export async function verifyPublicCertificate'),source.indexOf('/**',source.indexOf('export async function verifyPublicCertificate')+10)).replace('export ','');
 const context={supabase:{rpc:async()=>({error:{message:'unavailable'}})},getCachedCerts:()=>{throw Error('Cache must not be consulted')}};
 vm.createContext(context);vm.runInContext(body,context);
 await assert.rejects(context.verifyPublicCertificate('FORGED'),/unavailable/);
 context.supabase=null;assert.equal((await context.verifyPublicCertificate('TA-2026-NEXUS-8841')).verified,false);
});

// Execute real Edge handlers with mocked Auth, data and provider boundaries.
async function edge(name,{user={id:'buyer'},db,provider=async()=>{throw Error('Unexpected provider request')},env={}}={}){
 const result=await build({entryPoints:[`supabase/functions/${name}/index.ts`],bundle:true,platform:'node',format:'iife',write:false,logLevel:'silent',plugins:[{name:'fake-supabase',setup(b){b.onResolve({filter:/^npm:/},()=>({path:'client',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const createClient=globalThis.fixtureCreateClient;'}));}}]});
 let handler;const context={fixtureCreateClient:(_url,key)=>key==='anon'?{auth:{getUser:async()=>({data:{user}})}}:db,
 Deno:{env:{get:key=>({SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',SUPABASE_URL:'https://fixture.invalid',PAYSTACK_SECRET_KEY:'fixture-secret',STRIPE_SECRET_KEY:'fixture-secret',STRIPE_WEBHOOK_SECRET:'fixture-secret',ONESIGNAL_APP_ID:'fixture',ONESIGNAL_REST_API_KEY:'fixture',...env})[key]},serve:fn=>{handler=fn}},fetch:provider,URL,URLSearchParams,Request,Response,TextEncoder,TextDecoder,crypto:webcrypto,atob,btoa,console:{error:()=>{},log:()=>{}}};
 vm.runInNewContext(result.outputFiles[0].text,context);return handler;
}
const post=body=>new Request('https://fixture.invalid',{method:'POST',headers:{Authorization:'Bearer '+token('aal1'),'Content-Type':'application/json'},body:JSON.stringify(body)});
test('Paystack verify rejects a foreign or missing purchaser identity',async()=>{
 for(const metadata of [{},{user_id:'other'}]){
  const db={from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:null})})};
  const handler=await edge('paystack-verify',{db,provider:async()=>new Response(JSON.stringify({status:true,data:{status:'success',reference:'reference-123',metadata}}))});
  assert.equal((await handler(post({reference:'reference-123'}))).status,403);
 }
});
test('Paystack verify rejects an underpaid credit package before recording or granting',async()=>{
 let recorded=0;
 const db={rpc:async()=>{recorded++;return {}},from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:null})})};
 const handler=await edge('paystack-verify',{db,provider:async()=>new Response(JSON.stringify({status:true,data:{status:'success',amount:1,currency:'USD',reference:'reference-123',metadata:{user_id:'buyer',context:'credits',package:'team',credits_to_add:999999}}}))});
 assert.equal((await handler(post({reference:'reference-123'}))).status,400);assert.equal(recorded,0);
});
test('Successful provider verification records canonical entitlement and amount',async()=>{
 let recorded;
 const db={rpc:async(_name,params)=>{recorded=params;return {}},from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:null})})};
 const handler=await edge('paystack-verify',{db,provider:async()=>new Response(JSON.stringify({status:true,data:{status:'success',amount:500,currency:'USD',reference:'reference-123',metadata:{user_id:'buyer',context:'credits',package:'starter',credits_to_add:999999}}}))});
 const response=await handler(post({reference:'reference-123'}));assert.equal(response.status,200);
 assert.equal(recorded.p_metadata.credits_to_add,50);assert.equal(recorded.p_amount,5);
});
test('Recovery limiter failure does not send email or generate a recovery token',async()=>{
 let called=false;
 const handler=await edge('send-password-reset',{db:{rpc:async()=>({error:{message:'unavailable'}}),auth:{admin:{generateLink:async()=>{called=true;return {}}}}}});
 assert.equal((await handler(post({email:'person@example.invalid'}))).status,503);assert.equal(called,false);
});
test('Organization invitation endpoint rejects a platform-owner grant',async()=>{
 let inserted=false;
 const db={from:table=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:table==='organizations'?{name:'Fixture'}:{role:'admin'}}),then:fn=>Promise.resolve({data:[{role:'admin'}]}).then(fn),insert:()=>{inserted=true;return q;}};return q;}};
 const handler=await edge('invite-user',{db});
 assert.equal((await handler(post({email:'person@example.invalid',organization_id:'12345678-1234-1234-1234-123456789012',role:'super_admin',organization_role:'member'}))).status,400);assert.equal(inserted,false);
});
test('Sensitive handler denies an unchallenged MFA session before admin operations',async()=>{
 const handler=await edge('admin-reset-mfa',{user:{id:'owner',factors:[{status:'verified'}]},db:{}});
 assert.equal((await handler(post({email:'person@example.invalid'}))).status,403);
});
