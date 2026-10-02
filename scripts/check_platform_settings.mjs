import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const JEO_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const JEO_ANON = "sb_publishable_BvoX4QvVa1-pG6mx7NsVUQ_4GXGlwaJ";

const client = createClient(JEO_URL, JEO_ANON, { auth: { persistSession: false } });

async function main() {
  console.log("=== CHECKING PLATFORM SETTINGS ON JEOBGGRTXEYBXV LWPXVN ===");
  const { data, error } = await client.from("platform_settings").select("*");
  if (error) {
    console.error("Error:", error);
  } else {
    console.log(`Found ${data.length} settings:`);
    console.log(JSON.stringify(data, null, 2));
  }
}

main().catch(console.error);
