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
    const db = createClient(url, service);
    const [{ data: roles }, { data: profile }, { data: membership }] = await Promise.all([
      db.from("user_roles").select("role").eq("user_id", callerData.user.id),
      db.from("user_profiles").select("organization_id").eq("id", callerData.user.id).maybeSingle(),
      db.from("organization_members").select("role,organization_id").eq("user_id", callerData.user.id).eq("status", "active").in("role", ["owner", "admin"]).limit(1).maybeSingle(),
    ]);
    const isSuper = (roles || []).some((row) => row.role === "super_admin");
    const orgId = membership?.organization_id || profile?.organization_id || null;
    if (!isSuper && !membership) return json({ error: "Administrator access required." }, 403);
    const body = await req.json().catch(() => ({}));
    const group = String(body.recipient_group || "all");
    const specificEmail = String(body.specific_email || "").trim().toLowerCase();

    let allowedIds: Set<string> | null = null;
    let profileQuery = db.from("user_profiles").select("id,last_active_at,organization_id");
    if (!isSuper && orgId) profileQuery = profileQuery.eq("organization_id", orgId);
    const { data: profiles } = await profileQuery;
    const now = Date.now();
    const activeCutoff = now - 30 * 86400000;
    if (group === "active_users") allowedIds = new Set((profiles || []).filter((p) => p.last_active_at && new Date(p.last_active_at).getTime() >= activeCutoff).map((p) => p.id));
    else if (group === "inactive_users") allowedIds = new Set((profiles || []).filter((p) => !p.last_active_at || new Date(p.last_active_at).getTime() < activeCutoff).map((p) => p.id));
    else if (["active_mentors", "inactive_mentors"].includes(group)) {
      let query = db.from("mentors").select("user_id,is_active");
      if (!isSuper && orgId) query = query.eq("organization_id", orgId);
      const { data } = await query;
      const wantsActive = group === "active_mentors";
      allowedIds = new Set((data || []).filter((row) => !!row.is_active === wantsActive).map((row) => row.user_id));
    } else if (group === "organizations") {
      let query = db.from("organization_members").select("user_id").eq("status", "active").in("role", ["owner", "admin"]);
      if (!isSuper && orgId) query = query.eq("organization_id", orgId);
      const { data } = await query;
      allowedIds = new Set((data || []).map((row) => row.user_id));
    } else if (group === "referral_signups") {
      const { data } = await db.from("referral_signups").select("referred_user_id").eq("signup_completed", true);
      const scoped = new Set((profiles || []).map((p) => p.id));
      allowedIds = new Set((data || []).map((row) => row.referred_user_id).filter((id) => isSuper || scoped.has(id)));
    } else if (group === "sara_foundation") {
      if (!isSuper) return json({ error: "This recipient group is restricted to the platform owner." }, 403);
      const { data } = await db.from("sara_foundation_emails").select("email");
      const emails = [...new Set((data || []).map((row) => String(row.email || "").toLowerCase()).filter(Boolean))];
      if (body.action === "count") return json({ count: emails.length });
      return await sendCampaign(db, callerData.user.id, body, emails);
    }

    const users = [];
    for (let page = 1; page <= 100; page += 1) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return json({ error: "Could not resolve recipients." }, 500);
      users.push(...data.users);
      if (data.users.length < 1000) break;
    }
    const scopedIds = new Set((profiles || []).map((p) => p.id));
    let emails = users
      .filter((user) => isSuper || scopedIds.has(user.id))
      .filter((user) => !allowedIds || allowedIds.has(user.id))
      .map((user) => user.email?.toLowerCase())
      .filter(Boolean);
    if (group === "specific_email") {
      emails = emails.filter((email) => email === specificEmail);
    }
    emails = [...new Set(emails)];
    if (body.action === "count") return json({ count: emails.length });
    return await sendCampaign(db, callerData.user.id, body, emails);
  } catch (error) {
    console.error("advanced-broadcast-email failed", error);
    return json({ error: "Could not process the email campaign." }, 500);
  }
});

async function sendCampaign(db, senderId: string, body: Record<string, unknown>, emails: string[]) {
  const subject = String(body.subject || "").trim().slice(0, 200);
  const html = String(body.html_content || "").trim();
  if (!subject || !html) return json({ error: "Subject and message are required." }, 400);
  if (!emails.length) return json({ error: "No recipients matched this audience." }, 400);
  const resendKey = Deno.env.get("RESEND_API_KEY") || Deno.env.get("RESEND_KEY") || "";
  if (!resendKey) return json({ error: "Email delivery is not configured." }, 503);
  const { data: campaign, error: campaignError } = await db.from("email_campaigns").insert({ sender_id: senderId, subject, html_content: html, recipient_group: String(body.recipient_group || "all"), recipient_count: emails.length, sent_count: 0, status: "sending" }).select("id").single();
  if (campaignError) return json({ error: campaignError.message }, 500);
  let sent = 0;
  const from = String(body.sender_email || Deno.env.get("RESEND_FROM_EMAIL") || "Train AI <info@trainailtd.com>");
  for (let index = 0; index < emails.length; index += 100) {
    const batch = emails.slice(index, index + 100).map((to) => ({ from, to: [to], subject, html }));
    const response = await fetch("https://api.resend.com/emails/batch", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify(batch) });
    if (response.ok) sent += batch.length;
  }
  await db.from("email_campaigns").update({ sent_count: sent, status: sent === emails.length ? "sent" : "failed", sent_at: new Date().toISOString() }).eq("id", campaign.id);
  return json({ success: sent > 0, email_sent: sent, total_recipients: emails.length, campaign_id: campaign.id }, sent > 0 ? 200 : 502);
}
