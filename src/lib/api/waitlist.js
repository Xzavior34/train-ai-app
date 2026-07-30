import { supabase } from "../supabaseClient.js";
import { startPaystackPayment, startStripePayment, PAYMENT_CONTEXTS } from "./payments.js";

// Real backing tables/RPCs confirmed against the shared project's
// integrations/supabase/types.ts (train-ai-ltd-main reference app):
//   waitlist        (id, email, source, created_at) — plain single-tier
//                     opt-in list, matches the pre-existing landing page CTA.
//   waitlist_tiers  (id, email, user_id, tier ['free'|'paid'], source,
//                     payment_status, amount, currency, stripe_session_id,
//                     created_at, updated_at) — the two-tier growth feature
//                     from the reference app's TwoTierWaitlist component.
//   paid_waitlist   (id, email, user_id, amount, currency, payment_method,
//                     payment_status, bank_reference, stripe_session_id,
//                     source, created_at, updated_at) — populated
//                     SERVER-SIDE by the paystack-initialize/stripe-initialize
//                     edge functions themselves whenever context is
//                     "waitlist_premium" (confirmed in
//                     supabase/functions/{paystack,stripe}-initialize/index.ts).
//                     This module never inserts into paid_waitlist directly.
//   safe_paid_waitlist — RLS-safe view over paid_waitlist (id, email,
//                     created_at, payment_status, source; no amount/
//                     bank_reference/user_id) used for status lookups.
//   RPC get_waitlist_count() / get_waitlist_count_by_tier(tier_filter)

export const WAITLIST_TIERS = { FREE: "free", PAID: "paid" };

// Matches the reference app's TwoTierWaitlist pricing exactly
// (PREMIUM_AMOUNT_NGN = 10000 in TwoTierWaitlist.tsx; STRIPE_PRICES in
// TwoTierWaitlistSplit.tsx). Amounts are in the currency's main unit — the
// edge functions convert to subunits (kobo/cents) themselves.
const PAYSTACK_PREMIUM_AMOUNT_NGN = 10000;
const STRIPE_PREMIUM_PRICES = { USD: 7.5, GBP: 6, EUR: 7 };

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Joins the waitlist.
 *   - tier omitted    -> plain `waitlist` table insert (unchanged behaviour
 *     for the existing single-field landing page CTA).
 *   - tier === "free" -> `waitlist_tiers` insert (tier: 'free',
 *     payment_status: 'completed'), for the two-tier growth UI.
 *   - tier === "paid" -> starts a real Paystack (NGN) or Stripe (USD/GBP/EUR)
 *     checkout via the existing payments.js helpers with context
 *     "waitlist_premium". Both helpers redirect the browser to the hosted
 *     checkout page on success — the `paid_waitlist` row is written by the
 *     edge function itself once checkout is initialized, and its
 *     payment_status is updated by paystack-verify/stripe-verify once the
 *     user finishes paying. This function never writes to paid_waitlist.
 */
export async function joinWaitlist({ email, tier, source = "landing_page", currency = "NGN", metadata = {} } = {}) {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    return { success: false, error: "Please enter a valid email address." };
  }

  if (tier === WAITLIST_TIERS.PAID) {
    try {
      if (currency === "NGN") {
        await startPaystackPayment({
          email: normalizedEmail,
          amount: PAYSTACK_PREMIUM_AMOUNT_NGN,
          currency: "NGN",
          context: PAYMENT_CONTEXTS.WAITLIST_PREMIUM,
          metadata: { ...metadata, source },
        });
      } else {
        const amount = STRIPE_PREMIUM_PRICES[currency] || STRIPE_PREMIUM_PRICES.USD;
        await startStripePayment({
          email: normalizedEmail,
          amount,
          currency: STRIPE_PREMIUM_PRICES[currency] ? currency : "USD",
          context: PAYMENT_CONTEXTS.WAITLIST_PREMIUM,
          description: "Train AI — Premium Waitlist",
          metadata: { ...metadata, source },
        });
      }
      // Both helpers redirect the browser away to the hosted checkout page
      // on success, so control doesn't normally return here at all.
      return { success: true, redirecting: true };
    } catch (error) {
      return { success: false, error: error?.message || "Could not start premium waitlist checkout." };
    }
  }

  if (!supabase) return { success: true }; // demo mode — nothing to persist

  try {
    if (tier === WAITLIST_TIERS.FREE) {
      const { error } = await supabase.from("waitlist_tiers").insert({
        email: normalizedEmail,
        tier: "free",
        source,
        payment_status: "completed",
      });
      if (error) throw error;
      return { success: true };
    }

    const { error } = await supabase.from("waitlist").insert({ email: normalizedEmail, source });
    if (error) throw error;
    return { success: true };
  } catch (error) {
    if (error?.code === "23505" || error?.message?.includes("duplicate key")) {
      return { success: false, error: "This email is already on the waitlist." };
    }
    console.warn("Waitlist join warning:", error);
    return { success: false, error: "Could not join the waitlist — please try again." };
  }
}

/**
 * Looks up whether an email/user is already on the waitlist, checking the
 * paid tier first (most "advanced" status), then the tiered table, then the
 * plain table. Safe to call with just an email (anonymous visitor) or a
 * userId (signed-in learner).
 */
export async function fetchMyWaitlistStatus({ email, userId } = {}) {
  const normalizedEmail = normalizeEmail(email);
  const empty = { onWaitlist: false, tier: null, paymentStatus: null, source: null, joinedAt: null };
  if (!supabase || (!normalizedEmail && !userId)) return empty;

  try {
    if (normalizedEmail) {
      const { data: paidRow } = await supabase
        .from("safe_paid_waitlist")
        .select("*")
        .eq("email", normalizedEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (paidRow) {
        return {
          onWaitlist: true,
          tier: "paid",
          paymentStatus: paidRow.payment_status || "pending",
          source: paidRow.source || null,
          joinedAt: paidRow.created_at || null,
        };
      }
    }

    let tierQuery = supabase.from("waitlist_tiers").select("*").order("created_at", { ascending: false }).limit(1);
    tierQuery = userId ? tierQuery.eq("user_id", userId) : tierQuery.eq("email", normalizedEmail);
    const { data: tierRow } = await tierQuery.maybeSingle();
    if (tierRow) {
      return {
        onWaitlist: true,
        tier: tierRow.tier || "free",
        paymentStatus: tierRow.payment_status || null,
        source: tierRow.source || null,
        joinedAt: tierRow.created_at || null,
      };
    }

    if (normalizedEmail) {
      const { data: plainRow } = await supabase
        .from("waitlist")
        .select("*")
        .eq("email", normalizedEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (plainRow) {
        return { onWaitlist: true, tier: null, paymentStatus: null, source: plainRow.source || null, joinedAt: plainRow.created_at || null };
      }
    }

    return empty;
  } catch (error) {
    console.warn("Waitlist status fetch warning:", error);
    return empty;
  }
}

/** Public headline count for marketing copy ("Join 1,204 others…"). */
export async function fetchWaitlistCount() {
  if (!supabase) return 0;
  try {
    const { data, error } = await supabase.rpc("get_waitlist_count");
    if (error) return 0;
    return data || 0;
  } catch {
    return 0;
  }
}
