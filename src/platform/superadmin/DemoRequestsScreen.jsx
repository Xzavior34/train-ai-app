import React, { useState, useMemo } from "react";
import {
  TopBar,
  exportRowsAsCsv,
  Tag,
} from "../components/PlatformUI.jsx";
import {
  Calendar,
  Clock,
  Mail,
  Building2,
  Users,
  Search,
  Download,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Filter,
  RefreshCw,
  MessageSquare,
  Globe,
  UserCheck,
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { getSupabaseClientForProject, SUPABASE_PROJECTS, supabase } from "../../services/supabaseClient.js";
import { Skeleton, SkeletonCard } from "../../components/common/Skeleton.jsx";

function getDemoClient() {
  return getSupabaseClientForProject(SUPABASE_PROJECTS.ORGANIZATION_DB) || supabase;
}

export async function fetchAllDemoRequests() {
  const map = new Map();

  // 1. Fetch from database
  const db = getDemoClient();
  if (db) {
    try {
      const { data, error } = await db
        .from("demo_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const key = row.id || `${row.work_email}_${row.created_at}`;
          map.set(key, row);
        }
      }
    } catch (err) {
      console.warn("fetchDemoRequests warning:", err);
    }
  }

  // 2. Merge local storage demo requests
  try {
    const localRaw = localStorage.getItem("trainai_demo_requests_v1");
    if (localRaw) {
      const localList = JSON.parse(localRaw);
      for (const row of localList) {
        const key = row.id || `${row.work_email}_${row.created_at}`;
        if (!map.has(key)) {
          map.set(key, row);
        }
      }
    }
  } catch {}

  const all = Array.from(map.values());
  all.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  return all;
}

export async function updateDemoRequestStatus(id, newStatus) {
  // Update local storage backup
  try {
    const localRaw = localStorage.getItem("trainai_demo_requests_v1");
    if (localRaw) {
      const localList = JSON.parse(localRaw);
      const updated = localList.map((item) => item.id === id ? { ...item, status: newStatus } : item);
      localStorage.setItem("trainai_demo_requests_v1", JSON.stringify(updated));
    }
  } catch {}

  const db = getDemoClient();
  if (!db) return { id, status: newStatus };
  try {
    const { data, error } = await db
      .from("demo_requests")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) console.warn("updateDemoRequestStatus DB notice:", error);
    return data || { id, status: newStatus };
  } catch (err) {
    console.warn("updateDemoRequestStatus caught:", err);
    return { id, status: newStatus };
  }
}

export function DemoRequestsScreen({ orgSelector }) {
  const [filterStatus, setFilterStatus] = useState("all"); // "all" | "scheduled" | "new" | "contacted" | "closed"
  const [searchQuery, setSearchQuery] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

  const demoRequestsQuery = useSupabaseQuery(async () => fetchAllDemoRequests(), []);
  const allRequests = demoRequestsQuery.data || [];
  const loading = demoRequestsQuery.loading;

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return allRequests.filter((item) => {
      if (filterStatus !== "all") {
        if (filterStatus === "scheduled" && item.status !== "scheduled" && !item.scheduled_date) return false;
        if (filterStatus === "new" && item.status !== "new") return false;
        if (filterStatus === "contacted" && item.status !== "contacted") return false;
        if (filterStatus === "closed" && item.status !== "closed") return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (item.full_name || "").toLowerCase().includes(q);
        const emailMatch = (item.work_email || "").toLowerCase().includes(q);
        const companyMatch = (item.company_name || "").toLowerCase().includes(q);
        const messageMatch = (item.message || "").toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !companyMatch && !messageMatch) return false;
      }
      return true;
    });
  }, [allRequests, filterStatus, searchQuery]);

  // Quick KPI metrics
  const stats = useMemo(() => {
    const total = allRequests.length;
    const scheduled = allRequests.filter((r) => r.status === "scheduled" || r.scheduled_date).length;
    const newInquiries = allRequests.filter((r) => r.status === "new" || !r.status).length;
    const closed = allRequests.filter((r) => r.status === "closed").length;
    return { total, scheduled, newInquiries, closed };
  }, [allRequests]);

  async function handleStatusChange(id, newStatus) {
    setStatusUpdatingId(id);
    try {
      await updateDemoRequestStatus(id, newStatus);
      demoRequestsQuery.refetch?.();
      setActionNotice(`Status updated to "${newStatus}".`);
      setTimeout(() => setActionNotice(null), 2500);
    } catch (err) {
      console.warn("Status update failed:", err);
      setActionNotice("Could not update status. Please try again.");
      setTimeout(() => setActionNotice(null), 3000);
    } finally {
      setStatusUpdatingId(null);
    }
  }

  function handleExportCsv() {
    if (!filteredRequests.length) return;
    exportRowsAsCsv(
      "train-ai-demo-requests.csv",
      filteredRequests.map((r) => ({
        fullName: r.full_name || "",
        workEmail: r.work_email || "",
        organization: r.company_name || "",
        orgType: r.org_type || "",
        teamSize: r.team_size || "",
        scheduledDate: r.scheduled_date || "",
        scheduledTime: r.scheduled_time || "",
        timezone: r.timezone || "",
        status: r.status || "new",
        source: r.source || "",
        createdAt: r.created_at ? new Date(r.created_at).toLocaleString() : "",
        notes: r.message || "",
      }))
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <TopBar
        title="Institutional Demo & Appointment Requests"
        sub="Review incoming booking requests, scheduled institutional walkthroughs, and attendee details."
        orgSelector={orgSelector}
      />

      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Top Header Card */}
        <div className="ta-hero-banner anim-fluid-entrance">
          <div className="tai-glow-cobalt" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">Inbound Demos &amp; Walkthrough Pipeline</h1>
              <p className="ta-hero-desc">
                Real-time booking submissions from educational institutions, non-profits, and corporate enterprises.
              </p>
            </div>
            <div className="ta-hero-actions">
              <button
                className="ta-btn ta-btn-primary"
                style={{
                  background: "#2563EB",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  height: 36,
                  padding: "0 16px",
                  borderRadius: 8,
                  border: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                }}
                onClick={handleExportCsv}
                disabled={!filteredRequests.length}
              >
                <Download size={14} /> Export Requests (CSV)
              </button>
            </div>
          </div>
        </div>

        {/* Action Notice Toast */}
        {actionNotice && (
          <div
            style={{
              padding: "10px 14px",
              background: "#EFF6FF",
              border: "1px solid #BFDBFE",
              color: "#1D4ED8",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <CheckCircle2 size={16} /> {actionNotice}
          </div>
        )}

        {/* KPI Metric Cards */}
        <div className="ta-grid ta-grid-4 anim-stagger">
          <div className="ta-card" style={{ padding: 18 }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Total Inbound</span>
              <Calendar size={18} color="#2563EB" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>
              {loading ? "..." : stats.total}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 4 }}>All logged demo requests</div>
          </div>

          <div className="ta-card" style={{ padding: 18 }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Scheduled Sessions</span>
              <Clock size={18} color="#10B981" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8, color: "#10B981" }}>
              {loading ? "..." : stats.scheduled}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 4 }}>Date &amp; time confirmed</div>
          </div>

          <div className="ta-card" style={{ padding: 18 }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>New Inquiries</span>
              <AlertCircle size={18} color="#F59E0B" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8, color: "#F59E0B" }}>
              {loading ? "..." : stats.newInquiries}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 4 }}>Awaiting first outreach</div>
          </div>

          <div className="ta-card" style={{ padding: 18 }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Closed / Completed</span>
              <CheckCircle2 size={18} color="#64748B" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8, color: "#64748B" }}>
              {loading ? "..." : stats.closed}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 4 }}>Onboarded or finished</div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div
          className="ta-card"
          style={{
            padding: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {/* Status Tabs */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { key: "all", label: "All Requests", count: stats.total },
              { key: "scheduled", label: "Scheduled", count: stats.scheduled },
              { key: "new", label: "New Inquiries", count: stats.newInquiries },
              { key: "closed", label: "Closed", count: stats.closed },
            ].map(({ key, label, count }) => {
              const isActive = filterStatus === key;
              return (
                <button
                  key={key}
                  onClick={() => setFilterStatus(key)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: isActive ? "1.5px solid #2563EB" : "1px solid var(--border)",
                    background: isActive ? "#EFF6FF" : "var(--surface)",
                    color: isActive ? "#1D4ED8" : "var(--text)",
                    fontWeight: isActive ? 700 : 500,
                    fontSize: 12.5,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{label}</span>
                  <span
                    style={{
                      background: isActive ? "#2563EB" : "var(--surface-3)",
                      color: isActive ? "#FFFFFF" : "var(--text-2)",
                      padding: "1px 6px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 260, flex: 1, maxWidth: 380 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "6px 10px",
                width: "100%",
                gap: 8,
              }}
            >
              <Search size={14} color="var(--text-3)" />
              <input
                type="text"
                placeholder="Search by name, email, or institution..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: "var(--text)",
                  fontSize: 12.5,
                  width: "100%",
                }}
              />
            </div>
            <button
              onClick={() => demoRequestsQuery.refetch?.()}
              style={{
                border: "1px solid var(--border)",
                background: "var(--surface)",
                padding: 7,
                borderRadius: 8,
                cursor: "pointer",
                color: "var(--text-2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Refresh list"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Main List */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} height={120} />
            ))}
          </div>
        )}

        {!loading && filteredRequests.length === 0 && (
          <div
            className="ta-card"
            style={{
              padding: "48px 24px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Calendar size={36} color="var(--text-3)" />
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>No demo requests found</div>
            <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, maxWidth: 440 }}>
              {searchQuery
                ? "No entries match your search query. Try searching with a different keyword."
                : "No demo requests logged under this status filter yet."}
            </p>
          </div>
        )}

        {!loading && filteredRequests.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {filteredRequests.map((req) => {
              const isScheduled = !!req.scheduled_date;
              const dateDisplay = req.scheduled_date
                ? new Date(req.scheduled_date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : null;

              return (
                <div
                  key={req.id}
                  className="ta-card ta-card-hover anim-fluid-entrance"
                  style={{
                    padding: "18px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    borderLeft: isScheduled ? "4px solid #2563EB" : "4px solid #F59E0B",
                  }}
                >
                  {/* Top Row: Applicant identity & Status */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: "50%",
                          background: "#EFF6FF",
                          color: "#2563EB",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                          fontWeight: 800,
                          flexShrink: 0,
                          border: "1px solid #DBEAFE",
                        }}
                      >
                        {(req.full_name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>
                            {req.full_name || "Anonymous Contact"}
                          </span>
                          {req.org_type && (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                background: "var(--surface-3)",
                                color: "var(--text-2)",
                                padding: "2px 8px",
                                borderRadius: 4,
                              }}
                            >
                              {req.org_type}
                            </span>
                          )}
                          {req.team_size && (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                background: "#F1F5F9",
                                color: "#475569",
                                padding: "2px 8px",
                                borderRadius: 4,
                              }}
                            >
                              <Users size={11} style={{ display: "inline", verticalAlign: "-1px", marginRight: 3 }} />
                              {req.team_size}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 600, color: "var(--text)" }}>{req.company_name}</span>
                          <span style={{ color: "var(--text-3)" }}>•</span>
                          <a
                            href={`mailto:${req.work_email}?subject=Train%20AI%20Demo%20Session%20Follow-up&body=Hi%20${encodeURIComponent(req.full_name || "")},%0A%0AThank%20you%20for%20scheduling%20an%20appointment%20with%20Train%20AI.%0A%0ABest%20regards,%0ATrain%20AI%20Team`}
                            style={{ color: "#2563EB", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            <Mail size={12} /> {req.work_email}
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Status Dropdown */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <select
                        value={req.status || "new"}
                        disabled={statusUpdatingId === req.id}
                        onChange={(e) => handleStatusChange(req.id, e.target.value)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          border: "1px solid var(--border)",
                          background: "var(--surface)",
                          color:
                            req.status === "scheduled"
                              ? "#10B981"
                              : req.status === "contacted"
                              ? "#2563EB"
                              : req.status === "closed"
                              ? "#64748B"
                              : "#F59E0B",
                          cursor: "pointer",
                        }}
                      >
                        <option value="new">New Inquiry</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="contacted">Contacted</option>
                        <option value="closed">Closed / Handled</option>
                      </select>
                    </div>
                  </div>

                  {/* Appointment Schedule Banner (if scheduled) */}
                  {isScheduled && (
                    <div
                      style={{
                        padding: "10px 14px",
                        background: "#EFF6FF",
                        border: "1px solid #BFDBFE",
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Calendar size={16} color="#2563EB" />
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#1E3A8A" }}>
                          Appointment: {dateDisplay} at {req.scheduled_time}
                        </span>
                        {req.timezone && (
                          <span style={{ fontSize: 11.5, color: "#3B82F6", fontWeight: 600 }}>
                            ({req.timezone})
                          </span>
                        )}
                      </div>
                      <a
                        href={`mailto:${req.work_email}?subject=Train%20AI%20Demo%20Confirmation%20-%20${encodeURIComponent(dateDisplay || "")}&body=Hi%20${encodeURIComponent(req.full_name || "")},%0A%0AWe%20are%20looking%20forward%20to%20our%2030-minute%20walkthrough%20session%20on%20${encodeURIComponent(dateDisplay || "")}%20at%20${encodeURIComponent(req.scheduled_time || "")}%20(${encodeURIComponent(req.timezone || "WAT")}).%0A%0AGoogle%20Meet%20link:%20https://meet.google.com%0A%0ABest,%0ATrain%20AI%20Team`}
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#2563EB",
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        Send Meeting Invite <ExternalLink size={12} />
                      </a>
                    </div>
                  )}

                  {/* Notes / Agenda */}
                  {req.message && (
                    <div style={{ background: "var(--surface-2)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 4 }}>
                        Applicant Agenda &amp; Questions:
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                        {req.message}
                      </div>
                    </div>
                  )}

                  {/* Footer: Date submitted & Attribution */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, color: "var(--text-3)", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                    <span>
                      Submitted: {req.created_at ? new Date(req.created_at).toLocaleString() : "Recently"}
                    </span>
                    {req.source && (
                      <span>
                        Source: <strong style={{ color: "var(--text-2)" }}>{req.source}</strong>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default DemoRequestsScreen;
