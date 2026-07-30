import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured =
  !!url && !!anonKey &&
  !url.includes("your-project-ref") &&
  !anonKey.includes("your-anon-public-key");

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey)
  : null;
