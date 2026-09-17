// Train AI - paystack-webhook
//
// Real Paystack webhook signature verification, using Paystack's own
// documented mechanism (HMAC-SHA512 of the raw request body, keyed with
// the secret key, compared against the x-paystack-signature header -
// https://paystack.com/docs/payments/webhooks/#verifying-events) - not
// invented, not approximated.
//
// STATUS: CODE IMPLEMENTED. LIVE DELIVERY UNVERIFIED - no live Paystack
// account can send this function a real signed event from this sandbox.
// The signature verification logic itself was exercised against a real,
// correctly-computed HMAC-SHA512 using a known test secret (see the
// accompanying report) - that proves the verification code is correct,
// not that a real Paystack account has been wired to call it.
//
// Configure with: supabase secrets set PAYSTACK_SECRET_KEY=sk_...
// (the same secret key already used for paystack-initialize/paystack-verify
// - Paystack signs webhooks with the account's live/test secret key
// itself, there is no separate webhook-specific secret the way Stripe has).
// Register this function's URL in the Paystack dashboard's webhook settings.
// Deploy with: supabase functions deploy paystack-webhook

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-paystack-signature, content-type",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmacSha512Hex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPaystackSignature(payload, sigHeader, secret) {
  if (!sigHeader || !secret) return { valid: false, reason: "missing_signature_or_secret" };
  const expected = await hmacSha512Hex(secret, payload);
  if (expected.length !== sigHeader.length) return { valid: false, reason: "signature_mismatch" };
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sigHeader.charCodeAt(i);
  return diff === 0 ? { valid: true } : { valid: false, reason: "signature_mismatch" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!PAYSTACK_SECRET_KEY) {
      console.error("paystack-webhook: PAYSTACK_SECRET_KEY not configured");
      return jsonResponse({ error: "Webhook not configured" }, 500);
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Edge function is missing required Supabase environment bindings." }, 500);
    }

    const sigHeader = req.headers.get("x-paystack-signature");
    const rawBody = await req.text();

    const verification = await verifyPaystackSignature(rawBody, sigHeader, PAYSTACK_SECRET_KEY);
    if (!verification.valid) {
      console.error("paystack-webhook: signature verification failed:", verification.reason);
      return jsonResponse({ error: "Invalid signature" }, 400);
    }

    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: "Invalid JSON payload" }, 400);
    }

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (event?.event === "charge.success") {
      const data = event.data;
      const context = data?.metadata?.context;
      // Paystack references are already globally unique per transaction -
      // used directly as the idempotency key, same as the reference the
      // client-initiated verify flow already uses, so a webhook-delivered
      // and client-verified copy of the SAME real payment converge on the
      // same ledger row instead of double-crediting.
      const reference = data?.reference;
      if (context === "credits" && reference) {
        const userId = data?.metadata?.user_id;
        const creditsToAdd = Number(data?.metadata?.credits_to_add || 0);
        if (userId && creditsToAdd > 0) {
          const { data: grantData, error } = await db.rpc("record_and_grant_ai_credit_payment", {
            p_provider: "paystack",
            p_provider_reference: reference,
            p_account_scope: "learner",
            p_organization_id: null,
            p_user_id: userId,
            p_credits: creditsToAdd,
            p_amount: data?.amount ?? null,
            p_currency: data?.currency ?? "NGN",
          });
          if (error) console.error("paystack-webhook: grant failed:", error);
          else console.log("paystack-webhook: processed", reference, grantData);
        }
      }
    }

    return jsonResponse({ received: true });
  } catch (error) {
    console.error("paystack-webhook: unhandled error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
