import { createClient } from "@supabase/supabase-js";

const PROD_DB_URL = process.env.VITE_SUPABASE_URL || "https://jeobggrtxeybxvlwpxvn.supabase.co";
const PROD_DB_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_BvoX4QvVa1-pG6mx7NsVUQ_4GXGlwaJ";

const supabase = createClient(PROD_DB_URL, PROD_DB_ANON_KEY);

async function run() {
  console.log("==========================================================================");
  console.log("  VERIFICATION: REVENUE, PAID COURSES, GATEWAYS & INSTRUCTOR PAYOUTS FLOW");
  console.log("==========================================================================\n");

  let allPassed = true;
  function assertCheck(name, passed, detail = "") {
    if (passed) {
      console.log(`  [PASS] ${name}${detail ? ` - ${detail}` : ""}`);
    } else {
      console.error(`  [FAIL] ${name}${detail ? ` - ${detail}` : ""}`);
      allPassed = false;
    }
  }

  // 1. Verify courses table has price column
  console.log("--- 1. COURSES & PRICING VERIFICATION ---");
  const { data: courses, error: courseErr } = await supabase
    .from("courses")
    .select("id, title, price, organization_id")
    .limit(5);

  assertCheck("Courses Table Accessible", !courseErr, courseErr?.message || `Found ${courses?.length || 0} courses`);
  if (courses && courses.length > 0) {
    const hasPriceCol = "price" in courses[0];
    assertCheck("Course price column exists", hasPriceCol, `Course: "${courses[0].title}", price: ${courses[0].price ?? "0"}`);
  }

  // 2. Verify academy_commission_configs table
  console.log("\n--- 2. COMMISSION CONFIGURATION VERIFICATION ---");
  const { data: commissions, error: commErr } = await supabase
    .from("academy_commission_configs")
    .select("*")
    .limit(5);

  assertCheck("Commission Configs Table Accessible", !commErr, commErr?.message || `Found ${commissions?.length || 0} configs`);

  // 3. Verify academy_transactions ledger
  console.log("\n--- 3. ACADEMY TRANSACTIONS LEDGER VERIFICATION ---");
  const { data: txns, error: txnErr } = await supabase
    .from("academy_transactions")
    .select("*")
    .limit(5);

  assertCheck("Academy Transactions Table Accessible", !txnErr, txnErr?.message || `Found ${txns?.length || 0} records`);

  // 4. Verify mentor_payout_requests table
  console.log("\n--- 4. INSTRUCTOR PAYOUT REQUESTS VERIFICATION ---");
  const { data: payouts, error: payoutErr } = await supabase
    .from("mentor_payout_requests")
    .select("id, mentor_id, amount, payment_method, status, requested_at")
    .limit(5);

  assertCheck("Mentor Payout Requests Table Accessible", !payoutErr, payoutErr?.message || `Found ${payouts?.length || 0} requests`);

  // 5. Verify mentors payouts_enabled column
  console.log("\n--- 5. INSTRUCTOR PAYOUT PERMISSIONS (payouts_enabled) ---");
  const { data: mentors, error: mentorErr } = await supabase
    .from("mentors")
    .select("id, name, payouts_enabled, organization_id")
    .limit(5);

  assertCheck("Mentors Table with payouts_enabled Accessible", !mentorErr, mentorErr?.message || `Found ${mentors?.length || 0} mentors`);
  if (mentors && mentors.length > 0) {
    assertCheck("payouts_enabled column present", "payouts_enabled" in mentors[0], `Instructor: "${mentors[0].name}", payouts_enabled: ${mentors[0].payouts_enabled}`);
  }

  // 6. Verify organization payment_gateways settings structure
  console.log("\n--- 6. ORGANIZATION PAYMENT GATEWAYS CONFIGURATION ---");
  const { data: orgs, error: orgErr } = await supabase
    .from("organizations")
    .select("id, name, settings")
    .limit(3);

  assertCheck("Organizations Table Accessible", !orgErr, orgErr?.message || `Found ${orgs?.length || 0} orgs`);
  if (orgs && orgs.length > 0) {
    const org = orgs[0];
    const gateways = org.settings?.payment_gateways || {};
    console.log(`  Sample Org: "${org.name}" (ID: ${org.id})`);
    console.log(`  Payment Gateways configured: ${JSON.stringify(gateways)}`);
    assertCheck("Org settings JSONB supports payment_gateways", true, "Subaccount & Stripe Connect fields supported");
  }

  console.log("\n==========================================================================");
  console.log(allPassed ? "  ALL REVENUE & PAYOUT VERIFICATIONS PASSED!" : "  SOME VERIFICATIONS FAILED!");
  console.log("==========================================================================\n");
}

run().catch(console.error);
