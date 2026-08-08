import React, { useState, useContext } from "react";
import { TopBar, ToastContext } from "../components/PlatformUI.jsx";
import { Mail, Send, Users, RefreshCw } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchEmailCampaigns, previewBroadcastRecipientCount, sendBroadcastEmail } from "../../lib/api/platform.js";

// Recipient groups match the live "advanced-broadcast-email" edge function's
// `recipient_group` enum exactly (see supabase/functions/advanced-broadcast-email/index.ts
// in the reference app) - the function itself resolves each group server-side
// against auth.users + user_roles + mentorship_sessions / referral_signups /
// sara_foundation_emails, so there is no client-side membership logic here.
const RECIPIENT_GROUPS = [
  { value: "all", label: "All users" },
  { value: "active_users", label: "Active users (last 30 days)" },
  { value: "inactive_users", label: "Inactive users (30+ days)" },
  { value: "active_mentors", label: "Active instructors" },
  { value: "inactive_mentors", label: "Inactive instructors" },
  { value: "organizations", label: "Organization admins" },
  { value: "referral_signups", label: "Referral sign-ups" },
  { value: "sara_foundation", label: "Sara Foundation Africa (partner org)" },
  { value: "specific_email", label: "Specific email address..." },
];

function statusColor(status) {
  if (status === "sent") return { bg: "var(--success-bg)", fg: "var(--success)" };
  if (status === "failed") return { bg: "var(--danger-bg)", fg: "var(--danger)" };
  return { bg: "var(--warning-bg)", fg: "var(--warning)" };
}

export function EmailsScreen() {
  const showToast = useContext(ToastContext);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientGroup, setRecipientGroup] = useState("all");
  const [specificEmail, setSpecificEmail] = useState("");
  const [channels, setChannels] = useState({ email: true, in_app: false, push: false });
  const [previewCount, setPreviewCount] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const campaignsQuery = useSupabaseQuery(async () => fetchEmailCampaigns(), []);
  const campaigns = campaignsQuery.data || [];

  const needsSpecificEmail = recipientGroup === "specific_email";
  const canSend = subject.trim() && body.trim() && (!needsSpecificEmail || specificEmail.trim());

  async function handlePreview() {
    setPreviewing(true);
    setPreviewCount(null);
    try {
      const count = await previewBroadcastRecipientCount({ recipientGroup, specificEmail: specificEmail.trim() });
      setPreviewCount(count);
    } catch (e) {
      showToast(e?.message || "Could not check recipient count.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSend() {
    setSending(true);
    try {
      // Plain textarea input -> minimal HTML so the edge function's email
      // template (which wraps html_content as-is inside its <div class="content">)
      // renders paragraph breaks instead of one run-on line.
      const htmlContent = body
        .trim()
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
        .join("");
      const result = await sendBroadcastEmail({
        recipientGroup,
        specificEmail: specificEmail.trim(),
        subject: subject.trim(),
        htmlContent,
        channels,
      });
      setLastResult(result);
      setSubject("");
      setBody("");
      setPreviewCount(null);
      campaignsQuery.refetch();
      showToast(`Broadcast sent: ${result?.email_sent ?? 0} of ${result?.total_recipients ?? 0} recipient(s) emailed.`);
    } catch (e) {
      showToast(e?.message || "Broadcast failed. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="ta-fade">
      <TopBar title="Platform Emails" sub="System notifications & email broadcasts" />
      <div className="ta-content">
        <div className="ta-card" style={{ maxWidth: 640 }}>
          <div className="ta-title">Send Broadcast Email</div>
          <input className="ta-input ta-mt12" placeholder="Email subject line..." value={subject} onChange={(e) => setSubject(e.target.value)} />
          <textarea className="ta-input ta-mt12" rows={5} placeholder="Email content body..." value={body} onChange={(e) => setBody(e.target.value)} />

          <div className="ta-row ta-gap10 ta-mt12" style={{ flexWrap: "wrap" }}>
            <select
              className="ta-input"
              style={{ flex: 1, minWidth: 220 }}
              value={recipientGroup}
              onChange={(e) => { setRecipientGroup(e.target.value); setPreviewCount(null); }}
            >
              {RECIPIENT_GROUPS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
            {needsSpecificEmail && (
              <input
                className="ta-input"
                style={{ flex: 1, minWidth: 220 }}
                placeholder="name@example.com"
                value={specificEmail}
                onChange={(e) => { setSpecificEmail(e.target.value); setPreviewCount(null); }}
              />
            )}
          </div>

          <div className="ta-row ta-gap16 ta-mt12" style={{ flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-2)" }}>
              <input type="checkbox" checked readOnly disabled /> Email
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-2)" }}>
              <input type="checkbox" checked={channels.in_app} onChange={(e) => setChannels((c) => ({ ...c, in_app: e.target.checked }))} /> In-app notification
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-2)" }}>
              <input type="checkbox" checked={channels.push} onChange={(e) => setChannels((c) => ({ ...c, push: e.target.checked }))} /> Push notification
            </label>
          </div>

          <div className="ta-row ta-gap10 ta-mt12">
            <button className="ta-btn ta-btn-ghost ta-btn-sm" disabled={previewing} onClick={handlePreview}>
              <Users size={14} /> {previewing ? "Checking..." : "Preview recipient count"}
            </button>
            {previewCount !== null && (
              <span style={{ fontSize: 12.5, color: "var(--text-2)", fontWeight: 600 }}>{previewCount} recipient(s)</span>
            )}
          </div>

          <button className="ta-btn ta-btn-primary ta-mt12" disabled={!canSend || sending} onClick={handleSend}>
            <Send size={15} /> {sending ? "Sending..." : "Broadcast email"}
          </button>

          {lastResult && (
            <div className="ta-card ta-mt12" style={{ background: "var(--surface-2)", padding: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>Last broadcast result</div>
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                {lastResult.email_sent ?? 0} emailed · {lastResult.in_app_sent ?? 0} in-app · {lastResult.push_sent ?? 0} push queued · {lastResult.failed ?? 0} failed (of {lastResult.total_recipients ?? 0} total)
              </div>
            </div>
          )}
        </div>

        <div className="ta-card ta-mt16">
          <div className="ta-row ta-between">
            <div className="ta-row ta-gap8">
              <Mail size={16} color="var(--primary)" />
              <div className="ta-title">Campaign History</div>
            </div>
            <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => campaignsQuery.refetch()}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          {campaignsQuery.loading && <div className="ta-mt12" style={{ fontSize: 12.5, color: "var(--text-2)" }}>Loading...</div>}
          {!campaignsQuery.loading && campaigns.length === 0 && (
            <div className="ta-mt12" style={{ fontSize: 12.5, color: "var(--text-2)" }}>No broadcasts sent yet.</div>
          )}
          {campaigns.map((c) => {
            const colors = statusColor(c.status);
            return (
              <div key={c.id} className="ta-row ta-between ta-mt12" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{c.subject}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 2 }}>
                    {c.recipient_group} · {c.sent_count ?? 0}/{c.recipient_count ?? 0} sent · {c.open_count ?? 0} opened
                    {c.sent_at ? ` · ${new Date(c.sent_at).toLocaleString()}` : ""}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: colors.bg, color: colors.fg, flexShrink: 0 }}>
                  {c.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
