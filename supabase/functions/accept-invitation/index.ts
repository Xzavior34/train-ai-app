import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!url || !service) return json({ error: "Server configuration missing." }, 500);
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || "").trim();
    const password = typeof body.password === "string" ? body.password : "";
    if (!token) return json({ error: "Missing invitation token." }, 400);
    const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: invitation, error: inviteError } = await db.from("user_invitations").select("email,organization_id,organization_role,role,expires_at,status,organizations(name)").eq("token", token).maybeSingle();
    if (inviteError || !invitation || invitation.status !== "pending" || new Date(invitation.expires_at) <= new Date()) return json({ error: "This invitation is invalid, expired, or already used." }, 400);
    let user = null;
    for (let page = 1; page <= 100 && !user; page += 1) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return json({ error: "Could not look up the invited account." }, 500);
      user = data.users.find((candidate) => candidate.email?.toLowerCase() === invitation.email.toLowerCase()) || null;
      if (data.users.length < 1000) break;
    }
    let isNewUser = false;
    if (!user) {
      if (!password) return json({ requires_signup: true, email: invitation.email, organization_name: invitation.organizations?.name, role: invitation.role }, 400);
      if (password.length < 8) return json({ error: "Password must be at least 8 characters.", requires_signup: true }, 400);
      const { data, error } = await db.auth.admin.createUser({ email: invitation.email, password, email_confirm: true, user_metadata: { display_name: String(body.display_name || "").trim(), role: invitation.role } });
      if (error || !data.user) return json({ error: error?.message || "Could not create the invited account." }, 400);
      user = data.user;
      isNewUser = true;
    }
    const { data: accepted, error: acceptError } = await db.rpc("accept_invitation_for_user", { p_token: token, p_user_id: user.id });
    if (acceptError) return json({ error: acceptError.message }, 400);
    return json({ ...accepted, success: true, is_new_user: isNewUser, message: "Invitation accepted." });
  } catch (error) {
    console.error("accept-invitation failed", error);
    return json({ error: "Could not accept invitation." }, 500);
  }
});
