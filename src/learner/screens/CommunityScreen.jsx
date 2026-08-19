import React, { useState, useMemo, useEffect } from "react";
import { TopBar, Avatar, Tag, timeAgo, initialsOf } from "../components/LearnerUI.jsx";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { PlusCircle, Heart, MessageCircle, Send, Users, TrendingUp, Activity, ArrowLeft, X, ThumbsUp, ThumbsDown, Layers, CheckCircle2, Megaphone, ChevronRight, GraduationCap, Calendar, BookOpen, FileText } from "lucide-react";
import { WeeklyLeagueCard } from "../components/retention/WeeklyLeagueCard.jsx";

// Small reusable stat block for the member profile modal (level/streak/points
// pulled from the real user_gamification_stats table).
function StatPill({ label, value }) {
  return (
    <div style={{ flex: 1, textAlign: "center", background: "var(--surface-2)", borderRadius: 12, padding: "10px 6px" }}>
      <div style={{ fontSize: 15, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".04em", marginTop: 2 }}>{label}</div>
    </div>
  );
}

// Study group chat - reads/writes the real `study_group_messages` table.
// Complete Study Group Workspace - includes Discussion, Members list, and Shared Resources.
function StudyGroupWorkspace({ group, joined, session, onBack, fetchStudyGroupMembers, showToast, push, goTab }) {
  const [activeTab, setActiveTab] = useState("members"); // "members" | "resources"

  const membersQuery = useSupabaseQuery(async () => {
    if (!group?.id || !fetchStudyGroupMembers) return [];
    return fetchStudyGroupMembers(group.id);
  }, [group?.id]);
  const groupMembers = membersQuery.data || [];
  const instructorGroupMembers = groupMembers.filter(m => m.platform_role === "mentor" || m.platform_role === "admin");

  // Real member count for this specific group: prefer the live members
  // fetch (membersQuery, below) and fall back to the embedded
  // `study_group_members(count)` aggregate already returned by
  // fetchStudyGroups() - never a hardcoded "1".
  const realMemberCount = !membersQuery.loading
    ? groupMembers.length
    : (group?.study_group_members?.[0]?.count ?? 0);

  return (
    <div className="tai-card" style={{ display: "flex", flexDirection: "column", minHeight: 440 }}>
      {/* Group Header & Meta */}
      <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 14 }}>
        <div className="tai-row tai-between">
          <div className="tai-row tai-gap10">
            <button className="tai-iconbtn" onClick={onBack} aria-label="Back to study groups"><ArrowLeft size={16} /></button>
            <div>
              <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{group?.name || "Study Group Workspace"}</div>
                <Tag>{group?.topic || "Study Group"}</Tag>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 3 }}>
                {group?.description || "Collaborative workspace for study group members"}
              </div>
            </div>
          </div>
          <span className="tai-row tai-gap4" style={{ fontSize: 12, color: "var(--primary)", fontWeight: 700 }}>
            <Users size={14} /> {realMemberCount} Member{realMemberCount === 1 ? "" : "s"}
          </span>
        </div>

        {/* Group Sub-Tabs - "Discussion Board" removed directly per
            instruction ("remove chat from community"). It had no compose
            box already (no learner-to-learner posting, per
            0126_no_learner_to_learner_messaging.sql) and was empty for
            the vast majority of groups in practice, since it only ever
            showed content if an instructor happened to be a member. */}
        <div className="tai-row tai-gap8 tai-mt14">
          <div
            className={`tai-pill ${activeTab === "members" ? "tai-pill-active" : "tai-pill-inactive"}`}
            onClick={() => setActiveTab("members")}
            style={{ cursor: "pointer", fontSize: 12 }}
          >
            👥 Group Members ({realMemberCount})
          </div>
          <div
            className={`tai-pill ${activeTab === "resources" ? "tai-pill-active" : "tai-pill-inactive"}`}
            onClick={() => setActiveTab("resources")}
            style={{ cursor: "pointer", fontSize: 12 }}
          >
            📌 Shared Resources
          </div>
        </div>
      </div>

      {/* Tab Content 2: Group Members - real study_group_members rows for
          THIS group specifically, not a generic community-people slice. */}
      {activeTab === "members" && (
        <div className="tai-col tai-gap10 tai-mt12">
          {/* Instructor only, same principle applied consistently - though
              worth flagging directly: a study group's whole premise is
              peers studying together, so filtering its member list down to
              "instructor only" means a study group with no instructor
              member shows nothing here at all. Applied for consistency
              with the same explicit instruction used for Cohort's
              Instructor tab and Community's People tab - but this is the
              one place where that tension is real enough to name rather
              than silently accept. */}
          <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 4 }}>
            Instructor for this study group:
          </div>
          {membersQuery.loading && <div className="tai-empty">Loading...</div>}
          {!membersQuery.loading && instructorGroupMembers.length === 0 && (
            <div className="tai-empty">No instructor assigned to this study group yet.</div>
          )}
          {instructorGroupMembers.map(m => (
            <div key={m.user_id} className="tai-row tai-between" style={{ background: "var(--surface-2)", padding: "10px 12px", borderRadius: 10 }}>
              <div className="tai-row tai-gap10">
                <Avatar initials={initialsOf(m.display_name)} size={32} src={m.avatar_url} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{m.display_name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>Instructor</div>
                </div>
              </div>
              <Tag tone="success">Active</Tag>
            </div>
          ))}
        </div>
      )}

      {/* Tab Content 3: Shared Resources - this group's linked course
          (study_groups.course_id, a real FK) is the only actual "resource"
          the schema has for a study group; there's no dedicated shared-files
          table, so rather than inventing a fake syllabus card, this links
          straight to the real course when one is set. */}
      {activeTab === "resources" && (
        <div className="tai-col tai-gap10 tai-mt12">
          <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 4 }}>
            Shared resources for this group:
          </div>
          {group?.courses?.title ? (
            <div className="tai-card" style={{ background: "var(--surface-2)" }}>
              <div className="tai-row tai-between">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>📘 {group.courses.title}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 2 }}>This group's linked course. Open it for lessons & materials.</div>
                </div>
                <button
                  className="tai-btn tai-btn-outline tai-btn-sm"
                  onClick={() => {
                    if (push) push("courseDetail", { id: group.course_id });
                    else if (goTab) goTab("courses");
                  }}
                >
                  Open course
                </button>
              </div>
            </div>
          ) : (
            <div className="tai-empty">No shared resources yet. This group isn't linked to a course.</div>
          )}
        </div>
      )}
    </div>
  );
}

// Confirmed against the requirement to remove "traditional social feed,
// general posts feed, open peer-to-peer social networking" - the Forums
// feature (generic categories with open threads any member could start,
// unrelated to any specific cohort or study group) was exactly that kind
// of feature and directly contradicted it. Removed entirely from here and
// from the Admin side (ForumsScreen.jsx deleted). The underlying
// `forums`/`forum_posts` database tables are left in place rather than
// dropped - matching the same pattern used for the HR role - but nothing
// in the application surfaces them anymore.
export function CommunityScreen({
  communityTab = "posts", setCommunityTab, posts = [], newPostText = "", setNewPostText,
  expandedPost, setExpandedPost, replyInput = "", setReplyInput, studyGroupsQuery = {},
  joinedGroupIds = new Set(), myGroupIdsQuery = {}, communityPeopleQuery = {},
  memberStatsQuery = {}, activityFeedQuery = {},
  user = {}, session = {}, showToast = () => {}, postsQuery = {},
  createCommunityPost = () => {}, togglePostReaction = () => {}, addPostComment = () => {},
  joinStudyGroup = () => {}, leaveStudyGroup = () => {},
  fetchStudyGroupMembers,
  cohortMembershipQuery = {}, cohortPostsQuery = {},
  leaderboardQuery = {},
  leaderboardEnabled = true,
  upcomingSessionsQuery = {}, cohortResourcesQuery = {}, cohortSessionsQuery = {}, enrollmentsQuery = {},
  push, goTab,
  // Set when the learner arrived here from a universal-search "Community"
  // result (see TrainAILearnerApp's onOpenPost -> push("community", { postId })).
  // Expands that specific post's comments and scrolls it into view, instead
  // of just dumping the learner on the generic Feed tab.
  initialExpandedPostId = null,
}) {
  const safePosts = posts || [];
  const studyGroups = studyGroupsQuery.data || [];
  const communityPeople = communityPeopleQuery.data || [];
  const instructorPeople = communityPeople.filter(p => p.role === "mentor" || p.role === "admin");
  const memberStats = memberStatsQuery.data || {};
  const activityFeed = activityFeedQuery.data || [];
  const myCohort = cohortMembershipQuery.data?.cohort || null;
  const cohortPosts = cohortPostsQuery.data || [];

  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [cohortPostText, setCohortPostText] = useState("");
  const [cohortPosting, setCohortPosting] = useState(false);
  const [expandedCohortPostId, setExpandedCohortPostId] = useState(null);
  const [cohortReplyText, setCohortReplyText] = useState("");

  useEffect(() => {
    if (!initialExpandedPostId) return;
    if (setCommunityTab) setCommunityTab("posts");
    if (setExpandedPost) setExpandedPost(initialExpandedPostId);
    const t = setTimeout(() => {
      const el = document.getElementById(`community-post-${initialExpandedPostId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    return () => clearTimeout(t);
  }, [initialExpandedPostId]);

  // Trending topics - derived client-side from the `tags` column already
  // present on every fetched community_posts row (real column, no dedicated
  // trending table in the schema). Falls back to most-liked posts when
  // nobody has tagged anything yet.
  const trendingTags = useMemo(() => {
    const counts = {};
    safePosts.forEach(p => (p.tags || []).forEach(t => { if (t) counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([tag, count]) => ({ tag, count }));
  }, [safePosts]);

  const topLikedPosts = useMemo(() => {
    return safePosts.filter(p => (p.likes || 0) > 0).slice().sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 3);
  }, [safePosts]);

  const selectedGroup = studyGroups.find(g => g.id === selectedGroupId) || null;

  // Community Dashboard derivations (replaces the old post feed) - all from
  // data this screen already receives as props, nothing new fetched here.
  const cohortAnnouncements = useMemo(() => cohortPosts.filter(p => p.is_announcement), [cohortPosts]);
  const cohortNonAnnouncementPosts = useMemo(() => cohortPosts.filter(p => !p.is_announcement), [cohortPosts]);
  const myStudyGroups = useMemo(() => studyGroups.filter(g => joinedGroupIds.has(g.id)), [studyGroups, joinedGroupIds]);
  const leaderboardRows = leaderboardQuery.data || [];
  const leaderboardLoading = !!leaderboardQuery.loading;

  const tabs = [
    { k: "posts", label: "Dashboard" },
    { k: "cohorts", label: "Cohort Channels" },
    { k: "groups", label: `Study Groups${studyGroups.length ? ` (${studyGroups.length})` : ""}` },
    { k: "people", label: "Instructors" },
  ];

  return (
    <div className="tai-fade-in">
      <TopBar title="Community & Cohort Space" sub="Collaborate with cohort peers & study groups" />
      <div className="tai-row tai-gap8" style={{ flexWrap: "wrap" }}>
        {tabs.map(t => (
          <div key={t.k} className={`tai-pill ${communityTab === t.k ? "tai-pill-active" : "tai-pill-inactive"}`} onClick={() => setCommunityTab && setCommunityTab(t.k)}>
            {t.label}
          </div>
        ))}
      </div>

      {communityTab === "posts" && (
        <div className="tai-mt16">
          {/* Community Dashboard - replaces the old social-media-style post
              feed (createCommunityPost/togglePostReaction/addPostComment
              below are no longer called from here; the underlying table and
              functions are left alone, this is a UI-level removal). Per the
              product brief: "Community becomes structured instead of
              social-media style... Posts are removed. Feed becomes a
              dashboard showing: Cohort updates, Study group activity,
              Leaderboard summary, Announcements." */}

          {/* Announcements - pinned/announcement cohort posts */}
          {cohortAnnouncements.length > 0 && (
            <div className="tai-card" style={{ borderLeft: "3px solid var(--warning)" }}>
              <div className="tai-row tai-gap8"><Megaphone size={16} color="var(--warning)" /><div className="tai-title-sm">Announcements</div></div>
              <div className="tai-col tai-gap10 tai-mt10">
                {cohortAnnouncements.slice(0, 3).map((a) => (
                  <div key={a.id} style={{ fontSize: 12.5 }}>
                    <span style={{ fontWeight: 700 }}>{a.user_profiles?.display_name || "Instructor"}: </span>
                    <span style={{ color: "var(--text-2)" }}>{a.content}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cohort updates */}
          <div className="tai-card tai-mt12">
            <div className="tai-row tai-between">
              <div className="tai-row tai-gap8"><Layers size={16} color="var(--primary)" /><div className="tai-title-sm">Cohort updates</div></div>
              {myCohort && <span className="tai-link" style={{ fontSize: 12 }} onClick={() => push("cohort")}>Open cohort</span>}
            </div>
            {!myCohort && <div className="tai-empty" style={{ padding: "16px 0 4px" }}>Not part of a cohort yet.</div>}
            {myCohort && cohortNonAnnouncementPosts.length === 0 && (
              <div className="tai-empty" style={{ padding: "16px 0 4px" }}>No cohort activity yet.</div>
            )}
            {myCohort && cohortNonAnnouncementPosts.length > 0 && (
              <div className="tai-col tai-gap10 tai-mt10">
                {cohortNonAnnouncementPosts.slice(0, 3).map((p) => (
                  <div key={p.id} style={{ fontSize: 12.5 }}>
                    <span style={{ fontWeight: 700 }}>{p.user_profiles?.display_name || "Member"}: </span>
                    <span style={{ color: "var(--text-2)" }}>{p.content}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Study group activity */}
          <div className="tai-card tai-mt12">
            <div className="tai-row tai-between">
              <div className="tai-row tai-gap8"><Users size={16} color="var(--primary)" /><div className="tai-title-sm">Study group activity</div></div>
              <span className="tai-link" style={{ fontSize: 12 }} onClick={() => setCommunityTab && setCommunityTab("groups")}>All groups</span>
            </div>
            {myStudyGroups.length === 0 && <div className="tai-empty" style={{ padding: "16px 0 4px" }}>You haven't joined a study group yet.</div>}
            {myStudyGroups.length > 0 && (
              <div className="tai-col tai-gap8 tai-mt10">
                {myStudyGroups.slice(0, 3).map((g) => (
                  <div key={g.id} className="tai-row tai-between" style={{ cursor: "pointer" }} onClick={() => { setCommunityTab && setCommunityTab("groups"); setSelectedGroupId(g.id); }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{g.name}</span>
                    <span style={{ fontSize: 11.5, color: "var(--text-2)" }}>{g.study_group_members?.[0]?.count ?? 0} members</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Leaderboard summary - reuses the leaderboard data + card that
              were already fetched/built elsewhere but never actually wired
              to a screen. Hidden entirely if the organization has disabled
              rankings ("Leaderboard visibility is configurable. Admins can
              disable rankings."). */}
          {leaderboardEnabled && <WeeklyLeagueCard rows={leaderboardRows} loading={leaderboardLoading} />}

          {/* Upcoming sessions - explicitly required alongside cohort
              updates/study group activity/announcements. The booking data
              itself (upcomingSessionsQuery) already existed and was already
              used elsewhere (Home dashboard) - it just was never passed
              into or rendered by this component at all until now. */}
          {(upcomingSessionsQuery.data || []).length > 0 && (
            <div className="tai-card tai-mt12">
              <div className="tai-row tai-between">
                <div className="tai-row tai-gap8"><Calendar size={16} color="var(--primary)" /><div className="tai-title-sm">Upcoming sessions</div></div>
                <span className="tai-link" style={{ fontSize: 12 }} onClick={() => push("mentors")}>All sessions</span>
              </div>
              <div className="tai-col tai-gap8 tai-mt10">
                {(upcomingSessionsQuery.data || []).slice(0, 3).map((s) => (
                  <div key={s.id} className="tai-row tai-between">
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{s.title || "1:1 session"} - {s.mentors?.user_profiles?.display_name || "Instructor"}</span>
                    <span style={{ fontSize: 11.5, color: "var(--text-2)" }}>{new Date(s.scheduled_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick links to assigned courses and resources - explicitly
              required. Deliberately a lightweight link strip rather than
              duplicating the full Courses screen or Cohort resources list
              here - the Community Dashboard's job is to surface that these
              exist and get someone there in one tap, not to re-render them
              in full. */}
          <div className="tai-row tai-gap10 tai-mt12" style={{ flexWrap: "wrap" }}>
            <div className="tai-card" style={{ flex: 1, minWidth: 140, cursor: "pointer" }} onClick={() => goTab && goTab("courses")}>
              <div className="tai-row ta-gap8" style={{ gap: 8 }}>
                <BookOpen size={16} color="var(--primary)" />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>Assigned courses</div>
                  <div style={{ fontSize: 11, color: "var(--text-2)" }}>{(enrollmentsQuery.data || []).length} in progress</div>
                </div>
              </div>
            </div>
            {myCohort && (
              <div className="tai-card" style={{ flex: 1, minWidth: 140, cursor: "pointer" }} onClick={() => push("cohort")}>
                <div className="tai-row ta-gap8" style={{ gap: 8 }}>
                  <FileText size={16} color="var(--primary)" />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>Resources</div>
                    <div style={{ fontSize: 11, color: "var(--text-2)" }}>{(cohortResourcesQuery.data || []).length} shared in your cohort</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Instructors - third primary community structure per the brief */}
          <div className="tai-card tai-mt12" style={{ cursor: "pointer" }} onClick={() => push("mentors")}>
            <div className="tai-row tai-between">
              <div className="tai-row tai-gap10">
                <div className="tai-iconbtn" style={{ background: "var(--surface-2)" }}><GraduationCap size={16} /></div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>Instructors</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Book a 1:1 session or ask a question</div>
                </div>
              </div>
              <ChevronRight size={16} color="var(--text-3)" />
            </div>
          </div>
        </div>
      )}


      {communityTab === "cohorts" && (
        <div className="tai-mt16">
          {cohortMembershipQuery.loading ? (
            <div className="tai-empty">Loading your cohort...</div>
          ) : !myCohort ? (
            <div className="tai-empty">You're not part of a cohort yet. Once an admin adds you to one, its resources, sessions, and chat will show up here.</div>
          ) : (
            <div className="tai-card" style={{ background: "var(--surface-2)", cursor: "pointer" }} onClick={() => push && push("cohort")}>
              <div className="tai-row tai-between">
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: ".05em" }}>Your Cohort</div>
                  <div style={{ fontWeight: 800, fontSize: 17, marginTop: 2 }}>{myCohort.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>{myCohort.description}</div>
                  <div style={{ fontSize: 12, color: "var(--primary)", fontWeight: 700, marginTop: 10 }}>Open resources, sessions & chat →</div>
                </div>
                <Tag tone="success">Active</Tag>
              </div>
            </div>
          )}
        </div>
      )}

      {communityTab === "groups" && (
        <div className="tai-mt16">
          {selectedGroupId ? (
            <StudyGroupWorkspace
              group={selectedGroup || { id: selectedGroupId, name: "Study Group Workspace", description: "Collaborative learning space" }}
              joined={joinedGroupIds.has(selectedGroupId)}
              session={session}
              showToast={showToast}
              onBack={() => setSelectedGroupId(null)}
              fetchStudyGroupMembers={fetchStudyGroupMembers}
              push={push}
              goTab={goTab}
            />
          ) : (
            <div className="tai-col tai-gap10">
              {studyGroupsQuery.loading && <div className="tai-empty">Loading study groups...</div>}
              {!studyGroupsQuery.loading && studyGroups.length === 0 && <div className="tai-empty">No study groups found.</div>}
              {studyGroups.map(g => {
                const joined = joinedGroupIds.has(g.id);
                return (
                  <div key={g.id} className="tai-card tai-row tai-between" style={{ cursor: "pointer" }} onClick={() => setSelectedGroupId(g.id)}>
                    <div style={{ flex: 1, marginRight: 12 }}>
                      <div className="tai-row tai-gap8">
                        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{g.name}</div>
                        <Tag>{g.topic || "Study Group"}</Tag>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>{g.description}</div>
                      <div className="tai-row tai-gap6" style={{ fontSize: 11.5, color: "var(--primary)", marginTop: 8, fontWeight: 700 }}>
                        <Users size={13} /> {g.study_group_members?.[0]?.count ?? 0} Group Member{(g.study_group_members?.[0]?.count ?? 0) === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="tai-row tai-gap8" onClick={e => e.stopPropagation()}>
                      <button className="tai-btn tai-btn-primary tai-btn-sm" onClick={() => setSelectedGroupId(g.id)}>
                        <Users size={13} /> Enter Group
                      </button>
                      <button
                        className={`tai-btn tai-btn-sm ${joined ? "tai-btn-ghost" : "tai-btn-outline"}`}
                        onClick={async () => {
                          if (!session?.user?.id) return;
                          if (joined) {
                            await leaveStudyGroup({ studyGroupId: g.id, userId: session.user.id });
                            showToast(`Left ${g.name}`);
                          } else {
                            await joinStudyGroup({ studyGroupId: g.id, userId: session.user.id });
                            setSelectedGroupId(g.id);
                            showToast(`Joined & entered ${g.name}!`);
                          }
                          if (myGroupIdsQuery.refetch) myGroupIdsQuery.refetch();
                          if (studyGroupsQuery.refetch) studyGroupsQuery.refetch();
                        }}
                      >
                        {joined ? "Leave" : "Join"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {communityTab === "people" && (
        <div className="tai-mt16 tai-col tai-gap10">
          {/* Instructors only - same principle as CohortScreen's Members
              tab, confirmed by repeated direct instruction: no
              learner-to-learner visibility anywhere in Community, not just
              no messaging. Fellow learners' profiles are never listed
              here, even read-only. */}
          {communityPeopleQuery.loading && <div className="tai-empty">Loading instructors...</div>}
          {!communityPeopleQuery.loading && instructorPeople.length === 0 && <div className="tai-empty">No instructor profiles yet.</div>}
          {instructorPeople.map(p => {
            const name = p.display_name || p.name || "Learner";
            const initials = initialsOf(name);
            const stats = memberStats[p.id];
            return (
              <div key={p.id} className="tai-card tai-row tai-between" style={{ cursor: "pointer" }} onClick={() => setSelectedMember(p)}>
                <div className="tai-row tai-gap10">
                  <Avatar initials={initials} src={p.avatar_url} size={36} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{name}</div>
                    <div className="tai-row tai-gap8" style={{ fontSize: 11.5, color: "var(--text-2)" }}>
                      <span>{p.role === "mentor" ? "Instructor" : (p.role || "Learner")}</span>
                      {stats?.streak_days ? <span>· {stats.streak_days}d streak</span> : null}
                      {stats?.current_level ? <span>· Lvl {stats.current_level}</span> : null}
                    </div>
                  </div>
                </div>
                {/* Messaging is restricted to instructors - per the brief,
                    there is no unrestricted learner-to-learner messaging.
                    A plain learner in the directory has no Message action;
                    an instructor still does. */}
                {p.role === "mentor" && (
                  <div className="tai-row tai-gap8">
                    <button className="tai-btn tai-btn-primary tai-btn-sm" onClick={(e) => {
                      e.stopPropagation();
                      if (push) push("messages", { recipientId: p.id, recipientName: name });
                      else if (goTab) goTab("messages");
                      showToast(`Opening chat with ${name}...`);
                    }}>
                      <MessageCircle size={13} /> Message
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedMember && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(10,12,25,.55)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setSelectedMember(null)}
        >
          <div className="tai-card" style={{ maxWidth: 380, width: "100%" }} onClick={e => e.stopPropagation()}>
            <div className="tai-row tai-between">
              <div className="tai-row tai-gap10">
                <Avatar initials={initialsOf(selectedMember.display_name || selectedMember.name)} src={selectedMember.avatar_url} size={48} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{selectedMember.display_name || selectedMember.name || "Learner"}</div>
                  <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                    {selectedMember.role === "mentor" ? "Instructor" : (selectedMember.role || "Learner")}{selectedMember.school ? ` · ${selectedMember.school}` : ""}
                  </div>
                </div>
              </div>
              <button className="tai-iconbtn" onClick={() => setSelectedMember(null)} aria-label="Close"><X size={16} /></button>
            </div>
            {selectedMember.bio && <div className="tai-body-text tai-mt12">{selectedMember.bio}</div>}
            <div className="tai-row tai-gap8 tai-mt14">
              <StatPill label="Level" value={memberStats[selectedMember.id]?.current_level ?? "N/A"} />
              <StatPill label="Streak" value={memberStats[selectedMember.id]?.streak_days ? `${memberStats[selectedMember.id].streak_days}d` : "N/A"} />
              <StatPill label="Points" value={memberStats[selectedMember.id]?.total_points ?? "N/A"} />
            </div>
            {selectedMember.department && (
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 12 }}>Department: {selectedMember.department}</div>
            )}
            {selectedMember.last_active_at && (
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 4 }}>Last active {timeAgo(selectedMember.last_active_at)}</div>
            )}
            <div className="tai-col tai-gap8 tai-mt16">
              {selectedMember.role === "mentor" ? (
                <button className="tai-btn tai-btn-primary" style={{ width: "100%" }} onClick={() => {
                  const name = selectedMember.display_name || selectedMember.name || "Learner";
                  setSelectedMember(null);
                  if (push) push("messages", { recipientId: selectedMember.id, recipientName: name });
                  else if (goTab) goTab("messages");
                  showToast(`Opening chat with ${name}...`);
                }}>
                  <MessageCircle size={14} /> Message {selectedMember.display_name?.split(" ")[0] || "Learner"}
                </button>
              ) : (
                // Messaging is restricted to instructors - see the note by
                // the directory list above. A fellow learner's profile is
                // still viewable (level/streak/points), just not messageable
                // directly from here.
                <div style={{ fontSize: 11.5, color: "var(--text-3)", textAlign: "center", padding: "6px 0" }}>
                  Direct messaging is available with instructors.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
