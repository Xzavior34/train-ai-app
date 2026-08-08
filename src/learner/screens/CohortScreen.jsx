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
  createCohortPost, addCohortPostReply, toggleCohortPostReaction,
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
          { k: "resources", label: "Resources" },
          { k: "sessions", label: "Sessions" },
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
          <div className="tai-card">
            <textarea
              className="tai-input"
              rows={2}
              placeholder={`Post an update or question to ${cohort.name}...`}
              value={postText}
              onChange={e => setPostText(e.target.value)}
            />
            <button
              className="tai-btn tai-btn-primary tai-mt10"
              style={{ width: "100%" }}
              disabled={!postText.trim() || posting}
              onClick={async () => {
                if (!postText.trim() || !session?.user?.id || !createCohortPost) return;
                setPosting(true);
                try {
                  await createCohortPost({ cohortId: cohort.id, authorId: session.user.id, content: postText.trim() });
                  setPostText("");
                  cohortPostsQuery?.refetch?.();
                  showToast("Posted to cohort chat!");
                } catch (e) {
                  showToast(e?.message || "Couldn't post. Try again.");
                } finally {
                  setPosting(false);
                }
              }}
            >
              <PlusCircle size={15} /> Post to {cohort.name}
            </button>
          </div>

          {cohortPostsQuery?.loading && <div className="tai-empty">Loading cohort chat...</div>}
          {!cohortPostsQuery?.loading && posts.length === 0 && (
            <div className="tai-empty">No posts in your cohort chat yet. Start the conversation!</div>
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
                    {(cp.cohort_post_replies || []).map(rep => (
                      <div key={rep.id} style={{ fontSize: 12.5 }}>
                        <strong>{rep.user_profiles?.display_name || "Cohort Peer"}:</strong> {rep.content}
                      </div>
                    ))}
                  </div>
                  <div className="tai-row tai-gap8 tai-mt10">
                    <input
                      className="tai-input"
                      style={{ flex: 1, fontSize: 12.5, padding: "8px 12px" }}
                      placeholder="Reply to cohort post..."
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      onKeyDown={async e => {
                        if (e.key === "Enter" && replyText.trim() && session?.user?.id && addCohortPostReply) {
                          await addCohortPostReply({ postId: cp.id, authorId: session.user.id, content: replyText.trim() });
                          setReplyText("");
                          cohortPostsQuery?.refetch?.();
                          showToast("Reply added!");
                        }
                      }}
                    />
                    <button
                      className="tai-btn tai-btn-primary tai-btn-sm"
                      onClick={async () => {
                        if (!replyText.trim() || !session?.user?.id || !addCohortPostReply) return;
                        await addCohortPostReply({ postId: cp.id, authorId: session.user.id, content: replyText.trim() });
                        setReplyText("");
                        cohortPostsQuery?.refetch?.();
                        showToast("Reply added!");
                      }}
                    >
                      <Send size={13} />
                    </button>
                  </div>
                </div>
              )}
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
    </div>
  );
}
