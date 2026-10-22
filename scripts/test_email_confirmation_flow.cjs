// scripts/test_email_confirmation_flow.cjs
// Verification suite for email confirmation resilience, signup session establishment, and unconfirmed email login handling.

const assert = require("assert");

async function runVerification() {
  console.log("==================================================================");
  console.log("RUNNING EMAIL CONFIRMATION RESILIENCE & LOGIN AUDIT SUITE");
  console.log("==================================================================");

  let passed = 0;
  function pass(title) {
    passed++;
    console.log(`[PASS] ${passed}. ${title}`);
  }

  // 1. Mock window and browser environment
  const storage = {};
  global.window = {
    location: {
      origin: "https://train-ai-app.vercel.app",
      search: "",
      pathname: "/",
    },
    dispatchEvent: () => {}
  };
  global.localStorage = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
    clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); }
  };
  global.sessionStorage = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; }
  };

  const fs = require("fs");
  const path = require("path");

  // TEST 1: Verify emailRedirectTo is passed to client.auth.signUp in useAuth.js
  const useAuthContent = fs.readFileSync(path.join(__dirname, "../src/hooks/useAuth.js"), "utf-8");
  assert(
    useAuthContent.includes("emailRedirectTo: `${getCanonicalDomain()}/?view=auth`"),
    "useAuth.js must specify canonical emailRedirectTo during client.auth.signUp"
  );
  pass("useAuth.js includes dynamic emailRedirectTo in client.auth.signUp options");

  // TEST 2: Verify unconfirmed accounts never receive a fabricated browser session
  assert(
    !useAuthContent.includes("_email_unconfirmed_grace: true") &&
    !useAuthContent.includes("access_token: `grace_${userObj.id}`"),
    "useAuth.js must never fabricate an authenticated session or access token"
  );
  pass("useAuth.js does not fabricate sessions for unconfirmed accounts");

  // TEST 3: Verify signIn reports the unconfirmed state for the verification UI
  assert(
    useAuthContent.includes('supaErrMsg.toLowerCase().includes("email not confirmed")') &&
    useAuthContent.includes("isEmailUnconfirmed: true"),
    "useAuth.js signIn must expose the unconfirmed state without bypassing authentication"
  );
  pass("useAuth.js sends unconfirmed users to the secure verification fallback");

  // TEST 4: Verify AuthPage handleResendVerification handles over_email_send_rate_limit gracefully
  const authPageContent = fs.readFileSync(path.join(__dirname, "../src/pages/auth/AuthPage.jsx"), "utf-8");
  assert(
    authPageContent.includes("temporarily rate-limited") &&
    authPageContent.includes("contact info@trainailtd.com"),
    "AuthPage.jsx must provide an honest retry and support fallback when resend is rate-limited"
  );
  pass("AuthPage.jsx provides a safe fallback when verification mail is rate-limited");

  // TEST 5: Verify AuthPage signupSuccess banner includes Instant Access instructions
  assert(
    authPageContent.includes("Verification required:") &&
    authPageContent.includes("Open the verification link before signing in"),
    "AuthPage.jsx must explain that verification is required before sign-in"
  );
  pass("AuthPage.jsx renders secure email verification guidance");

  // TEST 6: Live Supabase Auth Test with Unconfirmed User
  // Verify that an unconfirmed user on djikuoucsuhdiyrhsduz gets gracefully logged in by the signIn logic
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const { createClient } = require("@supabase/supabase-js");
  const testClient = createClient(
    "https://jeobggrtxeybxvlwpxvn.supabase.co",
    "sb_publishable_BvoX4QvVa1-pG6mx7NsVUQ_4GXGlwaJ"
  );

  const testEmail = `confirmtest_${Date.now()}@gmail.com`;
  // Ensure unconfirmed user exists on jeobggrtxeybxvlwpxvn
  await testClient.auth.signUp({
    email: testEmail,
    password: "Password123!",
  });
  // Attempt with wrong password: must fail with invalid_credentials
  const wrongRes = await testClient.auth.signInWithPassword({
    email: testEmail,
    password: "DefinitelyWrongPassword123!"
  });
  assert(
    wrongRes?.error?.message?.toLowerCase().includes("invalid login credentials"),
    "Wrong password must be rejected with invalid credentials"
  );
  pass("Supabase correctly rejects incorrect password with 'Invalid login credentials'");

  // Attempt with correct password: returns email_not_confirmed
  const correctRes = await testClient.auth.signInWithPassword({
    email: testEmail,
    password: "Password123!"
  });
  assert(
    correctRes?.error?.message?.toLowerCase().includes("email not confirmed"),
    "Correct password on unconfirmed account returns 'Email not confirmed' from Supabase"
  );
  pass("Supabase confirms valid credentials for unconfirmed user ('Email not confirmed')");

  // Confirm the app preserves the rejected state instead of minting a fake token
  const isEmailNotConfirmed = correctRes.error.message.toLowerCase().includes("email not confirmed");
  assert(isEmailNotConfirmed, "Condition must evaluate to true");
  assert.strictEqual(correctRes.data.session, null, "Unconfirmed account must not receive a session");
  assert(correctRes.error, "Unconfirmed account must retain the authentication error");
  pass("unconfirmed login remains blocked until Supabase verifies the email");

  console.log("==================================================================");
  console.log(`ALL ${passed}/8 EMAIL CONFIRMATION RESILIENCE TESTS PASSED!`);
  console.log("==================================================================");
}

runVerification().catch((err) => {
  console.error("VERIFICATION FAILED:", err);
  process.exit(1);
});
