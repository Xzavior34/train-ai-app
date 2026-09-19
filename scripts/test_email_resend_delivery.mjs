import fs from 'fs';
import path from 'path';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const PROJECT_REF = "jeobggrtxeybxvlwpxvn";
const MANAGEMENT_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MGMT_TOKEN || "";
const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";

async function runSql(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MANAGEMENT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`SQL Error (${res.status}): ${errText}`);
  }
  return await res.json();
}

async function main() {
  console.log("=== STARTING COMPLETE TRANSACTIONAL EMAIL & RESEND VERIFICATION ===");

  // 1. Setup Multi-Tenant Test Organizations
  console.log("\n[Step 1] Creating isolated QA Organizations: EMAIL_QA_ORG_A & EMAIL_QA_ORG_B...");
  await runSql(`
    DELETE FROM user_invitations WHERE email LIKE '%@emailqaa.com' OR email LIKE '%@emailqab.com';
    DELETE FROM user_profiles WHERE id IN (SELECT id FROM auth.users WHERE email LIKE '%@emailqaa.com' OR email LIKE '%@emailqab.com');
    DELETE FROM auth.users WHERE email LIKE '%@emailqaa.com' OR email LIKE '%@emailqab.com';
    DELETE FROM organizations WHERE name IN ('EMAIL_QA_ORG_A', 'EMAIL_QA_ORG_B');

    INSERT INTO organizations (id, name, slug) VALUES 
      ('00000000-0000-4000-a000-00000000000a', 'EMAIL_QA_ORG_A', 'email-qa-org-a'),
      ('00000000-0000-4000-a000-00000000000b', 'EMAIL_QA_ORG_B', 'email-qa-org-b');

    INSERT INTO user_invitations (id, email, organization_id, role, token, status) VALUES 
      ('00000000-0000-4000-a000-111111111111', 'qa_user_a@emailqaa.com', '00000000-0000-4000-a000-00000000000a', 'learner', 'token_qa_a', 'pending'),
      ('00000000-0000-4000-a000-222222222222', 'qa_user_b@emailqab.com', '00000000-0000-4000-a000-00000000000b', 'learner', 'token_qa_b', 'pending');
  `);

  // 2. Test Multi-Tenant Organization Name Resolution
  console.log("\n[Step 2] Testing multi-tenant RPC organization name resolution...");
  const orgRes = await runSql(`
    SELECT 
      get_user_org_name('qa_user_a@emailqaa.com') as org_a,
      get_user_org_name('qa_user_b@emailqab.com') as org_b,
      get_user_org_name('info@sarafoundationafrica.com') as org_sara,
      get_user_org_name('trainailtd@gmail.com') as org_train;
  `);

  const row = orgRes[0];
  console.log("Resolved Organizations:", JSON.stringify(row, null, 2));

  if (row.org_a !== 'EMAIL_QA_ORG_A') {
    throw new Error(`Org A resolution mismatch! Expected 'EMAIL_QA_ORG_A', got '${row.org_a}'`);
  }
  if (row.org_b !== 'EMAIL_QA_ORG_B') {
    throw new Error(`Org B resolution mismatch! Expected 'EMAIL_QA_ORG_B', got '${row.org_b}'`);
  }
  if (row.org_sara !== 'Sara Foundation Africa') {
    throw new Error(`Sara Foundation resolution mismatch! Expected 'Sara Foundation Africa', got '${row.org_sara}'`);
  }
  if (row.org_train !== 'Train AI Platform') {
    throw new Error(`Train AI Platform resolution mismatch! Expected 'Train AI Platform', got '${row.org_train}'`);
  }
  console.log("✅ Dynamic Multi-Tenant Organization Resolution PASSED!");

  // 3. Test Resend Delivery for Password Reset Edge Function
  console.log("\n[Step 3] Verifying real Resend delivery via Edge Function for info@sarafoundationafrica.com...");
  const resetSaraRes = await fetch(`${SUPABASE_URL}/functions/v1/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'info@sarafoundationafrica.com', origin: 'https://trainai.app' })
  });
  const resetSaraData = await resetSaraRes.json();
  console.log("Sara Foundation Resend Dispatch Output:", JSON.stringify(resetSaraData, null, 2));

  if (!resetSaraData.emailSent || !resetSaraData.resend_response?.id) {
    throw new Error(`Resend API dispatch failed! ${JSON.stringify(resetSaraData.resend_response)}`);
  }
  if (resetSaraData.organization_name !== 'Sara Foundation Africa') {
    throw new Error(`Edge function org branding mismatch! Expected 'Sara Foundation Africa', got '${resetSaraData.organization_name}'`);
  }
  if (!resetSaraData.reset_url || resetSaraData.reset_url.includes('localhost')) {
    throw new Error(`Reset link contains localhost or is invalid! got '${resetSaraData.reset_url}'`);
  }

  console.log(`✅ Resend Email Delivered Successfully! Message ID: ${resetSaraData.resend_response.id}`);
  console.log(`✅ Branded Reset URL: ${resetSaraData.reset_url}`);

  // 4. QA Cleanup
  console.log("\n[Step 4] Performing QA Cleanup (Deleting test orgs and test users)...");
  await runSql(`
    DELETE FROM user_invitations WHERE email LIKE '%@emailqaa.com' OR email LIKE '%@emailqab.com';
    DELETE FROM user_profiles WHERE id IN (SELECT id FROM auth.users WHERE email LIKE '%@emailqaa.com' OR email LIKE '%@emailqab.com');
    DELETE FROM auth.users WHERE email LIKE '%@emailqaa.com' OR email LIKE '%@emailqab.com';
    DELETE FROM organizations WHERE name IN ('EMAIL_QA_ORG_A', 'EMAIL_QA_ORG_B');
  `);

  const checkOrgs = await runSql(`SELECT COUNT(*) as cnt FROM organizations WHERE name IN ('EMAIL_QA_ORG_A', 'EMAIL_QA_ORG_B')`);
  console.log(`Cleaned up QA orgs count: ${checkOrgs[0].cnt}`);
  if (parseInt(checkOrgs[0].cnt) !== 0) {
    throw new Error("QA Orgs were not completely cleaned up!");
  }
  console.log("✅ QA Cleanup completed successfully!");

  console.log("\n=== ALL EMAIL DELIVERY & BRANDING VERIFICATIONS PASSED ===");
}

main().catch(e => {
  console.error("❌ VERIFICATION FAILED:", e);
  process.exit(1);
});
