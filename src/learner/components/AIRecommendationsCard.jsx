import React, { useMemo } from "react";
import { Sparkles, ArrowRight, BellRing, AlertTriangle } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchAIRecommendations } from "../../lib/api/schemaHelper.js";

function priorityTone(priority) {
  if (priority === "high" || priority === "urgent") return "danger";
  if (priority === "medium" || priority === "normal") return "warning";
  return "success";
}

// The edge function returns free-form `actionUrl` strings (e.g. "/courses",
// "/practice", "/community") meant for the reference app's router — this app
// has no router, only the tab-key `goTab` navigation, so map the common
// cases onto real tabs instead of leaving the link dead.
function tabForActionUrl(actionUrl) {
  if (!actionUrl) return null;
  const url = actionUrl.toLowerCase();
  if (url.includes("course")) return "courses";
  if (url.includes("practice") || url.includes("quiz") || url.includes("material")) return "ai";
  if (url.includes("communit") || url.includes("group")) return "community";
  return null;
}

// Real AI-generated "recommended for you" section, distinct from the
// client-derived RecommendedCoursesCard below it on HomeScreen. Calls the
// live `generate-ai-recommendations` edge function (via
// fetchAIRecommendations in schemaHelper.js) with the learner's real
// profile/enrollment/progress data and renders whatever recommendations +
// reminders it returns. Self-contained (owns its own query + derives its own
// request payload from props already fetched by useLearnerData), so it only
// fires once `user`/`courses` are available.
export function AIRecommendationsCard({ user, courses = [], session, goTab }) {
  const enrolled = useMemo(() => courses.filter((c) => c.enrolled), [courses]);
  const completedCoursesCount = useMemo(() => enrolled.filter((c) => (c.progress || 0) >= 100).length, [enrolled]);
  const inProgressCoursesCount = useMemo(() => enrolled.filter((c) => (c.progress || 0) < 100).length, [enrolled]);
  const averageProgress = useMemo(() => {
    if (!enrolled.length) return 0;
    return Math.round(enrolled.reduce((sum, c) => sum + (c.progress || 0), 0) / enrolled.length);
  }, [enrolled]);

  const userContext = useMemo(() => {
    if (!user?.track) return null;
    return {
      learningTrack: user.track,
      skillLevel: user.skillLevel || "beginner",
      completedCoursesCount,
      inProgressCoursesCount,
      averageProgress,
      goals: [],
      interests: [...new Set(courses.filter((c) => c.enrolled).map((c) => c.category).filter(Boolean))],
    };
  }, [user?.track, user?.skillLevel, completedCoursesCount, inProgressCoursesCount, averageProgress, courses]);

  const userProgress = useMemo(
    () => enrolled.map((c) => ({ courseId: c.id, title: c.title, progress: c.progress || 0, category: c.category })),
    [enrolled]
  );

  const recQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id || !userContext) return null;
    return fetchAIRecommendations({ userContext, userProgress });
  }, [session?.user?.id, userContext ? JSON.stringify(userContext) : null]);

  if (!session?.user?.id) return null;

  const result = recQuery.data;
  const recommendations = result?.recommendations || [];
  const reminders = result?.reminders || [];

  return (
    <>
      <div className="tai-row tai-between tai-mt20">
        <div className="tai-row tai-gap8">
          <Sparkles size={16} color="var(--primary)" />
          <div className="tai-title-sm">AI Recommended for you</div>
        </div>
      </div>

      <div className="tai-card tai-mt10">
        {recQuery.loading && (
          <div className="tai-empty">Generating personalized recommendations with AI...</div>
        )}

        {!recQuery.loading && !result && (
          <div className="tai-row tai-gap8" style={{ color: "var(--text-2)", fontSize: 12.5 }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>AI recommendations are unavailable right now — this may be a temporary rate limit or service issue. Check "Explore a new category" below in the meantime.</span>
          </div>
        )}

        {!recQuery.loading && result && recommendations.length === 0 && reminders.length === 0 && (
          <div className="tai-empty">The AI didn't find any specific recommendations for you yet — keep learning and check back soon.</div>
        )}

        {!recQuery.loading && recommendations.length > 0 && (
          <div className="tai-col tai-gap10">
            {recommendations.map((r, i) => {
              const targetTab = tabForActionUrl(r.actionUrl);
              return (
                <div
                  key={i}
                  className="tai-row tai-between"
                  style={{ padding: "10px 0", borderTop: i > 0 ? "1px solid var(--border)" : "none", cursor: targetTab ? "pointer" : "default", alignItems: "flex-start" }}
                  onClick={() => { if (targetTab && goTab) goTab(targetTab); }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="tai-row tai-gap8">
                      <span className="tai-tag" style={{ textTransform: "capitalize", fontSize: 10 }}>{r.type || "tip"}</span>
                      {r.priority && (
                        <span className="tai-tag" style={{
                          fontSize: 10,
                          background: `var(--${priorityTone(r.priority)}-bg)`,
                          color: `var(--${priorityTone(r.priority)})`,
                        }}>{r.priority}</span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, marginTop: 6 }}>{r.title}</div>
                    {r.description && <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 3 }}>{r.description}</div>}
                    {r.reason && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4, fontStyle: "italic" }}>{r.reason}</div>}
                  </div>
                  {targetTab && <ArrowRight size={15} color="var(--text-3)" style={{ flexShrink: 0, marginTop: 4 }} />}
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
                  <strong style={{ color: "var(--text)" }}>{rem.title}</strong>{rem.message ? ` — ${rem.message}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
