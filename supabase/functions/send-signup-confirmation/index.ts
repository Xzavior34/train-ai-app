// Train AI - send-signup-confirmation edge function
// Called after Supabase auth.signUp has already created the user account.
// Receives { email, userId, role, origin } and sends an organization-branded
// welcome / confirmation email via Resend. Password is NOT required.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://jeobggrtxeybxvlwpxvn.supabase.co";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = (body?.email || "").trim().toLowerCase();
    const role = body?.role || "learner";

    if (!email) {
      return new Response(JSON.stringify({ error: "email parameter is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientOrigin = (body?.origin || "").trim();
    const appUrl = (Deno.env.get("APP_URL") || "https://train-ai-app.vercel.app").trim().replace(/\/$/, "");

    let targetOrigin = appUrl;
    if (clientOrigin && clientOrigin !== "null" && clientOrigin !== "undefined") {
      targetOrigin = clientOrigin.replace(/\/$/, "");
    }

    const redirectTarget = `${targetOrigin}/auth/callback`;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch user's organization name via authoritative RPC
    let orgName = "Train AI";
    try {
      const { data: resolvedOrgName } = await adminClient.rpc("get_user_org_name", { p_email: email });
      if (resolvedOrgName) {
        orgName = resolvedOrgName;
      }
    } catch (err) {
      console.warn("Could not query organization for signup confirmation email:", err);
    }

    // 2. Generate a confirmation link for the already-created account.
    let confirmUrl: string | null = null;
    try {
      const res = await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: redirectTarget, data: { role } },
      });
      const hashedToken = res.data?.properties?.hashed_token;
      confirmUrl = hashedToken
        ? `${targetOrigin}/?token_hash=${hashedToken}&type=magiclink`
        : res.data?.properties?.action_link || null;
    } catch (linkErr) {
      console.warn("Could not generate confirmation link (will send welcome email without link):", linkErr);
    }

    const confirmSection = confirmUrl
      ? `
        <div style="text-align: center; margin: 28px 0;">
          <a href="${confirmUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25); text-align: center;">
            Confirm Email &amp; Sign In
          </a>
        </div>
        <p style="margin: 0 0 10px 0; font-size: 11.5px; color: #94a3b8; line-height: 1.4; word-break: break-all;">
          If the button above does not work, copy and paste this link into your browser:<br/>
          <a href="${confirmUrl}" style="color: #2563eb; text-decoration: underline;">${confirmUrl}</a>
        </p>`
      : `
        <p style="margin: 0 0 16px 0; font-size: 14.5px; color: #475569; line-height: 1.6;">
          You can sign in at <a href="${targetOrigin}" style="color: #2563eb;">${targetOrigin}</a> using your email and password.
        </p>`;
    let emailSent = false;
    let resendDetails: any = null;

    // 3. Send email via Resend API
    if (resendApiKey) {
      try {
        const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || Deno.env.get("SENDER_EMAIL") || "Train AI <onboarding@trainailtd.com>";
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [email],
            subject: `Confirm Your Account for ${orgName} on Train AI`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Welcome to ${orgName} on Train AI</title>
              </head>
              <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 16px;">
                  <tr>
                    <td align="center">
                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);">
                        
                        <!-- Header Banner -->
                        <tr>
                          <td style="padding: 28px 32px; background-color: #0f172a; color: #ffffff;">
                            <h2 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.01em; color: #ffffff;">Train AI</h2>
                            <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8; font-weight: 500;">Workforce Learning & Capability Platform</p>
                          </td>
                        </tr>

                        <!-- Body Content -->
                        <tr>
                          <td style="padding: 32px 32px 24px 32px;">
                            <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                              Welcome to <span style="color: #2563eb;">${orgName}</span>!
                            </h1>
                            <p style="margin: 0 0 16px 0; font-size: 14.5px; color: #475569; line-height: 1.6;">
                              Your account has been created for <strong>${email}</strong>. Please verify your email address to activate your account on Train AI.
                            </p>
                            ${confirmSection}
                            <!-- Org Details Card -->
                            <div style="background-color: #f1f5f9; border-radius: 8px; padding: 14px 18px; margin-top: 24px; border: 1px solid #e2e8f0;">
                              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                  <td style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 4px;">Organization Workspace</td>
                                  <td align="right" style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 4px;">Account Email</td>
                                </tr>
                                <tr>
                                  <td style="font-size: 14px; color: #0f172a; font-weight: 700;">${orgName}</td>
                                  <td align="right" style="font-size: 13.5px; color: #2563eb; font-weight: 600;">${email}</td>
                                </tr>
                              </table>
                            </div>
                          </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                          <td style="padding: 20px 32px 28px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; font-size: 12.5px; color: #64748b; line-height: 1.5;">
                              If you did not create this account on <strong>${orgName}</strong>, you can safely disregard this email.
                            </p>
                          </td>
                        </tr>

                      </table>
                    </td>
                  </tr>
                </table>
              </body>
              </html>
            `,
          }),
        });
        emailSent = emailRes.ok;
        const resText = await emailRes.text();
        try {
          resendDetails = JSON.parse(resText);
        } catch {
          resendDetails = resText;
        }
        if (!emailRes.ok) {
          console.warn("Resend API warning in send-signup-confirmation:", emailRes.status, resText);
        }
      } catch (resendErr: any) {
        console.warn("Resend email dispatch error in send-signup-confirmation:", resendErr);
        resendDetails = resendErr?.message || String(resendErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailSent,
        email,
        organization_name: orgName,
        confirm_url: confirmUrl,
        resend_response: resendDetails,
        message: `Signup confirmation email dispatched to ${email}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
