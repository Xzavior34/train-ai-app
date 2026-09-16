import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function inspect(table) {
  const { data, error } = await supabase.from(table).select("*").limit(1);
  if (error) {
    console.log(`Table ${table} error:`, error.message);
  } else if (data && data[0]) {
    console.log(`Table ${table} columns:`, Object.keys(data[0]));
  } else {
    console.log(`Table ${table} is empty. Trying to insert and rollback or inspect...`);
  }
}

async function run() {
  await inspect("courses");
  await inspect("lessons");
  await inspect("cohorts");
  await inspect("cohort_courses");
  await inspect("cohort_members");
  await inspect("certificates");
}

run().catch(console.error);
