import { supabase } from "./supabaseClient.js";

/**
 * One switch for "is there a real database behind this screen right now".
 *
 * The rule this enforces, decided explicitly for this codebase:
 *
 *   Illustrative content that no table can supply - a career-progression
 *   roadmap, per-day study hours, a lesson transcript, an instructor's task
 *   list, server latency, "+12% vs last month" deltas - may render ONLY when
 *   there is no database connected. The moment Supabase is configured, those
 *   sections disappear entirely rather than presenting invented figures next
 *   to real ones.
 *
 * Why a module-level constant rather than a hook: `supabase` is created once
 * at import time from the build's env vars (see lib/supabaseClient.js) and
 * cannot change during a session, so there is nothing to subscribe to. A
 * constant also means `{!HAS_DATABASE && (...)}` compiles away to plain dead
 * code in a real deployment.
 *
 * Note this is deliberately NOT the same thing as `isMockDataEnabled()` in
 * lib/mockDataManager.js. That is a user-facing toggle for seeding sample
 * content while a database IS connected; this is the hard "no database at
 * all" case. Anything gated on the mock toggle alone was still showing
 * fabricated data against a live database, which is exactly the bug this
 * constant exists to close.
 */
export const HAS_DATABASE = Boolean(supabase);

/** Inverse of HAS_DATABASE, for readability at call sites. */
export const DEMO_MODE = !HAS_DATABASE;

/**
 * Picks between a real value and illustrative sample content.
 *
 * Use for a value (not a whole section): returns `live` whenever a database is
 * connected - including when `live` is empty, zero, or null, because an empty
 * real result is the truth and must not be papered over with a sample figure.
 * Only with no database at all does `sample` come back.
 *
 *   const rows = liveOr(activityQuery.data, DEMO_ACTIVITY);
 */
export function liveOr(live, sample) {
  return HAS_DATABASE ? live : sample;
}
