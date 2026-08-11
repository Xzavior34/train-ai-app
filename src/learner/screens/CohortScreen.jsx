import React, { useState } from "react";
import { TopBar, Avatar, Tag, timeAgo, initialsOf } from "../components/LearnerUI.jsx";
import { PlusCircle, Heart, MessageCircle, Send, FileText, Link2, Video, Calendar, ExternalLink } from "lucide-react";

// Dedicated learner-facing cohort space - reached from the Home screen's
// cohort card (and from Community's "Cohort Channels" teaser). Surfaces the
// three things a cohort member actually needs day to day: a live join link
// for the next scheduled session, the resources an admin has shared, and the
// cohort's own chat/announcement feed. Resources and Sessions read the real
// `cohort_resources` / `cohort_sessions` tables an admin already writes to
// from CohortDetailScreen.jsx (fetchCohortResources / fetchCohortSessions in
// lib/api/schemaHelper.js) - until this screen existed, nothing on the
// learner side ever read those two tables at all, even though an admin could
// already add resources and schedule sessions for a cohort.
export function CohortScreen({
  cohort, cohortMembershipQuery, cohortPostsQuery, cohortResourcesQuery, cohortSessionsQuery,
  cohortCoursesQuery, cohortMembersQuery,
  session, showToast = () => {}, back,
}) {
  const [tab, setTab] = useState("chat"); // "chat" | "resources" | "sessions"
  const [postText, setPostText] = useState("");
  const [posting, setPosting] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [replyText, setReplyText] = useState("");

  const posts = cohortPostsQuery?.data || [];
  const resources = cohortResourcesQuery?.data || [];
  const sessions = cohortSessionsQuery?.data || [];
  const now = Date.now();
  const upcomingSessions = sessions.filter(s => new Date(s.starts_at).getTime() >= now);
  const pastSessions = sessions.filter(s => new Date(s.starts_at).getTime() < now);
  const instructorMembers = (cohortMembersQuery?.data || []).filter(
    m => m.user_profiles?.role === "mentor" || m.user_profiles?.role === "admin"
  );

  if (cohortMembershipQuery?.loading && !cohort) {
    return (
      <div>
        <TopBar title="Cohort" onBack={back} />
        <div className="tai-empty">Loading your cohort...</div>
      </div>
    );
  }

  if (!cohort) {
    return (
      <div>
        <TopBar title="Cohort" onBack={back} />
        <div className="tai-empty">You're not part of a cohort yet. Once an admin adds you to one, its resources, sessions, and chat will show up here.</div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title={cohort.name} sub={cohort.description || "Your cohort space"} onBack={back} />

      <div className="tai-row tai-gap8 tai-mt10">
        {[
          { k: "chat", label: "Chat" },
          { k: "courses", label: "Courses" },
          { k: "resources", label: "Resources" },
          { k: "sessions", label: "Sessions" },
          { k: "members", label: "Instructor" },
        ].map(t => (
          <div
            key={t.k}
            className={`tai-pill ${tab === t.k ? "tai-pill-active" : "tai-pill-inactive"}`}
            onClick={() => setTab(t.k)}
          >
            {t.label}
          </div>
        ))}
      </div>

      {tab === "chat" && (
        <div className="tai-col tai-gap12 tai-mt16">
          {/* No compose box here - confirmed directly, correcting an
              earlier, too-narrow reading of the messaging restriction:
              "learners should not message learners at all, only
              instructors" means no learner-to-learner communication of any
              kind, including posting into a shared cohort channel other
              learners would see. This screen is only ever viewed by
              learners (instructors post cohort updates through
              CohortDetailScreen.jsx in the admin/instructor app instead,
              already a separate, real code path) - learners can read every
              update here, they just can't post one. Enforced at the
              database level too (0126_no_learner_to_learner_messaging.sql),
              not just by removing this UI. */}
          {cohortPostsQuery?.loading && <div className="tai-empty">Loading cohort chat...</div>}
          {!cohortPostsQuery?.loading && posts.length === 0 && (
            <div className="tai-empty">No posts in your cohort chat yet.</div>
          )}
          {posts.map(cp => (
            <div key={cp.id} className="tai-card">
              <div className="tai-row tai-between">
                <div className="tai-row tai-gap10">
                  <Avatar initials={initialsOf(cp.user_profiles?.display_name)} size={34} src={cp.user_profiles?.avatar_url} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{cp.user_profiles?.display_name || "Cohort Peer"}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>{timeAgo(cp.created_at)}</div>
                  </div>
                </div>
                {cp.is_announcement && <Tag tone="warning">Announcement</Tag>}
              </div>
              <div className="tai-body-text tai-mt10">{cp.content}</div>

              <div className="tai-row tai-gap16 tai-mt12" style={{ fontSize: 12, color: "var(--text-2)" }}>
                <button
                  className="tai-row tai-gap4"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-2)" }}
                  onClick={async () => {
                    if (!session?.user?.id || !toggleCohortPostReaction) return;
                    await toggleCohortPostReaction(cp.id, session.user.id, "like");
                    cohortPostsQuery?.refetch?.();
                  }}
                >
                  <Heart size={14} /> {cp.reaction_count || 0}
                </button>
                <button
                  className="tai-row tai-gap4"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-2)" }}
                  onClick={() => setExpandedPostId(expandedPostId === cp.id ? null : cp.id)}
                >
                  <MessageCircle size={14} /> {(cp.cohort_post_replies || []).length} replies
                </button>
              </div>

              {expandedPostId === cp.id && (
                <div className="tai-mt12" style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                  <div className="tai-col tai-gap8 tai-mt8">
                    {(cp.cohort_post_replies || []).length === 0 && (
                      <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>No replies yet.</div>
                    )}
                    {(cp.cohort_post_replies || []).map(rep => (
                      <div key={rep.id} style={{ fontSize: 12.5 }}>
                        <strong>{rep.user_profiles?.display_name || "Instructor"}:</strong> {rep.content}
                      </div>
                    ))}
                  </div>
                  {/* No reply composer here - same restriction as the main
                      compose box above: a learner's reply would be visible
                      to every other learner in the cohort, which is exactly
                      the learner-to-learner communication this was
                      corrected to remove entirely, not just narrow. */}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "courses" && (
        <div className="tai-col tai-gap10 tai-mt16">
          {cohortCoursesQuery?.loading && <div className="tai-empty">Loading assigned courses...</div>}
          {!cohortCoursesQuery?.loading && (cohortCoursesQuery?.data || []).length === 0 && (
            <div className="tai-empty">No courses assigned to your cohort yet.</div>
          )}
          {(cohortCoursesQuery?.data || []).map(cc => (
            <div key={cc.id} className="tai-card">
              <div style={{ fontWeight: 700, fontSize: 14 }}>{cc.courses?.title || "Untitled course"}</div>
              {cc.courses?.description && <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>{cc.courses.description}</div>}
              {cc.due_at && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>Due {new Date(cc.due_at).toLocaleDateString()}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === "resources" && (
        <div className="tai-col tai-gap10 tai-mt16">
          {cohortResourcesQuery?.loading && <div className="tai-empty">Loading resources...</div>}
          {!cohortResourcesQuery?.loading && resources.length === 0 && (
            <div className="tai-empty">No resources shared with your cohort yet.</div>
          )}
          {resources.map(r => (
            <div key={r.id} className="tai-card">
              <div className="tai-row tai-gap10">
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {r.resource_type === "link" ? <Link2 size={16} color="var(--primary)" /> : <FileText size={16} color="var(--primary)" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{r.title}</div>
                  {r.description && <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>{r.description}</div>}
                </div>
                {(r.file_url || r.external_url) && (
                  <a href={r.file_url || r.external_url} target="_blank" rel="noreferrer" className="tai-iconbtn" aria-label="Open resource">
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "sessions" && (
        <div className="tai-col tai-gap16 tai-mt16">
          {cohortSessionsQuery?.loading && <div className="tai-empty">Loading sessions...</div>}
          {!cohortSessionsQuery?.loading && sessions.length === 0 && (
            <div className="tai-empty">No live sessions scheduled for your cohort yet.</div>
          )}
          {upcomingSessions.length > 0 && (
            <div>
              <div className="tai-label tai-mt8">Upcoming</div>
              <div className="tai-col tai-gap10 tai-mt8">
                {upcomingSessions.map(s => (
                  <div key={s.id} className="tai-card">
                    <div className="tai-row tai-gap10">
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Calendar size={16} color="var(--primary)" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{s.title}</div>
                        <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                          {new Date(s.starts_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </div>
                      </div>
                      {s.join_url && (
                        <a href={s.join_url} target="_blank" rel="noreferrer" className="tai-btn tai-btn-primary tai-btn-sm">
                          <Video size={13} /> Join
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {pastSessions.length > 0 && (
            <div>
              <div className="tai-label tai-mt8">Past</div>
              <div className="tai-col tai-gap10 tai-mt8">
                {pastSessions.map(s => (
                  <div key={s.id} className="tai-card" style={{ opacity: 0.85 }}>
                    <div className="tai-row tai-between">
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{s.title}</div>
                        <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                          {new Date(s.starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </div>
                      </div>
                      {s.recording_url && (
                        <a href={s.recording_url} target="_blank" rel="noreferrer" className="tai-link">Recording</a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "members" && (
        <div className="tai-col tai-gap8 tai-mt16">
          {/* Shows only the instructor, not fellow learners - confirmed
              directly, repeated instruction: no learner-to-learner
              visibility of any kind in Community, not just no messaging.
              The underlying cohort_members data still includes every
              learner (needed for real membership/attendance tracking
              elsewhere), but this specific view filters to instructor-role
              members only before ever rendering anything. */}
          {cohortMembersQuery?.loading && <div className="tai-empty">Loading instructor...</div>}
          {!cohortMembersQuery?.loading && instructorMembers.length === 0 && (
            <div className="tai-empty">No instructor assigned to this cohort yet.</div>
          )}
          {instructorMembers.map(m => (
            <div key={m.id} className="tai-card tai-row tai-gap10" style={{ alignItems: "center" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {(m.user_profiles?.display_name || "U").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{m.user_profiles?.display_name || "Unnamed"}</div>
                <div style={{ fontSize: 11, color: "var(--text-2)", textTransform: "capitalize" }}>Instructor</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
