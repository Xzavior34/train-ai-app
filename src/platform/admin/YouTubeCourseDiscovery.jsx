import React, { useEffect, useState } from "react";
import { Search, ExternalLink, X, Sparkles } from "lucide-react";
import * as liveApi from "../../lib/api/youtubeDiscovery.js";
import "./youtubeDiscovery.css";
export function YouTubeCourseDiscovery({
  orgId,
  onClose,
  onChanged,
  onManage,
  api = liveApi,
}) {
  const [connection, setConnection] = useState(null),
    [items, setItems] = useState([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [prompt, setPrompt] = useState(""),
    [level, setLevel] = useState("beginner"),
    [filter, setFilter] = useState("pending"),
    [busy, setBusy] = useState(""),
    [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null),
    [targets, setTargets] = useState(null),
    [scope, setScope] = useState("individuals"),
    [cohort, setCohort] = useState(""),
    [selected, setSelected] = useState([]),
    [memberFilter, setMemberFilter] = useState("");
  async function refresh() {
    const data = await api.listYouTubeSuggestions(orgId);
    setItems(data);
  }
  async function load() {
    setLoading(true);
    setError("");
    try {
      const [status, data] = await Promise.all([
        api.discoveryStatus(orgId),
        api.listYouTubeSuggestions(orgId),
      ]);
      setConnection(status);
      setItems(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [orgId]);
  async function run(key, fn) {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e.message || "Could not save. Please retry.");
    } finally {
      setBusy("");
    }
  }
  const filtered = items.filter((s) => s.status === filter);
  return (
    <section
      className="yt-discovery ta-card"
      aria-label="AI YouTube course discovery"
      aria-busy={!!busy}
    >
      <div className="yt-heading">
        <div>
          <h2>
            <Sparkles size={20} /> Find YouTube courses with AI
          </h2>
          <p>
            Describe the skill and audience. Review suggestions before adding
            them to your library.
          </p>
        </div>
        <button
          type="button"
          className="ta-btn ta-btn-ghost"
          onClick={onClose}
          aria-label="Close course discovery"
        >
          <X size={20} />
        </button>
      </div>
      {error && (
        <div className="yt-message yt-error" role="alert">
          {error}{" "}
          <button
            className="ta-btn ta-btn-outline ta-btn-sm"
            disabled={!!busy}
            onClick={load}
          >
            Retry connection
          </button>
        </div>
      )}
      {notice && (
        <div className="yt-message" role="status">
          {notice}
        </div>
      )}
      {loading ? (
        <p role="status">Checking course discovery…</p>
      ) : connection && !connection.ready ? (
        <div className="yt-message">
          {!connection.youtube
            ? "YouTube search is awaiting connection by the platform owner. "
            : ""}
          {!connection.ai ? "The AI connection needs setup. " : ""}
          <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={load}>
            Check connection again
          </button>
        </div>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run("search", async () => {
            const result = await api.searchYouTubeCourses(
              orgId,
              prompt.trim(),
              level,
            );
            await refresh();
            setFilter("pending");
            setNotice(
              result.count
                ? `${result.count} new suggestions saved for review.`
                : "No matching courses found. Try a more specific request. No AI credit was charged.",
            );
          });
        }}
      >
        <label>
          What should learners learn?
          <textarea
            className="ta-input"
            required
            minLength={5}
            maxLength={1000}
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Find beginner product management courses covering roadmaps, user research and prioritization, taught in English."
          />
        </label>
        <div className="yt-search-row">
          <label>
            Learning level
            <select
              aria-label="Learning level"
              className="ta-input"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <button
            className="ta-btn ta-btn-primary"
            disabled={loading || !connection?.ready || !!busy}
          >
            <Search size={16} />
            {busy === "search" ? "Finding courses…" : "Find courses"}
          </button>
        </div>
        <p className="yt-muted">
          Uses 1 AI recommendation credit per successful search. Recommendations
          assess titles and descriptions; preview the teaching content before
          accepting.
        </p>
      </form>
      <div className="yt-filters" role="group" aria-label="Suggestion status">
        {["pending", "accepted", "rejected"].map((status) => (
          <button
            className={`ta-btn ${filter === status ? "ta-btn-primary" : "ta-btn-outline"}`}
            aria-pressed={filter === status}
            key={status}
            onClick={() => setFilter(status)}
          >
            {status === "pending"
              ? "To review"
              : status === "accepted"
                ? "Accepted"
                : "Rejected"}{" "}
            ({items.filter((i) => i.status === status).length})
          </button>
        ))}
      </div>
      {!loading && !filtered.length && (
        <p>No {filter === "pending" ? "pending" : filter} suggestions yet.</p>
      )}
      <div className="yt-results">
        {filtered.map((s) => (
          <article className="yt-result" key={s.id}>
            <img
              loading="lazy"
              src={`https://i.ytimg.com/vi/${s.video_id}/hqdefault.jpg`}
              alt=""
            />
            <div className="yt-result-body">
              <h3>{s.title}</h3>
              <p>
                {s.channel_title} · {Math.ceil(s.duration_seconds / 60)} min ·{" "}
                {s.level}
              </p>
              <p>
                <strong>Why suggested:</strong> {s.reason}
              </p>
              {s.cautions && (
                <p>
                  <strong>Review notes:</strong> {s.cautions}
                </p>
              )}
              <details>
                <summary>Source details</summary>
                <p className="yt-description">{s.description}</p>
                <p>Requested: {s.youtube_course_searches?.prompt}</p>
                <p>
                  Availability checked{" "}
                  {new Date(s.verified_at).toLocaleDateString()}. Playback may
                  vary by location.
                </p>
              </details>
              <div className="yt-actions">
                <a
                  className="ta-btn ta-btn-outline"
                  href={`https://www.youtube.com/watch?v=${s.video_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Preview on YouTube <ExternalLink size={14} />
                </a>
                {s.status === "pending" && (
                  <>
                    <button
                      className="ta-btn ta-btn-primary"
                      disabled={!!busy || !connection?.ready}
                      onClick={() =>
                        run(s.id, async () => {
                          await api.reviewYouTubeSuggestion(
                            orgId,
                            s.id,
                            "accept",
                          );
                          await refresh();
                          onChanged?.();
                          setNotice(
                            "Accepted into your course library. New imports stay as drafts until published or assigned.",
                          );
                        })
                      }
                    >
                      {busy === s.id ? "Saving…" : "Accept course"}
                    </button>
                    <button
                      className="ta-btn ta-btn-outline"
                      disabled={!!busy}
                      onClick={() =>
                        run(s.id, async () => {
                          await api.reviewYouTubeSuggestion(
                            orgId,
                            s.id,
                            "reject",
                          );
                          await refresh();
                        })
                      }
                    >
                      Reject
                    </button>
                  </>
                )}
                {s.status === "rejected" && (
                  <button
                    className="ta-btn ta-btn-outline"
                    disabled={!!busy}
                    onClick={() =>
                      run(s.id, async () => {
                        await api.reviewYouTubeSuggestion(
                          orgId,
                          s.id,
                          "restore",
                        );
                        await refresh();
                      })
                    }
                  >
                    Return to review
                  </button>
                )}
                {s.status === "accepted" && (
                  <>
                    <button
                      className="ta-btn ta-btn-outline"
                      onClick={() => onManage?.(s.course_id)}
                    >
                      Manage course
                    </button>
                    <button
                      className="ta-btn ta-btn-primary"
                      disabled={!!busy}
                      onClick={() =>
                        run(s.id, async () => {
                          const data =
                            await api.youTubeAssignmentTargets(orgId);
                          setTargets(data);
                          setAssigning(s);
                          setSelected([]);
                          setCohort("");
                          setScope("individuals");
                          setMemberFilter("");
                        })
                      }
                    >
                      Assign to learners
                    </button>
                  </>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {assigning && (
        <section className="yt-assignment" aria-label="Assign accepted course">
          <h3>Assign: {assigning.title}</h3>
          <p>
            This publishes the accepted course and enrolls the selected
            learners.
          </p>
          <label>
            Assign to
            <select
              aria-label="Assign to"
              className="ta-input"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              <option value="individuals">Selected learners</option>
              <option value="cohort">Entire cohort</option>
            </select>
          </label>
          {scope === "cohort" ? (
            <label>
              Cohort
              <select
                aria-label="Cohort"
                className="ta-input"
                value={cohort}
                onChange={(e) => setCohort(e.target.value)}
              >
                <option value="">Choose cohort</option>
                {targets.cohorts.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label>
                Find learner
                <input
                  className="ta-input"
                  value={memberFilter}
                  onChange={(e) => setMemberFilter(e.target.value)}
                />
              </label>
              <p>{selected.length} selected</p>
              <div className="yt-learners">
                {targets.learners
                  .filter((l) =>
                    l.name.toLowerCase().includes(memberFilter.toLowerCase()),
                  )
                  .map((l) => (
                    <label key={l.id}>
                      <input
                        type="checkbox"
                        checked={selected.includes(l.id)}
                        onChange={(e) =>
                          setSelected((prev) =>
                            e.target.checked
                              ? [...prev, l.id]
                              : prev.filter((id) => id !== l.id),
                          )
                        }
                      />
                      {l.name}
                    </label>
                  ))}
              </div>
            </>
          )}
          <div className="yt-actions">
            <button
              className="ta-btn ta-btn-primary"
              disabled={
                !!busy || (scope === "cohort" ? !cohort : !selected.length)
              }
              onClick={() =>
                run("assign", async () => {
                  const count = await api.publishAssignYouTubeCourse(
                    assigning.course_id,
                    scope === "individuals" ? selected : [],
                    scope === "cohort" ? cohort : null,
                  );
                  setAssigning(null);
                  onChanged?.();
                  setNotice(
                    `Course published and assigned to ${count} learner${count === 1 ? "" : "s"}.`,
                  );
                })
              }
            >
              {busy === "assign" ? "Assigning…" : "Publish & assign"}
            </button>
            <button
              className="ta-btn ta-btn-outline"
              disabled={!!busy}
              onClick={() => setAssigning(null)}
            >
              Cancel assignment
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
