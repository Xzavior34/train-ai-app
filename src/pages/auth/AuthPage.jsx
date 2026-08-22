import React, { useState } from "react";
import { ArrowRight, Mail, Lock, User, ShieldCheck, ShieldAlert, Building2 } from "lucide-react";
import { checkPasswordBreached } from "../../lib/api/mfa.js";
import { registerOrganization, joinDefaultOrganization, attributeReferralSignupIfPending } from "../../lib/api/organizations.js";

export default function AuthPage({ onSignIn, onSignUp, authError, initialEmail = "" }) {
  const [mode, setMode] = useState("signin");
  // Prefilled when this screen is reached right after accepting an org
  // invitation (see AcceptInvitationScreen -> App.jsx's onNeedsSignIn) so the
  // user doesn't have to retype the email their invite was sent to.
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  // Three distinct sign-up paths (per the product backlog): "organization"
  // is the primary one and defaults selected; "learner" is the secondary,
  // self-serve individual path; "mentor" applies to instruct. Admin is
  // deliberately not in this list - it is never a sign-up choice, only
  // granted by an existing org admin or the platform team (see the note
  // below the picker).
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

  // Advisory only (matches the reference app's password-breach-check edge
  // function, which itself fails open with breached:false on any upstream
  // error) - never blocks signup, just warns before submit so the user can
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
    if (mode === "signup" && accountType === "organization" && orgName.trim().length < 2) {
      setOrgError("Enter your organization's name to continue.");
      return;
    }
    setOrgError("");
    setSubmitting(true);
    if (mode === "signin") {
      await onSignIn(email, password);
    } else {
      // Organization sign-up creates the account itself as a normal
      // ("learner") account first, then registers the organization - the
      // create_organization_self_serve RPC is what actually promotes this
      // user to that organization's admin (supabase/migrations/
      // 0102_org_self_serve_signup.sql). Mentor/learner sign-up is
      // unchanged from before.
      const signupRole = "learner"; // Manager/Admin/Instructor are always assigned after login via org invitation, never chosen at signup
      const result = await onSignUp(email, password, signupRole, accountType);

      // Attribute this signup to whoever's referral link brought them here
      // (captured earlier on LandingPage, if any) - best-effort, never
      // blocks or affects the signup flow itself either way.
      if (!result?.error && result?.data?.user?.id) {
        attributeReferralSignupIfPending(result.data.user.id).catch(() => {});
      }

      if (accountType === "organization" && !result?.error) {
        const orgResult = await registerOrganization(orgName);
        if (!orgResult.success) {
          // The account exists at this point either way - surface the org
          // registration failure without implying signup itself failed.
          setOrgError(orgResult.error || "Account created, but we couldn't register your organization. You can try again from Settings.");
        } else {
          // The create_organization_self_serve RPC (or the demo-mode patch
          // in organizations.js) has just promoted this account to admin
          // in the database for a real project, in the patched local
          // session for demo mode. Either way, the role the app is
          // currently holding in memory is still the stale "learner" it
          // fetched right after onSignUp, one line above, before this
          // promotion happened. Without a reload, the promotion is real but
          // invisible: the app keeps rendering the Learner view against
          // that stale role until the next full reload happens to occur
          // for some unrelated reason. Reload unconditionally on success
          // not just for orgResult.demo - so App.jsx's role lookup runs
          // fresh and lands on the Platform/admin app immediately, the same
          // pattern AcceptInvitationScreen uses after a real invitation is
          // accepted.
          window.location.reload();
          return;
        }
      } else if (accountType === "learner" && !result?.error) {
        // Individual signup (no organization named): per the brief, an
        // unaffiliated learner lands in the "Digital Training Organization"
        // default
        // organization rather than staying org-less. Best-effort - a
        // failure here shouldn't block the account from being usable, and
        // isn't surfaced as a form error since the learner didn't take any
        // action that could plausibly be "wrong".
        joinDefaultOrganization().catch(() => {});
      }
    }
    setSubmitting(false);
  }

  return (
    <div style={styles.outer}>
      <style>{`
        @keyframes authFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .auth-card { animation: authFadeUp .35s ease; }
        .auth-input:focus { outline: none; border-color: #818CF8 !important; box-shadow: 0 0 0 3px rgba(79,70,229,.12); }
        .auth-submit:hover { box-shadow: 0 14px 28px -8px rgba(79,70,229,.55); transform: translateY(-1px); }
        .auth-switch:hover { text-decoration: underline; }
        .role-picker-card { transition: border-color .15s ease, background-color .15s ease, transform .15s ease; }
        .role-picker-card:hover { border-color: #C7D2FE; }
        .role-picker-card:active { transform: scale(.98); }
        .role-picker-card.active { border-color: #4F46E5 !important; background: #EEF2FF !important; }
        .auth-submit:active { transform: scale(.98); }
        @media (max-width: 400px) {
          .auth-card { padding: 24px 20px !important; }
          .role-picker-header { flex-wrap: wrap; row-gap: 4px; }
          .role-picker-header .role-picker-badge { margin-left: 0 !important; }
        }
      `}</style>

      <div style={styles.glowTop} />
      <div style={styles.glowBottom} />

      <form onSubmit={handleSubmit} className="auth-card" style={styles.card}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <img src="/train-ai-logo.png" alt="Train AI" style={{ height: 48, width: "auto", objectFit: "contain", display: "block" }} />
        </div>

        <h1 style={styles.h1}>{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p style={styles.sub}>
          {mode === "signin" ? "Sign in with your email and password." : "Join Train AI to start your personalized learning path."}
        </p>

        {mode === "signup" && (
          <div style={{ marginBottom: 20 }}>
            <div style={styles.label}>Choose account type</div>
            <div
              className={`role-picker-card ${accountType === "organization" ? "active" : ""}`}
              onClick={() => setAccountType("organization")}
              style={{
                marginTop: 8, padding: "14px 12px", borderRadius: 13, border: "1.5px solid #E6E9F5", background: "#fff",
                cursor: "pointer", display: "flex", flexDirection: "column", gap: 6
              }}
            >
              <div className="role-picker-header" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Building2 size={16} color={accountType === "organization" ? "#4F46E5" : "#656C86"} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "#10142A" }}>Organization</span>
                <span className="role-picker-badge" style={{ fontSize: 10, fontWeight: 700, color: "#4F46E5", background: "#EEF2FF", padding: "2px 7px", borderRadius: 999, marginLeft: "auto", flexShrink: 0 }}>RECOMMENDED</span>
              </div>
              <span style={{ fontSize: 11, color: "#656C86", lineHeight: 1.3 }}>
                Bring your team onto Train AI: workforce readiness, cohorts, and org-wide reporting. You become the organization's admin.
              </span>
            </div>

            {/* Only two sign-up paths - Organization and Individual Learner.
                Manager/Admin/Instructor are internal organization roles,
                assigned after login (via org invitation), never a public
                sign-up choice. This narrowed from three options (this used
                to also offer "Instructor" here) on explicit instruction:
                someone applying to instruct joins through an organization's
                invite, the same way a Manager or Admin does. There is no
                separate public "apply to instruct" path. */}
            <div
              className={`role-picker-card ${accountType === "learner" ? "active" : ""}`}
              onClick={() => setAccountType("learner")}
              style={{
                marginTop: 8, padding: "14px 12px", borderRadius: 13, border: "1.5px solid #E6E9F5", background: "#fff",
                cursor: "pointer", display: "flex", flexDirection: "column", gap: 6
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <User size={15} color={accountType === "learner" ? "#4F46E5" : "#656C86"} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#10142A" }}>Individual learner</span>
              </div>
              <span style={{ fontSize: 11, color: "#656C86", lineHeight: 1.3 }}>Access courses, AI quizzes, community. On your own, not tied to a company account</span>
            </div>

            {accountType === "organization" && (
              <div style={{ marginTop: 12 }}>
                <label style={styles.label}>Organization name</label>
                <div style={styles.inputWrap}>
                  <Building2 size={15} color="#9AA1B9" style={styles.inputIcon} />
                  <input
                    type="text" value={orgName}
                    onChange={(e) => { setOrgName(e.target.value); if (orgError) setOrgError(""); }}
                    className="auth-input" style={styles.input} placeholder="Acme Corporation"
                  />
                </div>
                {orgError && <div style={{ ...styles.breachBox, marginTop: 8 }}><ShieldAlert size={14} style={{ flexShrink: 0, marginTop: 1 }} /><span>{orgError}</span></div>}
              </div>
            )}

            <div style={{ fontSize: 11, color: "#9AA1B9", marginTop: 10, display: "flex", alignItems: "center", gap: 5 }}>
              <ShieldCheck size={13} color="#9AA1B9" /> Admin access is granted by your organisation or the platform team. It isn't a signup option here.
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
    background: "#F8FAFC", fontFamily: "var(--font-sans)", padding: 20,
  },
  glowTop: {
    position: "absolute", top: -180, left: "50%", transform: "translateX(-50%)", width: 560, height: 360, borderRadius: "50%",
    background: "radial-gradient(closest-side, rgba(99,102,241,.18), transparent)", pointerEvents: "none",
  },
  glowBottom: {
    position: "absolute", bottom: -200, right: -120, width: 480, height: 380, borderRadius: "50%",
    background: "radial-gradient(closest-side, rgba(79,70,229,.15), transparent)", pointerEvents: "none",
  },
  card: {
    position: "relative", width: "100%", maxWidth: 420, background: "#FFFFFF", borderRadius: 20, padding: 36,
    border: "1px solid #E2E8F0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05), 0 20px 35px -10px rgba(79,70,229,0.08)",
  },
  brandRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 20 },
  brandMark: {
    width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
    background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)",
    boxShadow: "0 6px 14px -4px rgba(79,70,229,0.4)",
  },
  brandName: { fontWeight: 800, fontSize: 16, letterSpacing: "-0.01em", color: "#0F172A" },
  h1: { fontSize: 22, fontWeight: 800, margin: "0 0 6px", color: "#0F172A", letterSpacing: "-0.02em" },
  sub: { fontSize: 13, color: "#64748B", margin: "0 0 22px", lineHeight: 1.5 },
  label: { fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".06em" },
  inputWrap: { position: "relative", marginTop: 6 },
  inputIcon: { position: "absolute", left: 13, top: 14 },
  input: {
    width: "100%", padding: "12px 14px 12px 38px", borderRadius: 12, border: "1.5px solid #E2E8F0",
    fontSize: 14, color: "#0F172A", boxSizing: "border-box", transition: "border-color .15s ease, box-shadow .15s ease",
  },
  errorBox: {
    background: "#FEF2F2", color: "#EF4444", fontSize: 12.5, padding: "11px 14px", borderRadius: 12,
    marginTop: 14, lineHeight: 1.4, fontWeight: 600, border: "1px solid #FECACA",
  },
  breachChecking: { fontSize: 11.5, color: "#94A3B8", marginTop: 8 },
  breachBox: {
    display: "flex", gap: 8, background: "#FFFBEB", color: "#B45309", fontSize: 12,
    padding: "10px 12px", borderRadius: 12, marginTop: 8, lineHeight: 1.4, fontWeight: 500, border: "1px solid #FDE68A",
  },
  submit: {
    width: "100%", marginTop: 22, border: "none", borderRadius: 12, padding: "13px 18px", fontWeight: 700, fontSize: 14.5,
    color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)",
    boxShadow: "0 10px 20px -6px rgba(79,70,229,0.45)", transition: "transform .15s ease, box-shadow .15s ease",
  },
  switchRow: { textAlign: "center", marginTop: 18, fontSize: 13, color: "#64748B" },
  switchLink: { color: "#4F46E5", fontWeight: 700, cursor: "pointer" },
};
