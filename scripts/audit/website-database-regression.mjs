import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { Client } from 'pg';
const local=JSON.parse(fs.readFileSync('docs/audit/local-test-cluster.json','utf8'));
if(local.port!==55439||!local.database?.startsWith('trainai_audit_'))throw Error('Isolated fixture required');
const config={host:'127.0.0.1',port:local.port,user:'audit_owner',database:local.database};
const db=new Client(config);await db.connect();const results=[];
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});console.log('PASS',name)}catch(error){results.push({name,status:'FAIL',message:error.message});console.log('FAIL',name,error.message)}}
async function as(user,fn,role='authenticated'){
 const c=new Client(config);await c.connect();try{
 await c.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[user||'',role]);await c.query('set role '+role);return await fn(c);
 }finally{await c.end();}
}
const ids=Object.fromEntries(['admin','owner','otherAdmin','learner','invitee','platform','org','otherOrg'].map(key=>[key,randomUUID()]));
const {admin,owner,otherAdmin,learner,invitee,platform,org,otherOrg}=ids;
const runId=randomUUID();const hash=value=>createHash('sha256').update(runId+value).digest('hex');
const email=user=>user+'@example.invalid';
try{
 await db.query("insert into organizations(id,name,slug,status,max_users) values($1,'Website fixture',$3,'trial',100),($2,'Foreign fixture',$4,'trial',100)",[org,otherOrg,org,otherOrg]);
 for(const user of [admin,owner,otherAdmin,learner,invitee,platform])await db.query('insert into auth.users(id,email) values($1,$2)',[user,email(user)]);
 for(const [user,organization,role] of [[admin,org,'admin'],[owner,org,'owner'],[otherAdmin,otherOrg,'admin'],[learner,org,'member']])await db.query("insert into organization_members(user_id,organization_id,role,status) values($1,$2,$3,'active')",[user,organization,role]);
 await db.query("insert into user_roles(user_id,role) values($1,'admin'),($2,'admin'),($3,'super_admin') on conflict do nothing",[admin,otherAdmin,platform]);
 await check('Organization admins cannot invite into another tenant through the definer RPC',()=>as(admin,c=>assert.rejects(c.query("select create_user_invitation($1,'learner',$2,'member')",[email(invitee),otherOrg]))));
 await check('Organization invitation cannot grant platform-owner or organization-owner access',()=>as(admin,async c=>{
  await assert.rejects(c.query("select create_user_invitation($1,'super_admin',$2,'member')",[email(invitee),org]));
  await assert.rejects(c.query("select create_user_invitation($1,'learner',$2,'owner')",[email(invitee),org]));
 }));
 await check('Administrator invitation requires the organization owner',async()=>{
  await as(admin,c=>assert.rejects(c.query("select create_user_invitation($1,'admin',$2,'admin')",[email(invitee),org])));
  await as(owner,async c=>assert((await c.query("select create_user_invitation($1,'admin',$2,'admin') id",['admin-'+email(invitee),org])).rows[0].id));
 });
 let invitation;
 await check('Organization admin can invite a mentor through the secured RPC',()=>as(admin,async c=>{
  invitation=(await c.query("select create_user_invitation($1,'mentor',$2,'member') id",[email(invitee),org])).rows[0].id;
  assert(invitation);
 }));
 await check('Another tenant administrator cannot read or cancel private invitations',()=>as(otherAdmin,async c=>{
  assert.equal((await c.query('select id from user_invitations where id=$1',[invitation])).rowCount,0);
  assert.equal((await c.query("update user_invitations set status='cancelled' where id=$1",[invitation])).rowCount,0);
 }));
 await check('Accepted invitation grants only its approved role to the matching account',async()=>{
  const token=(await db.query('select token from user_invitations where id=$1',[invitation])).rows[0].token;
  await as(null,async c=>assert.equal((await c.query('select accept_invitation_for_user($1,$2) x',[token,invitee])).rows[0].x.success,true),'service_role');
  assert.equal((await db.query("select count(*)::int n from user_roles where user_id=$1 and role='mentor'",[invitee])).rows[0].n,1);
 });
 await check('Legacy privileged invitation is rejected at redemption without granting roles',async()=>{
  await db.query('alter table user_invitations disable trigger validate_invitation_access');
  let row;
  try{row=(await db.query("insert into user_invitations(email,role,organization_id,organization_role,invited_by) values($1,'super_admin',$2,'member',$3) returning token",[email(learner),org,admin])).rows[0];}
  finally{await db.query('alter table user_invitations enable trigger validate_invitation_access');}
  await as(null,c=>assert.rejects(c.query('select accept_invitation_for_user($1,$2)',[row.token,learner])),'service_role');
  assert.equal((await db.query("select count(*)::int n from user_roles where user_id=$1 and role='super_admin'",[learner])).rows[0].n,0);
 });
 await check('Recovery throttle serializes concurrent requests per email',async()=>{
  const emailHash=hash('email'),ipHash=hash('ip');
  const calls=await Promise.all(Array.from({length:14},()=>as(null,c=>c.query('select take_password_reset_attempt($1,$2) allowed',[emailHash,ipHash]),'service_role')));
  assert.equal(calls.filter(result=>result.rows[0].allowed).length,5);
 });
 await check('Recovery throttle enforces an IP cap across different addresses',async()=>{
  const calls=await Promise.all(Array.from({length:26},(_,i)=>as(null,c=>c.query('select take_password_reset_attempt($1,$2) allowed',[hash('email-'+i),hash('shared-ip')]),'service_role')));
  assert.equal(calls.filter(result=>result.rows[0].allowed).length,20);
 });
 await check('Clients cannot manipulate password-reset counters',()=>as(learner,async c=>{
  await assert.rejects(c.query('select take_password_reset_attempt($1,$2)',['f'.repeat(64),'a'.repeat(64)]));
  await assert.rejects(c.query('delete from password_reset_attempts'));
 }));
 await check('Fake references cannot mint paid seats or activate subscriptions',()=>as(admin,async c=>{
  await assert.rejects(c.query("select purchase_seats($1,9999,0.01,'fake-reference')",[org]));
  await assert.rejects(c.query("select apply_organization_subscription_payment($1,'growth','stripe','fake-reference',0.01)",[org]));
 }));
 const reference='seat-'+randomUUID();
 async function receipt(context,ref,amount,metadata,user=admin,provider='stripe'){
  return as(null,c=>c.query('select record_verified_payment($1,$2,$3,$4,$5,$6,$7)',[provider,ref,user,context,amount,'USD',metadata]),'service_role');
 }
 await check('Authenticated callers cannot create a verified payment receipt',()=>as(admin,async c=>{
  await assert.rejects(c.query("select record_verified_payment('stripe',$1,$2,'seat_purchase',50,'USD',$3)",[reference,admin,{org_id:org,seats:5}]));
  await assert.rejects(c.query("insert into verified_payment_receipts(provider,reference,user_id,context,amount,currency,metadata) values('stripe',$1,$2,'seat_purchase',50,'USD','{}')",[reference,admin]));
 }));
 await receipt('seat_purchase',reference,50,{org_id:org,seats:5,user_id:admin});
 await check('Receipt parameters cannot be altered or used by another purchaser',async()=>{
  await as(admin,c=>assert.rejects(c.query('select purchase_seats($1,5000,50,$2)',[org,reference])));
  await as(admin,c=>assert.rejects(c.query('select purchase_seats($1,5,0.01,$2)',[org,reference])));
  await as(owner,c=>assert.rejects(c.query('select purchase_seats($1,5,50,$2)',[org,reference])));
 });
 await check('Concurrent payment callback retries add the purchased seats exactly once',async()=>{
  await Promise.all(Array.from({length:8},()=>as(admin,c=>c.query('select purchase_seats($1,5,50,$2)',[org,reference]))));
  const rows=await db.query('select seats_purchased from seat_purchases where organization_id=$1 and payment_reference=$2',[org,reference]);
  assert.equal(rows.rowCount,1);assert.equal(rows.rows[0].seats_purchased,5);
 });
 await check('A verified provider reference cannot be rebound to another purchase',async()=>{
  await assert.rejects(receipt('seat_purchase',reference,50,{org_id:otherOrg,seats:5},otherAdmin));
 });
 const subRef='subscription-'+randomUUID();await receipt('organization_subscription',subRef,45,{org_id:org,tier:'growth',user_id:admin});
 await check('Only the verified subscription tier can be applied',()=>as(admin,c=>assert.rejects(c.query("select apply_organization_subscription_payment($1,'enterprise','stripe',$2,45)",[org,subRef]))));
 await check('Verified subscription retries activate once and create one audit record',async()=>{
  await Promise.all(Array.from({length:5},()=>as(admin,c=>c.query("select apply_organization_subscription_payment($1,'growth','stripe',$2,45)",[org,subRef]))));
  assert.equal((await db.query('select subscription_tier from organizations where id=$1',[org])).rows[0].subscription_tier,'growth');
  assert.equal((await db.query("select count(*)::int n from admin_audit_log where metadata->>'reference'=$1",[subRef])).rows[0].n,1);
 });
 await check('Organization admins and owners cannot grant themselves free paid seats',async()=>{
  await as(admin,c=>assert.rejects(c.query("select grant_free_seats($1,500,'bypass')",[org])));
  await as(owner,c=>assert.rejects(c.query("select grant_free_seats($1,500,'bypass')",[org])));
 });
 await check('Platform-owner free seat grants remain available',()=>as(platform,async c=>{
  assert.equal((await c.query("select grant_free_seats($1,2,'Website fixture approved grant') x",[otherOrg])).rows[0].x.success,true);
 }));
}finally{fs.writeFileSync('docs/audit/website-database-results.json',JSON.stringify(results,null,2));await db.end();}
if(results.some(row=>row.status==='FAIL'))process.exitCode=1;
