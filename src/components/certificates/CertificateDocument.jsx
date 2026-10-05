import React from "react";
import { CERTIFICATE_THEMES, parseCertificateTemplate } from "./certificateThemes.js";
import { ShieldCheck, Award, QrCode, CheckCircle2, Star, Sparkles, GraduationCap, Globe } from "lucide-react";

/**
 * Creative Certificate Document Component
 * Renders high-fidelity, printable, verified certificates in any of the 4 themes.
 */
export function CertificateDocument({
  certificate = {},
  template = null,
  recipientName = "Learner Name",
  courseTitle = "Advanced AI Foundations & Prompt Engineering",
  issueDate = "",
  credentialNumber = "",
  scorePct = null,
  isLivePreview = false,
  verificationUrl = ""
}) {
  const config = parseCertificateTemplate(template || certificate.certificate_templates || certificate.template);
  const theme = CERTIFICATE_THEMES[config.themeId] || CERTIFICATE_THEMES.cyber_neon;

  const effectiveRecipient = recipientName || certificate.recipientName || certificate.user_profiles?.display_name || "Verified Learner";
  const effectiveCourse = courseTitle || certificate.courses?.title || certificate.title || "Course Completion";
  const effectiveDate = issueDate || certificate.issued_at ? (new Date(certificate.issued_at || issueDate || Date.now()).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })) : "October 2026";
  const effectiveNumber = credentialNumber || certificate.certificate_number || certificate.id || "TAI-CERT-8842-X9";
  const effectiveOrg = config.orgName || certificate.organizations?.name || "Sara Foundation";
  const effectiveUrl = verificationUrl || `${typeof window !== "undefined" ? window.location.origin : "https://trainailtd.com"}/verify/${effectiveNumber}`;

  return (
    <div className="tai-cert-wrapper" style={{ width: "100%", overflow: "hidden" }}>
      {/* Import high-prestige typography from Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,800;0,900;1,600;1,800&family=Great+Vibes&family=Dancing+Script:wght@700&family=Caveat:wght@700&family=Satisfy&display=swap');

        .cert-canvas {
          width: 100%;
          aspect-ratio: 1.414 / 1;
          min-height: 480px;
          position: relative;
          box-sizing: border-box;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: clamp(20px, 4vw, 44px);
          user-select: none;
          box-shadow: 0 20px 50px rgba(0,0,0,0.25);
          overflow: hidden;
        }

        .cert-border-circuit {
          border: 2px solid rgba(56, 189, 248, 0.4);
          outline: 8px solid rgba(15, 23, 42, 0.8);
          outline-offset: -14px;
        }

        .cert-border-ornate {
          border: 4px double #B45309;
          outline: 10px double #D97706;
          outline-offset: -16px;
        }

        .cert-border-geometric {
          border: 3px solid #2563EB;
          outline: 6px solid #EFF6FF;
          outline-offset: -12px;
        }

        .cert-border-aurora {
          border: 2px solid rgba(255, 255, 255, 0.3);
          outline: 8px solid rgba(168, 85, 247, 0.25);
          outline-offset: -14px;
        }

        @media print {
          body * {
            visibility: hidden;
          }
          .tai-cert-printable, .tai-cert-printable * {
            visibility: visible;
          }
          .tai-cert-printable {
            position: fixed;
            left: 0;
            top: 0;
            width: 100vw !important;
            height: 100vh !important;
            aspect-ratio: auto !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 40px !important;
            page-break-inside: avoid;
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
        {/* Background Ambient Decorative Elements */}
        {theme.id === "cyber_neon" && (
          <>
            <div style={{ position: "absolute", top: -80, right: -80, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,189,248,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: -80, left: -80, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
            {/* Tech Corner Matrix Accents */}
            <div style={{ position: "absolute", top: 22, left: 22, fontSize: 10, fontFamily: "monospace", color: "#38BDF8", opacity: 0.6 }}>// VERIFIED_ACADEMIC_BLOCK //</div>
            <div style={{ position: "absolute", top: 22, right: 22, fontSize: 10, fontFamily: "monospace", color: "#38BDF8", opacity: 0.6 }}>[SYS_SEC_V3.8]</div>
          </>
        )}

        {theme.id === "classic_academic" && (
          <>
            {/* Subtle Watermark Crest */}
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", opacity: 0.04, pointerEvents: "none" }}>
              <GraduationCap size={320} color="#B45309" />
            </div>
            <div style={{ position: "absolute", top: 24, left: 28, width: 14, height: 14, borderTop: "2px solid #B45309", borderLeft: "2px solid #B45309" }} />
            <div style={{ position: "absolute", top: 24, right: 28, width: 14, height: 14, borderTop: "2px solid #B45309", borderRight: "2px solid #B45309" }} />
            <div style={{ position: "absolute", bottom: 24, left: 28, width: 14, height: 14, borderBottom: "2px solid #B45309", borderLeft: "2px solid #B45309" }} />
            <div style={{ position: "absolute", bottom: 24, right: 28, width: 14, height: 14, borderBottom: "2px solid #B45309", borderRight: "2px solid #B45309" }} />
          </>
        )}

        {theme.id === "future_innovator" && (
          <>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: "linear-gradient(90deg, #A855F7, #EC4899, #38BDF8)" }} />
            <div style={{ position: "absolute", top: "15%", right: "10%", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(236,72,153,0.18) 0%, transparent 70%)", filter: "blur(40px)", pointerEvents: "none" }} />
          </>
        )}

        {/* 1. TOP HEADER: Organization & Authority Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: theme.id === "classic_academic" ? "#FAF5FF" : "rgba(255,255,255,0.08)",
              border: `1.5px solid ${config.accentColor || theme.accentColor}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 4px 12px ${config.accentColor}33`
            }}>
              <GraduationCap size={24} color={config.accentColor || theme.accentColor} />
            </div>
            <div>
              <div style={{ fontSize: "clamp(13px, 1.8vw, 17px)", fontWeight: 900, letterSpacing: "-0.01em", color: theme.textColor }}>
                {effectiveOrg}
              </div>
              <div style={{ fontSize: 11, opacity: 0.75, letterSpacing: ".04em", textTransform: "uppercase", fontWeight: 600 }}>
                {config.orgSubtitle || "Academy of Artificial Intelligence & Workforce Learning"}
              </div>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: theme.id === "classic_academic" ? "#FEF3C7" : "rgba(255,255,255,0.08)",
              color: theme.id === "classic_academic" ? "#92400E" : theme.accentColor,
              border: `1px solid ${config.accentColor || theme.accentColor}44`,
              padding: "4px 12px",
              borderRadius: 99,
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: ".05em"
            }}>
              <ShieldCheck size={13} /> {config.badgeLabel || "VERIFIED CREDENTIAL"}
            </div>
            <div style={{ fontSize: 10.5, opacity: 0.6, fontFamily: "monospace", marginTop: 3 }}>
              ID: {effectiveNumber}
            </div>
          </div>
        </div>

        {/* 2. MAIN BODY: Certification Title, Recipient, and Achievement Statement */}
        <div style={{ textAlign: "center", position: "relative", zIndex: 2, margin: "clamp(12px, 2vw, 24px) 0" }}>
          <div style={{
            fontSize: "clamp(11px, 1.4vw, 13px)",
            fontWeight: 800,
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: config.accentColor || theme.accentColor,
            marginBottom: 6
          }}>
            {config.title || "Certificate of Completion"}
          </div>

          <div style={{ fontSize: "clamp(11px, 1.3vw, 13px)", opacity: 0.8, fontStyle: theme.id === "classic_academic" ? "italic" : "normal" }}>
            {config.presentationText || "This officially certifies that"}
          </div>

          {/* Recipient Full Name */}
          <div style={{
            fontSize: "clamp(22px, 4vw, 36px)",
            fontWeight: 900,
            margin: "6px 0",
            color: theme.id === "cyber_neon" ? "#38BDF8" : theme.textColor,
            letterSpacing: "-0.02em",
            textShadow: theme.id === "cyber_neon" ? "0 0 20px rgba(56,189,248,0.4)" : "none",
            borderBottom: `2px solid ${config.accentColor || theme.accentColor}33`,
            display: "inline-block",
            padding: "0 24px 6px"
          }}>
            {effectiveRecipient}
          </div>

          <div style={{ fontSize: "clamp(11px, 1.3vw, 13px)", opacity: 0.8, maxWidth: 640, margin: "6px auto 0", lineHeight: 1.45 }}>
            {config.completionStatement || "has demonstrated verified proficiency and successfully completed the comprehensive curriculum and rigorous practical assessments for"}
          </div>

          {/* Course Title */}
          <div style={{
            fontSize: "clamp(16px, 2.5vw, 23px)",
            fontWeight: 800,
            margin: "8px 0 4px",
            color: config.goldColor || theme.goldColor,
            lineHeight: 1.25
          }}>
            {effectiveCourse}
          </div>

          {/* Honors or Score badge */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
            {config.honorsText && (
              <div style={{
                display: "inline-block",
                background: "linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(217,119,6,0.1) 100%)",
                color: config.goldColor || theme.goldColor,
                border: `1px solid ${config.goldColor || theme.goldColor}66`,
                fontSize: 11,
                fontWeight: 800,
                padding: "2px 10px",
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
                fontSize: 11,
                fontWeight: 800,
                padding: "2px 10px",
                borderRadius: 6
              }}>
                Assessed Score: {scorePct}% (Passing Standard Met)
              </div>
            )}
          </div>
        </div>

        {/* 3. BOTTOM FOOTER: Signatures, Seal Badge, Date, and QR Matrix */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "end", gap: 16, position: "relative", zIndex: 2 }}>
          
          {/* Primary Signatory */}
          <div style={{ textAlign: "left" }}>
            <div style={{
              fontFamily: theme.signatureFont,
              fontSize: "clamp(22px, 3.2vw, 30px)",
              color: config.accentColor || theme.accentColor,
              lineHeight: 1,
              marginBottom: 4
            }}>
              {config.signatoryName || "Inem Emmanuel"}
            </div>
            <div style={{ height: 1.5, background: theme.borderColor, width: "100%", maxWidth: 180, marginBottom: 4 }} />
            <div style={{ fontSize: 11.5, fontWeight: 800, color: theme.textColor }}>
              {config.signatoryName || "Inem Emmanuel"}
            </div>
            <div style={{ fontSize: 10, opacity: 0.7 }}>
              {config.signatoryTitle || "Director of Academic Excellence"}
            </div>
          </div>

          {/* Central Embossed Foil Seal / Security Badge */}
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{
              width: "clamp(60px, 8vw, 76px)",
              height: "clamp(60px, 8vw, 76px)",
              borderRadius: "50%",
              background: theme.id === "classic_academic" 
                ? "radial-gradient(circle, #FDE68A 0%, #D97706 70%, #92400E 100%)"
                : theme.id === "cyber_neon"
                ? "radial-gradient(circle, #0284C7 0%, #0369A1 60%, #0F172A 100%)"
                : "radial-gradient(circle, #2563EB 0%, #1E40AF 70%, #0F172A 100%)",
              border: `3px solid ${config.goldColor || theme.goldColor}`,
              boxShadow: `0 0 25px ${config.goldColor || theme.goldColor}55`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              position: "relative"
            }}>
              <Award size={26} color="#FFFFFF" />
              <span style={{ fontSize: 7.5, fontWeight: 900, letterSpacing: ".06em", marginTop: 2, textTransform: "uppercase" }}>
                {config.sealText || "OFFICIAL"}
              </span>
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.7, marginTop: 6 }}>
              Issued: {effectiveDate}
            </div>
          </div>

          {/* Secondary Signatory / QR Verification */}
          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{
              fontFamily: theme.signatureFont,
              fontSize: "clamp(20px, 3vw, 28px)",
              color: config.accentColor || theme.accentColor,
              lineHeight: 1,
              marginBottom: 4
            }}>
              {config.secondarySignatoryName || "Sara Foundation Authority"}
            </div>
            <div style={{ height: 1.5, background: theme.borderColor, width: "100%", maxWidth: 180, marginBottom: 4 }} />
            <div style={{ fontSize: 11.5, fontWeight: 800, color: theme.textColor }}>
              {config.secondarySignatoryName || "Sara Foundation Authority"}
            </div>
            <div style={{ fontSize: 10, opacity: 0.7 }}>
              {config.secondarySignatoryTitle || "Registrar & Academic Council"}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
