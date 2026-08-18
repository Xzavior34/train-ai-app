import React, { useState, useContext } from "react";
import { TopBar, Tag, ProgressBar, ToastContext } from "../components/PlatformUI.jsx";
import { Plus, Layers } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchCohortsWithStats, createCohort } from "../../lib/api/platform.js";

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
        right={<button className="ta-btn ta-btn-primary" onClick={() => setNewCohortOpen(true)}><Plus size={15} /> Create cohort</button>}
      />
      <div className="ta-content">
        <div className="ta-grid ta-grid-3">
          {cohortsQuery.loading && <div className="ta-empty">Loading cohorts...</div>}
          {!cohortsQuery.loading && cohorts.length === 0 && <div className="ta-empty">No cohorts created yet.</div>}
          {cohorts.map(c => {
            // cohorts has no `track` or `status` column in the shared schema
            // (only name/starts_at/ends_at/organization_id) - a fixed "Data &
            // AI" track tag and a hardcoded "Active" status previously showed
            // for every cohort regardless of reality. Course count is a real,
            // already-fetched number; "Active" vs "Completed" is honestly
            // derived from the real ends_at date instead.
            const isCompleted = c.endsAt && new Date(c.endsAt).getTime() < Date.now();
            return (
              <div
                key={c.id || c.name}
                className="ta-card"
                style={{ cursor: onOpenCohort ? "pointer" : "default" }}
                onClick={() => onOpenCohort?.(c.id)}
              >
                <div className="ta-row ta-between">
                  <Tag>{c.courses} course{c.courses === 1 ? "" : "s"}</Tag>
                  <Tag tone={isCompleted ? "warning" : "success"}>{isCompleted ? "Completed" : "Active"}</Tag>
                </div>
                <div style={{ fontWeight: 800, fontSize: 16, marginTop: 10 }}>{c.name}</div>
                <div className="ta-row ta-between ta-mt12" style={{ fontSize: 12, color: "var(--text-2)" }}>
                  <span>{c.members ?? c.learner_count ?? 0} members</span>
                  <span>{c.progress || 0}% complete</span>
                </div>
                <div className="ta-mt8"><ProgressBar value={c.progress || 0} /></div>
              </div>
            );
          })}
        </div>

        {newCohortOpen && (
          <div className="ta-card ta-mt16" style={{ borderColor: "var(--primary)" }}>
            <div className="ta-title">Create New Cohort</div>
            <input className="ta-input ta-mt12" placeholder="Cohort name (e.g. Q3 AI Batch)..." value={name} onChange={e => setName(e.target.value)} />
            <div className="ta-row ta-gap8 ta-mt12">
              <button className="ta-btn ta-btn-primary" onClick={async () => {
                if (!name.trim()) { showToast("Enter a cohort name first."); return; }
                if (!orgId) {
                  // The real, reported bug: this used to silently return
                  // here with zero feedback whenever orgId was missing -
                  // which is always true for a demo-mode account with no
                  // organization_id set, or a real account not yet linked
                  // to an org. Clicking "Save cohort" did nothing
                  // whatsoever, no error, no toast - looking exactly like
                  // a broken button rather than a config/demo-mode state.
                  showToast("You need to be part of an organization to create a cohort. This account isn't linked to one yet.");
                  return;
                }
                await createCohort({ organizationId: orgId, name: name.trim(), createdBy: currentUserId });
                setNewCohortOpen(false); setName("");
                cohortsQuery.refetch();
                showToast("Cohort created!");
              }}>Save cohort</button>
              <button className="ta-btn ta-btn-outline" onClick={() => setNewCohortOpen(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
