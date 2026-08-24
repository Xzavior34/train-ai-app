import React, { useState, useContext } from "react";
import { TopBar, Tag, ProgressBar, ToastContext, Avatar } from "../components/PlatformUI.jsx";
import { Plus, Layers, Users, Calendar, ArrowRight, X } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchCohortsWithStats, createCohort, fetchUpcomingOrgSessions, fetchOrgInstructorsMonitor } from "../../lib/api/platform.js";
import { PortalModal } from "../../components/common/PortalModal.jsx";

export function CohortsScreen({ orgId, onOpenCohort, orgSelector, setScreen, currentUserId }) {
  const showToast = useContext(ToastContext);
  const [newCohortOpen, setNewCohortOpen] = useState(false);
  const [name, setName] = useState("");
  const cohortsQuery = useSupabaseQuery(async () => orgId ? fetchCohortsWithStats(orgId) : [], [orgId]);
  const cohorts = cohortsQuery.data || [];
  // Both right-hand panels used to be literal arrays - three invented
  // "milestones" with relative dates that never advanced, and three invented
  // instructors whose "View" button jumped to People where those names don't
  // exist. Both now read the same real tables the rest of the admin area does.
  const sessionsQuery = useSupabaseQuery(async () => orgId ? fetchUpcomingOrgSessions(orgId) : [], [orgId]);
  const sessions = sessionsQuery.data || [];
  const instructorsQuery = useSupabaseQuery(async () => orgId ? fetchOrgInstructorsMonitor(orgId) : [], [orgId]);
  const instructors = (instructorsQuery.data || []).filter((i) => i.is_active);

  return (
    <div className="ta-fade">
      <TopBar
        title="Cohort Management" sub="Active learning batches & timeline progress"
        orgSelector={orgSelector}
        onNavigate={setScreen}
        right={<button className="ta-btn ta-btn-primary" onClick={() => setNewCohortOpen(true)}><Plus size={15} /> Create cohort</button>}
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* =========================================================================
            COHORT DASHBOARD HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner">
          {/* Background Stock Photo with Overlay */}
          <img
            src="https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1400&auto=format&fit=crop&q=85"
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

          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">
                Cohort Governance &amp; Pacing
              </h1>
              <p className="ta-hero-desc">
                Manage batch schedules, enrollment windows, and student milestones.
              </p>
            </div>
          </div>
        </div>

        <div className="ta-sidebar-layout">

          {/* Main Left Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              {cohortsQuery.loading && <div className="ta-empty">Loading cohorts...</div>}
              {!cohortsQuery.loading && cohorts.length === 0 && <div className="ta-empty">No cohorts created yet. Click "Create cohort" above to launch your first batch.</div>}
              {cohorts.map((c, idx) => {
                const isCompleted = c.endsAt && new Date(c.endsAt).getTime() < Date.now();
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
                    style={{ cursor: onOpenCohort ? "pointer" : "default", borderRadius: 16, padding: 0, overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", flexDirection: "column" }}
                    onClick={() => onOpenCohort?.(c.id)}
                  >
                    <div style={{ position: "relative", width: "100%", height: 120, overflow: "hidden" }}>
                      <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(15,23,42,0.15) 0%, rgba(15,23,42,0.75) 100%)" }} />
                      <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", justifyContent: "space-between" }}>
                        <Tag tone="primary">{c.courses || 0} course{c.courses === 1 ? "" : "s"}</Tag>
                        <Tag tone={isCompleted ? "warning" : "success"}>{isCompleted ? "Completed" : "Active Batch"}</Tag>
                      </div>
                      <div style={{ position: "absolute", bottom: 8, left: 12, right: 12, color: "#FFFFFF", fontWeight: 800, fontSize: 15, textShadow: "0 2px 4px rgba(0,0,0,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.name}
                      </div>
                    </div>

                    <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
                      <div className="ta-row ta-between" style={{ fontSize: 12, color: "var(--text-2)" }}>
                        <span className="ta-row ta-gap6"><Users size={13} color="var(--primary)" /> {c.members ?? c.learner_count ?? 0} active members</span>
                        <span style={{ fontWeight: 700, color: "var(--primary)" }}>{c.progress || 0}%</span>
                      </div>
                      <div className="ta-mt8"><ProgressBar value={c.progress || 0} /></div>
                      <div className="ta-row ta-between ta-mt12" style={{ paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 11.5, color: "var(--text-3)" }}>
                        {/* Was the fixed string "Schedule: Active" on every card,
                            including cohorts this same component had already
                            computed as finished. c.start/c.end are the real
                            starts_at/ends_at from fetchCohortsWithStats. */}
                        <span>{isCompleted ? `Ended ${c.end}` : `Schedule: ${c.start} → ${c.end}`}</span>
                        <span style={{ fontWeight: 700, color: "var(--primary)", display: "flex", alignItems: "center", gap: 3 }}>Manage Batch <ArrowRight size={12} /></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <PortalModal
              isOpen={newCohortOpen}
              onClose={() => setNewCohortOpen(false)}
              maxWidth={480}
              zIndex={9999}
            >
              <div className="ta-row ta-between">
                <div className="ta-title" style={{ fontSize: 18 }}>Create New Cohort</div>
                <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => setNewCohortOpen(false)}><X size={16} /></button>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 6, marginBottom: 14 }}>
                Set up a new synchronous learning batch for your organization.
              </p>
              <div className="ta-label">Cohort Name</div>
              <input
                className="ta-input ta-mt6"
                style={{ width: "100%", boxSizing: "border-box" }}
                placeholder="e.g. Q3 Generative AI Engineering Batch"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
              <div className="ta-row ta-gap10 ta-mt20" style={{ justifyContent: "flex-end" }}>
                <button className="ta-btn ta-btn-outline" onClick={() => setNewCohortOpen(false)}>Cancel</button>
                <button
                  className="ta-btn ta-btn-primary"
                  onClick={async () => {
                    if (!name.trim()) { showToast("Enter a cohort name first."); return; }
                    if (!orgId) {
                      showToast("You need to be part of an organization to create a cohort. This account isn't linked to one yet.");
                      return;
                    }
                    await createCohort({ organizationId: orgId, name: name.trim(), createdBy: currentUserId });
                    setNewCohortOpen(false); setName("");
                    cohortsQuery.refetch();
                    showToast("Cohort created successfully!");
                  }}
                >
                  Save Cohort
                </button>
              </div>
            </PortalModal>
          </div>

          {/* Right Side Panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Cohort Milestones */}
            <div className="ta-card" style={{ padding: 20, borderRadius: 16 }}>
              <div className="ta-row ta-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="ta-title" style={{ fontSize: 15 }}>Cohort Milestones</div>
                  <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Upcoming batch milestones & deadlines</div>
                </div>
                <Layers size={16} color="var(--primary)" />
              </div>

              {/* Real scheduled sessions for this org's instructors
                  (fetchUpcomingOrgSessions -> mentorship_sessions). The three
                  literals here were identical for every organization, with
                  "Tomorrow"/"Friday"/"Next Week" dates that never moved. */}
              <div className="ta-col ta-gap12 ta-mt14">
                {sessionsQuery.loading && <div className="ta-empty">Loading milestones...</div>}
                {!sessionsQuery.loading && sessions.length === 0 && (
                  <div className="ta-empty">No sessions scheduled for this organization yet.</div>
                )}
                {sessions.map((m, idx) => {
                  const when = m.time || (m.scheduled_at ? new Date(m.scheduled_at).toLocaleString() : "Time not set");
                  const who = m.mentor || m.mentor_name || null;
                  const isLive = m.status === "live" || m.status === "live_now";
                  return (
                    <div key={m.id || idx} className="ta-row ta-between" style={{ padding: "10px 12px", background: "var(--surface-3)", borderRadius: 12, border: "1px solid var(--border)" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{m.title}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{who ? `${who} • ${when}` : when}</div>
                      </div>
                      <Tag tone={isLive ? "danger" : "primary"}>{isLive ? "Live now" : "Scheduled"}</Tag>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Assigned Facilitators */}
            <div className="ta-card" style={{ padding: 20, borderRadius: 16 }}>
              <div className="ta-row ta-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="ta-title" style={{ fontSize: 15 }}>Lead Instructors</div>
                  <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Active cohort mentors</div>
                </div>
                {/* Was a hardcoded "3 Active" regardless of how many instructors
                    the org actually had. */}
                <Tag tone="success">{instructorsQuery.loading ? "..." : `${instructors.length} Active`}</Tag>
              </div>

              {/* Real active mentors rows for this organization
                  (fetchOrgInstructorsMonitor - the same source the People >
                  Instructor Monitor tab uses), so "View" now leads to people who
                  actually appear in the directory. The three literal instructors
                  with stock headshots are gone; where a mentor has no avatar the
                  shared initials Avatar is used instead of a stock photo. */}
              <div className="ta-col ta-gap10 ta-mt14">
                {instructorsQuery.loading && <div className="ta-empty">Loading instructors...</div>}
                {!instructorsQuery.loading && instructors.length === 0 && (
                  <div className="ta-empty">No active instructors in this organization yet.</div>
                )}
                {instructors.map((ins, idx) => (
                  <div key={ins.id || idx} className="ta-row ta-between" style={{ padding: "8px 10px", background: "var(--surface-3)", borderRadius: 10 }}>
                    <div className="ta-row ta-gap10">
                      <Avatar
                        initials={(ins.display_name || "I").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                        size={32}
                        src={ins.avatar_url || undefined}
                        style={{ borderRadius: 10 }}
                      />
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{ins.display_name || "Instructor"}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{ins.specialization || ins.expertise || "Specialization not set"}</div>
                      </div>
                    </div>
                    <button className="ta-btn ta-btn-outline ta-btn-sm" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setScreen?.("people")}>
                      View
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
