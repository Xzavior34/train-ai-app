import React, { useContext } from "react";
import { TopBar, Avatar, Tag, ToastContext } from "../components/PlatformUI.jsx";
import { Check, X, Flag } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchModerationQueue, resolveModerationItem } from "../../lib/api/platform.js";

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

export function ModerationScreen({ orgSelector, setScreen }) {
  const showToast = useContext(ToastContext);
  const queueQuery = useSupabaseQuery(async () => fetchModerationQueue(), []);
  const queue = queueQuery.data || [];

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
      <div className="ta-content">
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
