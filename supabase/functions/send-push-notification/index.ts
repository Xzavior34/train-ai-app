import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const oneSignalAppId = Deno.env.get("ONESIGNAL_APP_ID") || "";
    const oneSignalApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY") || Deno.env.get("ONESIGNAL_API_KEY") || "";
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!url || !anonKey || !serviceKey || !jwt) return json({ error: "Unauthorized" }, 401);
    if (!oneSignalAppId || !oneSignalApiKey) return json({ error: "Push delivery is not configured." }, 503);

    const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser(jwt);
    if (callerError || !callerData.user) return json({ error: "Invalid or expired session" }, 401);

    const body = await req.json().catch(() => ({}));
    const targetUserId = String(body.user_id || callerData.user.id);
    const title = String(body.title || "Train AI").trim().slice(0, 100);
    const message = String(body.message || "").trim().slice(0, 500);
    const launchUrl = String(body.url || "https://trainailtd.com");
    if (!message) return json({ error: "A notification message is required." }, 400);

    const admin = createClient(url, serviceKey);
    if (targetUserId !== callerData.user.id) {
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", callerData.user.id);
      if (!(roles || []).some((row) => ["super_admin", "admin"].includes(row.role))) {
        return json({ error: "You cannot notify another user." }, 403);
      }
    }

    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        Authorization: `Key ${oneSignalApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: oneSignalAppId,
        target_channel: "push",
        include_aliases: { external_id: [targetUserId] },
        headings: { en: title || "Train AI" },
        contents: { en: message },
        url: launchUrl,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.errors) {
      console.error("OneSignal delivery failed", result);
      return json({ error: "The push notification could not be delivered." }, 502);
    }
    return json({ success: true, id: result.id, recipients: result.recipients || 0 });
  } catch (error) {
    console.error("send-push-notification failed", error);
    return json({ error: "The push notification could not be delivered." }, 500);
  }
});
