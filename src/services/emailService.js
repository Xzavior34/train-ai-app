// Train AI canonical links. Transactional email is intentionally server-only;
// never add provider API keys to a VITE_* variable because Vite exposes those
// values in the public browser bundle.
export const CANONICAL_DOMAIN = "https://trainailtd.com";
export const SUPPORT_EMAIL = "info@trainailtd.com";

export function getCanonicalDomain() {
  if (typeof window !== "undefined" && window.location?.origin && window.location.origin.startsWith("http")) {
    return window.location.origin;
  }
  return CANONICAL_DOMAIN;
}
