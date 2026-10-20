import fs from 'node:fs';
import path from 'node:path';
import { build, transform } from 'esbuild';
import { Client } from 'pg';
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(item=>item.isDirectory()?walk(path.join(dir,item.name)):[path.join(dir,item.name).replaceAll('\\','/')]);}
const source=walk('src').filter(file=>/\.[jt]sx?$/.test(file));
const edges=walk('supabase/functions').filter(file=>file.endsWith('/index.ts'));
const results={sourceModules:source.length,edgeHandlers:edges.length,syntax:[],screens:[],missingAssets:[],databaseContracts:{}};
for(const file of [...source,...edges]){
 try{await transform(fs.readFileSync(file,'utf8'),{loader:file.endsWith('.ts')?'ts':'jsx'});results.syntax.push({file,status:'PASS'});}
 catch(error){results.syntax.push({file,status:'FAIL',message:error.message});}
}
const screenFiles=source.filter(file=>file.endsWith('.jsx')&&(/\/screens\/|\/pages\//.test(file)||(/\/platform\//.test(file)&&/Screen\.jsx$/.test(file))));
const entries=[];
for(const file of screenFiles){
 const text=fs.readFileSync(file,'utf8');
 const names=[...text.matchAll(/export\s+(default\s+)?function\s+(\w+)/g)].filter(match=>match[1]||/Screen$|Page$/.test(match[2]));
 for(const match of names)entries.push({file,name:match[2],default:!!match[1]});
}
fs.mkdirSync('scripts/audit/.generated',{recursive:true});
const entry=`import React from 'react';import {renderToString} from 'react-dom/server';\n`+
entries.map((item,i)=>`import ${item.default?'Screen'+i:'{'+item.name+' as Screen'+i+'}'} from '../../../${item.file}';`).join('\n')+`
const storage={getItem:()=>null,setItem:()=>{},removeItem:()=>{},clear:()=>{}};
globalThis.localStorage=storage;globalThis.sessionStorage=storage;
globalThis.window={location:{pathname:'/',search:'',hash:'',origin:'http://127.0.0.1:5188',href:'http://127.0.0.1:5188'},innerWidth:1440,localStorage:storage,sessionStorage:storage,matchMedia:()=>({matches:false}),addEventListener:()=>{},removeEventListener:()=>{}};
globalThis.document={documentElement:{classList:{contains:()=>false}},body:{style:{}}};
const noop=()=>{};const query={data:null,loading:false,error:null,refetch:noop};
const props={orgId:'demo-org-id',organizationId:'demo-org-id',userId:'fixture-user',currentUserId:'fixture-user',mentorId:'fixture-mentor',profileQuery:{...query,data:{display_name:'Fixture User',role:'admin',organization_id:'demo-org-id'}},session:{user:{id:'fixture-user',email:'fixture@example.invalid'}},userRoles:['admin'],courses:[],cohorts:[],members:[],enrollments:[],notifications:[],params:{},screen:'dashboard',back:noop,onBack:noop,push:noop,setScreen:noop,onNavigate:noop,showToast:noop,onClose:noop,onGoHome:noop,onSignIn:noop,onSignUp:noop,onSignOut:noop};
const cases=[${entries.map((item,i)=>`{file:${JSON.stringify(item.file)},name:${JSON.stringify(item.name)},Component:Screen${i}}`).join(',')}];
export const outcomes=cases.map(item=>{try{const html=renderToString(React.createElement(item.Component,props));return {file:item.file,name:item.name,status:'PASS',renderedBytes:html.length};}catch(error){return {file:item.file,name:item.name,status:'FAIL',message:error.message};}});
`;
fs.writeFileSync('scripts/audit/.generated/screen-entry.jsx',entry);
await build({entryPoints:['scripts/audit/.generated/screen-entry.jsx'],bundle:true,platform:'node',format:'esm',outfile:'scripts/audit/.generated/screen-smoke.mjs',packages:'external',logLevel:'error',plugins:[{name:'no-remote-services',setup(b){b.onResolve({filter:/services\/supabaseClient\.js$/},()=>({path:path.resolve('scripts/audit/fixture-client.mjs')}));b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));}}]});
try{results.screens=(await import('./.generated/screen-smoke.mjs?'+Date.now())).outcomes;}catch(error){results.screens=[{status:'FAIL',message:error.stack}];}
const relations=new Map(),rpcs=new Map();
for(const file of [...source,...edges]){
 const text=fs.readFileSync(file,'utf8');
 for(const match of text.matchAll(/\.(from|rpc)\(\s*['"]([^'"]+)['"]/g)){
  if(match[1]==='from'&&/storage\s*$/.test(text.slice(Math.max(0,match.index-12),match.index)))continue;
  const map=match[1]==='from'?relations:rpcs;map.set(match[2],[...(map.get(match[2])||[]),file]);
 }
 for(const match of text.matchAll(/(?:src|poster)=["'](\/[^"']+)["']/g)){
  const resource=match[1].split(/[?#]/)[0];if(!fs.existsSync('public'+resource)&&!resource.startsWith('/src/'))results.missingAssets.push({file,resource});
 }
}
const local=JSON.parse(fs.readFileSync('docs/audit/local-test-cluster.json','utf8'));
if(local.port!==55439||!local.database?.startsWith('trainai_audit_'))throw Error('Isolated fixture required');
const db=new Client({host:'127.0.0.1',port:local.port,user:'audit_owner',database:local.database});await db.connect();
try{
 const tables=new Set((await db.query("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','v','m','p')")).rows.map(row=>row.relname));
 const funcs=new Set((await db.query("select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'")).rows.map(row=>row.proname));
 results.databaseContracts={literalTables:relations.size,literalRpcs:rpcs.size,missingRelations:[...relations].filter(([name])=>!tables.has(name)).map(([name,files])=>({name,files:[...new Set(files)]})),missingRpcs:[...rpcs].filter(([name])=>!funcs.has(name)).map(([name,files])=>({name,files:[...new Set(files)]}))};
 results.tablesWithoutRls=(await db.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity order by c.relname")).rows;
}finally{await db.end();}
fs.writeFileSync('docs/audit/website-inventory.json',JSON.stringify(results,null,2));
console.log(JSON.stringify({modules:results.sourceModules,handlers:results.edgeHandlers,syntaxFailures:results.syntax.filter(row=>row.status==='FAIL'),screens:results.screens.length,renderFailures:results.screens.filter(row=>row.status==='FAIL'),missingAssets:results.missingAssets,...results.databaseContracts,tablesWithoutRls:results.tablesWithoutRls},null,2));
if(results.syntax.some(row=>row.status==='FAIL')||results.screens.some(row=>row.status==='FAIL'))process.exitCode=1;
