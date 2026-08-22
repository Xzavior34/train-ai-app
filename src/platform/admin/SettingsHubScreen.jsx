import React, { useState, useEffect, useContext } from "react";
import { TopBar, ToastContext, Switch, Tag, setGlobalThemeDark, getStoredThemeDark } from "../components/PlatformUI.jsx";
import { Lock, ShieldCheck, Moon, Database, Trash2, RefreshCw } from "lucide-react";
import { isMockDataEnabled, setMockDataEnabled, purgeAllMockData, restoreMockData, subscribeToMockDataChanges } from "../../lib/mockDataManager.js";
import MfaSetupScreen from "../../pages/auth/MfaSetupScreen.jsx";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchOrganizationById, updateOrganization } from "../../lib/api/platform.js";
import { fetchOrgAISettings, updateOrgAISettings, fetchOrgAIInsightsSettings, updateOrgAIInsightsSettings, fetchOrgLeaderboardSettings, updateOrgLeaderboardSettings, fetchOrgGamificationSettings, updateOrgGamificationSettings, startOrganizationSubscriptionPayment, TIER_PRICING, fetchOrgSeatsSummary, startSeatPurchasePayment } from "../../lib/api/organizations.js";
import { fetchMyOrgSupportTickets, createSupportTicket } from "../../lib/api/platform.js";

// Previously seeded from `profileQuery.data?.organizations?.name`, which
// never exists - fetchCurrentUserProfile() (used to build profileQuery in
// usePlatformData.js) returns a plain user_profiles row with no embedded
// `organizations` object (there's no declared FK for that embed). So this
// field always fell back to the hardcoded literal "Northwind Analytics
// Academy" - meaning "Save changes" could silently overwrite a real
// organization's name with that fake placeholder if an admin didn't notice
// and retype their real name first. Fixed by fetching the real organizations
// row directly via the org id already available on this screen.
export function SettingsHubScreen({ orgId, profileQuery, orgSelector, setScreen, userEmail }) {
  const showToast = useContext(ToastContext);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const orgQuery = useSupabaseQuery(async () => (orgId ? fetchOrganizationById(orgId) : null), [orgId]);
  const org = orgQuery.data;
  const [payingTier, setPayingTier] = useState(null);
  const seatsSummaryQuery = useSupabaseQuery(async () => (orgId ? fetchOrgSeatsSummary(orgId) : { purchased: 0, used: 0, available: 0 }), [orgId]);
  const seatsSummary = seatsSummaryQuery.data || { purchased: 0, used: 0, available: 0 };
  const [seatsToBuy, setSeatsToBuy] = useState("");
  const [purchasingSeats, setPurchasingSeats] = useState(false);
  const SEAT_PRICE_DISPLAY = 10;
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
    const result = await startOrganizationSubscriptionPayment({ orgId, tier, email: userEmail });
    if (!result.success) {
      showToast(result.error || "Could not start payment.");
      setPayingTier(null);
    }
    // On success, startOrganizationSubscriptionPayment redirects the
    // browser to the real Paystack checkout page - nothing after this runs.
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

  return (
    <div className="ta-fade">
      <TopBar title="Settings Hub" sub="Organization name & configuration" orgSelector={orgSelector} onNavigate={setScreen} profileQuery={profileQuery} />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* =========================================================================
            SETTINGS HUB HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner">
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">Settings Hub &amp; Preferences</h1>
              <p className="ta-hero-desc">Manage organization profile, seat licenses, AI policies, and gamification.</p>
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
                  <span>Max users: <strong style={{ color: "var(--text-1)" }}>{org?.max_users ?? "N/A"}</strong></span>
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
                  <div className="ta-title">Billing & Plan</div>
                  <Tag tone={org?.status === "active" ? "success" : "warning"}>
                    {org?.status === "active" ? "Active" : "Trial • Payment required"}
                  </Tag>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4 }}>
                  Current plan: <strong style={{ color: "var(--text-1)" }}>{org?.subscription_tier ? org.subscription_tier[0].toUpperCase() + org.subscription_tier.slice(1) : "N/A"}</strong>
                  {org?.status !== "active" && ": self-serve organizations start on a trial and need a plan activated to unlock the full admin dashboard."}
                </div>

                <div className="ta-row ta-gap10 ta-mt16" style={{ flexWrap: "wrap" }}>
                  {["starter", "growth"].map((tier) => (
                    <button
                      key={tier}
                      className={org?.subscription_tier === tier && org?.status === "active" ? "ta-btn ta-btn-ghost" : "ta-btn ta-btn-primary"}
                      disabled={payingTier === tier || (org?.subscription_tier === tier && org?.status === "active")}
                      onClick={() => handleUpgrade(tier)}
                    >
                      {org?.subscription_tier === tier && org?.status === "active"
                        ? `Current plan: ${TIER_PRICING[tier].label}`
                        : payingTier === tier
                          ? "Redirecting to checkout..."
                          : `${org?.status === "active" ? "Switch to" : "Activate"} ${TIER_PRICING[tier].label}: ₦${TIER_PRICING[tier].amountNGN.toLocaleString()}/mo`}
                    </button>
                  ))}
                  <a className="ta-btn ta-btn-ghost" href="mailto:info@trainailtd.com?subject=Enterprise%20plan%20inquiry">
                    Enterprise: Speak with us
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
                        const result = await startSeatPurchasePayment({ orgId, seats: Number(seatsToBuy), email: userEmail });
                        if (!result.success) { showToast(result.error); setPurchasingSeats(false); }
                      } catch (e) {
                        showToast(e?.message || "Could not start seat purchase.");
                        setPurchasingSeats(false);
                      }
                    }}
                  >
                    {purchasingSeats ? "Redirecting to checkout..." : `Purchase seats ($${SEAT_PRICE_DISPLAY}/seat)`}
                  </button>
                </div>
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
              <div className="ta-card" style={{ border: "1.5px solid var(--primary-light, #818CF8)" }}>
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
                      }}
                    >
                      <RefreshCw size={13} /> Restore Demo Data
                    </button>
                  </div>
                </div>
              </div>

              <div className="ta-card">
                <div className="ta-row ta-between">
                  <div className="ta-row ta-gap10">
                    <Moon size={20} color="var(--primary)" />
                    <div>
                      <div className="ta-title">Theme & Appearance</div>
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
      </div>
    </div>
  );
}
