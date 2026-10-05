import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!url || !anon || !service || !jwt) return json({ error: "Unauthorized" }, 401);
    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: callerData, error: callerError } = await caller.auth.getUser(jwt);
    if (callerError || !callerData.user) return json({ error: "Invalid or expired session" }, 401);
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const organizationId = String(body.organization_id || "");
    const role = String(body.role || "learner");
    const organizationRole = String(body.organization_role || "member");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !/^[0-9a-f-]{36}$/i.test(organizationId)) return json({ error: "Valid email and organization are required." }, 400);
    const db = createClient(url, service);
    const [{ data: membership }, { data: roles }, { data: org }] = await Promise.all([
      db.from("organization_members").select("role,status").eq("organization_id", organizationId).eq("user_id", callerData.user.id).eq("status", "active").maybeSingle(),
      db.from("user_roles").select("role").eq("user_id", callerData.user.id),
      db.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
    ]);
    const authorized = ["owner", "admin"].includes(membership?.role) || (roles || []).some((row) => row.role === "super_admin");
    if (!authorized) return json({ error: "Organization administrator access required." }, 403);
    const existing = await db.from("user_invitations").select("id,token").eq("organization_id", organizationId).eq("email", email).eq("status", "pending").gt("expires_at", new Date().toISOString()).maybeSingle();
    let invitation = existing.data;
    if (!invitation) {
      const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
      const token = Array.from(tokenBytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const { data, error } = await db.from("user_invitations").insert({ email, organization_id: organizationId, role, organization_role: organizationRole, invited_by: callerData.user.id, token }).select("id,token").single();
      if (error) return json({ error: error.message }, 400);
      invitation = data;
    }
    const inviteUrl = `https://trainailtd.com/?invite=${encodeURIComponent(invitation.token)}`;
    const resendKey = Deno.env.get("RESEND_API_KEY") || Deno.env.get("RESEND_KEY") || "";
    if (!resendKey) return json({ error: "Invitation created, but email delivery is not configured.", invitation_id: invitation.id }, 503);
    const mail = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: Deno.env.get("RESEND_FROM_EMAIL") || "Train AI <info@trainailtd.com>", to: [email], subject: `You're invited to ${org?.name || "Train AI"}`, html: `<p>You have been invited to join <strong>${org?.name || "Train AI"}</strong>.</p><p><a href="${inviteUrl}">Accept invitation</a></p><p>This invitation expires in 7 days.</p>`, text: `You have been invited to join ${org?.name || "Train AI"}. Accept here: ${inviteUrl}` }) });
    if (!mail.ok) return json({ error: "Invitation created, but the email could not be delivered.", invitation_id: invitation.id }, 502);
    return json({ success: true, results: [{ success: true, invitation_id: invitation.id }] });
  } catch (error) {
    console.error("invite-user failed", error);
    return json({ error: "Could not create invitation." }, 500);
  }
});
