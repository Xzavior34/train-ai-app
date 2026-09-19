import fs from 'fs';
import path from 'path';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const PROJECT_REF = "jeobggrtxeybxvlwpxvn";
const MANAGEMENT_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MGMT_TOKEN || "";

async function main() {
  const funcPath = path.resolve('supabase/functions/reset-password/index.ts');
  const code = fs.readFileSync(funcPath, 'utf8');

  console.log("Deploying reset-password Edge Function to Supabase project:", PROJECT_REF);
  
  // First check if function already exists
  const listRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/functions`, {
    headers: { 'Authorization': `Bearer ${MANAGEMENT_TOKEN}` }
  });
  const functions = await listRes.json();
  const existing = Array.isArray(functions) ? functions.find(f => f.slug === 'reset-password') : null;

  let url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions`;
  let method = 'POST';

  if (existing) {
    console.log("Function already exists, patching...");
    url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/${existing.slug}`;
    method = 'PATCH';
  }

  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${MANAGEMENT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      slug: 'reset-password',
      name: 'reset-password',
      body: code,
      verify_jwt: false
    })
  });

  const responseText = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", responseText);
}

main().catch(console.error);
