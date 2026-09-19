import fs from 'fs';
import path from 'path';

const PROJECT_REF = "jeobggrtxeybxvlwpxvn";
const MANAGEMENT_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MGMT_TOKEN;
if (!MANAGEMENT_TOKEN) {
  console.error("ERROR: Set SUPABASE_ACCESS_TOKEN or SUPABASE_MGMT_TOKEN env var before running this script.");
  process.exit(1);
}

async function deployFunction(slug, name, filePath) {
  const code = fs.readFileSync(path.resolve(filePath), 'utf8');
  console.log(`Deploying function '${slug}' from ${filePath} to project ${PROJECT_REF}...`);

  const listRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/functions`, {
    headers: { 'Authorization': `Bearer ${MANAGEMENT_TOKEN}` }
  });
  
  if (!listRes.ok) {
    const text = await listRes.text();
    throw new Error(`Failed to list Edge Functions: HTTP ${listRes.status} - ${text}`);
  }

  const functions = await listRes.json();
  const existing = Array.isArray(functions) ? functions.find(f => f.slug === slug) : null;

  let url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions`;
  let method = 'POST';

  if (existing) {
    console.log(`Function '${slug}' already exists (ID: ${existing.id}), updating via PATCH...`);
    url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/${slug}`;
    method = 'PATCH';
  }

  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${MANAGEMENT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      slug,
      name,
      body: code,
      verify_jwt: false
    })
  });

  const responseText = await res.text();
  console.log(`Deploy '${slug}' response status:`, res.status);
  console.log(`Deploy '${slug}' response body:`, responseText);
  if (!res.ok) {
    throw new Error(`Deployment failed for ${slug}: ${res.status} - ${responseText}`);
  }
}

async function main() {
  await deployFunction('send-certificate-email', 'send-certificate-email', 'supabase/functions/send-certificate-email/index.ts');
  await deployFunction('send-signup-confirmation', 'send-signup-confirmation', 'supabase/functions/send-signup-confirmation/index.ts');
  console.log("All email Edge Functions successfully deployed!");
}

main().catch(err => {
  console.error("Deployment error:", err);
  process.exit(1);
});
