import fs from 'fs';
import path from 'path';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'jeobggrtxeybxvlwpxvn';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
const sqlPath = path.resolve('./supabase/migrations/0171_tier_pricing_and_10x_credit_scaling.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

async function main() {
  console.log('Executing migration 0171 via Supabase Management API...');
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  const text = await res.text();
  console.log('Response status:', res.status);
  console.log('Response body:', text);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
