// Train AI - reset-password edge function
// Receives { email } and sends a branded, well-designed password reset email via Resend
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
    if (!email) {
      return new Response(JSON.stringify({ error: "email parameter is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract target origin from request body or environment
    const clientOrigin = (body?.origin || body?.redirectTo || "").trim();
    const appUrl = (Deno.env.get("APP_URL") || "https://train-ai-app.vercel.app").trim().replace(/\/$/, "");
    
    // Determine target redirect origin
    let targetOrigin = appUrl;
    if (clientOrigin && clientOrigin !== "null" && clientOrigin !== "undefined") {
      targetOrigin = clientOrigin.replace(/\/$/, "");
    }
    
    const redirectTarget = `${targetOrigin}/auth/callback?type=recovery`;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch user's organization name via authoritative RPC
    let orgName = "Train AI";
    try {
      const { data: resolvedOrgName } = await adminClient.rpc("get_user_org_name", { p_email: email });
      if (resolvedOrgName) {
        orgName = resolvedOrgName;
      }
    } catch (err) {
      console.warn("Could not query organization for password reset email:", err);
    }

    // 2. Generate Supabase recovery link
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: redirectTarget,
      },
    });

    if (linkErr || (!linkData?.properties?.action_link && !linkData?.properties?.hashed_token)) {
      console.warn("Generate recovery link warning:", linkErr);
      return new Response(
        JSON.stringify({ error: linkErr?.message || "Could not generate password reset link for this email." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Direct link to target origin with token_hash - lands directly on the app (e.g. Vercel)
    const hashedToken = linkData.properties.hashed_token;
    const resetUrl = hashedToken
      ? `${targetOrigin}/?token_hash=${hashedToken}&type=recovery`
      : linkData.properties.action_link;
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
            subject: `Reset Your Password for ${orgName} on Train AI`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Reset Your Password for ${orgName}</title>
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
                              Reset Your Password for <span style="color: #2563eb;">${orgName}</span>
                            </h1>
                            <p style="margin: 0 0 16px 0; font-size: 14.5px; color: #475569; line-height: 1.6;">
                              We received a request to reset the password for your account associated with <strong>${orgName}</strong> on Train AI.
                            </p>
                            <p style="margin: 0 0 24px 0; font-size: 14.5px; color: #475569; line-height: 1.6;">
                              Please click the button below to choose a new secure password.
                            </p>

                            <!-- CTA Button -->
                            <div style="text-align: center; margin: 28px 0;">
                              <a href="${resetUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25); text-align: center;">
                                Reset Your Password
                              </a>
                            </div>

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
                            <p style="margin: 0 0 10px 0; font-size: 12.5px; color: #64748b; line-height: 1.5;">
                              This password reset link will expire in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email — your password will remain unchanged.
                            </p>
                            <p style="margin: 0; font-size: 11.5px; color: #94a3b8; line-height: 1.4; word-break: break-all;">
                              If the button above does not work, copy and paste this link into your browser:<br/>
                              <a href="${resetUrl}" style="color: #2563eb; text-decoration: underline;">${resetUrl}</a>
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
          console.warn("Resend API warning in reset-password:", emailRes.status, resText);
        }
      } catch (resendErr: any) {
        console.warn("Resend email dispatch error in reset-password:", resendErr);
        resendDetails = resendErr?.message || String(resendErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailSent,
        email,
        organization_name: orgName,
        reset_url: resetUrl,
        resend_response: resendDetails,
        message: `Password reset email dispatched to ${email}`,
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
