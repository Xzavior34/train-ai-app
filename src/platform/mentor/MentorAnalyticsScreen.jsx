import React from "react";
import { TopBar, StatCard } from "../components/PlatformUI.jsx";
import { Star, Users, Calendar, DollarSign } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchMentorEarnings, fetchMentorSessions } from "../../lib/api/schemaHelper.js";

// Previously every stat here (4.9, 24, 18, $2,140) was a hardcoded literal
// with no data fetching at all. `mentors.rating` / `mentors.total_sessions`
// are real columns (0003_mentors_sessions_messaging.sql) already loaded by
// the mentorProfileQuery this screen's parent (TrainAIPlatformApp) builds via
// fetchMentorProfile - passed down here instead of re-fetching. "Mentees
// helped" is the count of distinct learners across this mentor's completed
// mentorship_sessions rows (fetchMentorSessions), and "Earnings to date"
// sums the real mentor_earnings table via fetchMentorEarnings - both helpers
// already existed in schemaHelper.js, just never called from this screen.
export function MentorAnalyticsScreen({ mentorId, mentorProfileQuery, orgSelector }) {
  const earningsQuery = useSupabaseQuery(async () => (mentorId ? fetchMentorEarnings(mentorId) : []), [mentorId]);
  const sessionsQuery = useSupabaseQuery(async () => (mentorId ? fetchMentorSessions(mentorId) : []), [mentorId]);
  const earnings = earningsQuery.data || [];
  const sessions = sessionsQuery.data || [];
  const totalEarnings = earnings.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const menteesHelped = new Set(sessions.filter((s) => s.status === "completed").map((s) => s.learner_id).filter(Boolean)).size;

  const mentor = mentorProfileQuery?.data;
  const loading = mentorProfileQuery?.loading || earningsQuery.loading || sessionsQuery.loading;

  return (
    <div className="ta-fade">
      <TopBar title="Instructor Performance" sub="Student satisfaction & ratings" orgSelector={orgSelector} />
      <div className="ta-content">
        {!mentorId && !mentorProfileQuery?.loading && (
          <div className="ta-empty">No instructor profile found for your account yet.</div>
        )}
        <div className="ta-grid ta-grid-4">
          <StatCard stat={{ label: "Instructor rating", value: loading ? "N/A" : (mentor?.rating != null ? Number(mentor.rating).toFixed(1) : "0.0"), icon: Star }} />
          <StatCard stat={{ label: "Total sessions", value: loading ? "N/A" : (mentor?.total_sessions ?? 0), icon: Calendar }} />
          <StatCard stat={{ label: "Learners helped", value: loading ? "N/A" : menteesHelped, icon: Users }} />
          <StatCard stat={{ label: "Earnings to date", value: loading ? "N/A" : `$${totalEarnings.toFixed(2)}`, icon: DollarSign }} />
        </div>
      </div>
    </div>
  );
}
