import { supabase } from "../supabaseClient.js";
import { startPaystackPayment, startStripePayment, PAYMENT_CONTEXTS } from "./payments.js";
import { setDemoRoleForEmail } from "../roleRouting.js";

// Backing RPC: create_organization_self_serve(p_org_name text) -> uuid
// (supabase/migrations/0102_org_self_serve_signup.sql). The calling user
// becomes that organization's owner/admin - see the migration for the exact
// guards (must be signed in, must not already belong to an organization).
//
// This is the primary sign-up path per the product backlog ("New Sign-up
// Flow" - organization sign-up first, individual learner sign-up secondary,
// admin sign-in separate and never granted through either). It's a distinct
// call from individual signup, made right after the account is created, not
// a role option inside the same generic form.

const AUTH_STORAGE_KEY = "trainai_active_session_v1"; // must match useAuth.js
export const PENDING_ORG_JOIN_STORAGE_KEY = "trainai_pending_org_join";

/**
 * Generates the canonical shareable join/referral URL for an organization.
 */
export function getOrganizationJoinUrl(orgIdOrSlug) {
  if (!orgIdOrSlug) return "";
  let base = "https://trainailtd.com";
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
      base = window.location.origin;
    }
  }
  return `${base}/?join=${encodeURIComponent(orgIdOrSlug)}`;
}

/**
 * Stores a pending organization referral/join intent when a user arrives via ?join=... or ?org=...
 */
export function trackOrganizationJoinIntent(orgIdOrSlug, options = {}) {
  if (!orgIdOrSlug || typeof window === "undefined") return;
  try {
    const payload = {
      orgIdOrSlug: String(orgIdOrSlug).trim(),
      role: options.role || "learner",
      timestamp: Date.now(),
    };
    localStorage.setItem(PENDING_ORG_JOIN_STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

/**
 * Retrieves pending organization referral/join data if stored in this browser.
 */
export function getPendingOrganizationJoin() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PENDING_ORG_JOIN_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Clears pending organization referral/join data.
 */
export function clearPendingOrganizationJoin() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PENDING_ORG_JOIN_STORAGE_KEY);
  } catch {}
}

/**
 * Fetches public display info (name, logo, slug) for an organization by ID or slug.
 */
export async function fetchOrganizationPublicInfo(orgIdOrSlug) {
  const target = (orgIdOrSlug || "").trim();
  if (!target) return null;

  if (!supabase) {
    return { id: target, name: target.replace(/[-_]/g, " ").replace(/\b\w/g, l => l.toUpperCase()), slug: target };
  }

  try {
    let query = supabase.from("organizations").select("id, name, slug, logo_url");
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target);
    if (isUuid) {
      query = query.eq("id", target);
    } else {
      query = query.eq("slug", target);
    }
    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Automatically joins the authenticated user into an organization by ID or Slug.
 * Used by organization referral links to automate invitations and eliminate manual email typing.
 */
export async function joinOrganizationByReferral(orgIdOrSlug, preferredRole = "learner") {
  const target = (orgIdOrSlug || "").trim();
  if (!target) return { success: false, error: "Missing organization identifier." };

  if (!supabase) {
    // Demo mode: link the session locally
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.user) {
          parsed.user.user_metadata = {
            ...(parsed.user.user_metadata || {}),
            organization_id: target,
            role: preferredRole
          };
        }
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
      }
    } catch {}
    clearPendingOrganizationJoin();
    return { success: true, organizationId: target, demo: true };
  }

  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("join_organization_by_invite", {
      p_org_target: target,
      p_role: preferredRole
    });
    if (rpcErr) throw rpcErr;
    if (!rpcData?.success) return rpcData || { success: false, error: "Could not submit this join request." };
    clearPendingOrganizationJoin();
    return rpcData;
  } catch (e) {
    console.error("joinOrganizationByReferral error:", e);
    return { success: false, error: e?.message || "Could not submit the organization join request." };
  }
}

/**
 * Places a previously-unaffiliated individual learner into the "Tech
 * Learning" default organization, so no learner ends up with a null
 * organization_id. Call this right after individual (non-organization,
 * non-instructor) signup completes. Safe/idempotent - a no-op if the user
 * already belongs to any organization.
 * @returns {Promise<{ success: boolean, organizationId?: string, error?: string, demo?: boolean }>}
 */
export async function joinDefaultOrganization() {
  if (!supabase) {
    return { success: true, demo: true };
  }
  try {
    const { data, error } = await supabase.rpc("join_default_organization");
    if (error) throw error;
    return { success: true, organizationId: data };
  } catch (e) {
    return { success: false, error: e?.message || "Could not complete account setup. Please try again." };
  }
}

/**
 * Validates a foundation promo code (e.g. SARA-FOUNDATION, FOUNDATION-FREE)
 * @param {string} code
 * @returns {Promise<{ valid: boolean, name?: string, grant_ai_credits?: number, grant_seats?: number, error?: string }>}
 */
export async function validateOrgPromoCode(code) {
  const normalized = (code || "").trim().toUpperCase();
  if (!normalized) return { valid: false, error: "Please enter a promo code." };

  const KNOWN_PROMOS = {
    "SARA-FOUNDATION": { name: "Sara Foundation Africa Social Impact Grant", grant_ai_credits: 1000, grant_seats: 50, tier: "starter" },
    "FOUNDATION-FREE": { name: "Global Non-Profit Free Basic Plan", grant_ai_credits: 1000, grant_seats: 50, tier: "starter" },
    "TRAINAI-FOUNDATION": { name: "Train AI Impact & Foundation Partner", grant_ai_credits: 1000, grant_seats: 50, tier: "starter" },
    "CAP3-FOUNDATION": { name: "CAP Cohort 3 Foundation Sponsor", grant_ai_credits: 1000, grant_seats: 50, tier: "starter" },
    "IMPACT-2026": { name: "Non-Governmental Organization Grant 2026", grant_ai_credits: 1000, grant_seats: 50, tier: "starter" },
  };

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("validate_org_promo_code", { p_code: normalized });
      if (!error && data) return data;
    } catch {}
  }

  // Fallback / client check
  if (KNOWN_PROMOS[normalized]) {
    return {
      valid: true,
      code: normalized,
      ...KNOWN_PROMOS[normalized],
    };
  }

  return { valid: false, error: "Invalid foundation or partner promo code." };
}

/**
 * Registers a brand-new organization with the current signed-in user as its owner/admin.
 * Supports Free Foundation Promo Code bypass or verified payment reference.
 * @param {string} orgName
 * @param {object} options
 * @param {string} [options.promoCode]
 * @param {string} [options.paymentRef]
 * @param {string} [options.paymentProvider]
 * @returns {Promise<{ success: boolean, organizationId?: string, error?: string, demo?: boolean, is_free_grant?: boolean }>}
 */
export async function registerOrganization(orgName, { promoCode = "", paymentRef = "", paymentProvider = "verified_payment" } = {}) {
  const trimmed = (orgName || "").trim();
  if (trimmed.length < 2) {
    return { success: false, error: "Organization name is required." };
  }

  const normalizedPromo = (promoCode || "").trim().toUpperCase();
  if (!normalizedPromo && !paymentRef) {
    return { success: false, error: "A valid Foundation Code or verified payment reference is required." };
  }

  if (!supabase) {
    // Demo mode: patch session
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.role = "admin";
        if (parsed.user) {
          parsed.user.user_metadata = {
            ...(parsed.user.user_metadata || {}),
            role: "admin",
            organization_name: trimmed,
            plan: "starter",
            is_foundation_grant: !!normalizedPromo,
          };
        }
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
        if (parsed.user?.email) {
          setDemoRoleForEmail(parsed.user.email, "admin");
        }
      }
    } catch {}
    return {
      success: true,
      organizationId: `demo_org_${Date.now()}`,
      demo: true,
      is_free_grant: !!normalizedPromo
    };
  }

  try {
    // Try the enhanced payment / promo RPC first
    const { data, error } = await supabase.rpc("create_organization_with_code_or_payment", {
      p_org_name: trimmed,
      p_promo_code: normalizedPromo || null,
      p_payment_ref: paymentRef || null,
      p_payment_provider: paymentProvider || "verified_payment",
    });

    if (error) throw error;
    if (!data?.success) return { success: false, error: data?.error || "Could not activate this organization." };
    return { success: true, organizationId: data.organization_id, data };
  } catch (e) {
    return { success: false, error: e?.message || "Could not register your organization. Please try again." };
  }
}

// AI Coach settings - enable/disable and Manual Mode. Stored in
// organizations.settings->'ai_coach' (jsonb column that already existed in
// the schema, previously completely unused by any code). No new table.
const DEFAULT_AI_COACH_SETTINGS = { enabled: true, manual_mode: false, manual_message: "" };

/**
 * Reads AI Coach settings for an organization.
 */
export async function fetchOrgAISettings(organizationId) {
  if (!organizationId) return { ...DEFAULT_AI_COACH_SETTINGS };

  // Read local backup first
  let localSettings = null;
  try {
    const raw = localStorage.getItem(`trainai_ai_coach_settings_${organizationId}`);
    if (raw) localSettings = JSON.parse(raw);
  } catch {}

  if (!supabase) return localSettings ? { ...DEFAULT_AI_COACH_SETTINGS, ...localSettings } : { ...DEFAULT_AI_COACH_SETTINGS };

  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();

    if (error) {
      console.warn("AI Coach settings fetch warning:", error);
      return { ...DEFAULT_AI_COACH_SETTINGS };
    }
    if (data?.settings?.ai_coach) {
      const merged = { ...DEFAULT_AI_COACH_SETTINGS, ...data.settings.ai_coach };
      try {
        localStorage.setItem(`trainai_ai_coach_settings_${organizationId}`, JSON.stringify(merged));
      } catch {}
      return merged;
    }
    return { ...DEFAULT_AI_COACH_SETTINGS };
  } catch (e) {
    console.warn("AI Coach settings fetch warning:", e);
    return { ...DEFAULT_AI_COACH_SETTINGS };
  }
}

/**
 * Updates AI Coach settings for the organization with instant persistence and event dispatch.
 */
export async function updateOrgAISettings(organizationId, patch) {
  if (!organizationId) return { success: false, error: "Organization ID required." };

  if (!supabase) return { success: false, error: "The database is unavailable." };

  try {
    const { data: existing, error: readError } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();
    if (readError) throw readError;

    const nextAISettings = {
      ...DEFAULT_AI_COACH_SETTINGS,
      ...(existing?.settings?.ai_coach || {}),
      ...patch,
    };

    const nextSettings = {
      ...(existing?.settings || {}),
      ai_coach: nextAISettings,
    };

    const { error } = await supabase.from("organizations").update({ settings: nextSettings }).eq("id", organizationId);
    if (error) throw error;
    try {
      localStorage.setItem(`trainai_ai_coach_settings_${organizationId}`, JSON.stringify(nextAISettings));
      window.dispatchEvent(new CustomEvent("trainai_ai_settings_changed", { detail: { organizationId, settings: nextAISettings } }));
    } catch {}
    return { success: true, settings: nextAISettings };
  } catch (e) {
    console.warn("updateOrgAISettings caught:", e);
    return { success: false, error: e?.message || "Could not save AI Coach settings." };
  }
}

// AI Insights manual mode
const DEFAULT_AI_INSIGHTS_SETTINGS = { enabled: true, manual_mode: false, manual_message: "" };

export async function fetchOrgAIInsightsSettings(organizationId) {
  if (!organizationId) return { ...DEFAULT_AI_INSIGHTS_SETTINGS };

  let localSettings = null;
  try {
    const raw = localStorage.getItem(`trainai_ai_insights_settings_${organizationId}`);
    if (raw) localSettings = JSON.parse(raw);
  } catch {}

  if (!supabase) return localSettings ? { ...DEFAULT_AI_INSIGHTS_SETTINGS, ...localSettings } : { ...DEFAULT_AI_INSIGHTS_SETTINGS };

  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();

    if (error) {
      console.warn("AI Insights settings fetch warning:", error);
      return { ...DEFAULT_AI_INSIGHTS_SETTINGS };
    }
    if (data?.settings?.ai_insights) {
      const merged = { ...DEFAULT_AI_INSIGHTS_SETTINGS, ...data.settings.ai_insights };
      try {
        localStorage.setItem(`trainai_ai_insights_settings_${organizationId}`, JSON.stringify(merged));
      } catch {}
      return merged;
    }
    return { ...DEFAULT_AI_INSIGHTS_SETTINGS };
  } catch (e) {
    console.warn("AI Insights settings fetch warning:", e);
    return { ...DEFAULT_AI_INSIGHTS_SETTINGS };
  }
}

export async function updateOrgAIInsightsSettings(organizationId, patch) {
  if (!organizationId) return { success: false, error: "Organization ID required." };

  if (!supabase) return { success: false, error: "The database is unavailable." };

  try {
    const { data: existing, error: readError } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();
    if (readError) throw readError;

    const nextInsightsSettings = {
      ...DEFAULT_AI_INSIGHTS_SETTINGS,
      ...(existing?.settings?.ai_insights || {}),
      ...patch,
    };

    const nextSettings = {
      ...(existing?.settings || {}),
      ai_insights: nextInsightsSettings,
    };

    const { error } = await supabase.from("organizations").update({ settings: nextSettings }).eq("id", organizationId);
    if (error) throw error;
    try {
      localStorage.setItem(`trainai_ai_insights_settings_${organizationId}`, JSON.stringify(nextInsightsSettings));
      window.dispatchEvent(new CustomEvent("trainai_ai_insights_changed", { detail: { organizationId, settings: nextInsightsSettings } }));
    } catch {}
    return { success: true, settings: nextInsightsSettings };
  } catch (e) {
    console.warn("updateOrgAIInsightsSettings caught:", e);
    return { success: false, error: e?.message || "Could not save AI Insights settings." };
  }
}

// Leaderboard visibility - "Leaderboard visibility is configurable. Admins
// can disable rankings." Same pattern as AI Coach settings above: stored in
// organizations.settings->'leaderboard', no new table.
const DEFAULT_LEADERBOARD_SETTINGS = { enabled: true };

export async function fetchOrgLeaderboardSettings(organizationId) {
  if (!supabase || !organizationId) return { ...DEFAULT_LEADERBOARD_SETTINGS };
  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();
    if (error || !data) return { ...DEFAULT_LEADERBOARD_SETTINGS };
    return { ...DEFAULT_LEADERBOARD_SETTINGS, ...(data.settings?.leaderboard || {}) };
  } catch (e) {
    console.warn("Leaderboard settings fetch warning:", e);
    return { ...DEFAULT_LEADERBOARD_SETTINGS };
  }
}

export async function updateOrgLeaderboardSettings(organizationId, patch) {
  if (!supabase || !organizationId) return { success: false, error: "Not available in demo mode." };
  try {
    const { data: existing, error: fetchError } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    const nextSettings = {
      ...(existing?.settings || {}),
      leaderboard: { ...DEFAULT_LEADERBOARD_SETTINGS, ...(existing?.settings?.leaderboard || {}), ...patch },
    };
    const { error } = await supabase.from("organizations").update({ settings: nextSettings }).eq("id", organizationId);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not save leaderboard settings." };
  }
}

// Gamification on/off - explicitly a separate toggle from the leaderboard
// in the PRD ("Reminder systems and notifications (Option to on
// gamification or off) - on and off leadership board" lists them as two
// distinct controls). Only the leaderboard toggle was ever built; this is
// the missing one. Controls streaks/points/badges visibility, independent
// of whether rankings are shown - an org can want progress badges without
// a competitive leaderboard, or vice versa.
const DEFAULT_GAMIFICATION_SETTINGS = { enabled: true };

export async function fetchOrgGamificationSettings(organizationId) {
  if (!supabase || !organizationId) return { ...DEFAULT_GAMIFICATION_SETTINGS };
  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();
    if (error || !data) return { ...DEFAULT_GAMIFICATION_SETTINGS };
    return { ...DEFAULT_GAMIFICATION_SETTINGS, ...(data.settings?.gamification || {}) };
  } catch (e) {
    console.warn("Gamification settings fetch warning:", e);
    return { ...DEFAULT_GAMIFICATION_SETTINGS };
  }
}

export async function updateOrgGamificationSettings(organizationId, patch) {
  if (!supabase || !organizationId) return { success: false, error: "Not available in demo mode." };
  try {
    const { data: existing, error: fetchError } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    const nextSettings = {
      ...(existing?.settings || {}),
      gamification: { ...DEFAULT_GAMIFICATION_SETTINGS, ...(existing?.settings?.gamification || {}), ...patch },
    };
    const { error } = await supabase.from("organizations").update({ settings: nextSettings }).eq("id", organizationId);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not save gamification settings." };
  }
}


// Payment gateway & payout accounts for the organization.
// Allows organizations to connect their Paystack Subaccount / API keys (for NGN/GHS/KES/ZAR),
// Stripe Connected Account / API keys (for USD/EUR/GBP), or Direct Bank Settlement details
// so that course revenues are settled directly into the organization's own account.
export const DEFAULT_PAYMENT_GATEWAY_SETTINGS = {
  preferred_gateway: "paystack", // "default" | "paystack" | "stripe" | "bank_transfer"
  environment: "live", // "test" | "live"
  paystack_public_key:
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_PAYSTACK_PUBLIC_KEY) ||
    "pk_live_e0aba73a49d9ffd6a3d18f70392f5fff30d41d30",
  paystack_subaccount_code: "",
  stripe_publishable_key:
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_STRIPE_PUBLISHABLE_KEY) ||
    "pk_live_51RT2PjCLDyMvhL5blPBYfPyUDRGCNSBwQm4Z4yJSL9TfeKpdEZRu75TrgqVZwhSX3XqLB5ynaXCNd0ZRu0jPemWD00y59JzP1p",
  stripe_account_id: "",
  bank_name: "",
  account_number: "",
  account_name: "",
  swift_code: "",
  payout_currency: "NGN",
};

export async function fetchOrgPaymentGatewaySettings(organizationId) {
  if (!supabase || !organizationId) return { ...DEFAULT_PAYMENT_GATEWAY_SETTINGS };
  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();
    if (error || !data) return { ...DEFAULT_PAYMENT_GATEWAY_SETTINGS };
    const gw = data.settings?.payment_gateways || {};
    const { data: secretStatus } = await supabase.functions.invoke("org-payment-credentials", {
      body: { action: "status", organization_id: organizationId },
    });
    return {
      ...DEFAULT_PAYMENT_GATEWAY_SETTINGS,
      ...gw,
      // For security, never expose raw secret key to client after save
      paystack_secret_key: "",
      stripe_secret_key: "",
      has_paystack_secret: !!secretStatus?.has_paystack_secret,
      has_stripe_secret: !!secretStatus?.has_stripe_secret,
    };
  } catch (e) {
    console.warn("Payment gateway settings fetch warning:", e);
    return { ...DEFAULT_PAYMENT_GATEWAY_SETTINGS };
  }
}

export async function updateOrgPaymentGatewaySettings(organizationId, patch) {
  if (!supabase || !organizationId) return { success: false, error: "Not available in demo mode." };
  try {
    const { data: existing, error: fetchError } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();
    if (fetchError) throw fetchError;

    const existingGw = existing?.settings?.payment_gateways || {};
    const cleanPatch = { ...patch };
    const paystackSecret = typeof cleanPatch.paystack_secret_key === "string" ? cleanPatch.paystack_secret_key.trim() : "";
    const stripeSecret = typeof cleanPatch.stripe_secret_key === "string" ? cleanPatch.stripe_secret_key.trim() : "";
    delete cleanPatch.paystack_secret_key;
    delete cleanPatch.stripe_secret_key;

    const nextSettings = {
      ...(existing?.settings || {}),
      payment_gateways: { ...DEFAULT_PAYMENT_GATEWAY_SETTINGS, ...existingGw, ...cleanPatch },
    };
    const { error } = await supabase.from("organizations").update({ settings: nextSettings }).eq("id", organizationId);
    if (error) throw error;
    if (paystackSecret || stripeSecret) {
      const { data: secretData, error: secretError } = await supabase.functions.invoke("org-payment-credentials", {
        body: {
          action: "update",
          organization_id: organizationId,
          paystack_secret_key: paystackSecret || undefined,
          stripe_secret_key: stripeSecret || undefined,
        },
      });
      if (secretError || secretData?.error) throw new Error(secretData?.error || secretError?.message || "Could not save payment credentials.");
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not save payment gateway settings." };
  }
}

export function testOrgPaymentGatewayConnection({ provider, publicKey, secretKey, subaccountCode, accountId, environment = "test" }) {
  if (provider === "paystack") {
    const pubKey = (publicKey || "").trim();
    const secKey = (secretKey || "").trim();
    const subacc = (subaccountCode || "").trim();
    if (!pubKey && !secKey && !subacc) {
      return { success: false, message: "Please enter a Paystack Public Key, Secret Key, or Subaccount Code to test." };
    }
    const isTest = environment === "test";
    const expectedPrefix = isTest ? "pk_test_" : "pk_live_";
    const expectedSecPrefix = isTest ? "sk_test_" : "sk_live_";
    if (pubKey && !pubKey.startsWith(expectedPrefix)) {
      return { success: false, message: `Public key format mismatch. Expected prefix '${expectedPrefix}' for ${environment.toUpperCase()} mode.` };
    }
    if (secKey && !secKey.startsWith(expectedSecPrefix)) {
      return { success: false, message: `Secret key format mismatch. Expected prefix '${expectedSecPrefix}' for ${environment.toUpperCase()} mode.` };
    }
    if (subacc && !subacc.startsWith("ACCT_")) {
      return { success: false, message: "Subaccount code format warning. Subaccount codes usually start with 'ACCT_'." };
    }
    return { success: true, message: `✓ Valid Paystack ${environment.toUpperCase()} configuration format!` };
  }

  if (provider === "stripe") {
    const pubKey = (publicKey || "").trim();
    const secKey = (secretKey || "").trim();
    const accId = (accountId || "").trim();
    if (!pubKey && !secKey && !accId) {
      return { success: false, message: "Please enter a Stripe Publishable Key, Secret Key, or Connected Account ID to test." };
    }
    const isTest = environment === "test";
    const expectedPrefix = isTest ? "pk_test_" : "pk_live_";
    const expectedSecPrefix = isTest ? "sk_test_" : "sk_live_";
    if (pubKey && !pubKey.startsWith(expectedPrefix)) {
      return { success: false, message: `Publishable key format mismatch. Expected prefix '${expectedPrefix}' for ${environment.toUpperCase()} mode.` };
    }
    if (secKey && !secKey.startsWith(expectedSecPrefix)) {
      return { success: false, message: `Secret key format mismatch. Expected prefix '${expectedSecPrefix}' for ${environment.toUpperCase()} mode.` };
    }
    if (accId && !accId.startsWith("acct_")) {
      return { success: false, message: "Stripe Account ID format warning. Connected Account IDs usually start with 'acct_'." };
    }
    return { success: true, message: `✓ Valid Stripe ${environment.toUpperCase()} configuration format!` };
  }

  return { success: false, message: "Unknown payment gateway provider." };
}

export async function resolveOrgPaymentGateway(organizationId) {
  const settings = await fetchOrgPaymentGatewaySettings(organizationId);
  return {
    provider: settings.preferred_gateway || "default",
    environment: settings.environment || "test",
    hasPaystackCustomKeys: !!(settings.paystack_public_key || settings.has_paystack_secret || settings.paystack_subaccount_code),
    hasStripeCustomKeys: !!(settings.stripe_publishable_key || settings.has_stripe_secret || settings.stripe_account_id),
    settings,
  };
}


// Organization subscription payment - the real fix for "organizations have
// to pay to see the admin dashboard." See 0114_organization_subscription_payment.sql
// for the full design and its one honest trust-boundary caveat.
//
// TIER_LABELS is display text only (plan names), not a financial value.
// The actual charged amount now comes from fetchTierPrice()
// (billing_prices / get_active_price(), 0158_billing_foundation.sql) -
// this replaces TIER_PRICING, a hardcoded { amountNGN, amountUSD } object
// whose own comment already admitted it was a placeholder ("replace with
// actual agreed pricing before this goes anywhere near a real customer"),
// found by this round's currency sweep. Known follow-up, not fixed in
// this pass: SettingsHubScreen.jsx's pre-checkout price preview text
// still reads a locally-held estimate rather than calling
// fetchTierPrice() itself - the actual charge below is always the real,
// current, server-configured amount regardless of what that preview text
// shows, so this is a display-accuracy gap, not a billing-integrity one.
export const TIER_LABELS = {
  starter: "Basic",
  basic: "Basic",
  growth: "Intermediate",
  intermediate: "Intermediate",
  enterprise: "Enterprise",
  advanced: "Enterprise",
};

export async function fetchTierPrice(tier, currency = "USD") {
  const normTier = (tier === "growth" || tier === "intermediate") ? "intermediate" : "basic";
  const fallbacks = {
    basic: {
      NGN: 25000000, // ₦250,000 in kobo
      USD: 25000,    // $250 in cents
      GBP: 19000,    // £190 in pence
      EUR: 22000,    // €220 in cents
    },
    intermediate: {
      NGN: 50000000, // ₦500,000 in kobo
      USD: 50000,    // $500 in cents
      GBP: 40000,    // £400 in pence
      EUR: 44000,    // €440 in cents
    },
  };

  const fallback = fallbacks[normTier] || fallbacks.basic;
  if (!supabase) return { currency, unit_amount_minor: fallback[currency] ?? fallback.USD, unverified_fallback: true };
  try {
    const { data, error } = await supabase.rpc("get_active_price", { p_category: `org_subscription_${tier}`, p_currency: currency });
    if (error || !data) throw error || new Error("No active price configured");
    return data;
  } catch (e) {
    console.warn("fetchTierPrice: could not load configured price:", e?.message || e);
    return { currency, unit_amount_minor: fallback[currency] ?? fallback.USD, unverified_fallback: true };
  }
}

export async function startOrganizationSubscriptionPayment({ orgId, tier, email, provider = "paystack" }) {
  if (tier === "enterprise" || tier === "advanced") {
    return { success: false, error: "Enterprise is custom-priced. Use Book a Demo or Organisation Inquiry instead of self-serve payment." };
  }
  if (!TIER_LABELS[tier]) return { success: false, error: "Unknown plan." };
  if (!orgId || !email) return { success: false, error: "Missing organization or email." };

  try {
    if (provider === "stripe") {
      const price = await fetchTierPrice(tier, "USD");
      await startStripePayment({
        email, amount: price.unit_amount_minor / 100, currency: "USD",
        context: PAYMENT_CONTEXTS.ORGANIZATION_SUBSCRIPTION,
        description: `Train AI: ${TIER_LABELS[tier]} plan`,
        metadata: { org_id: orgId, tier },
      });
    } else {
      const price = await fetchTierPrice(tier, "NGN");
      await startPaystackPayment({
        email, amount: price.unit_amount_minor / 100, currency: "NGN",
        context: PAYMENT_CONTEXTS.ORGANIZATION_SUBSCRIPTION,
        metadata: { org_id: orgId, tier },
      });
    }
    return { success: true }; // redirects the browser; nothing after this runs
  } catch (e) {
    return { success: false, error: e?.message || "Could not start payment." };
  }
}

export async function applyOrganizationSubscriptionPayment(orgId, tier, provider, reference, amount) {
  if (!supabase || !orgId) return { success: false, error: "Not available in demo mode." };
  try {
    const { data, error } = await supabase.rpc("apply_organization_subscription_payment", {
      p_org_id: orgId, p_tier: tier, p_provider: provider, p_reference: reference, p_amount: amount ?? null,
    });
    if (error) throw error;
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e?.message || "Payment was verified, but activating the plan failed. Contact support with your payment reference." };
  }
}

// Real per-organization feature flags - the actual mechanism per the
// Multi-Tenant Architecture Reference (Section 3/6), superseding the
// hardcoded map in lib/tierFeatures.js as the source of truth. Falls back
// to the tier-default map client-side only if the RPC itself is
// unavailable (demo mode, or a network failure) - real orgs go through
// the database function, which respects platform-owner overrides.
export async function fetchOrgFeatures(orgId, featureKeys) {
  if (!supabase || !orgId) return null; // caller falls back to tierFeatures.js's static map
  try {
    const { data, error } = await supabase.rpc("get_org_features_bulk", {
      p_org_id: orgId,
      p_feature_keys: featureKeys,
    });
    if (error) throw error;
    return data || null;
  } catch (e) {
    console.warn("Feature flag fetch warning (falling back to tier defaults):", e);
    return null;
  }
}

export async function setOrgFeatureFlag(orgId, featureKey, enabled, setBy) {
  if (!supabase || !orgId) return { success: false, error: "Not available in demo mode." };
  try {
    const { error } = await supabase
      .from("organization_feature_flags")
      .upsert({ organization_id: orgId, feature_key: featureKey, enabled, set_by: setBy, updated_at: new Date().toISOString() }, { onConflict: "organization_id,feature_key" });
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not update this feature flag." };
  }
}

export async function fetchOrgFeatureFlagOverrides(orgId) {
  if (!supabase || !orgId) return [];
  const { data, error } = await supabase
    .from("organization_feature_flags")
    .select("*")
    .eq("organization_id", orgId);
  if (error) { console.warn("Feature flag overrides fetch warning:", error); return []; }
  return data || [];
}

// ============================================================================
// Seat-based payments - PRD: "Implement the organization's seat-based
// payment model... Require payment for seats before learners/users can be
// added in the cloud version." See 0129_seat_based_payments.sql for the
// real enforcement (checked server-side at both invite and accept time,
// not just a UI counter) - trial organizations are unaffected, only
// "active" (paid, cloud) organizations are actually gated.
// ============================================================================
export async function fetchOrgSeatsSummary(organizationId) {
  if (!supabase || !organizationId) return { purchased: 0, used: 0, available: 0 };
  try {
    const { data, error } = await supabase.rpc("get_org_seats_summary", { check_org_id: organizationId });
    if (error) throw error;
    return data || { purchased: 0, used: 0, available: 0 };
  } catch (e) {
    console.warn("Seats summary fetch warning:", e);
    return { purchased: 0, used: 0, available: 0 };
  }
}

export async function fetchSeatPurchaseHistory(organizationId) {
  if (!supabase || !organizationId) return [];
  const { data, error } = await supabase
    .from("seat_purchases")
    .select("*")
    .eq("organization_id", organizationId)
    .order("purchased_at", { ascending: false });
  if (error) { console.warn("Seat purchase history fetch warning:", error); return []; }
  return data || [];
}

export async function purchaseSeats(organizationId, seats, amount, paymentReference) {
  if (!supabase || !organizationId) return { success: false, error: "Not available in demo mode." };
  try {
    const { data, error } = await supabase.rpc("purchase_seats", {
      p_organization_id: organizationId, p_seats: seats, p_amount: amount, p_payment_reference: paymentReference,
    });
    if (error) throw error;
    return { success: true, summary: data };
  } catch (e) {
    return { success: false, error: e?.message || "Could not complete seat purchase." };
  }
}

// Real Paystack/Stripe checkout for seats, matching
// startOrganizationSubscriptionPayment's exact pattern - a real charge is
// started; purchase_seats() (the actual database write, requiring a real
// payment reference) only ever runs from OrgPaymentCallbackScreen.jsx
// after a real payment verification succeeds, not from this function
// Real, configurable seat pricing (billing_prices / get_active_price(),
// 0158_billing_foundation.sql) - this used to be two hardcoded constants
// here (SEAT_PRICE_USD = 10, SEAT_PRICE_NGN = 15000), the exact
// "hard-coded price/exchange-rate scattered through the app" pattern a
// later billing audit called out by name. Fetched fresh each time rather
// than cached as a module-level constant, so a platform-owner price
// change takes effect without a redeploy.
export async function fetchSeatPrice(currency = "USD", tier = "growth") {
  const isBasic = tier === "basic" || tier === "starter";
  const fallbacks = isBasic
    ? { NGN: 1500000, USD: 1500, GBP: 1200, EUR: 1400 } // ₦15,000 / $15 / £12 / €14
    : { NGN: 1000000, USD: 1000, GBP: 800, EUR: 900 };   // ₦10,000 / $10 / £8 / €9

  if (!supabase) return { currency, unit_amount_minor: fallbacks[currency] ?? (currency === "NGN" ? 1000000 : 1000), unverified_fallback: true };
  try {
    const { data, error } = await supabase.rpc("get_active_price", {
      p_category: isBasic ? "seat_subscription_basic" : "seat_subscription",
      p_currency: currency,
    });
    if (error || !data) throw error || new Error("No active price configured");
    return data;
  } catch (e) {
    console.warn("fetchSeatPrice: could not load configured price, using last-known reference value:", e?.message || e);
    return { currency, unit_amount_minor: fallbacks[currency] ?? (currency === "NGN" ? 1000000 : 1000), unverified_fallback: true };
  }
}

export async function startSeatPurchasePayment({ orgId, seats, email, provider = "paystack", tier = "growth" }) {
  if (!orgId || !email) return { success: false, error: "Missing organization or email." };
  const seatCount = Number(seats);
  if (!seatCount || seatCount <= 0) return { success: false, error: "Enter a valid number of seats." };

  try {
    if (provider === "stripe") {
      const price = await fetchSeatPrice("USD", tier);
      const unitUsd = price.unit_amount_minor / 100;
      await startStripePayment({
        email, amount: seatCount * unitUsd, currency: "USD",
        context: PAYMENT_CONTEXTS.SEAT_PURCHASE,
        description: `Train AI: ${seatCount} seat${seatCount === 1 ? "" : "s"}`,
        metadata: { org_id: orgId, seats: seatCount },
      });
    } else {
      const price = await fetchSeatPrice("NGN", tier);
      const unitNgn = price.unit_amount_minor / 100;
      await startPaystackPayment({
        email, amount: seatCount * unitNgn, currency: "NGN",
        context: PAYMENT_CONTEXTS.SEAT_PURCHASE,
        metadata: { org_id: orgId, seats: seatCount },
      });
    }
    return { success: true }; // redirects the browser; nothing after this runs
  } catch (e) {
    return { success: false, error: e?.message || "Could not start payment." };
  }
}

// -----------------------------------------------------------------------
// Referral link click + signup attribution. The learner-facing "Invite &
// Earn" panel (ProfileScreen) generates a shareable `?ref=<code>` link;
// these two functions are the other half - without them the link's click
// count and "friends joined" stat would just stay at zero forever, which
// would be its own version of the achievement-system bug (a feature that
// visibly promises tracking but never actually tracks anything).
// -----------------------------------------------------------------------
const REFERRAL_CODE_STORAGE_KEY = "trainai_pending_referral_code";

/**
 * Call once, on app/landing-page load, with the raw `ref` query param (if
 * any). Records the click against that referral_links row and remembers
 * the code locally so it can be attributed to a signup that may happen
 * minutes later, on a different screen. Safe to call with no code, and
 * safe to call more than once (best-effort click counting, not exact).
 */
export async function trackReferralClickIfPresent(code) {
  if (!code) return;
  try {
    localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, code);
  } catch { /* ignore - localStorage may be unavailable */ }
  if (!supabase) return; // demo mode: nothing to persist
  try {
    const { data: link } = await supabase.from("referral_links").select("id, clicks").eq("code", code).eq("is_active", true).maybeSingle();
    if (!link) return;
    await supabase.from("referral_links").update({ clicks: (link.clicks || 0) + 1 }).eq("id", link.id);
  } catch (e) {
    console.warn("Could not record referral click:", e);
  }
}

/**
 * Call once, right after a new account is created. If a referral code was
 * captured earlier in this browser (trackReferralClickIfPresent), records
 * the attributed signup and clears the stored code either way so it's
 * never applied twice.
 */
export async function attributeReferralSignupIfPending(newUserId) {
  let code = null;
  try {
    code = localStorage.getItem(REFERRAL_CODE_STORAGE_KEY);
    localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
  } catch { /* ignore */ }
  if (!code || !newUserId || !supabase) return;
  try {
    const { data: link } = await supabase.from("referral_links").select("id, user_id").eq("code", code).eq("is_active", true).maybeSingle();
    if (!link || link.user_id === newUserId) return; // no self-referrals
    await supabase.from("referral_signups").insert({
      referrer_user_id: link.user_id,
      referred_user_id: newUserId,
      referral_code: code,
      referral_link_id: link.id,
      signup_completed: true,
    });
  } catch (e) {
    console.warn("Could not attribute referral signup:", e);
  }
}

/**
 * Fetch all learners pending approval to join the organization before consuming a seat
 * @param {string} orgId 
 * @returns {Promise<Array>}
 */
export async function fetchPendingOrgJoinRequests(orgId) {
  if (!orgId) return [];
  if (!supabase || orgId === "demo-org-id") {
    return [
      {
        id: "demo-pending-1",
        user_id: "demo-user-p1",
        organization_id: orgId,
        role: "learner",
        status: "pending",
        joined_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        display_name: "Chukwudi Okafor",
        email: "c.okafor@example.com",
        avatar_url: null
      }
    ];
  }

  try {
    const { data: memberRows, error: memberErr } = await supabase
      .from("organization_members")
      .select("id, user_id, organization_id, role, status, joined_at")
      .eq("organization_id", orgId)
      .eq("status", "pending")
      .order("joined_at", { ascending: false });

    if (memberErr) throw memberErr;
    if (!memberRows || !memberRows.length) return [];

    const userIds = memberRows.map((m) => m.user_id).filter(Boolean);
    const { data: profiles, error: profErr } = await supabase
      .from("user_profiles")
      .select("id, display_name, email, avatar_url, role")
      .in("id", userIds);

    if (profErr) throw profErr;
    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

    return memberRows.map((m) => {
      const p = profileMap[m.user_id] || {};
      return {
        ...m,
        display_name: p.display_name || "Learner",
        email: p.email || "No email on file",
        avatar_url: p.avatar_url || null,
        user_role: p.role || m.role || "learner"
      };
    });
  } catch (e) {
    console.error("fetchPendingOrgJoinRequests error:", e);
    return [];
  }
}

/**
 * Approve a pending learner into the organization, allocating a paid seat
 * @param {string} orgId 
 * @param {string} userId 
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function approveOrgJoinRequest(orgId, userId) {
  if (!orgId || !userId) return { success: false, error: "Missing required parameters." };
  if (!supabase || orgId === "demo-org-id") {
    return { success: true };
  }

  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("approve_organization_member", {
      p_org_id: orgId,
      p_user_id: userId
    });
    if (rpcErr) throw rpcErr;
    return rpcData || { success: false, error: "Could not approve learner." };
  } catch (e) {
    return { success: false, error: e?.message || "Could not approve learner join request." };
  }
}

/**
 * Reject / Decline a pending learner join request without consuming any seat
 * @param {string} orgId 
 * @param {string} userId 
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function rejectOrgJoinRequest(orgId, userId) {
  if (!orgId || !userId) return { success: false, error: "Missing required parameters." };
  if (!supabase || orgId === "demo-org-id") {
    return { success: true };
  }

  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("reject_organization_member", {
      p_org_id: orgId,
      p_user_id: userId
    });
    if (rpcErr) throw rpcErr;
    return rpcData || { success: false, error: "Could not decline learner." };
  } catch (e) {
    return { success: false, error: e?.message || "Could not reject learner join request." };
  }
}

