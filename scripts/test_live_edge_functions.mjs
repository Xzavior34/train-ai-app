import https from "https";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co/functions/v1";
const ANON_KEY = "sb_publishable_BvoX4QvVa1-pG6mx7NsVUQ_4GXGlwaJ";

const functions = [
  { name: "ai-chat", method: "POST", body: { message: "hello" }, expectAuth: true },
  { name: "ai-generate-quiz", method: "POST", body: { topic: "AI" }, expectAuth: true },
  { name: "ai-insights", method: "POST", body: {}, expectAuth: true },
  { name: "generate-ai-recommendations", method: "POST", body: {}, expectAuth: true },
  { name: "ai-content-moderation", method: "POST", body: { content: "test" }, expectAuth: true },
  { name: "grant-ai-credits-from-payment", method: "POST", body: {}, expectAuth: true },
  { name: "stripe-webhook", method: "POST", body: {}, headers: { "stripe-signature": "invalid_sig" }, expectAuth: false },
  { name: "paystack-webhook", method: "POST", body: {}, headers: { "x-paystack-signature": "invalid_sig" }, expectAuth: false },
];

async function probeFunction(fn) {
  return new Promise((resolve) => {
    const url = new URL(`${BASE_URL}/${fn.name}`);
    const data = JSON.stringify(fn.body || {});
    const headers = {
      "Content-Type": "application/json",
      ...(fn.headers || {})
    };

    const req = https.request(url, {
      method: fn.method,
      headers
    }, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        resolve({
          name: fn.name,
          status: res.statusCode,
          headers: res.headers,
          body: body.slice(0, 300)
        });
      });
    });

    req.on("error", (e) => {
      resolve({
        name: fn.name,
        error: e.message
      });
    });

    req.write(data);
    req.end();
  });
}

async function main() {
  console.log("=== PROBING LIVE EDGE FUNCTIONS ON JEOBGGRTXEYBXV LWPXVN ===");
  for (const fn of functions) {
    const res = await probeFunction(fn);
    console.log(`\nFunction [${res.name}]:`);
    console.log(`- HTTP Status: ${res.status}`);
    console.log(`- Response: ${res.body}`);
  }
}

main().catch(console.error);
