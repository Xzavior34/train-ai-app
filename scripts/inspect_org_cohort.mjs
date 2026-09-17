import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=== INSPECT COHORTS AND ORGANIZATIONS ===");
  
  // 1. Cohorts
  const { data: cohorts, error: cErr } = await supabase.from("cohorts").select("*");
  console.log("Cohorts count:", cohorts?.length, "Error:", cErr);
  console.table(cohorts || []);

  // 2. User Profiles
  const { data: users, error: uErr } = await supabase.from("user_profiles").select("id, email, display_name, role, organization_id");
  console.log("\nUsers count:", users?.length, "Error:", uErr);
  console.table(users || []);

  // 3. Organizations
  const { data: orgs, error: oErr } = await supabase.from("organizations").select("*");
  console.log("\nOrganizations count:", orgs?.length, "Error:", oErr);
  console.table(orgs || []);

  // 4. Organization Members
  const { data: orgMembers, error: omErr } = await supabase.from("organization_members").select("*");
  console.log("\nOrganization Members count:", orgMembers?.length, "Error:", omErr);
  console.table(orgMembers || []);

  // 5. Cohort Members
  const { data: cohortMembers, error: cmErr } = await supabase.from("cohort_members").select("*");
  console.log("\nCohort Members count:", cohortMembers?.length, "Error:", cmErr);
  console.table(cohortMembers || []);
}

main().catch(console.error);
