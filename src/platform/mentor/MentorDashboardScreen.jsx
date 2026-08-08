import React from "react";
import { TopBar, StatCard, Tag } from "../components/PlatformUI.jsx";
import { Calendar, Users, Star, DollarSign } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchMentorSessions, fetchMentorEarnings } from "../../lib/api/schemaHelper.js";

export function MentorDashboardScreen({ mentorId }) {
  const sessionsQuery = useSupabaseQuery(async () => mentorId ? fetchMentorSessions(mentorId) : [], [mentorId]);
  const earningsQuery = useSupabaseQuery(async () => mentorId ? fetchMentorEarnings(mentorId) : [], [mentorId]);

  const upcomingSessions = (sessionsQuery.data || []).filter(s => s.status !== "completed" && s.status !== "cancelled");
  const menteeCount = new Set((sessionsQuery.data || []).map(s => s.learner_id).filter(Boolean)).size;
  const ratedSessions = (sessionsQuery.data || []).filter(s => typeof s.rating === "number");
  const avgRating = ratedSessions.length
    ? (ratedSessions.reduce((sum, s) => sum + s.rating, 0) / ratedSessions.length).toFixed(1)
    : "N/A";
  // fetchMentorEarnings returns raw `mentor_earnings` rows, not a
  // pre-aggregated {total, pending} object - sum them here instead.
  const earningsRows = earningsQuery.data || [];
  const totalEarnings = earningsRows.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return (
    <div className="ta-fade">
      <TopBar title="Instructor Overview" sub="Your upcoming instructor sessions & earnings" />
      <div className="ta-content">
        <div className="ta-grid ta-grid-4">
          <StatCard stat={{ label: "Upcoming sessions", value: upcomingSessions.length, icon: Calendar }} />
          <StatCard stat={{ label: "Active mentees", value: menteeCount, icon: Users }} />
          <StatCard stat={{ label: "Instructor rating", value: avgRating, icon: Star }} />
          <StatCard stat={{ label: "Total earnings", value: `$${totalEarnings.toFixed(2)}`, icon: DollarSign }} />
        </div>

        <div className="ta-card ta-mt20">
          <div className="ta-title">Upcoming Sessions</div>
          <div className="ta-col ta-gap10 ta-mt14">
            {sessionsQuery.loading && <div className="ta-empty">Loading sessions...</div>}
            {!sessionsQuery.loading && upcomingSessions.length === 0 && <div className="ta-empty">No upcoming instructor sessions.</div>}
            {upcomingSessions.map(s => (
              <div key={s.id} className="ta-row ta-between" style={{ padding: 12, background: "var(--surface-3)", borderRadius: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{s.topic || s.title || "Instructor Session"}</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)" }}>{new Date(s.scheduled_at).toLocaleString()}</div>
                </div>
                <Tag tone="success">{s.status}</Tag>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
