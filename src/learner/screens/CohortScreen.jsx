import React, { useState } from "react";
import { TopBar, Avatar, Tag, timeAgo, initialsOf, ProgressBar } from "../components/LearnerUI.jsx";
import {
  Layers, Video, Calendar, FileText, Link2, ExternalLink, Flame, Users,
  CheckCircle2, Clock, Play, ArrowRight, BookOpen, Star, Sparkles, MessageCircle, Heart, GraduationCap
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchCohortActivityToday } from "../../lib/api/learner.js";
import { DEMO_MODE } from "../../lib/demoMode.js";

export function CohortScreen({
  cohort, cohortMembershipQuery, cohortPostsQuery, cohortResourcesQuery, cohortSessionsQuery,
  cohortCoursesQuery, cohortMembersQuery,
  // This learner's own courses (id + progress from their real
  // course_enrollments) - needed to say how far through the cohort's
  // assigned courses they actually are.
  courses = [],
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

  // The hero's "42% Completed" (and the width:"42%" bar under it) was the
  // one fabricated figure on an otherwise fully live screen. It is now this
  // learner's mean progress across the courses the cohort actually assigns:
  // cohort_courses.courses.id matched against their own course_enrollments
  // progress. fetchCohortAssignedCourses selects only (id, title,
  // description), so `cc.courses.progress` never existed either - the
  // per-course bars in the Assigned Courses tab were stuck at 0%.
  const progressByCourseId = new Map((courses || []).map((c) => [c.id, c.progress || 0]));
  const assignedCourseIds = assignedCourses.map((cc) => cc.courses?.id).filter(Boolean);
  const cohortCompletionPercent = assignedCourseIds.length
    ? Math.round(
        assignedCourseIds.reduce((sum, id) => sum + (progressByCourseId.get(id) || 0), 0) / assignedCourseIds.length
      )
    : null;
  const coursesLoading = Boolean(cohortCoursesQuery?.loading);

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
              {/* Real cohorts.name. The old fallbacks put an invented
                  cohort name and blurb on every unnamed/undescribed real
                  cohort; a cohort with no description now shows none. */}
              {cohort?.name || (DEMO_MODE ? "AI & Product Design Batch" : "Your Cohort")}
            </h1>
            {(cohort?.description || DEMO_MODE) && (
              <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.85)", margin: 0, maxWidth: 620, lineHeight: 1.4 }}>
                {cohort?.description || "Collaborative sprint track with live instructor sessions and peer critique."}
              </p>
            )}
          </div>

          <div style={{ textAlign: "right", flexShrink: 0, background: "rgba(255,255,255,0.1)", padding: "8px 14px", borderRadius: 12, backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)" }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#FFFFFF" }}>{(cohortMembersQuery?.data || []).length} Peers Enrolled</div>
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
              {/* Case C: nothing in the schema records sprints - no sprint
                  column, table, or cohort schedule - so the sprint counter
                  can only ever be illustrative. The label falls back to
                  what the bar actually measures. */}
              <span>{DEMO_MODE ? "Cohort Pace: Sprint 5 of 12" : "Your progress on assigned courses"}</span>
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
              {DEMO_MODE
                ? "42% Completed"
                : (cohortCompletionPercent != null
                    ? `${cohortCompletionPercent}% Completed`
                    : (coursesLoading ? "Loading…" : "No courses assigned"))}
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
              width: DEMO_MODE ? "42%" : `${cohortCompletionPercent ?? 0}%`,
              height: "100%",
              background: "linear-gradient(90deg, #10B981 0%, #34D399 50%, #6366F1 100%)",
              borderRadius: 99,
              boxShadow: "0 0 14px rgba(16, 185, 129, 0.8)",
              transition: "width 0.4s ease"
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
          {coursesLoading && <div className="tai-empty">Loading assigned courses...</div>}
          {!coursesLoading && assignedCourses.length === 0 && (
            <div className="tai-empty">No courses have been assigned to your cohort yet.</div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {assignedCourses.map(cc => (
              <div key={cc.id} className="tai-card tai-card-hover" style={{ padding: 22, borderRadius: 18, cursor: "pointer" }} onClick={() => push?.("courseDetail", { id: cc.courses?.id })}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", margin: "0 0 4px" }}>
                  {cc.courses?.title || "Untitled course"}
                </h3>
                <p style={{ fontSize: 12.5, color: "var(--text-3)", margin: "0 0 14px" }}>
                  {cc.courses?.description}
                </p>

                <div style={{ marginBottom: 16, background: "var(--surface-3)", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)" }}>
                  <div className="tai-row tai-between" style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>
                    <span style={{ color: "var(--text-2)" }}>Curriculum Pace</span>
                    <span style={{ color: "var(--primary)", fontWeight: 800, background: "var(--primary-tint)", padding: "2px 8px", borderRadius: 6 }}>
                      {/* `cc.courses.progress` is not selected by
                          fetchCohortAssignedCourses and never existed;
                          progress comes from this learner's own enrollment. */}
                      {progressByCourseId.get(cc.courses?.id) ?? 0}% Completed
                    </span>
                  </div>
                  <ProgressBar value={progressByCourseId.get(cc.courses?.id) ?? 0} height={9} />
                </div>

                <div className="tai-row tai-between" style={{ paddingTop: 12, borderTop: "1px solid var(--border)", gap: 10, flexWrap: "wrap" }}>
                  {/* cohort_courses.due_at is nullable - rendering it
                      unconditionally printed "Due: Invalid Date". */}
                  {cc.due_at && (
                    <span style={{ fontSize: 11.5, color: "var(--danger)", fontWeight: 700 }}>
                      Due: {new Date(cc.due_at).toLocaleDateString()}
                    </span>
                  )}
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
          {cohortMembersQuery?.loading && <div className="tai-empty">Loading facilitators...</div>}
          {!cohortMembersQuery?.loading && instructorMembers.length === 0 && (
            <div className="tai-empty">No instructor assigned to this cohort yet.</div>
          )}
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
