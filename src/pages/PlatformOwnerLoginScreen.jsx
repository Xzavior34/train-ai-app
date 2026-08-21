import React, { useState } from "react";
import { SUPABASE_PROJECTS, setActiveSupabaseProject, getSupabaseClientForProject } from "../services/supabaseClient.js";

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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // "Let access super admin temporary by typing url/admin for now before
  // database" - before a real database is connected, there's nothing real
  // to authenticate against or protect, so a direct preview here is safe,
  // not a security shortcut around real data. The moment a real Digital
  // Training project is connected, this button disappears entirely and
  // the real email/password + super_admin check below becomes the only
  // way in - this is the deliberately temporary bridge Philip's task list
  // describes, not a permanent alternate door.
  const hasRealProject = !!getSupabaseClientForProject(SUPABASE_PROJECTS.DIGITAL_TRAINING);

  async function handleSignIn(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      setActiveSupabaseProject(SUPABASE_PROJECTS.DIGITAL_TRAINING);
      const client = getSupabaseClientForProject(SUPABASE_PROJECTS.DIGITAL_TRAINING);
      if (!client) {
        setError("Demo mode - no real Digital Training project connected. Use the regular sign-in with a +admin email to preview the Owner dashboard instead.");
        return;
      }
      const { data, error: signInError } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError || !data?.session) {
        setError("Invalid credentials.");
        return;
      }
      const { data: roles } = await client.from("user_roles").select("role").eq("user_id", data.session.user.id);
      const isSuperAdmin = (roles || []).some((r) => r.role === "super_admin");
      if (!isSuperAdmin) {
        // Deliberately rejected here, not routed to Learner/Organisation -
        // this portal is Platform Owner only, per Section 10. A real
        // organization or learner account signing in here (even
        // correctly) should not land anywhere at all.
        await client.auth.signOut();
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

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0F172A" }}>
      <style>{`
        @keyframes ownerFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .owner-card { animation: ownerFadeUp .3s ease; }
        .owner-input { transition: border-color .12s ease, box-shadow .12s ease; }
        .owner-input:focus { outline: none; border-color: #4F46E5; box-shadow: 0 0 0 3px rgba(79,70,229,.15); }
        .owner-submit { transition: transform .12s ease, opacity .12s ease; }
        .owner-submit:not(:disabled):hover { opacity: .92; }
        .owner-submit:not(:disabled):active { transform: scale(.98); }
        .owner-preview-btn { transition: background .15s ease, transform .12s ease; }
        .owner-preview-btn:hover { background: #F8FAFC; }
        .owner-preview-btn:active { transform: scale(.98); }
      `}</style>
      <form onSubmit={handleSignIn} className="owner-card" style={{ maxWidth: 360, width: "100%", padding: 32, background: "#fff", borderRadius: 16, margin: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "#EF4444", textTransform: "uppercase" }}>Train AI Internal</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>Platform Owner Access</div>
        <div style={{ fontSize: 12.5, color: "#656C86", marginTop: 6, marginBottom: 20 }}>
          Train AI staff only. This is not the organization or learner sign-in.
        </div>
        <label style={{ fontSize: 12, fontWeight: 600 }}>Email</label>
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@trainailtd.com"
          className="owner-input"
          style={{ width: "100%", padding: "10px 12px", marginTop: 4, marginBottom: 12, borderRadius: 8, border: "1px solid #E5E7EB", boxSizing: "border-box" }}
        />
        <label style={{ fontSize: 12, fontWeight: 600 }}>Password</label>
        <input
          type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          className="owner-input"
          style={{ width: "100%", padding: "10px 12px", marginTop: 4, marginBottom: 16, borderRadius: 8, border: "1px solid #E5E7EB", boxSizing: "border-box" }}
        />
        {error && <div style={{ fontSize: 12.5, color: "#DC2626", marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={loading} className="owner-submit" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "#0F172A", color: "#fff", fontWeight: 700, border: "none", cursor: loading ? "default" : "pointer" }}>
          {loading ? "Signing in..." : "Sign in"}
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
