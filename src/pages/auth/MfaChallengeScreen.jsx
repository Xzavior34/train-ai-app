import React, { useEffect, useState } from "react";
import { ArrowRight, LogOut, Loader2 } from "lucide-react";
import { listMfaFactors, createMfaChallenge, verifyMfaChallenge } from "../../lib/api/mfa.js";

// Shown at login time (in place of the main app) whenever
// supabase.auth.mfa.getAuthenticatorAssuranceLevel() reports the session is
// still aal1 but a verified factor exists (nextLevel aal2) - i.e. the user
// has 2FA enabled but hasn't stepped up yet this session. Full-page layout
// mirrors AuthPage.jsx since, like AuthPage, this replaces the whole screen
// during boot rather than overlaying it.
export default function MfaChallengeScreen({ onVerified, onSignOut }) {
  const [factorId, setFactorId] = useState(null);
  const [challengeId, setChallengeId] = useState(null);
  const [code, setCode] = useState("");
  const [initializing, setInitializing] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const factors = await listMfaFactors();
        const totp = (factors?.totp || []).find((f) => f.status === "verified");
        if (!totp) {
          // Nothing to challenge against - let the app proceed rather than
          // trap the user on a dead-end screen.
          if (!cancelled) onVerified?.();
          return;
        }
        const { challengeId: newChallengeId } = await createMfaChallenge(totp.id);
        if (cancelled) return;
        setFactorId(totp.id);
        setChallengeId(newChallengeId);
      } catch (e) {
        if (!cancelled) setError(e?.message || "Could not start verification.");
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [onVerified]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!factorId || !challengeId || code.length !== 6) return;
    setSubmitting(true);
    setError(null);
    try {
      await verifyMfaChallenge(factorId, challengeId, code);
      onVerified?.();
    } catch (err) {
      setError(err?.message || "Invalid code. Please try again.");
      setCode("");
      // A used/expired challenge can't be retried - open a fresh one so the
      // next attempt isn't guaranteed to fail too.
      try {
        const { challengeId: freshChallengeId } = await createMfaChallenge(factorId);
        setChallengeId(freshChallengeId);
      } catch {
        // Leave the stale challengeId in place; the next submit will surface
        // whatever error Supabase returns for it.
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.outer}>
      <style>{`
        @keyframes mfaFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes mfaSpin { to { transform: rotate(360deg); } }
        .mfa-card { animation: mfaFadeUp .35s ease; }
        .mfa-spin { animation: mfaSpin .8s linear infinite; }
        .mfa-input:focus { outline: none; border-color: #818CF8 !important; box-shadow: 0 0 0 3px rgba(79,70,229,.12); }
        .mfa-submit:hover { box-shadow: 0 14px 28px -8px rgba(79,70,229,.55); transform: translateY(-1px); }
        .mfa-submit:active { transform: scale(.98); }
        .mfa-signout { transition: color .15s ease; }
        .mfa-signout:hover { text-decoration: underline; color: #4F46E5; }
      `}</style>

      <div style={styles.glowTop} />
      <div style={styles.glowBottom} />

      <form onSubmit={handleSubmit} className="mfa-card" style={styles.card}>
        <div style={styles.brandRow}>
          <img src="/brand/train-ai-logo.png" alt="Train AI" style={{ width: 34, height: 34, objectFit: "contain", borderRadius: 0, flexShrink: 0 }} />
          <div style={styles.brandName}>Train AI</div>
        </div>

        <h1 style={styles.h1}>Two-factor authentication</h1>
        <p style={styles.sub}>Enter the 6-digit code from your authenticator app to continue.</p>

        {initializing ? (
          <div style={styles.loadingRow}>
            <Loader2 size={16} className="mfa-spin" /> Preparing verification…
          </div>
        ) : (
          <>
            <label style={styles.label}>Authentication code</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mfa-input"
              style={styles.codeInput}
              placeholder="000000"
            />

            {error && <div style={styles.errorBox}>{error}</div>}

            <button
              type="submit"
              disabled={submitting || code.length !== 6 || !factorId}
              className="mfa-submit"
              style={{ ...styles.submit, opacity: submitting || code.length !== 6 || !factorId ? 0.75 : 1 }}
            >
              {submitting ? "Verifying..." : (
                <>Verify <ArrowRight size={16} /></>
              )}
            </button>
          </>
        )}

        {onSignOut && (
          <div style={styles.switchRow}>
            Not your device or lost your authenticator?{" "}
            <span className="mfa-signout" style={styles.switchLink} onClick={onSignOut}>
              <LogOut size={12} style={{ verticalAlign: -2, marginRight: 3 }} />
              Sign out
            </span>
          </div>
        )}
      </form>
    </div>
  );
}

const styles = {
  outer: {
    position: "relative", overflow: "hidden", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "#F4F6FC", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: 20,
  },
  glowTop: {
    position: "absolute", top: -180, left: "50%", transform: "translateX(-50%)", width: 560, height: 360, borderRadius: "50%",
    background: "radial-gradient(closest-side, rgba(91,127,255,.22), transparent)", pointerEvents: "none",
  },
  glowBottom: {
    position: "absolute", bottom: -200, right: -120, width: 480, height: 380, borderRadius: "50%",
    background: "radial-gradient(closest-side, rgba(44,70,214,.14), transparent)", pointerEvents: "none",
  },
  card: {
    position: "relative", width: "100%", maxWidth: 400, background: "#fff", borderRadius: 22, padding: 32,
    border: "1px solid #E6E9F5", boxShadow: "0 1px 2px rgba(16,20,42,.04), 0 30px 60px -24px rgba(16,20,42,.18)",
  },
  brandRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 20 },
  brandMark: {
    width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
    background: "linear-gradient(135deg, #4338CA 0%, #4F46E5 55%, #818CF8 100%)",
    boxShadow: "0 8px 16px -6px rgba(79,70,229,.5)",
  },
  brandName: { fontWeight: 800, fontSize: 15.5, letterSpacing: "-0.01em", color: "#10142A" },
  h1: { fontSize: 20, fontWeight: 800, margin: "0 0 4px", color: "#10142A", letterSpacing: "-0.01em" },
  sub: { fontSize: 12.5, color: "#656C86", margin: "0 0 20px", lineHeight: 1.45 },
  loadingRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#656C86", padding: "12px 0" },
  label: { fontSize: 11, fontWeight: 700, color: "#656C86", textTransform: "uppercase", letterSpacing: ".06em" },
  codeInput: {
    width: "100%", marginTop: 6, padding: "12px 13px", borderRadius: 12, border: "1.5px solid #E6E9F5",
    fontSize: 20, letterSpacing: "0.5em", textAlign: "center", color: "#10142A", boxSizing: "border-box",
    fontFamily: "monospace", transition: "border-color .12s ease, box-shadow .12s ease",
  },
  errorBox: {
    background: "#FDECEC", color: "#EF4444", fontSize: 12.5, padding: "10px 12px", borderRadius: 11,
    marginTop: 14, lineHeight: 1.4, fontWeight: 500,
  },
  submit: {
    width: "100%", marginTop: 20, border: "none", borderRadius: 13, padding: "12px 16px", fontWeight: 700, fontSize: 14,
    color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    background: "linear-gradient(135deg, #4338CA 0%, #4F46E5 55%, #818CF8 100%)",
    boxShadow: "0 10px 22px -8px rgba(79,70,229,.5)", transition: "transform .12s ease, box-shadow .12s ease",
  },
  switchRow: { textAlign: "center", marginTop: 18, fontSize: 12.5, color: "#656C86" },
  switchLink: { color: "#4F46E5", fontWeight: 700, cursor: "pointer" },
};
