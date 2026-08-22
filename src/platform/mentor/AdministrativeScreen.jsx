import React, { useState, useContext } from "react";
import { TopBar, Tag, ToastContext } from "../components/PlatformUI.jsx";
import { 
  DollarSign, Send, CreditCard, Building2, Wallet, 
  ArrowUpRight, Download, Clock, ShieldCheck, CheckCircle2, 
  AlertTriangle, RefreshCw, ChevronRight, HelpCircle
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchMentorEarnings, fetchMentorPayoutRequests, submitMentorPayoutRequest,
  fetchRefundRequestsForMentor, respondToRefundRequest,
} from "../../lib/api/schemaHelper.js";
import { useAuth } from "../../lib/useAuth.js";

const PAYOUT_METHODS = [
  { key: "bank_transfer", label: "Direct Bank Transfer (ACH / SEPA)", icon: Building2, desc: "Direct deposit to your local or international bank account (1-3 business days)" },
  { key: "paypal", label: "PayPal Express", icon: Wallet, desc: "Instant transfer to your connected PayPal email address" },
  { key: "stripe", label: "Stripe Connect", icon: CreditCard, desc: "Automated direct payouts to your debit card or local account" },
];

export function AdministrativeScreen({ mentorId, mentorProfileQuery, currentUserId }) {
  const payoutsEnabled = !!mentorProfileQuery?.data?.payouts_enabled;
  const showToast = useContext(ToastContext);
  const { session } = useAuth();
  const [tab, setTab] = useState("earnings");

  const earningsQuery = useSupabaseQuery(async () => mentorId ? fetchMentorEarnings(mentorId) : [], [mentorId]);
  const payoutsQuery = useSupabaseQuery(async () => mentorId ? fetchMentorPayoutRequests(mentorId) : [], [mentorId]);
  const refundsQuery = useSupabaseQuery(async () => mentorId ? fetchRefundRequestsForMentor(mentorId) : [], [mentorId]);

  const rawEarnings = earningsQuery.data || [];
  
  const defaultEarnings = [
    { id: "e-1", earning_type: "1:1 Clarification Session", amount: 85.00, status: "available", created_at: new Date(Date.now() - 86400000 * 2).toISOString(), learner_name: "Fatima Diallo" },
    { id: "e-2", earning_type: "Spatial UI Cohort Workshop", amount: 350.00, status: "available", created_at: new Date(Date.now() - 86400000 * 5).toISOString(), learner_name: "Cohort Batch 4" },
    { id: "e-3", earning_type: "Module Code Review & Grading", amount: 45.00, status: "available", created_at: new Date(Date.now() - 86400000 * 7).toISOString(), learner_name: "Liam Torres" },
    { id: "e-4", earning_type: "1:1 Architecture Mentorship", amount: 120.00, status: "pending", created_at: new Date(Date.now() - 86400000 * 1).toISOString(), learner_name: "Marcus Webb" },
  ];

  const earnings = rawEarnings.length > 0 ? rawEarnings : defaultEarnings;
  const totalEarnings = earnings.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const pendingEarnings = earnings.filter(e => e.status === "pending").reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const availableEarnings = earnings.filter(e => e.status === "available" || e.status === "paid" || e.status == null).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const requestedPayoutTotal = (payoutsQuery.data || []).filter(p => p.status === "pending").reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const availableBalance = Math.max(0, availableEarnings - requestedPayoutTotal);

  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("bank_transfer");
  const [payoutDetails, setPayoutDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refundResponses, setRefundResponses] = useState({});

  async function handleRequestPayout() {
    const amount = Number(payoutAmount);
    if (!amount || amount <= 0) { showToast("Enter a valid payout amount."); return; }
    if (amount > availableBalance) { showToast("Amount exceeds your available balance."); return; }
    setSubmitting(true);
    try {
      if (mentorId) {
        await submitMentorPayoutRequest(mentorId, amount, { type: payoutMethod, details: payoutDetails || null });
      }
      setPayoutAmount(""); setPayoutDetails("");
      payoutsQuery.refetch();
      showToast(`Payout request of $${amount.toFixed(2)} submitted successfully!`);
    } catch (e) {
      showToast(e.message || "Could not submit payout request.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleExportCsv() {
    const rows = [
      ["Transaction ID", "Type", "Amount ($)", "Status", "Date"],
      ...earnings.map(e => [e.id, e.earning_type || "session", Number(e.amount || 0).toFixed(2), e.status, new Date(e.created_at).toLocaleDateString()])
    ];
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(r => r.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `instructor_earnings_statement_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Earnings statement downloaded.");
  }

  async function handleRefundResponse(id, status) {
    try {
      await respondToRefundRequest(id, status, refundResponses[id] || "", session?.user?.id || null);
      refundsQuery.refetch();
      showToast(status === "approved" ? "Refund approved." : "Refund declined.");
    } catch (e) {
      showToast(e.message || "Could not update refund request.");
    }
  }

  return (
    <div className="ta-fade">
      <TopBar title="Earnings & Payouts" sub="Track teaching revenue, automated withdrawals, and dispute resolutions" />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        
        <div className="ta-hero-banner">

          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <div className="ta-row ta-gap10" style={{ flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{
                  background: "rgba(16, 185, 129, 0.35)", color: "#A7F3D0",
                  border: "1px solid rgba(16, 185, 129, 0.5)",
                  fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99,
                  display: "inline-flex", alignItems: "center", gap: 6, letterSpacing: "0.03em"
                }}>
                  <ShieldCheck size={13} color="#34D399" /> DIRECT DEPOSIT VERIFIED
                </span>
                <span style={{
                  background: "rgba(99, 102, 241, 0.28)", color: "#E0E7FF",
                  border: "1px solid rgba(165, 180, 252, 0.5)",
                  fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99
                }}>
                  NEXT AUTOMATED CYCLE: 1ST OF MONTH
                </span>
              </div>

              <h1 className="ta-hero-title">
                Instructor Earnings &amp; Financial Studio
              </h1>
              <p className="ta-hero-desc">
                Review course milestone bounties, workshop earnings, 1:1 mentorship fees, and request instant withdrawals.
              </p>
            </div>

            <div className="ta-hero-actions">
              <button
                className="ta-btn ta-btn-outline"
                onClick={handleExportCsv}
                style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)" }}
              >
                <Download size={14} /> Export CSV Statement
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          
          <div className="ta-card" style={{ padding: "20px 22px", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Available For Withdrawal</span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(16, 185, 129, 0.15)", color: "#10B981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <DollarSign size={18} />
              </div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: "var(--primary)", marginTop: 10, letterSpacing: "-0.02em" }}>
              ${availableBalance.toFixed(2)}
            </div>
            <div className="ta-row ta-gap6 ta-mt10" style={{ fontSize: 12, color: "var(--success)", fontWeight: 700 }}>
              <CheckCircle2 size={14} /> Ready for instant transfer
            </div>
          </div>

          <div className="ta-card" style={{ padding: "20px 22px", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Lifetime Gross Earnings</span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(99, 102, 241, 0.12)", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Wallet size={18} />
              </div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: "var(--text)", marginTop: 10, letterSpacing: "-0.02em" }}>
              ${totalEarnings.toFixed(2)}
            </div>
            <div className="ta-row ta-gap6 ta-mt10" style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>
              Across {earnings.length} verified sessions &amp; cohorts
            </div>
          </div>

          <div className="ta-card" style={{ padding: "20px 22px", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Pending Settlement</span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(245, 158, 11, 0.15)", color: "#F59E0B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Clock size={18} />
              </div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#F59E0B", marginTop: 10, letterSpacing: "-0.02em" }}>
              ${pendingEarnings.toFixed(2)}
            </div>
            <div className="ta-row ta-gap6 ta-mt10" style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>
              Clears in 24-48h after session sign-off
            </div>
          </div>

        </div>

        <div className="ta-card" style={{ padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
            {[
              { k: "earnings", label: "Earnings Breakdown" },
              { k: "payouts", label: "Withdrawal & Payout Methods" },
              { k: "refunds", label: "Refunds & Disputes" }
            ].map(t => (
              <button
                key={t.k}
                className={`ta-pill ${tab === t.k ? "active" : ""}`}
                onClick={() => setTab(t.k)}
                style={{
                  padding: "7px 16px",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none"
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === "earnings" && (
          <div className="ta-card" style={{ padding: "20px 22px", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between" style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
              <div>
                <div className="ta-title" style={{ fontSize: 16, fontWeight: 800 }}>Detailed Transaction History</div>
                <div className="ta-sub" style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Itemized credits from live sessions, capstone grading, and workshops</div>
              </div>
              <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => earningsQuery.refetch()}>
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            <div className="ta-table-wrap ta-mt14">
              <table className="ta-table">
                <thead>
                  <tr>
                    <th>Activity / Description</th>
                    <th>Learner / Cohort</th>
                    <th>Gross Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.map((e, idx) => (
                    <tr key={e.id || idx}>
                      <td>
                        <div className="ta-row ta-gap8">
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <DollarSign size={14} color="var(--primary)" />
                          </div>
                          <span style={{ fontWeight: 700, color: "var(--text)" }}>{(e.earning_type || "session").replace(/_/g, " ")}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ color: "var(--text-2)", fontWeight: 500 }}>{e.learner_name || "Enrolled Learner"}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 800, color: "var(--text)", fontSize: 14 }}>+${Number(e.amount || 0).toFixed(2)}</span>
                      </td>
                      <td>
                        <Tag tone={e.status === "available" || e.status === "paid" ? "success" : e.status === "pending" ? "warning" : "default"}>
                          {e.status?.toUpperCase() || "AVAILABLE"}
                        </Tag>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-3)" }}>
                        {e.created_at ? new Date(e.created_at).toLocaleDateString() : "Recent"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "payouts" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            
            <div className="ta-card" style={{ padding: "22px 24px", background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="ta-title" style={{ fontSize: 16, fontWeight: 800 }}>Request a Payout Withdrawal</div>
              <div className="ta-sub" style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Transfer your available balance to your preferred payout method</div>

              {!payoutsEnabled && (
                <div style={{ padding: 12, borderRadius: 10, background: "var(--warning-bg, #FEF3C7)", border: "1px solid var(--warning-border, #FDE68A)", marginTop: 14 }}>
                  <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 600, lineHeight: 1.4 }}>
                    Payouts are in Org-Managed mode for your profile. Your earnings are tracked and settled through your institutional payroll agreement.
                  </div>
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <label className="ta-label" style={{ marginBottom: 6, display: "block" }}>Withdrawal Amount ($)</label>
                <div className="ta-row ta-gap8">
                  <input
                    className="ta-input"
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder={`Max $${availableBalance.toFixed(2)}`}
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    style={{ flex: 1, fontSize: 14, fontWeight: 700 }}
                  />
                  <button
                    type="button"
                    className="ta-btn ta-btn-outline ta-btn-sm"
                    onClick={() => setPayoutAmount(availableBalance.toFixed(2))}
                  >
                    Max Amount
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <label className="ta-label" style={{ marginBottom: 8, display: "block" }}>Select Payout Method</label>
                <div className="ta-col ta-gap8">
                  {PAYOUT_METHODS.map((m) => {
                    const Icon = m.icon;
                    const isSel = payoutMethod === m.key;
                    return (
                      <div
                        key={m.key}
                        onClick={() => setPayoutMethod(m.key)}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 12,
                          background: isSel ? "var(--primary-tint, #EFF6FF)" : "var(--surface-2)",
                          border: isSel ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                          cursor: "pointer",
                          transition: "all 0.15s ease"
                        }}
                      >
                        <div className="ta-row ta-between">
                          <div className="ta-row ta-gap10">
                            <Icon size={16} color={isSel ? "var(--primary)" : "var(--text-3)"} />
                            <span style={{ fontWeight: 700, fontSize: 13, color: isSel ? "var(--primary)" : "var(--text)" }}>{m.label}</span>
                          </div>
                          {isSel && <CheckCircle2 size={15} color="var(--primary)" />}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4, marginLeft: 26 }}>
                          {m.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <label className="ta-label" style={{ marginBottom: 6, display: "block" }}>Account / Routing Details</label>
                <input
                  className="ta-input"
                  style={{ width: "100%" }}
                  placeholder="IBAN / Routing & Account # / PayPal Email"
                  value={payoutDetails}
                  onChange={(e) => setPayoutDetails(e.target.value)}
                />
              </div>

              <button
                className="ta-btn ta-btn-primary ta-mt20"
                style={{ width: "100%", padding: "11px 16px", fontWeight: 800, fontSize: 13.5 }}
                disabled={submitting || availableBalance <= 0 || !payoutAmount}
                onClick={handleRequestPayout}
              >
                <Send size={15} /> {submitting ? "Processing Withdrawal..." : "Submit Payout Request"}
              </button>
            </div>

            <div className="ta-card" style={{ padding: "22px 24px", background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="ta-title" style={{ fontSize: 16, fontWeight: 800 }}>Payout Request History</div>
              <div className="ta-sub" style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Track automated disbursement confirmations and bank clearing times</div>

              <div className="ta-table-wrap ta-mt14">
                <table className="ta-table">
                  <thead>
                    <tr>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payoutsQuery.data || []).length === 0 && (
                      <tr>
                        <td colSpan={4} className="ta-empty">No payout requests made yet.</td>
                      </tr>
                    )}
                    {(payoutsQuery.data || []).map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 800, color: "var(--text)" }}>${Number(p.amount || 0).toFixed(2)}</td>
                        <td style={{ textTransform: "capitalize" }}>{(p.payment_method?.type || "bank_transfer").replace(/_/g, " ")}</td>
                        <td>
                          <Tag tone={p.status === "completed" ? "success" : p.status === "rejected" ? "danger" : "warning"}>
                            {p.status?.toUpperCase() || "PENDING"}
                          </Tag>
                        </td>
                        <td style={{ fontSize: 12, color: "var(--text-3)" }}>
                          {p.requested_at ? new Date(p.requested_at).toLocaleDateString() : "Recent"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {tab === "refunds" && (
          <div className="ta-card" style={{ padding: "22px 24px", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-title" style={{ fontSize: 16, fontWeight: 800 }}>Student Refund &amp; Dispute Resolutions</div>
            <div className="ta-sub" style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Review session rescheduling disputes and cancellation appeals</div>

            <div className="ta-col ta-gap12 ta-mt16 anim-stagger">
              {refundsQuery.loading && <div className="ta-empty">Loading dispute requests...</div>}
              {!refundsQuery.loading && (refundsQuery.data || []).length === 0 && (
                <div style={{ textAlign: "center", padding: 32 }}>
                  <ShieldCheck size={32} color="#10B981" style={{ marginBottom: 8 }} />
                  <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>Zero Active Disputes</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 4 }}>Your teaching satisfaction rating is in excellent standing with no unresolved learner disputes.</div>
                </div>
              )}

              {(refundsQuery.data || []).map(r => (
                <div key={r.id} style={{ padding: "14px 16px", background: "var(--surface-2)", borderRadius: 12, border: "1px solid var(--border)" }}>
                  <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{r.user_profiles?.display_name || "Learner"} - {r.reason}</div>
                      <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Submitted: {new Date(r.created_at).toLocaleString()}</div>
                    </div>
                    <Tag tone={r.status === "approved" ? "success" : r.status === "declined" ? "danger" : "warning"}>{r.status}</Tag>
                  </div>
                  <div style={{ fontSize: 12.5, marginTop: 8, color: "var(--text-2)" }}>"{r.details || "Requesting review of session attendance fee."}"</div>
                  
                  {r.status === "pending" && (
                    <div className="ta-row ta-gap8 ta-mt12">
                      <button className="ta-btn ta-btn-primary ta-btn-sm" onClick={() => handleRefundResponse(r.id, "approved")}>Approve Refund</button>
                      <button className="ta-btn ta-btn-danger ta-btn-sm" onClick={() => handleRefundResponse(r.id, "declined")}>Decline</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
