import React, { useState, useEffect } from "react";
import { TopBar, Avatar, Tag } from "../components/LearnerUI.jsx";
import {
  Star, Video, CheckCircle2, Globe, Award, ChevronDown, ChevronUp,
  Users, Calendar, Clock, ShieldCheck, MessageSquare, Search, X
} from "lucide-react";
import { PortalModal } from "../../components/common/PortalModal.jsx";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
  mentorsList = [], requestingSession, setRequestingSession, sessionMentorChoice, setSessionMentorChoice,
  sessionTopicInput, setSessionTopicInput, sessionRequestSent, setSessionRequestSent, session,
  showToast, bookMentorshipSession, upcomingSessionsQuery,
  mentorAvailabilityQuery, bookingDay, setBookingDay, bookingTime, setBookingTime,
  initialSelectedMentorId = null, back, push,
}) {
  const [expandedMentorId, setExpandedMentorId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  // When an instructor has no published recurring availability, the learner
  // proposes a specific date/time instead of the request silently landing
  // on an arbitrary "24 hours from now" slot with no input from them.
  const [proposedDate, setProposedDate] = useState("");
  const [proposedTime, setProposedTime] = useState("");

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
    setProposedDate("");
    setProposedTime("");
  }

  async function confirmBooking() {
    if (!sessionTopicInput.trim() || !session?.user?.id) return;
    let scheduledAt;
    if (hasAvailability && selectedSlot) {
      scheduledAt = nextDateForDayTime(selectedSlot.day_of_week, bookingTime).toISOString();
    } else if (proposedDate && proposedTime) {
      scheduledAt = new Date(`${proposedDate}T${proposedTime}`).toISOString();
    } else {
      scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }
    // The instructor hasn't published a schedule, so this is a proposal,
    // not a confirmed booking - say so in the title/notes rather than
    // implying the instructor already agreed to this exact time.
    const title = hasAvailability
      ? sessionTopicInput.trim()
      : `${sessionTopicInput.trim()} (proposed time - awaiting instructor confirmation)`;
    await bookMentorshipSession({ learnerId: session.user.id, mentorId: sessionMentorChoice.id, title, scheduledAt, meetingUrl: sessionMentorChoice.meetingUrl });
    closeBooking();
    setSessionTopicInput("");
    upcomingSessionsQuery?.refetch?.();
    showToast?.(hasAvailability ? "Instructor session requested successfully!" : "Time proposed - the instructor will confirm or suggest another time.");
  }

  const canConfirm = sessionTopicInput.trim() && (
    hasAvailability ? (selectedSlot && bookingTime) : (proposedDate && proposedTime)
  );

  const filteredMentors = mentorsList.filter(m => {
    if (searchQuery && !m.name.toLowerCase().includes(searchQuery.toLowerCase()) && !m.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <TopBar title="Instructors &amp; Mentors" sub={`${mentorsList.length} instructors available`} onBack={back} />

      {/* HERO BANNER: Expert Mentors & 1-on-1 Office Hours */}
      <div
        className="tai-card tai-hero-card anim-fluid-entrance"
        style={{
          borderRadius: 14,
          padding: "clamp(18px, 2.5vw, 24px)",
          position: "relative",
          overflow: "hidden",
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
            background: "radial-gradient(circle, rgba(37, 99, 235, 0.22) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="tai-hero-title" style={{ fontSize: "clamp(20px, 2.5vw, 24px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 4px", lineHeight: 1.2 }}>
              Industry Instructors &amp; Mentors
            </h1>
            <p className="tai-hero-desc" style={{ fontSize: 13, margin: 0, maxWidth: 620, lineHeight: 1.45 }}>
              Connect 1-on-1 with verified industry leaders for architectural reviews, personalized guidance, and office hours.
            </p>
          </div>

          <div className="tai-hero-subcard" style={{ textAlign: "right", flexShrink: 0, padding: "10px 16px", borderRadius: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text)" }}>{mentorsList.length} Active</div>
            <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>Verified Instructors</div>
          </div>
        </div>
      </div>

      {/* BOOKING MODAL / CARD (PORTAL-MOUNTED DIRECTLY ON DOCUMENT.BODY) */}
      <PortalModal
        isOpen={Boolean(requestingSession && sessionMentorChoice)}
        onClose={closeBooking}
        maxWidth={540}
        zIndex={9999}
      >
        <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text)", minWidth: 0, flex: "1 1 200px" }}>Schedule Session</div>
          <button className="tai-btn tai-btn-ghost tai-btn-sm" style={{ flexShrink: 0 }} onClick={closeBooking}><X size={16} /></button>
        </div>

        {sessionMentorChoice && (
          <div className="tai-row tai-gap14 tai-mt14" style={{ padding: "12px 14px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
            <Avatar initials={sessionMentorChoice.name ? sessionMentorChoice.name.split(" ").map(n => n[0]).join("") : "I"} src={sessionMentorChoice.avatar} size={48} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sessionMentorChoice.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--primary)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sessionMentorChoice.title}</div>
            </div>
          </div>
        )}

        <div className="tai-label tai-mt16">Topic or Project Goals</div>
        <input
          className="tai-input tai-mt6"
          style={{ width: "100%", boxSizing: "border-box" }}
          placeholder="e.g. Figma variables architecture review, code audit for RNN pipeline..."
          value={sessionTopicInput}
          onChange={e => setSessionTopicInput(e.target.value)}
          autoFocus
        />

        <div className="tai-label tai-mt16">Select Available Day</div>
        {mentorAvailabilityQuery?.loading && <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6 }}>Loading instructor schedule...</div>}
        {!mentorAvailabilityQuery?.loading && !hasAvailability && (
          <div className="tai-mt8">
            <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
              This instructor hasn't published recurring slots yet. Propose a date and time - they'll confirm or suggest another.
            </div>
            <div className="tai-row tai-gap10 tai-mt10" style={{ flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 160px" }}>
                <div className="tai-label">Proposed Date</div>
                <input
                  className="tai-input tai-mt6"
                  type="date"
                  style={{ width: "100%", boxSizing: "border-box" }}
                  value={proposedDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={e => setProposedDate(e.target.value)}
                />
              </div>
              <div style={{ flex: "1 1 140px" }}>
                <div className="tai-label">Proposed Time</div>
                <input
                  className="tai-input tai-mt6"
                  type="time"
                  style={{ width: "100%", boxSizing: "border-box" }}
                  value={proposedTime}
                  onChange={e => setProposedTime(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
        {hasAvailability && (
          <div className="tai-scrollx tai-mt8">
            {availableSlots.map(s => (
              <div
                key={s.id}
                className={`tai-pill ${bookingDay === s.day_of_week ? "tai-pill-active" : "tai-pill-inactive"}`}
                onClick={() => chooseDay(s)}
              >
                {DAY_NAMES[s.day_of_week]} ({(s.start_time || "09:00").slice(0, 5)})
              </div>
            ))}
          </div>
        )}

        {hasAvailability && selectedSlot && (
          <div className="tai-mt14">
            <div className="tai-label">Preferred Time ({(selectedSlot.start_time || "").slice(0, 5)} - {(selectedSlot.end_time || "").slice(0, 5)})</div>
            <input
              className="tai-input tai-mt6"
              type="time"
              style={{ width: "100%", boxSizing: "border-box" }}
              value={bookingTime}
              min={(selectedSlot.start_time || "").slice(0, 5)}
              max={(selectedSlot.end_time || "").slice(0, 5)}
              onChange={e => setBookingTime(e.target.value)}
            />
          </div>
        )}

        <div className="tai-row tai-gap10 tai-mt20" style={{ justifyContent: "flex-end" }}>
          <button className="tai-btn tai-btn-outline" onClick={closeBooking}>Cancel</button>
          <button
            className="tai-btn tai-btn-primary"
            disabled={!canConfirm}
            onClick={confirmBooking}
          >
            Confirm &amp; Request Session →
          </button>
        </div>
      </PortalModal>

      {/* SEARCH & MENTOR CARDS GRID */}
      <div style={{ position: "relative" }}>
        <Search size={16} color="var(--text-3)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
        <input
          type="text"
          placeholder="Search instructors by name, specialization, or topic..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%", height: 44, paddingLeft: 42, paddingRight: 14,
            borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--surface)",
            fontSize: 13.5, color: "var(--text)", outline: "none"
          }}
        />
      </div>

      <div className="anim-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 16 }}>
        {filteredMentors.length === 0 && (
          <div className="tai-card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px 20px", borderRadius: 12 }}>
            <Users size={32} color="var(--text-3)" style={{ margin: "0 auto 12px", opacity: 0.6 }} />
            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>
              {searchQuery ? "No instructors match your search" : "No active instructors found"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4, maxWidth: 420, margin: "4px auto 0" }}>
              {searchQuery ? "Try searching for a different name, specialization, or keyword." : "Check back soon as new instructors and industry mentors join the platform."}
            </div>
          </div>
        )}

        {filteredMentors.map((m) => {
          const isExpanded = expandedMentorId === m.id;
          const initials = m.name ? m.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "IN";

          return (
            <div
              key={m.id}
              id={`mentor-card-${m.id}`}
              className="tai-card tai-card-hover"
              style={{
                borderRadius: 14,
                borderColor: isExpanded ? "var(--primary)" : "var(--border)",
                cursor: "pointer",
                padding: "20px 22px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 14,
              }}
              onClick={() => setExpandedMentorId(isExpanded ? null : m.id)}
            >
              <div>
                <div className="tai-row tai-between" style={{ alignItems: "flex-start" }}>
                  <div className="tai-row tai-gap14" style={{ minWidth: 0 }}>
                    <Avatar initials={initials} size={52} src={m.avatar || m.avatarUrl || null} />
                    <div style={{ minWidth: 0 }}>
                      <div className="tai-row tai-gap6" style={{ alignItems: "center" }}>
                        <span style={{ fontWeight: 800, fontSize: 15.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                        {m.verified && <CheckCircle2 size={15} color="var(--primary)" style={{ flexShrink: 0 }} />}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{m.title || "Instructor"}</div>
                      {m.rating > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-2)", fontWeight: 700, marginTop: 4 }}>
                          <Star size={12} color="#F59E0B" fill="#F59E0B" />
                          <span>{m.rating}</span>
                          {m.sessions > 0 && <span>• {m.sessions} sessions</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
                    {isExpanded ? <ChevronUp size={16} color="var(--text-3)" /> : <ChevronDown size={16} color="var(--text-3)" />}
                  </div>
                </div>

                {/* Bio / Description snippet */}
                {(m.bio || m.tagline) && (
                  <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 12, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: isExpanded ? 99 : 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {m.bio || m.tagline}
                  </div>
                )}

                {/* Specialization Tags */}
                {m.specializations && m.specializations.length > 0 && (
                  <div className="tai-row tai-gap6 tai-mt10" style={{ flexWrap: "wrap" }}>
                    {m.specializations.slice(0, 3).map(s => (
                      <span key={s} className="tai-tag" style={{ fontSize: 11, background: "var(--surface-2)", color: "var(--text-2)" }}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons: Chat + Book Session */}
              <div className="tai-row tai-gap8" style={{ marginTop: 10 }}>
                <button
                  className="tai-btn tai-btn-primary"
                  style={{ flex: 1, padding: "8px 14px", fontSize: 12.5, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (push) {
                      push("messages", { recipientId: m.userId || m.id, recipientName: m.name });
                    }
                  }}
                >
                  <MessageSquare size={14} /> Chat
                </button>
                <button
                  className="tai-btn tai-btn-outline"
                  style={{ padding: "8px 12px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 10 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSessionMentorChoice(m);
                    setRequestingSession(true);
                    setBookingDay(null);
                    setBookingTime("");
                  }}
                >
                  <Video size={13} /> Book
                </button>
              </div>

              {isExpanded && (
                <div className="tai-mt14 tai-fade-in" style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }} onClick={(e) => e.stopPropagation()}>
                  <div className="tai-row tai-gap16" style={{ flexWrap: "wrap", fontSize: 12, color: "var(--text-2)" }}>
                    <span className="tai-row tai-gap4"><Award size={13} /> {m.years || 3} yr{(m.years || 3) === 1 ? "" : "s"} experience</span>
                    {m.languages && m.languages.length > 0 && (
                      <span className="tai-row tai-gap4"><Globe size={13} /> {m.languages.join(", ")}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
