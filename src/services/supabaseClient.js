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
  ORGANIZATION_DB: "organization_db",
  TRAIN_AI_SHARED: "organization_db",
  // Backward compatibility aliases
  SIERRA_FOUNDATION: "sara_foundation",
  B2B: "organization_db",
  DIGITAL_TRAINING: "organization_db",
};

function normalizeSupabaseUrl(string) {
  if (!string) return "";
  let clean = string.trim();
  if (clean.toLowerCase().includes("your-")) return "";
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    clean = `https://${clean}.supabase.co`;
  }
  return clean;
}

function isValidHttpUrl(string) {
  try {
    const parsed = new URL(string);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_) {
    return false;
  }
}

const DEFAULT_ORG_DB_URL = "https://djikuoucsuhdiyrhsduz.supabase.co";
const DEFAULT_ORG_DB_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqaWt1b3Vjc3VoZGl5cmhzZHV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTQ2MjMwNSwiZXhwIjoyMTA1MDM4MzA1fQ.Nz1OWlBcnw4wW3dLtKqjgSmOvQ4FI5YUl-3Knt9JqOY";

const DEFAULT_SARA_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const DEFAULT_SARA_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6Implb2JnZ3J0eGV5Ynh2bHdweHZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMyNjM1NywiZXhwIjoyMTAyOTAyMzU3fQ.uDCs11c1ti9xGopgIcrVAGALgvjrhYSLMZyu5A_F-_Y";

function buildClient(primaryUrlEnv, primaryKeyEnv, fallbackUrlEnvs = [], fallbackKeyEnvs = [], defaultUrl = "", defaultKey = "") {
  let url = (import.meta.env[primaryUrlEnv] || "").trim();
  let anonKey = (import.meta.env[primaryKeyEnv] || "").trim();

  if (!url) {
    for (const fb of (Array.isArray(fallbackUrlEnvs) ? fallbackUrlEnvs : [fallbackUrlEnvs])) {
      const val = (import.meta.env[fb] || "").trim();
      if (val) { url = val; break; }
    }
  }
  if (!anonKey) {
    for (const fb of (Array.isArray(fallbackKeyEnvs) ? fallbackKeyEnvs : [fallbackKeyEnvs])) {
      const val = (import.meta.env[fb] || "").trim();
      if (val) { anonKey = val; break; }
    }
  }

  url = normalizeSupabaseUrl(url);
  if (!url && defaultUrl) url = normalizeSupabaseUrl(defaultUrl);
  if (!anonKey && defaultKey) anonKey = defaultKey;

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

// 1. Train AI 2.0 / Sara Foundation - dedicated project (jeobggrtxeybxvlwpxvn)
const sara = buildClient(
  "VITE_SUPABASE_SARA_URL",
  "VITE_SUPABASE_SARA_ANON_KEY",
  ["VITE_SUPABASE_URL"],
  ["VITE_SUPABASE_ANON_KEY"],
  DEFAULT_SARA_URL,
  DEFAULT_SARA_ANON_KEY
);

// 2. Train AI 2.0 / Organization Database - central platform & tenant project (djikuoucsuhdiyrhsduz)
const orgDb = buildClient(
  "VITE_SUPABASE_ORGANIZATION_URL",
  "VITE_SUPABASE_ORGANIZATION_ANON_KEY",
  ["VITE_SUPABASE_SHARED_URL", "VITE_SUPABASE_B2B_URL", "VITE_SUPABASE_DIGITAL_TRAINING_URL"],
  ["VITE_SUPABASE_SHARED_ANON_KEY", "VITE_SUPABASE_B2B_ANON_KEY", "VITE_SUPABASE_DIGITAL_TRAINING_ANON_KEY"],
  DEFAULT_ORG_DB_URL,
  DEFAULT_ORG_DB_ANON_KEY
);

const CLIENTS_BY_PROJECT = {
  [SUPABASE_PROJECTS.SARA_FOUNDATION]: sara.client,
  [SUPABASE_PROJECTS.ORGANIZATION_DB]: orgDb.client,
};

export const PROJECT_CONFIGURED = {
  [SUPABASE_PROJECTS.SARA_FOUNDATION]: sara.configured,
  [SUPABASE_PROJECTS.ORGANIZATION_DB]: orgDb.configured,
};

/** Returns the client for a specific project regardless of which one is
 * currently "active" */
export function getSupabaseClientForProject(projectKey) {
  if (projectKey === "b2b" || projectKey === "digital_training" || projectKey === "train_ai_shared" || projectKey === SUPABASE_PROJECTS.ORGANIZATION_DB) {
    return CLIENTS_BY_PROJECT[SUPABASE_PROJECTS.ORGANIZATION_DB] || null;
  }
  return CLIENTS_BY_PROJECT[projectKey] || null;
}

const ACTIVE_PROJECT_STORAGE_KEY = "trainai_active_project_v1";

function readStoredActiveProject() {
  try {
    const stored = localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
    if (stored === "b2b" || stored === "digital_training" || stored === "train_ai_shared" || stored === SUPABASE_PROJECTS.ORGANIZATION_DB) {
      return SUPABASE_PROJECTS.ORGANIZATION_DB;
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
  try {
    const sessionStr = localStorage.getItem("trainai_active_session_v1");
    if (sessionStr) {
      const parsed = JSON.parse(sessionStr);
      const email = parsed?.user?.email;
      if (email) {
        return resolveProjectForSignIn(email);
      }
    }
  } catch {}

  const stored = readStoredActiveProject();
  if (stored && CLIENTS_BY_PROJECT[stored]) return stored;
  if (CLIENTS_BY_PROJECT[SUPABASE_PROJECTS.ORGANIZATION_DB]) return SUPABASE_PROJECTS.ORGANIZATION_DB;
  if (CLIENTS_BY_PROJECT[SUPABASE_PROJECTS.SARA_FOUNDATION]) return SUPABASE_PROJECTS.SARA_FOUNDATION;
  return SUPABASE_PROJECTS.ORGANIZATION_DB;
}

export let activeProject = getInitialActiveProject();
export let supabase = CLIENTS_BY_PROJECT[activeProject] || null;
export let isSupabaseConfigured = !!supabase;

export function setActiveSupabaseProject(projectKey) {
  const normalizedKey =
    projectKey === "b2b" || projectKey === "digital_training" || projectKey === "train_ai_shared" || projectKey === SUPABASE_PROJECTS.ORGANIZATION_DB
      ? SUPABASE_PROJECTS.ORGANIZATION_DB
      : SUPABASE_PROJECTS.SARA_FOUNDATION;

  activeProject = normalizedKey;
  supabase = CLIENTS_BY_PROJECT[normalizedKey] || null;
  isSupabaseConfigured = !!supabase;
  try {
    localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, normalizedKey);
    window.dispatchEvent(new CustomEvent("trainai-project-change", { detail: { project: normalizedKey } }));
  } catch {
    // best-effort
  }
}

/**
 * Sign-up routing:
 * - @sarafoundationafrica.com -> Train AI 2.0 / Sara Foundation Dedicated Database (jeobggrtxeybxvlwpxvn)
 * - All other signups (individual learners, organization self-serve, Train AI staff)
 *   -> Train AI 2.0 / Organization Database (djikuoucsuhdiyrhsduz)
 */
export function resolveProjectForSignUp(email = "", accountType = "learner") {
  const normalized = email.trim().toLowerCase();
  if (normalized.endsWith("@sarafoundationafrica.com")) {
    return SUPABASE_PROJECTS.SARA_FOUNDATION;
  }
  return SUPABASE_PROJECTS.ORGANIZATION_DB;
}

/**
 * Sign-in routing:
 * - @sarafoundationafrica.com -> Train AI 2.0 / Sara Foundation Dedicated Database (jeobggrtxeybxvlwpxvn)
 * - All other accounts (individuals, organizations, platform owners) -> Train AI 2.0 / Organization Database (djikuoucsuhdiyrhsduz)
 */
export function resolveProjectForSignIn(email = "") {
  const normalized = email.trim().toLowerCase();
  if (normalized.endsWith("@sarafoundationafrica.com")) {
    return SUPABASE_PROJECTS.SARA_FOUNDATION;
  }
  return SUPABASE_PROJECTS.ORGANIZATION_DB;
}

export function fallbackProjectForSignIn(triedProjectKey) {
  if (triedProjectKey === SUPABASE_PROJECTS.SARA_FOUNDATION) {
    return PROJECT_CONFIGURED[SUPABASE_PROJECTS.ORGANIZATION_DB] ? SUPABASE_PROJECTS.ORGANIZATION_DB : null;
  }
  if (triedProjectKey === SUPABASE_PROJECTS.ORGANIZATION_DB) {
    return PROJECT_CONFIGURED[SUPABASE_PROJECTS.SARA_FOUNDATION] ? SUPABASE_PROJECTS.SARA_FOUNDATION : null;
  }
  return null;
}

