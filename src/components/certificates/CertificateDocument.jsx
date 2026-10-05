import React, { useState, useEffect } from "react";
import { CERTIFICATE_THEMES, parseCertificateTemplate } from "./certificateThemes.js";
import { ShieldCheck, Award, GraduationCap, Edit3, Check, Sparkles } from "lucide-react";

/**
 * Creative Certificate Document Component
 * Renders high-fidelity, printable, verified certificates in any of the 4 themes.
 * Perfectly structured for both mobile screens (320px - 768px) and desktop (1024px+).
 */
export function CertificateDocument({
  certificate = {},
  template = null,
  recipientName = "Learner Name",
  onRecipientNameChange = null,
  allowNameEdit = false,
  courseTitle = "Advanced AI Foundations & Prompt Engineering",
  issueDate = "",
  credentialNumber = "",
  scorePct = null,
  isLivePreview = false,
  verificationUrl = ""
}) {
  const config = parseCertificateTemplate(template || certificate.certificate_templates || certificate.template);
  const theme = CERTIFICATE_THEMES[config.themeId] || CERTIFICATE_THEMES.cyber_neon;

  const initialName = recipientName || certificate.recipientName || certificate.user_profiles?.display_name || "Verified Learner";
  const [isEditingName, setIsEditingName] = useState(false);
  const [customNameInput, setCustomNameInput] = useState(initialName);

  useEffect(() => {
    const updated = recipientName || certificate.recipientName || certificate.user_profiles?.display_name || "Verified Learner";
    setCustomNameInput(updated);
  }, [recipientName, certificate]);

  const effectiveRecipient = onRecipientNameChange ? recipientName : (customNameInput || recipientName || "Verified Learner");
  const effectiveCourse = courseTitle || certificate.courses?.title || certificate.title || "Course Completion";
  const effectiveDate = issueDate || certificate.issued_at 
    ? (new Date(certificate.issued_at || issueDate || Date.now()).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })) 
    : "October 2026";
  const effectiveNumber = credentialNumber || certificate.certificate_number || certificate.id || "TAI-CERT-8842-X9";
  const effectiveOrg = config.orgName || certificate.organizations?.name || "Sara Foundation";
  const effectiveUrl = verificationUrl || `${typeof window !== "undefined" ? window.location.origin : "https://trainailtd.com"}/verify/${effectiveNumber}`;

  function handleNameSubmit(e) {
    if (e) e.preventDefault();
    setIsEditingName(false);
    if (onRecipientNameChange) {
      onRecipientNameChange(customNameInput);
    }
  }

  return (
    <div className="tai-cert-wrapper" style={{ width: "100%", overflow: "hidden", position: "relative" }}>
      {/* High-Prestige Typography & Responsive Stylesheet */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,800;0,900;1,600;1,800&family=Great+Vibes&family=Dancing+Script:wght@700&family=Caveat:wght@700&family=Satisfy&display=swap');

        .cert-canvas {
          width: 100%;
          min-height: 480px;
          position: relative;
          box-sizing: border-box;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: clamp(16px, 3.5vw, 36px);
          user-select: none;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15);
          overflow: hidden;
          transition: all 0.2s ease;
        }

        /* Border styles */
        .cert-border-circuit {
          border: 2px solid rgba(56, 189, 248, 0.4);
          outline: 6px solid rgba(15, 23, 42, 0.85);
          outline-offset: -10px;
        }

        .cert-border-ornate {
          border: 3px double #B45309;
          outline: 8px double #D97706;
          outline-offset: -12px;
        }

        .cert-border-geometric {
          border: 2px solid #2563EB;
          outline: 6px solid #EFF6FF;
          outline-offset: -10px;
        }

        .cert-border-aurora {
          border: 2px solid rgba(255, 255, 255, 0.3);
          outline: 6px solid rgba(168, 85, 247, 0.25);
          outline-offset: -10px;
        }

        /* Desktop specific layout */
        @media (min-width: 680px) {
          .cert-canvas {
            aspect-ratio: 1.414 / 1;
            padding: 32px 38px;
          }
          .cert-footer-grid {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            align-items: flex-end;
            gap: 16px;
          }
          .cert-signatory-secondary {
            text-align: right;
            align-items: flex-end;
          }
        }

        /* Mobile specific layout */
        @media (max-width: 679px) {
          .cert-canvas {
            aspect-ratio: auto;
            min-height: auto;
            padding: 20px 16px;
            gap: 18px;
          }
          .cert-header-wrap {
            flex-direction: column;
            align-items: flex-start !important;
            gap: 10px;
          }
          .cert-header-badge {
            align-self: flex-start;
            text-align: left !important;
          }
          .cert-footer-grid {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
            text-align: center;
          }
          .cert-signatory-primary, .cert-signatory-secondary {
            text-align: center !important;
            align-items: center !important;
            width: 100%;
          }
          .cert-signatory-primary > div, .cert-signatory-secondary > div {
            margin-left: auto;
            margin-right: auto;
          }
        }

        @media print {
          body * {
            visibility: hidden !important;
          }
          .tai-cert-printable, .tai-cert-printable * {
            visibility: visible !important;
          }
          .tai-cert-printable {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            aspect-ratio: 1.414 / 1 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 36px 44px !important;
            page-break-inside: avoid;
            background-color: #FFFFFF !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .cert-name-edit-btn {
            display: none !important;
          }
          @page {
            size: landscape;
            margin: 0;
          }
        }
      `}</style>

      <div
        className={`cert-canvas tai-cert-printable ${
          theme.id === "cyber_neon" ? "cert-border-circuit" :
          theme.id === "classic_academic" ? "cert-border-ornate" :
          theme.id === "minimal_luxe" ? "cert-border-geometric" : "cert-border-aurora"
        }`}
        style={{
          background: theme.cardBg,
          color: theme.textColor,
          fontFamily: theme.fontFamily
        }}
      >
        {/* Background Ambient Elements */}
        {theme.id === "cyber_neon" && (
          <>
            <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,189,248,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: -60, left: -60, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
          </>
        )}

        {theme.id === "classic_academic" && (
          <>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", opacity: 0.035, pointerEvents: "none" }}>
              <GraduationCap size={280} color="#B45309" />
            </div>
            <div style={{ position: "absolute", top: 16, left: 18, width: 12, height: 12, borderTop: "2px solid #B45309", borderLeft: "2px solid #B45309" }} />
            <div style={{ position: "absolute", top: 16, right: 18, width: 12, height: 12, borderTop: "2px solid #B45309", borderRight: "2px solid #B45309" }} />
            <div style={{ position: "absolute", bottom: 16, left: 18, width: 12, height: 12, borderBottom: "2px solid #B45309", borderLeft: "2px solid #B45309" }} />
            <div style={{ position: "absolute", bottom: 16, right: 18, width: 12, height: 12, borderBottom: "2px solid #B45309", borderRight: "2px solid #B45309" }} />
          </>
        )}

        {theme.id === "future_innovator" && (
          <>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #A855F7, #EC4899, #38BDF8)" }} />
            <div style={{ position: "absolute", top: "10%", right: "8%", width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(236,72,153,0.15) 0%, transparent 70%)", filter: "blur(35px)", pointerEvents: "none" }} />
          </>
        )}

        {/* 1. TOP HEADER: Organization & Authority */}
        <div className="cert-header-wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: theme.id === "classic_academic" ? "#FAF5FF" : "rgba(255,255,255,0.08)",
              border: `1.5px solid ${config.accentColor || theme.accentColor}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}>
              <GraduationCap size={20} color={config.accentColor || theme.accentColor} />
            </div>
            <div>
              <div style={{ fontSize: "clamp(13px, 1.6vw, 16px)", fontWeight: 900, color: theme.textColor, lineHeight: 1.2 }}>
                {effectiveOrg}
              </div>
              <div style={{ fontSize: 10.5, opacity: 0.75, letterSpacing: ".03em", textTransform: "uppercase", fontWeight: 600 }}>
                {config.orgSubtitle || "Global AI Learning & Workforce Development Initiative"}
              </div>
            </div>
          </div>

          <div className="cert-header-badge" style={{ textAlign: "right" }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              background: theme.id === "classic_academic" ? "#FEF3C7" : "rgba(255,255,255,0.08)",
              color: theme.id === "classic_academic" ? "#92400E" : theme.accentColor,
              border: `1px solid ${config.accentColor || theme.accentColor}44`,
              padding: "3px 10px",
              borderRadius: 99,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: ".04em"
            }}>
              <ShieldCheck size={12} /> {config.badgeLabel || "VERIFIED CREDENTIAL"}
            </div>
            <div style={{ fontSize: 10, opacity: 0.6, fontFamily: "monospace", marginTop: 2 }}>
              ID: {effectiveNumber}
            </div>
          </div>
        </div>

        {/* 2. MAIN BODY: Certificate Title, Recipient Name (Editable on Demand), and Statement */}
        <div style={{ textAlign: "center", position: "relative", zIndex: 2, margin: "clamp(8px, 1.5vw, 16px) 0" }}>
          <div style={{
            fontSize: "clamp(10.5px, 1.2vw, 12.5px)",
            fontWeight: 800,
            letterSpacing: ".16em",
            textTransform: "uppercase",
            color: config.accentColor || theme.accentColor,
            marginBottom: 4
          }}>
            {config.title || "Certificate of Completion"}
          </div>

          <div style={{ fontSize: "clamp(10.5px, 1.1vw, 12px)", opacity: 0.8, fontStyle: theme.id === "classic_academic" ? "italic" : "normal" }}>
            {config.presentationText || "This officially certifies that"}
          </div>

          {/* Recipient Name Display / Inline Edit Mode */}
          <div style={{ margin: "4px 0", position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {isEditingName ? (
              <form onSubmit={handleNameSubmit} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <input
                  type="text"
                  value={customNameInput}
                  onChange={(e) => setCustomNameInput(e.target.value)}
                  autoFocus
                  style={{
                    fontSize: "clamp(18px, 3.2vw, 28px)",
                    fontWeight: 900,
                    textAlign: "center",
                    color: theme.id === "cyber_neon" ? "#38BDF8" : theme.textColor,
                    background: "var(--surface-2, rgba(255,255,255,0.15))",
                    border: `1.5px solid ${config.accentColor || theme.accentColor}`,
                    borderRadius: 8,
                    padding: "2px 10px",
                    outline: "none",
                    fontFamily: "inherit"
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: "var(--primary, #2563EB)",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: 6,
                    padding: "6px 10px",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  <Check size={14} /> Done
                </button>
              </form>
            ) : (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  fontSize: "clamp(20px, 3.6vw, 32px)",
                  fontWeight: 900,
                  color: theme.id === "cyber_neon" ? "#38BDF8" : theme.textColor,
                  letterSpacing: "-0.02em",
                  textShadow: theme.id === "cyber_neon" ? "0 0 16px rgba(56,189,248,0.35)" : "none",
                  borderBottom: `2px solid ${config.accentColor || theme.accentColor}33`,
                  display: "inline-block",
                  padding: "0 14px 4px",
                  lineHeight: 1.2
                }}>
                  {effectiveRecipient}
                </div>

                {allowNameEdit && (
                  <button
                    type="button"
                    className="cert-name-edit-btn"
                    onClick={() => setIsEditingName(true)}
                    title="Click to edit name on certificate"
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      border: `1px solid ${config.accentColor || theme.accentColor}55`,
                      color: config.accentColor || theme.accentColor,
                      borderRadius: 6,
                      padding: "4px 8px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 700
                    }}
                  >
                    <Edit3 size={12} /> Edit Name
                  </button>
                )}
              </div>
            )}
          </div>

          <div style={{ fontSize: "clamp(10.5px, 1.1vw, 12px)", opacity: 0.8, maxWidth: 580, margin: "4px auto 0", lineHeight: 1.4 }}>
            {config.completionStatement || "has demonstrated verified proficiency and successfully completed the comprehensive curriculum and rigorous practical assessments for"}
          </div>

          {/* Course Title */}
          <div style={{
            fontSize: "clamp(15px, 2.2vw, 21px)",
            fontWeight: 800,
            margin: "6px 0 2px",
            color: config.goldColor || theme.goldColor,
            lineHeight: 1.25
          }}>
            {effectiveCourse}
          </div>

          {/* Honors or Score badge */}
          <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
            {config.honorsText && (
              <div style={{
                display: "inline-block",
                background: "linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(217,119,6,0.1) 100%)",
                color: config.goldColor || theme.goldColor,
                border: `1px solid ${config.goldColor || theme.goldColor}66`,
                fontSize: 10.5,
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: 6
              }}>
                ★ {config.honorsText}
              </div>
            )}

            {scorePct && (
              <div style={{
                display: "inline-block",
                background: theme.id === "classic_academic" ? "#FEF3C7" : "rgba(245,158,11,0.15)",
                color: theme.id === "classic_academic" ? "#92400E" : "#FBBF24",
                border: "1px solid rgba(245,158,11,0.3)",
                fontSize: 10.5,
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: 6
              }}>
                Score: {scorePct}% (Passing Standard Met)
              </div>
            )}
          </div>
        </div>

        {/* 3. BOTTOM FOOTER: Signatures, Seal Badge, and Dates */}
        <div className="cert-footer-grid" style={{ position: "relative", zIndex: 2 }}>
          
          {/* Primary Signatory */}
          <div className="cert-signatory-primary" style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
            <div style={{
              fontFamily: theme.signatureFont,
              fontSize: "clamp(18px, 2.6vw, 26px)",
              color: config.accentColor || theme.accentColor,
              lineHeight: 1,
              marginBottom: 3
            }}>
              {config.signatoryName || "Inem Emmanuel"}
            </div>
            <div style={{ height: 1.5, background: theme.borderColor, width: "100%", maxWidth: 150, marginBottom: 3 }} />
            <div style={{ fontSize: 11, fontWeight: 800, color: theme.textColor }}>
              {config.signatoryName || "Inem Emmanuel"}
            </div>
            <div style={{ fontSize: 9.5, opacity: 0.7 }}>
              {config.signatoryTitle || "Director of Academic Excellence"}
            </div>
          </div>

          {/* Central Embossed Foil Seal / Security Badge */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{
              width: "clamp(52px, 6.5vw, 68px)",
              height: "clamp(52px, 6.5vw, 68px)",
              borderRadius: "50%",
              background: theme.id === "classic_academic" 
                ? "radial-gradient(circle, #FDE68A 0%, #D97706 70%, #92400E 100%)"
                : theme.id === "cyber_neon"
                ? "radial-gradient(circle, #0284C7 0%, #0369A1 60%, #0F172A 100%)"
                : "radial-gradient(circle, #2563EB 0%, #1E40AF 70%, #0F172A 100%)",
              border: `2.5px solid ${config.goldColor || theme.goldColor}`,
              boxShadow: `0 0 20px ${config.goldColor || theme.goldColor}44`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              flexShrink: 0
            }}>
              <Award size={22} color="#FFFFFF" />
              <span style={{ fontSize: 7, fontWeight: 900, letterSpacing: ".05em", marginTop: 1, textTransform: "uppercase" }}>
                {config.sealText || "OFFICIAL"}
              </span>
            </div>
            <div style={{ fontSize: 9.5, fontWeight: 800, opacity: 0.7, marginTop: 4 }}>
              Issued: {effectiveDate}
            </div>
          </div>

          {/* Secondary Signatory */}
          <div className="cert-signatory-secondary" style={{ display: "flex", flexDirection: "column" }}>
            <div style={{
              fontFamily: theme.signatureFont,
              fontSize: "clamp(18px, 2.4vw, 24px)",
              color: config.accentColor || theme.accentColor,
              lineHeight: 1,
              marginBottom: 3
            }}>
              {config.secondarySignatoryName || "Sara Foundation Authority"}
            </div>
            <div style={{ height: 1.5, background: theme.borderColor, width: "100%", maxWidth: 150, marginBottom: 3 }} />
            <div style={{ fontSize: 11, fontWeight: 800, color: theme.textColor }}>
              {config.secondarySignatoryName || "Sara Foundation Authority"}
            </div>
            <div style={{ fontSize: 9.5, opacity: 0.7 }}>
              {config.secondarySignatoryTitle || "Registrar & Academic Council"}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
