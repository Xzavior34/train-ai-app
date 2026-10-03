// Train AI - Transactional Email & Password Recovery Service
// Exclusively uses Resend API with domain trainailtd.com

export const CANONICAL_DOMAIN = "https://trainailtd.com";
export const SUPPORT_EMAIL = "info@trainailtd.com";

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
  const apiKey = (
    (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_RESEND_API_KEY) ||
    (typeof process !== "undefined" && process.env && process.env.VITE_RESEND_API_KEY) ||
    ""
  ).trim();

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
  const apiKey = (
    (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_RESEND_API_KEY) ||
    (typeof process !== "undefined" && process.env && process.env.VITE_RESEND_API_KEY) ||
    ""
  ).trim();

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
