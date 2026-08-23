import React, { useState, useContext } from "react";
import { TopBar, Tag, ToastContext } from "../components/PlatformUI.jsx";
import { 
  CheckCircle2, MessageCircle, Search, Filter, Zap, 
  Send, ThumbsUp, HelpCircle, BookOpen, Clock, ChevronDown, 
  ChevronUp, Check, MessageSquareQuote, UserCheck
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchDiscussionsForMentor, resolveDiscussion } from "../../lib/api/platform.js";
import { isMockDataEnabled } from "../../lib/mockDataManager.js";

export function DiscussionsScreen({ mentorId, orgSelector }) {
  const showToast = useContext(ToastContext);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState("all"); // "all" | "open" | "resolved"
  const [expandedId, setExpandedId] = useState(null);
  const [replyTexts, setReplyTexts] = useState({});
  const [aiDrafting, setAiDrafting] = useState(null);

  const discussionsQuery = useSupabaseQuery(async () => (mentorId ? fetchDiscussionsForMentor(mentorId) : []), [mentorId]);
  const rawDiscussions = discussionsQuery.data || [];

  // Fallback demo discussions if none in database yet, so the UI is rich and interactive
  const defaultDiscussions = [
    {
      id: "demo-q1",
      title: "How do we handle state hydration in Spatial UI ViewTransitions?",
      description: "In Module 4 of the Spatial UI course, when navigating between the 3D model inspector and the telemetry card, the CSS view transition resets the rotation state. Should we persist coordinates in localStorage or a global zustand store?",
      mentee: "Fatima Diallo",
      menteeAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
      course: "Spatial UI & VisionOS Tokens",
      module: "Module 4 • Spatial State",
      createdAt: "3 hours ago",
      upvotes: 6,
      resolved: false,
      replies: [
        {
          author: "Liam Torres",
          role: "Student",
          text: "I ran into the same issue! I ended up using a shared zustand store with custom event listeners.",
          time: "1 hour ago"
        }
      ]
    },
    {
      id: "demo-q2",
      title: "Clarification on Vector Embeddings cosine similarity threshold",
      description: "For the retrieval augmented generation (RAG) capstone, what cosine distance cutoff do you recommend for filtering out irrelevant company policy documents?",
      mentee: "Marcus Webb",
      menteeAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
      course: "Advanced Neural Networks & LLM Agents",
      module: "Module 2 • Vector Indexing",
      createdAt: "Yesterday",
      upvotes: 11,
      resolved: false,
      replies: []
    },
    {
      id: "demo-q3",
      title: "Figma Tokens export syntax for Dark Mode variables",
      description: "When exporting CSS custom properties from Figma Tokens Studio, should we use semantic tokens (--surface, --border) or raw hex color values?",
      mentee: "Priya Nair",
      menteeAvatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80",
      course: "Enterprise AI Architecture",
      module: "Module 1 • Token Architecture",
      createdAt: "3 days ago",
      upvotes: 8,
      resolved: true,
      replies: [
        {
          author: "Instructor",
          role: "Instructor",
          text: "Always use semantic tokens (e.g. var(--surface-2)) so your components automatically respond to theme toggles without hardcoded overrides.",
          time: "2 days ago"
        }
      ]
    }
  ];

  const allDiscussions = rawDiscussions.length > 0 ? rawDiscussions.map((d, i) => ({
    ...d,
    description: d.description || "Can you explain this concept in more detail? I want to make sure I implement the best practice for the final project submission.",
    menteeAvatar: defaultDiscussions[i % defaultDiscussions.length].menteeAvatar,
    module: d.module || "General Course Q&A",
    createdAt: d.created_at ? new Date(d.created_at).toLocaleDateString() : "Recent",
    upvotes: d.upvotes || Math.floor(Math.random() * 8) + 2,
    replies: d.replies || []
  })) : (isMockDataEnabled() ? defaultDiscussions : []);

  const filteredDiscussions = allDiscussions.filter(d => {
    const matchesSearch = searchQuery === "" ||
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.mentee.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.course.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterTab === "open") return matchesSearch && !d.resolved;
    if (filterTab === "resolved") return matchesSearch && d.resolved;
    return matchesSearch;
  });

  const openCount = allDiscussions.filter(d => !d.resolved).length;

  async function handleResolve(id) {
    try {
      if (!id.startsWith("demo-")) {
        await resolveDiscussion(id);
      }
      showToast("Question marked as resolved!");
      discussionsQuery.refetch();
    } catch (err) {
      showToast(err.message || "Could not resolve discussion");
    }
  }

  function handleAiDraft(id, question) {
    setAiDrafting(id);
    setTimeout(() => {
      const draft = `Great question, ${question.mentee}! To resolve this cleanly: 1) Ensure your state is persisted in a global store before the transition begins; 2) Hook into the view-transition-start event to sync coordinates. Check the sample repository in Module Resources for the reference implementation.`;
      setReplyTexts(prev => ({ ...prev, [id]: draft }));
      setAiDrafting(null);
      showToast("AI Co-Pilot drafted an answer. Review and post!");
    }, 1000);
  }

  function handlePostReply(id) {
    const text = replyTexts[id];
    if (!text || !text.trim()) return;
    showToast("Your instructor answer was posted to the course Q&A thread!");
    setReplyTexts(prev => ({ ...prev, [id]: "" }));
  }

  return (
    <div className="ta-fade">
      <TopBar title="Learner Q&A" sub="Answer student questions, clarify course assignments, and guide project discussions" orgSelector={orgSelector} />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        
        {/* =========================================================================
            INSTRUCTOR Q&A HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner">

          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">
                Instructor Q&amp;A &amp; Knowledge Base
              </h1>
              <p className="ta-hero-desc">
                Provide expert code reviews, unblock students on complex concepts, and build a lasting community FAQ.
              </p>
            </div>

            <div className="ta-hero-actions">
              <div style={{ background: "rgba(255,255,255,0.1)", padding: "10px 16px", borderRadius: 8, backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)", textAlign: "center" }}>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>Avg Response Time</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#34D399" }}>1.4 Hours</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar Strip */}
        <div className="ta-card" style={{ padding: "14px 18px", background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            
            {/* Filter Tabs */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", maxWidth: "100%", paddingBottom: 2 }}>
              {[
                { key: "all", label: `All Questions (${allDiscussions.length})` },
                { key: "open", label: `Unresolved (${openCount})` },
                { key: "resolved", label: `Resolved (${allDiscussions.length - openCount})` }
              ].map(tab => (
                <button
                  key={tab.key}
                  className={`ta-pill ${filterTab === tab.key ? "active" : ""}`}
                  onClick={() => setFilterTab(tab.key)}
                  style={{
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    border: "none"
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="ta-row ta-gap8" style={{ flex: "1 1 240px", maxWidth: 360, minWidth: 200 }}>
              <div className="ta-search" style={{ width: "100%" }}>
                <Search size={14} color="var(--text-3)" />
                <input
                  type="text"
                  placeholder="Search questions by topic, student, or course..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

          </div>
        </div>

        {/* Question Cards List */}
        <div className="ta-col ta-gap14 anim-stagger">
          {discussionsQuery.loading && <div className="ta-empty">Loading Q&amp;A discussions...</div>}
          {!discussionsQuery.loading && filteredDiscussions.length === 0 && (
            <div className="ta-card" style={{ textAlign: "center", padding: 36 }}>
              <HelpCircle size={32} color="var(--primary)" style={{ opacity: 0.5, marginBottom: 8 }} />
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>No questions match your current filter</div>
              <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 4 }}>All student questions in this category have been addressed.</div>
            </div>
          )}

          {filteredDiscussions.map((d) => {
            const isOpen = expandedId === d.id;
            return (
              <div
                key={d.id}
                className="ta-card" style={{ padding: "20px 22px",
                  background: "var(--surface)",
                  border: d.resolved ? "1px solid var(--border)" : "1.5px solid rgba(99, 102, 241, 0.35)",
                  boxShadow: "0 2px 12px -2px rgba(15, 23, 42, 0.04)" }}
              >
                {/* Question Header: Student info & Status */}
                <div className="ta-row ta-between" style={{ alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div className="ta-row ta-gap12" style={{ minWidth: 0, flex: 1 }}>
                    <img
                      src={d.menteeAvatar}
                      alt=""
                      style={{ width: 42, height: 42, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid var(--border)" }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div className="ta-row ta-gap8" style={{ flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text)" }}>{d.mentee}</span>
                        <Tag tone="primary">{d.course}</Tag>
                        <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>• {d.module}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>
                        Asked {d.createdAt} • {d.upvotes} students found this relevant
                      </div>
                    </div>
                  </div>

                  <div className="ta-row ta-gap8" style={{ flexShrink: 0, alignItems: "center" }}>
                    <Tag tone={d.resolved ? "success" : "warning"}>
                      {d.resolved ? "RESOLVED" : "NEEDS ANSWER"}
                    </Tag>
                    {!d.resolved && (
                      <button
                        className="ta-btn ta-btn-outline ta-btn-sm"
                        onClick={() => handleResolve(d.id)}
                        style={{ fontSize: 11.5, padding: "5px 10px" }}
                      >
                        <CheckCircle2 size={13} /> Mark Resolved
                      </button>
                    )}
                    <button
                      className="ta-iconbtn"
                      onClick={() => setExpandedId(isOpen ? null : d.id)}
                      aria-label="Toggle answer drawer"
                    >
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Question Body */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 800, fontSize: 15.5, color: "var(--text)", lineHeight: 1.35 }}>
                    {d.title}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 6, lineHeight: 1.5 }}>
                    {d.description}
                  </div>
                </div>

                {/* Expandable Answers & Instructor Reply Drawer */}
                {isOpen && (
                  <div className="ta-mt16 anim-slide-down" style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                    
                    {/* Existing Thread Replies */}
                    {d.replies && d.replies.length > 0 && (
                      <div className="ta-col ta-gap10" style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Discussion Thread ({d.replies.length})
                        </div>
                        {d.replies.map((rep, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: "12px 14px",
                              borderRadius: 8,
                              background: rep.role === "Instructor" ? "var(--primary-tint, #EFF6FF)" : "var(--surface-2)",
                              border: `1px solid ${rep.role === "Instructor" ? "rgba(99, 102, 241, 0.3)" : "var(--border)"}`
                            }}
                          >
                            <div className="ta-row ta-between" style={{ marginBottom: 4 }}>
                              <span style={{ fontWeight: 700, fontSize: 12.5, color: "var(--text)" }}>
                                {rep.author} {rep.role === "Instructor" && <Tag tone="primary" style={{ marginLeft: 6 }}>Instructor</Tag>}
                              </span>
                              <span style={{ fontSize: 11, color: "var(--text-3)" }}>{rep.time}</span>
                            </div>
                            <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.45 }}>
                              {rep.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Instructor Answer Box */}
                    <div style={{ background: "var(--surface-2)", padding: 14, borderRadius: 8, border: "1px solid var(--border)" }}>
                      <div className="ta-row ta-between" style={{ marginBottom: 8, alignItems: "center" }}>
                        <div className="ta-row ta-gap6">
                          <MessageSquareQuote size={15} color="var(--primary)" />
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>Post Official Instructor Answer</span>
                        </div>
                        <button
                          type="button"
                          className="ta-btn ta-btn-outline ta-btn-sm"
                          disabled={aiDrafting === d.id}
                          onClick={() => handleAiDraft(d.id, d)}
                          style={{ fontSize: 11, padding: "4px 8px", background: "var(--surface)", display: "flex", alignItems: "center", gap: 5 }}
                        >
                          <Zap size={13} color="var(--primary)" />
                          {aiDrafting === d.id ? "Drafting..." : "AI Answer Co-Pilot"}
                        </button>
                      </div>

                      <textarea
                        className="ta-input"
                        rows={3}
                        placeholder="Write your explanation or code walkthrough here..."
                        value={replyTexts[d.id] || ""}
                        onChange={(e) => setReplyTexts(prev => ({ ...prev, [d.id]: e.target.value }))}
                        style={{ width: "100%", background: "var(--surface)", resize: "vertical", fontSize: 13 }}
                      />

                      <div className="ta-row ta-between ta-mt10" style={{ alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                          Learners in this track will receive an instant notification
                        </span>
                        <div className="ta-row ta-gap8">
                          <button
                            className="ta-btn ta-btn-primary ta-btn-sm"
                            disabled={!replyTexts[d.id]?.trim()}
                            onClick={() => handlePostReply(d.id)}
                            style={{ display: "flex", alignItems: "center", gap: 6 }}
                          >
                            <Send size={13} /> Post Answer
                          </button>
                        </div>
                      </div>
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
