import React, { useState, useContext, useMemo } from "react";
import { TopBar, ToastContext, Tag, Avatar, Switch } from "../components/PlatformUI.jsx";
import { Wallet, RefreshCw, Search, CheckCircle2, X, ShieldCheck, Users } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchOrgPayoutRequests, updatePayoutRequestStatus,
  fetchAllMentorsForPayoutControl, setInstructorPayoutsEnabled,
} from "../../lib/api/platform.js";

/**
 * Operations -> Payouts (organization admin).
 *
 * fetchOrgPayoutRequests / updatePayoutRequestStatus and
 * fetchAllMentorsForPayoutControl / setInstructorPayoutsEnabled all already
 * existed in lib/api/platform.js, fully written against the real
 * mentor_payout_requests table and the set_instructor_payouts_enabled RPC -
 * and no screen in the admin workspace called any of them. An org admin could
 * neither see a payout request nor approve one, and per-instructor payout
 * access could only be toggled from the Platform Owner side.
 */

const STATUS_TONE = { pending: "warning", approved: "success", paid: "success", rejected: "danger" };

export function PayoutsScreen({ orgId, orgSelector, setScreen, currentUserId }) {
  const showToast = useContext(ToastContext);
  const requestsQuery = useSupabaseQuery(async () => (orgId ? fetchOrgPayoutRequests(orgId) : []), [orgId]);
  const mentorsQuery = useSupabaseQuery(async () => fetchAllMentorsForPayoutControl(), []);

  const requests = requestsQuery.data || [];
  // fetchAllMentorsForPayoutControl is platform-wide (it powers an Owner
  // screen), so scope it to this organization here rather than showing an
  // admin every instructor on the platform.
  const mentors = useMemo(
    () => (mentorsQuery.data || []).filter((m) => !orgId || m.organization_id === orgId),
    [mentorsQuery.data, orgId]
  );

  const [tab, setTab] = useState("requests");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);

  const filteredRequests = requests.filter((r) => {
    if (statusFilter !== "all" && (r.status || "pending") !== statusFilter) return false;
    const needle = search.trim().toLowerCase();
    return !needle || (r.mentor || "").toLowerCase().includes(needle);
  });

  const pendingTotal = requests
    .filter((r) => (r.status || "pending") === "pending")
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const paidTotal = requests
    .filter((r) => ["paid", "approved"].includes(r.status))
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const enabledCount = mentors.filter((m) => m.payouts_enabled).length;

  async function decide(request, status) {
    setBusyId(request.id);
    try {
      await updatePayoutRequestStatus(request.id, status, currentUserId);
      showToast(`${request.mentor}'s request marked ${status}.`);
      requestsQuery.refetch();
    } catch (e) {
      showToast(e?.message || "Could not update this request.");
    } finally {
      setBusyId(null);
    }
  }

  async function togglePayouts(mentor) {
    setBusyId(mentor.id);
    try {
      const res = await setInstructorPayoutsEnabled(mentor.id, !mentor.payouts_enabled);
      showToast(res.success
        ? `Payouts ${mentor.payouts_enabled ? "suspended" : "enabled"} for ${mentor.name}.`
        : res.error);
      if (res.success) mentorsQuery.refetch();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="ta-fade">
      <TopBar
        title="Payouts"
        sub="Instructor withdrawal requests and per-instructor payout access"
        orgSelector={orgSelector}
        onNavigate={setScreen}
        right={
          <button
            className="ta-btn ta-btn-outline"
            style={{
              height: 34,
              padding: "0 12px",
              borderRadius: 8,
              fontSize: 12.5,
              display: "inline-flex",
              alignItems: "center",
              gap: 5
            }}
            onClick={() => { requestsQuery.refetch(); mentorsQuery.refetch(); }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        }
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="ta-grid ta-grid-4 anim-stagger">
          {[
            { label: "Awaiting decision", value: requests.filter((r) => (r.status || "pending") === "pending").length, hint: "Requests to review" },
            { label: "Pending amount", value: pendingTotal ? pendingTotal.toLocaleString() : "0", hint: "Total requested, not yet settled" },
            { label: "Approved / paid", value: paidTotal ? paidTotal.toLocaleString() : "0", hint: "Cleared for withdrawal" },
            { label: "Payouts enabled", value: `${enabledCount}/${mentors.length}`, hint: "Instructors allowed to withdraw" },
          ].map((k) => (
            <div key={k.label} className="ta-card" style={{ padding: "14px 18px", borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{k.hint}</div>
            </div>
          ))}
        </div>

        <div className="ta-tabs">
          {[
            { k: "requests", label: `Withdrawal requests (${requests.length})` },
            { k: "access", label: `Payout access (${mentors.length})` },
          ].map((t) => (
            <div key={t.k} className={`ta-tab ${tab === t.k ? "active" : ""}`} onClick={() => setTab(t.k)}>{t.label}</div>
          ))}
        </div>

        {tab === "requests" && (
          <div className="ta-card" style={{ borderRadius: 10 }}>
            <div className="ta-row ta-between" style={{ gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <div className="ta-search" style={{ flex: "1 1 200px", minWidth: 160 }}>
                <Search size={14} />
                <input
                  className="ta-input" style={{ border: "none", padding: 0, width: "100%" }}
                  placeholder="Search by instructor..." value={search} onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select className="ta-input" style={{ width: "auto", minWidth: 150 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="pending">Pending only</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
                <option value="rejected">Rejected</option>
                <option value="all">All statuses</option>
              </select>
            </div>

            <div className="ta-table-wrap">
              <table className="ta-table">
                <thead><tr><th>Instructor</th><th>Amount</th><th>Method</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
                <tbody>
                  {requestsQuery.loading && <tr><td colSpan={5} className="ta-empty">Loading payout requests...</td></tr>}
                  {!requestsQuery.loading && filteredRequests.length === 0 && (
                    <tr><td colSpan={5} className="ta-empty">
                      {requests.length === 0
                        ? "No withdrawal requests have been submitted in this organization."
                        : "No request matches these filters."}
                    </td></tr>
                  )}
                  {filteredRequests.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="ta-row ta-gap10">
                          <Avatar initials={(r.mentor || "I").slice(0, 2).toUpperCase()} size={30} />
                          <span style={{ fontWeight: 600 }}>{r.mentor}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 700 }}>{Number(r.amount || 0).toLocaleString()}</td>
                      <td>{r.method}</td>
                      <td><Tag tone={STATUS_TONE[r.status] || "warning"}>{r.status || "pending"}</Tag></td>
                      <td style={{ textAlign: "right" }}>
                        {(r.status || "pending") !== "pending" ? (
                          <span style={{ fontSize: 12, color: "var(--text-3)" }}>Settled</span>
                        ) : (
                          <div className="ta-row ta-gap6" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                            <button className="ta-btn ta-btn-primary ta-btn-sm" disabled={busyId === r.id} onClick={() => decide(r, "approved")}>
                              <CheckCircle2 size={13} /> Approve
                            </button>
                            <button className="ta-btn ta-btn-outline ta-btn-sm" disabled={busyId === r.id} onClick={() => decide(r, "paid")}>
                              Mark paid
                            </button>
                            <button className="ta-btn ta-btn-danger ta-btn-sm" disabled={busyId === r.id} onClick={() => decide(r, "rejected")}>
                              <X size={13} /> Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "access" && (
          <div className="ta-card" style={{ borderRadius: 10 }}>
            <div className="ta-row ta-gap8">
              <ShieldCheck size={17} color="var(--primary)" />
              <div style={{ fontWeight: 800, fontSize: 15 }}>Who is allowed to withdraw</div>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
              Earnings are always tracked regardless of this switch — being owed money and being allowed
              to withdraw it are separate things. Suspending access stops withdrawals without erasing
              anything already earned.
            </div>

            {mentorsQuery.loading && <div className="ta-empty ta-mt12">Loading instructors...</div>}
            {!mentorsQuery.loading && mentors.length === 0 && (
              <div className="ta-empty ta-mt12">
                <Users size={26} style={{ opacity: 0.4, marginBottom: 8 }} />
                <div>No instructors in this organization yet. Promote a member to Instructor from People &amp; Access.</div>
              </div>
            )}

            <div className="ta-col ta-gap8 ta-mt12">
              {mentors.map((m) => (
                <div key={m.id} className="ta-row ta-between" style={{ gap: 10, padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8, flexWrap: "wrap" }}>
                  <div className="ta-row ta-gap10" style={{ minWidth: 0 }}>
                    <Avatar initials={(m.name || "I").slice(0, 2).toUpperCase()} size={30} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, overflowWrap: "anywhere" }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: m.payouts_enabled ? "var(--success)" : "var(--text-3)" }}>
                        {m.payouts_enabled ? "Withdrawals allowed" : "Withdrawals suspended"}
                      </div>
                    </div>
                  </div>
                  <div className="ta-row ta-gap8" style={{ flexShrink: 0 }}>
                    <Wallet size={14} color="var(--text-3)" />
                    <Switch on={!!m.payouts_enabled} onChange={() => { if (busyId !== m.id) togglePayouts(m); }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PayoutsScreen;
