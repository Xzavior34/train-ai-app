import React, { useState, useMemo } from "react";
import {
  Users, GraduationCap, Trophy, ChevronRight, Plus, Search, Heart, MessageCircle,
  MessageSquare, Send, Pin, Trash2, ArrowLeft, Layers, Mail, Sparkles, Crown, Star,
  Flame, Zap, Clock, Share2, X, BookOpen, UserCheck, Shield, TrendingUp,
  RefreshCw, CheckCircle2, MoreVertical, ExternalLink, Activity, Info, Award,
} from "lucide-react";
import { Avatar, initialsOf, timeAgo, Tag } from "../components/LearnerUI.jsx";
import { WeeklyLeagueCard } from "../components/retention/WeeklyLeagueCard.jsx";

// ---------------------------------------------------------------------------
// Train AI 2.0 Community Screen
// Exact 1.0 Production Community Hub (trainailtd.com) Replication
// 6 Flat Tabs: Posts | Groups | Tutors | Cohorts | People | Rank
// 100% Real Live Supabase Database Connectivity
// ---------------------------------------------------------------------------

const TIER_CONFIG = {
  newcomer: {
    label: "Newcomer",
    nextLabel: "Contributor",
    Icon: Zap,
    color: "#EA580C",
    bg: "rgba(234, 88, 12, 0.12)",
    border: "rgba(234, 88, 12, 0.25)",
  },
  contributor: {
    label: "Contributor",
    nextLabel: "Active Engager",
    Icon: Star,
    color: "var(--primary)",
    bg: "var(--primary-tint)",
    border: "rgba(37, 99, 235, 0.25)",
  },
  engager: {
    label: "Active Engager",
    nextLabel: "Community Leader",
    Icon: Star,
    color: "#2563EB",
    bg: "rgba(37, 99, 235, 0.12)",
    border: "rgba(37, 99, 235, 0.25)",
  },
  leader: {
    label: "Community Leader",
    nextLabel: "Community Champion",
    Icon: Trophy,
    color: "#7C3AED",
    bg: "rgba(124, 58, 237, 0.12)",
    border: "rgba(124, 58, 237, 0.25)",
  },
  champion: {
    label: "Champion",
    nextLabel: null,
    Icon: Trophy,
    color: "#2563EB",
    bg: "rgba(37, 99, 235, 0.12)",
    border: "rgba(37, 99, 235, 0.25)",
  },
};

const TIER_NEXT = {
  newcomer: 50,
  contributor: 100,
  engager: 200,
  leader: 500,
  champion: null,
};

function computeTier(score) {
  if (score >= 500) return "champion";
  if (score >= 200) return "leader";
  if (score >= 100) return "engager";
  if (score >= 50) return "contributor";
  return "newcomer";
}

function extractHashtags(posts) {
  const counts = {};
  for (const p of posts) {
    const matches = (p.content || "").match(/#[#a-zA-Z0-9_@]+/g) || [];
    for (const m of matches) {
      const tag = m.replace(/^#+/, "").toLowerCase();
      if (tag.length > 1) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));
}

// ---------------------------------------------------------------------------
// Live Activity Banner (Under Header on Every Tab)
// ---------------------------------------------------------------------------
function LiveActivityBanner({ items = [] }) {
  const latestActivity = items[0] || null;

  return (
    <div
      className="tai-card"
      style={{
        padding: "10px 16px",
        background: "var(--glass-surface)",
        border: "1px solid var(--glass-border)",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        boxShadow: "var(--glass-shadow)",
      }}
    >
      <div className="tai-row tai-gap10" style={{ alignItems: "center", minWidth: 0 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 8px",
            borderRadius: 999,
            background: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#10B981",
              boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.25)",
              animation: "pulse 2s infinite",
            }}
          />
          <span style={{ fontSize: 10, fontWeight: 900, color: "#10B981", letterSpacing: "0.04em" }}>
            LIVE ACTIVITY
          </span>
        </div>

        <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {latestActivity?.activity_text || "Learners and instructors are actively engaging across community forums and study groups."}
        </div>
      </div>

      {latestActivity?.created_at && (
        <span style={{ fontSize: 11.5, color: "var(--text-3)", flexShrink: 0 }}>
          {timeAgo(latestActivity.created_at)}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar: Your Community Status Card
// ---------------------------------------------------------------------------
function StatusCard({ stats }) {
  const tierKey = stats?.tier || "newcomer";
  const tier = TIER_CONFIG[tierKey] || TIER_CONFIG.newcomer;
  const score = stats?.score || 0;
  const postsCount = stats?.totalPosts || 0;
  const repliesCount = stats?.totalComments || 0;

  return (
    <div
      className="tai-card"
      style={{
        padding: "20px 18px",
        background: "var(--glass-surface)",
        border: "1px solid var(--glass-border)",
        borderRadius: 16,
        boxShadow: "var(--glass-shadow)",
      }}
    >
      <div className="tai-row tai-gap8" style={{ alignItems: "center", marginBottom: 14 }}>
        <Trophy size={16} color="var(--primary)" />
        <span style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)" }}>Your Community Status</span>
      </div>

      <div style={{ textAlign: "center", padding: "6px 0 16px" }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "var(--primary-tint)",
            border: "1.5px solid rgba(37, 99, 235, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 8px",
          }}
        >
          <Trophy size={24} color="var(--primary)" />
        </div>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 800,
            padding: "3px 12px",
            borderRadius: 999,
            background: "var(--primary-tint)",
            color: "var(--primary)",
            border: "1px solid rgba(37, 99, 235, 0.25)",
          }}
        >
          {tier.label}
        </span>
      </div>

      <div className="tai-row tai-gap8" style={{ marginTop: 4 }}>
        {[
          { label: "Posts", value: postsCount, icon: MessageSquare },
          { label: "Replies", value: repliesCount, icon: Heart },
          { label: "Score", value: score, icon: TrendingUp },
        ].map((s) => {
          const SIcon = s.icon;
          return (
            <div
              key={s.label}
              style={{
                flex: 1,
                textAlign: "center",
                background: "var(--surface-2)",
                borderRadius: 12,
                padding: "10px 4px",
                border: "1px solid var(--border)",
              }}
            >
              <SIcon size={13} color="var(--primary)" style={{ margin: "0 auto 4px" }} />
              <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)" }}>{s.value}</div>
              <div style={{ fontSize: 10.5, color: "var(--text-3)", fontWeight: 700, marginTop: 1 }}>{s.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Post Card Component (Matching Exact 1.0 Production Layout)
// ---------------------------------------------------------------------------
function PostCard({
  post,
  onToggleLike,
  onDelete,
  likeBusy,
  deleteBusy,
  expanded,
  onToggleExpand,
  commentDraft,
  onCommentDraftChange,
  onSubmitComment,
  commentBusy,
  onTagClick,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Author tier badge
  const authorTier = computeTier(post.likes * 10 + (post.comments?.length || 0) * 5);
  const tier = TIER_CONFIG[authorTier] || TIER_CONFIG.newcomer;
  const TierIcon = tier.Icon;

  // Split title and content if formatted with a bold title
  const { title, bodyText, tags } = useMemo(() => {
    let raw = post.content || "";
    let extractedTitle = null;
    let mainBody = raw;

    // Check if post starts with a title line or CBT-like bold topic
    const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length > 1 && lines[0].length < 60 && !lines[0].startsWith("http") && !lines[0].startsWith("#")) {
      extractedTitle = lines[0];
      mainBody = lines.slice(1).join("\n");
    }

    // Extract tags
    const tagMatches = raw.match(/#[#a-zA-Z0-9_@]+/g) || [];
    const uniqueTags = [...new Set(tagMatches)];

    return { title: extractedTitle, bodyText: mainBody, tags: uniqueTags };
  }, [post.content]);

  // Render clickable links and hashtags in body
  const renderedBody = useMemo(() => {
    if (!bodyText) return null;
    const parts = bodyText.split(/(\bhttps?:\/\/[^\s]+|#[#a-zA-Z0-9_@]+)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("http://") || part.startsWith("https://")) {
        return (
          <a
            key={idx}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--primary)", textDecoration: "underline", wordBreak: "break-all" }}
          >
            {part}
          </a>
        );
      }
      if (part.startsWith("#")) {
        const cleanTag = part.replace(/^#+/, "");
        return (
          <span
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
              onTagClick?.(cleanTag);
            }}
            style={{ color: "var(--primary)", fontWeight: 700, cursor: "pointer" }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  }, [bodyText, onTagClick]);

  return (
    <div
      className="tai-card tai-card-hover"
      style={{
        padding: "20px",
        background: "var(--glass-surface)",
        border: "1px solid var(--glass-border)",
        borderRadius: 16,
        boxShadow: "var(--glass-shadow)",
      }}
    >
      {/* Top Author Row */}
      <div className="tai-row tai-between" style={{ alignItems: "flex-start", gap: 10 }}>
        <div className="tai-row tai-gap10" style={{ minWidth: 0, alignItems: "center" }}>
          <Avatar size={42} src={post.authorAvatar} initials={initialsOf(post.authorName)} />
          <div style={{ minWidth: 0 }}>
            <div className="tai-row tai-gap8" style={{ alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>{post.authorName}</span>
              
              {/* Tier Pill */}
              <span
                className="tai-row tai-gap4"
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: tier.bg,
                  color: tier.color,
                  border: `1px solid ${tier.border}`,
                }}
              >
                <TierIcon size={10} /> {tier.label}
              </span>
            </div>

            <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>
              {timeAgo(post.createdAt)}
            </div>
          </div>
        </div>

        {/* Right Tag & Menu */}
        <div className="tai-row tai-gap6" style={{ alignItems: "center", position: "relative" }}>
          {post.postType && (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 6,
                background: "var(--surface-2)",
                color: "var(--text-3)",
                border: "1px solid var(--border)",
                textTransform: "lowercase",
              }}
            >
              {post.postType}
            </span>
          )}

          <div style={{ position: "relative" }}>
            <button
              className="tai-iconbtn"
              style={{ width: 28, height: 28, color: "var(--text-3)" }}
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              <MoreVertical size={14} />
            </button>

            {menuOpen && (
              <div
                className="anim-slide-down"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  zIndex: 20,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  boxShadow: "var(--glass-shadow-elevated)",
                  padding: "4px",
                  minWidth: 120,
                }}
              >
                {post.isMine && (
                  <button
                    className="tai-btn tai-btn-ghost tai-btn-sm"
                    style={{ width: "100%", justifyContent: "flex-start", color: "var(--danger)", fontSize: 12 }}
                    disabled={deleteBusy}
                    onClick={() => {
                      setMenuOpen(false);
                      if (window.confirm("Delete this post?")) onDelete?.(post.id);
                    }}
                  >
                    <Trash2 size={13} /> Delete Post
                  </button>
                )}
                <button
                  className="tai-btn tai-btn-ghost tai-btn-sm"
                  style={{ width: "100%", justifyContent: "flex-start", fontSize: 12 }}
                  onClick={() => {
                    setMenuOpen(false);
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(post.content);
                    }
                  }}
                >
                  <Share2 size={13} /> Copy Text
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Post Title (If present) */}
      {title && (
        <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", marginTop: 12 }}>
          {title}
        </div>
      )}

      {/* Post Body Content */}
      <p
        style={{
          fontSize: 13.5,
          color: "var(--text-2)",
          lineHeight: 1.6,
          margin: title ? "6px 0 0" : "12px 0 0",
          whiteSpace: "pre-wrap",
          overflowWrap: "break-word",
        }}
      >
        {renderedBody}
      </p>

      {/* Media if present */}
      {post.mediaUrl && (
        <div style={{ marginTop: 12, borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", background: "#000" }}>
          {post.mediaType === "video" ? (
            <video src={post.mediaUrl} controls playsInline style={{ width: "100%", maxHeight: 380, display: "block" }} />
          ) : (
            <img src={post.mediaUrl} alt="" loading="lazy" style={{ width: "100%", maxHeight: 380, objectFit: "cover", display: "block" }} />
          )}
        </div>
      )}

      {/* Hashtag Chips at Bottom */}
      {tags.length > 0 && (
        <div className="tai-row tai-gap6" style={{ marginTop: 12, flexWrap: "wrap" }}>
          {tags.map((t) => (
            <span
              key={t}
              onClick={() => onTagClick?.(t.replace(/^#+/, ""))}
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 6,
                background: "var(--surface-2)",
                color: "var(--text-2)",
                cursor: "pointer",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Footer Reactions Row */}
      <div className="tai-row tai-gap12" style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)", alignItems: "center" }}>
        <button
          onClick={() => onToggleLike(post.id)}
          disabled={likeBusy}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            color: post.liked ? "#EF4444" : "var(--text-2)",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            padding: "4px 6px",
          }}
        >
          <Heart size={15} fill={post.liked ? "#EF4444" : "none"} color={post.liked ? "#EF4444" : "currentColor"} />
          <span>{post.likes}</span>
        </button>

        <button
          onClick={() => onToggleExpand(post.id)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            color: expanded ? "var(--primary)" : "var(--text-2)",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            padding: "4px 6px",
          }}
        >
          <MessageCircle size={15} />
          <span>{post.comments.length}</span>
        </button>
      </div>

      {/* Expandable Comments Section */}
      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
          {post.comments.map((c) => (
            <div key={c.id} className="tai-row tai-gap8" style={{ alignItems: "flex-start" }}>
              <Avatar size={28} src={c.authorAvatar || c.user_profiles?.avatar_url} initials={initialsOf(c.authorName || c.user_profiles?.display_name)} />
              <div style={{ minWidth: 0, background: "var(--surface-2)", borderRadius: 10, padding: "8px 12px", flex: 1, border: "1px solid var(--border)" }}>
                <div className="tai-row tai-between" style={{ alignItems: "center", marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text)" }}>
                    {c.authorName || c.user_profiles?.display_name || "Learner"}
                  </span>
                  <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>{timeAgo(c.createdAt || c.created_at)}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 }}>
                  {c.content}
                </div>
              </div>
            </div>
          ))}

          {post.comments.length === 0 && (
            <div style={{ fontSize: 11.5, color: "var(--text-3)", textAlign: "center", padding: "4px 0" }}>
              No comments yet — be the first to reply!
            </div>
          )}

          {/* Comment Input */}
          <div className="tai-row tai-gap8" style={{ marginTop: 4 }}>
            <input
              className="tai-input"
              placeholder="Write a comment..."
              value={commentDraft || ""}
              onChange={(e) => onCommentDraftChange(post.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && commentDraft?.trim()) onSubmitComment(post.id);
              }}
              style={{ flex: 1, padding: "7px 12px", fontSize: 12.5 }}
            />
            <button
              className="tai-btn tai-btn-primary tai-btn-sm"
              disabled={commentBusy || !commentDraft?.trim()}
              onClick={() => onSubmitComment(post.id)}
              style={{ width: 34, height: 34, padding: 0, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// MAIN COMMUNITY SCREEN
// ===========================================================================
export function CommunityScreen({
  session,
  user = {},
  push,
  showToast,
  postsQuery = {},
  createCommunityPost,
  addPostComment,
  togglePostReaction,
  deleteCommunityPost,
  activityFeedQuery = {},
  myCommunityStatsQuery = {},
  studyGroupsQuery = {},
  myGroupIdsQuery = {},
  createStudyGroup,
  joinStudyGroup,
  leaveStudyGroup,
  mentorsList = [],
  cohortMembershipQuery = {},
  cohortSessionsQuery = {},
  communityPeopleQuery = {},
  memberStatsQuery = {},
  leaderboardQuery = {},
  gamificationStatsQuery = {},
  upcomingSessionsQuery = {},
}) {
  const myId = session?.user?.id;
  const [tab, setTab] = useState("posts");

  // Posts State
  const [composerOpen, setComposerOpen] = useState(false);
  const [postText, setPostText] = useState("");
  const [postType, setPostType] = useState("general");
  const [posting, setPosting] = useState(false);
  const [feedSearch, setFeedSearch] = useState("");
  const [activeTagFilter, setActiveTagFilter] = useState(null);
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentBusyId, setCommentBusyId] = useState(null);
  const [likeBusyId, setLikeBusyId] = useState(null);
  const [deleteBusyId, setDeleteBusyId] = useState(null);

  // Groups State
  const [groupSearch, setGroupSearch] = useState("");
  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [groupBusy, setGroupBusy] = useState(false);

  // Tutors State
  const [tutorSearch, setTutorSearch] = useState("");

  // People State
  const [peopleSearch, setPeopleSearch] = useState("");

  // Process Posts
  const rawPosts = postsQuery.data || [];
  const posts = useMemo(() => {
    return rawPosts.map((p) => ({
      id: p.id,
      userId: p.user_id,
      authorName: p.user_profiles?.display_name || "Learner",
      authorAvatar: p.user_profiles?.avatar_url || null,
      authorRole: p.user_profiles?.role || "learner",
      content: p.content,
      createdAt: p.created_at,
      postType: p.post_type || "general",
      mediaUrl: p.media_url || null,
      mediaType: p.media_type || null,
      isPinned: !!p.is_pinned,
      moderationStatus: p.moderation_status || "approved",
      isMine: p.user_id === myId,
      likes: (p.post_reactions || []).length,
      liked: (p.post_reactions || []).some((r) => r.user_id === myId),
      comments: (p.post_comments || []).map((c) => ({
        id: c.id,
        authorName: c.user_profiles?.display_name || "Learner",
        authorAvatar: c.user_profiles?.avatar_url || null,
        content: c.content,
        createdAt: c.created_at,
        user_profiles: c.user_profiles,
      })),
    })).sort((a, b) => (b.isPinned - a.isPinned) || (new Date(b.createdAt) - new Date(a.createdAt)));
  }, [rawPosts, myId]);

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      const matchesSearch = !feedSearch.trim() ||
        p.content.toLowerCase().includes(feedSearch.trim().toLowerCase().replace(/^#+/, ""));
      const matchesTag = !activeTagFilter ||
        p.content.toLowerCase().includes(`#${activeTagFilter.toLowerCase()}`);
      return matchesSearch && matchesTag;
    });
  }, [posts, feedSearch, activeTagFilter]);

  const trendingTags = useMemo(() => extractHashtags(posts), [posts]);

  // Handlers for Posts
  async function handlePost() {
    if (!postText.trim() || !myId || !createCommunityPost) return;
    setPosting(true);
    try {
      await createCommunityPost({ userId: myId, content: postText.trim(), postType });
      setPostText("");
      setComposerOpen(false);
      postsQuery.refetch?.();
      activityFeedQuery.refetch?.();
      myCommunityStatsQuery.refetch?.();
      showToast?.("Post published!");
    } catch (e) {
      showToast?.(e?.message || "Could not publish post.");
    } finally {
      setPosting(false);
    }
  }

  async function handleToggleLike(postId) {
    if (!myId || !togglePostReaction) return;
    setLikeBusyId(postId);
    try {
      await togglePostReaction({ postId, userId: myId });
      postsQuery.refetch?.();
    } catch (e) {
      showToast?.("Could not update like.");
    } finally {
      setLikeBusyId(null);
    }
  }

  async function handleDeletePost(postId) {
    if (!deleteCommunityPost) return;
    setDeleteBusyId(postId);
    try {
      await deleteCommunityPost(postId);
      postsQuery.refetch?.();
      myCommunityStatsQuery.refetch?.();
      showToast?.("Post deleted.");
    } catch (e) {
      showToast?.("Could not delete post.");
    } finally {
      setDeleteBusyId(null);
    }
  }

  async function handleSubmitComment(postId) {
    const content = (commentDrafts[postId] || "").trim();
    if (!content || !myId || !addPostComment) return;
    setCommentBusyId(postId);
    try {
      await addPostComment({ postId, userId: myId, content });
      setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
      postsQuery.refetch?.();
      myCommunityStatsQuery.refetch?.();
      activityFeedQuery.refetch?.();
      showToast?.("Comment added!");
    } catch (e) {
      showToast?.("Could not add comment.");
    } finally {
      setCommentBusyId(null);
    }
  }

  // Handlers for Groups
  const myGroupIds = new Set(myGroupIdsQuery.data || []);
  const allGroups = studyGroupsQuery.data || [];
  const filteredGroups = allGroups.filter((g) =>
    !groupSearch.trim() ||
    (g.name || "").toLowerCase().includes(groupSearch.trim().toLowerCase()) ||
    (g.description || "").toLowerCase().includes(groupSearch.trim().toLowerCase())
  );

  async function handleCreateGroup() {
    if (!newGroupName.trim() || !createStudyGroup) return;
    setGroupBusy(true);
    try {
      await createStudyGroup({
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        createdBy: myId,
      });
      setNewGroupName("");
      setNewGroupDesc("");
      setCreateGroupModalOpen(false);
      studyGroupsQuery.refetch?.();
      myGroupIdsQuery.refetch?.();
      showToast?.("Study group created!");
    } catch (e) {
      showToast?.("Could not create study group.");
    } finally {
      setGroupBusy(false);
    }
  }

  async function handleJoinGroup(groupId) {
    if (!myId || !joinStudyGroup) return;
    try {
      await joinStudyGroup({ studyGroupId: groupId, userId: myId });
      myGroupIdsQuery.refetch?.();
      showToast?.("Joined study group!");
    } catch (e) {
      showToast?.("Could not join group.");
    }
  }

  async function handleLeaveGroup(groupId) {
    if (!myId || !leaveStudyGroup) return;
    try {
      await leaveStudyGroup({ studyGroupId: groupId, userId: myId });
      myGroupIdsQuery.refetch?.();
      showToast?.("Left study group.");
    } catch (e) {
      showToast?.("Could not leave group.");
    }
  }

  // Tutors
  const filteredTutors = mentorsList.filter((m) =>
    !tutorSearch.trim() ||
    (m.name || "").toLowerCase().includes(tutorSearch.trim().toLowerCase()) ||
    (m.title || "").toLowerCase().includes(tutorSearch.trim().toLowerCase()) ||
    (m.specializations || []).some((s) => s.toLowerCase().includes(tutorSearch.trim().toLowerCase()))
  );

  // People
  const filteredPeople = (communityPeopleQuery.data || []).filter((p) =>
    !peopleSearch.trim() ||
    (p.display_name || "").toLowerCase().includes(peopleSearch.trim().toLowerCase())
  );

  // Cohort
  const cohort = cohortMembershipQuery.data?.cohort || null;
  const cohortSessions = cohortSessionsQuery.data || [];

  // Leaderboard data
  const leaderboardRows = leaderboardQuery.data || [];
  const myRankIndex = leaderboardRows.findIndex((r) => r.user_id === myId);
  const myRankNumber = myRankIndex >= 0 ? myRankIndex + 1 : "—";
  const myPoints = gamificationStatsQuery.data?.total_points || 0;
  const myLevel = gamificationStatsQuery.data?.current_level || 1;
  const nextRankPoints = myRankIndex > 0 ? (leaderboardRows[myRankIndex - 1]?.total_points || myPoints) - myPoints : 0;

  // Tabs list with icons
  const TABS = [
    { id: "posts", label: "Posts", icon: MessageSquare },
    { id: "groups", label: "Groups", icon: Users },
    { id: "tutors", label: "Tutors", icon: GraduationCap },
    { id: "cohorts", label: "Cohorts", icon: BookOpen },
    { id: "people", label: "People", icon: UserCheck },
    { id: "rank", label: "Rank", icon: Trophy },
  ];

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Page Header */}
      <div>
        <h1 className="tai-h1" style={{ margin: 0 }}>Community</h1>
      </div>

      {/* Live Activity Banner */}
      <LiveActivityBanner items={activityFeedQuery.data || []} />

      {/* Six Flat Tabs Row */}
      <div
        style={{
          display: "flex",
          gap: 6,
          paddingBottom: 4,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 18px",
                borderRadius: 999,
                border: "none",
                background: isActive ? "var(--primary)" : "transparent",
                color: isActive ? "#FFFFFF" : "var(--text-2)",
                fontWeight: isActive ? 800 : 600,
                fontSize: 13,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
                boxShadow: isActive ? "0 4px 14px rgba(37, 99, 235, 0.28)" : "none",
              }}
            >
              <Icon size={14} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* TAB 1: POSTS */}
      {/* =================================================================== */}
      {tab === "posts" && (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
          {/* Main Feed Column */}
          <div style={{ flex: "2 1 500px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Search Posts Bar */}
            <div style={{ position: "relative" }}>
              <Search size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
              <input
                className="tai-input"
                style={{ paddingLeft: 38, background: "var(--glass-surface)", borderRadius: 12 }}
                placeholder="Search posts..."
                value={feedSearch}
                onChange={(e) => setFeedSearch(e.target.value)}
              />
              {feedSearch && (
                <button
                  onClick={() => setFeedSearch("")}
                  className="tai-iconbtn"
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 22, height: 22 }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Composer */}
            {!composerOpen ? (
              <div
                className="tai-card tai-row tai-gap10"
                style={{
                  padding: "12px 16px",
                  alignItems: "center",
                  background: "var(--glass-surface)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: 14,
                  boxShadow: "var(--glass-shadow)",
                }}
              >
                <Avatar size={38} src={user.avatarUrl} initials={initialsOf(user.name || "You")} />
                <button
                  onClick={() => setComposerOpen(true)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: "left",
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    borderRadius: 999,
                    padding: "9px 16px",
                    color: "var(--text-3)",
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Share something with the community...
                </button>
                <button
                  className="tai-btn tai-btn-primary"
                  style={{ width: 36, height: 36, borderRadius: "50%", padding: 0, flexShrink: 0 }}
                  onClick={() => setComposerOpen(true)}
                >
                  <Plus size={16} />
                </button>
              </div>
            ) : (
              <div
                className="tai-card anim-slide-down"
                style={{
                  padding: "16px",
                  background: "var(--glass-surface)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: 14,
                  boxShadow: "var(--glass-shadow)",
                }}
              >
                <div className="tai-row tai-between" style={{ marginBottom: 10, alignItems: "center" }}>
                  <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
                    <Avatar size={32} src={user.avatarUrl} initials={initialsOf(user.name || "You")} />
                    <span style={{ fontWeight: 800, fontSize: 13 }}>Create a Post</span>
                  </div>
                  <div className="tai-row tai-gap6">
                    {["general", "question", "tip", "showcase"].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setPostType(type)}
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 6,
                          border: `1px solid ${postType === type ? "var(--primary)" : "var(--border)"}`,
                          background: postType === type ? "var(--primary-tint)" : "var(--surface-2)",
                          color: postType === type ? "var(--primary)" : "var(--text-3)",
                          cursor: "pointer",
                          textTransform: "capitalize",
                        }}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  className="tai-input"
                  rows={3}
                  autoFocus
                  placeholder="What's on your mind? Use #hashtags to categorize..."
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  style={{ marginBottom: 12, padding: "10px 12px", fontSize: 13, background: "var(--surface-2)" }}
                />

                <div className="tai-row tai-gap8" style={{ justifyContent: "flex-end" }}>
                  <button
                    className="tai-btn tai-btn-ghost tai-btn-sm"
                    onClick={() => {
                      setComposerOpen(false);
                      setPostText("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="tai-btn tai-btn-primary tai-btn-sm"
                    disabled={posting || !postText.trim()}
                    onClick={handlePost}
                  >
                    {posting ? "Posting..." : "Post"}
                  </button>
                </div>
              </div>
            )}

            {/* Posts Feed */}
            {postsQuery.loading && (
              <div className="tai-card" style={{ padding: 24, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                Loading posts...
              </div>
            )}

            {!postsQuery.loading && filteredPosts.length === 0 && (
              <div className="tai-card" style={{ padding: 36, textAlign: "center" }}>
                <MessageSquare size={24} color="var(--text-3)" style={{ margin: "0 auto 8px" }} />
                <div style={{ fontWeight: 800, fontSize: 14 }}>{feedSearch || activeTagFilter ? "No matching posts" : "No posts yet"}</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>Be the first to share something!</div>
              </div>
            )}

            {filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onToggleLike={handleToggleLike}
                likeBusy={likeBusyId === post.id}
                onDelete={post.isMine ? handleDeletePost : null}
                deleteBusy={deleteBusyId === post.id}
                expanded={expandedPostId === post.id}
                onToggleExpand={(id) => setExpandedPostId((prev) => (prev === id ? null : id))}
                commentDraft={commentDrafts[post.id]}
                onCommentDraftChange={(id, val) => setCommentDrafts((prev) => ({ ...prev, [id]: val }))}
                onSubmitComment={handleSubmitComment}
                commentBusy={commentBusyId === post.id}
                onTagClick={(tag) => setActiveTagFilter(tag)}
              />
            ))}
          </div>

          {/* Sidebar Column */}
          <div style={{ flex: "1 1 280px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Status Card */}
            <StatusCard stats={myCommunityStatsQuery.data} />

            {/* Trending Tags Card */}
            {trendingTags.length > 0 && (
              <div
                className="tai-card"
                style={{
                  padding: "18px 16px",
                  background: "var(--glass-surface)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: 16,
                  boxShadow: "var(--glass-shadow)",
                }}
              >
                <div className="tai-row tai-between" style={{ marginBottom: 12, alignItems: "center" }}>
                  <div className="tai-row tai-gap6" style={{ alignItems: "center" }}>
                    <TrendingUp size={15} color="var(--primary)" />
                    <span style={{ fontWeight: 800, fontSize: 13.5 }}>Trending Tags</span>
                  </div>
                  {activeTagFilter && (
                    <button
                      onClick={() => setActiveTagFilter(null)}
                      style={{ fontSize: 11, color: "var(--primary)", border: "none", background: "none", cursor: "pointer", fontWeight: 700 }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="tai-row tai-gap6" style={{ flexWrap: "wrap" }}>
                  {trendingTags.map((t) => {
                    const isSelected = activeTagFilter === t.tag;
                    return (
                      <button
                        key={t.tag}
                        onClick={() => setActiveTagFilter(isSelected ? null : t.tag)}
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: "3px 10px",
                          borderRadius: 999,
                          border: `1px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                          background: isSelected ? "var(--primary)" : "var(--surface-2)",
                          color: isSelected ? "#fff" : "var(--primary)",
                          cursor: "pointer",
                        }}
                      >
                        #{t.tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Community Stats Card */}
            <div
              className="tai-card"
              style={{
                padding: "18px 16px",
                background: "var(--glass-surface)",
                border: "1px solid var(--glass-border)",
                borderRadius: 16,
                boxShadow: "var(--glass-shadow)",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, color: "var(--text)" }}>
                Community Stats
              </div>
              <div className="tai-col tai-gap10">
                {[
                  { label: "Total Posts", value: posts.length },
                  { label: "Study Groups", value: allGroups.length },
                  { label: "Total Likes", value: posts.reduce((sum, p) => sum + p.likes, 0) },
                ].map((s) => (
                  <div key={s.label} className="tai-row tai-between" style={{ alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "var(--text-2)" }}>{s.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 900, color: "var(--text)" }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: GROUPS */}
      {/* =================================================================== */}
      {tab === "groups" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Header Bar */}
          <div className="tai-row tai-between" style={{ alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
              <Users size={20} color="var(--primary)" />
              <span style={{ fontWeight: 900, fontSize: 17, color: "var(--text)" }}>Study Groups</span>
            </div>
            <button
              className="tai-btn tai-btn-primary"
              style={{ borderRadius: 999, padding: "8px 18px", fontSize: 12.5 }}
              onClick={() => setCreateGroupModalOpen((prev) => !prev)}
            >
              <Plus size={15} /> Create Group
            </button>
          </div>

          {/* Create Group Form */}
          {createGroupModalOpen && (
            <div
              className="tai-card anim-slide-down"
              style={{
                padding: "16px",
                background: "var(--glass-surface)",
                border: "1px solid var(--glass-border)",
                borderRadius: 14,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Create a New Study Group</div>
              <input
                className="tai-input"
                placeholder="Group Name (e.g. AI Prompt Engineering Guild)"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                style={{ marginBottom: 10, background: "var(--surface-2)" }}
              />
              <textarea
                className="tai-input"
                rows={2}
                placeholder="Group Description & Purpose"
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
                style={{ marginBottom: 12, background: "var(--surface-2)" }}
              />
              <div className="tai-row tai-gap8" style={{ justifyContent: "flex-end" }}>
                <button
                  className="tai-btn tai-btn-ghost tai-btn-sm"
                  onClick={() => setCreateGroupModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="tai-btn tai-btn-primary tai-btn-sm"
                  disabled={groupBusy || !newGroupName.trim()}
                  onClick={handleCreateGroup}
                >
                  {groupBusy ? "Creating..." : "Create Group"}
                </button>
              </div>
            </div>
          )}

          {/* Search Bar */}
          <div style={{ position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
            <input
              className="tai-input"
              style={{ paddingLeft: 38, background: "var(--glass-surface)", borderRadius: 12 }}
              placeholder="Search study groups..."
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
            />
          </div>

          {/* Groups List */}
          {filteredGroups.length === 0 && (
            <div className="tai-card" style={{ padding: 36, textAlign: "center" }}>
              <Users size={24} color="var(--text-3)" style={{ margin: "0 auto 8px" }} />
              <div style={{ fontWeight: 800, fontSize: 14 }}>No study groups found</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>Create the first study group!</div>
            </div>
          )}

          <div className="tai-col tai-gap12">
            {filteredGroups.map((g) => {
              const isMember = myGroupIds.has(g.id);
              const memberCount = g.member_count || g.study_group_members?.[0]?.count || 1;

              return (
                <div
                  key={g.id}
                  className="tai-card tai-card-hover"
                  style={{
                    padding: "18px 20px",
                    background: "var(--glass-surface)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: 16,
                    boxShadow: "var(--glass-shadow)",
                  }}
                >
                  <div className="tai-row tai-between" style={{ alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0, flex: "1 1 280px" }}>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: 16,
                          color: "var(--text)",
                          cursor: "pointer",
                          marginBottom: 6,
                        }}
                        onClick={() => push("studyGroup", { groupId: g.id })}
                      >
                        {g.name}
                      </div>

                      <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.55, marginBottom: 10 }}>
                        {g.description || "Open study and peer discussion group."}
                      </div>

                      <div className="tai-row tai-gap12" style={{ fontSize: 12, color: "var(--text-3)", alignItems: "center", marginBottom: isMember ? 8 : 0 }}>
                        <span>👥 {memberCount} members</span>
                        {g.created_at && <span>🕒 {timeAgo(g.created_at)}</span>}
                      </div>

                      {isMember && (
                        <div style={{ marginTop: 6 }}>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 800,
                              padding: "2px 8px",
                              borderRadius: 999,
                              background: "rgba(37, 99, 235, 0.12)",
                              color: "var(--primary)",
                              border: "1px solid rgba(37, 99, 235, 0.25)",
                            }}
                          >
                            Member
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="tai-row tai-gap8" style={{ alignItems: "center", alignSelf: "center" }}>
                      <button
                        className="tai-btn tai-btn-outline tai-btn-sm"
                        style={{ borderRadius: 999, padding: "7px 16px", display: "inline-flex", alignItems: "center", gap: 6 }}
                        onClick={() => push("studyGroup", { groupId: g.id })}
                      >
                        <Users size={13} /> View Group
                      </button>

                      {isMember ? (
                        <button
                          className="tai-btn tai-btn-outline tai-btn-sm"
                          style={{ borderRadius: 999, padding: "7px 16px", color: "var(--danger)", borderColor: "rgba(239, 68, 68, 0.4)" }}
                          onClick={() => handleLeaveGroup(g.id)}
                        >
                          Leave
                        </button>
                      ) : (
                        <button
                          className="tai-btn tai-btn-primary tai-btn-sm"
                          style={{ borderRadius: 999, padding: "7px 16px" }}
                          onClick={() => handleJoinGroup(g.id)}
                        >
                          Join Group
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: TUTORS (INSTRUCTORS) */}
      {/* =================================================================== */}
      {tab === "tutors" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Search Bar */}
          <div style={{ position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
            <input
              className="tai-input"
              style={{ paddingLeft: 38, background: "var(--glass-surface)", borderRadius: 12 }}
              placeholder="Search tutors by name or specialization..."
              value={tutorSearch}
              onChange={(e) => setTutorSearch(e.target.value)}
            />
          </div>

          {filteredTutors.length === 0 && (
            <div className="tai-card" style={{ padding: 36, textAlign: "center" }}>
              <GraduationCap size={24} color="var(--text-3)" style={{ margin: "0 auto 8px" }} />
              <div style={{ fontWeight: 800, fontSize: 14 }}>No instructors found</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>Try searching for a different skill or name.</div>
            </div>
          )}

          <div className="tai-grid3">
            {filteredTutors.map((m) => (
              <div
                key={m.id}
                className="tai-card tai-card-hover"
                style={{
                  padding: "22px 18px",
                  background: "var(--glass-surface)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: 16,
                  boxShadow: "var(--glass-shadow)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  justifyContent: "space-between",
                  gap: 14,
                }}
              >
                <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <Avatar size={56} initials={initialsOf(m.name)} />
                  
                  <div style={{ fontWeight: 900, fontSize: 15, color: "var(--text)", marginTop: 10 }}>
                    {m.name}
                  </div>

                  {m.rating > 0 && (
                    <div className="tai-row tai-gap4" style={{ alignItems: "center", justifyContent: "center", marginTop: 3 }}>
                      <Star size={13} fill="#F59E0B" color="#F59E0B" />
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--text)" }}>{m.rating.toFixed(1)}</span>
                    </div>
                  )}

                  {m.specializations && m.specializations.length > 0 && (
                    <div className="tai-row tai-gap4" style={{ justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
                      {m.specializations.slice(0, 2).map((s) => (
                        <span
                          key={s}
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: "var(--surface-2)",
                            color: "var(--text-2)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {m.bio && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-3)",
                        lineHeight: 1.5,
                        marginTop: 8,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {m.bio}
                    </div>
                  )}
                </div>

                <button
                  className="tai-btn tai-btn-primary"
                  style={{ width: "100%", borderRadius: 10, justifyContent: "center", padding: "8px 0" }}
                  onClick={() => push("mentors")}
                >
                  <MessageSquare size={14} /> Chat
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: COHORTS */}
      {/* =================================================================== */}
      {tab === "cohorts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Info Banner */}
          <div
            className="tai-card"
            style={{
              padding: "18px 20px",
              background: "var(--glass-surface)",
              border: "1px solid var(--glass-border)",
              borderRadius: 16,
              boxShadow: "var(--glass-shadow)",
            }}
          >
            <div className="tai-row tai-gap8" style={{ alignItems: "center", marginBottom: 6 }}>
              <BookOpen size={16} color="var(--primary)" />
              <span style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text)" }}>Cohort Communication</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.55 }}>
              Open a cohort to access its discussion feed, group announcements, live sessions, shared resources, and member directory — all in one space.
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>My Cohort Spaces</div>

            {cohort ? (
              <div
                className="tai-card tai-card-hover"
                style={{
                  padding: "20px",
                  background: "var(--glass-surface)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: 16,
                  boxShadow: "var(--glass-shadow)",
                  cursor: "pointer",
                }}
                onClick={() => push("cohort")}
              >
                <div className="tai-row tai-between" style={{ alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "rgba(16, 185, 129, 0.12)",
                        color: "#10B981",
                        textTransform: "uppercase",
                      }}
                    >
                      Active Cohort
                    </span>
                    <div style={{ fontWeight: 900, fontSize: 17, color: "var(--text)", marginTop: 6 }}>
                      {cohort.name}
                    </div>
                  </div>
                  <ChevronRight size={18} color="var(--text-3)" />
                </div>

                <div style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.55, marginBottom: 12 }}>
                  {cohort.description || "Your dedicated organizational cohort workspace."}
                </div>

                <div className="tai-row tai-gap12" style={{ fontSize: 12, color: "var(--text-3)" }}>
                  {cohortSessions.length > 0 && (
                    <span>📅 {cohortSessions.length} live sessions</span>
                  )}
                  {cohort.start_date && (
                    <span>· Started {new Date(cohort.start_date).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="tai-card" style={{ padding: 36, textAlign: "center" }}>
                <Users size={24} color="var(--text-3)" style={{ margin: "0 auto 8px" }} />
                <div style={{ fontWeight: 800, fontSize: 14 }}>Not currently enrolled in a cohort</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>
                  Contact your workspace administrator to be assigned to a cohort.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 5: PEOPLE */}
      {/* =================================================================== */}
      {tab === "people" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Search Bar */}
          <div style={{ position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
            <input
              className="tai-input"
              style={{ paddingLeft: 38, background: "var(--glass-surface)", borderRadius: 12 }}
              placeholder="Search by name, username, or learning track..."
              value={peopleSearch}
              onChange={(e) => setPeopleSearch(e.target.value)}
            />
          </div>

          {filteredPeople.length === 0 && (
            <div className="tai-card" style={{ padding: 36, textAlign: "center" }}>
              <UserCheck size={24} color="var(--text-3)" style={{ margin: "0 auto 8px" }} />
              <div style={{ fontWeight: 800, fontSize: 14 }}>No members found</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>Try searching for a different name.</div>
            </div>
          )}

          <div className="tai-grid3">
            {filteredPeople.map((p) => {
              const username = `@${(p.display_name || "learner").toLowerCase().replace(/\s+/g, "")}`;
              const stats = memberStatsQuery.data?.[p.id];

              return (
                <div
                  key={p.id}
                  className="tai-card tai-card-hover"
                  style={{
                    padding: "16px",
                    background: "var(--glass-surface)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: 16,
                    boxShadow: "var(--glass-shadow)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div className="tai-row tai-gap10" style={{ alignItems: "center" }}>
                    <Avatar size={42} src={p.avatar_url} initials={initialsOf(p.display_name)} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.display_name || "Learner"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {username}
                      </div>
                    </div>
                  </div>

                  {stats?.total_points > 0 && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)" }}>
                      ⭐ {stats.total_points.toLocaleString()} pts {stats.streak_days > 0 ? `· 🔥 ${stats.streak_days}d` : ""}
                    </div>
                  )}

                  <div className="tai-row tai-gap6">
                    <button
                      className="tai-btn tai-btn-outline tai-btn-sm"
                      style={{ flex: 1, padding: "5px 0", justifyContent: "center", fontSize: 11.5, borderRadius: 8 }}
                      onClick={() => showToast?.(`${p.display_name || "Learner"} (${username})`)}
                    >
                      Profile
                    </button>
                    <button
                      className="tai-btn tai-btn-primary tai-btn-sm"
                      style={{ flex: 1, padding: "5px 0", justifyContent: "center", fontSize: 11.5, borderRadius: 8 }}
                      onClick={() => push?.(p.role === "mentor" ? "mentors" : "messages")}
                    >
                      Message
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 6: RANK (LEADERBOARD) */}
      {/* =================================================================== */}
      {tab === "rank" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Header Card */}
          <div
            className="tai-card"
            style={{
              padding: "18px 20px",
              background: "var(--glass-surface)",
              border: "1px solid var(--glass-border)",
              borderRadius: 16,
              boxShadow: "var(--glass-shadow)",
            }}
          >
            <div className="tai-row tai-between" style={{ alignItems: "center", marginBottom: 14 }}>
              <div className="tai-row tai-gap10" style={{ alignItems: "center" }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "rgba(245, 158, 11, 0.12)",
                    border: "1px solid rgba(245, 158, 11, 0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Trophy size={20} color="#D97706" />
                </div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16, color: "var(--text)" }}>Leaderboard</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                    {leaderboardRows.length} learners competing • Live updates
                  </div>
                </div>
              </div>

              <button
                className="tai-btn tai-btn-ghost tai-btn-sm"
                onClick={() => leaderboardQuery.refetch?.()}
                style={{ padding: "6px 12px", fontSize: 11.5 }}
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            {/* Your Rank Highlight Row */}
            <div
              className="tai-row tai-between"
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                background: "var(--primary-tint)",
                border: "1px solid rgba(37, 99, 235, 0.2)",
                alignItems: "center",
              }}
            >
              <div className="tai-row tai-gap10" style={{ alignItems: "center" }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 900,
                    padding: "4px 9px",
                    borderRadius: 8,
                    background: "var(--primary)",
                    color: "#fff",
                  }}
                >
                  #{myRankNumber}
                </span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)" }}>Your rank</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>
                    {myPoints.toLocaleString()} pts • Level {myLevel}
                  </div>
                </div>
              </div>

              {nextRankPoints > 0 && (
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>
                  {nextRankPoints} pts to rank #{myRankNumber - 1}
                </span>
              )}
            </div>
          </div>

          {/* Weekly League Retention Card */}
          <WeeklyLeagueCard rows={leaderboardRows} loading={leaderboardQuery.loading} />
        </div>
      )}
    </div>
  );
}

export default CommunityScreen;
