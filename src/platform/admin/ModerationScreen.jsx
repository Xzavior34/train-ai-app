import React, { useContext, useState, useEffect } from "react";
import { TopBar, Avatar, Tag, ToastContext, Switch } from "../components/PlatformUI.jsx";
import { Check, X, Flag, Bot } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchModerationQueue, resolveModerationItem } from "../../lib/api/platform.js";
import { fetchOrgAISettings, updateOrgAISettings, fetchOrgAIInsightsSettings, updateOrgAIInsightsSettings } from "../../lib/api/organizations.js";

// AI moderation score on `moderation_logs.ai_score` isn't a fixed 0-1 vs
// 0-100 scale in the shared schema (nullable numeric, set by whatever ran
// the AI check) - this normalizes just enough to render a sane percentage
// and a severity tone without pretending to know an exact scale.
function scoreTone(score) {
  const pct = score > 1 ? score : score * 100;
  if (pct >= 75) return "danger";
  if (pct >= 40) return "warning";
  return undefined;
}
function scorePct(score) {
  const pct = score > 1 ? score : score * 100;
  return Math.round(Math.min(100, Math.max(0, pct)));
}

export function ModerationScreen({ orgSelector, setScreen, orgId, currentUserId }) {
  const showToast = useContext(ToastContext);
  const queueQuery = useSupabaseQuery(async () => fetchModerationQueue(), []);
  const queue = queueQuery.data || [];

  // AI Manual Mode - confirmed directly: "under content moderation, they
  // should also be able to turn off AI features for manual mode, where it
  // won't work with AI and they can send their own message via the chat
  // bot/assistant." Reuses the exact same settings already built for
  const [coachManual, setCoachManual] = useState(false);
  const [insightsManual, setInsightsManual] = useState(false);

  useEffect(() => {
    fetchOrgAISettings().then((res) => { if (res && res.manual_mode !== undefined) setCoachManual(res.manual_mode); });
    fetchOrgAIInsightsSettings().then((res) => { if (res && res.manual_mode !== undefined) setInsightsManual(res.manual_mode); });
  }, []);

  const handleToggleCoachManual = async () => {
    const next = !coachManual;
    setCoachManual(next);
    const res = await updateOrgAISettings(next);
    if (res.success) showToast(`AI Coach manual mode ${next ? "enabled" : "disabled"}`);
    else { setCoachManual(!next); showToast(res.error || "Failed to update AI settings"); }
  };

  const handleToggleInsightsManual = async () => {
    const next = !insightsManual;
    setInsightsManual(next);
    const res = await updateOrgAIInsightsSettings(next);
    if (res.success) showToast(`AI Insights manual mode ${next ? "enabled" : "disabled"}`);
    else { setInsightsManual(!next); showToast(res.error || "Failed to update AI settings"); }
  };

  const handleAction = async (item, action) => {
    try {
      await resolveModerationItem(item.id, action);
      showToast(`Item ${action === "approved" ? "approved" : "rejected"}.`);
      queueQuery.refetch();
    } catch (e) {
      showToast(e?.message || `Could not ${action} item.`);
    }
  };

  return (
    <div className="ta-fade">
      <TopBar
        title="Content Moderation" sub="AI-flagged community content awaiting a human decision"
        orgSelector={orgSelector}
        onNavigate={setScreen}
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="ta-hero-banner anim-fluid-entrance">
          <div className="tai-glow-violet" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">Content &amp; Safety Moderation</h1>
              <p className="ta-hero-desc">Review flagged posts, policy violations, AI confidence scores, and community safety reports.</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                <span className="ta-tag ta-tag-success">
                  <ShieldCheck size={13} /> AI Guardrails Active
                </span>
                <span className="ta-tag ta-tag-info">
                  <Bot size={13} /> Automated Moderation Engine
                </span>
              </div>
            </div>

            <div className="ta-hero-actions">
              <button
                className="ta-btn"
                style={{
                  background: queue.length ? "rgba(245, 158, 11, 0.3)" : "rgba(16, 185, 129, 0.3)",
                  color: queue.length ? "#FBBF24" : "#34D399",
                  border: queue.length ? "1px solid rgba(245, 158, 11, 0.6)" : "1px solid rgba(16, 185, 129, 0.6)",
                  fontWeight: 800,
                  fontSize: 13,
                  padding: "8px 16px",
                  borderRadius: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
                }}
                onClick={() => showToast(queue.length ? `${queue.length} items in moderation queue.` : "Moderation queue is clean and up to date.")}
              >
                <Flag size={14} /> {queue.length} {queue.length === 1 ? "item" : "items"} awaiting review
              </button>
            </div>
          </div>
        </div>

        <div className="ta-card" style={{ maxWidth: "100%" }}>
          <div className="ta-row ta-gap8"><Bot size={16} color="var(--primary)" /><div className="ta-title">AI Manual Mode</div></div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
            Turn off AI so it doesn't reply automatically - your own message goes out through the chat bot/assistant instead. Community content itself lives inside a study group, a cohort, or a direct instructor conversation - there isn't much for AI to flag there beyond what's already covered below.
          </div>
          <div className="ta-row ta-between ta-mt16">
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>AI Coach - Manual Mode</div>
            <Switch on={coachManual} onChange={handleToggleCoachManual} />
          </div>
          <div className="ta-row ta-between ta-mt12">
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>AI Insights - Manual Mode</div>
            <Switch on={insightsManual} onChange={handleToggleInsightsManual} />
          </div>
        </div>

        <div className="ta-card">
          {queueQuery.loading && <div className="ta-empty">Loading moderation queue...</div>}
          {!queueQuery.loading && queue.length === 0 && <div className="ta-empty">Nothing flagged right now. The queue is clear.</div>}
          {!queueQuery.loading && queue.length > 0 && (
            <div className="ta-table-wrap">
            <table className="ta-table">
              <thead>
                <tr>
                  <th>Author</th>
                  <th>Content</th>
                  <th>AI confidence</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div className="ta-row ta-gap10">
                        <Avatar initials={(item.author || "U").slice(0, 2).toUpperCase()} size={30} />
                        <span style={{ fontWeight: 600 }}>{item.author}</span>
                      </div>
                    </td>
                    <td style={{ maxWidth: 340 }}>
                      <div style={{ fontSize: 13, color: "var(--text-2)" }}>{item.excerpt}</div>
                    </td>
                    <td><Tag tone={scoreTone(item.score)}>{scorePct(item.score)}%</Tag></td>
                    <td><Tag tone="warning">{item.reason}</Tag></td>
                    <td>
                      <div className="ta-row ta-gap6">
                        <button className="ta-btn ta-btn-primary ta-btn-sm" onClick={() => handleResolve(item.id, "approved")}>
                          <Check size={14} /> Approve
                        </button>
                        <button className="ta-btn ta-btn-danger ta-btn-sm" onClick={() => handleResolve(item.id, "removed")}>
                          <X size={14} /> Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
