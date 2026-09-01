// Train AI - AI Content Moderation edge function
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return jsonResponse({ error: "Missing Authorization header" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Edge function missing required Supabase environment bindings." }, 500);
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Invalid or expired session" }, 401);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const { content, contentType = "post", contentId } = body || {};
    if (!content || typeof content !== "string" || !contentId) {
      return jsonResponse({ error: "content and contentId are required" }, 400);
    }

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    let approved = true;
    let score = 0;
    let reason = "Approved by AI moderation";
    let flags: string[] = [];

    if (OPENAI_API_KEY) {
      try {
        const modResp = await fetch("https://api.openai.com/v1/moderations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ input: content }),
        });

        if (modResp.ok) {
          const modData = await modResp.json();
          const result = modData?.results?.[0];
          if (result) {
            approved = !result.flagged;
            const categoryScores = result.category_scores || {};
            const maxCategoryScore = Math.max(...Object.values(categoryScores).map((v) => Number(v) || 0));
            score = Math.round(maxCategoryScore * 100);

            if (result.categories) {
              flags = Object.entries(result.categories)
                .filter(([, val]) => val === true)
                .map(([cat]) => cat);
            }

            if (!approved) {
              reason = `Flagged for: ${flags.join(", ") || "policy violation"}`;
            }
          }
        }
      } catch (err) {
        console.error("ai-content-moderation OpenAI call error:", err);
      }
    }

    const statusStr = approved ? "approved" : "rejected";

    // Update community_posts table row
    if (contentType === "post") {
      const { error: updateErr } = await db
        .from("community_posts")
        .update({
          moderation_status: statusStr,
          moderation_score: score,
          ai_moderated: true,
          moderated_at: new Date().toISOString(),
        })
        .eq("id", contentId);

      if (updateErr) console.error("ai-content-moderation: post update error:", updateErr);
    }

    // Insert log row into moderation_logs table
    try {
      await db.from("moderation_logs").insert({
        content_id: contentId,
        content_type: contentType,
        moderation_action: statusStr,
        ai_reason: reason,
        ai_score: score,
      });
    } catch (logErr) {
      console.error("ai-content-moderation: log insert error:", logErr);
    }

    return jsonResponse({
      approved,
      score,
      reason,
      flags,
    });
  } catch (error) {
    console.error("ai-content-moderation unhandled error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
