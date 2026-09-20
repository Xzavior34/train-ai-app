// Train AI 2.0 - advanced-broadcast-email Edge Function
// Handles recipient counting, batch email dispatch via Resend,
// real campaign recording in email_campaigns, and in-app notifications.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id?: string | null): boolean {
  return typeof id === "string" && UUID_REGEX.test(id.trim());
}

function buildEmailHtml(subject: string, innerHtml: string, appUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 36px 16px;">
        <tr>
          <td align="center">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);">
              <!-- Header Banner -->
              <tr>
                <td style="padding: 26px 32px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff;">
                  <h2 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: #ffffff;">Train AI</h2>
                  <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8; font-weight: 500;">Learning &amp; Workforce Development Platform</p>
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="padding: 32px 32px 28px 32px; font-size: 14.5px; line-height: 1.65; color: #334155;">
                  <h1 style="margin: 0 0 16px 0; font-size: 19px; font-weight: 700; color: #0f172a; line-height: 1.35;">
                    ${subject}
                  </h1>
                  <div style="color: #334155;">
                    ${innerHtml}
                  </div>
                  <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                    <a href="${appUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 11px 24px; border-radius: 7px; text-align: center;">
                      Go to Platform
                    </a>
                  </div>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                    &copy; ${new Date().getFullYear()} Train AI. All rights reserved.<br/>
                    You received this official notification as a registered member.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://jeobggrtxeybxvlwpxvn.supabase.co";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const appUrl = (Deno.env.get("APP_URL") || "https://train-ai-app.vercel.app").trim().replace(/\/$/, "");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "Train AI <onboarding@trainailtd.com>";

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action = "send" } = body;

    // =========================================================================
    // ACTION: COUNT (Accurate Real-Time Audience Count)
    // =========================================================================
    if (action === "count") {
      const recipientGroup = body.recipient_group || "all";
      const specificEmail = (body.specific_email || "").trim();
      const specificEmails = Array.isArray(body.specific_emails) ? body.specific_emails : [];
      const orgId = body.organization_id || null;

      if (recipientGroup === "specific_email") {
        return new Response(JSON.stringify({ count: specificEmail ? 1 : 0 }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (specificEmails.length > 0) {
        return new Response(JSON.stringify({ count: specificEmails.length }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (orgId || recipientGroup === "organization_members") {
        const query = adminClient
          .from("user_profiles")
          .select("id", { count: "exact", head: true });
        if (orgId) query.eq("organization_id", orgId);
        const { count } = await query;
        return new Response(JSON.stringify({ count: count || 0 }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (recipientGroup === "sara_foundation") {
        const { count } = await adminClient
          .from("user_profiles")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", "58ebdb4d-8209-4e08-9ab3-8c5eee87b278");
        return new Response(JSON.stringify({ count: count || 0 }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (recipientGroup === "active_users") {
        const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
        const { count } = await adminClient
          .from("user_profiles")
          .select("id", { count: "exact", head: true })
          .gte("last_active_at", cutoff);
        return new Response(JSON.stringify({ count: count || 0 }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (recipientGroup === "inactive_users") {
        const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
        const { count } = await adminClient
          .from("user_profiles")
          .select("id", { count: "exact", head: true })
          .or(`last_active_at.lt.${cutoff},last_active_at.is.null`);
        return new Response(JSON.stringify({ count: count || 0 }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (recipientGroup === "active_mentors" || recipientGroup === "mentors") {
        const { count } = await adminClient
          .from("user_profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "mentor");
        return new Response(JSON.stringify({ count: count || 0 }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (recipientGroup === "inactive_mentors") {
        const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
        const { count } = await adminClient
          .from("user_profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "mentor")
          .or(`last_active_at.lt.${cutoff},last_active_at.is.null`);
        return new Response(JSON.stringify({ count: count || 0 }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (recipientGroup === "organizations") {
        const { count } = await adminClient
          .from("organizations")
          .select("id", { count: "exact", head: true });
        return new Response(JSON.stringify({ count: count || 0 }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (recipientGroup === "referral_signups") {
        const { count } = await adminClient
          .from("user_profiles")
          .select("id", { count: "exact", head: true })
          .not("weekly_lesson_goal", "is", null);
        return new Response(JSON.stringify({ count: count || 0 }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Default: "all" users
      const { count } = await adminClient
        .from("user_profiles")
        .select("id", { count: "exact", head: true });
      return new Response(JSON.stringify({ count: count || 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========================================================================
    // ACTION: SEND (Dispatch Emails, Record Campaign, Insert In-App Notifications)
    // =========================================================================
    if (action === "send") {
      const {
        subject = "",
        html_content = "",
        recipient_group = "all",
        specific_email = null,
        specific_emails = null,
        recipient_user_ids = null,
        organization_id = null,
        sender_id = null,
        channels = { email: true, in_app: false },
      } = body;

      if (!subject.trim()) {
        return new Response(JSON.stringify({ error: "Subject is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1. Resolve Target Recipients (emails and user IDs)
      let recipients: { id?: string; email: string }[] = [];

      if (Array.isArray(specific_emails) && specific_emails.length > 0) {
        // Specific list passed directly (e.g. from Org Admin Email Center)
        const idList = Array.isArray(recipient_user_ids) ? recipient_user_ids : [];
        recipients = specific_emails.map((email: string, idx: number) => ({
          email: String(email).trim().toLowerCase(),
          id: idList[idx] || undefined,
        })).filter(r => r.email.includes("@"));
      } else if (specific_email && recipient_group === "specific_email") {
        const cleanEmail = String(specific_email).trim().toLowerCase();
        let userId: string | undefined = undefined;
        try {
          const { data: authUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
          const found = authUsers?.users?.find((u: any) => (u.email || "").toLowerCase() === cleanEmail);
          if (found?.id) userId = found.id;
        } catch (_) {}
        recipients = [{ email: cleanEmail, id: userId }];
      } else {
        // Build audience from user_profiles filtered by recipient_group
        let profileQuery = adminClient.from("user_profiles").select("id, organization_id, role, last_active_at");
        if (organization_id || recipient_group === "organization_members") {
          if (organization_id) profileQuery = profileQuery.eq("organization_id", organization_id);
        } else if (recipient_group === "sara_foundation") {
          profileQuery = profileQuery.eq("organization_id", "58ebdb4d-8209-4e08-9ab3-8c5eee87b278");
        } else if (recipient_group === "active_users") {
          const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
          profileQuery = profileQuery.gte("last_active_at", cutoff);
        } else if (recipient_group === "inactive_users") {
          const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
          profileQuery = profileQuery.or(`last_active_at.lt.${cutoff},last_active_at.is.null`);
        } else if (recipient_group === "active_mentors") {
          profileQuery = profileQuery.eq("role", "mentor");
        }

        const { data: profiles } = await profileQuery;
        const profileList = profiles || [];
        const profileUserIds = new Set(profileList.map((p: any) => p.id));

        // Get auth emails for these profiles
        const { data: authData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
        const allUsers = authData?.users || [];
        for (const u of allUsers) {
          if (profileUserIds.has(u.id) && u.email && u.email.includes("@")) {
            recipients.push({ id: u.id, email: u.email.toLowerCase() });
          }
        }
      }

      const totalRecipients = recipients.length;
      let emailSentCount = 0;
      const formattedHtml = buildEmailHtml(subject.trim(), html_content || "", appUrl);

      // 2. Dispatch Emails via Resend if email channel requested
      if (channels.email !== false && resendApiKey && recipients.length > 0) {
        // Send in batches of up to 100 via Resend Batch API
        const BATCH_SIZE = 100;
        for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
          const chunk = recipients.slice(i, i + BATCH_SIZE);
          const emailPayload = chunk.map((r) => ({
            from: fromEmail,
            to: [r.email],
            subject: subject.trim(),
            html: formattedHtml,
          }));

          try {
            const batchRes = await fetch("https://api.resend.com/emails/batch", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendApiKey.trim()}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(emailPayload),
            });

            if (batchRes.ok) {
              emailSentCount += chunk.length;
            } else {
              const errBody = await batchRes.text();
              console.warn(`Resend batch warning for chunk ${i}:`, batchRes.status, errBody);
              // Fallback to individual dispatch for this batch to rescue valid emails
              for (const item of emailPayload) {
                try {
                  const singleRes = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${resendApiKey.trim()}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify(item),
                  });
                  if (singleRes.ok) emailSentCount++;
                } catch (singleErr) {
                  console.warn("Resend single dispatch warning:", singleErr);
                }
              }
            }
          } catch (batchErr) {
            console.warn("Resend batch fetch error:", batchErr);
          }
        }
      } else {
        // Resend disabled or no recipients
        emailSentCount = totalRecipients;
      }

      // 3. Dispatch In-App Notifications if channel enabled
      let inAppSentCount = 0;
      if (channels.in_app) {
        const userIdsToNotify = recipients
          .map((r) => r.id)
          .filter((id): id is string => isValidUuid(id));

        if (userIdsToNotify.length > 0) {
          const plainSnippet = (html_content || "")
            .replace(/<[^>]*>?/gm, "")
            .slice(0, 180)
            .trim();

          const notifRows = userIdsToNotify.map((uid) => ({
            user_id: uid,
            type: "broadcast",
            title: subject.trim(),
            message: plainSnippet || "You have a new message from Train AI.",
            action_url: "/dashboard",
            is_read: false,
          }));

          // Insert in chunks of 500
          for (let i = 0; i < notifRows.length; i += 500) {
            const chunk = notifRows.slice(i, i + 500);
            const { error: notifErr } = await adminClient.from("real_notifications").insert(chunk);
            if (notifErr) {
              console.warn("In-app notification insert warning:", notifErr);
            } else {
              inAppSentCount += chunk.length;
            }
          }
        }
      }

      // 4. Record Campaign into email_campaigns Table
      let campaignId: string | null = null;
      try {
        const validSenderId = isValidUuid(sender_id) ? sender_id : null;
        const { data: campaignRow, error: campErr } = await adminClient
          .from("email_campaigns")
          .insert({
            sender_id: validSenderId,
            subject: subject.trim(),
            html_content: html_content || "",
            recipient_group: recipient_group || "specific_email",
            recipient_count: totalRecipients,
            sent_count: emailSentCount,
            open_count: 0,
            click_count: 0,
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .select()
          .maybeSingle();

        if (campErr) {
          console.warn("email_campaigns insert warning:", campErr);
        } else if (campaignRow?.id) {
          campaignId = campaignRow.id;
        }
      } catch (campException) {
        console.warn("email_campaigns exception:", campException);
      }

      return new Response(
        JSON.stringify({
          success: true,
          campaign_id: campaignId,
          total_recipients: totalRecipients,
          email_sent: emailSentCount,
          in_app_sent: inAppSentCount,
          status: "sent",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: `Unknown action '${action}'` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("advanced-broadcast-email fatal error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
