import React, { useState, useMemo } from "react";
import {
  Users, GraduationCap, Trophy, ChevronRight, Plus, Search, Heart, MessageCircle,
  MessageSquare, Send, Pin, Trash2, ArrowLeft, Layers, Mail, Sparkles, Crown, Star,
  Flame, Zap, Clock, Share2, X, BookOpen, UserCheck, Shield, TrendingUp,
  RefreshCw, CheckCircle2, MoreVertical, ExternalLink, Activity, Info, Award,
  Quote, Lock, Bookmark, Copy, Flag, EyeOff, Pencil, Check,
} from "lucide-react";
import { Avatar, initialsOf, timeAgo, Tag } from "../components/LearnerUI.jsx";
import { WeeklyLeagueCard } from "../components/retention/WeeklyLeagueCard.jsx";
import CommunityHero from "../components/CommunityHero.jsx";
import { LeaderboardPanel } from "../components/LeaderboardPanel.jsx";
import { fetchLeaderboardForPeriod } from "../../lib/api/learner.js";
import { MessagesScreen } from "./MessagesScreen.jsx";

// ---------------------------------------------------------------------------
// Train AI 2.0 Community Screen
// Exact 1.0 Production Community Hub (trainailtd.com) Replication
// 6 Flat Tabs: Summary | Posts | Groups | Instructors | Cohorts | Rank
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
    Icon: Flame,
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
    label: "Community Champion",
    nextLabel: null,
    Icon: Crown,
    color: "#059669",
    bg: "rgba(5, 150, 105, 0.12)",
    border: "rgba(5, 150, 105, 0.25)",
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
          {latestActivity?.activity_text || "No recent activity yet."}
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
  const TierIcon = tier.Icon;
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
        <Star size={16} color="var(--primary)" />
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
          className="tai-row tai-gap4"
          style={{
            fontSize: 11.5,
            fontWeight: 800,
            padding: "3px 12px",
            borderRadius: 999,
            background: tier.bg,
            color: tier.color,
            border: `1px solid ${tier.border}`,
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <TierIcon size={12} /> {tier.label}
        </span>
      </div>

      <div className="tai-row tai-gap8" style={{ marginTop: 4 }}>
        {[
          { label: "Posts", value: postsCount, icon: MessageSquare },
          { label: "Replies", value: repliesCount, icon: MessageCircle },
          { label: "Score", value: score, icon: Zap },
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
// Daily Motivation Quote Widget (Tab 6: Rank)
// ---------------------------------------------------------------------------
const MOTIVATION_QUOTES = [
  {
    quote: "The more that you read, the more things you will know. The more that you learn, the more places you'll go.",
    author: "Dr. Seuss",
  },
  {
    quote: "Live as if you were to die tomorrow. Learn as if you were to live forever.",
    author: "Mahatma Gandhi",
  },
  {
    quote: "Learning is not attained by chance, it must be sought for with ardor and attended to with diligence.",
    author: "Abigail Adams",
  },
  {
    quote: "Success is the sum of small efforts, repeated day in and day out.",
    author: "Robert Collier",
  },
];

function DailyMotivationWidget() {
  const [index] = useState(() => Math.floor(Math.random() * MOTIVATION_QUOTES.length));
  const item = MOTIVATION_QUOTES[index] || MOTIVATION_QUOTES[0];

  return (
    <div
      className="tai-card"
      style={{
        padding: "20px 22px",
        background: "var(--glass-surface)",
        border: "1px solid var(--glass-border)",
        borderRadius: 16,
        boxShadow: "var(--glass-shadow)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div className="tai-row tai-gap10" style={{ alignItems: "flex-start" }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "rgba(37, 99, 235, 0.12)",
            border: "1px solid rgba(37, 99, 235, 0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Quote size={18} color="var(--primary)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              fontStyle: "italic",
              color: "var(--text)",
              lineHeight: 1.6,
            }}
          >
            "{item.quote}"
          </p>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)", marginTop: 6 }}>
            — {item.author}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            padding: "2px 8px",
            borderRadius: 999,
            background: "var(--primary-tint)",
            color: "var(--primary)",
            border: "1px solid rgba(37, 99, 235, 0.25)",
            letterSpacing: "0.02em",
          }}
        >
          ✨ Daily Motivation
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Post Card Component (Matching Exact 1.0 Production Layout)
// ---------------------------------------------------------------------------
function PostCard({
  post,
  authorStats,
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
  const [isSaved, setIsSaved] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [aiSummaryModalOpen, setAiSummaryModalOpen] = useState(false);
  const [toastNotice, setToastNotice] = useState(null);

  function showToast(msg) {
    setToastNotice(msg);
    setTimeout(() => setToastNotice(null), 3000);
  }

  // Author tier badge computed live from real post/comment counts
  const postScore = (authorStats?.posts || 1) * 10 + (authorStats?.comments || 0) * 5;
  const authorTier = computeTier(postScore);
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

  if (isHidden) {
    return (
      <div
        className="tai-card anim-fade-in"
        style={{
          padding: "14px 20px",
          borderRadius: 14,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          color: "var(--text-3)",
          fontSize: 13,
          display: "flex",
          justify: "space-between",
          alignItems: "center",
        }}
      >
        <span>Post hidden from your feed.</span>
        <button
          className="tai-btn tai-btn-ghost tai-btn-sm"
          style={{ color: "var(--primary)", fontSize: 12.5, fontWeight: 700 }}
          onClick={() => setIsHidden(false)}
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <div
      id={`post-${post.id}`}
      className="tai-card tai-card-hover"
      style={{
        padding: "20px",
        background: "var(--glass-surface)",
        border: "1px solid var(--glass-border)",
        borderRadius: 16,
        boxShadow: "var(--glass-shadow)",
        position: "relative",
      }}
    >
      {/* Toast Banner Feedback */}
      {toastNotice && (
        <div
          className="anim-slide-down"
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            background: "var(--primary-tint)",
            border: "1px solid var(--primary-border, var(--primary))",
            borderRadius: 8,
            color: "var(--primary)",
            fontSize: 12.5,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <CheckCircle2 size={14} /> {toastNotice}
        </div>
      )}

      {/* Top Author Row */}
      <div className="tai-row tai-between" style={{ alignItems: "flex-start", gap: 10 }}>
        <div className="tai-row tai-gap10" style={{ minWidth: 0, alignItems: "center" }}>
          <Avatar size={42} src={post.authorAvatar} initials={initialsOf(post.authorName)} />
          <div style={{ minWidth: 0 }}>
            <div className="tai-row tai-gap6" style={{ alignItems: "baseline", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>{post.authorName}</span>
              <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>·</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: tier.color }}>{tier.label}</span>
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
              title="Post Options"
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
                  zIndex: 30,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  boxShadow: "0 10px 25px -5px rgba(0,0,0,0.25), 0 8px 10px -6px rgba(0,0,0,0.2)",
                  padding: "6px",
                  minWidth: 180,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                {/* 1. Save to Bookmarks */}
                <button
                  className="tai-btn tai-btn-ghost tai-btn-sm"
                  style={{ width: "100%", justifyContent: "flex-start", fontSize: 12.5, gap: 8, padding: "6px 10px" }}
                  onClick={() => {
                    setMenuOpen(false);
                    setIsSaved((prev) => {
                      const next = !prev;
                      showToast(next ? "Post saved to your bookmarks!" : "Post removed from bookmarks.");
                      return next;
                    });
                  }}
                >
                  <Bookmark size={14} color={isSaved ? "var(--primary)" : "currentColor"} fill={isSaved ? "var(--primary)" : "none"} />
                  {isSaved ? "Saved to Bookmarks" : "Save Post"}
                </button>

                {/* 2. Copy Direct Link */}
                <button
                  className="tai-btn tai-btn-ghost tai-btn-sm"
                  style={{ width: "100%", justifyContent: "flex-start", fontSize: 12.5, gap: 8, padding: "6px 10px" }}
                  onClick={() => {
                    setMenuOpen(false);
                    const link = `${window.location.origin}${window.location.pathname}#post-${post.id}`;
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(link);
                      showToast("Direct link copied to clipboard!");
                    }
                  }}
                >
                  <Share2 size={14} /> Copy Direct Link
                </button>

                {/* 3. Copy Post Text */}
                <button
                  className="tai-btn tai-btn-ghost tai-btn-sm"
                  style={{ width: "100%", justifyContent: "flex-start", fontSize: 12.5, gap: 8, padding: "6px 10px" }}
                  onClick={() => {
                    setMenuOpen(false);
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(post.content);
                      showToast("Post text copied to clipboard!");
                    }
                  }}
                >
                  <Copy size={14} /> Copy Post Text
                </button>

                {/* 4. Ask AI / Summarize */}
                <button
                  className="tai-btn tai-btn-ghost tai-btn-sm"
                  style={{ width: "100%", justifyContent: "flex-start", fontSize: 12.5, gap: 8, padding: "6px 10px", color: "var(--primary)" }}
                  onClick={() => {
                    setMenuOpen(false);
                    setAiSummaryModalOpen(true);
                  }}
                >
                  <Sparkles size={14} /> Explain with AI
                </button>

                <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />

                {/* 5. Hide from My Feed */}
                <button
                  className="tai-btn tai-btn-ghost tai-btn-sm"
                  style={{ width: "100%", justifyContent: "flex-start", fontSize: 12.5, gap: 8, padding: "6px 10px" }}
                  onClick={() => {
                    setMenuOpen(false);
                    setIsHidden(true);
                  }}
                >
                  <EyeOff size={14} /> Hide from Feed
                </button>

                {/* 6. Report Post */}
                <button
                  className="tai-btn tai-btn-ghost tai-btn-sm"
                  style={{ width: "100%", justifyContent: "flex-start", fontSize: 12.5, gap: 8, padding: "6px 10px", color: "#D97706" }}
                  onClick={() => {
                    setMenuOpen(false);
                    setReportModalOpen(true);
                  }}
                >
                  <Flag size={14} /> Report Post
                </button>

                {/* 7. Delete Post (Author or Admin) */}
                {post.isMine && (
                  <>
                    <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
                    <button
                      className="tai-btn tai-btn-ghost tai-btn-sm"
                      style={{ width: "100%", justifyContent: "flex-start", color: "var(--danger)", fontSize: 12.5, gap: 8, padding: "6px 10px" }}
                      disabled={deleteBusy}
                      onClick={() => {
                        setMenuOpen(false);
                        if (window.confirm("Delete this post permanently?")) onDelete?.(post.id);
                      }}
                    >
                      <Trash2 size={14} /> Delete Post
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Summary Modal */}
      {aiSummaryModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setAiSummaryModalOpen(false)}
        >
          <div
            className="tai-card anim-scale-up"
            style={{
              maxWidth: 480,
              width: "100%",
              padding: 24,
              borderRadius: 16,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tai-row tai-between" style={{ marginBottom: 14 }}>
              <div className="tai-row tai-gap8" style={{ fontWeight: 800, fontSize: 16, color: "var(--primary)" }}>
                <Sparkles size={18} /> AI Content Summary
              </div>
              <button className="tai-iconbtn" onClick={() => setAiSummaryModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ background: "var(--surface-2)", padding: 14, borderRadius: 10, border: "1px solid var(--border)", fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: "var(--primary)" }}>Key Takeaway:</div>
              {title ? <strong>{title}: </strong> : null}
              {bodyText || "Discussion post sharing insights and best practices."}
            </div>

            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
              <button className="tai-btn tai-btn-primary tai-btn-sm" onClick={() => setAiSummaryModalOpen(false)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => {
            setReportModalOpen(false);
            setReportSubmitted(false);
          }}
        >
          <div
            className="tai-card anim-scale-up"
            style={{
              maxWidth: 420,
              width: "100%",
              padding: 24,
              borderRadius: 16,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tai-row tai-between" style={{ marginBottom: 14 }}>
              <div className="tai-row tai-gap8" style={{ fontWeight: 800, fontSize: 16, color: "#D97706" }}>
                <Flag size={18} /> Report Post
              </div>
              <button className="tai-iconbtn" onClick={() => { setReportModalOpen(false); setReportSubmitted(false); }}>
                <X size={16} />
              </button>
            </div>

            {reportSubmitted ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <CheckCircle2 size={36} color="var(--success)" style={{ margin: "0 auto 10px" }} />
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Thank you for keeping our community safe</div>
                <div style={{ fontSize: 12.5, color: "var(--text-3)", marginBottom: 16 }}>
                  Our moderators have received your report and will review this content.
                </div>
                <button
                  className="tai-btn tai-btn-primary tai-btn-sm"
                  onClick={() => {
                    setReportModalOpen(false);
                    setReportSubmitted(false);
                  }}
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 12 }}>
                  Please select why you are reporting this post by <strong>{post.authorName}</strong>:
                </div>

                <div className="tai-col tai-gap8" style={{ marginBottom: 16 }}>
                  {["Spam or Unsolicited Promotion", "Harassment or Inappropriate Content", "Off-topic or Low Quality", "Misinformation"].map((reason) => (
                    <label
                      key={reason}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: reportReason === reason ? "var(--primary-tint)" : "var(--surface-2)",
                        border: reportReason === reason ? "1px solid var(--primary)" : "1px solid var(--border)",
                        cursor: "pointer",
                        fontSize: 12.5,
                        fontWeight: 600,
                      }}
                      onClick={() => setReportReason(reason)}
                    >
                      <input
                        type="radio"
                        name="reportReason"
                        checked={reportReason === reason}
                        onChange={() => setReportReason(reason)}
                      />
                      {reason}
                    </label>
                  ))}
                </div>

                <div className="tai-row tai-end tai-gap8">
                  <button
                    className="tai-btn tai-btn-ghost tai-btn-sm"
                    onClick={() => setReportModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="tai-btn tai-btn-primary tai-btn-sm"
                    disabled={!reportReason}
                    onClick={() => {
                      setReportSubmitted(true);
                      showToast("Report submitted to community moderators.");
                    }}
                  >
                    Submit Report
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
  back,
  showToast,
  params,
  initialTab,
  activeTab,
  onTabChange,
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
  setRequestingSession,
  setSessionMentorChoice,
  activeMentorThread,
  setActiveMentorThread,
  messageInput,
  setMessageInput,
  messageThreads = [],
  threadsLoading,
  conversationMessages = [],
  conversationLoading,
  handleSendMessage,
}) {
  const myId = session?.user?.id;
  const initialSelectedTab = params?.tab || initialTab || activeTab || "summary";
  const [tab, setTab] = useState(initialSelectedTab);
  const prevExternalTabRef = React.useRef(params?.tab || activeTab || initialTab);

  React.useEffect(() => {
    const nextExternalTab = params?.tab || activeTab || initialTab;
    if (nextExternalTab && nextExternalTab !== prevExternalTabRef.current) {
      prevExternalTabRef.current = nextExternalTab;
      setTab(nextExternalTab);
    }
  }, [params?.tab, activeTab, initialTab]);

  const handleTabClick = (tabId) => {
    setTab(tabId);
    prevExternalTabRef.current = tabId;
    if (onTabChange) onTabChange(tabId);
  };

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

  // Derive author engagement scores from loaded posts and comments
  const authorStatsMap = useMemo(() => {
    const map = {};
    for (const p of posts) {
      if (!p.userId) continue;
      if (!map[p.userId]) map[p.userId] = { posts: 0, comments: 0 };
      map[p.userId].posts += 1;
      for (const c of p.comments || []) {
        const cUserId = c.user_profiles?.id || c.userId || c.user_id;
        if (cUserId) {
          if (!map[cUserId]) map[cUserId] = { posts: 0, comments: 0 };
          map[cUserId].comments += 1;
        }
      }
    }
    return map;
  }, [posts]);

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

  // Leaderboard period - "All Time" already comes from leaderboardQuery
  // (passed in as a prop, fetched once at the app level). "This Week" /
  // "This Month" use fetchLeaderboardForPeriod(), a real RPC
  // (get_leaderboard_for_period, 0148_leaderboard_period_and_cohort.sql)
  // that already existed but had no UI calling it anywhere in the app.
  const [leaderboardPeriod, setLeaderboardPeriod] = useState("all");
  const [periodRows, setPeriodRows] = useState([]);
  const [periodLoading, setPeriodLoading] = useState(false);

  const loadPeriodLeaderboard = React.useCallback((periodKey) => {
    if (periodKey === "all") return;
    setPeriodLoading(true);
    const now = new Date();
    const start = new Date(now);
    if (periodKey === "week") start.setDate(now.getDate() - 7);
    else start.setDate(now.getDate() - 30);
    return fetchLeaderboardForPeriod(start.toISOString(), now.toISOString())
      .then((rows) => setPeriodRows(rows))
      .finally(() => setPeriodLoading(false));
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    if (leaderboardPeriod === "all") return;
    Promise.resolve(loadPeriodLeaderboard(leaderboardPeriod)).then(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaderboardPeriod]);
  const leaderboardRows = leaderboardQuery.data || [];
  const myRankIndex = leaderboardRows.findIndex((r) => r.user_id === myId);
  const myRankNumber = myRankIndex >= 0 ? myRankIndex + 1 : "—";
  const myPoints = gamificationStatsQuery.data?.total_points || 0;
  const myLevel = gamificationStatsQuery.data?.current_level || 1;
  const nextRankPoints = myRankIndex > 0 ? (leaderboardRows[myRankIndex - 1]?.total_points || myPoints) - myPoints : 0;

  // Tabs list with icons
  const TABS = [
    { id: "summary", label: "Summary", icon: Sparkles },
    { id: "posts", label: "Posts", icon: MessageSquare },
    { id: "groups", label: "Groups", icon: Users },
    { id: "tutors", label: "Instructors", icon: GraduationCap },
    { id: "cohorts", label: "Cohorts", icon: BookOpen },
    { id: "messages", label: "Messages", icon: Mail },
    { id: "rank", label: "Rank", icon: Trophy },
  ];  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top Page Header */}
      <div className="tai-row tai-between" style={{ alignItems: "center" }}>
        <div>
          <h1 className="tai-h1" style={{ margin: 0 }}>Community Hub</h1>
          <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 2 }}>Connect, collaborate, discuss topics, and learn together with your peers.</div>
        </div>
      </div>

      {/* Hero Banner */}
      <CommunityHero user={user} onCreatePost={() => setComposerOpen(true)} />

      {/* Live Activity Ticker Banner */}
      <LiveActivityBanner items={activityFeedQuery.data} />

      {/* Unified Dashboard Grid Layout */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
        
        {/* =================================================================== */}
        {/* MAIN COLUMN (2/3 Width): Feed, Study Lounges, Cohort Channels, Instructors */}
        {/* =================================================================== */}
        <div style={{ flex: "2 1 540px", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
          
          {/* CARD 1: COMMUNITY FEED & COMPOSER */}
          <div className="tai-card" style={{ padding: 20, background: "var(--glass-surface)", border: "1px solid var(--glass-border)", borderRadius: 16, boxShadow: "var(--glass-shadow)" }}>
            <div className="tai-row tai-between" style={{ alignItems: "center", marginBottom: 14 }}>
              <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
                <MessageSquare size={18} color="var(--primary)" />
                <span style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>Community Feed</span>
              </div>
              <span className="tai-tag" style={{ background: "var(--primary-tint)", color: "var(--primary)" }}>
                {posts.length} Discussions
              </span>
            </div>

            {/* Search Posts Bar */}
            <div style={{ position: "relative", marginBottom: 14 }}>
              <Search size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
              <input
                className="tai-input"
                style={{ paddingLeft: 38, background: "var(--surface-2)", borderRadius: 12 }}
                placeholder="Search community posts..."
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

            {/* Post Composer */}
            {!composerOpen ? (
              <div
                className="tai-row tai-gap10"
                style={{
                  padding: "12px 16px",
                  alignItems: "center",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  marginBottom: 16,
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
                    background: "var(--surface)",
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
                className="anim-slide-down"
                style={{
                  padding: "16px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  marginBottom: 16,
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
                          background: postType === type ? "var(--primary-tint)" : "var(--surface)",
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
                  style={{ marginBottom: 12, padding: "10px 12px", fontSize: 13, background: "var(--surface)" }}
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

            {/* Posts Stream */}
            {postsQuery.loading && (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                Loading posts...
              </div>
            )}

            {!postsQuery.loading && filteredPosts.length === 0 && (
              <div style={{ padding: 36, textAlign: "center" }}>
                <MessageSquare size={24} color="var(--text-3)" style={{ margin: "0 auto 8px" }} />
                <div style={{ fontWeight: 800, fontSize: 14 }}>{feedSearch || activeTagFilter ? "No matching posts" : "No posts yet"}</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>Be the first to share something!</div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {filteredPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  authorStats={authorStatsMap[post.userId]}
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
          </div>

          {/* CARD 2: ACTIVE STUDY GROUPS */}
          <div className="tai-card" style={{ padding: 20, background: "var(--glass-surface)", border: "1px solid var(--glass-border)", borderRadius: 16, boxShadow: "var(--glass-shadow)" }}>
            <div className="tai-row tai-between" style={{ alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
                <Users size={18} color="var(--primary)" />
                <span style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>Active Study Lounges</span>
              </div>
              <button
                className="tai-btn tai-btn-primary tai-btn-sm"
                style={{ borderRadius: 999, padding: "6px 14px", fontSize: 12 }}
                onClick={() => setCreateGroupModalOpen((prev) => !prev)}
              >
                <Plus size={14} /> Create Group
              </button>
            </div>

            {/* Create Group Form Modal */}
            {createGroupModalOpen && (
              <div className="anim-slide-down" style={{ padding: 14, background: "var(--surface-2)", borderRadius: 12, marginBottom: 14, border: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 8 }}>Create a New Study Group</div>
                <input
                  className="tai-input"
                  placeholder="Group Name (e.g. AI Prompt Engineering Guild)"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  style={{ marginBottom: 8, background: "var(--surface)", fontSize: 12.5 }}
                />
                <textarea
                  className="tai-input"
                  rows={2}
                  placeholder="Group Description & Purpose"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  style={{ marginBottom: 10, background: "var(--surface)", fontSize: 12.5 }}
                />
                <div className="tai-row tai-gap8" style={{ justifyContent: "flex-end" }}>
                  <button className="tai-btn tai-btn-ghost tai-btn-sm" onClick={() => setCreateGroupModalOpen(false)}>Cancel</button>
                  <button className="tai-btn tai-btn-primary tai-btn-sm" disabled={groupBusy || !newGroupName.trim()} onClick={handleCreateGroup}>
                    {groupBusy ? "Creating..." : "Create Group"}
                  </button>
                </div>
              </div>
            )}

            {/* Groups Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              {filteredGroups.slice(0, 4).map((g) => {
                const isMember = myGroupIds.has(g.id);
                const memberCount = g.member_count || g.study_group_members?.[0]?.count || (isMember ? 1 : 0);

                return (
                  <div
                    key={g.id}
                    style={{
                      padding: "14px",
                      background: "var(--surface-2)",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", marginBottom: 4 }}>{g.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {g.description || "Peer study group for collaboration."}
                      </div>
                    </div>
                    <div className="tai-row tai-between" style={{ alignItems: "center" }}>
                      <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>👥 {memberCount} members</span>
                      <button
                        className={`tai-btn tai-btn-sm ${isMember ? "tai-btn-ghost" : "tai-btn-primary"}`}
                        style={{ padding: "4px 10px", fontSize: 11.5 }}
                        disabled={joiningGroupId === g.id}
                        onClick={() => handleToggleGroupJoin(g.id, isMember)}
                      >
                        {isMember ? "Joined" : "Join"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CARD 3: FEATURED INSTRUCTORS & MENTORS */}
          <div className="tai-card" style={{ padding: 20, background: "var(--glass-surface)", border: "1px solid var(--glass-border)", borderRadius: 16, boxShadow: "var(--glass-shadow)" }}>
            <div className="tai-row tai-between" style={{ alignItems: "center", marginBottom: 14 }}>
              <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
                <GraduationCap size={18} color="var(--primary)" />
                <span style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>Instructors & Mentors</span>
              </div>
              <span className="tai-tag" style={{ background: "var(--primary-tint)", color: "var(--primary)" }}>
                {mentorsList.length} Available
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {mentorsList.slice(0, 3).map((m) => (
                <div
                  key={m.id}
                  style={{
                    padding: "14px",
                    background: "var(--surface-2)",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Avatar size={46} src={m.avatarUrl} initials={initialsOf(m.name)} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)" }}>{m.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--primary)", fontWeight: 700 }}>{m.title || "Senior AI Instructor"}</div>
                  </div>
                  <button
                    className="tai-btn tai-btn-primary tai-btn-sm"
                    style={{ width: "100%", padding: "5px 10px", fontSize: 11.5 }}
                    onClick={() => openMentorBooking(m)}
                  >
                    Book 1:1 Session
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* =================================================================== */}
        {/* SIDEBAR COLUMN (1/3 Width): Status, Leaderboard, Direct Messages */}
        {/* =================================================================== */}
        <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
          
          {/* 1. YOUR COMMUNITY STATUS */}
          <StatusCard stats={myCommunityStatsQuery.data} />

          {/* 2. TOP CONTRIBUTORS LEADERBOARD */}
          <div className="tai-card" style={{ padding: 20, background: "var(--glass-surface)", border: "1px solid var(--glass-border)", borderRadius: 16, boxShadow: "var(--glass-shadow)" }}>
            <div className="tai-row tai-between" style={{ alignItems: "center", marginBottom: 14 }}>
              <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
                <Trophy size={18} color="#F59E0B" />
                <span style={{ fontWeight: 800, fontSize: 15, color: "var(--text)" }}>Top Contributors</span>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--primary)" }}>Rank #{myRankNumber}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {leaderboardRows.slice(0, 5).map((row, idx) => {
                const isYou = row.user_id === myId;
                return (
                  <div
                    key={row.user_id || idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      borderRadius: 10,
                      background: isYou ? "var(--primary-tint)" : "var(--surface-2)",
                      border: isYou ? "1px solid var(--primary)" : "1px solid var(--border)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span style={{ fontWeight: 900, fontSize: 12, color: idx === 0 ? "#F59E0B" : idx === 1 ? "#94A3B8" : idx === 2 ? "#D97706" : "var(--text-3)", width: 16 }}>
                        #{idx + 1}
                      </span>
                      <Avatar size={28} src={row.avatar_url} initials={row.initials || "L"} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 12.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row.name} {isYou ? "(You)" : ""}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontWeight: 800, fontSize: 12, color: "var(--primary)", flexShrink: 0 }}>
                      {row.points ?? 0} pts
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. TRENDING TAGS */}
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

          {/* 4. DIRECT MESSAGES / CONVERSATIONS */}
          <div className="tai-card" style={{ padding: 18, background: "var(--glass-surface)", border: "1px solid var(--glass-border)", borderRadius: 16, boxShadow: "var(--glass-shadow)" }}>
            <div className="tai-row tai-between" style={{ alignItems: "center", marginBottom: 10 }}>
              <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
                <Mail size={16} color="var(--primary)" />
                <span style={{ fontWeight: 800, fontSize: 14.5 }}>Direct Messages</span>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
              {messageThreads.length === 0 ? "No active chat threads yet." : (
                <><strong style={{ color: "var(--text)" }}>{messageThreads.length}</strong> active conversation{messageThreads.length === 1 ? "" : "s"} with instructors</>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

export default CommunityScreen;
