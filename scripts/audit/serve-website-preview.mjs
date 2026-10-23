import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { build } from 'esbuild';
fs.mkdirSync('scripts/audit/.generated',{recursive:true});
await build({entryPoints:['scripts/audit/website-preview.jsx'],bundle:true,format:'esm',outdir:'scripts/audit/.generated/website',loader:{'.png':'file','.jpg':'file','.svg':'file'},logLevel:'error',define:{'import.meta.env':'{}'},plugins:[{name:'isolated-services',setup(b){
 b.onLoad({filter:/[\\/]useSupabaseQuery\.js$/},async args=>({contents:(await fs.promises.readFile(args.path,'utf8')).replace('Promise.resolve().then(fetcher)','Promise.resolve().then(async () => { globalThis.__auditQueries?.push(fetcher.toString()); const slow = (globalThis.__auditSlowQueries || []).some(name => fetcher.toString().includes(name)); const delay = slow ? globalThis.__auditSlowDelay : globalThis.__auditQueryDelay; if (delay) await new Promise(resolve => setTimeout(resolve, delay)); return fetcher(); })'),loader:'js'}));
 b.onLoad({filter:/[\\/]api[\\/](platform|learner|schemaHelper)\.js$/},async args=>({contents:(await fs.promises.readFile(args.path,'utf8')).replace(/export async function (fetch\w+)\(([^)]*)\) \{/g, '$& globalThis.__auditApiCalls?.push("$1");'),loader:'js'}));
 b.onLoad({filter:/[\\/]authService\.js$/},async args=>({contents:(await fs.promises.readFile(args.path,'utf8')).replace('export async function fetchMyRoles() {','export async function fetchMyRoles() { if (globalThis.__auditRoleError) throw globalThis.__auditRoleError;'),loader:'js'}));
 b.onResolve({filter:/capProgram\.js$/},()=>({path:path.resolve('scripts/audit/cap-fixture-service.mjs')}));
 b.onResolve({filter:/schemaHelper\.js$/}, args => args.importer.endsWith('CommunityFeedScreen.jsx') ? {path:path.resolve('scripts/audit/feed-fixture-service.mjs')} : undefined);
 b.onResolve({filter:/(?:^|[\\/])supabaseClient\.js$/},()=>({path:path.resolve('scripts/audit/fixture-client.mjs')}));
 b.onResolve({filter:/^react-onesignal$/},()=>({path:'onesignal',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export default {init:async()=>{},login:async()=>{},logout:async()=>{},Notifications:{addEventListener:()=>{},removeEventListener:()=>{},requestPermission:async()=>false},User:{PushSubscription:{optIn:async()=>{},optOut:async()=>{},addEventListener:()=>{},removeEventListener:()=>{}}}};'}));
}}]});
if (process.argv.includes('--build-only')) process.exit(0);
const html='<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Train AI local website audit</title><link rel="stylesheet" href="/website-preview.css"></head><body><div id="root"></div><script type="module" src="/website-preview.js"></script></body></html>';
const mime={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json','.ico':'image/x-icon'};
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:5188');
 if(url.pathname==='/audit-mobile'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html><head><title>390px responsive audit</title></head><body style="margin:0"><iframe title="390px mobile website" src="/" style="width:390px;height:844px;border:0"></iframe></body></html>');return;}
 let name;try{name=decodeURIComponent(url.pathname);}catch{res.writeHead(400);res.end();return;}
 for(const root of ['scripts/audit/.generated/website','public']){
  const base=path.resolve(root),file=path.resolve(base,'.'+name);
  if(file.startsWith(base+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));return;}
 }
 if(path.extname(name)){res.writeHead(404);res.end('Not found');return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);
}).listen(5188,'127.0.0.1',()=>console.log('Isolated full website fixture: http://127.0.0.1:5188'));
