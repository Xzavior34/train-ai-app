// Train AI - grant-ai-credits-from-payment
//
// The actual missing link Phase 2 of the billing work asked for: until
// now, a client called the real paystack-verify/stripe-verify edge
// function (genuine server-side verification against Paystack/Stripe's
// own API) and then, as a SEPARATE, untied step, called
// purchase_personal_ai_credits() directly with whatever reference/amount
// it wanted - nothing forced those two calls to agree, so a client could
// skip verification entirely and grant itself credits with a fabricated
// reference. Confirmed exploitable by reasoning about the previous
// architecture, not assumed safe.
//
// This function ties them together, server-side, atomically:
//   1. Authenticate the caller's own JWT (same pattern as every other
//      Edge Function in this repo - ai-chat, etc.)
//   2. Call the REAL paystack-verify/stripe-verify function itself
//      (service-role invocation, not client-relayed) to independently
//      confirm the payment actually succeeded, and read the REAL amount/
//      currency/credits_to_add echoed back from Paystack/Stripe's own
//      transaction record - never the client's claim about those values.
//   3. Only if that comes back genuinely successful, call
//      record_and_grant_ai_credit_payment() (service-role-only RPC,
//      0157_ai_credit_payment_verification.sql) with the caller's own
//      verified identity and the values THIS function just confirmed,
//      not values the client supplied.
//   4. That RPC's own unique constraint on (provider, reference) is the
//      real idempotency guarantee - a replayed/duplicate call for the
//      same payment is rejected at the database level, not just an
//      application-level check.
//
// Currently scoped to personal (learner) credit purchases only - that is
// the one purchase flow actually wired into the frontend today
// (CreditsCheckoutScreen.jsx / PaymentCallbackScreen.jsx). An
// organization-level "Buy AI Credits" admin flow does not exist in the UI
// yet, so there is no real caller for the org-credit path to wire up -
// purchase_ai_credits() is left in place, service-role-restricted, for
// when that screen is built.
//
// Deploy with: supabase functions deploy grant-ai-credits-from-payment

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return jsonResponse({ error: "Missing Authorization header" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Edge function is missing required Supabase environment bindings." }, 500);
    }

    // Verify the caller's own identity - credits are only ever granted to
    // the real, currently-authenticated user, never to a client-supplied
    // user id.
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Invalid or expired session" }, 401);
    }
    const userId = userData.user.id;

    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }
    const { provider, reference, session_id } = body || {};
    if (!provider || !["paystack", "stripe"].includes(provider)) {
      return jsonResponse({ error: "provider must be 'paystack' or 'stripe'" }, 400);
    }
    if (!reference && !session_id) {
      return jsonResponse({ error: "reference or session_id is required" }, 400);
    }

    // Service-role client - used both to call the real verify function
    // (it doesn't need the caller's own auth, it needs Paystack/Stripe's
    // secret keys, which are already configured server-side for it) and
    // to call the service-role-only grant RPC afterward.
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const verifyFn = provider === "paystack" ? "paystack-verify" : "stripe-verify";
    const verifyBody = provider === "paystack" ? { reference } : { session_id, reference };
    const { data: verifyResult, error: verifyErr } = await db.functions.invoke(verifyFn, { body: verifyBody });
    if (verifyErr) {
      console.error("grant-ai-credits-from-payment: verify call failed:", verifyErr);
      return jsonResponse({ error: "Could not verify this payment right now. Please try again." }, 502);
    }

    if (!verifyResult?.success || verifyResult?.status !== "completed") {
      return jsonResponse({ error: "Payment was not completed. No credits were granted.", granted: false }, 402);
    }
    if (verifyResult?.context !== "credits") {
      return jsonResponse({ error: "This payment was not for AI credits.", granted: false }, 400);
    }

    // The real amount/currency/reference/credits come from what Paystack/
    // Stripe's own verify response echoes back - not from this request's
    // body, which is never used for anything beyond selecting which
    // provider/reference to check.
    const verifiedReference = verifyResult.reference || reference || session_id;
    const creditsToGrant = Number(verifyResult?.metadata?.credits_to_add || 0);
    if (!verifiedReference || creditsToGrant <= 0) {
      return jsonResponse({ error: "Verified payment did not include a valid credit amount.", granted: false }, 400);
    }

    const { data: grantResult, error: grantErr } = await db.rpc("record_and_grant_ai_credit_payment", {
      p_provider: provider,
      p_provider_reference: verifiedReference,
      p_account_scope: "learner",
      p_organization_id: null,
      p_user_id: userId,
      p_credits: creditsToGrant,
      p_amount: verifyResult.amount ?? null,
      p_currency: verifyResult.currency ?? null,
    });
    if (grantErr) {
      console.error("grant-ai-credits-from-payment: grant RPC failed:", grantErr);
      return jsonResponse({ error: "Payment was verified but credits could not be granted. Please contact support with your payment reference.", reference: verifiedReference }, 500);
    }

    if (grantResult?.granted === false && grantResult?.reason === "already_processed") {
      // Idempotent replay - not an error. The credits were already granted
      // the first time this reference was processed.
      return jsonResponse({ granted: true, already_processed: true });
    }

    return jsonResponse({ granted: true, new_balance: grantResult?.new_balance, credits_added: creditsToGrant });
  } catch (error) {
    console.error("grant-ai-credits-from-payment: unhandled error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
