// Train AI - send-password-reset Edge Function
//
// Dispatches password recovery emails using Resend with the canonical domain trainailtd.com
//
// 1. Receives { email, redirectTo }
// 2. Generates a secure recovery action link and 6-digit email OTP via Supabase Auth Admin API
// 3. Formats a branded Train AI HTML email
// 4. Sends the email via Resend API (https://api.resend.com/emails)
//
// Deploy with: supabase functions deploy send-password-reset
// Configure with: supabase secrets set RESEND_API_KEY=re_...
//                 supabase secrets set RESEND_FROM_EMAIL="Train AI <info@trainailtd.com>"

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CANONICAL_DOMAIN = "https://trainailtd.com";
const ALLOWED_REDIRECT_HOSTS = new Set(["trainailtd.com", "www.trainailtd.com"]);

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildHtmlEmail({ email, resetUrl, otpCode }: { email: string; resetUrl: string; otpCode?: string }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Train AI Password</title>
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
                Reset Your Password
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 14.5px; line-height: 1.6; color: #94a3b8; text-align: center;">
                We received a request to reset the password for your Train AI account associated with <strong style="color: #f1f5f9;">${email}</strong>.
              </p>

              <!-- Main CTA Button -->
              <div style="text-align: center; margin: 28px 0;">
                <a href="${resetUrl}" target="_blank" style="display: inline-block; background-color: #2563eb; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 10px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);">
                  Reset Password
                </a>
              </div>

              ${otpCode ? `
              <!-- OTP Box -->
              <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; text-align: center; margin: 28px 0 24px 0;">
                <div style="font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">
                  Or Enter Verification Code on trainailtd.com
                </div>
                <div style="font-size: 30px; font-weight: 800; color: #60a5fa; letter-spacing: 0.25em; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
                  ${otpCode}
                </div>
              </div>
              ` : ''}

              <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 1.6; color: #64748b; text-align: center;">
                This link and recovery code will expire in <strong>60 minutes</strong>.<br>
                If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
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
                Need help? Contact our support team at <a href="mailto:info@trainailtd.com" style="color: #94a3b8; text-decoration: underline;">info@trainailtd.com</a>
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
    if (!rawEmail) {
      return jsonResponse({ error: "Email address is required." }, 400);
    }
    const normalizedEmail = rawEmail.toLowerCase();
    if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(normalizedEmail)) {
      return jsonResponse({ error: "Enter a valid email address." }, 400);
    }

    // Use requested redirect or fallback to canonical trainailtd.com recovery URL
    let redirectTo = `${CANONICAL_DOMAIN}/?view=auth&recovery=1`;
    try {
      const requestedRedirect = new URL(body.redirectTo || redirectTo);
      if (requestedRedirect.protocol === "https:" && ALLOWED_REDIRECT_HOSTS.has(requestedRedirect.hostname)) {
        redirectTo = requestedRedirect.toString();
      }
    } catch {
      // Keep the canonical recovery URL.
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({
        error: "Supabase environment configuration missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)."
      }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 1. Generate recovery link and OTP
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: {
        redirectTo
      }
    });

    if (linkError) {
      const errMsg = (linkError.message || "").toLowerCase();
      if (errMsg.includes("not found") || errMsg.includes("user not found")) {
        // Do not disclose whether an account exists.
        return jsonResponse({ success: true, emailSent: true, email: normalizedEmail });
      }
      return jsonResponse({
        success: false,
        error: linkError.message || "Could not generate recovery link."
      }, 400);
    }

    const actionLink = linkData?.properties?.action_link || redirectTo;
    const otpCode = linkData?.properties?.email_otp || "";

    // 2. Dispatch via Resend
    const resendApiKey = (
      Deno.env.get("RESEND_API_KEY") ||
      Deno.env.get("RESEND_KEY") ||
      ""
    ).trim();

    const fromEmail = (
      Deno.env.get("RESEND_FROM_EMAIL") ||
      "Train AI <info@trainailtd.com>"
    ).trim();

    let emailDispatched = false;
    let resendErrorMsg = null;

    if (resendApiKey) {
      try {
        const emailHtml = buildHtmlEmail({
          email: normalizedEmail,
          resetUrl: actionLink,
          otpCode
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
            subject: "Reset your Train AI password",
            html: emailHtml,
            text: `Reset your Train AI password for ${normalizedEmail}\n\nClick here to reset: ${actionLink}\n\nOr enter this recovery code on trainailtd.com: ${otpCode}\n\nThis code expires in 60 minutes.\n\nTrain AI LTD - info@trainailtd.com`
          })
        });

        const resendJson = await resendRes.json().catch(() => ({}));
        if (resendRes.ok && resendJson?.id) {
          emailDispatched = true;
        } else {
          resendErrorMsg = resendJson?.message || resendRes.statusText || "Resend API call failed";
          console.warn("Resend email dispatch error:", resendErrorMsg);

          // If custom domain is not yet verified on Resend, try fallback sender if different
          if (resendErrorMsg?.includes("domain") && !fromEmail.includes("resend.dev")) {
            const fallbackRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                from: "Train AI <onboarding@resend.dev>",
                to: [normalizedEmail],
                subject: "Reset your Train AI password",
                html: emailHtml,
                text: `Reset your Train AI password: ${actionLink} (OTP: ${otpCode})`
              })
            }).catch(() => null);
            if (fallbackRes?.ok) {
              emailDispatched = true;
            }
          }
        }
      } catch (err: unknown) {
        resendErrorMsg = err instanceof Error ? err.message : String(err);
        console.warn("Resend network error:", err);
      }
    } else {
      resendErrorMsg = "Transactional email provider is not configured.";
    }

    if (!emailDispatched) {
      return jsonResponse({
        success: false,
        emailSent: false,
        error: "Password reset email could not be delivered. Please try again shortly or contact support.",
      }, 503);
    }

    return jsonResponse({
      success: true,
      emailSent: true,
      email: normalizedEmail,
      message: "Password reset instructions have been sent."
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonResponse({ error: message }, 500);
  }
});
