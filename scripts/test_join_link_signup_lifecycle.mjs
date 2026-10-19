// Setup browser environment mocks for Node test
if (typeof global.window === "undefined") {
  const store = new Map();
  global.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  global.window = {
    localStorage: global.localStorage,
    location: { origin: "https://trainailtd.com", href: "https://trainailtd.com/?join=sara-foundation" },
    dispatchEvent: () => true,
  };
  global.CustomEvent = class CustomEvent {
    constructor(type, init) { this.type = type; this.detail = init?.detail; }
  };
}

import {
  trackOrganizationJoinIntent,
  getPendingOrganizationJoin,
  recordLinkClickInRoster,
  joinOrganizationByReferral,
  getReferralSignupsRoster,
  getLinkClicksRoster
} from "../src/lib/api/organizations.js";
import { fetchOrgMembers, fetchOrgPeopleKpis } from "../src/lib/api/platform.js";

async function runTest() {
  console.log("=== SIMULATING JOIN LINK ARRIVAL ===");
  // 1. Prospective learner arrives via ?join=sara-foundation
  trackOrganizationJoinIntent("sara-foundation");
  const pending = getPendingOrganizationJoin();
  console.log("Pending join stored:", pending);

  const clicksBefore = getLinkClicksRoster("sara-foundation");
  console.log("Link clicks before signup:", clicksBefore.length);
  console.log("Sample click entry:", clicksBefore[0]);

  console.log("\n=== SIMULATING USER SIGNUP VIA LINK ===");
  const testEmail = "chidi.test." + Date.now() + "@gmail.com";
  const testName = "Chidi Test User";
  const testUid = "user_test_" + Date.now();

  // Exactly what useAuth.js lines 563-568 was calling:
  console.log("Calling joinOrganizationByReferral with object arg as useAuth.js did...");
  const joinResult = await joinOrganizationByReferral(pending.orgIdOrSlug, {
    userId: testUid,
    email: testEmail,
    displayName: testName,
    role: "learner",
  });
  console.log("joinOrganizationByReferral result:", joinResult);

  console.log("\n=== CHECKING ROSTERS AFTER SIGNUP ===");
  const referralSignups = getReferralSignupsRoster("sara-foundation");
  const foundSignup = referralSignups.find(u => u.email === testEmail);
  console.log("Found in referral signups roster:", foundSignup ? {
    id: foundSignup.id,
    display_name: foundSignup.display_name,
    email: foundSignup.email,
    status: foundSignup.status,
    organization_slug: foundSignup.organization_slug
  } : "NOT FOUND!");

  const clicksAfter = getLinkClicksRoster("sara-foundation");
  console.log("Link clicks after signup count:", clicksAfter.length);
  const clickMatchingEmail = clicksAfter.find(c => c.email === testEmail);
  console.log("Is there still an un-upgraded click record matching email?", clickMatchingEmail);

  console.log("\n=== CHECKING fetchOrgMembers FOR SARA FOUNDATION ===");
  // Test both slug and potential UUID / org ID
  const membersBySlug = await fetchOrgMembers("sara-foundation");
  const inSlugMembers = membersBySlug.find(m => m.email === testEmail);
  console.log("Found in fetchOrgMembers('sara-foundation'):", inSlugMembers ? {
    id: inSlugMembers.id,
    name: inSlugMembers.display_name,
    email: inSlugMembers.email,
    status: inSlugMembers.status,
    join_source: inSlugMembers.join_source
  } : "NOT FOUND!");

  const membersByOrg1 = await fetchOrgMembers("sara-org-1");
  const inOrg1Members = membersByOrg1.find(m => m.email === testEmail);
  console.log("Found in fetchOrgMembers('sara-org-1'):", inOrg1Members ? {
    id: inOrg1Members.id,
    name: inOrg1Members.display_name,
    email: inOrg1Members.email,
    status: inOrg1Members.status,
    join_source: inOrg1Members.join_source
  } : "NOT FOUND!");

  console.log("\n=== SIMULATING HISTORICAL SIGNUP BEFORE THIS CHANGE ===");
  // Simulate a historical learner who signed up before this change:
  // They have a click entry with real email and status: 'link_clicked'
  const historicalEmail = "historical.learner@sarafoundationafrica.com";
  const historicalName = "Historical Learner";
  const rawClicks = JSON.parse(global.localStorage.getItem("trainai_link_clicks_v1") || "[]");
  rawClicks.push({
    id: "click-historical-visitor-1",
    user_id: "click-historical-visitor-1",
    visitor_id: "hist-vis-1",
    display_name: historicalName,
    email: historicalEmail,
    role: "learner",
    status: "link_clicked",
    organization_id: "sara-org-1",
    organization_slug: "sara-foundation",
    organization_name: "Sara Foundation Africa",
    joined_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    last_active_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    join_source: "shareable_link",
    referral_link: "https://trainailtd.com/?join=sara-foundation",
  });
  global.localStorage.setItem("trainai_link_clicks_v1", JSON.stringify(rawClicks));

  // Run getReferralSignupsRoster to trigger auto-migration:
  const signupsWithHistorical = getReferralSignupsRoster("sara-foundation");
  const foundHistorical = signupsWithHistorical.find(u => u.email === historicalEmail);
  console.log("Historical signup auto-promoted in roster:", foundHistorical ? {
    id: foundHistorical.id,
    display_name: foundHistorical.display_name,
    email: foundHistorical.email,
    status: foundHistorical.status,
    join_source: foundHistorical.join_source
  } : "NOT FOUND!");

  const membersWithHistorical = await fetchOrgMembers("sara-foundation");
  const inMembersHistorical = membersWithHistorical.find(m => m.email === historicalEmail);
  console.log("Historical signup in fetchOrgMembers:", inMembersHistorical ? {
    id: inMembersHistorical.id,
    display_name: inMembersHistorical.display_name,
    email: inMembersHistorical.email,
    status: inMembersHistorical.status,
    join_source: inMembersHistorical.join_source
  } : "NOT FOUND!");

  const clicksAfterHistorical = getLinkClicksRoster("sara-foundation");
  const historicalStillInClicks = clicksAfterHistorical.find(c => c.email === historicalEmail);
  console.log("Historical signup purged from prospective link clicks?", !historicalStillInClicks);

  if (!foundHistorical || foundHistorical.status !== "active") {
    throw new Error("Historical signup was not promoted to active in referral roster!");
  }
  if (!inMembersHistorical || inMembersHistorical.status !== "active") {
    throw new Error("Historical signup was not active in fetchOrgMembers!");
  }
  if (historicalStillInClicks) {
    throw new Error("Historical signup was not purged from clicks roster!");
  }
  console.log("\nALL ASSERTIONS PASSED SUCCESSFULLY!");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
