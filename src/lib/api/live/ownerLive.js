import { supabase } from "../../supabaseClient.js";

/**
 * Platform-wide (cross-tenant) live queries for the Platform Owner's
 * Overview screen.
 *
 * These exist because the equivalents already in lib/api/platform.js are all
 * organization-scoped - fetchEnrollmentTrend(organizationId) and
 * fetchOrgAIUsageByFeature(organizationId) both require a tenant id, and the
 * Platform Owner's executive dashboard is explicitly cross-tenant. Rather
 * than change those signatures (they are called from admin/manager screens),
 * the platform-wide variants live here.
 *
 * Everything below reads real tables only. Nothing here has a literal
 * fallback: an empty platform is reported as empty/zero, which is the truth.
 */

/**
 * Monthly course enrollments across every tenant, for the last `monthsBack`
 * months including the current one.
 *
 * Replaces MONTHLY_GROWTH_DATA in OverviewScreen.jsx, which was a literal
 * six-month array (1240 -> 4620 enrollments) with a hardcoded per-bar
 * `heightPct` that was not even derived from its own numbers. Bar heights are
 * now computed from the real max in the returned series by the caller.
 *
 * Mirrors fetchEnrollmentTrend's bucketing (platform.js) minus the org
 * filter, so the two charts agree on what "a month" means.
 */
// course_enrollments has no created_at column - the real timestamp is
// enrolled_at. Selecting/filtering on created_at made PostgREST reject the
// whole query, so the growth chart came back empty every time.
export async function fetchPlatformEnrollmentTrend(monthsBack = 6) {
  if (!supabase) return [];
  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);
  const { data, error } = await supabase
    .from("course_enrollments")
    .select("enrolled_at, completed_at")
    .gte("enrolled_at", windowStart.toISOString());
  if (error) { console.warn("Platform enrollment trend fetch warning:", error); return []; }

  const buckets = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      month: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
      enrollments: 0,
      completions: 0,
    });
  }
  const bucketByKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
  for (const r of data || []) {
    if (!r.enrolled_at) continue;
    const d = new Date(r.enrolled_at);
    const bucket = bucketByKey[`${d.getFullYear()}-${d.getMonth()}`];
    if (!bucket) continue;
    bucket.enrollments += 1;
    if (r.completed_at) bucket.completions += 1;
  }
  return buckets.map(({ key, ...rest }) => rest);
}

/**
 * Platform-wide AI call split by the real `feature` column on
 * ai_usage_events, which the ai-chat edge function writes on every actual
 * provider call.
 *
 * Replaces AI_MODEL_BREAKDOWN in OverviewScreen.jsx - three invented rows
 * ("10,240 calls", 55%). The feature keys are whatever the table actually
 * contains rather than a fixed list, so a feature nobody has used simply
 * does not appear instead of showing a fabricated share.
 */
export async function fetchPlatformAIUsageByFeature() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("ai_usage_events").select("feature");
  if (error) { console.warn("Platform AI usage by feature fetch warning:", error); return []; }
  const rows = data || [];
  if (!rows.length) return [];
  const counts = new Map();
  for (const r of rows) {
    const key = (r.feature || "unattributed").trim() || "unattributed";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([feature, count]) => ({ feature, count, pct: Math.round((count / rows.length) * 100) }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Number of published lessons across every published, non-archived course.
 *
 * Backs the "Total Modules" footer on the Published Courses KPI card, which
 * was the literal "140 Total Modules". Two queries rather than a join
 * because lessons carries no is_published-on-course view; the course id list
 * is small enough at platform scale to filter client-side, and is chunked
 * the same way safeInQuery does to stay inside PostgREST's URL limits.
 */
export async function fetchPlatformLessonCount() {
  if (!supabase) return 0;
  const { data: courses, error: coursesError } = await supabase
    .from("courses")
    .select("id")
    .eq("is_published", true)
    .is("archived_at", null);
  if (coursesError) { console.warn("Platform lesson count (courses) fetch warning:", coursesError); return 0; }
  const ids = (courses || []).map((c) => c.id);
  if (!ids.length) return 0;
  let total = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const { count, error } = await supabase
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true)
      .in("course_id", ids.slice(i, i + 100));
    if (error) { console.warn("Platform lesson count fetch warning:", error); return total; }
    total += count || 0;
  }
  return total;
}
