// Train AI - AI Quiz Generator edge function
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

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return jsonResponse({ error: "Edge function is missing required Supabase environment bindings." }, 500);
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

    const { topic, difficulty = "intermediate", questionCount = 5, learningGoal } = body || {};
    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return jsonResponse({ error: "Topic is required" }, 400);
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return jsonResponse({ error: "AI provider not configured - OPENAI_API_KEY missing" }, 402);
    }

    const systemPrompt =
      "You are an expert AI quiz generator for Train AI. Generate an assessment quiz on the requested topic. " +
      "Respond ONLY with valid JSON matching this exact structure: " +
      `{
        "assessment": {
          "title": string,
          "description": string,
          "estimatedTime": string,
          "difficulty": string,
          "questions": [
            {
              "id": string,
              "question": string,
              "options": [string, string, string, string],
              "correctAnswer": number (0-based index: 0, 1, 2, or 3),
              "explanation": string,
              "difficulty": string
            }
          ]
        }
      }`;

    const userPrompt = `Topic: "${topic.trim()}". Difficulty level: ${difficulty}. Number of questions: ${questionCount}.${learningGoal ? ` Target Learning Goal: ${learningGoal}` : ""}`;

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
      console.error("OpenAI error in ai-generate-quiz:", resp.status, errText);
      if (resp.status === 429) {
        return jsonResponse({ error: "OpenAI rate limit / credit balance exhausted. Please check billing." }, 429);
      }
      return jsonResponse({ error: `OpenAI API error: ${resp.status} ${errText.slice(0, 200)}` }, 502);
    }

    const json = await resp.json();
    const rawText = json?.choices?.[0]?.message?.content?.trim();

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return jsonResponse({ error: "Model output failed to parse into valid JSON" }, 500);
    }

    const assessment = parsed?.assessment;
    if (!assessment || !Array.isArray(assessment.questions) || assessment.questions.length === 0) {
      return jsonResponse({ error: "Model returned invalid assessment structure" }, 500);
    }

    // Validate questions format
    for (let i = 0; i < assessment.questions.length; i++) {
      const q = assessment.questions[i];
      if (!q.id) q.id = `q_${i + 1}_${Date.now()}`;
      if (!Array.isArray(q.options) || q.options.length < 2) {
        q.options = ["Option A", "Option B", "Option C", "Option D"];
      }
      if (typeof q.correctAnswer !== "number" || q.correctAnswer < 0 || q.correctAnswer >= q.options.length) {
        q.correctAnswer = 0;
      }
    }

    return jsonResponse({ assessment });
  } catch (error) {
    console.error("ai-generate-quiz unhandled error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
