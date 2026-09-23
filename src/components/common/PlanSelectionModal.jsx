import React, { useState, useMemo } from "react";
import { Check, X, Building2, ShieldCheck, ArrowRight, Zap, Layers, Users, Lock, HelpCircle } from "lucide-react";
import { getUserLocationCurrency } from "../../lib/locationCurrency.js";

export const PLAN_TIERS = {
  starter: {
    id: "starter",
    name: "Basic",
    tagline: "For small teams starting structured AI training — 1 admin, 1 instructor & 20 learners included",
    priceNGN: 250000,
    priceUSD: 250,
    priceGBP: 190,
    priceEUR: 220,
    period: "month",
    seatLimit: "20 included (max 50 seats)",
    popular: false,
    badge: "Essential",
    color: "var(--primary-light, #3B82F6)",
    features: [
      { text: "1 Admin seat + 1 Instructor seat included", included: true },
      { text: "20 learner seats included (expandable up to 50 max seats)", included: true },
      { text: "Additional learners at ₦15,000 / $15 per seat", included: true },
      { text: "220 AI credits (2,200 AI queries) for entire organisation", included: true },
      { text: "Course Builder & Cohort management", included: true },
      { text: "Org-wide completion & progress analytics", included: true },
      { text: "Community forums & peer study groups", included: true },
      { text: "Default Train AI branding (no customisation)", included: true },
      { text: "Manager & Department performance portals", included: false },
      { text: "Workforce Intelligence & Skill Graphs", included: false },
      { text: "Custom white-label branding & API integrations", included: false },
    ],
    ctaText: "Select Basic",
  },
  growth: {
    id: "growth",
    name: "Intermediate",
    tagline: "For scaling organisations needing manager visibility, workforce intelligence & custom branding",
    priceNGN: 500000,
    priceUSD: 500,
    priceGBP: 400,
    priceEUR: 440,
    period: "month",
    seatLimit: "50 included (max 150 seats)",
    popular: true,
    badge: "Most Popular",
    color: "var(--primary, #2563EB)",
    features: [
      { text: "Multiple Admin & Instructor seats", included: true },
      { text: "50 learner seats included (expandable up to 150 max seats)", included: true },
      { text: "Additional seats at ₦10,000 / $10 per seat", included: true },
      { text: "400 AI credits (4,000 AI queries) for entire organisation", included: true },
      { text: "Manager View & Team Lead Dashboards", included: true },
      { text: "Workforce Intelligence & AI Skill Graphs", included: true },
      { text: "Data download — CSV / PDF Exports", included: true },
      { text: "Custom white-label branding on Train AI", included: true },
      { text: "Priority Support & Live Cohort Sessions", included: true },
      { text: "API connection & Webhook linking", included: false },
      { text: "Enterprise SSO (SAML, Okta, Azure AD)", included: false },
    ],
    ctaText: "Select Intermediate",
  },
  enterprise: {
    id: "enterprise",
    name: "Advanced",
    tagline: "Contact our sales team for a fully bespoke enterprise solution tailored to your organisation",
    priceNGN: null,
    priceUSD: null,
    priceGBP: null,
    priceEUR: null,
    period: "custom",
    seatLimit: "150 included (unlimited expansion)",
    popular: false,
    badge: "Enterprise",
    color: "#0F172A",
    features: [
      { text: "Multiple Admin, Manager & Instructor seats", included: true },
      { text: "150 base seats included + unlimited expansion", included: true },
      { text: "All Intermediate features included", included: true },
      { text: "Workforce Intelligence & predictive analytics", included: true },
      { text: "Data download — CSV / PDF Exports", included: true },
      { text: "API connection & Webhook linking", included: true },
      { text: "Full custom white-label branding", included: true },
      { text: "Enterprise SSO (SAML 2.0, Okta, Azure AD)", included: true },
      { text: "Dedicated Customer Success Manager & SLA", included: true },
      { text: "And much more…", included: true },
    ],
    ctaText: "Contact Sales Team",
  },
};

export function PlanSelectionModal({
  isOpen,
  onClose,
  selectedTier = "growth",
  onSelectTier,
  currency = null,
  onToggleCurrency,
  onContactEnterprise,
  currentTier = null,
  isUpgradeMode = false,
  isLoading = false
}) {
  const userLoc = useMemo(() => getUserLocationCurrency(), []);
  const curr = currency || userLoc.currency;

  if (!isOpen) return null;

  return (
    <div style={modalStyles.backdrop} onClick={onClose}>
      <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={modalStyles.header}>
          <div>
            <div style={modalStyles.tagRow}>
              <span style={modalStyles.tag}>
                <Building2 size={13} style={{ marginRight: 4 }} /> ORGANIZATION PLANS
              </span>
            </div>
            <h2 style={modalStyles.title}>Choose your organization plan</h2>
            <p style={modalStyles.subtitle}>
              Every plan includes structured cohort management and verifiable workforce training. Upgrade anytime as your team scales.
            </p>
          </div>

          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#F1F5F9", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#1E293B" }}>
            <span>{userLoc.symbol} {curr} • {userLoc.name}</span>
          </div>
        </div>

        {/* Plan Cards Grid */}
        <div style={modalStyles.grid}>
          {Object.values(PLAN_TIERS).map((plan) => {
            const isSelected = selectedTier === plan.id;
            const isCurrent = currentTier === plan.id;
            const priceMap = {
              NGN: plan.priceNGN,
              USD: plan.priceUSD,
              GBP: plan.priceGBP,
              EUR: plan.priceEUR,
            };
            const price = priceMap[curr] ?? plan.priceUSD;
            const symbol = userLoc.symbol || "$";

            return (
              <div
                key={plan.id}
                style={{
                  ...modalStyles.card,
                  borderColor: plan.popular ? "var(--primary, #2563EB)" : isSelected ? "var(--primary-light, #3B82F6)" : "#E2E8F0",
                  boxShadow: plan.popular ? "0 10px 25px -5px rgba(37,99,235,0.15), 0 8px 10px -6px rgba(37,99,235,0.1)" : "0 1px 3px rgba(15,23,42,0.05)",
                  transform: plan.popular ? "scale(1.02)" : "none",
                }}
              >
                {plan.popular && (
                  <div style={modalStyles.popularBadge}>
                    ★ MOST POPULAR
                  </div>
                )}

                <div style={modalStyles.cardHeader}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={modalStyles.planName}>{plan.name}</h3>
                    <span style={{ ...modalStyles.badge, background: plan.popular ? "var(--primary-tint, #EFF6FF)" : "#F1F5F9", color: plan.popular ? "var(--primary, #2563EB)" : "#475569" }}>
                      {plan.seatLimit}
                    </span>
                  </div>
                  <p style={modalStyles.planTagline}>{plan.tagline}</p>
                </div>

                {/* Price Display */}
                <div style={modalStyles.priceWrap}>
                  {price ? (
                    <>
                      <div style={modalStyles.priceAmount}>
                        <span style={modalStyles.currencySymbol}>{symbol}</span>
                        {price.toLocaleString()}
                      </div>
                      <span style={modalStyles.period}>/month</span>
                    </>
                  ) : (
                    <div style={modalStyles.customPrice}>Custom Pricing</div>
                  )}
                </div>

                {/* CTA Button */}
                <button
                  type="button"
                  disabled={isLoading || isCurrent}
                  style={{
                    ...modalStyles.ctaBtn,
                    background: isCurrent ? "#F1F5F9" : plan.popular ? "var(--primary, #2563EB)" : isSelected ? "#1E293B" : "#0F172A",
                    color: isCurrent ? "#64748B" : "#FFFFFF",
                    cursor: isCurrent ? "default" : "pointer",
                  }}
                  onClick={() => {
                    if (plan.id === "enterprise") {
                      onContactEnterprise ? onContactEnterprise() : onSelectTier(plan.id);
                    } else {
                      onSelectTier && onSelectTier(plan.id);
                    }
                  }}
                >
                  {isCurrent ? "Current Active Plan" : isLoading && isSelected ? "Processing..." : plan.ctaText}
                  {!isCurrent && <ArrowRight size={14} style={{ marginLeft: 6 }} />}
                </button>

                {/* Feature List */}
                <div style={modalStyles.featuresContainer}>
                  <div style={modalStyles.featuresHeading}>INCLUDED CAPABILITIES:</div>
                  <ul style={modalStyles.featureList}>
                    {plan.features.map((feat, idx) => (
                      <li key={idx} style={modalStyles.featureItem}>
                        {feat.included ? (
                          <div style={modalStyles.checkIcon}>
                            <Check size={12} color="#16A34A" strokeWidth={3} />
                          </div>
                        ) : (
                          <div style={modalStyles.crossIcon}>
                            <X size={12} color="#94A3B8" strokeWidth={2.5} />
                          </div>
                        )}
                        <span style={{ ...modalStyles.featureText, color: feat.included ? "#1E293B" : "#94A3B8" }}>
                          {feat.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div style={modalStyles.footer}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748B" }}>
            <ShieldCheck size={16} color="var(--primary, #2563EB)" />
            <span>All plans include encrypted data isolation, automated audit logging, and individual AI credit governance.</span>
          </div>
          <button type="button" onClick={onClose} style={modalStyles.closeBtn}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const modalStyles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.65)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10000,
    padding: "20px",
    overflowY: "auto",
  },
  modal: {
    background: "#FFFFFF",
    borderRadius: 16,
    width: "100%",
    maxWidth: 1100,
    padding: "32px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    border: "1px solid #E2E8F0",
    maxHeight: "92vh",
    overflowY: "auto",
    fontFamily: "var(--font-sans, 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 28,
    borderBottom: "1px solid #F1F5F9",
    paddingBottom: 20,
  },
  tagRow: { marginBottom: 6 },
  tag: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: 11,
    fontWeight: 700,
    color: "var(--primary, #2563EB)",
    background: "var(--primary-tint, #EFF6FF)",
    padding: "3px 8px",
    borderRadius: 6,
    letterSpacing: "0.04em",
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    color: "#0F172A",
    margin: "0 0 6px",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    fontSize: 13.5,
    color: "#64748B",
    margin: 0,
    maxWidth: 620,
    lineHeight: 1.5,
  },
  currencyToggleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#F8FAFC",
    padding: "6px 12px",
    borderRadius: 10,
    border: "1px solid #E2E8F0",
  },
  toggleContainer: {
    display: "flex",
    background: "#E2E8F0",
    padding: 2,
    borderRadius: 6,
  },
  toggleBtn: {
    border: "none",
    background: "transparent",
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 700,
    color: "#64748B",
    borderRadius: 4,
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  toggleBtnActive: {
    background: "#FFFFFF",
    color: "#0F172A",
    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 20,
    alignItems: "stretch",
    marginBottom: 28,
  },
  card: {
    background: "#FFFFFF",
    borderRadius: 12,
    border: "1.5px solid #E2E8F0",
    padding: "24px 20px",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    transition: "all 0.2s ease",
  },
  popularBadge: {
    position: "absolute",
    top: -12,
    left: "50%",
    transform: "translateX(-50%)",
    background: "var(--primary, #2563EB)",
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: 800,
    padding: "3px 12px",
    borderRadius: 20,
    display: "flex",
    alignItems: "center",
    letterSpacing: "0.06em",
    boxShadow: "0 2px 6px rgba(37,99,235,0.35)",
  },
  cardHeader: {
    marginBottom: 16,
  },
  planName: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0F172A",
    margin: 0,
  },
  badge: {
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 6,
  },
  planTagline: {
    fontSize: 12,
    color: "#64748B",
    margin: "6px 0 0",
    lineHeight: 1.45,
    minHeight: 36,
  },
  priceWrap: {
    display: "flex",
    alignItems: "baseline",
    gap: 4,
    margin: "12px 0 18px",
    paddingBottom: 16,
    borderBottom: "1px solid #F1F5F9",
  },
  priceAmount: {
    fontSize: 26,
    fontWeight: 900,
    color: "#0F172A",
    letterSpacing: "-0.03em",
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: 700,
    marginRight: 2,
    color: "#475569",
  },
  period: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: 600,
  },
  customPrice: {
    fontSize: 22,
    fontWeight: 800,
    color: "#0F172A",
  },
  ctaBtn: {
    width: "100%",
    border: "none",
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 13.5,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s ease",
    marginBottom: 20,
  },
  featuresContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  featuresHeading: {
    fontSize: 10.5,
    fontWeight: 800,
    color: "#94A3B8",
    letterSpacing: "0.06em",
    marginBottom: 12,
  },
  featureList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  featureItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    fontSize: 12.5,
    lineHeight: 1.45,
  },
  checkIcon: {
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "#DCFCE7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  crossIcon: {
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "#F1F5F9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  featureText: {
    fontSize: 12.5,
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    borderTop: "1px solid #F1F5F9",
    paddingTop: 18,
  },
  closeBtn: {
    background: "transparent",
    border: "1px solid #CBD5E1",
    padding: "8px 18px",
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 700,
    color: "#475569",
    cursor: "pointer",
  },
};
