// Train AI - AI Assistant chat edge function.
//
// Receives { conversationId, message } from the learner app AFTER the
// client has already persisted the learner's own message to ai_messages
// (via sendAIChatMessage in src/lib/api/schemaHelper.js). This function's
// job is only to:
//   1. verify the caller owns the conversation,
//   2. build the reply using whichever provider key is configured
//      (OPENAI_API_KEY or GEMINI_API_KEY, checked in that order),
//   3. persist the assistant's reply to ai_messages, and
//   4. return it so the client can render it without re-fetching.
//
// If neither provider key is configured, it returns a clear JSON error
// instead of a canned/fake reply, so the UI can show real-provider-not-set
// state honestly rather than pretending to be a working assistant.
//
// Deploy with:  supabase functions deploy ai-chat
// Configure with:  supabase secrets set OPENAI_API_KEY=sk-...
//              or:  supabase secrets set GEMINI_API_KEY=...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_HISTORY_MESSAGES = 20;
const MAX_CONTENT_CHARS = 4000;

function jsonResponse(body, status = 200) {
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
      return jsonResponse({ error: "Edge function is missing required Supabase environment bindings." }, 500);
    }

    // Verify the caller's identity with their own JWT (anon-key client).
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Invalid or expired session" }, 401);
    }
    const userId = userData.user.id;

    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }
    const { conversationId, message } = body || {};
    if (!conversationId || typeof message !== "string" || !message.trim()) {
      return jsonResponse({ error: "conversationId and message are required" }, 400);
    }

    // Service-role client - needed because ai_conversations/ai_messages have
    // RLS enabled with no policies yet (default-deny for every role except
    // this trusted server-side function, which has already checked ownership
    // above using the caller's own verified identity).
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: conversation, error: convErr } = await db
      .from("ai_conversations")
      .select("id, user_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (convErr || !conversation || conversation.user_id !== userId) {
      return jsonResponse({ error: "Conversation not found" }, 404);
    }

    // Org-level AI Coach controls (enable/disable, Manual Mode) - re-checked
    // here, not just trusted from the client. The client (TrainAILearnerApp.jsx)
    // already checks these before calling this function at all, so a normal
    // user of the app never reaches this far when AI Coach is off or in
    // Manual Mode - but that check is only a client-side convenience. A
    // request built by hand (or a modified client) could call this function
    // directly and skip it entirely, which would have meant Manual Mode and
    // the enable/disable toggle were UI-only, exactly the kind of gap this
    // codebase has had elsewhere (see mm_insert_sender in
    // 0108_messaging_restriction.sql for the same class of issue). This is
    // the actual enforcement; the client-side check is now just a fast path
    // that avoids the extra round trip.
    const { data: profile } = await db
      .from("user_profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();

    let aiCoachSettings = { enabled: true, manual_mode: false, manual_message: "" };
    if (profile?.organization_id) {
      const { data: org } = await db
        .from("organizations")
        .select("settings")
        .eq("id", profile.organization_id)
        .maybeSingle();
      if (org?.settings?.ai_coach) {
        aiCoachSettings = { ...aiCoachSettings, ...org.settings.ai_coach };
      }
    }

    if (!aiCoachSettings.enabled) {
      return jsonResponse({ error: "AI Coach has been turned off for your organization." }, 403);
    }

    if (aiCoachSettings.manual_mode) {
      const manualText = (aiCoachSettings.manual_message || "").trim()
        || "Your organization has AI Coach set to manual mode right now - an instructor will follow up with you directly.";
      const { data: manualRow, error: manualInsertErr } = await db
        .from("ai_messages")
        .insert({ conversation_id: conversationId, role: "assistant", content: manualText })
        .select()
        .single();
      if (manualInsertErr) console.error("ai-chat: failed to persist manual-mode message:", manualInsertErr);
      return jsonResponse({
        reply: manualText,
        message: manualRow || { role: "assistant", content: manualText, conversation_id: conversationId },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!OPENAI_API_KEY && !GEMINI_API_KEY) {
      return jsonResponse({
        error: "AI provider not configured - set OPENAI_API_KEY or GEMINI_API_KEY via `supabase secrets set`",
      });
    }

    const { data: history, error: histErr } = await db
      .from("ai_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(MAX_HISTORY_MESSAGES);
    if (histErr) console.error("ai-chat: history fetch warning:", histErr);

    const safeHistory = (history || [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CONTENT_CHARS) }));

    const systemPrompt =
      "You are the Train AI learning assistant. Help learners understand course concepts clearly and " +
      "concisely, offer worked examples when useful, and encourage critical thinking rather than simply " +
      "handing over quiz or assignment answers. Format responses with short paragraphs and bullet points " +
      "where that helps readability.";

    let replyText = "";

    try {
      if (OPENAI_API_KEY) {
        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: systemPrompt }, ...safeHistory],
            temperature: 0.7,
          }),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          return jsonResponse({ error: `OpenAI API error: ${resp.status} ${errText.slice(0, 300)}` }, 502);
        }
        const json = await resp.json();
        replyText = json?.choices?.[0]?.message?.content?.trim() || "";
      } else if (GEMINI_API_KEY) {
        const contents = safeHistory.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents,
            }),
          }
        );
        if (!resp.ok) {
          const errText = await resp.text();
          return jsonResponse({ error: `Gemini API error: ${resp.status} ${errText.slice(0, 300)}` }, 502);
        }
        const json = await resp.json();
        replyText = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      }
    } catch (providerError) {
      console.error("ai-chat: provider call failed:", providerError);
      return jsonResponse({ error: "AI provider request failed. Please try again." }, 502);
    }

    if (!replyText) {
      return jsonResponse({ error: "The AI provider returned an empty response. Please try again." }, 502);
    }

    // Real usage event for Platform Owner "AI credit tracking" / "usage
    // analytics" - one row per actual provider call that succeeded, not
    // for Manual Mode or disabled-org paths above (those never reach here).
    // Best-effort: a logging failure should never block the learner's reply.
    try {
      await db.from("ai_usage_events").insert({
        user_id: userId,
        organization_id: profile?.organization_id || null,
        feature: "ai_coach",
      });
    } catch (logErr) {
      console.error("ai-chat: usage event logging failed:", logErr);
    }

    const { data: assistantRow, error: insertErr } = await db
      .from("ai_messages")
      .insert({ conversation_id: conversationId, role: "assistant", content: replyText })
      .select()
      .single();
    if (insertErr) console.error("ai-chat: failed to persist assistant message:", insertErr);

    return jsonResponse({
      reply: replyText,
      message: assistantRow || { role: "assistant", content: replyText, conversation_id: conversationId },
    });
  } catch (error) {
    console.error("ai-chat: unhandled error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
