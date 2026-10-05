import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const auth = req.headers.get("Authorization") || ""; const jwt = auth.replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL") || ""; const anon = Deno.env.get("SUPABASE_ANON_KEY") || ""; let secret = Deno.env.get("STRIPE_SECRET_KEY") || "";
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
  const body = await req.json().catch(() => ({})); const sessionId = String(body.session_id || "");
  if (!/^cs_(test_|live_)?[A-Za-z0-9_]+$/.test(sessionId)) return respond({ error: "Valid session_id is required" }, 400);
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, { headers: { Authorization: `Bearer ${secret}` } });
  const session = await response.json().catch(() => ({}));
  if (!response.ok) return respond({ error: session?.error?.message || "Could not verify payment" }, 502);
  if (session.metadata?.user_id !== userData.user.id) return respond({ error: "Payment does not belong to this account" }, 403);
  let metadata = {}; try { metadata = JSON.parse(session.metadata?.metadata_json || "{}"); } catch { metadata = {}; }
  return respond({ success: session.payment_status === "paid", status: session.payment_status === "paid" ? "completed" : session.payment_status, amount: Number(session.amount_total || 0) / 100, currency: String(session.currency || "").toUpperCase(), context: session.metadata?.context, reference: session.metadata?.reference || session.client_reference_id, metadata });
});
