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
  const email = TEST_USER_EMAIL;
  const password = TEST_USER_PASSWORD;

  const { data: authData } = await supabase.auth.signInWithPassword({ email, password });
  const jwt = authData.session.access_token;
  const userId = authData.user.id;

  // Create conversation row
  const { data: conv, error: convErr } = await supabase
    .from("ai_conversations")
    .insert({
      user_id: userId,
      title: "Test Live Chat"
    })
    .select()
    .single();

  if (convErr) {
    console.log("ai_conversations insert error:", convErr);
    return;
  }
  console.log("Created live conversation:", conv.id);

  console.log("Calling ai-chat edge function with conversation ID...");
  const url = new URL(`${SUPABASE_URL}/functions/v1/ai-chat`);
  const payload = JSON.stringify({
    conversationId: conv.id,
    message: "Hello! Give me a 1-sentence tip on effective studying.",
    history: []
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
      console.log(`\nAI Chat Function Response (HTTP ${res.statusCode}):`);
      console.log(body.slice(0, 500));
    });
  });

  req.on("error", (e) => console.error("Request error:", e));
  req.write(payload);
  req.end();
}

main().catch(console.error);
