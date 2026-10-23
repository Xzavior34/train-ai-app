import { LoadingSkeleton } from "./../../components/common/PageLoadingBoundary.jsx";
import React, { useState } from "react";
import { TopBar, Avatar, Tag, timeAgo, initialsOf, ProgressBar } from "../components/LearnerUI.jsx";
import {
  Layers, Video, Calendar, FileText, Link2, ExternalLink, Flame, Users,
  CheckCircle2, Clock, Play, ArrowRight, ArrowLeft, BookOpen, Star, MessageCircle, Heart, GraduationCap, Send, Rocket, Edit3, Plus, X
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchCohortActivityToday } from "../../lib/api/learner.js";
import { fetchCohortSummary, createCohortPost, addCohortPostReply, toggleCohortPostReaction } from "../../lib/api/schemaHelper.js";
import { calculateCohortProgress, extendCohortTimeline, createCohortSession, assignCourseToCohortOrLearners } from "../../lib/api/cohorts.js";
import CapCohort3Screen from "./CapCohort3Screen.jsx";

export function CohortScreen({
  cohort: propCohort, cohortMembershipQuery, cohortPostsQuery, cohortResourcesQuery, cohortSessionsQuery,
  cohortCoursesQuery, cohortMembersQuery,
  courses = [], user,
  session, showToast = () => {}, back, push, goTab, params
}) {
  const [tab, setTab] = useState("chat"); // "chat" | "courses" | "resources" | "sessions" | "members"
  const [replyVisibility, setReplyVisibility] = useState({});
  const [newPostText, setNewPostText] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyInputs, setReplyInputs] = useState({});
  const [submittingReply, setSubmittingReply] = useState(false);
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [extendDays, setExtendDays] = useState(7);
  const [customEndDate, setCustomEndDate] = useState("");
  const [extending, setExtending] = useState(false);
  const [addSessionModalOpen, setAddSessionModalOpen] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionStartsAt, setSessionStartsAt] = useState("");
  const [sessionJoinUrl, setSessionJoinUrl] = useState("");
  const [sessionDescription, setSessionDescription] = useState("");
  const [savingSession, setSavingSession] = useState(false);
  const [assignCourseModalOpen, setAssignCourseModalOpen] = useState(false);
  const [modalCourseId, setModalCourseId] = useState("");
  const [modalAssignScope, setModalAssignScope] = useState("cohort"); // "cohort" | "individuals"
  const [modalSelectedUserIds, setModalSelectedUserIds] = useState([]);
  const [modalMemberFilter, setModalMemberFilter] = useState("");
  const [modalDueAt, setModalDueAt] = useState("");
  const [submittingAssignment, setSubmittingAssignment] = useState(false);

  const targetCohortId = params?.id || params?.cohortId || propCohort?.id || cohortMembershipQuery?.data?.cohort?.id;

  const knownCohort = [propCohort, ...(cohortMembershipQuery?.data?.allCohorts || [])].find(c => c?.id === targetCohortId);
  const fallbackCohortQuery = useSupabaseQuery(async () => {
    if (!targetCohortId) return null;
    return fetchCohortSummary(targetCohortId);
  }, [targetCohortId], { enabled: !!targetCohortId && !knownCohort && !cohortMembershipQuery?.loading, blocksPage: false });

  const resolvedCohort = [propCohort, ...(cohortMembershipQuery?.data?.allCohorts || []), fallbackCohortQuery.data?.cohort, cohortMembershipQuery?.data?.cohort]
    .find(c => c?.id === targetCohortId) || null;

  const activityTodayQuery = useSupabaseQuery(async () => {
    if (!resolvedCohort?.id) return 0;
    return fetchCohortActivityToday(resolvedCohort.id);
  }, [resolvedCohort?.id]);
  const activityToday = activityTodayQuery?.data || 0;

  if ((cohortMembershipQuery?.loading || fallbackCohortQuery?.loading) && !resolvedCohort) {
    return (
      <div>
        <TopBar title="Cohort" onBack={back} />
        <div className="tai-empty"><LoadingSkeleton label="Loading your cohort..." rows={3} /></div>
      </div>
    );
  }

  if (!resolvedCohort) {
    return (
      <div>
        <TopBar title="Cohort" onBack={back} />
        <div className="tai-empty" role={cohortMembershipQuery?.error || fallbackCohortQuery?.error ? "alert" : undefined}>
          {cohortMembershipQuery?.error || fallbackCohortQuery?.error || (targetCohortId ? "This cohort is unavailable. Ask your administrator to check your assignment." : "You have no cohort assignments yet. Your administrator can add you to a cohort.")}
          <button className="tai-btn tai-btn-primary" style={{ marginTop: 12 }} onClick={() => { cohortMembershipQuery?.refetch?.(); fallbackCohortQuery.refetch(); }}>Retry</button>
        </div>
      </div>
    );
  }

  const cohort = resolvedCohort;

  const posts = (cohortPostsQuery?.data ?? fallbackCohortQuery.data?.posts) || [];
  const resources = (cohortResourcesQuery?.data ?? fallbackCohortQuery.data?.resources) || [];
  const sessions = (cohortSessionsQuery?.data ?? fallbackCohortQuery.data?.sessions) || [];
  const rawAssignedCourses = (cohortCoursesQuery?.data ?? fallbackCohortQuery.data?.learnerCourses) || [];
  const courseMap = new Map((courses || []).map(c => [c.id, c]));
  const assignedCourses = (() => {
    if (rawAssignedCourses.length > 0) {
      const seen = new Set();
      return rawAssignedCourses
        .filter(cc => {
          const cid = cc.course_id || cc.courses?.id || cc.id;
          if (!cid || seen.has(cid)) return false;
          seen.add(cid);
          return true;
        })
        .map(cc => {
          const cid = cc.course_id || cc.courses?.id || cc.id;
          const matched = courseMap.get(cid);
          const realProgress = matched
            ? Math.round(Number(matched.progress) || 0)
            : Math.round(Number(cc.courses?.progress ?? cc.progress) || 0);
          return {
            ...cc,
            course_id: cid,
            courses: {
              ...(cc.courses || {}),
              id: cid,
              title: cc.courses?.title || matched?.title || "Assigned Cohort Course",
              description: cc.courses?.description || matched?.tagline || matched?.description || "",
              progress: realProgress,
            },
          };
        });
    }
    return [];
  })();
  const members = (cohortMembersQuery?.data ?? fallbackCohortQuery.data?.members) || [];

  const now = Date.now();
  const upcomingSessions = sessions.filter(s => new Date(s.starts_at).getTime() >= now);
  const pastSessions = sessions.filter(s => new Date(s.starts_at).getTime() < now);

  const instructorMembers = members.filter(
    m => m.cohort_role === "instructor" || m.isInstructor
  );
  const peerMembers = members.filter(
    m => m.cohort_role !== "instructor" && !m.isInstructor
  );

  const completedAssignedCount = assignedCourses.filter(cc => (cc.courses?.progress || 0) >= 100).length;
  const assignedCompletionRate = assignedCourses.length
    ? Math.round(assignedCourses.reduce((sum, cc) => sum + (Number(cc.courses?.progress) || 0), 0) / assignedCourses.length)
    : 0;

  const isAdminOrMentor = ["admin", "owner", "super_admin"].includes(user?.role) ||
    (cohortMembershipQuery?.data?.allMemberships || []).some(m => m.cohort_id === cohort.id && m.cohort_role === "instructor");

  const activeQuery = { chat: cohortPostsQuery, courses: cohortCoursesQuery, sessions: cohortSessionsQuery, resources: cohortResourcesQuery, members: cohortMembersQuery }[tab];
  const progressInfo = calculateCohortProgress(cohort?.starts_at, cohort?.ends_at);

  async function handleExtendTimeline(daysToAdd, explicitEnd) {
    if (!cohort?.id) return;
    setExtending(true);
    try {
      const res = await extendCohortTimeline({
        cohortId: cohort.id,
        extensionDays: daysToAdd || extendDays,
        newEndDate: explicitEnd || customEndDate || null,
      });
      showToast(res.message || `Cohort extended by ${daysToAdd || extendDays} days!`);
      setExtendModalOpen(false);
      cohortMembershipQuery?.refetch?.();
      fallbackCohortQuery.refetch?.();
    } catch (err) {
      showToast(err?.message || "Failed to extend cohort timeline.");
    } finally {
      setExtending(false);
    }
  }

  async function handleModalAssignCourse(e) {
    e.preventDefault();
    if (!cohort?.id || !modalCourseId) {
      showToast?.("Please choose a course from catalog to assign.");
      return;
    }
    if (modalAssignScope === "individuals" && modalSelectedUserIds.length === 0) {
      showToast?.("Please select at least one cohort member.");
      return;
    }
    setSubmittingAssignment(true);
    try {
      const res = await assignCourseToCohortOrLearners({
        cohortId: cohort.id,
        courseId: modalCourseId,
        scope: modalAssignScope,
        memberUserIds: modalSelectedUserIds,
        dueAt: modalDueAt || null,
        assignedBy: session?.user?.id || user?.id,
      });
      showToast?.(res.message || "Course assigned successfully!");
      setAssignCourseModalOpen(false);
      setModalCourseId("");
      setModalSelectedUserIds([]);
      setModalDueAt("");
      fallbackCohortQuery?.refetch?.();
      cohortCoursesQuery?.refetch?.();
    } catch (err) {
      showToast?.(err?.message || "Failed to assign course.");
    } finally {
      setSubmittingAssignment(false);
    }
  }

  async function handleCreateSession(e) {
    e.preventDefault();
    if (!sessionTitle.trim() || !sessionStartsAt) {
      showToast?.("Please enter a session title and date/time.");
      return;
    }
    setSavingSession(true);
    try {
      await createCohortSession({
        cohortId: cohort.id,
        createdBy: session?.user?.id,
        title: sessionTitle.trim(),
        description: sessionDescription.trim() || null,
        startsAt: new Date(sessionStartsAt).toISOString(),
        joinUrl: sessionJoinUrl.trim() || null,
      });
      showToast?.("Live Studio session scheduled!");
      setAddSessionModalOpen(false);
      setSessionTitle("");
      setSessionStartsAt("");
      setSessionJoinUrl("");
      setSessionDescription("");
      cohortSessionsQuery?.refetch?.();
      fallbackCohortQuery?.refetch?.();
    } catch (err) {
      showToast?.(err?.message || "Failed to schedule live studio session.");
    } finally {
      setSavingSession(false);
    }
  }


  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <TopBar title={cohort.name || "Cohort"} sub="" onBack={back} />

      <section className="tai-card tai-hero-card" style={{ padding: 18, borderRadius: 14, minWidth: 0 }} aria-label="Cohort overview">
        {cohortMembershipQuery?.data?.allCohorts?.length > 1 && (
          <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700 }}>
            Your cohorts
            <select aria-label="Switch cohort" value={cohort.id} onChange={e => push?.("cohort", { cohortId: e.target.value, id: e.target.value })}
              style={{ width: "100%", minWidth: 0, height: 44, padding: "0 10px", borderRadius: 8, background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", fontSize: 14 }}>
              {cohortMembershipQuery.data.allCohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 12, fontSize: 13 }}>
          <span>{members.length} members</span>
          {cohort.starts_at && cohort.ends_at && <span>{progressInfo.daysRemaining > 0 ? progressInfo.daysRemaining + " days left" : "Cohort ended"}</span>}
        </div>
        {cohort.starts_at && cohort.ends_at && <>
          <div role="progressbar" aria-label="Cohort timeline" aria-valuenow={progressInfo.percent} aria-valuemin={0} aria-valuemax={100} style={{ height: 6, background: "rgba(255,255,255,.18)", borderRadius: 8, marginTop: 10, overflow: "hidden" }}>
            <div style={{ width: progressInfo.percent + "%", height: "100%", background: "#34D399" }} />
          </div>
          <div style={{ marginTop: 8, fontSize: 12 }}>Week {progressInfo.currentWeek} of {progressInfo.totalWeeks}</div>
        </>}
        <details style={{ marginTop: 12, fontSize: 13 }}>
          <summary style={{ cursor: "pointer", padding: "6px 0" }}>Cohort details</summary>
          {cohort.description && <p>{cohort.description}</p>}
          {cohort.starts_at && <p>Starts {new Date(cohort.starts_at).toLocaleDateString()}</p>}
          {cohort.ends_at && <p>Ends {new Date(cohort.ends_at).toLocaleDateString()}</p>}
          <p>{completedAssignedCount} of {assignedCourses.length} courses completed</p>
        </details>
        {isAdminOrMentor && <button type="button" className="tai-btn" style={{ marginTop: 10 }} onClick={() => setExtendModalOpen(true)}><Clock size={14} /> Extend timeline</button>}
      </section>

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
          { k: "chat", label: `Discussion (${posts.length})`, icon: MessageCircle },
          { k: "cap", label: "CAP programme", icon: Rocket },
          { k: "sessions", label: `Live Sessions (${sessions.length})`, icon: Video },
          { k: "courses", label: `Courses (${assignedCourses.length})`, icon: BookOpen },
          { k: "resources", label: `Resources (${resources.length})`, icon: FileText },
          { k: "members", label: `People (${members.length})`, icon: Users },
        ].filter(t => t.k !== "cap" || /cap\s*(cohort\s*)?3|accelerator/i.test(`${cohort.name} ${cohort.program_name || ""}`)).map(t => {
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

      {activeQuery?.error && <div className="tai-card" role="alert" style={{ padding: 16 }}><p>{activeQuery.error}</p><button className="tai-btn tai-btn-outline" onClick={activeQuery.refetch}>Retry</button></div>}
      {/* =========================================================================
          TAB 1: ANNOUNCEMENTS & FEED
          ========================================================================= */}
      {tab === "chat" && (
        <div className="tai-col tai-gap14">
          {/* Read-only - only instructors/admins can post here (learners can read). */}
          {cohortPostsQuery?.loading && <div className="tai-empty"><LoadingSkeleton label="Loading cohort chat..." rows={3} /></div>}
          {!cohortPostsQuery?.loading && !cohortPostsQuery?.error && posts.length === 0 && (
            <div className="tai-empty">No announcements from your instructor yet.</div>
          )}
          {posts.map(cp => {
            const replies = cp.cohort_post_replies || [];
            const repliesOpen = replyVisibility[cp.id] ?? replies.length > 0;
            return (
            <div
              key={cp.id}
              className="tai-card"
              style={{
                padding: 20,
                borderRadius: 10,
                border: cp.is_announcement ? "1.5px solid rgba(59, 130, 246, 0.4)" : "1px solid var(--border)",
                background: "var(--surface)"
              }}
            >
              <div className="tai-row tai-between" style={{ marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
                <div className="tai-row tai-gap10" style={{ minWidth: 0, flex: "1 1 180px" }}>
                  <Avatar initials={initialsOf(cp.user_profiles?.display_name)} size={38} src={cp.user_profiles?.avatar_url} />
                  <div style={{ minWidth: 0 }}>
                    <div className="tai-row tai-gap6" style={{ flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{cp.user_profiles?.display_name || "Cohort Member"}</span>
                      {cp.user_profiles?.role === "admin" || cp.user_profiles?.role === "mentor" ? (
                        <span style={{ background: "#2563EB", color: "#fff", fontSize: 9.5, fontWeight: 800, padding: "1px 6px", borderRadius: 4, flexShrink: 0 }}>
                          INSTRUCTOR
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>{timeAgo(cp.created_at)}</div>
                  </div>
                </div>
                {cp.is_announcement && <Tag tone="warning">Announcement</Tag>}
              </div>

              <p style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.6, margin: "0 0 12px", whiteSpace: "pre-wrap" }}>
                {cp.content}
              </p>

              <div className="tai-row tai-between" style={{ paddingTop: 12, borderTop: "1px solid var(--border)", alignItems: "center" }}>
                <button
                  type="button"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12.5,
                    color: "var(--text-2)",
                    fontWeight: 700,
                    padding: "4px 8px",
                    borderRadius: 6
                  }}
                  onClick={async () => {
                    if (!session?.user?.id) return;
                    try {
                      await toggleCohortPostReaction({ postId: cp.id, userId: session.user.id });
                      cohortPostsQuery?.refetch();
                    } catch {}
                  }}
                >
                  <Heart size={14} color="#EF4444" fill={cp.reaction_count > 0 ? "#EF4444" : "none"} />
                  <span>{cp.reaction_count || 0} Likes</span>
                </button>

                <button
                  className="tai-btn tai-btn-ghost tai-btn-sm"
                  onClick={() => setReplyVisibility(prev => ({ ...prev, [cp.id]: !repliesOpen }))}
                >
                  <MessageCircle size={13} /> {replies.length} Replies
                </button>
              </div>

              {repliesOpen && (
                <div className="tai-col tai-gap8" style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                  {replies.map(rep => (
                    <div key={rep.id} style={{ background: "var(--surface-3)", padding: "10px 14px", borderRadius: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span style={{ fontWeight: 800, fontSize: 12.5, color: "var(--text)" }}>{rep.user_profiles?.display_name || "Peer"}:</span>
                        <span style={{ fontSize: 11, color: "var(--text-3)" }}>{timeAgo(rep.created_at)}</span>
                      </div>
                      <span style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.45 }}>{rep.content}</span>
                    </div>
                  ))}

                  {/* Reply Input Form */}
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <input
                      type="text"
                      placeholder="Write a reply..."
                      value={replyInputs[cp.id] || ""}
                      onChange={(e) => setReplyInputs(prev => ({ ...prev, [cp.id]: e.target.value }))}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && !e.shiftKey && (replyInputs[cp.id] || "").trim()) {
                          e.preventDefault();
                          if (!session?.user?.id) return;
                          setSubmittingReply(true);
                          try {
                            await addCohortPostReply({
                              postId: cp.id,
                              authorId: session.user.id,
                              content: (replyInputs[cp.id] || "").trim()
                            });
                            setReplyInputs(prev => ({ ...prev, [cp.id]: "" }));
                            cohortPostsQuery?.refetch();
                          } catch (err) {
                            showToast?.(err?.message || "Failed to post reply.");
                          } finally {
                            setSubmittingReply(false);
                          }
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "var(--surface-2)",
                        color: "var(--text)",
                        fontSize: 12.5,
                        outline: "none"
                      }}
                    />
                    <button
                      className="tai-btn tai-btn-primary tai-btn-sm"
                      disabled={submittingReply || !(replyInputs[cp.id] || "").trim()}
                      onClick={async () => {
                        if (!session?.user?.id || !(replyInputs[cp.id] || "").trim()) return;
                        setSubmittingReply(true);
                        try {
                          await addCohortPostReply({
                            postId: cp.id,
                            authorId: session.user.id,
                            content: (replyInputs[cp.id] || "").trim()
                          });
                          setReplyInputs(prev => ({ ...prev, [cp.id]: "" }));
                          cohortPostsQuery?.refetch();
                        } catch (err) {
                          showToast?.(err?.message || "Failed to post reply.");
                        } finally {
                          setSubmittingReply(false);
                        }
                      }}
                    >
                      Reply
                    </button>
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          TAB 2: LIVE SESSIONS
          ========================================================================= */}
      {tab === "sessions" && (
        <div className="tai-col tai-gap16">
          {isAdminOrMentor && (
            <div className="tai-row tai-between" style={{ alignItems: "center", background: "var(--surface)", padding: "14px 18px", borderRadius: 10, border: "1px solid var(--border)", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>Instructor Live Studio Controls</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Schedule, announce, and broadcast live workshops or code reviews for this cohort</div>
              </div>
              <button
                type="button"
                className="tai-btn tai-btn-primary tai-btn-sm"
                onClick={() => setAddSessionModalOpen(true)}
              >
                <Plus size={14} /> Schedule Live Studio
              </button>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 20 }}>
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
                  <span>Facilitator: <strong>{s.host_name || s.instructor || "Train AI Mentor"}</strong></span>
                </div>

                <div className="tai-row tai-between" style={{ paddingTop: 12, borderTop: "1px solid var(--border)", gap: 10, flexWrap: "wrap" }}>
                  <Avatar src={s.instructorAvatar} initials={initialsOf(s.host_name || s.instructor || "SF")} size={32} />
                  {s.join_url ? (
                    <a href={s.join_url} target="_blank" rel="noreferrer" className="tai-btn tai-btn-primary tai-btn-sm" style={{ textDecoration: "none" }}>
                      <Video size={13} /> Join Virtual Studio →
                    </a>
                  ) : (
                    <a href={s.recording_url || s.external_url || "#"} target="_blank" rel="noreferrer" className="tai-btn tai-btn-outline tai-btn-sm" style={{ textDecoration: "none" }}>
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
          <div className="tai-card" style={{ padding: "14px 16px", borderRadius: 10, border: "1px solid var(--border)" }}>
            <div className="tai-row tai-between" style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>
              <span style={{ color: "var(--text-2)" }}>Cohort Assigned-Course Completion Rate</span>
              <span style={{ color: "var(--primary)", fontWeight: 800 }}>{completedAssignedCount} of {assignedCourses.length} ({assignedCompletionRate}%)</span>
            </div>
            <ProgressBar value={assignedCompletionRate} height={8} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 20 }}>
            {assignedCourses.map(cc => (
              <div key={cc.id} className="tai-card tai-card-hover" style={{ padding: 22, borderRadius: 10, cursor: "pointer" }} onClick={() => push?.("courseDetail", { id: cc.courses?.id || cc.course_id })}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", margin: "0 0 4px" }}>
                  {cc.courses?.title || "Assigned Cohort Course"}
                </h3>
                <p style={{ fontSize: 12.5, color: "var(--text-3)", margin: "0 0 14px" }}>
                  {cc.courses?.description || "Curriculum requirement for this cohort track."}
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
                  <span style={{ fontSize: 11.5, color: cc.due_at ? "var(--danger)" : "var(--text-3)", fontWeight: 700 }}>
                    {cc.due_at ? `Due: ${new Date(cc.due_at).toLocaleDateString()}` : "Active Track"}
                  </span>
                  <button
                    className="tai-btn tai-btn-primary tai-btn-sm"
                    onClick={(e) => { e.stopPropagation(); push("courseDetail", { id: cc.courses?.id || cc.course_id }); }}
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
          {cohortResourcesQuery?.loading && <div className="tai-empty"><LoadingSkeleton label="Loading resources..." rows={3} /></div>}
          {!cohortResourcesQuery?.loading && !cohortResourcesQuery?.error && resources.length === 0 && (
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
                  href={r.external_url || r.file_url || r.url || "#"}
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
          TAB: CAP COHORT 3 ACCELERATOR
          ========================================================================= */}
      {tab === "cap" && (
        <CapCohort3Screen
          session={session}
          showToast={showToast}
          push={push}
          goTab={goTab}
          cohortId={cohort?.id}
          courses={courses}
          user={user}
        />
      )}

      {/* =========================================================================
          TAB 5: FACILITATORS
          ========================================================================= */}
      {tab === "members" && (
        <div className="tai-col tai-gap16">
          {cohortMembersQuery?.loading && !members.length && <div className="tai-empty"><LoadingSkeleton label="Loading members..." rows={3} /></div>}
          {!cohortMembersQuery?.loading && !cohortMembersQuery?.error && members.length === 0 && (
            <div className="tai-empty">No members in this cohort yet.</div>
          )}
          <div className="tai-grid2">
            {members.map(m => {
              const isInstructor = m.user_profiles?.role === "mentor" || m.user_profiles?.role === "admin";
              return (
                <div key={m.id} className="tai-card" style={{ padding: "14px 16px", borderRadius: 10 }}>
                  <div className="tai-row tai-gap12" style={{ alignItems: "center", justifyContent: "space-between" }}>
                    <div className="tai-row tai-gap10" style={{ minWidth: 0, flex: 1 }}>
                      <Avatar src={m.user_profiles?.avatar_url} initials={initialsOf(m.user_profiles?.display_name)} size={40} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.user_profiles?.display_name || "Cohort Member"}
                        </div>
                        {isInstructor && (
                          <span style={{ background: "#2563EB", color: "#fff", fontSize: 9.5, fontWeight: 800, padding: "1px 6px", borderRadius: 4 }}>
                            INSTRUCTOR
                          </span>
                        )}
                      </div>
                    </div>
                    {isInstructor && (
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
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          ADMIN / MENTOR MODAL: EXTEND COHORT TIMELINE
          ========================================================================= */}
      {extendModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(6px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--surface, #1E293B)",
              border: "1.5px solid var(--border, rgba(255,255,255,0.15))",
              borderRadius: 16,
              padding: 26,
              maxWidth: 480,
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              color: "var(--text, #FFFFFF)",
            }}
          >
            <div className="tai-row tai-between" style={{ marginBottom: 12, alignItems: "flex-start" }}>
              <div className="tai-row tai-gap10" style={{ alignItems: "center" }}>
                <div className="tai-decoration-icon" style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(59, 130, 246, 0.15)", color: "#60A5FA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Clock size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 900, margin: 0, color: "var(--text, #FFF)" }}>Extend Cohort Timeline</h3>
                  <div style={{ fontSize: 12, color: "var(--text-3, #94A3B8)", marginTop: 2 }}>{cohort?.name}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExtendModalOpen(false)}
                style={{ background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer", padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ background: "var(--surface-2, rgba(0,0,0,0.25))", borderRadius: 10, padding: 12, border: "1px solid var(--border, rgba(255,255,255,0.08))", marginBottom: 16, fontSize: 12 }}>
              <div className="tai-row tai-between" style={{ marginBottom: 4 }}>
                <span style={{ color: "var(--text-3)" }}>Current End Date:</span>
                <span style={{ fontWeight: 700, color: "var(--text)" }}>{cohort?.ends_at ? new Date(cohort.ends_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "TBD"}</span>
              </div>
              <div className="tai-row tai-between">
                <span style={{ color: "var(--text-3)" }}>Current Pacing:</span>
                <span style={{ fontWeight: 700, color: "#34D399" }}>{progressInfo.daysRemaining} Days Left &bull; Week {progressInfo.currentWeek} of {progressInfo.totalWeeks}</span>
              </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2, #CBD5E1)", marginBottom: 8 }}>
              Quick Extension Presets:
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 16 }}>
              {[
                { label: "+1 Week (+7 Days)", days: 7 },
                { label: "+2 Weeks (+14 Days)", days: 14 },
                { label: "+3 Weeks (+21 Days)", days: 21 },
                { label: "+4 Weeks (+28 Days)", days: 28 },
              ].map(opt => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => { setExtendDays(opt.days); setCustomEndDate(""); }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    border: extendDays === opt.days && !customEndDate ? "2px solid #3B82F6" : "1px solid var(--border, rgba(255,255,255,0.12))",
                    background: extendDays === opt.days && !customEndDate ? "rgba(59, 130, 246, 0.2)" : "var(--surface-3, rgba(255,255,255,0.04))",
                    color: extendDays === opt.days && !customEndDate ? "#60A5FA" : "var(--text, #FFF)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2, #CBD5E1)", marginBottom: 6 }}>
                Or Pick Custom Completion Date:
              </div>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  background: "var(--surface-2, rgba(0,0,0,0.3))",
                  border: "1px solid var(--border, rgba(255,255,255,0.15))",
                  color: "var(--text, #FFF)",
                  outline: "none",
                }}
              />
            </div>

            <div className="tai-row tai-between" style={{ gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="tai-btn tai-btn-outline tai-btn-sm"
                onClick={() => setExtendModalOpen(false)}
                disabled={extending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tai-btn tai-btn-primary tai-btn-sm"
                onClick={() => handleExtendTimeline(extendDays, customEndDate || null)}
                disabled={extending}
                style={{ padding: "8px 18px", fontWeight: 800 }}
              >
                {extending ? "Updating Cohort..." : "Save & Extend Cohort"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Live Studio Modal (Instructors / Admins) */}
      {addSessionModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              background: "var(--surface, #1E293B)",
              borderRadius: 14,
              padding: 26,
              maxWidth: 480,
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
              color: "var(--text, #FFF)",
              border: "1px solid var(--border, rgba(255,255,255,0.1))",
            }}
          >
            <div className="tai-row tai-between" style={{ marginBottom: 14, alignItems: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Schedule Live Studio Session</div>
              <button
                type="button"
                className="tai-iconbtn"
                onClick={() => setAddSessionModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: 12.5, color: "var(--text-3)", margin: "0 0 16px", lineHeight: 1.45 }}>
              Create a scheduled virtual workshop or code critique session for all enrolled learners in this cohort.
            </p>

            <form onSubmit={handleCreateSession}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Session Title *</div>
                <input
                  type="text"
                  className="tai-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                  placeholder="e.g. Sprint 2 Architecture Review & Code Lab"
                  required
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Starts At (Date & Time) *</div>
                <input
                  type="datetime-local"
                  className="tai-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                  required
                  value={sessionStartsAt}
                  onChange={(e) => setSessionStartsAt(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Virtual Studio Join URL (Google Meet / Zoom)</div>
                <input
                  type="url"
                  className="tai-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                  placeholder="https://meet.google.com/..."
                  value={sessionJoinUrl}
                  onChange={(e) => setSessionJoinUrl(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Session Agenda & Notes</div>
                <textarea
                  className="tai-input"
                  rows={3}
                  style={{ width: "100%", boxSizing: "border-box" }}
                  placeholder="What will learners build or review in this live studio?"
                  value={sessionDescription}
                  onChange={(e) => setSessionDescription(e.target.value)}
                />
              </div>

              <div className="tai-row tai-between" style={{ gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="tai-btn tai-btn-outline tai-btn-sm"
                  onClick={() => setAddSessionModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tai-btn tai-btn-primary tai-btn-sm"
                  disabled={savingSession}
                  style={{ padding: "8px 18px", fontWeight: 800 }}
                >
                  {savingSession ? "Scheduling..." : "Schedule Live Studio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
}
