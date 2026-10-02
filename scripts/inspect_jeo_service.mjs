import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const JEO_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const JEO_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6Implb2JnZ3J0eGV5Ynh2bHdweHZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMyNjM1NywiZXhwIjoyMTAyOTAyMzU3fQ.uDCs11c1ti9xGopgIcrVAGALgvjrhYSLMZyu5A_F-_Y";

const client = createClient(JEO_URL, JEO_SERVICE_KEY, { auth: { persistSession: false } });

async function main() {
  console.log("=== INSPECTING JEOBGGRTXEYBXV LWPXVN WITH SERVICE KEY ===");
  
  // 1. Check user_profiles
  const { data: users, error: uErr } = await client.from("user_profiles").select("id, email, display_name, role, organization_id").limit(10);
  console.log("User Profiles count:", users?.length, "Error:", uErr?.message);
  if (users?.length) console.log("Users:", JSON.stringify(users, null, 2));

  // 2. Check platform_settings / integrations / secrets
  const tables = [
    "platform_settings", "branding_settings", "organizations", "email_campaigns",
    "org_integrations", "cohorts", "courses"
  ];

  for (const t of tables) {
    const { data, error } = await client.from(t).select("*").limit(5);
    if (!error && data?.length > 0) {
      console.log(`Table [${t}]: ${data.length} rows`);
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

main().catch(console.error);
