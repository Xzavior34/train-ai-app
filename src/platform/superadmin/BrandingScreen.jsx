import React, { useContext, useEffect, useState, useCallback } from "react";
import { TopBar, ToastContext, Tag } from "../components/PlatformUI.jsx";
import {
  Building2, Palette, Check, Sun, Moon, Eye, Upload, RefreshCw,
  Save, Sparkles, Globe, Image as ImageIcon
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchAllOrganizations, fetchOrgBranding, upsertOrgBranding } from "../../lib/api/platform.js";
import FileUploadZone from "../../components/common/FileUploadZone.jsx";
import { applyDynamicBranding } from "../../lib/brandingHelper.js";

const PRESET_PALETTES = [
  { name: "Train AI Blue",      color: "#1D4ED8" },
  { name: "Electric Indigo",    color: "#4F46E5" },
  { name: "Cyber Lavender",     color: "#7C3AED" },
  { name: "Emerald Tech",       color: "#059669" },
  { name: "Midnight Teal",      color: "#0D9488" },
  { name: "Rose Vibrant",       color: "#E11D48" },
  { name: "Royal Amber",        color: "#D97706" },
  { name: "Sky Blue",           color: "#0284C7" },
];

function hexToRgb(hex) {
  try {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  } catch {
    return "29, 78, 216";
  }
}

export function BrandingScreen({ orgSelector } = {}) {
  const showToast = useContext(ToastContext);

  const orgsQuery = useSupabaseQuery(async () => fetchAllOrganizations(), []);
  const orgs = orgsQuery.data || [];

  // ─── Org selection ──────────────────────────────────────────────────────
  const [selectedOrgId, setSelectedOrgId] = useState(orgSelector?.selectedOrgId || "");

  // Sync to parent orgSelector
  useEffect(() => {
    if (orgSelector?.selectedOrgId && orgSelector.selectedOrgId !== selectedOrgId) {
      setSelectedOrgId(orgSelector.selectedOrgId);
    }
  }, [orgSelector?.selectedOrgId]); // eslint-disable-line

  // Auto-select first org once the list loads
  useEffect(() => {
    if (!selectedOrgId && orgs.length > 0) {
      const initialId = orgSelector?.selectedOrgId || orgs[0].id;
      setSelectedOrgId(initialId);
      if (orgSelector?.onSelectOrg && !orgSelector.selectedOrgId) {
        orgSelector.onSelectOrg(initialId);
      }
    }
  }, [orgs.length]); // eslint-disable-line

  // ─── Load existing branding from database ───────────────────────────────
  const brandingQuery = useSupabaseQuery(async () => {
    if (!selectedOrgId) return null;
    return fetchOrgBranding(selectedOrgId);
  }, [selectedOrgId]);

  const [logoUrl,       setLogoUrl]       = useState("");
  const [primaryColor,  setPrimaryColor]  = useState("#1D4ED8");
  const [secondaryColor,setSecondaryColor]= useState("#0EA5E9");
  const [customCss,     setCustomCss]     = useState("");
  const [themeMode,     setThemeMode]     = useState("light");
  const [saving,        setSaving]        = useState(false);
  const [hasChanges,    setHasChanges]    = useState(false);

  // Populate form from DB whenever branding loads / org changes
  useEffect(() => {
    const d = brandingQuery.data;
    if (d === undefined) return; // still loading
    setLogoUrl(d?.logo_url || "");
    setPrimaryColor(d?.primary_color || "#1D4ED8");
    setSecondaryColor(d?.secondary_color || "#0EA5E9");
    setCustomCss(d?.custom_css || "");
    setHasChanges(false);
    // Apply live so the dashboard itself reflects the stored branding immediately
    if (d) applyDynamicBranding(d);
  }, [brandingQuery.data, selectedOrgId]);

  // ─── Save ────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!selectedOrgId) {
      showToast("Please select an organization first.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        logoUrl:       logoUrl       || null,
        primaryColor:  primaryColor  || null,
        secondaryColor:secondaryColor|| null,
        customCss:     customCss     || null,
      };
      await upsertOrgBranding(selectedOrgId, payload);

      // Apply immediately to the live UI (normalise to snake_case so the
      // helper's color-computation paths all fire correctly)
      applyDynamicBranding({
        logo_url:       logoUrl       || null,
        primary_color:  primaryColor  || null,
        secondary_color:secondaryColor|| null,
        custom_css:     customCss     || null,
      });

      // Apply theme preference to document
      if (themeMode === "dark") {
        document.documentElement.classList.add("dark");
        try { localStorage.setItem("trainai_theme_dark", "true"); } catch {}
      } else {
        document.documentElement.classList.remove("dark");
        try { localStorage.setItem("trainai_theme_dark", "false"); } catch {}
      }
      // Broadcast theme change to other mounted dashboards
      window.dispatchEvent(new CustomEvent("trainai-theme-change", { detail: { dark: themeMode === "dark" } }));

      brandingQuery.refetch();
      setHasChanges(false);
      showToast("✓ Branding saved and applied site-wide!");
    } catch (e) {
      showToast(e?.message || "Couldn't save branding — check console.");
      console.error("upsertOrgBranding error:", e);
    } finally {
      setSaving(false);
    }
  }

  // ─── Reset to defaults ───────────────────────────────────────────────────
  async function handleReset() {
    if (!selectedOrgId) return;
    setSaving(true);
    try {
      await upsertOrgBranding(selectedOrgId, {
        logoUrl: null, primaryColor: null, secondaryColor: null, customCss: null,
      });
      applyDynamicBranding({});
      setPrimaryColor("#1D4ED8");
      setSecondaryColor("#0EA5E9");
      setLogoUrl("");
      setCustomCss("");
      setHasChanges(false);
      showToast("Branding reset to defaults.");
    } catch (e) {
      showToast(e?.message || "Couldn't reset branding.");
    } finally {
      setSaving(false);
    }
  }

  // ─── Live-preview any color change ──────────────────────────────────────
  const handlePrimaryChange = useCallback((val) => {
    setPrimaryColor(val);
    setHasChanges(true);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      applyDynamicBranding({ primary_color: val, secondary_color: secondaryColor });
    }
  }, [secondaryColor]);

  const handleSecondaryChange = useCallback((val) => {
    setSecondaryColor(val);
    setHasChanges(true);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      applyDynamicBranding({ primary_color: primaryColor, secondary_color: val });
    }
  }, [primaryColor]);

  const selectedOrg = orgs.find(o => o.id === selectedOrgId) || { name: "Train AI Platform" };
  const isValidPrimary = /^#[0-9a-fA-F]{6}$/.test(primaryColor);
  const isValidSecondary = /^#[0-9a-fA-F]{6}$/.test(secondaryColor);

  return (
    <div className="ta-fade">
      <TopBar
        title="Branding & White-Label"
        sub="Customize logos, color palettes, and CSS per tenant — changes apply site-wide instantly"
      />

      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Hero Banner ─────────────────────────────────────────────────── */}
        <div className="ta-hero-banner ta-hero-dark anim-fluid-entrance">
          <div className="tai-glow-cobalt" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Sparkles size={22} style={{ flexShrink: 0 }} /> White-Label Brand Studio
              </h1>
              <p className="ta-hero-desc">
                Every color, logo, and CSS override you set here propagates immediately to
                the learner portal, admin workspace, and email templates — no redeploy needed.
              </p>
            </div>
            <div className="ta-hero-actions">
              {hasChanges && (
                <div style={{ display:"flex", alignItems:"center", gap: 6, background:"rgba(251,191,36,0.15)", border:"1px solid rgba(251,191,36,0.4)", borderRadius:8, padding:"6px 12px", fontSize:12, color:"#FCD34D", fontWeight:600 }}>
                  ● Unsaved changes
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Org Selector ────────────────────────────────────────────────── */}
        <div className="ta-card" style={{ padding: "16px 20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
            <Building2 size={18} color="var(--primary)" style={{ flexShrink:0 }} />
            <span style={{ fontWeight:700, fontSize:14, whiteSpace:"nowrap" }}>Tenant:</span>
            {orgsQuery.loading ? (
              <span className="ta-sub" style={{ fontSize:13 }}>Loading organizations…</span>
            ) : orgs.length === 0 ? (
              <span className="ta-sub" style={{ fontSize:13, color:"var(--danger)" }}>No organizations found — create one first.</span>
            ) : (
              <select
                className="ta-input"
                style={{ flex:1, minWidth:200, maxWidth:380 }}
                value={selectedOrgId}
                onChange={e => {
                  const id = e.target.value;
                  setSelectedOrgId(id);
                  orgSelector?.onSelectOrg?.(id);
                  setHasChanges(false);
                }}
              >
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            )}
            {brandingQuery.loading && <RefreshCw size={14} className="anim-spin" style={{ color:"var(--text-3)" }} />}
            {brandingQuery.error && (
              <span style={{ fontSize:12, color:"var(--danger)", fontWeight:600 }}>
                ⚠ Could not load branding — check RLS policies
              </span>
            )}
          </div>
        </div>

        {/* ── Two-column: Controls + Live Preview ─────────────────────────── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap:20, alignItems:"start" }}>

          {/* Left: Controls */}
          <div className="ta-card" style={{ padding:24, display:"flex", flexDirection:"column", gap:20 }}>

            {/* Primary Color */}
            <div>
              <label className="ta-label" style={{ marginBottom:10, display:"block" }}>
                Primary Brand Color
              </label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:12 }}>
                {PRESET_PALETTES.map(p => (
                  <button
                    key={p.color}
                    type="button"
                    title={p.name}
                    onClick={() => handlePrimaryChange(p.color)}
                    style={{
                      width:32, height:32, borderRadius:"50%",
                      background:p.color,
                      border: primaryColor === p.color ? "3px solid #fff" : "2px solid transparent",
                      boxShadow: primaryColor === p.color ? `0 0 0 2.5px ${p.color}` : "0 1px 3px rgba(0,0,0,0.2)",
                      cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                      color:"#fff", transition:"transform .15s ease",
                      transform: primaryColor === p.color ? "scale(1.15)" : "scale(1)",
                    }}
                  >
                    {primaryColor === p.color && <Check size={14} />}
                  </button>
                ))}
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <input
                  type="color"
                  value={isValidPrimary ? primaryColor : "#1D4ED8"}
                  onChange={e => handlePrimaryChange(e.target.value)}
                  style={{ width:44, height:40, padding:2, border:"1px solid var(--border)", borderRadius:8, cursor:"pointer", flexShrink:0 }}
                />
                <input
                  className="ta-input"
                  style={{ flex:1, fontFamily:"monospace", fontSize:13 }}
                  placeholder="#1D4ED8"
                  value={primaryColor}
                  onChange={e => handlePrimaryChange(e.target.value)}
                />
              </div>
            </div>

            {/* Secondary Color */}
            <div>
              <label className="ta-label" style={{ marginBottom:8, display:"block" }}>
                Secondary / Accent Color
              </label>
              <div style={{ display:"flex", gap:10 }}>
                <input
                  type="color"
                  value={isValidSecondary ? secondaryColor : "#0EA5E9"}
                  onChange={e => handleSecondaryChange(e.target.value)}
                  style={{ width:44, height:40, padding:2, border:"1px solid var(--border)", borderRadius:8, cursor:"pointer", flexShrink:0 }}
                />
                <input
                  className="ta-input"
                  style={{ flex:1, fontFamily:"monospace", fontSize:13 }}
                  placeholder="#0EA5E9"
                  value={secondaryColor}
                  onChange={e => handleSecondaryChange(e.target.value)}
                />
              </div>
            </div>

            {/* Interface Theme */}
            <div>
              <label className="ta-label" style={{ marginBottom:8, display:"block" }}>
                Interface Theme
              </label>
              <div style={{ display:"flex", gap:8 }}>
                <button
                  type="button"
                  className={`ta-btn ta-btn-sm ${themeMode === "light" ? "ta-btn-primary" : "ta-btn-outline"}`}
                  style={{ flex:1, gap:6 }}
                  onClick={() => { setThemeMode("light"); setHasChanges(true); }}
                >
                  <Sun size={14} /> Light
                </button>
                <button
                  type="button"
                  className={`ta-btn ta-btn-sm ${themeMode === "dark" ? "ta-btn-primary" : "ta-btn-outline"}`}
                  style={{ flex:1, gap:6 }}
                  onClick={() => { setThemeMode("dark"); setHasChanges(true); }}
                >
                  <Moon size={14} /> Dark
                </button>
              </div>
            </div>

            {/* Logo Upload */}
            <div>
              <label className="ta-label" style={{ marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                <ImageIcon size={14} /> Organization Logo
              </label>
              {logoUrl && (
                <div style={{ marginBottom:10, display:"flex", alignItems:"center", gap:12 }}>
                  <img
                    src={logoUrl}
                    alt="Brand Logo"
                    style={{ width:60, height:60, borderRadius:10, objectFit:"contain", background:"var(--surface-2)", border:"1px solid var(--border)", padding:4 }}
                  />
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    <span style={{ fontSize:12, color:"var(--text-2)" }}>Current logo</span>
                    <button
                      type="button"
                      className="ta-btn ta-btn-outline ta-btn-sm"
                      onClick={() => { setLogoUrl(""); setHasChanges(true); }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
              {selectedOrgId && (
                <FileUploadZone
                  bucket="uploads"
                  pathPrefix={`branding/${selectedOrgId}`}
                  accept="image/*"
                  maxSizeMB={5}
                  label="Drop logo here or click to upload (PNG / SVG recommended)"
                  onUploaded={(url) => { setLogoUrl(url); setHasChanges(true); }}
                />
              )}
            </div>

            {/* Custom CSS */}
            <div>
              <label className="ta-label" style={{ marginBottom:6, display:"block" }}>
                Custom CSS <span style={{ fontWeight:400, fontSize:11, color:"var(--text-3)" }}>(optional)</span>
              </label>
              <textarea
                className="ta-input"
                rows={4}
                style={{ width:"100%", fontFamily:"monospace", fontSize:12, resize:"vertical" }}
                placeholder={`:root {\n  --border-radius: 12px;\n  --font-heading: 'Inter', sans-serif;\n}`}
                value={customCss}
                onChange={e => { setCustomCss(e.target.value); setHasChanges(true); }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              <button
                className="ta-btn ta-btn-primary"
                style={{ flex:2, minWidth:140, gap:6 }}
                onClick={handleSave}
                disabled={saving || !selectedOrgId}
              >
                {saving ? <><RefreshCw size={14} className="anim-spin" /> Saving…</> : <><Save size={14} /> Save & Apply Site-Wide</>}
              </button>
              <button
                className="ta-btn ta-btn-outline ta-btn-sm"
                style={{ flex:1, minWidth:80 }}
                onClick={handleReset}
                disabled={saving || !selectedOrgId}
              >
                Reset
              </button>
            </div>
          </div>

          {/* Right: Live Preview */}
          <div
            className="ta-card"
            style={{
              padding:24,
              background: themeMode === "dark" ? "#0F172A" : "var(--surface)",
              color:       themeMode === "dark" ? "#F8FAFC"  : "var(--text)",
              border: `1px solid ${isValidPrimary ? primaryColor + "44" : "var(--border)"}`,
              transition: "background .25s ease, color .25s ease",
            }}
          >
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, paddingBottom:12, borderBottom:"1px solid rgba(148,163,184,0.2)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <Eye size={16} color={primaryColor} />
                <span style={{ fontWeight:700, fontSize:13 }}>Live Preview</span>
              </div>
              <Tag tone="primary">Real-time</Tag>
            </div>

            {/* Simulated Learner Portal Nav Bar */}
            <div style={{
              background: themeMode === "dark" ? "#1E293B" : "#fff",
              borderRadius:10,
              padding:"10px 14px",
              border:`1px solid ${themeMode === "dark" ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
              marginBottom:12,
              display:"flex", alignItems:"center", justifyContent:"space-between", gap:10,
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{
                  width:34, height:34, borderRadius:8, background:primaryColor,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontWeight:800, color:"#fff", fontSize:15, overflow:"hidden", flexShrink:0,
                }}>
                  {logoUrl
                    ? <img src={logoUrl} alt="Logo" style={{ width:"100%", height:"100%", objectFit:"contain" }} />
                    : (selectedOrg.name?.charAt(0) || "T")
                  }
                </div>
                <div>
                  <div style={{ fontWeight:700, fontSize:13 }}>{selectedOrg.name}</div>
                  <div style={{ fontSize:10, opacity:0.6 }}>Learning Portal</div>
                </div>
              </div>
              <button style={{
                background:primaryColor, color:"#fff", border:"none",
                padding:"5px 12px", borderRadius:7, fontSize:11, fontWeight:700, cursor:"default",
              }}>
                Dashboard
              </button>
            </div>

            {/* Simulated Course Card */}
            <div style={{
              background: themeMode === "dark" ? "#1E293B" : "#F8FAFC",
              borderRadius:10, padding:14,
              border:`1px solid ${themeMode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
              marginBottom:12,
            }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:13 }}>AI Fundamentals</div>
                  <div style={{ fontSize:11, opacity:0.6, marginTop:2 }}>Module 3 of 8 · 24 min left</div>
                </div>
                <div style={{
                  background:`rgba(${hexToRgb(primaryColor)}, 0.12)`,
                  color:primaryColor, padding:"3px 8px", borderRadius:6, fontSize:11, fontWeight:700,
                }}>
                  In Progress
                </div>
              </div>
              {/* Progress bar */}
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:4, fontWeight:600 }}>
                  <span>Track Progress</span>
                  <span style={{ color:secondaryColor }}>72%</span>
                </div>
                <div style={{ width:"100%", height:7, background:themeMode==="dark"?"#334155":"#E2E8F0", borderRadius:6, overflow:"hidden" }}>
                  <div style={{ width:"72%", height:"100%", background:`linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`, borderRadius:6 }} />
                </div>
              </div>
            </div>

            {/* Simulated CTA button */}
            <button style={{
              width:"100%", background:`linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
              color:"#fff", border:"none", padding:"9px 0", borderRadius:9,
              fontSize:13, fontWeight:700, cursor:"default", letterSpacing:".3px",
            }}>
              Continue Learning →
            </button>

            {/* Color swatch summary */}
            <div style={{ display:"flex", gap:8, marginTop:14 }}>
              <div style={{ flex:1, background:primaryColor,   borderRadius:6, height:10, opacity:.9 }} title={`Primary: ${primaryColor}`} />
              <div style={{ flex:1, background:secondaryColor, borderRadius:6, height:10, opacity:.9 }} title={`Secondary: ${secondaryColor}`} />
            </div>
            <div style={{ display:"flex", gap:8, marginTop:4, fontSize:10, color:"var(--text-3)", fontFamily:"monospace" }}>
              <span style={{ flex:1, textAlign:"center" }}>{primaryColor}</span>
              <span style={{ flex:1, textAlign:"center" }}>{secondaryColor}</span>
            </div>
          </div>
        </div>

        {/* ── Info Card ────────────────────────────────────────────────────── */}
        <div className="ta-card" style={{ padding:"14px 18px", display:"flex", alignItems:"flex-start", gap:12, borderLeft:"3px solid var(--primary)" }}>
          <Globe size={18} color="var(--primary)" style={{ flexShrink:0, marginTop:2 }} />
          <div>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:3 }}>How branding propagates</div>
            <div style={{ fontSize:12, color:"var(--text-2)", lineHeight:1.6 }}>
              Colors set here update the CSS <code>--primary</code> and <code>--secondary</code> variables
              globally across the learner portal, admin workspace, and Platform Owner dashboard — without a
              page reload. The logo is stored in Supabase Storage and referenced everywhere a brand mark
              appears. Custom CSS is injected directly into <code>&lt;head&gt;</code> on every page load.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
