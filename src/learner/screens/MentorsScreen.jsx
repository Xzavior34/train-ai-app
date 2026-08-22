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
  initialSelectedMentorId = null,
}) {
  const [expandedMentorId, setExpandedMentorId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

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
      scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }
    await bookMentorshipSession({ learnerId: session.user.id, mentorId: sessionMentorChoice.id, title: sessionTopicInput.trim(), scheduledAt });
    closeBooking();
    setSessionTopicInput("");
    upcomingSessionsQuery?.refetch?.();
    showToast?.("Instructor session requested successfully!");
  }

  const canConfirm = sessionTopicInput.trim() && (!hasAvailability || (selectedSlot && bookingTime));

  const filteredMentors = mentorsList.filter(m => {
    if (searchQuery && !m.name.toLowerCase().includes(searchQuery.toLowerCase()) && !m.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      {/* =========================================================================
          HERO BANNER: Expert Mentors & 1-on-1 Office Hours
          ========================================================================= */}
      <div style={{
        borderRadius: 10,
        background: "#0F172A",
        color: "#FFFFFF",
        padding: "clamp(16px, 2.5vw, 22px)",
        boxShadow: "0 4px 16px rgba(15, 23, 42, 0.2)",
        border: "1px solid #1E293B",
        position: "relative",
        overflow: "hidden"
      }}>
        <div className="tai-row tai-between" style={{ position: "relative", zIndex: 1, flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="tai-row tai-gap10" style={{ flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{
                background: "rgba(99, 102, 241, 0.35)", color: "#E0E7FF",
                border: "1px solid rgba(165, 180, 252, 0.5)",
                fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99,
                display: "inline-flex", alignItems: "center", gap: 6, letterSpacing: "0.03em"
              }}>
                <Video size={13} color="#A5B4FC" /> 1-ON-1 INSTRUCTOR SESSIONS
              </span>
              <span style={{
                background: "rgba(16, 185, 129, 0.28)", color: "#A7F3D0",
                border: "1px solid rgba(16, 185, 129, 0.5)",
                fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99
              }}>
                {mentorsList.length} ACTIVE INSTRUCTOR{mentorsList.length === 1 ? "" : "S"}
              </span>
            </div>
            <h1 style={{ fontSize: "clamp(18px, 2.2vw, 24px)", fontWeight: 800, letterSpacing: "-0.025em", margin: "0 0 6px", color: "#FFFFFF" }}>
              Expert Instructors &amp; 1-on-1 Mentorship
            </h1>
            <p style={{ fontSize: 13, color: "#94A3B8", margin: 0, maxWidth: 640, lineHeight: 1.45 }}>
              Book dedicated 1-on-1 sessions for portfolio reviews, code architecture deep-dives, design token audits, and career guidance.
            </p>
          </div>

          <div style={{
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: 8,
            padding: "10px 16px",
            flexShrink: 0
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#FFFFFF" }}>{mentorsList.length} Active Instructors</div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2, fontWeight: 600 }}>Average Rating: 4.9 ★</div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          BOOKING MODAL / CARD
          ========================================================================= */}
      {/* =========================================================================
          BOOKING MODAL / CARD (PORTAL-MOUNTED DIRECTLY ON DOCUMENT.BODY)
          ========================================================================= */}
      <PortalModal
        isOpen={Boolean(requestingSession && sessionMentorChoice)}
        onClose={closeBooking}
        maxWidth={540}
        zIndex={9999}
      >
        <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text)", minWidth: 0, flex: "1 1 200px" }}>Schedule 1-on-1 Mentorship Session</div>
          <button className="tai-btn tai-btn-ghost tai-btn-sm" style={{ flexShrink: 0 }} onClick={closeBooking}><X size={16} /></button>
        </div>

        {sessionMentorChoice && (
          <div className="tai-row tai-gap14 tai-mt14" style={{ padding: "12px 14px", background: "var(--surface-2)", borderRadius: 14, border: "1px solid var(--border)" }}>
            <Avatar initials={sessionMentorChoice.name.split(" ").map(n => n[0]).join("")} size={48} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sessionMentorChoice.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--primary)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>${sessionMentorChoice.rate}/hr • {sessionMentorChoice.title}</div>
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
          <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 6 }}>This instructor hasn't published recurring slots yet. Request will be submitted as tentative.</div>
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

      {/* =========================================================================
          SEARCH & MENTOR CARDS GRID
          ========================================================================= */}
      <div style={{ position: "relative" }}>
        <Search size={16} color="var(--text-3)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
        <input
          type="text"
          placeholder="Search instructors by name, specialization, or topic..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%", height: 44, paddingLeft: 42, paddingRight: 14,
            borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--surface)",
            fontSize: 13.5, color: "var(--text)", outline: "none"
          }}
        />
      </div>

      <div className="anim-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: 20 }}>
        {filteredMentors.length === 0 && (
          <div className="tai-card tai-empty" style={{ gridColumn: "1 / -1", borderRadius: 16 }}>
            No instructors found matching "{searchQuery}".
          </div>
        )}

        {filteredMentors.map((m, idx) => {
          const isExpanded = expandedMentorId === m.id;
          const stockAvatar = `https://images.unsplash.com/photo-${[
            "1534528741775-53994a69daeb",
            "1507003211169-0a1dd7228f2d",
            "1494790108377-be9c29b29330",
            "1500648767791-00dcc994a43e",
            "1573496359142-b8d87734a5a2"
          ][idx % 5]}?w=150&auto=format&fit=crop&q=80`;

          return (
            <div
              key={m.id}
              id={`mentor-card-${m.id}`}
              className="tai-card tai-card-hover"
              style={{
                borderRadius: 18,
                borderColor: isExpanded ? "var(--primary)" : "var(--border)",
                cursor: "pointer",
                padding: 22
              }}
              onClick={() => setExpandedMentorId(isExpanded ? null : m.id)}
            >
              <div className="tai-row tai-between">
                <div className="tai-row tai-gap14" style={{ minWidth: 0 }}>
                  <Avatar initials={m.name.split(" ").map(n => n[0]).join("")} size={48} src={stockAvatar} />
                  <div style={{ minWidth: 0 }}>
                    <div className="tai-row tai-gap6">
                      <span style={{ fontWeight: 800, fontSize: 15.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                      {m.verified && <CheckCircle2 size={15} color="var(--primary)" style={{ flexShrink: 0 }} />}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</div>
                  </div>
                </div>

                <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "var(--primary)" }}>${m.rate}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>per hour</div>
                  </div>
                  {isExpanded ? <ChevronUp size={16} color="var(--text-3)" /> : <ChevronDown size={16} color="var(--text-3)" />}
                </div>
              </div>

              <div className="tai-row tai-between tai-mt16" style={{ flexWrap: "wrap", gap: 10 }}>
                <div className="tai-row tai-gap12" style={{ fontSize: 12.5, color: "var(--text-2)", fontWeight: 600, flexWrap: "wrap" }}>
                  <span className="tai-row tai-gap4"><Star size={13} color="var(--warning)" fill="var(--warning)" /> {m.rating}</span>
                  <span>•</span>
                  <span>{m.sessions} sessions completed</span>
                </div>
                <button
                  className="tai-btn tai-btn-ghost tai-btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSessionMentorChoice(m);
                    setRequestingSession(true);
                    setBookingDay(null);
                    setBookingTime("");
                  }}
                >
                  <Video size={13} /> Book 1-on-1
                </button>
              </div>

              {isExpanded && (
                <div className="tai-mt14 tai-fade-in" style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }} onClick={(e) => e.stopPropagation()}>
                  {m.bio && <p className="tai-body-text" style={{ fontSize: 12.5, margin: "0 0 10px" }}>{m.bio}</p>}
                  {m.tagline && !m.bio && <p className="tai-body-text" style={{ fontSize: 12.5, margin: "0 0 10px" }}>{m.tagline}</p>}
                  <div className="tai-row tai-gap16" style={{ flexWrap: "wrap", fontSize: 12, color: "var(--text-2)" }}>
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
