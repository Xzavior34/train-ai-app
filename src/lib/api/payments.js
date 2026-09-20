import { supabase } from "../supabaseClient.js";
import { fetchOrgPaymentGatewaySettings } from "./organizations.js";

// Payment "context" values and edge function names below must match the
// already-deployed Supabase edge functions exactly (paystack-initialize,
// paystack-verify, stripe-initialize, stripe-verify - see the reference
// train-ai-ltd-main app's supabase/functions/*). These are live on the
// shared project with real secret keys configured server-side; this module
// never talks to Paystack/Stripe directly, only via supabase.functions.invoke.
export const PAYMENT_CONTEXTS = {
  CREDITS: "credits",
  COURSE_ENROLLMENT: "course_enrollment",
  WAITLIST_PREMIUM: "waitlist_premium",
  SEAT_PURCHASE: "seat_purchase",
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
 * Supports both Live Production and Test mode transactions.
 *
 * @param {{ email: string, amount: number, currency?: "NGN"|"USD"|"GHS"|"ZAR"|"KES", context: string, metadata?: object }} args
 */
export async function startPaystackPayment({ email, amount, currency = "NGN", context, metadata = {} }) {
  if (!supabase) throw new Error("Payments are not available right now.");
  if (!email) throw new Error("Email is required");
  if (!amount || amount <= 0) throw new Error("Invalid amount");
  if (!context) throw new Error("Missing payment context");

  const callback_url = currentPageUrl();

  let enrichedMetadata = { ...metadata };
  if (metadata?.orgId) {
    try {
      const gwSettings = await fetchOrgPaymentGatewaySettings(metadata.orgId);
      if (gwSettings) {
        enrichedMetadata.gateway_settings = gwSettings;
        if (gwSettings.paystack_subaccount_code) {
          enrichedMetadata.subaccount = gwSettings.paystack_subaccount_code;
        }
      }
    } catch (e) {
      console.warn("Could not enrich org gateway settings:", e);
    }
  }

  const paystackPayload = {
    email,
    amount,
    currency,
    context,
    callback_url,
    metadata: enrichedMetadata,
  };
  if (enrichedMetadata?.subaccount) {
    paystackPayload.subaccount = enrichedMetadata.subaccount;
  }

  const { data, error } = await supabase.functions.invoke("paystack-initialize", {
    body: paystackPayload,
  });

  if (error || !data?.authorization_url) {
    throw new Error(error?.message || data?.error || "Failed to start Paystack payment");
  }

  rememberPending("paystack", data.reference, { context, metadata: enrichedMetadata });
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
 * function and redirects the browser to Stripe's hosted checkout.
 * Supports both Live Production and Test mode transactions.
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

  let enrichedMetadata = { ...metadata };
  if (metadata?.orgId) {
    try {
      const gwSettings = await fetchOrgPaymentGatewaySettings(metadata.orgId);
      if (gwSettings) {
        enrichedMetadata.gateway_settings = gwSettings;
        if (gwSettings.stripe_account_id) {
          enrichedMetadata.stripe_account = gwSettings.stripe_account_id;
        }
      }
    } catch (e) {
      console.warn("Could not enrich org gateway settings:", e);
    }
  }

  const stripePayload = {
    email,
    amount,
    currency,
    context,
    success_url,
    cancel_url,
    description,
    metadata: enrichedMetadata,
  };
  if (enrichedMetadata?.stripe_account) {
    stripePayload.stripe_account = enrichedMetadata.stripe_account;
  }

  const { data, error } = await supabase.functions.invoke("stripe-initialize", {
    body: stripePayload,
  });

  if (error || !data?.checkout_url) {
    throw new Error(error?.message || data?.error || "Failed to start Stripe checkout");
  }

  rememberPending("stripe", data.reference, { context, metadata: enrichedMetadata });
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
