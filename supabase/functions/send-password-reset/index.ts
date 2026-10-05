import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const canonicalOrigin = "https://trainailtd.com";
const allowedHosts = new Set(["trainailtd.com", "www.trainailtd.com"]);

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hash(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeRedirect(value: unknown) {
  const fallback = `${canonicalOrigin}/?view=auth&recovery=1`;
  try {
    const candidate = new URL(String(value || fallback));
    return candidate.protocol === "https:" && allowedHosts.has(candidate.hostname)
      ? candidate.toString()
      : fallback;
  } catch {
    return fallback;
  }
}

function resetEmail(email: string, actionLink: string, otp: string) {
  const code = otp
    ? `<p style="font-size:13px;color:#475569;margin-top:24px">Or enter this recovery code:</p><p style="font-size:28px;font-weight:800;letter-spacing:.2em;color:#2563eb">${otp}</p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px"><table width="100%" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:14px"><tr><td style="padding:32px"><p style="font-size:22px;font-weight:800;margin:0 0 24px">TRAIN<span style="color:#2563eb">AI</span></p><h1 style="font-size:24px;margin:0 0 12px">Reset your password</h1><p style="line-height:1.6;color:#475569">A password reset was requested for ${email}. Use the secure button below within 60 minutes.</p><p style="margin:28px 0"><a href="${actionLink}" style="background:#2563eb;color:#fff;padding:14px 24px;border-radius:9px;text-decoration:none;font-weight:700">Choose a new password</a></p>${code}<p style="font-size:13px;line-height:1.6;color:#64748b">If you did not request this, you can ignore this email. Need help? Contact info@trainailtd.com.</p></td></tr></table></td></tr></table></body></html>`;
}

async function sendThroughSupabase(url: string, anonKey: string, email: string, redirectTo: string) {
  if (!anonKey) return false;
  const response = await fetch(`${url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return response.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return respond({ success: false, emailSent: false, rateLimited: false, error: "Enter a valid email address." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    if (!supabaseUrl || !serviceKey) return respond({ success: false, emailSent: false, rateLimited: false, error: "Recovery service is not configured." }, 503);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const clientIp = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown").split(",")[0].trim();
    const [emailHash, ipHash] = await Promise.all([hash(email), hash(clientIp)]);
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const [{ count: emailCount }, { count: ipCount }] = await Promise.all([
      admin.from("password_reset_attempts").select("id", { count: "exact", head: true }).eq("email_hash", emailHash).gte("created_at", since),
      admin.from("password_reset_attempts").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since),
    ]);
    if ((emailCount || 0) >= 5 || (ipCount || 0) >= 20) {
      return respond({ success: false, emailSent: false, rateLimited: true, error: "Too many reset requests. Please wait 15 minutes and try again." }, 429);
    }
    await admin.from("password_reset_attempts").insert({ email_hash: emailHash, ip_hash: ipHash });

    const redirectTo = safeRedirect(body.redirectTo);
    const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } });
    if (error) {
      const unknownUser = /not found|does not exist/i.test(error.message || "");
      if (unknownUser) return respond({ success: true, emailSent: true, rateLimited: false });
      return respond({ success: false, emailSent: false, rateLimited: false, error: "Recovery could not be started. Please try again." }, 400);
    }

    const actionLink = data?.properties?.action_link || redirectTo;
    const otp = data?.properties?.email_otp || "";
    const resendKey = (Deno.env.get("RESEND_API_KEY") || Deno.env.get("RESEND_KEY") || "").trim();
    let delivered = false;
    if (resendKey) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: Deno.env.get("RESEND_FROM_EMAIL") || "Train AI <info@trainailtd.com>",
          to: [email],
          subject: "Reset your Train AI password",
          html: resetEmail(email, actionLink, otp),
        }),
      });
      delivered = response.ok;
    }

    if (!delivered) delivered = await sendThroughSupabase(supabaseUrl, anonKey, email, redirectTo);
    if (!delivered) {
      return respond({ success: false, emailSent: false, rateLimited: false, error: "The recovery email could not be delivered. Please try again shortly." }, 503);
    }
    return respond({ success: true, emailSent: true, rateLimited: false, email });
  } catch (error) {
    console.error("send-password-reset failed", error);
    return respond({ success: false, emailSent: false, rateLimited: false, error: "The recovery service is temporarily unavailable." }, 500);
  }
});
