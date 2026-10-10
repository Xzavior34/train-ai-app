import React, { useMemo } from "react";
import { Brain, ArrowRight, BellRing, Sparkles } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchAIRecommendations } from "../../lib/api/schemaHelper.js";

function priorityTone(priority) {
  if (priority === "high" || priority === "urgent") return "danger";
  if (priority === "medium" || priority === "normal") return "warning";
  return "success";
}

// The edge function returns free-form `actionUrl` strings (e.g. "/courses",
// "/practice", "/community") meant for the reference app's router - this app
// has no router, only the tab-key `goTab` navigation, so map the common
// cases onto real tabs instead of leaving the link dead.
function tabForActionUrl(actionUrl) {
  if (!actionUrl) return null;
  const url = actionUrl.toLowerCase();
  if (url.includes("course")) return "courses";
  if (url.includes("practice") || url.includes("quiz") || url.includes("material")) return "ai";
  if (url.includes("communit") || url.includes("group") || url.includes("cohort")) return "community";
  return null;
}

// Real AI-generated "recommended for you" section, driven by the live
// `generate-ai-recommendations` edge function with intelligent contextual
// fallback so learners never hit broken rate-limit placeholders.
export function AIRecommendationsCard({ user, courses = [], session, goTab, maxItems, showSeeAll = false }) {
  const enrolled = useMemo(() => courses.filter((c) => c.enrolled), [courses]);
  const completedCoursesCount = useMemo(() => enrolled.filter((c) => (c.progress || 0) >= 100).length, [enrolled]);
  const inProgressCoursesCount = useMemo(() => enrolled.filter((c) => (c.progress || 0) < 100).length, [enrolled]);
  const averageProgress = useMemo(() => {
    if (!enrolled.length) return 0;
    return Math.round(enrolled.reduce((sum, c) => sum + (c.progress || 0), 0) / enrolled.length);
  }, [enrolled]);

  const activeTrack = user?.track || user?.learning_track || user?.program_track || "Tech-preneur Track";

  const userContext = useMemo(() => {
    return {
      learningTrack: activeTrack,
      skillLevel: user?.skillLevel || "intermediate",
      completedCoursesCount,
      inProgressCoursesCount,
      averageProgress,
      goals: [],
      interests: [...new Set(courses.filter((c) => c.enrolled).map((c) => c.category).filter(Boolean))],
    };
  }, [activeTrack, user?.skillLevel, completedCoursesCount, inProgressCoursesCount, averageProgress, courses]);

  const userProgress = useMemo(
    () => enrolled.map((c) => ({ courseId: c.id, title: c.title, progress: c.progress || 0, category: c.category })),
    [enrolled]
  );

  const recQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id || !userContext) return null;
    return fetchAIRecommendations({ userContext, userProgress });
  }, [session?.user?.id, userContext ? JSON.stringify(userContext) : null]);

  // Contextual fallback recommendation when the remote AI Edge function has rate limit
  const activeCourse = enrolled.find((c) => (c.progress || 0) < 100) || enrolled[0] || courses[0] || null;
  const contextualFallbackRecs = useMemo(() => {
    const list = [];
    if (activeCourse) {
      list.push({
        title: `Advance in ${activeCourse.title}`,
        type: "Next Step",
        description: `Currently at ${activeCourse.progress || 0}% progress. Finish the next module to accelerate your ${activeTrack} milestones.`,
        reason: "Adaptive recommendation for active track",
        actionUrl: "/courses",
        priority: "high",
      });
    }
    list.push({
      title: "AI Adaptive Quiz Assessment",
      type: "Practice",
      description: "Test and benchmark your knowledge on recent syllabus lessons with custom AI evaluation.",
      reason: "Reinforce key concepts",
      actionUrl: "/practice",
      priority: "normal",
    });
    return list;
  }, [activeCourse, activeTrack]);

  if (!session?.user?.id) return null;

  const result = recQuery.data;
  const remoteRecs = result?.recommendations || [];
  const allRecommendations = remoteRecs.length > 0 ? remoteRecs : contextualFallbackRecs;
  const recommendations = maxItems ? allRecommendations.slice(0, maxItems) : allRecommendations;
  const reminders = maxItems ? [] : (result?.reminders || []);

  return (
    <>
      <div className="tai-row tai-between tai-mt20">
        <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
          <Brain size={16} color="var(--primary)" />
          <div className="tai-title-sm">AI Recommended for you</div>
        </div>
        {showSeeAll && goTab && (
          <span className="tai-link" style={{ cursor: "pointer", fontSize: 12, fontWeight: 700 }} onClick={() => goTab("ai")}>
            Open AI Coach
          </span>
        )}
      </div>

      <div className="tai-card tai-mt10" style={{ borderRadius: 10, padding: 14 }}>
        {recQuery.loading && (
          <div className="tai-empty">Generating personalized recommendations with AI...</div>
        )}

        {!recQuery.loading && recommendations.length > 0 && (
          <div className="tai-col tai-gap10">
            {recommendations.map((r, i) => {
              const targetTab = tabForActionUrl(r.actionUrl);
              return (
                <div
                  key={i}
                  className="tai-row tai-between"
                  style={{
                    padding: "8px 0",
                    borderTop: i > 0 ? "1px solid var(--border)" : "none",
                    cursor: targetTab ? "pointer" : "default",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                  onClick={() => { if (targetTab && goTab) goTab(targetTab); }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
                      <span className="tai-tag" style={{ textTransform: "capitalize", fontSize: 10, fontWeight: 800 }}>
                        <Sparkles size={10} style={{ marginRight: 3 }} /> {r.type || "AI Suggestion"}
                      </span>
                      {r.priority && (
                        <span
                          className="tai-tag"
                          style={{
                            fontSize: 10,
                            background: `var(--${priorityTone(r.priority)}-bg, rgba(37,99,235,0.1))`,
                            color: `var(--${priorityTone(r.priority)}, #2563EB)`,
                            fontWeight: 700,
                          }}
                        >
                          {r.priority}
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 13.5, marginTop: 4, color: "var(--text)" }}>{r.title}</div>
                    {r.description && <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2, lineHeight: 1.4 }}>{r.description}</div>}
                    {r.reason && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3, fontStyle: "italic" }}>{r.reason}</div>}
                  </div>
                  {targetTab && <ArrowRight size={15} color="var(--primary)" style={{ flexShrink: 0, marginTop: 4 }} />}
                </div>
              );
            })}
          </div>
        )}

        {!recQuery.loading && reminders.length > 0 && (
          <div className="tai-col tai-gap8 tai-mt12" style={{ borderTop: recommendations.length ? "1px solid var(--border)" : "none", paddingTop: recommendations.length ? 10 : 0 }}>
            {reminders.map((rem, i) => (
              <div key={i} className="tai-row tai-gap8" style={{ alignItems: "flex-start" }}>
                <BellRing size={14} color="var(--warning)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                  <strong style={{ color: "var(--text)" }}>{rem.title}</strong>{rem.message ? `: ${rem.message}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
