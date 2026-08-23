import React, { useState, useContext, useMemo } from "react";
import { TopBar, ToastContext, Tag, Avatar, Switch } from "../components/PlatformUI.jsx";
import {
  Mail, Send, Users, RefreshCw, Search, X, Eye, FileText, CheckCircle2,
  Layers, GraduationCap, AlertTriangle, ChevronDown,
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { PortalModal } from "../../components/common/PortalModal.jsx";
import {
  fetchEmailCampaigns, sendBroadcastEmail, fetchOrgMembers, fetchCohorts,
  fetchOrgLearnerProgressOverview,
} from "../../lib/api/platform.js";

/**
 * Operations -> Email Center (organization admin).
 *
 * The broadcast pipeline already existed end to end - the
 * `advanced-broadcast-email` edge function, the real `email_campaigns` table,
 * and sendBroadcastEmail / fetchEmailCampaigns in lib/api/platform.js - but
 * the only screen that ever called it was the Platform Owner's EmailsScreen.
 * An organization admin had no way to email their own members at all.
 *
 * One important difference from the Owner screen: the edge function's
 * `recipient_group` values ("all", "active_users", "organizations", ...) are
 * resolved server-side across the WHOLE platform, with no organization
 * scoping. Handing those to an org admin would let them email every user on
 * the platform, which is wrong. So this screen resolves its own audience from
 * real org data (members, roles, cohorts, pace) and sends per recipient via
 * the function's `specific_email` path - which keeps every send inside this
 * organization by construction.
 */

const SEGMENTS = [
  { key: "all", label: "All members", Icon: Users, hint: "Everyone in this organization" },
  { key: "learners", label: "Learners only", Icon: GraduationCap, hint: "Members with the learner role" },
  { key: "instructors", label: "Instructors only", Icon: FileText, hint: "Members with the instructor role" },
  { key: "behind", label: "Learners falling behind", Icon: AlertTriangle, hint: "Anyone flagged behind pace" },
  { key: "cohort", label: "A specific cohort", Icon: Layers, hint: "Pick a cohort below" },
  { key: "custom", label: "Pick individually", Icon: CheckCircle2, hint: "Choose exact recipients" },
];

const TEMPLATES = [
  {
    name: "Welcome / kickoff",
    subject: "Welcome aboard — here's how to get started",
    body: "Hi there,\n\nWelcome to the team's learning workspace. Your first courses are already waiting for you on your dashboard.\n\nStart with anything marked as required, and reach out if you get stuck.\n\nSee you in there.",
  },
  {
    name: "Nudge: falling behind",
    subject: "A quick nudge on your training",
    body: "Hi there,\n\nWe noticed a couple of your assigned courses have slipped behind schedule. No problem — most of them take under an hour.\n\nJump back in whenever you have a window, and let us know if a deadline needs moving.",
  },
  {
    name: "New course announcement",
    subject: "New course just published",
    body: "Hi there,\n\nA new course has just been added to the catalog. It's available on your dashboard now.\n\nWorth a look if it lines up with your track.",
  },
  {
    name: "Deadline reminder",
    subject: "Reminder: a required course is due soon",
    body: "Hi there,\n\nThis is a reminder that one of your mandatory courses is coming up on its due date.\n\nPlease complete it before the deadline so your compliance record stays clear.",
  },
];

function statusTone(status) {
  if (status === "sent") return "success";
  if (status === "failed") return "danger";
  return "warning";
}

// Plain textarea -> minimal HTML, matching what the edge function's template
// expects (it wraps html_content as-is), so paragraph breaks survive instead
// of collapsing into one run-on line.
function toHtml(body) {
  return body
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

export function EmailCenterScreen({ orgId, orgSelector, setScreen, currentUserId }) {
  const showToast = useContext(ToastContext);

  const membersQuery = useSupabaseQuery(async () => (orgId ? fetchOrgMembers(orgId) : []), [orgId]);
  const cohortsQuery = useSupabaseQuery(async () => (orgId ? fetchCohorts(orgId) : []), [orgId]);
  const progressQuery = useSupabaseQuery(async () => (orgId ? fetchOrgLearnerProgressOverview(orgId) : []), [orgId]);
  const campaignsQuery = useSupabaseQuery(async () => fetchEmailCampaigns(currentUserId), [currentUserId]);

  const members = membersQuery.data || [];
  const cohorts = cohortsQuery.data || [];
  const progressRows = progressQuery.data || [];
  const campaigns = campaignsQuery.data || [];

  const [tab, setTab] = useState("compose");
  const [segment, setSegment] = useState("all");
  const [cohortName, setCohortName] = useState("");
  const [customIds, setCustomIds] = useState(new Set());
  const [customSearch, setCustomSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [channels, setChannels] = useState({ email: true, in_app: false, push: false });
  const [sending, setSending] = useState(false);
  const [progressNote, setProgressNote] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const behindIds = useMemo(
    () => new Set(progressRows.filter((r) => r.pace === "behind").map((r) => r.id)),
    [progressRows]
  );

  // Only members with a real email address can actually be sent to - the rest
  // are reported rather than silently dropped from the count.
  const audience = useMemo(() => {
    let rows = members;
    if (segment === "learners") rows = rows.filter((m) => (m.role || "learner") === "learner");
    else if (segment === "instructors") rows = rows.filter((m) => m.role === "mentor");
    else if (segment === "behind") rows = rows.filter((m) => behindIds.has(m.id));
    else if (segment === "cohort") rows = cohortName ? rows.filter((m) => m.cohort_name === cohortName) : [];
    else if (segment === "custom") rows = rows.filter((m) => customIds.has(m.id));
    return rows;
  }, [members, segment, cohortName, customIds, behindIds]);

  const sendable = audience.filter((m) => (m.email || "").includes("@"));
  const missingEmail = audience.length - sendable.length;

  const filteredForPicker = members.filter((m) => {
    const needle = customSearch.trim().toLowerCase();
    return !needle
      || (m.display_name || "").toLowerCase().includes(needle)
      || (m.email || "").toLowerCase().includes(needle);
  });

  const canSend = subject.trim() && body.trim() && sendable.length > 0 && !sending;

  function applyTemplate(t) {
    setSubject(t.subject);
    setBody(t.body);
    showToast(`"${t.name}" loaded into the composer.`);
  }

  async function handleSend() {
    if (!canSend) return;
    if (!window.confirm(`Send "${subject.trim()}" to ${sendable.length} recipient${sendable.length === 1 ? "" : "s"}?`)) return;
    setSending(true);
    setLastResult(null);
    const htmlContent = toHtml(body);
    let sent = 0;
    const failed = [];
    for (let i = 0; i < sendable.length; i++) {
      const member = sendable[i];
      setProgressNote(`Sending ${i + 1} of ${sendable.length}...`);
      try {
        await sendBroadcastEmail({
          recipientGroup: "specific_email",
          specificEmail: member.email,
          subject: subject.trim(),
          htmlContent,
          channels,
        });
        sent++;
      } catch (e) {
        failed.push({ email: member.email, reason: e?.message || "Send failed" });
      }
    }
    setSending(false);
    setProgressNote(null);
    setLastResult({ sent, failed });
    campaignsQuery.refetch();
    showToast(`${sent} of ${sendable.length} email${sendable.length === 1 ? "" : "s"} sent${failed.length ? `, ${failed.length} failed` : ""}.`);
    if (!failed.length) { setSubject(""); setBody(""); }
  }

  return (
    <div className="ta-fade">
      <TopBar
        title="Email Center"
        sub="Send announcements and nudges to your organization's members"
        orgSelector={orgSelector}
        onNavigate={setScreen}
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* =========================================================================
            EMAIL CENTER & BROADCASTS HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner anim-fluid-entrance">
          <div className="tai-glow-cyan" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">
                Email Center &amp; Broadcasts
              </h1>
              <p className="ta-hero-desc">
                Send targeted announcements, automated milestone reminders, and batch nudges to your organization learners.
              </p>
            </div>

            <div className="ta-hero-actions">
              <button
                className="ta-btn ta-btn-outline"
                style={{
                  height: 36,
                  padding: "0 14px",
                  borderRadius: 8,
                  fontSize: 12.5,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}
                onClick={() => campaignsQuery.refetch()}
              >
                <RefreshCw size={13} /> Refresh History
              </button>
            </div>
          </div>
        </div>

        <div className="ta-tabs">
          {[
            { k: "compose", label: "Compose" },
            { k: "templates", label: `Templates (${TEMPLATES.length})` },
            { k: "history", label: `History (${campaigns.length})` },
          ].map((t) => (
            <div key={t.k} className={`ta-tab ${tab === t.k ? "active" : ""}`} onClick={() => setTab(t.k)}>{t.label}</div>
          ))}
        </div>

        {tab === "compose" && (
          <>
            {/* ---- Audience ---- */}
            <div className="ta-card" style={{ borderRadius: 10 }}>
              <div className="ta-row ta-gap8">
                <Users size={17} color="var(--primary)" />
                <div style={{ fontWeight: 800, fontSize: 15 }}>Who receives this</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                Every option here is resolved from your own organization's members, so a send can never
                reach anyone outside this workspace.
              </div>

              <div className="ta-grid ta-grid-3 ta-gap8 ta-mt12">
                {SEGMENTS.map((s) => {
                  const Icon = s.Icon;
                  const active = segment === s.key;
                  return (
                    <div
                      key={s.key}
                      onClick={() => setSegment(s.key)}
                      className="ta-card ta-card-hover"
                      style={{
                        padding: "11px 13px", borderRadius: 10, cursor: "pointer",
                        border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                        background: active ? "var(--primary-tint)" : "var(--surface)",
                      }}
                    >
                      <div className="ta-row ta-gap8" style={{ color: active ? "var(--primary)" : "var(--text)" }}>
                        <Icon size={14} />
                        <span style={{ fontSize: 12.5, fontWeight: 700 }}>{s.label}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>{s.hint}</div>
                    </div>
                  );
                })}
              </div>

              {segment === "cohort" && (
                <select className="ta-input ta-mt12" style={{ width: "100%", boxSizing: "border-box" }} value={cohortName} onChange={(e) => setCohortName(e.target.value)}>
                  <option value="">Choose a cohort...</option>
                  {cohorts.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              )}

              {segment === "custom" && (
                <div className="ta-mt12">
                  <div className="ta-search">
                    <Search size={14} />
                    <input
                      className="ta-input" style={{ border: "none", padding: 0, width: "100%" }}
                      placeholder="Search members..." value={customSearch} onChange={(e) => setCustomSearch(e.target.value)}
                    />
                  </div>
                  <div className="ta-col ta-gap6 ta-mt10" style={{ maxHeight: 240, overflowY: "auto" }}>
                    {membersQuery.loading && <div className="ta-empty">Loading members...</div>}
                    {!membersQuery.loading && filteredForPicker.length === 0 && <div className="ta-empty">No members found.</div>}
                    {filteredForPicker.map((m) => (
                      <label key={m.id} className="ta-row ta-gap10" style={{ padding: "7px 10px", background: "var(--surface-2)", borderRadius: 8, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={customIds.has(m.id)}
                          onChange={(e) => {
                            const next = new Set(customIds);
                            if (e.target.checked) next.add(m.id); else next.delete(m.id);
                            setCustomIds(next);
                          }}
                        />
                        <Avatar initials={(m.display_name || "U").slice(0, 2).toUpperCase()} size={26} src={m.avatar_url || undefined} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, overflowWrap: "anywhere" }}>{m.display_name || "Member"}</div>
                          <div style={{ fontSize: 11, color: "var(--text-3)", overflowWrap: "anywhere" }}>{m.email || "No email on file"}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="ta-row ta-gap10 ta-mt12" style={{ flexWrap: "wrap", padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                  {membersQuery.loading ? "Counting..." : `${sendable.length} recipient${sendable.length === 1 ? "" : "s"}`}
                </span>
                {missingEmail > 0 && (
                  <span style={{ fontSize: 11.5, color: "var(--warning)" }}>
                    {missingEmail} member{missingEmail === 1 ? "" : "s"} skipped — no email address on file
                  </span>
                )}
                {sendable.length > 0 && (
                  <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => setPreviewOpen(true)} style={{ marginLeft: "auto" }}>
                    <Eye size={13} /> See the list
                  </button>
                )}
              </div>
            </div>

            {/* ---- Message ---- */}
            <div className="ta-card" style={{ borderRadius: 10 }}>
              <div className="ta-row ta-gap8">
                <Mail size={17} color="var(--primary)" />
                <div style={{ fontWeight: 800, fontSize: 15 }}>Message</div>
              </div>

              <div className="ta-label ta-mt12">Subject</div>
              <input
                className="ta-input ta-mt6" style={{ width: "100%", boxSizing: "border-box" }}
                placeholder="Subject line..." value={subject} onChange={(e) => setSubject(e.target.value)}
              />

              <div className="ta-label ta-mt12">Body</div>
              <textarea
                className="ta-input ta-mt6" rows={8} style={{ width: "100%", boxSizing: "border-box" }}
                placeholder={"Write your message. Leave a blank line between paragraphs."}
                value={body} onChange={(e) => setBody(e.target.value)}
              />

              <div className="ta-label ta-mt12">Delivery channels</div>
              <div className="ta-col ta-gap8 ta-mt6">
                {[
                  { key: "email", label: "Email", hint: "Sent through the broadcast function" },
                  { key: "in_app", label: "In-app notification", hint: "Appears in their notification bell" },
                  { key: "push", label: "Push notification", hint: "Only reaches members who enabled push" },
                ].map((c) => (
                  <div key={c.key} className="ta-row ta-between" style={{ gap: 10, padding: "8px 10px", background: "var(--surface-2)", borderRadius: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700 }}>{c.label}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>{c.hint}</div>
                    </div>
                    <Switch on={!!channels[c.key]} onChange={() => setChannels((p) => ({ ...p, [c.key]: !p[c.key] }))} />
                  </div>
                ))}
              </div>

              {progressNote && (
                <div className="ta-mt12" style={{ fontSize: 12.5, color: "var(--primary)", fontWeight: 700 }}>{progressNote}</div>
              )}

              {lastResult && (
                <div className="ta-mt12" style={{ padding: "10px 12px", background: lastResult.failed.length ? "var(--warning-bg)" : "var(--success-bg)", color: lastResult.failed.length ? "var(--warning)" : "var(--success)", borderRadius: 8, fontSize: 12.5 }}>
                  {lastResult.sent} sent{lastResult.failed.length ? ` • ${lastResult.failed.length} failed (${lastResult.failed.slice(0, 3).map((f) => f.email).join(", ")}${lastResult.failed.length > 3 ? "..." : ""})` : " — all delivered to the mail service"}
                </div>
              )}

              <button className="ta-btn ta-btn-primary ta-mt16" disabled={!canSend} onClick={handleSend}>
                <Send size={15} /> {sending ? "Sending..." : `Send to ${sendable.length} recipient${sendable.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </>
        )}

        {tab === "templates" && (
          <div className="ta-col ta-gap12">
            <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
              Starting points you can edit before sending. Picking one drops it into the composer.
            </div>
            {TEMPLATES.map((t) => (
              <div key={t.name} className="ta-card" style={{ borderRadius: 10 }}>
                <div className="ta-row ta-between" style={{ gap: 10, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{t.name}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 3 }}>{t.subject}</div>
                  </div>
                  <button className="ta-btn ta-btn-primary ta-btn-sm" onClick={() => { applyTemplate(t); setTab("compose"); }}>
                    Use template
                  </button>
                </div>
                <div className="ta-mt10" style={{ fontSize: 12, color: "var(--text-3)", whiteSpace: "pre-wrap", background: "var(--surface-2)", borderRadius: 8, padding: 12 }}>
                  {t.body}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "history" && (
          <div className="ta-card" style={{ borderRadius: 10 }}>
            <div style={{ fontSize: 12.5, color: "var(--text-2)", marginBottom: 12 }}>
              Real rows from the email_campaigns table, newest first. Open and click counts come from the
              mail provider's webhooks, so they fill in after delivery rather than immediately.
            </div>
            <div className="ta-table-wrap">
              <table className="ta-table">
                <thead><tr><th>Subject</th><th>Audience</th><th>Sent</th><th>Opens</th><th>Clicks</th><th>Status</th><th>When</th></tr></thead>
                <tbody>
                  {campaignsQuery.loading && <tr><td colSpan={7} className="ta-empty">Loading campaign history...</td></tr>}
                  {!campaignsQuery.loading && campaigns.length === 0 && <tr><td colSpan={7} className="ta-empty">Nothing sent yet.</td></tr>}
                  {campaigns.map((c) => (
                    <tr key={c.id}>
                      <td style={{ overflowWrap: "anywhere" }}>{c.subject || "Untitled"}</td>
                      <td>{(c.recipient_group || "").replace(/_/g, " ") || "N/A"}</td>
                      <td>{c.sent_count ?? 0}</td>
                      <td>{c.open_count ?? 0}</td>
                      <td>{c.click_count ?? 0}</td>
                      <td><Tag tone={statusTone(c.status)}>{c.status || "pending"}</Tag></td>
                      <td>{c.sent_at ? new Date(c.sent_at).toLocaleString() : "Not sent"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <PortalModal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth={520} zIndex={9999}>
        <div className="ta-row ta-between">
          <div className="ta-title" style={{ fontSize: 17 }}>{sendable.length} recipient{sendable.length === 1 ? "" : "s"}</div>
          <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => setPreviewOpen(false)}><X size={16} /></button>
        </div>
        <div className="ta-col ta-gap6 ta-mt12" style={{ maxHeight: 340, overflowY: "auto" }}>
          {sendable.map((m) => (
            <div key={m.id} className="ta-row ta-between" style={{ gap: 10, padding: "7px 10px", background: "var(--surface-2)", borderRadius: 8, fontSize: 12.5 }}>
              <span style={{ overflowWrap: "anywhere" }}>{m.display_name || "Member"}</span>
              <span style={{ color: "var(--text-3)", overflowWrap: "anywhere" }}>{m.email}</span>
            </div>
          ))}
        </div>
      </PortalModal>
    </div>
  );
}

export default EmailCenterScreen;
