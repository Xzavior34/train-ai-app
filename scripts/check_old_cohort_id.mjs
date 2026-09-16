import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=== CHECK COHORT ID e0509f84-5d83-4976-9ee7-fec263415416 ===");
  
  const { data: cohortOld } = await supabase.from("cohorts").select("*").eq("id", "e0509f84-5d83-4976-9ee7-fec263415416");
  console.log("Cohort with ID e0509f84-5d83-4976-9ee7-fec263415416:", cohortOld);

  const { data: cohortsAll } = await supabase.from("cohorts").select("*");
  console.log("All Cohorts:", cohortsAll);

  // Check if any child tables reference e0509f84-5d83-4976-9ee7-fec263415416
  const { data: sessOld } = await supabase.from("cohort_sessions").select("*").eq("cohort_id", "e0509f84-5d83-4976-9ee7-fec263415416");
  console.log("Sessions with old ID:", sessOld);

  const { data: resOld } = await supabase.from("cohort_resources").select("*").eq("cohort_id", "e0509f84-5d83-4976-9ee7-fec263415416");
  console.log("Resources with old ID:", resOld);

  const { data: courOld } = await supabase.from("cohort_courses").select("*").eq("cohort_id", "e0509f84-5d83-4976-9ee7-fec263415416");
  console.log("Courses with old ID:", courOld);

  const { data: memOld } = await supabase.from("cohort_members").select("*").eq("cohort_id", "e0509f84-5d83-4976-9ee7-fec263415416");
  console.log("Members with old ID:", memOld);

  // If someone might query with e0509f84-5d83-4976-9ee7-fec263415416 or 35a6a31e-cd6f-42d6-80e4-b30c39445a2e, let's see why there were two IDs!
  // In 1.0, the FLIP cohort ID in 1.0 DB was e0509f84-5d83-4976-9ee7-fec263415416!
  // In 2.0 DB, when 2.0 was originally seeded, it created 35a6a31e-cd6f-42d6-80e4-b30c39445a2e with name "FLIP Fellow C2" and org_id "58ebdb4d-8209-4e08-9ab3-8c5eee87b278".
}

main().catch(console.error);
