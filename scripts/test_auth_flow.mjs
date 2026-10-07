import { createClient } from "@supabase/supabase-js";


const JEO_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const JEO_ANON = "sb_publishable_BvoX4QvVa1-pG6mx7NsVUQ_4GXGlwaJ";

const client = createClient(JEO_URL, JEO_ANON, { auth: { persistSession: false } });

async function main() {
  console.log("=== TESTING LIVE AUTH ON JEOBGGRTXEYBXV LWPXVN ===");

  // Test password reset request on auth endpoint
  console.log("\n1. Testing resetPasswordForEmail with trainailtd.com redirect...");
  const resetRes = await client.auth.resetPasswordForEmail("test.learner@sarafoundationafrica.com", {
    redirectTo: "https://trainailtd.com/?view=auth#type=recovery"
  });

  console.log("Reset Password Response:", JSON.stringify(resetRes, null, 2));

  // Test edge function invocation for send-password-reset
  console.log("\n2. Testing send-password-reset edge function invocation...");
  try {
    const fnRes = await client.functions.invoke("send-password-reset", {
      body: {
        email: "test.learner@sarafoundationafrica.com",
        redirectTo: "https://trainailtd.com/?view=auth#type=recovery"
      }
    });
    console.log("Edge Function Response:", JSON.stringify(fnRes, null, 2));
  } catch (e) {
    console.log("Edge Function invoke notice:", e.message);
  }

  console.log("\nLive Auth test complete!");
}

main().catch(console.error);
