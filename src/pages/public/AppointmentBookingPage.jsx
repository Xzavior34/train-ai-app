import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Calendar,
  Clock,
  Globe,
  Video,
  CheckCircle2,
  ArrowLeft,
  Building2,
  Users,
  Mail,
  User,
  ExternalLink,
  Download,
  ChevronRight,
  ShieldCheck,
  Loader2,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { submitDemoRequest, fetchBookedSlots } from "../../lib/api/waitlist.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

// Generate business-day dates (skip weekends), starting tomorrow
function generateAvailableDates(count = 14) {
  const dates = [];
  const now = new Date();
  let current = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  while (dates.length < count) {
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) {
      const year = current.getFullYear();
      const month = current.getMonth();
      const day = current.getDate();
      const dateObj = new Date(year, month, day);
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      dates.push({
        dateObj,
        iso,
        dayName: dateObj.toLocaleDateString("en-US", { weekday: "short" }),
        fullDayName: dateObj.toLocaleDateString("en-US", { weekday: "long" }),
        monthName: dateObj.toLocaleDateString("en-US", { month: "short" }),
        fullMonthName: dateObj.toLocaleDateString("en-US", { month: "long" }),
        dayNum: dateObj.getDate(),
        year,
        formattedShort: `${dateObj.toLocaleDateString("en-US", { weekday: "short" })}, ${dateObj.toLocaleDateString("en-US", { month: "short" })} ${dateObj.getDate()}`,
        formattedLong: `${dateObj.toLocaleDateString("en-US", { weekday: "long" })}, ${dateObj.toLocaleDateString("en-US", { month: "long" })} ${dateObj.getDate()}, ${year}`,
        badge: dates.length === 0 ? "Tomorrow" : dates.length === 1 ? "Next Day" : null,
      });
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// ─── Timezone-aware time slots ───────────────────────────────────────────────
// All slots are defined in WAT (Africa/Lagos, UTC+1 year-round, no DST).
// They are converted to the visitor's local timezone for display.
// The canonical "key" stored in the DB is always the WAT time string.

const HOST_TZ = "Africa/Lagos"; // UTC+1 WAT - Train AI headquarters

// Raw slots in 24h format, in WAT (Africa/Lagos)
const BASE_SLOTS_24H = [
  "09:30", "10:00", "11:00", "11:30",
  "13:30", "14:00", "15:00", "16:00", "17:00",
];

/**
 * For a given ISO date and the visitor's IANA timezone, returns an array of
 * slot objects with local and host display strings.
 * WAT = UTC+1 (fixed, no DST).
 */
function buildTimeSlotsForDate(dateIso, userTz) {
  const WAT_OFFSET_MS = 60 * 60 * 1000; // +1h

  return BASE_SLOTS_24H.map((time24) => {
    const [h, m] = time24.split(":").map(Number);
    // Treat the slot time as WAT: subtract offset to get UTC ms
    const [y, mo, d] = dateIso.split("-").map(Number);
    const utcMs = Date.UTC(y, mo - 1, d, h, m, 0) - WAT_OFFSET_MS;
    const dt = new Date(utcMs);

    const fmt = (tz) =>
      dt.toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit", hour12: true, timeZone: tz,
      });

    const localDisplay = fmt(userTz || HOST_TZ);
    const hostDisplay = fmt(HOST_TZ);
    // Key stored in DB is always the WAT string (e.g. "09:30 AM")
    const key = hostDisplay;
    const sameZone = localDisplay === hostDisplay;

    return { key, localDisplay, hostDisplay, sameZone, utcMs };
  });
}

const ORG_TYPE_OPTIONS = [
  "Academy / Educational Institution",
  "NGO / Non-Profit / Foundation",
  "Business / Enterprise",
  "Government / Public Sector",
  "Other",
];

const TEAM_SIZE_OPTIONS = [
  "1 - 50 learners",
  "50 - 250 learners",
  "250 - 1,000 learners",
  "1,000+ learners",
];

function parseTimeSlot(timeStr) {
  const [time, modifier] = timeStr.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (modifier === "PM" && hours < 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  return { hours, minutes };
}

function watSlotToUtc(dateIso, timeStr) {
  const { hours, minutes } = parseTimeSlot(timeStr);
  const [year, month, day] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hours - 1, minutes, 0));
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AppointmentBookingPage({ onBack, onNavigate, initialSector = "academies" }) {
  const availableDates = useMemo(() => generateAvailableDates(14), []);

  const detectedTimezone = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
  }, []);

  // Build timezone-aware slots for the selected date
  const [selectedDate, setSelectedDate] = useState(availableDates[0] || null);

  const timeSlots = useMemo(() =>
    buildTimeSlotsForDate(selectedDate?.iso || availableDates[0]?.iso || "2026-01-01", detectedTimezone),
    [selectedDate, detectedTimezone]
  );

  // selectedTime stores the WAT key (e.g. "10:00 AM") for DB consistency
  const [selectedTime, setSelectedTime] = useState(() => timeSlots[1]?.key || "10:00 AM");

  // Detect timezone offset difference from WAT for the banner
  const tzOffsetLabel = useMemo(() => {
    try {
      const watOffset = 60; // WAT = UTC+1 in minutes
      const dt = new Date();
      const localStr = dt.toLocaleTimeString("en-US", { timeZone: detectedTimezone, hour: "2-digit", minute: "2-digit", hour12: false });
      const watStr = dt.toLocaleTimeString("en-US", { timeZone: HOST_TZ, hour: "2-digit", minute: "2-digit", hour12: false });
      const [lh, lm] = localStr.split(":").map(Number);
      const [wh, wm] = watStr.split(":").map(Number);
      const diffMins = (lh * 60 + lm) - (wh * 60 + wm);
      if (diffMins === 0) return null;
      const sign = diffMins > 0 ? "+" : "-";
      const abs = Math.abs(diffMins);
      const h = Math.floor(abs / 60);
      const m = abs % 60;
      return `${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}h from WAT`;
    } catch { return null; }
  }, [detectedTimezone]);

  // Form state
  const [fullName, setFullName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [orgType, setOrgType] = useState(() => {
    if (initialSector === "ngos") return ORG_TYPE_OPTIONS[1];
    if (initialSector === "businesses") return ORG_TYPE_OPTIONS[2];
    return ORG_TYPE_OPTIONS[0];
  });
  const [teamSize, setTeamSize] = useState(TEAM_SIZE_OPTIONS[0]);
  const [agendaNotes, setAgendaNotes] = useState("");

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [confirmedDetails, setConfirmedDetails] = useState(null);

  // Booked slots from the database (keyed by WAT time)
  const [bookedSlots, setBookedSlots] = useState(new Set());
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState("");

  // Load booked slots on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    async function loadSlots() {
      setSlotsLoading(true);
      setAvailabilityError("");
      try {
        const from = availableDates[0]?.iso;
        const to = availableDates[availableDates.length - 1]?.iso;
        const slots = await fetchBookedSlots({ fromDate: from, toDate: to });
        setBookedSlots(slots);
      } catch {
        setBookedSlots(new Set());
        setAvailabilityError("Live appointment availability could not be loaded. Refresh the page before booking.");
      } finally {
        setSlotsLoading(false);
      }
    }
    loadSlots();
  }, []);

  // Auto-skip to first available slot when date changes
  useEffect(() => {
    if (!selectedDate) return;
    const slots = buildTimeSlotsForDate(selectedDate.iso, detectedTimezone);
    const firstAvail = slots.find((s) => !bookedSlots.has(`${selectedDate.iso}|${s.key}`));
    if (firstAvail && bookedSlots.has(`${selectedDate.iso}|${selectedTime}`)) {
      setSelectedTime(firstAvail.key);
    }
  }, [selectedDate, bookedSlots]);

  const isSlotBooked = useCallback(
    (dateIso, slotKey) => bookedSlots.has(`${dateIso}|${slotKey}`),
    [bookedSlots]
  );

  // Count available slots for selected date (uses WAT keys)
  const availableTimesForDate = useMemo(() => {
    if (!selectedDate) return BASE_SLOTS_24H.length;
    return timeSlots.filter((s) => !isSlotBooked(selectedDate.iso, s.key)).length;
  }, [selectedDate, timeSlots, isSlotBooked]);

  // ─── Submission ──────────────────────────────────────────────────────────

  async function handleBookAppointment(e) {
    e.preventDefault();
    if (submitting) return;

    if (!selectedDate || !selectedTime) {
      setSubmitError("Please ensure a day and time are selected.");
      return;
    }
    if (availabilityError) {
      setSubmitError("Live availability is unavailable. Refresh the page before booking so we do not double-book your time.");
      return;
    }
    if (isSlotBooked(selectedDate.iso, selectedTime)) {
      setSubmitError("This time slot is already booked. Please choose a different one.");
      return;
    }
    if (!fullName.trim() || !workEmail.trim() || !organizationName.trim()) {
      setSubmitError("Please fill in your name, work email, and organization name.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      const result = await submitDemoRequest({
        fullName: fullName.trim(),
        workEmail: workEmail.trim(),
        companyName: organizationName.trim(),
        teamSize,
        message: agendaNotes.trim(),
        source: `appointment_scheduler_${initialSector}`,
        scheduledDate: selectedDate.iso,
        scheduledTime: selectedTime,
        orgType,
        timezone: detectedTimezone,
      });

      if (!result.success) {
        setSubmitError(result.error || "Could not book your appointment. Please try again.");
        return;
      }

      // Optimistically mark this slot as booked in local state
      setBookedSlots((prev) => new Set([...prev, `${selectedDate.iso}|${selectedTime}`]));

      setConfirmedDetails({
        fullName: fullName.trim(),
        workEmail: workEmail.trim(),
        organizationName: organizationName.trim(),
        orgType,
        teamSize,
        dateFormatted: selectedDate.formattedLong,
        dateObj: selectedDate.dateObj,
        time: selectedTime,
        timezone: detectedTimezone,
        isoDate: selectedDate.iso,
        meetingUrl: result.meetingUrl,
        calendarEventUrl: result.calendarEventUrl,
        bookingId: result.bookingId,
      });
      setIsConfirmed(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.warn("Appointment booking failed:", err);
      setSubmitError("An error occurred while booking. Please try again or email info@trainailtd.com.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Calendar links ──────────────────────────────────────────────────────

  function getGoogleCalendarUrl() {
    return confirmedDetails?.calendarEventUrl || confirmedDetails?.meetingUrl || "#";
  }

  function handleDownloadIcs() {
    if (!confirmedDetails) return;
    const start = watSlotToUtc(confirmedDetails.isoDate, confirmedDetails.time);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const formatIcs = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const icsContent = [
      "BEGIN:VCALENDAR", "VERSION:2.0",
      "PRODID:-//Train AI Ltd//Appointment Scheduler//EN",
      "CALSCALE:GREGORIAN", "METHOD:REQUEST", "BEGIN:VEVENT",
      `SUMMARY:Train AI Product Demo & Institutional Consultation`,
      `UID:${confirmedDetails.bookingId}@trainailtd.com`,
      `DTSTAMP:${formatIcs(new Date())}`,
      `DESCRIPTION:Train AI 30-minute consultation for ${confirmedDetails.organizationName}. Join at ${confirmedDetails.meetingUrl}`,
      `LOCATION:${confirmedDetails.meetingUrl}`,
      `URL:${confirmedDetails.meetingUrl}`,
      `ORGANIZER;CN=Train AI:mailto:trainailtd@gmail.com`,
      `ATTENDEE;CN=${confirmedDetails.fullName};RSVP=TRUE:mailto:${confirmedDetails.workEmail}`,
      `ATTENDEE;RSVP=TRUE:mailto:info@sarafoundationafrica.com`,
      `ATTENDEE;RSVP=TRUE:mailto:trainailtd@gmail.com`,
      `DTSTART:${formatIcs(start)}`, `DTEND:${formatIcs(end)}`,
      `STATUS:CONFIRMED`, "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `train-ai-demo-${confirmedDetails.isoDate}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={S.outer}>
      <style>{`
        .apt-date-btn {
          border: 1.5px solid #E2E8F0; background: #FFFFFF; color: #0F172A;
          border-radius: 10px; padding: 10px 12px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          min-width: 68px; flex-shrink: 0;
          cursor: pointer; transition: all 0.15s ease; user-select: none;
        }
        .apt-date-btn:hover { border-color: #2563EB; background: #F8FAFF; }
        .apt-date-btn.active { border-color: #2563EB; background: #EFF6FF; color: #1D4ED8; box-shadow: 0 0 0 3px rgba(37,99,235,0.12); }
        .apt-date-btn.fully-booked { opacity: 0.45; cursor: not-allowed; }

        .apt-time-btn {
          border: 1.5px solid #E2E8F0; background: #FFFFFF; color: #1E293B;
          border-radius: 8px; padding: 10px 6px; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all 0.15s ease; min-width: 0;
          display: flex; align-items: center; justify-content: center; gap: 4px;
          position: relative;
        }
        .apt-time-btn:hover:not(:disabled) { border-color: #2563EB; background: #F8FAFF; }
        .apt-time-btn.active { border-color: #2563EB; background: #2563EB; color: #FFFFFF; font-weight: 700; }
        .apt-time-btn.booked {
          background: #F8FAFC; color: #94A3B8; border-color: #E2E8F0;
          cursor: not-allowed; text-decoration: line-through;
        }
        .apt-time-btn.booked::after {
          content: 'Booked'; position: absolute; top: -8px; left: 50%; transform: translateX(-50%);
          font-size: 9px; font-weight: 700; background: #EF4444; color: white;
          padding: 1px 5px; border-radius: 3px; white-space: nowrap;
        }

        .action-btn-primary {
          background: #2563EB; color: #FFFFFF;
          transition: background-color .14s ease, transform .14s ease; cursor: pointer;
        }
        .action-btn-primary:hover { background: #1D4ED8; }
        .action-btn-primary:active { transform: scale(.98); }
        .action-btn-primary:disabled { background: #93C5FD; cursor: not-allowed; }

        .action-btn-outline {
          background: #FFFFFF; color: #0F172A; border: 1.5px solid #CBD5E1;
          transition: background-color .14s ease, border-color .14s ease; cursor: pointer;
        }
        .action-btn-outline:hover { background: #F8FAFC; border-color: #94A3B8; }

        .apt-input-field {
          background-color: #FFFFFF !important; background: #FFFFFF !important;
          color: #0F172A !important; -webkit-text-fill-color: #0F172A !important;
          color-scheme: light !important;
        }
        .apt-input-field::placeholder { color: #94A3B8 !important; -webkit-text-fill-color: #94A3B8 !important; opacity: 1 !important; }
        .apt-input-group { background-color: #FFFFFF !important; background: #FFFFFF !important; color-scheme: light !important; }

        .apt-dates-scroll {
          display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin; scrollbar-color: #CBD5E1 transparent;
        }
        .apt-dates-scroll::-webkit-scrollbar { height: 4px; }
        .apt-dates-scroll::-webkit-scrollbar-track { background: transparent; }
        .apt-dates-scroll::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }

        @media (max-width: 900px) {
          .booking-grid { flex-direction: column !important; }
          .scheduler-panel, .form-panel {
            flex: none !important; width: 100% !important;
            box-sizing: border-box !important; min-width: 0 !important;
          }
        }
        @media (max-width: 480px) {
          .apt-time-btn { font-size: 11.5px !important; padding: 8px 3px !important; }
          .apt-date-btn { min-width: 60px !important; padding: 8px 8px !important; }
        }
      `}</style>

      {/* Header */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={onBack} style={S.backBtn} aria-label="Back to home">
              <ArrowLeft size={16} color="#0F172A" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>Back to Train AI</span>
            </button>
            <div style={{ height: 18, width: 1, background: "#E2E8F0" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img
                src="/train-ai-logo.png"
                alt="Train AI"
                onError={(e) => { e.currentTarget.src = "/brand/train-ai-logo.png"; e.currentTarget.onerror = null; }}
                style={{ height: 26, width: "auto", objectFit: "contain" }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>Appointment Scheduler</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748B" }}>
            <Globe size={14} color="#64748B" />
            <span style={{ fontWeight: 500 }}>Timezone: <strong style={{ color: "#0F172A" }}>{detectedTimezone}</strong></span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={S.main}>

          {/* Page title */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#2563EB", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
              <Clock size={15} />
              <span>30-Minute Institutional Walkthrough</span>
            </div>
            <h1 style={{ fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 900, color: "#0F172A", letterSpacing: "-0.03em", margin: "0 0 6px" }}>
              Set an Appointment with Train AI
            </h1>
            <p style={{ fontSize: 14, color: "#64748B", margin: 0, maxWidth: 680, lineHeight: 1.55 }}>
              Choose your preferred day and time below. Green slots are open; slots marked Booked are already taken.
            </p>
          </div>

          {/* ─── CONFIRMED STATE ─── */}
          {isConfirmed && confirmedDetails ? (
            <div style={S.confirmedCard}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 52, height: 52, borderRadius: "50%", background: "#DCFCE7", color: "#16A34A", margin: "0 auto 16px" }}>
                <CheckCircle2 size={30} />
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", margin: "0 0 8px", textAlign: "center" }}>
                Your Appointment is Confirmed
              </h2>
              <p style={{ fontSize: 14, color: "#64748B", margin: "0 auto 24px", textAlign: "center", maxWidth: 520, lineHeight: 1.5 }}>
                The Google Calendar event and Meet room have been created. Invitations were sent to <strong>{confirmedDetails.workEmail}</strong> and the Train AI team.
              </p>

              <div style={S.confirmedBox}>
                {[
                  { icon: <Calendar size={17} color="#2563EB" />, label: "Date", value: confirmedDetails.dateFormatted },
                  { icon: <Clock size={17} color="#2563EB" />, label: "Time & Duration", value: `${confirmedDetails.time} (30 mins) [${confirmedDetails.timezone}]` },
                  { icon: <Video size={17} color="#2563EB" />, label: "Meeting Format", value: "Google Meet (Invitation sent)" },
                  { icon: <Building2 size={17} color="#2563EB" />, label: "Organization", value: `${confirmedDetails.organizationName} (${confirmedDetails.orgType})` },
                ].map(({ icon, label, value }) => (
                  <div key={label} style={S.confirmedRow}>
                    {icon}
                    <div>
                      <div style={{ fontSize: 11.5, color: "#64748B", fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{value}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 24 }}>
                <a href={getGoogleCalendarUrl()} target="_blank" rel="noopener noreferrer"
                  className="action-btn-primary"
                  style={{ textDecoration: "none", padding: "11px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <Calendar size={15} /> Open Calendar Event <ExternalLink size={13} />
                </a>
                <button onClick={handleDownloadIcs} className="action-btn-outline"
                  style={{ padding: "11px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <Download size={15} /> Download .ics (Outlook / Apple)
                </button>
              </div>
              <div style={{ textAlign: "center", marginTop: 20 }}>
                <button onClick={onBack} style={{ background: "transparent", border: "none", color: "#64748B", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>
                  Return to Train AI Homepage
                </button>
              </div>
            </div>

          ) : (
            /* ─── BOOKING FLOW ─── */
            <div className="booking-grid" style={S.bookingGrid}>

              {/* ── Left: Date & Time Picker ── */}
              <div className="scheduler-panel" style={S.schedulerPanel}>

                {/* Legend */}
                <div style={S.legend}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#0F172A" }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: "#FFFFFF", border: "1.5px solid #2563EB" }} />
                    Available
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#64748B" }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: "#F1F5F9", border: "1.5px solid #E2E8F0" }} />
                    Booked
                  </div>
                  {slotsLoading && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#64748B" }}>
                      <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                      Loading availability...
                    </div>
                  )}
                </div>

                {availabilityError && (
                  <div style={{ ...S.errorBox, marginBottom: 14 }}>
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    {availabilityError}
                  </div>
                )}

                {/* Step 1: Select Day */}
                <div style={{ marginBottom: 22 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>
                      <Calendar size={15} color="#2563EB" />
                      <span>1. Select Day</span>
                    </div>
                    <span style={{ fontSize: 11.5, color: "#64748B" }}>Upcoming weekdays only</span>
                  </div>

                  <div className="apt-dates-scroll">
                    {availableDates.map((item) => {
                      const isSelected = selectedDate?.iso === item.iso;
                      const slots = buildTimeSlotsForDate(item.iso, detectedTimezone);
                      const takenCount = slots.filter((s) => isSlotBooked(item.iso, s.key)).length;
                      const fullyBooked = takenCount === BASE_SLOTS_24H.length;
                      return (
                        <button
                          key={item.iso}
                          type="button"
                          className={`apt-date-btn ${isSelected ? "active" : ""} ${fullyBooked ? "fully-booked" : ""}`}
                          onClick={() => !fullyBooked && setSelectedDate(item)}
                          disabled={fullyBooked}
                          title={fullyBooked ? "All slots booked for this day" : undefined}
                        >
                          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: isSelected ? "#2563EB" : "#64748B" }}>
                            {item.dayName}
                          </span>
                          <span style={{ fontSize: 17, fontWeight: 800, margin: "2px 0", color: isSelected ? "#1D4ED8" : "#0F172A" }}>
                            {item.dayNum}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 500, color: isSelected ? "#2563EB" : "#64748B" }}>
                            {item.monthName}
                          </span>
                          {item.badge && (
                            <span style={{ marginTop: 3, fontSize: 9.5, fontWeight: 700, padding: "1px 5px", background: isSelected ? "#2563EB" : "#F1F5F9", color: isSelected ? "#FFF" : "#475569", borderRadius: 4 }}>
                              {item.badge}
                            </span>
                          )}
                          {fullyBooked && (
                            <span style={{ marginTop: 3, fontSize: 9, fontWeight: 700, padding: "1px 5px", background: "#FEE2E2", color: "#DC2626", borderRadius: 4 }}>
                              Full
                            </span>
                          )}
                          {!fullyBooked && takenCount > 0 && !isSelected && (
                            <span style={{ marginTop: 3, fontSize: 9, fontWeight: 600, color: "#F59E0B" }}>
                              {BASE_SLOTS_24H.length - takenCount} left
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2: Select Time */}
                <div style={{ marginBottom: 22 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>
                      <Clock size={15} color="#2563EB" />
                      <span>2. Select Time</span>
                    </div>
                    <span style={{ fontSize: 11.5, color: "#64748B" }}>
                      {selectedDate && !slotsLoading
                        ? `${availableTimesForDate} of ${BASE_SLOTS_24H.length} slots open`
                        : "30-min duration"}
                    </span>
                  </div>

                  {/* Timezone notice when visitor is not in WAT */}
                  {timeSlots[0] && !timeSlots[0].sameZone && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 7, marginBottom: 10, fontSize: 11.5, color: "#92400E" }}>
                      <Globe size={13} color="#D97706" style={{ flexShrink: 0 }} />
                      <span>
                        Times shown in <strong>your local timezone ({detectedTimezone})</strong>.
                        {tzOffsetLabel && <> WAT time shown in grey below each slot ({tzOffsetLabel}).</>}
                      </span>
                    </div>
                  )}

                  {slotsLoading ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "24px 0", color: "#64748B", fontSize: 13 }}>
                      <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                      Checking availability...
                    </div>
                  ) : (
                    <div style={S.timesGrid}>
                      {timeSlots.map((slot) => {
                        const isSelected = selectedTime === slot.key;
                        const booked = selectedDate ? isSlotBooked(selectedDate.iso, slot.key) : false;
                        return (
                          <button
                            key={slot.key}
                            type="button"
                            className={`apt-time-btn ${isSelected && !booked ? "active" : ""} ${booked ? "booked" : ""}`}
                            onClick={() => !booked && setSelectedTime(slot.key)}
                            disabled={booked}
                            title={booked ? "This slot is already booked" : `Select ${slot.localDisplay}`}
                          >
                            <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, lineHeight: 1.2 }}>
                              {isSelected && !booked && <CheckCircle2 size={11} style={{ marginBottom: 1 }} />}
                              {booked && <XCircle size={11} style={{ opacity: 0.5, marginBottom: 1 }} />}
                              <span style={{ fontWeight: 700 }}>{slot.localDisplay}</span>
                              {!slot.sameZone && !booked && (
                                <span style={{ fontSize: 9.5, fontWeight: 500, color: isSelected ? "rgba(255,255,255,0.75)" : "#94A3B8" }}>
                                  {slot.hostDisplay} WAT
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {selectedDate && availableTimesForDate === 0 && !slotsLoading && (
                    <div style={{ marginTop: 10, padding: "10px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <AlertCircle size={15} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 12.5, color: "#7F1D1D" }}>All slots for this day are fully booked. Please select another day.</span>
                    </div>
                  )}
                </div>

                {/* What we'll cover */}
                <div style={S.coverBox}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <ShieldCheck size={14} color="#2563EB" />
                    <span>What we will cover in your demo:</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
                    <li>A walkthrough shaped around your organisation and learning model.</li>
                    <li>Course, cohort, community, learner and instructor management.</li>
                    <li>AI learning support, skill-gap tracking and readiness insights.</li>
                    <li>The most appropriate platform tier and implementation approach.</li>
                  </ul>
                </div>
              </div>

              {/* ── Right: Form ── */}
              <div className="form-panel" style={S.formPanel}>

                <div style={{ borderBottom: "1px solid #E2E8F0", paddingBottom: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>3. Your Organization Details</div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>We will send the Google Meet invitation and agenda directly to your work email.</div>
                </div>

                {/* Current selection badge */}
                <div style={S.slotRecap}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#2563EB", marginBottom: 3 }}>Selected Slot</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>
                    {selectedDate ? selectedDate.formattedLong : "Select a day"}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#475569", fontWeight: 600, display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                    <Clock size={13} color="#2563EB" />
                    <span>
                      {(() => {
                        const slot = timeSlots.find((s) => s.key === selectedTime);
                        if (!slot) return `${selectedTime} (${detectedTimezone})`;
                        if (selectedDate && isSlotBooked(selectedDate.iso, selectedTime)) {
                          return <span style={{ color: "#EF4444" }}>{slot.localDisplay} - Already booked, choose another</span>;
                        }
                        return slot.sameZone
                          ? `${slot.localDisplay} (${detectedTimezone})`
                          : `${slot.localDisplay} your time (${slot.hostDisplay} WAT)`;
                      })()}
                    </span>
                  </div>
                </div>

                <form onSubmit={handleBookAppointment} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                  {/* Full Name */}
                  <div>
                    <label style={S.label}>Full Name <span style={{ color: "#EF4444" }}>*</span></label>
                    <div className="apt-input-group" style={S.inputGroup}>
                      <User size={15} color="#94A3B8" style={{ marginLeft: 10, flexShrink: 0 }} />
                      <input required type="text" placeholder="e.g. Dr. Sarah Jenkins"
                        value={fullName} onChange={(e) => setFullName(e.target.value)}
                        className="apt-input-field" style={S.textInput} />
                    </div>
                  </div>

                  {/* Work Email */}
                  <div>
                    <label style={S.label}>Institutional / Work Email <span style={{ color: "#EF4444" }}>*</span></label>
                    <div className="apt-input-group" style={S.inputGroup}>
                      <Mail size={15} color="#94A3B8" style={{ marginLeft: 10, flexShrink: 0 }} />
                      <input required type="email" placeholder="sarah@institution.edu or name@company.org"
                        value={workEmail} onChange={(e) => setWorkEmail(e.target.value)}
                        className="apt-input-field" style={S.textInput} />
                    </div>
                  </div>

                  {/* Organization Name */}
                  <div>
                    <label style={S.label}>Organization Name <span style={{ color: "#EF4444" }}>*</span></label>
                    <div className="apt-input-group" style={S.inputGroup}>
                      <Building2 size={15} color="#94A3B8" style={{ marginLeft: 10, flexShrink: 0 }} />
                      <input required type="text" placeholder="e.g. Westford Institute / Global Hope Foundation"
                        value={organizationName} onChange={(e) => setOrganizationName(e.target.value)}
                        className="apt-input-field" style={S.textInput} />
                    </div>
                  </div>

                  {/* Org Type + Team Size */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={S.label}>Organization Type</label>
                      <select value={orgType} onChange={(e) => setOrgType(e.target.value)} className="apt-input-field" style={S.selectInput}>
                        {ORG_TYPE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={S.label}>Learner / Team Size</label>
                      <select value={teamSize} onChange={(e) => setTeamSize(e.target.value)} className="apt-input-field" style={S.selectInput}>
                        {TEAM_SIZE_OPTIONS.map((sz) => <option key={sz} value={sz}>{sz}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Optional notes */}
                  <div>
                    <label style={S.label}>Topics or Goals to Focus On <span style={{ color: "#94A3B8", fontWeight: 400 }}>(Optional)</span></label>
                    <textarea rows={2} placeholder="e.g. Semester cohort timeline, grant proposal needs, custom LMS integration..."
                      value={agendaNotes} onChange={(e) => setAgendaNotes(e.target.value)}
                      className="apt-input-field" style={S.textareaInput} />
                  </div>

                  {/* Error */}
                  {submitError && (
                    <div style={S.errorBox}>
                      <AlertCircle size={14} style={{ flexShrink: 0 }} />
                      {submitError}
                    </div>
                  )}

                  {/* Submit */}
                  <button type="submit" disabled={submitting || !!availabilityError || (selectedDate && isSlotBooked(selectedDate.iso, selectedTime))}
                    className="action-btn-primary"
                    style={{ ...S.submitBtn, opacity: (availabilityError || (selectedDate && isSlotBooked(selectedDate.iso, selectedTime))) ? 0.5 : 1 }}>
                    {submitting
                      ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Confirming Appointment...</>
                      : <>Confirm Appointment for {selectedDate ? selectedDate.dayName : ""} at {selectedTime} <ChevronRight size={16} /></>}
                  </button>

                  <div style={{ textAlign: "center", fontSize: 11.5, color: "#64748B", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                    <ShieldCheck size={13} color="#059669" />
                    Free 30-minute discovery call. No commitment required.
                  </div>

                </form>
              </div>
            </div>
          )}
      </main>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const S = {
  outer: { minHeight: "100vh", background: "#F8FAFC", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#0F172A", paddingBottom: 60, overflowX: "hidden" },
  header: { background: "#FFFFFF", borderBottom: "1px solid #E2E8F0", position: "sticky", top: 0, zIndex: 50 },
  headerInner: { maxWidth: 1120, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 },
  backBtn: { display: "flex", alignItems: "center", gap: 7, background: "transparent", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 6 },
  main: { maxWidth: 1120, margin: "0 auto", padding: "24px 16px 0", boxSizing: "border-box", width: "100%" },
  bookingGrid: { display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" },
  schedulerPanel: { flex: "1 1 400px", minWidth: 0, background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 14, padding: "20px 18px", boxSizing: "border-box" },
  formPanel: { flex: "1 1 340px", minWidth: 0, background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 14, padding: "20px 18px", boxSizing: "border-box" },
  legend: { display: "flex", alignItems: "center", gap: 14, marginBottom: 14, padding: "8px 12px", background: "#F8FAFC", borderRadius: 8, flexWrap: "wrap" },
  timesGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 },
  coverBox: { background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "14px 16px" },
  slotRecap: { background: "#EFF6FF", border: "1.5px solid #BFDBFE", borderRadius: 10, padding: "12px 14px", marginBottom: 16 },
  label: { display: "block", fontSize: 12.5, fontWeight: 700, color: "#374151", marginBottom: 5 },
  inputGroup: { display: "flex", alignItems: "center", border: "1.5px solid #E2E8F0", borderRadius: 8, overflow: "hidden", background: "#FFFFFF" },
  textInput: { flex: 1, border: "none", outline: "none", padding: "10px 12px", fontSize: 13.5, background: "#FFFFFF", minWidth: 0 },
  selectInput: { width: "100%", padding: "10px 12px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 13, background: "#FFFFFF", cursor: "pointer" },
  textareaInput: { width: "100%", padding: "10px 12px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 13, resize: "vertical", background: "#FFFFFF", boxSizing: "border-box" },
  errorBox: { display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, color: "#991B1B", fontSize: 13, fontWeight: 500 },
  submitBtn: { width: "100%", padding: "13px 18px", borderRadius: 10, fontSize: 14, fontWeight: 700, border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },
  confirmedCard: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16, padding: "36px 28px", maxWidth: 640, margin: "0 auto" },
  confirmedBox: { display: "flex", flexDirection: "column", gap: 12, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "16px 18px" },
  confirmedRow: { display: "flex", alignItems: "flex-start", gap: 10 },
};
