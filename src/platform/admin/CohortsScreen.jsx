import React, { useState, useContext } from "react";
import { TopBar, Tag, ProgressBar, ToastContext } from "../components/PlatformUI.jsx";
import {
  Plus, Layers, Users, Calendar, ArrowRight, X, Send, Copy,
  Archive, Trash2, Clock, CheckCircle2, AlertTriangle, Sparkles
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchCohortsWithStats, createCohort, fetchUpcomingOrgSessions } from "../../lib/api/platform.js";
import { calculateCohortProgress, deleteOrArchiveCohort, duplicateCohort } from "../../lib/api/cohorts.js";
import { createCohortPost } from "../../lib/api/schemaHelper.js";
import { PortalModal } from "../../components/common/PortalModal.jsx";
import { COHORT_STATUSES, PROGRAMME_TYPES } from "../../lib/constants/terminology.js";

export function CohortsScreen({ orgId, onOpenCohort, orgSelector, setScreen, currentUserId }) {
  const showToast = useContext(ToastContext);
  const [newCohortOpen, setNewCohortOpen] = useState(false);
  const [name, setName] = useState("");
  const [programName, setProgramName] = useState(PROGRAMME_TYPES.TRAINING_PROGRAMME);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date(Date.now() + 42 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)); // Default 6 weeks
  const [trialStatus, setTrialStatus] = useState("none");
  const [saving, setSaving] = useState(false);

  // Archive / Delete Confirmation State
  const [confirmModal, setConfirmModal] = useState(null); // { cohort, action: 'delete' | 'archive' | 'duplicate' }
  const [duplicateName, setDuplicateName] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const [announcementText, setAnnouncementText] = useState("");
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const cohortsQuery = useSupabaseQuery(async () => orgId ? fetchCohortsWithStats(orgId) : [], [orgId]);
  const cohorts = cohortsQuery.data || [];
  const sessionsQuery = useSupabaseQuery(async () => orgId ? fetchUpcomingOrgSessions(orgId) : [], [orgId]);
  const upcomingSessions = sessionsQuery.data || [];

  async function handleCreateCohort(e) {
    e.preventDefault();
    if (!name.trim()) { showToast("Enter a cohort name first."); return; }
    if (!orgId) {
      showToast("You need to be part of an organization to create a cohort.");
      return;
    }
    setSaving(true);
    try {
      await createCohort({
        organizationId: orgId,
        name: name.trim(),
        programName,
        startDate,
        endDate,
        trialStatus,
        createdBy: currentUserId,
      });
      setNewCohortOpen(false);
      setName("");
      cohortsQuery.refetch();
      showToast("Cohort created successfully!");
    } catch (err) {
      showToast(err?.message || "Could not create cohort.");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmAction() {
    if (!confirmModal) return;
    setActionBusy(true);
    try {
      if (confirmModal.action === "duplicate") {
        const res = await duplicateCohort(confirmModal.cohort.id, duplicateName);
        showToast(`Cohort duplicated as "${res.name}".`);
      } else {
        const res = await deleteOrArchiveCohort(confirmModal.cohort.id);
        showToast(res.message || "Cohort updated.");
      }
      setConfirmModal(null);
      cohortsQuery.refetch();
    } catch (err) {
      showToast(err?.message || "Action failed.");
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="ta-fade">
      <TopBar
        title="Cohorts" sub="Active cohorts, time-elapsed progress &amp; batch schedules"
        orgSelector={orgSelector}
        onNavigate={setScreen}
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* =========================================================================
            COHORT DASHBOARD HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner anim-fluid-entrance">
          <div className="tai-glow-cyan" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">
                Cohort Administration &amp; Milestone Pacing
              </h1>
              <p className="ta-hero-desc">
                Manage structured training programmes, 6-week CAP accelerators, time-elapsed learner pacing, and batch broadcasts.
              </p>
            </div>

            <div className="ta-hero-actions">
              <button
                className="ta-btn ta-btn-primary"
                style={{ height: 36, padding: "0 14px", borderRadius: 8, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={() => setNewCohortOpen(true)}
              >
                <Plus size={14} /> Create Cohort
              </button>
            </div>
          </div>
        </div>

        <div className="ta-sidebar-layout">
          {/* Main Left Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 16 }}>
              {cohortsQuery.loading && <div className="ta-empty">Loading cohorts...</div>}
              {!cohortsQuery.loading && cohorts.length === 0 && (
                <div className="ta-empty">No cohorts created yet. Click "Create Cohort" above to launch your first training batch.</div>
              )}
              {cohorts.map((c, idx) => {
                // Precise elapsed time calculation
                const progressInfo = calculateCohortProgress(c.start_date || c.startsAt || c.created_at, c.end_date || c.endsAt);
                const cohortCovers = [
                  "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=600&auto=format&fit=crop&q=80",
                  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80",
                  "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&auto=format&fit=crop&q=80",
                  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&auto=format&fit=crop&q=80"
                ];
                const cover = c.banner_url || cohortCovers[idx % cohortCovers.length];

                return (
                  <div
                    key={c.id || c.name}
                    className="ta-card ta-card-hover"
                    style={{
                      borderRadius: 12,
                      padding: 0,
                      overflow: "hidden",
                      background: "var(--surface)",
                      border: c.is_archived ? "1px dashed var(--border)" : "1px solid var(--border)",
                      opacity: c.is_archived ? 0.75 : 1,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div style={{ position: "relative", width: "100%", height: 120, overflow: "hidden" }}>
                      <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(15,23,42,0.15) 0%, rgba(15,23,42,0.85) 100%)" }} />
                      <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", justifyContent: "space-between" }}>
                        <Tag tone="primary">{c.program_name || "Training Programme"}</Tag>
                        <Tag tone={progressInfo.isCompleted ? "warning" : progressInfo.isUpcoming ? "default" : "success"}>
                          {c.is_archived ? "Archived" : progressInfo.isCompleted ? "Completed" : progressInfo.isUpcoming ? "Upcoming" : "Active"}
                        </Tag>
                      </div>
                      <div style={{ position: "absolute", bottom: 8, left: 12, right: 12, color: "#FFFFFF", fontWeight: 800, fontSize: 14.5, textShadow: "0 2px 4px rgba(0,0,0,0.6)", lineHeight: 1.25, wordBreak: "break-word" }}>
                        {c.name}
                      </div>
                    </div>

                    <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
                      <div>
                        <div className="ta-row ta-between" style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 6 }}>
                          <span className="ta-row ta-gap6">
                            <Users size={13} color="var(--primary)" /> {c.members ?? c.learner_count ?? 0} learners
                          </span>
                          <span style={{ fontWeight: 800, color: "var(--primary)" }}>{progressInfo.percent}%</span>
                        </div>
                        <ProgressBar value={progressInfo.percent} />

                        <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                          <Clock size={12} /> {progressInfo.statusLabel}
                        </div>
                      </div>

                      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              className="ta-btn ta-btn-ghost ta-btn-sm"
                              style={{ padding: "4px 6px" }}
                              title="Duplicate Cohort"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmModal({ cohort: c, action: "duplicate" });
                                setDuplicateName(`${c.name} (Copy)`);
                              }}
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              className="ta-btn ta-btn-ghost ta-btn-sm"
                              style={{ padding: "4px 6px", color: "var(--danger)" }}
                              title="Delete or Archive Cohort"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmModal({ cohort: c, action: "delete" });
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          <button
                            className="ta-btn ta-btn-primary ta-btn-sm"
                            style={{ fontSize: 11.5, padding: "4px 10px" }}
                            onClick={() => onOpenCohort?.(c.id)}
                          >
                            Manage <ArrowRight size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Create Cohort Modal */}
            <PortalModal
              isOpen={newCohortOpen}
              onClose={() => setNewCohortOpen(false)}
              maxWidth={520}
              zIndex={9999}
            >
              <div className="ta-row ta-between">
                <div className="ta-title" style={{ fontSize: 18 }}>Create New Cohort</div>
                <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => setNewCohortOpen(false)}><X size={16} /></button>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 6, marginBottom: 14 }}>
                Set up a time-bound training cohort with automated elapsed pacing and schedule tracking.
              </p>

              <form onSubmit={handleCreateCohort}>
                <div className="ta-label">Cohort Name</div>
                <input
                  className="ta-input ta-mt6"
                  style={{ width: "100%", boxSizing: "border-box" }}
                  placeholder="e.g. CAP Cohort 3 — AI &amp; Product Batch"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus
                />

                <div className="ta-grid ta-grid-2 ta-mt12">
                  <div>
                    <div className="ta-label">Programme Type</div>
                    <select
                      className="ta-input ta-mt6"
                      value={programName}
                      onChange={e => setProgramName(e.target.value)}
                    >
                      {Object.values(PROGRAMME_TYPES).map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="ta-label">Trial Status</div>
                    <select
                      className="ta-input ta-mt6"
                      value={trialStatus}
                      onChange={e => setTrialStatus(e.target.value)}
                    >
                      <option value="none">Standard / None</option>
                      <option value="active">Active 6-Week Trial</option>
                    </select>
                  </div>
                </div>

                <div className="ta-grid ta-grid-2 ta-mt12">
                  <div>
                    <div className="ta-label">Start Date</div>
                    <input
                      type="date"
                      className="ta-input ta-mt6"
                      required
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="ta-label">End Date</div>
                    <input
                      type="date"
                      className="ta-input ta-mt6"
                      required
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="ta-row ta-gap10 ta-mt20" style={{ justifyContent: "flex-end" }}>
                  <button type="button" className="ta-btn ta-btn-outline" onClick={() => setNewCohortOpen(false)}>Cancel</button>
                  <button type="submit" className="ta-btn ta-btn-primary" disabled={saving}>
                    {saving ? "Saving..." : "Create Cohort"}
                  </button>
                </div>
              </form>
            </PortalModal>

            {/* Confirm Delete / Archive / Duplicate Modal */}
            {confirmModal && (
              <PortalModal
                isOpen={true}
                onClose={() => setConfirmModal(null)}
                maxWidth={440}
                zIndex={99999}
              >
                <div className="ta-row ta-between">
                  <div className="ta-title" style={{ fontSize: 17 }}>
                    {confirmModal.action === "duplicate" ? "Duplicate Cohort" : "Delete / Archive Cohort"}
                  </div>
                  <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => setConfirmModal(null)}><X size={16} /></button>
                </div>

                {confirmModal.action === "duplicate" ? (
                  <div className="ta-mt12">
                    <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 12 }}>
                      Create a duplicate copy of <strong>{confirmModal.cohort.name}</strong> with fresh schedules.
                    </p>
                    <div className="ta-label">New Cohort Name</div>
                    <input
                      className="ta-input ta-mt6"
                      value={duplicateName}
                      onChange={e => setDuplicateName(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="ta-mt12">
                    <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>
                      Are you sure you want to remove <strong>{confirmModal.cohort.name}</strong>?
                    </p>
                    <div style={{ background: "var(--surface-2)", padding: 12, borderRadius: 8, fontSize: 12, color: "var(--text-2)", marginTop: 8 }}>
                      <AlertTriangle size={14} color="#F59E0B" style={{ verticalAlign: "-2px", marginRight: 5 }} />
                      If this cohort has enrolled learners, it will be safely <strong>archived</strong> to preserve student certificates, assignments, and records. Empty cohorts will be deleted.
                    </div>
                  </div>
                )}

                <div className="ta-row ta-gap10 ta-mt20" style={{ justifyContent: "flex-end" }}>
                  <button className="ta-btn ta-btn-outline" onClick={() => setConfirmModal(null)}>Cancel</button>
                  <button
                    className={`ta-btn ${confirmModal.action === "duplicate" ? "ta-btn-primary" : "ta-btn-danger"}`}
                    disabled={actionBusy}
                    onClick={handleConfirmAction}
                  >
                    {actionBusy ? "Processing..." : confirmModal.action === "duplicate" ? "Duplicate Cohort" : "Confirm Delete / Archive"}
                  </button>
                </div>
              </PortalModal>
            )}
          </div>

          {/* Right Side Panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Cohort Milestones */}
            <div className="ta-card" style={{ padding: 20 }}>
              <div className="ta-row ta-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="ta-title" style={{ fontSize: 15 }}>Cohort Milestones</div>
                  <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Upcoming batch milestones &amp; deadlines</div>
                </div>
                <Layers size={16} color="var(--primary)" />
              </div>

              <div className="ta-col ta-gap12 ta-mt14">
                {sessionsQuery.loading && <div className="ta-empty">Loading milestone sessions...</div>}
                {!sessionsQuery.loading && upcomingSessions.length === 0 && (
                  <div className="ta-empty" style={{ padding: "16px 8px" }}>
                    No upcoming live cohort milestones scheduled yet.
                  </div>
                )}
                {upcomingSessions.map((s, idx) => (
                  <div key={s.id || idx} className="ta-row ta-between" style={{ padding: "10px 12px", background: "var(--surface-3)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                        {s.time || "Scheduled"} {s.mentor ? `• ${s.mentor}` : ""}
                      </div>
                    </div>
                    <Tag tone={s.status === "live" ? "danger" : "primary"}>
                      {s.status === "live" ? "Live Now" : "Live Session"}
                    </Tag>
                  </div>
                ))}
              </div>
            </div>

            {/* Cohort Discussion Feed & Announcement Composer */}
            <div className="ta-card" style={{ padding: 20 }}>
              <div className="ta-row ta-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="ta-title" style={{ fontSize: 15 }}>Cohort Announcements &amp; Discussion</div>
                  <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Post announcements into cohort stream</div>
                </div>
                <Tag tone="primary">Stream</Tag>
              </div>

              <div className="ta-col ta-gap10 ta-mt14">
                <textarea
                  className="ta-input"
                  rows={3}
                  placeholder="Broadcast an announcement to all active cohorts in your org..."
                  style={{ width: "100%", fontSize: 12.5, boxSizing: "border-box", resize: "vertical" }}
                  value={announcementText}
                  onChange={e => setAnnouncementText(e.target.value)}
                />
                <button
                  className="ta-btn ta-btn-primary ta-btn-sm"
                  style={{ alignSelf: "flex-end", height: 32, display: "inline-flex", alignItems: "center", gap: 6 }}
                  disabled={postingAnnouncement || !announcementText.trim()}
                  onClick={async () => {
                    if (!announcementText.trim() || !currentUserId) return;
                    const targets = cohorts.slice(0, 10);
                    if (targets.length === 0) {
                      showToast("No active cohorts to broadcast to.");
                      return;
                    }
                    setPostingAnnouncement(true);
                    try {
                      await Promise.all(
                        targets.map(c =>
                          createCohortPost({
                            cohortId: c.id,
                            authorId: currentUserId,
                            content: announcementText.trim(),
                            isAnnouncement: true,
                          }).catch(() => {})
                        )
                      );
                      setAnnouncementText("");
                      showToast(`Announcement posted to ${targets.length} cohort${targets.length === 1 ? "" : "s"}!`);
                    } catch {
                      showToast("Could not post announcement. Try again.");
                    } finally {
                      setPostingAnnouncement(false);
                    }
                  }}
                >
                  <Send size={13} /> {postingAnnouncement ? "Posting..." : "Post Announcement →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
