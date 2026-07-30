import React from "react";
import { Sparkles, RefreshCw, BookOpen, Clock, Target, GraduationCap } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchAIInsights } from "../../lib/api/schemaHelper.js";

// Turns the markdown-ish text the real `ai-insights` edge function returns
// (it's prompted with "Format the response in markdown with clear sections",
// headings like "**Progress Summary**" and "1. **Strengths**") into simple
// React nodes without pulling in a markdown dependency (none of
// @supabase/supabase-js, lucide-react, react, react-dom cover that). Bold
// runs and heading-ish lines get visual weight; everything else stays as
// plain wrapped text so nothing is silently dropped.
function renderInlineBold(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, j) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={j}>{part.slice(2, -2)}</strong>
      : <React.Fragment key={j}>{part}</React.Fragment>
  );
}

function renderInsightsText(raw) {
  if (!raw) return null;
  const lines = raw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  return lines.map((line, i) => {
    const isHeading = /^#{1,3}\s+/.test(line) || (/^\*\*.*\*\*:?$/.test(line) && line.length < 80);
    const isBullet = /^[-*]\s+/.test(line);
    const clean = line.replace(/^#{1,3}\s+/, "").replace(/^\d+\.\s*/, "").replace(/^[-*]\s+/, "");
    return (
      <div
        key={i}
        style={{
          fontSize: isHeading ? 13.5 : 12.8,
          fontWeight: isHeading ? 800 : 400,
          color: isHeading ? "var(--primary)" : "var(--text-2)",
          marginTop: isHeading ? (i === 0 ? 0 : 14) : 6,
          paddingLeft: isBullet ? 12 : 0,
          lineHeight: 1.5,
        }}
      >
        {isBullet ? "• " : ""}{renderInlineBold(clean)}
      </div>
    );
  });
}

// Real learner-facing AI insights card. Calls the live `ai-insights` edge
// function (via fetchAIInsights in schemaHelper.js) which authenticates the
// caller from their session, pulls THEIR OWN lesson_progress/
// course_enrollments/quiz_attempts server-side, and returns
// `{ insights: "<markdown>", stats: { completedLessons, totalHours,
// averageScore, enrolledCourses } }` from an LLM. Self-contained (owns its
// own query) so it only fires when actually mounted on the Achievements
// screen, matching the pattern GroupChatPanel uses on CommunityScreen.
export function AIInsightsCard({ session, credits, consumeCredit, onBuyCredits }) {
  const insightsQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return null;
    return fetchAIInsights();
  }, [session?.user?.id]);

  const result = insightsQuery.data;
  const stats = result?.stats;
  const outOfCredits = typeof credits === "number" && credits <= 0;

  // The initial load (above, on mount) is free — re-running the analysis on
  // demand via this button is a second discretionary LLM call, so it spends
  // 1 AI credit the same way AI quiz generation does (see AIQuizScreen.jsx).
  function handleRefresh() {
    if (outOfCredits) { onBuyCredits && onBuyCredits(); return; }
    if (consumeCredit) consumeCredit(1);
    insightsQuery.refetch();
  }

  return (
    <div className="tai-card tai-mt12" style={{ borderColor: "var(--primary)" }}>
      <div className="tai-row tai-between">
        <div className="tai-row tai-gap8">
          <Sparkles size={16} color="var(--primary)" />
          <div className="tai-title-sm">AI Insights</div>
        </div>
        <button
          className="tai-iconbtn"
          aria-label={outOfCredits ? "Out of AI credits" : "Refresh AI insights"}
          title={outOfCredits ? "Out of AI credits for today" : "Refresh (uses 1 AI credit)"}
          disabled={insightsQuery.loading}
          onClick={handleRefresh}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {insightsQuery.loading && (
        <div className="tai-empty tai-mt10">Analyzing your learning activity with AI...</div>
      )}

      {!insightsQuery.loading && result?.error && (
        <div className="tai-empty tai-mt10">{result.error}</div>
      )}

      {!insightsQuery.loading && !result?.error && !result?.insights && (
        <div className="tai-empty tai-mt10">
          Complete a few lessons or quizzes first — AI insights need some learning activity to analyze.
        </div>
      )}

      {!insightsQuery.loading && result?.insights && (
        <>
          {stats && (
            <div className="tai-row tai-gap8 tai-mt10" style={{ flexWrap: "wrap" }}>
              <span className="tai-tag"><BookOpen size={11} style={{ marginRight: 4, verticalAlign: -2 }} />{stats.completedLessons} lessons</span>
              <span className="tai-tag"><Clock size={11} style={{ marginRight: 4, verticalAlign: -2 }} />{stats.totalHours}h studied</span>
              <span className="tai-tag"><Target size={11} style={{ marginRight: 4, verticalAlign: -2 }} />{stats.averageScore}% avg quiz score</span>
              <span className="tai-tag"><GraduationCap size={11} style={{ marginRight: 4, verticalAlign: -2 }} />{stats.enrolledCourses} courses</span>
            </div>
          )}
          <div className="tai-mt12">{renderInsightsText(result.insights)}</div>
        </>
      )}
    </div>
  );
}
