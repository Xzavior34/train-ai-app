import React, { useState, useEffect, useMemo } from "react";
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
  Award,
  Sparkles as _IgnoredSparkles, // explicitly not used to satisfy zero-sparkle rule
  HelpCircle,
  FileText
} from "lucide-react";
import { submitDemoRequest } from "../../lib/api/waitlist.js";

// Helper to calculate available upcoming business days (skipping weekends)
function generateAvailableDates(count = 12) {
  const dates = [];
  const now = new Date();
  
  // Start from tomorrow
  let current = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  while (dates.length < count) {
    const dayOfWeek = current.getDay(); // 0 is Sunday, 6 is Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const year = current.getFullYear();
      const month = current.getMonth();
      const day = current.getDate();

      const dateObj = new Date(year, month, day);
      const isTomorrow = dates.length === 0;

      const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
      const fullDayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });
      const monthName = dateObj.toLocaleDateString("en-US", { month: "short" });
      const fullMonthName = dateObj.toLocaleDateString("en-US", { month: "long" });
      const dayNum = dateObj.getDate();

      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      dates.push({
        dateObj,
        iso,
        dayName,
        fullDayName,
        monthName,
        fullMonthName,
        dayNum,
        year,
        formattedShort: `${dayName}, ${monthName} ${dayNum}`,
        formattedLong: `${fullDayName}, ${fullMonthName} ${dayNum}, ${year}`,
        badge: isTomorrow ? "Tomorrow" : dates.length === 1 ? "Next Day" : null
      });
    }
    // Move to next day
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

const TIME_SLOTS = [
  "09:30 AM",
  "10:00 AM",
  "11:00 AM",
  "11:30 AM",
  "01:30 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
  "05:00 PM"
];

const ORG_TYPE_OPTIONS = [
  "Academy / Educational Institution",
  "NGO / Non-Profit / Foundation",
  "Business / Enterprise",
  "Government / Public Sector",
  "Other"
];

const TEAM_SIZE_OPTIONS = [
  "1 - 50 learners",
  "50 - 250 learners",
  "250 - 1,000 learners",
  "1,000+ learners"
];

export default function AppointmentBookingPage({ onBack, onNavigate, initialSector = "academies" }) {
  // Generate dates
  const availableDates = useMemo(() => generateAvailableDates(14), []);

  // AUTOMATIC SELECTION: Automatically select the first available day and a prime morning time slot
  const [selectedDate, setSelectedDate] = useState(availableDates[0] || null);
  const [selectedTime, setSelectedTime] = useState(TIME_SLOTS[1] || "10:00 AM"); // Auto-selects 10:00 AM

  // Timezone detection
  const detectedTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }, []);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [orgType, setOrgType] = useState(() => {
    if (initialSector === "ngos") return ORG_TYPE_OPTIONS[1];
    if (initialSector === "businesses") return ORG_TYPE_OPTIONS[2];
    return ORG_TYPE_OPTIONS[0];
  });
  const [teamSize, setTeamSize] = useState(TEAM_SIZE_OPTIONS[1]);
  const [agendaNotes, setAgendaNotes] = useState("");

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [confirmedDetails, setConfirmedDetails] = useState(null);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Helper to parse time string like "10:00 AM" into hours and minutes
  function parseTimeSlot(timeStr) {
    const [time, modifier] = timeStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if (modifier === "PM" && hours < 12) hours += 12;
    if (modifier === "AM" && hours === 12) hours = 0;
    return { hours, minutes };
  }

  // Handle appointment confirmation
  async function handleBookAppointment(e) {
    e.preventDefault();
    if (submitting) return;

    if (!selectedDate || !selectedTime) {
      setSubmitError("Please ensure a day and time are selected.");
      return;
    }

    if (!fullName.trim() || !workEmail.trim() || !organizationName.trim()) {
      setSubmitError("Please fill in your name, work email, and organization name.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      const scheduledSummary = `${selectedDate.formattedLong} at ${selectedTime} (${detectedTimezone})`;
      const fullMessage = [
        `[APPOINTMENT SCHEDULED]`,
        `Appointment Slot: ${scheduledSummary}`,
        `Organization Type: ${orgType}`,
        `Cohort / Team Size: ${teamSize}`,
        `Meeting Link: Google Meet (Automatic Dispatch)`,
        agendaNotes ? `Special Goals / Questions: ${agendaNotes.trim()}` : null
      ].filter(Boolean).join("\n");

      const result = await submitDemoRequest({
        fullName: fullName.trim(),
        workEmail: workEmail.trim(),
        companyName: `[${orgType}] ${organizationName.trim()}`,
        teamSize,
        message: fullMessage,
        source: `appointment_scheduler_${initialSector}`
      });

      if (!result.success) {
        setSubmitError(result.error || "Could not book your appointment. Please try again.");
        return;
      }

      // Store confirmed appointment state
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
        isoDate: selectedDate.iso
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

  // Google Calendar URL Generator
  function getGoogleCalendarUrl() {
    if (!confirmedDetails) return "#";
    const { hours, minutes } = parseTimeSlot(confirmedDetails.time);
    const start = new Date(confirmedDetails.dateObj);
    start.setHours(hours, minutes, 0, 0);

    const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 minutes duration

    const formatUtc = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const datesParam = `${formatUtc(start)}/${formatUtc(end)}`;

    const title = encodeURIComponent("Train AI: Product Demo & Institutional Consultation");
    const details = encodeURIComponent(
      `Train AI 30-minute institutional demo and strategy session.\n\nOrganization: ${confirmedDetails.organizationName} (${confirmedDetails.orgType})\nAttendee: ${confirmedDetails.fullName} (${confirmedDetails.workEmail})\nLocation: Google Meet video link will be sent to your email.`
    );
    const location = encodeURIComponent("Google Meet (Video Conference)");

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${datesParam}&details=${details}&location=${location}`;
  }

  // Download .ics file
  function handleDownloadIcs() {
    if (!confirmedDetails) return;
    const { hours, minutes } = parseTimeSlot(confirmedDetails.time);
    const start = new Date(confirmedDetails.dateObj);
    start.setHours(hours, minutes, 0, 0);
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    const formatIcs = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Train AI Ltd//Appointment Scheduler//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:REQUEST",
      "BEGIN:VEVENT",
      `SUMMARY:Train AI Product Demo & Institutional Consultation`,
      `DESCRIPTION:Train AI 30-minute consultation for ${confirmedDetails.organizationName}. Google Meet video conference link will be dispatched to your email.`,
      `LOCATION:Google Meet`,
      `DTSTART:${formatIcs(start)}`,
      `DTEND:${formatIcs(end)}`,
      `STATUS:CONFIRMED`,
      "END:VEVENT",
      "END:VCALENDAR"
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

  return (
    <div style={styles.outerContainer}>
      <style>{`
        .apt-date-btn {
          border: 1px solid #E2E8F0;
          background: #FFFFFF;
          color: #0F172A;
          border-radius: 8px;
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-width: 82px;
          cursor: pointer;
          transition: all 0.16s ease;
          user-select: none;
        }
        .apt-date-btn:hover {
          border-color: #2563EB;
          background: #F8FAFC;
        }
        .apt-date-btn.active {
          border-color: #2563EB;
          background: #EFF6FF;
          color: #1D4ED8;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
        }

        .apt-time-btn {
          border: 1px solid #E2E8F0;
          background: #FFFFFF;
          color: #1E293B;
          border-radius: 6px;
          padding: 9px 12px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .apt-time-btn:hover {
          border-color: #2563EB;
          background: #F8FAFC;
        }
        .apt-time-btn.active {
          border-color: #2563EB;
          background: #2563EB;
          color: #FFFFFF;
          font-weight: 700;
        }

        .action-btn-primary {
          background: #2563EB;
          color: #FFFFFF;
          transition: background-color .14s ease, transform .14s ease;
          cursor: pointer;
        }
        .action-btn-primary:hover {
          background: #1D4ED8;
        }
        .action-btn-primary:active {
          transform: scale(.98);
        }

        .action-btn-outline {
          background: #FFFFFF;
          color: #0F172A;
          border: 1px solid #CBD5E1;
          transition: background-color .14s ease, border-color .14s ease;
          cursor: pointer;
        }
        .action-btn-outline:hover {
          background: #F8FAFC;
          border-color: #94A3B8;
        }
      `}</style>

      {/* Top Navigation Bar */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={onBack}
              style={styles.backBtn}
              aria-label="Back to home"
            >
              <ArrowLeft size={16} color="#0F172A" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>Back to Train AI</span>
            </button>
            <div style={{ height: 18, width: 1, background: "#E2E8F0" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={styles.logoMark}>
                <span style={{ color: "#fff", fontWeight: 900, fontSize: 13 }}>T</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>
                Train AI
              </span>
              <span style={styles.schedulerBadge}>
                Live Scheduler
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748B" }}>
            <Globe size={14} color="#64748B" />
            <span style={{ fontWeight: 500 }}>Timezone: <strong style={{ color: "#0F172A" }}>{detectedTimezone}</strong></span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={styles.mainWrapper}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          
          {/* Header Info */}
          <div style={{ marginBottom: 24, textAlign: "left" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", background: "#EFF6FF", color: "#1D4ED8", borderRadius: 6, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
              <Clock size={13} />
              <span>30-Minute Institutional Walkthrough</span>
            </div>
            <h1 style={{ fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 900, color: "#0F172A", letterSpacing: "-0.03em", margin: "0 0 6px" }}>
              Set an Appointment with Train AI
            </h1>
            <p style={{ fontSize: 14, color: "#64748B", margin: 0, maxWidth: 680, lineHeight: 1.5 }}>
              Choose your preferred day and time below. We automatically select the earliest available slot to save you time. Explore cohort management, AI tutoring, and subsidized options.
            </p>
          </div>

          {/* CONFIRMED STATE */}
          {isConfirmed && confirmedDetails ? (
            <div style={styles.confirmedCard}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: "50%", background: "#DCFCE7", color: "#16A34A", margin: "0 auto 16px" }}>
                <CheckCircle2 size={28} />
              </div>

              <h2 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", margin: "0 0 8px", textAlign: "center" }}>
                Your Appointment is Confirmed
              </h2>
              <p style={{ fontSize: 14, color: "#64748B", margin: "0 auto 24px", textAlign: "center", maxWidth: 520, lineHeight: 1.5 }}>
                A calendar invitation with your secure Google Meet video link has been prepared for <strong>{confirmedDetails.workEmail}</strong>.
              </p>

              {/* Appointment summary box */}
              <div style={styles.confirmedSummaryBox}>
                <div style={styles.confirmedSummaryRow}>
                  <Calendar size={17} color="#2563EB" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11.5, color: "#64748B", fontWeight: 600 }}>Date</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{confirmedDetails.dateFormatted}</div>
                  </div>
                </div>

                <div style={styles.confirmedSummaryRow}>
                  <Clock size={17} color="#2563EB" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11.5, color: "#64748B", fontWeight: 600 }}>Time & Duration</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
                      {confirmedDetails.time} (30 mins) <span style={{ fontWeight: 500, color: "#64748B", fontSize: 12 }}>[{confirmedDetails.timezone}]</span>
                    </div>
                  </div>
                </div>

                <div style={styles.confirmedSummaryRow}>
                  <Video size={17} color="#2563EB" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11.5, color: "#64748B", fontWeight: 600 }}>Meeting Format</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
                      Google Meet (Video Conference)
                    </div>
                  </div>
                </div>

                <div style={styles.confirmedSummaryRow}>
                  <Building2 size={17} color="#2563EB" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11.5, color: "#64748B", fontWeight: 600 }}>Organization</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
                      {confirmedDetails.organizationName} <span style={{ fontWeight: 500, color: "#64748B", fontSize: 12 }}>({confirmedDetails.orgType})</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 24 }}>
                <a
                  href={getGoogleCalendarUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="action-btn-primary"
                  style={{ textDecoration: "none", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 7 }}
                >
                  <Calendar size={15} /> Add to Google Calendar <ExternalLink size={13} />
                </a>

                <button
                  onClick={handleDownloadIcs}
                  className="action-btn-outline"
                  style={{ padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 7 }}
                >
                  <Download size={15} /> Download .ics (Outlook / Apple)
                </button>
              </div>

              <div style={{ textAlign: "center", marginTop: 20 }}>
                <button
                  onClick={onBack}
                  style={{ background: "transparent", border: "none", color: "#64748B", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
                >
                  Return to Train AI Homepage
                </button>
              </div>
            </div>
          ) : (
            /* BOOKING FLOW */
            <div style={styles.bookingGrid}>
              
              {/* Left Column: Date & Time Picker */}
              <div style={styles.schedulerPanel}>
                
                {/* Auto-selected notice */}
                <div style={styles.autoSelectBanner}>
                  <CheckCircle2 size={16} color="#059669" style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: 12.5, color: "#065F46", lineHeight: 1.4 }}>
                    <strong>Slot automatically selected:</strong> {selectedDate ? selectedDate.formattedShort : "Select Day"} at {selectedTime}. You can switch to any other day or time slot below.
                  </div>
                </div>

                {/* Step 1: Select Date */}
                <div style={{ marginBottom: 22 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>
                      <Calendar size={15} color="#2563EB" />
                      <span>1. Select Day</span>
                    </div>
                    <span style={{ fontSize: 11.5, color: "#64748B" }}>Upcoming weekdays</span>
                  </div>

                  <div style={styles.datesScrollWrapper}>
                    {availableDates.map((item) => {
                      const isSelected = selectedDate?.iso === item.iso;
                      return (
                        <button
                          key={item.iso}
                          type="button"
                          className={`apt-date-btn ${isSelected ? "active" : ""}`}
                          onClick={() => setSelectedDate(item)}
                          aria-label={`Select date ${item.formattedLong}`}
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
                            <span style={{ marginTop: 4, fontSize: 9.5, fontWeight: 700, padding: "1px 5px", background: isSelected ? "#2563EB" : "#F1F5F9", color: isSelected ? "#FFFFFF" : "#475569", borderRadius: 4 }}>
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2: Select Time */}
                <div style={{ marginBottom: 22 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>
                      <Clock size={15} color="#2563EB" />
                      <span>2. Select Time</span>
                    </div>
                    <span style={{ fontSize: 11.5, color: "#64748B" }}>30-min duration</span>
                  </div>

                  <div style={styles.timesGrid}>
                    {TIME_SLOTS.map((slot) => {
                      const isSelected = selectedTime === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          className={`apt-time-btn ${isSelected ? "active" : ""}`}
                          onClick={() => setSelectedTime(slot)}
                          aria-label={`Select time ${slot}`}
                        >
                          {isSelected && <CheckCircle2 size={13} />}
                          <span>{slot}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Meeting Context Highlights */}
                <div style={styles.sessionFeaturesBox}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <ShieldCheck size={14} color="#2563EB" />
                    <span>What we will cover in your demo:</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#475569", lineHeight: 1.55 }}>
                    <li>Tailored walkthrough for your sector (Academies, NGOs, or Businesses).</li>
                    <li>Live look at cohort scheduling, AI-assisted quizzes, and AI tutor.</li>
                    <li>Grant reporting &amp; telemetry exports (CSV/PDF) or enterprise skill graph.</li>
                    <li>Licensing options, academic volume discounts, or subsidized seat programs.</li>
                  </ul>
                </div>

              </div>

              {/* Right Column: Attendee Information Form */}
              <div style={styles.formPanel}>
                
                <div style={{ borderBottom: "1px solid #E2E8F0", paddingBottom: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>
                    3. Your Organization Details
                  </div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>
                    We will send the Google Meet invitation and agenda directly to your work email.
                  </div>
                </div>

                {/* Selected Slot Recap Badge */}
                <div style={styles.slotRecapCard}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#2563EB", marginBottom: 3 }}>
                    Current Selection
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>
                    {selectedDate ? selectedDate.formattedLong : "Select a day"}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#475569", fontWeight: 600, display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <Clock size={13} color="#2563EB" />
                    <span>{selectedTime} ({detectedTimezone})</span>
                  </div>
                </div>

                <form onSubmit={handleBookAppointment} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  
                  {/* Full Name */}
                  <div>
                    <label style={styles.inputLabel}>
                      Full Name <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <div style={styles.inputGroup}>
                      <User size={15} color="#94A3B8" style={{ marginLeft: 10 }} />
                      <input
                        required
                        type="text"
                        placeholder="e.g. Dr. Sarah Jenkins"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        style={styles.textInput}
                      />
                    </div>
                  </div>

                  {/* Work Email */}
                  <div>
                    <label style={styles.inputLabel}>
                      Institutional / Work Email <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <div style={styles.inputGroup}>
                      <Mail size={15} color="#94A3B8" style={{ marginLeft: 10 }} />
                      <input
                        required
                        type="email"
                        placeholder="sarah@institution.edu or name@company.org"
                        value={workEmail}
                        onChange={(e) => setWorkEmail(e.target.value)}
                        style={styles.textInput}
                      />
                    </div>
                  </div>

                  {/* Organization Name */}
                  <div>
                    <label style={styles.inputLabel}>
                      Organization Name <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <div style={styles.inputGroup}>
                      <Building2 size={15} color="#94A3B8" style={{ marginLeft: 10 }} />
                      <input
                        required
                        type="text"
                        placeholder="e.g. Westford Institute / Global Hope Foundation"
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        style={styles.textInput}
                      />
                    </div>
                  </div>

                  {/* Sector / Organization Type */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={styles.inputLabel}>Organization Type</label>
                      <select
                        value={orgType}
                        onChange={(e) => setOrgType(e.target.value)}
                        style={styles.selectInput}
                      >
                        {ORG_TYPE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={styles.inputLabel}>Learner / Team Size</label>
                      <select
                        value={teamSize}
                        onChange={(e) => setTeamSize(e.target.value)}
                        style={styles.selectInput}
                      >
                        {TEAM_SIZE_OPTIONS.map((size) => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Optional Notes */}
                  <div>
                    <label style={styles.inputLabel}>
                      Topics or Goals to Focus On <span style={{ color: "#94A3B8", fontWeight: 400 }}>(Optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Semester cohort timeline, grant proposal needs, custom LMS integration..."
                      value={agendaNotes}
                      onChange={(e) => setAgendaNotes(e.target.value)}
                      style={styles.textareaInput}
                    />
                  </div>

                  {/* Error Message */}
                  {submitError && (
                    <div style={styles.errorBox}>
                      {submitError}
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="action-btn-primary"
                    style={styles.submitBtn}
                  >
                    {submitting ? "Confirming Appointment..." : `Confirm Appointment for ${selectedDate ? selectedDate.dayName : ""} at ${selectedTime}`}
                    <ChevronRight size={16} />
                  </button>

                  <div style={{ textAlign: "center", fontSize: 11.5, color: "#64748B", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                    <ShieldCheck size={13} color="#059669" />
                    <span>Free 30-minute discovery call. No commitment required.</span>
                  </div>

                </form>

              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  );
}

const styles = {
  outerContainer: {
    minHeight: "100vh",
    background: "#F8FAFC",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: "#0F172A",
    paddingBottom: 48
  },
  header: {
    background: "#FFFFFF",
    borderBottom: "1px solid #E2E8F0",
    position: "sticky",
    top: 0,
    zIndex: 50
  },
  headerInner: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "12px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12
  },
  backBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    borderRadius: 6
  },
  logoMark: {
    width: 24,
    height: 24,
    borderRadius: 6,
    background: "#0F172A",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  schedulerBadge: {
    fontSize: 11,
    fontWeight: 700,
    background: "#EFF6FF",
    color: "#2563EB",
    padding: "2px 7px",
    borderRadius: 4,
    border: "1px solid #DBEAFE"
  },
  mainWrapper: {
    padding: "24px 18px"
  },
  bookingGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 20,
    alignItems: "start"
  },
  schedulerPanel: {
    background: "#FFFFFF",
    borderRadius: 10,
    border: "1px solid #E2E8F0",
    padding: "20px 18px",
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)"
  },
  autoSelectBanner: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    background: "#ECFDF5",
    border: "1px solid #A7F3D0",
    borderRadius: 8,
    padding: "10px 12px",
    marginBottom: 18
  },
  datesScrollWrapper: {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    paddingBottom: 8,
    WebkitOverflowScrolling: "touch"
  },
  timesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
    gap: 8
  },
  sessionFeaturesBox: {
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 8,
    padding: "12px 14px",
    marginTop: 18
  },
  formPanel: {
    background: "#FFFFFF",
    borderRadius: 10,
    border: "1px solid #E2E8F0",
    padding: "20px 18px",
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)"
  },
  slotRecapCard: {
    background: "#F1F5F9",
    border: "1px solid #E2E8F0",
    borderRadius: 8,
    padding: "10px 14px",
    marginBottom: 16
  },
  inputLabel: {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    color: "#334155",
    marginBottom: 5
  },
  inputGroup: {
    display: "flex",
    alignItems: "center",
    border: "1px solid #CBD5E1",
    borderRadius: 6,
    background: "#FFFFFF",
    overflow: "hidden"
  },
  textInput: {
    width: "100%",
    border: "none",
    padding: "9px 10px",
    fontSize: 13,
    color: "#0F172A",
    outline: "none",
    fontFamily: "inherit"
  },
  selectInput: {
    width: "100%",
    border: "1px solid #CBD5E1",
    borderRadius: 6,
    padding: "8.5px 10px",
    fontSize: 12.5,
    color: "#0F172A",
    background: "#FFFFFF",
    outline: "none",
    fontFamily: "inherit"
  },
  textareaInput: {
    width: "100%",
    border: "1px solid #CBD5E1",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 12.5,
    color: "#0F172A",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    resize: "vertical"
  },
  errorBox: {
    fontSize: 12,
    color: "#EF4444",
    background: "#FEF2F2",
    border: "1px solid #FCA5A5",
    borderRadius: 6,
    padding: "8px 10px",
    fontWeight: 600
  },
  submitBtn: {
    border: "none",
    padding: "11px 16px",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 13.5,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 4
  },
  confirmedCard: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 12,
    padding: "36px 24px",
    maxWidth: 640,
    margin: "0 auto",
    boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.06)"
  },
  confirmedSummaryBox: {
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 8,
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: 14
  },
  confirmedSummaryRow: {
    display: "flex",
    alignItems: "center",
    gap: 12
  }
};
