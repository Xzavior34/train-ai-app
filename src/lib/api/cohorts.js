import { supabase } from "../supabaseClient.js";
import { COHORT_STATUSES } from "../constants/terminology.js";

/**
 * Robust Cohort Duration & Elapsed Time Progress Calculator
 * Handles invalid, missing, or future dates without crashing.
 * If either date is not explicitly set, calculates based on a standard 6-week (42 days) cohort track.
 */
export function calculateCohortProgress(startDate, endDate) {
  const effectiveStart = startDate || new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const effectiveEnd = endDate || new Date(new Date(effectiveStart).getTime() + 42 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const start = new Date(effectiveStart).getTime();
    const end = new Date(effectiveEnd).getTime();
    const now = Date.now();

    if (isNaN(start) || isNaN(end) || end <= start) {
      return {
        percent: 0,
        daysRemaining: 42,
        totalDays: 42,
        totalWeeks: 6,
        currentWeek: 1,
        isUpcoming: false,
        isCompleted: false,
        statusLabel: "6-Week Intensive Track",
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
      percent: 33,
      daysRemaining: 28,
      totalDays: 42,
      totalWeeks: 6,
      currentWeek: 3,
      isUpcoming: false,
      isCompleted: false,
      statusLabel: "Week 3 of 6 (28 days left)",
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
        starts_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        ends_at: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
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
        starts_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        ends_at: new Date(Date.now() + 49 * 24 * 60 * 60 * 1000).toISOString(),
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
        starts_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        ends_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
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
      progress: calculateCohortProgress(c.starts_at, c.ends_at),
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
        program_name: programName,
        starts_at: startDate,
        ends_at: endDate,
        status,
        trial_status: trialStatus,
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
      starts_at: startDate,
      ends_at: endDate,
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
  if (!supabase) return { success: true, data: updates };

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
 * Allows Admins and Mentors to extend or customize a cohort's time period
 */
export async function extendCohortTimeline({
  cohortId,
  extensionDays = 7,
  newEndDate = null,
  newStartDate = null,
}) {
  if (!cohortId) throw new Error("Cohort ID is required.");

  if (!supabase) {
    const days = Number(extensionDays || 7);
    return {
      success: true,
      cohort_id: cohortId,
      days_remaining: 28 + days,
      message: `Cohort extended by ${days} days.`,
    };
  }

  // 1. Try server RPC
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("extend_cohort_timeline", {
      p_cohort_id: String(cohortId),
      p_extension_days: Number(extensionDays || 7),
      p_new_end_date: newEndDate ? new Date(newEndDate).toISOString() : null,
      p_new_start_date: newStartDate ? new Date(newStartDate).toISOString() : null,
    });
    if (!rpcErr && rpcData?.success) {
      return rpcData;
    }
  } catch (rpcErr) {
    console.warn("extend_cohort_timeline RPC fallback:", rpcErr?.message || rpcErr);
  }

  // 2. Direct table update fallback
  try {
    const { data: cohortRow, error: fetchErr } = await supabase
      .from("cohorts")
      .select("*")
      .eq("id", cohortId)
      .maybeSingle();

    if (fetchErr || !cohortRow) throw fetchErr || new Error("Cohort not found.");

    const currentEnd = cohortRow.ends_at ? new Date(cohortRow.ends_at) : new Date(Date.now() + 42 * 86400000);
    const updatedEnd = newEndDate
      ? new Date(newEndDate)
      : new Date(currentEnd.getTime() + Number(extensionDays || 7) * 86400000);
    const updatedStart = newStartDate
      ? new Date(newStartDate)
      : cohortRow.starts_at
      ? new Date(cohortRow.starts_at)
      : new Date(Date.now() - 14 * 86400000);

    const totalDays = Math.max(1, Math.round((updatedEnd.getTime() - updatedStart.getTime()) / 86400000));
    const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));

    const { error: updateErr } = await supabase
      .from("cohorts")
      .update({
        starts_at: updatedStart.toISOString(),
        ends_at: updatedEnd.toISOString(),
        duration_weeks: totalWeeks,
        status: "Active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", cohortId);

    if (updateErr) throw updateErr;

    const daysRemaining = Math.max(0, Math.ceil((updatedEnd.getTime() - Date.now()) / 86400000));

    // Automated announcement post
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (authUser?.user?.id) {
        await supabase.from("cohort_posts").insert({
          cohort_id: cohortId,
          author_id: authUser.user.id,
          content: `📢 Cohort Timeline Extended! The administration has extended this cohort by ${extensionDays} days. New completion date: ${updatedEnd.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} (${daysRemaining} days remaining).`,
          is_announcement: true,
        });
      }
    } catch {}

    return {
      success: true,
      cohort_id: cohortId,
      starts_at: updatedStart.toISOString(),
      ends_at: updatedEnd.toISOString(),
      duration_weeks: totalWeeks,
      total_days: totalDays,
      days_remaining: daysRemaining,
      message: `Cohort extended successfully. ${daysRemaining} days remaining.`,
    };
  } catch (err) {
    console.error("extendCohortTimeline error:", err);
    throw err;
  }
}

/**
 * Safe Delete or Archive of a Cohort.
 * Protects learner history by soft-archiving if members exist.
 */
export async function deleteOrArchiveCohort(cohortId) {
  if (!supabase) return { success: true, action: "archived", message: "Cohort archived." };

  const { data, error } = await supabase.rpc("delete_or_archive_cohort", { p_cohort_id: cohortId });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "Could not delete or archive this cohort.");
  return data;
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

/**
 * Creates a new Cohort Live Studio Session.
 * Full backend control for Admins & Instructors.
 */
export async function createCohortSession({ cohortId, createdBy, title, description, startsAt, joinUrl, recordingUrl }) {
  if (!supabase) {
    return {
      id: `sess-${Date.now()}`,
      cohort_id: cohortId,
      title,
      description: description || "",
      starts_at: startsAt || new Date().toISOString(),
      join_url: joinUrl || null,
      recording_url: recordingUrl || null,
      status: "Scheduled"
    };
  }

  let authUserId = createdBy;
  if (!authUserId) {
    const { data: authData } = await supabase.auth.getUser();
    authUserId = authData?.user?.id;
  }

  const { data, error } = await supabase
    .from("cohort_sessions")
    .insert({
      cohort_id: cohortId,
      created_by: authUserId,
      title,
      description: description || null,
      starts_at: startsAt,
      join_url: joinUrl || null,
      recording_url: recordingUrl || null,
    })
    .select()
    .single();

  if (error) {
    console.error("createCohortSession error:", error);
    throw error;
  }
  return data;
}

/**
 * Assigns a course to either the entire cohort OR specific individual members.
 * Keeps `cohort_courses`, `cohort_learner_courses`, and `course_enrollments` synchronized.
 */
export async function assignCourseToCohortOrLearners({
  cohortId,
  courseId,
  scope = "cohort",
  memberUserIds = [],
  dueAt = null,
  assignedBy = null,
}) {
  if (!cohortId || !courseId) {
    throw new Error("Cohort ID and Course ID are required to assign a course.");
  }

  if (!supabase) {
    const count = scope === "cohort" ? 5 : (memberUserIds?.length || 1);
    return {
      success: true,
      count,
      scope,
      message: scope === "cohort"
        ? `Assigned course to entire cohort (${count} members).`
        : `Assigned course to ${count} individual member(s).`,
    };
  }

  let authUserId = assignedBy;
  if (!authUserId) {
    const { data: authData } = await supabase.auth.getUser();
    authUserId = authData?.user?.id || null;
  }

  // Prefer the transactional server-side path. It validates that every
  // selected learner belongs to this cohort, writes the cohort curriculum,
  // individual assignments, and learner enrollments as one operation. The
  // previous client-only path could partially succeed and also sent a
  // non-existent `status` column to course_enrollments on the live schema.
  const rpcArgs = {
    p_cohort_id: cohortId,
    p_course_id: courseId,
    p_user_ids: scope === "cohort" ? null : memberUserIds,
    p_assign_all: scope === "cohort",
    p_due_at: dueAt || null,
  };
  const { data: rpcResult, error: rpcError } = await supabase.rpc("assign_course_to_cohort_members", rpcArgs);
  if (!rpcError) {
    const assignedCount = Number(rpcResult?.assigned_count || 0);
    return {
      success: true,
      count: assignedCount,
      scope,
      newlyAssigned: Number(rpcResult?.new_assignment_count || 0),
      message: scope === "cohort"
        ? `Successfully assigned to entire cohort (${assignedCount} member${assignedCount === 1 ? "" : "s"}).`
        : `Successfully assigned to ${assignedCount} selected member${assignedCount === 1 ? "" : "s"}.`,
    };
  }
  // Keep compatibility during a rolling deployment, but never hide a real
  // RPC failure once the function exists.
  if (rpcError.code !== "PGRST202" && !String(rpcError.message || "").includes("assign_course_to_cohort_members")) {
    throw rpcError;
  }

  // 1. Determine target user IDs
  let targetUserIds = [];
  if (scope === "cohort") {
    const { data: memberRows, error: memberErr } = await supabase
      .from("cohort_members")
      .select("user_id")
      .eq("cohort_id", cohortId);
    if (memberErr) console.warn("Could not fetch cohort members:", memberErr);
    targetUserIds = (memberRows || []).map((m) => m.user_id).filter(Boolean);

    // Upsert into cohort_courses (cohort-level track syllabus)
    const { error: cohortCourseError } = await supabase
      .from("cohort_courses")
      .upsert(
        { cohort_id: cohortId, course_id: courseId, due_at: dueAt || null },
        { onConflict: "cohort_id,course_id", ignoreDuplicates: false }
      );
    if (cohortCourseError) throw cohortCourseError;
  } else {
    targetUserIds = Array.isArray(memberUserIds) ? memberUserIds.filter(Boolean) : [];
    if (!targetUserIds.length) {
      throw new Error("Please select at least one individual member to assign this course.");
    }

    // Also record in cohort_courses so the cohort curriculum acknowledges this course
    const { error: cohortCourseError } = await supabase
      .from("cohort_courses")
      .upsert(
        { cohort_id: cohortId, course_id: courseId, due_at: dueAt || null },
        { onConflict: "cohort_id,course_id", ignoreDuplicates: true }
      );
    if (cohortCourseError) throw cohortCourseError;
  }

  // 2. Fetch existing cohort_learner_courses to prevent duplicates
  const { data: existingAssignments, error: existingAssignmentsError } = await supabase
    .from("cohort_learner_courses")
    .select("user_id")
    .eq("cohort_id", cohortId)
    .eq("course_id", courseId);
  if (existingAssignmentsError) throw existingAssignmentsError;

  const alreadyAssignedUserIds = new Set((existingAssignments || []).map((r) => r.user_id));
  const newAssigneeIds = targetUserIds.filter((uid) => !alreadyAssignedUserIds.has(uid));

  // 3. Insert into cohort_learner_courses
  if (newAssigneeIds.length > 0) {
    const learnerCourseRows = newAssigneeIds.map((uid) => ({
      cohort_id: cohortId,
      user_id: uid,
      course_id: courseId,
      assigned_by: authUserId,
    }));
    const { error: insertErr } = await supabase
      .from("cohort_learner_courses")
      .insert(learnerCourseRows);
    if (insertErr) throw insertErr;
  }

  // 4. Upsert into course_enrollments so each learner has it in their active dashboard
  if (targetUserIds.length > 0) {
    const enrollments = targetUserIds.map((uid) => ({
      user_id: uid,
      course_id: courseId,
      progress_percentage: 0,
    }));
    const { error: enrollmentError } = await supabase
      .from("course_enrollments")
      .upsert(enrollments, { onConflict: "user_id,course_id", ignoreDuplicates: true });
    if (enrollmentError) throw enrollmentError;
  }

  // 5. Post an activity announcement to cohort feed
  try {
    const { data: courseRow } = await supabase
      .from("courses")
      .select("title")
      .eq("id", courseId)
      .maybeSingle();
    const courseTitle = courseRow?.title || "Course Curriculum";
    const scopeMsg = scope === "cohort" ? "the entire cohort" : `${targetUserIds.length} member(s)`;
    const dueMsg = dueAt ? ` • Due: ${new Date(dueAt).toLocaleDateString()}` : "";
    if (authUserId) {
      await supabase.from("cohort_posts").insert({
        cohort_id: cohortId,
        author_id: authUserId,
        content: `📚 Course Assigned: "${courseTitle}" has been assigned to ${scopeMsg}!${dueMsg}`,
        is_announcement: true,
      });
    }
  } catch {}

  const finalCount = targetUserIds.length;
  return {
    success: true,
    count: finalCount,
    scope,
    newlyAssigned: newAssigneeIds.length,
    message: scope === "cohort"
      ? `Successfully assigned to entire cohort (${finalCount} member${finalCount === 1 ? "" : "s"}).`
      : `Successfully assigned to ${finalCount} selected member${finalCount === 1 ? "" : "s"}.`,
  };
}

/**
 * Unassigns a course from a specific learner or from the entire cohort
 */
export async function unassignCohortCourse({ cohortId, courseId, userId = null }) {
  if (!cohortId || !courseId) return { success: false, error: "Missing cohort or course ID" };
  if (!supabase) return { success: true, message: "Course unassigned." };

  try {
    if (userId) {
      await supabase
        .from("cohort_learner_courses")
        .delete()
        .eq("cohort_id", cohortId)
        .eq("course_id", courseId)
        .eq("user_id", userId);
    } else {
      // Unassign from entire cohort
      await supabase
        .from("cohort_learner_courses")
        .delete()
        .eq("cohort_id", cohortId)
        .eq("course_id", courseId);

      await supabase
        .from("cohort_courses")
        .delete()
        .eq("cohort_id", cohortId)
        .eq("course_id", courseId);
    }
    return { success: true, message: "Course unassigned successfully." };
  } catch (err) {
    console.error("unassignCohortCourse error:", err);
    throw err;
  }
}


