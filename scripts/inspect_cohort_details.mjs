import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=== CHECK ALL COHORT RELATED DATA & RLS POLICIES ===");

  const { data: cohorts } = await supabase.from("cohorts").select("*");
  console.log("Cohorts:", cohorts);

  const { data: sessions } = await supabase.from("cohort_sessions").select("*");
  console.log("Sessions count:", sessions?.length, "Sessions:", sessions);

  const { data: resources } = await supabase.from("cohort_resources").select("*");
  console.log("Resources count:", resources?.length, "Resources:", resources);

  const { data: courses } = await supabase.from("cohort_courses").select("*");
  console.log("Courses count:", courses?.length, "Courses:", courses);

  const { data: members } = await supabase.from("cohort_members").select("*");
  console.log("Members count:", members?.length);

  // Let's check RLS policies via SQL or schema check if possible or test client queries
  // Let's sign in as Sara with service role auth admin or generate a token to test client queries as Sara
  const saraId = "4d034e4a-76b4-44eb-8918-ce3d1cc5dfd9";
  
  // Test query as Sara:
  // Using anon key + set user or test RLS policies
}

main().catch(console.error);
