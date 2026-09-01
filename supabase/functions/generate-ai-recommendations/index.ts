// Train AI - AI Course/Practice Recommendations edge function
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
      return jsonResponse({ error: "Missing Authorization header", fallback: true }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return jsonResponse({ error: "Missing Supabase env bindings", fallback: true }, 200);
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Invalid session", fallback: true }, 401);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body", fallback: true }, 400);
    }

    const { userContext, userProgress } = body || {};
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return jsonResponse({ error: "AI provider not configured", fallback: true }, 200);
    }

    const systemPrompt =
      "You are an AI learning recommendation engine for Train AI. Generate personalized course/practice recommendations and reminders for the learner. " +
      "Respond ONLY with valid JSON matching this exact structure: " +
      `{
        "recommendations": [
          { "type": "course" | "practice" | "quiz", "title": string, "description": string, "reason": string, "priority": "high" | "medium" | "low", "actionUrl": string, "metadata": object }
        ],
        "reminders": [
          { "type": "streak" | "review" | "goal", "title": string, "message": string, "priority": "high" | "medium" | "low", "dueDate": string }
        ]
      }`;

    const userPrompt = `Learner Context: ${JSON.stringify(userContext || {})}. Progress: ${JSON.stringify(userProgress || {})}. Generate 3 targeted recommendations and 2 learning reminders.`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("OpenAI error in generate-ai-recommendations:", resp.status, errText);
      return jsonResponse({ error: `OpenAI error: ${resp.status}`, fallback: true }, 200);
    }

    const json = await resp.json();
    const rawText = json?.choices?.[0]?.message?.content?.trim();
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return jsonResponse({ error: "Failed to parse AI output", fallback: true }, 200);
    }

    return jsonResponse({
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
    });
  } catch (error) {
    console.error("generate-ai-recommendations unhandled error:", error);
    return jsonResponse({ error: "Internal server error", fallback: true }, 200);
  }
});
