import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://trainailtd.com",
  "https://www.trainailtd.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
const internalAttendees = ["info@sarafoundationafrica.com", "trainailtd@gmail.com"];
const validSlots = new Set([
  "09:30 AM", "10:00 AM", "11:00 AM", "11:30 AM",
  "01:30 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM",
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://www.trainailtd.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function respond(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[char] || char));
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlText(value: string) {
  return base64Url(new TextEncoder().encode(value));
}

async function serviceAccountToken(email: string, privateKey: string, subject?: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims: Record<string, unknown> = {
    iss: email,
    scope: "https://www.googleapis.com/auth/calendar.events",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  if (subject) claims.sub = subject;
  const payload = base64UrlText(JSON.stringify(claims));
  const pem = privateKey.replace(/\\n/g, "\n").replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const keyBytes = Uint8Array.from(atob(pem), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  const assertion = `${header}.${payload}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error(`Google authentication failed: ${result.error_description || result.error || response.status}`);
  return result.access_token as string;
}

async function calendarAccessToken() {
  const refreshToken = clean(Deno.env.get("GOOGLE_REFRESH_TOKEN"), 4096);
  const clientId = clean(Deno.env.get("GOOGLE_CLIENT_ID"), 1024);
  const clientSecret = clean(Deno.env.get("GOOGLE_CLIENT_SECRET"), 2048);
  if (refreshToken && clientId && clientSecret) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.access_token) throw new Error(`Google authentication failed: ${result.error_description || result.error || response.status}`);
    return result.access_token as string;
  }

  const serviceEmail = clean(Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL"), 512);
  const privateKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY") || "";
  const subject = clean(Deno.env.get("GOOGLE_IMPERSONATED_USER_EMAIL"), 512);
  if (serviceEmail && privateKey) return serviceAccountToken(serviceEmail, privateKey, subject || undefined);
  throw new Error("Google Calendar credentials are not configured.");
}

function slotDateTimes(date: string, time: string) {
  const match = time.match(/^(\d{2}):(\d{2}) (AM|PM)$/);
  if (!match) throw new Error("Invalid appointment time.");
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (match[3] === "PM" && hour !== 12) hour += 12;
  if (match[3] === "AM" && hour === 12) hour = 0;
  const startUtc = Date.parse(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+01:00`);
  if (!Number.isFinite(startUtc)) throw new Error("Invalid appointment date.");
  const isoWithWat = (ms: number) => {
    const wat = new Date(ms + 60 * 60 * 1000);
    return `${wat.getUTCFullYear()}-${String(wat.getUTCMonth() + 1).padStart(2, "0")}-${String(wat.getUTCDate()).padStart(2, "0")}T${String(wat.getUTCHours()).padStart(2, "0")}:${String(wat.getUTCMinutes()).padStart(2, "0")}:00+01:00`;
  };
  return { start: isoWithWat(startUtc), end: isoWithWat(startUtc + 30 * 60 * 1000), startUtc };
}

async function createCalendarEvent(input: Record<string, string>, bookingId: string) {
  const appsScriptUrl = clean(Deno.env.get("GOOGLE_BOOKING_SCRIPT_URL"), 2048);
  const appsScriptSecret = clean(Deno.env.get("GOOGLE_BOOKING_SCRIPT_SECRET"), 4096);
  if (appsScriptUrl && appsScriptSecret) {
    const { start, end } = slotDateTimes(input.scheduledDate, input.scheduledTime);
    const response = await fetch(appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        automationSecret: appsScriptSecret,
        bookingId,
        ...input,
        start,
        end,
        attendees: [...new Set([input.workEmail, ...internalAttendees])],
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success || !result.eventId || !result.meetingUrl) {
      throw new Error(`Google Calendar rejected the event: ${result.error || response.status}`);
    }
    return {
      id: String(result.eventId),
      htmlLink: String(result.htmlLink || result.meetingUrl),
      meetingUrl: String(result.meetingUrl),
      title: String(result.title || `Train AI Product Demo: ${input.organizationName}`),
      start,
      end,
    };
  }

  const token = await calendarAccessToken();
  const calendarId = clean(Deno.env.get("GOOGLE_CALENDAR_ID"), 1024) || "primary";
  const { start, end } = slotDateTimes(input.scheduledDate, input.scheduledTime);
  const attendees = [...new Set([input.workEmail, ...internalAttendees])].map((email) => ({ email }));
  const title = `Train AI Product Demo: ${input.organizationName}`;
  const description = [
    "Train AI 30-minute product demo and institutional consultation.",
    "",
    `Booking reference: ${bookingId}`,
    `Primary attendee: ${input.fullName} <${input.workEmail}>`,
    `Organisation: ${input.organizationName}`,
    `Organisation type: ${input.orgType}`,
    `Cohort or team size: ${input.teamSize}`,
    `Visitor timezone: ${input.timezone}`,
    input.agendaNotes ? `Goals or questions: ${input.agendaNotes}` : "Goals or questions: None provided",
  ].join("\n");
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: title,
      description,
      start: { dateTime: start, timeZone: "Africa/Lagos" },
      end: { dateTime: end, timeZone: "Africa/Lagos" },
      attendees,
      guestsCanInviteOthers: false,
      guestsCanModify: false,
      conferenceData: {
        createRequest: {
          requestId: `trainai-demo-${bookingId}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
      extendedProperties: { private: { trainAiBookingId: bookingId } },
    }),
  });
  const event = await response.json();
  if (!response.ok) throw new Error(`Google Calendar rejected the event: ${event?.error?.message || response.status}`);
  const meetingUrl = event.hangoutLink || event.conferenceData?.entryPoints?.find((item: { entryPointType?: string }) => item.entryPointType === "video")?.uri;
  if (!event.id || !meetingUrl) throw new Error("Google Calendar created the event without a Google Meet link.");
  return { id: event.id as string, htmlLink: event.htmlLink as string, meetingUrl: meetingUrl as string, title, start, end };
}

async function sendBackupEmail(input: Record<string, string>, event: { title: string; meetingUrl: string; htmlLink: string }) {
  const resendKey = clean(Deno.env.get("RESEND_API_KEY") || Deno.env.get("RESEND_KEY"), 4096);
  if (!resendKey) return false;
  const recipients = [...new Set([input.workEmail, ...internalAttendees])];
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("RESEND_FROM_EMAIL") || "Train AI <info@trainailtd.com>",
      to: recipients,
      subject: `${event.title} | ${input.scheduledDate} at ${input.scheduledTime} WAT`,
      html: `<h2>${escapeHtml(event.title)}</h2><p>A Google Calendar invitation has been created for <strong>${escapeHtml(input.scheduledDate)}</strong> at <strong>${escapeHtml(input.scheduledTime)} WAT</strong>.</p><p><a href="${escapeHtml(event.meetingUrl)}">Join the Google Meet</a></p><p><a href="${escapeHtml(event.htmlLink)}">Open the calendar event</a></p><p>Attendee: ${escapeHtml(input.fullName)} &lt;${escapeHtml(input.workEmail)}&gt;<br>Organisation: ${escapeHtml(input.organizationName)}<br>Team size: ${escapeHtml(input.teamSize)}<br>Goals or questions: ${escapeHtml(input.agendaNotes || "None provided")}</p>`,
    }),
  });
  if (!response.ok) console.error("Backup booking email failed", await response.text());
  return response.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return respond(req, { success: false, error: "Method not allowed." }, 405);
  const origin = req.headers.get("origin") || "";
  if (origin && !allowedOrigins.has(origin)) return respond(req, { success: false, error: "This booking origin is not allowed." }, 403);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return respond(req, { success: false, error: "Booking is temporarily unavailable." }, 503);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let bookingId = "";
  try {
    const body = await req.json().catch(() => ({}));
    const input: Record<string, string> = {
      fullName: clean(body.fullName, 160),
      workEmail: clean(body.workEmail, 320).toLowerCase(),
      organizationName: clean(body.organizationName, 200),
      teamSize: clean(body.teamSize, 100),
      agendaNotes: clean(body.agendaNotes, 3000),
      source: clean(body.source, 120) || "appointment_scheduler",
      scheduledDate: clean(body.scheduledDate, 10),
      scheduledTime: clean(body.scheduledTime, 20),
      orgType: clean(body.orgType, 160),
      timezone: clean(body.timezone, 120) || "UTC",
      utmSource: clean(body.utm_source, 200),
      utmMedium: clean(body.utm_medium, 200),
      utmCampaign: clean(body.utm_campaign, 200),
    };
    if (!input.fullName || !isEmail(input.workEmail) || !input.organizationName || !input.teamSize || !input.orgType) {
      return respond(req, { success: false, error: "Please complete all required booking details." }, 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.scheduledDate) || !validSlots.has(input.scheduledTime)) {
      return respond(req, { success: false, error: "Please select a valid appointment date and time." }, 400);
    }
    const { startUtc } = slotDateTimes(input.scheduledDate, input.scheduledTime);
    const maxDate = Date.now() + 70 * 24 * 60 * 60 * 1000;
    const weekday = new Date(`${input.scheduledDate}T12:00:00Z`).getUTCDay();
    if (startUtc <= Date.now() || startUtc > maxDate || weekday === 0 || weekday === 6) {
      return respond(req, { success: false, error: "Please select an available business-day appointment." }, 400);
    }

    const clientIp = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown").split(",")[0].trim();
    const [emailHash, ipHash] = await Promise.all([sha256(input.workEmail), sha256(clientIp)]);
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const [{ count: emailCount }, { count: ipCount }] = await Promise.all([
      admin.from("demo_booking_attempts").select("id", { count: "exact", head: true }).eq("email_hash", emailHash).gte("created_at", since),
      admin.from("demo_booking_attempts").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since),
    ]);
    if ((emailCount || 0) >= 5 || (ipCount || 0) >= 20) {
      return respond(req, { success: false, error: "Too many booking attempts. Please wait 15 minutes and try again." }, 429);
    }
    await admin.from("demo_booking_attempts").insert({ email_hash: emailHash, ip_hash: ipHash });

    bookingId = crypto.randomUUID();
    const message = [
      `[APPOINTMENT REQUESTED]`,
      `Appointment Slot: ${input.scheduledDate} at ${input.scheduledTime} WAT`,
      `Organization Type: ${input.orgType}`,
      `Cohort / Team Size: ${input.teamSize}`,
      input.agendaNotes ? `Special Goals / Questions: ${input.agendaNotes}` : null,
    ].filter(Boolean).join("\n");
    const { error: reserveError } = await admin.rpc("reserve_demo_appointment", {
      p_id: bookingId,
      p_full_name: input.fullName,
      p_work_email: input.workEmail,
      p_company_name: input.organizationName,
      p_team_size: input.teamSize,
      p_message: message,
      p_source: input.source,
      p_scheduled_date: input.scheduledDate,
      p_scheduled_time: input.scheduledTime,
      p_org_type: input.orgType,
      p_timezone: input.timezone,
      p_utm_source: input.utmSource || null,
      p_utm_medium: input.utmMedium || null,
      p_utm_campaign: input.utmCampaign || null,
    });
    if (reserveError) {
      if (/DEMO_SLOT_UNAVAILABLE/.test(reserveError.message || "")) {
        return respond(req, { success: false, code: "slot_unavailable", error: "This time was just booked. Please choose another available slot." }, 409);
      }
      throw new Error(`Could not reserve appointment: ${reserveError.message}`);
    }

    let event;
    try {
      event = await createCalendarEvent(input, bookingId);
    } catch (calendarError) {
      await admin.from("demo_requests").delete().eq("id", bookingId);
      bookingId = "";
      throw calendarError;
    }

    const { error: updateError } = await admin.from("demo_requests").update({
      calendar_event_id: event.id,
      calendar_event_url: event.htmlLink,
      meeting_url: event.meetingUrl,
      calendar_status: "created",
      calendar_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", bookingId);
    if (updateError) console.error("Calendar metadata update failed", updateError);

    await Promise.allSettled([
      admin.from("organization_inquiries").insert({
        full_name: input.fullName,
        work_email: input.workEmail,
        company_name: input.organizationName,
        inquiry_type: "demo_request",
        message,
        source: input.source,
        status: "new",
        utm_source: input.utmSource || null,
        utm_medium: input.utmMedium || null,
        utm_campaign: input.utmCampaign || null,
      }),
      sendBackupEmail(input, event),
    ]);

    return respond(req, {
      success: true,
      bookingId,
      meetingUrl: event.meetingUrl,
      calendarEventUrl: event.htmlLink,
      scheduledDate: input.scheduledDate,
      scheduledTime: input.scheduledTime,
    });
  } catch (error) {
    console.error("book-demo-appointment failed", error);
    if (bookingId) await admin.from("demo_requests").delete().eq("id", bookingId);
    const configurationError = /credentials are not configured|Google authentication failed|Google Calendar rejected|without a Google Meet/i.test(String(error));
    return respond(req, {
      success: false,
      error: configurationError
        ? "The calendar service could not create your invitation. No booking was recorded. Please try again shortly or email info@trainailtd.com."
        : "We could not complete this booking. No appointment was recorded. Please try again.",
    }, configurationError ? 503 : 500);
  }
});
