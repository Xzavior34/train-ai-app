import React, { useState, useContext } from "react";
import { TopBar, Tag, ToastContext } from "../components/PlatformUI.jsx";
import { DollarSign, Send } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchMentorEarnings, fetchMentorPayoutRequests, submitMentorPayoutRequest,
  fetchRefundRequestsForMentor, respondToRefundRequest,
} from "../../lib/api/schemaHelper.js";
import { useAuth } from "../../lib/useAuth.js";

const PAYOUT_METHODS = [
  { key: "bank_transfer", label: "Bank transfer" },
  { key: "paypal", label: "PayPal" },
  { key: "mobile_money", label: "Mobile money" },
];

export function AdministrativeScreen({ mentorId, mentorProfileQuery, currentUserId }) {
  const payoutsEnabled = !!mentorProfileQuery?.data?.payouts_enabled;
  const showToast = useContext(ToastContext);
  const { session } = useAuth();
  const [tab, setTab] = useState("earnings");

  const earningsQuery = useSupabaseQuery(async () => mentorId ? fetchMentorEarnings(mentorId) : [], [mentorId]);
  const payoutsQuery = useSupabaseQuery(async () => mentorId ? fetchMentorPayoutRequests(mentorId) : [], [mentorId]);
  const refundsQuery = useSupabaseQuery(async () => mentorId ? fetchRefundRequestsForMentor(mentorId) : [], [mentorId]);

  const earnings = earningsQuery.data || [];
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
    if (!mentorId || !amount || amount <= 0) { showToast("Enter a valid payout amount."); return; }
    if (amount > availableBalance) { showToast("Amount exceeds your available balance."); return; }
    setSubmitting(true);
    try {
      const result = await submitMentorPayoutRequest(mentorId, amount, { type: payoutMethod, details: payoutDetails || null });
      if (result?.success === false) {
        showToast(result.error);
      } else {
        setPayoutAmount(""); setPayoutDetails("");
        payoutsQuery.refetch();
        showToast("Payout request submitted.");
      }
    } catch (e) {
      showToast(e.message || "Could not submit payout request.");
    } finally {
      setSubmitting(false);
    }
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
      <TopBar title="Earnings & Payouts" sub="Earnings, payout history & disputes" />
      <div className="ta-content">
        <div className="ta-tabs">
          {[{ k: "earnings", label: "Earnings" }, { k: "payouts", label: "Payouts" }, { k: "refunds", label: "Refunds & Disputes" }].map(t => (
            <div key={t.k} className={`ta-tab ${tab === t.k ? "active" : ""}`} onClick={() => setTab(t.k)}>{t.label}</div>
          ))}
        </div>

        {tab === "earnings" && (
          <>
            <div className="ta-card ta-mt16">
              <div className="ta-row" style={{ flexWrap: "wrap", gap: 32 }}>
                <div>
                  <div className="ta-label">Available balance</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "var(--primary)", marginTop: 4 }}>${availableBalance.toFixed(2)}</div>
                </div>
                <div>
                  <div className="ta-label">Lifetime earnings</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>${totalEarnings.toFixed(2)}</div>
                </div>
                <div>
                  <div className="ta-label">Pending</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--warning)", marginTop: 6 }}>${pendingEarnings.toFixed(2)}</div>
                </div>
              </div>
            </div>
            <div className="ta-card ta-mt16">
              <div className="ta-title">Earnings history</div>
              <div className="ta-table-wrap">
              <table className="ta-table ta-mt12">
                <thead><tr><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {earningsQuery.loading && <tr><td colSpan={4} className="ta-empty">Loading earnings...</td></tr>}
                  {!earningsQuery.loading && earnings.length === 0 && <tr><td colSpan={4} className="ta-empty">No earnings recorded yet.</td></tr>}
                  {earnings.map(e => (
                    <tr key={e.id}>
                      <td style={{ textTransform: "capitalize" }}>{(e.earning_type || "session").replace(/_/g, " ")}</td>
                      <td>${Number(e.amount || 0).toFixed(2)}</td>
                      <td><Tag tone={e.status === "available" || e.status === "paid" ? "success" : e.status === "pending" ? "warning" : undefined}>{e.status || "N/A"}</Tag></td>
                      <td>{e.created_at ? new Date(e.created_at).toLocaleDateString() : "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </>
        )}

        {tab === "payouts" && (
          <>
            {!payoutsEnabled && (
              <div className="ta-card ta-mt16" style={{ maxWidth: 560, borderColor: "var(--warning, #B45309)" }}>
                <div style={{ fontSize: 12.5, color: "var(--warning, #B45309)", fontWeight: 600 }}>
                  Payouts aren't enabled for your account - this is normal if you work for an organization rather than running an independent academy. Your earnings below are still tracked correctly. Contact Train AI if you believe this should be enabled.
                </div>
              </div>
            )}
            <div className="ta-card ta-mt16" style={{ maxWidth: 560, opacity: payoutsEnabled ? 1 : 0.6 }}>
              <div className="ta-title">Request a withdrawal</div>
              <div className="ta-label ta-mt12">Amount ($)</div>
              <input className="ta-input ta-mt6" type="number" min="0" step="0.01" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)} placeholder={`Up to $${availableBalance.toFixed(2)}`} disabled={!payoutsEnabled} />
              <div className="ta-label ta-mt12">Payout method</div>
              <select className="ta-input ta-mt6" value={payoutMethod} onChange={e => setPayoutMethod(e.target.value)} disabled={!payoutsEnabled}>
                {PAYOUT_METHODS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
              <div className="ta-label ta-mt12">Account details</div>
              <input className="ta-input ta-mt6" value={payoutDetails} onChange={e => setPayoutDetails(e.target.value)} placeholder="Account number / email / phone" disabled={!payoutsEnabled} />
              <button className="ta-btn ta-btn-primary ta-mt16" disabled={!payoutsEnabled || !mentorId || submitting || availableBalance <= 0} onClick={handleRequestPayout}>
                <Send size={15} /> Request Payout
              </button>
              {!payoutsEnabled && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>Disabled - payouts aren't enabled for your account.</div>}
            </div>

            <div className="ta-card ta-mt16">
              <div className="ta-title">Payout history</div>
              <div className="ta-table-wrap">
              <table className="ta-table ta-mt12">
                <thead><tr><th>Amount</th><th>Method</th><th>Status</th><th>Requested</th></tr></thead>
                <tbody>
                  {payoutsQuery.loading && <tr><td colSpan={4} className="ta-empty">Loading payout history...</td></tr>}
                  {!payoutsQuery.loading && (payoutsQuery.data || []).length === 0 && <tr><td colSpan={4} className="ta-empty">No payout requests yet.</td></tr>}
                  {(payoutsQuery.data || []).map(p => (
                    <tr key={p.id}>
                      <td>${Number(p.amount || 0).toFixed(2)}</td>
                      <td style={{ textTransform: "capitalize" }}>{(p.payment_method?.type || "N/A").replace(/_/g, " ")}</td>
                      <td><Tag tone={p.status === "completed" ? "success" : p.status === "rejected" ? "danger" : "warning"}>{p.status || "pending"}</Tag></td>
                      <td>{p.requested_at ? new Date(p.requested_at).toLocaleDateString() : "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </>
        )}

        {tab === "refunds" && (
          <div className="ta-card ta-mt16">
            <div className="ta-title">Refund & dispute requests</div>
            <div className="ta-col ta-gap12 ta-mt12 anim-stagger">
              {refundsQuery.loading && <div className="ta-empty">Loading requests...</div>}
              {!refundsQuery.loading && (refundsQuery.data || []).length === 0 && <div className="ta-empty">No refund or dispute requests.</div>}
              {(refundsQuery.data || []).map(r => (
                <div key={r.id} style={{ padding: 14, background: "var(--surface-3)", borderRadius: 12 }}>
                  <div className="ta-row ta-between">
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{r.learner_name || "Learner"} · ${Number(r.amount || 0).toFixed(2)} {r.type || "refund"}</div>
                      <div style={{ fontSize: 12, color: "var(--text-3)" }}>{r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}{r.session_date ? ` · session ${new Date(r.session_date).toLocaleDateString()}` : ""}</div>
                    </div>
                    <Tag tone={r.status === "approved" ? "success" : r.status === "rejected" ? "danger" : "warning"}>{r.status || "pending"}</Tag>
                  </div>
                  <div className="ta-body ta-mt8">{r.reason}</div>
                  {r.mentor_response && <div className="ta-body ta-mt8" style={{ fontStyle: "italic" }}>Your response: {r.mentor_response}</div>}
                  {(!r.status || r.status === "pending") && (
                    <div className="ta-col ta-gap8 ta-mt12">
                      <input
                        className="ta-input"
                        placeholder="Add a response (optional)"
                        value={refundResponses[r.id] || ""}
                        onChange={e => setRefundResponses(prev => ({ ...prev, [r.id]: e.target.value }))}
                      />
                      <div className="ta-row ta-gap8">
                        <button className="ta-btn ta-btn-primary ta-btn-sm" onClick={() => handleRefundResponse(r.id, "approved")}>Approve</button>
                        <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => handleRefundResponse(r.id, "rejected")}>Decline</button>
                      </div>
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
