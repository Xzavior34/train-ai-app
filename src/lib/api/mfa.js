import { supabase } from "../../services/supabaseClient.js";

// Thin wrappers around Supabase Auth's built-in MFA (TOTP) API. These work
// against the shared Supabase project (qibqouymqtpirtbyjvjr) exactly like
// they do in the reference train-ai-ltd-main app - `supabase.auth.mfa.*` is
// core Supabase Auth functionality, not a custom edge function, so no extra
// deployment is required for enroll/challenge/verify/unenroll/listFactors.
//
// `checkPasswordBreached` is the one call here that DOES hit a custom edge
// function ("password-breach-check") that's already deployed live on the
// shared project - see supabase/functions/password-breach-check/index.ts in
// train-ai-ltd-main for the source this matches.
//
// `resetMfaForUserByAdmin` matches the shape of the also-already-deployed
// "admin-reset-mfa" edge function (super_admin only server-side). Nothing in
// this pass wires it into a UI yet - it's here so a future admin screen can
// call it without re-deriving the request/response shape.

function requireSupabase() {
  if (!supabase) {
    throw new Error("Two-factor authentication isn't available in demo mode. Connect a live account first.");
  }
}

/**
 * Starts (or resumes) TOTP enrollment. Returns:
 *   { factorId, qrCodeDataUri, secret, uri }
 * `qrCodeDataUri` is ready to drop straight into an <img src="..."> with no
 * extra QR-generating library - Supabase's enroll response includes
 * `totp.qr_code`, which is the *raw SVG source* (per the auth-js type
 * comment), not a pre-built data: URI, so it's wrapped here with
 * `data:image/svg+xml;utf8,${encodeURIComponent(...)}` before being handed
 * back to callers.
 */
export async function enrollMfaFactor() {
  requireSupabase();
  const friendlyName = `Train AI - ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName });
  if (error) throw new Error(error.message || "Could not start two-factor enrollment.");

  const { id, totp } = data;
  const qrCodeDataUri = totp?.qr_code
    ? `data:image/svg+xml;utf8,${encodeURIComponent(totp.qr_code)}`
    : null;

  return {
    factorId: id,
    qrCodeDataUri,
    secret: totp?.secret || null,
    uri: totp?.uri || null,
  };
}

/** Lists every MFA factor on the current user. Returns { all, totp, phone, webauthn }. */
export async function listMfaFactors() {
  requireSupabase();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw new Error(error.message || "Could not load two-factor status.");
  return data;
}

/** Opens a challenge against a factor. Returns { challengeId, expiresAt }. */
export async function createMfaChallenge(factorId) {
  requireSupabase();
  if (!factorId) throw new Error("Missing factor id");
  const { data, error } = await supabase.auth.mfa.challenge({ factorId });
  if (error) throw new Error(error.message || "Could not start verification.");
  return { challengeId: data.id, expiresAt: data.expires_at };
}

/** Verifies a 6-digit TOTP code against an open challenge. */
export async function verifyMfaChallenge(factorId, challengeId, code) {
  requireSupabase();
  if (!factorId || !challengeId) throw new Error("Missing factor or challenge id");
  if (!code || code.length !== 6) throw new Error("Enter the 6-digit code from your authenticator app.");
  const { data, error } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
  if (error) throw new Error(error.message || "Invalid code. Please try again.");
  return data;
}

/** Removes a factor (cancel a pending enrollment, or disable an active one). */
export async function unenrollMfaFactor(factorId) {
  requireSupabase();
  if (!factorId) throw new Error("Missing factor id");
  const { data, error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw new Error(error.message || "Could not remove this factor.");
  return data;
}

/**
 * Current Authenticator Assurance Level for this session:
 * { currentLevel, nextLevel, currentAuthenticationMethods }.
 * A step-up is needed whenever currentLevel === 'aal1' && nextLevel === 'aal2'.
 */
export async function getAuthenticatorAssuranceLevel() {
  requireSupabase();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw new Error(error.message || "Could not check verification status.");
  return data;
}

/**
 * Calls the shared "password-breach-check" edge function (Have I Been
 * Pwned k-anonymity check - only a SHA-1 prefix ever leaves this device,
 * the raw password never does). Request: { password }. Response:
 * { breached: boolean, count: number, degraded?: boolean }.
 *
 * The edge function itself fails OPEN (returns breached:false, degraded:true)
 * on any upstream error rather than blocking signup, and this wrapper mirrors
 * that: any client-side failure (offline, demo mode, function not reachable)
 * also resolves to a non-breach result instead of throwing, since this check
 * is advisory only and must never be able to block account creation.
 */
export async function checkPasswordBreached(password) {
  if (!supabase || !password) return { breached: false, count: 0, degraded: true };
  try {
    const { data, error } = await supabase.functions.invoke("password-breach-check", {
      body: { password },
    });
    if (error || !data) return { breached: false, count: 0, degraded: true };
    return { breached: !!data.breached, count: data.count || 0, degraded: !!data.degraded };
  } catch {
    return { breached: false, count: 0, degraded: true };
  }
}

/**
 * Matches the shared "admin-reset-mfa" edge function (super_admin only,
 * enforced server-side via the caller's JWT + a user_roles lookup). Request:
 * { email }. Response on success:
 * { success: true, userId, factorsRemoved, totalFactors, results: [{ id, deleted, error? }] }.
 * Not wired into any screen in this pass - kept here so a future admin
 * "reset stuck MFA" tool doesn't need to re-derive the contract.
 */
export async function resetMfaForUserByAdmin(email) {
  requireSupabase();
  if (!email) throw new Error("Missing email");
  const { data, error } = await supabase.functions.invoke("admin-reset-mfa", {
    body: { email },
  });
  if (error) throw new Error(error.message || data?.error || "Could not reset two-factor authentication for this user.");
  return data;
}
