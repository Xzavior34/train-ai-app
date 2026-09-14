import React, { useEffect, useState, useCallback } from "react";
import { X, ShieldCheck, ShieldAlert, Smartphone, Trash2, Loader2, AlertCircle } from "lucide-react";
import {
  enrollMfaFactor,
  listMfaFactors,
  createMfaChallenge,
  verifyMfaChallenge,
  unenrollMfaFactor,
} from "../../lib/api/mfa.js";

// Shown from Profile & Settings ("Two-factor authentication" row). Presented
// as a modal overlay, matching the pattern already used by
// src/components/common/AccessibilityPanel.jsx elsewhere in this screen.
//
// States:
//  - "loading"     initial factor lookup
//  - "not_started" no verified TOTP factor yet - show "Enable" button
//  - "pending"     mid-enrollment - show QR + secret + 6-digit confirm form
//  - "active"      a verified factor exists - show status + disable button
export default function MfaSetupScreen({ onClose }) {
  const [view, setView] = useState({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const data = await listMfaFactors();
      const verified = (data?.totp || []).find((f) => f.status === "verified");
      if (verified) {
        setView({ kind: "active", factorId: verified.id });
        return;
      }
      // Strictly opt-in: stale/unverified factors from an abandoned attempt
      // are cleaned up in startEnroll(), not surfaced here on load.
      setView({ kind: "not_started" });
    } catch (e) {
      setError(e?.message || "Could not load two-factor status.");
      setView({ kind: "not_started" });
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function startEnroll() {
    setError(null);
    setBusy(true);
    try {
      // Clean up any abandoned unverified TOTP factors first so re-enrollment
      // never collides on friendly name or leaves orphaned pending factors.
      const existing = await listMfaFactors().catch(() => null);
      const stale = (existing?.totp || []).filter((f) => f.status === "unverified");
      for (const f of stale) {
        await unenrollMfaFactor(f.id).catch(() => {});
      }

      const enrolled = await enrollMfaFactor();
      setView({
        kind: "pending",
        factorId: enrolled.factorId,
        qrCodeDataUri: enrolled.qrCodeDataUri,
        secret: enrolled.secret,
      });
    } catch (e) {
      setError(e?.message || "Could not start two-factor enrollment.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelPending(factorId) {
    setBusy(true);
    setError(null);
    try {
      await unenrollMfaFactor(factorId);
      setCode("");
      await refresh();
    } catch (e) {
      setError(e?.message || "Could not cancel enrollment.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e, factorId) {
    e.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const { challengeId } = await createMfaChallenge(factorId);
      await verifyMfaChallenge(factorId, challengeId, code);
      setCode("");
      await refresh();
    } catch (e2) {
      setError(e2?.message || "Invalid code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disable(factorId) {
    setBusy(true);
    setError(null);
    try {
      await unenrollMfaFactor(factorId);
      await refresh();
    } catch (e) {
      setError(e?.message || "Could not disable two-factor authentication.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Two-factor authentication"
      onClick={busy ? undefined : onClose}
      className="mfa2-overlay"
      style={{
        position: "fixed", inset: 0, zIndex: 10000, background: "rgba(16,20,42,.45)",
        display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mfa2-card"
        style={{
          width: "100%", maxWidth: 440, background: "#FFFFFF", borderRadius: 10,
          boxShadow: "0 20px 60px -15px rgba(16,20,42,.4)", padding: 20,
          maxHeight: "88vh", overflowY: "auto",
        }}
      >
        <style>{`
          @keyframes taiMfaSpin { to { transform: rotate(360deg); } }
          .tai-spin { animation: taiMfaSpin .8s linear infinite; }
          @keyframes mfa2FadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes mfa2SlideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
          .mfa2-overlay { animation: mfa2FadeIn .18s ease both; }
          .mfa2-card { animation: mfa2SlideUp .25s cubic-bezier(.16,1,.3,1) both; }
          .mfa2-close-btn { transition: background .15s ease, color .15s ease; }
          .mfa2-close-btn:hover { background: #F1F5F9; color: #10142A; }
          .mfa2-primary-btn { transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease; }
          .mfa2-primary-btn:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 10px 22px -8px rgba(37,99,235,.5); }
          .mfa2-primary-btn:not(:disabled):active { transform: scale(.98); }
          .mfa2-outline-btn { transition: background .15s ease, border-color .15s ease; }
          .mfa2-outline-btn:not(:disabled):hover { background: #F8FAFC; border-color: #C7D2FE; }
          .mfa2-danger-btn { transition: background .15s ease, transform .15s ease; }
          .mfa2-danger-btn:not(:disabled):hover { background: #FEF2F2; }
          .mfa2-danger-btn:not(:disabled):active { transform: scale(.98); }
        `}</style>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {view.kind === "active" ? (
              <ShieldCheck size={18} color="#16A34A" />
            ) : (
              <ShieldAlert size={18} color="#2563EB" />
            )}
            <div style={{ fontWeight: 800, fontSize: 15.5, color: "#10142A" }}>Two-factor authentication</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="mfa2-close-btn"
            style={{
              width: 32, height: 32, borderRadius: 8, border: "1px solid #E6E9F5", background: "#FFFFFF",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: busy ? "default" : "pointer", color: "#656C86",
            }}
          >
            <X size={15} />
          </button>
        </div>

        {view.kind === "loading" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 24, marginBottom: 8, color: "#656C86", fontSize: 13 }}>
            <Loader2 size={16} className="tai-spin" /> Loading…
          </div>
        )}

        {view.kind === "not_started" && (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 12.5, color: "#656C86", lineHeight: 1.5, margin: "0 0 16px" }}>
              Add an extra layer of security by requiring a one-time code from an authenticator
              app (Google Authenticator, 1Password, Authy, etc.) whenever you sign in.
            </p>
            <button
              type="button"
              onClick={startEnroll}
              disabled={busy}
              className="mfa2-primary-btn"
              style={{
                width: "100%", border: "none", cursor: busy ? "default" : "pointer", borderRadius: 8,
                fontWeight: 700, fontSize: 14, padding: "11px 16px", color: "#fff", opacity: busy ? 0.75 : 1,
                background: "#2563EB",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {busy ? <Loader2 size={15} className="tai-spin" /> : <ShieldCheck size={15} />}
              Enable two-factor authentication
            </button>
          </div>
        )}

        {view.kind === "pending" && (
          <form onSubmit={(e) => verify(e, view.factorId)} style={{ marginTop: 14 }}>
            <p style={{ fontSize: 12.5, color: "#656C86", lineHeight: 1.5, margin: "0 0 14px" }}>
              {view.qrCodeDataUri
                ? "Scan this QR code with your authenticator app, then enter the 6-digit code below."
                : "Enter the 6-digit code from your authenticator, or cancel to start over."}
            </p>

            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
              border: "1px solid #E6E9F5", borderRadius: 8, background: "#F7F9FF", padding: 16,
            }}>
              {view.qrCodeDataUri && (
                <img
                  src={view.qrCodeDataUri}
                  alt="MFA QR Code"
                  style={{ width: 176, height: 176, borderRadius: 8, border: "1px solid #D8DEF5", background: "#fff", padding: 8 }}
                />
              )}

              {view.secret && (
                <div style={{ width: "100%", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#656C86", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700 }}>
                    Manual secret key
                  </div>
                  <code style={{
                    display: "inline-block", marginTop: 4, padding: "4px 8px", background: "#fff",
                    border: "1px solid #D8DEF5", borderRadius: 6, fontSize: 12, color: "#2563EB",
                    fontFamily: "ui-monospace, Menlo, Monaco, monospace", wordBreak: "break-all",
                  }}>
                    {view.secret}
                  </code>
                </div>
              )}
            </div>

            <div style={{ marginTop: 14 }}>
              <label htmlFor="mfa2-code-input" style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#656C86", textTransform: "uppercase", letterSpacing: ".06em" }}>
                6-digit verification code
              </label>
              <input
                id="mfa2-code-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="one-time-code"
                autoFocus
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                style={{
                  width: "100%", marginTop: 6, boxSizing: "border-box", padding: "10px 14px",
                  borderRadius: 8, border: "1.5px solid #D8DEF5", fontSize: 18, fontWeight: 700,
                  letterSpacing: ".25em", textAlign: "center", color: "#10142A", background: "#fff",
                }}
              />
            </div>

            {error && (
              <div style={{
                display: "flex", gap: 8, background: "#FDECEC", color: "#EF4444", fontSize: 12,
                padding: "10px 12px", borderRadius: 8, marginTop: 12, lineHeight: 1.4, fontWeight: 500,
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => cancelPending(view.factorId)}
                disabled={busy}
                className="mfa2-outline-btn"
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #D8DEF5", background: "#fff",
                  color: "#656C86", fontWeight: 700, fontSize: 13, cursor: busy ? "default" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="mfa2-primary-btn"
                style={{
                  flex: 1.4, border: "none", cursor: (busy || code.length !== 6) ? "default" : "pointer",
                  borderRadius: 8, fontWeight: 700, fontSize: 13.5, padding: "10px 16px", color: "#fff",
                  background: "#2563EB", opacity: (busy || code.length !== 6) ? 0.6 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                {busy ? <Loader2 size={14} className="tai-spin" /> : <ShieldCheck size={14} />}
                Verify & enable
              </button>
            </div>
          </form>
        )}

        {view.kind === "active" && (
          <div style={{ marginTop: 14 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10, background: "#F0FDF4", border: "1px solid #BBF7D0",
              borderRadius: 8, padding: 14, marginBottom: 14,
            }}>
              <ShieldCheck size={20} color="#16A34A" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: 12.5, color: "#166534", lineHeight: 1.45 }}>
                Your account is protected with an authenticator app. You'll be asked for a
                6-digit code the next time you sign in.
              </div>
            </div>

            {error && (
              <div style={{
                display: "flex", gap: 8, background: "#FDECEC", color: "#EF4444", fontSize: 12,
                padding: "10px 12px", borderRadius: 8, marginBottom: 14, lineHeight: 1.4, fontWeight: 500,
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => disable(view.factorId)}
              disabled={busy}
              className="mfa2-danger-btn"
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 8, border: "1.5px solid #FCA5A5", background: "#fff",
                color: "#EF4444", fontWeight: 700, fontSize: 13.5, cursor: busy ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {busy ? <Loader2 size={14} className="tai-spin" /> : <Trash2 size={14} />}
              Disable two-factor authentication
            </button>
          </div>
        )}

        {error && view.kind === "not_started" && (
          <div style={{
            display: "flex", gap: 8, background: "#FDECEC", color: "#EF4444", fontSize: 12,
            padding: "10px 12px", borderRadius: 8, marginTop: 14, lineHeight: 1.4, fontWeight: 500,
          }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
