import React, { useState, useEffect } from "react";
import { ArrowRight, Mail, Lock, GraduationCap, User, ShieldCheck, ShieldAlert } from "lucide-react";
import { checkPasswordBreached } from "../../lib/api/mfa.js";
import { applyReferralCode } from "../../lib/api/referrals.js";

// No client-side router in this app, so a "?ref=CODE" on the URL (e.g.
// shared via a referrer's link from ReferralPanel.jsx) is captured once on
// mount and held in sessionStorage until signup completes — it would
// otherwise be lost as soon as the user starts typing into the form.
const PENDING_REFERRAL_KEY = "trainai_pending_referral_code";

export default function AuthPage({ onSignIn, onSignUp, authError, initialEmail = "" }) {
  const [mode, setMode] = useState("signin");
  // Prefilled when this screen is reached right after accepting an org
  // invitation (see AcceptInvitationScreen -> App.jsx's onNeedsSignIn) so the
  // user doesn't have to retype the email their invite was sent to.
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [signupRole, setSignupRole] = useState("learner");
  const [submitting, setSubmitting] = useState(false);
  const [breachWarning, setBreachWarning] = useState(false);
  const [checkingBreach, setCheckingBreach] = useState(false);

  useEffect(() => {
    try {
      const refCode = new URLSearchParams(window.location.search).get("ref");
      if (refCode) sessionStorage.setItem(PENDING_REFERRAL_KEY, refCode);
      // If a referral code is already pending, jump straight to the signup
      // form so a shared link doesn't dead-end on the sign-in screen.
      if (sessionStorage.getItem(PENDING_REFERRAL_KEY)) setMode("signup");
    } catch {
      // URLSearchParams/sessionStorage can throw in locked-down browsing
      // contexts — referral capture is best-effort, never blocks signup.
    }
  }, []);

  function handlePasswordChange(value) {
    setPassword(value);
    if (breachWarning) setBreachWarning(false);
  }

  // Advisory only (matches the reference app's password-breach-check edge
  // function, which itself fails open with breached:false on any upstream
  // error) — never blocks signup, just warns before submit so the user can
  // choose a different password if they want to.
  async function handlePasswordBlur() {
    if (mode !== "signup" || !password) return;
    setCheckingBreach(true);
    try {
      const result = await checkPasswordBreached(password);
      setBreachWarning(!!result?.breached);
    } catch {
      setBreachWarning(false);
    } finally {
      setCheckingBreach(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setSubmitting(true);
    if (mode === "signin") {
      await onSignIn(email, password);
    } else {
      const result = await onSignUp(email, password, signupRole);
      const newUserId = result?.data?.user?.id || result?.data?.session?.user?.id;
      let pendingCode = null;
      try { pendingCode = sessionStorage.getItem(PENDING_REFERRAL_KEY); } catch { /* best-effort */ }
      if (pendingCode && newUserId) {
        // Fire-and-forget: a failed/blocked referral write (e.g. email
        // confirmation required so there's no session yet) should never
        // stop the account from being created.
        applyReferralCode(pendingCode, newUserId)
          .then((res) => { if (res?.success) { try { sessionStorage.removeItem(PENDING_REFERRAL_KEY); } catch { /* ignore */ } } })
          .catch(() => {});
      }
    }
    setSubmitting(false);
  }

  return (
    <div style={styles.outer}>
      <style>{`
        @keyframes authFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .auth-card { animation: authFadeUp .35s ease; }
        .auth-input:focus { outline: none; border-color: #60A5FA !important; box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
        .auth-submit:hover { box-shadow: 0 14px 28px -8px rgba(37,99,235,.55); transform: translateY(-1px); }
        .auth-switch:hover { text-decoration: underline; }
        .role-picker-card { transition: border-color .15s ease, background-color .15s ease; }
        .role-picker-card.active { border-color: #2563EB !important; background: #EEF2FF !important; }
      `}</style>

      <div style={styles.glowTop} />
      <div style={styles.glowBottom} />

      <form onSubmit={handleSubmit} className="auth-card" style={styles.card}>
        <div style={styles.brandRow}>
          <img src="/brand/train-ai-logo.png" alt="Train AI" style={{ width: 34, height: 34, objectFit: "contain", borderRadius: 0, flexShrink: 0 }} />
          <div style={styles.brandName}>Train AI</div>
        </div>

        <h1 style={styles.h1}>{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p style={styles.sub}>
          {mode === "signin" ? "Sign in with your email and password." : "Join Train AI to start your personalized learning path."}
        </p>

        {mode === "signup" && (
          <div style={{ marginBottom: 20 }}>
            <div style={styles.label}>Choose account type</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
              <div
                className={`role-picker-card ${signupRole === "learner" ? "active" : ""}`}
                onClick={() => setSignupRole("learner")}
                style={{
                  padding: "12px 10px", borderRadius: 13, border: "1.5px solid #E6E9F5", background: "#fff",
                  cursor: "pointer", display: "flex", flexDirection: "column", gap: 6
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <User size={15} color={signupRole === "learner" ? "#2563EB" : "#656C86"} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#10142A" }}>Learner</span>
                </div>
                <span style={{ fontSize: 11, color: "#656C86", lineHeight: 1.3 }}>Access courses, AI quizzes, community</span>
              </div>

              <div
                className={`role-picker-card ${signupRole === "mentor" ? "active" : ""}`}
                onClick={() => setSignupRole("mentor")}
                style={{
                  padding: "12px 10px", borderRadius: 13, border: "1.5px solid #E6E9F5", background: "#fff",
                  cursor: "pointer", display: "flex", flexDirection: "column", gap: 6
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <GraduationCap size={15} color={signupRole === "mentor" ? "#2563EB" : "#656C86"} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#10142A" }}>Instructor</span>
                </div>
                <span style={{ fontSize: 11, color: "#656C86", lineHeight: 1.3 }}>Apply to mentor students & host sessions</span>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#9AA1B9", marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}>
              <ShieldCheck size={13} color="#9AA1B9" /> Admin access is reserved for platform administration (info@sarafoundationafrica.com).
            </div>
          </div>
        )}

        <label style={styles.label}>Email Address</label>
        <div style={styles.inputWrap}>
          <Mail size={15} color="#9AA1B9" style={styles.inputIcon} />
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="auth-input" style={styles.input} placeholder="you@example.com"
          />
        </div>

        <label style={{ ...styles.label, marginTop: 14 }}>Password</label>
        <div style={styles.inputWrap}>
          <Lock size={15} color="#9AA1B9" style={styles.inputIcon} />
          <input
            type="password" required value={password} onChange={(e) => handlePasswordChange(e.target.value)}
            onBlur={mode === "signup" ? handlePasswordBlur : undefined}
            className="auth-input" style={styles.input} placeholder="••••••••"
          />
        </div>

        {mode === "signup" && checkingBreach && (
          <div style={styles.breachChecking}>Checking password against known breaches…</div>
        )}
        {mode === "signup" && breachWarning && (
          <div style={styles.breachBox}>
            <ShieldAlert size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>This password has appeared in a known data breach. Please choose a more secure password.</span>
          </div>
        )}

        {authError && <div style={styles.errorBox}>{authError}</div>}

        <button type="submit" disabled={submitting} className="auth-submit" style={{ ...styles.submit, opacity: submitting ? .75 : 1 }}>
          {submitting ? "Processing..." : (
            <>{mode === "signin" ? "Sign in" : "Create Account"} <ArrowRight size={16} /></>
          )}
        </button>

        <div style={styles.switchRow}>
          {mode === "signin" ? (
            <>Don't have an account? <span className="auth-switch" style={styles.switchLink} onClick={() => { setMode("signup"); setBreachWarning(false); }}>Sign up</span></>
          ) : (
            <>Already have an account? <span className="auth-switch" style={styles.switchLink} onClick={() => { setMode("signin"); setBreachWarning(false); }}>Sign in</span></>
          )}
        </div>
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
    background: "linear-gradient(135deg, #1D4ED8 0%, #2563EB 55%, #60A5FA 100%)",
    boxShadow: "0 8px 16px -6px rgba(37,99,235,.5)",
  },
  brandName: { fontWeight: 800, fontSize: 15.5, letterSpacing: "-0.01em", color: "#10142A" },
  h1: { fontSize: 20, fontWeight: 800, margin: "0 0 4px", color: "#10142A", letterSpacing: "-0.01em" },
  sub: { fontSize: 12.5, color: "#656C86", margin: "0 0 20px", lineHeight: 1.45 },
  label: { fontSize: 11, fontWeight: 700, color: "#656C86", textTransform: "uppercase", letterSpacing: ".06em" },
  inputWrap: { position: "relative", marginTop: 6 },
  inputIcon: { position: "absolute", left: 13, top: 13 },
  input: {
    width: "100%", padding: "11px 13px 11px 36px", borderRadius: 12, border: "1.5px solid #E6E9F5",
    fontSize: 13.5, color: "#10142A", boxSizing: "border-box", transition: "border-color .12s ease, box-shadow .12s ease",
  },
  errorBox: {
    background: "#FDECEC", color: "#EF4444", fontSize: 12.5, padding: "10px 12px", borderRadius: 11,
    marginTop: 14, lineHeight: 1.4, fontWeight: 500,
  },
  breachChecking: { fontSize: 11, color: "#9AA1B9", marginTop: 8 },
  breachBox: {
    display: "flex", gap: 8, background: "#FFF7E6", color: "#B45309", fontSize: 12,
    padding: "10px 12px", borderRadius: 11, marginTop: 8, lineHeight: 1.4, fontWeight: 500,
  },
  submit: {
    width: "100%", marginTop: 20, border: "none", borderRadius: 13, padding: "12px 16px", fontWeight: 700, fontSize: 14,
    color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    background: "linear-gradient(135deg, #1D4ED8 0%, #2563EB 55%, #60A5FA 100%)",
    boxShadow: "0 10px 22px -8px rgba(37,99,235,.5)", transition: "transform .12s ease, box-shadow .12s ease",
  },
  switchRow: { textAlign: "center", marginTop: 18, fontSize: 13, color: "#656C86" },
  switchLink: { color: "#2563EB", fontWeight: 700, cursor: "pointer" },
};
