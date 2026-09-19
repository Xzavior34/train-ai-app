// Train AI - invite-user edge function.
//
// Receives { email, organization_id, role, organization_role } from the
// admin client (createInvitation() in src/lib/api/platform.js).
//
// Steps:
//   1. Verify caller is authenticated and is an org admin for organization_id
//   2. Call create_user_invitation() RPC to create the secure token
//   3. Send the invitation email via Resend (RESEND_API_KEY env var)
//   4. Return success/failure result
//
// If RESEND_API_KEY is not set, the invitation row is still created but no
// email is sent — the app's PeopleScreen shows the token-based invite link
// so an admin can share it manually.

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const appUrl = Deno.env.get("APP_URL") || "https://trainai.app";

    // Caller-scoped client (respects RLS, uses their JWT)
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify caller identity
    const { data: { user }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, organization_id, role = "learner", organization_role = "member" } = body;

    if (!email || !organization_id) {
      return new Response(JSON.stringify({ error: "email and organization_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call create_user_invitation RPC — it enforces org-admin authorization server-side
    const { data: inviteResult, error: rpcErr } = await callerClient.rpc("create_user_invitation", {
      p_email: email.trim().toLowerCase(),
      p_organization_id: organization_id,
      p_role: role,
      p_organization_role: organization_role,
    });

    if (rpcErr) {
      return new Response(JSON.stringify({ error: rpcErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the invitation token to build the accept link
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: inviteRow } = await adminClient
      .from("user_invitations")
      .select("token, id, expires_at")
      .eq("email", email.trim().toLowerCase())
      .eq("organization_id", organization_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get org name for the email
    let orgName = body.organization_name || "";
    if (!orgName) {
      const { data: org } = await adminClient
        .from("organizations")
        .select("name")
        .eq("id", organization_id)
        .maybeSingle();
      orgName = org?.name || "Train AI";
    }

    const acceptUrl = `${appUrl}/accept-invitation?token=${inviteRow?.token || ""}`;
    let emailSent = false;
    let resendDetails: any = null;

    // Send via Resend if key is configured
    if (resendApiKey && inviteRow?.token) {
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
            to: [email.trim().toLowerCase()],
            subject: `You've been invited to join ${orgName} on Train AI - Set your password`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Join ${orgName} on Train AI</title>
              </head>
              <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 16px;">
                  <tr>
                    <td align="center">
                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);">
                        
                        <!-- Header Banner -->
                        <tr>
                          <td style="padding: 28px 32px; background-color: #2563eb; color: #ffffff;">
                            <h2 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.01em; color: #ffffff;">Train AI</h2>
                            <p style="margin: 4px 0 0 0; font-size: 13px; color: #bfdbfe; font-weight: 500;">Workforce Learning & Capability Platform</p>
                          </td>
                        </tr>

                        <!-- Body Content -->
                        <tr>
                          <td style="padding: 32px 32px 24px 32px;">
                            <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                              You've been invited to join <span style="color: #2563eb;">${orgName}</span>
                            </h1>
                            <p style="margin: 0 0 16px 0; font-size: 14.5px; color: #475569; line-height: 1.6;">
                              You have been invited to join the <strong>${orgName}</strong> workspace on Train AI as an active <strong>${role}</strong>.
                            </p>
                            <p style="margin: 0 0 24px 0; font-size: 14.5px; color: #475569; line-height: 1.6;">
                              Please click the button below to set your password and activate your account.
                            </p>

                            <!-- CTA Button -->
                            <div style="text-align: center; margin: 28px 0;">
                              <a href="${acceptUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25); text-align: center;">
                                Set your password
                              </a>
                            </div>

                            <!-- Org Info Box -->
                            <div style="background-color: #f1f5f9; border-radius: 8px; padding: 14px 18px; margin-top: 24px; border: 1px solid #e2e8f0;">
                              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                  <td style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 4px;">Organization</td>
                                  <td align="right" style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 4px;">Assigned Role</td>
                                </tr>
                                <tr>
                                  <td style="font-size: 14px; color: #0f172a; font-weight: 700;">${orgName}</td>
                                  <td align="right" style="font-size: 14px; color: #2563eb; font-weight: 700; text-transform: capitalize;">${role}</td>
                                </tr>
                              </table>
                            </div>
                          </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                          <td style="padding: 20px 32px 28px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0 0 10px 0; font-size: 12.5px; color: #64748b; line-height: 1.5;">
                              This invitation link expires in <strong>7 days</strong>. If you did not expect this invitation, you can safely ignore this email.
                            </p>
                            <p style="margin: 0; font-size: 11.5px; color: #94a3b8; line-height: 1.4; word-break: break-all;">
                              If the button above does not work, copy and paste this URL into your browser:<br/>
                              <a href="${acceptUrl}" style="color: #2563eb; text-decoration: underline;">${acceptUrl}</a>
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
        try {
          const resText = await emailRes.text();
          resendDetails = JSON.parse(resText);
        } catch {
          resendDetails = null;
        }
        if (!emailRes.ok) {
          console.warn("Resend API warning in invite-user:", emailRes.status, resendDetails);
        }
      } catch (emailErr: any) {
        console.warn("Resend email dispatch exception in invite-user:", emailErr);
      }
    }

    return new Response(
      JSON.stringify({
        results: [{ success: true, email, emailSent, invitationId: inviteRow?.id, accept_url: acceptUrl, resend_response: resendDetails }],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
