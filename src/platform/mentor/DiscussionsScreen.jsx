import React, { useContext } from "react";
import { TopBar, Tag, ToastContext } from "../components/PlatformUI.jsx";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchDiscussionsForMentor, resolveDiscussion } from "../../lib/api/platform.js";

// Previously this screen was 100% static: a `useState([])` that nothing ever
// populated, always rendering the hardcoded "No unresolved learner Q&A
// discussions right now." - regardless of what was actually in the database.
// `fetchDiscussionsForMentor` / `resolveDiscussion` (real `mentor_learner_discussions`
// table) already existed in lib/api/platform.js but were never called from
// here. Wired in below with real loading/empty/error states.
export function DiscussionsScreen({ mentorId, orgSelector }) {
  const showToast = useContext(ToastContext);
  const discussionsQuery = useSupabaseQuery(async () => (mentorId ? fetchDiscussionsForMentor(mentorId) : []), [mentorId]);
  const discussions = discussionsQuery.data || [];

  async function handleResolve(id) {
    try {
      await resolveDiscussion(id);
      showToast("Discussion marked resolved");
      discussionsQuery.refetch();
    } catch (err) {
      showToast(err.message || "Could not resolve discussion");
    }
  }

  return (
    <div className="ta-fade">
      <TopBar title="Discussions" sub="Answer learner Q&A questions" orgSelector={orgSelector} />
      <div className="ta-content">
        {!mentorId && !discussionsQuery.loading && (
          <div className="ta-empty">No instructor profile found for your account yet.</div>
        )}
        <div className="ta-col ta-gap12 anim-stagger">
          {discussionsQuery.loading && <div className="ta-card"><div className="ta-empty">Loading discussions...</div></div>}
          {discussionsQuery.error && <div className="ta-card"><div className="ta-empty">Couldn't load discussions: {discussionsQuery.error}</div></div>}
          {!discussionsQuery.loading && !discussionsQuery.error && discussions.length === 0 && (
            <div className="ta-card"><div className="ta-empty">No unresolved learner Q&A discussions right now.</div></div>
          )}
          {discussions.map((d) => (
            <div key={d.id} className="ta-card">
              <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 12 }}>
                <div className="ta-row ta-gap10" style={{ minWidth: 0, flex: "1 1 200px" }}>
                  <MessageCircle size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</div>
                    <div style={{ fontSize: 12, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.mentee} · {d.course}</div>
                  </div>
                </div>
                <div className="ta-row ta-gap10" style={{ flexShrink: 0, flexWrap: "wrap" }}>
                  <Tag tone={d.resolved ? "success" : "warning"}>{d.resolved ? "Resolved" : "Open"}</Tag>
                  {!d.resolved && (
                    <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => handleResolve(d.id)}>
                      <CheckCircle2 size={13} /> Mark resolved
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
