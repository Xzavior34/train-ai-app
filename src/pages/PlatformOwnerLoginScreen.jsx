import React, { useState, useEffect } from "react";
import { Eye, EyeOff, ShieldAlert, AlertCircle, Clock } from "lucide-react";
import { SUPABASE_PROJECTS, setActiveSupabaseProject, getSupabaseClientForProject } from "../services/supabaseClient.js";
import { getRateLimitStatus, recordFailedPasswordAttempt, resetPasswordRateLimit, formatLockoutTime, MAX_PASSWORD_TRIALS } from "../lib/authRateLimiter.js";

// Platform Owner's separate login entry point - PRD Section 10: "The
// platform owner view is for Train AI internal operations... not login
// from initial login area - separate login." Confirmed a real gap: the
// only way to reach the Owner dashboard was the Dashboard Switcher,
// reachable from inside the exact same login/signup flow as every
// organization and learner - "not from the initial login area" was not
// actually true.
//
// This is a genuinely distinct screen: no Organization/Individual Learner
// choice, no public sign-up path at all (there never was one for
// super_admin - accounts are provisioned directly, per
// 0119_super_admin_trainai_only.sql), reached only via a dedicated URL
// (?portal=owner), not linked from the regular AuthPage anywhere.
// Authenticates directly against the Digital Training project (where
// Super Admin accounts live - see services/supabaseClient.js's header
// comment) and explicitly rejects any account that isn't confirmed
// super_admin after signing in, rather than silently falling through to a
// Learner or Organisation dashboard.
export function PlatformOwnerLoginScreen({ onAuthenticated }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rateLimit, setRateLimit] = useState(() => getRateLimitStatus(""));
  const [capsLockActive, setCapsLockActive] = useState(false);

  function handlePasswordKeyDown(e) {
    if (e.getModifierState && e.getModifierState("CapsLock")) {
      setCapsLockActive(true);
    } else {
      setCapsLockActive(false);
    }
  }

  useEffect(() => {
    setActiveSupabaseProject(SUPABASE_PROJECTS.ORGANIZATION_DB);
  }, []);

  // Sync rate limit when email changes
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

  const hasRealProject = !!getSupabaseClientForProject(SUPABASE_PROJECTS.ORGANIZATION_DB);

  async function handleSignIn(e) {
    e.preventDefault();
    setError("");

    // Enforce 10-trial rate limiting before attempting sign in
    const currentLimit = getRateLimitStatus(email);
    if (currentLimit.isLocked) {
      setRateLimit(currentLimit);
      return;
    }

    setLoading(true);
    try {
      setActiveSupabaseProject(SUPABASE_PROJECTS.ORGANIZATION_DB);
      const client = getSupabaseClientForProject(SUPABASE_PROJECTS.ORGANIZATION_DB);
      if (!client) {
        setError("Demo mode - no real Train AI 2.0 Organization Database connected. Use the regular sign-in with a +admin email to preview the Owner dashboard instead.");
        return;
      }
      const { data, error: signInError } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError || !data?.session) {
        const updated = recordFailedPasswordAttempt(email);
        setRateLimit(updated);
        if (updated.isLocked) {
          setError(`Account temporarily locked due to 10 failed password trials. Please wait ${formatLockoutTime(updated.remainingMs)}.`);
        } else if (updated.remainingAttempts <= 5) {
          setError(`Invalid credentials. You have ${updated.remainingAttempts} attempt(s) remaining before a 15-minute temporary lockout.`);
        } else {
          setError("Invalid credentials.");
        }
        return;
      }
      const { data: roles } = await client.from("user_roles").select("role").eq("user_id", data.session.user.id);
      const isSuperAdmin = (roles || []).some((r) => r.role === "super_admin");
      if (!isSuperAdmin) {
        await client.auth.signOut();
        setError("This account does not have Platform Owner access.");
        return;
      }
      resetPasswordRateLimit(email);
      onAuthenticated(data.session);
    } catch (err) {
      setError(err?.message || "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0F172A", fontFamily: "var(--font-sans, 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)" }}>
      <style>{`
        @keyframes ownerFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .owner-card { animation: ownerFadeUp .3s ease; }
        .owner-input { transition: border-color .12s ease, box-shadow .12s ease; }
        .owner-input:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,.15); }
        .owner-submit { transition: transform .12s ease, opacity .12s ease; }
        .owner-submit:not(:disabled):hover { opacity: .92; }
        .owner-submit:not(:disabled):active { transform: scale(.98); }
        .owner-preview-btn { transition: background .15s ease, transform .12s ease; }
        .owner-preview-btn:hover { background: #F8FAFC; }
        .owner-preview-btn:active { transform: scale(.98); }
      `}</style>
      <form onSubmit={handleSignIn} className="owner-card" style={{ maxWidth: 360, width: "100%", padding: 32, background: "#fff", color: "#0F172A", borderRadius: 10, margin: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "#EF4444", textTransform: "uppercase" }}>Train AI Internal</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, color: "#0F172A" }}>Platform Owner Access</div>
        <div style={{ fontSize: 12.5, color: "#656C86", marginTop: 6, marginBottom: 20 }}>
          Train AI staff only. This is not the organization or learner sign-in.
        </div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Email</label>
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@trainailtd.com"
          className="owner-input"
          style={{ width: "100%", padding: "10px 12px", marginTop: 4, marginBottom: 12, borderRadius: 8, border: "1px solid #CBD5E1", boxSizing: "border-box", background: "#FFFFFF", color: "#0F172A", caretColor: "#0F172A" }}
        />
        <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Password</label>
        <div style={{ position: "relative", width: "100%", marginTop: 4, marginBottom: 16 }}>
          <input
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handlePasswordKeyDown}
            onKeyUp={handlePasswordKeyDown}
            disabled={rateLimit.isLocked}
            className="owner-input"
            style={{
              width: "100%", padding: "10px 38px 10px 12px", borderRadius: 8,
              border: "1px solid #E5E7EB", boxSizing: "border-box",
              backgroundColor: rateLimit.isLocked ? "#F8FAFC" : "#FFFFFF", color: "#0F172A", caretColor: "#0F172A",
              cursor: rateLimit.isLocked ? "not-allowed" : "text"
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            disabled={rateLimit.isLocked}
            style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              background: "transparent", border: "none", cursor: "pointer", padding: "6px",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8"
            }}
            aria-label={showPassword ? "Hide password" : "Show password"}
            title={showPassword ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {/* Caps Lock Warning */}
        {capsLockActive && !rateLimit.isLocked && (
          <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 6, padding: "6px 10px", marginBottom: 12, fontSize: 11.5, color: "#92400E", display: "flex", alignItems: "center", gap: 6 }}>
            <AlertCircle size={13} color="#D97706" /> Caps Lock is ON
          </div>
        )}

        {/* Lockout Box */}
        {rateLimit.isLocked && (
          <div style={{ background: "#FFF1F2", border: "1.5px solid #FECDD3", borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <ShieldAlert size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#991B1B" }}>Account Locked</div>
                <div style={{ fontSize: 12, color: "#B91C1C", marginTop: 2 }}>
                  10 failed password trials. Cooldown remaining: <strong>{formatLockoutTime(rateLimit.remainingMs)}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && !rateLimit.isLocked && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 12px", marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 8 }}>
            <AlertCircle size={15} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12.5, color: "#DC2626", fontWeight: 600 }}>{error}</div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || rateLimit.isLocked}
          className="owner-submit"
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8,
            background: rateLimit.isLocked ? "#64748B" : "#0F172A", color: "#fff",
            fontWeight: 700, border: "none",
            cursor: (loading || rateLimit.isLocked) ? "not-allowed" : "pointer"
          }}
        >
          {loading
            ? "Signing in..."
            : rateLimit.isLocked
              ? `Locked (${formatLockoutTime(rateLimit.remainingMs)})`
              : "Sign in"}
        </button>
        {!hasRealProject && (
          <>
            <div style={{ textAlign: "center", fontSize: 11, color: "#94A3B8", margin: "16px 0" }}>Temporary, before database is connected</div>
            <button
              type="button"
              onClick={() => onAuthenticated(null)}
              className="owner-preview-btn"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "#fff", color: "#0F172A", fontWeight: 700, border: "1px solid #0F172A", cursor: "pointer" }}
            >
              Preview Owner Dashboard (no database yet)
            </button>
          </>
        )}
      </form>
    </div>
  );
}
