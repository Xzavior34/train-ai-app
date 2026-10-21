import fs from 'node:fs';
import path from 'node:path';
import { build, transform } from 'esbuild';

function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(item=>item.isDirectory()?walk(path.join(dir,item.name)):[path.join(dir,item.name).replaceAll('\\','/')]);}
const source=walk('src').filter(file=>/\.[jt]sx?$/.test(file));
const edges=[];
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
const props={orgId:'demo-org-id',organizationId:'demo-org-id',userId:'fixture-user',currentUserId:'fixture-user',mentorId:'fixture-mentor',profileQuery:{...query,data:{display_name:'Fixture User',role:'admin',organization_id:'demo-org-id'}},session:{user:{id:'fixture-user',email:'fixture@example.invalid'}},userRoles:['admin'],courses:[],cohorts:[],members:[],enrollments:[],notifications:[],params:{},user:{name:'Fixture User',email:'fixture@example.invalid'},completedLessonIds:new Set(),quizzesQuery:{...query,data:[]},quizHistory:[],weakAreas:[],quizAnswers:{},quizIndex:0,coachInput:'',sessionTopicInput:'',noteInputText:'',screen:'dashboard',back:noop,onBack:noop,push:noop,setScreen:noop,onNavigate:noop,showToast:noop,onClose:noop,onGoHome:noop,onSignIn:noop,onSignUp:noop,onSignOut:noop};
const cases=[${entries.map((item,i)=>`{file:${JSON.stringify(item.file)},name:${JSON.stringify(item.name)},Component:Screen${i}}`).join(',')}];
export const outcomes=cases.map(item=>{try{const html=renderToString(React.createElement(item.Component,props));return {file:item.file,name:item.name,status:'PASS',renderedBytes:html.length};}catch(error){return {file:item.file,name:item.name,status:'FAIL',message:error.message};}});
`;
fs.writeFileSync('scripts/audit/.generated/screen-entry.jsx',entry);
await build({entryPoints:['scripts/audit/.generated/screen-entry.jsx'],bundle:true,platform:'node',format:'esm',outfile:'scripts/audit/.generated/screen-smoke.mjs',packages:'external',logLevel:'error',plugins:[{name:'no-remote-services',setup(b){b.onResolve({filter:/(?:^|[\\/])supabaseClient\.js$/},()=>({path:path.resolve('scripts/audit/fixture-client.mjs')}));b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));}}]});
try{results.screens=(await import('./.generated/screen-smoke.mjs?'+Date.now())).outcomes;}catch(error){results.screens=[{status:'FAIL',message:error.stack}];}
fs.writeFileSync('docs/audit/page-render-results.json',JSON.stringify({modules:results.sourceModules,screens:results.screens,syntax:results.syntax},null,2));
console.log(JSON.stringify(results.screens.filter(row=>row.status==='FAIL')));
console.log(results.screens.length+' screen renders checked');
if(results.screens.some(row=>row.status==='FAIL'))process.exitCode=1;
