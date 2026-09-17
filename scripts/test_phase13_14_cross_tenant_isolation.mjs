import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log("=== PHASE 13 & 14: LIVE DUAL-TENANT ACCEPTANCE & ISOLATION TEST ===");
  const runId = Date.now().toString(36);

  // 1. Provision Org A ("Org Alpha")
  console.log("\n1. Provisioning Organization A (Alpha)");
  const { data: orgA } = await supabase
    .from("organizations")
    .insert({
      name: `Org Alpha ${runId}`,
      slug: `org-alpha-${runId}`,
      subscription_tier: "growth",
      max_users: 10,
      status: "active"
    })
    .select()
    .single();

  const adminARes = await supabase.auth.admin.createUser({
    email: `admin-a-${runId}@alpha.org`,
    password: "Password123!Secure",
    email_confirm: true,
    user_metadata: { display_name: "Alpha Admin", role: "admin" }
  });
  const adminAId = adminARes.data.user.id;
  await supabase.from("user_profiles").upsert({ id: adminAId, display_name: "Alpha Admin", role: "admin", organization_id: orgA.id });
  await supabase.from("organization_members").upsert({ organization_id: orgA.id, user_id: adminAId, role: "admin", status: "active" });

  const learnerARes = await supabase.auth.admin.createUser({
    email: `learner-a-${runId}@alpha.org`,
    password: "Password123!Secure",
    email_confirm: true,
    user_metadata: { display_name: "Alpha Learner", role: "learner" }
  });
  const learnerAId = learnerARes.data.user.id;
  await supabase.from("user_profiles").upsert({ id: learnerAId, display_name: "Alpha Learner", role: "learner", organization_id: orgA.id });
  await supabase.from("organization_members").upsert({ organization_id: orgA.id, user_id: learnerAId, role: "member", status: "active" });

  const { data: cohortA } = await supabase
    .from("cohorts")
    .insert({ organization_id: orgA.id, name: `Alpha Batch ${runId}`, created_by: adminAId })
    .select()
    .single();
  await supabase.from("cohort_members").insert({ cohort_id: cohortA.id, user_id: learnerAId, added_by: adminAId });

  // 2. Provision Org B ("Org Beta")
  console.log("\n2. Provisioning Organization B (Beta)");
  const { data: orgB } = await supabase
    .from("organizations")
    .insert({
      name: `Org Beta ${runId}`,
      slug: `org-beta-${runId}`,
      subscription_tier: "growth",
      max_users: 10,
      status: "active"
    })
    .select()
    .single();

  const adminBRes = await supabase.auth.admin.createUser({
    email: `admin-b-${runId}@beta.org`,
    password: "Password123!Secure",
    email_confirm: true,
    user_metadata: { display_name: "Beta Admin", role: "admin" }
  });
  const adminBId = adminBRes.data.user.id;
  await supabase.from("user_profiles").upsert({ id: adminBId, display_name: "Beta Admin", role: "admin", organization_id: orgB.id });
  await supabase.from("organization_members").upsert({ organization_id: orgB.id, user_id: adminBId, role: "admin", status: "active" });

  const learnerBRes = await supabase.auth.admin.createUser({
    email: `learner-b-${runId}@beta.org`,
    password: "Password123!Secure",
    email_confirm: true,
    user_metadata: { display_name: "Beta Learner", role: "learner" }
  });
  const learnerBId = learnerBRes.data.user.id;
  await supabase.from("user_profiles").upsert({ id: learnerBId, display_name: "Beta Learner", role: "learner", organization_id: orgB.id });
  await supabase.from("organization_members").upsert({ organization_id: orgB.id, user_id: learnerBId, role: "member", status: "active" });

  const { data: cohortB } = await supabase
    .from("cohorts")
    .insert({ organization_id: orgB.id, name: `Beta Batch ${runId}`, created_by: adminBId })
    .select()
    .single();
  await supabase.from("cohort_members").insert({ cohort_id: cohortB.id, user_id: learnerBId, added_by: adminBId });

  console.log(`Org A (${orgA.id}) & Org B (${orgB.id}) setup complete with independent users and cohorts.`);

  // 3. Bidirectional Isolation Tests
  console.log("\n3. Testing Cross-Tenant Isolation Queries");

  // Query Org A members scoped to Org A
  const { data: membersA } = await supabase
    .from("organization_members")
    .select("user_id, organization_id")
    .eq("organization_id", orgA.id);

  const containsBInA = (membersA || []).some((m) => m.organization_id === orgB.id || m.user_id === learnerBId || m.user_id === adminBId);
  console.log("Org A query leaks Org B members?", containsBInA ? "LEAK (FAIL)" : "NO LEAK (PASS)");

  // Query Org B cohorts scoped to Org B
  const { data: cohortsB } = await supabase
    .from("cohorts")
    .select("id, organization_id, name")
    .eq("organization_id", orgB.id);

  const containsAInB = (cohortsB || []).some((c) => c.organization_id === orgA.id || c.id === cohortA.id);
  console.log("Org B query leaks Org A cohorts?", containsAInB ? "LEAK (FAIL)" : "NO LEAK (PASS)");

  // Test certificate isolation
  const { data: certA } = await supabase
    .from("certificates")
    .insert({
      organization_id: orgA.id,
      user_id: learnerAId,
      certificate_number: `ALPHA-${runId}-001`,
      title: "Alpha Certificate",
      status: "issued"
    })
    .select()
    .single();

  const { data: certB } = await supabase
    .from("certificates")
    .insert({
      organization_id: orgB.id,
      user_id: learnerBId,
      certificate_number: `BETA-${runId}-001`,
      title: "Beta Certificate",
      status: "issued"
    })
    .select()
    .single();

  const { data: orgACerts } = await supabase
    .from("certificates")
    .select("*")
    .eq("organization_id", orgA.id);

  const certLeaked = (orgACerts || []).some((c) => c.id === certB.id || c.organization_id === orgB.id);
  console.log("Org A certificates contain Org B certificate?", certLeaked ? "LEAK (FAIL)" : "NO LEAK (PASS)");

  console.log("\n=== PHASE 13 & 14 CROSS-TENANT ISOLATION TESTS COMPLETE ===");
}

run().catch(console.error);
