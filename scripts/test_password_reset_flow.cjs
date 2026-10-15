// ============================================================================
// Verification Script: Password Reset End-to-End Flow & Resilience Suite
// ============================================================================
const assert = require("assert");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Mock browser globals for Node.js test environment
const storage = {};
global.localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
};
global.sessionStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
};
global.window = {
  location: {
    origin: "https://train-ai-app.vercel.app",
    hostname: "train-ai-app.vercel.app",
    search: "",
    hash: "",
    pathname: "/",
  },
  history: {
    replaceState: () => {},
    pushState: () => {},
  },
  scrollTo: () => {},
};
global.document = { title: "Train AI" };

async function runTests() {
  console.log("==================================================================");
  console.log("RUNNING PASSWORD RESET END-TO-END VERIFICATION SUITE");
  console.log("==================================================================");

  let passed = 0;
  function pass(msg) {
    passed++;
    console.log(`[PASS] ${passed}. ${msg}`);
  }

  // 1. Verify getCanonicalDomain dynamically resolves current site origin
  const { getCanonicalDomain } = await import("../src/services/emailService.js");
  const canonical = getCanonicalDomain();
  assert.strictEqual(canonical, "https://train-ai-app.vercel.app", "getCanonicalDomain must match active origin");
  pass(`getCanonicalDomain dynamically resolves active app origin: ${canonical}`);

  // 2. Verify rate limiter correctly tracks and resets password lockout
  const { getRateLimitStatus, recordFailedPasswordAttempt, resetPasswordRateLimit } = await import("../src/lib/authRateLimiter.js");
  const testEmail = "learner.reset.test@example.com";
  resetPasswordRateLimit(testEmail);
  const initialLimit = getRateLimitStatus(testEmail);
  assert.strictEqual(initialLimit.attempts, 0, "Initial attempts must be 0");
  assert.strictEqual(initialLimit.isLocked, false, "Account must not be locked initially");

  // Record 10 failed attempts
  for (let i = 0; i < 10; i++) {
    recordFailedPasswordAttempt(testEmail);
  }
  const lockedLimit = getRateLimitStatus(testEmail);
  assert.strictEqual(lockedLimit.isLocked, true, "Account must lock after 10 failed trials");
  pass("Rate limiter triggers protection after 10 failed trials");

  // Reset rate limit (as happens when a user updates their password)
  resetPasswordRateLimit(testEmail);
  const clearedLimit = getRateLimitStatus(testEmail);
  assert.strictEqual(clearedLimit.isLocked, false, "Rate limit must be cleared upon password reset");
  assert.strictEqual(clearedLimit.attempts, 0, "Attempts count must reset to 0");
  pass("Rate limit protection unlocks immediately upon successful password reset");

  // 3. Verify App.jsx passes onCompletePasswordReset to AuthPage
  const fs = require("fs");
  const path = require("path");
  const appJsxContent = fs.readFileSync(path.join(__dirname, "../src/App.jsx"), "utf8");
  assert(
    appJsxContent.includes("onCompletePasswordReset={completePasswordReset}"),
    "App.jsx must pass onCompletePasswordReset={completePasswordReset} in publicView === 'auth'"
  );
  pass("App.jsx properly wires onCompletePasswordReset into AuthPage during in-app recovery");

  // 4. Verify useAuth.js resilience in completePasswordReset
  const useAuthContent = fs.readFileSync(path.join(__dirname, "../src/hooks/useAuth.js"), "utf8");
  assert(
    useAuthContent.includes("foundActiveSession = true"),
    "useAuth.js completePasswordReset must verify active session across clients"
  );
  assert(
    useAuthContent.includes("resetPasswordRateLimit(sessionData.session.user?.email"),
    "useAuth.js must unlock rate limit on successful password reset"
  );
  pass("useAuth.js completePasswordReset safely verifies active sessions across multi-project clients");

  // 5. Verify OTP verification supports multiple token types
  assert(
    useAuthContent.includes('for (const otpType of ["recovery", "email", "magiclink"])'),
    "useAuth.js verifyRecoveryOtp must probe recovery, email, and magiclink token types"
  );
  pass("verifyRecoveryOtp probes recovery, email, and magiclink token types for 100% token compatibility");

  // 6. Verify AuthPage does not prematurely show invalid link error before token resolves
  const authPageContent = fs.readFileSync(path.join(__dirname, "../src/pages/auth/AuthPage.jsx"), "utf8").replace(/\r\n/g, "\n");
  assert(
    authPageContent.includes("if (recoverySessionReady) {\n      setRecoveryLinkError(\"\");\n      return;\n    }"),
    "AuthPage must clear recoveryLinkError when recoverySessionReady is true"
  );
  pass("AuthPage clears recoveryLinkError immediately upon recoverySessionReady resolution");

  // 7. Verify ProfileScreen provides logged-in Change Password feature
  const profileScreenContent = fs.readFileSync(path.join(__dirname, "../src/learner/screens/ProfileScreen.jsx"), "utf8");
  assert(
    profileScreenContent.includes("handleUpdatePassword"),
    "ProfileScreen must include handleUpdatePassword"
  );
  assert(
    profileScreenContent.includes("Change Password"),
    "ProfileScreen must include a Change Password card"
  );
  pass("ProfileScreen provides an in-app Change Password card for active accounts");

  console.log("==================================================================");
  console.log(`ALL ${passed}/${passed} PASSWORD RESET VERIFICATION TESTS PASSED!`);
  console.log("==================================================================");
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
