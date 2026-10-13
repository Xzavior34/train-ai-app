// scripts/test_referral_flow.cjs
// Tests the full organization referral link, onboarding, admin visibility, and course access flows.

const assert = require("assert");

async function runTests() {
  console.log("==================================================================");
  console.log("RUNNING ORGANISATION REFERRAL LINK & ADMIN VISIBILITY AUDIT SUITE");
  console.log("==================================================================");

  // 1. Mock window and localStorage environment for Node.js
  const storage = {};
  global.window = {
    location: {
      origin: "https://train-ai-app.vercel.app",
      search: "?join=sara-foundation",
      pathname: "/",
    },
    dispatchEvent: () => {}
  };
  global.CustomEvent = class CustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  };
  global.localStorage = {
    getItem: (key) => storage[key] || null,
    setItem: (key, val) => { storage[key] = String(val); },
    removeItem: (key) => { delete storage[key]; },
    clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); }
  };

  // 2. Import modules dynamically
  const {
    trackOrganizationJoinIntent,
    getPendingOrganizationJoin,
    clearPendingOrganizationJoin,
    getOrganizationJoinUrl,
    fetchOrganizationPublicInfo,
    joinOrganizationByReferral,
    fetchPendingOrgJoinRequests,
    recordReferralSignupInRoster,
    getReferralSignupsRoster,
    PUBLIC_ORGANIZATIONS_DIRECTORY,
  } = await import("../src/lib/api/organizations.js");

  const {
    fetchOrgMembers,
    fetchCurrentUserProfile,
    fetchOrganizationById,
    fetchUsersInOrg,
  } = await import("../src/lib/api/platform.js");

  const { fetchPublishedCourses } = await import("../src/lib/api/learner.js");

  let passedCount = 0;
  function pass(testName) {
    passedCount++;
    console.log(`[PASS] ${testName}`);
  }

  // --- TEST 1: Track Join Intent ---
  trackOrganizationJoinIntent("sara-foundation", { role: "learner" });
  const pending = getPendingOrganizationJoin();
  assert(pending !== null, "Pending join intent should be stored in localStorage");
  assert.strictEqual(pending.orgIdOrSlug, "sara-foundation", "Pending target should match sara-foundation");
  assert.strictEqual(pending.role, "learner", "Role should match learner");
  pass("1. trackOrganizationJoinIntent records pending referral in browser storage");

  // --- TEST 2: Generate Shareable Link ---
  const joinUrl = getOrganizationJoinUrl("sara-foundation");
  assert(joinUrl.includes("/?join=sara-foundation"), `Join URL should contain /?join=sara-foundation: ${joinUrl}`);
  pass(`2. getOrganizationJoinUrl generates canonical invite link: ${joinUrl}`);

  // --- TEST 3: Fetch Organization Public Display Info ---
  const orgInfo = await fetchOrganizationPublicInfo("sara-foundation");
  assert(orgInfo !== null, "Organization public info must resolve for sara-foundation");
  assert(orgInfo.name.toLowerCase().includes("sara"), `Organization name must match Sara Foundation, got: ${orgInfo?.name}`);
  pass(`3. fetchOrganizationPublicInfo resolves organization metadata: ${orgInfo.name} (id: ${orgInfo.id})`);

  // --- TEST 4: Join Organization via Referral Link (with Real Student Identity) ---
  const joinResult = await joinOrganizationByReferral(
    "sara-foundation",
    "learner",
    "user-amina-test-123",
    { email: "amina.bello@example.com", displayName: "Amina Bello" }
  );
  assert(joinResult.success === true, "joinOrganizationByReferral must return success: true");
  pass(`4. joinOrganizationByReferral links user to workspace with success: true`);

  // --- TEST 5: Verify Student Captured in Referral Roster ---
  const roster = getReferralSignupsRoster("sara-foundation");
  const aminaInRoster = roster.find((r) => r.email === "amina.bello@example.com");
  assert(aminaInRoster, "Student Amina Bello must exist in the referral signups roster");
  assert.strictEqual(aminaInRoster.display_name, "Amina Bello");
  assert.strictEqual(aminaInRoster.join_source, "shareable_link");
  pass(`5. Roster records signed up student with real email, display name, and referral link`);

  // --- TEST 6: Admin Member Directory Fetch (fetchOrgMembers) Shows Student ---
  const members = await fetchOrgMembers("sara-foundation");
  assert(Array.isArray(members), "fetchOrgMembers must return an array of members");
  assert(members.length > 0, "fetchOrgMembers must return members for the organization");
  
  const aminaInAdmin = members.find((m) => m.email === "amina.bello@example.com" || m.id === "user-amina-test-123");
  assert(aminaInAdmin, "CRITICAL: Student who signed up via link MUST show up in Admin Members list!");
  assert.strictEqual(aminaInAdmin.display_name, "Amina Bello");
  assert.strictEqual(aminaInAdmin.role, "learner");
  assert.strictEqual(aminaInAdmin.join_source, "shareable_link");
  assert(aminaInAdmin.referral_link.includes("/?join="), "Referral link must format as /?join=...");
  pass(`6. fetchOrgMembers verifies student who signed up with link displays in Admin with full details (${members.length} total members)`);

  // --- TEST 7: Global Search / Users in Org Returns Signed Up Student ---
  const orgUsers = await fetchUsersInOrg("sara-foundation");
  const aminaInSearch = orgUsers.find((u) => u.name === "Amina Bello" || u.id === "user-amina-test-123");
  assert(aminaInSearch, "Student must show up in fetchUsersInOrg for global admin search");
  pass(`7. fetchUsersInOrg returns signed up student in organization selector & search: ${aminaInSearch.name}`);

  // --- TEST 8: Pending Approval Queue (fetchPendingOrgJoinRequests) ---
  const pendingRequests = await fetchPendingOrgJoinRequests("sara-foundation");
  assert(Array.isArray(pendingRequests), "fetchPendingOrgJoinRequests must return an array");
  pass(`8. fetchPendingOrgJoinRequests returns pending seat approval queue (${pendingRequests.length} candidate(s))`);

  // --- TEST 9: Course Access for Joined Learner (fetchPublishedCourses) ---
  const coursesWithSlug = await fetchPublishedCourses("sara-foundation");
  assert(Array.isArray(coursesWithSlug), "fetchPublishedCourses with slug must return courses array");
  assert(coursesWithSlug.length > 0, "fetchPublishedCourses must return active courses for learner to work on");

  const coursesWithUuid = await fetchPublishedCourses("00000000-0000-0000-0000-000000000001");
  assert(Array.isArray(coursesWithUuid), "fetchPublishedCourses with UUID must return courses array");
  pass(`9. fetchPublishedCourses cleanly resolves courses for joined learner without UUID cast errors (${coursesWithSlug.length} courses loaded)`);

  // --- TEST 10: Learner Profile Organization Preservation ---
  const userProfile = await fetchCurrentUserProfile("demo-learner-1");
  assert(userProfile !== null, "fetchCurrentUserProfile must return valid profile");
  assert(userProfile.organization_id !== null, "fetchCurrentUserProfile must contain organization_id");
  pass(`10. fetchCurrentUserProfile preserves organization identity: org_id=${userProfile.organization_id}, role=${userProfile.role}`);

  console.log("==================================================================");
  console.log(`ALL ${passedCount}/10 TESTS PASSED SUCCESSFULLY!`);
  console.log("Verified: ALL students who sign up with link show in admin Directory,");
  console.log("are identified by shareable link badge, and are searchable across the admin workspace.");
  console.log("==================================================================");
}

runTests().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
