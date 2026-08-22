import React, { useState, useContext } from "react";
import { TopBar, Tag, ProgressBar, ToastContext } from "../components/PlatformUI.jsx";
import { Plus, Layers, Users, Calendar, ArrowRight, X } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchCohortsWithStats, createCohort } from "../../lib/api/platform.js";
import { PortalModal } from "../../components/common/PortalModal.jsx";

export function CohortsScreen({ orgId, onOpenCohort, orgSelector, setScreen, currentUserId }) {
  const showToast = useContext(ToastContext);
  const [newCohortOpen, setNewCohortOpen] = useState(false);
  const [name, setName] = useState("");
  const cohortsQuery = useSupabaseQuery(async () => orgId ? fetchCohortsWithStats(orgId) : [], [orgId]);
  const cohorts = cohortsQuery.data || [];

  return (
    <div className="ta-fade">
      <TopBar
        title="Cohort Management" sub="Active learning batches & timeline progress"
        orgSelector={orgSelector}
        onNavigate={setScreen}
        right={
          <button
            className="ta-btn ta-btn-primary"
            style={{ height: 34, padding: "0 12px", borderRadius: 8, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 5 }}
            onClick={() => setNewCohortOpen(true)}
          >
            <Plus size={14} /> Create cohort
          </button>
        }
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* =========================================================================
            COHORT DASHBOARD HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner">

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
                    style={{ cursor: onOpenCohort ? "pointer" : "default", borderRadius: 10, padding: 0, overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", flexDirection: "column" }}
                    onClick={() => onOpenCohort?.(c.id)}
                  >
                    <div style={{ position: "relative", width: "100%", height: 120, overflow: "hidden" }}>
                      <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(15,23,42,0.15) 0%, rgba(15,23,42,0.75) 100%)" }} />
                      <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", justifyContent: "space-between" }}>
                        <Tag tone="primary">{c.courses || 0} course{c.courses === 1 ? "" : "s"}</Tag>
                        <Tag tone={isCompleted ? "warning" : "success"}>{isCompleted ? "Completed" : "Active Batch"}</Tag>
                      </div>
                      <div style={{ position: "absolute", bottom: 8, left: 12, right: 12, color: "#FFFFFF", fontWeight: 800, fontSize: 14.5, textShadow: "0 2px 4px rgba(0,0,0,0.6)", lineHeight: 1.25, wordBreak: "break-word" }}>
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
                        <span>Schedule: Active</span>
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
            <div className="ta-card" style={{ padding: 20 }}>
              <div className="ta-row ta-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="ta-title" style={{ fontSize: 15 }}>Cohort Milestones</div>
                  <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Upcoming batch milestones & deadlines</div>
                </div>
                <Layers size={16} color="var(--primary)" />
              </div>

              <div className="ta-col ta-gap12 ta-mt14">
                {[
                  { title: "Module 4 Design Critique", date: "Tomorrow • 6:00 PM", status: "Live Review", tone: "primary" },
                  { title: "Mid-Term Capstone Submissions", date: "Friday • 11:59 PM", status: "Deadline", tone: "danger" },
                  { title: "Industry Pitch & Demo Day", date: "Next Week • 4:00 PM", status: "Demo Day", tone: "success" }
                ].map((m, idx) => (
                  <div key={idx} className="ta-row ta-between" style={{ padding: "10px 12px", background: "var(--surface-3)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{m.title}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{m.date}</div>
                    </div>
                    <Tag tone={m.tone}>{m.status}</Tag>
                  </div>
                ))}
              </div>
            </div>

            {/* Assigned Facilitators */}
            <div className="ta-card" style={{ padding: 20 }}>
              <div className="ta-row ta-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="ta-title" style={{ fontSize: 15 }}>Lead Instructors</div>
                  <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>Active cohort mentors</div>
                </div>
                <Tag tone="success">3 Active</Tag>
              </div>

              <div className="ta-col ta-gap10 ta-mt14">
                {[
                  { name: "Astrid Larsson", track: "UI/UX & Design Systems", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80" },
                  { name: "Alex Rivera", track: "Generative AI Workflows", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80" },
                  { name: "Sarah Jenkins", track: "DevOps & Cloud Architecture", avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80" }
                ].map((ins, idx) => (
                  <div key={idx} className="ta-row ta-between" style={{ padding: "8px 10px", background: "var(--surface-3)", borderRadius: 10 }}>
                    <div className="ta-row ta-gap10">
                      <img src={ins.avatar} alt={ins.name} style={{ width: 32, height: 32, borderRadius: 10, objectFit: "cover" }} />
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{ins.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{ins.track}</div>
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
