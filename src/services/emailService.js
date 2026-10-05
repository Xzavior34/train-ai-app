// Train AI - Transactional Email & Password Recovery Service
// Exclusively uses Resend API with domain trainailtd.com

export const CANONICAL_DOMAIN = "https://trainailtd.com";
export const SUPPORT_EMAIL = "info@trainailtd.com";

/**
 * Returns the active Resend API key from environment variables.
 */
export function getResendApiKey() {
  const envKey = (
    (typeof import.meta !== "undefined" && import.meta.env && (import.meta.env.VITE_RESEND_API_KEY || import.meta.env.RESEND_API_KEY)) ||
    (typeof process !== "undefined" && process.env && (process.env.VITE_RESEND_API_KEY || process.env.RESEND_API_KEY)) ||
    ""
  ).trim();

  return envKey;
}

/**
 * Returns the active canonical domain for links & redirects.
 * In local development, respects window.location.origin; in production, defaults to https://trainailtd.com.
 */
export function getCanonicalDomain() {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local")) {
      return window.location.origin;
    }
  }
  return CANONICAL_DOMAIN;
}

/**
 * Dispatches a password reset email via Resend directly from client if API key is provided.
 */
export async function sendPasswordResetViaResendDirect({ email, resetUrl, otpCode }) {
  const apiKey = getResendApiKey();

  if (!apiKey) return { success: false, reason: "NO_CLIENT_KEY" };


  try {
    const fromEmail = "Train AI <info@trainailtd.com>";
    const html = `
      <div style="background-color: #0b0f19; font-family: sans-serif; color: #f1f5f9; padding: 40px 20px;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 32px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 24px; font-weight: 800; color: #ffffff;">TRAIN<span style="color: #3b82f6;">AI</span></span>
          </div>
          <h2 style="font-size: 18px; color: #ffffff; text-align: center; margin-bottom: 16px;">Reset Your Password</h2>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.5; text-align: center;">
            We received a request to reset your Train AI password for <strong>${email}</strong>.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">
              Reset Password
            </a>
          </div>
          ${otpCode ? `
            <div style="background-color: #1e293b; border-radius: 8px; padding: 14px; text-align: center; margin: 20px 0;">
              <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Or use verification code</div>
              <div style="font-size: 24px; font-weight: 800; color: #60a5fa; letter-spacing: 0.15em; font-family: monospace; margin-top: 4px;">${otpCode}</div>
            </div>
          ` : ''}
          <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 24px;">
            This link is valid for 60 minutes. If you did not request this, please ignore this email.
          </p>
          <div style="border-top: 1px solid #1f2937; padding-top: 16px; margin-top: 24px; text-align: center; font-size: 11px; color: #475569;">
            Train AI LTD &bull; trainailtd.com &bull; ${SUPPORT_EMAIL}
          </div>
        </div>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: "Reset your Train AI password",
        html,
        text: `Reset your Train AI password: ${resetUrl} (OTP: ${otpCode || ''})`
      })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.id) {
      return { success: true, messageId: data.id };
    }
    return { success: false, error: data?.message || "Resend failed" };
  } catch (err) {
    return { success: false, error: err?.message };
  }
}

/**
 * Dispatches an organization invitation email via Resend directly from client if API key is provided.
 */
export async function sendInvitationViaResendDirect({ email, orgName, role, inviteUrl }) {
  const apiKey = getResendApiKey();

  if (!apiKey) return { success: false, reason: "NO_CLIENT_KEY" };

  try {
    const fromEmail = "Train AI <info@trainailtd.com>";
    const formattedRole = role ? role.charAt(0).toUpperCase() + role.slice(1) : "Learner";
    const html = `
      <div style="background-color: #0b0f19; font-family: sans-serif; color: #f1f5f9; padding: 40px 20px;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 32px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 24px; font-weight: 800; color: #ffffff;">TRAIN<span style="color: #3b82f6;">AI</span></span>
          </div>
          <h2 style="font-size: 18px; color: #ffffff; text-align: center; margin-bottom: 16px;">You're Invited to Join ${orgName || "Train AI"}</h2>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.5; text-align: center;">
            You have been invited to join <strong>${orgName || "Train AI"}</strong> on the Train AI platform as a <strong>${formattedRole}</strong>.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${inviteUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          <div style="background-color: #1e293b; border-radius: 8px; padding: 12px; margin: 20px 0; word-break: break-all; font-family: monospace; font-size: 12px; color: #60a5fa;">
            ${inviteUrl}
          </div>
          <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 24px;">
            This invitation link is valid for 7 days.
          </p>
          <div style="border-top: 1px solid #1f2937; padding-top: 16px; margin-top: 24px; text-align: center; font-size: 11px; color: #475569;">
            Train AI LTD &bull; trainailtd.com &bull; ${SUPPORT_EMAIL}
          </div>
        </div>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: `Invitation to join ${orgName || "Train AI"} on Train AI`,
        html,
        text: `You have been invited to join ${orgName || "Train AI"} on Train AI as a ${role}.\n\nAccept your invitation: ${inviteUrl}\n\nValid for 7 days.\n\nTrain AI LTD - info@trainailtd.com`
      })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.id) {
      return { success: true, messageId: data.id };
    }
    return { success: false, error: data?.message || "Resend failed" };
  } catch (err) {
    return { success: false, error: err?.message };
  }
}

/**
 * Dispatches a demo booking confirmation and team notification via Resend.
 */
export async function sendDemoBookingNotificationViaResend({ fullName, workEmail, companyName, teamSize, scheduledDate, scheduledTime, timezone, message }) {
  const apiKey = getResendApiKey();

  if (!apiKey) return { success: false, reason: "NO_CLIENT_KEY" };

  try {
    const fromEmail = "Train AI <info@trainailtd.com>";
    const html = `
      <div style="background-color: #0b0f19; font-family: sans-serif; color: #f1f5f9; padding: 40px 20px;">
        <div style="max-width: 540px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 32px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 24px; font-weight: 800; color: #ffffff;">TRAIN<span style="color: #3b82f6;">AI</span></span>
          </div>
          <h2 style="font-size: 18px; color: #ffffff; text-align: center; margin-bottom: 16px;">New Demo Scheduled: ${fullName}</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13.5px; color: #cbd5e1;">
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #1f2937; font-weight: 700;">Name</td><td style="padding: 8px 0; border-bottom: 1px solid #1f2937;">${fullName}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #1f2937; font-weight: 700;">Work Email</td><td style="padding: 8px 0; border-bottom: 1px solid #1f2937;"><a href="mailto:${workEmail}" style="color: #60a5fa;">${workEmail}</a></td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #1f2937; font-weight: 700;">Organization</td><td style="padding: 8px 0; border-bottom: 1px solid #1f2937;">${companyName}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #1f2937; font-weight: 700;">Team Size</td><td style="padding: 8px 0; border-bottom: 1px solid #1f2937;">${teamSize || "Not specified"}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #1f2937; font-weight: 700;">Scheduled Time</td><td style="padding: 8px 0; border-bottom: 1px solid #1f2937; color: #38bdf8; font-weight: 700;">${scheduledDate || "N/A"} at ${scheduledTime || "N/A"} (${timezone || "UTC"})</td></tr>
          </table>
          ${message ? `
            <div style="background-color: #1e293b; border-radius: 8px; padding: 14px; margin: 20px 0; font-size: 12.5px; color: #cbd5e1; white-space: pre-wrap;">
              ${message}
            </div>
          ` : ''}
          <div style="border-top: 1px solid #1f2937; padding-top: 16px; margin-top: 24px; text-align: center; font-size: 11px; color: #475569;">
            Train AI LTD &bull; trainailtd.com &bull; ${SUPPORT_EMAIL}
          </div>
        </div>
      </div>
    `;

    // Send notifications to both info@trainailtd.com and info@sarafoundationafrica.com
    await Promise.allSettled([
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromEmail,
          to: ["info@trainailtd.com"],
          subject: `New Demo Scheduled: ${fullName} (${companyName})`,
          html,
          text: `New Demo Scheduled: ${fullName} (${companyName})\nEmail: ${workEmail}\nDate: ${scheduledDate} at ${scheduledTime} (${timezone})\n\nTrain AI`
        })
      }),
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromEmail,
          to: ["info@sarafoundationafrica.com"],
          subject: `New Demo Scheduled: ${fullName} (${companyName})`,
          html,
          text: `New Demo Scheduled: ${fullName} (${companyName})\nEmail: ${workEmail}\nDate: ${scheduledDate} at ${scheduledTime} (${timezone})\n\nSara Foundation / Train AI`
        })
      }),
      // Also send confirmation to the attendee
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromEmail,
          to: [workEmail],
          subject: `Your Train AI Demo is Confirmed (${scheduledDate} at ${scheduledTime})`,
          html: `
            <div style="background-color: #0b0f19; font-family: sans-serif; color: #f1f5f9; padding: 40px 20px;">
              <div style="max-width: 500px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 32px;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <span style="font-size: 24px; font-weight: 800; color: #ffffff;">TRAIN<span style="color: #3b82f6;">AI</span></span>
                </div>
                <h2 style="font-size: 18px; color: #ffffff; text-align: center; margin-bottom: 16px;">Your Demo is Confirmed</h2>
                <p style="color: #94a3b8; font-size: 14px; line-height: 1.5; text-align: center;">
                  Hello ${fullName}, your 30-minute institutional walkthrough with Train AI is scheduled for:
                </p>
                <div style="background-color: #1e293b; border-radius: 8px; padding: 14px; text-align: center; margin: 20px 0;">
                  <div style="font-size: 15px; font-weight: 700; color: #60a5fa;">${scheduledDate} at ${scheduledTime} (${timezone})</div>
                  <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Format: Google Meet (Video Conference)</div>
                </div>
                <p style="font-size: 12px; color: #64748b; text-align: center;">
                  A calendar invite with the video link has been prepared. If you need to reschedule, reply to this email.
                </p>
                <div style="border-top: 1px solid #1f2937; padding-top: 16px; margin-top: 24px; text-align: center; font-size: 11px; color: #475569;">
                  Train AI LTD &bull; trainailtd.com &bull; ${SUPPORT_EMAIL}
                </div>
              </div>
            </div>
          `,
          text: `Hello ${fullName},\n\nYour 30-minute demo with Train AI is confirmed for ${scheduledDate} at ${scheduledTime} (${timezone}).\n\nTrain AI LTD - info@trainailtd.com`
        })
      })
    ]);

    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message };
  }
}

/**
 * Dispatches a 2.0 Migration & Password Setup email via Resend for legacy users.
 */
export async function sendMigrationPasswordResetViaResend({ email, displayName, resetUrl }) {
  const apiKey = getResendApiKey();


  const domain = getCanonicalDomain();
  const url = resetUrl || `${domain}/?view=auth&recovery=1&email=${encodeURIComponent(email)}`;
  const name = displayName || email.split("@")[0];

  if (!apiKey) {
    // If client key is not set, log and return link for manual sharing
    console.info(`[Train AI 2.0 Migration] Password reset link for ${email}: ${url}`);
    return { success: true, viaResend: false, resetUrl: url };
  }

  try {
    const fromEmail = "Train AI <info@trainailtd.com>";
    const html = `
      <div style="background-color: #0b0f19; font-family: sans-serif; color: #f1f5f9; padding: 40px 20px;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 32px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 24px; font-weight: 800; color: #ffffff;">TRAIN<span style="color: #3b82f6;">AI</span> <span style="font-size: 14px; background: #2563eb; color: #fff; padding: 2px 8px; border-radius: 4px; margin-left: 6px;">2.0</span></span>
          </div>
          <h2 style="font-size: 18px; color: #ffffff; text-align: center; margin-bottom: 16px;">Welcome to Train AI 2.0</h2>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.5; text-align: center;">
            Hello <strong>${name}</strong>,<br/>
            Your account has been upgraded to the new Train AI 2.0 platform. To access your learning cohort, courses, and AI coach, please set your password below.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${url}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">
              Set Up Your 2.0 Password
            </a>
          </div>
          <div style="background-color: #1e293b; border-radius: 8px; padding: 12px; margin: 20px 0; word-break: break-all; font-family: monospace; font-size: 12px; color: #60a5fa; text-align: center;">
            ${url}
          </div>
          <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 24px;">
            If you have any questions or require assistance, our team is available at ${SUPPORT_EMAIL}.
          </p>
          <div style="border-top: 1px solid #1f2937; padding-top: 16px; margin-top: 24px; text-align: center; font-size: 11px; color: #475569;">
            Train AI LTD &bull; trainailtd.com &bull; ${SUPPORT_EMAIL}
          </div>
        </div>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: "Welcome to Train AI 2.0 - Set your new password",
        html,
        text: `Hello ${name},\n\nYour account has been upgraded to Train AI 2.0. Set your password to get started:\n${url}\n\nTrain AI LTD - ${SUPPORT_EMAIL}`
      })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.id) {
      return { success: true, messageId: data.id, viaResend: true, resetUrl: url };
    }
    return { success: true, viaResend: false, resetUrl: url, error: data?.message };
  } catch (err) {
    return { success: true, viaResend: false, resetUrl: url, error: err?.message };
  }
}

