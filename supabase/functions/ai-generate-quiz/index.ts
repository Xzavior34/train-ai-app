// Train AI - AI Quiz Generator edge function
import { createClient } from "npm:@supabase/supabase-js@2";

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

  // Hoisted outside the try block so the outer catch (genuinely
  // unexpected exceptions, not just handled non-2xx responses) can still
  // attempt a refund - see ai-chat's identical fix for the full reasoning.
  let creditTransactionId: string | null = null;

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

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Invalid or expired session" }, 401);
    }

    // Service-role client, used only for the refund call below (which is
    // itself service-role-restricted by design - see 0156's own comment
    // on why a user must never be able to trigger their own refund).
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

    // Verify organization AI feature gating server-side
    const userId = userData.user.id;
    const { data: profile } = await db
      .from("user_profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.organization_id) {
      const { data: org } = await db
        .from("organizations")
        .select("settings")
        .eq("id", profile.organization_id)
        .maybeSingle();

      const aiSettings = org?.settings?.ai || org?.settings?.ai_coach;
      if (aiSettings && (aiSettings.enabled === false || aiSettings.quiz_enabled === false)) {
        return jsonResponse({ error: "AI Quiz generation has been disabled for your organization." }, 403);
      }
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return jsonResponse({ error: "AI provider not configured - OPENAI_API_KEY missing" }, 402);
    }

    // Real, server-side AI credit metering (0156_ai_credit_ledger.sql /
    // 0157_ai_credit_payment_verification.sql) - same pattern already
    // proven in ai-chat: called with the caller's OWN authenticated
    // client so auth.uid() inside the RPC resolves correctly, cost comes
    // from the database's ai_operation_costs table (quiz_generation = 2
    // by default, not hard-coded here), and this happens BEFORE the
    // OpenAI call so an unauthorized request never reaches the provider.
    const { data: creditResult, error: creditErr } = await authClient.rpc("consume_ai_credits", {
      p_operation_key: "quiz_generation",
      p_reference_id: topic.trim().slice(0, 200),
    });
    if (creditErr) {
      console.error("ai-generate-quiz: credit metering call failed:", creditErr);
      return jsonResponse({ error: "AI usage could not be verified. Please try again." }, 503);
    }
    if (!creditResult?.authorized) {
      return jsonResponse({
        error: "AI credits exhausted",
        message: "Your available AI credits have been used. Ask your organization administrator to add more credits, or purchase personal AI credits.",
        code: "insufficient_credits",
      }, 402);
    }
    creditTransactionId = creditResult.transaction_id || null;
    async function refundOnFailure() {
      if (!creditTransactionId) return;
      try {
        await db.rpc("refund_ai_credits", { p_transaction_id: creditTransactionId, p_reason: "provider_failure" });
      } catch (refundErr) {
        console.error("ai-generate-quiz: credit refund failed:", refundErr);
      }
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
      await refundOnFailure();
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
      await refundOnFailure();
      return jsonResponse({ error: "Model output failed to parse into valid JSON" }, 500);
    }

    const assessment = parsed?.assessment;
    if (!assessment || !Array.isArray(assessment.questions) || assessment.questions.length === 0) {
      await refundOnFailure();
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
    if (creditTransactionId) {
      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
          const fallbackDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          await fallbackDb.rpc("refund_ai_credits", { p_transaction_id: creditTransactionId, p_reason: "unexpected_error" });
        }
      } catch (refundErr) {
        console.error("ai-generate-quiz: fallback credit refund failed:", refundErr);
      }
    }
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
