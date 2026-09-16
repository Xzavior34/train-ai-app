import { createClient } from "@supabase/supabase-js";
import https from "https";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const ANON_KEY = "sb_publishable_BvoX4QvVa1-pG6mx7NsVUQ_4GXGlwaJ";

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function main() {
  console.log("=== SIGNING IN AS A REAL USER TO TEST AI EDGE FUNCTIONS ===");
  const email = "trainai@gmail.com";
  const password = "SaraF123$";

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authErr) {
    console.error("Sign in failed:", authErr);
    return;
  }

  const jwt = authData.session.access_token;
  console.log("Signed in successfully. Testing ai-generate-quiz with real JWT...");

  const url = new URL(`${SUPABASE_URL}/functions/v1/ai-generate-quiz`);
  const payload = JSON.stringify({
    topic: "Introduction to Artificial Intelligence",
    questionCount: 3,
    difficulty: "beginner"
  });

  const req = https.request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwt}`
    }
  }, (res) => {
    let body = "";
    res.on("data", chunk => body += chunk);
    res.on("end", () => {
      console.log(`\nAI Quiz Function Response (HTTP ${res.statusCode}):`);
      console.log(body.slice(0, 500));
    });
  });

  req.on("error", (e) => console.error("Request error:", e));
  req.write(payload);
  req.end();
}

main().catch(console.error);
