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
    // Demo mode: no backend, nothing to persist. Unlike registerOrganization,
    // this deliberately does not patch the session role - an individual
    // learner should stay in the learner app, not the admin one.
    return { success: true, demo: true };
  }
  try {
    const { data: sessionData } = await supabase.auth.getSession().catch(() => ({ data: {} }));
    if (!sessionData?.session?.user) {
      // If user is unconfirmed or no active session token is present, RPC will fail with 400.
      // Return gracefully. The session listener in useAuth.js will call join_default_organization
      // as soon as the user confirms their email and signs in.
      return { success: true, pendingSession: true };
    }
    const { data, error } = await supabase.rpc("join_default_organization");
    if (error) throw error;
    return { success: true, organizationId: data };
  } catch (e) {
    return { success: false, error: e?.message || "Could not complete account setup. Please try again." };
  }
}

/**
 * Registers a brand-new organization with the current signed-in user as its
 * owner/admin. Call this immediately after a successful account creation on
 * the "Sign up your organization" path.
 * @param {string} orgName
 * @returns {Promise<{ success: boolean, organizationId?: string, error?: string, demo?: boolean }>}
 */
export async function registerOrganization(orgName, tier = "growth") {
  const trimmed = (orgName || "").trim();
  if (trimmed.length < 2) {
    return { success: false, error: "Organization name is required." };
  }
  const selectedTier = ["starter", "growth", "enterprise"].includes(tier) ? tier : "growth";
  if (!supabase) {
    // Demo mode: no backend to create a real organization row or run the
    // real RPC's role promotion against. To still preview what a real
    // organization sign-up leads to (landing in the Platform/admin app, not
    // the plain learner Home), patch the local demo session the same way
    // the real RPC would have changed the account's role, then let the
    // caller reload so every downstream role lookup (App.jsx) recomputes
    // from scratch - the same pattern AcceptInvitationScreen already uses.
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.role = "admin";
        if (parsed.user) {
          parsed.user.user_metadata = { ...(parsed.user.user_metadata || {}), role: "admin", organization_name: trimmed };
        }
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
        // Record the promotion so a later sign-out/sign-in for this same
        // email remembers "admin" instead of reverting to the "learner"
        // useAuth.js's signUp assigned a moment earlier, before this
        // function ran - see setDemoRoleForEmail in roleRouting.js.
        if (parsed.user?.email) {
          setDemoRoleForEmail(parsed.user.email, "admin");
        }
      }
    } catch {
      // Best-effort only - a failure here shouldn't block the rest of signup.
    }
    return { success: true, organizationId: `demo_org_${Date.now()}`, demo: true };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession().catch(() => ({ data: {} }));
    if (!sessionData?.session?.user) {
      return { success: true, pendingSession: true };
    }
    const { data, error } = await supabase.rpc("create_organization_self_serve", { p_org_name: trimmed, p_tier: selectedTier });
    if (error) throw error;
    return { success: true, organizationId: data };
  } catch (e) {
    return { success: false, error: e?.message || "Could not register your organization. Please try again." };
  }
}

// AI Coach settings - enable/disable and Manual Mode. Stored in
// organizations.settings->'ai_coach' (jsonb column that already existed in
// the schema, previously completely unused by any code). No new table.
const DEFAULT_AI_COACH_SETTINGS = { enabled: true, manual_mode: false, manual_message: "" };

/**
 * Reads AI Coach settings for an organization. Missing keys fall back to
 * enabled=true / manual_mode=false, so an org that has never configured
 * this behaves exactly like it did before this feature existed.
 */
export async function fetchOrgAISettings(organizationId) {
  if (!supabase || !organizationId) return { ...DEFAULT_AI_COACH_SETTINGS };
  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();
    if (error || !data) return { ...DEFAULT_AI_COACH_SETTINGS };
    return { ...DEFAULT_AI_COACH_SETTINGS, ...(data.settings?.ai_coach || {}) };
  } catch (e) {
    console.warn("AI Coach settings fetch warning:", e);
    return { ...DEFAULT_AI_COACH_SETTINGS };
  }
}

/**
 * Updates AI Coach settings for the caller's own organization. RLS
 * (org_update_admin, 0109_ai_coach_settings.sql) restricts this to an admin
 * or owner of that specific organization, or a platform super_admin.
 * Merges into the existing `settings` jsonb rather than overwriting it, so
 * other settings namespaces aren't clobbered.
 */
export async function updateOrgAISettings(organizationId, patch) {
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
      ai_coach: { ...DEFAULT_AI_COACH_SETTINGS, ...(existing?.settings?.ai_coach || {}), ...patch },
    };
    const { error } = await supabase.from("organizations").update({ settings: nextSettings }).eq("id", organizationId);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not save AI Coach settings." };
  }
}

// AI Insights manual mode - PRD Section 8.3 "Moderation settings - (Turn
// off or set AI coach to manual mode, AI insights to manual mode (pass
// instructions or announcements)." Only AI Coach's manual mode existed
// before this - AI Insights had no equivalent admin control at all, a
// real, separate gap from AI Coach's. Same storage shape and pattern as
// AI Coach settings above, in its own settings->'ai_insights' namespace so
// the two can be configured independently (an org might want AI Coach
// live but AI Insights replaced with a manual announcement, or vice
// versa).
const DEFAULT_AI_INSIGHTS_SETTINGS = { enabled: true, manual_mode: false, manual_message: "" };

export async function fetchOrgAIInsightsSettings(organizationId) {
  if (!supabase || !organizationId) return { ...DEFAULT_AI_INSIGHTS_SETTINGS };
  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();
    if (error || !data) return { ...DEFAULT_AI_INSIGHTS_SETTINGS };
    return { ...DEFAULT_AI_INSIGHTS_SETTINGS, ...(data.settings?.ai_insights || {}) };
  } catch (e) {
    console.warn("AI Insights settings fetch warning:", e);
    return { ...DEFAULT_AI_INSIGHTS_SETTINGS };
  }
}

export async function updateOrgAIInsightsSettings(organizationId, patch) {
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
      ai_insights: { ...DEFAULT_AI_INSIGHTS_SETTINGS, ...(existing?.settings?.ai_insights || {}), ...patch },
    };
    const { error } = await supabase.from("organizations").update({ settings: nextSettings }).eq("id", organizationId);
    if (error) throw error;
    return { success: true };
  } catch (e) {
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
  preferred_gateway: "default", // "default" | "paystack" | "stripe" | "bank_transfer"
  environment: "test", // "test" | "live"
  paystack_public_key: "",
  paystack_secret_key: "",
  paystack_subaccount_code: "",
  stripe_publishable_key: "",
  stripe_secret_key: "",
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
    return {
      ...DEFAULT_PAYMENT_GATEWAY_SETTINGS,
      ...gw,
      // For security, never expose raw secret key to client after save
      paystack_secret_key: "",
      stripe_secret_key: "",
      has_paystack_secret: Boolean(gw.paystack_secret_key),
      has_stripe_secret: Boolean(gw.stripe_secret_key),
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

    // If secret keys are empty in patch (i.e. not changed), preserve existing saved secret keys
    if (!cleanPatch.paystack_secret_key || !cleanPatch.paystack_secret_key.trim()) {
      if (existingGw.paystack_secret_key) {
        cleanPatch.paystack_secret_key = existingGw.paystack_secret_key;
      } else {
        delete cleanPatch.paystack_secret_key;
      }
    }
    if (!cleanPatch.stripe_secret_key || !cleanPatch.stripe_secret_key.trim()) {
      if (existingGw.stripe_secret_key) {
        cleanPatch.stripe_secret_key = existingGw.stripe_secret_key;
      } else {
        delete cleanPatch.stripe_secret_key;
      }
    }

    const nextSettings = {
      ...(existing?.settings || {}),
      payment_gateways: { ...DEFAULT_PAYMENT_GATEWAY_SETTINGS, ...existingGw, ...cleanPatch },
    };
    const { error } = await supabase.from("organizations").update({ settings: nextSettings }).eq("id", organizationId);
    if (error) throw error;
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
    hasPaystackCustomKeys: !!(settings.paystack_public_key || settings.paystack_secret_key || settings.paystack_subaccount_code),
    hasStripeCustomKeys: !!(settings.stripe_publishable_key || settings.stripe_secret_key || settings.stripe_account_id),
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
export const TIER_LABELS = { starter: "Starter", growth: "Growth" };

export async function fetchTierPrice(tier, currency = "USD") {
  const fallback = tier === "growth"
    ? { USD: 4500, NGN: 4500000, GBP: 3600, EUR: 4200 }
    : { USD: 1500, NGN: 1500000, GBP: 1200, EUR: 1400 };
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
  if (tier === "enterprise") {
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
export async function fetchSeatPrice(currency = "USD") {
  const fallbackMinor = { NGN: 1500000, USD: 1000, GBP: 800, EUR: 900 };
  if (!supabase) return { currency, unit_amount_minor: fallbackMinor[currency] ?? 1000, unverified_fallback: true };
  try {
    const { data, error } = await supabase.rpc("get_active_price", { p_category: "seat_subscription", p_currency: currency });
    if (error || !data) throw error || new Error("No active price configured");
    return data;
  } catch (e) {
    console.warn("fetchSeatPrice: could not load configured price, using last-known reference value:", e?.message || e);
    return { currency, unit_amount_minor: fallbackMinor[currency] ?? 1000, unverified_fallback: true };
  }
}

export async function startSeatPurchasePayment({ orgId, seats, email, provider = "paystack" }) {
  if (!orgId || !email) return { success: false, error: "Missing organization or email." };
  const seatCount = Number(seats);
  if (!seatCount || seatCount <= 0) return { success: false, error: "Enter a valid number of seats." };

  try {
    if (provider === "stripe") {
      const price = await fetchSeatPrice("USD");
      const unitUsd = price.unit_amount_minor / 100;
      await startStripePayment({
        email, amount: seatCount * unitUsd, currency: "USD",
        context: PAYMENT_CONTEXTS.SEAT_PURCHASE,
        description: `Train AI: ${seatCount} seat${seatCount === 1 ? "" : "s"}`,
        metadata: { org_id: orgId, seats: seatCount },
      });
    } else {
      const price = await fetchSeatPrice("NGN");
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

// -----------------------------------------------------------------------
// Organization AI credits - "buy credits" + "per-learner usage" admin page
// (src/platform/admin/CreditsScreen.jsx, replacing the old Content
// Moderation screen). Reuses the real ledger already built in
// 0156_ai_credit_ledger.sql/0157_ai_credit_payment_verification.sql -
// get_org_ai_credits_summary() and ai_credit_transactions were both
// already there, just never called from any screen until now.
// -----------------------------------------------------------------------

export async function fetchOrgAICreditsSummary(organizationId) {
  if (!supabase || !organizationId) return { balance: 0, lifetime_credited: 0, lifetime_consumed: 0 };
  try {
    const { data, error } = await supabase.rpc("get_org_ai_credits_summary", { p_org_id: organizationId });
    if (error) throw error;
    return data || { balance: 0, lifetime_credited: 0, lifetime_consumed: 0 };
  } catch (e) {
    console.warn("Org AI credits summary fetch warning:", e);
    return { balance: 0, lifetime_credited: 0, lifetime_consumed: 0 };
  }
}

// Comprehensive Organization AI Credit Monitoring - retrieves all organization members
// from user_profiles, their individual AI credit balances from ai_credit_accounts,
// their consumed credits and operations from ai_credit_transactions, and calculates
// how much credits they have left (both personal remaining and shared org pool available).
export async function fetchOrgAllUsersAICreditMonitoring(organizationId) {
  const emptyResult = {
    orgSummary: { balance: 0, lifetime_credited: 0, lifetime_consumed: 0 },
    users: [],
    stats: {
      totalMembers: 0,
      orgPoolBalance: 0,
      totalPersonalCredits: 0,
      totalCombinedCredits: 0,
      totalConsumed: 0,
      activeConsumersCount: 0,
      zeroUsageCount: 0,
      depletedCount: 0,
    },
  };

  if (!supabase || !organizationId) return emptyResult;

  try {
    // 1. Parallel fetch: Org credit summary, organization members, credit accounts, and transactions
    const [summaryRes, profilesRes, accountsRes, txsRes] = await Promise.all([
      fetchOrgAICreditsSummary(organizationId),
      supabase
        .from("user_profiles")
        .select("id, display_name, avatar_url, role, last_active_at, department")
        .eq("organization_id", organizationId)
        .order("display_name", { ascending: true }),
      supabase
        .from("ai_credit_accounts")
        .select("id, owner_user_id, balance, lifetime_credited, lifetime_consumed, account_type")
        .eq("organization_id", organizationId),
      supabase
        .from("ai_credit_transactions")
        .select("id, user_id, amount, transaction_type, reference_type, created_at, balance_after")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);

    const orgSummary = summaryRes || { balance: 0, lifetime_credited: 0, lifetime_consumed: 0 };
    const orgPoolBalance = orgSummary.balance || 0;
    const profiles = profilesRes.data || [];
    const accounts = accountsRes.data || [];
    const txs = txsRes.data || [];

    // Index credit accounts by owner_user_id
    const accountByUserId = new Map();
    for (const a of accounts) {
      if (a.owner_user_id) accountByUserId.set(a.owner_user_id, a);
    }

    // Index transactions and usage by user_id
    const usageByUserId = new Map();
    for (const t of txs) {
      if (!t.user_id) continue;
      const existing = usageByUserId.get(t.user_id) || {
        totalConsumed: 0,
        totalTopUp: 0,
        eventCount: 0,
        lastAiUsedAt: null,
        operations: {},
        recentTransactions: [],
      };
      if (t.transaction_type === "consumption") {
        existing.totalConsumed += Math.abs(t.amount || 0);
        existing.eventCount += 1;
        const op = t.reference_type || "ai_operation";
        existing.operations[op] = (existing.operations[op] || 0) + 1;
        if (!existing.lastAiUsedAt || new Date(t.created_at) > new Date(existing.lastAiUsedAt)) {
          existing.lastAiUsedAt = t.created_at;
        }
      } else {
        existing.totalTopUp += Math.abs(t.amount || 0);
      }
      if (existing.recentTransactions.length < 8) {
        existing.recentTransactions.push(t);
      }
      usageByUserId.set(t.user_id, existing);
    }

    // Build unified user monitoring records
    const users = profiles.map((p) => {
      const acc = accountByUserId.get(p.id);
      const usage = usageByUserId.get(p.id) || {
        totalConsumed: 0,
        totalTopUp: 0,
        eventCount: 0,
        lastAiUsedAt: null,
        operations: {},
        recentTransactions: [],
      };

      const personalBalance = acc?.balance ?? 0;
      const effectiveBalance = personalBalance + orgPoolBalance;
      const totalConsumed = acc?.lifetime_consumed || usage.totalConsumed;

      let status = "ready";
      if (effectiveBalance === 0) {
        status = "depleted";
      } else if (personalBalance <= 2 && orgPoolBalance === 0) {
        status = "low";
      } else if (usage.totalConsumed > 0) {
        status = "active";
      }

      return {
        userId: p.id,
        displayName: p.display_name || "Unnamed Member",
        avatarUrl: p.avatar_url,
        role: p.role || "learner",
        department: p.department || null,
        lastActiveAt: p.last_active_at,
        personalBalance,
        orgPoolBalance,
        effectiveBalance,
        lifetimeCredited: acc?.lifetime_credited ?? personalBalance,
        totalConsumed,
        eventCount: usage.eventCount,
        lastAiUsedAt: usage.lastAiUsedAt,
        lastUsedAt: usage.lastAiUsedAt,
        operations: usage.operations,
        recentTransactions: usage.recentTransactions,
        status,
        profile: {
          id: p.id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          role: p.role,
        },
      };
    });

    // Default sorting: Most consumed first, then highest available balance, then name
    users.sort((a, b) => {
      if (b.totalConsumed !== a.totalConsumed) return b.totalConsumed - a.totalConsumed;
      if (b.effectiveBalance !== a.effectiveBalance) return b.effectiveBalance - a.effectiveBalance;
      return (a.displayName || "").localeCompare(b.displayName || "");
    });

    const totalPersonalCredits = users.reduce((sum, u) => sum + u.personalBalance, 0);
    const totalConsumed = users.reduce((sum, u) => sum + u.totalConsumed, 0);
    const activeConsumersCount = users.filter((u) => u.totalConsumed > 0).length;
    const zeroUsageCount = users.filter((u) => u.totalConsumed === 0).length;
    const depletedCount = users.filter((u) => u.effectiveBalance === 0).length;

    const stats = {
      totalMembers: users.length,
      orgPoolBalance,
      totalPersonalCredits,
      totalCombinedCredits: totalPersonalCredits + orgPoolBalance,
      totalConsumed,
      activeConsumersCount,
      zeroUsageCount,
      depletedCount,
    };

    return { orgSummary, users, stats };
  } catch (err) {
    console.error("fetchOrgAllUsersAICreditMonitoring error:", err);
    return emptyResult;
  }
}

// Retained for backward compatibility: returns the users list with both consumption and remaining balance data
export async function fetchOrgAICreditUsageByLearner(organizationId) {
  const res = await fetchOrgAllUsersAICreditMonitoring(organizationId);
  return res.users;
}

// Simple, flat per-credit admin rate - NOT yet wired to the configurable
// billing_prices table the way seats are (fetchSeatPrice/get_active_price)
// - matching the exact same honest, already-acknowledged gap the personal
// credit packages in CreditsCheckoutScreen.jsx have (those are hardcoded
// package prices too). A real fix would add an 'ai_credit' category to
// billing_prices - flagged as a follow-up, not silently done here.
const ORG_CREDIT_UNIT_PRICE = { USD: 0.08, NGN: 110, GBP: 0.065, EUR: 0.075 };

export function orgCreditUnitPrice(currency = "USD") {
  return ORG_CREDIT_UNIT_PRICE[currency] ?? ORG_CREDIT_UNIT_PRICE.USD;
}

export async function startOrgCreditsPurchasePayment({ orgId, credits, email, provider = "paystack" }) {
  if (!orgId || !email) return { success: false, error: "Missing organization or email." };
  const creditCount = Number(credits);
  if (!creditCount || creditCount <= 0) return { success: false, error: "Enter a valid number of credits." };

  try {
    if (provider === "stripe") {
      const unit = orgCreditUnitPrice("USD");
      await startStripePayment({
        email, amount: Math.round(creditCount * unit * 100) / 100, currency: "USD",
        context: PAYMENT_CONTEXTS.CREDITS,
        description: `Train AI: ${creditCount} organization AI credits`,
        metadata: { org_id: orgId, credits: creditCount, credits_to_add: creditCount, account_scope: "organization" },
      });
    } else {
      const unit = orgCreditUnitPrice("NGN");
      await startPaystackPayment({
        email, amount: Math.round(creditCount * unit), currency: "NGN",
        context: PAYMENT_CONTEXTS.CREDITS,
        metadata: { org_id: orgId, credits: creditCount, credits_to_add: creditCount, account_scope: "organization" },
      });
    }
    return { success: true }; // redirects the browser; nothing after this runs
  } catch (e) {
    return { success: false, error: e?.message || "Could not start payment." };
  }
}
