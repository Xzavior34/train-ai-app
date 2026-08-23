import React, { useContext, useEffect, useState } from "react";
import { TopBar, ToastContext, Tag } from "../components/PlatformUI.jsx";
import { Building2, Palette, Check, Sun, Moon, Eye } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchAllOrganizations, fetchOrgBranding, upsertOrgBranding } from "../../lib/api/platform.js";
import FileUploadZone from "../../components/common/FileUploadZone.jsx";

const PRESET_PALETTES = [
  { name: "Train AI Bluish-Purple", color: "#4338CA" },
  { name: "Electric Indigo", color: "#4F46E5" },
  { name: "Cyber Lavender", color: "#6366F1" },
  { name: "Emerald Tech", color: "#059669" },
  { name: "Midnight Teal", color: "#0D9488" },
  { name: "Royal Amber", color: "#D97706" }
];

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
  const [primaryColor, setPrimaryColor] = useState("#4338CA");
  const [themeMode, setThemeMode] = useState("light");
  const [borderRadius, setBorderRadius] = useState("10px");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLogoUrl(brandingQuery.data?.logo_url || "");
    setPrimaryColor(brandingQuery.data?.primary_color || "#4338CA");
  }, [brandingQuery.data, selectedOrgId]);

  async function handleSave() {
    if (!selectedOrgId) return;
    setSaving(true);
    try {
      await upsertOrgBranding(selectedOrgId, { logoUrl: logoUrl || null, primaryColor: primaryColor || null });
      brandingQuery.refetch();
      showToast("Branding settings updated!");
    } catch (e) {
      showToast(e?.message || "Couldn't save branding.");
    } finally {
      setSaving(false);
    }
  }

  const selectedOrg = orgs.find(o => o.id === selectedOrgId) || { name: "Train AI Platform" };

  return (
    <div className="ta-fade">
      <TopBar title="Branding & White-Label" sub="Customize logos, brand palettes, and theme tokens per tenant" />
      
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* =========================================================================
            BRANDING & WHITE-LABEL HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner anim-fluid-entrance">
          <div className="tai-glow-magenta" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">
                White-Label &amp; Brand Studio
              </h1>
              <p className="ta-hero-desc">
                Customize institution logos, custom accent palettes, domain hostnames, and CSS design tokens per tenant.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, alignItems: "start" }}>
        
        {/* Controls Card */}
        <div className="ta-card" style={{ padding: 24, borderRadius: 10 }}>
          <div className="ta-title" style={{ fontSize: 16 }}>Tenant Customization</div>
          
          <div className="ta-mt16">
            <label className="ta-label" style={{ marginBottom: 6, display: "block" }}>Select Tenant Organization</label>
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
          </div>

          <div className="ta-mt20">
            <label className="ta-label" style={{ marginBottom: 8, display: "block" }}>Primary Brand Color</label>
            <div className="ta-row ta-gap8" style={{ flexWrap: "wrap", marginBottom: 12 }}>
              {PRESET_PALETTES.map((p) => (
                <button
                  key={p.color}
                  type="button"
                  onClick={() => setPrimaryColor(p.color)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: p.color,
                    border: primaryColor === p.color ? "3px solid var(--surface)" : "2px solid transparent",
                    boxShadow: primaryColor === p.color ? `0 0 0 2px var(--text)` : "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    transition: "all .15s ease"
                  }}
                  title={p.name}
                >
                  {primaryColor === p.color && <Check size={14} />}
                </button>
              ))}
            </div>

            <div className="ta-row ta-gap10">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : "#4338CA"}
                onChange={(e) => setPrimaryColor(e.target.value)}
                style={{ width: 44, height: 38, padding: 0, border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" }}
              />
              <input
                className="ta-input"
                style={{ flex: 1 }}
                placeholder="#4338CA"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
              />
            </div>
          </div>

          <div className="ta-mt20">
            <label className="ta-label" style={{ marginBottom: 6, display: "block" }}>Interface Theme</label>
            <div className="ta-row ta-gap10">
              <button
                type="button"
                className={`ta-btn ${themeMode === "light" ? "ta-btn-primary" : "ta-btn-outline"} ta-btn-sm`}
                style={{ flex: 1 }}
                onClick={() => setThemeMode("light")}
              >
                <Sun size={14} /> Light Theme
              </button>
              <button
                type="button"
                className={`ta-btn ${themeMode === "dark" ? "ta-btn-primary" : "ta-btn-outline"} ta-btn-sm`}
                style={{ flex: 1 }}
                onClick={() => setThemeMode("dark")}
              >
                <Moon size={14} /> Dark Theme
              </button>
            </div>
          </div>

          <div className="ta-mt20">
            <label className="ta-label" style={{ marginBottom: 6, display: "block" }}>Organization Logo</label>
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Logo"
                style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", marginBottom: 10, border: "1px solid var(--border)" }}
              />
            )}
            <FileUploadZone
              bucket="uploads"
              pathPrefix={`branding/${selectedOrgId}`}
              accept="image/*"
              maxSizeMB={5}
              label="Drop custom logo or click to upload"
              onUploaded={(url) => setLogoUrl(url)}
            />
          </div>

          <button className="ta-btn ta-btn-primary ta-mt20" style={{ width: "100%" }} onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Branding Settings"}
          </button>
        </div>

        {/* Live Preview Card */}
        <div className="ta-card" style={{ padding: 24, borderRadius: 10, background: themeMode === "dark" ? "#0F172A" : "var(--surface)", color: themeMode === "dark" ? "#F8FAFC" : "var(--text)" }}>
          <div className="ta-row ta-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
            <div className="ta-row ta-gap8">
              <Eye size={16} color={primaryColor} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Live Learner Portal Preview</span>
            </div>
            <Tag tone="primary">Live Preview</Tag>
          </div>

          <div style={{ marginTop: 20, padding: 18, borderRadius: borderRadius, background: themeMode === "dark" ? "#1E293B" : "var(--surface-2)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between" style={{ gap: 10, flexWrap: "wrap" }}>
              <div className="ta-row ta-gap10" style={{ minWidth: 0, flex: "1 1 auto" }}>
                <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 8, background: primaryColor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
                  {selectedOrg.name?.charAt(0) || "T"}
                </div>
                <div style={{ minWidth: 0, overflow: "hidden" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedOrg.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>Enterprise AI Academy</div>
                </div>
              </div>
              <button style={{ background: primaryColor, color: "#fff", border: "none", padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                Enroll
              </button>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Track Progress</div>
              <div style={{ width: "100%", height: 8, background: themeMode === "dark" ? "#334155" : "var(--surface-3)", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ width: "72%", height: "100%", background: primaryColor, borderRadius: 6 }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}
