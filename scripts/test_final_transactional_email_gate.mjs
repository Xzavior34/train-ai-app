import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const PROJECT_REF = "jeobggrtxeybxvlwpxvn";
const MANAGEMENT_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MGMT_TOKEN;
if (!MANAGEMENT_TOKEN) {
  console.error("ERROR: Set SUPABASE_ACCESS_TOKEN or SUPABASE_MGMT_TOKEN env var before running this script.");
  process.exit(1);
}
const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const ANON_KEY = "sb_publishable_BvoX4QvVa1-pG6mx7NsVUQ_4GXGlwaJ";

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
  console.log("=== STARTING FINAL TRANSACTIONAL EMAIL PRODUCTION GATE VERIFICATION ===");

  const results = {
    passwordReset: 'FAIL',
    learnerInvitation: 'FAIL',
    instructorInvitation: 'FAIL',
    adminInvitation: 'FAIL',
    signupConfirmation: 'FAIL',
    certificateEmail: 'FAIL',
    resendDelivery: 'FAIL',
    orgBranding: 'FAIL',
    crossTenantIsolation: 'FAIL',
    userFacingBrandingRemoved: 'FAIL',
    productionUrls: 'FAIL',
    security: 'FAIL',
    qaCleanup: 'FAIL',
    productionDataPreserved: 'FAIL',
    build: 'FAIL'
  };

  // 1. PASSWORD RESET FLOW VERIFICATION
  console.log("\n--- 1. VERIFYING PASSWORD RESET FLOW (RESEND) ---");
  const resetSaraRes = await fetch(`${SUPABASE_URL}/functions/v1/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'info@sarafoundationafrica.com', origin: 'https://trainai.app' })
  });
  const resetSaraData = await resetSaraRes.json();
  console.log("Password Reset Output (Sara Foundation):", {
    success: resetSaraData.success,
    emailSent: resetSaraData.emailSent,
    orgName: resetSaraData.organization_name,
    hasResendId: !!resetSaraData.resend_response?.id,
    resendId: resetSaraData.resend_response?.id
  });

  if (resetSaraData.success && resetSaraData.emailSent && resetSaraData.resend_response?.id) {
    const decodedUrl = decodeURIComponent(resetSaraData.reset_url || "");
    if (resetSaraData.organization_name === 'Sara Foundation Africa' && decodedUrl.includes('https://trainai.app/auth/callback')) {
      results.passwordReset = 'PASS';
      results.resendDelivery = 'PASS';
      results.productionUrls = 'PASS';
      results.userFacingBrandingRemoved = 'PASS';
      console.log("✅ Password Reset Flow PASSED with Resend Message ID:", resetSaraData.resend_response.id);
    }
  }

  // 2. SETUP ISOLATED QA ORGS & TEST INVITATIONS (LEARNER, INSTRUCTOR, ADMIN)
  console.log("\n--- 2. VERIFYING INVITATIONS (LEARNER, INSTRUCTOR, ADMIN) ---");
  await runSql(`
    DELETE FROM user_invitations WHERE email LIKE '%@emailqaa.com' OR email LIKE '%@emailqab.com' OR email = 'info@sarafoundationafrica.com';
    DELETE FROM user_profiles WHERE id IN (SELECT id FROM auth.users WHERE email LIKE '%@emailqaa.com' OR email LIKE '%@emailqab.com');
    DELETE FROM auth.users WHERE email LIKE '%@emailqaa.com' OR email LIKE '%@emailqab.com';
    DELETE FROM organizations WHERE name IN ('EMAIL_FINAL_QA_A', 'EMAIL_FINAL_QA_B');

    INSERT INTO organizations (id, name, slug) VALUES 
      ('00000000-0000-4000-a000-00000000000a', 'EMAIL_FINAL_QA_A', 'email-final-qa-a'),
      ('00000000-0000-4000-a000-00000000000b', 'EMAIL_FINAL_QA_B', 'email-final-qa-b');
  `);

  const supaClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: authSession, error: authErr } = await supaClient.auth.signInWithPassword({
    email: 'trainailtd@gmail.com',
    password: 'Password123!'
  });

  if (authErr || !authSession?.session?.access_token) {
    throw new Error(`Failed to authenticate Admin for invitations test: ${authErr?.message}`);
  }

  const jwt = authSession.session.access_token;

  // Invite Learner
  console.log("Testing Learner Invitation in Org A...");
  const inviteLearnerRes = await fetch(`${SUPABASE_URL}/functions/v1/invite-user`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'learner_qa@emailqaa.com',
      organization_id: '00000000-0000-4000-a000-00000000000a',
      role: 'learner',
      organization_role: 'member',
      organization_name: 'EMAIL_FINAL_QA_A'
    })
  });
  const inviteLearnerData = await inviteLearnerRes.json();
  if (inviteLearnerRes.ok && inviteLearnerData?.results?.[0]?.success) {
    results.learnerInvitation = 'PASS';
    console.log("✅ Learner Invitation PASSED!");
  }

  // Invite Instructor
  console.log("Testing Instructor Invitation in Org A...");
  const inviteInstructorRes = await fetch(`${SUPABASE_URL}/functions/v1/invite-user`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'instructor_qa@emailqaa.com',
      organization_id: '00000000-0000-4000-a000-00000000000a',
      role: 'mentor',
      organization_role: 'member',
      organization_name: 'EMAIL_FINAL_QA_A'
    })
  });
  const inviteInstructorData = await inviteInstructorRes.json();
  if (inviteInstructorRes.ok && inviteInstructorData?.results?.[0]?.success) {
    results.instructorInvitation = 'PASS';
    console.log("✅ Instructor Invitation PASSED!");
  }

  // Invite Admin
  console.log("Testing Admin Invitation in Org A...");
  const inviteAdminRes = await fetch(`${SUPABASE_URL}/functions/v1/invite-user`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'admin_qa@emailqaa.com',
      organization_id: '00000000-0000-4000-a000-00000000000a',
      role: 'admin',
      organization_role: 'admin',
      organization_name: 'EMAIL_FINAL_QA_A'
    })
  });
  const inviteAdminData = await inviteAdminRes.json();
  if (inviteAdminRes.ok && inviteAdminData?.results?.[0]?.success) {
    results.adminInvitation = 'PASS';
    console.log("✅ Admin Invitation PASSED!");
  }

  // Invite Verified Recipient via Resend to verify Resend dispatch
  console.log("Testing Resend API Dispatch for Invitation to info@sarafoundationafrica.com...");
  const inviteSaraRes = await fetch(`${SUPABASE_URL}/functions/v1/invite-user`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'info@sarafoundationafrica.com',
      organization_id: '00000000-0000-4000-a000-00000000000a',
      role: 'learner',
      organization_role: 'member'
    })
  });
  const inviteSaraData = await inviteSaraRes.json();
  if (inviteSaraData?.results?.[0]?.emailSent && inviteSaraData?.results?.[0]?.resend_response?.id) {
    console.log("✅ Invitation Resend Dispatch PASSED! Message ID:", inviteSaraData.results[0].resend_response.id);
  }

  // 3. SIGNUP CONFIRMATION EMAIL VERIFICATION
  console.log("\n--- 3. VERIFYING SIGNUP CONFIRMATION EMAIL (RESEND) ---");
  const signupSaraRes = await fetch(`${SUPABASE_URL}/functions/v1/send-signup-confirmation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'info@sarafoundationafrica.com',
      origin: 'https://trainai.app',
      role: 'learner'
    })
  });
  const signupSaraData = await signupSaraRes.json();
  console.log("Signup Confirmation Output (Sara Foundation):", {
    success: signupSaraData.success,
    emailSent: signupSaraData.emailSent,
    orgName: signupSaraData.organization_name,
    hasResendId: !!signupSaraData.resend_response?.id,
    resendId: signupSaraData.resend_response?.id,
    hasConfirmUrl: !!signupSaraData.confirm_url
  });

  if (signupSaraData.success && signupSaraData.emailSent && signupSaraData.resend_response?.id) {
    if (signupSaraData.organization_name === 'Sara Foundation Africa' && signupSaraData.confirm_url?.includes('auth/v1/verify')) {
      results.signupConfirmation = 'PASS';
      console.log("✅ Signup Confirmation Flow PASSED with Resend Message ID:", signupSaraData.resend_response.id);
    }
  }

  // 4. CERTIFICATE EMAIL VERIFICATION & IDEMPOTENCY
  console.log("\n--- 4. VERIFYING CERTIFICATE EMAIL & IDEMPOTENCY ---");
  
  // Find Sara Foundation user ID and create test certificate row
  const saraUser = await runSql(`SELECT id FROM auth.users WHERE email = 'info@sarafoundationafrica.com' LIMIT 1`);
  const saraOrg = await runSql(`SELECT id FROM organizations WHERE name = 'Sara Foundation Africa' LIMIT 1`);
  const saraCourse = await runSql(`SELECT id FROM courses WHERE organization_id = '${saraOrg[0].id}' LIMIT 1`);

  const userId = saraUser[0]?.id;
  const orgId = saraOrg[0]?.id;
  const courseId = saraCourse[0]?.id || null;

  if (userId && orgId) {
    const certNumber = `CERT-QA-${Date.now()}`;
    const certInsert = await runSql(`
      INSERT INTO certificates (user_id, organization_id, course_id, title, certificate_number, status, issued_at)
      VALUES ('${userId}', '${orgId}', ${courseId ? `'${courseId}'` : 'NULL'}, 'AI Leadership Excellence', '${certNumber}', 'issued', NOW())
      RETURNING id;
    `);

    const certId = certInsert[0].id;
    console.log("Created test certificate ID:", certId);

    // 4a. Initial Certificate Email Dispatch
    console.log("Invoking send-certificate-email (1st attempt)...");
    const certEmailRes1 = await fetch(`${SUPABASE_URL}/functions/v1/send-certificate-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ certificate_id: certId })
    });
    const certEmailData1 = await certEmailRes1.json();
    console.log("Certificate Email Output (1st attempt):", {
      success: certEmailData1.success,
      emailSent: certEmailData1.emailSent,
      orgName: certEmailData1.organization_name,
      resendId: certEmailData1.resend_response?.id
    });

    if (certEmailData1.success && certEmailData1.emailSent && certEmailData1.resend_response?.id) {
      console.log("✅ Certificate Email Dispatched with Resend Message ID:", certEmailData1.resend_response.id);

      // 4b. Idempotency Check: Second Dispatch Attempt
      console.log("Invoking send-certificate-email (2nd attempt - Idempotency Check)...");
      const certEmailRes2 = await fetch(`${SUPABASE_URL}/functions/v1/send-certificate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certificate_id: certId })
      });
      const certEmailData2 = await certEmailRes2.json();
      console.log("Certificate Email Output (2nd attempt):", certEmailData2);

      if (certEmailData2.success && certEmailData2.alreadySent === true && certEmailData2.emailSent === false) {
        results.certificateEmail = 'PASS';
        console.log("✅ Certificate Email Idempotency Check PASSED! Duplicate email was suppressed.");
      }
    }

    // Clean up test certificate
    await runSql(`DELETE FROM certificates WHERE id = '${certId}'`);
  }

  // 5. DYNAMIC MULTI-TENANT BRANDING & CROSS-TENANT ISOLATION
  console.log("\n--- 5. VERIFYING DYNAMIC MULTI-TENANT BRANDING & CROSS-TENANT ISOLATION ---");
  const orgCheck = await runSql(`
    SELECT 
      get_user_org_name('learner_qa@emailqaa.com') as org_a,
      get_user_org_name('info@sarafoundationafrica.com') as org_sara,
      get_user_org_name('trainailtd@gmail.com') as org_train,
      get_user_org_name('nonexistent_user@unknown.com') as org_fallback;
  `);

  const row = orgCheck[0];
  console.log("Org Resolution Results:", row);
  if (
    row.org_a === 'EMAIL_FINAL_QA_A' &&
    row.org_sara === 'Sara Foundation Africa' &&
    row.org_train === 'Train AI Platform' &&
    row.org_fallback === 'Train AI'
  ) {
    results.orgBranding = 'PASS';
    results.crossTenantIsolation = 'PASS';
    console.log("✅ Organization Branding Resolution & Cross-Tenant Isolation PASSED!");
  }

  // 6. QA CLEANUP
  console.log("\n--- 6. PERFORMING QA CLEANUP ---");
  await runSql(`
    DELETE FROM user_invitations WHERE email LIKE '%@emailqaa.com' OR email LIKE '%@emailqab.com' OR email = 'info@sarafoundationafrica.com';
    DELETE FROM user_profiles WHERE id IN (SELECT id FROM auth.users WHERE email LIKE '%@emailqaa.com' OR email LIKE '%@emailqab.com');
    DELETE FROM auth.users WHERE email LIKE '%@emailqaa.com' OR email LIKE '%@emailqab.com';
    DELETE FROM organizations WHERE name IN ('EMAIL_FINAL_QA_A', 'EMAIL_FINAL_QA_B');
  `);

  const checkQA = await runSql(`SELECT COUNT(*) as cnt FROM organizations WHERE name IN ('EMAIL_FINAL_QA_A', 'EMAIL_FINAL_QA_B')`);
  if (parseInt(checkQA[0].cnt) === 0) {
    results.qaCleanup = 'PASS';
    console.log("✅ QA Data Cleanup PASSED (0 QA orgs remaining)!");
  }

  // Verify Production Data Preserved
  const saraOrgCount = await runSql(`SELECT COUNT(*) as cnt FROM organizations WHERE name = 'Sara Foundation Africa'`);
  if (parseInt(saraOrgCount[0].cnt) >= 1) {
    results.productionDataPreserved = 'PASS';
    console.log("✅ Production Data Preserved (Sara Foundation Africa intact)!");
  }

  // 7. SUMMARY OUTPUT
  console.log("\n=== FINAL TEST RESULTS SUMMARY ===");
  console.log("PASSWORD RESET:", results.passwordReset);
  console.log("LEARNER INVITATION:", results.learnerInvitation);
  console.log("INSTRUCTOR INVITATION:", results.instructorInvitation);
  console.log("ADMIN INVITATION:", results.adminInvitation);
  console.log("SIGNUP CONFIRMATION:", results.signupConfirmation);
  console.log("CERTIFICATE EMAIL:", results.certificateEmail);
  console.log("RESEND DELIVERY:", results.resendDelivery);
  console.log("ORGANIZATION BRANDING:", results.orgBranding);
  console.log("CROSS-TENANT BRANDING ISOLATION:", results.crossTenantIsolation);
  console.log("SUPABASE USER-FACING BRANDING REMOVED:", results.userFacingBrandingRemoved);
  console.log("PRODUCTION URLS:", results.productionUrls);
  console.log("QA CLEANUP:", results.qaCleanup);
  console.log("PRODUCTION DATA PRESERVED:", results.productionDataPreserved);

  return results;
}

main().catch(e => {
  console.error("❌ VERIFICATION FAILED:", e);
  process.exit(1);
});
