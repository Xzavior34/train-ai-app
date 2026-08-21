import React, { useState, useMemo, useEffect } from "react";
import { TopBar, Avatar, Tag, timeAgo, initialsOf, ProgressBar } from "../components/LearnerUI.jsx";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  MessageCircle, Heart, Flame, Sparkles, Rocket, Users, Share2, Send, Plus,
  Search, Bookmark, ExternalLink, Calendar, CheckCircle2, Megaphone, Radio,
  Filter, Pin, ThumbsUp, Code2, Award, ChevronRight, Layers, Play, Clock,
  ArrowUpRight, MoreHorizontal, Check, X, HelpCircle, Image as ImageIcon,
  Palette, Zap, Target, MessageSquare, GraduationCap, Video, BookOpen
} from "lucide-react";
import { WeeklyLeagueCard } from "../components/retention/WeeklyLeagueCard.jsx";

export function CommunityScreen({
  communityTab = "feed", setCommunityTab, posts = [], postsQuery = {}, newPostText = "", setNewPostText,
  studyGroupsQuery = {}, joinedGroupIds = new Set(), communityPeopleQuery = {},
  memberStatsQuery = {}, activityFeedQuery = {},
  user = {}, session = {}, showToast = () => {},
  createCommunityPost, togglePostReaction, addPostComment,
  cohortMembershipQuery = {}, cohortPostsQuery = {}, cohortResourcesQuery = {},
  leaderboardQuery = {}, leaderboardEnabled = true,
  upcomingSessionsQuery = {}, push, goTab, initialExpandedPostId = null,
}) {
  const [selectedSpace, setSelectedSpace] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [postComposerOpen, setPostComposerOpen] = useState(false);
  const [composerType, setComposerType] = useState("discussion"); // discussion | showcase | question | resource
  const [composerTitle, setComposerTitle] = useState("");
  const [composerContent, setComposerContent] = useState("");
  const [composerTags, setComposerTags] = useState("Design & AI");
  const [composerImage, setComposerImage] = useState("");
  const [composerLink, setComposerLink] = useState("");
  const [posting, setPosting] = useState(false);

  const [expandedCommentsPostId, setExpandedCommentsPostId] = useState(initialExpandedPostId || null);
  const [replyInput, setReplyInput] = useState({});
  const [userReactions, setUserReactions] = useState({});
  const [activeTab, setActiveTab] = useState("feed"); // feed | events | circles | leaderboard

  // Rich Community Spaces (Disco LMS Architecture with Professional Icons)
  const SPACES = [
    { id: "all", label: "All Spaces", icon: Sparkles, count: 28 },
    { id: "announcements", label: "Announcements", icon: Megaphone, count: 4 },
    { id: "design-critique", label: "Design & UI Critique", icon: Palette, count: 9 },
    { id: "ai-engineering", label: "AI & Full-Stack", icon: Zap, count: 8 },
    { id: "showcase", label: "Project Showcase", icon: Rocket, count: 5 },
    { id: "general", label: "Lounge & Networking", icon: MessageSquare, count: 12 },
  ];

  // Rich Seed Community Posts with Multi-Reactions, Project Media, Comments
  const [feedPosts, setFeedPosts] = useState([
    {
      id: "post-spotlight-1",
      pinned: true,
      space: "announcements",
      spaceLabel: "Announcements",
      author: {
        name: "Astrid Larsson",
        title: "Lead AI Design Instructor • Staff Designer",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=140&auto=format&fit=crop&q=80",
        badge: "INSTRUCTOR",
        isStaff: true
      },
      time: "2 hours ago",
      title: "Live Critique Studio Tomorrow: Bring Your Spatial UI & Token Systems",
      content: "Hey everyone! For tomorrow's live studio at 10:00 AM EST, we'll be breaking down real student submissions from Module 3. If you want your Figma variables setup or React token exporter reviewed live with constructive feedback, post your Figma or GitHub link below!",
      tags: ["Masterclass", "Live Studio", "Spatial UI"],
      likes: 34,
      fires: 19,
      insights: 12,
      comments: [
        {
          id: "c-1",
          author: "Marcus Wright",
          avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
          role: "Learner",
          time: "1 hour ago",
          text: "Submitted my spatial glassmorphism widget! Really looking forward to the breakdown on gaze target padding."
        },
        {
          id: "c-2",
          author: "Elena Rostova",
          avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
          role: "Learner",
          time: "45 min ago",
          text: "Can we submit our Token JSON schema for validation as well? Excited for tomorrow!"
        }
      ]
    },
    {
      id: "post-showcase-1",
      pinned: false,
      space: "showcase",
      spaceLabel: "Project Showcase",
      author: {
        name: "David Kim",
        title: "Full-Stack AI Fellow • Batch 04",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=140&auto=format&fit=crop&q=80",
        badge: "STUDENT",
        isStaff: false
      },
      time: "4 hours ago",
      title: "Built an autonomous Figma plugin that converts vector icons into animated SVG React components using Gemini 2.5",
      content: "Wanted to share my capstone project for the Full-Stack AI track! The plugin analyzes selected Figma layers, optimizes paths, and injects Framer Motion spring physics with automated TypeScript typings. Check out the demo screenshot and let me know your thoughts!",
      imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&auto=format&fit=crop&q=80",
      projectLink: "https://github.com/train-ai/figma-motion-ai",
      tags: ["Project Showcase", "Figma API", "React", "Gemini AI"],
      likes: 48,
      fires: 27,
      insights: 15,
      comments: [
        {
          id: "c-3",
          author: "Dr. Elena Vance",
          avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80",
          role: "Instructor",
          time: "2 hours ago",
          text: "Outstanding architecture, David! The AST transform pass on the SVG tree is extremely clean."
        }
      ]
    },
    {
      id: "post-critique-1",
      pinned: false,
      space: "design-critique",
      spaceLabel: "Design & UI Critique",
      author: {
        name: "Chloe Chen",
        title: "Product Designer • Cohort 02",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=140&auto=format&fit=crop&q=80",
        badge: "STUDENT",
        isStaff: false
      },
      time: "6 hours ago",
      title: "Critique Request: Semantic Dark Mode Contrast for Data Viz Dashboards",
      content: "I'm refining the color tokens for our enterprise chart library. On 10% opacity fills, WCAG AA passes, but AAA fails on some OLED displays. Which token mapping strategy do you recommend for secondary metric lines?",
      codeSnippet: `// Token Definition
export const chartColors = {
  primaryGlow: "rgba(99, 102, 241, 0.25)",
  gridStroke: "var(--border-subtle)",
  activeNode: "#818CF8"
};`,
      tags: ["Design Critique", "Accessibility", "Design Tokens"],
      likes: 21,
      fires: 8,
      insights: 14,
      comments: []
    }
  ]);

  // Upcoming Community Events & AMAs (Disco LMS style)
  const UPCOMING_EVENTS = [
    {
      id: "ev-1",
      title: "Live Design System Office Hours with Astrid Larsson",
      type: "Live Workshop",
      date: "Tomorrow, 10:00 AM EST",
      attendees: 38,
      isRsvpd: true,
      speaker: "Astrid Larsson (Lead Facilitator)",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
    },
    {
      id: "ev-2",
      title: "Building Production RAG Systems with Vector Databases",
      type: "Guest AMA & Tech Talk",
      date: "Friday, 02:00 PM EST",
      attendees: 56,
      isRsvpd: false,
      speaker: "Dr. Elena Vance (AI Architect)",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80"
    },
    {
      id: "ev-3",
      title: "Weekly Cohort Demo Day & Peer Networking Lounge",
      type: "Community Social",
      date: "Saturday, 12:00 PM EST",
      attendees: 42,
      isRsvpd: true,
      speaker: "Cohort Facilitators",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80"
    }
  ];

  // Active Study Circles (Disco Circles)
  const STUDY_CIRCLES = [
    {
      id: "sc-1",
      name: "Figma Variables & Token Masters",
      topic: "Design Systems",
      membersCount: 16,
      activeSprint: "Module 4: Multi-brand Token Switcher",
      pace: "High Activity",
      goal: "Ship 3 reusable Figma UI kits by Friday"
    },
    {
      id: "sc-2",
      name: "Full-Stack LLM Builders Squad",
      topic: "AI Engineering",
      membersCount: 22,
      activeSprint: "Module 5: Hybrid Vector Search & Re-ranking",
      pace: "Daily Standups",
      goal: "Deploy 1 end-to-end AI assistant"
    },
    {
      id: "sc-3",
      name: "Spatial UI & VisionOS Explorers",
      topic: "Spatial Design",
      membersCount: 12,
      activeSprint: "Module 2: Depth Parallax & Glass Shader",
      pace: "Weekend Sprints",
      goal: "Prototype 3 spatial glassmorphism cards"
    }
  ];

  // Real posts (from the app's actual community_posts backend, via the
  // `posts` prop) are normalized into the same shape the rich demo feed
  // cards below expect, so both render through one card template. Real
  // posts only ever support plain content + a single like reaction + plain
  // comments - there's no title/image/link/multi-reaction column on
  // community_posts, so anything typed into those composer fields gets
  // folded into the post's content text at publish time instead of being
  // silently dropped.
  const realPostIds = useMemo(() => new Set(posts.map(p => p.id)), [posts]);
  const realFeedPosts = useMemo(() => posts.map(p => ({
    id: p.id,
    isReal: true,
    pinned: !!p.pinned,
    space: "general",
    spaceLabel: "Lounge & Networking",
    author: {
      name: p.author,
      title: p.isMine ? "You" : "Community member",
      avatar: null,
      badge: null,
      isStaff: false,
    },
    time: p.time,
    title: null,
    content: p.content,
    imageUrl: null,
    projectLink: null,
    tags: p.tags || [],
    likes: p.likes,
    fires: 0,
    insights: 0,
    liked: p.liked,
    moderationStatus: p.moderationStatus,
    isMine: p.isMine,
    comments: (p.replies || []).map(r => ({ id: r.id, author: r.author, avatar: null, role: "Learner", time: r.time, text: r.text })),
  })), [posts]);

  function handleAddReaction(postId, type) {
    if (realPostIds.has(postId)) {
      if (type !== "like") { showToast("Only likes are supported on real community posts right now."); return; }
      if (!session?.user?.id || !togglePostReaction) return;
      togglePostReaction({ postId, userId: session.user.id, reactionType: "like" })
        .then(() => postsQuery.refetch?.())
        .catch((e) => showToast(e?.message || "Could not react to this post."));
      return;
    }

    setUserReactions(prev => {
      const current = prev[postId] || {};
      const nextActive = !current[type];
      return {
        ...prev,
        [postId]: { ...current, [type]: nextActive }
      };
    });

    setFeedPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const isAlreadyActive = userReactions[postId]?.[type];
      const delta = isAlreadyActive ? -1 : 1;
      if (type === "like") return { ...p, likes: Math.max(0, p.likes + delta) };
      if (type === "fire") return { ...p, fires: Math.max(0, p.fires + delta) };
      if (type === "insight") return { ...p, insights: Math.max(0, p.insights + delta) };
      return p;
    }));
  }

  async function handleAddComment(postId) {
    const text = replyInput[postId]?.trim();
    if (!text) return;

    if (realPostIds.has(postId)) {
      if (!session?.user?.id || !addPostComment) return;
      try {
        await addPostComment({ postId, userId: session.user.id, content: text });
        setReplyInput(prev => ({ ...prev, [postId]: "" }));
        await postsQuery.refetch?.();
        showToast("Comment posted!");
      } catch (e) {
        showToast(e?.message || "Could not post your comment.");
      }
      return;
    }

    const newComment = {
      id: `c-${Date.now()}`,
      author: user.name || "Evelyn Hayes",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
      role: "Learner",
      time: "Just now",
      text
    };

    setFeedPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      return { ...p, comments: [...(p.comments || []), newComment] };
    }));

    setReplyInput(prev => ({ ...prev, [postId]: "" }));
    showToast("Comment posted!");
  }

  async function handleCreatePost() {
    if (!composerContent.trim()) {
      showToast("Please write something before posting.");
      return;
    }
    if (!session?.user?.id || !createCommunityPost) {
      showToast("You need to be signed in to post.");
      return;
    }

    setPosting(true);
    try {
      // Fold every composer field into one content string since
      // community_posts only has a plain `content` column - nothing typed
      // here is silently dropped, it's just rendered as text instead of a
      // dedicated title/image/link chip once it comes back from the server.
      const parts = [];
      if (composerTitle.trim()) parts.push(`**${composerTitle.trim()}**`);
      parts.push(composerContent.trim());
      if (composerLink.trim()) parts.push(`🔗 ${composerLink.trim()}`);
      if (composerImage.trim()) parts.push(`🖼️ ${composerImage.trim()}`);
      const tagList = composerTags.split(",").map(t => t.trim()).filter(Boolean);
      if (tagList.length) parts.push(tagList.map(t => `#${t.replace(/\s+/g, "")}`).join(" "));

      await createCommunityPost({
        userId: session.user.id,
        content: parts.join("\n\n"),
        postType: composerType === "question" ? "question" : "text",
      });

      setComposerTitle("");
      setComposerContent("");
      setComposerImage("");
      setComposerLink("");
      setComposerTags("Design & AI");
      setPostComposerOpen(false);
      await postsQuery.refetch?.();
      showToast("Post shared with the community!");
    } catch (e) {
      showToast(e?.message || "Could not publish your post.");
    } finally {
      setPosting(false);
    }
  }

  const combinedFeedPosts = useMemo(() => [...realFeedPosts, ...feedPosts], [realFeedPosts, feedPosts]);

  const filteredFeedPosts = combinedFeedPosts.filter(p => {
    if (selectedSpace !== "all" && p.space !== selectedSpace) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = p.title ? p.title.toLowerCase().includes(q) : false;
      if (!matchesTitle && !p.content.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      {/* =========================================================================
          HERO BANNER: DISCO LMS COMMUNITY & COLLABORATIVE KNOWLEDGE HUB
          ========================================================================= */}
      <div style={{
        borderRadius: 18,
        background: "linear-gradient(135deg, rgba(15,23,42,0.94) 0%, rgba(30,27,75,0.88) 100%)",
        color: "#FFFFFF",
        padding: "clamp(16px, 2.5vw, 24px)",
        boxShadow: "0 10px 28px -4px rgba(15, 23, 42, 0.35)",
        border: "1px solid rgba(99, 102, 241, 0.35)",
        position: "relative",
        overflow: "hidden",
        width: "100%",
        boxSizing: "border-box"
      }}>
        {/* Background Stock Photo with Overlay */}
        <img
          src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1400&auto=format&fit=crop&q=85"
          alt=""
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", opacity: 0.28, zIndex: 0
          }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(100deg, rgba(15,23,42,0.96) 0%, rgba(30,27,75,0.82) 55%, rgba(15,23,42,0.65) 100%)",
          zIndex: 0
        }} />

        <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ minWidth: 0, flex: "1 1 240px" }}>
            <h1 style={{ fontSize: "clamp(19px, 2.2vw, 24px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 4px", color: "#FFFFFF", textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
              Train AI Community Hub
            </h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", margin: 0, maxWidth: 580, lineHeight: 1.45 }}>
              Share projects, ask questions, and collaborate with peers and mentors.
            </p>
          </div>

          <button
            className="tai-btn"
            onClick={() => setPostComposerOpen(true)}
            style={{
              background: "var(--grad)", color: "#FFFFFF", fontWeight: 800, fontSize: 13,
              padding: "9px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer",
              boxShadow: "0 4px 16px rgba(79, 70, 229, 0.4)", display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0
            }}
          >
            <Plus size={16} /> Share or Ask Question
          </button>
        </div>
      </div>

      {/* =========================================================================
          CONTROLS: Search & Disco Navigation Tabs
          ========================================================================= */}
      <div className="tai-col tai-gap12">
        <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 12 }}>
          
          {/* Search Input */}
          <div style={{ flex: "1 1 200px", minWidth: 0, position: "relative" }}>
            <Search size={16} color="var(--text-3)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Search community discussions, project showcases, or questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%", height: 44, paddingLeft: 42, paddingRight: 14,
                borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--surface)",
                fontSize: 13.5, color: "var(--text)", outline: "none"
              }}
            />
          </div>

          {/* Primary View Mode Tabs */}
          <div className="tai-scrollx" style={{ paddingBottom: 4, width: "100%", boxSizing: "border-box" }}>
            {[
              { k: "feed", label: "Community Feed", icon: MessageCircle },
              { k: "instructors", label: "Instructors & Faculty", icon: GraduationCap },
              { k: "events", label: "Live Events & AMAs", icon: Calendar },
              { k: "circles", label: "Study Circles", icon: Users },
              { k: "leaderboard", label: "Leaderboard", icon: Award },
            ].map(t => {
              const Icon = t.icon;
              const isSelected = activeTab === t.k;
              return (
                <button
                  key={t.k}
                  onClick={() => {
                    if (t.k === "leaderboard") {
                      push("leaderboard");
                    } else {
                      setActiveTab(t.k);
                    }
                  }}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: isSelected ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                    background: isSelected ? "var(--primary-tint)" : "var(--surface)",
                    color: isSelected ? "var(--primary)" : "var(--text-2)",
                    fontSize: 12.5,
                    fontWeight: isSelected ? 800 : 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease"
                  }}
                  onMouseEnter={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = "var(--primary-light)"; e.currentTarget.style.color = "var(--text)"; } }}
                  onMouseLeave={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-2)"; } }}
                >
                  <Icon size={14} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Space Channels Horizontal Bar */}
        {activeTab === "feed" && (
          <div className="tai-scrollx" style={{ paddingBottom: 4, width: "100%", boxSizing: "border-box" }}>
            {SPACES.map(sp => {
              const Icon = sp.icon;
              const isActive = selectedSpace === sp.id;
              return (
                <button
                  key={sp.id}
                  onClick={() => setSelectedSpace(sp.id)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: isActive ? "var(--primary)" : "var(--surface-2)",
                    color: isActive ? "#FFFFFF" : "var(--text-2)",
                    fontWeight: isActive ? 800 : 600,
                    fontSize: 12.5,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                    transition: "all 0.15s ease"
                  }}
                >
                  <Icon size={14} />
                  <span>{sp.label}</span>
                  <span style={{ opacity: 0.75, fontSize: 11, fontWeight: 700 }}>({sp.count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          POST COMPOSER MODAL
          ========================================================================= */}
      {postComposerOpen && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 500,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20
        }}>
          <div className="tai-card" style={{ maxWidth: 580, width: "100%", padding: 24, borderRadius: 20 }}>
            <div className="tai-row tai-between" style={{ marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
              <div className="tai-row tai-gap8">
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MessageCircle size={16} color="var(--primary)" />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Create Community Post</h3>
              </div>
              <button className="tai-iconbtn" onClick={() => setPostComposerOpen(false)}><X size={16} /></button>
            </div>

            <div className="tai-col tai-gap12">
              <div>
                <label className="tai-label">Post Title</label>
                <input
                  className="tai-input tai-mt6"
                  placeholder="e.g. Feedback on my new Figma UI kit tokens..."
                  value={composerTitle}
                  onChange={(e) => setComposerTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="tai-label">Details / Question Content</label>
                <textarea
                  className="tai-input tai-mt6"
                  rows={4}
                  placeholder="Share your progress, describe what you built, or ask a specific question..."
                  value={composerContent}
                  onChange={(e) => setComposerContent(e.target.value)}
                />
              </div>

              <div className="tai-grid2">
                <div>
                  <label className="tai-label">Image or Screenshot URL (optional)</label>
                  <input
                    className="tai-input tai-mt6"
                    placeholder="https://..."
                    value={composerImage}
                    onChange={(e) => setComposerImage(e.target.value)}
                  />
                </div>
                <div>
                  <label className="tai-label">External Repository Link (optional)</label>
                  <input
                    className="tai-input tai-mt6"
                    placeholder="https://github.com/..."
                    value={composerLink}
                    onChange={(e) => setComposerLink(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="tai-label">Tags (comma separated)</label>
                <input
                  className="tai-input tai-mt6"
                  placeholder="Design Tokens, Figma, AI, Frontend"
                  value={composerTags}
                  onChange={(e) => setComposerTags(e.target.value)}
                />
              </div>

              <div className="tai-row tai-between tai-mt14">
                <button className="tai-btn tai-btn-ghost" onClick={() => setPostComposerOpen(false)}>
                  Cancel
                </button>
                <button className="tai-btn tai-btn-primary" onClick={handleCreatePost} disabled={posting}>
                  {posting ? "Publishing…" : "Publish Post →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 1: RICH COMMUNITY FEED (DISCO LMS FEED)
          ========================================================================= */}
      {activeTab === "feed" && (
        <div className="tai-dashboard-grid">
          
          {/* Main Feed Column */}
          <div className="tai-col tai-gap18" style={{ minWidth: 0, width: "100%" }}>
            
            {filteredFeedPosts.map(post => {
              const reactions = post.isReal
                ? { like: !!post.liked }
                : (userReactions[post.id] || {});
              const isCommentsOpen = expandedCommentsPostId === post.id;

              return (
                <div
                  key={post.id}
                  id={`community-post-${post.id}`}
                  className="tai-card"
                  style={{
                    padding: "18px 16px",
                    borderRadius: 16,
                    border: post.pinned ? "1.5px solid rgba(99, 102, 241, 0.45)" : "1px solid var(--border)",
                    boxShadow: post.pinned ? "0 4px 20px rgba(79, 70, 229, 0.08)" : "var(--shadow-card)",
                    background: "var(--surface)",
                    width: "100%",
                    boxSizing: "border-box"
                  }}
                >
                  {/* Pinned & Space Tag - Wrapped Cleanly Without Overlapping */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, minWidth: 0 }}>
                      {post.pinned && (
                        <span style={{ background: "rgba(245, 158, 11, 0.15)", color: "#D97706", fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                          <Pin size={11} /> PINNED ANNOUNCEMENT
                        </span>
                      )}
                      <Tag tone="primary">{post.spaceLabel}</Tag>
                    </div>
                    <span style={{ fontSize: 11.5, color: "var(--text-3)", flexShrink: 0, marginLeft: "auto" }}>{post.time}</span>
                  </div>

                  {/* Author Header */}
                  <div className="tai-row tai-gap12" style={{ marginBottom: 14 }}>
                    <Avatar src={post.author.avatar} initials={initialsOf(post.author.name)} size={44} />
                    <div>
                      <div className="tai-row tai-gap6">
                        <span style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text)" }}>{post.author.name}</span>
                        {post.author.isStaff && (
                          <span style={{ background: "#4F46E5", color: "#fff", fontSize: 9.5, fontWeight: 800, padding: "1px 6px", borderRadius: 4 }}>
                            {post.author.badge}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-3)" }}>{post.author.title}</div>
                    </div>
                  </div>

                  {/* Post Title & Body */}
                  {post.title && (
                    <h3 style={{ fontSize: 16.5, fontWeight: 800, color: "var(--text)", margin: "0 0 8px", lineHeight: 1.35 }}>
                      {post.title}
                    </h3>
                  )}
                  {post.isMine && post.moderationStatus && post.moderationStatus !== "approved" && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: post.moderationStatus === "rejected" ? "var(--danger)" : "var(--warning)", marginBottom: 8 }}>
                      {post.moderationStatus === "rejected" ? "Not approved - only visible to you" : "Pending review - only visible to you until approved"}
                    </div>
                  )}
                  <p style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.6, margin: "0 0 14px", whiteSpace: "pre-wrap" }}>
                    {post.content}
                  </p>

                  {/* Code Snippet Attachment */}
                  {post.codeSnippet && (
                    <pre style={{
                      background: "#0F172A", color: "#E2E8F0", padding: "14px 16px",
                      borderRadius: 12, fontSize: 12, lineHeight: 1.5, overflowX: "auto", margin: "0 0 14px",
                      fontFamily: "monospace"
                    }}>
                      <code>{post.codeSnippet}</code>
                    </pre>
                  )}

                  {/* Image Attachment */}
                  {post.imageUrl && (
                    <div style={{ width: "100%", height: 220, borderRadius: 14, overflow: "hidden", marginBottom: 14 }}>
                      <img src={post.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  )}

                  {/* Project External Link */}
                  {post.projectLink && (
                    <a
                      href={post.projectLink}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        background: "var(--surface-2)", color: "var(--primary)",
                        padding: "6px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700,
                        textDecoration: "none", marginBottom: 14
                      }}
                    >
                      <ExternalLink size={13} /> View Live Project Repository →
                    </a>
                  )}

                  {/* Tags */}
                  {post.tags && post.tags.length > 0 && (
                    <div className="tai-row tai-gap6" style={{ flexWrap: "wrap", marginBottom: 14 }}>
                      {post.tags.map(t => (
                        <span key={t} style={{ fontSize: 11, color: "var(--text-3)", background: "var(--surface-3)", padding: "2px 8px", borderRadius: 6 }}>
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Reactions & Comment Trigger Strip */}
                  <div className="tai-row tai-between" style={{ paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                    <div className="tai-row tai-gap8">
                      <button
                        onClick={() => handleAddReaction(post.id, "like")}
                        style={{
                          background: reactions.like ? "#FEE2E2" : "var(--surface-2)",
                          color: reactions.like ? "#EF4444" : "var(--text-2)",
                          border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 700,
                          cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4
                        }}
                      >
                        <Heart size={13} fill={reactions.like ? "#EF4444" : "none"} /> {post.likes}
                      </button>

                      {!post.isReal && (
                        <button
                          onClick={() => handleAddReaction(post.id, "fire")}
                          style={{
                            background: reactions.fire ? "#FEF3C7" : "var(--surface-2)",
                            color: reactions.fire ? "#D97706" : "var(--text-2)",
                            border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 700,
                            cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4
                          }}
                        >
                          <Flame size={13} color="#D97706" /> {post.fires}
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => setExpandedCommentsPostId(isCommentsOpen ? null : post.id)}
                      style={{
                        background: "transparent", border: "none", color: "var(--primary)",
                        fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4
                      }}
                    >
                      <MessageCircle size={14} /> {post.comments?.length || 0} Comments
                    </button>
                  </div>

                  {/* Expanded Comments Thread */}
                  {isCommentsOpen && (
                    <div className="tai-col tai-gap10" style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                      {(post.comments || []).map(c => (
                        <div key={c.id} style={{ background: "var(--surface-3)", padding: "10px 14px", borderRadius: 12 }}>
                          <div className="tai-row tai-between">
                            <div className="tai-row tai-gap8">
                              <Avatar src={c.avatar} initials={initialsOf(c.author)} size={24} />
                              <span style={{ fontWeight: 700, fontSize: 12.5, color: "var(--text)" }}>{c.author}</span>
                              <span style={{ fontSize: 10, color: "var(--primary)", fontWeight: 700 }}>• {c.role}</span>
                            </div>
                            <span style={{ fontSize: 11, color: "var(--text-3)" }}>{c.time}</span>
                          </div>
                          <p style={{ fontSize: 12.5, color: "var(--text-2)", margin: "6px 0 0", lineHeight: 1.45 }}>
                            {c.text}
                          </p>
                        </div>
                      ))}

                        {/* Inline Reply Composer */}
                        <div className="tai-row tai-gap8" style={{ marginTop: 6 }}>
                          <input
                            type="text"
                            placeholder="Write a supportive reply..."
                            value={replyInput[post.id] || ""}
                            onChange={(e) => setReplyInput(prev => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") handleAddComment(post.id); }}
                            style={{
                              flex: 1, height: 38, padding: "0 14px", borderRadius: 10,
                              border: "1px solid var(--border)", background: "var(--surface)",
                              fontSize: 12.5, outline: "none"
                            }}
                          />
                          <button
                            className="tai-btn tai-btn-primary tai-btn-sm"
                            onClick={() => handleAddComment(post.id)}
                            style={{ height: 38, padding: "0 14px" }}
                          >
                            <Send size={13} />
                          </button>
                        </div>
                    </div>
                  )}

                </div>
              );
            })}

          </div>

          {/* Right Sidebar: Disco LMS Widgets & Live Sessions */}
          <div className="tai-col tai-gap18">
            
            {/* Live Studio & AMAs Mini Card */}
            <div className="tai-card" style={{
              background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)",
              color: "#FFFFFF", padding: 20, borderRadius: 18
            }}>
              <div className="tai-row tai-between">
                <span style={{ background: "rgba(239, 68, 68, 0.25)", color: "#FCA5A5", border: "1px solid rgba(239,68,68,0.4)", fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 6 }}>
                  UPCOMING LIVE
                </span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>Studio 1</span>
              </div>
              <h4 style={{ fontSize: 15, fontWeight: 800, margin: "10px 0 4px", color: "#fff" }}>
                Spatial UI &amp; Design Systems Critique
              </h4>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", margin: "0 0 14px" }}>
                Tomorrow at 10:00 AM • Astrid Larsson
              </p>
              <button
                className="tai-btn"
                onClick={() => showToast("RSVP Confirmed! Calendar invite sent.")}
                style={{
                  width: "100%", background: "#4F46E5", color: "#fff", border: "none",
                  padding: "9px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 800, cursor: "pointer"
                }}
              >
                RSVP for Studio Stream →
              </button>
            </div>

            {/* Weekly Community Leaderboard Widget */}
            {leaderboardEnabled && (
              <WeeklyLeagueCard rows={leaderboardQuery.data || []} loading={leaderboardQuery.loading} />
            )}

            {/* Study Circles Preview Widget */}
            <div className="tai-card" style={{ padding: 20, borderRadius: 18 }}>
              <div className="tai-row tai-between" style={{ marginBottom: 12 }}>
                <h4 style={{ fontSize: 14.5, fontWeight: 800, margin: 0, color: "var(--text)" }}>
                  Featured Study Circles
                </h4>
                <button
                  onClick={() => setActiveTab("circles")}
                  style={{ background: "transparent", border: "none", color: "var(--primary)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  View All →
                </button>
              </div>

              <div className="tai-col tai-gap10">
                {STUDY_CIRCLES.slice(0, 2).map(c => (
                  <div key={c.id} style={{ background: "var(--surface-3)", padding: 12, borderRadius: 12 }}>
                    <div className="tai-row tai-between">
                      <span style={{ fontWeight: 800, fontSize: 13, color: "var(--text)" }}>{c.name}</span>
                      <span style={{ fontSize: 11, color: "var(--primary)", fontWeight: 700 }}>{c.membersCount} peers</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>{c.activeSprint}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* =========================================================================
          VIEW 2: LIVE EVENTS & AMAS (DISCO LMS EVENTS CALENDAR)
          ========================================================================= */}
      {activeTab === "events" && (
        <div className="tai-col tai-gap16">
          <div className="tai-row tai-between">
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: "var(--text)", margin: "0 0 2px" }}>
                Community Workshops, Studios &amp; AMAs
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
                Interactive live streams, portfolio reviews, and guest tech talks with industry leaders.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
            {UPCOMING_EVENTS.map(ev => (
              <div key={ev.id} className="tai-card" style={{ padding: 22, borderRadius: 18, background: "var(--surface)" }}>
                <div className="tai-row tai-between" style={{ marginBottom: 10 }}>
                  <span style={{ background: "rgba(99, 102, 241, 0.12)", color: "var(--primary)", fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 8 }}>
                    {ev.type}
                  </span>
                  <span className="tai-row tai-gap4" style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>
                    <Users size={13} /> {ev.attendees} attending
                  </span>
                </div>

                <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", margin: "0 0 8px", lineHeight: 1.35 }}>
                  {ev.title}
                </h3>

                <div className="tai-row tai-gap8" style={{ fontSize: 12.5, color: "var(--text-2)", marginBottom: 14 }}>
                  <Calendar size={14} color="var(--primary)" />
                  <span>{ev.date}</span>
                </div>

                <div className="tai-row tai-between" style={{ paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                  <div className="tai-row tai-gap8">
                    <Avatar src={ev.avatar} initials="AL" size={32} />
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{ev.speaker}</div>
                  </div>

                  <button
                    className="tai-btn tai-btn-primary tai-btn-sm"
                    onClick={() => showToast(`RSVP Confirmed for ${ev.title}!`)}
                  >
                    {ev.isRsvpd ? "RSVP'd ✓" : "RSVP Now"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: STUDY CIRCLES (DISCO LMS CIRCLES)
          ========================================================================= */}
      {activeTab === "circles" && (
        <div className="tai-col tai-gap16">
          {(() => {
            const myCohort = cohortMembershipQuery.data?.cohort;
            const cohortPosts = cohortPostsQuery.data || [];
            const cohortResources = cohortResourcesQuery.data || [];
            if (cohortMembershipQuery.loading) {
              return <div className="tai-card tai-fade-in" style={{ padding: 20, borderRadius: 18 }}>Loading your cohort…</div>;
            }
            if (!myCohort) return null;
            return (
              <div
                className="tai-card tai-card-hover tai-fade-in"
                style={{ padding: 20, borderRadius: 18, background: "var(--grad-subtle)", border: "1px solid var(--primary-light)", cursor: "pointer" }}
                onClick={() => goTab?.("cohort")}
              >
                <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 12 }}>
                  <div className="tai-row tai-gap10" style={{ minWidth: 0 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--grad)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Users size={20} color="#fff" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="tai-row tai-gap8" style={{ marginBottom: 2 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)", textTransform: "uppercase", letterSpacing: ".04em" }}>Your Cohort</span>
                      </div>
                      <h3 style={{ fontSize: 15.5, fontWeight: 800, color: "var(--text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {myCohort.name}
                      </h3>
                    </div>
                  </div>
                  <button
                    className="tai-btn tai-btn-primary tai-btn-sm"
                    onClick={(e) => { e.stopPropagation(); goTab?.("cohort"); }}
                  >
                    Open Cohort Hub <ChevronRight size={14} />
                  </button>
                </div>

                {(cohortPosts.length > 0 || cohortResources.length > 0) && (
                  <div className="tai-row tai-gap20" style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
                    {cohortPosts[0] && (
                      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", marginBottom: 4 }}>Latest cohort update</div>
                        <div style={{ fontSize: 13, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {cohortPosts[0].content}
                        </div>
                      </div>
                    )}
                    {cohortResources.length > 0 && (
                      <div style={{ flexShrink: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", marginBottom: 4 }}>Shared resources</div>
                        <div className="tai-row tai-gap6" style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>
                          <FileText size={14} /> {cohortResources.length}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="tai-row tai-between">
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: "var(--text)", margin: "0 0 2px" }}>
                Study Circles &amp; Accountability Squads
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
                Join micro-cohorts of 8–15 learners tackling specific syllabus modules and capstone projects together.
              </p>
            </div>

            <button
              className="tai-btn tai-btn-primary tai-btn-sm"
              onClick={() => showToast("Circle creation form opened!")}
            >
              <Plus size={14} /> Create Study Circle
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
            {STUDY_CIRCLES.map(sc => (
              <div key={sc.id} className="tai-card" style={{ padding: 22, borderRadius: 18, background: "var(--surface)" }}>
                <div className="tai-row tai-between" style={{ marginBottom: 8 }}>
                  <Tag tone="primary">{sc.topic}</Tag>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "var(--success)", background: "rgba(16, 185, 129, 0.1)", padding: "2px 8px", borderRadius: 6 }}>
                    {sc.pace}
                  </span>
                </div>

                <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", margin: "0 0 6px" }}>
                  {sc.name}
                </h3>
                <p style={{ fontSize: 12.5, color: "var(--text-2)", margin: "0 0 12px" }}>
                  Sprint: <strong>{sc.activeSprint}</strong>
                </p>

                <div style={{ background: "var(--surface-3)", padding: "10px 12px", borderRadius: 10, fontSize: 12, color: "var(--text-2)", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  <Target size={14} color="var(--primary)" /> <span><strong>Goal:</strong> {sc.goal}</span>
                </div>

                <div className="tai-row tai-between" style={{ paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>{sc.membersCount} Members</span>
                  <button
                    className="tai-btn tai-btn-primary tai-btn-sm"
                    onClick={() => showToast(`Joined ${sc.name}!`)}
                  >
                    Join Circle →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW: INSTRUCTORS & FACULTY
          ========================================================================= */}
      {activeTab === "instructors" && (
        <div className="tai-col tai-gap20">
          <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: "var(--text)", margin: "0 0 2px" }}>
                Course Instructors &amp; Faculty Leads
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
                Directly connect with course authors, join weekly office hours, or schedule 1:1 mentorship sessions.
              </p>
            </div>

            <button
              className="tai-btn tai-btn-primary tai-btn-sm"
              onClick={() => push("mentors")}
            >
              <GraduationCap size={14} /> View All Mentors &amp; Booking
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            {[
              {
                id: "inst-1",
                name: "Astrid Larsson",
                role: "Lead AI Design & Spatial Systems Instructor",
                org: "Ex-Spotify • Lead UX Architect",
                avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80",
                badge: "FACULTY LEAD",
                coursesCount: 3,
                hours: "Today at 4:00 PM EST",
                rating: 4.98,
                bio: "Specializes in design token variable architectures, spatial visionOS interfaces, and generative AI design pipelines."
              },
              {
                id: "inst-2",
                name: "Alex Rivera",
                role: "Principal AI Engineer & Full-Stack Lead",
                org: "AI Infrastructure Specialist",
                avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80",
                badge: "STAFF INSTRUCTOR",
                coursesCount: 4,
                hours: "Tomorrow at 2:00 PM EST",
                rating: 4.95,
                bio: "Author of Full-Stack AI Engineering. Expert in LangChain, vector databases, multi-agent orchestration, and prompt caching."
              },
              {
                id: "inst-3",
                name: "Dr. Elena Vance",
                role: "Academic Director & Machine Learning Lead",
                org: "PhD Stanford AI Lab",
                avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&auto=format&fit=crop&q=80",
                badge: "ACADEMIC DIRECTOR",
                coursesCount: 2,
                hours: "Thursday at 11:00 AM EST",
                rating: 5.0,
                bio: "Leads syllabus rigor, peer review standards, and capstone evaluations across all AI certification batches."
              },
              {
                id: "inst-4",
                name: "Wale Adebayo",
                role: "Senior Engineering Lead & Systems Architect",
                org: "Cloud Architecture Lead",
                avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&auto=format&fit=crop&q=80",
                badge: "SENIOR INSTRUCTOR",
                coursesCount: 3,
                hours: "Friday at 3:30 PM EST",
                rating: 4.92,
                bio: "Teaches microservices, real-time distributed architecture, and secure enterprise AI application deployment."
              }
            ].map(inst => (
              <div
                key={inst.id}
                className="tai-card"
                style={{
                  padding: 22,
                  borderRadius: 18,
                  background: "var(--surface)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  border: "1px solid var(--border)",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.03)"
                }}
              >
                <div>
                  <div className="tai-row tai-gap14" style={{ marginBottom: 14 }}>
                    <img
                      src={inst.avatar}
                      alt={inst.name}
                      style={{
                        width: 56, height: 56, borderRadius: 16, objectFit: "cover",
                        border: "2px solid var(--primary-light)", flexShrink: 0
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="tai-row tai-between" style={{ alignItems: "flex-start", gap: 6 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", margin: 0 }}>
                          {inst.name}
                        </h3>
                        <Tag tone="primary">{inst.badge}</Tag>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)", marginTop: 2 }}>
                        {inst.role}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>
                        {inst.org}
                      </div>
                    </div>
                  </div>

                  <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.45, margin: "0 0 14px" }}>
                    {inst.bio}
                  </p>

                  <div style={{
                    background: "var(--surface-3)", padding: "10px 12px", borderRadius: 12,
                    border: "1px solid var(--border)", fontSize: 11.5, color: "var(--text-2)",
                    display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16
                  }}>
                    <span className="tai-row tai-gap6">
                      <Clock size={13} color="var(--primary)" />
                      <span><strong>Next Live Session:</strong> {inst.hours}</span>
                    </span>
                    <span className="tai-row tai-gap4" style={{ fontWeight: 800, color: "#F59E0B" }}>
                      ★ {inst.rating}
                    </span>
                  </div>
                </div>

                <div className="tai-row tai-gap10">
                  <button
                    className="tai-btn tai-btn-outline tai-btn-sm"
                    style={{ flex: 1, padding: "8px 12px", fontSize: 12, fontWeight: 700 }}
                    onClick={() => push("messages", { recipientId: inst.id, recipientName: inst.name })}
                  >
                    <MessageSquare size={13} /> Message
                  </button>
                  <button
                    className="tai-btn tai-btn-primary tai-btn-sm"
                    style={{ flex: 1, padding: "8px 12px", fontSize: 12, fontWeight: 700 }}
                    onClick={() => push("mentors", { mentorId: inst.id })}
                  >
                    <Video size={13} /> Book 1:1 Office Hours
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 4: LEADERBOARD
          ========================================================================= */}
      {activeTab === "leaderboard" && (
        <div className="tai-col tai-gap16">
          <div className="tai-row tai-between">
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: "var(--text)", margin: "0 0 2px" }}>
                Weekly Cohort Leaderboard &amp; Top Helpers
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
                Earn XP points and league status by completing lessons, submitting assignments, and helping peers.
              </p>
            </div>

            <button
              className="tai-btn tai-btn-primary tai-btn-sm"
              onClick={() => push("leaderboard")}
            >
              <Award size={14} /> Full Leaderboard &amp; Podium →
            </button>
          </div>

          <WeeklyLeagueCard rows={leaderboardQuery.data || []} loading={leaderboardQuery.loading} />
        </div>
      )}

    </div>
  );
}
