import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react";
import { verifyPaystackPayment, verifyStripePayment, readPendingPayment, PAYMENT_CONTEXTS } from "../../lib/api/payments.js";
import { supabase } from "../../lib/supabaseClient.js";

// Rendered when the app boots (or is already open) with a Paystack/Stripe
// redirect-back query string on the URL - see the `?reference=/?trxref=/
// ?session_id=` detection in TrainAILearnerApp.jsx's initial screen state.
// There is no router in this app, so this screen (not a route) IS the
// "/payment/callback" page from the reference implementation.
export function PaymentCallbackScreen({ addCredits, enrollmentsQuery, goTab, showToast }) {
  const [state, setState] = useState("verifying"); // "verifying" | "success" | "failed"
  const [message, setMessage] = useState("Confirming your payment…");

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const sessionId = searchParams.get("session_id"); // Stripe
    const reference = searchParams.get("reference") || searchParams.get("trxref"); // Paystack

    if (!reference && !sessionId) {
      setState("failed");
      setMessage("Missing payment reference.");
      return;
    }

    // Stripe callback carries session_id, or a TAI_STRIPE_-prefixed reference.
    const isStripe = !!sessionId || (!!reference && reference.startsWith("TAI_STRIPE_"));
    const pending = readPendingPayment(isStripe ? "stripe" : "paystack", reference) || {};

    (async () => {
      try {
        const result = isStripe
          ? await verifyStripePayment({ session_id: sessionId || undefined, reference: reference || undefined })
          : await verifyPaystackPayment(reference);

        if (result?.success && result?.status === "completed") {
          const context = result?.context || pending?.context;
          if (context === PAYMENT_CONTEXTS.CREDITS) {
            // purchase_personal_ai_credits() (the RPC previously called
            // directly from here) is gone - it's been replaced by a
            // service-role-only path that this function alone can't
            // satisfy (0157_ai_credit_payment_verification.sql). The new
            // grant-ai-credits-from-payment Edge Function does its own
            // independent re-verification against Paystack/Stripe before
            // granting anything - the client-side verify call above is
            // only used for UI branching (which context is this?), not
            // trusted as the basis for crediting an account.
            const paymentRef = reference || sessionId || undefined;
            let creditsToAdd = 0;
            try {
              const { data: grantData, error: grantErr } = await supabase.functions.invoke("grant-ai-credits-from-payment", {
                body: { provider: isStripe ? "stripe" : "paystack", reference: paymentRef, session_id: sessionId || undefined },
              });
              if (grantErr) throw grantErr;
              if (grantData?.granted) {
                creditsToAdd = Number(grantData?.credits_added || result?.metadata?.credits_to_add || pending?.metadata?.credits_to_add || 0);
              }
            } catch (grantErr) {
              console.error("PaymentCallbackScreen: credit grant failed after verified payment:", grantErr);
            }
            if (addCredits) await addCredits(creditsToAdd);
            setMessage(creditsToAdd > 0 ? `Added ${creditsToAdd} AI credits to your account.` : "Payment confirmed.");
          } else if (context === PAYMENT_CONTEXTS.COURSE_ENROLLMENT) {
            const courseId = result?.metadata?.course_id || pending?.metadata?.course_id;
            const userId = result?.metadata?.user_id || pending?.metadata?.user_id;
            const amountPaid = result?.amount || pending?.amount;
            const currency = result?.currency || pending?.currency || "NGN";
            const paymentRef = reference || sessionId;

            if (courseId && userId && paymentRef) {
              try {
                await supabase.rpc("enroll_after_course_payment", {
                  p_course_id: courseId,
                  p_user_id: userId,
                  p_reference: paymentRef,
                  p_provider: isStripe ? "stripe" : "paystack",
                  p_amount_paid: amountPaid ? Number(amountPaid) : null,
                  p_currency: currency,
                });
              } catch (enrollErr) {
                console.warn("enroll_after_course_payment callback warning:", enrollErr);
              }
            }
            if (enrollmentsQuery) enrollmentsQuery.refetch();
            setMessage("You're enrolled! Jump into your course any time.");
          } else {
            setMessage("Payment confirmed.");
          }
          setState("success");
          if (showToast) showToast("Payment successful");
        } else {
          setState("failed");
          setMessage("Payment was not completed. You have not been charged for any unsuccessful attempt.");
        }
      } catch (err) {
        setState("failed");
        setMessage(err?.message || "We couldn't verify your payment. Please contact support.");
      } finally {
        // Strip the payment query params so refreshing this page doesn't
        // re-run verification against an already-settled reference.
        window.history.replaceState({}, "", window.location.pathname);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="tai-fade-in" style={{ display: "flex", justifyContent: "center", paddingTop: 40 }}>
      <div className="tai-card" style={{ maxWidth: 360, width: "100%", textAlign: "center", padding: 28 }}>
        {state === "verifying" && (
          <>
            <Loader2 size={48} color="var(--primary)" className="tai-spin" />
            <div style={{ fontWeight: 800, fontSize: 18, marginTop: 14 }}>Verifying payment…</div>
            <div className="tai-body-text tai-mt8">{message}</div>
          </>
        )}
        {state === "success" && (
          <>
            <CheckCircle2 size={48} color="var(--success)" className="anim-pop" />
            <div style={{ fontWeight: 800, fontSize: 18, marginTop: 14 }}>Payment successful</div>
            <div className="tai-body-text tai-mt8">{message}</div>
            <button className="tai-btn tai-btn-primary tai-mt16" style={{ width: "100%" }} onClick={() => goTab("home")}>
              Continue <ArrowRight size={16} />
            </button>
          </>
        )}
        {state === "failed" && (
          <>
            <XCircle size={48} color="var(--danger)" className="anim-pop" />
            <div style={{ fontWeight: 800, fontSize: 18, marginTop: 14 }}>Payment failed</div>
            <div className="tai-body-text tai-mt8">{message}</div>
            <button className="tai-btn tai-btn-primary tai-mt16" style={{ width: "100%" }} onClick={() => goTab("home")}>
              Go home
            </button>
          </>
        )}
      </div>
    </div>
  );
}
