// Train AI - Learner AI Insights edge function
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
    const userId = userData.user.id;

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch user's own data
    const [lessonRes, enrollRes, attemptsRes, quizzesRes] = await Promise.all([
      db.from("lesson_progress").select("is_completed, time_spent_minutes").eq("user_id", userId),
      db.from("course_enrollments").select("progress_percentage, completed_at").eq("user_id", userId),
      db.from("assessment_attempts").select("score").eq("user_id", userId),
      db.from("quiz_attempts").select("score").eq("user_id", userId).not("completed_at", "is", null),
    ]);
    if ([lessonRes, enrollRes, attemptsRes, quizzesRes].some(result => result.error)) {
      console.error("ai-insights: learning activity query failed", [lessonRes.error, enrollRes.error, attemptsRes.error, quizzesRes.error]);
      return jsonResponse({ error: "Your learning activity could not be loaded. Please try again shortly.", code: "activity_unavailable" }, 503);
    }

    const lessons = lessonRes.data || [];
    const enrollments = enrollRes.data || [];
    const attempts = [...(attemptsRes.data || []), ...(quizzesRes.data || [])];

    const completedLessons = lessons.filter((l) => l.is_completed).length;
    const totalMinutes = lessons.reduce((acc, l) => acc + (Number(l.time_spent_minutes) || 0), 0);
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
    const enrolledCourses = enrollments.length;

    const scores = attempts.filter(a => a.score != null).map((a) => Number(a.score)).filter(Number.isFinite);
    const averageScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

    const stats = { completedLessons, totalHours, averageScore, enrolledCourses };

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return jsonResponse({ error: "AI insights are not configured yet. Your learning progress is still saved.", code: "provider_unavailable" }, 503);
    }
    if (!lessons.length && !enrollments.length && !scores.length) return jsonResponse({ insights: "Complete a lesson or quiz to start building your learning insights.", stats });

    const systemPrompt = "You are a personal learning analytics coach for Train AI. Provide a concise, encouraging markdown summary (3-4 bullet points) highlighting the learner's progress, strengths, and recommended next steps based on their stats. Keep it engaging, direct, and under 200 words.";
    const userPrompt = `Learner stats: Enrolled courses: ${enrolledCourses}, Completed lessons: ${completedLessons}, Total learning hours: ${totalHours}, Average assessment score: ${averageScore == null ? 'No scored attempts yet' : averageScore + '%'}. Generate personalized learning insights in GitHub Markdown. Do not invent scores, strengths or achievements unsupported by these stats. Do not use emojis.`;

    // Only actual provider generation is billable. Configuration, activity
    // query failures and empty activity must never charge the learner.
    const { data: creditResult, error: creditErr } = await authClient.rpc("consume_ai_credits", {
      p_operation_key: "ai_insight",
      p_reference_id: userId,
    });
    if (creditErr) {
      console.error("ai-insights: credit metering call failed:", creditErr);
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
        console.error("ai-insights: credit refund failed:", refundErr);
      }
    }

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
        temperature: 0.7,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      await refundOnFailure();
      console.error("ai-insights: provider error", resp.status, errText.slice(0, 300));
      return jsonResponse({ error: "AI insights are temporarily unavailable. Please try again shortly.", code: "provider_unavailable" }, resp.status === 429 ? 429 : 502);
    }

    const json = await resp.json();
    const insights = json?.choices?.[0]?.message?.content?.trim() || "";

    if (!insights) {
      await refundOnFailure();
      return jsonResponse({ error: "The AI provider returned an empty response. Please try again." }, 502);
    }

    return jsonResponse({ insights, stats });
  } catch (error) {
    console.error("ai-insights error:", error);
    if (creditTransactionId) {
      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
          const fallbackDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          await fallbackDb.rpc("refund_ai_credits", { p_transaction_id: creditTransactionId, p_reason: "unexpected_error" });
        }
      } catch (refundErr) {
        console.error("ai-insights: fallback credit refund failed:", refundErr);
      }
    }
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
