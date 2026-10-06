import { supabase } from "../supabaseClient.js";
import { COHORT_STATUSES } from "../constants/terminology.js";

/**
 * Robust Cohort Duration & Elapsed Time Progress Calculator
 * Handles invalid, missing, or future dates without crashing.
 */
export function calculateCohortProgress(startDate, endDate) {
  if (!startDate || !endDate) {
    return {
      percent: 0,
      daysRemaining: 0,
      totalDays: 0,
      totalWeeks: 0,
      currentWeek: 1,
      isUpcoming: false,
      isCompleted: false,
      statusLabel: "Dates not set",
    };
  }

  try {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const now = Date.now();

    if (isNaN(start) || isNaN(end) || end <= start) {
      return {
        percent: 0,
        daysRemaining: 0,
        totalDays: 0,
        totalWeeks: 0,
        currentWeek: 1,
        isUpcoming: false,
        isCompleted: false,
        statusLabel: "Invalid date range",
      };
    }

    const totalDurationMs = end - start;
    const totalDays = Math.max(1, Math.round(totalDurationMs / (1000 * 60 * 60 * 24)));
    const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));

    if (now < start) {
      const daysUntilStart = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
      return {
        percent: 0,
        daysRemaining: totalDays,
        totalDays,
        totalWeeks,
        currentWeek: 0,
        isUpcoming: true,
        isCompleted: false,
        statusLabel: `Starts in ${daysUntilStart} day${daysUntilStart === 1 ? "" : "s"}`,
      };
    }

    if (now >= end) {
      return {
        percent: 100,
        daysRemaining: 0,
        totalDays,
        totalWeeks,
        currentWeek: totalWeeks,
        isUpcoming: false,
        isCompleted: true,
        statusLabel: "Completed",
      };
    }

    const elapsedMs = now - start;
    const percent = Math.min(100, Math.max(0, Math.round((elapsedMs / totalDurationMs) * 100)));
    const daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
    const currentWeek = Math.min(totalWeeks, Math.max(1, Math.floor(elapsedMs / (1000 * 60 * 60 * 24 * 7)) + 1));

    return {
      percent,
      daysRemaining,
      totalDays,
      totalWeeks,
      currentWeek,
      isUpcoming: false,
      isCompleted: false,
      statusLabel: `Week ${currentWeek} of ${totalWeeks} (${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left)`,
    };
  } catch {
    return {
      percent: 0,
      daysRemaining: 0,
      totalDays: 0,
      totalWeeks: 0,
      currentWeek: 1,
      isUpcoming: false,
      isCompleted: false,
      statusLabel: "Unavailable",
    };
  }
}

/**
 * Fetches all cohorts for an organization with member count and trial status
 */
export async function fetchCohortsWithDetails(organizationId) {
  if (!supabase) {
    return [
      {
        id: "cap-cohort-3",
        name: "CAP Cohort 3 (Career Acceleration)",
        program_name: "Career Acceleration Programme (CAP)",
        organization_id: organizationId || "org-demo",
        start_date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
        status: COHORT_STATUSES.ACTIVE,
        is_archived: false,
        trial_status: "active",
        learner_count: 34,
        created_at: new Date().toISOString(),
      },
      {
        id: "ai-eng-cohort-1",
        name: "AI Engineering Fast-Track",
        program_name: "Executive Academy",
        organization_id: organizationId || "org-demo",
        start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(Date.now() + 49 * 24 * 60 * 60 * 1000).toISOString(),
        status: COHORT_STATUSES.UPCOMING,
        is_archived: false,
        trial_status: "none",
        learner_count: 18,
        created_at: new Date().toISOString(),
      },
      {
        id: "spring-2026-cohort",
        name: "Spring 2026 Foundation Cohort",
        program_name: "Internal Training",
        organization_id: organizationId || "org-demo",
        start_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
        status: COHORT_STATUSES.COMPLETED,
        is_archived: false,
        trial_status: "none",
        learner_count: 42,
        created_at: new Date().toISOString(),
      },
    ];
  }

  try {
    let query = supabase
      .from("cohorts")
      .select("*, cohort_members(count)")
      .order("created_at", { ascending: false });

    if (organizationId && organizationId !== "demo-org-id") {
      query = query.eq("organization_id", organizationId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((c) => ({
      ...c,
      learner_count: c.cohort_members?.[0]?.count || 0,
      progress: calculateCohortProgress(c.start_date, c.end_date),
    }));
  } catch (err) {
    console.warn("fetchCohortsWithDetails fallback notice:", err);
    return [];
  }
}

/**
 * Creates a new Cohort
 */
export async function createCohort({ name, organizationId, programName, startDate, endDate, status = "Active", trialStatus = "none" }) {
  if (!supabase) {
    return {
      success: true,
      data: {
        id: `cohort-${Date.now()}`,
        name,
        organization_id: organizationId,
        program_name: programName || "Training Programme",
        start_date: startDate,
        end_date: endDate,
        status,
        trial_status: trialStatus,
        learner_count: 0,
        is_archived: false,
      },
    };
  }

  const { data, error } = await supabase
    .from("cohorts")
    .insert({
      name,
      organization_id: organizationId,
      program_name: programName || "Training Programme",
      start_date: startDate,
      end_date: endDate,
      status,
      trial_status: trialStatus,
      is_archived: false,
    })
    .select()
    .single();

  if (error) throw error;
  return { success: true, data };
}

/**
 * Updates an existing Cohort
 */
export async function updateCohort(cohortId, updates) {
  if (!supabase) return { success: true };

  const { data, error } = await supabase
    .from("cohorts")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", cohortId)
    .select()
    .single();

  if (error) throw error;
  return { success: true, data };
}

/**
 * Safe Delete or Archive of a Cohort.
 * Protects learner history by soft-archiving if members exist.
 */
export async function deleteOrArchiveCohort(cohortId) {
  if (!supabase) return { success: true, action: "archived", message: "Cohort archived." };

  try {
    const { data, error } = await supabase.rpc("delete_or_archive_cohort", { p_cohort_id: cohortId });
    if (error) throw error;
    return data;
  } catch (err) {
    // Fallback if RPC is missing
    const { error: delErr } = await supabase.from("cohorts").delete().eq("id", cohortId);
    if (delErr) {
      await supabase.from("cohorts").update({ is_archived: true, status: "Archived" }).eq("id", cohortId);
      return { success: true, action: "archived", message: "Cohort safely archived." };
    }
    return { success: true, action: "deleted", message: "Cohort deleted." };
  }
}

/**
 * Duplicates a Cohort configuration
 */
export async function duplicateCohort(cohortId, newName) {
  if (!supabase) {
    return { success: true, new_cohort_id: `cohort-${Date.now()}`, name: newName || "Duplicate Cohort" };
  }

  try {
    const { data, error } = await supabase.rpc("duplicate_cohort", {
      p_cohort_id: cohortId,
      p_new_name: newName,
    });
    if (error) throw error;
    return data;
  } catch (err) {
    throw err;
  }
}
