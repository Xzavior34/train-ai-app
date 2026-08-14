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
export async function registerOrganization(orgName) {
  const trimmed = (orgName || "").trim();
  if (trimmed.length < 2) {
    return { success: false, error: "Organization name is required." };
  }
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
    const { data, error } = await supabase.rpc("create_organization_self_serve", { p_org_name: trimmed });
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

// Organization subscription payment - the real fix for "organizations have
// to pay to see the admin dashboard." See 0114_organization_subscription_payment.sql
// for the full design and its one honest trust-boundary caveat.
//
// PLACEHOLDER PRICING - flagging explicitly rather than inventing real
// numbers silently. The pricing page says "Per user" for Starter/Growth
// with no fixed figure and "Custom" for Enterprise (which is why Enterprise
// is deliberately NOT self-serve-payable below - it routes to Book a
// Demo/Organisation Inquiry instead). These flat monthly amounts exist only
// so the payment flow has something real to charge against; replace with
// actual agreed pricing before this goes anywhere near a real customer.
export const TIER_PRICING = {
  starter: { amountNGN: 15000, amountUSD: 15, label: "Starter" },
  growth: { amountNGN: 45000, amountUSD: 45, label: "Growth" },
};

export async function startOrganizationSubscriptionPayment({ orgId, tier, email, provider = "paystack" }) {
  if (tier === "enterprise") {
    return { success: false, error: "Enterprise is custom-priced. Use Book a Demo or Organisation Inquiry instead of self-serve payment." };
  }
  const pricing = TIER_PRICING[tier];
  if (!pricing) return { success: false, error: "Unknown plan." };
  if (!orgId || !email) return { success: false, error: "Missing organization or email." };

  try {
    if (provider === "stripe") {
      await startStripePayment({
        email, amount: pricing.amountUSD, currency: "USD",
        context: PAYMENT_CONTEXTS.ORGANIZATION_SUBSCRIPTION,
        description: `Train AI: ${pricing.label} plan`,
        metadata: { org_id: orgId, tier },
      });
    } else {
      await startPaystackPayment({
        email, amount: pricing.amountNGN, currency: "NGN",
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
// directly.
const SEAT_PRICE_USD = 10;
const SEAT_PRICE_NGN = 15000;

export async function startSeatPurchasePayment({ orgId, seats, email, provider = "paystack" }) {
  if (!orgId || !email) return { success: false, error: "Missing organization or email." };
  const seatCount = Number(seats);
  if (!seatCount || seatCount <= 0) return { success: false, error: "Enter a valid number of seats." };

  try {
    if (provider === "stripe") {
      await startStripePayment({
        email, amount: seatCount * SEAT_PRICE_USD, currency: "USD",
        context: PAYMENT_CONTEXTS.SEAT_PURCHASE,
        description: `Train AI: ${seatCount} seat${seatCount === 1 ? "" : "s"}`,
        metadata: { org_id: orgId, seats: seatCount },
      });
    } else {
      await startPaystackPayment({
        email, amount: seatCount * SEAT_PRICE_NGN, currency: "NGN",
        context: PAYMENT_CONTEXTS.SEAT_PURCHASE,
        metadata: { org_id: orgId, seats: seatCount },
      });
    }
    return { success: true }; // redirects the browser; nothing after this runs
  } catch (e) {
    return { success: false, error: e?.message || "Could not start payment." };
  }
}
