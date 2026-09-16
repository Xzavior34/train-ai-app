import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log("=== CHECK DB SCHEMA & MIGRATIONS ===");

  // Let's check tables via rpc or select
  const { data: orgCols, error: orgErr } = await supabase.from("organizations").select("*").limit(1);
  console.log("Organizations sample row / error:", orgCols, orgErr);

  // Let's check user_profiles
  const { data: profs, error: profErr } = await supabase.from("user_profiles").select("*").limit(1);
  console.log("User profiles sample row / error:", profs, profErr);

  // Let's check schema_migrations if accessible
  const { data: migs, error: migErr } = await supabase.from("supabase_migrations").select("*");
  console.log("supabase_migrations:", migs, migErr);
}

run().catch(console.error);
