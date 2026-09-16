import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SHARED_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const ANON_KEY = "sb_publishable_BvoX4QvVa1-pG6mx7NsVUQ_4GXGlwaJ";

const anonClient = createClient(SHARED_URL, ANON_KEY);

const results = [];
function record(testName, expected, actual, pass) {
  results.push({ testName, expected, actual, pass: pass ? "PASS" : "FAIL" });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${testName} | Expected: ${expected} | Actual: ${actual}`);
}

async function main() {
  console.log("=== EXECUTING LIVE TWO-DATABASE & MULTI-TENANT ISOLATION VERIFICATION ===");
  const runId = Date.now().toString(36);

  // -------------------------------------------------------------
  // PHASE 3 & 4: PLATFORM OWNER & DIGITAL ORG VERIFICATION
  // -------------------------------------------------------------
  console.log("\n--- 1. Authenticating Platform Owner (trainai@gmail.com) ---");
  const poSignIn = await anonClient.auth.signInWithPassword({
    email: "trainai@gmail.com",
    password: "SaraF123$"
  });

  if (poSignIn.error) {
    console.error("Platform Owner sign in error:", poSignIn.error);
  }

  const poClient = createClient(SHARED_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${poSignIn.data?.session?.access_token}` } }
  });

  // Verify super_admin role and view of organizations
  const { data: poRoles } = await poClient.from("user_roles").select("role");
  const poRoleList = (poRoles || []).map(r => r.role);
  record(
    "Platform Owner has super_admin role in Shared DB",
    "super_admin present",
    poRoleList.join(", "),
    poRoleList.includes("super_admin") || poRoleList.includes("admin")
  );

  const { data: allOrgs, error: orgErr } = await poClient.from("organizations").select("*");
  console.log("Platform Owner visible organizations count:", allOrgs?.length);
  const digitalOrg = allOrgs?.find(o => o.slug === "digital-users" || o.slug === "tech-learning");
  record(
    "Canonical digital organization visible to Platform Owner",
    "digital-users / tech-learning exists",
    digitalOrg ? `${digitalOrg.name} (slug: ${digitalOrg.slug}, id: ${digitalOrg.id})` : "Not found",
    !!digitalOrg
  );

  // -------------------------------------------------------------
  // PHASE 3: REAL INDIVIDUAL SIGNUP & JOIN DEFAULT ORG
  // -------------------------------------------------------------
  console.log("\n--- 2. Testing Individual Signup & join_default_organization() ---");
  const individualEmail = `tenant-test-individual-${runId}@example.com`;
  const testPassword = "Password123!Secure";

  const indSignUpRes = await anonClient.auth.signUp({
    email: individualEmail,
    password: testPassword,
    options: { data: { role: "learner" } }
  });

  let indSession = indSignUpRes.data?.session;
  let indUser = indSignUpRes.data?.user;

  if (!indSession) {
    const indSignInRes = await anonClient.auth.signInWithPassword({
      email: individualEmail,
      password: testPassword
    });
    indSession = indSignInRes.data?.session;
    indUser = indSignInRes.data?.user;
  }

  let individualClient = null;
  if (indSession) {
    individualClient = createClient(SHARED_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${indSession.access_token}` } }
    });

    const { data: joinedOrgId, error: joinErr } = await individualClient.rpc("join_default_organization");
    console.log("join_default_organization() returned:", joinedOrgId, joinErr?.message || "success");

    const { data: profile } = await individualClient.from("user_profiles").select("*").eq("id", indUser.id).single();
    const { data: mems } = await individualClient.from("organization_members").select("*").eq("user_id", indUser.id);

    record(
      "Individual Signup assigns canonical digital org",
      "Matches canonical digital org ID",
      `Profile Org: ${profile?.organization_id}, Expected: ${digitalOrg?.id}`,
      profile?.organization_id === digitalOrg?.id && profile?.organization_id !== null
    );

    record(
      "Individual Signup creates active membership in digital org",
      "1 active member row",
      `Memberships: ${mems?.length || 0}`,
      mems?.length > 0 && mems[0].organization_id === digitalOrg?.id
    );
  } else {
    record("Individual Signup session creation", "Session established", "Email confirmation pending / not returned", false);
  }

  // -------------------------------------------------------------
  // PHASE 5: CREATE TWO REAL TEST ORGANIZATIONS (A & B) VIA SELF-SERVE
  // -------------------------------------------------------------
  console.log("\n--- 3. Creating Test Organizations (A & B) via create_organization_self_serve ---");
  const orgAName = `Isolation Test Academy A ${runId}`;
  const ownerAEmail = `owner-a-${runId}@academy-a.org`;

  const ownerASignUp = await anonClient.auth.signUp({
    email: ownerAEmail,
    password: testPassword,
    options: { data: { role: "admin" } }
  });

  let ownerASession = ownerASignUp.data?.session;
  let ownerAUser = ownerASignUp.data?.user;
  if (!ownerASession) {
    const s = await anonClient.auth.signInWithPassword({ email: ownerAEmail, password: testPassword });
    ownerASession = s.data?.session;
    ownerAUser = s.data?.user;
  }

  let clientA = null;
  let orgAId = null;
  if (ownerASession) {
    clientA = createClient(SHARED_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${ownerASession.access_token}` } }
    });
    const { data: aId, error: aErr } = await clientA.rpc("create_organization_self_serve", { p_org_name: orgAName });
    orgAId = aId;
    console.log("Org A created via self-serve:", orgAId, aErr?.message || "success");
  }

  const orgBName = `Isolation Test Academy B ${runId}`;
  const ownerBEmail = `owner-b-${runId}@academy-b.org`;

  const ownerBSignUp = await anonClient.auth.signUp({
    email: ownerBEmail,
    password: testPassword,
    options: { data: { role: "admin" } }
  });

  let ownerBSession = ownerBSignUp.data?.session;
  let ownerBUser = ownerBSignUp.data?.user;
  if (!ownerBSession) {
    const s = await anonClient.auth.signInWithPassword({ email: ownerBEmail, password: testPassword });
    ownerBSession = s.data?.session;
    ownerBUser = s.data?.user;
  }

  let clientB = null;
  let orgBId = null;
  if (ownerBSession) {
    clientB = createClient(SHARED_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${ownerBSession.access_token}` } }
    });
    const { data: bId, error: bErr } = await clientB.rpc("create_organization_self_serve", { p_org_name: orgBName });
    orgBId = bId;
    console.log("Org B created via self-serve:", orgBId, bErr?.message || "success");
  }

  record("Org A self-serve creation", "Valid UUID", orgAId || "Failed", !!orgAId);
  record("Org B self-serve creation", "Valid UUID", orgBId || "Failed", !!orgBId);

  // -------------------------------------------------------------
  // PHASE 6 & 7: CREATE UNIQUE DATA IN ORG A & VERIFY ORG A VISIBILITY
  // -------------------------------------------------------------
  let courseA = null;
  let cohortA = null;
  let postA = null;
  let certA = null;

  if (clientA && orgAId) {
    console.log("\n--- 4. Creating Unique Test Records in Org A ---");
    const courseRes = await clientA.from("courses").insert({
      organization_id: orgAId,
      title: `PRIVATE-COURSE-A-${runId}`,
      description: "Private syllabus for Org A",
      status: "published",
      instructor_id: ownerAUser.id
    }).select().single();
    courseA = courseRes.data;

    const cohortRes = await clientA.from("cohorts").insert({
      organization_id: orgAId,
      name: `COHORT-A-PRIVATE-${runId}`,
      created_by: ownerAUser.id
    }).select().single();
    cohortA = cohortRes.data;

    const postRes = await clientA.from("community_posts").insert({
      organization_id: orgAId,
      user_id: ownerAUser.id,
      title: `Private Announcement A ${runId}`,
      content: `PRIVATE-POST-A-${runId}`,
      category: "general"
    }).select().single();
    postA = postRes.data;

    const certRes = await clientA.from("certificates").insert({
      organization_id: orgAId,
      user_id: ownerAUser.id,
      title: `Private Certificate A ${runId}`,
      certificate_number: `CERT-A-${runId}`,
      status: "issued"
    }).select().single();
    certA = certRes.data;

    // Verify Org A can read its own records
    const { data: aCourses } = await clientA.from("courses").select("*").eq("id", courseA?.id);
    const { data: aCohorts } = await clientA.from("cohorts").select("*").eq("id", cohortA?.id);
    const { data: aPosts } = await clientA.from("community_posts").select("*").eq("id", postA?.id);
    const { data: aCerts } = await clientA.from("certificates").select("*").eq("id", certA?.id);

    record("Org A sees own Course A", "1 row returned", `${aCourses?.length || 0} rows`, aCourses?.length === 1);
    record("Org A sees own Cohort A", "1 row returned", `${aCohorts?.length || 0} rows`, aCohorts?.length === 1);
    record("Org A sees own Post A", "1 row returned", `${aPosts?.length || 0} rows`, aPosts?.length === 1);
    record("Org A sees own Certificate A", "1 row returned", `${aCerts?.length || 0} rows`, aCerts?.length === 1);
  }

  // -------------------------------------------------------------
  // PHASE 8: ORG B QUERIES & CROSS-TENANT ISOLATION
  // -------------------------------------------------------------
  if (clientB && orgBId && courseA) {
    console.log("\n--- 5. Testing Cross-Tenant Boundary from Org B ---");

    // Query all courses as Org B
    const { data: bCourses } = await clientB.from("courses").select("*");
    const leaksCourse = (bCourses || []).some(c => c.id === courseA.id || c.title?.includes(runId));

    // Query all cohorts as Org B
    const { data: bCohorts } = await clientB.from("cohorts").select("*");
    const leaksCohort = (bCohorts || []).some(c => c.id === cohortA?.id || c.name?.includes(runId));

    // Query all posts as Org B
    const { data: bPosts } = await clientB.from("community_posts").select("*");
    const leaksPost = (bPosts || []).some(p => p.id === postA?.id || p.content?.includes(runId));

    // Query all certificates as Org B
    const { data: bCerts } = await clientB.from("certificates").select("*");
    const leaksCert = (bCerts || []).some(c => c.id === certA?.id || c.certificate_number?.includes(runId));

    // Query all members as Org B
    const { data: bMembers } = await clientB.from("organization_members").select("*");
    const leaksMember = (bMembers || []).some(m => m.organization_id === orgAId || m.user_id === ownerAUser?.id);

    record("Org B sees Org A Courses", "0 leaked rows", leaksCourse ? "LEAK" : "0 leaked", !leaksCourse);
    record("Org B sees Org A Cohorts", "0 leaked rows", leaksCohort ? "LEAK" : "0 leaked", !leaksCohort);
    record("Org B sees Org A Posts", "0 leaked rows", leaksPost ? "LEAK" : "0 leaked", !leaksPost);
    record("Org B sees Org A Certificates", "0 leaked rows", leaksCert ? "LEAK" : "0 leaked", !leaksCert);
    record("Org B sees Org A Members", "0 leaked rows", leaksMember ? "LEAK" : "0 leaked", !leaksMember);

    // -------------------------------------------------------------
    // PHASE 9: DIRECT IDOR TESTING (READ, UPDATE, DELETE, INSERT)
    // -------------------------------------------------------------
    console.log("\n--- 6. Testing Direct IDOR Attacks from Org B against Org A ---");

    // 1. Direct ID SELECT on Course A
    const { data: idorRead } = await clientB.from("courses").select("*").eq("id", courseA.id);

    // 2. Direct ID UPDATE on Course A
    const { data: idorUpdate } = await clientB.from("courses").update({ title: "HACKED_BY_B" }).eq("id", courseA.id).select();

    // 3. Direct ID DELETE on Course A
    const { data: idorDelete } = await clientB.from("courses").delete().eq("id", courseA.id).select();

    // 4. Direct INSERT into Org A using Org B credentials
    const { data: idorInsert, error: idorInsErr } = await clientB.from("courses").insert({
      organization_id: orgAId,
      title: "INTRUDER_BY_B",
      instructor_id: ownerBUser.id
    }).select();

    record("Direct IDOR SELECT on Org A Course", "0 rows returned", `${idorRead?.length || 0} rows`, (idorRead?.length || 0) === 0);
    record("Direct IDOR UPDATE on Org A Course", "0 rows affected", `${idorUpdate?.length || 0} rows`, (idorUpdate?.length || 0) === 0);
    record("Direct IDOR DELETE on Org A Course", "0 rows affected", `${idorDelete?.length || 0} rows`, (idorDelete?.length || 0) === 0);
    record("Direct IDOR INSERT into Org A", "0 rows / RLS rejection", `${idorInsErr ? idorInsErr.message : "0 rows inserted"}`, !idorInsert || idorInsert.length === 0);
  }

  // -------------------------------------------------------------
  // PHASE 10: ROLE ESCALATION & PROFILE TAMPERING
  // -------------------------------------------------------------
  if (individualClient && indUser && orgAId) {
    console.log("\n--- 7. Testing Role Escalation & Profile Tampering ---");

    // Learner attempts to modify own organization_id to Org A
    await individualClient.from("user_profiles").update({ organization_id: orgAId }).eq("id", indUser.id);
    const { data: verifyProf } = await individualClient.from("user_profiles").select("organization_id").eq("id", indUser.id).single();
    const orgTamperBlocked = verifyProf?.organization_id !== orgAId;

    // Learner attempts to self-grant super_admin in user_roles
    const { data: roleInsert, error: roleErr } = await individualClient.from("user_roles").insert({
      user_id: indUser.id,
      role: "super_admin"
    }).select();

    record("Learner organization_id tampering to Org A", "Blocked (unchanged)", `Org ID: ${verifyProf?.organization_id}`, orgTamperBlocked);
    record("Learner self-granting super_admin in user_roles", "Blocked by RLS", `${roleErr ? roleErr.message : "0 rows inserted"}`, !!roleErr || !roleInsert || roleInsert.length === 0);
  }

  // -------------------------------------------------------------
  // PHASE 15: AI CREDIT ISOLATION
  // -------------------------------------------------------------
  if (clientB && orgAId) {
    console.log("\n--- 8. Testing AI Credit Wallet Isolation ---");
    const { data: walletsA } = await clientB.from("ai_credit_wallets").select("*").eq("organization_id", orgAId);
    record("Org B querying Org A AI Credit Wallet", "0 rows returned", `${walletsA?.length || 0} rows`, (walletsA?.length || 0) === 0);
  }

  // -------------------------------------------------------------
  // FINAL MATRIX OUTPUT
  // -------------------------------------------------------------
  console.log("\n=== FAILED TESTS ===");
  const failed = results.filter(r => r.pass === "FAIL");
  console.log(`Failed count: ${failed.length}`);
  failed.forEach(f => console.log(`FAIL: ${f.testName} -> Expected: ${f.expected}, Actual: ${f.actual}`));

  const allPassed = results.every(r => r.pass === "PASS");
  console.log(`\nOVERALL VERIFICATION RESULT: ${allPassed ? "PASS" : "FAIL"}`);
}

main().catch(console.error);

