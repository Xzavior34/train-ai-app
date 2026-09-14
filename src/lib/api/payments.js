import { supabase } from "../supabaseClient.js";

// Payment "context" values and edge function names below must match the
// already-deployed Supabase edge functions exactly (paystack-initialize,
// paystack-verify, stripe-initialize, stripe-verify - see the reference
// train-ai-ltd-main app's supabase/functions/*). These are live on the
// shared project with real secret keys configured server-side; this module
// never talks to Paystack/Stripe directly, only via supabase.functions.invoke.
export const PAYMENT_CONTEXTS = {
  CREDITS: "credits",
  COURSE_ENROLLMENT: "course_enrollment",
  // Confirmed against the live paystack-initialize/stripe-initialize edge
  // functions (Context = "credits" | "waitlist_premium" | "course_enrollment").
  // Both edge functions insert/update the real `paid_waitlist` table
  // server-side whenever this context is used - the client never writes to
  // that table directly, see lib/api/waitlist.js.
  WAITLIST_PREMIUM: "waitlist_premium",
  // Same honest status as ORGANIZATION_SUBSCRIPTION below - not confirmed
  // against a live edge function's server-side verification handling the
  // way CREDITS/COURSE_ENROLLMENT/WAITLIST_PREMIUM are; tier/seat
  // activation both happen via the client calling their respective real
  // database functions after a generically-verified successful payment,
  // matching the exact same established pattern.
  SEAT_PURCHASE: "seat_purchase",
  // NOT confirmed against a live edge function the way the three above are
  // - see the header of 0114_organization_subscription_payment.sql for the
  // full explanation. The shared stripe-initialize/paystack-initialize
  // functions will accept any context string and start a real charge either
  // way; what's untested is whether stripe-verify/paystack-verify does
  // anything server-side with this specific value the way it does for
  // "waitlist_premium". Until that's confirmed or added, tier activation
  // happens via the client calling apply_organization_subscription_payment()
  // after a successful verify response - see lib/api/organizations.js.
  ORGANIZATION_SUBSCRIPTION: "organization_subscription",
};

// Both providers redirect back to this same page (no client-side router in
// this app), landing on whatever path/query the browser is sent back to.
// App-level boot logic looks for ?reference=/?trxref=/?session_id= in the
// URL to decide whether to show PaymentCallbackScreen.
function currentPageUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function rememberPending(provider, reference, info) {
  if (!reference) return;
  try {
    sessionStorage.setItem(`${provider}:${reference}`, JSON.stringify(info));
  } catch {
    // sessionStorage can throw in private/locked-down browsing contexts
    // the callback screen falls back to the server's verify response only.
  }
}

export function readPendingPayment(provider, reference) {
  if (!reference) return null;
  try {
    const raw = sessionStorage.getItem(`${provider}:${reference}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearPendingPayment(provider, reference) {
  if (!reference) return;
  try {
    sessionStorage.removeItem(`${provider}:${reference}`);
  } catch {
    // ignore
  }
}

/**
 * Starts a Paystack transaction via the live "paystack-initialize" edge
 * function and redirects the browser to Paystack's hosted checkout.
 * Paystack redirects back to `callback_url` with ?reference=...&trxref=...
 * in the query string once the user finishes (or cancels) checkout.
 *
 * @param {{ email: string, amount: number, currency?: "NGN"|"USD"|"GHS"|"ZAR"|"KES", context: string, metadata?: object }} args
 */
export async function startPaystackPayment({ email, amount, currency = "NGN", context, metadata = {} }) {
  if (!supabase) throw new Error("Payments are not available right now.");
  if (!email) throw new Error("Email is required");
  if (!amount || amount <= 0) throw new Error("Invalid amount");
  if (!context) throw new Error("Missing payment context");

  const callback_url = currentPageUrl();

  const { data, error } = await supabase.functions.invoke("paystack-initialize", {
    body: { email, amount, currency, context, callback_url, metadata },
  });

  if (error || !data?.authorization_url) {
    throw new Error(error?.message || data?.error || "Failed to start payment");
  }

  rememberPending("paystack", data.reference, { context, metadata });
  window.location.href = data.authorization_url;
}

/**
 * Verifies a Paystack reference via the live "paystack-verify" edge function.
 * Returns { success, status, amount, currency, context, reference, metadata }.
 */
export async function verifyPaystackPayment(reference) {
  if (!supabase) throw new Error("Payments are not available right now.");
  if (!reference) throw new Error("Missing payment reference");

  const { data, error } = await supabase.functions.invoke("paystack-verify", {
    body: { reference },
  });
  if (error) throw new Error(error.message || "Could not verify payment");

  clearPendingPayment("paystack", reference);
  return data;
}

/**
 * Starts a Stripe Checkout Session via the live "stripe-initialize" edge
 * function and redirects the browser to Stripe's hosted checkout. Stripe
 * redirects back to `success_url?reference=...&session_id=...` on success,
 * or straight back to `cancel_url` if the user cancels.
 *
 * @param {{ email: string, amount: number, currency?: "USD"|"GBP"|"EUR", context: string, description?: string, metadata?: object }} args
 */
export async function startStripePayment({ email, amount, currency = "USD", context, description, metadata = {} }) {
  if (!supabase) throw new Error("Payments are not available right now.");
  if (!email) throw new Error("Email is required");
  if (!amount || amount <= 0) throw new Error("Invalid amount");
  if (!context) throw new Error("Missing payment context");

  const success_url = currentPageUrl();
  const cancel_url = currentPageUrl();

  const { data, error } = await supabase.functions.invoke("stripe-initialize", {
    body: { email, amount, currency, context, success_url, cancel_url, description, metadata },
  });

  if (error || !data?.checkout_url) {
    throw new Error(error?.message || data?.error || "Failed to start Stripe checkout");
  }

  rememberPending("stripe", data.reference, { context, metadata });
  window.location.href = data.checkout_url;
}

/**
 * Verifies a Stripe checkout session via the live "stripe-verify" edge
 * function. Either `session_id` or `reference` is enough.
 * Returns { success, status, amount, currency, context, reference }.
 */
export async function verifyStripePayment({ session_id, reference } = {}) {
  if (!supabase) throw new Error("Payments are not available right now.");
  if (!session_id && !reference) throw new Error("Missing payment session");

  const { data, error } = await supabase.functions.invoke("stripe-verify", {
    body: { session_id, reference },
  });
  if (error) throw new Error(error.message || "Could not verify payment");

  clearPendingPayment("stripe", reference || data?.reference);
  return data;
}
