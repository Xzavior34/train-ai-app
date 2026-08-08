import React, { useState } from "react";
import { ArrowRight, Mail, Lock, User, ShieldCheck, ShieldAlert, Building2 } from "lucide-react";
import { checkPasswordBreached } from "../../lib/api/mfa.js";
import { registerOrganization, joinDefaultOrganization } from "../../lib/api/organizations.js";

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
            <div
              className={`role-picker-card ${accountType === "organization" ? "active" : ""}`}
              onClick={() => setAccountType("organization")}
              style={{
                marginTop: 8, padding: "14px 12px", borderRadius: 13, border: "1.5px solid #E6E9F5", background: "#fff",
                cursor: "pointer", display: "flex", flexDirection: "column", gap: 6
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Building2 size={16} color={accountType === "organization" ? "#2563EB" : "#656C86"} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "#10142A" }}>Organization</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#2563EB", background: "#EEF2FF", padding: "2px 7px", borderRadius: 999, marginLeft: "auto" }}>RECOMMENDED</span>
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
                marginTop: 8, padding: "12px 10px", borderRadius: 13, border: "1.5px solid #E6E9F5", background: "#fff",
                cursor: "pointer", display: "flex", flexDirection: "column", gap: 6
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <User size={15} color={accountType === "learner" ? "#2563EB" : "#656C86"} />
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
