import React, { useState } from "react";
import { TopBar } from "../components/PlatformUI.jsx";
import { Map, Users, ChevronDown, ChevronUp } from "lucide-react";
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

        <div className="ta-grid ta-grid-3">
          {tracks.map((t) => {
            const isOpen = expanded === t.id;
            return (
              <div key={t.id} className="ta-card" style={{ cursor: "pointer" }} onClick={() => setExpanded(isOpen ? null : t.id)}>
                <div className="ta-row ta-between">
                  <div className="ta-row ta-gap10">
                    <Map size={20} color="var(--primary)" />
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{t.name}</div>
                  </div>
                  {isOpen ? <ChevronUp size={16} color="var(--text-2)" /> : <ChevronDown size={16} color="var(--text-2)" />}
                </div>
                <div className="ta-body ta-mt8">{t.courses || 0} associated course{t.courses === 1 ? "" : "s"}</div>
                <div className="ta-row ta-gap6 ta-mt8" style={{ fontSize: 12, color: "var(--text-2)" }}>
                  <Users size={13} /> {t.learners || 0} enrollment{t.learners === 1 ? "" : "s"}
                </div>
                {isOpen && (
                  <div className="ta-col ta-gap6 ta-mt12" style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                    {(t.courseTitles || []).length === 0 && <div style={{ fontSize: 12, color: "var(--text-2)" }}>No course titles available.</div>}
                    {(t.courseTitles || []).map((title, i) => (
                      <div key={i} style={{ fontSize: 12.5 }}>• {title}</div>
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
