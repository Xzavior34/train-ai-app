// Train AI - Role Routing Logic
//
// Single source of truth for deciding which app shell (learner vs platform)
// a signed-in user lands on. This app is a state-based SPA (no react-router
// / URL routes for dashboards - see App.jsx), so this intentionally returns
// a view-mode key, not a URL path.
//
// Admin separation (fixed): this used to hardcode a specific email address
// (info@sarafoundationafrica.com - Sara Foundation's inbox, not a Train AI
// one) as an automatic admin/super_admin backdoor, in four places
// (hooks/useAuth.js, services/authService.js, and a dead duplicate in
// lib/api/auth.js). That coupled Train AI's own admin access to a different
// organisation's email account and let anyone who could sign up with that
// address reach the platform admin UI regardless of their real role. It's
// removed. Every access decision now comes only from the real `user_roles`
// table (see fetchMyRoles() in services/authService.js), which Postgres RLS
// already restricts to writes by an existing super_admin
// (ur_write_super_admin, supabase/migrations/0006_rls_policies.sql) - so
// "only approved admin accounts reach platform management" is enforced at
// the database, not by a string match in client code.

// Roles that land in the "platform" shell (TrainAIPlatformApp) instead of
// the "learner" shell (TrainAILearnerApp).
const PLATFORM_ROLES = ["admin", "mentor", "super_admin", "hr", "manager"];

// Demo-mode-only convention (see useAuth.js) for previewing the admin/
// platform experience with no Supabase project connected at all - there is
// no database to read a real role from in that mode. This is plus-addressing
// (`anything+admin@example.com`), the same convention Gmail and most mail
// providers support for testing; it is not a real credential, is not tied to
// any specific inbox, and is completely inert once a real Supabase project
// is configured - real mode never reads this and sources roles only from
// `user_roles`.
export const DEMO_ADMIN_EMAIL_MARKER = "+admin";

export function isDemoAdminMarker(email = "") {
  return !!email && email.toLowerCase().includes(DEMO_ADMIN_EMAIL_MARKER);
}

// Demo-mode-only persistent role registry, keyed by email, so a role
// assigned during demo sign-up (e.g. organization registration promoting
// someone to admin - see organizations.js) survives a sign-out/sign-in
// cycle in the same browser. Without this, signIn's demo path had no
// memory of what signUp (or a later organization registration) had just
// decided - it fabricated a brand-new "learner" session from scratch every
// time based only on the +admin marker, so a demo org account would
// silently revert to learner the moment you signed out and back in. Real
// mode never reads this; it exists purely so demo mode is internally
// consistent with its own past decisions in this browser.
const DEMO_ROLE_REGISTRY_KEY = "trainai_demo_role_registry_v1";

export function getDemoRoleForEmail(email = "") {
  if (!email) return null;
  try {
    const registry = JSON.parse(localStorage.getItem(DEMO_ROLE_REGISTRY_KEY) || "{}");
    return registry[email.toLowerCase()] || null;
  } catch {
    return null;
  }
}

export function setDemoRoleForEmail(email, role) {
  if (!email || !role) return;
  try {
    const registry = JSON.parse(localStorage.getItem(DEMO_ROLE_REGISTRY_KEY) || "{}");
    registry[email.toLowerCase()] = role;
    localStorage.setItem(DEMO_ROLE_REGISTRY_KEY, JSON.stringify(registry));
  } catch {
    // best-effort only - demo-mode convenience, never blocks sign-in/up
  }
}

/**
 * Decide which app shell a signed-in user should see, from their real roles
 * alone.
 * @param {string[]} roles - platform roles for the user (e.g. from user_roles)
 * @returns {"platform"|"learner"}
 */
export function resolveViewMode(roles = []) {
  return roles.some((r) => PLATFORM_ROLES.includes(r)) ? "platform" : "learner";
}

// ============================================================================
// Three separate top-level dashboards, not "Owner as a tab inside Org"
// ============================================================================
// Corrected directly: Platform Owner was previously just one more entry in
// the same WORKSPACES list as Admin/Instructor/HR/Manager, sharing that
// dashboard's sidebar and shell - the exact "just a page/section under
// organisation view" problem this fixes. There are three genuinely separate
// dashboards now: Learner, Organisation (Admin/Instructor/HR/Manager - the
// same one org staff have always had), and Owner (Platform Owner /
// Super Admin, now its own top-level shell with its own sidebar, in
// src/platform/PlatformOwnerApp.jsx).
//
// Access rule, matching what was confirmed directly:
//   - super_admin -> can switch between all three.
//   - any other platform role (admin/mentor/hr/manager) -> can switch
//     between Organisation and Learner only. Owner never appears as an
//     option for them, regardless of which org they administer or how
//     large it is.
//   - a plain learner with no platform role -> Learner only, nothing to
//     switch to.
export const DASHBOARDS = {
  LEARNER: "learner",
  ORGANISATION: "organisation",
  OWNER: "owner",
};

export function getAvailableDashboards(roles = []) {
  if (roles.includes("super_admin")) {
    return [DASHBOARDS.LEARNER, DASHBOARDS.ORGANISATION, DASHBOARDS.OWNER];
  }
  if (roles.some((r) => PLATFORM_ROLES.includes(r))) {
    return [DASHBOARDS.LEARNER, DASHBOARDS.ORGANISATION];
  }
  return [DASHBOARDS.LEARNER];
}

export const DASHBOARD_META = {
  [DASHBOARDS.LEARNER]: { label: "Learner Dashboard", subtitle: "View as student" },
  [DASHBOARDS.ORGANISATION]: { label: "Organisation Dashboard", subtitle: "Manage your organisation" },
  [DASHBOARDS.OWNER]: { label: "Platform Owner Dashboard", subtitle: "Manage the whole platform" },
};
