import React, { useState } from "react";
import { TopBar, Avatar, Tag, ProgressBar } from "../components/PlatformUI.jsx";
import { BookOpen, Calendar, CheckCircle2, MessageSquare, X, Search, Filter } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchAllPlatformLearners } from "../../lib/api/platform.js";

export function MenteesScreen({ mentorId, orgSelector, setScreen, setSelectedLearnerForChat }) {
  const [selectedMentee, setSelectedMentee] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");

  const menteesQuery = useSupabaseQuery(async () => fetchAllPlatformLearners(), []);
  const allMentees = menteesQuery.data || [];

  // Filter all platform learners by search query and risk filter
  const filteredMentees = allMentees.filter(m => {
    const courseText = (m.courses || []).join(" ").toLowerCase();
    const matchesSearch = searchQuery === "" ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      courseText.includes(searchQuery.toLowerCase());
    const matchesRisk = riskFilter === "all" || m.risk === riskFilter;
    return matchesSearch && matchesRisk;
  });

  function handleStartChat(mentee) {
    if (setSelectedLearnerForChat) setSelectedLearnerForChat(mentee);
    if (setScreen) setScreen("messages");
  }

  return (
    <div className="ta-fade">
      <TopBar title="Mentees & Learner Progress" sub="Search all platform learners, monitor progress & launch direct messaging" orgSelector={orgSelector} />
      <div className="ta-content">

        {/* Search & Filter Bar */}
        <div className="ta-card" style={{ marginBottom: 16 }}>
          <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 12 }}>
            <div className="ta-row ta-gap10" style={{ flex: 1, minWidth: 280 }}>
              <div className="ta-search" style={{ width: "100%", background: "var(--surface-3)" }}>
                <Search size={16} color="var(--text-3)" />
                <input
                  type="text"
                  placeholder="Search all learners by name or enrolled course..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ border: "none", background: "transparent", width: "100%", fontSize: 13.5, color: "var(--text)", outline: "none" }}
                />
                {searchQuery && (
                  <X size={14} color="var(--text-3)" style={{ cursor: "pointer" }} onClick={() => setSearchQuery("")} />
                )}
              </div>
            </div>

            <div className="ta-row ta-gap8">
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-2)", display: "flex", alignItems: "center", gap: 4 }}>
                <Filter size={14} /> Risk Level:
              </span>
              {[
                { key: "all", label: `All Learners (${allMentees.length})` },
                { key: "high", label: "High Risk" },
                { key: "medium", label: "Medium Risk" },
                { key: "low", label: "On Track" },
              ].map(f => (
                <button
                  key={f.key}
                  className={`ta-btn ta-btn-sm ${riskFilter === f.key ? "ta-btn-primary" : "ta-btn-outline"}`}
                  onClick={() => setRiskFilter(f.key)}
                  style={{ padding: "6px 12px", fontSize: 12 }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Learners Table */}
        <div className="ta-card">
          <table className="ta-table">
            <thead>
              <tr>
                <th>Mentee / Learner</th>
                <th>Enrolled Courses</th>
                <th>Sessions</th>
                <th>Avg. Course Progress</th>
                <th>Quiz Avg</th>
                <th>Risk Level</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {menteesQuery.loading && <tr><td colSpan={7} className="ta-empty">Loading platform learners...</td></tr>}
              {!menteesQuery.loading && allMentees.length === 0 && (
                <tr>
                  <td colSpan={7} className="ta-empty">
                    No learners registered on the platform yet.
                  </td>
                </tr>
              )}
              {!menteesQuery.loading && allMentees.length > 0 && filteredMentees.length === 0 && (
                <tr>
                  <td colSpan={7} className="ta-empty">
                    No learners found matching "{searchQuery}" {riskFilter !== "all" ? `with ${riskFilter} risk` : ""}.
                  </td>
                </tr>
              )}
                  {filteredMentees.map(m => (
                    <tr key={m.id}>
                      <td>
                        <div className="ta-row ta-gap10">
                          <Avatar initials={m.initials} size={34} />
                          <div style={{ fontWeight: 600 }}>{m.name}</div>
                        </div>
                      </td>
                      <td style={{ fontSize: 12.5, fontWeight: 500 }}>
                        {m.courses && m.courses.length > 0 ? m.courses.join(", ") : <span style={{ color: "var(--text-3)" }}>Not enrolled in any course</span>}
                      </td>
                      <td>{m.sessionsCompleted} completed</td>
                      <td>
                        <div className="ta-col ta-gap4" style={{ width: 130 }}>
                          <div className="ta-row ta-between" style={{ fontSize: 11 }}>
                            <span style={{ fontWeight: 700, color: m.progress == null ? "var(--text-3)" : undefined }}>
                              {m.progress == null ? "Not visible" : `${m.progress}%`}
                            </span>
                          </div>
                          <ProgressBar value={m.progress ?? 0} />
                        </div>
                      </td>
                      <td style={{ fontWeight: 700, color: m.quizAvg == null ? "var(--text-3)" : m.quizAvg >= 80 ? "var(--success)" : "var(--warning)" }}>
                        {m.quizAvg == null ? "—" : `${m.quizAvg}%`}
                      </td>
                      <td><Tag tone={m.risk === "high" ? "danger" : m.risk === "medium" ? "warning" : m.risk === "unknown" ? "neutral" : "success"}>{m.risk === "unknown" ? "NO DATA" : m.risk.toUpperCase()}</Tag></td>
                      <td>
                        <div className="ta-row ta-gap6">
                          <button
                            className="ta-btn ta-btn-outline ta-btn-sm"
                            onClick={() => setSelectedMentee(selectedMentee?.id === m.id ? null : m)}
                          >
                            {selectedMentee?.id === m.id ? "Hide Details" : "Progress"}
                          </button>
                          <button
                            className="ta-btn ta-btn-ghost ta-btn-sm"
                            title="Send Direct Message"
                            onClick={() => handleStartChat(m)}
                          >
                            <MessageSquare size={14} /> Message
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Selected Mentee Detail Drawer */}
            {selectedMentee && (
              <div className="ta-card ta-mt16 anim-pop" style={{ borderLeft: "4px solid var(--primary)", marginTop: 16 }}>
                <div className="ta-row ta-between">
                  <div className="ta-row ta-gap12">
                    <Avatar initials={selectedMentee.initials} size={42} />
                    <div>
                      <div className="ta-title" style={{ fontSize: 16, fontWeight: 700 }}>{selectedMentee.name} — Progress Report</div>
                      <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                        {selectedMentee.courses && selectedMentee.courses.length > 0 ? selectedMentee.courses.join(", ") : "Not enrolled in any course"}
                      </div>
                    </div>
                  </div>
                  <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => setSelectedMentee(null)}><X size={16} /></button>
                </div>

                <div className="ta-grid ta-grid-3" style={{ marginTop: 16 }}>
                  <div className="ta-card" style={{ background: "var(--surface-3)" }}>
                    <div className="ta-row ta-gap8"><BookOpen size={16} color="var(--primary)" /><span style={{ fontWeight: 700, fontSize: 13 }}>Course Progress</span></div>
                    <div style={{ fontWeight: 800, fontSize: 24, marginTop: 8, color: selectedMentee.progress == null ? "var(--text-3)" : undefined }}>
                      {selectedMentee.progress == null ? "Not visible" : `${selectedMentee.progress}%`}
                    </div>
                    <div style={{ marginTop: 10 }}><ProgressBar value={selectedMentee.progress ?? 0} /></div>
                    {selectedMentee.progress == null && (
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>Only visible for courses you instruct</div>
                    )}
                  </div>

                  <div className="ta-card" style={{ background: "var(--surface-3)" }}>
                    <div className="ta-row ta-gap8"><CheckCircle2 size={16} color="var(--success)" /><span style={{ fontWeight: 700, fontSize: 13 }}>Quiz & Assessment Score</span></div>
                    <div style={{ fontWeight: 800, fontSize: 24, marginTop: 8, color: selectedMentee.quizAvg == null ? "var(--text-3)" : "var(--success)" }}>
                      {selectedMentee.quizAvg == null ? "—" : `${selectedMentee.quizAvg}%`}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                      {selectedMentee.quizAvg == null ? "No graded quiz attempts yet" : "Average across all graded quiz attempts"}
                    </div>
                  </div>

                  <div className="ta-card" style={{ background: "var(--surface-3)" }}>
                    <div className="ta-row ta-gap8"><Calendar size={16} color="var(--primary)" /><span style={{ fontWeight: 700, fontSize: 13 }}>Mentorship Sessions</span></div>
                    <div style={{ fontWeight: 800, fontSize: 24, marginTop: 8 }}>{selectedMentee.sessionsCompleted}</div>
                    <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>Completed sessions with you</div>
                  </div>
                </div>

                <div className="ta-row ta-gap10" style={{ marginTop: 16 }}>
                  <button className="ta-btn ta-btn-primary ta-btn-sm" onClick={() => handleStartChat(selectedMentee)}>
                    <MessageSquare size={14} /> Send Direct Message
                  </button>
                  {setScreen && (
                    <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => setScreen("schedule")}>
                      <Calendar size={14} /> Go to Schedule
                    </button>
                  )}
                </div>
              </div>
            )}
      </div>
    </div>
  );
}
