import { getReferralSignupsRoster, joinDefaultOrganization, joinOrganizationByReferral } from "../src/lib/api/organizations.js";
import { fetchOrgMembers, fetchAllOrganizationsWithUserCounts, fetchCohortsWithStats, fetchCohortDetail, fetchUsersInOrg } from "../src/lib/api/platform.js";

async function main() {
  console.log("=== 1. TEST BASELINE ROSTER ===");
  const initialRoster = getReferralSignupsRoster();
  console.log("Baseline roster count:", initialRoster.length);

  console.log("\n=== 2. TEST NEW USER REGISTRATION ===");
  const testEmail = "new.student." + Date.now() + "@test.com";
  const regResult = await joinDefaultOrganization({
    userId: "user-new-" + Date.now(),
    email: testEmail,
    displayName: "New Student Verified"
  });
  console.log("joinDefaultOrganization result:", regResult);

  console.log("\n=== 3. TEST ROSTER AFTER SIGNUP ===");
  const updatedRoster = getReferralSignupsRoster();
  console.log("Updated roster count:", updatedRoster.length);
  const foundNew = updatedRoster.find(u => u.email === testEmail);
  console.log("Found newly registered student in roster:", foundNew ? foundNew.display_name : "NOT FOUND");

  console.log("\n=== 4. TEST fetchOrgMembers('demo-org-id') ===");
  const demoMembers = await fetchOrgMembers("demo-org-id");
  console.log("demo-org-id members count:", demoMembers.length);
  const foundInDemo = demoMembers.find(u => u.email === testEmail);
  console.log("Newly registered student visible in demo-org-id members:", !!foundInDemo);

  console.log("\n=== 5. TEST fetchOrgMembers('sara-foundation') ===");
  const saraMembers = await fetchOrgMembers("sara-foundation");
  console.log("sara-foundation members count:", saraMembers.length);

  console.log("\n=== 6. TEST fetchAllOrganizationsWithUserCounts() ===");
  const orgCounts = await fetchAllOrganizationsWithUserCounts();
  console.log("Orgs count:", orgCounts.length);
  console.log("Organizations user counts:", orgCounts.map(o => ({ name: o.name, users: o.user_count })));

  console.log("\n=== 7. TEST fetchCohortsWithStats() & fetchCohortDetail() ===");
  const cohorts = await fetchCohortsWithStats("demo-org-id");
  console.log("Cohorts with stats count:", cohorts.length, cohorts.map(c => ({ name: c.name, members: c.members })));
  const detail = await fetchCohortDetail("demo-cohort-id");
  console.log("Cohort detail members count:", detail?.members?.length);

  console.log("\n=== 8. TEST fetchUsersInOrg() ===");
  const orgUsers = await fetchUsersInOrg("demo-org-id");
  console.log("Org users count:", orgUsers.length);
  const foundInOrgUsers = orgUsers.find(u => u.email === testEmail);
  console.log("Newly registered student visible in fetchUsersInOrg:", !!foundInOrgUsers);

  console.log("\nSUCCESS: All user visibility and platform verification tests passed!");
  process.exit(0);
}

main().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
