import React, { useState, useEffect } from "react";
import { ArrowRight, Mail, Lock, User, ShieldCheck, ShieldAlert, Building2, CheckCircle2, Eye, EyeOff, AlertCircle, Clock, KeyRound, HelpCircle, RefreshCw, Gift, CreditCard, Sparkles, Check, X } from "lucide-react";
import { checkPasswordBreached } from "../../lib/api/mfa.js";
import {
  registerOrganization,
  validateOrgPromoCode,
  joinDefaultOrganization,
  attributeReferralSignupIfPending,
  joinOrganizationByReferral,
  getPendingOrganizationJoin,
  fetchOrganizationPublicInfo
} from "../../lib/api/organizations.js";
import { getRateLimitStatus, formatLockoutTime, MAX_PASSWORD_TRIALS } from "../../lib/authRateLimiter.js";

export default function AuthPage({
  onSignIn, onSignUp, authError, initialEmail = "",
  onForgotPassword, onVerifyRecoveryOtp, recoveryMode = false, onCompletePasswordReset,
  onGoHome, orgParam = ""
}) {
  const [mode, setMode] = useState("signin");

  useEffect(() => {
    if (recoveryMode) setMode("recovery");
  }, [recoveryMode]);

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accountType, setAccountType] = useState("organization");
  const [orgName, setOrgName] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoValidation, setPromoValidation] = useState(null);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [testPaymentProcessing, setTestPaymentProcessing] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [orgError, setOrgError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [breachWarning, setBreachWarning] = useState(false);
  const [checkingBreach, setCheckingBreach] = useState(false);

  // Forgot password & OTP verification states
  const [sendingReset, setSendingReset] = useState(false);
  const [forgotResult, setForgotResult] = useState(null);
  const [forgotError, setForgotError] = useState("");
  const [recoveryOtpInput, setRecoveryOtpInput] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [showOtpManualInput, setShowOtpManualInput] = useState(false);

  // Set new password (recovery mode) states
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [recoveryLinkError, setRecoveryLinkError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
    const description = params.get("error_description") || hashParams.get("error_description");
    const code = params.get("error_code") || hashParams.get("error_code");
    if (description || code) {
      setRecoveryLinkError(
        decodeURIComponent((description || "This password reset link is invalid or has expired.").replace(/\+/g, " "))
      );
    }
  }, []);

  // Organization Referral & Join Link target info
  const [targetOrgTarget, setTargetOrgTarget] = useState(() => {
    return orgParam || getPendingOrganizationJoin()?.orgIdOrSlug || "";
  });
  const [orgInfo, setOrgInfo] = useState(null);

  useEffect(() => {
    const target = orgParam || getPendingOrganizationJoin()?.orgIdOrSlug || "";
    setTargetOrgTarget(target);
    if (target) {
      fetchOrganizationPublicInfo(target).then((info) => {
        if (info) setOrgInfo(info);
      }).catch(() => {});
    }
  }, [orgParam]);

  // Rate Limiting on Password attempts
  const [rateLimit, setRateLimit] = useState(() => getRateLimitStatus(initialEmail));

  // Sync rate limit whenever email input changes
  useEffect(() => {
    if (email) {
      setRateLimit(getRateLimitStatus(email));
    }
  }, [email]);

  // Live countdown timer for active lockout
  useEffect(() => {
    if (!rateLimit.isLocked) return;
    const interval = setInterval(() => {
      const current = getRateLimitStatus(email);
      setRateLimit(current);
      if (!current.isLocked) {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [rateLimit.isLocked, email]);

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
    if (e && e.preventDefault) e.preventDefault();
    if (!email.trim() || sendingReset) return;
    setForgotError("");
    setForgotResult(null);
    setOtpError("");
    setSendingReset(true);
    try {
      const result = await onForgotPassword?.(email.trim());
      if (result?.notFound) {
        setForgotError(result.error || "No account found with this email address. Please check your spelling or create an account.");
      } else if (result?.success) {
        setForgotResult(result);
        if (result.otp) {
          setRecoveryOtpInput(result.otp);
        }
      } else {
        setForgotError(result?.error || "Could not process password reset. Please try again or contact support at info@trainailtd.com.");
      }
    } catch (err) {
      setForgotError(err?.message || "An unexpected error occurred. Please try again.");
    } finally {
      setSendingReset(false);
    }
  }

  async function handleVerifyRecoveryOtp(tokenToVerify) {
    const token = (tokenToVerify || recoveryOtpInput || "").trim();
    if (!token) {
      setOtpError("Please enter your verification code.");
      return;
    }
    setOtpError("");
    setVerifyingOtp(true);
    try {
      const res = await onVerifyRecoveryOtp?.(email.trim(), token);
      if (res?.success) {
        setMode("recovery");
      } else {
        setOtpError(res?.error || "Invalid or expired recovery code. Please check the code and try again.");
      }
    } catch (err) {
      setOtpError(err?.message || "Verification failed. Please try again.");
    } finally {
      setVerifyingOtp(false);
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
      setResetError("Passwords do not match.");
      return;
    }
    setResettingPassword(true);
    try {
      const result = await onCompletePasswordReset?.(newPassword);
      if (!result?.success) {
        setResetError(result?.error || "Could not update your password. The reset link or code may have expired. Please request a new one.");
      } else {
        setResetSuccess(true);
        setTimeout(() => {
          window.location.replace(window.location.pathname);
        }, 1800);
      }
    } finally {
      setResettingPassword(false);
    }
  }

  async function handleCheckPromoCode(codeVal) {
    const trimmed = (codeVal || "").trim();
    setPromoCode(trimmed);
    if (!trimmed) {
      setPromoValidation(null);
      return;
    }
    setValidatingPromo(true);
    try {
      const res = await validateOrgPromoCode(trimmed);
      setPromoValidation(res);
    } catch {
      setPromoValidation({ valid: false, error: "Could not validate code." });
    } finally {
      setValidatingPromo(false);
    }
  }

  async function executeOrgSignup(paymentReference = null, paymentProvider = "test_flow") {
    setSubmitting(true);
    setOrgError("");
    try {
      const signupRole = "learner";
      const result = await onSignUp(email, password, signupRole, "organization");

      if (result?.error) {
        setOrgError(result.error);
        setSubmitting(false);
        return false;
      }

      if (result?.data?.user?.id) {
        attributeReferralSignupIfPending(result.data.user.id).catch(() => {});
      }

      const orgResult = await registerOrganization(orgName, {
        promoCode: promoValidation?.valid ? promoCode : "",
        paymentRef: paymentReference || (promoValidation?.valid ? null : `TEST_PAY_${Date.now()}`),
        paymentProvider: promoValidation?.valid ? "promo_code" : paymentProvider,
      });

      if (!orgResult.success) {
        setOrgError(orgResult.error || "Account created, but we could not register your organization. You can complete this from Settings.");
        setSubmitting(false);
        return false;
      } else {
        window.location.reload();
        return true;
      }
    } catch (err) {
      setOrgError(err?.message || "An error occurred during organization creation.");
      setSubmitting(false);
      return false;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    if (mode === "signup" && accountType === "organization" && orgName.trim().length < 2) {
      setOrgError("Enter your organization name to continue.");
      return;
    }
    setOrgError("");

    if (mode === "signin") {
      setSubmitting(true);
      const currentLimit = getRateLimitStatus(email);
      if (currentLimit.isLocked) {
        setRateLimit(currentLimit);
        setSubmitting(false);
        return;
      }
      const signInRes = await onSignIn(email, password);
      setRateLimit(getRateLimitStatus(email));
      if (!signInRes?.error && targetOrgTarget) {
        await joinOrganizationByReferral(targetOrgTarget, "learner").catch(() => {});
      }
      setSubmitting(false);
    } else {
      // Sign-up branch
      if (accountType === "organization") {
        // If valid foundation code, proceed immediately with waived payment
        if (promoValidation?.valid) {
          await executeOrgSignup();
        } else {
          // If no foundation code, prompt mandatory test payment flow
          setShowPaymentModal(true);
        }
      } else {
        // Individual learner sign-up
        setSubmitting(true);
        const result = await onSignUp(email, password, "learner", "learner");
        if (!result?.error && result?.data?.user?.id) {
          attributeReferralSignupIfPending(result.data.user.id).catch(() => {});
        }
        if (!result?.error) {
          if (targetOrgTarget) {
            await joinOrganizationByReferral(targetOrgTarget, "learner").catch(() => {});
          } else {
            joinDefaultOrganization().catch(() => {});
          }
        }
        setSubmitting(false);
      }
    }
  }

  const isEmailNotFound = authError && (authError.includes("No account found") || authError.includes("create a new account"));

  return (
    <div style={styles.outer}>
      <style>{`
        @keyframes authFadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .auth-card { animation: authFadeUp .2s ease; }
        .auth-input {
          background-color: #FFFFFF !important;
          color: #0F172A !important;
        }
        .auth-input:focus {
          outline: none;
          border-color: #2563EB !important;
          box-shadow: 0 0 0 2px rgba(37,99,235,.15);
        }
        .auth-input:-webkit-autofill,
        .auth-input:-webkit-autofill:hover, 
        .auth-input:-webkit-autofill:focus, 
        .auth-input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px #FFFFFF inset !important;
          box-shadow: 0 0 0 1000px #FFFFFF inset !important;
          -webkit-text-fill-color: #0F172A !important;
          caret-color: #0F172A !important;
          background-color: #FFFFFF !important;
          color: #0F172A !important;
        }
        .auth-submit:hover { background-color: #1D4ED8 !important; }
        .auth-switch:hover { text-decoration: underline; }
        .role-picker-card { transition: border-color .15s ease, background-color .15s ease; }
        .role-picker-card:hover { border-color: #CBD5E1; }
        .role-picker-card.active { border-color: #2563EB !important; background: #EFF6FF !important; }
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
            &larr; Back to website
          </span>
        </div>

        {targetOrgTarget && (
          <div style={{
            padding: "12px 14px",
            background: "#EFF6FF",
            border: "1.5px solid #BFDBFE",
            borderRadius: 10,
            marginBottom: 18,
            display: "flex",
            alignItems: "center",
            gap: 10
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "#DBEAFE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}>
              <Building2 size={18} color="#2563EB" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: "#1E40AF", fontWeight: 700, lineHeight: 1.3 }}>
                Joining {orgInfo?.name || targetOrgTarget}
              </div>
              <div style={{ fontSize: 11.5, color: "#3B82F6", lineHeight: 1.35, marginTop: 2 }}>
                {mode === "signup" ? "Sign up to automatically access your team's assigned courses and cohorts." : "Sign in to access your organization workspace."}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* MODE: FORGOT PASSWORD                                            */}
        {/* ================================================================ */}
        {mode === "forgot" && (
          <>
            <h1 style={styles.h1}>Reset your password</h1>

            {/* Error box when account does not exist or general failure */}
            {forgotError && (
              <div style={styles.errorBox}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <AlertCircle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{forgotError}</div>
                    {forgotError.includes("No account found") && (
                      <div style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          onClick={() => { setMode("signup"); setForgotError(""); }}
                          style={{
                            background: "#2563EB",
                            color: "#FFFFFF",
                            border: "none",
                            borderRadius: 6,
                            padding: "6px 12px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4
                          }}
                        >
                          <span>Sign up for a new account</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* State: Reset requested successfully */}
            {forgotResult && (
              <div style={{ marginTop: 12 }}>
                {forgotResult.emailSent && (
                  <div style={{ padding: "14px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <CheckCircle2 size={18} color="#16A34A" style={{ flexShrink: 0, marginTop: 1 }} />
                      <div style={{ fontSize: 12.5, color: "#166534", lineHeight: 1.45 }}>
                        <strong>Email Sent:</strong> We have dispatched a password reset link to <strong>{forgotResult.email}</strong>.
                        <div style={{ marginTop: 4, fontSize: 11.5, color: "#15803D" }}>
                          &bull; Please check your Inbox and Spam/Junk folders.<br />
                          &bull; Click the link in the email or enter the 6-digit code below.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Instant Recovery Action Link or OTP Code if generated */}
                {forgotResult.actionLink && (
                  <div style={{ marginBottom: 14 }}>
                    <a
                      href={forgotResult.actionLink}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        width: "100%",
                        padding: "10px 14px",
                        background: "#2563EB",
                        color: "#FFFFFF",
                        textDecoration: "none",
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: 13,
                        boxSizing: "border-box"
                      }}
                    >
                      <span>Open Reset Link Directly</span>
                      <ArrowRight size={14} />
                    </a>
                  </div>
                )}

                {forgotResult.rateLimited && (
                  <div style={{ padding: "14px", background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8, marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <Clock size={18} color="#C2410C" style={{ flexShrink: 0, marginTop: 1 }} />
                      <div style={{ fontSize: 12.5, color: "#9A3412", lineHeight: 1.45 }}>
                        <strong>Too many reset requests.</strong> For your security, wait 15 minutes before trying again. If an earlier reset email arrived, you can still use its link while it remains valid.
                      </div>
                    </div>
                  </div>
                )}

                {/* Instant recovery is only available when the server actually
                    returned a one-time code. Never claim that a code exists
                    merely because the mail provider is rate-limited. */}
                {forgotResult.otp && (
                  <div style={{ padding: "14px", background: "#EFF6FF", border: "1.5px solid #BFDBFE", borderRadius: 8, marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                      <KeyRound size={18} color="#2563EB" style={{ flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1E40AF" }}>
                          {forgotResult.rateLimited ? "Instant Recovery Code Ready" : "One-Time Recovery Code"}
                        </div>
                        <div style={{ fontSize: 12, color: "#3B82F6", lineHeight: 1.4, marginTop: 2 }}>
                          {forgotResult.rateLimited
                            ? "Mail provider rate limit active. Use your instant verification code below to set a new password right away:"
                            : "You can reset your password immediately with this one-time code:"}
                        </div>
                      </div>
                    </div>

                    {forgotResult.otp && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "10px", background: "#FFFFFF", borderRadius: 6, border: "1px dashed #93C5FD", marginBottom: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".05em" }}>Your Code:</span>
                        <span style={{ fontSize: 20, fontWeight: 900, color: "#1E3A8A", letterSpacing: "3px", fontFamily: "monospace" }}>
                          {forgotResult.otp}
                        </span>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={verifyingOtp}
                      onClick={() => handleVerifyRecoveryOtp(forgotResult.otp)}
                      style={{
                        width: "100%",
                        padding: "9px 14px",
                        background: "#2563EB",
                        color: "#FFFFFF",
                        border: "none",
                        borderRadius: 6,
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6
                      }}
                    >
                      {verifyingOtp ? "Verifying..." : "Verify Code & Set New Password"}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                )}

                {/* Direct 6 to 8 digit verification code entry */}
                <div style={{ marginTop: 12, padding: "14px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8 }}>
                  <label style={styles.label}>Enter 6 to 8 Digit Recovery Code</label>
                  <div style={{ fontSize: 11.5, color: "#64748B", marginBottom: 8 }}>
                    If you received a recovery code in your email, paste or type it below to proceed:
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      value={recoveryOtpInput}
                      onChange={(e) => { setRecoveryOtpInput(e.target.value); setOtpError(""); }}
                      placeholder="12345678"
                      className="auth-input"
                      style={{ ...styles.input, paddingLeft: 12, textAlign: "center", letterSpacing: "2px", fontWeight: 700 }}
                    />
                    <button
                      type="button"
                      disabled={verifyingOtp || !recoveryOtpInput.trim()}
                      onClick={() => handleVerifyRecoveryOtp()}
                      style={{
                        padding: "0 16px",
                        background: "#2563EB",
                        color: "#FFFFFF",
                        border: "none",
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {verifyingOtp ? "Verifying..." : "Verify"}
                    </button>
                  </div>
                  {otpError && (
                    <div style={{ color: "#DC2626", fontSize: 11.5, marginTop: 6, fontWeight: 600 }}>
                      {otpError}
                    </div>
                  )}
                </div>

                {/* Resend button */}
                <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
                  <button
                    type="button"
                    disabled={sendingReset}
                    onClick={handleForgotPasswordSubmit}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#2563EB",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4
                    }}
                  >
                    <RefreshCw size={12} className={sendingReset ? "spin" : ""} />
                    <span>{sendingReset ? "Resending email..." : "Resend reset email"}</span>
                  </button>
                </div>

                {/* Support Fallback Link */}
                <div style={{ marginTop: 14, textAlign: "center", fontSize: 11.5, color: "#64748B" }}>
                  Need direct assistance? Contact our team at <a href={`mailto:info@trainailtd.com?subject=Password%20Reset%20Assistance%20for%20${encodeURIComponent(email)}`} style={{ color: "#2563EB", fontWeight: 700 }}>info@trainailtd.com</a>
                </div>

                <div style={styles.switchRow}>
                  <span className="auth-switch" style={styles.switchLink} onClick={() => { setMode("signin"); setForgotResult(null); }}>
                    Back to sign in
                  </span>
                </div>
              </div>
            )}

            {/* Initial Forgot Password Form */}
            {!forgotResult && (
              <>
                <p style={styles.sub}>
                  Enter the email address registered on your account. We will send you a reset link or provide an instant recovery code.
                </p>
                <label style={styles.label}>Email Address</label>
                <div style={styles.inputWrap}>
                  <Mail size={15} color="#94A3B8" style={styles.inputIcon} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setForgotError(""); }}
                    className="auth-input"
                    style={styles.input}
                    placeholder="you@example.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={sendingReset}
                  className="auth-submit"
                  style={{ ...styles.submit, opacity: sendingReset ? 0.75 : 1 }}
                >
                  {sendingReset ? "Sending reset link..." : "Send reset link"}
                </button>
                <div style={styles.switchRow}>
                  <span className="auth-switch" style={styles.switchLink} onClick={() => setMode("signin")}>
                    Back to sign in
                  </span>
                </div>
              </>
            )}
          </>
        )}

        {/* ================================================================ */}
        {/* MODE: SET NEW PASSWORD (RECOVERY MODE)                           */}
        {/* ================================================================ */}
        {mode === "recovery" && (
          <>
            <h1 style={styles.h1}>Choose a new password</h1>
            {recoveryLinkError ? (
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                <AlertCircle size={40} color="#DC2626" style={{ margin: "0 auto 12px" }} />
                <p style={{ ...styles.sub, color: "#991B1B", fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
                  This reset link cannot be used
                </p>
                <p style={{ ...styles.sub, fontSize: 12.5 }}>
                  {recoveryLinkError} Password reset links can only be used once and may expire.
                </p>
                <button
                  type="button"
                  className="auth-submit"
                  style={styles.submit}
                  onClick={() => { setRecoveryLinkError(""); setMode("forgot"); }}
                >
                  Request a new reset link
                </button>
                <div style={styles.switchRow}>
                  <span className="auth-switch" style={styles.switchLink} onClick={() => setMode("signin")}>Back to sign in</span>
                </div>
              </div>
            ) : resetSuccess ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <CheckCircle2 size={40} color="#16A34A" style={{ margin: "0 auto 12px" }} />
                <p style={{ ...styles.sub, color: "#16A34A", fontWeight: 700, fontSize: 14 }}>
                  Password updated successfully!
                </p>
                <p style={{ ...styles.sub, fontSize: 12.5 }}>
                  Redirecting to your dashboard...
                </p>
              </div>
            ) : (
              <>
                <p style={styles.sub}>Your identity has been verified. Set a new password for your account below.</p>

                <label style={styles.label}>New Password</label>
                <div style={styles.inputWrap}>
                  <Lock size={15} color="#94A3B8" style={styles.inputIcon} />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="auth-input"
                    style={{ ...styles.input, paddingRight: 40 }}
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={styles.eyeBtn}
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                    title={showNewPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <label style={{ ...styles.label, marginTop: 14 }}>Confirm New Password</label>
                <div style={styles.inputWrap}>
                  <Lock size={15} color="#94A3B8" style={styles.inputIcon} />
                  <input
                    type={showNewPasswordConfirm ? "text" : "password"}
                    required
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    className="auth-input"
                    style={{ ...styles.input, paddingRight: 40 }}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPasswordConfirm(!showNewPasswordConfirm)}
                    style={styles.eyeBtn}
                    aria-label={showNewPasswordConfirm ? "Hide password" : "Show password"}
                    title={showNewPasswordConfirm ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showNewPasswordConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {resetError && (
                  <div style={styles.errorBox}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <AlertCircle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
                      <div style={{ flex: 1 }}>
                        <span>{resetError}</span>
                        {(resetError.toLowerCase().includes("session") || resetError.toLowerCase().includes("expired")) && (
                          <button
                            type="button"
                            onClick={() => { setResetError(""); setMode("forgot"); }}
                            style={{ ...styles.secondaryButton, width: "100%", marginTop: 10, borderColor: "#FCA5A5", color: "#B91C1C" }}
                          >
                            <RefreshCw size={14} /> Request a new reset email
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={resettingPassword}
                  className="auth-submit"
                  style={{ ...styles.submit, opacity: resettingPassword ? 0.75 : 1 }}
                >
                  {resettingPassword ? "Updating..." : "Update password"}
                </button>
                <div style={styles.switchRow}>
                  <span className="auth-switch" style={styles.switchLink} onClick={() => { setMode("signin"); window.location.replace(window.location.pathname); }}>
                    Back to sign in
                  </span>
                </div>
              </>
            )}
          </>
        )}

        {/* ================================================================ */}
        {/* MODE: SIGN IN & SIGN UP                                          */}
        {/* ================================================================ */}
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
                    <Building2 size={15} color={accountType === "organization" ? "#2563EB" : "#64748B"} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Organization</span>
                    <span className="role-picker-badge" style={{ fontSize: 10, fontWeight: 700, color: "#2563EB", background: "#EFF6FF", padding: "1px 6px", borderRadius: 4, marginLeft: "auto", flexShrink: 0 }}>RECOMMENDED</span>
                  </div>
                  <span style={{ fontSize: 11.5, color: "#64748B", lineHeight: 1.4 }}>
                    Workforce readiness, team cohorts, and org-wide reporting. You become the organization admin.
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
                    <User size={15} color={accountType === "learner" ? "#2563EB" : "#64748B"} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Individual learner</span>
                  </div>
                  <span style={{ fontSize: 11.5, color: "#64748B", lineHeight: 1.4 }}>Access courses, AI quizzes, and community independently.</span>
                </div>

                {accountType === "organization" && (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={styles.label}>Organization name</label>
                      <div style={styles.inputWrap}>
                        <Building2 size={15} color="#94A3B8" style={styles.inputIcon} />
                        <input
                          type="text"
                          value={orgName}
                          onChange={(e) => { setOrgName(e.target.value); if (orgError) setOrgError(""); }}
                          className="auth-input"
                          style={styles.input}
                          placeholder="Acme Corporation or Foundation"
                        />
                      </div>
                      {orgError && <div style={{ ...styles.breachBox, marginTop: 8 }}><ShieldAlert size={14} style={{ flexShrink: 0, marginTop: 1 }} /><span>{orgError}</span></div>}
                    </div>

                    {/* Foundation / Partner Promo Code (Optional) */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <label style={styles.label}>Foundation / Promo Code <span style={{ color: "#94A3B8", textTransform: "none", fontWeight: 500 }}>(Optional)</span></label>
                        {validatingPromo && <span style={{ fontSize: 11, color: "#2563EB", fontWeight: 700 }}>Checking code...</span>}
                      </div>
                      <div style={styles.inputWrap}>
                        <Gift size={15} color={promoValidation?.valid ? "#10B981" : "#94A3B8"} style={styles.inputIcon} />
                        <input
                          type="text"
                          value={promoCode}
                          onChange={(e) => handleCheckPromoCode(e.target.value)}
                          onBlur={(e) => handleCheckPromoCode(e.target.value)}
                          className="auth-input"
                          style={{
                            ...styles.input,
                            borderColor: promoValidation?.valid ? "#10B981" : promoValidation?.valid === false ? "#F87171" : "#E2E8F0",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            fontWeight: 700
                          }}
                          placeholder="e.g. SARA-FOUNDATION or FOUNDATION-FREE"
                        />
                      </div>

                      {/* Promo Verification Result */}
                      {promoValidation?.valid && (
                        <div style={{
                          marginTop: 8,
                          padding: "8px 12px",
                          borderRadius: 6,
                          background: "#ECFDF5",
                          border: "1px solid #A7F3D0",
                          color: "#065F46",
                          fontSize: 12,
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8
                        }}>
                          <Sparkles size={15} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} />
                          <div>
                            <div style={{ fontWeight: 800, color: "#047857" }}>{promoValidation.name || "Foundation Grant Verified"}</div>
                            <div style={{ fontSize: 11, color: "#065F46", marginTop: 2 }}>
                              ✓ Payment Waived • Free Basic Plan • {promoValidation.grant_ai_credits || 1000} AI Credits • {promoValidation.grant_seats || 50} Free Seats
                            </div>
                          </div>
                        </div>
                      )}

                      {promoValidation && !promoValidation.valid && promoCode.trim() && (
                        <div style={{ fontSize: 11.5, color: "#DC2626", marginTop: 5, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                          <X size={13} /> {promoValidation.error || "Invalid promo code"}
                        </div>
                      )}

                      <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                        Foundations &amp; NGOs with a code bypass subscription fees and unlock free credits.
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 10, display: "flex", alignItems: "center", gap: 5 }}>
                  <ShieldCheck size={13} color="#94A3B8" /> Admin access is granted by your organisation or the platform team.
                </div>
              </div>
            )}

            <label style={styles.label}>{mode === "signin" ? "Email or Username" : "Email Address"}</label>
            <div style={styles.inputWrap}>
              <Mail size={15} color="#94A3B8" style={styles.inputIcon} />
              <input
                type={mode === "signin" ? "text" : "email"}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
                style={styles.input}
                placeholder={mode === "signin" ? "you@example.com or username" : "you@example.com"}
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
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                onBlur={mode === "signup" ? handlePasswordBlur : undefined}
                disabled={mode === "signin" && rateLimit.isLocked}
                className="auth-input"
                style={{
                  ...styles.input,
                  paddingRight: 40,
                  backgroundColor: (mode === "signin" && rateLimit.isLocked) ? "#F8FAFC" : "#FFFFFF",
                  cursor: (mode === "signin" && rateLimit.isLocked) ? "not-allowed" : "text"
                }}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={mode === "signin" && rateLimit.isLocked}
                style={styles.eyeBtn}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {mode === "signup" && checkingBreach && (
              <div style={styles.breachChecking}>Checking password against known breaches...</div>
            )}
            {mode === "signup" && breachWarning && (
              <div style={styles.breachBox}>
                <ShieldAlert size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>This password has appeared in a known data breach. Please choose a more secure password.</span>
              </div>
            )}

            {/* Brute-force Protection / 10 Trials Lockout Banner */}
            {mode === "signin" && rateLimit.isLocked && (
              <div style={styles.lockedBox}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <ShieldAlert size={18} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#991B1B", marginBottom: 3 }}>
                      Account Temporarily Locked
                    </div>
                    <div style={{ fontSize: 12, color: "#B91C1C", lineHeight: 1.45 }}>
                      Too many failed password trials (10/10). To safeguard your account, sign-in attempts have been suspended.
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12, fontWeight: 700, color: "#DC2626" }}>
                      <Clock size={13} />
                      <span>Cooldown remaining: {formatLockoutTime(rateLimit.remainingMs)}</span>
                    </div>
                    <div style={{ marginTop: 8, borderTop: "1px solid #FECACA", paddingTop: 8, fontSize: 12 }}>
                      <span
                        onClick={() => { setMode("forgot"); }}
                        style={{ color: "#2563EB", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}
                      >
                        Forgot your password? Click here to reset it &rarr;
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Non-existent Account Helper Alert */}
            {mode === "signin" && isEmailNotFound && (
              <div style={styles.errorBox}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <AlertCircle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{authError}</div>
                    <div style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        onClick={() => { setMode("signup"); }}
                        style={{
                          background: "#2563EB",
                          color: "#FFFFFF",
                          border: "none",
                          borderRadius: 6,
                          padding: "6px 12px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4
                        }}
                      >
                        <span>Create account with {email}</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Standard Error State (when not locked and not emailNotFound) */}
            {authError && !isEmailNotFound && (!rateLimit.isLocked || mode !== "signin") && (
              <div style={styles.errorBox}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <AlertCircle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div>{authError}</div>
                    {mode === "signin" && rateLimit.attempts > 0 && !rateLimit.isLocked && (
                      <div style={{ fontSize: 11.5, color: "#B91C1C", marginTop: 4, fontWeight: 600 }}>
                        Trial {rateLimit.attempts} of {MAX_PASSWORD_TRIALS} failed. (Account locks after {MAX_PASSWORD_TRIALS} failed trials).
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || (mode === "signin" && rateLimit.isLocked)}
              className="auth-submit"
              style={{
                ...styles.submit,
                opacity: (submitting || (mode === "signin" && rateLimit.isLocked)) ? 0.7 : 1,
                background: (mode === "signin" && rateLimit.isLocked) ? "#94A3B8" : "#2563EB",
                cursor: (mode === "signin" && rateLimit.isLocked) ? "not-allowed" : "pointer"
              }}
            >
              {submitting
                ? "Processing..."
                : (mode === "signin" && rateLimit.isLocked)
                  ? `Locked (${formatLockoutTime(rateLimit.remainingMs)})`
                  : (
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

        {/* Test Payment Activation Modal for Paid Organizations */}
        {showPaymentModal && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20
          }}>
            <div style={{
              background: "#FFFFFF",
              borderRadius: 12,
              width: "100%",
              maxWidth: 440,
              padding: "24px 22px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              border: "1px solid #E2E8F0"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CreditCard size={18} color="#2563EB" />
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>Activate Organization Plan</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748B" }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                padding: "12px 14px",
                marginBottom: 16
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>Starter Plan (Test Mode)</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#2563EB" }}>
                    {selectedCurrency === "USD" ? "$19.00 / mo" : "₦15,000 / mo"}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 4, lineHeight: 1.4 }}>
                  Includes <strong>25 Team Seats</strong>, <strong>200 AI Credits</strong>, Cohort tracking, and unlimited LMS courses.
                </div>
              </div>

              {/* Currency Toggle */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {["USD", "NGN"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedCurrency(c)}
                    style={{
                      flex: 1,
                      padding: "6px 10px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      border: selectedCurrency === c ? "1.5px solid #2563EB" : "1px solid #E2E8F0",
                      background: selectedCurrency === c ? "#EFF6FF" : "#FFFFFF",
                      color: selectedCurrency === c ? "#1E40AF" : "#64748B",
                      cursor: "pointer"
                    }}
                  >
                    {c === "USD" ? "USD ($19)" : "NGN (₦15,000)"}
                  </button>
                ))}
              </div>

              {/* Simulated Test Card Notice */}
              <div style={{
                background: "#EFF6FF",
                border: "1px solid #BFDBFE",
                borderRadius: 8,
                padding: "10px 12px",
                marginBottom: 16,
                fontSize: 12,
                color: "#1E40AF"
              }}>
                <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <Sparkles size={14} color="#2563EB" /> Sandbox Test Payment Flow
                </div>
                <div style={{ fontSize: 11, marginTop: 3, color: "#3B82F6" }}>
                  Test Card pre-filled: <code>4000 0000 0000 0000</code> (No live charge).
                </div>
              </div>

              {/* Alternative Promo Code shortcut inside modal */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: 4 }}>
                  Have a Foundation Code instead?
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SARA-FOUNDATION"
                    style={{
                      flex: 1,
                      padding: "7px 10px",
                      borderRadius: 6,
                      border: "1px solid #CBD5E1",
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "uppercase"
                    }}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      await handleCheckPromoCode(promoCode);
                      if (promoCode.trim().toUpperCase() === "SARA-FOUNDATION" || promoCode.trim().toUpperCase() === "FOUNDATION-FREE") {
                        setShowPaymentModal(false);
                      }
                    }}
                    style={{
                      padding: "7px 12px",
                      borderRadius: 6,
                      background: "#0F172A",
                      color: "#FFF",
                      fontSize: 11,
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer"
                    }}
                  >
                    Apply Code
                  </button>
                </div>
              </div>

              {orgError && (
                <div style={{ ...styles.errorBox, marginBottom: 12 }}>{orgError}</div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#475569",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={testPaymentProcessing}
                  onClick={async () => {
                    setTestPaymentProcessing(true);
                    const success = await executeOrgSignup(`TEST_TXN_${Date.now()}`, selectedCurrency === "NGN" ? "paystack_test" : "stripe_test");
                    if (!success) {
                      setTestPaymentProcessing(false);
                    }
                  }}
                  style={{
                    flex: 2,
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "none",
                    background: "#2563EB",
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#FFFFFF",
                    cursor: testPaymentProcessing ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6
                  }}
                >
                  {testPaymentProcessing ? (
                    <>Processing Test Payment...</>
                  ) : (
                    <>Pay &amp; Activate Org <ArrowRight size={14} /></>
                  )}
                </button>
              </div>
            </div>
          </div>
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
  eyeBtn: {
    position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
    background: "transparent", border: "none", cursor: "pointer", padding: "6px",
    display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8",
    transition: "color .15s ease"
  },
  errorBox: {
    background: "#FEF2F2", color: "#EF4444", fontSize: 12.5, padding: "10px 12px", borderRadius: 8,
    marginTop: 12, lineHeight: 1.4, fontWeight: 600, border: "1px solid #FECACA",
  },
  lockedBox: {
    background: "#FFF1F2", color: "#991B1B", fontSize: 12.5, padding: "12px 14px", borderRadius: 8,
    marginTop: 14, lineHeight: 1.45, border: "1.5px solid #FECDD3",
  },
  breachChecking: { fontSize: 11.5, color: "#94A3B8", marginTop: 8 },
  breachBox: {
    display: "flex", gap: 8, background: "#FFFBEB", color: "#B45309", fontSize: 12,
    padding: "10px 12px", borderRadius: 8, marginTop: 8, lineHeight: 1.4, fontWeight: 500, border: "1px solid #FDE68A",
  },
  submit: {
    width: "100%", marginTop: 20, border: "none", borderRadius: 8, padding: "11px 16px", fontWeight: 700, fontSize: 14,
    color: "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    background: "#2563EB", transition: "background-color .15s ease",
  },
  secondaryButton: {
    minHeight: 38, border: "1px solid #CBD5E1", borderRadius: 8, padding: "8px 10px",
    background: "#FFFFFF", color: "#334155", cursor: "pointer", fontWeight: 700,
    fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
  },
  switchRow: { textAlign: "center", marginTop: 16, fontSize: 13, color: "#64748B" },
  switchLink: { color: "#2563EB", fontWeight: 700, cursor: "pointer" },
};
