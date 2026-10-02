import React, { useState, useEffect } from "react";
import { CERTIFICATE_THEMES, COLOR_PALETTES, SIGNATURE_PRESETS, parseCertificateTemplate } from "./certificateThemes.js";
import { CertificateDocument } from "./CertificateDocument.jsx";
import {
  Sparkles, Check, Palette, Award, ShieldCheck, FileText,
  Sliders, Eye, Save, RefreshCw, Layers, Printer, Share2
} from "lucide-react";

/**
 * Creative Organization Certificate Studio & Customizer
 * Allows Org Admins & Instructors to design, brand, preview, and save certificate templates.
 */
export function OrgCertificateStudio({
  course = {},
  initialTemplate = null,
  onSave = null,
  showToast = () => {},
  isOrgLevel = false
}) {
  const [activeTab, setActiveTab] = useState("theme"); // "theme" | "branding" | "signatories" | "criteria"
  const [saving, setSaving] = useState(false);

  // Studio configuration state
  const initialConfig = parseCertificateTemplate(initialTemplate);
  const [themeId, setThemeId] = useState(initialConfig.themeId || "cyber_neon");
  const [title, setTitle] = useState(initialConfig.title || "Certificate of Completion");
  const [orgName, setOrgName] = useState(initialConfig.orgName || "Sara Foundation");
  const [orgSubtitle, setOrgSubtitle] = useState(initialConfig.orgSubtitle || "Global AI Learning & Workforce Development Initiative");
  
  const [signatoryName, setSignatoryName] = useState(initialConfig.signatoryName || "Inem Emmanuel");
  const [signatoryTitle, setSignatoryTitle] = useState(initialConfig.signatoryTitle || "Director of Academic Excellence");
  const [secondarySignatoryName, setSecondarySignatoryName] = useState(initialConfig.secondarySignatoryName || "Sara Foundation Authority");
  const [secondarySignatoryTitle, setSecondarySignatoryTitle] = useState(initialConfig.secondarySignatoryTitle || "Registrar & Academic Council");

  const [primaryColor, setPrimaryColor] = useState(initialConfig.primaryColor || "#2563EB");
  const [accentColor, setAccentColor] = useState(initialConfig.accentColor || "#38BDF8");
  const [goldColor, setGoldColor] = useState(initialConfig.goldColor || "#F59E0B");

  const [passingScorePct, setPassingScorePct] = useState(initialConfig.passingScorePct ?? 70);
  const [requiresApproval, setRequiresApproval] = useState(initialConfig.requiresApproval ?? false);

  // Live preview dummy recipient
  const [previewRecipient, setPreviewRecipient] = useState("Amara Chen");

  // Sync if initialTemplate changes
  useEffect(() => {
    if (initialTemplate) {
      const p = parseCertificateTemplate(initialTemplate);
      setThemeId(p.themeId || "cyber_neon");
      setTitle(p.title || "Certificate of Completion");
      setOrgName(p.orgName || "Sara Foundation");
      setOrgSubtitle(p.orgSubtitle || "Global AI Learning & Workforce Development Initiative");
      setSignatoryName(p.signatoryName || "Inem Emmanuel");
      setSignatoryTitle(p.signatoryTitle || "Director of Academic Excellence");
      setSecondarySignatoryName(p.secondarySignatoryName || "Sara Foundation Authority");
      setSecondarySignatoryTitle(p.secondarySignatoryTitle || "Registrar & Academic Council");
      setPrimaryColor(p.primaryColor || "#2563EB");
      setAccentColor(p.accentColor || "#38BDF8");
      setGoldColor(p.goldColor || "#F59E0B");
      setPassingScorePct(p.passingScorePct ?? 70);
      setRequiresApproval(p.requiresApproval ?? false);
    }
  }, [initialTemplate]);

  const liveConfig = {
    themeId,
    title,
    orgName,
    orgSubtitle,
    signatoryName,
    signatoryTitle,
    secondarySignatoryName,
    secondarySignatoryTitle,
    primaryColor,
    accentColor,
    goldColor,
    passingScorePct,
    requiresApproval
  };

  async function handleSaveTemplate() {
    setSaving(true);
    try {
      const payload = {
        title,
        passingScorePct: Number(passingScorePct),
        requiresApproval: Boolean(requiresApproval),
        templateText: JSON.stringify(liveConfig)
      };
      const result = await onSave?.(payload);
      if (result?.success !== false) {
        showToast("Certificate template saved successfully!");
      } else {
        showToast(result?.error || "Could not save template.");
      }
    } catch (e) {
      showToast(e?.message || "Failed to save template.");
    } finally {
      setSaving(false);
    }
  }

  function handlePrintPreview() {
    window.print();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Studio Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
        paddingBottom: 16,
        borderBottom: "1px solid var(--border)"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Award size={20} color="var(--primary)" />
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0, color: "var(--text)" }}>
              Organization Certificate Studio
            </h2>
            <span style={{
              fontSize: 11,
              fontWeight: 800,
              background: "var(--primary-tint, #EFF6FF)",
              color: "var(--primary)",
              padding: "2px 8px",
              borderRadius: 6
            }}>
              CREATIVE SUITE
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-3)", margin: "4px 0 0" }}>
            Design bespoke, accredited certificate templates for {course.title ? `"${course.title}"` : "your organization"}.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className="tai-btn tai-btn-outline tai-btn-sm"
            onClick={handlePrintPreview}
            style={{ borderRadius: 8, padding: "8px 14px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Printer size={14} /> Test Print / PDF
          </button>

          <button
            type="button"
            className="tai-btn tai-btn-primary tai-btn-sm"
            disabled={saving}
            onClick={handleSaveTemplate}
            style={{ borderRadius: 8, padding: "8px 18px", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Save size={14} /> {saving ? "Saving Studio..." : "Save Template"}
          </button>
        </div>
      </div>

      {/* Main Studio Grid: Controls Left, Live Document Preview Right */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 20, alignItems: "start" }}>
        
        {/* LEFT COLUMN: Customizer Controls */}
        <div className="tai-card" style={{ padding: 18, borderRadius: 12, border: "1px solid var(--border)" }}>
          
          {/* Studio Section Tabs */}
          <div style={{ display: "flex", gap: 6, borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 16 }}>
            {[
              { k: "theme", label: "Themes", icon: Layers },
              { k: "branding", label: "Branding", icon: Palette },
              { k: "signatories", label: "Signatories", icon: FileText },
              { k: "criteria", label: "Issuance", icon: Sliders },
            ].map(t => {
              const Icon = t.icon;
              const isActive = activeTab === t.k;
              return (
                <button
                  key={t.k}
                  type="button"
                  onClick={() => setActiveTab(t.k)}
                  style={{
                    background: isActive ? "var(--surface-3)" : "transparent",
                    color: isActive ? "var(--primary)" : "var(--text-3)",
                    border: isActive ? "1px solid var(--border)" : "1px solid transparent",
                    borderRadius: 8,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    transition: "all .15s ease"
                  }}
                >
                  <Icon size={13} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: THEME SELECTION */}
          {activeTab === "theme" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>Select Certificate Style:</div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.values(CERTIFICATE_THEMES).map((th) => {
                  const isSelected = themeId === th.id;
                  return (
                    <div
                      key={th.id}
                      onClick={() => {
                        setThemeId(th.id);
                        setAccentColor(th.accentColor);
                        setGoldColor(th.goldColor);
                      }}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 10,
                        border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border)",
                        background: isSelected ? "var(--surface-3)" : "var(--surface)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "all .15s ease"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: th.bg,
                          border: `2px solid ${th.accentColor}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}>
                          <Sparkles size={14} color={th.accentColor} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>{th.name}</div>
                          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>{th.subtitle}</div>
                        </div>
                      </div>
                      {isSelected && <Check size={18} color="var(--primary)" />}
                    </div>
                  );
                })}
              </div>

              {/* Quick Color Presets */}
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 8 }}>Preset Color Schemes:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {COLOR_PALETTES.map((cp, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setPrimaryColor(cp.primary);
                        setAccentColor(cp.accent);
                        setGoldColor(cp.gold);
                      }}
                      style={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        padding: "4px 8px",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6
                      }}
                    >
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: cp.primary }} />
                      <span>{cp.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BRANDING & HEADINGS */}
          {activeTab === "branding" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="ta-label">Certificate Title</label>
                <input
                  className="ta-input ta-mt4"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Certificate of Excellence"
                />
              </div>

              <div>
                <label className="ta-label">Organization Name</label>
                <input
                  className="ta-input ta-mt4"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Sara Foundation"
                />
              </div>

              <div>
                <label className="ta-label">Organization Subtitle / Department</label>
                <input
                  className="ta-input ta-mt4"
                  value={orgSubtitle}
                  onChange={(e) => setOrgSubtitle(e.target.value)}
                  placeholder="e.g. Global AI Learning & Workforce Development Initiative"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="ta-label">Accent Color</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      style={{ width: 34, height: 34, border: "none", borderRadius: 6, cursor: "pointer" }}
                    />
                    <span style={{ fontSize: 12, fontFamily: "monospace" }}>{accentColor}</span>
                  </div>
                </div>

                <div>
                  <label className="ta-label">Seal Foil Color</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <input
                      type="color"
                      value={goldColor}
                      onChange={(e) => setGoldColor(e.target.value)}
                      style={{ width: 34, height: 34, border: "none", borderRadius: 6, cursor: "pointer" }}
                    />
                    <span style={{ fontSize: 12, fontFamily: "monospace" }}>{goldColor}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SIGNATORIES & SIGNATURES */}
          {activeTab === "signatories" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ padding: "10px 12px", background: "var(--surface-3)", borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text)", marginBottom: 8 }}>Primary Signatory</div>
                <div>
                  <label className="ta-label">Signatory Name</label>
                  <input
                    className="ta-input ta-mt4"
                    value={signatoryName}
                    onChange={(e) => setSignatoryName(e.target.value)}
                    placeholder="e.g. Inem Emmanuel"
                  />
                </div>
                <div style={{ marginTop: 8 }}>
                  <label className="ta-label">Signatory Title</label>
                  <input
                    className="ta-input ta-mt4"
                    value={signatoryTitle}
                    onChange={(e) => setSignatoryTitle(e.target.value)}
                    placeholder="e.g. Director of Academic Excellence"
                  />
                </div>
              </div>

              <div style={{ padding: "10px 12px", background: "var(--surface-3)", borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text)", marginBottom: 8 }}>Secondary Signatory (Council / Registrar)</div>
                <div>
                  <label className="ta-label">Signatory Name</label>
                  <input
                    className="ta-input ta-mt4"
                    value={secondarySignatoryName}
                    onChange={(e) => setSecondarySignatoryName(e.target.value)}
                    placeholder="e.g. Sara Foundation Authority"
                  />
                </div>
                <div style={{ marginTop: 8 }}>
                  <label className="ta-label">Signatory Title</label>
                  <input
                    className="ta-input ta-mt4"
                    value={secondarySignatoryTitle}
                    onChange={(e) => setSecondarySignatoryTitle(e.target.value)}
                    placeholder="e.g. Registrar & Academic Council"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ISSUANCE CRITERIA */}
          {activeTab === "criteria" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="ta-label">Passing Assessment Score Required (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="ta-input ta-mt4"
                  value={passingScorePct}
                  onChange={(e) => setPassingScorePct(e.target.value)}
                />
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                  Learners must achieve at least this score on the course assessment to become eligible.
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px", background: "var(--surface-3)", borderRadius: 8, marginTop: 6 }}>
                <input
                  type="checkbox"
                  id="reqApproval"
                  checked={requiresApproval}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <label htmlFor="reqApproval" style={{ fontSize: 12.5, color: "var(--text)", cursor: "pointer" }}>
                  <strong>Require Manual Admin / Instructor Approval</strong>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>
                    When enabled, eligible learners submit a request that appears in your Certificate Requests queue. When disabled, certificates are issued instantly upon passing.
                  </div>
                </label>
              </div>

              <div>
                <label className="ta-label">Preview Learner Name</label>
                <input
                  className="ta-input ta-mt4"
                  value={previewRecipient}
                  onChange={(e) => setPreviewRecipient(e.target.value)}
                  placeholder="Preview Name"
                />
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Live Responsive Document Canvas */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".05em" }}>
              Live Certificate Preview
            </span>
            <span style={{ fontSize: 11, color: "var(--primary)", fontWeight: 700 }}>
              Updates in real-time
            </span>
          </div>

          <div style={{
            background: "var(--surface-2)",
            padding: 16,
            borderRadius: 14,
            border: "1px solid var(--border)",
            boxShadow: "inset 0 2px 6px rgba(0,0,0,0.05)"
          }}>
            <CertificateDocument
              template={{ template_text: liveConfig, title, passing_score_pct: passingScorePct, requires_admin_approval: requiresApproval }}
              recipientName={previewRecipient}
              courseTitle={course.title || "Foundations of Artificial Intelligence & Applied LLMs"}
              issueDate="October 2026"
              credentialNumber={`TAI-CERT-${new Date().getFullYear()}-DEMO`}
              scorePct={94}
              isLivePreview={true}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
