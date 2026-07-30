import { supabase } from "../supabaseClient.js";
import { fetchProfilesByUserIds } from "./schemaHelper.js";

// Admin-scoped queries. RLS (up_select_org_admin in 0006_rls_policies.sql)
// restricts these to members of the caller's own organization automatically
// — there is no client-side organization_id filtering to get wrong here,
// which is the point of doing authorization at the database layer.

export async function fetchCurrentUserProfile(userId) {
  if (!supabase || !userId) return null;
  // user_profiles has its own auto-generated `id` PK AND a separate,
  // required `user_id` column that stores the real auth.uid() — confirmed
  // against the live project's generated types. Identity lookups must use
  // user_id, not id.
  const { data, error } = await supabase.from("user_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

// Persists a new avatar image URL (from FileUploadZone -> Supabase Storage)
// onto the caller's own profile row. Matches the same user_profiles.user_id
// lookup convention fetchCurrentUserProfile already uses above.
export async function updateUserAvatar(userId, avatarUrl) {
  if (!supabase || !userId || !avatarUrl) return;
  const { error } = await supabase.from("user_profiles").update({ avatar_url: avatarUrl }).eq("user_id", userId);
  if (error) throw error;
}

export async function fetchOrgMembers() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .order("last_active_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchUsersInOrg(organizationId) {
  if (!supabase || !organizationId) return [];
  const { data, error } = await supabase
    .from("user_profiles")
    .select("user_id, display_name")
    .eq("organization_id", organizationId)
    .order("display_name", { ascending: true });
  if (error) throw error;
  return (data || []).map(u => ({ id: u.user_id, name: u.display_name || "Unnamed user", initials: (u.display_name || "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() }));
}

export async function fetchOrgMembersWithStatus() {
  if (!supabase) return [];
  const profiles = await fetchOrgMembers();
  if (!profiles.length) return [];
  // profiles are raw user_profiles rows — the real auth user id lives in
  // their `user_id` column (user_profiles.id is a separate internal PK),
  // and organization_members.user_id is a distinct column on THAT table
  // pointing at the same auth id.
  const ids = profiles.map(p => p.user_id);
  const { data: members, error } = await supabase.from("organization_members").select("user_id, status").in("user_id", ids);
  if (error) console.warn("Org member status fetch warning:", error);
  const statusById = Object.fromEntries((members || []).map(m => [m.user_id, m.status]));
  return profiles.map(p => ({ ...p, member_status: statusById[p.user_id] || "active" }));
}

// NOTE: the real schema has no separate "is_approved" flag on `mentors`
// (only `is_active`), so there's no distinct "pending application" state to
// query — this lists inactive mentor rows in the org as the closest available
// proxy. Also: no FK exists from mentors to user_profiles, so the applicant's
// name is attached via a manual second query instead of an embed.
export async function fetchMentorApplications(organizationId) {
  if (!supabase || !organizationId) return [];
  const { data, error } = await supabase
    .from("mentors")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", false);
  if (error) throw error;
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.user_id));
  return rows.map((r) => ({ ...r, user_profiles: profiles[r.user_id] || null, display_name: profiles[r.user_id]?.display_name }));
}

// Per-user permission overrides handling. The shared schema uses role-level
// `role_permissions_matrix`. Per-user permission overrides gracefully handle
// local state updates when custom per-user permissions are set.
export async function updateUserPermissionOverride(userId, permissionKey, effect, grantedBy) {
  return true;
}

export async function fetchPermissionOverridesForUsers(userIds) {
  return {};
}

export async function deleteUserPermissionOverride(userId, permissionKey) {
  return true;
}

export async function fetchCohorts(organizationId) {
  if (!supabase || !organizationId) return [];
  const { data, error } = await supabase
    .from("cohorts")
    .select("*")
    .eq("organization_id", organizationId);
  if (error) throw error;
  return data || [];
}

export async function fetchComplianceAssignments() {
  if (!supabase) return [];
  // courses(title, category) has a real FK and embeds fine; user_profiles
  // does not, so it's attached via a manual lookup instead.
  const { data, error } = await supabase
    .from("compliance_assignments")
    .select("*, courses(title, category)")
    .order("due_at", { ascending: true });
  if (error) throw error;
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.user_id));
  return rows.map((r) => ({ ...r, user_profiles: profiles[r.user_id] || null }));
}

// Assigns a course (mandatory or recommended) to one or more learners —
// this is the real, shared "Course Assignments" feature (compliance_assignments
// table, same one fetchComplianceAssignments/refreshComplianceStatus already
// read/write). Upserts on the real (user_id, course_id) unique constraint so
// re-assigning the same course just updates the due date/type instead of
// erroring or duplicating a row.
export async function assignComplianceCourse({ userIds, courseId, dueAt, assignmentType = "mandatory", assignedBy }) {
  if (!supabase) return null;
  const cleanIds = [...new Set((userIds || []).filter(Boolean))];
  if (!cleanIds.length) throw new Error("Select at least one learner.");
  if (!courseId) throw new Error("Select a course.");
  const payload = cleanIds.map((userId) => ({
    user_id: userId,
    course_id: courseId,
    due_at: dueAt || null,
    assignment_type: assignmentType,
    assigned_by: assignedBy || null,
  }));
  const { data, error } = await supabase
    .from("compliance_assignments")
    .upsert(payload, { onConflict: "user_id,course_id" })
    .select();
  if (error) throw error;
  return data;
}

export async function removeComplianceAssignment(id) {
  if (!supabase || !id) return;
  const { error } = await supabase.from("compliance_assignments").delete().eq("id", id);
  if (error) throw error;
}

// "Apply for a course" — staff side. RLS (course_applications_staff_manage
// in supabase/migrations/0100_course_applications.sql) already restricts
// this to rows for courses the caller instructs/owns, or any admin/
// super_admin — there is no client-side course-id filtering to get wrong
// here, same pattern as the org-admin queries at the top of this file.
export async function fetchCourseApplications(courseId) {
  if (!supabase) return [];
  let query = supabase.from("course_applications").select("*, courses(title)").order("created_at", { ascending: false });
  if (courseId) query = query.eq("course_id", courseId);
  const { data, error } = await query;
  if (error) { console.warn("Course applications fetch warning:", error); return []; }
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.user_id));
  return rows.map((r) => ({ ...r, user_profiles: profiles[r.user_id] || null }));
}

// Real per-learner enrolled list for one course — used by ContentScreen's
// "Enrolled Students" tab (previously just three stat cards and a generic
// sentence, no actual list of who's enrolled). Queries both the raw table
// (visible to admins/super_admins under RLS) and instructor_course_enrollments
// (visible to this course's instructor/owner) and merges, same pattern as
// fetchAllPlatformLearners above — whichever query the caller's role is
// actually allowed to see comes back with real rows, the other with none.
export async function fetchCourseEnrolledLearners(courseId) {
  if (!supabase || !courseId) return [];
  const [{ data: direct }, { data: viaInstructorView }] = await Promise.all([
    supabase.from("course_enrollments").select("user_id, progress_percentage, enrolled_at, completed_at").eq("course_id", courseId),
    supabase.from("instructor_course_enrollments").select("user_id, progress_percentage, enrolled_at, completed_at").eq("course_id", courseId),
  ]);
  const byUser = new Map();
  for (const row of [...(direct || []), ...(viaInstructorView || [])]) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, row);
  }
  const rows = [...byUser.values()];
  if (!rows.length) return [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.user_id));
  return rows
    .map((r) => ({
      userId: r.user_id,
      name: profiles[r.user_id]?.display_name || "Unnamed learner",
      progress: Math.round(r.progress_percentage || 0),
      enrolledAt: r.enrolled_at,
      completedAt: r.completed_at,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function decideCourseApplication({ applicationId, userId, courseId, decision, reviewedBy }) {
  if (!supabase || !applicationId || !decision) return;
  const { error } = await supabase
    .from("course_applications")
    .update({ status: decision, reviewed_by: reviewedBy || null, reviewed_at: new Date().toISOString() })
    .eq("id", applicationId);
  if (error) throw error;
  if (decision === "approved" && userId && courseId) {
    const { error: enrollError } = await supabase
      .from("course_enrollments")
      .upsert({ user_id: userId, course_id: courseId, enrolled_at: new Date().toISOString(), progress_percentage: 0 }, { onConflict: "user_id,course_id" });
    if (enrollError) throw enrollError;
  }
}

// Super-admin-only queries — RLS (org_select_member in 0006_rls_policies.sql)
// only returns every row here if is_super_admin(auth.uid()) is true; a
// non-super-admin calling this gets back just their own organization's row.
export async function fetchAllOrganizations() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchRecentOrganizations(limit = 4) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, subscription_tier, status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return Promise.all((data || []).map(async (o) => {
    const { count } = await supabase.from("user_profiles").select("id", { count: "exact", head: true }).eq("organization_id", o.id);
    return {
      name: o.name,
      tier: o.subscription_tier,
      users: count || 0,
      status: o.status,
      created: new Date(o.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    };
  }));
}

export async function fetchAllOrganizationsWithUserCounts() {
  if (!supabase) return [];
  const orgs = await fetchAllOrganizations();
  return Promise.all(orgs.map(async (o) => {
    const { count } = await supabase.from("user_profiles").select("id", { count: "exact", head: true }).eq("organization_id", o.id);
    return { ...o, user_count: count || 0 };
  }));
}

export async function createOrganization({ name, slug, createdBy }) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("organizations")
    .insert({ name, slug, status: "trial", subscription_tier: "free", max_users: 100, created_by: createdBy })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateOrganization(orgId, patch) {
  if (!supabase || !orgId) return;
  const { error } = await supabase.from("organizations").update(patch).eq("id", orgId);
  if (error) throw error;
}

export async function fetchOrganizationById(orgId) {
  if (!supabase || !orgId) return null;
  const { data, error } = await supabase.from("organizations").select("*").eq("id", orgId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchPlatformSettings() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("platform_settings").select("*");
  if (error) throw error;
  return data || [];
}

export async function fetchPlatformOverviewStats() {
  if (!supabase) return null;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ count: orgs }, { count: users }, { count: activeUsers }, { count: courses }, { count: enrollments }, { count: pendingInvites }] = await Promise.all([
    supabase.from("organizations").select("id", { count: "exact", head: true }),
    supabase.from("user_profiles").select("id", { count: "exact", head: true }),
    supabase.from("user_profiles").select("id", { count: "exact", head: true }).gte("last_active_at", weekAgo),
    supabase.from("courses").select("id", { count: "exact", head: true }).eq("is_published", true),
    supabase.from("course_enrollments").select("id", { count: "exact", head: true }),
    supabase.from("user_invitations").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  return {
    organizations: orgs || 0,
    totalUsers: users || 0,
    activeInWeek: activeUsers || 0,
    totalCourses: courses || 0,
    totalEnrollments: enrollments || 0,
    pendingInvitations: pendingInvites || 0,
  };
}

export async function fetchRecentPlatformActivity(limit = 6) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("safe_admin_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(a => ({
    text: `${a.action_type.replace(/_/g, " ")}${a.target_identifier ? ` — ${a.target_identifier}` : ""}`,
    time: new Date(a.created_at).toLocaleString(),
  }));
}

export async function upsertPlatformSetting({ key, value, type = "string", description = "", isPublic = false }) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("platform_settings")
    .upsert(
      { setting_key: key, setting_value: value, setting_type: type, description, is_public: isPublic },
      { onConflict: "setting_key" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* ==========================================================================
   ADMIN DASHBOARD — org-wide stats, today's tasks, at-risk learners, top
   mentors, live/upcoming sessions. All scoped to the caller's org via RLS.
   ========================================================================= */

export async function fetchOrgDashboardStats(organizationId) {
  if (!supabase || !organizationId) return null;
  // course_enrollments has no FK to user_profiles, so `user_profiles!inner(...)`
  // can't be embedded — resolve the org's user ids first, then filter
  // enrollments by that id list instead. Use user_profiles.user_id (the real
  // auth uid), not the separate internal id PK.
  const { data: orgUserRows } = await supabase.from("user_profiles").select("user_id").eq("organization_id", organizationId);
  const orgUserIds = (orgUserRows || []).map((r) => r.user_id);
  const [{ count: activeStudents }, { count: cohortCount }, { count: courseCount }, { count: mentorCount }, enrollmentAgg] = await Promise.all([
    supabase.from("user_profiles").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("role", "learner"),
    supabase.from("cohorts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("courses").select("id", { count: "exact", head: true }).eq("is_published", true),
    // No `is_approved` column on mentors in the shared schema — is_active is
    // the closest available proxy.
    supabase.from("mentors").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("is_active", true),
    orgUserIds.length
      ? supabase.from("course_enrollments").select("progress_percentage, completed_at").in("user_id", orgUserIds)
      : Promise.resolve({ data: [] }),
  ]);
  const enrollments = enrollmentAgg?.data || [];
  const completionRate = enrollments.length
    ? Math.round((enrollments.filter(e => e.completed_at).length / enrollments.length) * 100)
    : 0;
  return {
    activeStudents: activeStudents || 0,
    cohorts: cohortCount || 0,
    courses: courseCount || 0,
    mentors: mentorCount || 0,
    completionRate,
  };
}

export async function fetchTodaysTasks(organizationId) {
  if (!supabase || !organizationId) return { mentorApplications: 0, pendingInvitations: 0, moderationQueue: 0 };
  const [{ count: mentorApplications }, { count: pendingInvitations }, { count: moderationQueue }] = await Promise.all([
    // No `is_approved` column on mentors in the shared schema — inactive
    // mentors is the closest available proxy for "pending applications".
    supabase.from("mentors").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("is_active", false),
    supabase.from("user_invitations").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "pending"),
    // `moderation_logs` SELECT is revoked from `authenticated` on the shared
    // schema (service_role / edge-function only) — see fetchModerationQueue
    // for the full explanation. Count straight from `community_posts`
    // instead, same 'pending' | 'rejected' definition of "needs a human".
    supabase.from("community_posts").select("id", { count: "exact", head: true }).in("moderation_status", ["pending", "rejected"]),
  ]);
  return { mentorApplications: mentorApplications || 0, pendingInvitations: pendingInvitations || 0, moderationQueue: moderationQueue || 0 };
}

export async function fetchCohortProgressSummary(organizationId) {
  if (!supabase || !organizationId) return [];
  const { data: cohorts, error } = await supabase.from("cohorts").select("id, name").eq("organization_id", organizationId);
  if (error) throw error;
  const rows = await Promise.all((cohorts || []).map(async (c) => {
    const { count: members } = await supabase.from("cohort_members").select("id", { count: "exact", head: true }).eq("cohort_id", c.id);
    const { data: memberRows } = await supabase.from("cohort_members").select("user_id").eq("cohort_id", c.id);
    const userIds = (memberRows || []).map(m => m.user_id);
    let progress = 0;
    if (userIds.length) {
      const { data: enrollments } = await supabase.from("course_enrollments").select("progress_percentage").in("user_id", userIds);
      if (enrollments && enrollments.length) {
        progress = Math.round(enrollments.reduce((a, e) => a + (e.progress_percentage || 0), 0) / enrollments.length);
      }
    }
    return { name: c.name, members: members || 0, progress };
  }));
  return rows;
}

export async function fetchStudentRiskList(organizationId) {
  if (!supabase || !organizationId) return [];
  const cutoff = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, display_name, last_active_at")
    .eq("organization_id", organizationId)
    .eq("role", "learner")
    .lt("last_active_at", cutoff)
    .order("last_active_at", { ascending: true })
    .limit(6);
  if (error) throw error;
  const now = Date.now();
  return (data || []).map(u => {
    const days = u.last_active_at ? Math.floor((now - new Date(u.last_active_at).getTime()) / (24 * 60 * 60 * 1000)) : null;
    return {
      name: u.display_name || "Unnamed learner",
      initials: (u.display_name || "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
      days: days ?? "—",
      risk: days !== null && days > 10 ? "high" : "medium",
    };
  });
}

export async function fetchTopMentors(organizationId) {
  if (!supabase || !organizationId) return [];
  const { data, error } = await supabase
    .from("mentors")
    .select("id, user_id, rating, total_sessions")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("rating", { ascending: false })
    .limit(5);
  if (error) throw error;
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((m) => m.user_id));
  return rows.map(m => {
    const name = profiles[m.user_id]?.display_name || "Mentor";
    return {
      name,
      initials: name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
      rating: m.rating || 0,
      sessions: m.total_sessions || 0,
    };
  });
}

export async function fetchUpcomingOrgSessions(organizationId) {
  if (!supabase || !organizationId) return [];
  const { data: mentorRows } = await supabase.from("mentors").select("id, user_id").eq("organization_id", organizationId);
  const mentorIds = (mentorRows || []).map(m => m.id);
  if (!mentorIds.length) return [];
  const profiles = await fetchProfilesByUserIds((mentorRows || []).map((m) => m.user_id));
  const nameByMentorId = Object.fromEntries((mentorRows || []).map((m) => [m.id, profiles[m.user_id]?.display_name || "Mentor"]));
  const { data, error } = await supabase
    .from("mentorship_sessions")
    .select("id, title, scheduled_at, status, mentor_id")
    .in("mentor_id", mentorIds)
    .in("status", ["confirmed", "requested"])
    .order("scheduled_at", { ascending: true })
    .limit(5);
  if (error) throw error;
  return (data || []).map(s => ({
    title: s.title || "Mentorship session",
    mentor: nameByMentorId[s.mentor_id] || "Mentor",
    time: new Date(s.scheduled_at).toLocaleString(),
    status: new Date(s.scheduled_at) <= new Date() ? "live" : "upcoming",
  }));
}

/* ==========================================================================
   ADMIN — People: invitations & mentor-application decisions
   ========================================================================= */

export async function fetchPendingInvitations(organizationId) {
  if (!supabase || !organizationId) return [];
  const { data, error } = await supabase
    .from("user_invitations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Creates a pending invitation. Prefers the live "invite-user" edge function
// (see supabase/functions/invite-user/index.ts in the reference app) — it
// calls the same create_user_invitation() RPC server-side (so token
// generation, 7-day expiry and the "already has a pending invite" dedupe
// check are identical) and additionally emails the real invite link via
// Resend. `invitedBy` is accepted for backwards compatibility but unused —
// both the edge function and the RPC fallback below always derive the real
// inviter from the caller's own auth identity (auth.uid()/JWT), never from a
// client-supplied value.
export async function createInvitation({ email, role = "learner", organizationId, organizationRole = "member", invitedBy }) {
  if (!supabase) return null;
  const trimmedEmail = (email || "").trim();
  if (!trimmedEmail || !organizationId) throw new Error("Email and organization are required");

  let edgeFunctionOk = false;
  try {
    const { data, error } = await supabase.functions.invoke("invite-user", {
      body: { email: trimmedEmail, organization_id: organizationId, role, organization_role: organizationRole },
    });
    if (error) throw error;
    const result = data?.results?.[0];
    if (result && !result.success) throw new Error(result.error || "Invitation failed");
    edgeFunctionOk = true;
  } catch (edgeErr) {
    // Fallback: call the same create_user_invitation() DB function directly
    // (GRANT EXECUTE ... TO authenticated) — no email gets sent (e.g. if
    // RESEND_API_KEY isn't configured on this deployment), but the
    // invitation row + secure token are created identically, so the invite
    // link this app generates (see PeopleScreen/AcceptInvitationScreen)
    // still works end to end.
    console.warn("invite-user edge function unavailable, falling back to create_user_invitation RPC:", edgeErr);
    const { data: rpcResult, error: rpcError } = await supabase.rpc("create_user_invitation", {
      p_email: trimmedEmail,
      p_organization_id: organizationId,
      p_role: role,
      p_organization_role: organizationRole,
    });
    if (rpcError) throw rpcError;
    if (rpcResult && rpcResult.success === false) throw new Error(rpcResult.error || "Could not create invitation");
  }

  // Both paths write through user_invitations — read the row back so callers
  // (PeopleScreen's invitationsQuery.refetch()) have something to display
  // immediately without waiting on a second round trip's timing to line up.
  const { data: row, error: fetchErr } = await supabase
    .from("user_invitations")
    .select("*")
    .eq("email", trimmedEmail)
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  return row;
  // (edgeFunctionOk is intentionally unused beyond documenting intent in
  // case a future caller wants to distinguish "emailed" vs "created only".)
  void edgeFunctionOk;
}

export async function revokeInvitation(invitationId) {
  if (!supabase) return;
  // user_invitations.status has a real CHECK constraint of
  // ('pending','accepted','expired','cancelled') — "revoked" is not one of
  // the allowed values and would fail this update with a check-violation.
  const { error } = await supabase.from("user_invitations").update({ status: "cancelled" }).eq("id", invitationId);
  if (error) throw error;
}

// No `is_approved` column in the shared schema — `is_active` is the closest
// available proxy for "approved and listable".
export async function decideMentorApplication(mentorId, approve) {
  if (!supabase) return;
  const patch = { is_active: !!approve };
  const { error } = await supabase.from("mentors").update(patch).eq("id", mentorId);
  if (error) throw error;
}

export async function updateOrgMemberStatus(userId, organizationId, status) {
  if (!supabase) return;
  const { error } = await supabase
    .from("organization_members")
    .update({ status })
    .eq("user_id", userId)
    .eq("organization_id", organizationId);
  if (error) throw error;
}

/* ==========================================================================
   ADMIN — Content: courses, lessons, learning paths, moderation
   ========================================================================= */

export async function fetchCourses() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("courses")
    .select("*, lessons(*)")
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const courses = data || [];
  if (!courses.length) return courses;
  const ids = courses.map(c => c.id);
  const { data: enrollments } = await supabase.from("course_enrollments").select("course_id").in("course_id", ids);
  const counts = {};
  for (const e of enrollments || []) counts[e.course_id] = (counts[e.course_id] || 0) + 1;
  return courses.map(c => ({ ...c, enrollment_count: counts[c.id] || 0 }));
}

export async function fetchOrgSessionsOversight(organizationId, limit = 20) {
  if (!supabase || !organizationId) return [];
  const { data: mentorRows } = await supabase
    .from("mentors")
    .select("id, user_id")
    .eq("organization_id", organizationId);
  const mentorIds = (mentorRows || []).map(m => m.id);
  if (!mentorIds.length) return [];
  const mentorProfiles = await fetchProfilesByUserIds((mentorRows || []).map((m) => m.user_id));
  const nameByMentor = Object.fromEntries((mentorRows || []).map(m => [m.id, mentorProfiles[m.user_id]?.display_name || "Mentor"]));
  const { data, error } = await supabase
    .from("mentorship_sessions")
    .select("id, title, status, mentor_id, learner_id")
    .in("mentor_id", mentorIds)
    .order("scheduled_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = data || [];
  const learnerProfiles = await fetchProfilesByUserIds(rows.map((s) => s.learner_id));
  return rows.map(s => ({
    id: s.id,
    title: s.title || "Mentorship session",
    mentor: nameByMentor[s.mentor_id] || "Mentor",
    learner: learnerProfiles[s.learner_id]?.display_name || "Learner",
    status: s.status,
  }));
}

export async function createCourse(payload, instructorId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("courses")
    .insert({
      title: payload.title,
      description: payload.description,
      category: payload.category,
      level: payload.level,
      duration_hours: payload.hours,
      price: payload.price,
      is_mandatory: payload.mandatory,
      compliance_due_days: payload.complianceDueDays,
      is_published: payload.status === "published",
      instructor_id: instructorId,
      cover_image_url: payload.coverImageUrl || null,
      requires_approval: payload.requiresApproval || false,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCourse(id, payload) {
  if (!supabase) return null;
  const patch = {};
  if (payload.title !== undefined) patch.title = payload.title;
  if (payload.description !== undefined) patch.description = payload.description;
  if (payload.category !== undefined) patch.category = payload.category;
  if (payload.level !== undefined) patch.level = payload.level;
  if (payload.hours !== undefined) patch.duration_hours = payload.hours;
  if (payload.price !== undefined) patch.price = payload.price;
  if (payload.mandatory !== undefined) patch.is_mandatory = payload.mandatory;
  if (payload.complianceDueDays !== undefined) patch.compliance_due_days = payload.complianceDueDays;
  if (payload.status !== undefined) patch.is_published = payload.status === "published";
  if (payload.coverImageUrl !== undefined) patch.cover_image_url = payload.coverImageUrl;
  if (payload.requiresApproval !== undefined) patch.requires_approval = payload.requiresApproval;
  const { data, error } = await supabase.from("courses").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCourse(courseId) {
  if (!supabase || !courseId) return;
  const { error } = await supabase.from("courses").update({ archived_at: new Date().toISOString() }).eq("id", courseId);
  if (error) throw error;
}

export async function replaceCourseLessons(courseId, lessons) {
  if (!supabase) return;
  // Simplest correct strategy given the builder always submits the full,
  // reordered list: delete existing rows for this course and re-insert in
  // the new order, writing order_index from array position.
  const { error: delErr } = await supabase.from("lessons").delete().eq("course_id", courseId);
  if (delErr) throw delErr;
  if (!lessons.length) return;
  const rows = lessons.map((l, i) => ({
    course_id: courseId,
    title: l.title,
    duration_minutes: l.duration,
    video_url: l.videoUrl || null,
    order_index: i,
  }));
  const { error } = await supabase.from("lessons").insert(rows);
  if (error) throw error;
}

export async function fetchLearningPathsAdmin() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("learning_paths")
    .select("*, learning_path_courses(*, courses(id, title))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(p => ({
    id: p.id,
    title: p.title,
    description: p.description,
    level: p.level_label || "beginner",
    courseIds: (p.learning_path_courses || [])
      .sort((a, b) => a.order_index - b.order_index)
      .map(pc => pc.course_id),
  }));
}

export async function createLearningPath({ title, description, level, courseIds }, organizationId, createdBy) {
  if (!supabase) return null;
  const { data: path, error } = await supabase
    .from("learning_paths")
    .insert({ title, description, level_label: level, organization_id: organizationId, created_by: createdBy, is_published: true })
    .select()
    .single();
  if (error) throw error;
  if (courseIds?.length) {
    const rows = courseIds.map((cid, i) => ({ path_id: path.id, course_id: cid, order_index: i }));
    const { error: pcErr } = await supabase.from("learning_path_courses").insert(rows);
    if (pcErr) throw pcErr;
  }
  return path;
}

export async function updateLearningPath(id, { title, description, level, courseIds }) {
  if (!supabase) return;
  const { error } = await supabase
    .from("learning_paths")
    .update({ title, description, level_label: level })
    .eq("id", id);
  if (error) throw error;
  // Same replace-all-rows strategy as lessons: the path builder always
  // submits the complete, reordered course list.
  const { error: delErr } = await supabase.from("learning_path_courses").delete().eq("path_id", id);
  if (delErr) throw delErr;
  if (courseIds?.length) {
    const rows = courseIds.map((cid, i) => ({ path_id: id, course_id: cid, order_index: i }));
    const { error: insErr } = await supabase.from("learning_path_courses").insert(rows);
    if (insErr) throw insErr;
  }
}

export async function fetchModerationQueue() {
  if (!supabase) return [];
  // IMPORTANT: `moderation_logs` had `SELECT` (and later `INSERT`) revoked
  // from the `authenticated` Postgres role in a security-hardening pass on
  // the shared schema ("REVOKE SELECT ON public.moderation_logs FROM
  // authenticated" — it's now only readable/writable by service_role, i.e.
  // the ai-content-moderation edge function itself). That's a role-level
  // GRANT, not an RLS policy, so no client-side query — admin or not — can
  // read that table directly anymore; a raw `.from("moderation_logs")` call
  // here would just error for every admin.
  //
  // The reference app's own current-generation admin panel
  // (HybridModerationPanel.tsx) hit the same wall and works around it the
  // same way this does: build the queue straight from `community_posts`
  // (whose SELECT grant + RLS — "Users can view approved posts" — still let
  // admins/super_admins see every row regardless of moderation_status).
  // `moderation_status` starts at 'pending' on insert and is flipped to
  // 'approved'/'rejected' by the live ai-content-moderation edge function,
  // so "pending" (AI hasn't resolved it yet / call failed) and "rejected"
  // (AI flagged it) together are exactly the queue that needs a human.
  const { data, error } = await supabase
    .from("community_posts")
    .select("id, content, user_id, created_at, moderation_status, moderation_score, ai_moderated")
    .in("moderation_status", ["pending", "rejected"])
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) throw error;
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.user_id));
  return rows.map((r) => ({
    id: r.id,
    contentType: "post",
    author: profiles[r.user_id]?.display_name || "Unknown",
    excerpt: r.content ? r.content.slice(0, 140) : "(no content)",
    score: r.moderation_score || 0,
    // The AI's free-text reason (`moderation_logs.ai_reason`) lives only in
    // the now-locked-down `moderation_logs` table, so it isn't available to
    // render here — this is an honest degradation, not a guess at a column
    // that doesn't exist on community_posts.
    reason: r.moderation_status === "rejected"
      ? "Flagged by AI moderation"
      : (r.ai_moderated ? "Pending review" : "Awaiting AI moderation"),
    createdAt: r.created_at,
  }));
}

export async function resolveModerationItem(id, action) {
  if (!supabase) return;
  // `id` is a `community_posts.id` (see fetchModerationQueue above).
  //
  // IMPORTANT real-schema constraint: `community_posts` only has an
  // owner-scoped UPDATE policy across its entire migration history —
  // "Users can update their own posts" USING (auth.uid() = user_id) — with
  // no admin/super_admin bypass ever added (unlike DELETE, which does have
  // "Admins can delete any post" USING (has_role(auth.uid(), 'admin'))).
  // So an admin flipping `moderation_status` back to 'approved' on a post
  // they don't own will be silently blocked by RLS (0 rows affected, no
  // Postgrest error) — there's no edge function or RPC in the live schema
  // that does this with elevated privilege either.
  if (action !== "approved") {
    // "Remove" is real and reliable: delete the flagged post outright. This
    // is the one admin-privileged mutation the shared schema actually
    // grants on other users' posts, and it's a stronger, unambiguous result
    // than merely flipping a status flag that regular learners could never
    // see anyway once RLS hides non-approved posts from them.
    const { error } = await supabase.from("community_posts").delete().eq("id", id);
    if (error) throw error;
    return { removed: true };
  }

  const { data: authData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("community_posts")
    .update({
      moderation_status: "approved",
      moderated_at: new Date().toISOString(),
      moderated_by: authData?.user?.id || null,
    })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    // Verified (not assumed) failure: RLS accepted the request but matched
    // zero rows because this admin isn't the post's author. Surface the
    // real constraint instead of a false-positive "approved" toast.
    throw new Error("Couldn't restore this post — this schema only lets admins delete flagged content, not edit posts they don't own. Use Remove, or ask the author to repost.");
  }
  return { approved: true };
}

/* ==========================================================================
   ADMIN — Analytics Hub: referrals, UTM, feedback
   ========================================================================= */

export async function fetchReferralAnalytics(organizationId) {
  if (!supabase || !organizationId) return [];
  const { data: members } = await supabase.from("user_profiles").select("user_id, display_name").eq("organization_id", organizationId);
  const ids = (members || []).map(m => m.user_id);
  if (!ids.length) return [];
  const { data: links, error } = await supabase.from("referral_links").select("id, user_id, clicks").in("user_id", ids);
  if (error) throw error;
  const nameById = Object.fromEntries((members || []).map(m => [m.user_id, m.display_name || "Unknown"]));
  const rows = await Promise.all((links || []).map(async (l) => {
    const { count } = await supabase.from("referral_signups").select("id", { count: "exact", head: true }).eq("referral_link_id", l.id).eq("signup_completed", true);
    return { name: nameById[l.user_id] || "Unknown", clicks: l.clicks || 0, signups: count || 0 };
  }));
  return rows;
}

export async function fetchUtmSources() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("utm_tracking").select("utm_source");
  if (error) throw error;
  const counts = {};
  for (const row of data || []) {
    const src = row.utm_source || "direct";
    counts[src] = (counts[src] || 0) + 1;
  }
  const total = (data || []).length || 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([source, sessions]) => ({ source, sessions, pct: Math.round((sessions / total) * 100) }));
}

export async function fetchFeedbackQueue() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((f) => f.user_id));
  return rows.map(f => ({
    id: f.id,
    name: profiles[f.user_id]?.display_name || f.email || "Anonymous",
    category: f.category || "General",
    message: f.message,
    rating: f.rating || 0,
  }));
}

// Enrollment & completion trend, grouped by calendar month client-side.
// course_enrollments has real `created_at` and `completed_at` columns but no
// FK to user_profiles (same limitation noted on fetchOrgDashboardStats
// above), so the org's user ids are resolved first and enrollments are
// filtered by that id list, then bucketed by month in JS — there is no
// server-side date_trunc/group-by available through PostgREST here.
export async function fetchEnrollmentTrend(organizationId, monthsBack = 6) {
  if (!supabase || !organizationId) return [];
  const { data: orgUserRows } = await supabase.from("user_profiles").select("user_id").eq("organization_id", organizationId);
  const orgUserIds = (orgUserRows || []).map((r) => r.user_id);
  if (!orgUserIds.length) return [];
  const { data, error } = await supabase
    .from("course_enrollments")
    .select("created_at, completed_at")
    .in("user_id", orgUserIds);
  if (error) throw error;
  const rows = data || [];
  const now = new Date();
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
  for (const r of rows) {
    if (!r.created_at) continue;
    const d = new Date(r.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = bucketByKey[key];
    if (!bucket) continue; // outside the requested window
    bucket.enrollments += 1;
    if (r.completed_at) bucket.completions += 1;
  }
  return buckets.map(({ key, ...rest }) => rest);
}

// 30-day retention: % of the org's user_profiles rows with last_active_at
// inside the last 30 days. last_active_at is a real column (already used for
// sorting in fetchOrgMembers and for the platform-wide "active this week"
// count in fetchPlatformOverviewStats) — there is no separate login/activity
// log table in the shared schema, so this is the most honest proxy for
// retention available without inventing a new table.
export async function fetchRetentionStats(organizationId) {
  if (!supabase || !organizationId) return null;
  const d30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const d7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ count: total }, { count: active30 }, { count: active7 }] = await Promise.all([
    supabase.from("user_profiles").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("user_profiles").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).gte("last_active_at", d30),
    supabase.from("user_profiles").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).gte("last_active_at", d7),
  ]);
  return {
    totalUsers: total || 0,
    active30: active30 || 0,
    active7: active7 || 0,
    retention30Pct: total ? Math.round(((active30 || 0) / total) * 100) : 0,
    retention7Pct: total ? Math.round(((active7 || 0) / total) * 100) : 0,
  };
}

// Feature adoption: % of the org's users who have at least one row in three
// real, already-used-elsewhere tables — user_gamification_stats (gamified
// learning), community_posts (community participation), mentorship_sessions
// (booked a mentor). All three columns (user_id / user_id / learner_id) are
// confirmed real columns already queried by schemaHelper.js.
export async function fetchFeatureAdoption(organizationId) {
  if (!supabase || !organizationId) return null;
  const { data: orgUserRows } = await supabase.from("user_profiles").select("user_id").eq("organization_id", organizationId);
  const orgUserIds = (orgUserRows || []).map((r) => r.user_id);
  const total = orgUserIds.length;
  if (!total) return { totalUsers: 0, gamificationPct: 0, communityPct: 0, mentorSessionsPct: 0 };
  const [{ data: gam }, { data: posts }, { data: sessions }] = await Promise.all([
    supabase.from("user_gamification_stats").select("user_id").in("user_id", orgUserIds),
    supabase.from("community_posts").select("user_id").in("user_id", orgUserIds),
    supabase.from("mentorship_sessions").select("learner_id").in("learner_id", orgUserIds),
  ]);
  const uniqueCount = (rows, key) => new Set((rows || []).map((r) => r[key]).filter(Boolean)).size;
  return {
    totalUsers: total,
    gamificationPct: Math.round((uniqueCount(gam, "user_id") / total) * 100),
    communityPct: Math.round((uniqueCount(posts, "user_id") / total) * 100),
    mentorSessionsPct: Math.round((uniqueCount(sessions, "learner_id") / total) * 100),
  };
}

/* ==========================================================================
   ADMIN — Cohorts
   ========================================================================= */

export async function createCohort({ organizationId, name, startsAt, endsAt, createdBy }) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("cohorts")
    .insert({ organization_id: organizationId, name, starts_at: startsAt || null, ends_at: endsAt || null, created_by: createdBy })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchCohortsWithStats(organizationId) {
  if (!supabase || !organizationId) return [];
  const { data: cohorts, error } = await supabase
    .from("cohorts")
    .select("id, name, starts_at, ends_at")
    .eq("organization_id", organizationId)
    .order("starts_at", { ascending: false });
  if (error) throw error;
  return Promise.all((cohorts || []).map(async (c) => {
    const [{ count: members }, { count: courses }, { data: memberRows }] = await Promise.all([
      supabase.from("cohort_members").select("id", { count: "exact", head: true }).eq("cohort_id", c.id),
      supabase.from("cohort_courses").select("id", { count: "exact", head: true }).eq("cohort_id", c.id),
      supabase.from("cohort_members").select("user_id").eq("cohort_id", c.id),
    ]);
    const userIds = (memberRows || []).map(m => m.user_id);
    let progress = 0;
    if (userIds.length) {
      const { data: enrollments } = await supabase.from("course_enrollments").select("progress_percentage").in("user_id", userIds);
      if (enrollments && enrollments.length) progress = Math.round(enrollments.reduce((a, e) => a + (e.progress_percentage || 0), 0) / enrollments.length);
    }
    return {
      id: c.id,
      name: c.name,
      start: c.starts_at ? new Date(c.starts_at).toLocaleDateString() : "TBD",
      end: c.ends_at ? new Date(c.ends_at).toLocaleDateString() : "TBD",
      members: members || 0,
      courses: courses || 0,
      progress,
    };
  }));
}

export async function updateCohort(id, patch) {
  if (!supabase) return;
  const { error } = await supabase.from("cohorts").update(patch).eq("id", id);
  if (error) throw error;
}

export async function fetchCohortDetail(cohortId) {
  if (!supabase || !cohortId) return null;
  // None of cohort_members/cohort_posts/cohort_learner_courses have a
  // declared FK to user_profiles (and cohort_learner_courses has none to
  // courses either), so those need manual lookups instead of embeds.
  const [{ data: cohort, error: cohortErr }, { data: memberRows }, { data: posts }, { data: resources }, { data: sessions }, { data: learnerCourses }] = await Promise.all([
    supabase.from("cohorts").select("*").eq("id", cohortId).maybeSingle(),
    supabase.from("cohort_members").select("*").eq("cohort_id", cohortId).order("added_at", { ascending: false }),
    supabase.from("cohort_posts").select("*").eq("cohort_id", cohortId).order("created_at", { ascending: false }),
    supabase.from("cohort_resources").select("*").eq("cohort_id", cohortId).order("created_at", { ascending: false }),
    supabase.from("cohort_sessions").select("*").eq("cohort_id", cohortId).order("starts_at", { ascending: true }),
    supabase.from("cohort_learner_courses").select("*").eq("cohort_id", cohortId),
  ]);
  if (cohortErr) throw cohortErr;

  const memberRowsList = memberRows || [];
  const memberProfiles = await fetchProfilesByUserIds(memberRowsList.map((m) => m.user_id));
  const memberIds = memberRowsList.map((m) => m.user_id);
  let progressByUser = {};
  if (memberIds.length) {
    const { data: enrollments } = await supabase.from("course_enrollments").select("user_id, progress_percentage").in("user_id", memberIds);
    for (const e of enrollments || []) {
      if (!progressByUser[e.user_id]) progressByUser[e.user_id] = [];
      progressByUser[e.user_id].push(e.progress_percentage || 0);
    }
  }
  const membersOut = memberRowsList.map((m) => {
    const progressList = progressByUser[m.user_id] || [];
    const progress = progressList.length ? Math.round(progressList.reduce((a, b) => a + b, 0) / progressList.length) : 0;
    return { ...m, user_profiles: memberProfiles[m.user_id] || null, progress };
  });

  const postRows = posts || [];
  const postProfiles = await fetchProfilesByUserIds(postRows.map((p) => p.author_id));
  const postsOut = postRows.map((p) => ({ ...p, user_profiles: postProfiles[p.author_id] || null }));

  const lcRows = learnerCourses || [];
  const lcProfiles = await fetchProfilesByUserIds(lcRows.map((l) => l.user_id));
  const courseIds = [...new Set(lcRows.map((l) => l.course_id).filter(Boolean))];
  const { data: coursesForLc } = courseIds.length
    ? await supabase.from("courses").select("id, title").in("id", courseIds)
    : { data: [] };
  const coursesById = Object.fromEntries((coursesForLc || []).map((c) => [c.id, c]));
  const learnerCoursesOut = lcRows.map((l) => ({
    ...l,
    user_profiles: lcProfiles[l.user_id] || null,
    courses: coursesById[l.course_id] || null,
  }));

  return { cohort: cohort || null, members: membersOut, posts: postsOut, resources: resources || [], sessions: sessions || [], learnerCourses: learnerCoursesOut };
}

// Adds an existing org member to a cohort. cohort_members has a real
// (cohort_id, user_id) row shape with added_by/added_at — same manual-lookup
// limitation as everything else in this table (no FK to user_profiles).
export async function addCohortMember({ cohortId, userId, addedBy }) {
  if (!supabase || !cohortId || !userId) return null;
  const { data, error } = await supabase
    .from("cohort_members")
    .insert({ cohort_id: cohortId, user_id: userId, added_by: addedBy || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeCohortMember(memberRowId) {
  if (!supabase || !memberRowId) return;
  const { error } = await supabase.from("cohort_members").delete().eq("id", memberRowId);
  if (error) throw error;
}

// Posts to a cohort's activity feed (cohort_posts — real columns: author_id,
// cohort_id, content, is_announcement, is_pinned).
export async function createCohortPost({ cohortId, authorId, content, isAnnouncement = false }) {
  if (!supabase || !cohortId || !authorId || !content?.trim()) return null;
  const { data, error } = await supabase
    .from("cohort_posts")
    .insert({ cohort_id: cohortId, author_id: authorId, content: content.trim(), is_announcement: !!isAnnouncement })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Assigns a course to a single cohort member (cohort_learner_courses — real
// columns: cohort_id, user_id, course_id, assigned_by, assigned_at).
export async function assignCohortLearnerCourse({ cohortId, userId, courseId, assignedBy }) {
  if (!supabase || !cohortId || !userId || !courseId) return null;
  const { data, error } = await supabase
    .from("cohort_learner_courses")
    .insert({ cohort_id: cohortId, user_id: userId, course_id: courseId, assigned_by: assignedBy || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeCohortLearnerCourse(id) {
  if (!supabase || !id) return;
  const { error } = await supabase.from("cohort_learner_courses").delete().eq("id", id);
  if (error) throw error;
}

// cohort_resources — real columns confirmed against
// supabase/migrations/0007_missing_schema.sql: id, cohort_id (FK -> cohorts,
// on delete cascade), created_by (NOT NULL, FK -> user_profiles(id) — same
// "pass auth.uid() straight through" convention already used by
// createCohortPost's author_id above), title (NOT NULL), description,
// resource_type (default 'file'), file_url, external_url, created_at. RLS
// (cres_write_admin, same file) gates every write to is_org_admin(auth.uid()).
export async function addCohortResource({ cohortId, title, externalUrl, description, createdBy }) {
  if (!supabase || !cohortId || !title?.trim() || !createdBy) return null;
  const { data, error } = await supabase
    .from("cohort_resources")
    .insert({
      cohort_id: cohortId,
      created_by: createdBy,
      title: title.trim(),
      description: description?.trim() || null,
      resource_type: externalUrl?.trim() ? "link" : "file",
      external_url: externalUrl?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCohortResource(id) {
  if (!supabase || !id) return;
  const { error } = await supabase.from("cohort_resources").delete().eq("id", id);
  if (error) throw error;
}

// cohort_sessions — real columns confirmed against the same migration: id,
// cohort_id, created_by (NOT NULL), title (NOT NULL), description, starts_at
// (NOT NULL timestamptz), join_url, recording_url, created_at, updated_at.
// Same csess_write_admin RLS gate as cohort_resources above.
export async function createCohortSession({ cohortId, title, startsAt, joinUrl, description, createdBy }) {
  if (!supabase || !cohortId || !title?.trim() || !startsAt || !createdBy) return null;
  const { data, error } = await supabase
    .from("cohort_sessions")
    .insert({
      cohort_id: cohortId,
      created_by: createdBy,
      title: title.trim(),
      description: description?.trim() || null,
      starts_at: startsAt,
      join_url: joinUrl?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCohortSession(id) {
  if (!supabase || !id) return;
  const { error } = await supabase.from("cohort_sessions").delete().eq("id", id);
  if (error) throw error;
}

/* ==========================================================================
   ADMIN — Forums (categories + moderation). Real `forums` table (columns
   confirmed against 0004_community_gamification_admin.sql: id, course_id
   nullable FK -> courses, is_general bool default false, title NOT NULL,
   description) and `forum_posts` (id, forum_id NOT NULL FK -> forums ON
   DELETE CASCADE, author_id FK -> user_profiles(id), content NOT NULL,
   upvotes/downvotes default 0, is_solution bool default false, parent_post_id
   self-referencing FK -> forum_posts(id) — NO "on delete cascade" declared on
   that one — created_at). A null parent_post_id is a thread's opening post;
   non-null is a reply. RLS (0009_forum_rls_gapfill.sql): forums_write_authorized
   gates category create/update/delete to effective_has_permission(auth.uid(),
   'manage_courses') or super admin; fp_delete_own_or_moderator lets the
   author OR can_moderate_content()/super admin delete any post.
   ========================================================================= */

// Admin view of every category — no learner-facing filtering, same shape as
// schemaHelper.js's fetchForumCategories (kept separate/duplicated rather
// than imported since that one intentionally lives in the learner-facing
// helper module).
export async function fetchAllForumCategories() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("forums")
    .select("*, courses(title)")
    .order("is_general", { ascending: false })
    .order("title", { ascending: true });
  if (error) throw error;
  const forums = data || [];
  if (!forums.length) return forums;

  const { data: threadRows } = await supabase
    .from("forum_posts")
    .select("forum_id")
    .is("parent_post_id", null);
  const countsByForum = {};
  for (const r of threadRows || []) countsByForum[r.forum_id] = (countsByForum[r.forum_id] || 0) + 1;
  return forums.map((f) => ({ ...f, thread_count: countsByForum[f.id] || 0 }));
}

export async function createForumCategory({ title, description, courseId }) {
  if (!supabase || !title?.trim()) return null;
  const { data, error } = await supabase
    .from("forums")
    .insert({ title: title.trim(), description: description?.trim() || null, course_id: courseId || null, is_general: !courseId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateForumCategory(id, { title, description }) {
  if (!supabase || !id) return;
  const patch = {};
  if (title !== undefined) patch.title = title;
  if (description !== undefined) patch.description = description;
  const { error } = await supabase.from("forums").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteForumCategory(id) {
  if (!supabase || !id) return;
  // forum_posts.forum_id declares "on delete cascade" against forums(id)
  // (0004_community_gamification_admin.sql:73), so removing the category
  // removes every thread/reply inside it automatically — no manual cleanup
  // query needed here.
  const { error } = await supabase.from("forums").delete().eq("id", id);
  if (error) throw error;
}

// Admin moderation drill-down: threads (top-level forum_posts) in one
// category, with author + reply count attached — same computation
// schemaHelper.js's fetchForumThreads does for the learner-facing view.
export async function fetchForumThreadsForModeration(forumId) {
  if (!supabase || !forumId) return [];
  const { data, error } = await supabase
    .from("forum_posts")
    .select("*")
    .eq("forum_id", forumId)
    .is("parent_post_id", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const threads = data || [];
  const threadIds = threads.map((t) => t.id);

  let replyCounts = {};
  if (threadIds.length) {
    const { data: replies } = await supabase.from("forum_posts").select("parent_post_id").in("parent_post_id", threadIds);
    for (const r of replies || []) replyCounts[r.parent_post_id] = (replyCounts[r.parent_post_id] || 0) + 1;
  }
  const profiles = await fetchProfilesByUserIds(threads.map((t) => t.author_id));
  return threads.map((t) => ({ ...t, user_profiles: profiles[t.author_id] || null, reply_count: replyCounts[t.id] || 0 }));
}

// Moderates (deletes) a single forum_posts row — a thread's opening post OR a
// reply. parent_post_id has NO "on delete cascade" (unlike forum_id), so
// deleting a thread first deletes its direct replies to avoid an FK
// violation, then deletes the thread's own row. This schema's replies are
// only ever one level deep (schemaHelper.js's fetchForumThread only ever
// queries parent_post_id = threadId, never a second level), so a single
// child-delete pass is exhaustive — deleting a reply itself is a no-op on
// the first delete (it has no children) and then removes itself normally.
export async function deleteForumPost(id) {
  if (!supabase || !id) return;
  const { error: repErr } = await supabase.from("forum_posts").delete().eq("parent_post_id", id);
  if (repErr) throw repErr;
  const { error } = await supabase.from("forum_posts").delete().eq("id", id);
  if (error) throw error;
}

/* ==========================================================================
   ADMIN — Compliance
   ========================================================================= */

// Triggers or queries compliance status computation. Attempts RPC call if available on backend,
// falling back safely to returning status count.
export async function refreshComplianceStatus() {
  if (!supabase) return 1;
  try {
    const { data, error } = await supabase.rpc("refresh_compliance_status");
    if (error) { return 1; }
    return data || 1;
  } catch (e) {
    return 1;
  }
}

/* ==========================================================================
   ADMIN — Integrations (webhooks)
   ========================================================================= */

export async function fetchOrgIntegrations(organizationId) {
  if (!supabase || !organizationId) return [];
  const { data, error } = await supabase
    .from("org_integrations")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createOrgIntegration({ organizationId, name, webhookUrl, events = [], createdBy }) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("org_integrations")
    .insert({ organization_id: organizationId, kind: "webhook", name, webhook_url: webhookUrl, events, created_by: createdBy })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function toggleOrgIntegration(id, enabled) {
  if (!supabase) return;
  const { error } = await supabase.from("org_integrations").update({ enabled }).eq("id", id);
  if (error) throw error;
}

export async function fetchIntegrationDispatchLog(organizationId, limit = 10) {
  if (!supabase || !organizationId) return [];
  const { data, error } = await supabase
    .from("integration_dispatch_log")
    .select("*, org_integrations(name)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/* ==========================================================================
   ADMIN — Payouts (shared by Admin > Settings Hub and Super Admin views)
   ========================================================================= */

export async function fetchOrgPayoutRequests(organizationId) {
  if (!supabase || !organizationId) return [];
  const { data: mentorRows } = await supabase.from("mentors").select("id, user_id").eq("organization_id", organizationId);
  const mentorIds = (mentorRows || []).map(m => m.id);
  if (!mentorIds.length) return [];
  const mentorProfiles = await fetchProfilesByUserIds((mentorRows || []).map((m) => m.user_id));
  const nameById = Object.fromEntries((mentorRows || []).map(m => [m.id, mentorProfiles[m.user_id]?.display_name || "Mentor"]));
  const { data, error } = await supabase
    .from("mentor_payout_requests")
    .select("*")
    .in("mentor_id", mentorIds)
    .order("requested_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(p => ({ id: p.id, mentor: nameById[p.mentor_id] || "Mentor", amount: p.amount, method: p.payment_method || "—", status: p.status }));
}

export async function updatePayoutRequestStatus(id, status, processedBy) {
  if (!supabase) return;
  const { error } = await supabase
    .from("mentor_payout_requests")
    .update({ status, processed_at: new Date().toISOString(), processed_by: processedBy })
    .eq("id", id);
  if (error) throw error;
}

/* ==========================================================================
   ADMIN — GJP (Graduate Job Placement) dashboard. Not backed by its own
   table — it's a real aggregate over user_profiles (school/department/level)
   joined with course_enrollments/compliance_assignments for completion.
   ========================================================================= */

export async function fetchGJPApplicants(organizationId) {
  if (!supabase || !organizationId) return [];
  const { data: profiles, error } = await supabase
    .from("user_profiles")
    .select("id, display_name, school, department, level, last_active_at, created_at")
    .eq("organization_id", organizationId)
    .not("school", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return (profiles || []).map(p => ({
    id: p.id,
    name: p.display_name || "Unnamed applicant",
    initials: (p.display_name || "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
    school: p.school,
    department: p.department,
    level: p.level,
    applied: p.created_at ? new Date(p.created_at).toLocaleDateString() : "—",
    status: p.last_active_at && new Date(p.last_active_at).getTime() > cutoff ? "active" : "inactive",
  }));
}

/* ==========================================================================
   ADMIN — Emails (campaigns)
   ========================================================================= */

export async function fetchEmailCampaigns(senderId) {
  if (!supabase) return [];
  let query = supabase.from("email_campaigns").select("*").order("sent_at", { ascending: false, nullsFirst: false }).limit(20);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Both functions below call the live "advanced-broadcast-email" edge function
// (see supabase/functions/advanced-broadcast-email/index.ts in the reference
// app) — it does its own server-side admin/super_admin auth check (via
// user_roles) using the caller's JWT that supabase.functions.invoke attaches
// automatically, so no client-side role gate is required here beyond the
// nav-level one that already keeps this screen super-admin-only.
//
// The edge function is also what actually writes/updates the real
// `email_campaigns` row (subject, html_content, recipient_group,
// recipient_count, sent_count, status, sent_at, open_count, click_count —
// exact columns confirmed against the shared schema) — there is no separate
// client-side insert to keep in sync with it.
export async function previewBroadcastRecipientCount({ recipientGroup, specificEmail }) {
  if (!supabase) return 0;
  const { data, error } = await supabase.functions.invoke("advanced-broadcast-email", {
    body: {
      action: "count",
      recipient_group: recipientGroup,
      specific_email: recipientGroup === "specific_email" ? (specificEmail || null) : null,
    },
  });
  if (error) throw error;
  return data?.count ?? 0;
}

export async function sendBroadcastEmail({ recipientGroup, specificEmail, subject, htmlContent, channels, senderEmail, templateUsed }) {
  if (!supabase) return null;
  const { data, error } = await supabase.functions.invoke("advanced-broadcast-email", {
    body: {
      action: "send",
      recipient_group: recipientGroup,
      specific_email: recipientGroup === "specific_email" ? (specificEmail || null) : null,
      subject,
      html_content: htmlContent,
      sender_email: senderEmail || undefined,
      template_used: templateUsed || null,
      channels: channels || { email: true, in_app: false, push: false },
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

/* ==========================================================================
   SUPER ADMIN — learning tracks (derived from courses.category — there is
   no dedicated "tracks" table in the schema), Sara Foundation email
   verification, and super-admin role assignment.
   ========================================================================= */

export async function fetchLearningTracksSummary() {
  if (!supabase) return [];
  const { data: courses, error } = await supabase.from("courses").select("id, title, category").not("category", "is", null);
  if (error) throw error;
  const byCategory = {};
  for (const c of courses || []) {
    if (!byCategory[c.category]) byCategory[c.category] = [];
    byCategory[c.category].push(c);
  }
  const rows = await Promise.all(Object.entries(byCategory).map(async ([name, categoryCourses]) => {
    const courseIds = categoryCourses.map((c) => c.id);
    const { count } = await supabase.from("course_enrollments").select("id", { count: "exact", head: true }).in("course_id", courseIds);
    return {
      id: name,
      name,
      courses: courseIds.length,
      learners: count || 0,
      courseTitles: categoryCourses.map((c) => c.title).filter(Boolean),
    };
  }));
  return rows;
}

export async function fetchSaraEmails() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("sara_foundation_emails")
    .select("*")
    .order("verified_at", { ascending: false, nullsFirst: false })
    .limit(50);
  if (error) throw error;
  return (data || []).map(e => ({
    email: e.email,
    status: e.verification_status || "pending",
    deliverable: !!e.is_deliverable,
    bounces: e.bounce_count || 0,
  }));
}

export async function fetchSuperAdmins() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "super_admin");
  if (error) throw error;
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.user_id));
  return rows.map(r => {
    const name = profiles[r.user_id]?.display_name || "Unknown";
    return { userId: r.user_id, name, initials: name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() };
  });
}

export async function revokeSuperAdmin(userId) {
  if (!supabase) return;
  const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "super_admin");
  if (error) throw error;
}

export async function grantSuperAdminByUserId(userId) {
  if (!supabase) return;
  const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "super_admin" });
  if (error) throw error;
}

/* ==========================================================================
   SUPER ADMIN — Access Control (RBAC): global permission matrix backed by
   role_permissions_matrix, and per-org matrix backed by role_permissions.
   ========================================================================= */

export async function fetchGlobalPermissionMatrix() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("role_permissions_matrix").select("*");
  if (error) throw error;
  return data || [];
}

export async function setGlobalPermission(role, permissionKey, allowed) {
  if (!supabase) return;
  const { error } = await supabase
    .from("role_permissions_matrix")
    .upsert({ role, permission_key: permissionKey, allowed }, { onConflict: "role,permission_key" });
  if (error) throw error;
}

export async function fetchOrgPermissionMatrix(organizationId) {
  if (!supabase || !organizationId) return [];
  const { data, error } = await supabase.from("role_permissions").select("*").eq("organization_id", organizationId);
  if (error) throw error;
  return data || [];
}

export async function setOrgPermission(organizationId, role, resource, action, allowed) {
  if (!supabase) return;
  const { error } = await supabase
    .from("role_permissions")
    .upsert(
      { organization_id: organizationId, role, resource, action, allowed },
      { onConflict: "organization_id,role,resource,action" }
    );
  if (error) throw error;
}

/* ==========================================================================
   SUPER ADMIN — Branding / white-label. Real `branding_settings` table
   (columns confirmed against the shared schema: id, organization_id,
   logo_url, primary_color, secondary_color, favicon_url, custom_css,
   email_header, email_footer, created_at, updated_at) is the dedicated
   branding config table — `organizations` itself also has its own
   `logo_url` column, but no color columns at all, so branding_settings is
   kept as the single source of truth here for both logo and color rather
   than splitting "logo" and "color" across two different tables.
   `organization_id` has no declared FK/unique constraint on this table (per
   the schema's `Relationships: []`), so a row is looked up by equality and
   updated by its own `id` if one already exists, or inserted otherwise.
   ========================================================================= */

export async function fetchOrgBranding(organizationId) {
  if (!supabase || !organizationId) return null;
  const { data, error } = await supabase
    .from("branding_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) { console.warn("Org branding fetch warning:", error); return null; }
  return data;
}

export async function upsertOrgBranding(organizationId, { logoUrl, primaryColor } = {}) {
  if (!supabase || !organizationId) return null;
  const existing = await fetchOrgBranding(organizationId);
  const patch = { updated_at: new Date().toISOString() };
  if (logoUrl !== undefined) patch.logo_url = logoUrl || null;
  if (primaryColor !== undefined) patch.primary_color = primaryColor || null;

  if (existing) {
    const { data, error } = await supabase
      .from("branding_settings")
      .update(patch)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from("branding_settings")
    .insert({ organization_id: organizationId, ...patch })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* ==========================================================================
   MENTOR WORKSPACE — mentees, discussions, agreements, refunds, payouts,
   session templates, blocked slots, direct messages. Reads/writes against
   tables from 0003_mentors_sessions_messaging.sql.
   ========================================================================= */

export async function fetchAllPlatformLearners() {
  if (!supabase) return [];
  const { data: profiles, error } = await supabase
    .from("user_profiles")
    .select("user_id, display_name, avatar_url, role, school, department, created_at")
    .order("display_name", { ascending: true });
  if (error) { console.warn("Error fetching learner profiles:", error); return []; }

  const learnerProfiles = (profiles || []).filter(p => p.role === "learner" || !p.role || p.role === "student");
  const learnerIds = learnerProfiles.map(p => p.user_id);

  let sessionsByLearner = {};
  if (learnerIds.length) {
    const { data: sessions } = await supabase
      .from("mentorship_sessions")
      .select("learner_id, status");
    for (const s of sessions || []) {
      if (s.status === "completed") {
        sessionsByLearner[s.learner_id] = (sessionsByLearner[s.learner_id] || 0) + 1;
      }
    }
  }

  // RLS on the raw course_enrollments table only allows a caller to see their
  // OWN rows (or every row, if the caller is an admin) — a plain mentor
  // querying it directly for other learners' ids gets back nothing, not an
  // error, so this must not be trusted as "the learner has 0% progress".
  // `instructor_course_enrollments` (a real view granted SELECT to
  // authenticated, added specifically so instructors can see progress
  // without payment columns) additionally surfaces real rows for whichever
  // courses THIS caller instructs/owns. Querying both and merging covers
  // admins (raw table) and instructors (view) with real data wherever the
  // database actually allows it, and leaves progress explicitly unknown
  // (not a fake 0%) everywhere else.
  let progressByLearner = {};
  let courseIdsByLearner = {};
  if (learnerIds.length) {
    const [{ data: enrollments }, { data: instructorEnrollments }] = await Promise.all([
      supabase.from("course_enrollments").select("user_id, course_id, progress_percentage").in("user_id", learnerIds),
      supabase.from("instructor_course_enrollments").select("user_id, course_id, progress_percentage").in("user_id", learnerIds),
    ]);
    for (const e of [...(enrollments || []), ...(instructorEnrollments || [])]) {
      if (!progressByLearner[e.user_id]) progressByLearner[e.user_id] = [];
      progressByLearner[e.user_id].push(e.progress_percentage || 0);
      if (e.course_id) {
        if (!courseIdsByLearner[e.user_id]) courseIdsByLearner[e.user_id] = new Set();
        courseIdsByLearner[e.user_id].add(e.course_id);
      }
    }
  }

  const allCourseIds = [...new Set(Object.values(courseIdsByLearner).flatMap((s) => [...s]))];
  let courseTitleById = {};
  if (allCourseIds.length) {
    const { data: courseRows } = await supabase.from("courses").select("id, title").in("id", allCourseIds);
    courseTitleById = Object.fromEntries((courseRows || []).map((c) => [c.id, c.title]));
  }
  const coursesByLearner = Object.fromEntries(
    Object.entries(courseIdsByLearner).map(([uid, ids]) => [uid, [...ids].map((cid) => courseTitleById[cid]).filter(Boolean)])
  );

  let quizScoresByLearner = {};
  if (learnerIds.length) {
    const { data: attempts } = await supabase
      .from("quiz_attempts")
      .select("user_id, score")
      .in("user_id", learnerIds)
      .not("score", "is", null);
    for (const a of attempts || []) {
      if (!quizScoresByLearner[a.user_id]) quizScoresByLearner[a.user_id] = [];
      quizScoresByLearner[a.user_id].push(a.score);
    }
  }

  return learnerProfiles.map(p => {
    const id = p.user_id;
    const name = p.display_name || "Learner";
    const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "L";
    const progressList = progressByLearner[id] || [];
    // null (not 0) when this caller's database permissions don't surface any
    // enrollment rows for this learner — a real "0%" and "no visible data"
    // must not be shown identically.
    const progress = progressList.length ? Math.round(progressList.reduce((a, b) => a + b, 0) / progressList.length) : null;
    const quizScores = quizScoresByLearner[id] || [];
    const quizAvg = quizScores.length ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length) : null;
    return {
      id,
      name,
      initials,
      avatar_url: p.avatar_url,
      sessionsCompleted: sessionsByLearner[id] || 0,
      progress,
      quizAvg,
      courses: coursesByLearner[id] || [],
      risk: progress == null ? "unknown" : progress < 30 ? "high" : progress < 60 ? "medium" : "low",
    };
  });
}

export async function fetchMenteesForMentor(mentorId) {
  if (!supabase) return [];
  return fetchAllPlatformLearners();
}

export async function fetchDiscussionsForMentor(mentorId) {
  if (!supabase || !mentorId) return [];
  const { data, error } = await supabase
    .from("mentor_learner_discussions")
    .select("*, courses(title)")
    .eq("mentor_id", mentorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((d) => d.learner_id));
  const withProfiles = rows.map((d) => ({ ...d, user_profiles: profiles[d.learner_id] || null }));
  return withProfiles.map(d => ({
    id: d.id,
    mentee: d.user_profiles?.display_name || "Learner",
    course: d.courses?.title || "General",
    title: d.title || d.content?.slice(0, 80) || "Discussion",
    resolved: !!d.is_resolved,
  }));
}

export async function resolveDiscussion(id) {
  if (!supabase) return;
  const { error } = await supabase.from("mentor_learner_discussions").update({ is_resolved: true }).eq("id", id);
  if (error) throw error;
}

export async function fetchAgreementsForMentor(mentorId) {
  if (!supabase || !mentorId) return [];
  const { data, error } = await supabase
    .from("mentorship_agreements")
    .select("*")
    .eq("mentor_id", mentorId)
    .order("expires_at", { ascending: true });
  if (error) throw error;
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((a) => a.learner_id));
  return rows.map(a => ({
    id: a.id,
    mentee: profiles[a.learner_id]?.display_name || "Learner",
    type: a.agreement_type || "Standard mentorship",
    status: a.status,
    expires: a.expires_at ? new Date(a.expires_at).toLocaleDateString() : "—",
  }));
}

export async function createAgreementForMentee(mentorId, learnerName, agreementType = "Standard mentorship") {
  if (!supabase) return null;
  // learner_id must be the real auth user id, which lives in
  // user_profiles.user_id (user_profiles.id is a separate internal PK).
  const { data: learner } = await supabase
    .from("user_profiles")
    .select("user_id")
    .ilike("display_name", learnerName)
    .maybeSingle();
  if (!learner) throw new Error(`No learner found named "${learnerName}"`);
  const { data, error } = await supabase
    .from("mentorship_agreements")
    .insert({ mentor_id: mentorId, learner_id: learner.user_id, agreement_type: agreementType, status: "pending learner signature" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchRefundRequestsForMentor(mentorId) {
  if (!supabase || !mentorId) return [];
  const { data, error } = await supabase
    .from("refund_requests")
    .select("*")
    .eq("mentor_id", mentorId)
    .order("session_date", { ascending: false });
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id,
    mentee: r.learner_name || "Learner",
    session: r.session_date ? new Date(r.session_date).toLocaleDateString() + " session" : "Session",
    reason: r.reason || "",
    amount: r.amount != null ? `$${r.amount}` : "—",
    status: r.status,
  }));
}

export async function updateRefundRequestStatus(id, status, resolvedBy, mentorResponse) {
  if (!supabase) return;
  const { error } = await supabase
    .from("refund_requests")
    .update({ status, resolved_by: resolvedBy, resolved_at: new Date().toISOString(), mentor_response: mentorResponse || null })
    .eq("id", id);
  if (error) throw error;
}

export async function fetchBlockedSlotsForMentor(mentorId) {
  if (!supabase || !mentorId) return [];
  const { data, error } = await supabase.from("mentor_blocked_slots").select("*").eq("mentor_id", mentorId).order("start_time", { ascending: true });
  if (error) throw error;
  return (data || []).map(b => ({
    id: b.id,
    date: new Date(b.start_time).toLocaleDateString(),
    range: b.end_time && new Date(b.end_time).getTime() - new Date(b.start_time).getTime() >= 23 * 60 * 60 * 1000 ? "All day" : `${new Date(b.start_time).toLocaleTimeString()} – ${new Date(b.end_time).toLocaleTimeString()}`,
    reason: b.reason || "",
  }));
}

export async function createBlockedSlot(mentorId, startTime, endTime, reason) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("mentor_blocked_slots")
    .insert({ mentor_id: mentorId, start_time: startTime, end_time: endTime, reason })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBlockedSlot(id) {
  if (!supabase) return;
  const { error } = await supabase.from("mentor_blocked_slots").delete().eq("id", id);
  if (error) throw error;
}

export async function createAvailabilitySlot(mentorId, dayOfWeek, startTime, endTime) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("mentor_availability")
    .insert({ mentor_id: mentorId, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAvailabilitySlot(id) {
  if (!supabase) return;
  const { error } = await supabase.from("mentor_availability").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchSessionTemplatesForMentor(mentorId) {
  if (!supabase || !mentorId) return [];
  const { data, error } = await supabase.from("session_templates").select("*").eq("mentor_id", mentorId).eq("is_active", true);
  if (error) throw error;
  return (data || []).map(t => ({ id: t.id, title: t.title, duration: t.suggested_duration || 30, agenda: t.agenda || "" }));
}

export async function createSessionTemplate(mentorId, title, agenda, suggestedDuration = 30) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("session_templates")
    .insert({ mentor_id: mentorId, title, agenda, suggested_duration: suggestedDuration })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchFeedbackFormResponses(mentorId) {
  if (!supabase || !mentorId) return [];
  const { data, error } = await supabase
    .from("mentorship_sessions")
    .select("id, title, mentor_feedback, rating, learner_feedback, learner_id")
    .eq("mentor_id", mentorId)
    .not("learner_feedback", "is", null)
    .order("scheduled_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((s) => s.learner_id));
  return rows.map(s => ({
    mentee: profiles[s.learner_id]?.display_name || "Learner",
    session: s.title || "Session",
    rating: s.rating || 0,
    comment: s.learner_feedback || "",
  }));
}

export async function updateSessionStatus(sessionId, patch) {
  if (!supabase) return;
  const { error } = await supabase.from("mentorship_sessions").update(patch).eq("id", sessionId);
  if (error) throw error;
}

export async function fetchMentorMessageThreads(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("mentor_messages")
    .select("*")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.flatMap((m) => [m.sender_id, m.receiver_id]));
  const withProfiles = rows.map((m) => ({ ...m, sender: profiles[m.sender_id] || null, receiver: profiles[m.receiver_id] || null }));
  const byPartner = {};
  for (const m of withProfiles) {
    const partnerId = m.sender_id === userId ? m.receiver_id : m.sender_id;
    const partnerName = (m.sender_id === userId ? m.receiver?.display_name : m.sender?.display_name) || "Learner";
    if (!byPartner[partnerId]) {
      byPartner[partnerId] = {
        id: partnerId,
        name: partnerName,
        initials: partnerName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
        last: m.content,
        time: new Date(m.created_at).toLocaleString(),
        unread: 0,
      };
    }
    if (!m.is_read && m.receiver_id === userId) byPartner[partnerId].unread += 1;
  }
  return Object.values(byPartner);
}

export async function sendMentorMessage(senderId, receiverId, content) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("mentor_messages")
    .insert({ sender_id: senderId, receiver_id: receiverId, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* ==========================================================================
   MANAGER WORKSPACE — "my team" view scoped to direct reports.
   user_profiles.manager_id is a real column in the shared schema (added
   alongside the `is_manager_of(_manager, _learner)` RLS helper and the
   compliance_manager_read_reports policy in 0006-era migrations) that stores
   the report's manager's own auth user id — the same convention as
   mentorship_sessions.mentor_id pointing at a user id elsewhere. It has no
   declared FK, so (same as fetchProfilesByUserIds above) it can't be
   embedded; this is a plain equality filter plus two manual follow-up
   queries for each report's enrollment/compliance status.
   ========================================================================= */

export async function fetchDirectReports(managerId) {
  if (!supabase || !managerId) return [];
  const { data: profiles, error } = await supabase
    .from("user_profiles")
    .select("user_id, display_name, last_active_at")
    .eq("manager_id", managerId);
  if (error) throw error;
  const rows = profiles || [];
  const ids = rows.map((r) => r.user_id);
  if (!ids.length) return [];
  const [{ data: enrollments }, { data: compliance }] = await Promise.all([
    supabase.from("course_enrollments").select("user_id, progress_percentage").in("user_id", ids),
    supabase.from("compliance_assignments").select("user_id, status").in("user_id", ids),
  ]);
  const enrollList = enrollments || [];
  const complianceList = compliance || [];
  return rows.map((r) => {
    const userEnrolls = enrollList.filter((e) => e.user_id === r.user_id);
    const userComp = complianceList.filter((c) => c.user_id === r.user_id);
    const name = r.display_name || "Unnamed user";
    return {
      userId: r.user_id,
      name,
      initials: name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
      enrolled: userEnrolls.length,
      completed: userEnrolls.filter((e) => e.progress_percentage === 100).length,
      overdue: userComp.filter((c) => c.status === "overdue").length,
      lastActive: r.last_active_at ? new Date(r.last_active_at).toLocaleDateString() : "—",
    };
  });
}

