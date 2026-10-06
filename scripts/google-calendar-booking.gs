/**
 * Google Apps Script endpoint used by the Train AI booking Edge Function.
 *
 * Required setup:
 * 1. Add the Calendar advanced service in Apps Script.
 * 2. Set Script Property GOOGLE_BOOKING_SCRIPT_SECRET.
 * 3. Deploy as a Web app, execute as the owner, accessible to anyone.
 * 4. Store its /exec URL and the same secret as Supabase Edge secrets.
 */

const REQUIRED_TEAM_ATTENDEES = [
  "info@sarafoundationafrica.com",
  "trainailtd@gmail.com",
];

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function clean(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength || 500);
}

function doPost(event) {
  try {
    const body = JSON.parse((event && event.postData && event.postData.contents) || "{}");
    const expectedSecret = PropertiesService.getScriptProperties().getProperty("GOOGLE_BOOKING_SCRIPT_SECRET");
    if (!expectedSecret || body.automationSecret !== expectedSecret) {
      return jsonResponse({ success: false, error: "Unauthorized request." });
    }

    const bookingId = clean(body.bookingId, 100);
    const visitorEmail = clean(body.workEmail, 320).toLowerCase();
    const organizationName = clean(body.organizationName, 200);
    if (!bookingId || !visitorEmail || !organizationName || !body.start || !body.end) {
      return jsonResponse({ success: false, error: "Required booking details are missing." });
    }

    const attendeeEmails = [visitorEmail].concat(REQUIRED_TEAM_ATTENDEES)
      .filter(function (email, index, all) { return all.indexOf(email) === index; });
    const title = "Train AI Product Demo: " + organizationName;
    const description = [
      "Train AI 30-minute product demo and institutional consultation.",
      "",
      "Booking reference: " + bookingId,
      "Primary attendee: " + clean(body.fullName, 160) + " <" + visitorEmail + ">",
      "Organisation: " + organizationName,
      "Organisation type: " + clean(body.orgType, 160),
      "Cohort or team size: " + clean(body.teamSize, 100),
      "Visitor timezone: " + clean(body.timezone, 120),
      "Goals or questions: " + (clean(body.agendaNotes, 3000) || "None provided"),
    ].join("\n");

    const calendarId = "primary";
    const eventPayload = {
      summary: title,
      description: description,
      start: { dateTime: body.start, timeZone: "Africa/Lagos" },
      end: { dateTime: body.end, timeZone: "Africa/Lagos" },
      attendees: attendeeEmails.map(function (email) { return { email: email }; }),
      guestsCanInviteOthers: false,
      guestsCanModify: false,
      conferenceData: {
        createRequest: {
          requestId: "trainai-demo-" + bookingId,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
      extendedProperties: { private: { trainAiBookingId: bookingId } },
    };
    const insertUrl = "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(calendarId)
      + "/events?conferenceDataVersion=1&sendUpdates=all";
    const insertResponse = UrlFetchApp.fetch(insertUrl, {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
      payload: JSON.stringify(eventPayload),
      muteHttpExceptions: true,
    });
    const created = JSON.parse(insertResponse.getContentText() || "{}");
    if (insertResponse.getResponseCode() < 200 || insertResponse.getResponseCode() >= 300) {
      return jsonResponse({ success: false, error: (created.error && created.error.message) || "Google Calendar rejected the event." });
    }

    const videoEntry = created.conferenceData && created.conferenceData.entryPoints
      ? created.conferenceData.entryPoints.filter(function (item) { return item.entryPointType === "video"; })[0]
      : null;
    const meetingUrl = created.hangoutLink || (videoEntry && videoEntry.uri);
    if (!created.id || !meetingUrl) {
      if (created.id) {
        UrlFetchApp.fetch("https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(calendarId) + "/events/" + encodeURIComponent(created.id) + "?sendUpdates=none", {
          method: "delete",
          headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
          muteHttpExceptions: true,
        });
      }
      return jsonResponse({ success: false, error: "The calendar event did not produce a Google Meet room." });
    }

    return jsonResponse({
      success: true,
      eventId: created.id,
      htmlLink: created.htmlLink,
      meetingUrl: meetingUrl,
      title: title,
    });
  } catch (error) {
    return jsonResponse({ success: false, error: String(error && error.message ? error.message : error) });
  }
}
