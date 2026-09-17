import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=== COHORT TABLES COLUMNS ===");

  const { data: s } = await supabase.from("cohort_sessions").select("*").limit(1);
  console.log("\ncohort_sessions sample row:", s?.[0]);

  const { data: r } = await supabase.from("cohort_resources").select("*").limit(1);
  console.log("\ncohort_resources sample row:", r?.[0]);

  const { data: c } = await supabase.from("cohort_courses").select("*, courses(*)").limit(1);
  console.log("\ncohort_courses sample row:", c?.[0]);
}

main().catch(console.error);
