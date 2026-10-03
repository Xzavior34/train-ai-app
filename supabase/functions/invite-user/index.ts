// Train AI - invite-user Edge Function
//
// Dispatches organization invitation emails exclusively via Resend with trainailtd.com branding
//
// Deploy with: supabase functions deploy invite-user
// Configure with: supabase secrets set RESEND_API_KEY=re_...
//                 supabase secrets set RESEND_FROM_EMAIL="Train AI <info@trainailtd.com>"

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CANONICAL_DOMAIN = "https://trainailtd.com";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildInviteEmailHtml({ email, orgName, role, inviteUrl }: { email: string; orgName: string; role: string; inviteUrl: string }) {
  const formattedRole = role ? role.charAt(0).toUpperCase() + role.slice(1) : "Learner";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're invited to join ${orgName || "Train AI"}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="540" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; text-align: center; border-bottom: 1px solid #1f2937; background: linear-gradient(180deg, #1e293b 0%, #111827 100%);">
              <div style="display: inline-block; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">
                TRAIN<span style="color: #3b82f6;">AI</span>
              </div>
              <div style="font-size: 13px; color: #94a3b8; margin-top: 4px; font-weight: 500;">
                Enterprise Learning &amp; AI Intelligence
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #ffffff; text-align: center;">
                You're Invited to Join ${orgName || "Train AI"}
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 14.5px; line-height: 1.6; color: #94a3b8; text-align: center;">
                You have been invited to join <strong style="color: #f1f5f9;">${orgName || "Train AI"}</strong> on the Train AI platform as a <strong style="color: #3b82f6;">${formattedRole}</strong>.
              </p>

              <!-- Main CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${inviteUrl}" target="_blank" style="display: inline-block; background-color: #2563eb; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 10px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);">
                  Accept Invitation &amp; Get Started
                </a>
              </div>

              <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 16px; margin: 24px 0;">
                <div style="font-size: 12px; font-weight: 600; color: #94a3b8; margin-bottom: 6px;">Your Invitation Link:</div>
                <div style="font-size: 12px; color: #60a5fa; word-break: break-all; font-family: monospace;">
                  ${inviteUrl}
                </div>
              </div>

              <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 1.6; color: #64748b; text-align: center;">
                This invitation link is valid for <strong>7 days</strong>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #0b0f19; border-top: 1px solid #1f2937; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">
                Train AI LTD &bull; <a href="https://trainailtd.com" style="color: #3b82f6; text-decoration: none;">trainailtd.com</a>
              </p>
              <p style="margin: 0; font-size: 11.5px; color: #475569;">
                Need assistance? Contact our team at <a href="mailto:info@trainailtd.com" style="color: #94a3b8; text-decoration: underline;">info@trainailtd.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawEmail = (body.email || "").trim();
    const organizationId = body.organization_id;
    const role = body.role || "learner";
    const organizationRole = body.organization_role || "member";

    if (!rawEmail || !organizationId) {
      return jsonResponse({ error: "Email and organization_id are required." }, 400);
    }
    const normalizedEmail = rawEmail.toLowerCase();

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase configuration missing." }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 1. Create invitation record via RPC
    const { data: inviteResult, error: rpcError } = await supabaseAdmin.rpc("create_user_invitation", {
      p_email: normalizedEmail,
      p_organization_id: organizationId,
      p_role: role,
      p_organization_role: organizationRole
    });

    if (rpcError) {
      return jsonResponse({ success: false, error: rpcError.message }, 400);
    }

    // 2. Fetch invitation token and organization details
    const { data: inviteRow } = await supabaseAdmin
      .from("user_invitations")
      .select("token, organization_id")
      .eq("email", normalizedEmail)
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: orgRow } = await supabaseAdmin
      .from("organizations")
      .select("name, slug")
      .eq("id", organizationId)
      .maybeSingle();

    const orgName = orgRow?.name || "Your Organization";
    const token = inviteRow?.token || (inviteResult?.token) || "";
    const inviteUrl = `${CANONICAL_DOMAIN}/?invite=${token}`;

    // 3. Dispatch via Resend
    const resendApiKey = (
      Deno.env.get("RESEND_API_KEY") ||
      Deno.env.get("RESEND_KEY") ||
      ""
    ).trim();

    const fromEmail = (
      Deno.env.get("RESEND_FROM_EMAIL") ||
      "Train AI <info@trainailtd.com>"
    ).trim();

    let emailSent = false;
    let resendError = null;

    if (resendApiKey) {
      try {
        const html = buildInviteEmailHtml({
          email: normalizedEmail,
          orgName,
          role,
          inviteUrl
        });

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [normalizedEmail],
            subject: `Invitation to join ${orgName} on Train AI`,
            html,
            text: `You have been invited to join ${orgName} on Train AI as a ${role}.\n\nAccept your invitation here: ${inviteUrl}\n\nThis invitation is valid for 7 days.\n\nTrain AI LTD - info@trainailtd.com`
          })
        });

        const resData = await resendRes.json().catch(() => ({}));
        if (resendRes.ok && resData?.id) {
          emailSent = true;
        } else {
          resendError = resData?.message || resendRes.statusText;
          console.warn("Resend invite error:", resendError);
        }
      } catch (err: unknown) {
        resendError = err instanceof Error ? err.message : String(err);
      }
    }

    return jsonResponse({
      success: true,
      emailSent,
      token,
      inviteUrl,
      results: [{ email: normalizedEmail, success: true, emailSent }]
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonResponse({ error: message }, 500);
  }
});
