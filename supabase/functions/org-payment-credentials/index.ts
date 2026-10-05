import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Authentication required" }, 401);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !anon || !serviceRole) return json({ error: "Server configuration missing" }, 500);

  const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await caller.auth.getUser(jwt);
  if (userError || !userData?.user) return json({ error: "Invalid session" }, 401);

  const body = await req.json().catch(() => ({}));
  const organizationId = String(body.organization_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(organizationId)) return json({ error: "Valid organization_id is required" }, 400);

  const db = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const userId = userData.user.id;
  const [{ data: roles }, { data: membership }] = await Promise.all([
    db.from("user_roles").select("role").eq("user_id", userId),
    db.from("organization_members").select("role").eq("user_id", userId).eq("organization_id", organizationId).maybeSingle(),
  ]);
  const isSuperAdmin = (roles || []).some((row) => row.role === "super_admin");
  const isOrgAdmin = membership && ["owner", "admin"].includes(membership.role);
  if (!isSuperAdmin && !isOrgAdmin) return json({ error: "Organization administrator access required" }, 403);

  if (body.action === "status") {
    const { data, error } = await db.from("organization_payment_credentials")
      .select("paystack_secret_key, stripe_secret_key, updated_at")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    return json({
      success: true,
      has_paystack_secret: !!data?.paystack_secret_key,
      has_stripe_secret: !!data?.stripe_secret_key,
      updated_at: data?.updated_at || null,
    });
  }

  if (body.action !== "update") return json({ error: "Unknown action" }, 400);
  const patch: Record<string, unknown> = { organization_id: organizationId, updated_at: new Date().toISOString(), updated_by: userId };
  if (typeof body.paystack_secret_key === "string" && body.paystack_secret_key.trim()) patch.paystack_secret_key = body.paystack_secret_key.trim();
  if (typeof body.stripe_secret_key === "string" && body.stripe_secret_key.trim()) patch.stripe_secret_key = body.stripe_secret_key.trim();
  if (body.clear_paystack_secret === true) patch.paystack_secret_key = null;
  if (body.clear_stripe_secret === true) patch.stripe_secret_key = null;

  const { error } = await db.from("organization_payment_credentials").upsert(patch, { onConflict: "organization_id" });
  if (error) return json({ error: error.message }, 500);
  return json({ success: true });
});
