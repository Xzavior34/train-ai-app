import React, { useState, useEffect } from "react";
import {
  Activity, CheckCircle2, Clock, AlertTriangle, PlayCircle,
  Filter, Plus, RefreshCw, Calendar, User, Edit3, X, Check
} from "lucide-react";
import { fetchKpiActivities, updateKpiActivityStatus, createKpiActivity } from "../../lib/api/kpi.js";
import { KPI_STATUSES } from "../../lib/constants/terminology.js";

const STATUS_CONFIG = {
  [KPI_STATUSES.COMPLETED]: {
    color: "#10B981",
    bg: "rgba(16, 185, 129, 0.1)",
    border: "rgba(16, 185, 129, 0.25)",
    icon: CheckCircle2,
  },
  [KPI_STATUSES.IN_PROGRESS]: {
    color: "#2563EB",
    bg: "rgba(37, 99, 235, 0.1)",
    border: "rgba(37, 99, 235, 0.25)",
    icon: PlayCircle,
  },
  [KPI_STATUSES.NOT_STARTED]: {
    color: "#64748B",
    bg: "rgba(100, 116, 139, 0.1)",
    border: "rgba(100, 116, 139, 0.25)",
    icon: Clock,
  },
  [KPI_STATUSES.BLOCKED]: {
    color: "#EF4444",
    bg: "rgba(239, 68, 68, 0.1)",
    border: "rgba(239, 68, 68, 0.25)",
    icon: AlertTriangle,
  },
};

export function KPITrackerCard({ organizationId, showToast }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  
  // Edit / Update Modal
  const [editingKpi, setEditingKpi] = useState(null);
  const [editStatus, setEditStatus] = useState("");
  const [editProgress, setEditProgress] = useState(0);
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // New Activity Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Operations");
  const [newOwner, setNewOwner] = useState("Train AI Operations");
  const [newTarget, setNewTarget] = useState("");
  const [newMonth, setNewMonth] = useState("2026-10");

  async function loadData() {
    setLoading(true);
    try {
      const data = await fetchKpiActivities({ organizationId, monthYear: selectedMonth });
      setActivities(data);
    } catch (e) {
      console.warn("Could not load KPI activities:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [organizationId, selectedMonth]);

  const filtered = activities.filter((k) => {
    if (selectedStatus !== "all" && k.status !== selectedStatus) return false;
    if (selectedCategory !== "all" && k.category !== selectedCategory) return false;
    return true;
  });

  const completedCount = activities.filter((k) => k.status === KPI_STATUSES.COMPLETED).length;
  const inProgressCount = activities.filter((k) => k.status === KPI_STATUSES.IN_PROGRESS).length;
  const totalCount = activities.length || 1;
  const overallCompletionRate = Math.round((completedCount / totalCount) * 100);

  async function handleSaveStatus(e) {
    e.preventDefault();
    if (!editingKpi) return;
    setSaving(true);
    try {
      await updateKpiActivityStatus(editingKpi.id, {
        status: editStatus,
        progressPercent: Number(editProgress),
        notes: editNotes,
      });
      if (showToast) showToast(`Updated "${editingKpi.title}"`);
      setEditingKpi(null);
      await loadData();
    } catch {
      if (showToast) showToast("Failed to update activity.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateActivity(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      await createKpiActivity({
        title: newTitle.trim(),
        category: newCategory,
        ownerName: newOwner.trim(),
        targetMetric: newTarget.trim(),
        monthYear: newMonth,
        organizationId,
      });
      if (showToast) showToast("New KPI activity created.");
      setCreateOpen(false);
      setNewTitle("");
      setNewTarget("");
      await loadData();
    } catch {
      if (showToast) showToast("Failed to create activity.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        background: "var(--bg-card, #FFFFFF)",
        border: "1.5px solid var(--border, #E2E8F0)",
        borderRadius: 14,
        padding: "20px 24px",
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 38, height: 38, borderRadius: 10,
              background: "rgba(37,99,235,0.08)", color: "#2563EB",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Activity size={20} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)" }}>
              Monthly KPI &amp; Activity Tracker
            </div>
            <div style={{ fontSize: 12, color: "var(--text-2)" }}>
              Tracking monthly milestones, team ownership, and operational deliverables
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            className="ta-btn ta-btn-outline ta-btn-sm"
            onClick={loadData}
            title="Refresh tracker"
          >
            <RefreshCw size={13} className={loading ? "spin" : ""} /> Refresh
          </button>
          <button
            className="ta-btn ta-btn-primary ta-btn-sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={14} /> Add Activity
          </button>
        </div>
      </div>

      {/* Overview Stat Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 16,
          padding: "12px 16px",
          background: "var(--surface-2, #F8FAFC)",
          borderRadius: 10,
          border: "1px solid var(--border)",
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>Completion Rate</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#2563EB", marginTop: 2 }}>{overallCompletionRate}%</div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>Completed</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#10B981", marginTop: 2 }}>{completedCount} <span style={{ fontSize: 12, color: "var(--text-3)" }}>tasks</span></div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>In Progress</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#2563EB", marginTop: 2 }}>{inProgressCount} <span style={{ fontSize: 12, color: "var(--text-3)" }}>active</span></div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>Total Tracked</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", marginTop: 2 }}>{activities.length} <span style={{ fontSize: 12, color: "var(--text-3)" }}>total</span></div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Calendar size={13} color="var(--text-3)" />
          <select
            className="ta-input"
            style={{ width: "auto", padding: "5px 10px", fontSize: 12 }}
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            <option value="all">All Months</option>
            <option value="2026-09">September 2026</option>
            <option value="2026-10">October 2026 (Current)</option>
            <option value="2026-11">November 2026</option>
            <option value="2026-12">December 2026</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Filter size={13} color="var(--text-3)" />
          <select
            className="ta-input"
            style={{ width: "auto", padding: "5px 10px", fontSize: 12 }}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value={KPI_STATUSES.IN_PROGRESS}>In Progress</option>
            <option value={KPI_STATUSES.COMPLETED}>Completed</option>
            <option value={KPI_STATUSES.NOT_STARTED}>Not Started</option>
            <option value={KPI_STATUSES.BLOCKED}>Blocked</option>
          </select>
        </div>
      </div>

      {/* Activities Table */}
      <div className="ta-table-wrap">
        <table className="ta-table">
          <thead>
            <tr>
              <th>Activity / Deliverable</th>
              <th>Month</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Target vs Current</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="ta-empty">Loading KPI activities...</td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="ta-empty">No activities matching current filter.</td>
              </tr>
            )}
            {!loading && filtered.map((kpi) => {
              const cfg = STATUS_CONFIG[kpi.status] || STATUS_CONFIG[KPI_STATUSES.NOT_STARTED];
              const Icon = cfg.icon;

              return (
                <tr key={kpi.id}>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{kpi.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{kpi.category}</div>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-2)" }}>
                      {kpi.month_year}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text)" }}>
                      <User size={12} color="var(--text-3)" />
                      {kpi.owner_name}
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: cfg.color,
                        background: cfg.bg,
                        border: `1px solid ${cfg.border}`,
                      }}
                    >
                      <Icon size={12} /> {kpi.status}
                    </span>
                  </td>
                  <td style={{ minWidth: 120 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${kpi.progress_percent || 0}%`,
                            background: cfg.color,
                            borderRadius: 3,
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text)" }}>
                        {kpi.progress_percent}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                      {kpi.current_metric || "—"} <span style={{ color: "var(--text-3)", fontWeight: 400 }}>/ {kpi.target_metric || "100%"}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="ta-btn ta-btn-outline ta-btn-sm"
                      style={{ fontSize: 11.5, padding: "3px 8px" }}
                      onClick={() => {
                        setEditingKpi(kpi);
                        setEditStatus(kpi.status);
                        setEditProgress(kpi.progress_percent);
                        setEditNotes(kpi.notes || "");
                      }}
                    >
                      <Edit3 size={12} /> Update Status
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Update Status Modal */}
      {editingKpi && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 12,
              padding: 24,
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#10142A" }}>Update Activity Status</div>
              <button
                style={{ border: "none", background: "none", cursor: "pointer" }}
                onClick={() => setEditingKpi(null)}
              >
                <X size={18} color="#64748B" />
              </button>
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: "#2563EB", marginBottom: 16 }}>
              {editingKpi.title}
            </div>

            <form onSubmit={handleSaveStatus}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                Status
              </label>
              <select
                className="ta-input"
                style={{ marginTop: 4, marginBottom: 14 }}
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
              >
                <option value={KPI_STATUSES.NOT_STARTED}>Not Started</option>
                <option value={KPI_STATUSES.IN_PROGRESS}>In Progress</option>
                <option value={KPI_STATUSES.COMPLETED}>Completed</option>
                <option value={KPI_STATUSES.BLOCKED}>Blocked</option>
              </select>

              <label style={{ fontSize: 11.5, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                Progress Percentage ({editProgress}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={editProgress}
                onChange={(e) => setEditProgress(Number(e.target.value))}
                style={{ width: "100%", marginTop: 6, marginBottom: 14 }}
              />

              <label style={{ fontSize: 11.5, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                Notes / Operational Remarks
              </label>
              <textarea
                className="ta-input"
                rows={3}
                style={{ marginTop: 4, marginBottom: 16, resize: "vertical" }}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add latest update or blocker details..."
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  className="ta-btn ta-btn-ghost ta-btn-sm"
                  onClick={() => setEditingKpi(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ta-btn ta-btn-primary ta-btn-sm"
                  disabled={saving}
                >
                  {saving ? "Saving..." : <><Check size={14} /> Save Status</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Activity Modal */}
      {createOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 12,
              padding: 24,
              maxWidth: 480,
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#10142A" }}>Add Monthly KPI Activity</div>
              <button
                style={{ border: "none", background: "none", cursor: "pointer" }}
                onClick={() => setCreateOpen(false)}
              >
                <X size={18} color="#64748B" />
              </button>
            </div>

            <form onSubmit={handleCreateActivity}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                Activity Title
              </label>
              <input
                className="ta-input"
                style={{ marginTop: 4, marginBottom: 12 }}
                placeholder="e.g. October Cohort Graduation & Demo Day"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                    Category
                  </label>
                  <select
                    className="ta-input"
                    style={{ marginTop: 4 }}
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  >
                    <option value="Operations">Operations</option>
                    <option value="Learner Acquisition">Learner Acquisition</option>
                    <option value="Curriculum Delivery">Curriculum Delivery</option>
                    <option value="Placement">Placement</option>
                    <option value="Monetization">Monetization</option>
                    <option value="Infrastructure">Infrastructure</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                    Target Month
                  </label>
                  <select
                    className="ta-input"
                    style={{ marginTop: 4 }}
                    value={newMonth}
                    onChange={(e) => setNewMonth(e.target.value)}
                  >
                    <option value="2026-09">September 2026</option>
                    <option value="2026-10">October 2026</option>
                    <option value="2026-11">November 2026</option>
                    <option value="2026-12">December 2026</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                    Owner / Team
                  </label>
                  <input
                    className="ta-input"
                    style={{ marginTop: 4 }}
                    value={newOwner}
                    onChange={(e) => setNewOwner(e.target.value)}
                    placeholder="e.g. Lead Trainer"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                    Target Metric
                  </label>
                  <input
                    className="ta-input"
                    style={{ marginTop: 4 }}
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                    placeholder="e.g. 50 Graduates"
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  className="ta-btn ta-btn-ghost ta-btn-sm"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ta-btn ta-btn-primary ta-btn-sm"
                  disabled={saving}
                >
                  {saving ? "Creating..." : <><Plus size={14} /> Create Activity</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
