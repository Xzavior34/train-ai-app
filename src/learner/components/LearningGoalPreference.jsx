import React from "react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchMyLearningGoal,
  saveMyLearningGoal,
} from "../../lib/api/capProgram.js";
export function LearningGoalPreference({ userId }) {
  const query = useSupabaseQuery(fetchMyLearningGoal, [userId], {
    enabled: !!userId,
    blocksPage: false,
  });
  const [busy, setBusy] = React.useState(false),
    [message, setMessage] = React.useState(null);
  return (
    <details className="tai-card" style={{ padding: 16, marginBottom: 16 }}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>
        My learning goal
        {query.data?.track
          ? ` · ${query.data.track} → ${query.data.skill}`
          : ""}
      </summary>
      <p style={{ fontSize: 13, color: "var(--text-3)" }}>
        Tell your administrator the exact skill you want to learn. Your course
        assignments are managed separately.
      </p>
      {query.loading ? (
        <p role="status">Loading learning goal…</p>
      ) : query.error ? (
        <div role="alert">
          {query.error}{" "}
          <button className="tai-btn tai-btn-outline" onClick={query.refetch}>
            Retry
          </button>
        </div>
      ) : (
        <form
          key={query.data?.updatedAt || "empty"}
          style={{ display: "grid", gap: 12 }}
          onSubmit={async (e) => {
            e.preventDefault();
            const v = new FormData(e.currentTarget);
            setBusy(true);
            setMessage(null);
            try {
              await saveMyLearningGoal(v.get("track"), v.get("skill"));
              setMessage({
                text: "Learning goal saved. Your administrator can now see this choice.",
              });
              query.refetch();
            } catch (error) {
              setMessage({ text: error.message, error: true });
            } finally {
              setBusy(false);
            }
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            Track
            <input
              className="tai-input"
              aria-label="Learning goal track"
              name="track"
              list="learning-goal-tracks"
              defaultValue={query.data?.track || ""}
              placeholder="e.g. Code"
              maxLength={120}
              required
            />
          </label>
          <datalist id="learning-goal-tracks">
            {[
              "Code",
              "No Code",
              "Tech Entrepreneurship",
              "General Soft Skills",
              "Data & AI",
            ].map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <label style={{ display: "grid", gap: 6 }}>
            Specific skill
            <input
              className="tai-input"
              aria-label="Learning goal specific skill"
              name="skill"
              list="learning-goal-skills"
              defaultValue={query.data?.skill || ""}
              placeholder="e.g. Frontend development"
              maxLength={160}
              required
            />
          </label>
          <datalist id="learning-goal-skills">
            {[
              "Frontend development",
              "Backend development",
              "Full-stack development",
              "Mobile development",
              "UI/UX design",
              "Data analysis",
              "Product management",
              "Digital marketing",
              "Leadership",
            ].map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <button
            className="tai-btn tai-btn-primary"
            disabled={busy || !userId}
          >
            {busy ? "Saving…" : "Save my learning goal"}
          </button>
        </form>
      )}
      {message && (
        <p role={message.error ? "alert" : "status"}>{message.text}</p>
      )}
    </details>
  );
}
