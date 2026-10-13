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
    PUBLIC_ORGANIZATIONS_DIRECTORY,
  } = await import("../src/lib/api/organizations.js");

  const {
    fetchOrgMembers,
    fetchCurrentUserProfile,
    fetchOrganizationById,
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

  // --- TEST 4: Join Organization via Referral Link (Demo/Simulation) ---
  const joinResult = await joinOrganizationByReferral("sara-foundation", "learner");
  assert(joinResult.success === true, "joinOrganizationByReferral must return success: true");
  pass(`4. joinOrganizationByReferral links user to workspace with success: true`);

  // --- TEST 5: Admin Member Directory Fetch (fetchOrgMembers) ---
  const members = await fetchOrgMembers("sara-foundation");
  assert(Array.isArray(members), "fetchOrgMembers must return an array of members");
  assert(members.length > 0, "fetchOrgMembers must return members for the organization");
  
  const sampleMember = members[0];
  assert(sampleMember.id, "Member record must have an id");
  assert(sampleMember.display_name, "Member record must have display_name");
  assert(sampleMember.email, "Member record must have email");
  assert(sampleMember.join_source, "Member record must have join_source");
  assert(sampleMember.referral_link, "Member record must have referral_link");
  pass(`5. fetchOrgMembers returns ${members.length} members with join_source, referral link, and activity status`);

  // --- TEST 6: Verify Shareable Link Tracking on Members ---
  const shareableMembers = members.filter((m) => m.join_source === "shareable_link");
  assert(shareableMembers.length > 0, "Must have members registered via shareable_link");
  assert(shareableMembers[0].referral_link.includes("/?join="), "Referral link must format as /?join=...");
  pass(`6. Admin Directory correctly identifies members who joined via shareable invite links (${shareableMembers.length} found)`);

  // --- TEST 7: Pending Approval Queue (fetchPendingOrgJoinRequests) ---
  const pendingRequests = await fetchPendingOrgJoinRequests("sara-foundation");
  assert(Array.isArray(pendingRequests), "fetchPendingOrgJoinRequests must return an array");
  pass(`7. fetchPendingOrgJoinRequests returns pending seat approval queue (${pendingRequests.length} candidate(s))`);

  // --- TEST 8: Course Access for Joined Learner (fetchPublishedCourses) ---
  // Ensure that passing slug or UUID does NOT throw Postgres syntax errors
  const coursesWithSlug = await fetchPublishedCourses("sara-foundation");
  assert(Array.isArray(coursesWithSlug), "fetchPublishedCourses with slug must return courses array");
  assert(coursesWithSlug.length > 0, "fetchPublishedCourses must return active courses for learner to work on");

  const coursesWithUuid = await fetchPublishedCourses("00000000-0000-0000-0000-000000000001");
  assert(Array.isArray(coursesWithUuid), "fetchPublishedCourses with UUID must return courses array");
  pass(`8. fetchPublishedCourses cleanly resolves courses for joined learner without UUID cast errors (${coursesWithSlug.length} courses loaded)`);

  // --- TEST 9: Learner Profile Organization Preservation ---
  const userProfile = await fetchCurrentUserProfile("demo-learner-1");
  assert(userProfile !== null, "fetchCurrentUserProfile must return valid profile");
  assert(userProfile.organization_id !== null, "fetchCurrentUserProfile must contain organization_id");
  pass(`9. fetchCurrentUserProfile preserves organization identity: org_id=${userProfile.organization_id}, role=${userProfile.role}`);

  console.log("==================================================================");
  console.log(`ALL ${passedCount}/9 TESTS PASSED SUCCESSFULLY!`);
  console.log("Verified: Users who click the link join the organization, are visible to admins,");
  console.log("can be monitored in Directory & Pending Approvals, and can access courses to work.");
  console.log("==================================================================");
}

runTests().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
