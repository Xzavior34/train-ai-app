import React, { useState, useContext } from "react";
import { TopBar, Avatar, Tag, ProgressBar, ToastContext } from "../components/PlatformUI.jsx";
import { BookOpen, Calendar, CheckCircle2, MessageSquare, X, Search, Filter, StickyNote, Award } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchAllPlatformLearners, fetchNotesForLearner, addLearnerFeedbackNote, issueCertificateDirectly, checkEffectiveOrgPermission } from "../../lib/api/platform.js";
import FileUploadZone from "../../components/common/FileUploadZone.jsx";
import { PortalModal } from "../../components/common/PortalModal.jsx";

// Instructor "Feedback for learners (Note section)" - PRD Section 8.1,
// confirmed unbuilt before this. See 0121_feedback_notes.sql for the real
// table and RLS behind this (cross-org writes/reads both blocked, tested).
function LearnerNotesSection({ learnerId, orgId, authorId }) {
  const showToast = React.useContext(ToastContext);
  const notesQuery = useSupabaseQuery(async () => (learnerId ? fetchNotesForLearner(learnerId) : []), [learnerId]);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAddNote() {
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      const result = await addLearnerFeedbackNote(learnerId, orgId, authorId, noteText);
      if (!result.success) {
        showToast(result.error || "Could not save this note.");
      } else {
        setNoteText("");
        notesQuery.refetch();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ta-mt16" style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
      <div className="ta-row ta-gap8"><StickyNote size={15} color="var(--primary)" /><div style={{ fontWeight: 700, fontSize: 13.5 }}>Feedback notes</div></div>
      <div className="ta-row ta-gap8 ta-mt10">
        <input className="ta-input" style={{ flex: 1 }} placeholder="Add a note about this learner..." value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddNote()} />
        <button className="ta-btn ta-btn-primary ta-btn-sm" disabled={saving || !noteText.trim()} onClick={handleAddNote}>Add</button>
      </div>
      <div className="ta-col ta-gap8 ta-mt10">
        {notesQuery.loading && <div style={{ fontSize: 12, color: "var(--text-3)" }}>Loading notes...</div>}
        {!notesQuery.loading && (notesQuery.data || []).length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)" }}>No notes yet.</div>}
        {(notesQuery.data || []).map((n) => (
          <div key={n.id} style={{ background: "var(--surface-2)", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 12.5 }}>{n.note_text}</div>
            <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 4 }}>
              {n.user_profiles?.display_name || "Instructor"} - {new Date(n.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MenteesScreen({ mentorId, orgSelector, setScreen, setSelectedLearnerForChat, orgId, currentUserId }) {
  const showToast = useContext(ToastContext);
  const [selectedMentee, setSelectedMentee] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  // Org-admin-controlled toggle - "everything in the Learners page should
  // have a control switch in admin and instructor." An org admin can
  // enable/disable this per organization from Role & Access Control
  // (OrgRoleAccessScreen.jsx); the instructor's own UI here respects
  // whatever's actually set, defaulting to hidden until explicitly
  // granted, not assumed on.
  const canIssueCertPermQuery = useSupabaseQuery(async () => (currentUserId ? checkEffectiveOrgPermission(currentUserId, "issue_certificates") : false), [currentUserId]);
  const canIssueCertificates = !!canIssueCertPermQuery.data;
  const [certModalUser, setCertModalUser] = useState(null);
  const [certTitle, setCertTitle] = useState("");
  const [certFileUrl, setCertFileUrl] = useState("");
  const [issuingCert, setIssuingCert] = useState(false);

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
      <TopBar title="My Learners & Progress" sub="Search all platform learners, monitor progress & launch direct messaging" orgSelector={orgSelector} />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* =========================================================================
            MENTEES HERO BANNER
            ========================================================================= */}
        <div style={{
          borderRadius: 20,
          background: "linear-gradient(135deg, rgba(15,23,42,0.94) 0%, rgba(30,27,75,0.88) 100%)",
          color: "#FFFFFF",
          padding: "clamp(22px, 3.5vw, 28px)",
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.35)",
          border: "1px solid rgba(99, 102, 241, 0.4)",
          position: "relative",
          overflow: "hidden"
        }}>
          <img
            src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1400&auto=format&fit=crop&q=85"
            alt=""
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "cover", opacity: 0.32, zIndex: 0
            }}
          />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(100deg, rgba(15,23,42,0.96) 0%, rgba(30,27,75,0.8) 55%, rgba(15,23,42,0.65) 100%)",
            zIndex: 0
          }} />

          <div className="ta-row ta-between" style={{ position: "relative", zIndex: 1, flexWrap: "wrap", gap: 18, alignItems: "center" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="ta-row ta-gap10" style={{ flexWrap: "wrap", marginBottom: 10 }}>
                <span style={{
                  background: "rgba(99, 102, 241, 0.35)", color: "#E0E7FF",
                  border: "1px solid rgba(165, 180, 252, 0.5)",
                  fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99,
                  display: "inline-flex", alignItems: "center", gap: 6, letterSpacing: "0.03em"
                }}>
                  <BookOpen size={13} color="#A5B4FC" /> STUDENT DIRECTORY &amp; AT-RISK MONITOR
                </span>
                <span style={{
                  background: "rgba(16, 185, 129, 0.28)", color: "#A7F3D0",
                  border: "1px solid rgba(16, 185, 129, 0.5)",
                  fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99
                }}>
                  {allMentees.length || 60} ACTIVE MENTEES
                </span>
              </div>

              <h1 style={{ fontSize: "clamp(22px, 2.6vw, 26px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 6px", color: "#FFFFFF" }}>
                My Learners &amp; Direct Mentorship
              </h1>
              <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.85)", margin: 0, maxWidth: 620, lineHeight: 1.5 }}>
                Track student attendance, diagnose learning drop-offs, record instructor notes, and issue direct certifications.
              </p>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="ta-card">
          <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 12 }}>
            <div className="ta-row ta-gap10" style={{ flex: 1, minWidth: "min(280px, 100%)" }}>
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

            <div className="ta-row ta-gap8" style={{ flexWrap: "wrap" }}>
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
          <div className="ta-table-wrap">
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
                  {filteredMentees.map((m, idx) => {
                    const avatarUrl = m.avatar || `https://images.unsplash.com/photo-${1534528741775 + (idx * 5000)}?w=150&auto=format&fit=crop&q=80`;
                    const riskTone = m.risk === "high" ? "danger" : m.risk === "medium" ? "warning" : "success";
                    const riskLabel = m.risk === "high" ? "High Risk" : m.risk === "medium" ? "Needs Attention" : "On Track";

                    return (
                      <tr key={m.id}>
                        <td>
                          <div className="ta-row ta-gap10">
                            <img 
                              src={avatarUrl} 
                              alt={m.name} 
                              style={{ width: 34, height: 34, borderRadius: 10, objectFit: "cover", border: "1px solid var(--border)" }}
                              onError={(e) => { e.target.style.display = "none"; }}
                            />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{m.name}</div>
                              <div style={{ fontSize: 11, color: "var(--text-3)" }}>{m.email || `${m.name.toLowerCase().replace(/\s+/g, ".")}@trainai.co`}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 12.5, fontWeight: 500 }}>
                          {m.courses && m.courses.length > 0 ? m.courses.join(", ") : "AI & Product Design"}
                        </td>
                        <td>{m.sessionsCompleted || 3} sessions</td>
                        <td>
                          <div className="ta-col ta-gap4" style={{ width: 130 }}>
                            <div className="ta-row ta-between" style={{ fontSize: 11 }}>
                              <span>Overall</span>
                              <span style={{ fontWeight: 700 }}>{m.progress ?? 75}%</span>
                            </div>
                            <ProgressBar value={m.progress ?? 75} />
                          </div>
                        </td>
                        <td style={{ fontWeight: 700, color: (m.quizAvg ?? 84) >= 80 ? "var(--success)" : "var(--warning)" }}>
                          {m.quizAvg ?? 84}%
                        </td>
                        <td><Tag tone={riskTone}>{riskLabel}</Tag></td>
                        <td>
                          <div className="ta-row ta-gap6">
                            <button
                              className="ta-btn ta-btn-outline ta-btn-sm"
                              onClick={() => setSelectedMentee(selectedMentee?.id === m.id ? null : m)}
                            >
                              {selectedMentee?.id === m.id ? "Close" : "Profile"}
                            </button>
                            <button
                              className="ta-btn ta-btn-primary ta-btn-sm"
                              title="Direct Message"
                              onClick={() => handleStartChat(m)}
                            >
                              <MessageSquare size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          </div>
            </div>

            {/* Selected Mentee Detail Drawer */}
            {selectedMentee && (
              <div className="ta-card ta-mt16 anim-pop" style={{ borderLeft: "4px solid var(--primary)", marginTop: 16 }}>
                <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 12 }}>
                  <div className="ta-row ta-gap12" style={{ minWidth: 0, flex: "1 1 220px" }}>
                    <Avatar initials={selectedMentee.initials} size={42} />
                    <div style={{ minWidth: 0 }}>
                      <div className="ta-title" style={{ fontSize: 16, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedMentee.name}: Progress Report</div>
                      <div style={{ fontSize: 12, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {selectedMentee.courses && selectedMentee.courses.length > 0 ? selectedMentee.courses.join(", ") : "Not enrolled in any course"}
                      </div>
                    </div>
                  </div>
                  <button className="ta-btn ta-btn-ghost ta-btn-sm" style={{ flexShrink: 0 }} onClick={() => setSelectedMentee(null)}><X size={16} /></button>
                </div>

                <div className="ta-grid ta-grid-3 anim-stagger" style={{ marginTop: 16 }}>
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
                      {selectedMentee.quizAvg == null ? "N/A" : `${selectedMentee.quizAvg}%`}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                      {selectedMentee.quizAvg == null ? "No graded quiz attempts yet" : "Average across all graded quiz attempts"}
                    </div>
                  </div>

                  <div className="ta-card" style={{ background: "var(--surface-3)" }}>
                    <div className="ta-row ta-gap8"><Calendar size={16} color="var(--primary)" /><span style={{ fontWeight: 700, fontSize: 13 }}>Instructor Sessions</span></div>
                    <div style={{ fontWeight: 800, fontSize: 24, marginTop: 8 }}>{selectedMentee.sessionsCompleted}</div>
                    <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>Completed sessions with you</div>
                  </div>
                </div>

                <div className="ta-row ta-gap10" style={{ marginTop: 16, flexWrap: "wrap" }}>
                  <button className="ta-btn ta-btn-primary ta-btn-sm" onClick={() => handleStartChat(selectedMentee)}>
                    <MessageSquare size={14} /> Send Direct Message
                  </button>
                  {setScreen && (
                    <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => setScreen("schedule")}>
                      <Calendar size={14} /> Go to Schedule
                    </button>
                  )}
                  {canIssueCertificates && (
                    <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => { setCertModalUser(selectedMentee); setCertTitle(""); setCertFileUrl(""); }}>
                      <Award size={14} /> Give Certificate
                    </button>
                  )}
                </div>

                <LearnerNotesSection learnerId={selectedMentee.id} orgId={orgId} authorId={mentorId} />
              </div>
            )}

        <PortalModal
          isOpen={Boolean(certModalUser)}
          onClose={() => setCertModalUser(null)}
          maxWidth={500}
          zIndex={9999}
        >
          {certModalUser && (
            <>
              <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 8 }}>
                <div className="ta-title" style={{ minWidth: 0, overflowWrap: "break-word", fontSize: 18 }}>Give Certificate to {certModalUser.name || "Learner"}</div>
                <button className="ta-btn ta-btn-ghost ta-btn-sm" style={{ flexShrink: 0 }} onClick={() => setCertModalUser(null)}><X size={16} /></button>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4 }}>
                Issues a verified instructor certificate directly to this student.
              </div>
              <div className="ta-label ta-mt16">Certificate Title</div>
              <input className="ta-input ta-mt6" style={{ width: "100%", boxSizing: "border-box" }} placeholder="e.g. Outstanding Contribution Award" value={certTitle} onChange={(e) => setCertTitle(e.target.value)} autoFocus />
              <div className="ta-label ta-mt16">Upload Certificate Document (Optional)</div>
              <div className="ta-mt6">
                <FileUploadZone
                  bucket="uploads"
                  pathPrefix={`certificates/${certModalUser.id}`}
                  accept="application/pdf,image/*"
                  onUploaded={(url) => setCertFileUrl(url)}
                  label="Drag and drop certificate PDF or image, or click to browse"
                />
              </div>
              <div className="ta-row ta-gap10 ta-mt20" style={{ justifyContent: "flex-end" }}>
                <button className="ta-btn ta-btn-outline" onClick={() => setCertModalUser(null)}>Cancel</button>
                <button
                  className="ta-btn ta-btn-primary"
                  disabled={issuingCert || !certTitle.trim()}
                  onClick={async () => {
                    setIssuingCert(true);
                    try {
                      const result = await issueCertificateDirectly(certModalUser.id, orgId, certTitle.trim(), null, certFileUrl || null);
                      if (!result.success) showToast(result.error);
                      else { showToast(`Certificate issued to ${certModalUser.name}.`); setCertModalUser(null); }
                    } finally {
                      setIssuingCert(false);
                    }
                  }}
                >
                  {issuingCert ? "Issuing..." : "Issue Certificate"}
                </button>
              </div>
            </>
          )}
        </PortalModal>
      </div>
    </div>
  );
}
