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
  let secret = Deno.env.get("STRIPE_SECRET_KEY") || "";
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
      const { data: credentials } = await db.from("organization_payment_credentials").select("stripe_secret_key").eq("organization_id", profile.organization_id).maybeSingle();
      secret = credentials?.stripe_secret_key || secret;
    }
  }
  if (!secret) return respond({ error: "Payment provider is not configured" }, 503);
  const body = await req.json().catch(() => ({}));
  const amount = Number(body.amount); const context = String(body.context || "");
  if (!Number.isFinite(amount) || amount <= 0 || !allowedContexts.has(context)) return respond({ error: "Invalid payment request" }, 400);
  let success: URL; let cancel: URL;
  try { success = new URL(body.success_url); cancel = new URL(body.cancel_url); } catch { return respond({ error: "Invalid return URL" }, 400); }
  if (!allowedHosts.has(success.hostname) || !allowedHosts.has(cancel.hostname)) return respond({ error: "Return host is not allowed" }, 400);
  success.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
  const reference = crypto.randomUUID();
  success.searchParams.set("reference", reference);
  const form = new URLSearchParams({
    mode: "payment", success_url: success.toString(), cancel_url: cancel.toString(),
    customer_email: userData.user.email || "", client_reference_id: reference,
    "line_items[0][price_data][currency]": String(body.currency || "USD").toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(Math.round(amount * 100)),
    "line_items[0][price_data][product_data][name]": String(body.description || "Train AI purchase"),
    "line_items[0][quantity]": "1", "metadata[user_id]": userData.user.id,
    "metadata[context]": context, "metadata[reference]": reference,
    "metadata[metadata_json]": JSON.stringify(body.metadata || {}).slice(0, 450),
  });
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.url) return respond({ error: result?.error?.message || "Could not initialize payment" }, 502);
  return respond({ checkout_url: result.url, session_id: result.id, reference });
});
