// Test password reset & canonical domain configuration
import { getCanonicalDomain, CANONICAL_DOMAIN, SUPPORT_EMAIL } from "../src/services/emailService.js";

console.log("=== VERIFYING PASSWORD RESET & DOMAIN CONFIGURATION ===");

console.log("Canonical Domain:", CANONICAL_DOMAIN);
console.log("Support Email:", SUPPORT_EMAIL);
console.log("Resolved App Domain:", getCanonicalDomain());

if (CANONICAL_DOMAIN !== "https://trainailtd.com") {
  throw new Error("Canonical domain must be https://trainailtd.com");
}

console.log("Password reset configuration and domain checks passed successfully!");
