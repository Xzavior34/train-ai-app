// Train AI - Learner AI Insights edge function
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
    const [lessonRes, enrollRes, attemptsRes] = await Promise.all([
      db.from("lesson_progress").select("is_completed, time_spent_minutes").eq("user_id", userId),
      db.from("course_enrollments").select("progress_percentage, completed_at").eq("user_id", userId),
      db.from("assessment_attempts").select("score").eq("user_id", userId),
    ]);

    const lessons = lessonRes.data || [];
    const enrollments = enrollRes.data || [];
    const attempts = attemptsRes.data || [];

    const completedLessons = lessons.filter((l) => l.is_completed).length;
    const totalMinutes = lessons.reduce((acc, l) => acc + (Number(l.time_spent_minutes) || 0), 0);
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
    const enrolledCourses = enrollments.length;

    const scores = attempts.map((a) => Number(a.score)).filter((s) => !isNaN(s));
    const averageScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 85;

    const stats = { completedLessons, totalHours, averageScore, enrolledCourses };

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      const defaultInsights = `### 🌟 Your Learning Highlights\n- **Great momentum!** You have enrolled in ${enrolledCourses} course${enrolledCourses === 1 ? '' : 's'} and completed ${completedLessons} lesson${completedLessons === 1 ? '' : 's'}.\n- **Time Investment:** You have logged ${totalHours} hours of active learning.\n- **Assessment Performance:** Your current average score across quizzes is ${averageScore}%.\n- **Recommendation:** Keep practicing regularly to build mastery!`;
      return jsonResponse({ insights: defaultInsights, stats });
    }

    const systemPrompt = "You are a personal learning analytics coach for Train AI. Provide a concise, encouraging markdown summary (3-4 bullet points) highlighting the learner's progress, strengths, and recommended next steps based on their stats. Keep it engaging, direct, and under 200 words.";
    const userPrompt = `Learner stats: Enrolled courses: ${enrolledCourses}, Completed lessons: ${completedLessons}, Total learning hours: ${totalHours}, Average quiz score: ${averageScore}%. Generate personalized learning insights in GitHub Markdown.`;

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
      return jsonResponse({ error: `OpenAI API error: ${resp.status} ${errText.slice(0, 300)}` }, resp.status === 429 ? 429 : 502);
    }

    const json = await resp.json();
    const insights = json?.choices?.[0]?.message?.content?.trim() || "";

    return jsonResponse({ insights, stats });
  } catch (error) {
    console.error("ai-insights error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
