import {build} from 'esbuild';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
fs.mkdirSync('scripts/audit/.generated',{recursive:true});
await build({entryPoints:['scripts/audit/render-community.jsx'],bundle:true,platform:'node',format:'cjs',packages:'external',outfile:'scripts/audit/.generated/community.cjs',logLevel:'error'});
const result=spawnSync(process.execPath,['scripts/audit/.generated/community.cjs'],{encoding:'utf8',windowsHide:true});
console.log(result.stdout);if(result.status){console.error(result.stderr);process.exitCode=result.status;}
