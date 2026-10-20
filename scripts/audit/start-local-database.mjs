import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const configPath='docs/audit/local-test-cluster.json';
const bin=process.env.AUDIT_PG_BIN || 'C:/Program Files/PostgreSQL/18/bin';
const existing=fs.existsSync(configPath)?JSON.parse(fs.readFileSync(configPath,'utf8')):null;
const local=existing || {dir:fs.mkdtempSync(path.join(os.tmpdir(),'trainai-audit-pg-')),port:55439,bin};
const target=fs.realpathSync.native(local.dir);
const tempRoot=fs.realpathSync.native(os.tmpdir());
if(!target.toLowerCase().startsWith((tempRoot+path.sep).toLowerCase()) || !path.basename(target).startsWith('trainai-audit-pg-') || local.port!==55439) throw Error('Refusing non-fixture database directory');
const run=(name,args,stdio='ignore')=>spawnSync(path.join(local.bin,name+'.exe'),args,{windowsHide:true,stdio,timeout:15000});
if(!fs.existsSync(path.join(target,'data','PG_VERSION'))) {
 const result=run('initdb',['-D',path.join(target,'data'),'-U','audit_owner','-A','trust','--no-locale','--encoding=UTF8']);
 if(result.status!==0)throw Error('Local fixture initialization failed');
}
fs.writeFileSync(configPath,JSON.stringify(local));
if(run('pg_isready',['-h','127.0.0.1','-p','55439']).status!==0) {
 const result=run('pg_ctl',['-D',path.join(target,'data'),'-l',path.join(target,'server.log'),'-o','-p 55439 -h 127.0.0.1','-w','start']);
 if(result.status!==0 && run('pg_isready',['-h','127.0.0.1','-p','55439']).status!==0)throw Error('Local fixture startup failed; inspect its server.log');
}
console.log('Local fixture ready on 127.0.0.1:55439. No production connection is used.');
