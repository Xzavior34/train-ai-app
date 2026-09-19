import React, { useState } from "react";
import { supabase, isSupabaseConfigured } from "../services/supabaseClient.js";
import { isPlatformOwnerEmail } from "../lib/roleRouting.js";

// Platform Owner's separate login entry point - PRD Section 10: "The
// platform owner view is for Train AI internal operations... not login
// from initial login area - separate login."
//
// This is a genuinely distinct screen: no Organization/Individual Learner
// choice, no public sign-up path at all (there never was one for
// super_admin - accounts are provisioned directly, per
// 0119_super_admin_trainai_only.sql), reached only via a dedicated URL
// (?portal=owner), not linked from the regular AuthPage anywhere.
// Authenticates directly against the single production database and explicitly
// rejects any account that isn't confirmed super_admin after signing in, rather
// than silently falling through to a Learner or Organisation dashboard.
export function PlatformOwnerLoginScreen({ onAuthenticated, initialEmail = "", onCancel }) {
  const [email, setEmail] = useState(initialEmail || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const hasRealProject = isSupabaseConfigured;

  async function handleSignIn(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!supabase) {
        setError("Demo mode - no real database connected. Use the regular sign-in with a +admin email to preview the Owner dashboard instead.");
        return;
      }
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError || !data?.session) {
        setError("Invalid credentials.");
        return;
      }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.session.user.id);
      const isSuperAdmin = (roles || []).some((r) => r.role === "super_admin") || isPlatformOwnerEmail(data.session.user.email);
      if (!isSuperAdmin) {
        await supabase.auth.signOut();
        setError("This account does not have Platform Owner access.");
        return;
      }
      onAuthenticated(data.session);
    } catch (err) {
      setError(err?.message || "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  function handleGoBack() {
    if (onCancel) {
      onCancel();
    } else {
      window.location.replace("/");
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
      <form onSubmit={handleSignIn} className="owner-card" style={{ maxWidth: 380, width: "100%", padding: 32, background: "#fff", borderRadius: 12, margin: 16, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "#EF4444", textTransform: "uppercase" }}>Train AI Internal</div>
          <button type="button" onClick={handleGoBack} style={{ background: "none", border: "none", color: "#64748B", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>
            ← Back to App
          </button>
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, color: "#0F172A" }}>Platform Owner Access</div>
        <div style={{ fontSize: 12.5, color: "#656C86", marginTop: 6, marginBottom: 20 }}>
          Train AI administrative portal. Sign in with your platform owner credentials to access global management.
        </div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Email</label>
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="trainailtd@gmail.com"
          className="owner-input"
          style={{ width: "100%", padding: "10px 12px", marginTop: 4, marginBottom: 12, borderRadius: 8, border: "1px solid #E5E7EB", boxSizing: "border-box", fontSize: 13.5 }}
        />
        <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Password</label>
        <input
          type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="owner-input"
          style={{ width: "100%", padding: "10px 12px", marginTop: 4, marginBottom: 16, borderRadius: 8, border: "1px solid #E5E7EB", boxSizing: "border-box", fontSize: 13.5 }}
        />
        {error && <div style={{ fontSize: 12.5, color: "#DC2626", marginBottom: 12, padding: "8px 12px", background: "#FEF2F2", borderRadius: 6 }}>{error}</div>}
        <button type="submit" disabled={loading} className="owner-submit" style={{ width: "100%", padding: "11px 12px", borderRadius: 8, background: "#0F172A", color: "#fff", fontWeight: 700, border: "none", cursor: loading ? "default" : "pointer", fontSize: 14 }}>
          {loading ? "Authenticating..." : "Sign in as Platform Owner"}
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
