import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const allowedContexts = new Set(["credits", "course_enrollment", "waitlist_premium", "seat_purchase", "organization_subscription"]);
const allowedHosts = new Set(["trainailtd.com", "www.trainailtd.com", "localhost", "127.0.0.1"]);
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const auth = req.headers.get("Authorization") || "";
  const jwt = auth.replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  let secret = Deno.env.get("PAYSTACK_SECRET_KEY") || "";
  if (!jwt) return respond({ error: "Authentication required" }, 401);
  if (!url || !anon) return respond({ error: "Payment provider is not configured" }, 503);
  const authClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: userError } = await authClient.auth.getUser(jwt);
  if (userError || !userData?.user) return respond({ error: "Invalid session" }, 401);
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (service) {
    const db = createClient(url, service);
    const { data: profile } = await db.from("user_profiles").select("organization_id").eq("id", userData.user.id).maybeSingle();
    if (profile?.organization_id) {
      const { data: credentials } = await db.from("organization_payment_credentials").select("paystack_secret_key").eq("organization_id", profile.organization_id).maybeSingle();
      secret = credentials?.paystack_secret_key || secret;
    }
  }
  if (!secret) return respond({ error: "Payment provider is not configured" }, 503);

  const body = await req.json().catch(() => ({}));
  const amount = Number(body.amount);
  const context = String(body.context || "");
  if (!Number.isFinite(amount) || amount <= 0 || !allowedContexts.has(context)) return respond({ error: "Invalid payment request" }, 400);
  let callbackUrl: URL;
  try { callbackUrl = new URL(body.callback_url); } catch { return respond({ error: "Invalid callback URL" }, 400); }
  if (!allowedHosts.has(callbackUrl.hostname)) return respond({ error: "Callback host is not allowed" }, 400);

  const metadata = { ...(body.metadata || {}), context, user_id: userData.user.id };
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: userData.user.email,
      amount: Math.round(amount * 100),
      currency: String(body.currency || "NGN").toUpperCase(),
      callback_url: callbackUrl.toString(),
      metadata,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.status) return respond({ error: result?.message || "Could not initialize payment" }, 502);
  return respond({ authorization_url: result.data.authorization_url, access_code: result.data.access_code, reference: result.data.reference });
});
