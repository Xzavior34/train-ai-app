import React, { useState, useContext } from "react";
import { TopBar, Tag, ToastContext } from "../components/PlatformUI.jsx";
import { LifeBuoy } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchAllSupportTickets, fetchSupportTicketMessages, replyToSupportTicket, updateSupportTicketStatus, fetchFeedbackQueue } from "../../lib/api/platform.js";

const STATUS_OPTIONS = ["open", "in_progress", "resolved", "closed"];

// Platform Owner side of the Support Queue - PRD "Platform Owner Support
// System": "View support tickets, respond, change status, track
// organization, maintain support history." See 0122_support_tickets.sql
// for the real cross-org visibility (Platform Owner only) and the
// internal-note privacy rule, both verified with real Postgres tests.
export function SupportQueueScreen({ currentUserId }) {
  const showToast = useContext(ToastContext);
  const ticketsQuery = useSupabaseQuery(async () => fetchAllSupportTickets(), []);
  // General Feedback - confirmed directly against the real 1.0 reference
  // codebase (FeedbackSection.tsx / AdminFeedbackManagement.tsx). A real,
  // already-existing table and read function (fetchFeedbackQueue) with
  // no screen anywhere that ever called it - a genuinely different,
  // simpler mechanism from ticket-based support (a one-shot rating +
  // message, not a back-and-forth conversation), so it gets its own card
  // on this same screen rather than being folded into the ticket list.
  const feedbackQuery = useSupabaseQuery(async () => fetchFeedbackQueue(), []);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const messagesQuery = useSupabaseQuery(async () => (selectedTicketId ? fetchSupportTicketMessages(selectedTicketId) : []), [selectedTicketId]);
  const [replyText, setReplyText] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const tickets = ticketsQuery.data || [];
  const selectedTicket = tickets.find((t) => t.id === selectedTicketId);
  const openCount = tickets.filter((t) => t.status === "open").length;

  async function handleReply() {
    if (!replyText.trim() || !selectedTicketId) return;
    const result = await replyToSupportTicket(selectedTicketId, currentUserId, replyText, isInternal);
    if (!result.success) showToast(result.error || "Could not send reply.");
    else { setReplyText(""); messagesQuery.refetch(); }
  }

  async function handleStatusChange(ticketId, status) {
    const result = await updateSupportTicketStatus(ticketId, status);
    if (!result.success) showToast(result.error || "Could not update status.");
    else ticketsQuery.refetch();
  }

  return (
    <div className="ta-fade">
      <TopBar title="Support Queue" sub={`Every organization's support requests, in one place - ${openCount} open`} />
      <div className="ta-content">
        <div className="ta-row ta-gap16" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
          <div className="ta-card" style={{ flex: 1, minWidth: "min(320px, 100%)", borderRadius: 10 }}>
            <div className="ta-title">All tickets ({tickets.length})</div>
            <div className="ta-col ta-gap8 ta-mt12">
              {ticketsQuery.loading && <div className="ta-empty">Loading tickets...</div>}
              {!ticketsQuery.loading && tickets.length === 0 && <div className="ta-empty">No support tickets yet.</div>}
              {tickets.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTicketId(t.id)}
                  style={{ cursor: "pointer", padding: "10px 12px", borderRadius: 8, background: selectedTicketId === t.id ? "var(--primary-tint, #EFF6FF)" : "var(--surface-2)", transition: "background .15s ease" }}
                >
                  <div className="ta-row ta-between" style={{ gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, minWidth: 0, wordBreak: "break-word", lineHeight: 1.35, flex: "1 1 auto" }}>{t.subject}</span>
                    <Tag tone={t.status === "resolved" || t.status === "closed" ? "success" : t.status === "in_progress" ? "warning" : "danger"}>{t.status.replace("_", " ")}</Tag>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{t.organizations?.name || "Unknown org"} - {new Date(t.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          </div>

          {selectedTicket && (
            <div className="ta-card ta-fade" style={{ flex: 1, minWidth: "min(340px, 100%)", borderRadius: 10 }}>
              <div className="ta-row ta-between" style={{ gap: 10, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, wordBreak: "break-word" }}>{selectedTicket.subject}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>{selectedTicket.organizations?.name} - {selectedTicket.priority}</div>
                </div>
                <select className="ta-input" style={{ width: 130, flexShrink: 0 }} value={selectedTicket.status} onChange={(e) => handleStatusChange(selectedTicket.id, e.target.value)}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </div>
              <div style={{ fontSize: 12.5, marginTop: 10, padding: 10, background: "var(--surface-2)", borderRadius: 8 }}>{selectedTicket.description}</div>

              <div className="ta-col ta-gap8 ta-mt12 anim-stagger">
                {(messagesQuery.data || []).map((m) => (
                  <div
                    key={m.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: m.is_internal_note ? "var(--warning-bg, #FEF3C7)" : "var(--surface-2)",
                      border: `1px solid ${m.is_internal_note ? "var(--warning-border, #FDE68A)" : "var(--border)"}`,
                      color: m.is_internal_note ? "var(--text)" : "var(--text)"
                    }}
                  >
                    <div style={{ fontSize: 12.5, lineHeight: 1.4 }}>{m.message}</div>
                    <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 4, fontWeight: 600 }}>
                      {m.user_profiles?.display_name || "Support"} • {new Date(m.created_at).toLocaleString()} {m.is_internal_note && "• internal note (org cannot see this)"}
                    </div>
                  </div>
                ))}
              </div>

              <div className="ta-row ta-gap8 ta-mt12">
                <input className="ta-input" style={{ flex: 1 }} placeholder="Reply to this ticket..." value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleReply()} />
                <button
                  className="ta-btn ta-btn-primary"
                  style={{ height: 34, padding: "0 14px", borderRadius: 8, fontSize: 12.5 }}
                  onClick={handleReply}
                >
                  Send
                </button>
              </div>
              <label className="ta-row ta-gap6 ta-mt8" style={{ fontSize: 11.5, cursor: "pointer", color: "var(--text-2)" }}>
                <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
                Internal note (never visible to the organization)
              </label>
            </div>
          )}
        </div>

        <div className="ta-card ta-mt20" style={{ borderRadius: 10 }}>
          <div className="ta-title" style={{ fontSize: 16 }}>General Platform Feedback</div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
            Feedback submitted from learner and organization profile screens.
          </div>
          <div className="ta-col ta-gap10 ta-mt14 anim-stagger">
            {feedbackQuery.loading && <div className="ta-empty">Loading feedback...</div>}
            {!feedbackQuery.loading && (feedbackQuery.data || []).length === 0 && <div className="ta-empty">No feedback submitted yet.</div>}
            {(feedbackQuery.data || []).map((f) => (
              <div key={f.id} style={{ padding: "12px 14px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div className="ta-row ta-between" style={{ gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>{f.name}</span>
                  <Tag tone="primary">{f.category}</Tag>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.45 }}>{f.message}</div>
                {f.rating > 0 && <div style={{ fontSize: 11.5, color: "var(--warning, #D97706)", marginTop: 6, fontWeight: 700 }}>★ {f.rating}/5 stars</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
