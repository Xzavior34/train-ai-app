import fs from 'node:fs';
import {Client} from 'pg';
const local=JSON.parse(fs.readFileSync('docs/audit/local-test-cluster.json','utf8'));
const c=new Client({host:'127.0.0.1',port:55439,user:'audit_owner',database:local.database});await c.connect();
try{for(const file of ['cleanup-dry-run.sql','kpi-readonly.sql','deployment-preflight.sql']){await c.query(fs.readFileSync('scripts/audit/'+file,'utf8'));console.log('PASS read-only SQL:',file);}}finally{await c.end();}
