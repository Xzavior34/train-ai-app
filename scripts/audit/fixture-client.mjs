// Explicitly isolated browser/SSR test environment. No Supabase connections.
export const supabase = null;
export const isSupabaseConfigured = false;
export const SUPABASE_PROJECTS = { ORGANIZATION_DB:'organization_db', SARA_FOUNDATION:'sara_foundation', TRAIN_AI_SHARED:'organization_db', B2B:'organization_db', DIGITAL_TRAINING:'organization_db', SIERRA_FOUNDATION:'sara_foundation' };
export const PROJECT_CONFIGURED = {};
export let activeProject = 'organization_db';
export function getSupabaseClientForProject(){return null;}
export function setActiveSupabaseProject(key){activeProject=key;}
export function resolveProjectForSignIn(){return activeProject;}
export function resolveProjectForSignUp(){return activeProject;}
export function fallbackProjectForSignIn(){return null;}
