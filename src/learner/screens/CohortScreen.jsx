import React, { useState } from "react";
import { TopBar, Avatar, Tag, timeAgo, initialsOf, ProgressBar } from "../components/LearnerUI.jsx";
import {
  Layers, Video, Calendar, FileText, Link2, ExternalLink, Flame, Users,
  CheckCircle2, Clock, Play, ArrowRight, BookOpen, Star, MessageCircle, Heart, GraduationCap
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

  const posts = cohortPostsQuery?.data || [];
  const resources = cohortResourcesQuery?.data || [];
  const sessions = cohortSessionsQuery?.data || [];
  const now = Date.now();
  const upcomingSessions = sessions.filter(s => new Date(s.starts_at).getTime() >= now);
  const pastSessions = sessions.filter(s => new Date(s.starts_at).getTime() < now);
  const activityTodayQuery = useSupabaseQuery(async () => (cohort?.id ? fetchCohortActivityToday(cohort.id) : 0), [cohort?.id]);
  const activityToday = activityTodayQuery.data || 0;

  const instructorMembers = (cohortMembersQuery?.data || []).filter(
    m => m.user_profiles?.role === "mentor" || m.user_profiles?.role === "admin"
  );

  const assignedCourses = cohortCoursesQuery?.data || [];

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      {/* =========================================================================
          HERO BANNER: Dedicated Cohort & Batch Space
          ========================================================================= */}
      {/* =========================================================================
          HERO BANNER: Cohort Sprint Identity (Adaptive Liquid Glass)
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
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, transparent 70%)",
            pointerEvents: "none"
          }}
        />

        <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="tai-hero-title" style={{ fontSize: "clamp(20px, 2.5vw, 25px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 4px", lineHeight: 1.2 }}>
              {cohort?.name || "AI & Product Design Batch"}
            </h1>
            <p className="tai-hero-desc" style={{ fontSize: 13, margin: 0, maxWidth: 620, lineHeight: 1.45 }}>
              {cohort?.description || "Collaborative sprint track with live instructor sessions and peer critique."}
            </p>
          </div>

          <div className="tai-hero-subcard" style={{ textAlign: "right", flexShrink: 0, padding: "10px 16px", borderRadius: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text)" }}>{(cohortMembersQuery?.data || []).length} Peers Enrolled</div>
            <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>Active Cohort Track</div>
          </div>
        </div>

        {/* Milestone Progress Bar */}
        <div className="tai-hero-subcard" style={{
          marginTop: 16,
          position: "relative",
          zIndex: 1,
          padding: "12px 16px",
          borderRadius: 10
        }}>
          <div className="tai-row tai-between" style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>
            <div className="tai-row tai-gap6">
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#34D399" }} />
              <span>Cohort Pace: Sprint 5 of 12</span>
            </div>
            <span style={{
              color: "#34D399",
              fontSize: 12,
              fontWeight: 700
            }}>
              42% Completed
            </span>
          </div>

          <div style={{
            height: 8,
            borderRadius: 99,
            background: "var(--surface-3)",
            overflow: "hidden"
          }}>
            <div style={{
              width: "42%",
              height: "100%",
              background: "#10B981",
              borderRadius: 99
            }} />
          </div>
        </div>
      </div>

      {activityToday > 0 && (
        <div className="tai-card" style={{ padding: 12 }}>
          <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
            <Flame size={16} color="var(--danger, #DC2626)" />
            <span style={{ fontSize: 12.5 }}>
              <strong>{activityToday}</strong> {activityToday === 1 ? "peer" : "peers"} in your cohort studied today. Don't fall behind.
            </span>
          </div>
        </div>
      )}

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
          {cohortPostsQuery?.loading && <div className="tai-empty">Loading cohort chat...</div>}
          {!cohortPostsQuery?.loading && posts.length === 0 && (
            <div className="tai-empty">No posts in your cohort chat yet.</div>
          )}
          {posts.map(cp => (
            <div
              key={cp.id}
              className="tai-card"
              style={{
                padding: 22,
                borderRadius: 10,
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
                  <Heart size={14} color="#EF4444" fill="#EF4444" /> {cp.reaction_count || 0} Reactions
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
              <div key={s.id} className="tai-card" style={{ padding: 22, borderRadius: 10, background: "var(--surface)" }}>
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
                  <span>Facilitator: <strong>{s.instructor || "TBD"}</strong></span>
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
              <div key={cc.id} className="tai-card tai-card-hover" style={{ padding: 22, borderRadius: 10, cursor: "pointer" }} onClick={() => push?.("courseDetail", { id: cc.courses?.id })}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", margin: "0 0 4px" }}>
                  {cc.courses?.title || "Untitled course"}
                </h3>
                <p style={{ fontSize: 12.5, color: "var(--text-3)", margin: "0 0 14px" }}>
                  {cc.courses?.description}
                </p>

                <div style={{ marginBottom: 16, background: "var(--surface-3)", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div className="tai-row tai-between" style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>
                    <span style={{ color: "var(--text-2)" }}>Curriculum Pace</span>
                    <span style={{ color: "var(--primary)", fontWeight: 800, background: "var(--primary-tint)", padding: "2px 8px", borderRadius: 6 }}>
                      {cc.courses?.progress || 0}% Completed
                    </span>
                  </div>
                  <ProgressBar value={cc.courses?.progress || 0} height={9} />
                </div>

                <div className="tai-row tai-between" style={{ paddingTop: 12, borderTop: "1px solid var(--border)", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11.5, color: "var(--danger)", fontWeight: 700 }}>
                    Due: {new Date(cc.due_at).toLocaleDateString()}
                  </span>
                  <button
                    className="tai-btn tai-btn-primary tai-btn-sm"
                    onClick={(e) => { e.stopPropagation(); push("courseDetail", { id: cc.courses?.id || "course-figma-ai" }); }}
                  >
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
          {cohortResourcesQuery?.loading && <div className="tai-empty">Loading resources...</div>}
          {!cohortResourcesQuery?.loading && resources.length === 0 && (
            <div className="tai-empty">No resources shared with your cohort yet.</div>
          )}
          {resources.map(r => (
            <div key={r.id} className="tai-card" style={{ padding: 18, borderRadius: 10 }}>
              <div className="tai-row tai-between" style={{ gap: 12, flexWrap: "wrap" }}>
                <div className="tai-row tai-gap12" style={{ minWidth: 0, flex: "1 1 200px" }}>
                  <div style={{ width: 42, height: 42, borderRadius: 8, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
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
          {cohortMembersQuery?.loading && <div className="tai-empty">Loading facilitators...</div>}
          {!cohortMembersQuery?.loading && instructorMembers.length === 0 && (
            <div className="tai-empty">No instructor assigned to this cohort yet.</div>
          )}
          {instructorMembers.map(m => (
            <div key={m.id} className="tai-card" style={{ padding: 20, borderRadius: 10 }}>
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
