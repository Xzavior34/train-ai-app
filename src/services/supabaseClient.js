import { createClient } from "@supabase/supabase-js";

// ============================================================================
// Two separate Supabase projects:
//   1. Sara Foundation (Dedicated single-tenant project)
//   2. Train AI Shared Organization Database (Multi-tenant shared project)
//      - Houses Train AI LTD / Ajimi.com (Platform Owner / Super Admin)
//      - Houses Digital Users organization (Default org for individual signups)
//      - Houses all customer B2B organizations, academies, and business tenants
// ============================================================================

export const SUPABASE_PROJECTS = {
  SARA_FOUNDATION: "sara_foundation",
  TRAIN_AI_SHARED: "train_ai_shared",
  // Backward compatibility aliases
  SIERRA_FOUNDATION: "sara_foundation",
  B2B: "train_ai_shared",
};

function isValidHttpUrl(string) {
  try {
    const parsed = new URL(string);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_) {
    return false;
  }
}

function buildClient(primaryUrlEnv, primaryKeyEnv, fallbackUrlEnv = "VITE_SUPABASE_URL", fallbackKeyEnv = "VITE_SUPABASE_ANON_KEY") {
  let url = (import.meta.env[primaryUrlEnv] || import.meta.env[fallbackUrlEnv] || "").trim();
  let anonKey = (import.meta.env[primaryKeyEnv] || import.meta.env[fallbackKeyEnv] || "").trim();

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
      console.warn(`Failed to initialize Supabase client for ${primaryUrlEnv}:`, e);
      client = null;
    }
  }
  return { configured: !!client, client };
}

// 1. Sara Foundation - dedicated project
const sara = buildClient("VITE_SUPABASE_SARA_URL", "VITE_SUPABASE_SARA_ANON_KEY", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY");

// 2. Train AI Shared - shared multi-tenant database (Train AI LTD, Digital Users, B2B orgs)
const shared = buildClient("VITE_SUPABASE_SHARED_URL", "VITE_SUPABASE_SHARED_ANON_KEY", "VITE_SUPABASE_B2B_URL", "VITE_SUPABASE_B2B_ANON_KEY");

const CLIENTS_BY_PROJECT = {
  [SUPABASE_PROJECTS.SARA_FOUNDATION]: sara.client,
  [SUPABASE_PROJECTS.TRAIN_AI_SHARED]: shared.client,
};

export const PROJECT_CONFIGURED = {
  [SUPABASE_PROJECTS.SARA_FOUNDATION]: sara.configured,
  [SUPABASE_PROJECTS.TRAIN_AI_SHARED]: shared.configured,
};

/** Returns the client for a specific project regardless of which one is
 * currently "active" */
export function getSupabaseClientForProject(projectKey) {
  if (projectKey === "b2b" || projectKey === "digital_training" || projectKey === SUPABASE_PROJECTS.TRAIN_AI_SHARED) {
    return CLIENTS_BY_PROJECT[SUPABASE_PROJECTS.TRAIN_AI_SHARED] || null;
  }
  return CLIENTS_BY_PROJECT[projectKey] || null;
}

const ACTIVE_PROJECT_STORAGE_KEY = "trainai_active_project_v1";

function readStoredActiveProject() {
  try {
    const stored = localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
    if (stored === "b2b" || stored === "digital_training" || stored === SUPABASE_PROJECTS.TRAIN_AI_SHARED) {
      return SUPABASE_PROJECTS.TRAIN_AI_SHARED;
    }
    if (stored === SUPABASE_PROJECTS.SARA_FOUNDATION) {
      return SUPABASE_PROJECTS.SARA_FOUNDATION;
    }
    return null;
  } catch {
    return null;
  }
}

function getInitialActiveProject() {
  const stored = readStoredActiveProject();
  if (stored && CLIENTS_BY_PROJECT[stored]) return stored;
  if (CLIENTS_BY_PROJECT[SUPABASE_PROJECTS.TRAIN_AI_SHARED]) return SUPABASE_PROJECTS.TRAIN_AI_SHARED;
  if (CLIENTS_BY_PROJECT[SUPABASE_PROJECTS.SARA_FOUNDATION]) return SUPABASE_PROJECTS.SARA_FOUNDATION;
  return SUPABASE_PROJECTS.TRAIN_AI_SHARED;
}

export let activeProject = getInitialActiveProject();
export let supabase = CLIENTS_BY_PROJECT[activeProject] || null;
export let isSupabaseConfigured = !!supabase;

export function setActiveSupabaseProject(projectKey) {
  const normalizedKey =
    projectKey === "b2b" || projectKey === "digital_training" || projectKey === SUPABASE_PROJECTS.TRAIN_AI_SHARED
      ? SUPABASE_PROJECTS.TRAIN_AI_SHARED
      : SUPABASE_PROJECTS.SARA_FOUNDATION;

  activeProject = normalizedKey;
  supabase = CLIENTS_BY_PROJECT[normalizedKey] || null;
  isSupabaseConfigured = !!supabase;
  try {
    localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, normalizedKey);
  } catch {
    // best-effort
  }
}

/**
 * Sign-up routing:
 * - @sarafoundationafrica.com -> Sara Foundation dedicated project
 * - All other signups (individual learners, organization self-serve, Train AI staff)
 *   -> Train AI Shared Multi-Tenant Database
 */
export function resolveProjectForSignUp(email = "", accountType = "learner") {
  const normalized = email.trim().toLowerCase();
  if (normalized.endsWith("@sarafoundationafrica.com")) {
    return SUPABASE_PROJECTS.SARA_FOUNDATION;
  }
  return SUPABASE_PROJECTS.TRAIN_AI_SHARED;
}

/**
 * Sign-in routing:
 * - @sarafoundationafrica.com -> Sara Foundation dedicated project
 * - All other accounts (individuals, organizations, platform owners) -> Train AI Shared Database
 */
export function resolveProjectForSignIn(email = "") {
  const normalized = email.trim().toLowerCase();
  if (normalized.endsWith("@sarafoundationafrica.com")) {
    return SUPABASE_PROJECTS.SARA_FOUNDATION;
  }
  return SUPABASE_PROJECTS.TRAIN_AI_SHARED;
}

export function fallbackProjectForSignIn(triedProjectKey) {
  return null; // Fixed project separation, no third database fallback
}
