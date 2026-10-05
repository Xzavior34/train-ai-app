import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
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
  const { reference } = await req.json().catch(() => ({}));
  if (!reference || !/^[A-Za-z0-9._=-]{5,200}$/.test(reference)) return respond({ error: "Invalid reference" }, 400);
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secret}` } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.status) return respond({ error: result?.message || "Could not verify payment" }, 502);
  const tx = result.data || {};
  if (tx.metadata?.user_id && tx.metadata.user_id !== userData.user.id) return respond({ error: "Payment does not belong to this account" }, 403);
  return respond({
    success: tx.status === "success", status: tx.status === "success" ? "completed" : tx.status,
    amount: Number(tx.amount || 0) / 100, currency: tx.currency, context: tx.metadata?.context,
    reference: tx.reference, metadata: tx.metadata || {},
  });
});
