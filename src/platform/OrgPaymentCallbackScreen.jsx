import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { verifyPaystackPayment, verifyStripePayment, readPendingPayment, PAYMENT_CONTEXTS } from "../lib/api/payments.js";
import { applyOrganizationSubscriptionPayment, purchaseSeats } from "../lib/api/organizations.js";
import { TOKENS } from "./components/PlatformUI.jsx";

// Platform-app equivalent of learner/screens/PaymentCallbackScreen.jsx
// that screen only ever handled the CREDITS/COURSE_ENROLLMENT contexts,
// which are learner actions. Organization subscription payments are
// initiated from the admin side (SettingsHubScreen.jsx's Billing & Plan
// card), so they need their own callback handling here - nothing in the
// Platform app previously looked for a payment redirect at all.
export function OrgPaymentCallbackScreen({ onDone }) {
  const [state, setState] = useState("verifying"); // "verifying" | "success" | "failed"
  const [message, setMessage] = useState("Confirming your payment…");

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const sessionId = searchParams.get("session_id");
    const reference = searchParams.get("reference") || searchParams.get("trxref");

    if (!reference && !sessionId) {
      setState("failed");
      setMessage("Missing payment reference.");
      return;
    }

    const isStripe = !!sessionId || (!!reference && reference.startsWith("TAI_STRIPE_"));
    const pending = readPendingPayment(isStripe ? "stripe" : "paystack", reference) || {};

    (async () => {
      try {
        const result = isStripe
          ? await verifyStripePayment({ session_id: sessionId || undefined, reference: reference || undefined })
          : await verifyPaystackPayment(reference);

        const context = result?.context || pending?.context;
        if (result?.success && result?.status === "completed" && context === PAYMENT_CONTEXTS.ORGANIZATION_SUBSCRIPTION) {
          const orgId = result?.metadata?.org_id || pending?.metadata?.org_id;
          const tier = result?.metadata?.tier || pending?.metadata?.tier;
          const applyResult = await applyOrganizationSubscriptionPayment(
            orgId, tier, isStripe ? "stripe" : "paystack", reference || sessionId, result?.amount
          );
          if (applyResult.success) {
            setState("success");
            setMessage(`Payment confirmed. Your organization is now on the ${tier} plan.`);
          } else {
            setState("failed");
            setMessage(applyResult.error || "Payment succeeded but activating your plan failed. Contact support with this reference: " + (reference || sessionId));
          }
        } else if (result?.success && result?.status === "completed" && context === PAYMENT_CONTEXTS.SEAT_PURCHASE) {
          const orgId = result?.metadata?.org_id || pending?.metadata?.org_id;
          const seats = result?.metadata?.seats || pending?.metadata?.seats;
          const applyResult = await purchaseSeats(orgId, seats, result?.amount, reference || sessionId);
          if (applyResult.success) {
            setState("success");
            setMessage(`Payment confirmed. ${seats} seat${seats === 1 ? "" : "s"} added to your organization.`);
          } else {
            setState("failed");
            setMessage(applyResult.error || "Payment succeeded but adding seats failed. Contact support with this reference: " + (reference || sessionId));
          }
        } else if (result?.success && result?.status === "completed") {
          // A real payment succeeded but wasn't for an organization
          // subscription - shouldn't reach this screen, but don't claim
          // success for a context this screen doesn't handle.
          setState("failed");
          setMessage("Payment confirmed, but this screen doesn't know how to apply it. Contact support.");
        } else {
          setState("failed");
          setMessage("Payment was not completed. You have not been charged for any unsuccessful attempt.");
        }
      } catch (err) {
        setState("failed");
        setMessage(err?.message || "We couldn't verify your payment. Please contact support.");
      } finally {
        try {
          const url = new URL(window.location.href);
          ["reference", "trxref", "session_id"].forEach((k) => url.searchParams.delete(k));
          window.history.replaceState({}, "", url.toString());
        } catch { /* best-effort */ }
      }
    })();
  }, []);

  return (
    <div className="ta" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-1, #F5F6FA)", padding: 20 }}>
      <style>{TOKENS}</style>
      <div className="ta-fade" style={{ width: "100%", maxWidth: 420, textAlign: "center", padding: 32, background: "#fff", borderRadius: 16, boxShadow: "0 8px 30px rgba(0,0,0,.08)" }}>
        {state === "verifying" && <Loader2 size={32} className="ta-spin" color="#4F46E5" />}
        {state === "success" && <CheckCircle2 size={32} color="#17A673" />}
        {state === "failed" && <XCircle size={32} color="#E5484D" />}
        <div style={{ fontWeight: 700, fontSize: 16, marginTop: 16 }}>
          {state === "verifying" ? "Confirming payment" : state === "success" ? "Plan activated" : "Payment issue"}
        </div>
        <div style={{ fontSize: 13, color: "#656C86", marginTop: 8 }}>{message}</div>
        {state !== "verifying" && (
          <button className="ta-btn ta-btn-primary ta-mt16" onClick={onDone}>Continue to dashboard</button>
        )}
      </div>
    </div>
  );
}
