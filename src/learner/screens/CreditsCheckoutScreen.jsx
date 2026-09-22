import React, { useState, useMemo } from "react";
import { TopBar, Tag } from "../components/LearnerUI.jsx";
import { Zap, ShieldCheck, Loader2, CreditCard, Plus, CheckCircle2, Lock, Mail, ArrowRight, HelpCircle, Send, Clock3 } from "lucide-react";
import { startPaystackPayment, startStripePayment, PAYMENT_CONTEXTS } from "../../lib/api/payments.js";
import { requestCredits, fetchMyCreditRequests } from "../../lib/api/creditRequests.js";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { getUserLocationCurrency } from "../../lib/locationCurrency.js";

// Credit display note: 10 credits = 1 AI query (cosmetic multiplier applied
// to make balances feel more generous while keeping the same real value).
// Without payment: 20 credits (= 2 real queries). With payment packages below.
const PACKAGES = [
  {
    id: "starter",
    credits: 150,
    label: "Personal Starter",
    tagline: "For individuals joining Train AI's digital training platform",
    features: ["150 AI Neural Credits", "15 AI Tutor queries", "Automated Code Analysis", "Instant credit allocation", "Never expires"],
    priceUSD: 15,
    priceNGN: 15000,
    priceGBP: 12,
    priceEUR: 14,
  },
  {
    id: "pro",
    credits: 2000,
    label: "Pro",
    highlight: true,
    tagline: "Most popular for active career learners",
    features: ["2,000 AI Neural Credits", "200 AI Tutor queries", "Full Mock Technical Interviews", "Live Project Feedback", "Priority AI model response", "Never expires"],
    priceUSD: 15,
    priceNGN: 22000,
    priceGBP: 12,
    priceEUR: 14,
  },
  {
    id: "team",
    credits: 6000,
    label: "Power Learner",
    badge: "BEST VALUE",
    tagline: "Comprehensive career track mastery",
    features: ["6,000 AI Neural Credits", "600 AI Tutor queries", "Unlimited Interview Simulations", "Deep Architectural Reviews", "Portfolio & Resume AI Polish", "Never expires"],
    priceUSD: 35,
    priceNGN: 50000,
    priceGBP: 28,
    priceEUR: 32,
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

export function CreditsCheckoutScreen({ session, params, back, showToast, orgId }) {
  const isCourseMode = params?.mode === "course_enrollment";
  const [activeTab, setActiveTab] = useState(params?.tab === "request" ? "request" : "buy");
  const [requestAmount, setRequestAmount] = useState(50);
  const [requestReason, setRequestReason] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const myRequestsQuery = useSupabaseQuery(
    () => fetchMyCreditRequests(session?.user?.id),
    [session?.user?.id]
  );

  async function handleSubmitRequest() {
    if (!requestAmount || requestAmount <= 0) {
      showToast?.("Enter how many credits you need.");
      return;
    }
    setRequestSubmitting(true);
    try {
      await requestCredits({
        userId: session?.user?.id,
        organizationId: orgId,
        amount: Number(requestAmount),
        reason: requestReason.trim(),
      });
      showToast?.("Credit request sent to your organization.");
      setRequestReason("");
      myRequestsQuery.refetch();
    } catch (err) {
      showToast?.(err?.message || "Could not send your request");
    } finally {
      setRequestSubmitting(false);
    }
  }

  const userLoc = useMemo(() => getUserLocationCurrency(), []);
  const [selectedPackageId, setSelectedPackageId] = useState(PACKAGES[1].id);
  const currency = userLoc.currency;
  const provider = userLoc.provider;
  const [email, setEmail] = useState(session?.user?.email || "");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const pkg = PACKAGES.find((p) => p.id === selectedPackageId) ?? PACKAGES[1];
  const coursePrice = Number(params?.coursePrice) || 0;
  const amount = isCourseMode ? coursePrice : priceFor(pkg, currency);

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
        const metadata = {
          user_id: session?.user?.id ?? null,
          course_id: params?.courseId,
          orgId: params?.orgId || orgId,
        };
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
              <span style={{ background: "var(--primary, #2563EB)", color: "#FFFFFF", padding: "2px 8px", borderRadius: 6, fontWeight: 800, fontSize: 11 }}>
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
        <div style={{ display: "flex", gap: 8, background: "var(--surface-3)", padding: 4, borderRadius: 10, border: "1px solid var(--border)", width: "fit-content" }}>
          <button
            type="button"
            onClick={() => setActiveTab("buy")}
            style={{
              padding: "8px 18px", borderRadius: 7, fontSize: 13, fontWeight: activeTab === "buy" ? 800 : 600,
              background: activeTab === "buy" ? "var(--primary)" : "transparent",
              color: activeTab === "buy" ? "#FFFFFF" : "var(--text)", border: "none", cursor: "pointer"
            }}
          >
            Buy Credits
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("request")}
            style={{
              padding: "8px 18px", borderRadius: 7, fontSize: 13, fontWeight: activeTab === "request" ? 800 : 600,
              background: activeTab === "request" ? "var(--primary)" : "transparent",
              color: activeTab === "request" ? "#FFFFFF" : "var(--text)", border: "none", cursor: "pointer"
            }}
          >
            Request from Organization
          </button>
        </div>
      )}

      {!isCourseMode && activeTab === "request" && (
        <div className="tai-card" style={{ padding: 20, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", marginBottom: 6 }}>
            Request AI Credits from Your Organization
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-2)", margin: "0 0 16px", lineHeight: 1.5 }}>
            Send a request to your organization for AI credits instead of paying for them yourself. Your admin will review it.
          </p>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
              How many credits do you need?
            </label>
            <input
              className="tai-input"
              style={{ width: "100%", boxSizing: "border-box", maxWidth: 200 }}
              type="number"
              min={1}
              value={requestAmount}
              onChange={(e) => setRequestAmount(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
              Reason (optional)
            </label>
            <textarea
              className="tai-input"
              style={{ width: "100%", boxSizing: "border-box", minHeight: 70, resize: "vertical", fontFamily: "inherit" }}
              placeholder="e.g. Finishing my current course and need more AI Coach queries this week"
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
            />
          </div>

          <button
            className="tai-btn tai-btn-primary"
            style={{ padding: "10px 18px", fontSize: 13.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 8 }}
            disabled={requestSubmitting}
            onClick={handleSubmitRequest}
          >
            {requestSubmitting ? <Loader2 size={15} className="tai-spin" /> : <Send size={15} />}
            <span>{requestSubmitting ? "Sending..." : "Send Request"}</span>
          </button>

          {(myRequestsQuery.data || []).length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 10 }}>
                Your Requests
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {myRequestsQuery.data.map((r) => (
                  <div key={r.id} className="tai-row tai-between" style={{ padding: "10px 12px", background: "var(--surface-3)", borderRadius: 8, border: "1px solid var(--border)", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                      <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
                        <Clock3 size={14} color="var(--text-3)" />
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{r.amount} credits</span>
                        <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                      {r.reason && (
                        <div style={{ fontSize: 12, color: "var(--text-2)", fontStyle: "italic", marginLeft: 22 }}>
                          &ldquo;{r.reason}&rdquo;
                        </div>
                      )}
                    </div>
                    <Tag tone={r.status === "approved" ? "success" : r.status === "denied" ? "danger" : "warning"}>
                      {r.status === "pending" ? "Pending Review" : r.status === "approved" ? "Approved" : "Denied"}
                    </Tag>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(isCourseMode || activeTab === "buy") && !isCourseMode && (
        <>
          {/* Dynamic Location-Based Pricing Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>Select Package</div>
              <div style={{ fontSize: 12, color: "var(--text-2)" }}>Pricing in your local currency ({currency} • {userLoc.name})</div>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--surface-3)", padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>
              <span>{userLoc.symbol} {currency}</span>
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
      {(isCourseMode || activeTab === "buy") && (
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

        {/* Payment Gateway Info */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
            Payment processing
          </label>
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface-3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap"
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)" }}>
                {provider === "stripe" ? "Stripe Direct Checkout" : "Paystack Direct Checkout"}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 2 }}>
                {provider === "stripe"
                  ? `Secure card & digital payment in ${currency}`
                  : `Cards, Bank Transfer & USSD in ${currency}`}
              </div>
            </div>
            <Tag tone="success">
              <ShieldCheck size={12} style={{ marginRight: 4 }} />
              256-Bit Encrypted
            </Tag>
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
      )}

    </div>
  );
}

