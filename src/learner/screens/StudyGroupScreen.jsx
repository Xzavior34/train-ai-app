import React, { useState, useMemo } from "react";
import { TopBar, Avatar, Tag, initialsOf, timeAgo } from "../components/LearnerUI.jsx";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  Users, Plus, ChevronRight, MessageSquare, X, Check, Lock, BookOpen,
  Heart, MessageCircle, Send, Trash2, ShieldCheck, Sparkles, Clock,
  Search, ArrowLeft, Info, HelpCircle
} from "lucide-react";

// ============================================================================
// Train AI 2.0 Study Group Screen
// Matched 1:1 against Train AI 1.0 (StudyGroupCard.tsx & StudyGroupPage.tsx)
//
// Features:
// 1. Group Cards: Lock icon for private groups, Course badge for linked courses,
//    X/max_members capacity, created_at relative time, description.
// 2. Group Detail:
//    - Tab 1: Posts (Group-scoped community posts with composer, likes, comments, delete)
//    - Tab 2: Overview & Instructor Updates (Read-only instructor announcements)
//    - Tab 3: Members (Roster with roles and avatars)
// 3. Access Control: Deliberately preserves 0126_no_learner_to_learner_messaging.sql;
//    study_group_messages remains instructor-only updates.
// ============================================================================

export function StudyGroupScreen({
  studyGroupsQuery = {},
  myGroupIdsQuery = {},
  joinStudyGroup,
  leaveStudyGroup,
  createStudyGroup,
  fetchStudyGroupMembers,
  fetchStudyGroupMessages,
  fetchCommunityPosts,
  createCommunityPost,
  addPostComment,
  togglePostReaction,
  deleteCommunityPost,
  orgId,
  session,
  showToast = () => {},
  back,
  push,
  params = {},
}) {
  const [selectedGroupId, setSelectedGroupId] = useState(params?.groupId || null);
  const [activeTab, setActiveTab] = useState("posts"); // 'posts' | 'overview' | 'members'
  const [creating, setCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Post composer state in Group Detail
  const [newPostContent, setNewPostContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [expandedComments, setExpandedComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [commentBusy, setCommentBusy] = useState({});

  const groups = studyGroupsQuery.data || [];
  const myGroupIds = new Set(myGroupIdsQuery.data || []);
  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null;

  // -------------------------------------------------------------------
  // Detail Queries
  // -------------------------------------------------------------------
  const membersQuery = useSupabaseQuery(
    () => (selectedGroupId && fetchStudyGroupMembers ? fetchStudyGroupMembers(selectedGroupId) : Promise.resolve([])),
    [selectedGroupId]
  );

  const messagesQuery = useSupabaseQuery(
    () => (selectedGroupId && fetchStudyGroupMessages ? fetchStudyGroupMessages(selectedGroupId) : Promise.resolve([])),
    [selectedGroupId]
  );

  const groupPostsQuery = useSupabaseQuery(
    () => (selectedGroupId && fetchCommunityPosts ? fetchCommunityPosts(selectedGroupId) : Promise.resolve([])),
    [selectedGroupId]
  );

  // -------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------
  async function handleJoin(groupId) {
    try {
      await joinStudyGroup?.({ studyGroupId: groupId, userId: session?.user?.id });
      showToast?.("Joined study group!");
      myGroupIdsQuery.refetch?.();
      studyGroupsQuery.refetch?.();
      if (selectedGroupId === groupId) {
        membersQuery.refetch?.();
      }
    } catch (err) {
      showToast?.(err?.message || "Could not join group");
    }
  }

  async function handleLeave(groupId) {
    try {
      await leaveStudyGroup?.({ studyGroupId: groupId, userId: session?.user?.id });
      showToast?.("Left study group.");
      myGroupIdsQuery.refetch?.();
      studyGroupsQuery.refetch?.();
      if (selectedGroupId === groupId) {
        membersQuery.refetch?.();
      }
    } catch (err) {
      showToast?.(err?.message || "Could not leave group");
    }
  }

  async function handleCreate() {
    if (!newGroupName.trim()) {
      showToast?.("Give your study group a name.");
      return;
    }
    setSaving(true);
    try {
      const group = await createStudyGroup?.({
        organizationId: orgId,
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        createdBy: session?.user?.id,
      });
      showToast?.("Study group created!");
      setNewGroupName("");
      setNewGroupDesc("");
      setCreating(false);
      studyGroupsQuery.refetch?.();
      myGroupIdsQuery.refetch?.();
      if (group?.id) setSelectedGroupId(group.id);
    } catch (err) {
      showToast?.(err?.message || "Could not create group");
    } finally {
      setSaving(false);
    }
  }

  // Group Post Creation
  async function handleCreatePost() {
    if (!newPostContent.trim() || !session?.user?.id || !selectedGroupId) return;
    setPosting(true);
    try {
      await createCommunityPost?.({
        userId: session.user.id,
        content: newPostContent.trim(),
        postType: "general",
        studyGroupId: selectedGroupId,
      });
      setNewPostContent("");
      groupPostsQuery.refetch?.();
      showToast?.("Post shared to study group!");
    } catch (err) {
      showToast?.(err?.message || "Could not publish post");
    } finally {
      setPosting(false);
    }
  }

  // Toggle Post Like
  async function handleToggleReaction(postId) {
    if (!session?.user?.id || !postId) return;
    try {
      await togglePostReaction?.({ postId, userId: session.user.id, reactionType: "like" });
      groupPostsQuery.refetch?.();
    } catch (err) {
      console.warn("Could not toggle reaction:", err);
    }
  }

  // Toggle Comment Thread
  function toggleComments(postId) {
    setExpandedComments((prev) => ({ ...prev, [postId]: !prev[postId] }));
  }

  // Add Comment
  async function handleAddComment(postId) {
    const text = (commentInputs[postId] || "").trim();
    if (!text || !session?.user?.id || !postId) return;
    setCommentBusy((prev) => ({ ...prev, [postId]: true }));
    try {
      await addPostComment?.({ postId, userId: session.user.id, content: text });
      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
      groupPostsQuery.refetch?.();
      showToast?.("Comment posted!");
    } catch (err) {
      showToast?.(err?.message || "Could not post comment");
    } finally {
      setCommentBusy((prev) => ({ ...prev, [postId]: false }));
    }
  }

  // Delete Post
  async function handleDeletePost(postId) {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      await deleteCommunityPost?.(postId);
      groupPostsQuery.refetch?.();
      showToast?.("Post deleted.");
    } catch (err) {
      showToast?.(err?.message || "Could not delete post");
    }
  }

  // -------------------------------------------------------------------
  // Render: GROUP DETAIL VIEW
  // -------------------------------------------------------------------
  if (selectedGroup) {
    const members = membersQuery.data || [];
    const isMember = myGroupIds.has(selectedGroup.id);
    const maxMembers = selectedGroup.max_members || 50;
    const isFull = !isMember && members.length >= maxMembers;
    const posts = groupPostsQuery.data || [];
    const messages = messagesQuery.data || [];

    return (
      <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Top Header Card */}
        <div
          className="tai-card"
          style={{
            padding: "20px 22px",
            borderRadius: 16,
            background: "var(--glass-surface)",
            border: "1px solid var(--glass-border)",
            boxShadow: "var(--glass-shadow)",
          }}
        >
          <div className="tai-row tai-between" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
            <div style={{ flex: "1 1 320px", minWidth: 0 }}>
              <button
                className="tai-btn tai-btn-ghost tai-btn-sm"
                style={{ padding: "4px 8px", marginBottom: 8, display: "inline-flex", alignItems: "center", gap: 5, color: "var(--text-3)" }}
                onClick={() => setSelectedGroupId(null)}
              >
                <ArrowLeft size={14} /> Back to all groups
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                <h1 style={{ fontSize: 20, fontWeight: 900, color: "var(--text)", margin: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {selectedGroup.name}
                  {selectedGroup.is_private && (
                    <span title="Private Study Group" style={{ display: "inline-flex", alignItems: "center" }}>
                      <Lock size={16} color="var(--warning)" />
                    </span>
                  )}
                </h1>

                {selectedGroup.courses?.title && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 10px",
                      borderRadius: 999,
                      background: "rgba(37, 99, 235, 0.12)",
                      color: "var(--primary)",
                      border: "1px solid rgba(37, 99, 235, 0.25)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <BookOpen size={12} /> {selectedGroup.courses.title}
                  </span>
                )}

                {isMember && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: "3px 10px",
                      borderRadius: 999,
                      background: "rgba(16, 185, 129, 0.12)",
                      color: "var(--success)",
                      border: "1px solid rgba(16, 185, 129, 0.25)",
                    }}
                  >
                    Joined Member
                  </span>
                )}
              </div>

              <p style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.55, margin: "0 0 12px 0" }}>
                {selectedGroup.description || "Open study and peer discussion group."}
              </p>

              <div className="tai-row tai-gap14" style={{ fontSize: 12.5, color: "var(--text-3)", alignItems: "center" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Users size={13} color="var(--primary)" />
                  <strong>{members.length}/{maxMembers}</strong> members
                </span>
                {selectedGroup.created_at && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Clock size={13} />
                    Created {timeAgo(selectedGroup.created_at)}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {isMember ? (
                <button
                  className="tai-btn tai-btn-outline"
                  style={{ borderRadius: 999, padding: "8px 18px", color: "var(--danger)", borderColor: "rgba(239, 68, 68, 0.4)", fontSize: 13 }}
                  onClick={() => handleLeave(selectedGroup.id)}
                >
                  Leave Group
                </button>
              ) : (
                <button
                  className="tai-btn tai-btn-primary"
                  style={{ borderRadius: 999, padding: "8px 20px", fontSize: 13 }}
                  disabled={isFull}
                  onClick={() => handleJoin(selectedGroup.id)}
                >
                  {isFull ? "Group Full" : "Join Group"}
                </button>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div
            style={{
              display: "flex",
              gap: 8,
              borderTop: "1px solid var(--border)",
              marginTop: 18,
              paddingTop: 14,
            }}
          >
            <button
              onClick={() => setActiveTab("posts")}
              style={{
                padding: "7px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                border: "none",
                background: activeTab === "posts" ? "var(--primary)" : "transparent",
                color: activeTab === "posts" ? "#fff" : "var(--text-2)",
                transition: "all .15s ease",
              }}
            >
              Posts ({posts.length})
            </button>

            <button
              onClick={() => setActiveTab("overview")}
              style={{
                padding: "7px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                border: "none",
                background: activeTab === "overview" ? "var(--primary)" : "transparent",
                color: activeTab === "overview" ? "#fff" : "var(--text-2)",
                transition: "all .15s ease",
              }}
            >
              Overview & Updates
            </button>

            <button
              onClick={() => setActiveTab("members")}
              style={{
                padding: "7px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                border: "none",
                background: activeTab === "members" ? "var(--primary)" : "transparent",
                color: activeTab === "members" ? "#fff" : "var(--text-2)",
                transition: "all .15s ease",
              }}
            >
              Members ({members.length})
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* TAB 1: POSTS & DISCUSSIONS */}
        {/* ================================================================= */}
        {activeTab === "posts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Post Composer */}
            {isMember ? (
              <div
                className="tai-card"
                style={{
                  padding: 16,
                  borderRadius: 14,
                  background: "var(--glass-surface)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <Avatar
                    size={34}
                    initials={initialsOf(session?.user?.user_metadata?.full_name || "You")}
                    src={session?.user?.user_metadata?.avatar_url}
                  />
                  <div style={{ flex: 1 }}>
                    <textarea
                      className="tai-input"
                      rows={3}
                      placeholder={`Share something with ${selectedGroup.name}...`}
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      style={{
                        width: "100%",
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        padding: 12,
                        fontSize: 13.5,
                        fontFamily: "inherit",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                    <div className="tai-row tai-between" style={{ marginTop: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                        Markdown formatting and questions supported
                      </span>
                      <button
                        className="tai-btn tai-btn-primary tai-btn-sm"
                        style={{ borderRadius: 999, padding: "6px 16px", display: "inline-flex", alignItems: "center", gap: 6 }}
                        disabled={posting || !newPostContent.trim()}
                        onClick={handleCreatePost}
                      >
                        <Send size={13} /> {posting ? "Posting..." : "Post to Group"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="tai-card"
                style={{
                  padding: "16px 20px",
                  borderRadius: 14,
                  background: "var(--primary-tint)",
                  border: "1px solid rgba(37, 99, 235, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Info size={18} color="var(--primary)" />
                  <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>
                    Join this study group to share posts, ask questions, and comment on discussions.
                  </span>
                </div>
                <button
                  className="tai-btn tai-btn-primary tai-btn-sm"
                  style={{ borderRadius: 999, padding: "6px 18px" }}
                  disabled={isFull}
                  onClick={() => handleJoin(selectedGroup.id)}
                >
                  {isFull ? "Group Full" : "Join to Participate"}
                </button>
              </div>
            )}

            {/* Posts List */}
            {groupPostsQuery.loading ? (
              <div className="tai-card" style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                Loading group discussions...
              </div>
            ) : posts.length === 0 ? (
              <div className="tai-card tai-empty" style={{ padding: 36, textAlign: "center", borderRadius: 14 }}>
                <MessageSquare size={28} color="var(--text-3)" style={{ margin: "0 auto 10px" }} />
                <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>No posts in this group yet</div>
                <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 4 }}>
                  {isMember ? "Be the first to share an update, question, or study notes!" : "Join this group to get the discussion started!"}
                </div>
              </div>
            ) : (
              posts.map((post) => {
                const isAuthor = post.user_id === session?.user?.id;
                const authorName = post.user_profiles?.display_name || post.user_profiles?.full_name || "Study Group Member";
                const reactions = post.post_reactions || [];
                const comments = post.post_comments || [];
                const hasLiked = reactions.some((r) => r.user_id === session?.user?.id);
                const isCommentsOpen = !!expandedComments[post.id];

                return (
                  <div
                    key={post.id}
                    className="tai-card"
                    style={{
                      padding: 18,
                      borderRadius: 14,
                      background: "var(--glass-surface)",
                      border: "1px solid var(--glass-border)",
                      boxShadow: "var(--glass-shadow)",
                    }}
                  >
                    {/* Post Header */}
                    <div className="tai-row tai-between" style={{ alignItems: "center", marginBottom: 10 }}>
                      <div className="tai-row tai-gap10" style={{ alignItems: "center" }}>
                        <Avatar
                          size={32}
                          initials={initialsOf(authorName)}
                          src={post.user_profiles?.avatar_url}
                        />
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)" }}>{authorName}</div>
                          <div style={{ fontSize: 11, color: "var(--text-3)" }}>{timeAgo(post.created_at)}</div>
                        </div>
                      </div>

                      {isAuthor && (
                        <button
                          className="tai-btn tai-btn-ghost tai-btn-sm"
                          style={{ color: "var(--danger)", padding: 6, borderRadius: 8 }}
                          title="Delete post"
                          onClick={() => handleDeletePost(post.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {/* Post Content */}
                    <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 14 }}>
                      {post.content}
                    </div>

                    {/* Post Actions */}
                    <div
                      className="tai-row tai-gap14"
                      style={{
                        paddingTop: 10,
                        borderTop: "1px solid var(--border)",
                        alignItems: "center",
                      }}
                    >
                      <button
                        onClick={() => handleToggleReaction(post.id)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          background: hasLiked ? "rgba(239, 68, 68, 0.1)" : "transparent",
                          color: hasLiked ? "#EF4444" : "var(--text-2)",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 12.5,
                          fontWeight: 700,
                          padding: "5px 10px",
                          borderRadius: 8,
                          transition: "all .15s ease",
                        }}
                      >
                        <Heart size={14} fill={hasLiked ? "#EF4444" : "none"} />
                        <span>{reactions.length}</span>
                      </button>

                      <button
                        onClick={() => toggleComments(post.id)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          background: isCommentsOpen ? "var(--surface-2)" : "transparent",
                          color: "var(--text-2)",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 12.5,
                          fontWeight: 700,
                          padding: "5px 10px",
                          borderRadius: 8,
                          transition: "all .15s ease",
                        }}
                      >
                        <MessageCircle size={14} />
                        <span>{comments.length} {comments.length === 1 ? "Comment" : "Comments"}</span>
                      </button>
                    </div>

                    {/* Comments Thread */}
                    {isCommentsOpen && (
                      <div
                        style={{
                          marginTop: 12,
                          paddingTop: 12,
                          borderTop: "1px solid var(--border)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        {comments.length === 0 ? (
                          <div style={{ fontSize: 12, color: "var(--text-3)", padding: "4px 0" }}>
                            No comments yet. Start the conversation!
                          </div>
                        ) : (
                          comments.map((c) => {
                            const cAuthor = c.user_profiles?.display_name || c.user_profiles?.full_name || "Member";
                            return (
                              <div
                                key={c.id}
                                style={{
                                  padding: "8px 12px",
                                  background: "var(--surface-2)",
                                  borderRadius: 8,
                                  display: "flex",
                                  gap: 8,
                                }}
                              >
                                <Avatar size={24} initials={initialsOf(cAuthor)} src={c.user_profiles?.avatar_url} />
                                <div style={{ flex: 1 }}>
                                  <div className="tai-row tai-between" style={{ alignItems: "center", marginBottom: 2 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{cAuthor}</span>
                                    <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>{timeAgo(c.created_at)}</span>
                                  </div>
                                  <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.45 }}>{c.content}</div>
                                </div>
                              </div>
                            );
                          })
                        )}

                        {/* Comment Input */}
                        {isMember && (
                          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                            <input
                              className="tai-input"
                              placeholder="Write a comment..."
                              value={commentInputs[post.id] || ""}
                              onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleAddComment(post.id);
                                }
                              }}
                              style={{ flex: 1, fontSize: 12.5, padding: "6px 10px", background: "var(--surface)" }}
                            />
                            <button
                              className="tai-btn tai-btn-primary tai-btn-sm"
                              style={{ borderRadius: 8, padding: "6px 12px" }}
                              disabled={commentBusy[post.id] || !(commentInputs[post.id] || "").trim()}
                              onClick={() => handleAddComment(post.id)}
                            >
                              Reply
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: OVERVIEW & INSTRUCTOR UPDATES */}
        {/* ================================================================= */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Instructor Updates (Read-only per item 3) */}
            <div
              className="tai-card"
              style={{
                padding: 18,
                borderRadius: 14,
                background: "var(--glass-surface)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div className="tai-row tai-gap8" style={{ alignItems: "center", marginBottom: 12 }}>
                <MessageSquare size={16} color="var(--primary)" />
                <span style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>Updates from your instructor</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {messages.map((msg) => {
                  const instructorName = msg.user_profiles?.display_name || msg.user_profiles?.full_name || "Instructor";
                  return (
                    <div
                      key={msg.id}
                      style={{
                        padding: "12px 14px",
                        background: "var(--surface-3)",
                        borderRadius: 10,
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div className="tai-row tai-between" style={{ alignItems: "center", marginBottom: 6 }}>
                        <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
                          <Avatar size={24} initials={initialsOf(instructorName)} src={msg.user_profiles?.avatar_url} />
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>{instructorName}</span>
                          <Tag tone="primary" size="sm">Instructor</Tag>
                        </div>
                        {msg.created_at && (
                          <span style={{ fontSize: 11, color: "var(--text-3)" }}>{timeAgo(msg.created_at)}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>{msg.message}</div>
                    </div>
                  );
                })}
                {messages.length === 0 && (
                  <div style={{ fontSize: 12.5, color: "var(--text-3)", padding: "10px 0" }}>
                    No updates posted yet. Your instructor can post announcements and milestones here for the whole group.
                  </div>
                )}
              </div>
            </div>

            {/* Group Information & Rules */}
            <div
              className="tai-card"
              style={{
                padding: 18,
                borderRadius: 14,
                background: "var(--glass-surface)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div className="tai-row tai-gap8" style={{ alignItems: "center", marginBottom: 12 }}>
                <ShieldCheck size={16} color="var(--primary)" />
                <span style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>Study Group Guidelines</span>
              </div>
              <ul style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, paddingLeft: 18, margin: 0 }}>
                <li>Collaborate respectfully and share helpful learning resources.</li>
                <li>Ask questions and help peers work through challenging concepts.</li>
                <li>All posts are moderated to ensure a productive and safe learning environment.</li>
              </ul>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: MEMBERS ROSTER */}
        {/* ================================================================= */}
        {activeTab === "members" && (
          <div
            className="tai-card"
            style={{
              padding: 18,
              borderRadius: 14,
              background: "var(--glass-surface)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div className="tai-row tai-between" style={{ alignItems: "center", marginBottom: 14 }}>
              <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
                <Users size={16} color="var(--primary)" />
                <span style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>Group Roster ({members.length}/{maxMembers})</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {members.map((m) => {
                const name = m.user_profiles?.display_name || m.user_profiles?.full_name || "Member";
                const isLead = m.role === "lead";
                return (
                  <div
                    key={m.user_id}
                    className="tai-row tai-between"
                    style={{
                      padding: "10px 12px",
                      background: "var(--surface-3)",
                      borderRadius: 10,
                      alignItems: "center",
                    }}
                  >
                    <div className="tai-row tai-gap10" style={{ alignItems: "center" }}>
                      <Avatar size={30} initials={initialsOf(name)} src={m.user_profiles?.avatar_url} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{name}</div>
                        {m.joined_at && <div style={{ fontSize: 11, color: "var(--text-3)" }}>Joined {timeAgo(m.joined_at)}</div>}
                      </div>
                    </div>

                    {isLead ? (
                      <Tag tone="primary">Group Lead</Tag>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--text-3)" }}>Member</span>
                    )}
                  </div>
                );
              })}
              {members.length === 0 && (
                <div style={{ fontSize: 12.5, color: "var(--text-3)", padding: "10px 0" }}>No members joined yet.</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------
  // Render: GROUP LIST / BROWSER VIEW (1.0 Parity)
  // -------------------------------------------------------------------
  const filteredGroups = useMemo(() => {
    let list = groups;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (g) =>
          g.name?.toLowerCase().includes(q) ||
          g.description?.toLowerCase().includes(q) ||
          g.courses?.title?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [groups, searchQuery]);

  const myGroups = filteredGroups.filter((g) => myGroupIds.has(g.id));
  const otherGroups = filteredGroups.filter((g) => !myGroupIds.has(g.id));

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <TopBar title="Study Groups" sub="Find, join, and collaborate with peers in your organization" onBack={back} />

      {/* Header with Search and Create Action */}
      <div className="tai-row tai-between" style={{ alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 360 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
          <input
            className="tai-input"
            style={{ paddingLeft: 34, width: "100%", boxSizing: "border-box", borderRadius: 10, fontSize: 13 }}
            placeholder="Search study groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <button
          className="tai-btn tai-btn-primary tai-btn-sm"
          style={{ borderRadius: 999, padding: "8px 18px", fontSize: 12.5 }}
          onClick={() => setCreating((v) => !v)}
        >
          <Plus size={14} /> Create Study Group
        </button>
      </div>

      {/* Create Modal / Form */}
      {creating && (
        <div
          className="tai-card anim-slide-down"
          style={{
            padding: 18,
            borderRadius: 14,
            background: "var(--glass-surface)",
            border: "1px solid var(--glass-border)",
            boxShadow: "var(--glass-shadow)",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 14.5, marginBottom: 12, color: "var(--text)" }}>Create a New Study Group</div>
          <input
            className="tai-input"
            style={{ width: "100%", boxSizing: "border-box", marginBottom: 10, background: "var(--surface-2)" }}
            placeholder="Group Name (e.g. AI Prompt Engineering Guild)"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <textarea
            className="tai-input"
            rows={3}
            style={{ width: "100%", boxSizing: "border-box", marginBottom: 12, background: "var(--surface-2)", fontFamily: "inherit" }}
            placeholder="Group description and focus..."
            value={newGroupDesc}
            onChange={(e) => setNewGroupDesc(e.target.value)}
          />
          <div className="tai-row tai-gap8" style={{ justifyContent: "flex-end" }}>
            <button className="tai-btn tai-btn-outline tai-btn-sm" onClick={() => setCreating(false)}>
              <X size={14} /> Cancel
            </button>
            <button className="tai-btn tai-btn-primary tai-btn-sm" disabled={saving || !newGroupName.trim()} onClick={handleCreate}>
              <Check size={14} /> {saving ? "Creating..." : "Create Group"}
            </button>
          </div>
        </div>
      )}

      {/* SECTION 1: Your Groups */}
      <div>
        <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <span>Your Groups</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)", background: "var(--surface-2)", padding: "1px 7px", borderRadius: 999 }}>
            {myGroups.length}
          </span>
        </div>

        {myGroups.length === 0 ? (
          <div className="tai-card tai-empty" style={{ padding: 22, borderRadius: 12, fontSize: 13, color: "var(--text-2)" }}>
            You haven't joined a study group yet. Explore the groups below or create your own!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {myGroups.map((g) => {
              const memberCount = g.member_count || g.study_group_members?.[0]?.count || 1;
              const maxMembers = g.max_members || 50;

              return (
                <div
                  key={g.id}
                  className="tai-card tai-card-hover"
                  style={{
                    padding: "16px 18px",
                    borderRadius: 14,
                    background: "var(--glass-surface)",
                    border: "1px solid var(--glass-border)",
                    boxShadow: "var(--glass-shadow)",
                  }}
                >
                  <div className="tai-row tai-between" style={{ alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0, flex: "1 1 280px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: 15.5,
                            color: "var(--text)",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                          onClick={() => setSelectedGroupId(g.id)}
                        >
                          {g.name}
                          {g.is_private && (
                            <span title="Private group" style={{ display: "inline-flex", alignItems: "center" }}>
                              <Lock size={13} color="var(--warning)" />
                            </span>
                          )}
                        </div>

                        {g.courses?.title && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 999,
                              background: "rgba(37, 99, 235, 0.1)",
                              color: "var(--primary)",
                              border: "1px solid rgba(37, 99, 235, 0.2)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <BookOpen size={11} /> {g.courses.title}
                          </span>
                        )}

                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: "rgba(16, 185, 129, 0.12)",
                            color: "var(--success)",
                            border: "1px solid rgba(16, 185, 129, 0.25)",
                          }}
                        >
                          Joined
                        </span>
                      </div>

                      <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5, marginBottom: 10 }}>
                        {g.description || "Open study and peer discussion group."}
                      </div>

                      <div className="tai-row tai-gap12" style={{ fontSize: 12, color: "var(--text-3)", alignItems: "center" }}>
                        <span>👥 {memberCount}/{maxMembers} members</span>
                        {g.created_at && <span>🕒 Created {timeAgo(g.created_at)}</span>}
                      </div>
                    </div>

                    <div className="tai-row tai-gap8" style={{ alignItems: "center", alignSelf: "center" }}>
                      <button
                        className="tai-btn tai-btn-outline tai-btn-sm"
                        style={{ borderRadius: 999, padding: "7px 16px", display: "inline-flex", alignItems: "center", gap: 6 }}
                        onClick={() => setSelectedGroupId(g.id)}
                      >
                        <Users size={13} /> View Group
                      </button>
                      <button
                        className="tai-btn tai-btn-outline tai-btn-sm"
                        style={{ borderRadius: 999, padding: "7px 16px", color: "var(--danger)", borderColor: "rgba(239, 68, 68, 0.4)" }}
                        onClick={() => handleLeave(g.id)}
                      >
                        Leave
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: Discover Groups */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <span>Discover Groups</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)", background: "var(--surface-2)", padding: "1px 7px", borderRadius: 999 }}>
            {otherGroups.length}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {otherGroups.map((g) => {
            const memberCount = g.member_count || g.study_group_members?.[0]?.count || 0;
            const maxMembers = g.max_members || 50;
            const isFull = memberCount >= maxMembers;

            return (
              <div
                key={g.id}
                className="tai-card tai-card-hover"
                style={{
                  padding: "16px 18px",
                  borderRadius: 14,
                  background: "var(--glass-surface)",
                  border: "1px solid var(--glass-border)",
                  boxShadow: "var(--glass-shadow)",
                }}
              >
                <div className="tai-row tai-between" style={{ alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0, flex: "1 1 280px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: 15.5,
                          color: "var(--text)",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                        onClick={() => setSelectedGroupId(g.id)}
                      >
                        {g.name}
                        {g.is_private && (
                          <span title="Private group" style={{ display: "inline-flex", alignItems: "center" }}>
                            <Lock size={13} color="var(--warning)" />
                          </span>
                        )}
                      </div>

                      {g.courses?.title && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: "rgba(37, 99, 235, 0.1)",
                            color: "var(--primary)",
                            border: "1px solid rgba(37, 99, 235, 0.2)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <BookOpen size={11} /> {g.courses.title}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5, marginBottom: 10 }}>
                      {g.description || "Open study and peer discussion group."}
                    </div>

                    <div className="tai-row tai-gap12" style={{ fontSize: 12, color: "var(--text-3)", alignItems: "center" }}>
                      <span>👥 {memberCount}/{maxMembers} members</span>
                      {g.created_at && <span>🕒 Created {timeAgo(g.created_at)}</span>}
                    </div>
                  </div>

                  <div className="tai-row tai-gap8" style={{ alignItems: "center", alignSelf: "center" }}>
                    <button
                      className="tai-btn tai-btn-outline tai-btn-sm"
                      style={{ borderRadius: 999, padding: "7px 16px", display: "inline-flex", alignItems: "center", gap: 6 }}
                      onClick={() => setSelectedGroupId(g.id)}
                    >
                      <Users size={13} /> View Group
                    </button>
                    <button
                      className="tai-btn tai-btn-primary tai-btn-sm"
                      style={{ borderRadius: 999, padding: "7px 16px" }}
                      disabled={isFull}
                      onClick={() => handleJoin(g.id)}
                    >
                      {isFull ? "Group Full" : "Join Group"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {otherGroups.length === 0 && groups.length > 0 && (
            <div style={{ fontSize: 12.5, color: "var(--text-3)", padding: "10px 0" }}>
              You're already a member of every available study group.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StudyGroupScreen;
