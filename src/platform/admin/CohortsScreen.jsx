import React, { useState, useContext } from "react";
import { TopBar, Tag, ProgressBar, ToastContext } from "../components/PlatformUI.jsx";
import { Plus, Layers } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchCohortsWithStats, createCohort } from "../../lib/api/platform.js";

export function CohortsScreen({ orgId, onOpenCohort, orgSelector, setScreen }) {
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
          {cohorts.map(c => (
            <div
              key={c.id || c.name}
              className="ta-card"
              style={{ cursor: onOpenCohort ? "pointer" : "default" }}
              onClick={() => onOpenCohort?.(c.id)}
            >
              <div className="ta-row ta-between">
                <Tag>{c.track || "Data & AI"}</Tag>
                <Tag tone="success">Active</Tag>
              </div>
              <div style={{ fontWeight: 800, fontSize: 16, marginTop: 10 }}>{c.name}</div>
              <div className="ta-row ta-between ta-mt12" style={{ fontSize: 12, color: "var(--text-2)" }}>
                <span>{c.members ?? c.learner_count ?? 0} members</span>
                <span>{c.progress || 0}% complete</span>
              </div>
              <div className="ta-mt8"><ProgressBar value={c.progress || 0} /></div>
            </div>
          ))}
        </div>

        {newCohortOpen && (
          <div className="ta-card ta-mt16" style={{ borderColor: "var(--primary)" }}>
            <div className="ta-title">Create New Cohort</div>
            <input className="ta-input ta-mt12" placeholder="Cohort name (e.g. Q3 AI Batch)..." value={name} onChange={e => setName(e.target.value)} />
            <div className="ta-row ta-gap8 ta-mt12">
              <button className="ta-btn ta-btn-primary" onClick={async () => {
                if (!name.trim() || !orgId) return;
                await createCohort({ organizationId: orgId, name: name.trim() });
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
