// Train AI 2.0 - send-certificate-email edge function
// Receives { certificate_id } and sends an organization-branded certificate issuance email via Resend.
// Idempotent: Tracks email_sent_at on certificates table to prevent duplicate dispatches.

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
    const appUrl = (Deno.env.get("APP_URL") || "https://trainai.app").trim().replace(/\/$/, "");

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { certificate_id, force = false } = body;
    if (!certificate_id) {
      return new Response(JSON.stringify({ error: "certificate_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Query certificate record
    const { data: cert, error: certErr } = await adminClient
      .from("certificates")
      .select("id, user_id, organization_id, course_id, title, certificate_number, issued_at, email_sent_at, file_url")
      .eq("id", certificate_id)
      .maybeSingle();

    if (certErr || !cert) {
      return new Response(JSON.stringify({ error: certErr?.message || "Certificate record not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Idempotency Check
    if (cert.email_sent_at && !force) {
      return new Response(
        JSON.stringify({
          success: true,
          emailSent: false,
          alreadySent: true,
          message: `Certificate email was already sent at ${cert.email_sent_at}`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Resolve user email & profile
    const { data: userData, error: userErr } = await adminClient.auth.admin.getUserById(cert.user_id);
    const email = userData?.user?.email;
    if (!email) {
      return new Response(JSON.stringify({ error: "Learner user email could not be resolved" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await adminClient
      .from("user_profiles")
      .select("display_name")
      .eq("id", cert.user_id)
      .maybeSingle();

    const learnerName = profile?.display_name || email.split("@")[0];

    // 4. Resolve organization name dynamically
    let orgName = "Train AI";
    if (cert.organization_id) {
      const { data: org } = await adminClient
        .from("organizations")
        .select("name")
        .eq("id", cert.organization_id)
        .maybeSingle();
      if (org?.name) orgName = org.name;
    } else {
      const { data: resolvedOrg } = await adminClient.rpc("get_user_org_name", { p_email: email });
      if (resolvedOrg) orgName = resolvedOrg;
    }

    // 5. Resolve course / certificate title
    let certTitle = cert.title || "Course Certificate";
    if (cert.course_id && (!cert.title || cert.title === "Course Certificate")) {
      const { data: course } = await adminClient
        .from("courses")
        .select("title")
        .eq("id", cert.course_id)
        .maybeSingle();
      if (course?.title) certTitle = course.title;
    }

    const certNumber = cert.certificate_number || cert.id.slice(0, 8).toUpperCase();
    const issueDateStr = cert.issued_at ? new Date(cert.issued_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const viewUrl = cert.file_url || `${appUrl}/profile?tab=certificates`;

    let emailSent = false;
    let resendDetails: any = null;

    // 6. Send email via Resend API
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
            subject: `Congratulations! You've Earned a Certificate from ${orgName}`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Certificate Awarded - ${orgName}</title>
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
                              Congratulations, <span style="color: #2563eb;">${learnerName}</span>!
                            </h1>
                            <p style="margin: 0 0 16px 0; font-size: 14.5px; color: #475569; line-height: 1.6;">
                              You have successfully earned a official completion certificate for <strong>${certTitle}</strong> from <strong>${orgName}</strong>.
                            </p>
                            <p style="margin: 0 0 24px 0; font-size: 14.5px; color: #475569; line-height: 1.6;">
                              Your achievement has been verified and registered on the platform.
                            </p>

                            <!-- CTA Button -->
                            <div style="text-align: center; margin: 28px 0;">
                              <a href="${viewUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25); text-align: center;">
                                View Your Certificate
                              </a>
                            </div>

                            <!-- Certificate Details Box -->
                            <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px 18px; margin-top: 24px; border: 1px solid #e2e8f0;">
                              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                  <td style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 4px;">Certificate Title</td>
                                  <td align="right" style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 4px;">Issued Date</td>
                                </tr>
                                <tr>
                                  <td style="font-size: 14px; color: #0f172a; font-weight: 700; padding-bottom: 12px;">${certTitle}</td>
                                  <td align="right" style="font-size: 13.5px; color: #0f172a; font-weight: 600; padding-bottom: 12px;">${issueDateStr}</td>
                                </tr>
                                <tr>
                                  <td style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 4px;">Issuing Organization</td>
                                  <td align="right" style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 4px;">Certificate No.</td>
                                </tr>
                                <tr>
                                  <td style="font-size: 14px; color: #2563eb; font-weight: 700;">${orgName}</td>
                                  <td align="right" style="font-size: 13.5px; color: #0f172a; font-weight: 600;">${certNumber}</td>
                                </tr>
                              </table>
                            </div>
                          </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                          <td style="padding: 20px 32px 28px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0 0 10px 0; font-size: 12.5px; color: #64748b; line-height: 1.5;">
                              This certificate is issued and verified by <strong>${orgName}</strong> on Train AI.
                            </p>
                            <p style="margin: 0; font-size: 11.5px; color: #94a3b8; line-height: 1.4; word-break: break-all;">
                              If the button above does not work, copy and paste this link into your browser:<br/>
                              <a href="${viewUrl}" style="color: #2563eb; text-decoration: underline;">${viewUrl}</a>
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
          console.warn("Resend API warning in send-certificate-email:", emailRes.status, resendDetails);
        }
      } catch (resendErr: any) {
        console.warn("Resend email dispatch error in send-certificate-email:", resendErr);
        resendDetails = resendErr?.message || String(resendErr);
      }
    }

    // 7. Update email_sent_at on certificate row upon success
    if (emailSent) {
      await adminClient
        .from("certificates")
        .update({ email_sent_at: new Date().toISOString() })
        .eq("id", certificate_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailSent,
        certificate_id,
        email,
        organization_name: orgName,
        resend_response: resendDetails,
        message: `Certificate email dispatched to ${email}`,
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
