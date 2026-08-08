import React, { useContext, useEffect, useState } from "react";
import { TopBar, ToastContext } from "../components/PlatformUI.jsx";
import { Building2, Palette } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchAllOrganizations, fetchOrgBranding, upsertOrgBranding } from "../../lib/api/platform.js";
import FileUploadZone from "../../components/common/FileUploadZone.jsx";

// Super-admin white-label screen: pick one org, set its logo + primary brand
// color. Backed by the real `branding_settings` table (organization_id,
// logo_url, primary_color - confirmed against the shared schema; see the
// comment above fetchOrgBranding/upsertOrgBranding in lib/api/platform.js
// for why that table is used instead of organizations.logo_url alone).
export function BrandingScreen() {
  const showToast = useContext(ToastContext);
  const orgsQuery = useSupabaseQuery(async () => fetchAllOrganizations(), []);
  const orgs = orgsQuery.data || [];

  const [selectedOrgId, setSelectedOrgId] = useState("");
  useEffect(() => {
    if (!selectedOrgId && orgs.length) setSelectedOrgId(orgs[0].id);
  }, [orgs, selectedOrgId]);

  const brandingQuery = useSupabaseQuery(async () => {
    if (!selectedOrgId) return null;
    return fetchOrgBranding(selectedOrgId);
  }, [selectedOrgId]);

  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563EB");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLogoUrl(brandingQuery.data?.logo_url || "");
    setPrimaryColor(brandingQuery.data?.primary_color || "#2563EB");
  }, [brandingQuery.data, selectedOrgId]);

  async function handleSave() {
    if (!selectedOrgId) return;
    setSaving(true);
    try {
      await upsertOrgBranding(selectedOrgId, { logoUrl: logoUrl || null, primaryColor: primaryColor || null });
      brandingQuery.refetch();
      showToast("Branding saved!");
    } catch (e) {
      showToast(e?.message || "Couldn't save branding. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ta-fade">
      <TopBar title="Branding" sub="Set a per-organization logo and brand color" />
      <div className="ta-content">
        <div className="ta-card" style={{ maxWidth: 560 }}>
          <div className="ta-label" style={{ marginBottom: 6 }}>Organization</div>
          {orgsQuery.loading && <div className="ta-empty">Loading organizations...</div>}
          {!orgsQuery.loading && orgs.length === 0 && <div className="ta-empty">No organizations created yet.</div>}
          {orgs.length > 0 && (
            <div className="ta-row ta-gap10">
              <Building2 size={18} color="var(--primary)" />
              <select
                className="ta-input"
                style={{ flex: 1 }}
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
              >
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}

          {selectedOrgId && (
            <>
              <div className="ta-title ta-mt20">Logo</div>
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Organization logo"
                  style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover", marginTop: 10, border: "1px solid var(--border)" }}
                />
              )}
              <div className="ta-mt10">
                <FileUploadZone
                  bucket="uploads"
                  pathPrefix={`branding/${selectedOrgId}`}
                  accept="image/*"
                  maxSizeMB={5}
                  label="Drag and drop a logo image, or click to browse"
                  onUploaded={(url) => setLogoUrl(url)}
                />
              </div>

              <div className="ta-title ta-mt20">Primary brand color</div>
              <div className="ta-row ta-gap10 ta-mt10">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : "#2563EB"}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  style={{ width: 48, height: 36, padding: 0, border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" }}
                />
                <input
                  className="ta-input"
                  style={{ flex: 1 }}
                  placeholder="#2563EB"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                />
                <Palette size={18} color="var(--primary)" />
              </div>
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6 }}>
                Applied as the learner app's --primary accent color and header logo for members of this organization.
              </div>

              <button className="ta-btn ta-btn-primary ta-mt16" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save branding"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
