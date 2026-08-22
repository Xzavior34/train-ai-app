import React, { useState } from "react";
import { TopBar, Avatar, Tag, timeAgo, initialsOf, ProgressBar } from "../components/LearnerUI.jsx";
import {
  Layers, Video, Calendar, FileText, Link2, ExternalLink, Flame, Users,
  CheckCircle2, Clock, Play, ArrowRight, BookOpen, Star, Sparkles, MessageCircle, Heart, GraduationCap
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchCohortActivityToday } from "../../lib/api/learner.js";

export function CohortScreen({
  cohort, cohortMembershipQuery, cohortPostsQuery, cohortResourcesQuery, cohortSessionsQuery,
  cohortCoursesQuery, cohortMembersQuery,
  session, showToast = () => {}, back, push, goTab
}) {
  const [tab, setTab] = useState("chat"); // "chat" | "courses" | "resources" | "sessions" | "members"
  const [expandedPostId, setExpandedPostId] = useState(null);

  const effectiveCohort = cohort || {
    id: "cohort-demo-q3",
    name: "Q3 AI & Product Design Batch 04",
    description: "Intensive 12-week professional track with live mentor critiques, weekly deliverables, and verified skill credentialing."
  };

  const DEFAULT_POSTS = [
    {
      id: "post-1",
      user_profiles: { display_name: "Astrid Larsson", avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80" },
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      is_announcement: true,
      content: "🚀 Welcome to Week 5! Tonight at 6:00 PM UTC we will conduct the live Figma Auto-Layout & Design Tokens review. Please ensure your Module 4 deliverable is submitted.",
      reaction_count: 18,
      cohort_post_replies: [
        { id: "rep-1", user_profiles: { display_name: "Marcus Vance" }, content: "Looking forward to this session! Will the recording be uploaded afterwards?" },
        { id: "rep-2", user_profiles: { display_name: "Astrid Larsson" }, content: "Yes Marcus! The high-res recording and transcript will be available in the Sessions tab within 1 hour." }
      ]
    },
    {
      id: "post-2",
      user_profiles: { display_name: "Dr. Elena Vance", avatar_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80" },
      created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
      is_announcement: false,
      content: "Shared the updated Prompt Engineering Cheat Sheet and RAG Architecture diagrams in the Resources tab. Check it out before tomorrow's quiz.",
      reaction_count: 12,
      cohort_post_replies: []
    }
  ];

  const DEFAULT_RESOURCES = [
    {
      id: "res-1",
      title: "Design System Architecture Starter Kit (Figma .fig)",
      description: "Official starter file with pre-built variable tokens, semantic color ramps, and typography scale.",
      resource_type: "file",
      file_url: "https://figma.com",
      author: "Astrid Larsson"
    },
    {
      id: "res-2",
      title: "Production RAG & Vector Embeddings Architecture PDF",
      description: "Step-by-step technical manual on hybrid search, re-ranking models, and chunking parameters.",
      resource_type: "link",
      external_url: "https://github.com",
      author: "Dr. Elena Vance"
    },
    {
      id: "res-3",
      title: "Week 5 Live Review Slide Deck & Evaluation Rubric",
      description: "Presentation slides covering layout grids, accessibility standards, and production token deployment.",
      resource_type: "file",
      file_url: "https://trainailtd.com",
      author: "Astrid Larsson"
    }
  ];

  const DEFAULT_SESSIONS = [
    {
      id: "sess-1",
      title: "Live UI Critique & Design Tokens System Review",
      starts_at: new Date(Date.now() + 3600000 * 2).toISOString(),
      join_url: "https://meet.google.com/new",
      instructor: "Astrid Larsson",
      instructorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
      status: "Starting in 2 hrs"
    },
    {
      id: "sess-2",
      title: "Full-Stack AI Workflows & Multi-Modal API Integration",
      starts_at: new Date(Date.now() + 3600000 * 48).toISOString(),
      join_url: "https://meet.google.com/new",
      instructor: "Dr. Elena Vance",
      instructorAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80",
      status: "In 2 days"
    },
    {
      id: "sess-past-1",
      title: "Module 3: Prototyping & Micro-interactions in Spatial UI",
      starts_at: new Date(Date.now() - 3600000 * 72).toISOString(),
      recording_url: "https://trainailtd.com",
      instructor: "Astrid Larsson",
      instructorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
      status: "Recording Ready"
    }
  ];

  const DEFAULT_COURSES = [
    {
      id: "cc-1",
      courses: {
        id: "course-figma-ai",
        title: "Master Design Systems in Figma with Generative AI",
        description: "Learn auto-layout, variable tokens, component variants, and AI acceleration.",
        progress: 46
      },
      due_at: new Date(Date.now() + 3600000 * 24 * 7).toISOString()
    },
    {
      id: "cc-2",
      courses: {
        id: "course-fullstack-ai",
        title: "Full-Stack AI Application Engineering",
        description: "Build production-grade GenAI apps with React 19, Supabase, and vector embeddings.",
        progress: 19
      },
      due_at: new Date(Date.now() + 3600000 * 24 * 14).toISOString()
    }
  ];

  const posts = (cohortPostsQuery?.data && cohortPostsQuery.data.length > 0) ? cohortPostsQuery.data : DEFAULT_POSTS;
  const resources = (cohortResourcesQuery?.data && cohortResourcesQuery.data.length > 0) ? cohortResourcesQuery.data : DEFAULT_RESOURCES;
  const sessions = (cohortSessionsQuery?.data && cohortSessionsQuery.data.length > 0) ? cohortSessionsQuery.data : DEFAULT_SESSIONS;
  const now = Date.now();
  const upcomingSessions = sessions.filter(s => new Date(s.starts_at).getTime() >= now);
  const pastSessions = sessions.filter(s => new Date(s.starts_at).getTime() < now);

  const instructorMembers = (cohortMembersQuery?.data && cohortMembersQuery.data.length > 0)
    ? cohortMembersQuery.data.filter(m => m.user_profiles?.role === "mentor" || m.user_profiles?.role === "admin")
    : [
        {
          id: "m-1",
          user_profiles: { display_name: "Astrid Larsson", role: "Lead Facilitator", avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80" }
        },
        {
          id: "m-2",
          user_profiles: { display_name: "Dr. Elena Vance", role: "AI Engineering Mentor", avatar_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80" }
        }
      ];

  const assignedCourses = (cohortCoursesQuery?.data && cohortCoursesQuery.data.length > 0) ? cohortCoursesQuery.data : DEFAULT_COURSES;

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      {/* =========================================================================
          HERO BANNER: Dedicated Cohort & Batch Space
          ========================================================================= */}
      <div style={{
        borderRadius: 20,
        background: "linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(30,27,75,0.85) 100%)",
        color: "#FFFFFF",
        padding: "clamp(18px, 3vw, 26px)",
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.35)",
        border: "1px solid rgba(99, 102, 241, 0.4)",
        position: "relative",
        overflow: "hidden"
      }}>
        {/* Background Stock Photo with Overlay */}
        <img
          src="https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=1400&auto=format&fit=crop&q=85"
          alt=""
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", opacity: 0.38, zIndex: 0
          }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(100deg, rgba(15,23,42,0.95) 0%, rgba(30,27,75,0.78) 55%, rgba(15,23,42,0.6) 100%)",
          zIndex: 0
        }} />

        <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: "clamp(20px, 2.5vw, 26px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 6px", color: "#FFFFFF", textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
              {cohort?.name || "AI & Product Design Batch"}
            </h1>
            <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.85)", margin: 0, maxWidth: 620, lineHeight: 1.4 }}>
              {cohort?.description || "Collaborative sprint track with live instructor sessions and peer critique."}
            </p>
          </div>

          <div style={{ textAlign: "right", flexShrink: 0, background: "rgba(255,255,255,0.1)", padding: "8px 14px", borderRadius: 12, backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)" }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#FFFFFF" }}>{cohortMembersQuery?.data?.length || 68} Peers Enrolled</div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>Active Cohort Track</div>
          </div>
        </div>

        {/* Milestone Progress Bar (High-Contrast Vivid Track) */}
        <div style={{
          marginTop: 16,
          position: "relative",
          zIndex: 1,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(12px)",
          padding: "12px 16px",
          borderRadius: 14,
          border: "1px solid rgba(255, 255, 255, 0.22)",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)"
        }}>
          <div className="tai-row tai-between" style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, color: "#FFFFFF", letterSpacing: "0.01em" }}>
            <div className="tai-row tai-gap6">
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 8px #10B981" }} />
              <span>Cohort Pace: Sprint 5 of 12</span>
            </div>
            <span style={{
              background: "rgba(16, 185, 129, 0.25)",
              color: "#6EE7B7",
              padding: "2px 8px",
              borderRadius: 99,
              border: "1px solid rgba(16, 185, 129, 0.5)",
              fontSize: 11.5,
              fontWeight: 800
            }}>
              42% Completed
            </span>
          </div>

          <div style={{
            height: 12,
            borderRadius: 99,
            background: "rgba(255, 255, 255, 0.18)",
            padding: 2,
            border: "1px solid rgba(255, 255, 255, 0.2)",
            overflow: "hidden",
            boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.3)"
          }}>
            <div style={{
              width: "42%",
              height: "100%",
              background: "linear-gradient(90deg, #10B981 0%, #34D399 50%, #6366F1 100%)",
              borderRadius: 99,
              boxShadow: "0 0 14px rgba(16, 185, 129, 0.8)",
              transition: "width 0.4s ease"
            }} />
          </div>
        </div>
      </div>

      {/* =========================================================================
          CONTROLS: Cohort Tabs
          ========================================================================= */}
      <div className="tai-row tai-gap8" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        {[
          { k: "chat", label: `Announcements & Feed (${posts.length})`, icon: MessageCircle },
          { k: "sessions", label: `Live Studios (${sessions.length})`, icon: Video },
          { k: "courses", label: `Assigned Courses (${assignedCourses.length})`, icon: BookOpen },
          { k: "resources", label: `Shared Resources (${resources.length})`, icon: FileText },
          { k: "members", label: `Facilitators (${instructorMembers.length})`, icon: Users },
        ].map(t => {
          const Icon = t.icon;
          const isActive = tab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                border: "none",
                background: isActive ? "var(--primary)" : "transparent",
                color: isActive ? "#FFFFFF" : "var(--text-3)",
                fontWeight: isActive ? 800 : 600,
                fontSize: 13,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                flexShrink: 0,
                transition: "all 0.15s ease"
              }}
              onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.color = "var(--text)"; e.currentTarget.style.background = "var(--surface-2)"; } }}
              onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.background = "transparent"; } }}
            >
              <Icon size={14} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          TAB 1: ANNOUNCEMENTS & FEED
          ========================================================================= */}
      {tab === "chat" && (
        <div className="tai-col tai-gap14">
          {posts.map(cp => (
            <div
              key={cp.id}
              className="tai-card"
              style={{
                padding: 22,
                borderRadius: 18,
                border: cp.is_announcement ? "1.5px solid rgba(99, 102, 241, 0.4)" : "1px solid var(--border)",
                background: "var(--surface)"
              }}
            >
              <div className="tai-row tai-between" style={{ marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
                <div className="tai-row tai-gap10" style={{ minWidth: 0, flex: "1 1 180px" }}>
                  <Avatar initials={initialsOf(cp.user_profiles?.display_name)} size={38} src={cp.user_profiles?.avatar_url} />
                  <div style={{ minWidth: 0 }}>
                    <div className="tai-row tai-gap6" style={{ flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{cp.user_profiles?.display_name || "Cohort Facilitator"}</span>
                      <span style={{ background: "#4F46E5", color: "#fff", fontSize: 9.5, fontWeight: 800, padding: "1px 6px", borderRadius: 4, flexShrink: 0 }}>
                        INSTRUCTOR
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>{timeAgo(cp.created_at)}</div>
                  </div>
                </div>
                {cp.is_announcement && <Tag tone="warning">Announcement</Tag>}
              </div>

              <p style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.6, margin: "0 0 12px" }}>
                {cp.content}
              </p>

              <div className="tai-row tai-between" style={{ paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                <span className="tai-row tai-gap4" style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 700 }}>
                  <Heart size={14} color="#EF4444" fill="#EF4444" /> {cp.reaction_count || 12} Reactions
                </span>

                <button
                  className="tai-btn tai-btn-ghost tai-btn-sm"
                  onClick={() => setExpandedPostId(expandedPostId === cp.id ? null : cp.id)}
                >
                  <MessageCircle size={13} /> {(cp.cohort_post_replies || []).length} Instructor Notes
                </button>
              </div>

              {expandedPostId === cp.id && (
                <div className="tai-col tai-gap8" style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                  {(cp.cohort_post_replies || []).map(rep => (
                    <div key={rep.id} style={{ background: "var(--surface-3)", padding: "10px 14px", borderRadius: 10 }}>
                      <span style={{ fontWeight: 800, fontSize: 12.5, color: "var(--text)" }}>{rep.user_profiles?.display_name || "Instructor"}: </span>
                      <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{rep.content}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* =========================================================================
          TAB 2: LIVE SESSIONS
          ========================================================================= */}
      {tab === "sessions" && (
        <div className="tai-col tai-gap16">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {sessions.map(s => (
              <div key={s.id} className="tai-card" style={{ padding: 22, borderRadius: 18, background: "var(--surface)" }}>
                <div className="tai-row tai-between" style={{ marginBottom: 10 }}>
                  <span style={{ background: "rgba(239, 68, 68, 0.15)", color: "#EF4444", fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Video size={12} /> {s.status || "Live Studio"}
                  </span>
                  <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                    {new Date(s.starts_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                </div>

                <h3 style={{ fontSize: 15.5, fontWeight: 800, color: "var(--text)", margin: "0 0 6px" }}>
                  {s.title}
                </h3>
                <div className="tai-row tai-gap8" style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 14, flexWrap: "wrap" }}>
                  <Clock size={13} />
                  <span>{new Date(s.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                  <span>•</span>
                  <span>Facilitator: <strong>{s.instructor || "Astrid Larsson"}</strong></span>
                </div>

                <div className="tai-row tai-between" style={{ paddingTop: 12, borderTop: "1px solid var(--border)", gap: 10, flexWrap: "wrap" }}>
                  <Avatar src={s.instructorAvatar} initials="AL" size={32} />
                  {s.join_url ? (
                    <a href={s.join_url} target="_blank" rel="noreferrer" className="tai-btn tai-btn-primary tai-btn-sm" style={{ textDecoration: "none" }}>
                      <Video size={13} /> Join Virtual Studio →
                    </a>
                  ) : (
                    <a href={s.recording_url || "#"} target="_blank" rel="noreferrer" className="tai-btn tai-btn-outline tai-btn-sm" style={{ textDecoration: "none" }}>
                      <Play size={13} /> Watch Replay
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: ASSIGNED COURSES
          ========================================================================= */}
      {tab === "courses" && (
        <div className="tai-col tai-gap16">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {assignedCourses.map(cc => (
              <div key={cc.id} className="tai-card tai-card-hover" style={{ padding: 22, borderRadius: 18, cursor: "pointer" }} onClick={() => push("courseDetail", { id: cc.courses?.id || "course-figma-ai" })}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", margin: "0 0 4px" }}>
                  {cc.courses?.title || "Master Design Systems in Figma with AI"}
                </h3>
                <p style={{ fontSize: 12.5, color: "var(--text-3)", margin: "0 0 14px" }}>
                  {cc.courses?.description}
                </p>

                <div style={{ marginBottom: 16, background: "var(--surface-3)", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)" }}>
                  <div className="tai-row tai-between" style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>
                    <span style={{ color: "var(--text-2)" }}>Curriculum Pace</span>
                    <span style={{ color: "var(--primary)", fontWeight: 800, background: "var(--primary-tint)", padding: "2px 8px", borderRadius: 6 }}>
                      {cc.courses?.progress || 46}% Completed
                    </span>
                  </div>
                  <ProgressBar value={cc.courses?.progress || 46} height={9} />
                </div>

                <div className="tai-row tai-between" style={{ paddingTop: 12, borderTop: "1px solid var(--border)", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11.5, color: "var(--danger)", fontWeight: 700 }}>
                    Due: {new Date(cc.due_at).toLocaleDateString()}
                  </span>
                  <button className="tai-btn tai-btn-primary tai-btn-sm">
                    Open Syllabus →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: SHARED RESOURCES
          ========================================================================= */}
      {tab === "resources" && (
        <div className="tai-col tai-gap14">
          {resources.map(r => (
            <div key={r.id} className="tai-card" style={{ padding: 18, borderRadius: 16 }}>
              <div className="tai-row tai-between" style={{ gap: 12, flexWrap: "wrap" }}>
                <div className="tai-row tai-gap12" style={{ minWidth: 0, flex: "1 1 200px" }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {r.resource_type === "link" ? <Link2 size={18} color="var(--primary)" /> : <FileText size={18} color="var(--primary)" />}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h4 style={{ fontSize: 14.5, fontWeight: 800, color: "var(--text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</h4>
                    <p style={{ fontSize: 12, color: "var(--text-3)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</p>
                  </div>
                </div>

                <a
                  href={r.file_url || r.external_url || "https://figma.com"}
                  target="_blank"
                  rel="noreferrer"
                  className="tai-btn tai-btn-outline tai-btn-sm"
                  style={{ textDecoration: "none", flexShrink: 0 }}
                >
                  <ExternalLink size={13} /> Access File
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* =========================================================================
          TAB 5: FACILITATORS
          ========================================================================= */}
      {tab === "members" && (
        <div className="tai-grid2">
          {instructorMembers.map(m => (
            <div key={m.id} className="tai-card" style={{ padding: 20, borderRadius: 16 }}>
              <div className="tai-row tai-between" style={{ gap: 12, flexWrap: "wrap" }}>
                <div className="tai-row tai-gap12" style={{ minWidth: 0, flex: "1 1 160px" }}>
                  <Avatar src={m.user_profiles?.avatar_url} initials={initialsOf(m.user_profiles?.display_name)} size={48} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.user_profiles?.display_name}</div>
                    <div style={{ fontSize: 12, color: "var(--primary)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.user_profiles?.role || "Lead Facilitator"}</div>
                  </div>
                </div>

                <button
                  className="tai-btn tai-btn-primary tai-btn-sm"
                  style={{ flexShrink: 0 }}
                  onClick={() => {
                    if (push) push("messages", { recipientName: m.user_profiles?.display_name });
                    showToast(`Starting chat with ${m.user_profiles?.display_name}...`);
                  }}
                >
                  <MessageCircle size={13} /> Message
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
