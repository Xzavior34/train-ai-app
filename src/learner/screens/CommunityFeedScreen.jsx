import React, { useState } from "react";
import { TopBar, Avatar, Tag, timeAgo, initialsOf } from "../components/LearnerUI.jsx";
import {
  MessageSquare, Heart, Send, Search, Filter, Sparkles, MessageCircle,
  Share2, MoreVertical, Plus, CheckCircle2, User, Flame, BookOpen, Users, ArrowLeft
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchCommunityPosts, createCommunityPost, togglePostReaction,
  addPostComment, deleteCommunityPost
} from "../../lib/api/schemaHelper.js";

const FEED_TAGS = [
  "All",
  "General",
  "AI & ML",
  "Web Development",
  "Projects",
  "Questions",
  "Announcements",
  "Study Lounge"
];

export function CommunityFeedScreen({
  session,
  userProfile,
  showToast = () => {},
  back,
  push,
  goTab
}) {
  const [selectedTag, setSelectedTag] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [newPostText, setNewPostText] = useState("");
  const [newPostTag, setNewPostTag] = useState("General");
  const [submittingPost, setSubmittingPost] = useState(false);
  const [expandedCommentsPostId, setExpandedCommentsPostId] = useState(null);
  const [commentInputs, setCommentInputs] = useState({});
  const [submittingComment, setSubmittingComment] = useState(false);

  // Live posts query
  const postsQuery = useSupabaseQuery(async () => {
    return fetchCommunityPosts();
  }, []);

  const posts = postsQuery.data || [];

  // Filtered posts
  const filteredPosts = posts.filter(post => {
    const matchesTag = selectedTag === "All" || (post.category || post.tags?.[0] || "General").toLowerCase() === selectedTag.toLowerCase();
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query ||
      (post.content || post.body || "").toLowerCase().includes(query) ||
      (post.title || "").toLowerCase().includes(query) ||
      (post.author?.full_name || post.user_profiles?.full_name || "").toLowerCase().includes(query);
    return matchesTag && matchesSearch;
  });

  const handleCreatePost = async (e) => {
    e?.preventDefault();
    if (!newPostText.trim()) {
      showToast("Please enter some content for your post", "warning");
      return;
    }
    if (!session?.user?.id) {
      showToast("Please sign in to create a post", "error");
      return;
    }

    setSubmittingPost(true);
    try {
      await createCommunityPost({
        userId: session.user.id,
        content: newPostText.trim(),
        category: newPostTag,
        tags: [newPostTag]
      });
      setNewPostText("");
      setComposerOpen(false);
      showToast("Post shared with the community!", "success");
      postsQuery.refetch();
    } catch (err) {
      console.error("Failed to create post:", err);
      showToast(err.message || "Failed to publish post", "error");
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleToggleLike = async (postId) => {
    if (!session?.user?.id) {
      showToast("Please sign in to like posts", "warning");
      return;
    }
    try {
      await togglePostReaction(postId, session.user.id);
      postsQuery.refetch();
    } catch (err) {
      console.error("Failed to toggle reaction:", err);
    }
  };

  const handleAddComment = async (postId) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    if (!session?.user?.id) {
      showToast("Please sign in to reply", "warning");
      return;
    }

    setSubmittingComment(true);
    try {
      await addPostComment(postId, session.user.id, text);
      setCommentInputs(prev => ({ ...prev, [postId]: "" }));
      showToast("Comment added", "success");
      postsQuery.refetch();
    } catch (err) {
      console.error("Failed to add comment:", err);
      showToast("Failed to post comment", "error");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleAuthorClick = (authorId) => {
    if (!authorId) return;
    if (push) {
      push("mentors", { mentorId: authorId });
    }
  };

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <TopBar title="Community Feed" sub="Real-time discussions, questions, and insights" onBack={back} />

      {/* =========================================================================
          HERO BANNER: Matching platform fluid entrance design language
          ========================================================================= */}
      <div
        className="tai-card tai-hero-card anim-fluid-entrance"
        style={{
          borderRadius: 14,
          padding: "clamp(18px, 2.5vw, 24px)",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 180,
            height: 180,
            background: "radial-gradient(circle, rgba(37, 99, 235, 0.2) 0%, transparent 70%)",
            borderRadius: "50%",
            pointerEvents: "none"
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, position: "relative", zIndex: 1 }}>
          <div style={{ maxWidth: 560 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "var(--primary-tint)", border: "1px solid var(--border)", fontSize: 11, fontWeight: 700, color: "var(--primary)", marginBottom: 10 }}>
              <Flame size={13} />
              <span>LIVE COMMUNITY FEED</span>
            </div>
            <h1 className="tai-hero-title" style={{ margin: 0, fontSize: "clamp(20px, 2.4vw, 26px)", fontWeight: 800, color: "var(--text)", lineHeight: 1.25 }}>
              Connect, Learn & Share with Peers
            </h1>
            <p className="tai-hero-desc" style={{ margin: "8px 0 0 0", fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>
              Ask questions, showcase your projects, discuss AI developments, and engage with verified instructors and peers.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              className="tai-btn tai-btn-primary"
              onClick={() => setComposerOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 18px",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 13
              }}
            >
              <Plus size={16} />
              <span>Create Post</span>
            </button>
            <button
              type="button"
              className="tai-btn tai-btn-outline"
              onClick={() => push ? push("mentors") : goTab?.("community")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                borderRadius: 10,
                fontWeight: 600,
                fontSize: 13
              }}
            >
              <Users size={16} />
              <span>Instructors</span>
            </button>
          </div>
        </div>

        {/* Community Stat Pills */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-2)" }}>
            <MessageCircle size={14} color="var(--primary)" />
            <strong style={{ color: "var(--text)" }}>{posts.length}</strong> Total Posts
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-2)" }}>
            <Sparkles size={14} color="var(--primary)" />
            <strong style={{ color: "var(--text)" }}>Verified</strong> Instructors Active
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-2)" }}>
            <CheckCircle2 size={14} color="var(--success, #10b981)" />
            <strong style={{ color: "var(--text)" }}>Real-time</strong> Synced
          </div>
        </div>
      </div>

      {/* =========================================================================
          COMPOSER DRAWER / CARD
          ========================================================================= */}
      {composerOpen && (
        <div className="tai-card" style={{ padding: 20, borderRadius: 14, border: "1px solid var(--primary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar
                src={userProfile?.avatar_url || session?.user?.user_metadata?.avatar_url}
                name={userProfile?.full_name || session?.user?.email || "You"}
                size={36}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>
                  {userProfile?.full_name || session?.user?.email || "Share an Update"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                  Posting publicly to Community Feed
                </div>
              </div>
            </div>
            <button
              type="button"
              className="tai-btn tai-btn-ghost"
              onClick={() => setComposerOpen(false)}
              style={{ fontSize: 12, padding: "4px 8px" }}
            >
              Cancel
            </button>
          </div>

          <textarea
            value={newPostText}
            onChange={(e) => setNewPostText(e.target.value)}
            placeholder="What would you like to discuss or share with the community today?"
            rows={4}
            className="tai-input"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: 12,
              borderRadius: 10,
              fontSize: 14,
              fontFamily: "inherit",
              resize: "vertical",
              color: "var(--text)",
              background: "var(--surface-2)"
            }}
          />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>Category:</span>
              <select
                value={newPostTag}
                onChange={(e) => setNewPostTag(e.target.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontSize: 12
                }}
              >
                {FEED_TAGS.filter(t => t !== "All").map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="tai-btn tai-btn-primary"
              onClick={handleCreatePost}
              disabled={submittingPost || !newPostText.trim()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 18px",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 13
              }}
            >
              <Send size={14} />
              <span>{submittingPost ? "Publishing..." : "Publish Post"}</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          FILTERS & SEARCH BAR
          ========================================================================= */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 240, position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
            <input
              type="text"
              className="tai-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts, topics, or authors..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "9px 12px 9px 36px",
                borderRadius: 10,
                background: "var(--surface)",
                border: "1.5px solid var(--border)",
                color: "var(--text)",
                fontSize: 13
              }}
            />
          </div>

          {!composerOpen && (
            <button
              type="button"
              className="tai-btn tai-btn-primary"
              onClick={() => setComposerOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 16px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600
              }}
            >
              <Plus size={15} />
              <span>New Post</span>
            </button>
          )}
        </div>

        {/* Tag pills */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
          {FEED_TAGS.map(tag => {
            const active = selectedTag === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(tag)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  background: active ? "var(--primary)" : "var(--surface)",
                  color: active ? "#ffffff" : "var(--text-2)",
                  border: active ? "1px solid var(--primary)" : "1px solid var(--border)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease"
                }}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          POSTS FEED
          ========================================================================= */}
      {postsQuery.loading && (
        <div className="tai-empty" style={{ padding: 40, color: "var(--text-3)" }}>
          Loading community discussions...
        </div>
      )}

      {!postsQuery.loading && filteredPosts.length === 0 && (
        <div className="tai-card" style={{ padding: 40, textAlign: "center", borderRadius: 14 }}>
          <MessageSquare size={40} color="var(--text-3)" style={{ margin: "0 auto 12px auto", opacity: 0.6 }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
            No posts found
          </h3>
          <p style={{ margin: "6px 0 16px 0", fontSize: 13, color: "var(--text-2)" }}>
            {searchQuery || selectedTag !== "All"
              ? "Try adjusting your search or category filter"
              : "Be the first one to start a conversation in the community!"}
          </p>
          <button
            type="button"
            className="tai-btn tai-btn-primary"
            onClick={() => setComposerOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Plus size={15} />
            <span>Create the First Post</span>
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {filteredPosts.map(post => {
          const authorName = post.user_profiles?.full_name || post.user_profiles?.display_name || post.author?.full_name || post.author?.display_name || "Community Member";
          const authorAvatar = post.user_profiles?.avatar_url || post.author?.avatar_url;
          const authorRole = post.user_profiles?.role || post.author?.role || "Learner";
          const isInstructor = authorRole === "mentor" || authorRole === "instructor" || authorRole === "admin";
          const authorId = post.user_id || post.author_id || post.user_profiles?.id;
          const isLiked = (post.reactions || []).some(r => r.user_id === session?.user?.id);
          const likeCount = (post.reactions || []).length || post.like_count || 0;
          const comments = post.comments || post.replies || [];
          const isExpanded = expandedCommentsPostId === post.id;

          return (
            <div
              key={post.id}
              className="tai-card anim-fluid-entrance"
              style={{
                padding: 20,
                borderRadius: 14,
                display: "flex",
                flexDirection: "column",
                gap: 14,
                background: "var(--surface)",
                border: isInstructor ? "1.5px solid var(--primary-light, rgba(37, 99, 235, 0.4))" : "1px solid var(--border)",
                boxShadow: "var(--shadow-card)"
              }}
            >
              {/* Post Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                  onClick={() => handleAuthorClick(authorId)}
                >
                  <Avatar src={authorAvatar} name={authorName} size={42} />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text)" }}>
                        {authorName}
                      </span>
                      {isInstructor && (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "2px 7px",
                          borderRadius: 4,
                          background: "var(--primary-tint)",
                          color: "var(--primary)",
                          border: "1px solid var(--border)"
                        }}>
                          INSTRUCTOR
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>
                      {timeAgo(post.created_at)} &bull; {post.category || post.tags?.[0] || "General"}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {post.category && (
                    <Tag tone={isInstructor ? "blue" : "gray"}>
                      {post.category}
                    </Tag>
                  )}
                </div>
              </div>

              {/* Post Title */}
              {post.title && (
                <div style={{ fontSize: 15.5, fontWeight: 800, color: "var(--text)", lineHeight: 1.3 }}>
                  {post.title}
                </div>
              )}

              {/* Post Content */}
              <div style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: "var(--text)",
                whiteSpace: "pre-wrap"
              }}>
                {post.content || post.body}
              </div>

              {/* Post Actions Bar */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                paddingTop: 12,
                borderTop: "1px solid var(--border)"
              }}>
                <button
                  type="button"
                  onClick={() => handleToggleLike(post.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "none",
                    border: "none",
                    color: isLiked ? "var(--danger, #ef4444)" : "var(--text-2)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: "4px 8px",
                    borderRadius: 6,
                    transition: "all 0.15s ease"
                  }}
                >
                  <Heart size={16} fill={isLiked ? "#ef4444" : "none"} color={isLiked ? "#ef4444" : "currentColor"} />
                  <span>{likeCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setExpandedCommentsPostId(isExpanded ? null : post.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "none",
                    border: "none",
                    color: isExpanded ? "var(--primary)" : "var(--text-2)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: "4px 8px",
                    borderRadius: 6
                  }}
                >
                  <MessageSquare size={16} />
                  <span>{comments.length} {comments.length === 1 ? "Comment" : "Comments"}</span>
                </button>
              </div>

              {/* Expanded Comments Section */}
              {isExpanded && (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  marginTop: 6,
                  padding: 14,
                  borderRadius: 10,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)"
                }}>
                  {/* Comments list */}
                  {comments.length > 0 ? (
                    comments.map(c => (
                      <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <Avatar
                          src={c.user_profiles?.avatar_url}
                          name={c.user_profiles?.full_name || c.user_profiles?.display_name || "Member"}
                          size={30}
                        />
                        <div style={{
                          flex: 1,
                          background: "var(--surface)",
                          padding: "10px 14px",
                          borderRadius: 10,
                          border: "1px solid var(--border)"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                            <span style={{ fontWeight: 800, fontSize: 12.5, color: "var(--text)" }}>
                              {c.user_profiles?.full_name || c.user_profiles?.display_name || "Member"}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                              {timeAgo(c.created_at)}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.45 }}>
                            {c.content || c.body}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 12.5, color: "var(--text-3)", textAlign: "center", padding: 8 }}>
                      No comments yet. Be the first to share your thoughts!
                    </div>
                  )}

                  {/* Add comment input */}
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <input
                      type="text"
                      className="tai-input"
                      placeholder="Write a comment..."
                      value={commentInputs[post.id] || ""}
                      onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddComment(post.id); }}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                        fontSize: 13
                      }}
                    />
                    <button
                      type="button"
                      className="tai-btn tai-btn-primary"
                      onClick={() => handleAddComment(post.id)}
                      disabled={submittingComment || !commentInputs[post.id]?.trim()}
                      style={{ padding: "8px 14px", borderRadius: 8 }}
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
  );
}

export default CommunityFeedScreen;
