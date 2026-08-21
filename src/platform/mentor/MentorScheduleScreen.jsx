import React, { useState, useContext } from "react";
import { TopBar, Tag, ToastContext } from "../components/PlatformUI.jsx";
import { Calendar, Trash2, Plus, Video, CheckCircle2, XCircle, Clock, MessageSquare, ExternalLink } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchMentorSessions, fetchMentorAvailability, createAvailabilitySlot, deleteAvailabilitySlot,
} from "../../lib/api/schemaHelper.js";
import { updateSessionStatus, completeMentorshipSession, rescheduleMentorshipSession } from "../../lib/api/platform.js";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function MentorScheduleScreen({ mentorId, orgSelector }) {
  const showToast = useContext(ToastContext);
  const [tab, setTab] = useState("sessions");
  const [sessionFilter, setSessionFilter] = useState("all");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [saving, setSaving] = useState(false);

  const [updatingSessionId, setUpdatingSessionId] = useState(null);
  const [completingSessionId, setCompletingSessionId] = useState(null);
  const [completionFeedback, setCompletionFeedback] = useState("");
  const [reschedulingSessionId, setReschedulingSessionId] = useState(null);
  const [rescheduleDateTime, setRescheduleDateTime] = useState("");

  const sessionsQuery = useSupabaseQuery(async () => mentorId ? fetchMentorSessions(mentorId) : [], [mentorId]);
  const availabilityQuery = useSupabaseQuery(async () => mentorId ? fetchMentorAvailability(mentorId) : [], [mentorId]);

  const rawSessions = sessionsQuery.data || [];

  const sessions = rawSessions.map(s => ({ ...s, status: s.status || "confirmed" }));

  const filteredSessions = sessions.filter(s => {
    if (sessionFilter === "upcoming") return s.status === "confirmed" || s.status === "requested";
    if (sessionFilter === "completed") return s.status === "completed";
    if (sessionFilter === "cancelled") return s.status === "cancelled";
    return true;
  });

  const availability = (availabilityQuery.data || []).slice().sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));

  async function handleAddSlot() {
    if (!mentorId || startTime >= endTime) {
      showToast("End time must be after start time.");
      return;
    }
    setSaving(true);
    try {
      await createAvailabilitySlot(mentorId, Number(dayOfWeek), startTime, endTime);
      availabilityQuery.refetch();
      showToast("Availability slot added.");
    } catch (e) {
      showToast(e.message || "Could not add availability slot.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSlot(id) {
    try {
      await deleteAvailabilitySlot(id);
      availabilityQuery.refetch();
      showToast("Availability slot removed.");
    } catch (e) {
      showToast(e.message || "Could not remove slot.");
    }
  }

  async function handleUpdateSessionStatus(sessionId, newStatus, message) {
    setUpdatingSessionId(sessionId);
    try {
      await updateSessionStatus(sessionId, { status: newStatus });
      await sessionsQuery.refetch();
      showToast(message);
    } catch (e) {
      showToast(e?.message || "Could not update this session.");
    } finally {
      setUpdatingSessionId(null);
    }
  }

  async function handleCompleteSession(sessionId, feedback) {
    setUpdatingSessionId(sessionId);
    try {
      const result = await completeMentorshipSession(sessionId, feedback);
      if (!result.success) { showToast(result.error); return; }
      await sessionsQuery.refetch();
      setCompletingSessionId(null);
      setCompletionFeedback("");
      showToast("Session marked complete - earnings recorded.");
    } finally {
      setUpdatingSessionId(null);
    }
  }

  async function handleReschedule(sessionId, newDateTime) {
    if (!newDateTime) return;
    setUpdatingSessionId(sessionId);
    try {
      const result = await rescheduleMentorshipSession(sessionId, new Date(newDateTime).toISOString());
      if (!result.success) { showToast(result.error); return; }
      await sessionsQuery.refetch();
      setReschedulingSessionId(null);
      showToast("Session rescheduled.");
    } finally {
      setUpdatingSessionId(null);
    }
  }

  return (
    <div className="ta-fade">
      <TopBar title="Schedule &amp; Sessions" sub="Manage 1:1 sessions, student requests &amp; recurring availability" orgSelector={orgSelector} />
      <div className="ta-content">
        <div className="ta-tabs">
          {[{ k: "sessions", label: "Sessions & Bookings" }, { k: "availability", label: "Weekly Availability" }].map(t => (
            <div key={t.k} className={`ta-tab ${tab === t.k ? "active" : ""}`} onClick={() => setTab(t.k)}>{t.label}</div>
          ))}
        </div>

        {tab === "sessions" && (
          <>
            <div className="ta-card ta-mt16" style={{ padding: "12px 14px" }}>
              <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <div style={{
                  display: "flex",
                  gap: 6,
                  overflowX: "auto",
                  WebkitOverflowScrolling: "touch",
                  maxWidth: "100%",
                  paddingBottom: 2
                }}>
                  {["all", "upcoming", "completed", "cancelled"].map(f => (
                    <div
                      key={f}
                      className={`ta-pill ${sessionFilter === f ? "active" : ""}`}
                      onClick={() => setSessionFilter(f)}
                      style={{
                        flexShrink: 0,
                        padding: "5px 10px",
                        fontSize: 11,
                        cursor: "pointer"
                      }}
                    >
                      {f.toUpperCase()}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600, flexShrink: 0 }}>
                  {filteredSessions.length} session{filteredSessions.length === 1 ? "" : "s"} listed
                </div>
              </div>
            </div>

            <div className="ta-col ta-gap12 ta-mt16 anim-stagger">
              {!mentorId && <div className="ta-empty">Your instructor profile isn't linked to an instructor record yet.</div>}
              {mentorId && sessionsQuery.loading && <div className="ta-empty">Loading sessions...</div>}
              {mentorId && !sessionsQuery.loading && sessions.length === 0 && <div className="ta-empty">No sessions yet. Booked and requested sessions with your mentees will show up here.</div>}
              {filteredSessions.map(s => (
                <div key={s.id} className="ta-card ta-row ta-between" style={{ flexWrap: "wrap", gap: 14, alignItems: "center" }}>
                  <div className="ta-row ta-gap12" style={{ minWidth: 0, flex: "1 1 240px" }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Calendar size={18} color="var(--primary)" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>{s.title || "Instructor Session"}</div>
                      <div className="ta-row ta-gap8 ta-mt4" style={{ fontSize: 12, color: "var(--text-2)", flexWrap: "wrap" }}>
                        <span>Learner: <strong>{s.learner_name || "Learner"}</strong></span>
                        <span>•</span>
                        <span className="ta-row ta-gap4">
                          <Clock size={12} />
                          {(() => {
                            const d = new Date(s.scheduled_at);
                            return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} (${s.duration_minutes || 30}m)`;
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="ta-row ta-gap8" style={{ flexWrap: "wrap", alignItems: "center" }}>
                    <Tag tone={s.status === "completed" ? "success" : s.status === "cancelled" ? "danger" : s.status === "requested" ? "warning" : "primary"}>
                      {s.status.toUpperCase()}
                    </Tag>

                    {s.status === "requested" && (
                      <button
                        className="ta-btn ta-btn-primary ta-btn-sm"
                        onClick={() => handleUpdateSessionStatus(s.id, "confirmed", "Session confirmed!")}
                      >
                        <CheckCircle2 size={13} /> Confirm Request
                      </button>
                    )}

                    {s.status === "confirmed" && (
                      <>
                        {s.meeting_url ? (
                          <a
                            href={s.meeting_url}
                            target="_blank"
                            rel="noreferrer"
                            className="ta-btn ta-btn-primary ta-btn-sm"
                            style={{ textDecoration: "none" }}
                          >
                            <Video size={14} /> Join Call
                          </a>
                        ) : (
                          <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>No link set</span>
                        )}
                        <button
                          className="ta-btn ta-btn-outline ta-btn-sm"
                          onClick={() => { setCompletingSessionId(s.id); setCompletionFeedback(""); }}
                        >
                          <CheckCircle2 size={13} /> Complete
                        </button>
                        <button
                          className="ta-btn ta-btn-outline ta-btn-sm"
                          onClick={() => { setReschedulingSessionId(s.id); setRescheduleDateTime(""); }}
                        >
                          <Clock size={13} /> Reschedule
                        </button>
                      </>
                    )}

                    {completingSessionId === s.id && (
                      <div className="ta-col ta-gap8 ta-mt10" style={{ width: "100%" }}>
                        <textarea
                          className="ta-input" rows={2} placeholder="Optional feedback for this session..."
                          value={completionFeedback} onChange={(e) => setCompletionFeedback(e.target.value)}
                        />
                        <div className="ta-row ta-gap8">
                          <button className="ta-btn ta-btn-primary ta-btn-sm" disabled={updatingSessionId === s.id} onClick={() => handleCompleteSession(s.id, completionFeedback)}>
                            {updatingSessionId === s.id ? "Saving..." : "Confirm Complete"}
                          </button>
                          <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => setCompletingSessionId(null)}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {reschedulingSessionId === s.id && (
                      <div className="ta-col ta-gap8 ta-mt10" style={{ width: "100%" }}>
                        <input type="datetime-local" className="ta-input" value={rescheduleDateTime} onChange={(e) => setRescheduleDateTime(e.target.value)} />
                        <div className="ta-row ta-gap8">
                          <button className="ta-btn ta-btn-primary ta-btn-sm" disabled={updatingSessionId === s.id || !rescheduleDateTime} onClick={() => handleReschedule(s.id, rescheduleDateTime)}>
                            {updatingSessionId === s.id ? "Saving..." : "Confirm Reschedule"}
                          </button>
                          <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => setReschedulingSessionId(null)}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {(s.status === "confirmed" || s.status === "requested") && (
                      <button
                        className="ta-btn ta-btn-danger ta-btn-sm"
                        onClick={() => handleUpdateSessionStatus(s.id, "cancelled", "Session canceled.")}
                      >
                        <XCircle size={13} /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "availability" && (
          <>
            <div className="ta-card ta-mt16" style={{ maxWidth: 560 }}>
              <div className="ta-title">Add recurring weekly availability</div>
              <div className="ta-row ta-gap10 ta-mt12" style={{ flexWrap: "wrap" }}>
                <select className="ta-input" value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value)}>
                  {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
                <input className="ta-input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                <span style={{ color: "var(--text-3)" }}>to</span>
                <input className="ta-input" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                <button className="ta-btn ta-btn-primary" disabled={!mentorId || saving} onClick={handleAddSlot}>
                  <Plus size={15} /> Add slot
                </button>
              </div>
              {!mentorId && <div className="ta-empty" style={{ padding: "10px 0 0" }}>Your instructor profile isn't linked to an instructor record yet.</div>}
            </div>

            <div className="ta-card ta-mt16">
              <div className="ta-title">Weekly Availability Roster</div>
              <div className="ta-col ta-gap10 ta-mt12 anim-stagger">
                {availabilityQuery.loading && <div className="ta-empty">Loading availability...</div>}
                {!availabilityQuery.loading && availability.length === 0 && <div className="ta-empty">No recurring availability set yet. Learners can't see open slots until you add some.</div>}
                {availability.map(a => (
                  <div key={a.id} className="ta-row ta-between" style={{ padding: 12, background: "var(--surface-3)", borderRadius: 12 }}>
                    <div className="ta-row ta-gap10">
                      <span style={{ fontWeight: 600 }}>{DAY_NAMES[a.day_of_week] || `Day ${a.day_of_week}`}</span>
                      <span style={{ color: "var(--text-2)", fontSize: 13 }}>{(a.start_time || "").slice(0, 5)} - {(a.end_time || "").slice(0, 5)}</span>
                      {a.is_available === false && <Tag tone="danger">disabled</Tag>}
                    </div>
                    <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => handleDeleteSlot(a.id)}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
