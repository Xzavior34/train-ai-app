import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!url || !anonKey || !serviceKey || !jwt) return json({ error: "Unauthorized" }, 401);

    const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser(jwt);
    if (callerError || !callerData.user) return json({ error: "Invalid or expired session" }, 401);

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: roles, error: roleError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerData.user.id);
    if (roleError || !(roles || []).some((row) => row.role === "super_admin")) {
      return json({ error: "Only a platform owner can reset two-factor authentication." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "A valid email is required." }, 400);

    let target = null;
    for (let page = 1; page <= 100 && !target; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return json({ error: "Could not look up this user." }, 500);
      target = data.users.find((user) => user.email?.toLowerCase() === email) || null;
      if (data.users.length < 1000) break;
    }
    if (!target) return json({ error: "No account was found with this email address." }, 404);

    const factors = target.factors || [];
    const results = [];
    for (const factor of factors) {
      const { error } = await admin.auth.admin.mfa.deleteFactor({ userId: target.id, id: factor.id });
      results.push({ id: factor.id, deleted: !error, ...(error ? { error: error.message } : {}) });
    }
    const factorsRemoved = results.filter((result) => result.deleted).length;
    return json({ success: true, userId: target.id, factorsRemoved, totalFactors: factors.length, results });
  } catch (error) {
    console.error("admin-reset-mfa failed", error);
    return json({ error: "Could not reset two-factor authentication." }, 500);
  }
});
