#!/usr/bin/env node
/**
 * deploy-signup-edge-function.mjs
 *
 * Deploys the updated send-signup-confirmation Edge Function to Supabase.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=<your-pat> node --use-system-ca scripts/deploy-signup-edge-function.mjs
 *
 * Get your PAT from: https://supabase.com/dashboard/account/tokens
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Attempt to load token from environment, .env.local, or .env
let TOKEN = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MGMT_TOKEN;

if (!TOKEN) {
  for (const envFile of ['.env.local', '.env']) {
    const envPath = path.resolve(__dirname, '..', envFile);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/^SUPABASE_(?:ACCESS|MGMT)_TOKEN\s*=\s*["']?([^"'\r\n]+)["']?/m);
      if (match && match[1]) {
        TOKEN = match[1].trim();
        break;
      }
    }
  }
}

if (!TOKEN) {
  console.error('ERROR: Set SUPABASE_ACCESS_TOKEN env var or add it to .env.local.');
  console.error('Get your PAT from: https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}

const fnPath = path.resolve(__dirname, '../supabase/functions/send-signup-confirmation/index.ts');
const code = fs.readFileSync(fnPath, 'utf8');
const slug = 'send-signup-confirmation';

console.log(`Deploying ${slug} to project ${PROJECT_REF}...`);

// Check if function exists
const listRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/functions`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
if (!listRes.ok) {
  console.error('Failed to list functions:', listRes.status, await listRes.text());
  process.exit(1);
}
const functions = await listRes.json();
const existing = Array.isArray(functions) ? functions.find(f => f.slug === slug) : null;

const url = existing
  ? `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/${slug}`
  : `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions`;
const method = existing ? 'PATCH' : 'POST';

const deployRes = await fetch(url, {
  method,
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ slug, name: slug, body: code, verify_jwt: false }),
});

const body = await deployRes.text();
if (!deployRes.ok) {
  console.error('Deploy failed:', deployRes.status, body);
  process.exit(1);
}

console.log('✅ Deployed successfully:', JSON.parse(body)?.id || body);
