import React from "react";
import { Users, Calendar, GraduationCap, Trophy, ChevronRight } from "lucide-react";
import { WeeklyLeagueCard } from "../components/retention/WeeklyLeagueCard.jsx";

// Community - a simple summary, not a social feed. The old version's
// posting/reacting/commenting features (Announcements, Design & UI
// Critique, AI & Full-Stack "spaces", etc.) were dead weight: cohort_posts
// insert is already restricted to instructors/admins only (see
// supabase/migrations/0126_no_learner_to_learner_messaging.sql), so a
// learner composer that can never successfully post doesn't belong here.
// This screen just orients the learner and links out to the real
// destinations (Cohort, Instructors, Study Group, Leaderboard).
export function CommunityScreen({
  cohortMembershipQuery = {}, cohortSessionsQuery = {},
  studyGroupsQuery = {}, myGroupIdsQuery = {},
  leaderboardQuery = {}, upcomingSessionsQuery = {},
  push, user = {},
}) {
  const cohort = cohortMembershipQuery.data?.cohort || null;
  const now = Date.now();
  const nextCohortSession = (cohortSessionsQuery.data || [])
    .filter(s => new Date(s.starts_at).getTime() >= now)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))[0] || null;
  const nextInstructorSession = (upcomingSessionsQuery.data || [])[0] || null;

  const myGroupIds = new Set(myGroupIdsQuery.data || []);
  const myGroup = (studyGroupsQuery.data || []).find(g => myGroupIds.has(g.id)) || null;

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 className="tai-h1" style={{ margin: 0 }}>Community</h1>
        <p className="tai-sub" style={{ margin: "4px 0 0" }}>Your cohort, instructors, study group and standing - at a glance</p>
      </div>

      {/* Upcoming cohort session */}
      <div className="tai-card tai-card-hover" style={{ padding: 16, borderRadius: 12, border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }} onClick={() => push("cohort")}>
        <div className="tai-row tai-gap10" style={{ alignItems: "center", minWidth: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: "rgba(37, 99, 235, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Calendar size={18} color="var(--primary)" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Upcoming Cohort Session</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {!cohort ? "Not part of a cohort yet" : nextCohortSession ? `${nextCohortSession.title} • ${new Date(nextCohortSession.starts_at).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}` : "No session scheduled yet"}
            </div>
          </div>
        </div>
        <ChevronRight size={16} color="var(--text-3)" style={{ flexShrink: 0 }} />
      </div>

      {/* Upcoming instructor session */}
      <div className="tai-card tai-card-hover" style={{ padding: 16, borderRadius: 12, border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }} onClick={() => push("mentors")}>
        <div className="tai-row tai-gap10" style={{ alignItems: "center", minWidth: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: "rgba(37, 99, 235, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <GraduationCap size={18} color="var(--primary)" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Upcoming Instructor Session</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {nextInstructorSession ? `${nextInstructorSession.title || "Session"} with ${nextInstructorSession.mentors?.user_profiles?.display_name || "an instructor"}` : "No session booked - browse instructors"}
            </div>
          </div>
        </div>
        <ChevronRight size={16} color="var(--text-3)" style={{ flexShrink: 0 }} />
      </div>

      {/* Active study group */}
      <div className="tai-card tai-card-hover" style={{ padding: 16, borderRadius: 12, border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }} onClick={() => push("studyGroup", myGroup ? { groupId: myGroup.id } : {})}>
        <div className="tai-row tai-gap10" style={{ alignItems: "center", minWidth: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: "rgba(37, 99, 235, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Users size={18} color="var(--primary)" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Study Group</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {myGroup ? myGroup.name : "You haven't joined a study group yet"}
            </div>
          </div>
        </div>
        <ChevronRight size={16} color="var(--text-3)" style={{ flexShrink: 0 }} />
      </div>

      {/* Current leaderboard ranking */}
      <div onClick={() => push("leaderboard")} style={{ cursor: "pointer" }}>
        <WeeklyLeagueCard rows={leaderboardQuery.data || []} loading={leaderboardQuery.loading} />
      </div>
    </div>
  );
}

export default CommunityScreen;
