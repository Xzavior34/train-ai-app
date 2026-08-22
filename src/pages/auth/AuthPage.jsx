import React, { useState, useEffect } from "react";
import { ArrowRight, Mail, Lock, User, ShieldCheck, ShieldAlert, Building2, CheckCircle2 } from "lucide-react";
import { checkPasswordBreached } from "../../lib/api/mfa.js";
import { registerOrganization, joinDefaultOrganization, attributeReferralSignupIfPending } from "../../lib/api/organizations.js";

export default function AuthPage({
  onSignIn, onSignUp, authError, initialEmail = "",
  onForgotPassword, recoveryMode = false, onCompletePasswordReset,
  onGoHome
}) {
  const [mode, setMode] = useState("signin");

  useEffect(() => {
    if (recoveryMode) setMode("recovery");
  }, [recoveryMode]);

  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [resetError, setResetError] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState("organization");
  const [orgName, setOrgName] = useState("");
  const [orgError, setOrgError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [breachWarning, setBreachWarning] = useState(false);
  const [checkingBreach, setCheckingBreach] = useState(false);

  function handlePasswordChange(value) {
    setPassword(value);
    if (breachWarning) setBreachWarning(false);
  }

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

  async function handleForgotPasswordSubmit(e) {
    e.preventDefault();
    if (!email.trim() || sendingReset) return;
    setSendingReset(true);
    try {
      await onForgotPassword?.(email.trim());
    } finally {
      setSendingReset(false);
      setResetEmailSent(true);
    }
  }

  async function handleSetNewPasswordSubmit(e) {
    e.preventDefault();
    setResetError("");
    if (newPassword.length < 8) {
      setResetError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setResetError("Passwords don't match.");
      return;
    }
    setResettingPassword(true);
    try {
      const result = await onCompletePasswordReset?.(newPassword);
      if (!result?.success) {
        setResetError(result?.error || "Could not update your password. The reset link may have expired - request a new one.");
      }
    } finally {
      setResettingPassword(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    if (mode === "signup" && accountType === "organization" && orgName.trim().length < 2) {
      setOrgError("Enter your organization's name to continue.");
      return;
    }
    setOrgError("");
    setSubmitting(true);
    if (mode === "signin") {
      await onSignIn(email, password);
    } else {
      const signupRole = "learner";
      const result = await onSignUp(email, password, signupRole, accountType);

      if (!result?.error && result?.data?.user?.id) {
        attributeReferralSignupIfPending(result.data.user.id).catch(() => {});
      }

      if (accountType === "organization" && !result?.error) {
        const orgResult = await registerOrganization(orgName);
        if (!orgResult.success) {
          setOrgError(orgResult.error || "Account created, but we couldn't register your organization. You can try again from Settings.");
        } else {
          window.location.reload();
          return;
        }
      } else if (accountType === "learner" && !result?.error) {
        joinDefaultOrganization().catch(() => {});
      }
    }
    setSubmitting(false);
  }

  return (
    <div style={styles.outer}>
      <style>{`
        @keyframes authFadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .auth-card { animation: authFadeUp .2s ease; }
        .auth-input:focus { outline: none; border-color: #4F46E5 !important; box-shadow: 0 0 0 2px rgba(79,70,229,.15); }
        .auth-submit:hover { background-color: #4338CA !important; }
        .auth-switch:hover { text-decoration: underline; }
        .role-picker-card { transition: border-color .15s ease, background-color .15s ease; }
        .role-picker-card:hover { border-color: #CBD5E1; }
        .role-picker-card.active { border-color: #4F46E5 !important; background: #EEF2FF !important; }
        @media (max-width: 440px) {
          .auth-card { padding: 24px 18px !important; }
          .role-picker-header { flex-wrap: wrap; row-gap: 4px; }
          .role-picker-header .role-picker-badge { margin-left: 0 !important; }
        }
      `}</style>

      <form
        onSubmit={mode === "forgot" ? handleForgotPasswordSubmit : mode === "recovery" ? handleSetNewPasswordSubmit : handleSubmit}
        className="auth-card" style={styles.card}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div onClick={onGoHome || (() => { window.location.href = "/"; })} style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
            <img src="/train-ai-logo.png" alt="Train AI" style={{ height: 28, width: "auto", objectFit: "contain", display: "block" }} />
          </div>
          <span
            onClick={onGoHome || (() => { window.location.href = "/"; })}
            style={{ fontSize: 12, color: "#64748B", fontWeight: 600, cursor: "pointer" }}
            className="auth-switch"
          >
            ← Back to website
          </span>
        </div>

        {mode === "forgot" && (
          <>
            <h1 style={styles.h1}>Reset your password</h1>
            {resetEmailSent ? (
              <>
                <p style={styles.sub}>
                  <CheckCircle2 size={15} color="#16A34A" style={{ verticalAlign: -2, marginRight: 6 }} />
                  If an account exists for <strong>{email}</strong>, we've sent a link to reset your password. Check your inbox.
                </p>
                <div style={styles.switchRow}>
                  <span className="auth-switch" style={styles.switchLink} onClick={() => { setMode("signin"); setResetEmailSent(false); }}>Back to sign in</span>
                </div>
              </>
            ) : (
              <>
                <p style={styles.sub}>Enter the email address on your account and we'll send you a link to reset your password.</p>
                <label style={styles.label}>Email Address</label>
                <div style={styles.inputWrap}>
                  <Mail size={15} color="#94A3B8" style={styles.inputIcon} />
                  <input
                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    className="auth-input" style={styles.input} placeholder="you@example.com"
                  />
                </div>
                <button type="submit" disabled={sendingReset} className="auth-submit" style={{ ...styles.submit, opacity: sendingReset ? .75 : 1 }}>
                  {sendingReset ? "Sending..." : "Send reset link"}
                </button>
                <div style={styles.switchRow}>
                  <span className="auth-switch" style={styles.switchLink} onClick={() => setMode("signin")}>Back to sign in</span>
                </div>
              </>
            )}
          </>
        )}

        {mode === "recovery" && (
          <>
            <h1 style={styles.h1}>Choose a new password</h1>
            <p style={styles.sub}>You followed a password reset link. Set a new password for your account below.</p>

            <label style={styles.label}>New Password</label>
            <div style={styles.inputWrap}>
              <Lock size={15} color="#94A3B8" style={styles.inputIcon} />
              <input
                type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className="auth-input" style={styles.input} placeholder="At least 8 characters"
              />
            </div>

            <label style={{ ...styles.label, marginTop: 14 }}>Confirm New Password</label>
            <div style={styles.inputWrap}>
              <Lock size={15} color="#94A3B8" style={styles.inputIcon} />
              <input
                type="password" required value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)}
                className="auth-input" style={styles.input} placeholder="••••••••"
              />
            </div>

            {resetError && <div style={styles.errorBox}>{resetError}</div>}

            <button type="submit" disabled={resettingPassword} className="auth-submit" style={{ ...styles.submit, opacity: resettingPassword ? .75 : 1 }}>
              {resettingPassword ? "Updating..." : "Update password"}
            </button>
          </>
        )}

        {(mode === "signin" || mode === "signup") && (
          <>
            <h1 style={styles.h1}>{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
            <p style={styles.sub}>
              {mode === "signin" ? "Sign in with your email and password." : "Join Train AI to start your workforce learning path."}
            </p>

            {mode === "signup" && (
              <div style={{ marginBottom: 18 }}>
                <div style={styles.label}>Choose account type</div>
                <div
                  className={`role-picker-card ${accountType === "organization" ? "active" : ""}`}
                  onClick={() => setAccountType("organization")}
                  style={{
                    marginTop: 8, padding: "12px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#FFFFFF",
                    cursor: "pointer", display: "flex", flexDirection: "column", gap: 4
                  }}
                >
                  <div className="role-picker-header" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Building2 size={15} color={accountType === "organization" ? "#4F46E5" : "#64748B"} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Organization</span>
                    <span className="role-picker-badge" style={{ fontSize: 10, fontWeight: 700, color: "#4F46E5", background: "#EEF2FF", padding: "1px 6px", borderRadius: 4, marginLeft: "auto", flexShrink: 0 }}>RECOMMENDED</span>
                  </div>
                  <span style={{ fontSize: 11.5, color: "#64748B", lineHeight: 1.4 }}>
                    Workforce readiness, team cohorts, and org-wide reporting. You become the organization's admin.
                  </span>
                </div>

                <div
                  className={`role-picker-card ${accountType === "learner" ? "active" : ""}`}
                  onClick={() => setAccountType("learner")}
                  style={{
                    marginTop: 8, padding: "12px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#FFFFFF",
                    cursor: "pointer", display: "flex", flexDirection: "column", gap: 4
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <User size={15} color={accountType === "learner" ? "#4F46E5" : "#64748B"} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Individual learner</span>
                  </div>
                  <span style={{ fontSize: 11.5, color: "#64748B", lineHeight: 1.4 }}>Access courses, AI quizzes, and community independently.</span>
                </div>

                {accountType === "organization" && (
                  <div style={{ marginTop: 12 }}>
                    <label style={styles.label}>Organization name</label>
                    <div style={styles.inputWrap}>
                      <Building2 size={15} color="#94A3B8" style={styles.inputIcon} />
                      <input
                        type="text" value={orgName}
                        onChange={(e) => { setOrgName(e.target.value); if (orgError) setOrgError(""); }}
                        className="auth-input" style={styles.input} placeholder="Acme Corporation"
                      />
                    </div>
                    {orgError && <div style={{ ...styles.breachBox, marginTop: 8 }}><ShieldAlert size={14} style={{ flexShrink: 0, marginTop: 1 }} /><span>{orgError}</span></div>}
                  </div>
                )}

                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 10, display: "flex", alignItems: "center", gap: 5 }}>
                  <ShieldCheck size={13} color="#94A3B8" /> Admin access is granted by your organisation or the platform team.
                </div>
              </div>
            )}

            <label style={styles.label}>Email Address</label>
            <div style={styles.inputWrap}>
              <Mail size={15} color="#94A3B8" style={styles.inputIcon} />
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="auth-input" style={styles.input} placeholder="you@example.com"
              />
            </div>

            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 14 }}>
              <label style={styles.label}>Password</label>
              {mode === "signin" && (
                <span className="auth-switch" style={{ ...styles.switchLink, fontSize: 12 }} onClick={() => setMode("forgot")}>Forgot password?</span>
              )}
            </div>
            <div style={styles.inputWrap}>
              <Lock size={15} color="#94A3B8" style={styles.inputIcon} />
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
                <>{mode === "signin" ? "Sign in" : "Create Account"} <ArrowRight size={15} /></>
              )}
            </button>

            <div style={styles.switchRow}>
              {mode === "signin" ? (
                <>Don't have an account? <span className="auth-switch" style={styles.switchLink} onClick={() => { setMode("signup"); setBreachWarning(false); }}>Sign up</span></>
              ) : (
                <>Already have an account? <span className="auth-switch" style={styles.switchLink} onClick={() => { setMode("signin"); setBreachWarning(false); }}>Sign in</span></>
              )}
            </div>
          </>
        )}
      </form>
    </div>
  );
}

const styles = {
  outer: {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "#F8FAFC", fontFamily: "var(--font-sans, 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)", padding: 20,
  },
  card: {
    width: "100%", maxWidth: 400, background: "#FFFFFF", borderRadius: 10, padding: "32px 28px",
    border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(15,23,42,0.04), 0 6px 18px -3px rgba(15,23,42,0.03)",
  },
  h1: { fontSize: 20, fontWeight: 800, margin: "0 0 4px", color: "#0F172A", letterSpacing: "-0.02em" },
  sub: { fontSize: 13, color: "#64748B", margin: "0 0 20px", lineHeight: 1.5 },
  label: { fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: ".06em" },
  inputWrap: { position: "relative", marginTop: 6 },
  inputIcon: { position: "absolute", left: 12, top: 12 },
  input: {
    width: "100%", padding: "10px 12px 10px 36px", borderRadius: 8, border: "1px solid #E2E8F0",
    fontSize: 13.5, color: "#0F172A", boxSizing: "border-box", transition: "border-color .15s ease, box-shadow .15s ease",
    background: "#FFFFFF"
  },
  errorBox: {
    background: "#FEF2F2", color: "#EF4444", fontSize: 12.5, padding: "10px 12px", borderRadius: 8,
    marginTop: 12, lineHeight: 1.4, fontWeight: 600, border: "1px solid #FECACA",
  },
  breachChecking: { fontSize: 11.5, color: "#94A3B8", marginTop: 8 },
  breachBox: {
    display: "flex", gap: 8, background: "#FFFBEB", color: "#B45309", fontSize: 12,
    padding: "10px 12px", borderRadius: 8, marginTop: 8, lineHeight: 1.4, fontWeight: 500, border: "1px solid #FDE68A",
  },
  submit: {
    width: "100%", marginTop: 20, border: "none", borderRadius: 8, padding: "11px 16px", fontWeight: 700, fontSize: 14,
    color: "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    background: "#4F46E5", transition: "background-color .15s ease",
  },
  switchRow: { textAlign: "center", marginTop: 16, fontSize: 13, color: "#64748B" },
  switchLink: { color: "#4F46E5", fontWeight: 700, cursor: "pointer" },
};
