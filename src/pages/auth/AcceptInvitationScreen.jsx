import React, { useEffect, useState } from "react";
import { ArrowRight, Building2, User, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { validateInvitationToken, acceptInvitation } from "../../lib/api/invitations.js";

// Rendered instead of the whole app whenever the URL has a `?invite=TOKEN`
// param on boot (there's no router here, so App.jsx detects that query
// param itself - see initialScreenFromLocation()'s ?reference=/?trxref=
// pattern in TrainAILearnerApp.jsx for the established precedent of reading
// a one-shot query param at boot to decide what to render). Unlike the
// payment callback (which only ever runs post-auth, inside the learner app),
// an invite link can be the very first thing a brand-new user ever opens, so
// this has to run pre-auth, above the sign-in gate in App.jsx.
//
// Full-page layout intentionally mirrors MfaChallengeScreen.jsx (also a
// full-page pre-auth replacement screen in this app).
export default function AcceptInvitationScreen({ token, session, onAccepted, onNeedsSignIn, onGoHome }) {
  const [phase, setPhase] = useState("validating"); // validating | invalid | ready | needs_signup | accepting | done
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [doneMessage, setDoneMessage] = useState("");
  const [doneNeedsSignIn, setDoneNeedsSignIn] = useState(false);
  const [doneEmail, setDoneEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setPhase("invalid");
      setError("Missing invitation link.");
      return;
    }
    (async () => {
      try {
        const row = await validateInvitationToken(token);
        if (cancelled) return;
        if (!row) {
          setPhase("invalid");
          setError("This invitation link is not valid.");
          return;
        }
        if (!row.is_valid) {
          setPhase("invalid");
          setError("This invitation has expired or has already been used.");
          return;
        }
        setInvitation(row);
        setDisplayName((row.email || "").split("@")[0] || "");
        setPhase("ready");
      } catch (e) {
        if (!cancelled) {
          setPhase("invalid");
          setError(e?.message || "Could not validate this invitation.");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function handleAccept(withPassword) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await acceptInvitation({
        token,
        password: withPassword ? password : undefined,
        displayName: displayName.trim() || undefined,
      });

      if (!result.ok) {
        if (result.requiresSignup) {
          setPhase("needs_signup");
        } else {
          setError(result.message || "Failed to accept invitation.");
        }
        return;
      }

      // Already-signed-in caller accepting their own invite: refresh the
      // whole app boot so App.jsx re-fetches roles/org membership from
      // scratch rather than trying to patch a handful of pieces of state
      // that were computed before this org membership existed.
      if (session?.user?.id && session.user.id === result.userId) {
        setPhase("done");
        setDoneMessage(`You're all set. You've joined ${invitation?.organization_name || "the organization"}.`);
        setDoneNeedsSignIn(false);
        onAccepted?.();
        return;
      }

      // New account or an existing-but-signed-out account: there is no local
      // session for that user (accept-invitation never issues one - it uses
      // the service-role admin API), so send them to sign in.
      setPhase("done");
      setDoneNeedsSignIn(true);
      setDoneEmail(invitation?.email || result.email || "");
      setDoneMessage(
        result.isNewUser
          ? "Account created! Sign in with the password you just set to get started."
          : `Invitation accepted. Sign in to continue as a member of ${invitation?.organization_name || "the organization"}.`
      );
    } catch (e) {
      setError(e?.message || "Failed to accept invitation.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSignupSubmit(e) {
    e.preventDefault();
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    handleAccept(true);
  }

  return (
    <div style={styles.outer}>
      <style>{`
        @keyframes inviteFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes inviteSpin { to { transform: rotate(360deg); } }
        .invite-card { animation: inviteFadeUp .35s ease; }
        .invite-spin { animation: inviteSpin .8s linear infinite; }
        .invite-input:focus { outline: none; border-color: #818CF8 !important; box-shadow: 0 0 0 3px rgba(79,70,229,.12); }
        .invite-submit:hover { box-shadow: 0 14px 28px -8px rgba(79,70,229,.55); transform: translateY(-1px); }
        .invite-link:hover { text-decoration: underline; }
      `}</style>

      <div style={styles.glowTop} />
      <div style={styles.glowBottom} />

      <div className="invite-card" style={styles.card}>
        <div style={styles.brandRow}>
          <img src="/brand/train-ai-logo.png" alt="Train AI" style={{ width: 34, height: 34, objectFit: "contain", borderRadius: 0, flexShrink: 0 }} />
          <div style={styles.brandName}>Train AI</div>
        </div>

        {phase === "validating" && (
          <div style={styles.loadingRow}>
            <Loader2 size={16} className="invite-spin" /> Checking your invitation…
          </div>
        )}

        {phase === "invalid" && (
          <>
            <XCircle size={36} color="#EF4444" style={{ marginBottom: 10 }} />
            <h1 style={styles.h1}>Invalid invitation</h1>
            <p style={styles.sub}>{error || "This invitation link could not be used."}</p>
            <button className="invite-submit" style={styles.submit} onClick={() => onGoHome?.()}>
              Go to Train AI <ArrowRight size={16} />
            </button>
          </>
        )}

        {(phase === "ready" || phase === "needs_signup") && invitation && (
          <>
            <h1 style={styles.h1}>You're invited!</h1>
            <p style={styles.sub}>Join {invitation.organization_name} on Train AI.</p>

            <div style={styles.infoBox}>
              <div style={styles.infoRow}>
                <Building2 size={15} color="#656C86" />
                <div>
                  <div style={styles.infoLabel}>Organization</div>
                  <div style={styles.infoValue}>{invitation.organization_name}</div>
                </div>
              </div>
              <div style={styles.infoRow}>
                <User size={15} color="#656C86" />
                <div>
                  <div style={styles.infoLabel}>Your role</div>
                  <div style={{ ...styles.infoValue, textTransform: "capitalize" }}>{invitation.role}</div>
                </div>
              </div>
            </div>

            {phase === "ready" && (
              <>
                {error && <div style={styles.errorBox}>{error}</div>}
                <button
                  className="invite-submit"
                  style={{ ...styles.submit, opacity: submitting ? 0.75 : 1 }}
                  disabled={submitting}
                  onClick={() => handleAccept(false)}
                >
                  {submitting ? "Checking..." : (<>Accept invitation <ArrowRight size={16} /></>)}
                </button>
              </>
            )}

            {phase === "needs_signup" && (
              <form onSubmit={handleSignupSubmit}>
                <p style={{ ...styles.sub, marginTop: 0 }}>
                  No account exists yet for {invitation.email}. Set a password to create one and join automatically.
                </p>
                <label style={styles.label}>Display name</label>
                <input
                  className="invite-input"
                  style={styles.input}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                />
                <label style={{ ...styles.label, marginTop: 12 }}>Password</label>
                <input
                  className="invite-input"
                  style={styles.input}
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
                <label style={{ ...styles.label, marginTop: 12 }}>Confirm password</label>
                <input
                  className="invite-input"
                  style={styles.input}
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                />

                {error && <div style={styles.errorBox}>{error}</div>}

                <button
                  type="submit"
                  className="invite-submit"
                  style={{ ...styles.submit, opacity: submitting ? 0.75 : 1 }}
                  disabled={submitting}
                >
                  {submitting ? "Creating account..." : (<>Create account & join <ArrowRight size={16} /></>)}
                </button>
              </form>
            )}
          </>
        )}

        {phase === "done" && (
          <>
            <CheckCircle2 size={36} color="#10B981" style={{ marginBottom: 10 }} />
            <h1 style={styles.h1}>{doneNeedsSignIn ? "Almost there" : "Welcome aboard!"}</h1>
            <p style={styles.sub}>{doneMessage}</p>
            <button
              className="invite-submit"
              style={styles.submit}
              onClick={() => (doneNeedsSignIn ? onNeedsSignIn?.(doneEmail) : onAccepted?.())}
            >
              {doneNeedsSignIn ? "Continue to sign in" : "Continue"} <ArrowRight size={16} />
            </button>
          </>
        )}
      </div>
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
    position: "relative", width: "100%", maxWidth: 420, background: "#fff", borderRadius: 22, padding: 32,
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
  infoBox: { background: "#F8F9FC", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 },
  infoRow: { display: "flex", alignItems: "flex-start", gap: 10 },
  infoLabel: { fontSize: 11, color: "#656C86" },
  infoValue: { fontSize: 13.5, fontWeight: 700, color: "#10142A" },
  label: { fontSize: 11, fontWeight: 700, color: "#656C86", textTransform: "uppercase", letterSpacing: ".06em" },
  input: {
    width: "100%", marginTop: 6, padding: "11px 13px", borderRadius: 11, border: "1.5px solid #E6E9F5",
    fontSize: 13.5, color: "#10142A", boxSizing: "border-box", fontFamily: "inherit",
    transition: "border-color .12s ease, box-shadow .12s ease",
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
};
