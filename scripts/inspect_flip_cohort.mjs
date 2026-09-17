import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=== INSPECT FLIP FELLOW C2 COHORT DATA IN DB ===");

  // 1. Fetch cohorts
  const { data: cohorts } = await supabase.from("cohorts").select("*");
  console.log("\nAll Cohorts in DB:");
  console.table((cohorts || []).map(c => ({ id: c.id, name: c.name, starts_at: c.starts_at, ends_at: c.ends_at })));

  const flipCohort = (cohorts || []).find(c => c.id === "e0509f84-5d83-4976-9ee7-fec263415416" || (c.name || "").includes("FLIP"));
  console.log("\nTarget Cohort:", flipCohort);

  const cohortId = flipCohort?.id || "e0509f84-5d83-4976-9ee7-fec263415416";

  // 2. Fetch cohort_sessions for cohortId
  const { data: sessions, error: sessErr } = await supabase.from("cohort_sessions").select("*").eq("cohort_id", cohortId);
  console.log(`\nCohort Sessions (${sessions?.length || 0}) for cohort ${cohortId}:`, sessErr);
  console.table(sessions || []);

  // 3. Fetch cohort_resources for cohortId
  const { data: resources, error: resErr } = await supabase.from("cohort_resources").select("*").eq("cohort_id", cohortId);
  console.log(`\nCohort Resources (${resources?.length || 0}) for cohort ${cohortId}:`, resErr);
  console.table(resources || []);

  // 4. Fetch cohort_courses for cohortId
  const { data: courses, error: courErr } = await supabase.from("cohort_courses").select("*, courses(*)").eq("cohort_id", cohortId);
  console.log(`\nCohort Courses (${courses?.length || 0}) for cohort ${cohortId}:`, courErr);
  console.table(courses || []);

  // 5. Fetch cohort_members for cohortId
  const { data: members, error: memErr } = await supabase.from("cohort_members").select("*").eq("cohort_id", cohortId);
  console.log(`\nCohort Members (${members?.length || 0}) for cohort ${cohortId}:`, memErr);
  console.table(members || []);

  const { data: userProfiles } = await supabase.from("user_profiles").select("id, email, display_name, role");
  console.log("\nUser Profiles in DB:");
  console.table(userProfiles || []);

  const saraProfile = (userProfiles || []).find(p => p.email === "info@sarafoundationafrica.com");
  console.log("\nSara Profile:", saraProfile);

  if (saraProfile) {
    const { data: saraMems } = await supabase.from("cohort_members").select("*").eq("user_id", saraProfile.id);
    console.log(`\nSara cohort_memberships (${saraMems?.length || 0}):`, saraMems);
  }

  // Also check if there are sessions/resources/courses with ANY cohort_id or null cohort_id in DB!
  const { data: allSessions } = await supabase.from("cohort_sessions").select("*");
  console.log(`\nTOTAL cohort_sessions in DB across all cohorts: ${allSessions?.length || 0}`);
  console.table(allSessions || []);

  const { data: allResources } = await supabase.from("cohort_resources").select("*");
  console.log(`\nTOTAL cohort_resources in DB across all cohorts: ${allResources?.length || 0}`);
  console.table(allResources || []);

  const { data: allCohortCourses } = await supabase.from("cohort_courses").select("*");
  console.log(`\nTOTAL cohort_courses in DB across all cohorts: ${allCohortCourses?.length || 0}`);
  console.table(allCohortCourses || []);
}

main().catch(console.error);
