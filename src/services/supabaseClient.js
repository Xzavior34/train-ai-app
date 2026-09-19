import { createClient } from "@supabase/supabase-js";

// ============================================================================
// Train AI 2.0 Unified Single Database Architecture:
// Authoritative Production Database: jeobggrtxeybxvlwpxvn
// All organizations, Sara Foundation learners, platform owner, and B2B tenants
// live within this single database with row-level security (RLS) isolation.
// ============================================================================

export const SUPABASE_PROJECTS = {
  SARA_FOUNDATION: "sara_foundation",
  ORGANIZATION_DB: "organization_db",
  TRAIN_AI_SHARED: "organization_db",
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

// Single Authoritative Database Configuration (jeobggrtxeybxvlwpxvn)
const DEFAULT_PRODUCTION_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const DEFAULT_PRODUCTION_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implb2JnZ3J0eGV5Ynh2bHdweHZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMyNjM1NywiZXhwIjoyMTAyOTAyMzU3fQ.uDCs11c1ti9xGopgIcrVAGALgvjrhYSLMZyu5A_F-_Y";

function buildSingleClient() {
  const env = (typeof import.meta !== "undefined" && import.meta.env) || (typeof process !== "undefined" && process.env) || {};
  let url = (env.VITE_SUPABASE_SARA_URL || env.VITE_SUPABASE_ORGANIZATION_URL || env.VITE_SUPABASE_URL || "").trim();
  let anonKey = (env.VITE_SUPABASE_SARA_ANON_KEY || env.VITE_SUPABASE_ORGANIZATION_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || "").trim();

  url = normalizeSupabaseUrl(url);
  if (!url) url = normalizeSupabaseUrl(DEFAULT_PRODUCTION_URL);
  if (!anonKey) anonKey = DEFAULT_PRODUCTION_ANON_KEY;

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
      console.warn("Failed to initialize Supabase production client:", e);
      client = null;
    }
  }
  return { configured: !!client, client };
}

const mainClient = buildSingleClient();

export const supabase = mainClient.client;
export const isSupabaseConfigured = mainClient.configured;
export let activeProject = SUPABASE_PROJECTS.ORGANIZATION_DB;

export const PROJECT_CONFIGURED = {
  [SUPABASE_PROJECTS.SARA_FOUNDATION]: mainClient.configured,
  [SUPABASE_PROJECTS.ORGANIZATION_DB]: mainClient.configured,
};

export function getSupabaseClientForProject(_projectKey) {
  return mainClient.client;
}

export function setActiveSupabaseProject(_projectKey) {
  activeProject = SUPABASE_PROJECTS.ORGANIZATION_DB;
}

export function resolveProjectForSignUp(_email = "", _accountType = "learner") {
  return SUPABASE_PROJECTS.ORGANIZATION_DB;
}

export function resolveProjectForSignIn(_email = "") {
  return SUPABASE_PROJECTS.ORGANIZATION_DB;
}

export function fallbackProjectForSignIn(_triedProjectKey) {
  return null;
}


