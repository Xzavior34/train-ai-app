import React, { useState } from "react";
import { TopBar, Tag } from "../components/PlatformUI.jsx";
import { Map, Users, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchLearningTracksSummary } from "../../lib/api/platform.js";

// Learning "tracks" have no dedicated table in the shared schema - they're a
// real aggregate derived from courses.category (see fetchLearningTracksSummary
// in lib/api/platform.js). Cards expand in place to list the real course
// titles behind each track's count, so the number isn't just a display-only
// figure with nothing backing it up.
export function TracksScreen() {
  const tracksQuery = useSupabaseQuery(async () => fetchLearningTracksSummary(), []);
  const tracks = tracksQuery.data || [];
  const [expanded, setExpanded] = useState(null);

  return (
    <div className="ta-fade">
      <TopBar title="Learning Tracks" sub="System-wide learning tracks & career paths" />
      <div className="ta-content">
        {tracksQuery.loading && <div className="ta-empty">Loading learning tracks...</div>}
        {tracksQuery.error && <div className="ta-empty">Couldn't load learning tracks: {tracksQuery.error}</div>}
        {!tracksQuery.loading && !tracksQuery.error && tracks.length === 0 && (
          <div className="ta-empty">No learning tracks yet. Tracks are derived from course categories, so publish a course with a category to see one here.</div>
        )}

        <div className="ta-grid ta-grid-3 anim-stagger">
          {tracks.map((t) => {
            const isOpen = expanded === t.id;
            return (
              <div
                key={t.id}
                className="ta-card ta-card-hover"
                style={{ cursor: "pointer", padding: "18px 20px", borderRadius: 10, border: "1px solid var(--border)" }}
                onClick={() => setExpanded(isOpen ? null : t.id)}
              >
                <div className="ta-row ta-between" style={{ gap: 8, alignItems: "center" }}>
                  <div className="ta-row ta-gap12" style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Map size={18} color="var(--primary)" />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 15.5, color: "var(--text)", wordBreak: "break-word", lineHeight: 1.25 }}>
                        {t.name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2, fontWeight: 500 }}>
                        {t.courses || 0} associated course{t.courses === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {isOpen ? <ChevronUp size={15} color="var(--text-2)" /> : <ChevronDown size={15} color="var(--text-2)" />}
                  </div>
                </div>

                <div className="ta-row ta-between ta-mt14" style={{ alignItems: "center" }}>
                  <span className="ta-row ta-gap6" style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>
                    <Users size={13} color="var(--primary)" /> {t.learners || 0} enrollment{t.learners === 1 ? "" : "s"}
                  </span>
                  <Tag tone="primary">{t.courses || 0} Courses</Tag>
                </div>

                {isOpen && (
                  <div className="ta-col ta-gap8 ta-mt14 anim-slide-down" style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                    {(t.courseTitles || []).length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)" }}>No course titles available.</div>}
                    {(t.courseTitles || []).map((title, i) => (
                      <div key={i} className="ta-row ta-gap8" style={{ fontSize: 12.5, color: "var(--text)" }}>
                        <BookOpen size={12} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span style={{ wordBreak: "break-word", lineHeight: 1.35 }}>{title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
