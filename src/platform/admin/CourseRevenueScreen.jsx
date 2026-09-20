import React, { useState, useContext, useMemo } from "react";
import { TopBar, ToastContext, Tag } from "../components/PlatformUI.jsx";
import { DollarSign, TrendingUp, RefreshCw, Download, BookOpen, AlertTriangle } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchOrgRevenueSummary, fetchOrgCourseRevenue } from "../../lib/api/revenue.js";

function fmt(value) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function exportCSV(rows) {
  if (!rows.length) return;
  const headers = ["Course Name", "Listed Price", "Enrollments", "Gross Revenue", "Platform Fee", "Net to Org"];
  const lines = rows.map((r) =>
    [
      `"${(r.course_name || "").replace(/"/g, '""')}"`,
      r.listed_price || 0,
      r.enrollment_count || 0,
      r.gross_revenue || 0,
      r.platform_fee || 0,
      r.net_to_org || 0,
    ].join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "course_revenue.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function CourseRevenueScreen({ orgId, orgSelector, setScreen }) {
  const showToast = useContext(ToastContext);

  const summaryQuery = useSupabaseQuery(
    async () => (orgId ? fetchOrgRevenueSummary(orgId) : null),
    [orgId]
  );
  const courseRevenueQuery = useSupabaseQuery(
    async () => (orgId ? fetchOrgCourseRevenue(orgId) : []),
    [orgId]
  );

  const summary = summaryQuery.data || { total_gross: 0, total_platform_fee: 0, total_net: 0, transaction_count: 0 };
  const courses = courseRevenueQuery.data || [];

  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return t ? courses.filter((c) => (c.course_name || "").toLowerCase().includes(t)) : courses;
  }, [courses, search]);

  function refresh() {
    summaryQuery.refetch();
    courseRevenueQuery.refetch();
  }

  return (
    <div className="ta-fade">
      <TopBar
        title="Course Revenue"
        sub="Track income from paid courses and platform commission"
        orgSelector={orgSelector}
        onNavigate={setScreen}
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Hero Banner */}
        <div className="ta-hero-banner anim-fluid-entrance">
          <div className="tai-glow-emerald" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">
                Course Revenue Dashboard
              </h1>
              <p className="ta-hero-desc">
                Real-time breakdown of learner payments for paid courses, platform commission deducted, and your organization's net earnings.
              </p>
            </div>
            <div className="ta-hero-actions">
              <button
                className="ta-btn ta-btn-outline"
                style={{ height: 36, padding: "0 14px", borderRadius: 8, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={refresh}
              >
                <RefreshCw size={13} /> Refresh
              </button>
              <button
                className="ta-btn ta-btn-outline"
                style={{ height: 36, padding: "0 14px", borderRadius: 8, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={() => { if (filtered.length === 0) { showToast("No data to export."); return; } exportCSV(filtered); }}
              >
                <Download size={13} /> Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="ta-grid ta-grid-4 anim-stagger">
          {[
            { label: "Total gross revenue", value: `$${fmt(summary.total_gross)}`, hint: "Learner payments before commission", Icon: DollarSign },
            { label: "Platform commission", value: `$${fmt(summary.total_platform_fee)}`, hint: "Deducted by Train AI", Icon: TrendingUp },
            { label: "Net to your org", value: `$${fmt(summary.total_net)}`, hint: "After commission", Icon: DollarSign },
            { label: "Total transactions", value: summary.transaction_count || 0, hint: "Paid enrollments", Icon: BookOpen },
          ].map((k) => (
            <div key={k.label} className="ta-card" style={{ padding: "14px 18px", borderRadius: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <k.Icon size={14} color="var(--primary)" />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>{k.label}</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{k.hint}</div>
            </div>
          ))}
        </div>

        {/* How it works note */}
        <div className="ta-card" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", padding: "12px 16px" }}>
          <div className="ta-row ta-gap8">
            <AlertTriangle size={14} color="var(--text-3)" style={{ marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.6 }}>
              <strong>How paid courses work:</strong> When a learner pays for a course, the platform deducts its commission (configured by the platform owner per organization — default 10%) then records the net amount for your organization. Revenue figures are in the currency Paystack/Stripe reported.
              To set course prices, open <strong>Content → Course Builder → Price</strong>. Free courses (price = 0) allow instant enrollment. Paid courses redirect learners to checkout.
            </span>
          </div>
        </div>

        {/* Course Revenue Table */}
        <div className="ta-card" style={{ borderRadius: 10 }}>
          <div className="ta-row ta-between" style={{ marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
            <div>
              <div className="ta-label" style={{ margin: 0 }}>Per-course breakdown</div>
              <div className="ta-body" style={{ marginTop: 4 }}>
                {courseRevenueQuery.loading
                  ? "Loading..."
                  : `${courses.length} course${courses.length === 1 ? "" : "s"}`}
              </div>
            </div>
            <input
              className="ta-input"
              style={{ maxWidth: 240, padding: "7px 12px" }}
              placeholder="Search course..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="ta-table-wrap">
            <table className="ta-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Listed Price</th>
                  <th>Enrollments</th>
                  <th>Gross Revenue</th>
                  <th>Platform Fee</th>
                  <th>Net to Org</th>
                </tr>
              </thead>
              <tbody>
                {courseRevenueQuery.loading && (
                  <tr><td colSpan={6} className="ta-empty">Loading revenue data…</td></tr>
                )}
                {!courseRevenueQuery.loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="ta-empty">
                      {courses.length === 0
                        ? "No paid courses with revenue yet. Create a paid course (price > 0) in Content to start earning."
                        : "No course matches your search."}
                    </td>
                  </tr>
                )}
                {filtered.map((row) => (
                  <tr key={row.course_id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <BookOpen size={14} color="var(--primary)" />
                        <span style={{ fontWeight: 600 }}>{row.course_name || "Untitled"}</span>
                      </div>
                    </td>
                    <td>
                      {row.listed_price > 0
                        ? <Tag tone="primary">${fmt(row.listed_price)}</Tag>
                        : <Tag tone="neutral">Free</Tag>}
                    </td>
                    <td style={{ fontWeight: 700 }}>{row.enrollment_count || 0}</td>
                    <td style={{ fontWeight: 700, color: "var(--text)" }}>${fmt(row.gross_revenue)}</td>
                    <td style={{ color: "var(--warning)" }}>${fmt(row.platform_fee)}</td>
                    <td style={{ fontWeight: 800, color: "var(--success)" }}>${fmt(row.net_to_org)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CourseRevenueScreen;
