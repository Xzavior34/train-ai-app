import { createClient } from "@supabase/supabase-js";

// ============================================================================
// Train AI Unified Database Architecture
// Primary & Sole Production Database: jeobggrtxeybxvlwpxvn
//   - Houses Platform Owner / Super Admin (trainailtd@gmail.com)
//   - Houses Sara Foundation, Digital Users, and all B2B enterprise tenants
//   - Houses all courses, cohorts, study groups, enrollments, and demo bookings
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

const env = (typeof import.meta !== "undefined" && import.meta.env) ? import.meta.env : (typeof process !== "undefined" && process.env ? process.env : {});

// Sole canonical database: jeobggrtxeybxvlwpxvn
export const UNIFIED_SUPABASE_URL =
  env.VITE_SUPABASE_URL ||
  env.VITE_SUPABASE_SARA_URL ||
  env.VITE_SUPABASE_ORGANIZATION_URL ||
  env.VITE_SUPABASE_SHARED_URL ||
  "https://jeobggrtxeybxvlwpxvn.supabase.co";

export const UNIFIED_SUPABASE_ANON_KEY =
  env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_SARA_ANON_KEY ||
  env.VITE_SUPABASE_ORGANIZATION_ANON_KEY ||
  env.VITE_SUPABASE_SHARED_ANON_KEY ||
  "sb_publishable_BvoX4QvVa1-pG6mx7NsVUQ_4GXGlwaJ";

function buildClient(projectUrl, publishableKey, authOptions = {}) {
  const url = normalizeSupabaseUrl(projectUrl);
  const anonKey = (publishableKey || "").trim();

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
      client = createClient(url, anonKey, { auth: authOptions });
    } catch (e) {
      console.warn("Failed to initialize Supabase client:", e);
      client = null;
    }
  }
  return { configured: !!client, client };
}

// Single unified client instance
const unifiedClient = buildClient(
  UNIFIED_SUPABASE_URL,
  UNIFIED_SUPABASE_ANON_KEY,
  { detectSessionInUrl: false }
);

const CLIENTS_BY_PROJECT = {
  [SUPABASE_PROJECTS.SARA_FOUNDATION]: unifiedClient.client,
  [SUPABASE_PROJECTS.ORGANIZATION_DB]: unifiedClient.client,
};

export const PROJECT_CONFIGURED = {
  [SUPABASE_PROJECTS.SARA_FOUNDATION]: unifiedClient.configured,
  [SUPABASE_PROJECTS.ORGANIZATION_DB]: unifiedClient.configured,
};

/** Returns the client for a specific project - all point to the unified database */
export function getSupabaseClientForProject(projectKey) {
  return unifiedClient.client;
}

const ACTIVE_PROJECT_STORAGE_KEY = "trainai_active_project_v1";

function readStoredActiveProject() {
  return SUPABASE_PROJECTS.ORGANIZATION_DB;
}

function getInitialActiveProject() {
  return SUPABASE_PROJECTS.ORGANIZATION_DB;
}

export let activeProject = SUPABASE_PROJECTS.ORGANIZATION_DB;
export let supabase = unifiedClient.client;
export let isSupabaseConfigured = unifiedClient.configured;

export function setActiveSupabaseProject(projectKey) {
  activeProject = SUPABASE_PROJECTS.ORGANIZATION_DB;
  supabase = unifiedClient.client;
  isSupabaseConfigured = unifiedClient.configured;
  try {
    localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, SUPABASE_PROJECTS.ORGANIZATION_DB);
    window.dispatchEvent(new CustomEvent("trainai-project-change", { detail: { project: SUPABASE_PROJECTS.ORGANIZATION_DB } }));
  } catch {
    // best-effort
  }
}

/**
 * Sign-up routing:
 * All signups (Sara Foundation, individual learners, organization self-serve, Train AI staff)
 * route cleanly into the single unified database (jeobggrtxeybxvlwpxvn).
 */
export function resolveProjectForSignUp(email = "", accountType = "learner", preferredProject = "") {
  return SUPABASE_PROJECTS.ORGANIZATION_DB;
}

/**
 * Sign-in routing:
 * All accounts authenticate against the single unified database (jeobggrtxeybxvlwpxvn).
 */
export function resolveProjectForSignIn(email = "") {
  return SUPABASE_PROJECTS.ORGANIZATION_DB;
}

export function fallbackProjectForSignIn(triedProjectKey) {
  return null;
}
