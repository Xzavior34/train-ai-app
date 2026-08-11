import React from "react";
import { TopBar, StatCard, ProgressBar, Tag } from "../components/PlatformUI.jsx";
import { Brain, Sparkles, ClipboardCheck, AlertTriangle, Bot } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchWorkforceIntelligence } from "../../lib/api/platform.js";

// Workforce Intelligence Dashboard - PRD Section 9, "the key
// differentiator," confirmed as the largest unbuilt gap in the whole
// product before this. Visible to Admin (and Manager, at their own team
// scope - see ManagerDashboardScreen.jsx's Readiness Score/Skill Snapshot,
// built the same way) per Section 9's explicit access restriction.
//
// Section 9.5's data rule, followed directly: "should not rely on course
// completion alone... must combine available signals into decision-ready
// outputs." This combines four real, independently-fetched signals -
// completion, compliance, assessment scores, and real AI Coach usage - not
// one proxy dressed up as several. See fetchWorkforceIntelligence() for
// exactly how each number here is computed; nothing on this screen is
// estimated or invented.
export function WorkforceIntelligenceScreen({ orgId, orgSelector }) {
  const wiQuery = useSupabaseQuery(async () => (orgId ? fetchWorkforceIntelligence(orgId) : null), [orgId]);
  const wi = wiQuery.data;

  return (
    <div className="ta-fade">
      <TopBar title="Workforce Intelligence" sub="Readiness, skill gaps, and activity - combined from real signals, not completion alone" orgSelector={orgSelector} />
      <div className="ta-content">
        {wiQuery.loading && <div className="ta-card ta-empty">Loading workforce intelligence...</div>}
        {!wiQuery.loading && (!wi || wi.learnerCount === 0) && (
          <div className="ta-card ta-empty">No learners in this organization yet - readiness and skill data will appear once there's real activity to summarize.</div>
        )}

        {!wiQuery.loading && wi && wi.learnerCount > 0 && (
          <>
            <div className="ta-grid ta-grid-4">
              <StatCard stat={{ label: "Workforce readiness score", value: `${wi.readinessScore}`, icon: Brain }} />
              <StatCard stat={{ label: "Avg. course completion", value: `${wi.avgCompletion}%`, icon: ClipboardCheck }} />
              <StatCard stat={{ label: "Compliance rate", value: wi.complianceRate === null ? "N/A" : `${wi.complianceRate}%`, icon: AlertTriangle }} />
              <StatCard stat={{ label: "Real AI Coach uses (7d)", value: wi.aiUsageCount7d, icon: Bot }} />
              <StatCard stat={{ label: "Instructor/Manager notes (30d)", value: wi.feedbackNotesCount30d, icon: Sparkles }} />
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: -8, marginBottom: 8 }}>
              Readiness score = average of course completion ({wi.avgCompletion}%){wi.complianceRate !== null ? `, compliance rate (${wi.complianceRate}%)` : ""}{wi.avgAssessmentScore !== null ? `, and average assessment score (${wi.avgAssessmentScore}%)` : ""} across {wi.learnerCount} learners. Instructor and manager feedback notes ({wi.feedbackNotesCount30d} in the last 30 days) and real AI Coach usage are tracked as additional context alongside the score, not blended into it numerically - they're qualitative signals, not scores. Not predictive - a live summary of what's directly measurable today.
            </div>

            <div className="ta-card ta-mt16">
              <div className="ta-row ta-gap8"><Sparkles size={16} color="var(--primary)" /><div className="ta-title">Skill gaps by department</div></div>
              <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>
                Real course-category completion, broken down by department - the lowest scores are the closest thing this data supports to "where the gaps are." Not a dedicated skills taxonomy (none exists in the product yet) - flagged honestly rather than presented as more sophisticated than it is.
              </div>
              <div className="ta-col ta-gap10 ta-mt12">
                {wi.departmentBreakdown.length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)" }}>No department data yet.</div>}
                {wi.departmentBreakdown.map((d) => (
                  <div key={d.department}>
                    <div className="ta-row ta-between" style={{ fontSize: 12.5 }}>
                      <span style={{ fontWeight: 600 }}>{d.department}</span>
                      <span>{d.avgProgress}% avg ({d.count} enrollments)</span>
                    </div>
                    <ProgressBar value={d.avgProgress} />
                  </div>
                ))}
              </div>
            </div>

            <div className="ta-card ta-mt16">
              <div className="ta-row ta-gap8"><ClipboardCheck size={16} color="var(--primary)" /><div className="ta-title">Completion by course category</div></div>
              <div className="ta-col ta-gap10 ta-mt12">
                {wi.categoryBreakdown.length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)" }}>No course activity yet.</div>}
                {wi.categoryBreakdown.map((c) => (
                  <div key={c.category}>
                    <div className="ta-row ta-between" style={{ fontSize: 12.5 }}>
                      <span style={{ fontWeight: 600 }}>{c.category}</span>
                      <span>{c.avgProgress}% avg ({c.count} enrollments)</span>
                    </div>
                    <ProgressBar value={c.avgProgress} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
