import React, { useState, useEffect } from "react";
import { TopBar, Avatar, Tag } from "../components/LearnerUI.jsx";
import { Star, Video, CheckCircle2, Globe, Award, ChevronDown, ChevronUp } from "lucide-react";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Given a day-of-week (0=Sunday..6=Saturday, matching the real
// `mentor_availability.day_of_week` column) and an "HH:MM" time, returns the
// next real Date that combination falls on - today if it hasn't passed yet,
// otherwise the next matching weekday.
function nextDateForDayTime(dayOfWeek, timeStr) {
  const [h, m] = (timeStr || "09:00").split(":").map(Number);
  const now = new Date();
  const candidate = new Date(now);
  let diff = (dayOfWeek - now.getDay() + 7) % 7;
  candidate.setDate(now.getDate() + diff);
  candidate.setHours(h || 0, m || 0, 0, 0);
  if (candidate <= now) candidate.setDate(candidate.getDate() + 7);
  return candidate;
}

export function MentorsScreen({
  mentorsList, requestingSession, setRequestingSession, sessionMentorChoice, setSessionMentorChoice,
  sessionTopicInput, setSessionTopicInput, sessionRequestSent, setSessionRequestSent, session,
  showToast, bookMentorshipSession, upcomingSessionsQuery,
  mentorAvailabilityQuery, bookingDay, setBookingDay, bookingTime, setBookingTime,
  // Set when the learner arrived here from a universal-search "Mentors"
  // result (see TrainAILearnerApp's onOpenMentor -> push("mentors", { mentorId })).
  // Expands that specific mentor's detail card and scrolls it into view,
  // instead of just dumping the learner on the generic mentor list.
  initialSelectedMentorId = null,
}) {
  const [expandedMentorId, setExpandedMentorId] = useState(null);

  useEffect(() => {
    if (!initialSelectedMentorId) return;
    setExpandedMentorId(initialSelectedMentorId);
    const el = document.getElementById(`mentor-card-${initialSelectedMentorId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [initialSelectedMentorId]);

  const availableSlots = (mentorAvailabilityQuery?.data || []).filter(a => a.is_available !== false);
  const hasAvailability = availableSlots.length > 0;
  const selectedSlot = availableSlots.find(a => a.day_of_week === bookingDay) || null;

  function chooseDay(slot) {
    setBookingDay(slot.day_of_week);
    setBookingTime((slot.start_time || "09:00").slice(0, 5));
  }

  function closeBooking() {
    setRequestingSession(false);
    setBookingDay(null);
    setBookingTime("");
  }

  async function confirmBooking() {
    if (!sessionTopicInput.trim() || !session?.user?.id) return;
    let scheduledAt;
    if (hasAvailability && selectedSlot) {
      scheduledAt = nextDateForDayTime(selectedSlot.day_of_week, bookingTime).toISOString();
    } else {
      // No recurring availability on file for this mentor yet - fall back to
      // "next 24 hours" as a tentative request rather than blocking booking.
      scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }
    await bookMentorshipSession({ learnerId: session.user.id, mentorId: sessionMentorChoice.id, title: sessionTopicInput.trim(), scheduledAt });
    closeBooking();
    setSessionTopicInput("");
    upcomingSessionsQuery.refetch();
    showToast("Instructor session requested!");
  }

  const canConfirm = sessionTopicInput.trim() && (!hasAvailability || (selectedSlot && bookingTime));

  return (
    <div className="tai-fade-in">
      <TopBar title="Instructors & 1-on-1 Sessions" sub="Book expert instruction" />

      {requestingSession && sessionMentorChoice && (
        <div className="tai-card tai-mt12" style={{ borderColor: "var(--primary)" }}>
          <div className="tai-row tai-between">
            <div style={{ fontWeight: 800, fontSize: 15 }}>Book 1-on-1 Session</div>
            <button className="tai-btn tai-btn-ghost tai-btn-sm" onClick={closeBooking}>Cancel</button>
          </div>
          <div className="tai-row tai-gap10 tai-mt10">
            <Avatar initials={sessionMentorChoice.name.split(" ").map(n => n[0]).join("")} size={36} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{sessionMentorChoice.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>${sessionMentorChoice.rate}/hr</div>
            </div>
          </div>
          <div className="tai-label tai-mt12">Topic / Goal</div>
          <input className="tai-input tai-mt6" placeholder="e.g. Code review on RNN architecture..." value={sessionTopicInput} onChange={e => setSessionTopicInput(e.target.value)} />

          <div className="tai-label tai-mt12">Pick a day</div>
          {mentorAvailabilityQuery?.loading && <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6 }}>Loading this instructor's availability...</div>}
          {!mentorAvailabilityQuery?.loading && !hasAvailability && (
            <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6 }}>This instructor hasn't set recurring availability yet. Your request will be sent as a tentative booking for tomorrow.</div>
          )}
          {hasAvailability && (
            <div className="tai-row tai-gap8 tai-mt8" style={{ flexWrap: "wrap" }}>
              {availableSlots.map(slot => (
                <button
                  key={slot.id}
                  type="button"
                  className={`tai-btn tai-btn-sm ${bookingDay === slot.day_of_week ? "tai-btn-primary" : "tai-btn-outline"}`}
                  onClick={() => chooseDay(slot)}
                >
                  {DAY_NAMES[slot.day_of_week]}
                </button>
              ))}
            </div>
          )}
          {hasAvailability && selectedSlot && (
            <>
              <div className="tai-label tai-mt12">Time ({(selectedSlot.start_time || "").slice(0, 5)} - {(selectedSlot.end_time || "").slice(0, 5)})</div>
              <input
                className="tai-input tai-mt6"
                type="time"
                value={bookingTime}
                min={(selectedSlot.start_time || "").slice(0, 5)}
                max={(selectedSlot.end_time || "").slice(0, 5)}
                onChange={e => setBookingTime(e.target.value)}
              />
            </>
          )}

          <button className="tai-btn tai-btn-primary tai-mt12" style={{ width: "100%" }} disabled={!canConfirm} onClick={confirmBooking}>
            Confirm booking
          </button>
        </div>
      )}

      <div className="tai-col tai-gap12 tai-mt16">
        {mentorsList.length === 0 && <div className="tai-empty">No active instructors available at this time.</div>}
        {mentorsList.map(m => {
          const isExpanded = expandedMentorId === m.id;
          return (
            <div
              key={m.id}
              id={`mentor-card-${m.id}`}
              className="tai-card"
              style={isExpanded ? { borderColor: "var(--primary)", cursor: "pointer" } : { cursor: "pointer" }}
              onClick={() => setExpandedMentorId(isExpanded ? null : m.id)}
            >
              <div className="tai-row tai-between">
                <div className="tai-row tai-gap12">
                  <Avatar initials={m.name.split(" ").map(n => n[0]).join("")} size={44} />
                  <div>
                    <div className="tai-row tai-gap6">
                      <span style={{ fontWeight: 800, fontSize: 14.5 }}>{m.name}</span>
                      {m.verified && <CheckCircle2 size={15} color="var(--primary)" />}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-2)" }}>{m.title}</div>
                  </div>
                </div>
                <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "var(--primary)" }}>${m.rate}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>per hour</div>
                  </div>
                  {isExpanded ? <ChevronUp size={16} color="var(--text-3)" /> : <ChevronDown size={16} color="var(--text-3)" />}
                </div>
              </div>
              <div className="tai-row tai-between tai-mt12">
                <div className="tai-row tai-gap12" style={{ fontSize: 12, color: "var(--text-2)" }}>
                  <span className="tai-row tai-gap4"><Star size={13} color="var(--warning)" fill="var(--warning)" /> {m.rating}</span>
                  <span>•</span>
                  <span>{m.sessions} sessions</span>
                </div>
                <button className="tai-btn tai-btn-ghost tai-btn-sm" onClick={(e) => { e.stopPropagation(); setSessionMentorChoice(m); setRequestingSession(true); setBookingDay(null); setBookingTime(""); }}>
                  <Video size={13} /> Book 1-on-1
                </button>
              </div>

              {isExpanded && (
                <div className="tai-mt12" style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }} onClick={(e) => e.stopPropagation()}>
                  {m.bio && <div className="tai-body-text" style={{ fontSize: 12.5 }}>{m.bio}</div>}
                  {m.tagline && !m.bio && <div className="tai-body-text" style={{ fontSize: 12.5 }}>{m.tagline}</div>}
                  <div className="tai-row tai-gap16 tai-mt10" style={{ flexWrap: "wrap", fontSize: 11.5, color: "var(--text-2)" }}>
                    <span className="tai-row tai-gap4"><Award size={13} /> {m.years} yr{m.years === 1 ? "" : "s"} experience</span>
                    {m.languages && m.languages.length > 0 && (
                      <span className="tai-row tai-gap4"><Globe size={13} /> {m.languages.join(", ")}</span>
                    )}
                  </div>
                  {m.specializations && m.specializations.length > 0 && (
                    <div className="tai-row tai-gap6 tai-mt10" style={{ flexWrap: "wrap" }}>
                      {m.specializations.map(s => <Tag key={s}>{s}</Tag>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
