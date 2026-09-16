import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=== FIX FLIP FELLOW C2 COHORT CONSOLIDATION ===");

  const targetCohortId = "35a6a31e-cd6f-42d6-80e4-b30c39445a2e";
  const duplicateCohortId = "e0509f84-5d83-4976-9ee7-fec263415416";

  // 1. Move sessions
  const { data: movedSessions, error: sessErr } = await supabase
    .from("cohort_sessions")
    .update({ cohort_id: targetCohortId })
    .eq("cohort_id", duplicateCohortId)
    .select();
  console.log(`Moved ${movedSessions?.length || 0} sessions to cohort ${targetCohortId}:`, sessErr || "OK");

  // 2. Move resources
  const { data: movedResources, error: resErr } = await supabase
    .from("cohort_resources")
    .update({ cohort_id: targetCohortId })
    .eq("cohort_id", duplicateCohortId)
    .select();
  console.log(`Moved ${movedResources?.length || 0} resources to cohort ${targetCohortId}:`, resErr || "OK");

  // 3. Move courses
  const { data: movedCourses, error: courErr } = await supabase
    .from("cohort_courses")
    .update({ cohort_id: targetCohortId })
    .eq("cohort_id", duplicateCohortId)
    .select();
  console.log(`Moved ${movedCourses?.length || 0} courses to cohort ${targetCohortId}:`, courErr || "OK");

  // 4. Update Target Cohort Metadata
  const { error: updateErr } = await supabase
    .from("cohorts")
    .update({
      description: "FLIP Fellowship cohort 2: Intensive training in AI, digital skills, leadership and career growth.",
      starts_at: "2025-08-01",
      ends_at: "2026-10-31"
    })
    .eq("id", targetCohortId);
  console.log(`Updated cohort ${targetCohortId} metadata:`, updateErr || "OK");

  // 5. Ensure Sara Admin membership
  const saraId = "4d034e4a-76b4-44eb-8918-ce3d1cc5dfd9";
  const { data: existingSaraMem } = await supabase
    .from("cohort_members")
    .select("*")
    .eq("cohort_id", targetCohortId)
    .eq("user_id", saraId);

  if (!existingSaraMem || existingSaraMem.length === 0) {
    const { error: insSaraErr } = await supabase.from("cohort_members").insert({
      cohort_id: targetCohortId,
      user_id: saraId,
      added_by: saraId
    });
    console.log("Added Sara to cohort_members:", insSaraErr || "OK");
  } else {
    console.log("Sara already in cohort_members for target cohort.");
  }

  // 6. Delete members on duplicate cohort, then delete duplicate cohort
  const { error: delMemErr } = await supabase
    .from("cohort_members")
    .delete()
    .eq("cohort_id", duplicateCohortId);
  console.log("Deleted duplicate cohort members:", delMemErr || "OK");

  const { error: delCohortErr } = await supabase
    .from("cohorts")
    .delete()
    .eq("id", duplicateCohortId);
  console.log("Deleted duplicate cohort:", delCohortErr || "OK");

  // 7. Verify target cohort status
  console.log("\n=== VERIFYING FINAL TARGET COHORT DATA ===");
  const { data: finalCohort } = await supabase.from("cohorts").select("*").eq("id", targetCohortId).single();
  const { data: finalSessions } = await supabase.from("cohort_sessions").select("*").eq("cohort_id", targetCohortId);
  const { data: finalResources } = await supabase.from("cohort_resources").select("*").eq("cohort_id", targetCohortId);
  const { data: finalCourses } = await supabase.from("cohort_courses").select("*").eq("cohort_id", targetCohortId);
  const { data: finalMembers } = await supabase.from("cohort_members").select("*").eq("cohort_id", targetCohortId);

  console.log(`Target Cohort Name: ${finalCohort?.name} (${finalCohort?.id})`);
  console.log(`Sessions Count: ${finalSessions?.length}`);
  console.log(`Resources Count: ${finalResources?.length}`);
  console.log(`Courses Count: ${finalCourses?.length}`);
  console.log(`Members Count: ${finalMembers?.length}`);
}

main().catch(console.error);
