import React, { useState, useEffect, useContext } from "react";
import { TopBar, ToastContext, Tag, Switch } from "../components/PlatformUI.jsx";
import {
  CreditCard, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw,
  Copy, Check, ExternalLink, Key, Landmark, HelpCircle,
  ArrowRight, Save, Lock, DollarSign, Wallet, CheckCheck,
  ChevronDown, ChevronRight, Sparkles, Building2, Globe
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchOrgPaymentGatewaySettings,
  updateOrgPaymentGatewaySettings,
  testOrgPaymentGatewayConnection,
  DEFAULT_PAYMENT_GATEWAY_SETTINGS
} from "../../lib/api/organizations.js";

const PAYSTACK_WEBHOOK_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co/functions/v1/paystack-webhook";
const STRIPE_WEBHOOK_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co/functions/v1/stripe-webhook";

export function PaymentSettingsScreen({ orgId, orgSelector, setScreen, userEmail, currentUserId }) {
  const showToast = useContext(ToastContext);

  // Load gateway settings for this organization
  const settingsQuery = useSupabaseQuery(
    async () => (orgId ? fetchOrgPaymentGatewaySettings(orgId) : null),
    [orgId]
  );

  // Form State
  const [preferredGateway, setPreferredGateway] = useState("default");
  const [environment, setEnvironment] = useState("test");
  const [paystackSubaccount, setPaystackSubaccount] = useState("");
  const [paystackPublicKey, setPaystackPublicKey] = useState("");
  const [paystackSecretKey, setPaystackSecretKey] = useState("");
  const [stripeAccountId, setStripeAccountId] = useState("");
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [payoutCurrency, setPayoutCurrency] = useState("NGN");
  const [swiftCode, setSwiftCode] = useState("");

  // UI State
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [activeGuideTab, setActiveGuideTab] = useState("paystack"); // 'paystack' | 'stripe' | 'bank'
  const [expandedSection, setExpandedSection] = useState("gateway"); // 'gateway' | 'credentials' | 'bank'

  // Populate data when loaded
  useEffect(() => {
    if (settingsQuery.data) {
      const d = settingsQuery.data;
      setPreferredGateway(d.preferred_gateway || "default");
      setEnvironment(d.environment || "test");
      setPaystackSubaccount(d.paystack_subaccount_code || "");
      setPaystackPublicKey(d.paystack_public_key || "");
      setPaystackSecretKey(""); // Never populate raw secret keys in client state
      setStripeAccountId(d.stripe_account_id || "");
      setStripePublishableKey(d.stripe_publishable_key || "");
      setStripeSecretKey(""); // Never populate raw secret keys in client state
      setBankName(d.bank_name || "");
      setAccountNumber(d.account_number || "");
      setAccountName(d.account_name || "");
      setPayoutCurrency(d.payout_currency || "NGN");
      setSwiftCode(d.swift_code || "");
    }
  }, [settingsQuery.data]);

  const hasSavedPaystackSecret = Boolean(settingsQuery.data?.has_paystack_secret);
  const hasSavedStripeSecret = Boolean(settingsQuery.data?.has_stripe_secret);

  // Copy helper
  function copyToClipboard(text, id) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    showToast("Copied to clipboard!");
    setTimeout(() => {
      setCopiedKey((prev) => (prev === id ? null : prev));
    }, 2500);
  }

  // Save changes
  async function handleSaveSettings() {
    if (!orgId) {
      showToast("No active organization found.");
      return;
    }
    setSaving(true);
    try {
      const patch = {
        preferred_gateway: preferredGateway,
        environment: environment,
        paystack_subaccount_code: paystackSubaccount.trim(),
        paystack_public_key: paystackPublicKey.trim(),
        stripe_account_id: stripeAccountId.trim(),
        stripe_publishable_key: stripePublishableKey.trim(),
        bank_name: bankName.trim(),
        account_number: accountNumber.trim(),
        account_name: accountName.trim(),
        payout_currency: payoutCurrency,
        swift_code: swiftCode.trim(),
      };

      // Only pass secret key if user actually typed a new one
      if (paystackSecretKey.trim()) {
        patch.paystack_secret_key = paystackSecretKey.trim();
      }
      if (stripeSecretKey.trim()) {
        patch.stripe_secret_key = stripeSecretKey.trim();
      }

      const res = await updateOrgPaymentGatewaySettings(orgId, patch);
      if (res.success) {
        showToast("✓ Payment gateway settings saved successfully!");
        setPaystackSecretKey("");
        setStripeSecretKey("");
        settingsQuery.refetch();
      } else {
        showToast(res.error || "Failed to save payment settings.");
      }
    } finally {
      setSaving(false);
    }
  }

  // Test gateway keys
  function handleTestGateway(provider) {
    const isPaystack = provider === "paystack";
    const res = testOrgPaymentGatewayConnection({
      provider,
      publicKey: isPaystack ? paystackPublicKey : stripePublishableKey,
      secretKey: isPaystack ? paystackSecretKey : stripeSecretKey,
      subaccountCode: isPaystack ? paystackSubaccount : "",
      accountId: !isPaystack ? stripeAccountId : "",
      environment,
    });
    setTestResult({ provider, ...res });
    showToast(res.message);
  }

  return (
    <div className="ta-fade">
      <TopBar
        title="Payment & Payout Setup"
        sub="Connect Paystack or Stripe to receive course revenues directly into your organization's account"
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
                Receive Course Payments &amp; Settle Directly
              </h1>
              <p className="ta-hero-desc">
                When learners purchase courses created by your organization, payments are routed through your configured gateway. You can use your own Paystack Subaccount (NGN, GHS, KES, ZAR), Stripe Connect account (USD, EUR, GBP), or our managed Platform Default.
              </p>
            </div>
            <div className="ta-hero-actions">
              <button
                className="ta-btn ta-btn-outline"
                style={{ height: 36, padding: "0 14px", borderRadius: 8, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={() => settingsQuery.refetch()}
              >
                <RefreshCw size={13} className={settingsQuery.loading ? "ta-spin" : ""} /> Refresh
              </button>
              <button
                className="ta-btn ta-btn-primary"
                style={{ height: 36, padding: "0 18px", borderRadius: 8, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={handleSaveSettings}
                disabled={saving}
              >
                <Save size={13} /> {saving ? "Saving…" : "Save All Settings"}
              </button>
            </div>
          </div>
        </div>

        {/* Step-by-Step Setup Guide & Webhook Configuration Box */}
        <div className="ta-card" style={{ borderRadius: 12, border: "1px solid var(--border)", padding: 20, background: "var(--surface)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                <CreditCard size={18} color="var(--primary)" />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Step-by-Step Setup Guide &amp; Webhooks</h2>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Follow these instructions to connect your account and verify automated enrollments</div>
              </div>
            </div>

            {/* Guide Switcher Tabs */}
            <div className="ta-row ta-gap6">
              <button
                className={`ta-btn ta-btn-sm ${activeGuideTab === "paystack" ? "ta-btn-primary" : "ta-btn-outline"}`}
                style={{ height: 30, fontSize: 12, borderRadius: 8 }}
                onClick={() => setActiveGuideTab("paystack")}
              >
                Paystack Setup
              </button>
              <button
                className={`ta-btn ta-btn-sm ${activeGuideTab === "stripe" ? "ta-btn-primary" : "ta-btn-outline"}`}
                style={{ height: 30, fontSize: 12, borderRadius: 8 }}
                onClick={() => setActiveGuideTab("stripe")}
              >
                Stripe Setup
              </button>
              <button
                className={`ta-btn ta-btn-sm ${activeGuideTab === "bank" ? "ta-btn-primary" : "ta-btn-outline"}`}
                style={{ height: 30, fontSize: 12, borderRadius: 8 }}
                onClick={() => setActiveGuideTab("bank")}
              >
                Bank Settlement
              </button>
            </div>
          </div>

          {/* Guide Content: PAYSTACK */}
          {activeGuideTab === "paystack" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ padding: "12px 16px", borderRadius: 8, background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", display: "flex", alignItems: "flex-start", gap: 12 }}>
                <CheckCircle2 size={18} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text-1)" }}>
                  <strong>Paystack is ideal for African and multi-currency payments</strong> (Nigeria, Ghana, Kenya, South Africa, plus USD cards). You can either create a <strong>Subaccount</strong> (instant setup, no server keys required) or use your own <strong>API Keys</strong>.
                </div>
              </div>

              {/* Steps List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                
                {/* Step 1 */}
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    1
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Log In to Your Paystack Dashboard</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                      Go to <a href="https://dashboard.paystack.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", textDecoration: "underline" }}>dashboard.paystack.com <ExternalLink size={11} style={{ display: "inline" }} /></a> and ensure your business is activated.
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    2
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Option A: Create a Subaccount (Recommended)</div>
                    <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2, lineHeight: 1.5 }}>
                      In Paystack Dashboard, navigate to <strong>Settings → Subaccounts → Create Subaccount</strong>. Select your bank, enter your account number, and choose your split preference. Copy your generated Subaccount Code (starts with <code>ACCT_</code>) and paste it into the <strong>Paystack Subaccount Code</strong> field below.
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
                      <strong>Option B: Use Custom API Keys:</strong> Go to <strong>Settings → API Keys &amp; Webhooks</strong>. Copy your Public Key (<code>pk_live_...</code> or <code>pk_test_...</code>) and Secret Key (<code>sk_live_...</code> or <code>sk_test_...</code>).
                    </div>
                  </div>
                </div>

                {/* Step 3: Webhook */}
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#10B981", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    3
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                      Configure Your Paystack Webhook URL <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "rgba(16, 185, 129, 0.15)", color: "#10B981", fontWeight: 700 }}>CRITICAL</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2, lineHeight: 1.5 }}>
                      In your Paystack Dashboard, go to <strong>Settings → API Keys &amp; Webhooks → Webhook URL</strong> (configure both Test and Live). Paste the following endpoint URL:
                    </div>

                    {/* Webhook Copy Box */}
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px" }}>
                      <code style={{ fontSize: 12, flex: 1, wordBreak: "break-all", color: "var(--text-1)", fontFamily: "monospace" }}>
                        {PAYSTACK_WEBHOOK_URL}
                      </code>
                      <button
                        className="ta-btn ta-btn-outline ta-btn-sm"
                        style={{ height: 28, padding: "0 10px", fontSize: 11.5, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}
                        onClick={() => copyToClipboard(PAYSTACK_WEBHOOK_URL, "paystack-webhook")}
                      >
                        {copiedKey === "paystack-webhook" ? (
                          <>
                            <CheckCheck size={12} color="#10B981" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy size={12} /> Copy URL
                          </>
                        )}
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                      Why this matters: This webhook automatically notifies TrainAI when a learner successfully completes payment, granting immediate access to course materials even if their browser is closed.
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Guide Content: STRIPE */}
          {activeGuideTab === "stripe" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ padding: "12px 16px", borderRadius: 8, background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.2)", display: "flex", alignItems: "flex-start", gap: 12 }}>
                <Globe size={18} color="#3B82F6" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text-1)" }}>
                  <strong>Stripe is ideal for international card payments, USD, EUR, and GBP</strong>. Connect your Stripe account using your Connected Account ID (<code>acct_...</code>) or custom API keys.
                </div>
              </div>

              {/* Steps List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                
                {/* Step 1 */}
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    1
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Open Your Stripe Dashboard</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                      Navigate to <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", textDecoration: "underline" }}>dashboard.stripe.com <ExternalLink size={11} style={{ display: "inline" }} /></a>.
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    2
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Retrieve Keys or Connected Account ID</div>
                    <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2, lineHeight: 1.5 }}>
                      Go to <strong>Developers → API Keys</strong>. Copy your <strong>Publishable key</strong> (<code>pk_live_...</code> or <code>pk_test_...</code>) and <strong>Secret key</strong> (<code>sk_live_...</code> or <code>sk_test_...</code>). If using Stripe Connect, also copy your Account ID (<code>acct_...</code>) from <strong>Settings → Account details</strong>.
                    </div>
                  </div>
                </div>

                {/* Step 3: Webhook */}
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#3B82F6", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    3
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                      Configure Your Stripe Webhook Endpoint <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "rgba(59, 130, 246, 0.15)", color: "#3B82F6", fontWeight: 700 }}>REQUIRED</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2, lineHeight: 1.5 }}>
                      In your Stripe Dashboard, go to <strong>Developers → Webhooks → Add endpoint</strong>. Paste the following URL:
                    </div>

                    {/* Webhook Copy Box */}
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px" }}>
                      <code style={{ fontSize: 12, flex: 1, wordBreak: "break-all", color: "var(--text-1)", fontFamily: "monospace" }}>
                        {STRIPE_WEBHOOK_URL}
                      </code>
                      <button
                        className="ta-btn ta-btn-outline ta-btn-sm"
                        style={{ height: 28, padding: "0 10px", fontSize: 11.5, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}
                        onClick={() => copyToClipboard(STRIPE_WEBHOOK_URL, "stripe-webhook")}
                      >
                        {copiedKey === "stripe-webhook" ? (
                          <>
                            <CheckCheck size={12} color="#10B981" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy size={12} /> Copy URL
                          </>
                        )}
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                      Select the following events to listen to: <code>checkout.session.completed</code>, <code>payment_intent.succeeded</code>.
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Guide Content: BANK SETTLEMENT */}
          {activeGuideTab === "bank" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ padding: "12px 16px", borderRadius: 8, background: "rgba(217, 119, 6, 0.08)", border: "1px solid rgba(217, 119, 6, 0.2)", display: "flex", alignItems: "flex-start", gap: 12 }}>
                <Landmark size={18} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text-1)" }}>
                  <strong>Direct Bank Settlement</strong> is used for manual reconciliation, corporate wire transfers, or when using Platform Default gateway where TrainAI calculates and transfers your net earnings periodically.
                </div>
              </div>

              <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.6 }}>
                Please fill in your legal entity name, operating bank name, account number, SWIFT/BIC code, and preferred payout currency in the <strong>Bank Settlement Information</strong> section below.
              </div>
            </div>
          )}

        </div>

        {/* Configuration Section 1: Gateway Selection & Environment */}
        <div className="ta-card" style={{ borderRadius: 12, border: "1px solid var(--border)", padding: 20, background: "var(--surface)" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: 8 }}>
            <CreditCard size={17} color="var(--primary)" /> 1. Payment Gateway &amp; Environment Selection
          </h2>

          <div className="ta-grid ta-grid-2" style={{ gap: 16 }}>
            <div>
              <label className="ta-label" style={{ marginBottom: 6 }}>Preferred Primary Gateway</label>
              <select
                className="ta-select"
                value={preferredGateway}
                onChange={(e) => setPreferredGateway(e.target.value)}
              >
                <option value="default">Platform Default (Managed by TrainAI)</option>
                <option value="paystack">Paystack Direct / Subaccount (NGN, GHS, KES, ZAR)</option>
                <option value="stripe">Stripe Direct / Connect (USD, EUR, GBP)</option>
                <option value="bank_transfer">Direct Bank Transfer / Wire Settlement</option>
              </select>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 4 }}>
                Learners paying for your courses will be directed through this processor.
              </div>
            </div>

            <div>
              <label className="ta-label" style={{ marginBottom: 6 }}>Gateway Environment</label>
              <select
                className="ta-select"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
              >
                <option value="test">Test Mode (Sandboxed — test cards accepted, no real funds)</option>
                <option value="live">Live Mode (Production — real learner card charges and payouts)</option>
              </select>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 4 }}>
                Current mode:{" "}
                <Tag tone={environment === "live" ? "success" : "warning"}>
                  {environment ? environment.toUpperCase() : "TEST"}
                </Tag>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Section 2: Paystack Gateway Credentials */}
        <div className="ta-card" style={{ borderRadius: 12, border: "1px solid var(--border)", padding: 20, background: "var(--surface)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CreditCard size={16} color="#10B981" />
              </div>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>2. Paystack Credentials &amp; Subaccount</h2>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>Configure Paystack to settle course fees into your Nigerian / African bank account</div>
              </div>
            </div>

            <div className="ta-row ta-gap8">
              <button
                type="button"
                className="ta-btn ta-btn-outline ta-btn-sm"
                style={{ height: 28, fontSize: 11.5 }}
                onClick={() => handleTestGateway("paystack")}
              >
                Test Paystack Keys
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            
            {/* Subaccount Code */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <label className="ta-label" style={{ margin: 0 }}>Paystack Subaccount Code</label>
                {paystackSubaccount && (
                  <span style={{ fontSize: 11, color: "#10B981", fontWeight: 600 }}>✓ Subaccount Configured</span>
                )}
              </div>
              <input
                type="text"
                className="ta-input"
                placeholder="ACCT_xxxxxxxxxxxxx"
                value={paystackSubaccount}
                onChange={(e) => setPaystackSubaccount(e.target.value)}
              />
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 4 }}>
                Found in your Paystack Dashboard under Settings → Subaccounts. Enables automatic split and direct deposit.
              </div>
            </div>

            {/* Public Key */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <label className="ta-label" style={{ margin: 0 }}>Paystack Public Key</label>
                {paystackPublicKey && (
                  <span style={{ fontSize: 11, color: "#10B981", fontWeight: 600 }}>✓ Public Key Configured</span>
                )}
              </div>
              <input
                type="text"
                className="ta-input"
                placeholder={environment === "live" ? "pk_live_xxxxxxxxxxxxxxxxxxxx" : "pk_test_xxxxxxxxxxxxxxxxxxxx"}
                value={paystackPublicKey}
                onChange={(e) => setPaystackPublicKey(e.target.value)}
              />
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 4 }}>
                Must start with <code>{environment === "live" ? "pk_live_" : "pk_test_"}</code> for {environment.toUpperCase()} mode.
              </div>
            </div>

            {/* Secret Key with Security Masking */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <label className="ta-label" style={{ margin: 0 }}>Paystack Secret Key</label>
                {hasSavedPaystackSecret && (
                  <span style={{ fontSize: 11, color: "var(--primary)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    <Lock size={11} /> Saved &amp; Encrypted in Database
                  </span>
                )}
              </div>

              {hasSavedPaystackSecret && (
                <div style={{ marginBottom: 8, padding: "8px 12px", borderRadius: 6, background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-2)" }}>
                    <Lock size={13} color="var(--primary)" />
                    <span style={{ fontFamily: "monospace", letterSpacing: 2 }}>••••••••••••••••••••••••</span>
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>(Configured &amp; Hidden for security)</span>
                  </div>
                  <Tag tone="success">Active</Tag>
                </div>
              )}

              <input
                type="password"
                className="ta-input"
                placeholder={hasSavedPaystackSecret ? "Enter new secret key to update (leave blank to keep existing)" : (environment === "live" ? "sk_live_xxxxxxxxxxxxxxxxxxxx" : "sk_test_xxxxxxxxxxxxxxxxxxxx")}
                value={paystackSecretKey}
                onChange={(e) => setPaystackSecretKey(e.target.value)}
              />
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 4 }}>
                For security, your secret key is write-only. Once saved, it is never displayed or transmitted to any client.
              </div>
            </div>

          </div>
        </div>

        {/* Configuration Section 3: Stripe Gateway Credentials */}
        <div className="ta-card" style={{ borderRadius: 12, border: "1px solid var(--border)", padding: 20, background: "var(--surface)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(59, 130, 246, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CreditCard size={16} color="#3B82F6" />
              </div>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>3. Stripe Credentials &amp; Connected Account</h2>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>Configure Stripe for global credit card acceptance in USD, EUR, and GBP</div>
              </div>
            </div>

            <div className="ta-row ta-gap8">
              <button
                type="button"
                className="ta-btn ta-btn-outline ta-btn-sm"
                style={{ height: 28, fontSize: 11.5 }}
                onClick={() => handleTestGateway("stripe")}
              >
                Test Stripe Keys
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            
            {/* Stripe Account ID */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <label className="ta-label" style={{ margin: 0 }}>Stripe Connected Account ID</label>
                {stripeAccountId && (
                  <span style={{ fontSize: 11, color: "#3B82F6", fontWeight: 600 }}>✓ Account ID Configured</span>
                )}
              </div>
              <input
                type="text"
                className="ta-input"
                placeholder="acct_xxxxxxxxxxxxx"
                value={stripeAccountId}
                onChange={(e) => setStripeAccountId(e.target.value)}
              />
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 4 }}>
                Your Stripe Connect Account ID (starts with <code>acct_</code>).
              </div>
            </div>

            {/* Publishable Key */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <label className="ta-label" style={{ margin: 0 }}>Stripe Publishable Key</label>
                {stripePublishableKey && (
                  <span style={{ fontSize: 11, color: "#3B82F6", fontWeight: 600 }}>✓ Publishable Key Configured</span>
                )}
              </div>
              <input
                type="text"
                className="ta-input"
                placeholder={environment === "live" ? "pk_live_xxxxxxxxxxxxxxxxxxxx" : "pk_test_xxxxxxxxxxxxxxxxxxxx"}
                value={stripePublishableKey}
                onChange={(e) => setStripePublishableKey(e.target.value)}
              />
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 4 }}>
                Must start with <code>{environment === "live" ? "pk_live_" : "pk_test_"}</code> for {environment.toUpperCase()} mode.
              </div>
            </div>

            {/* Secret Key with Security Masking */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <label className="ta-label" style={{ margin: 0 }}>Stripe Secret Key</label>
                {hasSavedStripeSecret && (
                  <span style={{ fontSize: 11, color: "var(--primary)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    <Lock size={11} /> Saved &amp; Encrypted in Database
                  </span>
                )}
              </div>

              {hasSavedStripeSecret && (
                <div style={{ marginBottom: 8, padding: "8px 12px", borderRadius: 6, background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-2)" }}>
                    <Lock size={13} color="var(--primary)" />
                    <span style={{ fontFamily: "monospace", letterSpacing: 2 }}>••••••••••••••••••••••••</span>
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>(Configured &amp; Hidden for security)</span>
                  </div>
                  <Tag tone="success">Active</Tag>
                </div>
              )}

              <input
                type="password"
                className="ta-input"
                placeholder={hasSavedStripeSecret ? "Enter new secret key to update (leave blank to keep existing)" : (environment === "live" ? "sk_live_xxxxxxxxxxxxxxxxxxxx" : "sk_test_xxxxxxxxxxxxxxxxxxxx")}
                value={stripeSecretKey}
                onChange={(e) => setStripeSecretKey(e.target.value)}
              />
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 4 }}>
                For security, your secret key is write-only. Once saved, it is never displayed or transmitted to any client.
              </div>
            </div>

          </div>
        </div>

        {/* Configuration Section 4: Bank Settlement Information */}
        <div className="ta-card" style={{ borderRadius: 12, border: "1px solid var(--border)", padding: 20, background: "var(--surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(217, 119, 6, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Landmark size={16} color="#D97706" />
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>4. Bank Settlement Information</h2>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>Your organization's official bank details for payouts and wire transfers</div>
            </div>
          </div>

          <div className="ta-grid ta-grid-2" style={{ gap: 14 }}>
            <div>
              <label className="ta-label">Bank Name</label>
              <input
                type="text"
                className="ta-input"
                placeholder="e.g. Access Bank, Chase, Barclays"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </div>

            <div>
              <label className="ta-label">Account Number / IBAN</label>
              <input
                type="text"
                className="ta-input"
                placeholder="e.g. 0123456789 or GB82..."
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
            </div>

            <div>
              <label className="ta-label">Account Holder / Legal Entity Name</label>
              <input
                type="text"
                className="ta-input"
                placeholder="e.g. Northwind Academy Ltd"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
            </div>

            <div>
              <label className="ta-label">Settlement Currency</label>
              <select
                className="ta-select"
                value={payoutCurrency}
                onChange={(e) => setPayoutCurrency(e.target.value)}
              >
                <option value="NGN">NGN — Nigerian Naira (₦)</option>
                <option value="USD">USD — US Dollar ($)</option>
                <option value="GBP">GBP — British Pound (£)</option>
                <option value="EUR">EUR — Euro (€)</option>
                <option value="GHS">GHS — Ghanaian Cedi (GH₵)</option>
                <option value="KES">KES — Kenyan Shilling (KSh)</option>
                <option value="ZAR">ZAR — South African Rand (R)</option>
              </select>
            </div>

            <div style={{ gridColumn: "span 2" }}>
              <label className="ta-label">SWIFT / BIC / Routing Code (Optional for International Wire)</label>
              <input
                type="text"
                className="ta-input"
                placeholder="e.g. CHASUS33XXX"
                value={swiftCode}
                onChange={(e) => setSwiftCode(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Bottom Save Bar */}
        <div className="ta-card" style={{ borderRadius: 12, border: "1px solid var(--border)", padding: "16px 20px", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ShieldCheck size={20} color="#10B981" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Ready to receive payments?</div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                Make sure you have copied the webhook URL into your Paystack or Stripe dashboard to enable instant course enrollment.
              </div>
            </div>
          </div>

          <div className="ta-row ta-gap10">
            <button
              className="ta-btn ta-btn-outline"
              style={{ height: 38, padding: "0 16px", fontSize: 12.5 }}
              onClick={() => settingsQuery.refetch()}
            >
              Reset
            </button>
            <button
              className="ta-btn ta-btn-primary"
              style={{ height: 38, padding: "0 22px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
              onClick={handleSaveSettings}
              disabled={saving}
            >
              <Save size={14} /> {saving ? "Saving Settings…" : "Save Payment Settings"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
