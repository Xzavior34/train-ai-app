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
      <TopBar title="Availability & Sessions" sub="Manage 1:1 sessions, student requests & recurring weekly availability" orgSelector={orgSelector} />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        
        {/* =========================================================================
            SCHEDULING HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner">

          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <div className="ta-row ta-gap10" style={{ flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{
                  background: "rgba(99, 102, 241, 0.35)", color: "#E0E7FF",
                  border: "1px solid rgba(165, 180, 252, 0.5)",
                  fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99,
                  display: "inline-flex", alignItems: "center", gap: 6, letterSpacing: "0.03em"
                }}>
                  <Calendar size={13} color="#A5B4FC" /> LIVE TEACHING STUDIO
                </span>
                <span style={{
                  background: "rgba(16, 185, 129, 0.28)", color: "#A7F3D0",
                  border: "1px solid rgba(16, 185, 129, 0.5)",
                  fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99
                }}>
                  {filteredSessions.filter(s => s.status === "confirmed").length} CONFIRMED SESSIONS
                </span>
              </div>

              <h1 className="ta-hero-title">
                Availability &amp; Live Sessions
              </h1>
              <p className="ta-hero-desc">
                Host 1:1 clarification video calls, manage recurring office hours, and confirm student booking requests.
              </p>
            </div>

            <div className="ta-hero-actions">
              <a
                href="https://meet.google.com/new"
                target="_blank"
                rel="noreferrer"
                className="ta-btn ta-btn-primary"
                style={{
                  background: "#4F46E5", color: "#fff", border: "none", fontWeight: 800,
                  boxShadow: "0 4px 16px rgba(79, 70, 229, 0.4)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6
                }}
              >
                <Video size={15} /> Instant Live Room
              </a>
            </div>
          </div>
        </div>

        {/* Top 3 KPI Metric Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <div className="ta-card" style={{ padding: "20px 22px", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Total Booked</span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(99, 102, 241, 0.12)", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Calendar size={18} />
              </div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: "var(--text)", marginTop: 10, letterSpacing: "-0.02em" }}>
              {sessions.length}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 8 }}>
              {sessions.filter(s => s.status === "completed").length} completed successfully
            </div>
          </div>

          <div className="ta-card" style={{ padding: "20px 22px", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Teaching Hours</span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(16, 185, 129, 0.12)", color: "#10B981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Clock size={18} />
              </div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#10B981", marginTop: 10, letterSpacing: "-0.02em" }}>
              {Math.round(sessions.reduce((sum, s) => sum + (s.duration_minutes || 30), 0) / 60)} hrs
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 8 }}>
              Avg session: 30-45 mins
            </div>
          </div>

          <div className="ta-card" style={{ padding: "20px 22px", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Weekly Slots</span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(245, 158, 11, 0.15)", color: "#F59E0B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Clock size={18} />
              </div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#F59E0B", marginTop: 10, letterSpacing: "-0.02em" }}>
              {availability.length} active
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 8 }}>
              Configured across {new Set(availability.map(a => a.day_of_week)).size} days
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="ta-card" style={{ padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { k: "sessions", label: "Sessions & Bookings" },
              { k: "availability", label: "Weekly Availability" }
            ].map(t => (
              <button
                key={t.k}
                className={`ta-pill ${tab === t.k ? "active" : ""}`}
                onClick={() => setTab(t.k)}
                style={{
                  padding: "7px 16px",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none"
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === "sessions" && (
          <>
            {/* Filter Pills */}
            <div className="ta-card" style={{ padding: "12px 14px", background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <div style={{ display: "flex", gap: 6, overflowX: "auto", maxWidth: "100%", paddingBottom: 2 }}>
                  {["all", "upcoming", "completed", "cancelled"].map(f => (
                    <button
                      key={f}
                      className={`ta-pill ${sessionFilter === f ? "active" : ""}`}
                      onClick={() => setSessionFilter(f)}
                      style={{
                        padding: "5px 12px",
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        border: "none"
                      }}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>
                  {filteredSessions.length} session{filteredSessions.length === 1 ? "" : "s"} listed
                </div>
              </div>
            </div>

            {/* Sessions Queue Cards */}
            <div className="ta-col ta-gap12 anim-stagger">
              {sessionsQuery.loading && <div className="ta-empty">Loading sessions...</div>}
              {!sessionsQuery.loading && filteredSessions.length === 0 && (
                <div className="ta-card" style={{ textAlign: "center", padding: 36 }}>
                  <Calendar size={32} color="var(--primary)" style={{ opacity: 0.5, marginBottom: 8 }} />
                  <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>No sessions matching filter</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 4 }}>Booked and requested 1:1 sessions will appear here.</div>
                </div>
              )}

              {filteredSessions.map(s => (
                <div key={s.id} className="ta-card ta-row ta-between" style={{ padding: "18px 20px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
                  <div className="ta-row ta-gap14" style={{ minWidth: 0, flex: "1 1 260px" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 8, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Calendar size={20} color="var(--primary)" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)" }}>{s.title || "1:1 Instructor Clarification Session"}</div>
                      <div className="ta-row ta-gap8 ta-mt4" style={{ fontSize: 12.5, color: "var(--text-2)", flexWrap: "wrap" }}>
                        <span>Learner: <strong style={{ color: "var(--text)" }}>{s.learner_name || "Enrolled Learner"}</strong></span>
                        <span>•</span>
                        <span className="ta-row ta-gap4">
                          <Clock size={13} color="var(--primary)" />
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
                      <button className="ta-btn ta-btn-primary ta-btn-sm" onClick={() => handleUpdateSessionStatus(s.id, "confirmed", "Session confirmed!")}>
                        Confirm Request
                      </button>
                    )}

                    {s.status === "confirmed" && (
                      <div className="ta-row ta-gap8" style={{ flexWrap: "wrap", alignItems: "center" }}>
                        <a
                          href={s.meeting_url || "https://meet.google.com/new"}
                          target="_blank"
                          rel="noreferrer"
                          className="ta-btn ta-btn-primary ta-btn-sm"
                          style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}
                        >
                          <Video size={13} /> Join Call
                        </a>
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
                          Reschedule
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Modals for Complete and Reschedule */}
            {completingSessionId && (
              <div className="ta-card ta-mt16 anim-slide-down" style={{ border: "1.5px solid var(--primary)", background: "var(--surface)" }}>
                <div className="ta-title" style={{ fontSize: 15, fontWeight: 800 }}>Complete Session &amp; Add Student Feedback</div>
                <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Write key takeaways or assignment unblockers for the student</div>
                <textarea
                  className="ta-input ta-mt10"
                  rows={3}
                  placeholder="Great progress today! Reviewed spatial UI shaders..."
                  value={completionFeedback}
                  onChange={(e) => setCompletionFeedback(e.target.value)}
                  style={{ width: "100%", fontSize: 13 }}
                />
                <div className="ta-row ta-gap8 ta-mt12">
                  <button className="ta-btn ta-btn-primary ta-btn-sm" onClick={() => handleCompleteSession(completingSessionId, completionFeedback)}>
                    Confirm &amp; Record Earnings
                  </button>
                  <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => setCompletingSessionId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {reschedulingSessionId && (
              <div className="ta-card ta-mt16 anim-slide-down" style={{ border: "1.5px solid var(--primary)", background: "var(--surface)" }}>
                <div className="ta-title" style={{ fontSize: 15, fontWeight: 800 }}>Reschedule Session</div>
                <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Select a new date and time for this session</div>
                <input
                  type="datetime-local"
                  className="ta-input ta-mt10"
                  value={rescheduleDateTime}
                  onChange={(e) => setRescheduleDateTime(e.target.value)}
                  style={{ width: "100%", maxWidth: 300 }}
                />
                <div className="ta-row ta-gap8 ta-mt12">
                  <button className="ta-btn ta-btn-primary ta-btn-sm" disabled={!rescheduleDateTime} onClick={() => handleReschedule(reschedulingSessionId, rescheduleDateTime)}>
                    Save Reschedule
                  </button>
                  <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => setReschedulingSessionId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "availability" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            
            {/* Add Availability Slot Card */}
            <div className="ta-card" style={{ padding: "22px 24px", background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="ta-title" style={{ fontSize: 16, fontWeight: 800 }}>Add Availability Slot</div>
              <div className="ta-sub" style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Set recurring weekly office hours when students can book 1:1 sessions</div>

              <div style={{ marginTop: 16 }}>
                <label className="ta-label" style={{ marginBottom: 6, display: "block" }}>Day of Week</label>
                <select className="ta-input" style={{ width: "100%" }} value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
                  {DAY_NAMES.map((d, i) => (
                    <option key={d} value={i}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="ta-row ta-gap12" style={{ marginTop: 14 }}>
                <div style={{ flex: 1 }}>
                  <label className="ta-label" style={{ marginBottom: 6, display: "block" }}>Start Time</label>
                  <input type="time" className="ta-input" style={{ width: "100%" }} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="ta-label" style={{ marginBottom: 6, display: "block" }}>End Time</label>
                  <input type="time" className="ta-input" style={{ width: "100%" }} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>

              <button
                className="ta-btn ta-btn-primary ta-mt20"
                style={{ width: "100%", padding: "11px 16px", fontWeight: 800 }}
                disabled={saving}
                onClick={handleAddSlot}
              >
                <Plus size={15} /> {saving ? "Saving Slot..." : "Add Recurring Weekly Slot"}
              </button>
            </div>

            {/* Configured Weekly Timetable */}
            <div className="ta-card" style={{ padding: "22px 24px", background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="ta-title" style={{ fontSize: 16, fontWeight: 800 }}>Configured Weekly Timetable</div>
              <div className="ta-sub" style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Recurring time windows active on your public booking calendar</div>

              <div className="ta-col ta-gap8 ta-mt16 anim-stagger">
                {availabilityQuery.loading && <div className="ta-empty">Loading timetable...</div>}
                {!availabilityQuery.loading && availability.length === 0 && (
                  <div className="ta-empty">No availability slots configured yet. Add your first window on the left.</div>
                )}
                {availability.map((slot) => (
                  <div
                    key={slot.id}
                    className="ta-row ta-between"
                    style={{ padding: "12px 14px", background: "var(--surface-2)", borderRadius: 12, border: "1px solid var(--border)" }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)" }}>{DAY_NAMES[slot.day_of_week]}</div>
                      <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                        {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                      </div>
                    </div>
                    <button
                      className="ta-iconbtn"
                      onClick={() => handleDeleteSlot(slot.id)}
                      aria-label="Remove slot"
                    >
                      <Trash2 size={15} color="var(--danger)" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
