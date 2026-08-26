import React, { useState } from "react";
import { TopBar, Tag } from "../components/LearnerUI.jsx";
import { Zap, ShieldCheck, Loader2, CreditCard, Plus, CheckCircle2, Lock, Mail, ArrowRight, HelpCircle } from "lucide-react";
import { startPaystackPayment, startStripePayment, PAYMENT_CONTEXTS } from "../../lib/api/payments.js";

const PACKAGES = [
  {
    id: "starter",
    credits: 50,
    label: "Starter",
    tagline: "Essential AI simulations & code reviews",
    features: ["50 AI Tutor Queries", "Automated Code Analysis", "Instant credit allocation", "Never expires"],
    priceUSD: 5,
    priceNGN: 7500,
    priceGBP: 4,
    priceEUR: 4.5
  },
  {
    id: "pro",
    credits: 200,
    label: "Pro",
    highlight: true,
    tagline: "Most popular for active career learners",
    features: ["200 AI Tutor Queries", "Full Mock Technical Interviews", "Live Project Feedback", "Priority AI model response", "Never expires"],
    priceUSD: 15,
    priceNGN: 22000,
    priceGBP: 12,
    priceEUR: 14
  },
  {
    id: "team",
    credits: 600,
    label: "Power Learner",
    badge: "BEST VALUE",
    tagline: "Comprehensive career track mastery",
    features: ["600 AI Tutor Queries", "Unlimited Interview Simulations", "Deep Architectural Reviews", "Portfolio & Resume AI Polish", "Never expires"],
    priceUSD: 35,
    priceNGN: 50000,
    priceGBP: 28,
    priceEUR: 32
  },
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
    } catch (err) {
      setErrorMsg(err?.message || "Could not start checkout");
      if (showToast) showToast(err?.message || "Could not start checkout");
      setLoading(false);
    }
  }

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 960, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      
      {/* =========================================================================
          HERO BANNER: Unified Checkout Header
          ========================================================================= */}
      <div
        className="tai-card tai-hero-card tai-hero-dark anim-fluid-entrance"
        style={{
          borderRadius: 14,
          padding: "clamp(18px, 2.5vw, 24px)",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(37, 99, 235, 0.25) 0%, transparent 70%)",
            pointerEvents: "none"
          }}
        />

        <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <h1 className="tai-hero-title" style={{ fontSize: "clamp(20px, 2.5vw, 26px)", fontWeight: 900, letterSpacing: "-0.025em", margin: 0, lineHeight: 1.2, color: "#FFFFFF" }}>
                {isCourseMode ? "Course Checkout" : "Buy AI Neural Credits"}
              </h1>
              <span style={{ background: "#2563EB", color: "#FFFFFF", padding: "2px 8px", borderRadius: 6, fontWeight: 800, fontSize: 11 }}>
                Instant Access
              </span>
            </div>
            <p className="tai-hero-desc" style={{ fontSize: 13.5, margin: 0, color: "#F8FAFC", fontWeight: 500, lineHeight: 1.45 }}>
              {isCourseMode
                ? (params?.courseTitle || "Enrollment Fee")
                : "Select an AI credit tier for real-time code reviews, interview drills, and personalized AI tutor queries."}
            </p>
          </div>

          <div
            style={{
              background: "rgba(255, 255, 255, 0.12)",
              border: "1px solid rgba(255, 255, 255, 0.22)",
              padding: "10px 18px",
              borderRadius: 10,
              textAlign: "right",
              flexShrink: 0
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 900, color: "#FFFFFF" }}>{formatAmount(amount, currency)}</div>
            <div style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.8)", fontWeight: 700 }}>Total Due ({currency})</div>
          </div>
        </div>
      </div>

      {!isCourseMode && (
        <>
          {/* Currency Switcher Controls */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>Select Currency</div>
              <div style={{ fontSize: 12, color: "var(--text-2)" }}>Choose your preferred payment denomination</div>
            </div>
            <div style={{ display: "flex", gap: 6, background: "var(--surface-3)", padding: 4, borderRadius: 10, border: "1px solid var(--border)" }}>
              {CREDITS_CURRENCIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  style={{
                    padding: "6px 14px",
                    borderRadius: 7,
                    fontSize: 12.5,
                    fontWeight: currency === c ? 800 : 600,
                    background: currency === c ? "var(--primary)" : "transparent",
                    color: currency === c ? "#FFFFFF" : "var(--text)",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                  onClick={() => onCurrencyChange(c)}
                >
                  {SYMBOL[c]} {c}
                </button>
              ))}
            </div>
          </div>

          {/* 3-Column Pricing Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 14 }}>
            {PACKAGES.map((p) => {
              const isSelected = selectedPackageId === p.id;
              return (
                <div
                  key={p.id}
                  className="tai-card-hover"
                  style={{
                    cursor: "pointer",
                    borderRadius: 12,
                    padding: "18px",
                    background: isSelected ? "var(--surface-2)" : "var(--surface)",
                    border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border)",
                    boxShadow: isSelected ? "0 4px 20px rgba(37, 99, 235, 0.15)" : "none",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transition: "all 0.18s ease"
                  }}
                  onClick={() => setSelectedPackageId(p.id)}
                >
                  {p.highlight && (
                    <div style={{ position: "absolute", top: -11, right: 14, background: "#D97706", color: "#FFFFFF", fontSize: 10, fontWeight: 900, padding: "2px 8px", borderRadius: 99, letterSpacing: "0.04em" }}>
                      MOST POPULAR
                    </div>
                  )}
                  {p.badge && !p.highlight && (
                    <div style={{ position: "absolute", top: -11, right: 14, background: "#059669", color: "#FFFFFF", fontSize: 10, fontWeight: 900, padding: "2px 8px", borderRadius: 99, letterSpacing: "0.04em" }}>
                      {p.badge}
                    </div>
                  )}

                  <div>
                    <div className="tai-row tai-between" style={{ alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>{p.label}</span>
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          border: isSelected ? "6px solid var(--primary)" : "2px solid var(--border)",
                          background: "#FFFFFF",
                          transition: "all 0.15s ease"
                        }}
                      />
                    </div>
                    
                    <p style={{ fontSize: 11.5, color: "var(--text-2)", margin: "0 0 14px", lineHeight: 1.35 }}>
                      {p.tagline}
                    </p>

                    {/* Credits display with PLUS icon */}
                    <div style={{ background: "var(--surface-3)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(37, 99, 235, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Plus size={16} color="var(--primary)" />
                      </div>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text)", lineHeight: 1.1 }}>
                          +{p.credits}
                        </div>
                        <div style={{ fontSize: 10.5, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase" }}>
                          AI Neural Credits
                        </div>
                      </div>
                    </div>

                    {/* Feature bullet list */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
                      {p.features.map((feat, fIdx) => (
                        <div key={fIdx} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-2)" }}>
                          <CheckCircle2 size={13} color="#10B981" style={{ flexShrink: 0 }} />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: "auto" }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>
                      {formatAmount(priceFor(p, currency), currency)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, marginTop: 2 }}>
                      One-time payment • No recurring charges
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* =========================================================================
          CHECKOUT & PAYMENT GATEWAY FORM
          ========================================================================= */}
      <div className="tai-card" style={{ padding: 20, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", marginBottom: 14 }}>
          Payment &amp; Billing Details
        </div>

        {/* Order summary row */}
        <div style={{ background: "var(--surface-3)", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", marginBottom: 16 }}>
          <div className="tai-row tai-between" style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
            <span>{isCourseMode ? (params?.courseTitle || "Course Enrollment") : `${pkg.label} Tier (+${pkg.credits} Credits)`}</span>
            <span>{formatAmount(amount, currency)}</span>
          </div>
          <div className="tai-row tai-between" style={{ fontSize: 11.5, color: "var(--text-3)" }}>
            <span>Processing &amp; Instant Allocation Fee</span>
            <span style={{ color: "#10B981", fontWeight: 700 }}>FREE</span>
          </div>
        </div>

        {/* Email Input */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
            Email address for transaction receipt
          </label>
          <div style={{ position: "relative" }}>
            <Mail size={16} color="var(--text-3)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              className="tai-input"
              style={{ paddingLeft: 36, width: "100%", boxSizing: "border-box" }}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
        </div>

        {/* Payment Provider Selection */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
            Choose payment gateway
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <div
              className={`tai-card-hover`}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                cursor: paystackAllowed ? "pointer" : "not-allowed",
                opacity: paystackAllowed ? 1 : 0.45,
                border: provider === "paystack" ? "2px solid var(--primary)" : "1px solid var(--border)",
                background: provider === "paystack" ? "rgba(37, 99, 235, 0.06)" : "var(--surface-3)"
              }}
              onClick={() => paystackAllowed && setProviderOverride("paystack")}
            >
              <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)" }}>Paystack</div>
              <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2 }}>Card, Bank Transfer &amp; USSD (NGN, USD)</div>
            </div>

            <div
              className={`tai-card-hover`}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                cursor: stripeAllowed ? "pointer" : "not-allowed",
                opacity: stripeAllowed ? 1 : 0.45,
                border: provider === "stripe" ? "2px solid var(--primary)" : "1px solid var(--border)",
                background: provider === "stripe" ? "rgba(37, 99, 235, 0.06)" : "var(--surface-3)"
              }}
              onClick={() => stripeAllowed && setProviderOverride("stripe")}
            >
              <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)" }}>Stripe</div>
              <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2 }}>International Cards &amp; Apple Pay (USD, GBP, EUR)</div>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div style={{ color: "var(--danger)", fontSize: 12.5, fontWeight: 700, padding: "8px 12px", background: "rgba(239, 68, 68, 0.1)", borderRadius: 8, marginBottom: 14 }}>
            {errorMsg}
          </div>
        )}

        <button
          className="tai-btn tai-btn-primary"
          style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          disabled={loading}
          onClick={handlePay}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="tai-spin" />
              <span>Redirecting to {provider === "stripe" ? "Stripe" : "Paystack"}...</span>
            </>
          ) : (
            <>
              <Lock size={15} />
              <span>Pay {formatAmount(amount, currency)} with {provider === "stripe" ? "Stripe" : "Paystack"}</span>
              <ArrowRight size={15} />
            </>
          )}
        </button>

        <div className="tai-row tai-gap6" style={{ justifyContent: "center", marginTop: 14, fontSize: 11.5, color: "var(--text-2)", alignItems: "center" }}>
          <ShieldCheck size={14} color="#10B981" />
          <span>256-bit SSL encrypted checkout. Credits are added to your balance immediately upon payment.</span>
        </div>
      </div>

    </div>
  );
}

