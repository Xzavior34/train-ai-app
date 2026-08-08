// This file used to duplicate services/supabaseClient.js verbatim. Kept as a
// re-export (instead of deleted) because src/learner and src/platform import
// from here - but there is now exactly one real implementation, so the two
// copies can no longer drift out of sync with each other.
export {
  supabase, isSupabaseConfigured,
  SUPABASE_PROJECTS, PROJECT_CONFIGURED, activeProject,
  getSupabaseClientForProject, setActiveSupabaseProject,
  resolveProjectForSignUp, resolveProjectForSignIn, fallbackProjectForSignIn,
} from "../services/supabaseClient.js";
