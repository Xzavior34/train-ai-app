import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log("=== CHECK LIVE SUPABASE BASELINE ===");

  const { data: orgs, error: oErr } = await supabase.from("organizations").select("id, name, slug, tier, seat_limit, status");
  console.log("Organizations count:", orgs?.length, "Error:", oErr?.message || "none");
  console.log("Organizations:", JSON.stringify(orgs, null, 2));

  const { data: prices, error: prErr } = await supabase.from("billing_prices").select("*");
  console.log("Billing prices count:", prices?.length, "Error:", prErr?.message || "none");

  const { data: aiAccounts, error: aiErr } = await supabase.from("ai_credit_accounts").select("*");
  console.log("AI Credit Accounts count:", aiAccounts?.length, "Error:", aiErr?.message || "none");

  const { data: invites, error: invErr } = await supabase.from("user_invitations").select("*").limit(5);
  console.log("User invitations count (sample):", invites?.length, "Error:", invErr?.message || "none");

  const { data: tables, error: tErr } = await supabase.rpc("check_seat_available", { p_organization_id: orgs?.[0]?.id });
  console.log("check_seat_available RPC test:", tables, "Error:", tErr?.message || "none");
}

run().catch(console.error);
