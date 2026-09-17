import { createClient } from "@supabase/supabase-js";
import https from "https";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const ANON_KEY = "sb_publishable_BvoX4QvVa1-pG6mx7NsVUQ_4GXGlwaJ";

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function main() {
  const email = "trainai@gmail.com";
  const password = "SaraF123$";

  const { data: authData } = await supabase.auth.signInWithPassword({ email, password });
  const jwt = authData.session.access_token;

  console.log("Testing ai-chat with real user JWT...");
  const url = new URL(`${SUPABASE_URL}/functions/v1/ai-chat`);
  const payload = JSON.stringify({
    conversationId: "test-conv-001",
    message: "What are the core fundamentals of Python variables?",
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
