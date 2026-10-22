import React, { useState } from "react";
import { Brain, RefreshCw, BookOpen, Clock, Target, GraduationCap } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchAIInsights } from "../../lib/api/schemaHelper.js";
import { fetchOrgAIInsightsSettings } from "../../lib/api/organizations.js";

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
export function AIInsightsCard({ session, credits, consumeCredit, onBuyCredits, orgId }) {
  const [generation, setGeneration] = useState(0);

  // AI Insights manual mode - PRD 8.3, previously entirely unbuilt (only
  // AI Coach had this). When the org has switched this on, a real learner
  // never sees the real AI-generated analysis at all - the admin's own
  // announcement text replaces it entirely, the same posture AI Coach's
  // manual mode already uses (never blend real AI output with a manual
  // override in the same card).
  const orgInsightsSettingsQuery = useSupabaseQuery(async () => (orgId ? fetchOrgAIInsightsSettings(orgId) : null), [orgId]);
  const insightsEnabled = orgInsightsSettingsQuery.data?.enabled !== false;
  const insightsManualMode = !!orgInsightsSettingsQuery.data?.manual_mode;
  const insightsManualMessage = orgInsightsSettingsQuery.data?.manual_message;
  const ready = !orgInsightsSettingsQuery.loading && !orgInsightsSettingsQuery.error && insightsEnabled && !insightsManualMode;
  const insightsQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id || !ready || !generation) return null;
    const response = await fetchAIInsights();
    if (consumeCredit) await consumeCredit(0, "refresh");
    return response;
  }, [session?.user?.id, ready, generation]);

  const result = insightsQuery.data;
  const stats = result?.stats;
  const outOfCredits = typeof credits === "number" && credits <= 0;

  // Generate only on request. The server alone checks and charges credits.
  function handleRefresh() {
    if (outOfCredits || result?.status === 402) { onBuyCredits && onBuyCredits(); return; }
    if (ready) setGeneration(value => value + 1);
  }

  if (!insightsEnabled) return null;

  if (insightsManualMode) {
    return (
      <div className="tai-card tai-mt12" style={{ borderColor: "var(--border)", borderRadius: 10 }}>
        <div className="tai-row tai-gap8"><Brain size={16} color="var(--primary)" /><div style={{ fontWeight: 700, fontSize: 14 }}>A note from your organization</div></div>
        <div style={{ fontSize: 12.8, color: "var(--text-2)", marginTop: 8, lineHeight: 1.5 }}>
          {insightsManualMessage || "Your organization has enabled manual insights, but hasn't added a message yet."}
        </div>
      </div>
    );
  }

  return (
    <div className="tai-card tai-mt12" style={{ borderColor: "var(--border)", borderRadius: 10 }}>
      <div className="tai-row tai-between">
        <div className="tai-row tai-gap8">
          <Brain size={16} color="var(--primary)" />
          <div className="tai-title-sm">AI Insights</div>
        </div>
        <button
          className="tai-iconbtn"
          aria-label={outOfCredits ? "Out of AI credits" : "Refresh AI insights"}
          title={outOfCredits ? "Add AI credits" : "Generate AI insights (uses AI credits)"}
          disabled={insightsQuery.loading || !ready}
          onClick={handleRefresh}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {insightsQuery.loading && (
        <div className="tai-empty tai-mt10">Analyzing your learning activity with AI...</div>
      )}

      {!insightsQuery.loading && (result?.error || insightsQuery.error || orgInsightsSettingsQuery.error) && (
        <div className="tai-mt12" role="alert">{result?.error || "We could not load insights. Please try again shortly."}</div>
      )}

      {!insightsQuery.loading && !result?.error && !insightsQuery.error && !orgInsightsSettingsQuery.error && !result?.insights && (
        <div className="tai-empty tai-mt10">
          {outOfCredits ? "AI insights require credits. Your course and quiz progress remains available without AI credits." : "Generate a personal summary of your learning activity when you are ready. This uses AI credits."}
        </div>
      )}
      {!insightsQuery.loading && ready && <button type="button" className="tai-btn tai-btn-outline tai-mt12" onClick={handleRefresh}>
        {outOfCredits || result?.status === 402 ? "Add AI credits" : generation ? "Generate again" : "Generate insights"}
      </button>}

      {!insightsQuery.loading && result?.insights && (
        <>
          {stats && (
            <div className="tai-row tai-gap8 tai-mt10" style={{ flexWrap: "wrap" }}>
              <span className="tai-tag"><BookOpen size={11} style={{ marginRight: 4, verticalAlign: -2 }} />{stats.completedLessons} lessons</span>
              <span className="tai-tag"><Clock size={11} style={{ marginRight: 4, verticalAlign: -2 }} />{stats.totalHours}h studied</span>
              {stats.averageScore != null && <span className="tai-tag"><Target size={11} style={{ marginRight: 4, verticalAlign: -2 }} />{stats.averageScore}% avg assessment score</span>}
              <span className="tai-tag"><GraduationCap size={11} style={{ marginRight: 4, verticalAlign: -2 }} />{stats.enrolledCourses} courses</span>
            </div>
          )}
          <div className="tai-mt12">{renderInsightsText(result.insights)}</div>
        </>
      )}
    </div>
  );
}
