import { createClient } from "@supabase/supabase-js";


const JEO_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const JEO_ANON = "sb_publishable_BvoX4QvVa1-pG6mx7NsVUQ_4GXGlwaJ";

const client = createClient(JEO_URL, JEO_ANON, { auth: { persistSession: false } });

async function main() {
  console.log("=== CHECKING RECORDS IN JEOBGGRTXEYBXV LWPXVN ===");
  const allPossibleTables = [
    "platform_settings", "branding_settings", "organizations", "email_campaigns",
    "org_integrations", "cohorts", "courses", "lessons", "user_profiles",
    "video_integration_settings", "reminder_settings", "org_sso_settings",
    "support_tickets", "feedback"
  ];

  for (const t of allPossibleTables) {
    try {
      const { data, error } = await client.from(t).select("*").limit(10);
      if (error) {
        // console.log(`- ${t}: ${error.message}`);
      } else if (data && data.length > 0) {
        console.log(`\n>>> [${t}] (${data.length} rows):`);
        console.log(JSON.stringify(data, null, 2));
      }
    } catch (e) {
      // ignore
    }
  }
}

main().catch(console.error);
