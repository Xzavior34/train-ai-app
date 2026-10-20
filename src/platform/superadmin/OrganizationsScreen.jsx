import React, { useState, useContext, useMemo } from "react";
import { TopBar, Tag, ToastContext, Switch, Avatar, exportRowsAsCsv } from "../components/PlatformUI.jsx";
import {
  Plus, Building2, ExternalLink, ShieldCheck, Settings, CreditCard,
  Lock, Unlock, LayoutGrid, List, Users, Link2, Copy, Check,
  Filter, Download, Search
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchAllOrganizationsWithUserCounts,
  createOrganization,
  setOrganizationStatus,
  fetchPlatformOrganizationPayments,
  fetchAllPlatformUsersWithReferralTracking,
  matchesDateRangeFilter,
} from "../../lib/api/platform.js";
import { fetchOrgFeatureFlagOverrides, setOrgFeatureFlag, fetchOrgSeatsSummary, grantFreeSeats } from "../../lib/api/organizations.js";

const FEATURE_KEYS = [
  { key: "learner_view", label: "Learner view" },
  { key: "instructor_view", label: "Instructor view" },
  { key: "manager_view", label: "Manager view" },
  { key: "admin_view", label: "Admin view" },
  { key: "ai_intelligence_layer", label: "AI Intelligence Layer" },
  { key: "ai_intelligence_advanced", label: "AI Intelligence Layer (Advanced)" },
  { key: "sso", label: "SSO" },
  { key: "api_integrations", label: "API integrations" },
  { key: "analytics_export", label: "Analytics export" },
  { key: "multi_department_breakdown", label: "Multi-department breakdown" },
  { key: "custom_branding", label: "Custom branding" },
];

function OrgManagePanel({ org, onClose, showToast, refetchOrgs, currentUserId, onTrackOrgLinkUsers }) {
  const overridesQuery = useSupabaseQuery(async () => fetchOrgFeatureFlagOverrides(org.id), [org.id]);
  const overrides = overridesQuery.data || [];
  const overrideMap = Object.fromEntries(overrides.map((o) => [o.feature_key, o.enabled]));
  const seatsSummaryQuery = useSupabaseQuery(async () => fetchOrgSeatsSummary(org.id), [org.id]);
  const seats = seatsSummaryQuery.data || { purchased: 0, used: 0, available: 0 };
  const [copiedLink, setCopiedLink] = useState(false);
  const [grantSeatsQty, setGrantSeatsQty] = useState(300);
  const [grantReason, setGrantReason] = useState("");
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [submittingGrant, setSubmittingGrant] = useState(false);

  const shareableLink = org.shareable_link || `${typeof window !== "undefined" ? window.location.origin : "https://train-ai-app.vercel.app"}/?join=${encodeURIComponent(org.referral_slug || org.slug || org.id)}`;

  async function handleToggleStatus() {
    const next = org.status === "suspended" ? "active" : "suspended";
    const result = await setOrganizationStatus(org.id, next);
    if (!result.success) {
      showToast(result.error || "Could not update status.");
    } else {
      showToast(next === "suspended" ? `${org.name} suspended.` : `${org.name} reactivated.`);
      refetchOrgs();
    }
  }

  async function handleToggleFeature(featureKey, currentResolved) {
    const result = await setOrgFeatureFlag(org.id, featureKey, !currentResolved, currentUserId);
    if (!result.success) {
      showToast(result.error || "Could not update this feature flag.");
    } else {
      overridesQuery.refetch();
    }
  }

  function handleCopyShareableLink() {
    navigator.clipboard?.writeText(shareableLink);
    setCopiedLink(true);
    if (showToast) showToast(`Copied ${org.name} invite link!`);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  return (
    <div className="ta-card ta-mt16 ta-fade" style={{ borderColor: "var(--primary)" }}>
      <div className="ta-row ta-between" style={{ gap: 10, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div className="ta-title" style={{ wordBreak: "break-word" }}>{org.name}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>
            {org.subscription_tier ? org.subscription_tier[0].toUpperCase() + org.subscription_tier.slice(1) : "-"} plan - status: {org.status}
          </div>
        </div>
        <div className="ta-row ta-gap8" style={{ flexShrink: 0, flexWrap: "wrap" }}>
          {onTrackOrgLinkUsers && (
            <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => onTrackOrgLinkUsers(org)}>
              <Filter size={13} /> Track Link Users
            </button>
          )}
          <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={handleToggleStatus}>
            {org.status === "suspended" ? <><Unlock size={13} /> Reactivate</> : <><Lock size={13} /> Suspend</>}
          </button>
          <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>

      {/* Organization Shareable Invite & Referral Link Box */}
      <div className="ta-mt16" style={{ padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <div className="ta-row ta-between" style={{ gap: 10, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="ta-row ta-gap6" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--primary)", marginBottom: 4 }}>
              <Link2 size={13} /> Organization Shareable Invite &amp; Referral Link
            </div>
            <div style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text)", wordBreak: "break-all" }}>
              {shareableLink}
            </div>
          </div>
          <div className="ta-row ta-gap6">
            <button className="ta-btn ta-btn-primary ta-btn-sm" onClick={handleCopyShareableLink}>
              {copiedLink ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy Link</>}
            </button>
          </div>
        </div>
      </div>

      <div className="ta-mt16">
        <div className="ta-row ta-between" style={{ alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>Seats &amp; Capacity</div>
          <button
            type="button"
            className="ta-btn ta-btn-primary ta-btn-sm"
            onClick={() => setShowGrantModal((prev) => !prev)}
            style={{ fontSize: 11.5 }}
          >
            <Plus size={13} /> Grant Free Seats
          </button>
        </div>
        <div className="ta-row ta-gap16">
          <div><div style={{ fontSize: 16, fontWeight: 800 }}>{seats.purchased}</div><div style={{ fontSize: 10.5, color: "var(--text-2)" }}>Purchased / Granted</div></div>
          <div><div style={{ fontSize: 16, fontWeight: 800 }}>{seats.used}</div><div style={{ fontSize: 10.5, color: "var(--text-2)" }}>Used</div></div>
          <div><div style={{ fontSize: 16, fontWeight: 800, color: seats.available > 0 ? "var(--success)" : "var(--danger)" }}>{seats.available}</div><div style={{ fontSize: 10.5, color: "var(--text-2)" }}>Available</div></div>
        </div>
        {org.status === "active" && seats.available <= 0 && (
          <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>This organization cannot add new users until they purchase or are granted more seats.</div>
        )}

        {showGrantModal && (
          <div className="ta-mt12" style={{ padding: 12, borderRadius: 8, background: "var(--surface)", border: "1px solid var(--primary-tint)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)", marginBottom: 8 }}>
              Grant Free Seats to {org.name}
            </div>
            <div className="ta-row ta-gap6" style={{ marginBottom: 10, flexWrap: "wrap" }}>
              {[50, 100, 300, 500, 1000].map((qty) => (
                <button
                  key={qty}
                  type="button"
                  className={grantSeatsQty === qty ? "ta-btn ta-btn-primary ta-btn-sm" : "ta-btn ta-btn-outline ta-btn-sm"}
                  style={{ height: 26, fontSize: 11 }}
                  onClick={() => setGrantSeatsQty(qty)}
                >
                  +{qty}
                </button>
              ))}
            </div>
            <div className="ta-row ta-gap8" style={{ flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="number"
                min="1"
                className="ta-input"
                style={{ width: 100, height: 32, fontSize: 12 }}
                value={grantSeatsQty}
                onChange={(e) => setGrantSeatsQty(Math.max(1, parseInt(e.target.value) || 0))}
              />
              <input
                type="text"
                className="ta-input"
                style={{ flex: 1, minWidth: 160, height: 32, fontSize: 12 }}
                placeholder="Reason or reference (e.g. Platform Owner Grant)"
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
              />
              <button
                type="button"
                className="ta-btn ta-btn-primary ta-btn-sm"
                style={{ height: 32 }}
                disabled={submittingGrant || grantSeatsQty <= 0}
                onClick={async () => {
                  setSubmittingGrant(true);
                  try {
                    const res = await grantFreeSeats(org.id, grantSeatsQty, grantReason || "Platform Owner Free Grant");
                    if (res.success) {
                      showToast(`Successfully granted ${grantSeatsQty} seats to ${org.name}!`);
                      setShowGrantModal(false);
                      setGrantReason("");
                      seatsSummaryQuery.refetch();
                      refetchOrgs();
                    } else {
                      showToast(res.error || "Failed to grant seats.");
                    }
                  } catch (err) {
                    showToast(err.message || "Failed to grant seats.");
                  } finally {
                    setSubmittingGrant(false);
                  }
                }}
              >
                {submittingGrant ? "Granting..." : "Confirm Grant"}
              </button>
              <button
                type="button"
                className="ta-btn ta-btn-ghost ta-btn-sm"
                style={{ height: 32 }}
                onClick={() => setShowGrantModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="ta-mt16">
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Feature flags</div>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 10 }}>
          Tier defaults shown unless explicitly overridden below. Overriding a flag here applies to this organization only, independent of its tier.
        </div>
        <div className="ta-col ta-gap6">
          {FEATURE_KEYS.map(({ key, label }) => {
            const hasOverride = key in overrideMap;
            const resolved = hasOverride ? overrideMap[key] : null;
            return (
              <div key={key} className="ta-row ta-between" style={{ padding: "6px 4px", gap: 8 }}>
                <div className="ta-row ta-gap8" style={{ minWidth: 0, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5 }}>{label}</span>
                  {hasOverride && <Tag tone="warning">Override</Tag>}
                </div>
                <Switch
                  on={hasOverride ? resolved : false}
                  onChange={() => handleToggleFeature(key, hasOverride ? resolved : false)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PlatformBillingPanel() {
  const paymentsQuery = useSupabaseQuery(async () => fetchPlatformOrganizationPayments(50), []);
  const payments = paymentsQuery.data || [];
  return (
    <div className="ta-card ta-mt16 ta-fade">
      <div className="ta-row ta-gap8">
        <CreditCard size={16} color="var(--primary)" />
        <div className="ta-title" style={{ fontSize: 15 }}>Organization payments</div>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 6, marginBottom: 10 }}>
        Every organization subscription activation across the platform, from the audit log.
      </div>
      <div className="ta-table-wrap">
        <table className="ta-table">
          <thead><tr><th>Organization</th><th>Tier</th><th>Provider</th><th>Reference</th><th>When</th></tr></thead>
          <tbody>
            {paymentsQuery.loading && <tr><td colSpan={5} className="ta-empty">Loading payments...</td></tr>}
            {!paymentsQuery.loading && payments.length === 0 && <tr><td colSpan={5} className="ta-empty">No organization payments recorded yet.</td></tr>}
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{p.target_identifier}</td>
                <td style={{ textTransform: "capitalize" }}>{p.metadata?.tier}</td>
                <td style={{ textTransform: "capitalize" }}>{p.metadata?.provider}</td>
                <td style={{ fontSize: 11 }}>{p.metadata?.reference}</td>
                <td style={{ fontSize: 11.5 }}>{new Date(p.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PlatformUserReferralTracker({
  orgs = [],
  initialReferralFilter = "all",
  initialOrgFilter = "all",
  showToast,
}) {
  const usersQuery = useSupabaseQuery(async () => fetchAllPlatformUsersWithReferralTracking(), []);
  const allUsers = usersQuery.data || [];

  const [searchQuery, setSearchQuery] = useState("");
  const [orgFilter, setOrgFilter] = useState(initialOrgFilter);
  const [referralFilter, setReferralFilter] = useState(initialReferralFilter);
  const [roleFilter, setRoleFilter] = useState("all");
  const [datePreset, setDatePreset] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  React.useEffect(() => {
    if (initialOrgFilter && initialOrgFilter !== "all") {
      setOrgFilter(initialOrgFilter);
    }
    if (initialReferralFilter && initialReferralFilter !== "all") {
      setReferralFilter(initialReferralFilter);
    }
  }, [initialOrgFilter, initialReferralFilter]);

  const filteredUsers = useMemo(() => {
    return allUsers.filter((u) => {
      const q = searchQuery.trim().toLowerCase();
      const matchQuery =
        !q ||
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.organization_name || "").toLowerCase().includes(q) ||
        (u.referral_link || "").toLowerCase().includes(q) ||
        (u.referral_slug || "").toLowerCase().includes(q);

      const matchOrg =
        orgFilter === "all" ||
        u.organization_id === orgFilter ||
        u.referral_slug === orgFilter;

      const matchRole =
        roleFilter === "all" ||
        (u.role || "").toLowerCase() === roleFilter.toLowerCase();

      let matchReferral = true;
      if (referralFilter === "shareable_link") {
        matchReferral = u.join_source === "shareable_link";
      } else if (referralFilter === "email_invite") {
        matchReferral = u.join_source === "email_invite";
      } else if (referralFilter === "direct") {
        matchReferral = u.join_source !== "shareable_link" && u.join_source !== "email_invite";
      } else if (referralFilter !== "all") {
        const slugTarget = referralFilter.startsWith("link:")
          ? referralFilter.slice(5)
          : referralFilter;
        matchReferral =
          u.join_source === "shareable_link" &&
          (u.referral_slug === slugTarget ||
            u.organization_id === slugTarget ||
            (u.referral_link || "").includes(slugTarget));
      }

      const matchDate = matchesDateRangeFilter(
        u.joined_at || u.created_at,
        datePreset,
        dateFrom,
        dateTo
      );

      return matchQuery && matchOrg && matchRole && matchReferral && matchDate;
    });
  }, [allUsers, searchQuery, orgFilter, roleFilter, referralFilter, datePreset, dateFrom, dateTo]);

  const shareableLinkCount = useMemo(
    () => filteredUsers.filter((u) => u.join_source === "shareable_link").length,
    [filteredUsers]
  );
  const emailInviteCount = useMemo(
    () => filteredUsers.filter((u) => u.join_source === "email_invite").length,
    [filteredUsers]
  );
  const joinedLast30dCount = useMemo(
    () => filteredUsers.filter((u) => matchesDateRangeFilter(u.joined_at || u.created_at, "30d")).length,
    [filteredUsers]
  );

  function handleExportTrackedUsersCsv() {
    exportRowsAsCsv(
      "platform-users-referral-date-tracking.csv",
      filteredUsers.map((u) => ({
        name: u.name,
        email: u.email,
        organization: u.organization_name,
        role: u.role,
        joinMethod:
          u.join_source === "shareable_link"
            ? "Shareable Invite & Referral Link"
            : u.join_source === "email_invite"
              ? "Direct Email Invitation"
              : "Admin / Direct Provisioned",
        referralLink: u.referral_link || "",
        joinedDate: u.joined_at ? new Date(u.joined_at).toISOString().slice(0, 10) : "",
        status: u.status || "Active",
      }))
    );
  }

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    orgFilter !== "all" ||
    referralFilter !== "all" ||
    roleFilter !== "all" ||
    datePreset !== "all" ||
    dateFrom !== "" ||
    dateTo !== "";

  return (
    <div className="ta-card ta-fade" style={{ padding: 20, borderRadius: 12 }}>
      <div className="ta-row ta-between" style={{ gap: 12, flexWrap: "wrap", paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
        <div>
          <div className="ta-row ta-gap8">
            <Link2 size={18} color="var(--primary)" />
            <div className="ta-title" style={{ fontSize: 16 }}>
              Platform-Wide User Tracking by Date &amp; Organization Shareable Invite Link
            </div>
          </div>
          <div className="ta-sub" style={{ fontSize: 12, marginTop: 3 }}>
            Filter and audit learners, instructors, and admins across all organizations by join date range and shareable referral link (<code>/?join=...</code>).
          </div>
        </div>
        <div className="ta-row ta-gap8" style={{ flexWrap: "wrap" }}>
          {hasActiveFilters && (
            <button
              className="ta-btn ta-btn-ghost ta-btn-sm"
              onClick={() => {
                setSearchQuery("");
                setOrgFilter("all");
                setReferralFilter("all");
                setRoleFilter("all");
                setDatePreset("all");
                setDateFrom("");
                setDateTo("");
              }}
            >
              Reset Filters
            </button>
          )}
          <button
            className="ta-btn ta-btn-outline ta-btn-sm"
            onClick={handleExportTrackedUsersCsv}
            disabled={filteredUsers.length === 0}
          >
            <Download size={13} /> Export Filtered CSV ({filteredUsers.length})
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 16 }}>
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>Matched Users</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text)", marginTop: 4 }}>{filteredUsers.length}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>of {allUsers.length} total platform users</div>
        </div>
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase" }}>Via Shareable Invite Link</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "var(--primary)", marginTop: 4 }}>{shareableLinkCount}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Joined via /?join=&lt;org-slug&gt;</div>
        </div>
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>Via Direct Email Invite</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text)", marginTop: 4 }}>{emailInviteCount}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Accepted organization email invite</div>
        </div>
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", textTransform: "uppercase" }}>Joined Last 30 Days</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "var(--success)", marginTop: 4 }}>{joinedLast30dCount}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Within current filter selection</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="ta-row ta-gap10" style={{ flexWrap: "wrap", marginTop: 16, padding: 12, borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
          <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
          <input
            className="ta-input"
            style={{ paddingLeft: 32, width: "100%" }}
            placeholder="Search user, email, org, or ?join= link..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Organization Filter */}
        <select
          className="ta-select"
          style={{ width: "auto", minWidth: 170 }}
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
          title="Filter by Organization"
        >
          <option value="all">All Organizations</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.user_count || 0})
            </option>
          ))}
        </select>

        {/* Shareable Invite & Referral Link Filter */}
        <select
          className="ta-select"
          style={{ width: "auto", minWidth: 235 }}
          value={referralFilter}
          onChange={(e) => setReferralFilter(e.target.value)}
          title="Filter by Organization Shareable Invite & Referral Link"
        >
          <option value="all">All Invite &amp; Referral Links</option>
          <option value="shareable_link">All Shareable Invite Links (/?join=...)</option>
          <option value="email_invite">Direct Email Invitations</option>
          <option value="direct">Admin / Direct Provisioned</option>
          {orgs.length > 0 && (
            <optgroup label="Specific Organization Shareable Links">
              {orgs.map((o) => {
                const slug = o.referral_slug || o.slug || o.id;
                return (
                  <option key={o.id} value={`link:${slug}`}>
                    {o.name} (/?join={slug})
                  </option>
                );
              })}
            </optgroup>
          )}
        </select>

        {/* Role Filter */}
        <select
          className="ta-select"
          style={{ width: "auto", minWidth: 135 }}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          title="Filter by Role"
        >
          <option value="all">All Roles</option>
          <option value="Learner">Learner</option>
          <option value="Instructor">Instructor</option>
          <option value="Manager">Manager</option>
          <option value="Admin">Admin</option>
          <option value="Super Admin">Super Admin</option>
        </select>

        {/* Date Preset Filter */}
        <select
          className="ta-select"
          style={{ width: "auto", minWidth: 155 }}
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value)}
          title="Filter by Date Joined"
        >
          <option value="all">All Dates</option>
          <option value="today">Joined Today</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
          <option value="this_month">This Month</option>
          <option value="this_year">This Year</option>
          <option value="custom">Custom Date Range</option>
        </select>

        {(datePreset === "custom" || dateFrom || dateTo) && (
          <div className="ta-row ta-gap6" style={{ flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 600 }}>From:</span>
            <input
              type="date"
              className="ta-input"
              style={{ width: "auto", height: 34, padding: "0 8px", fontSize: 12 }}
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                if (datePreset !== "custom") setDatePreset("custom");
              }}
            />
            <span style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 600 }}>To:</span>
            <input
              type="date"
              className="ta-input"
              style={{ width: "auto", height: 34, padding: "0 8px", fontSize: 12 }}
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                if (datePreset !== "custom") setDatePreset("custom");
              }}
            />
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="ta-table-wrap ta-mt16">
        <table className="ta-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Organization</th>
              <th>Role</th>
              <th>Shareable Invite &amp; Referral Link</th>
              <th>Date Joined</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {usersQuery.loading && (
              <tr>
                <td colSpan={6} className="ta-empty">Loading platform users and referral tracking...</td>
              </tr>
            )}
            {!usersQuery.loading && filteredUsers.length === 0 && (
              <tr>
                <td colSpan={6} className="ta-empty">No users match the selected date and shareable invite link filters.</td>
              </tr>
            )}
            {filteredUsers.map((u) => (
              <tr key={`${u.id}-${u.organization_id || "global"}`}>
                <td>
                  <div className="ta-row ta-gap10" style={{ minWidth: 0 }}>
                    <Avatar initials={u.initials || "U"} size={30} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</div>
                      {u.email && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{u.email}</div>}
                    </div>
                  </div>
                </td>
                <td>
                  <div className="ta-row ta-gap6">
                    <Building2 size={14} color="var(--primary)" />
                    <span style={{ fontWeight: 600, fontSize: 12.5 }}>{u.organization_name}</span>
                  </div>
                </td>
                <td>
                  <Tag tone={u.role === "Super Admin" ? "danger" : u.role === "Admin" ? "primary" : "neutral"}>
                    {u.role}
                  </Tag>
                </td>
                <td>
                  {u.join_source === "shareable_link" ? (
                    <div className="ta-col" style={{ gap: 3 }}>
                      <div className="ta-row ta-gap6">
                        <Tag tone="primary"><Link2 size={11} /> Shareable Invite Link</Tag>
                        <button
                          className="ta-btn ta-btn-ghost ta-btn-sm"
                          style={{ padding: "2px 6px", height: 22, fontSize: 10.5 }}
                          onClick={() => {
                            navigator.clipboard?.writeText(u.referral_link);
                            if (showToast) showToast("Copied referral link!");
                          }}
                          title="Copy user's organization referral link"
                        >
                          <Copy size={10} /> Copy
                        </button>
                      </div>
                      <span style={{ fontSize: 10.5, color: "var(--text-3)", fontFamily: "monospace" }}>
                        /?join={u.referral_slug}
                      </span>
                    </div>
                  ) : u.join_source === "email_invite" ? (
                    <Tag tone="info">Direct Email Invite</Tag>
                  ) : (
                    <div className="ta-col" style={{ gap: 2 }}>
                      <Tag>Admin / Direct</Tag>
                      {u.referral_slug && (
                        <span style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "monospace" }}>
                          Org link: /?join={u.referral_slug}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
                    {u.joined_at ? new Date(u.joined_at).toLocaleDateString() : "—"}
                  </div>
                  {u.joined_at && (
                    <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                      {new Date(u.joined_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                </td>
                <td>
                  <Tag tone={u.status === "Active" ? "success" : "warning"}>{u.status || "Active"}</Tag>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function OrganizationsScreen({ orgSelector, onSwitchToOrgWorkspace, onLaunchOnboarding, currentUserId }) {
  const showToast = useContext(ToastContext);
  const [newOrgOpen, setNewOrgOpen] = useState(false);
  const [name, setName] = useState("");
  const [managingOrgId, setManagingOrgId] = useState(null);
  const [showBilling, setShowBilling] = useState(false);
  const [viewMode, setViewMode] = useState("grid"); // grid | table | tracker

  // Filters for Organizations list (by Date & Shareable Invite Link / Search)
  const [orgSearch, setOrgSearch] = useState("");
  const [orgLinkFilter, setOrgLinkFilter] = useState("all");
  const [orgDatePreset, setOrgDatePreset] = useState("all");
  const [orgDateFrom, setOrgDateFrom] = useState("");
  const [orgDateTo, setOrgDateTo] = useState("");

  // State passed into PlatformUserReferralTracker when clicking "Track Link Users" on an org
  const [trackerInitialOrg, setTrackerInitialOrg] = useState("all");
  const [trackerInitialReferral, setTrackerInitialReferral] = useState("all");

  const orgsQuery = useSupabaseQuery(async () => fetchAllOrganizationsWithUserCounts(), []);
  const orgs = orgsQuery.data || [];
  const managingOrg = orgs.find((o) => o.id === managingOrgId);

  const filteredOrgs = useMemo(() => {
    return orgs.filter((o) => {
      const q = orgSearch.trim().toLowerCase();
      const slug = (o.referral_slug || o.slug || o.id || "").toLowerCase();
      const link = (o.shareable_link || `/?join=${slug}`).toLowerCase();
      const matchSearch =
        !q ||
        (o.name || "").toLowerCase().includes(q) ||
        slug.includes(q) ||
        link.includes(q);

      const matchLink =
        orgLinkFilter === "all" ||
        o.id === orgLinkFilter ||
        slug === orgLinkFilter.toLowerCase();

      const matchDate = matchesDateRangeFilter(
        o.created_at,
        orgDatePreset,
        orgDateFrom,
        orgDateTo
      );

      return matchSearch && matchLink && matchDate;
    });
  }, [orgs, orgSearch, orgLinkFilter, orgDatePreset, orgDateFrom, orgDateTo]);

  function handleTrackOrgLinkUsers(org) {
    const slug = org.referral_slug || org.slug || org.id;
    setTrackerInitialOrg(org.id);
    setTrackerInitialReferral(`link:${slug}`);
    setViewMode("tracker");
  }

  return (
    <div className="ta-fade">
      <TopBar
        title="Organizations"
        sub="All registered multi-tenant organizations & shareable invite link tracking on Train AI"
        orgSelector={orgSelector}
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* =========================================================================
            ORGANIZATIONS HERO BANNER
            ========================================================================= */}
        <div
          className="ta-card ta-hero-banner ta-hero-dark anim-fluid-entrance"
          style={{
            borderRadius: 14,
            padding: "clamp(18px, 2.5vw, 24px)",
            position: "relative",
            overflow: "hidden"
          }}
        >
          <div className="tai-glow-purple" />

          <div className="ta-hero-inner" style={{ position: "relative", zIndex: 1 }}>
            <div className="ta-hero-text">
              <h1 className="ta-hero-title" style={{ fontSize: "clamp(20px, 2.5vw, 25px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 4px", lineHeight: 1.2 }}>
                Multi-Tenant Organizations &amp; Invite Link Directory
              </h1>
              <p className="ta-hero-desc" style={{ fontSize: 13, margin: 0, maxWidth: 680, lineHeight: 1.5 }}>
                Manage institutional subscriptions, seat quotas, custom feature flag overrides, and track users by join dates and Organization Shareable Invite &amp; Referral Links.
              </p>
            </div>

            <div className="ta-hero-actions" style={{ flexWrap: "wrap", gap: 8 }}>
              <button
                className="ta-btn ta-btn-outline"
                style={{
                  height: 36, padding: "0 12px", borderRadius: 8, fontSize: 12.5,
                  color: "#FFFFFF",
                  background: viewMode === "tracker" ? "rgba(59, 130, 246, 0.35)" : "transparent",
                  borderColor: viewMode === "tracker" ? "#60A5FA" : "rgba(255,255,255,0.2)",
                  display: "inline-flex", alignItems: "center", gap: 6
                }}
                onClick={() => {
                  if (viewMode === "tracker") {
                    setViewMode("grid");
                  } else {
                    setTrackerInitialOrg("all");
                    setTrackerInitialReferral("all");
                    setViewMode("tracker");
                  }
                }}
              >
                <Link2 size={13} /> {viewMode === "tracker" ? "Back to Orgs View" : "User & Invite Link Tracker"}
              </button>
              <button
                className="ta-btn ta-btn-outline"
                style={{ height: 36, padding: "0 12px", borderRadius: 8, fontSize: 12.5, color: "#FFFFFF", borderColor: "rgba(255,255,255,0.2)", display: "inline-flex", alignItems: "center", gap: 5 }}
                onClick={() => setShowBilling((v) => !v)}
              >
                <CreditCard size={13} /> {showBilling ? "Hide Billing" : "Billing"}
              </button>
              <button
                className="ta-btn ta-btn-primary"
                style={{ height: 36, padding: "0 14px", borderRadius: 8, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={() => setNewOrgOpen(true)}
              >
                <Plus size={14} /> Create Organization
              </button>
            </div>
          </div>
        </div>

        {showBilling && <PlatformBillingPanel />}

        {/* =========================================================================
            FILTER BAR & VIEW SWITCHER (Dates + Shareable Invite Link + Mode)
            ========================================================================= */}
        <div className="ta-card" style={{ padding: "12px 16px", borderRadius: 10 }}>
          <div className="ta-row ta-between" style={{ gap: 10, flexWrap: "wrap" }}>
            <div className="ta-row ta-gap8" style={{ flexWrap: "wrap", flex: "1 1 auto" }}>
              {viewMode !== "tracker" && (
                <>
                  <div style={{ position: "relative", minWidth: 210, flex: "1 1 210px", maxWidth: 320 }}>
                    <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
                    <input
                      className="ta-input"
                      style={{ paddingLeft: 30, width: "100%" }}
                      placeholder="Filter orgs or ?join= link..."
                      value={orgSearch}
                      onChange={(e) => setOrgSearch(e.target.value)}
                    />
                  </div>
                  <select
                    className="ta-select"
                    style={{ width: "auto", minWidth: 210 }}
                    value={orgLinkFilter}
                    onChange={(e) => setOrgLinkFilter(e.target.value)}
                    title="Filter by Organization Shareable Invite & Referral Link"
                  >
                    <option value="all">All Organization Invite Links</option>
                    {orgs.map((o) => {
                      const slug = o.referral_slug || o.slug || o.id;
                      return (
                        <option key={o.id} value={o.id}>
                          {o.name} (/?join={slug})
                        </option>
                      );
                    })}
                  </select>
                  <select
                    className="ta-select"
                    style={{ width: "auto", minWidth: 150 }}
                    value={orgDatePreset}
                    onChange={(e) => setOrgDatePreset(e.target.value)}
                    title="Filter Organizations by Date Created"
                  >
                    <option value="all">All Dates</option>
                    <option value="today">Created Today</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                    <option value="this_month">This Month</option>
                    <option value="this_year">This Year</option>
                    <option value="custom">Custom Date Range</option>
                  </select>
                  {(orgDatePreset === "custom" || orgDateFrom || orgDateTo) && (
                    <div className="ta-row ta-gap6" style={{ flexWrap: "wrap" }}>
                      <input
                        type="date"
                        className="ta-input"
                        style={{ width: "auto", height: 34, padding: "0 8px", fontSize: 12 }}
                        value={orgDateFrom}
                        onChange={(e) => {
                          setOrgDateFrom(e.target.value);
                          if (orgDatePreset !== "custom") setOrgDatePreset("custom");
                        }}
                      />
                      <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>to</span>
                      <input
                        type="date"
                        className="ta-input"
                        style={{ width: "auto", height: 34, padding: "0 8px", fontSize: 12 }}
                        value={orgDateTo}
                        onChange={(e) => {
                          setOrgDateTo(e.target.value);
                          if (orgDatePreset !== "custom") setOrgDatePreset("custom");
                        }}
                      />
                    </div>
                  )}
                </>
              )}
              {viewMode === "tracker" && (
                <div className="ta-row ta-gap8" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--primary)" }}>
                  <Users size={15} /> Viewing Cross-Tenant User &amp; Shareable Invite Link Tracker
                </div>
              )}
            </div>

            <div className="ta-row ta-gap6">
              <button
                className={`ta-btn ta-btn-sm ${viewMode === "grid" ? "ta-btn-primary" : "ta-btn-outline"}`}
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid size={13} /> Grid
              </button>
              <button
                className={`ta-btn ta-btn-sm ${viewMode === "table" ? "ta-btn-primary" : "ta-btn-outline"}`}
                onClick={() => setViewMode("table")}
              >
                <List size={13} /> Table
              </button>
              <button
                className={`ta-btn ta-btn-sm ${viewMode === "tracker" ? "ta-btn-primary" : "ta-btn-outline"}`}
                onClick={() => setViewMode("tracker")}
              >
                <Link2 size={13} /> User &amp; Link Tracker
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================================
            VIEW MODE: USER & INVITE LINK TRACKER
            ========================================================================= */}
        {viewMode === "tracker" ? (
          <PlatformUserReferralTracker
            orgs={orgs}
            initialOrgFilter={trackerInitialOrg}
            initialReferralFilter={trackerInitialReferral}
            showToast={showToast}
          />
        ) : viewMode === "grid" ? (
          /* =========================================================================
              VIEW MODE: CARD GRID
              ========================================================================= */
          <div>
            {orgsQuery.loading && <div className="ta-empty">Loading organizations...</div>}
            {!orgsQuery.loading && filteredOrgs.length === 0 && <div className="ta-empty">No organizations match the current date or invite link filters.</div>}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 18 }} className="anim-stagger">
              {filteredOrgs.map((o) => {
                const slug = o.referral_slug || o.slug || o.id;
                const shareableLink = o.shareable_link || `${typeof window !== "undefined" ? window.location.origin : "https://train-ai-app.vercel.app"}/?join=${encodeURIComponent(slug)}`;
                return (
                  <div
                    key={o.id}
                    className="ta-card ta-card-hover"
                    style={{
                      padding: 20,
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 16,
                      background: "var(--surface)"
                    }}
                  >
                    <div>
                      {/* Top Row: Org Icon, Name, and Status */}
                      <div className="ta-row ta-between" style={{ alignItems: "flex-start", marginBottom: 12, gap: 10 }}>
                        <div className="ta-row ta-gap12" style={{ minWidth: 0, flex: "1 1 auto" }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: 8,
                            background: "var(--primary-tint)", color: "var(--primary)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            border: "1px solid rgba(59, 130, 246, 0.2)", flexShrink: 0
                          }}>
                            <Building2 size={22} />
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: 15.5, color: "var(--text)", wordBreak: "break-word", lineHeight: 1.25 }}>{o.name}</div>
                            <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>ID: {o.id.slice(0, 12)}...</div>
                          </div>
                        </div>
                        <Tag tone={o.status === "active" ? "success" : o.status === "suspended" ? "danger" : "warning"}>
                          {o.status}
                        </Tag>
                      </div>

                      {/* Stats Metric Strip */}
                      <div style={{
                        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
                        background: "var(--surface-2)", padding: "10px 14px", borderRadius: 8, marginBottom: 12
                      }}>
                        <div>
                          <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>MEMBERS</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginTop: 2 }}>
                            {o.user_count || 0} users
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>TIER</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--primary)", marginTop: 2, textTransform: "capitalize" }}>
                            {o.subscription_tier || "Enterprise"}
                          </div>
                        </div>
                      </div>

                      {/* Shareable Invite & Referral Link Strip */}
                      <div style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        marginBottom: 10
                      }}>
                        <div className="ta-row ta-between" style={{ gap: 6 }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="ta-row ta-gap4" style={{ fontSize: 10.5, fontWeight: 700, color: "var(--primary)" }}>
                              <Link2 size={11} /> Shareable Invite Link
                            </div>
                            <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              /?join={slug}
                            </div>
                          </div>
                          <div className="ta-row ta-gap4">
                            <button
                              className="ta-btn ta-btn-ghost ta-btn-sm"
                              style={{ height: 26, padding: "0 8px", fontSize: 11 }}
                              onClick={() => {
                                navigator.clipboard?.writeText(shareableLink);
                                showToast(`Copied ${o.name} invite link!`);
                              }}
                              title="Copy Shareable Invite & Referral Link"
                            >
                              <Copy size={11} /> Copy
                            </button>
                            <button
                              className="ta-btn ta-btn-outline ta-btn-sm"
                              style={{ height: 26, padding: "0 8px", fontSize: 11 }}
                              onClick={() => handleTrackOrgLinkUsers(o)}
                              title="Track users who joined via this organization's shareable invite link"
                            >
                              <Filter size={11} /> Track
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Isolation Badge */}
                      <div className="ta-row ta-gap6" style={{ fontSize: 11.5, color: "var(--text-2)", fontWeight: 600 }}>
                        <ShieldCheck size={14} color="#10B981" />
                        <span>Dedicated RLS schema isolation • Strict Multi-Tenancy</span>
                      </div>
                    </div>

                    {/* Actions Footer */}
                    <div className="ta-row ta-between" style={{ paddingTop: 14, borderTop: "1px solid var(--border)", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                        Created {new Date(o.created_at).toLocaleDateString()}
                      </span>
                      <div className="ta-row ta-gap8">
                        <button
                          className="ta-btn ta-btn-outline ta-btn-sm"
                          onClick={() => {
                            orgSelector?.onSelectOrg?.(o.id);
                            onSwitchToOrgWorkspace?.();
                            showToast(`Switched Super Admin context to ${o.name}`);
                          }}
                        >
                          <ExternalLink size={13} /> View
                        </button>
                        <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => setManagingOrgId(o.id)}>
                          <Settings size={13} /> Manage
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* =========================================================================
              VIEW MODE: TABLE
              ========================================================================= */
          <div className="ta-card">
            <div className="ta-table-wrap">
              <table className="ta-table">
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Members</th>
                    <th>Shareable Invite &amp; Referral Link</th>
                    <th>Tier</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orgsQuery.loading && <tr><td colSpan={7} className="ta-empty">Loading organizations...</td></tr>}
                  {!orgsQuery.loading && filteredOrgs.length === 0 && <tr><td colSpan={7} className="ta-empty">No organizations match the current filters.</td></tr>}
                  {filteredOrgs.map((o) => {
                    const slug = o.referral_slug || o.slug || o.id;
                    const shareableLink = o.shareable_link || `${typeof window !== "undefined" ? window.location.origin : "https://train-ai-app.vercel.app"}/?join=${encodeURIComponent(slug)}`;
                    return (
                      <tr key={o.id}>
                        <td>
                          <div className="ta-row ta-gap10">
                            <Building2 size={18} color="var(--primary)" />
                            <div>
                              <div style={{ fontWeight: 600 }}>{o.name}</div>
                              <div style={{ fontSize: 11, color: "var(--text-3)" }}>ID: {o.id.slice(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        <td>{o.user_count || 0} users</td>
                        <td>
                          <div className="ta-row ta-gap6">
                            <span style={{ fontSize: 11.5, fontFamily: "monospace", color: "var(--primary)" }}>
                              /?join={slug}
                            </span>
                            <button
                              className="ta-btn ta-btn-ghost ta-btn-sm"
                              style={{ height: 24, padding: "0 6px", fontSize: 10.5 }}
                              onClick={() => {
                                navigator.clipboard?.writeText(shareableLink);
                                showToast(`Copied ${o.name} invite link!`);
                              }}
                            >
                              <Copy size={10} /> Copy
                            </button>
                            <button
                              className="ta-btn ta-btn-outline ta-btn-sm"
                              style={{ height: 24, padding: "0 6px", fontSize: 10.5 }}
                              onClick={() => handleTrackOrgLinkUsers(o)}
                            >
                              Track
                            </button>
                          </div>
                        </td>
                        <td style={{ textTransform: "capitalize" }}>{o.subscription_tier}</td>
                        <td><Tag tone={o.status === "active" ? "success" : o.status === "suspended" ? "danger" : "warning"}>{o.status}</Tag></td>
                        <td>{new Date(o.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className="ta-row ta-gap6">
                            <button
                              className="ta-btn ta-btn-outline ta-btn-sm"
                              onClick={() => {
                                orgSelector?.onSelectOrg?.(o.id);
                                onSwitchToOrgWorkspace?.();
                                showToast(`Switched Super Admin context to ${o.name}`);
                              }}
                            >
                              <ExternalLink size={13} /> View
                            </button>
                            <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => setManagingOrgId(o.id)}>
                              <Settings size={13} /> Manage
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
        )}

        {managingOrg && (
          <OrgManagePanel
            org={managingOrg}
            onClose={() => setManagingOrgId(null)}
            showToast={showToast}
            refetchOrgs={orgsQuery.refetch}
            currentUserId={currentUserId}
            onTrackOrgLinkUsers={handleTrackOrgLinkUsers}
          />
        )}

        {newOrgOpen && (
          <div className="ta-card ta-mt16 ta-fade" style={{ borderColor: "var(--border)", borderRadius: 10 }}>
            <div className="ta-title">Create New Organization</div>
            <input className="ta-input ta-mt12" placeholder="Organization name..." value={name} onChange={e => setName(e.target.value)} />
            <div className="ta-row ta-gap8 ta-mt12" style={{ flexWrap: "wrap" }}>
              <button className="ta-btn ta-btn-primary" onClick={async () => {
                if (!name.trim()) return;
                await createOrganization({ name: name.trim() });
                setNewOrgOpen(false); setName("");
                orgsQuery.refetch();
                showToast("Organization created!");
              }}>Save organization</button>
              <button className="ta-btn ta-btn-outline" onClick={() => setNewOrgOpen(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
