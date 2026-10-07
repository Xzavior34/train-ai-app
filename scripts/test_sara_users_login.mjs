import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";


const JEO_URL = process.env.SUPABASE_URL;
const JEO_ANON = process.env.SUPABASE_ANON_KEY;
const TEST_EMAIL = process.env.TEST_USER_EMAIL || "nonexistent-auth-probe@example.invalid";

if (!JEO_URL || !JEO_ANON) {
  throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required.");
}

const client = createClient(JEO_URL, JEO_ANON, { auth: { persistSession: false } });

async function main() {
  console.log("=== VERIFYING SARA FOUNDATION AUTH RESOLUTION ===");

  // Test sign in attempt with a non-existent password to verify auth service responds with expected credentials rejection (not 401/network/invalid key error)
  const res = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: `Invalid-${randomUUID()}-A1!`
  });

  console.log("Auth Response Status / Code:", res.error?.status, res.error?.message);

  if (res.error && res.error.status !== 400 && res.error.message !== "Invalid login credentials") {
    console.error("Unexpected error:", res.error);
    process.exit(1);
  }

  console.log("SUCCESS: Auth endpoint is online and responding correctly for Sara Foundation users!");
}

main().catch(console.error);
