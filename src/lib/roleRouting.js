// Sara Foundation Africa — Role Routing Logic
//
// Single source of truth for the platform admin email and for deciding which
// app shell (learner vs platform) a signed-in user lands on. This app is a
// state-based SPA (no react-router / URL routes for dashboards — see
// App.jsx), so this intentionally returns a view-mode key, not a URL path.
// Everything that previously hardcoded its own copy of ADMIN_EMAIL
// (hooks/useAuth.js, lib/useAuth.js, services/authService.js) now imports it
// from here so there is exactly one place to change it.

export const ADMIN_EMAIL = "info@sarafoundationafrica.com";

// Roles that land in the "platform" shell (TrainAIPlatformApp) instead of
// the "learner" shell (TrainAILearnerApp). Keep in sync with PLATFORM_ROLES
// used to be duplicated in App.jsx directly; App.jsx now calls this instead.
const PLATFORM_ROLES = ["admin", "mentor", "super_admin", "hr", "manager"];

export function isAdminEmail(email = "") {
  return !!email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

/**
 * Decide which app shell a signed-in user should see.
 * @param {string[]} roles - platform roles for the user (e.g. from user_roles)
 * @param {string} email - the signed-in user's email
 * @returns {"platform"|"learner"}
 */
export function resolveViewMode(roles = [], email = "") {
  if (isAdminEmail(email)) return "platform";
  return roles.some((r) => PLATFORM_ROLES.includes(r)) ? "platform" : "learner";
}
