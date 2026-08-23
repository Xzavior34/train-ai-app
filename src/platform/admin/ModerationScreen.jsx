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
  // Settings Hub several rounds ago (fetchOrgAISettings/
  // fetchOrgAIInsightsSettings) rather than a second, competing toggle -
  // both places read and write the same underlying value, surfaced here
  // too since Content Moderation is a more natural place to think about
  // "should AI be making decisions here at all."
  const aiSettingsQuery = useSupabaseQuery(async () => (orgId ? fetchOrgAISettings(orgId) : null), [orgId]);
  const aiInsightsSettingsQuery = useSupabaseQuery(async () => (orgId ? fetchOrgAIInsightsSettings(orgId) : null), [orgId]);
  const [coachManual, setCoachManual] = useState(false);
  const [insightsManual, setInsightsManual] = useState(false);

  useEffect(() => { if (aiSettingsQuery.data) setCoachManual(!!aiSettingsQuery.data.manual_mode); }, [aiSettingsQuery.data]);
  useEffect(() => { if (aiInsightsSettingsQuery.data) setInsightsManual(!!aiInsightsSettingsQuery.data.manual_mode); }, [aiInsightsSettingsQuery.data]);

  async function handleToggleCoachManual() {
    const next = !coachManual;
    setCoachManual(next);
    const result = await updateOrgAISettings(orgId, { manual_mode: next });
    if (!result.success) { showToast(result.error); setCoachManual(!next); }
    else showToast(next ? "AI Coach is now in manual mode." : "AI Coach is back to automatic replies.");
  }
  async function handleToggleInsightsManual() {
    const next = !insightsManual;
    setInsightsManual(next);
    const result = await updateOrgAIInsightsSettings(orgId, { manual_mode: next });
    if (!result.success) { showToast(result.error); setInsightsManual(!next); }
    else showToast(next ? "AI Insights is now in manual mode." : "AI Insights is back to automatic.");
  }

  async function handleResolve(id, action) {
    try {
      await resolveModerationItem(id, action);
      queueQuery.refetch();
      showToast(action === "approved" ? "Content approved." : "Content removed.");
    } catch (e) {
      showToast(e.message || "Could not update this item.");
    }
  }

  return (
    <div className="ta-fade">
      <TopBar
        title="Content Moderation" sub="AI-flagged community content awaiting a human decision"
        orgSelector={orgSelector}
        onNavigate={setScreen}
        right={<Tag tone={queue.length ? "warning" : "success"}><Flag size={12} /> {queue.length} awaiting review</Tag>}
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="ta-hero-banner anim-fluid-entrance">
          <div className="tai-glow-violet" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">Content &amp; Safety Moderation</h1>
              <p className="ta-hero-desc">Review flagged posts, policy violations, AI confidence scores, and community safety reports.</p>
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
