import React, { useState, useContext } from "react";
import { TopBar, Tag, ToastContext } from "../components/PlatformUI.jsx";
import {
  MessagesSquare, Search, Heart, MessageCircle, Pin, Trash2, Send, AlertTriangle
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchCommunityPosts, addPostComment, togglePostReaction, deleteCommunityPost,
} from "../../lib/api/schemaHelper.js";
import { supabase } from "../../lib/supabaseClient.js";

// Instructor-facing view of the learner community feed. Reuses the exact
// same community_posts/post_comments/post_reactions data the learner-side
// CommunityScreen shows - there's no separate "instructor feed" table.
//
// Honest scope note, confirmed against the schema before building this:
// community_posts has no organization_id or course_id column at all - per
// 0153_remaining_wide_open_policies.sql's own audit note, it's a genuinely
// platform-wide feed by original design, the same as it is everywhere else
// in this app (the learner Community screen isn't org-scoped either). So
// this screen shows the same platform-wide feed, not just "this
// instructor's org's learners" - flagging that plainly rather than
// pretending it's isolated when the schema doesn't support that yet. If
// per-organization isolation is required here, that needs a real schema
// change (an organization_id column + backfill + new RLS), not a client-
// side filter.
//
// Pin/delete require can_moderate_content(auth.uid()) = true server-side
// (set_post_pinned RPC, and the cp_delete_own_or_moderator RLS policy
// added in 0162_community_posts_moderator_delete.sql alongside this
// screen). If that migration hasn't been applied to the live database yet,
// pin/delete will fail with a permission error from Supabase - this screen
// surfaces that via a toast rather than pretending it succeeded.
export function LearnerFeedScreen({ mentorId, orgSelector }) {
  const showToast = useContext(ToastContext);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState("all"); // "all" | "pinned"
  const [expandedId, setExpandedId] = useState(null);
  const [replyTexts, setReplyTexts] = useState({});
  const [submittingReply, setSubmittingReply] = useState(null);
  const [busyPostId, setBusyPostId] = useState(null);

  const postsQuery = useSupabaseQuery(async () => fetchCommunityPosts(), []);
  const rawPosts = postsQuery.data || [];

  const posts = rawPosts.map((p) => ({
    ...p,
    likeCount: (p.post_reactions || []).filter((r) => r.reaction_type === "like").length,
    userLiked: mentorId ? (p.post_reactions || []).some((r) => r.reaction_type === "like" && r.user_id === mentorId) : false,
    commentCount: (p.post_comments || []).length,
  }));

  const pinnedCount = posts.filter((p) => p.is_pinned).length;
  const studyGroupCount = posts.filter((p) => p.study_group_id != null).length;

  const filteredPosts = posts.filter((p) => {
    const matchesSearch =
      searchQuery === "" ||
      (p.content || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.user_profiles?.display_name || "").toLowerCase().includes(searchQuery.toLowerCase());
    if (filterTab === "pinned") return matchesSearch && p.is_pinned;
    if (filterTab === "study_groups") return matchesSearch && p.study_group_id != null;
    return matchesSearch;
  });

  async function handleToggleLike(postId) {
    if (!mentorId) return;
    try {
      await togglePostReaction({ postId, userId: mentorId, reactionType: "like" });
      postsQuery.refetch();
    } catch (err) {
      showToast?.(err?.message || "Failed to update reaction.");
    }
  }

  async function handleAddComment(postId) {
    const content = (replyTexts[postId] || "").trim();
    if (!content || !mentorId) return;
    setSubmittingReply(postId);
    try {
      await addPostComment({ postId, userId: mentorId, content });
      setReplyTexts((prev) => ({ ...prev, [postId]: "" }));
      await postsQuery.refetch();
    } catch (err) {
      showToast?.(err?.message || "Failed to post comment.");
    } finally {
      setSubmittingReply(null);
    }
  }

  async function handleTogglePin(postId, nextPinned) {
    setBusyPostId(postId);
    try {
      if (!supabase) throw new Error("Not connected.");
      const { error } = await supabase.rpc("set_post_pinned", { p_post_id: postId, p_pinned: nextPinned });
      if (error) throw error;
      showToast?.(nextPinned ? "Post pinned." : "Post unpinned.");
      await postsQuery.refetch();
    } catch (err) {
      showToast?.(err?.message || "Not authorized to pin posts - this account may not have moderator permissions yet.");
    } finally {
      setBusyPostId(null);
    }
  }

  async function handleDelete(postId) {
    if (!window.confirm("Delete this post? This can't be undone.")) return;
    setBusyPostId(postId);
    try {
      await deleteCommunityPost(postId);
      showToast?.("Post deleted.");
      await postsQuery.refetch();
    } catch (err) {
      showToast?.(err?.message || "Not authorized to delete this post - this account may not have moderator permissions yet.");
    } finally {
      setBusyPostId(null);
    }
  }

  return (
    <div className="ta-fade">
      <TopBar
        title="Learner Feed" sub="View and manage posts from the learner community"
        orgSelector={orgSelector}
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="ta-hero-banner anim-fluid-entrance">
          <div className="tai-glow-amber" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">Learner Feed</h1>
              <p className="ta-hero-desc">
                See what learners are posting, join the conversation, and keep the feed on track.
              </p>
            </div>
            <div className="ta-hero-actions" style={{ flexWrap: "wrap", gap: 8 }}>
              <div className="tai-hero-subcard" style={{ padding: "8px 14px", borderRadius: 8, backdropFilter: "blur(8px)", textAlign: "center" }}>
                <div style={{ fontSize: 10.5, opacity: 0.8, fontWeight: 700 }}>Posts</div>
                <div style={{ fontSize: 15, fontWeight: 900 }}>{posts.length}</div>
              </div>
              <div className="tai-hero-subcard" style={{ padding: "8px 14px", borderRadius: 8, backdropFilter: "blur(8px)", textAlign: "center" }}>
                <div style={{ fontSize: 10.5, opacity: 0.8, fontWeight: 700 }}>Pinned</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#FBBF24" }}>{pinnedCount}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="ta-card" style={{ padding: "10px 14px", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <div className="ta-row ta-gap8" style={{ alignItems: "flex-start" }}>
            <AlertTriangle size={14} color="var(--text-3)" style={{ marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.4 }}>
              This feed is platform-wide (community posts aren't tied to a single organization in this app yet), so
              it shows the same posts every instructor and learner sees elsewhere in Community.
            </span>
          </div>
        </div>

        <div className="ta-card" style={{ padding: "14px 18px", background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", maxWidth: "100%", paddingBottom: 2 }}>
              {[
                { key: "all", label: `All Posts (${posts.length})` },
                { key: "pinned", label: `Pinned (${pinnedCount})` },
                { key: "study_groups", label: `Study Groups (${studyGroupCount})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  className={`ta-pill ${filterTab === tab.key ? "active" : ""}`}
                  onClick={() => setFilterTab(tab.key)}
                  style={{ padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none" }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="ta-row ta-gap8" style={{ flex: "1 1 240px", maxWidth: 360, minWidth: 200 }}>
              <div className="ta-search" style={{ width: "100%" }}>
                <Search size={14} color="var(--text-3)" />
                <input
                  type="text"
                  placeholder="Search posts by content or learner..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="ta-col ta-gap14 anim-stagger">
          {postsQuery.loading && <div className="ta-empty">Loading learner posts...</div>}
          {!postsQuery.loading && filteredPosts.length === 0 && (
            <div className="ta-card" style={{ textAlign: "center", padding: 36 }}>
              <MessagesSquare size={32} color="var(--primary)" style={{ opacity: 0.5, marginBottom: 8 }} />
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>No posts to show</div>
              <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 4 }}>
                {filterTab === "pinned" ? "Nothing is pinned right now." : "Nothing in the learner feed yet."}
              </div>
            </div>
          )}

          {!postsQuery.loading && filteredPosts.map((p) => {
            const isExpanded = expandedId === p.id;
            const isBusy = busyPostId === p.id;
            return (
              <div key={p.id} className="ta-card" style={{ padding: 18 }}>
                <div className="ta-row ta-between" style={{ alignItems: "flex-start", gap: 10 }}>
                  <div className="ta-row ta-gap10" style={{ alignItems: "center" }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%", background: "var(--primary-tint)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 800, color: "var(--primary)", flexShrink: 0,
                    }}>
                      {(p.user_profiles?.display_name || "L").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text)" }}>
                        {p.user_profiles?.display_name || "Learner"}
                        {p.is_pinned && (
                          <span style={{ marginLeft: 8, display: "inline-block" }}>
                            <Tag tone="warning" icon={Pin}>Pinned</Tag>
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                        {p.created_at ? new Date(p.created_at).toLocaleString() : ""}
                        {p.moderation_status && p.moderation_status !== "approved" && (
                          <span style={{ marginLeft: 8, color: "var(--warning, #F59E0B)", fontWeight: 700 }}>
                            {p.moderation_status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="ta-row ta-gap6">
                    <button
                      className="ta-btn ta-btn-outline"
                      disabled={isBusy}
                      onClick={() => handleTogglePin(p.id, !p.is_pinned)}
                      title={p.is_pinned ? "Unpin" : "Pin"}
                      style={{ height: 30, width: 30, padding: 0, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <Pin size={14} color={p.is_pinned ? "#FBBF24" : "var(--text-3)"} />
                    </button>
                    <button
                      className="ta-btn ta-btn-outline"
                      disabled={isBusy}
                      onClick={() => handleDelete(p.id)}
                      title="Delete post"
                      style={{ height: 30, width: 30, padding: 0, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <Trash2 size={14} color="var(--danger, #DC2626)" />
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.5, marginTop: 12, whiteSpace: "pre-wrap" }}>
                  {p.content}
                </div>

                <div className="ta-row ta-gap14" style={{ marginTop: 12, fontSize: 12, color: "var(--text-3)" }}>
                  <button
                    onClick={() => handleToggleLike(p.id)}
                    className="ta-row ta-gap6"
                    style={{ background: "none", border: "none", cursor: "pointer", color: p.userLiked ? "var(--danger, #DC2626)" : "var(--text-3)", padding: 0, fontSize: 12 }}
                  >
                    <Heart size={14} fill={p.userLiked ? "currentColor" : "none"} /> {p.likeCount}
                  </button>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                    className="ta-row ta-gap6"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 0, fontSize: 12 }}
                  >
                    <MessageCircle size={14} /> {p.commentCount}
                  </button>
                </div>

                {isExpanded && (
                  <div className="tai-col tai-gap8" style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                    {(p.post_comments || []).map((c) => (
                      <div key={c.id} style={{ background: "var(--surface-3)", padding: "10px 14px", borderRadius: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                          <span style={{ fontWeight: 800, fontSize: 12.5, color: "var(--text)" }}>{c.user_profiles?.display_name || "Learner"}:</span>
                          <span style={{ fontSize: 11, color: "var(--text-3)" }}>{c.created_at ? new Date(c.created_at).toLocaleDateString() : ""}</span>
                        </div>
                        <span style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.45 }}>{c.content}</span>
                      </div>
                    ))}

                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <input
                        type="text"
                        placeholder="Reply as instructor..."
                        value={replyTexts[p.id] || ""}
                        onChange={(e) => setReplyTexts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && (replyTexts[p.id] || "").trim()) {
                            e.preventDefault();
                            handleAddComment(p.id);
                          }
                        }}
                        style={{
                          flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)",
                          background: "var(--surface-2)", color: "var(--text)", fontSize: 12.5, outline: "none",
                        }}
                      />
                      <button
                        className="ta-btn"
                        disabled={submittingReply === p.id || !(replyTexts[p.id] || "").trim()}
                        onClick={() => handleAddComment(p.id)}
                        style={{ height: 34, width: 34, padding: 0, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default LearnerFeedScreen;
