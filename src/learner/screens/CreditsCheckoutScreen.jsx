import React, { useState } from "react";
import { TopBar, Tag } from "../components/LearnerUI.jsx";
import { Sparkles, ShieldCheck, Loader2, CreditCard } from "lucide-react";
import { startPaystackPayment, startStripePayment, PAYMENT_CONTEXTS } from "../../lib/api/payments.js";

const PACKAGES = [
  { id: "starter", credits: 50, label: "Starter", priceUSD: 5, priceNGN: 7500, priceGBP: 4, priceEUR: 4.5 },
  { id: "pro", credits: 200, label: "Pro", highlight: true, priceUSD: 15, priceNGN: 22000, priceGBP: 12, priceEUR: 14 },
  { id: "team", credits: 600, label: "Team", priceUSD: 35, priceNGN: 50000, priceGBP: 28, priceEUR: 32 },
];

const SYMBOL = { NGN: "₦", USD: "$", GBP: "£", EUR: "€" };
const CREDITS_CURRENCIES = ["NGN", "USD", "GBP", "EUR"];

function priceFor(pkg, currency) {
  if (currency === "NGN") return pkg.priceNGN;
  if (currency === "USD") return pkg.priceUSD;
  if (currency === "GBP") return pkg.priceGBP;
  return pkg.priceEUR;
}

function formatAmount(value, currency) {
  if (currency === "NGN") return `${SYMBOL.NGN}${Number(value).toLocaleString()}`;
  return `${SYMBOL[currency] || ""}${Number(value).toFixed(2)}`;
}

// Single checkout screen for both flows the reference app supports:
//  - buying an AI credits package (params.mode === "credits" or omitted)
//  - paying for a paid course enrollment (params.mode === "course_enrollment",
//    params.courseId / params.courseTitle / params.coursePrice supplied by
//    whoever pushed this screen)
export function CreditsCheckoutScreen({ session, params, back, showToast }) {
  const isCourseMode = params?.mode === "course_enrollment";

  const [selectedPackageId, setSelectedPackageId] = useState(PACKAGES[1].id);
  const [currency, setCurrency] = useState("NGN");
  const [providerOverride, setProviderOverride] = useState(null);
  const [email, setEmail] = useState(session?.user?.email || "");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const defaultProvider = currency === "NGN" ? "paystack" : "stripe";
  const provider = providerOverride ?? defaultProvider;
  const paystackAllowed = currency === "NGN" || currency === "USD";
  const stripeAllowed = currency !== "NGN";

  const pkg = PACKAGES.find((p) => p.id === selectedPackageId) ?? PACKAGES[1];
  const coursePrice = Number(params?.coursePrice) || 0;
  const amount = isCourseMode ? coursePrice : priceFor(pkg, currency);

  function onCurrencyChange(next) {
    setCurrency(next);
    setProviderOverride(null);
  }

  async function handlePay() {
    setErrorMsg("");
    if (!email || !email.includes("@")) {
      setErrorMsg("Enter the email you'd like the receipt sent to.");
      return;
    }
    if (!amount || amount <= 0) {
      setErrorMsg("Invalid amount.");
      return;
    }

    setLoading(true);
    try {
      if (provider === "stripe" && !stripeAllowed) {
        throw new Error("Stripe does not support NGN. Switch to USD, GBP or EUR.");
      }
      if (provider === "paystack" && !paystackAllowed) {
        throw new Error("Paystack supports NGN or USD only. Switch currency or use Stripe.");
      }

      if (isCourseMode) {
        const metadata = { user_id: session?.user?.id ?? null, course_id: params?.courseId };
        const description = `Train AI: ${params?.courseTitle || "Course"} enrollment`;
        if (provider === "stripe") {
          await startStripePayment({ email, amount, currency, context: PAYMENT_CONTEXTS.COURSE_ENROLLMENT, description, metadata });
        } else {
          await startPaystackPayment({ email, amount, currency, context: PAYMENT_CONTEXTS.COURSE_ENROLLMENT, metadata });
        }
      } else {
        const metadata = { credits_to_add: pkg.credits, package: pkg.id, user_id: session?.user?.id ?? null };
        const description = `Train AI: ${pkg.credits} AI Credits (${pkg.label})`;
        if (provider === "stripe") {
          await startStripePayment({ email, amount, currency, context: PAYMENT_CONTEXTS.CREDITS, description, metadata });
        } else {
          await startPaystackPayment({ email, amount, currency, context: PAYMENT_CONTEXTS.CREDITS, metadata });
        }
      }
      // If we reach here without throwing, the browser is already
      // navigating away to the hosted checkout page.
    } catch (err) {
      setErrorMsg(err?.message || "Could not start checkout");
      if (showToast) showToast(err?.message || "Could not start checkout");
      setLoading(false);
    }
  }

  return (
    <div className="tai-fade-in">
      <TopBar
        title={isCourseMode ? "Course checkout" : "Buy AI Credits"}
        sub={isCourseMode ? params?.courseTitle : "Pick a package and pay securely"}
        onBack={back}
      />

      {!isCourseMode && (
        <>
          <div className="tai-scrollx tai-mt10">
            {CREDITS_CURRENCIES.map((c) => (
              <div
                key={c}
                className={`tai-pill ${currency === c ? "tai-pill-active" : "tai-pill-inactive"}`}
                onClick={() => onCurrencyChange(c)}
              >
                {SYMBOL[c]} {c}
              </div>
            ))}
          </div>

          <div className="tai-col tai-gap10 tai-mt14">
            {PACKAGES.map((p) => {
              const isSelected = selectedPackageId === p.id;
              return (
                <div
                  key={p.id}
                  className="tai-card"
                  style={{
                    cursor: "pointer",
                    borderColor: isSelected ? "var(--primary)" : "var(--border)",
                    background: isSelected ? "var(--surface-2)" : "var(--surface)",
                  }}
                  onClick={() => setSelectedPackageId(p.id)}
                >
                  <div className="tai-row tai-between">
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{p.label}</span>
                    {p.highlight && <Tag tone="warning">POPULAR</Tag>}
                  </div>
                  <div className="tai-row tai-gap6 tai-mt8">
                    <Sparkles size={16} color="var(--primary)" />
                    <span style={{ fontSize: 20, fontWeight: 800 }}>{p.credits}</span>
                    <span style={{ fontSize: 12, color: "var(--text-2)" }}>credits</span>
                  </div>
                  <div className="tai-body-text tai-mt8">{formatAmount(priceFor(p, currency), currency)} one-time</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {isCourseMode && (
        <div className="tai-card tai-mt12">
          <div style={{ fontWeight: 700, fontSize: 15 }}>{params?.courseTitle || "Course"}</div>
          <div className="tai-body-text tai-mt8">One-time enrollment fee</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>{formatAmount(amount, currency)}</div>
          <div className="tai-scrollx tai-mt10">
            {["NGN", "USD"].map((c) => (
              <div
                key={c}
                className={`tai-pill ${currency === c ? "tai-pill-active" : "tai-pill-inactive"}`}
                onClick={() => onCurrencyChange(c)}
              >
                {SYMBOL[c]} {c}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="tai-card tai-mt16">
        <div className="tai-label">Email for receipt</div>
        <input
          className="tai-input tai-mt8"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <div className="tai-label tai-mt16">Payment provider</div>
        <div className="tai-grid2 tai-mt8">
          <div
            className="tai-card"
            style={{
              cursor: paystackAllowed ? "pointer" : "not-allowed",
              opacity: paystackAllowed ? 1 : 0.4,
              borderColor: provider === "paystack" ? "var(--primary)" : "var(--border)",
            }}
            onClick={() => paystackAllowed && setProviderOverride("paystack")}
          >
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>Paystack</div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>NGN & USD · Africa-friendly</div>
          </div>
          <div
            className="tai-card"
            style={{
              cursor: stripeAllowed ? "pointer" : "not-allowed",
              opacity: stripeAllowed ? 1 : 0.4,
              borderColor: provider === "stripe" ? "var(--primary)" : "var(--border)",
            }}
            onClick={() => stripeAllowed && setProviderOverride("stripe")}
          >
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>Stripe</div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>USD, GBP, EUR</div>
          </div>
        </div>

        {errorMsg && (
          <div className="tai-body-text tai-mt10" style={{ color: "var(--danger)" }}>{errorMsg}</div>
        )}

        <button className="tai-btn tai-btn-primary tai-mt16" style={{ width: "100%" }} disabled={loading} onClick={handlePay}>
          {loading ? (
            <>
              <Loader2 size={16} />
              Redirecting to {provider === "stripe" ? "Stripe" : "Paystack"}...
            </>
          ) : (
            <>
              <CreditCard size={16} />
              Pay {formatAmount(amount, currency)} with {provider === "stripe" ? "Stripe" : "Paystack"}
            </>
          )}
        </button>

        <div className="tai-row tai-gap6" style={{ justifyContent: "center", marginTop: 12, fontSize: 11.5, color: "var(--text-2)" }}>
          <ShieldCheck size={14} />
          Secure hosted checkout. We never see your card details.
        </div>
      </div>
    </div>
  );
}
