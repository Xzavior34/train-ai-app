import { createClient } from "@supabase/supabase-js";

// ============================================================================
// Three separate Supabase projects, confirmed - not one shared database,
// and not the earlier "Digital Training Org + B2B combined" proposal either
// ============================================================================
// Confirmed directly, correcting an earlier version of this file that
// combined Digital Training Organization and B2B into one shared project:
//
//   1. Sara Foundation - its own dedicated project.
//   2. Digital Training Organization - its own dedicated project. Owned and
//      operated by Train AI itself as its own B2C product line - this is
//      also where Super Admin / Platform Owner accounts live
//      (info@trainailtd.com is provisioned here with BOTH the 'admin' role
//      for Digital Training Organization itself AND the platform-wide
//      'super_admin' role - one account, two roles, same multi-role support
//      this app already had everywhere else).
//   3. B2B - one shared project for every business-organization tenant (the
//      three seeded demo orgs, and every real business customer going
//      forward), isolated tenant-by-tenant inside it via organization_id +
//      RLS, the same model this app has always used at that level.
//
// There is no separate fourth "Platform" project - that was this file's
// own earlier proposal, explicitly not confirmed, and superseded by
// provisioning Super Admin inside the Digital Training Organization project
// instead.
//
// Each project is configured independently and degrades to demo mode
// (null client) exactly like the single-project version always did if its
// own two env vars aren't set.
// ============================================================================

export const SUPABASE_PROJECTS = {
  SARA_FOUNDATION: "sara_foundation",
  DIGITAL_TRAINING: "digital_training", // Digital Training Organization + Super Admin accounts
  B2B: "b2b", // every business-organization tenant, isolated internally by organization_id + RLS
};

function isValidHttpUrl(string) {
  try {
    const parsed = new URL(string);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_) {
    return false;
  }
}

function buildClient(urlEnvKey, anonKeyEnvKey) {
  const url = (import.meta.env[urlEnvKey] || "").trim();
  const anonKey = (import.meta.env[anonKeyEnvKey] || "").trim();
  const isValidUrl = isValidHttpUrl(url);
  const isPlaceholderKey =
    !anonKey ||
    anonKey.toLowerCase().includes("your-") ||
    anonKey.toLowerCase().includes("anon-public-key") ||
    anonKey.length < 10;
  const configured = isValidUrl && !isPlaceholderKey;
  let client = null;
  if (configured) {
    try {
      client = createClient(url, anonKey);
    } catch (e) {
      console.warn(`Failed to initialize Supabase client for ${urlEnvKey}:`, e);
      client = null;
    }
  }
  return { configured: !!client, client };
}

// Sara Foundation - the project already in .env.example (previously
// described as "the" shared project for this whole app - that was correct
// before the three-project split was confirmed; it belongs to this one
// tenant only now).
const sara = buildClient("VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY");

// Digital Training Organization - real credentials don't exist in this
// codebase yet. Also where Super Admin accounts are provisioned - see the
// header comment above.
const digitalTraining = buildClient("VITE_SUPABASE_DIGITAL_TRAINING_URL", "VITE_SUPABASE_DIGITAL_TRAINING_ANON_KEY");

// B2B - real credentials don't exist in this codebase yet.
const b2b = buildClient("VITE_SUPABASE_B2B_URL", "VITE_SUPABASE_B2B_ANON_KEY");

const CLIENTS_BY_PROJECT = {
  [SUPABASE_PROJECTS.SARA_FOUNDATION]: sara.client,
  [SUPABASE_PROJECTS.DIGITAL_TRAINING]: digitalTraining.client,
  [SUPABASE_PROJECTS.B2B]: b2b.client,
};

export const PROJECT_CONFIGURED = {
  [SUPABASE_PROJECTS.SARA_FOUNDATION]: sara.configured,
  [SUPABASE_PROJECTS.DIGITAL_TRAINING]: digitalTraining.configured,
  [SUPABASE_PROJECTS.B2B]: b2b.configured,
};

/** Returns the client for a specific project regardless of which one is
 * currently "active" - Super Admin needs this to reach a project other
 * than the one their own session is authenticated against. */
export function getSupabaseClientForProject(projectKey) {
  return CLIENTS_BY_PROJECT[projectKey] || null;
}

const ACTIVE_PROJECT_STORAGE_KEY = "trainai_active_project_v1";

function readStoredActiveProject() {
  try {
    return localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

// The live binding every existing file that does
// `import { supabase } from ...` already depends on. `let`, not `const` -
// ES module bindings are live, so reassigning this here is visible to every
// other module that imported it, without needing to touch any of their
// import statements.
export let activeProject = readStoredActiveProject() || SUPABASE_PROJECTS.DIGITAL_TRAINING;
export let supabase = CLIENTS_BY_PROJECT[activeProject] || null;
export let isSupabaseConfigured = !!supabase;

export function setActiveSupabaseProject(projectKey) {
  activeProject = projectKey;
  supabase = CLIENTS_BY_PROJECT[projectKey] || null;
  isSupabaseConfigured = !!supabase;
  try {
    localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, projectKey);
  } catch {
    // best-effort
  }
}

/**
 * Sign-up routing: which project a brand-new account should be created in.
 * Known up front because the sign-up form already captures the one piece
 * of information that decides it - account type - before this is ever
 * called. @sarafoundationafrica.com and @trainailtd.com are fixed
 * exceptions regardless of account type (a Sara Foundation or Train AI
 * staff email always goes to their own project); everyone else goes by
 * what they actually chose to sign up as.
 */
export function resolveProjectForSignUp(email = "", accountType = "learner") {
  const normalized = email.trim().toLowerCase();
  if (normalized.endsWith("@sarafoundationafrica.com")) {
    return SUPABASE_PROJECTS.SARA_FOUNDATION;
  }
  if (normalized.endsWith("@trainailtd.com")) {
    return SUPABASE_PROJECTS.DIGITAL_TRAINING;
  }
  return accountType === "organization" ? SUPABASE_PROJECTS.B2B : SUPABASE_PROJECTS.DIGITAL_TRAINING;
}

/**
 * Sign-in routing is genuinely harder than sign-up: an existing account's
 * project can't be inferred from email domain alone once Digital Training
 * Organization and B2B are separate databases - a plain gmail.com address
 * could belong to either one, and there's no cross-project lookup service
 * to ask first. @sarafoundationafrica.com and @trainailtd.com still resolve
 * with certainty (fixed domains, always their own project). For everything
 * else, this returns Digital Training Organization as the first project to
 * try - the caller (useAuth.js) is expected to fall back to B2B if that
 * attempt fails with an auth error, rather than this function guessing.
 */
export function resolveProjectForSignIn(email = "") {
  const normalized = email.trim().toLowerCase();
  if (normalized.endsWith("@sarafoundationafrica.com")) {
    return SUPABASE_PROJECTS.SARA_FOUNDATION;
  }
  if (normalized.endsWith("@trainailtd.com")) {
    return SUPABASE_PROJECTS.DIGITAL_TRAINING;
  }
  return SUPABASE_PROJECTS.DIGITAL_TRAINING;
}

export function fallbackProjectForSignIn(triedProjectKey) {
  if (triedProjectKey === SUPABASE_PROJECTS.DIGITAL_TRAINING) return SUPABASE_PROJECTS.B2B;
  if (triedProjectKey === SUPABASE_PROJECTS.B2B) return SUPABASE_PROJECTS.DIGITAL_TRAINING;
  return null; // Sara Foundation has no fallback - it's a fixed domain match, not a guess
}
