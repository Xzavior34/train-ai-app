import fs from 'fs';
import path from 'path';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const PROJECT_REF = "jeobggrtxeybxvlwpxvn";
let MANAGEMENT_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MGMT_TOKEN;

if (!MANAGEMENT_TOKEN) {
  for (const envFile of ['.env.local', '.env']) {
    const envPath = path.resolve(envFile);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/^SUPABASE_(?:ACCESS|MGMT)_TOKEN\s*=\s*["']?([^"'\r\n]+)["']?/m);
      if (match && match[1]) {
        MANAGEMENT_TOKEN = match[1].trim();
        break;
      }
    }
  }
}

if (!MANAGEMENT_TOKEN) {
  console.error("ERROR: Set SUPABASE_ACCESS_TOKEN or SUPABASE_MGMT_TOKEN env var, or add it to .env.local before running this script.");
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
  if (!res.ok) {
    throw new Error(`Deployment failed for ${slug}: ${res.status} - ${responseText}`);
  }
}

async function main() {
  await deployFunction('ai-chat', 'ai-chat', 'supabase/functions/ai-chat/index.ts');
  await deployFunction('ai-generate-quiz', 'ai-generate-quiz', 'supabase/functions/ai-generate-quiz/index.ts');
  await deployFunction('ai-insights', 'ai-insights', 'supabase/functions/ai-insights/index.ts');
  await deployFunction('generate-ai-recommendations', 'generate-ai-recommendations', 'supabase/functions/generate-ai-recommendations/index.ts');
  console.log("All AI Edge Functions successfully deployed!");
}

main().catch(err => {
  console.error("Deployment error:", err);
  process.exit(1);
});
