import React, { useState, useEffect } from "react";
import {
  ShieldCheck, AlertTriangle, XCircle, CheckCircle2, Award,
  Building2, Calendar, BookOpen, ArrowLeft, ExternalLink, Printer
} from "lucide-react";
import { verifyPublicCertificate } from "../../lib/api/certificates.js";

export default function CertificateVerificationPage({ certCode, onGoHome }) {
  const [loading, setLoading] = useState(true);
  const [certData, setCertData] = useState(null);
  const [searchQuery, setSearchQuery] = useState(certCode || "");

  async function handleVerify(code) {
    if (!code) return;
    setLoading(true);
    try {
      const res = await verifyPublicCertificate(code);
      setCertData(res);
    } catch {
      setCertData({ verified: false, error: "Unable to verify certificate at this time." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (certCode) {
      handleVerify(certCode);
    } else {
      setLoading(false);
    }
  }, [certCode]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0B0F19",
        color: "#F1F5F9",
        fontFamily: "var(--font-sans, 'Plus Jakarta Sans', sans-serif)",
        padding: "40px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ maxWidth: 640, width: "100%" }}>
        {/* Navigation & Brand Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <button
            onClick={onGoHome}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#94A3B8",
              padding: "8px 14px",
              borderRadius: 8,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <ArrowLeft size={14} /> Back to Train AI
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/brand/train-ai-logo.png" alt="Train AI" style={{ width: 28, height: 28, objectFit: "contain" }} />
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>
              TRAIN<span style={{ color: "#3B82F6" }}>AI</span>
            </span>
          </div>
        </div>

        {/* Verification Search Bar */}
        <div
          style={{
            background: "#111827",
            border: "1px solid #1F2937",
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
            Credential &amp; Certificate Verification Portal
          </div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 16, lineHeight: 1.5 }}>
            Verify the authenticity of digital certificates issued by Train AI partner organizations, academies, and the Career Acceleration Programme (CAP).
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerify(searchQuery.trim());
            }}
            style={{ display: "flex", gap: 8 }}
          >
            <input
              type="text"
              className="ta-input"
              style={{
                flex: 1,
                background: "#1E293B",
                border: "1px solid #334155",
                color: "#FFFFFF",
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 13.5,
              }}
              placeholder="Enter Certificate ID (e.g. TA-2026-NEXUS-8841)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              type="submit"
              className="ta-btn ta-btn-primary"
              style={{ padding: "0 18px", fontSize: 13.5 }}
            >
              Verify
            </button>
          </form>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: "#94A3B8" }}>
            <div className="spin" style={{ width: 24, height: 24, margin: "0 auto 12px", border: "2px solid #3B82F6", borderTopColor: "transparent", borderRadius: "50%" }} />
            Validating certificate signature against immutable ledger...
          </div>
        )}

        {/* Result: Verified */}
        {!loading && certData && certData.verified && (
          <div
            style={{
              background: "#111827",
              border: "1.5px solid rgba(16, 185, 129, 0.4)",
              borderRadius: 14,
              padding: 28,
              boxShadow: "0 0 40px rgba(16, 185, 129, 0.08)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div
                style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: "rgba(16, 185, 129, 0.15)", color: "#10B981",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <ShieldCheck size={26} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#10B981", textTransform: "uppercase", letterSpacing: ".06em" }}>
                  Verified Authentic Certificate
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#FFFFFF" }}>
                  Official Credential Verified
                </div>
              </div>
            </div>

            {/* Credential Data Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 14,
                background: "#1E293B",
                borderRadius: 10,
                padding: 18,
                border: "1px solid #334155",
                marginBottom: 20,
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Recipient Name</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#FFFFFF", marginTop: 2 }}>{certData.recipient_name}</div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Programme / Course</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#60A5FA", marginTop: 2 }}>{certData.course_name}</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Issuing Authority</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#CBD5E1", marginTop: 2 }}>{certData.organization_name}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Issue Date</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#CBD5E1", marginTop: 2 }}>
                    {new Date(certData.issued_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Certificate Identifier</div>
                <div style={{ fontSize: 12.5, fontFamily: "monospace", color: "#38BDF8", marginTop: 2, wordBreak: "break-all" }}>
                  {certData.certificate_code}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <span style={{ fontSize: 11.5, color: "#64748B" }}>
                Verified via Train AI Tamper-Proof Credential Engine
              </span>
              <button
                onClick={() => window.print()}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#FFFFFF",
                  padding: "6px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <Printer size={13} /> Print Verification
              </button>
            </div>
          </div>
        )}

        {/* Result: Revoked or Invalid */}
        {!loading && certData && !certData.verified && (
          <div
            style={{
              background: "#111827",
              border: "1.5px solid rgba(239, 68, 68, 0.4)",
              borderRadius: 14,
              padding: 28,
              boxShadow: "0 0 40px rgba(239, 68, 68, 0.08)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: "rgba(239, 68, 68, 0.15)", color: "#EF4444",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <XCircle size={26} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", textTransform: "uppercase", letterSpacing: ".06em" }}>
                  {certData.is_revoked ? "Certificate Revoked" : "Verification Failed"}
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#FFFFFF" }}>
                  {certData.is_revoked ? "This credential is no longer valid" : "Invalid Certificate ID"}
                </div>
              </div>
            </div>

            <p style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.5, margin: 0 }}>
              {certData.reason || certData.error || "The provided certificate identifier could not be verified against the official records."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
