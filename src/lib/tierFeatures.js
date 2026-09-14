// Organization tier feature gating.
//
// SUPERSEDED as the primary mechanism by real per-organization feature
// flags (0115_organization_feature_flags.sql / get_org_features_bulk RPC)
// per "Multi-Tenant Database Architecture Reference" Section 3: "Feature
// availability is not hardcoded per organization type - it's controlled
// centrally by Train AI as platform owner... via toggleable feature flags
// per organization." The map below is now only a client-side fallback for
// use before the real async fetch resolves (or if it fails) - the actual
// source of truth for any real screen is fetchOrgFeatures() in
// lib/api/organizations.js, which calls the real database function and
// respects platform-owner overrides. Keep this map in sync with
// tier_default_feature() in the migration if either changes - that SQL
// function is authoritative, this is a mirror for the fallback path only.
const TIER_RANK = { free: 0, starter: 1, growth: 2, enterprise: 3 };

const FEATURE_MIN_TIER = {
  manager_view: "growth",
  ai_intelligence_advanced: "growth",
  analytics_export: "growth",
  multi_department_breakdown: "growth",
  sso: "enterprise",
  api_integrations: "enterprise",
  integrations: "enterprise", // alias kept for the two call sites already using this key
  custom_branding: "enterprise",
};

export function tierMeetsMinimum(tier, minTier) {
  const rank = TIER_RANK[tier] ?? 0;
  const minRank = TIER_RANK[minTier] ?? 0;
  return rank >= minRank;
}

/**
 * @param {string} tier - the organization's subscription_tier value
 * @param {keyof FEATURE_MIN_TIER} feature
 * @returns {boolean}
 */
export function orgHasFeature(tier, feature) {
  const minTier = FEATURE_MIN_TIER[feature];
  if (!minTier) return true; // ungated feature
  return tierMeetsMinimum(tier, minTier);
}

export function minTierLabelFor(feature) {
  const minTier = FEATURE_MIN_TIER[feature];
  if (!minTier) return null;
  return minTier[0].toUpperCase() + minTier.slice(1);
}
