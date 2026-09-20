import React, { useState, useMemo, useContext } from "react";
import { TopBar, ToastContext, Tag, Avatar, Switch } from "../components/PlatformUI.jsx";
import { PortalModal } from "../../components/common/PortalModal.jsx";
import {
  CreditCard, RefreshCw, Search, Building2, CheckCircle2, AlertCircle,
  Download, Filter, DollarSign, Wallet, ArrowUpRight, ArrowDownRight,
  Eye, ShieldCheck, Check, X, Loader2, Copy, TrendingUp, Sliders, ExternalLink
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchAllOrgPaymentGateways,
  fetchAllPlatformTransactions,
  fetchAllPlatformPayoutRequests,
  updatePlatformPayoutRequest
} from "../../lib/api/revenue.js";
import {
  testOrgPaymentGatewayConnection,
  updateOrgPaymentGatewaySettings
} from "../../lib/api/organizations.js";
import {
  fetchAllMentorsForPayoutControl,
  setInstructorPayoutsEnabled
} from "../../lib/api/platform.js";

export function PaymentMonitorScreen({ orgSelector, currentUserId }) {
  const showToast = useContext(ToastContext);

  const [activeTab, setActiveTab] = useState("gateways"); // 'gateways' | 'transactions' | 'payouts'
  const [search, setSearch] = useState("");
  const [gatewayFilter, setGatewayFilter] = useState("all");
  const [txnProviderFilter, setTxnProviderFilter] = useState("all");
  const [payoutStatusFilter, setPayoutStatusFilter] = useState("pending");

  // Queries
  const gatewaysQuery = useSupabaseQuery(async () => fetchAllOrgPaymentGateways(), []);
  const txnsQuery = useSupabaseQuery(async () => fetchAllPlatformTransactions(150), []);
  const payoutRequestsQuery = useSupabaseQuery(async () => fetchAllPlatformPayoutRequests(), []);
  const mentorsQuery = useSupabaseQuery(async () => fetchAllMentorsForPayoutControl(), []);

  const gateways = gatewaysQuery.data || [];
  const { transactions = [], summary: txnSummary = { total_gross: 0, total_platform_fee: 0, total_net: 0, count: 0, currency_breakdown: {} } } = txnsQuery.data || {};
  const payoutRequests = payoutRequestsQuery.data || [];
  const mentors = mentorsQuery.data || [];

  // Modal State for Viewing / Editing Org Payment Settings
  const [selectedOrgGateway, setSelectedOrgGateway] = useState(null);
  const [modalEditMode, setModalEditMode] = useState(false);
  const [editPreferredGateway, setEditPreferredGateway] = useState("default");
  const [editEnvironment, setEditEnvironment] = useState("test");
  const [editPaystackSubaccount, setEditPaystackSubaccount] = useState("");
  const [editPaystackPublicKey, setEditPaystackPublicKey] = useState("");
  const [editPaystackSecretKey, setEditPaystackSecretKey] = useState("");
  const [editStripeAccountId, setEditStripeAccountId] = useState("");
  const [editStripePublishableKey, setEditStripePublishableKey] = useState("");
  const [editStripeSecretKey, setEditStripeSecretKey] = useState("");
  const [editBankName, setEditBankName] = useState("");
  const [editAccountNumber, setEditAccountNumber] = useState("");
  const [editAccountName, setEditAccountName] = useState("");
  const [editPayoutCurrency, setEditPayoutCurrency] = useState("NGN");
  const [editSwiftCode, setEditSwiftCode] = useState("");
  const [savingGateway, setSavingGateway] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Busy state for inline actions
  const [busyActionId, setBusyActionId] = useState(null);

  // Helper to open modal
  function handleOpenGatewayModal(org, edit = false) {
    setSelectedOrgGateway(org);
    setModalEditMode(edit);
    setEditPreferredGateway(org.preferred_gateway || "default");
    setEditEnvironment(org.environment || "test");
    setEditPaystackSubaccount(org.paystack_subaccount_code || "");
    setEditPaystackPublicKey(org.paystack_public_key || "");
    setEditPaystackSecretKey("");
    setEditStripeAccountId(org.stripe_account_id || "");
    setEditStripePublishableKey(org.stripe_publishable_key || "");
    setEditStripeSecretKey("");
    setEditBankName(org.bank_name || "");
    setEditAccountNumber(org.account_number || "");
    setEditAccountName(org.account_name || "");
    setEditPayoutCurrency(org.payout_currency || "NGN");
    setEditSwiftCode(org.swift_code || "");
    setTestResult(null);
  }

  // Save Gateway edits from modal
  async function handleSaveGatewayModal() {
    if (!selectedOrgGateway?.org_id) return;
    setSavingGateway(true);
    try {
      const patch = {
        preferred_gateway: editPreferredGateway,
        environment: editEnvironment,
        paystack_subaccount_code: editPaystackSubaccount.trim(),
        paystack_public_key: editPaystackPublicKey.trim(),
        stripe_account_id: editStripeAccountId.trim(),
        stripe_publishable_key: editStripePublishableKey.trim(),
        bank_name: editBankName.trim(),
        account_number: editAccountNumber.trim(),
        account_name: editAccountName.trim(),
        payout_currency: editPayoutCurrency,
        swift_code: editSwiftCode.trim(),
      };
      if (editPaystackSecretKey.trim()) patch.paystack_secret_key = editPaystackSecretKey.trim();
      if (editStripeSecretKey.trim()) patch.stripe_secret_key = editStripeSecretKey.trim();

      const res = await updateOrgPaymentGatewaySettings(selectedOrgGateway.org_id, patch);
      if (res.success) {
        showToast(`Payment settings updated for ${selectedOrgGateway.org_name}.`);
        gatewaysQuery.refetch();
        setSelectedOrgGateway(null);
      } else {
        showToast(res.error || "Failed to update payment settings.");
      }
    } finally {
      setSavingGateway(false);
    }
  }

  // Inline connection test
  function handleTestConnection(org, provider = null) {
    const targetProvider = provider || (org.preferred_gateway === "stripe" ? "stripe" : "paystack");
    const res = testOrgPaymentGatewayConnection({
      provider: targetProvider,
      publicKey: targetProvider === "paystack" ? org.paystack_public_key : org.stripe_publishable_key,
      secretKey: "",
      subaccountCode: org.paystack_subaccount_code,
      accountId: org.stripe_account_id,
      environment: org.environment || "test",
    });
    setTestResult({ orgId: org.org_id, provider: targetProvider, ...res });
    showToast(`${org.org_name} (${targetProvider}): ${res.message}`);
  }

  // Payout Decision
  async function handleDecidePayout(req, status) {
    setBusyActionId(req.id);
    try {
      const res = await updatePlatformPayoutRequest(req.id, status, currentUserId);
      if (res.success) {
        showToast(`Payout request marked as ${status}.`);
        payoutRequestsQuery.refetch();
      } else {
        showToast(res.error || "Could not update payout request.");
      }
    } finally {
      setBusyActionId(null);
    }
  }

  // Instructor Payout Permission Toggle
  async function handleToggleInstructorPayout(mentor) {
    setBusyActionId(`mentor-${mentor.id}`);
    try {
      const nextState = !mentor.payouts_enabled;
      const res = await setInstructorPayoutsEnabled(mentor.id, nextState);
      if (res.success) {
        showToast(`Payouts ${nextState ? "enabled" : "disabled"} for ${mentor.name}.`);
        mentorsQuery.refetch();
      } else {
        showToast(res.error || "Failed to update instructor payout status.");
      }
    } finally {
      setBusyActionId(null);
    }
  }

  // Copy helper
  function copyText(text, label) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard!`);
  }

  // Export Gateways CSV
  function handleExportGatewaysCSV() {
    const headers = ["Organization", "Slug", "Preferred Gateway", "Environment", "Paystack Subaccount", "Stripe Account ID", "Bank Name", "Account Number", "Account Name", "Payout Currency", "Status"];
    const rows = gateways.map(g => [
      `"${g.org_name || ""}"`,
      `"${g.org_slug || ""}"`,
      `"${g.preferred_gateway || "default"}"`,
      `"${g.environment || "test"}"`,
      `"${g.paystack_subaccount_code || ""}"`,
      `"${g.stripe_account_id || ""}"`,
      `"${g.bank_name || ""}"`,
      `"${g.account_number ? "'" + g.account_number : ""}"`,
      `"${g.account_name || ""}"`,
      `"${g.payout_currency || "NGN"}"`,
      `"${g.is_configured ? "Configured" : "Default"}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `trainai_payment_gateways_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Export Transactions CSV
  function handleExportTransactionsCSV() {
    const headers = ["Date", "Organization", "Learner Name", "Learner Email", "Provider", "Reference", "Currency", "Gross Amount", "Commission %", "Platform Fee", "Org Net", "Status"];
    const rows = transactions.map(t => [
      `"${t.created_at || ""}"`,
      `"${t.org_name || ""}"`,
      `"${t.learner_name || ""}"`,
      `"${t.learner_email || ""}"`,
      `"${t.provider || ""}"`,
      `"${t.provider_reference || ""}"`,
      `"${t.currency || ""}"`,
      t.gross_amount || 0,
      t.commission_percent || 0,
      t.platform_fee || 0,
      t.academy_net || 0,
      `"${t.status || ""}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `trainai_platform_transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Filtered Gateways
  const filteredGateways = useMemo(() => {
    return gateways.filter((g) => {
      if (gatewayFilter === "paystack" && !g.has_paystack && g.preferred_gateway !== "paystack") return false;
      if (gatewayFilter === "stripe" && !g.has_stripe && g.preferred_gateway !== "stripe") return false;
      if (gatewayFilter === "bank" && !g.has_bank) return false;
      if (gatewayFilter === "configured" && !g.is_configured) return false;
      if (gatewayFilter === "default" && g.preferred_gateway !== "default") return false;
      if (gatewayFilter === "live" && g.environment !== "live") return false;
      if (gatewayFilter === "test" && g.environment !== "test") return false;

      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        (g.org_name || "").toLowerCase().includes(q) ||
        (g.org_slug || "").toLowerCase().includes(q) ||
        (g.paystack_subaccount_code || "").toLowerCase().includes(q) ||
        (g.stripe_account_id || "").toLowerCase().includes(q) ||
        (g.bank_name || "").toLowerCase().includes(q)
      );
    });
  }, [gateways, gatewayFilter, search]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (txnProviderFilter !== "all" && t.provider !== txnProviderFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        (t.org_name || "").toLowerCase().includes(q) ||
        (t.learner_name || "").toLowerCase().includes(q) ||
        (t.learner_email || "").toLowerCase().includes(q) ||
        (t.provider_reference || "").toLowerCase().includes(q)
      );
    });
  }, [transactions, txnProviderFilter, search]);

  // Filtered Payout Requests
  const filteredPayoutRequests = useMemo(() => {
    return payoutRequests.filter((p) => {
      if (payoutStatusFilter !== "all" && p.status !== payoutStatusFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        (p.mentor_name || "").toLowerCase().includes(q) ||
        (p.org_name || "").toLowerCase().includes(q) ||
        (p.payment_method || "").toLowerCase().includes(q)
      );
    });
  }, [payoutRequests, payoutStatusFilter, search]);

  // High-level counts
  const configuredCount = gateways.filter((g) => g.is_configured).length;
  const paystackCount = gateways.filter((g) => g.has_paystack || g.preferred_gateway === "paystack").length;
  const stripeCount = gateways.filter((g) => g.has_stripe || g.preferred_gateway === "stripe").length;
  const bankCount = gateways.filter((g) => g.has_bank).length;
  const pendingPayoutsCount = payoutRequests.filter((p) => p.status === "pending").length;

  return (
    <div className="ta-fade">
      <TopBar
        title="Payment Gateways & Transactions"
        sub="Monitor organization payment methods, direct payouts, live transactions, and commission cuts"
        orgSelector={orgSelector}
      />

      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* =========================================================================
            HERO BANNER & METRICS
            ========================================================================= */}
        <div className="ta-hero-banner anim-fluid-entrance">
          <div className="tai-glow-emerald" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">Platform Payment Systems &amp; Direct Gateways</h1>
              <p className="ta-hero-desc">
                Oversee multi-tenant gateway configurations across Paystack subaccounts, Stripe Connect accounts, and direct bank settlements. Track transactions, audit platform commission deductions, and manage instructor payouts.
              </p>
            </div>
            <div className="ta-hero-actions">
              <button
                className="ta-btn ta-btn-outline"
                style={{ height: 36, padding: "0 14px", borderRadius: 8, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={() => {
                  gatewaysQuery.refetch();
                  txnsQuery.refetch();
                  payoutRequestsQuery.refetch();
                  mentorsQuery.refetch();
                  showToast("Payment and transaction data refreshed.");
                }}
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================================
            KEY PERFORMANCE METRICS
            ========================================================================= */}
        <div className="ta-grid ta-grid-4">
          <div className="ta-card" style={{ padding: "16px 20px" }}>
            <div className="ta-row ta-between" style={{ marginBottom: 8 }}>
              <span className="ta-label" style={{ margin: 0 }}>Total Platform Cut</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
                <TrendingUp size={15} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)" }}>
              ₦{txnSummary.total_platform_fee.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 4 }}>
              Net revenue share across {txnSummary.count} transactions
            </div>
          </div>

          <div className="ta-card" style={{ padding: "16px 20px" }}>
            <div className="ta-row ta-between" style={{ marginBottom: 8 }}>
              <span className="ta-label" style={{ margin: 0 }}>Total Gross Volume</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--success-bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--success)" }}>
                <DollarSign size={15} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)" }}>
              ₦{txnSummary.total_gross.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 4 }}>
              Total paid by learners before commission
            </div>
          </div>

          <div className="ta-card" style={{ padding: "16px 20px" }}>
            <div className="ta-row ta-between" style={{ marginBottom: 8 }}>
              <span className="ta-label" style={{ margin: 0 }}>Configured Gateways</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", color: "#D97706" }}>
                <CreditCard size={15} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)" }}>
              {configuredCount} <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-3)" }}>/ {gateways.length} Orgs</span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 4 }}>
              {paystackCount} Paystack · {stripeCount} Stripe · {bankCount} Direct Bank
            </div>
          </div>

          <div className="ta-card" style={{ padding: "16px 20px" }}>
            <div className="ta-row ta-between" style={{ marginBottom: 8 }}>
              <span className="ta-label" style={{ margin: 0 }}>Pending Payouts</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: pendingPayoutsCount > 0 ? "#FEE2E2" : "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", color: pendingPayoutsCount > 0 ? "#DC2626" : "var(--text-3)" }}>
                <Wallet size={15} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: pendingPayoutsCount > 0 ? "#DC2626" : "var(--text)" }}>
              {pendingPayoutsCount}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 4 }}>
              Instructor withdrawal requests awaiting review
            </div>
          </div>
        </div>

        {/* =========================================================================
            TABS NAVIGATION & SEARCH CONTROLS
            ========================================================================= */}
        <div className="ta-card" style={{ padding: 12, borderRadius: 10 }}>
          <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 12 }}>
            <div className="ta-row ta-gap8">
              <button
                className={`ta-btn ${activeTab === "gateways" ? "ta-btn-primary" : "ta-btn-ghost"}`}
                style={{ height: 36, fontSize: 13, borderRadius: 8 }}
                onClick={() => { setActiveTab("gateways"); setSearch(""); }}
              >
                <CreditCard size={14} /> Organization Gateways ({gateways.length})
              </button>
              <button
                className={`ta-btn ${activeTab === "transactions" ? "ta-btn-primary" : "ta-btn-ghost"}`}
                style={{ height: 36, fontSize: 13, borderRadius: 8 }}
                onClick={() => { setActiveTab("transactions"); setSearch(""); }}
              >
                <TrendingUp size={14} /> Live Transactions ({transactions.length})
              </button>
              <button
                className={`ta-btn ${activeTab === "payouts" ? "ta-btn-primary" : "ta-btn-ghost"}`}
                style={{ height: 36, fontSize: 13, borderRadius: 8 }}
                onClick={() => { setActiveTab("payouts"); setSearch(""); }}
              >
                <Wallet size={14} /> Instructor Payouts ({payoutRequests.length})
              </button>
            </div>

            <div className="ta-row ta-gap8" style={{ flex: "1 1 280px", maxWidth: 400 }}>
              <div style={{ position: "relative", width: "100%" }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
                <input
                  type="text"
                  className="ta-input"
                  style={{ paddingLeft: 30, height: 36, fontSize: 12.5 }}
                  placeholder={
                    activeTab === "gateways"
                      ? "Search by org name or account ID..."
                      : activeTab === "transactions"
                      ? "Search learner, org or reference..."
                      : "Search instructor or org..."
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            TAB 1: ORGANIZATION PAYMENT GATEWAYS & SETTLEMENTS
            ========================================================================= */}
        {activeTab === "gateways" && (
          <div className="ta-card" style={{ borderRadius: 10, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div className="ta-row ta-gap6">
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginRight: 6 }}>FILTER:</span>
                {[
                  { key: "all", label: "All Orgs" },
                  { key: "configured", label: "Configured" },
                  { key: "paystack", label: "Paystack" },
                  { key: "stripe", label: "Stripe" },
                  { key: "bank", label: "Bank Details" },
                  { key: "default", label: "Platform Default" },
                  { key: "live", label: "Live Mode" },
                  { key: "test", label: "Test Mode" },
                ].map((f) => (
                  <button
                    key={f.key}
                    className={`ta-btn ta-btn-sm ${gatewayFilter === f.key ? "ta-btn-primary" : "ta-btn-outline"}`}
                    style={{ height: 26, fontSize: 11.5, padding: "0 10px", borderRadius: 6 }}
                    onClick={() => setGatewayFilter(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="ta-row ta-gap8">
                <button
                  className="ta-btn ta-btn-outline ta-btn-sm"
                  style={{ height: 30, fontSize: 12, borderRadius: 6 }}
                  onClick={handleExportGatewaysCSV}
                >
                  <Download size={13} /> Export CSV
                </button>
              </div>
            </div>

            <div className="ta-table-wrap">
              <table className="ta-table">
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Preferred Gateway</th>
                    <th>Environment</th>
                    <th>Paystack Subaccount</th>
                    <th>Stripe Account ID</th>
                    <th>Bank Settlement</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {gatewaysQuery.loading && (
                    <tr>
                      <td colSpan={8} className="ta-empty" style={{ padding: 40 }}>
                        <Loader2 size={24} className="ta-spin" style={{ margin: "0 auto 8px" }} />
                        Loading organization payment configurations…
                      </td>
                    </tr>
                  )}

                  {!gatewaysQuery.loading && filteredGateways.length === 0 && (
                    <tr>
                      <td colSpan={8} className="ta-empty" style={{ padding: 40 }}>
                        No organizations found matching the selected filter.
                      </td>
                    </tr>
                  )}

                  {filteredGateways.map((org) => {
                    const hasSubaccount = !!org.paystack_subaccount_code;
                    const hasStripeAcc = !!org.stripe_account_id;
                    const hasBank = !!org.bank_name && !!org.account_number;

                    return (
                      <tr key={org.org_id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Building2 size={16} color="var(--primary)" />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{org.org_name}</div>
                              <div style={{ fontSize: 11, color: "var(--text-3)" }}>/{org.org_slug} · {org.subscription_tier}</div>
                            </div>
                          </div>
                        </td>

                        <td>
                          {org.preferred_gateway === "paystack" ? (
                            <Tag tone="success">Paystack Direct</Tag>
                          ) : org.preferred_gateway === "stripe" ? (
                            <Tag tone="primary">Stripe Direct</Tag>
                          ) : (
                            <Tag tone="neutral">Platform Default</Tag>
                          )}
                        </td>

                        <td>
                          {org.environment === "live" ? (
                            <Tag tone="success">LIVE</Tag>
                          ) : (
                            <Tag tone="warning">TEST</Tag>
                          )}
                        </td>

                        <td>
                          {hasSubaccount ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <code style={{ fontSize: 11, fontWeight: 600 }}>{org.paystack_subaccount_code}</code>
                              <button
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 2 }}
                                onClick={() => copyText(org.paystack_subaccount_code, "Subaccount code")}
                                title="Copy code"
                              >
                                <Copy size={11} />
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: "var(--text-3)" }}>—</span>
                          )}
                        </td>

                        <td>
                          {hasStripeAcc ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <code style={{ fontSize: 11, fontWeight: 600 }}>{org.stripe_account_id}</code>
                              <button
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 2 }}
                                onClick={() => copyText(org.stripe_account_id, "Stripe Account ID")}
                                title="Copy Account ID"
                              >
                                <Copy size={11} />
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: "var(--text-3)" }}>—</span>
                          )}
                        </td>

                        <td>
                          {hasBank ? (
                            <div style={{ fontSize: 12 }}>
                              <div style={{ fontWeight: 600 }}>{org.bank_name}</div>
                              <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                                •••• {org.account_number.slice(-4)} ({org.payout_currency})
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: "var(--text-3)" }}>—</span>
                          )}
                        </td>

                        <td>
                          {org.is_configured ? (
                            <Tag tone="success">Configured</Tag>
                          ) : (
                            <Tag tone="neutral">Default</Tag>
                          )}
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <div className="ta-row ta-gap6" style={{ justifyContent: "flex-end" }}>
                            {org.is_configured && (
                              <button
                                className="ta-btn ta-btn-outline ta-btn-sm"
                                style={{ height: 26, fontSize: 11, padding: "0 8px" }}
                                onClick={() => handleTestConnection(org)}
                                title="Test connection format"
                              >
                                Test
                              </button>
                            )}

                            <button
                              className="ta-btn ta-btn-outline ta-btn-sm"
                              style={{ height: 26, fontSize: 11, padding: "0 8px" }}
                              onClick={() => handleOpenGatewayModal(org, false)}
                            >
                              <Eye size={11} /> View
                            </button>

                            <button
                              className="ta-btn ta-btn-primary ta-btn-sm"
                              style={{ height: 26, fontSize: 11, padding: "0 8px" }}
                              onClick={() => handleOpenGatewayModal(org, true)}
                            >
                              <Sliders size={11} /> Edit
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

        {/* =========================================================================
            TAB 2: LIVE TRANSACTIONS & REVENUE FEED
            ========================================================================= */}
        {activeTab === "transactions" && (
          <div className="ta-card" style={{ borderRadius: 10, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div className="ta-row ta-gap6">
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginRight: 6 }}>PROVIDER:</span>
                {[
                  { key: "all", label: "All Providers" },
                  { key: "paystack", label: "Paystack" },
                  { key: "stripe", label: "Stripe" },
                ].map((f) => (
                  <button
                    key={f.key}
                    className={`ta-btn ta-btn-sm ${txnProviderFilter === f.key ? "ta-btn-primary" : "ta-btn-outline"}`}
                    style={{ height: 26, fontSize: 11.5, padding: "0 10px", borderRadius: 6 }}
                    onClick={() => setTxnProviderFilter(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="ta-row ta-gap8">
                <button
                  className="ta-btn ta-btn-outline ta-btn-sm"
                  style={{ height: 30, fontSize: 12, borderRadius: 6 }}
                  onClick={handleExportTransactionsCSV}
                >
                  <Download size={13} /> Export Transactions CSV
                </button>
              </div>
            </div>

            <div className="ta-table-wrap">
              <table className="ta-table">
                <thead>
                  <tr>
                    <th>Date &amp; Time</th>
                    <th>Organization</th>
                    <th>Learner</th>
                    <th>Gateway &amp; Reference</th>
                    <th>Gross Amount</th>
                    <th>Platform Fee</th>
                    <th>Org Net</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {txnsQuery.loading && (
                    <tr>
                      <td colSpan={8} className="ta-empty" style={{ padding: 40 }}>
                        <Loader2 size={24} className="ta-spin" style={{ margin: "0 auto 8px" }} />
                        Loading platform transactions…
                      </td>
                    </tr>
                  )}

                  {!txnsQuery.loading && filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="ta-empty" style={{ padding: 40 }}>
                        No transactions found.
                      </td>
                    </tr>
                  )}

                  {filteredTransactions.map((txn) => {
                    const symbol = txn.currency === "USD" ? "$" : txn.currency === "GBP" ? "£" : txn.currency === "EUR" ? "€" : "₦";
                    return (
                      <tr key={txn.id}>
                        <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                          {new Date(txn.created_at).toLocaleString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                            hour: "2-digit", minute: "2-digit"
                          })}
                        </td>

                        <td>
                          <div style={{ fontWeight: 600, fontSize: 12.5 }}>{txn.org_name}</div>
                          <div style={{ fontSize: 11, color: "var(--text-3)" }}>/{txn.org_slug}</div>
                        </td>

                        <td>
                          <div style={{ fontWeight: 600, fontSize: 12.5 }}>{txn.learner_name}</div>
                          <div style={{ fontSize: 11, color: "var(--text-3)" }}>{txn.learner_email}</div>
                        </td>

                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Tag tone={txn.provider === "stripe" ? "primary" : "success"}>
                              {txn.provider ? txn.provider.toUpperCase() : "PAYSTACK"}
                            </Tag>
                            <code style={{ fontSize: 11, color: "var(--text-2)" }} title={txn.provider_reference}>
                              {txn.provider_reference ? txn.provider_reference.slice(0, 14) + "…" : "—"}
                            </code>
                          </div>
                        </td>

                        <td style={{ fontWeight: 700 }}>
                          {symbol}{txn.gross_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>

                        <td style={{ color: "var(--primary)", fontWeight: 600 }}>
                          {symbol}{txn.platform_fee.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          <span style={{ fontSize: 10, color: "var(--text-3)", marginLeft: 4 }}>({txn.commission_percent}%)</span>
                        </td>

                        <td style={{ color: "var(--success)", fontWeight: 700 }}>
                          {symbol}{txn.academy_net.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>

                        <td>
                          <Tag tone={txn.status === "completed" ? "success" : txn.status === "refunded" ? "danger" : "warning"}>
                            {txn.status}
                          </Tag>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: INSTRUCTOR PAYOUTS & PERMISSIONS
            ========================================================================= */}
        {activeTab === "payouts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Payout Requests Section */}
            <div className="ta-card" style={{ borderRadius: 10, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Instructor Withdrawal Requests</h3>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Review and process payouts requested by instructors</div>
                </div>

                <div className="ta-row ta-gap6">
                  {["pending", "paid", "rejected", "all"].map((st) => (
                    <button
                      key={st}
                      className={`ta-btn ta-btn-sm ${payoutStatusFilter === st ? "ta-btn-primary" : "ta-btn-outline"}`}
                      style={{ height: 26, fontSize: 11.5, padding: "0 10px", borderRadius: 6, textTransform: "capitalize" }}
                      onClick={() => setPayoutStatusFilter(st)}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ta-table-wrap">
                <table className="ta-table">
                  <thead>
                    <tr>
                      <th>Instructor</th>
                      <th>Organization</th>
                      <th>Amount</th>
                      <th>Payment Method</th>
                      <th>Requested At</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payoutRequestsQuery.loading && (
                      <tr>
                        <td colSpan={7} className="ta-empty" style={{ padding: 40 }}>
                          <Loader2 size={24} className="ta-spin" style={{ margin: "0 auto 8px" }} />
                          Loading payout requests…
                        </td>
                      </tr>
                    )}

                    {!payoutRequestsQuery.loading && filteredPayoutRequests.length === 0 && (
                      <tr>
                        <td colSpan={7} className="ta-empty" style={{ padding: 40 }}>
                          No payout requests in this view.
                        </td>
                      </tr>
                    )}

                    {filteredPayoutRequests.map((req) => (
                      <tr key={req.id}>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{req.mentor_name}</div>
                          <div style={{ fontSize: 11, color: "var(--text-3)" }}>{req.mentor_email}</div>
                        </td>

                        <td>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{req.org_name}</div>
                        </td>

                        <td style={{ fontWeight: 800, fontSize: 13.5 }}>
                          ₦{req.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>

                        <td style={{ fontSize: 12 }}>
                          {req.payment_method}
                        </td>

                        <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                          {new Date(req.requested_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>

                        <td>
                          <Tag tone={req.status === "paid" ? "success" : req.status === "rejected" ? "danger" : "warning"}>
                            {req.status}
                          </Tag>
                        </td>

                        <td style={{ textAlign: "right" }}>
                          {req.status === "pending" ? (
                            <div className="ta-row ta-gap6" style={{ justifyContent: "flex-end" }}>
                              <button
                                className="ta-btn ta-btn-primary ta-btn-sm"
                                style={{ height: 26, fontSize: 11, padding: "0 10px" }}
                                disabled={busyActionId === req.id}
                                onClick={() => handleDecidePayout(req, "paid")}
                              >
                                {busyActionId === req.id ? <Loader2 size={11} className="ta-spin" /> : <Check size={11} />} Mark as Paid
                              </button>
                              <button
                                className="ta-btn ta-btn-outline ta-btn-sm"
                                style={{ height: 26, fontSize: 11, padding: "0 10px", color: "var(--danger)" }}
                                disabled={busyActionId === req.id}
                                onClick={() => handleDecidePayout(req, "rejected")}
                              >
                                <X size={11} /> Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>Processed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Instructor Payout Permissions Control */}
            <div className="ta-card" style={{ borderRadius: 10, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Instructor Payout Permissions (Platform-wide)</h3>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                  Platform owners can grant or revoke an instructor's ability to request direct payouts. Academy-style instructors require payouts enabled; org-employed instructors typically remain off.
                </div>
              </div>

              <div className="ta-table-wrap">
                <table className="ta-table">
                  <thead>
                    <tr>
                      <th>Instructor</th>
                      <th>Organization ID</th>
                      <th>Payouts Enabled</th>
                      <th style={{ textAlign: "right" }}>Toggle Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mentorsQuery.loading && (
                      <tr>
                        <td colSpan={4} className="ta-empty" style={{ padding: 40 }}>
                          <Loader2 size={24} className="ta-spin" style={{ margin: "0 auto 8px" }} />
                          Loading platform instructors…
                        </td>
                      </tr>
                    )}

                    {!mentorsQuery.loading && mentors.length === 0 && (
                      <tr>
                        <td colSpan={4} className="ta-empty" style={{ padding: 40 }}>
                          No instructors found.
                        </td>
                      </tr>
                    )}

                    {mentors.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{m.name}</div>
                          <div style={{ fontSize: 11, color: "var(--text-3)" }}>ID: {m.id}</div>
                        </td>

                        <td>
                          <code style={{ fontSize: 11 }}>{m.organization_id || "Independent"}</code>
                        </td>

                        <td>
                          {m.payouts_enabled ? (
                            <Tag tone="success">Enabled (Academy)</Tag>
                          ) : (
                            <Tag tone="neutral">Disabled (Org-Employed)</Tag>
                          )}
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <button
                            className={`ta-btn ta-btn-sm ${m.payouts_enabled ? "ta-btn-outline" : "ta-btn-primary"}`}
                            style={{ height: 26, fontSize: 11, padding: "0 10px" }}
                            disabled={busyActionId === `mentor-${m.id}`}
                            onClick={() => handleToggleInstructorPayout(m)}
                          >
                            {busyActionId === `mentor-${m.id}` ? (
                              <Loader2 size={11} className="ta-spin" />
                            ) : m.payouts_enabled ? (
                              "Revoke Access"
                            ) : (
                              "Enable Payouts"
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL: VIEW / EDIT ORG GATEWAY SETTINGS
            ========================================================================= */}
        {selectedOrgGateway && (
          <PortalModal
            isOpen={true}
            onClose={() => setSelectedOrgGateway(null)}
            title={`${modalEditMode ? "Edit" : "Inspect"} Payment Gateways — ${selectedOrgGateway.org_name}`}
            maxWidth={640}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Top Gateway Selector & Mode */}
              <div className="ta-grid ta-grid-2">
                <div>
                  <label className="ta-label">Preferred Gateway</label>
                  {modalEditMode ? (
                    <select
                      className="ta-select"
                      value={editPreferredGateway}
                      onChange={(e) => setEditPreferredGateway(e.target.value)}
                    >
                      <option value="default">Platform Default</option>
                      <option value="paystack">Custom Paystack Direct</option>
                      <option value="stripe">Custom Stripe Direct</option>
                    </select>
                  ) : (
                    <div style={{ fontSize: 13, fontWeight: 600, padding: "6px 0" }}>
                      {selectedOrgGateway.preferred_gateway === "paystack" ? "Paystack Direct" : selectedOrgGateway.preferred_gateway === "stripe" ? "Stripe Direct" : "Platform Default"}
                    </div>
                  )}
                </div>

                <div>
                  <label className="ta-label">Gateway Environment</label>
                  {modalEditMode ? (
                    <select
                      className="ta-select"
                      value={editEnvironment}
                      onChange={(e) => setEditEnvironment(e.target.value)}
                    >
                      <option value="test">Test Mode (Sandboxed)</option>
                      <option value="live">Live Mode (Real Transactions)</option>
                    </select>
                  ) : (
                    <div style={{ fontSize: 13, fontWeight: 600, padding: "6px 0" }}>
                      <Tag tone={selectedOrgGateway.environment === "live" ? "success" : "warning"}>
                        {selectedOrgGateway.environment ? selectedOrgGateway.environment.toUpperCase() : "TEST"}
                      </Tag>
                    </div>
                  )}
                </div>
              </div>

              {/* Paystack Subaccount & Keys */}
              <div className="ta-card" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <CreditCard size={14} color="var(--success)" /> Paystack Direct Subaccount
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label className="ta-label" style={{ fontSize: 11 }}>Paystack Subaccount Code</label>
                    {modalEditMode ? (
                      <input
                        type="text"
                        className="ta-input"
                        placeholder="ACCT_xxxxxxxxxxxxx"
                        value={editPaystackSubaccount}
                        onChange={(e) => setEditPaystackSubaccount(e.target.value)}
                      />
                    ) : (
                      <code style={{ fontSize: 12 }}>{selectedOrgGateway.paystack_subaccount_code || "Not configured"}</code>
                    )}
                  </div>

                  <div>
                    <label className="ta-label" style={{ fontSize: 11 }}>Paystack Public Key</label>
                    {modalEditMode ? (
                      <input
                        type="text"
                        className="ta-input"
                        placeholder="pk_live_... or pk_test_..."
                        value={editPaystackPublicKey}
                        onChange={(e) => setEditPaystackPublicKey(e.target.value)}
                      />
                    ) : (
                      <code style={{ fontSize: 12 }}>{selectedOrgGateway.paystack_public_key || "Not configured"}</code>
                    )}
                  </div>

                  {modalEditMode && (
                    <div>
                      <label className="ta-label" style={{ fontSize: 11 }}>Paystack Secret Key (Optional Override)</label>
                      <input
                        type="password"
                        className="ta-input"
                        placeholder="Leave blank to keep existing key"
                        value={editPaystackSecretKey}
                        onChange={(e) => setEditPaystackSecretKey(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Stripe Connect & Keys */}
              <div className="ta-card" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <CreditCard size={14} color="var(--primary)" /> Stripe Connect &amp; Direct Account
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label className="ta-label" style={{ fontSize: 11 }}>Stripe Connected Account ID</label>
                    {modalEditMode ? (
                      <input
                        type="text"
                        className="ta-input"
                        placeholder="acct_xxxxxxxxxxxxx"
                        value={editStripeAccountId}
                        onChange={(e) => setEditStripeAccountId(e.target.value)}
                      />
                    ) : (
                      <code style={{ fontSize: 12 }}>{selectedOrgGateway.stripe_account_id || "Not configured"}</code>
                    )}
                  </div>

                  <div>
                    <label className="ta-label" style={{ fontSize: 11 }}>Stripe Publishable Key</label>
                    {modalEditMode ? (
                      <input
                        type="text"
                        className="ta-input"
                        placeholder="pk_live_... or pk_test_..."
                        value={editStripePublishableKey}
                        onChange={(e) => setEditStripePublishableKey(e.target.value)}
                      />
                    ) : (
                      <code style={{ fontSize: 12 }}>{selectedOrgGateway.stripe_publishable_key || "Not configured"}</code>
                    )}
                  </div>

                  {modalEditMode && (
                    <div>
                      <label className="ta-label" style={{ fontSize: 11 }}>Stripe Secret Key (Optional Override)</label>
                      <input
                        type="password"
                        className="ta-input"
                        placeholder="Leave blank to keep existing key"
                        value={editStripeSecretKey}
                        onChange={(e) => setEditStripeSecretKey(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Bank Settlement Details */}
              <div className="ta-card" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <Wallet size={14} color="#D97706" /> Bank Settlement Information
                </div>

                <div className="ta-grid ta-grid-2" style={{ gap: 10 }}>
                  <div>
                    <label className="ta-label" style={{ fontSize: 11 }}>Bank Name</label>
                    {modalEditMode ? (
                      <input
                        type="text"
                        className="ta-input"
                        placeholder="e.g. Access Bank"
                        value={editBankName}
                        onChange={(e) => setEditBankName(e.target.value)}
                      />
                    ) : (
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{selectedOrgGateway.bank_name || "—"}</span>
                    )}
                  </div>

                  <div>
                    <label className="ta-label" style={{ fontSize: 11 }}>Account Number</label>
                    {modalEditMode ? (
                      <input
                        type="text"
                        className="ta-input"
                        placeholder="e.g. 0123456789"
                        value={editAccountNumber}
                        onChange={(e) => setEditAccountNumber(e.target.value)}
                      />
                    ) : (
                      <code style={{ fontSize: 12 }}>{selectedOrgGateway.account_number || "—"}</code>
                    )}
                  </div>

                  <div>
                    <label className="ta-label" style={{ fontSize: 11 }}>Account Holder Name</label>
                    {modalEditMode ? (
                      <input
                        type="text"
                        className="ta-input"
                        placeholder="e.g. Tech Learning Org Ltd"
                        value={editAccountName}
                        onChange={(e) => setEditAccountName(e.target.value)}
                      />
                    ) : (
                      <span style={{ fontSize: 12.5 }}>{selectedOrgGateway.account_name || "—"}</span>
                    )}
                  </div>

                  <div>
                    <label className="ta-label" style={{ fontSize: 11 }}>Payout Currency</label>
                    {modalEditMode ? (
                      <select
                        className="ta-select"
                        value={editPayoutCurrency}
                        onChange={(e) => setEditPayoutCurrency(e.target.value)}
                      >
                        <option value="NGN">NGN (₦)</option>
                        <option value="USD">USD ($)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="EUR">EUR (€)</option>
                      </select>
                    ) : (
                      <Tag tone="neutral">{selectedOrgGateway.payout_currency || "NGN"}</Tag>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="ta-row ta-between" style={{ marginTop: 8 }}>
                <div>
                  <button
                    className="ta-btn ta-btn-outline"
                    onClick={() => handleTestConnection(selectedOrgGateway)}
                  >
                    Test Connection
                  </button>
                </div>

                <div className="ta-row ta-gap8">
                  <button
                    className="ta-btn ta-btn-ghost"
                    onClick={() => setSelectedOrgGateway(null)}
                  >
                    Close
                  </button>

                  {modalEditMode ? (
                    <button
                      className="ta-btn ta-btn-primary"
                      disabled={savingGateway}
                      onClick={handleSaveGatewayModal}
                    >
                      {savingGateway ? <Loader2 size={13} className="ta-spin" /> : <Check size={13} />} Save Settings
                    </button>
                  ) : (
                    <button
                      className="ta-btn ta-btn-primary"
                      onClick={() => setModalEditMode(true)}
                    >
                      <Sliders size={13} /> Edit Configuration
                    </button>
                  )}
                </div>
              </div>
            </div>
          </PortalModal>
        )}
      </div>
    </div>
  );
}

export default PaymentMonitorScreen;
