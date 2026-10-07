import { createClient } from "@supabase/supabase-js";
import https from "https";


const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;

if (!SUPABASE_URL || !ANON_KEY || !TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
  throw new Error("SUPABASE_URL, SUPABASE_ANON_KEY, TEST_USER_EMAIL, and TEST_USER_PASSWORD are required.");
}

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function main() {
  console.log("=== SIGNING IN AS A REAL USER TO TEST AI EDGE FUNCTIONS ===");
  const email = TEST_USER_EMAIL;
  const password = TEST_USER_PASSWORD;

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
