import fs from 'node:fs';
import {Client} from 'pg';
const port=Number(process.env.AUDIT_PG_PORT||55439);
if(port===5432) throw new Error('Refusing default database port; use an isolated fixture');
const config={host:'127.0.0.1',port,user:'audit_owner',database:'postgres',connectionTimeoutMillis:5000};
const database='trainai_audit_'+Date.now();
const c=new Client(config);await c.connect();
try {await c.query('create database '+database);} catch(e) {if(e.code!=='42P04')throw e;} finally {await c.end();}
const db=new Client({...config,database});await db.connect();
await db.query(`do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role bypassrls; exception when duplicate_object then null; end $$;
create schema if not exists auth; create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions;
create table if not exists auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb,created_at timestamptz default now());
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('sub',auth.uid(),'role',auth.role()) $$;
alter default privileges in schema public grant select,insert,update,delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage,select on sequences to authenticated,service_role;
grant usage on schema public,auth to authenticated,anon,service_role;
grant execute on all functions in schema auth to authenticated,anon,service_role;`);
const local=JSON.parse(fs.readFileSync('docs/audit/local-test-cluster.json','utf8')); local.database=database; fs.writeFileSync('docs/audit/local-test-cluster.json',JSON.stringify(local));
const report=[];
for(const file of fs.readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort()) {
try {await db.query(fs.readFileSync('supabase/migrations/'+file,'utf8'));report.push({file,result:'PASS'});}
catch(e){await db.query('rollback');report.push({file,result:'FAIL',message:e.message,code:e.code});console.log(JSON.stringify(report.at(-1)));break;}
}
fs.writeFileSync('docs/audit/migration-replay-results.json',JSON.stringify(report,null,2));
console.log('Applied migrations:',report.filter(x=>x.result==='PASS').length);await db.end();


if (report.some(row => row.result === "FAIL")) process.exitCode = 1;
