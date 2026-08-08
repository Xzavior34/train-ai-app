import React, { useState, useEffect, useContext } from "react";
import { TopBar, ToastContext, Switch, Tag } from "../components/PlatformUI.jsx";
import { Lock } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchOrganizationById, updateOrganization } from "../../lib/api/platform.js";
import { fetchOrgAISettings, updateOrgAISettings, fetchOrgLeaderboardSettings, updateOrgLeaderboardSettings, startOrganizationSubscriptionPayment, TIER_PRICING } from "../../lib/api/organizations.js";

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
  const orgQuery = useSupabaseQuery(async () => (orgId ? fetchOrganizationById(orgId) : null), [orgId]);
  const org = orgQuery.data;
  const [payingTier, setPayingTier] = useState(null);

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
      <div className="ta-content">
        {!orgId && <div className="ta-empty">No organization on your profile yet.</div>}
        {orgId && orgQuery.loading && <div className="ta-empty">Loading organization settings...</div>}
        {orgId && orgQuery.error && <div className="ta-empty">Couldn't load organization: {orgQuery.error}</div>}

        {orgId && !orgQuery.loading && !orgQuery.error && (
          <div className="ta-card" style={{ maxWidth: 600 }}>
            <div className="ta-title">Organization Settings</div>
            <div className="ta-label ta-mt16">Organization Name</div>
            <input className="ta-input ta-mt6" style={{ width: "100%" }} value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            <div className="ta-label ta-mt16">Domain (optional)</div>
            <input className="ta-input ta-mt6" style={{ width: "100%" }} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="e.g. yourcompany.com" />
            <div className="ta-row ta-gap10 ta-mt16" style={{ fontSize: 12.5, color: "var(--text-2)" }}>
              <span>Plan: <strong style={{ color: "var(--text-1)" }}>{org?.subscription_tier || "free"}</strong></span>
              <span>Status: <strong style={{ color: "var(--text-1)" }}>{org?.status || "trial"}</strong></span>
              <span>Max users: <strong style={{ color: "var(--text-1)" }}>{org?.max_users ?? "N/A"}</strong></span>
            </div>
            <button className="ta-btn ta-btn-primary ta-mt16" onClick={handleSave} disabled={saving || !orgName.trim()}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        )}

        {orgId && !orgQuery.loading && !orgQuery.error && (
          <>
          <div className="ta-card ta-mt16" style={{ maxWidth: 600 }}>
            <div className="ta-row ta-between">
              <div className="ta-title">Billing & Plan</div>
              <Tag tone={org?.status === "active" ? "success" : "warning"}>
                {org?.status === "active" ? "Active" : "Trial. Payment required"}
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
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 10 }}>
              Placeholder pricing for testing this flow. Not the final agreed rate. Payment runs through the real, already-live Paystack checkout; nothing here processes fake money.
            </div>
          </div>

          <div className="ta-card ta-mt16" style={{ maxWidth: 600 }}>
            <div className="ta-title">AI Coach</div>
            <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
              Control whether learners in your organization get real AI Coach replies.
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
          </>
        )}

        {orgId && !orgQuery.loading && !orgQuery.error && (
          <div className="ta-card ta-mt16" style={{ maxWidth: 600 }}>
            <div className="ta-title">Leaderboard</div>
            <div className="ta-row ta-between ta-mt16">
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>Show leaderboard rankings</div>
                <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Turn off to hide points-based rankings from your learners' community view.</div>
              </div>
              <Switch on={leaderboardEnabled} onChange={handleToggleLeaderboard} />
            </div>
            {savingLeaderboard && <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 8 }}>Saving...</div>}
          </div>
        )}
      </div>
    </div>
  );
}
