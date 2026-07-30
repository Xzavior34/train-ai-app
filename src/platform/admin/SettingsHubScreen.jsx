import React, { useState, useEffect, useContext } from "react";
import { TopBar, ToastContext } from "../components/PlatformUI.jsx";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchOrganizationById, updateOrganization } from "../../lib/api/platform.js";

// Previously seeded from `profileQuery.data?.organizations?.name`, which
// never exists — fetchCurrentUserProfile() (used to build profileQuery in
// usePlatformData.js) returns a plain user_profiles row with no embedded
// `organizations` object (there's no declared FK for that embed). So this
// field always fell back to the hardcoded literal "Northwind Analytics
// Academy" — meaning "Save changes" could silently overwrite a real
// organization's name with that fake placeholder if an admin didn't notice
// and retype their real name first. Fixed by fetching the real organizations
// row directly via the org id already available on this screen.
export function SettingsHubScreen({ orgId, profileQuery, orgSelector, setScreen }) {
  const showToast = useContext(ToastContext);
  const orgQuery = useSupabaseQuery(async () => (orgId ? fetchOrganizationById(orgId) : null), [orgId]);
  const org = orgQuery.data;

  const [orgName, setOrgName] = useState("");
  const [domain, setDomain] = useState("");
  const [saving, setSaving] = useState(false);

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
              <span>Max users: <strong style={{ color: "var(--text-1)" }}>{org?.max_users ?? "—"}</strong></span>
            </div>
            <button className="ta-btn ta-btn-primary ta-mt16" onClick={handleSave} disabled={saving || !orgName.trim()}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
