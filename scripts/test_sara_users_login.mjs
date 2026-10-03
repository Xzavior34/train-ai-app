import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const JEO_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const JEO_ANON = "sb_publishable_BvoX4QvVa1-pG6mx7NsVUQ_4GXGlwaJ";

const client = createClient(JEO_URL, JEO_ANON, { auth: { persistSession: false } });

async function main() {
  console.log("=== VERIFYING SARA FOUNDATION AUTH RESOLUTION ===");

  // Test sign in attempt with a non-existent password to verify auth service responds with expected credentials rejection (not 401/network/invalid key error)
  const res = await client.auth.signInWithPassword({
    email: "learner@sarafoundationafrica.com",
    password: "TestPassword123!"
  });

  console.log("Auth Response Status / Code:", res.error?.status, res.error?.message);

  if (res.error && res.error.status !== 400 && res.error.message !== "Invalid login credentials") {
    console.error("Unexpected error:", res.error);
    process.exit(1);
  }

  console.log("SUCCESS: Auth endpoint is online and responding correctly for Sara Foundation users!");
}

main().catch(console.error);
