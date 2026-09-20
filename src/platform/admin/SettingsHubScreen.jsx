import React, { useState, useEffect, useCallback, useContext, useMemo } from "react";
import { applyDynamicBranding } from "../../lib/brandingHelper.js";
import { TopBar, ToastContext, Switch, Tag, setGlobalThemeDark, getStoredThemeDark } from "../components/PlatformUI.jsx";
import { Lock, ShieldCheck, Moon, Database, Trash2, RefreshCw, Building2, Save, Palette, Eye, Sparkles, ArrowRight, Check } from "lucide-react";
import { isMockDataEnabled, setMockDataEnabled, purgeAllMockData, restoreMockData, subscribeToMockDataChanges } from "../../lib/mockDataManager.js";
import MfaSetupScreen from "../../pages/auth/MfaSetupScreen.jsx";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchOrganizationById, updateOrganization, fetchOrgBranding, upsertOrgBranding, fetchMyOrgSupportTickets, createSupportTicket } from "../../lib/api/platform.js";
import { fetchOrgAISettings, updateOrgAISettings, fetchOrgAIInsightsSettings, updateOrgAIInsightsSettings, fetchOrgLeaderboardSettings, updateOrgLeaderboardSettings, fetchOrgGamificationSettings, updateOrgGamificationSettings, startOrganizationSubscriptionPayment, TIER_LABELS, fetchTierPrice, fetchOrgSeatsSummary, startSeatPurchasePayment, fetchSeatPrice, fetchOrgPaymentGatewaySettings, updateOrgPaymentGatewaySettings, testOrgPaymentGatewayConnection } from "../../lib/api/organizations.js";
import { PlanSelectionModal, PLAN_TIERS } from "../../components/common/PlanSelectionModal.jsx";
import { getUserLocationCurrency, formatCurrencyAmount } from "../../lib/locationCurrency.js";

// organization's name with that fake placeholder if an admin didn't notice
// and retype their real name first. Fixed by fetching the real organizations
// row directly via the org id already available on this screen.
export function SettingsHubScreen({ orgId, profileQuery, orgSelector, setScreen, userEmail }) {
  const showToast = useContext(ToastContext);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const orgQuery = useSupabaseQuery(async () => (orgId ? fetchOrganizationById(orgId) : null), [orgId]);
  const org = orgQuery.data;
  const [payingTier, setPayingTier] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const seatsSummaryQuery = useSupabaseQuery(async () => (orgId ? fetchOrgSeatsSummary(orgId) : { purchased: 0, used: 0, available: 0 }), [orgId]);
  const seatsSummary = seatsSummaryQuery.data || { purchased: 0, used: 0, available: 0 };
  const [seatsToBuy, setSeatsToBuy] = useState("");
  const [purchasingSeats, setPurchasingSeats] = useState(false);
  const userLoc = useMemo(() => getUserLocationCurrency(), []);
  const locCurrency = userLoc.currency;
  const seatPriceQuery = useSupabaseQuery(async () => fetchSeatPrice(locCurrency), [locCurrency]);
  const SEAT_PRICE_DISPLAY = (seatPriceQuery.data?.unit_amount_minor || (locCurrency === "NGN" ? 1500000 : 1000)) / 100;
  const starterPriceQuery = useSupabaseQuery(async () => fetchTierPrice("starter", locCurrency), [locCurrency]);
  const growthPriceQuery = useSupabaseQuery(async () => fetchTierPrice("growth", locCurrency), [locCurrency]);
  const starterAmount = (starterPriceQuery.data?.unit_amount_minor || (locCurrency === "NGN" ? 150000000 : 150000)) / 100;
  const growthAmount = (growthPriceQuery.data?.unit_amount_minor || (locCurrency === "NGN" ? 450000000 : 450000)) / 100;

  function fmtTierPrice(amount) {
    if (locCurrency === "NGN") return `₦${(amount / 1000000).toFixed(1)}M/mo`;
    return `${userLoc.symbol}${Number(amount).toLocaleString()}/mo`;
  }

  const ticketsQuery = useSupabaseQuery(async () => (orgId ? fetchMyOrgSupportTickets(orgId) : []), [orgId]);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [submittingTicket, setSubmittingTicket] = useState(false);

  async function handleSubmitTicket() {
    if (!ticketSubject.trim()) return;
    setSubmittingTicket(true);
    try {
      const result = await createSupportTicket({ organizationId: orgId, createdBy: profileQuery?.data?.id, subject: ticketSubject, description: ticketDescription, priority: "normal" });
      if (!result.success) showToast(result.error || "Could not submit your request.");
      else {
        showToast("Support request submitted - Train AI will respond soon.");
        setTicketSubject(""); setTicketDescription("");
        ticketsQuery.refetch();
      }
    } finally {
      setSubmittingTicket(false);
    }
  }

  async function handleUpgrade(tier) {
    if (!userEmail) {
      showToast("Could not determine your email. Try reloading.");
      return;
    }
    setPayingTier(tier);
    const result = await startOrganizationSubscriptionPayment({
      orgId,
      tier,
      email: userEmail,
      provider: userLoc.provider,
    });
    if (!result.success) {
      showToast(result.error || "Could not start payment.");
      setPayingTier(null);
    }
    // On success, startOrganizationSubscriptionPayment redirects the
    // browser to the real checkout page - nothing after this runs.
  }

  const [orgName, setOrgName] = useState("");
  const [domain, setDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem("trainai_theme_dark") === "true";
    } catch {
      return false;
    }
  });

  // AI Coach controls - enable/disable and Manual Mode (custom admin
  // message instead of a real AI reply). Backed by organizations.settings,
  // not a new table; see lib/api/organizations.js.
  const aiSettingsQuery = useSupabaseQuery(async () => (orgId ? fetchOrgAISettings(orgId) : null), [orgId]);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [manualMode, setManualMode] = useState(false);
  const [manualMessage, setManualMessage] = useState("");
  const [savingAI, setSavingAI] = useState(false);

  useEffect(() => {
    if (aiSettingsQuery.data) {
      setAiEnabled(aiSettingsQuery.data.enabled !== false);
      setManualMode(!!aiSettingsQuery.data.manual_mode);
      setManualMessage(aiSettingsQuery.data.manual_message || "");
    }
  }, [aiSettingsQuery.data]);

  async function handleSaveAISettings(patch) {
    if (!orgId) return;
    setSavingAI(true);
    try {
      const result = await updateOrgAISettings(orgId, patch);
      if (!result.success) {
        showToast(result.error || "Could not save AI Coach settings");
      } else {
        showToast("AI Coach settings saved!");
        aiSettingsQuery.refetch();
      }
    } finally {
      setSavingAI(false);
    }
  }

  // Payment Gateway & Payout Accounts (Paystack, Stripe & Direct Bank Transfers)
  const paymentSettingsQuery = useSupabaseQuery(async () => (orgId ? fetchOrgPaymentGatewaySettings(orgId) : null), [orgId]);
  const [preferredGateway, setPreferredGateway] = useState("default");
  const [gatewayEnvironment, setGatewayEnvironment] = useState("test");
  const [paystackPublicKey, setPaystackPublicKey] = useState("");
  const [paystackSecretKey, setPaystackSecretKey] = useState("");
  const [paystackSubaccount, setPaystackSubaccount] = useState("");
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [stripeAccountId, setStripeAccountId] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [swiftCode, setSwiftCode] = useState("");
  const [payoutCurrency, setPayoutCurrency] = useState("NGN");
  const [savingPaymentSettings, setSavingPaymentSettings] = useState(false);
  const [gatewayTestResult, setGatewayTestResult] = useState(null);

  useEffect(() => {
    if (paymentSettingsQuery.data) {
      setPreferredGateway(paymentSettingsQuery.data.preferred_gateway || "default");
      setGatewayEnvironment(paymentSettingsQuery.data.environment || "test");
      setPaystackPublicKey(paymentSettingsQuery.data.paystack_public_key || "");
      setPaystackSecretKey(paymentSettingsQuery.data.paystack_secret_key || "");
      setPaystackSubaccount(paymentSettingsQuery.data.paystack_subaccount_code || "");
      setStripePublishableKey(paymentSettingsQuery.data.stripe_publishable_key || "");
      setStripeSecretKey(paymentSettingsQuery.data.stripe_secret_key || "");
      setStripeAccountId(paymentSettingsQuery.data.stripe_account_id || "");
      setBankName(paymentSettingsQuery.data.bank_name || "");
      setAccountNumber(paymentSettingsQuery.data.account_number || "");
      setAccountName(paymentSettingsQuery.data.account_name || "");
      setSwiftCode(paymentSettingsQuery.data.swift_code || "");
      setPayoutCurrency(paymentSettingsQuery.data.payout_currency || "NGN");
    }
  }, [paymentSettingsQuery.data]);

  async function handleSavePaymentSettings() {
    if (!orgId) return;
    setSavingPaymentSettings(true);
    try {
      const res = await updateOrgPaymentGatewaySettings(orgId, {
        preferred_gateway: preferredGateway,
        environment: gatewayEnvironment,
        paystack_public_key: paystackPublicKey.trim(),
        paystack_secret_key: paystackSecretKey.trim(),
        paystack_subaccount_code: paystackSubaccount.trim(),
        stripe_publishable_key: stripePublishableKey.trim(),
        stripe_secret_key: stripeSecretKey.trim(),
        stripe_account_id: stripeAccountId.trim(),
        bank_name: bankName.trim(),
        account_number: accountNumber.trim(),
        account_name: accountName.trim(),
        swift_code: swiftCode.trim(),
        payout_currency: payoutCurrency,
      });
      if (res.success) {
        showToast("Payment gateway & settlement settings saved!");
        paymentSettingsQuery.refetch();
      } else {
        showToast(res.error || "Could not save payment gateway settings.");
      }
    } finally {
      setSavingPaymentSettings(false);
    }
  }

  function handleTestGateway(provider) {
    const isPaystack = provider === "paystack";
    const res = testOrgPaymentGatewayConnection({
      provider,
      publicKey: isPaystack ? paystackPublicKey : stripePublishableKey,
      secretKey: isPaystack ? paystackSecretKey : stripeSecretKey,
      subaccountCode: paystackSubaccount,
      accountId: stripeAccountId,
      environment: gatewayEnvironment,
    });
    setGatewayTestResult({ provider, ...res });
    showToast(res.message);
  }

  // AI Insights manual mode - separate from AI Coach (PRD 8.3 names both
  // as distinct moderation controls). Same organizations.settings pattern,
  // its own 'ai_insights' namespace.
  const aiInsightsSettingsQuery = useSupabaseQuery(async () => (orgId ? fetchOrgAIInsightsSettings(orgId) : null), [orgId]);
  const [insightsEnabled, setInsightsEnabled] = useState(true);
  const [insightsManualMode, setInsightsManualMode] = useState(false);
  const [insightsManualMessage, setInsightsManualMessage] = useState("");
  const [savingInsights, setSavingInsights] = useState(false);

  useEffect(() => {
    if (aiInsightsSettingsQuery.data) {
      setInsightsEnabled(aiInsightsSettingsQuery.data.enabled !== false);
      setInsightsManualMode(!!aiInsightsSettingsQuery.data.manual_mode);
      setInsightsManualMessage(aiInsightsSettingsQuery.data.manual_message || "");
    }
  }, [aiInsightsSettingsQuery.data]);

  async function handleSaveAIInsightsSettings(patch) {
    if (!orgId) return;
    setSavingInsights(true);
    try {
      const result = await updateOrgAIInsightsSettings(orgId, patch);
      if (!result.success) {
        showToast(result.error || "Could not save AI Insights settings");
      } else {
        showToast("AI Insights settings saved!");
        aiInsightsSettingsQuery.refetch();
      }
    } finally {
      setSavingInsights(false);
    }
  }

  // Leaderboard visibility - "Leaderboard visibility is configurable.
  // Admins can disable rankings."
  const leaderboardSettingsQuery = useSupabaseQuery(async () => (orgId ? fetchOrgLeaderboardSettings(orgId) : null), [orgId]);
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(true);
  const [savingLeaderboard, setSavingLeaderboard] = useState(false);

  useEffect(() => {
    if (leaderboardSettingsQuery.data) {
      setLeaderboardEnabled(leaderboardSettingsQuery.data.enabled !== false);
    }
  }, [leaderboardSettingsQuery.data]);

  async function handleToggleLeaderboard() {
    if (!orgId) return;
    const next = !leaderboardEnabled;
    setLeaderboardEnabled(next);
    setSavingLeaderboard(true);
    try {
      const result = await updateOrgLeaderboardSettings(orgId, { enabled: next });
      if (!result.success) {
        showToast(result.error || "Could not save leaderboard settings");
        setLeaderboardEnabled(!next); // revert optimistic update
      } else {
        showToast("Leaderboard settings saved!");
        leaderboardSettingsQuery.refetch();
      }
    } finally {
      setSavingLeaderboard(false);
    }
  }

  // Gamification on/off - separate control from the leaderboard per the
  // PRD ("Option to on gamification or off - on and off leadership
  // board" lists two distinct toggles). Controls streaks/points/badges;
  // the leaderboard toggle above controls rankings visibility separately.
  const gamificationSettingsQuery = useSupabaseQuery(async () => (orgId ? fetchOrgGamificationSettings(orgId) : null), [orgId]);
  const [gamificationEnabled, setGamificationEnabled] = useState(true);
  const [savingGamification, setSavingGamification] = useState(false);

  useEffect(() => {
    if (gamificationSettingsQuery.data) {
      setGamificationEnabled(gamificationSettingsQuery.data.enabled !== false);
    }
  }, [gamificationSettingsQuery.data]);

  async function handleToggleGamification() {
    if (!orgId) return;
    const next = !gamificationEnabled;
    setGamificationEnabled(next);
    setSavingGamification(true);
    try {
      const result = await updateOrgGamificationSettings(orgId, { enabled: next });
      if (!result.success) {
        showToast(result.error || "Could not save gamification settings");
        setGamificationEnabled(!next);
      } else {
        showToast("Gamification settings saved!");
        gamificationSettingsQuery.refetch();
      }
    } finally {
      setSavingGamification(false);
    }
  }

  useEffect(() => {
    if (org) {
      setOrgName(org.name || "");
      setDomain(org.domain || "");
    }
  }, [org?.id, org?.name, org?.domain]);

  async function handleSave() {
    if (!orgId || !orgName.trim()) return;
    setSaving(true);
    try {
      await updateOrganization(orgId, { name: orgName.trim(), domain: domain.trim() || null });
      orgQuery.refetch();
      profileQuery?.refetch?.();
      showToast("Organization settings saved!");
    } catch (err) {
      showToast(err.message || "Could not save organization settings");
    } finally {
      setSaving(false);
    }
  }

  // ─── Custom Branding ────────────────────────────────────────────────────
  // Stored in the real `branding_settings` table (see lib/api/platform.js).
  // Org admins can set their primary brand color and logo so their learners
  // see a unique identity instead of the default Train AI blue.
  const PRESET_COLORS = [
    { name: "Train AI Blue",   color: "#1D4ED8" },
    { name: "Electric Indigo", color: "#4F46E5" },
    { name: "Emerald Tech",    color: "#059669" },
    { name: "Midnight Teal",   color: "#0D9488" },
    { name: "Rose Vibrant",    color: "#E11D48" },
    { name: "Royal Amber",     color: "#D97706" },
    { name: "Sky Blue",        color: "#0284C7" },
    { name: "Cyber Purple",    color: "#7C3AED" },
  ];

  const brandingQuery = useSupabaseQuery(async () => (orgId ? fetchOrgBranding(orgId) : null), [orgId]);
  const [brandPrimary,  setBrandPrimary]  = useState("#1D4ED8");
  const [brandSecondary,setBrandSecondary]= useState("#0EA5E9");
  const [brandLogo,     setBrandLogo]     = useState("");
  const [savingBrand,   setSavingBrand]   = useState(false);

  useEffect(() => {
    const d = brandingQuery.data;
    if (d === undefined) return;
    setBrandPrimary(d?.primary_color   || "#1D4ED8");
    setBrandSecondary(d?.secondary_color || "#0EA5E9");
    setBrandLogo(d?.logo_url || "");
    if (d) applyDynamicBranding(d);
  }, [brandingQuery.data, orgId]);

  const handleBrandPrimaryChange = useCallback((val) => {
    setBrandPrimary(val);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      applyDynamicBranding({ primary_color: val, secondary_color: brandSecondary });
    }
  }, [brandSecondary]);

  const handleBrandSecondaryChange = useCallback((val) => {
    setBrandSecondary(val);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      applyDynamicBranding({ primary_color: brandPrimary, secondary_color: val });
    }
  }, [brandPrimary]);

  async function handleSaveBranding() {
    if (!orgId) return;
    setSavingBrand(true);
    try {
      await upsertOrgBranding(orgId, {
        primaryColor:   brandPrimary   || null,
        secondaryColor: brandSecondary || null,
        logoUrl:        brandLogo      || null,
      });
      applyDynamicBranding({
        primary_color:   brandPrimary   || null,
        secondary_color: brandSecondary || null,
        logo_url:        brandLogo      || null,
      });
      brandingQuery.refetch();
      showToast("✓ Branding saved and applied site-wide!");
    } catch (e) {
      showToast(e?.message || "Could not save branding.");
    } finally {
      setSavingBrand(false);
    }
  }

  async function handleResetBranding() {
    if (!orgId) return;
    setSavingBrand(true);
    try {
      await upsertOrgBranding(orgId, { primaryColor: null, secondaryColor: null, logoUrl: null });
      applyDynamicBranding({});
      setBrandPrimary("#1D4ED8");
      setBrandSecondary("#0EA5E9");
      setBrandLogo("");
      brandingQuery.refetch();
      showToast("Branding reset to Train AI defaults.");
    } catch (e) {
      showToast(e?.message || "Could not reset branding.");
    } finally {
      setSavingBrand(false);
    }
  }

  return (
    <div className="ta-fade">
      <TopBar title="Settings Hub" sub="Organization name & configuration" orgSelector={orgSelector} onNavigate={setScreen} profileQuery={profileQuery} />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="ta-hero-banner ta-hero-dark anim-fluid-entrance">
          <div className="tai-glow-cobalt" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">Settings Hub &amp; Preferences</h1>
              <p className="ta-hero-desc">Manage organization profile, seat licenses, AI policies, security rules, and gamification toggles.</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                <span className="ta-tag ta-tag-success">
                  <Building2 size={13} /> {org?.name || "Train AI"}
                </span>
                <span className="ta-tag ta-tag-info">
                  <ShieldCheck size={13} /> {(org?.subscription_tier || "Enterprise").toUpperCase()} Plan Active
                </span>
              </div>
            </div>
            <div className="ta-hero-actions">
              <button 
                className="ta-btn ta-btn-primary" 
                style={{ background: "var(--primary, #2563EB)", color: "#FFFFFF", fontWeight: 700, height: 36, padding: "0 16px", borderRadius: 8, border: "none" }}
                onClick={handleSave}
                disabled={saving || !orgName.trim()}
              >
                <Save size={14} style={{ marginRight: 6 }} /> {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        </div>

        {!orgId && <div className="ta-empty">No organization on your profile yet.</div>}
        {orgId && orgQuery.loading && <div className="ta-empty">Loading organization settings...</div>}
        {orgId && orgQuery.error && <div className="ta-empty">Couldn't load organization: {orgQuery.error}</div>}

        {orgId && !orgQuery.loading && !orgQuery.error && (
          <div className="ta-grid ta-grid-2" style={{ gap: 20 }}>

            {/* Left Column: Organization, Billing & Seats */}
            <div className="anim-stagger" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="ta-card">
                <div className="ta-title">Organization Profile</div>
                <div className="ta-label ta-mt16">Organization Name</div>
                <input className="ta-input ta-mt6" style={{ width: "100%" }} value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                <div className="ta-label ta-mt16">Domain (optional)</div>
                <input className="ta-input ta-mt6" style={{ width: "100%" }} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="e.g. yourcompany.com" />
                <div className="ta-row ta-gap10 ta-mt16" style={{ fontSize: 12.5, color: "var(--text-2)", flexWrap: "wrap" }}>
                  <span>Plan: <strong style={{ color: "var(--text-1)" }}>{org?.subscription_tier || "free"}</strong></span>
                  <span>Status: <strong style={{ color: "var(--text-1)" }}>{org?.status || "trial"}</strong></span>
                  <span>Max users: <strong style={{ color: "var(--text-1)" }}>{org?.max_users ?? 50}</strong></span>
                </div>
                <button
                  className="ta-btn ta-btn-primary ta-mt16"
                  style={{ height: 36, padding: "0 16px", borderRadius: 8, fontSize: 13 }}
                  onClick={handleSave}
                  disabled={saving || !orgName.trim()}
                >
                  {saving ? "Saving..." : "Save profile"}
                </button>
              </div>

              <div className="ta-card">
                <div className="ta-row ta-between">
                  <div className="ta-title">Billing & Subscription Plan</div>
                  <Tag tone={org?.status === "active" ? "success" : "warning"}>
                    {org?.status === "active" ? "Active Plan" : "Trial • Activation required"}
                  </Tag>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4 }}>
                  Current active tier: <strong style={{ color: "var(--text-1)", textTransform: "capitalize" }}>{org?.subscription_tier || "Enterprise"}</strong>
                  {org?.status !== "active" && " (Trial status • choose a plan to activate the full workspace)"}
                </div>

                {/* Plan Highlights Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
                  {/* Starter Box */}
                  <div style={{
                    padding: "12px", borderRadius: 8, border: `1.5px solid ${org?.subscription_tier === "starter" ? "var(--primary)" : "var(--border)"}`,
                    background: org?.subscription_tier === "starter" ? "rgba(37,99,235,0.06)" : "var(--surface-2)"
                  }}>
                    <div className="ta-row ta-between">
                      <strong style={{ fontSize: 13 }}>Starter</strong>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)" }}>{fmtTierPrice(starterAmount)}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>
                      Up to 100 learners • Course Builder • 10 AI credits/user • Org-wide analytics.
                    </div>
                    <button
                      className={`ta-btn ${org?.subscription_tier === "starter" && org?.status === "active" ? "ta-btn-ghost" : "ta-btn-primary"} ta-mt10`}
                      style={{ width: "100%", fontSize: 12, height: 32 }}
                      disabled={payingTier === "starter" || (org?.subscription_tier === "starter" && org?.status === "active")}
                      onClick={() => handleUpgrade("starter")}
                    >
                      {org?.subscription_tier === "starter" && org?.status === "active" ? "Current Plan" : payingTier === "starter" ? "Redirecting..." : "Activate Starter"}
                    </button>
                  </div>

                  {/* Growth Box */}
                  <div style={{
                    padding: "12px", borderRadius: 8, border: `1.5px solid ${org?.subscription_tier === "growth" ? "var(--primary)" : "var(--border)"}`,
                    background: org?.subscription_tier === "growth" ? "rgba(37,99,235,0.06)" : "var(--surface-2)",
                    position: "relative"
                  }}>
                    <div className="ta-row ta-between">
                      <strong style={{ fontSize: 13 }}>Growth</strong>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)" }}>{fmtTierPrice(growthAmount)}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>
                      Up to 500 learners • Manager View • Advanced Skill Graphs • CSV/PDF Exports.
                    </div>
                    <button
                      className={`ta-btn ${org?.subscription_tier === "growth" && org?.status === "active" ? "ta-btn-ghost" : "ta-btn-primary"} ta-mt10`}
                      style={{ width: "100%", fontSize: 12, height: 32 }}
                      disabled={payingTier === "growth" || (org?.subscription_tier === "growth" && org?.status === "active")}
                      onClick={() => handleUpgrade("growth")}
                    >
                      {org?.subscription_tier === "growth" && org?.status === "active" ? "Current Plan" : payingTier === "growth" ? "Redirecting..." : "Activate Growth"}
                    </button>
                  </div>
                </div>

                {/* Compare & Enterprise actions */}
                <div className="ta-row ta-between ta-mt14" style={{ flexWrap: "wrap", gap: 8 }}>
                  <button
                    type="button"
                    className="ta-btn ta-btn-outline"
                    style={{ fontSize: 12, height: 32, display: "inline-flex", alignItems: "center", gap: 5 }}
                    onClick={() => setShowPlanModal(true)}
                  >
                    <Eye size={13} /> Compare all plan features & pricing
                  </button>
                  <a className="ta-btn ta-btn-ghost" style={{ fontSize: 12, height: 32 }} href="mailto:info@trainailtd.com?subject=Enterprise%20plan%20inquiry">
                    Enterprise: Speak with us →
                  </a>
                </div>
              </div>

              <div className="ta-card">
                <div className="ta-title">Seat Allocations</div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4 }}>
                  {org?.status === "active"
                    ? "Your organization must have available seats before new users can be invited."
                    : "Trial organizations aren't seat-limited yet • this applies once your plan is active."}
                </div>
                <div className="ta-row ta-gap16 ta-mt16" style={{ flexWrap: "wrap" }}>
                  <div><div style={{ fontSize: 22, fontWeight: 800 }}>{seatsSummary.purchased}</div><div style={{ fontSize: 11, color: "var(--text-2)" }}>Purchased</div></div>
                  <div><div style={{ fontSize: 22, fontWeight: 800 }}>{seatsSummary.used}</div><div style={{ fontSize: 11, color: "var(--text-2)" }}>Used</div></div>
                  <div><div style={{ fontSize: 22, fontWeight: 800, color: seatsSummary.available > 0 ? "var(--success)" : "var(--danger)" }}>{seatsSummary.available}</div><div style={{ fontSize: 11, color: "var(--text-2)" }}>Available</div></div>
                </div>
                <div className="ta-row ta-gap8 ta-mt16" style={{ flexWrap: "wrap" }}>
                  <input className="ta-input" style={{ width: 100 }} type="number" min="1" placeholder="Seats" value={seatsToBuy} onChange={(e) => setSeatsToBuy(e.target.value)} />
                  <button
                    className="ta-btn ta-btn-primary"
                    disabled={purchasingSeats || !seatsToBuy || Number(seatsToBuy) <= 0}
                    onClick={async () => {
                      setPurchasingSeats(true);
                      try {
                        const result = await startSeatPurchasePayment({ orgId, seats: Number(seatsToBuy), email: userEmail, provider: userLoc.provider, currency: locCurrency });
                        if (!result.success) { showToast(result.error); setPurchasingSeats(false); }
                      } catch (e) {
                        showToast(e?.message || "Could not start seat purchase.");
                        setPurchasingSeats(false);
                      }
                    }}
                  >
                    {purchasingSeats ? "Redirecting to checkout..." : `Purchase seats (${formatCurrencyAmount(SEAT_PRICE_DISPLAY, locCurrency)}/seat)`}
                  </button>
                </div>
              </div>

              <div className="ta-card">
                <div className="ta-row ta-between">
                  <div className="ta-title">Payment Gateways & Direct Payouts</div>
                  <Tag tone={preferredGateway !== "default" || paystackPublicKey || stripePublishableKey || paystackSubaccount || stripeAccountId ? "success" : "neutral"}>
                    {preferredGateway !== "default"
                      ? `${preferredGateway.toUpperCase()} (${gatewayEnvironment.toUpperCase()})`
                      : paystackSubaccount || stripeAccountId
                      ? "Subaccount Connected"
                      : "Platform Default"}
                  </Tag>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4 }}>
                  Configure your organization's payment gateway keys (Paystack &amp; Stripe), select your active payment provider, or set direct bank settlement accounts for course revenues.
                </div>

                {/* Active Provider & Environment Selectors */}
                <div className="ta-grid ta-grid-2 ta-gap12 ta-mt16">
                  <div>
                    <div className="ta-label" style={{ fontWeight: 700 }}>Active Payment Provider</div>
                    <select
                      className="ta-input ta-mt6"
                      style={{ width: "100%", height: 38 }}
                      value={preferredGateway}
                      onChange={(e) => setPreferredGateway(e.target.value)}
                    >
                      <option value="default">Platform Default (Train AI Central Gateway)</option>
                      <option value="paystack">Custom Paystack Direct (NGN, GHS, KES, ZAR)</option>
                      <option value="stripe">Custom Stripe Direct (USD, EUR, GBP)</option>
                      <option value="bank_transfer">Direct Bank Transfer / Invoice</option>
                    </select>
                  </div>
                  <div>
                    <div className="ta-label" style={{ fontWeight: 700 }}>Gateway Environment</div>
                    <select
                      className="ta-input ta-mt6"
                      style={{ width: "100%", height: 38 }}
                      value={gatewayEnvironment}
                      onChange={(e) => setGatewayEnvironment(e.target.value)}
                    >
                      <option value="test">Test / Sandbox Mode (Safe for Testing)</option>
                      <option value="live">Live / Production Mode (Real Charges)</option>
                    </select>
                  </div>
                </div>

                {/* Paystack Integration Section */}
                <div style={{ background: "var(--surface-2, rgba(255,255,255,0.03))", borderRadius: 8, padding: 14, marginTop: 16, border: "1px solid var(--border)" }}>
                  <div className="ta-row ta-between">
                    <div className="ta-label" style={{ fontWeight: 700, fontSize: 13 }}>Paystack Configuration</div>
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>Supports NGN, GHS, KES, ZAR</span>
                  </div>
                  <div className="ta-grid ta-grid-2 ta-gap10 ta-mt10">
                    <div>
                      <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Public Key</div>
                      <input
                        className="ta-input ta-mt4"
                        style={{ width: "100%" }}
                        placeholder={gatewayEnvironment === "test" ? "pk_test_xxxxxxxx..." : "pk_live_xxxxxxxx..."}
                        value={paystackPublicKey}
                        onChange={(e) => setPaystackPublicKey(e.target.value)}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Secret Key</div>
                      <input
                        type="password"
                        className="ta-input ta-mt4"
                        style={{ width: "100%" }}
                        placeholder={gatewayEnvironment === "test" ? "sk_test_xxxxxxxx..." : "sk_live_xxxxxxxx..."}
                        value={paystackSecretKey}
                        onChange={(e) => setPaystackSecretKey(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="ta-mt10">
                    <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Subaccount Code (Optional for revenue splitting)</div>
                    <input
                      className="ta-input ta-mt4"
                      style={{ width: "100%" }}
                      placeholder="ACCT_xxxxxxxxx"
                      value={paystackSubaccount}
                      onChange={(e) => setPaystackSubaccount(e.target.value)}
                    />
                  </div>
                  <div className="ta-row ta-between ta-mt12" style={{ alignItems: "center" }}>
                    <button
                      type="button"
                      className="ta-btn ta-btn-outline"
                      style={{ fontSize: 11.5, height: 30, padding: "0 12px" }}
                      onClick={() => handleTestGateway("paystack")}
                    >
                      Test Paystack Keys
                    </button>
                    {gatewayTestResult?.provider === "paystack" && (
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: gatewayTestResult.success ? "var(--success)" : "var(--danger)" }}>
                        {gatewayTestResult.message}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stripe Integration Section */}
                <div style={{ background: "var(--surface-2, rgba(255,255,255,0.03))", borderRadius: 8, padding: 14, marginTop: 14, border: "1px solid var(--border)" }}>
                  <div className="ta-row ta-between">
                    <div className="ta-label" style={{ fontWeight: 700, fontSize: 13 }}>Stripe Configuration</div>
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>Supports USD, EUR, GBP</span>
                  </div>
                  <div className="ta-grid ta-grid-2 ta-gap10 ta-mt10">
                    <div>
                      <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Publishable Key</div>
                      <input
                        className="ta-input ta-mt4"
                        style={{ width: "100%" }}
                        placeholder={gatewayEnvironment === "test" ? "pk_test_xxxxxxxx..." : "pk_live_xxxxxxxx..."}
                        value={stripePublishableKey}
                        onChange={(e) => setStripePublishableKey(e.target.value)}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Secret Key</div>
                      <input
                        type="password"
                        className="ta-input ta-mt4"
                        style={{ width: "100%" }}
                        placeholder={gatewayEnvironment === "test" ? "sk_test_xxxxxxxx..." : "sk_live_xxxxxxxx..."}
                        value={stripeSecretKey}
                        onChange={(e) => setStripeSecretKey(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="ta-mt10">
                    <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Stripe Connected Account ID (Optional)</div>
                    <input
                      className="ta-input ta-mt4"
                      style={{ width: "100%" }}
                      placeholder="acct_xxxxxxxxx"
                      value={stripeAccountId}
                      onChange={(e) => setStripeAccountId(e.target.value)}
                    />
                  </div>
                  <div className="ta-row ta-between ta-mt12" style={{ alignItems: "center" }}>
                    <button
                      type="button"
                      className="ta-btn ta-btn-outline"
                      style={{ fontSize: 11.5, height: 30, padding: "0 12px" }}
                      onClick={() => handleTestGateway("stripe")}
                    >
                      Test Stripe Keys
                    </button>
                    {gatewayTestResult?.provider === "stripe" && (
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: gatewayTestResult.success ? "var(--success)" : "var(--danger)" }}>
                        {gatewayTestResult.message}
                      </span>
                    )}
                  </div>
                </div>

                {/* Direct Bank Settlement Account Details */}
                <div style={{ background: "var(--surface-2, rgba(255,255,255,0.03))", borderRadius: 8, padding: 14, marginTop: 14, border: "1px solid var(--border)" }}>
                  <div className="ta-row ta-between">
                    <div className="ta-label" style={{ fontWeight: 700, fontSize: 13 }}>Organization Bank Settlement Details</div>
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>For manual / bank transfer payouts</span>
                  </div>
                  <div className="ta-grid ta-grid-2 ta-gap10 ta-mt10">
                    <input
                      className="ta-input"
                      placeholder="Bank Name (e.g. Zenith Bank)"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                    />
                    <input
                      className="ta-input"
                      placeholder="Account Number / IBAN"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                    />
                  </div>
                  <div className="ta-grid ta-grid-2 ta-gap10 ta-mt10">
                    <input
                      className="ta-input"
                      placeholder="Account Name (e.g. Acme Corp Ltd)"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                    />
                    <div className="ta-row ta-gap8">
                      <input
                        className="ta-input"
                        placeholder="SWIFT / Sort Code"
                        value={swiftCode}
                        onChange={(e) => setSwiftCode(e.target.value)}
                      />
                      <select
                        className="ta-input"
                        style={{ width: 110, height: 38 }}
                        value={payoutCurrency}
                        onChange={(e) => setPayoutCurrency(e.target.value)}
                      >
                        <option value="NGN">NGN (₦)</option>
                        <option value="USD">USD ($)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GHS">GHS (GH₵)</option>
                        <option value="KES">KES (KSh)</option>
                        <option value="ZAR">ZAR (R)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  className="ta-btn ta-btn-primary ta-mt16"
                  style={{ height: 36, padding: "0 16px", borderRadius: 8, fontSize: 13 }}
                  onClick={handleSavePaymentSettings}
                  disabled={savingPaymentSettings}
                >
                  {savingPaymentSettings ? "Saving..." : "Save Payment Gateways & Payouts"}
                </button>
              </div>

              <div className="ta-card">
                <div className="ta-title">Support & Help Desk</div>
                <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>Submit a request to Train AI • replies appear below.</div>
                <input className="ta-input ta-mt12" placeholder="Subject" value={ticketSubject} onChange={(e) => setTicketSubject(e.target.value)} />
                <textarea className="ta-input ta-mt8" rows={3} placeholder="Describe the issue or question..." value={ticketDescription} onChange={(e) => setTicketDescription(e.target.value)} />
                <button className="ta-btn ta-btn-primary ta-mt8" disabled={submittingTicket || !ticketSubject.trim()} onClick={handleSubmitTicket}>
                  {submittingTicket ? "Submitting..." : "Submit request"}
                </button>
                <div className="ta-col ta-gap8 ta-mt16">
                  {(ticketsQuery.data || []).length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)" }}>No support requests yet.</div>}
                  {(ticketsQuery.data || []).map((t) => (
                    <div key={t.id} className="ta-row ta-between" style={{ background: "var(--surface-2)", borderRadius: 8, padding: "8px 10px" }}>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t.subject}</div>
                        <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>{new Date(t.created_at).toLocaleDateString()}</div>
                      </div>
                      <Tag tone={t.status === "resolved" || t.status === "closed" ? "success" : t.status === "in_progress" ? "warning" : "default"}>{t.status.replace("_", " ")}</Tag>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: AI Automation, Gamification & Leaderboard */}
            <div className="anim-stagger" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="ta-card">
                <div className="ta-title">AI Neural Coach</div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                  Control whether learners in your organization get automated AI Coach replies.
                </div>

                <div className="ta-row ta-between ta-mt16">
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>Enable AI Coach</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Turn off to hide AI replies for your learners entirely.</div>
                  </div>
                  <Switch on={aiEnabled} onChange={() => { const next = !aiEnabled; setAiEnabled(next); handleSaveAISettings({ enabled: next }); }} />
                </div>

                <div className="ta-row ta-between ta-mt16" style={{ opacity: aiEnabled ? 1 : 0.5 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>Manual Mode</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Replace automatic AI replies with your own custom message.</div>
                  </div>
                  <Switch
                    on={manualMode}
                    onChange={() => { if (!aiEnabled) return; const next = !manualMode; setManualMode(next); handleSaveAISettings({ manual_mode: next }); }}
                  />
                </div>

                {aiEnabled && manualMode && (
                  <div className="ta-mt16">
                    <div className="ta-label">Custom message</div>
                    <textarea
                      className="ta-input ta-mt6" style={{ width: "100%", minHeight: 80 }}
                      placeholder="e.g. Thanks for your question. An instructor will follow up with you directly."
                      value={manualMessage}
                      onChange={(e) => setManualMessage(e.target.value)}
                      onBlur={() => handleSaveAISettings({ manual_message: manualMessage })}
                    />
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>Saves automatically when you click away.</div>
                  </div>
                )}
                {savingAI && <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 8 }}>Saving...</div>}
              </div>

              <div className="ta-card">
                <div className="ta-title">AI Personalized Insights</div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                  Control whether learners in your organization get real, personalized AI Insights.
                </div>

                <div className="ta-row ta-between ta-mt16">
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>Enable AI Insights</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Turn off to hide AI Insights for your learners entirely.</div>
                  </div>
                  <Switch on={insightsEnabled} onChange={() => { const next = !insightsEnabled; setInsightsEnabled(next); handleSaveAIInsightsSettings({ enabled: next }); }} />
                </div>

                <div className="ta-row ta-between ta-mt16" style={{ opacity: insightsEnabled ? 1 : 0.5 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>Manual Mode</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Replace personalized AI Insights with your own announcement.</div>
                  </div>
                  <Switch
                    on={insightsManualMode}
                    onChange={() => { if (!insightsEnabled) return; const next = !insightsManualMode; setInsightsManualMode(next); handleSaveAIInsightsSettings({ manual_mode: next }); }}
                  />
                </div>

                {insightsEnabled && insightsManualMode && (
                  <div className="ta-mt16">
                    <div className="ta-label">Custom announcement</div>
                    <textarea
                      className="ta-input ta-mt6" style={{ width: "100%", minHeight: 80 }}
                      placeholder="e.g. This week, focus on completing your compliance modules before Friday."
                      value={insightsManualMessage}
                      onChange={(e) => setInsightsManualMessage(e.target.value)}
                      onBlur={() => handleSaveAIInsightsSettings({ manual_message: insightsManualMessage })}
                    />
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>Saves automatically when you click away.</div>
                  </div>
                )}
                {savingInsights && <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 8 }}>Saving...</div>}
              </div>

              <div className="ta-card">
                <div className="ta-title">Gamification & Badges</div>
                <div className="ta-row ta-between ta-mt16">
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>Enable streaks, points & badges</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Enable learner motivation loops across courses and milestones.</div>
                  </div>
                  <Switch on={gamificationEnabled} onChange={handleToggleGamification} />
                </div>
                {savingGamification && <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 8 }}>Saving...</div>}
              </div>

              <div className="ta-card">
                <div className="ta-title">Leaderboard Rankings</div>
                <div className="ta-row ta-between ta-mt16">
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>Show leaderboard rankings</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Display peer rankings in the Community view.</div>
                  </div>
                  <Switch on={leaderboardEnabled} onChange={handleToggleLeaderboard} />
                </div>
                {savingLeaderboard && <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 8 }}>Saving...</div>}
              </div>

              {/* Database & Mock Data Management Card */}
              <div className="ta-card" style={{ border: "1.5px solid var(--primary-light, #60A5FA)" }}>
                <div className="ta-row ta-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                  <div className="ta-row ta-gap10">
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Database size={17} color="var(--primary)" />
                    </div>
                    <div>
                      <div className="ta-title" style={{ fontSize: 15, fontWeight: 800 }}>Database &amp; Mock Data Mode</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>
                        Toggle demo prototype data vs live production database records
                      </div>
                    </div>
                  </div>

                  <span style={{
                    fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 6,
                    background: isMockDataEnabled() ? "var(--warning-bg, #FEF3C7)" : "var(--success-bg, #DCFCE7)",
                    color: isMockDataEnabled() ? "var(--warning, #D97706)" : "var(--success, #16A34A)"
                  }}>
                    {isMockDataEnabled() ? "DEMO ACTIVE" : "REAL DB ONLY"}
                  </span>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div className="ta-row ta-between" style={{ alignItems: "center" }}>
                    <div style={{ minWidth: 0, flex: 1, paddingRight: 14 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>Include Mock &amp; Demo Courses</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 3, lineHeight: 1.4 }}>
                        When connecting your live Supabase database, turn this off to show only your real organization tables.
                      </div>
                    </div>
                    <Switch
                      on={isMockDataEnabled()}
                      onChange={() => {
                        const next = !isMockDataEnabled();
                        setMockDataEnabled(next);
                        showToast(next ? "Mock data enabled" : "Real database mode active");
                      }}
                    />
                  </div>

                  <div className="ta-row ta-gap8 ta-mt14" style={{ flexWrap: "wrap" }}>
                    <button
                      className="ta-btn ta-btn-danger ta-btn-sm"
                      onClick={() => {
                        if (window.confirm("Purge all mock data and switch to real database records only?")) {
                          purgeAllMockData();
                          showToast("All mock data purged! Live database mode active.");
                          setTimeout(() => {
                            window.location.reload();
                          }, 500);
                        }
                      }}
                    >
                      <Trash2 size={13} /> Purge All Mock Data
                    </button>

                    <button
                      className="ta-btn ta-btn-outline ta-btn-sm"
                      onClick={() => {
                        restoreMockData();
                        showToast("Demo & mock masterclasses restored.");
                        setTimeout(() => {
                          window.location.reload();
                        }, 500);
                      }}
                    >
                      <RefreshCw size={13} /> Restore Demo Data
                    </button>
                  </div>
                </div>
              </div>


              {/* ── Custom Branding Card ──────────────────────────────── */}
              <div className="ta-card">
                <div className="ta-row ta-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
                  <div className="ta-row ta-gap10">
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Palette size={17} color="var(--primary)" />
                    </div>
                    <div>
                      <div className="ta-title" style={{ fontSize: 15, fontWeight: 800 }}>Custom Branding</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>
                        Customize your organization's colors and logo — changes apply site-wide instantly
                      </div>
                    </div>
                  </div>
                  {brandingQuery.loading && <RefreshCw size={14} style={{ color: "var(--text-3)", animation: "spin 1s linear infinite" }} />}
                </div>

                {/* Primary Brand Color */}
                <div>
                  <div className="ta-label" style={{ marginBottom: 8 }}>Primary Brand Color</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {PRESET_COLORS.map(p => (
                      <button
                        key={p.color}
                        type="button"
                        title={p.name}
                        onClick={() => handleBrandPrimaryChange(p.color)}
                        style={{
                          width: 28, height: 28, borderRadius: "50%", background: p.color, cursor: "pointer",
                          border: brandPrimary === p.color ? "2.5px solid #fff" : "2px solid transparent",
                          boxShadow: brandPrimary === p.color ? `0 0 0 2px ${p.color}` : "0 1px 3px rgba(0,0,0,0.2)",
                          display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
                          transform: brandPrimary === p.color ? "scale(1.15)" : "scale(1)", transition: "transform .15s",
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(brandPrimary) ? brandPrimary : "#1D4ED8"}
                      onChange={e => handleBrandPrimaryChange(e.target.value)}
                      style={{ width: 40, height: 36, padding: 2, border: "1px solid var(--border)", borderRadius: 7, cursor: "pointer", flexShrink: 0 }}
                    />
                    <input
                      className="ta-input"
                      style={{ flex: 1, fontFamily: "monospace", fontSize: 13 }}
                      placeholder="#1D4ED8"
                      value={brandPrimary}
                      onChange={e => handleBrandPrimaryChange(e.target.value)}
                    />
                  </div>
                </div>

                {/* Secondary / Accent Color */}
                <div style={{ marginTop: 14 }}>
                  <div className="ta-label" style={{ marginBottom: 8 }}>Accent / Secondary Color</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(brandSecondary) ? brandSecondary : "#0EA5E9"}
                      onChange={e => handleBrandSecondaryChange(e.target.value)}
                      style={{ width: 40, height: 36, padding: 2, border: "1px solid var(--border)", borderRadius: 7, cursor: "pointer", flexShrink: 0 }}
                    />
                    <input
                      className="ta-input"
                      style={{ flex: 1, fontFamily: "monospace", fontSize: 13 }}
                      placeholder="#0EA5E9"
                      value={brandSecondary}
                      onChange={e => handleBrandSecondaryChange(e.target.value)}
                    />
                  </div>
                </div>

                {/* Logo URL */}
                <div style={{ marginTop: 14 }}>
                  <div className="ta-label" style={{ marginBottom: 6 }}>Organization Logo URL <span style={{ fontWeight: 400, fontSize: 11, color: "var(--text-3)" }}>(optional — paste a public image URL)</span></div>
                  <input
                    className="ta-input"
                    style={{ width: "100%", fontSize: 12.5 }}
                    placeholder="https://your-org.com/logo.png"
                    value={brandLogo}
                    onChange={e => setBrandLogo(e.target.value)}
                  />
                  {brandLogo && (
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
                      <img
                        src={brandLogo}
                        alt="Logo preview"
                        style={{ width: 48, height: 48, borderRadius: 8, objectFit: "contain", background: "var(--surface-2)", border: "1px solid var(--border)", padding: 4 }}
                        onError={e => { e.target.style.display = "none"; }}
                      />
                      <span style={{ fontSize: 11, color: "var(--text-3)" }}>Logo preview</span>
                    </div>
                  )}
                </div>

                {/* Live Preview strip */}
                <div style={{ marginTop: 16, background: "var(--surface-2)", borderRadius: 10, padding: "12px 14px", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 7, background: brandPrimary, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14, overflow: "hidden", flexShrink: 0 }}>
                      {brandLogo ? <img src={brandLogo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} onError={e => { e.target.style.display = "none"; }} /> : (org?.name?.charAt(0) || "T")}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 12.5 }}>{org?.name || "Your Org"}</div>
                      <div style={{ fontSize: 10, color: "var(--text-3)" }}>Live preview</div>
                    </div>
                  </div>
                  <button style={{ background: `linear-gradient(135deg, ${brandPrimary}, ${brandSecondary})`, color: "#fff", border: "none", padding: "5px 12px", borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: "default" }}>
                    Dashboard →
                  </button>
                </div>

                {/* Save / Reset */}
                <div className="ta-row ta-gap8 ta-mt16">
                  <button
                    className="ta-btn ta-btn-primary"
                    style={{ flex: 2, height: 36, fontSize: 13, gap: 6, display: "flex", alignItems: "center", justifyContent: "center" }}
                    onClick={handleSaveBranding}
                    disabled={savingBrand}
                  >
                    {savingBrand ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Saving…</> : <><Save size={13} /> Save Branding</>}
                  </button>
                  <button
                    className="ta-btn ta-btn-outline"
                    style={{ flex: 1, height: 36, fontSize: 12 }}
                    onClick={handleResetBranding}
                    disabled={savingBrand}
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="ta-card">
                <div className="ta-row ta-between">
                  <div className="ta-row ta-gap10">
                    <Moon size={20} color="var(--primary)" />
                    <div>
                      <div className="ta-title">Theme &amp; Appearance</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 2 }}>
                        Switch between light mode and high-contrast dark theme.
                      </div>
                    </div>
                  </div>
                  <Switch
                    on={isDark}
                    onChange={() => {
                      const next = !isDark;
                      setIsDark(next);
                      setGlobalThemeDark(next);
                      showToast(next ? "Dark mode activated" : "Light mode activated");
                    }}
                  />
                </div>
              </div>
            </div>

          </div>
        )}

        <PlanSelectionModal
          isOpen={showPlanModal}
          onClose={() => setShowPlanModal(false)}
          currentTier={org?.subscription_tier}
          selectedTier={org?.subscription_tier || "growth"}
          isUpgradeMode={true}
          isLoading={payingTier !== null}
          onSelectTier={(tier) => {
            setShowPlanModal(false);
            handleUpgrade(tier);
          }}
          onContactEnterprise={() => {
            setShowPlanModal(false);
            window.location.href = "mailto:info@trainailtd.com?subject=Enterprise%20plan%20inquiry";
          }}
        />
      </div>
    </div>
  );
}
