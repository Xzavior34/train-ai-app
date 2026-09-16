import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  const tables = [
    "ai_credit_accounts",
    "ai_credit_transactions",
    "billing_prices",
    "organization_subscriptions",
    "organization_payments",
    "organization_branding",
    "enrollments",
    "lesson_completions",
    "assessment_submissions"
  ];

  for (const t of tables) {
    const { data, error } = await supabase.from(t).select("*").limit(1);
    console.log(`Table ${t}:`, error ? `ERROR: ${error.message}` : `OK, sample count: ${data?.length}`);
  }
}

run().catch(console.error);
