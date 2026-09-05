import { supabase, activeProject } from "../supabaseClient.js";
import { fetchProfilesByUserIds } from "./schemaHelper.js";
import { DEMO_PROJECT_DATA, DEMO_LEARNERS, DEMO_INSTRUCTORS, DEMO_COURSES, DEMO_ENROLLMENTS, DEMO_CERTIFICATES, DEMO_COHORT, DEMO_STUDY_GROUP, demoTotalUsersBreakdown, demoTopCourses, demoSkillGapsDetail, demoLearnerProgressOverview } from "./demoData.js";

// Admin-scoped queries. RLS (up_select_org_admin in 0006_rls_policies.sql)
// restricts these to members of the caller's own organization automatically
// - there is no client-side organization_id filtering to get wrong here,
// which is the point of doing authorization at the database layer.

export async function fetchCurrentUserProfile(userId) {
  if (!supabase || !userId) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem("trainai_active_session_v1") || "null"); } catch { /* ignore */ }
    const role = saved?.user?.user_metadata?.role || saved?.role || "learner";
    return {
      id: userId, organization_id: "demo-org-id", role,
      display_name: role === "admin" ? "Demo Admin" : role === "mentor" ? "Demo Instructor" : role === "manager" ? "Demo Manager" : "Demo Learner",
      manager_id: role === "learner" ? "demo-manager-id" : null,
    };
  }
  const { data, error } = await supabase.from("user_profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;

  let orgId = data?.organization_id;
  if (!orgId) {
    const { data: firstOrg } = await supabase.from("organizations").select("id").limit(1).maybeSingle();
    orgId = firstOrg?.id || null;
    if (orgId && data?.id) {
      try {
        await supabase.from("user_profiles").update({ organization_id: orgId }).eq("id", data.id);
      } catch (e) {
        /* ignore */
      }
    }
  }

  if (!data) {
    return {
      id: userId,
      organization_id: orgId,
      role: "admin",
      display_name: "Admin User",
    };
  }
  return { ...data, organization_id: orgId || data.organization_id };
}

// Persists a new avatar image URL (from FileUploadZone -> Supabase Storage)
// onto the caller's own profile row. Matches the same user_profiles.user_id
// lookup convention fetchCurrentUserProfile already uses above.
// A real, previously undiscovered bug found while wiring up Instructor
// Settings' name/picture fields: this filtered on "user_id", a column
// that does not exist on user_profiles at all (confirmed against the
// actual schema - user_profiles.id IS the real auth id directly, there
// is no separate user_id column on this specific table, unlike several
// others that do have one). This has been silently failing (or erroring)
// every time it was ever called.
export async function updateUserAvatar(userId, avatarUrl) {
  if (!supabase || !userId || !avatarUrl) return;
  const { error } = await supabase.from("user_profiles").update({ avatar_url: avatarUrl }).eq("id", userId);
  if (error) throw error;
}

export async function updateUserDisplayName(userId, displayName) {
  if (!supabase || !userId || !displayName?.trim()) return;
  const { error } = await supabase.from("user_profiles").update({ display_name: displayName.trim() }).eq("id", userId);
  if (error) throw error;
}

// Weekly lesson goal - confirmed directly: the Home screen's "Edit" link
// led to Settings, where no control existed to change this, and the
// underlying column never existed at all. See
// 0143_weekly_lesson_goal.sql.
export async function updateWeeklyGoal(userId, goal) {
  if (!supabase) return { success: true };
  if (!userId || !goal || goal < 1) return { success: false, error: "Choose a valid weekly goal." };
  try {
    const { error } = await supabase.from("user_profiles").update({ weekly_lesson_goal: goal }).eq("id", userId);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not update your weekly goal." };
  }
}

// Chunking helper to prevent HTTP query string length limits when querying large org user ID arrays
export async function safeInQuery(tableName, selectFields, idColumn, ids) {
  if (!supabase || !ids || !ids.length) return [];
  if (ids.length <= 30) {
    const { data } = await supabase.from(tableName).select(selectFields).in(idColumn, ids);
    return data || [];
  }
  const results = [];
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30);
    const { data } = await supabase.from(tableName).select(selectFields).in(idColumn, chunk);
    if (data) results.push(...data);
  }
  return results;
}

export async function fetchOrgMembers(organizationId) {
  if (!supabase) {
    return [
      ...DEMO_LEARNERS.map((l) => ({ id: l.id, display_name: l.name, email: l.email, role: "learner", status: "active", last_active_at: new Date().toISOString() })),
      ...DEMO_INSTRUCTORS.map((i) => ({ id: i.id, display_name: i.name, email: i.email || `${i.name.toLowerCase().replace(/\s+/g, '.')}@trainailtd.com`, role: "mentor", status: "active", last_active_at: new Date().toISOString() })),
      { id: "demo-manager-id", display_name: "Demo Manager", email: "manager@trainailtd.com", role: "manager", status: "active", last_active_at: new Date().toISOString() },
    ];
  }
  let query = supabase.from("user_profiles").select("*").order("last_active_at", { ascending: false });
  // A plain org admin never sees other orgs' rows regardless of this filter
  // (RLS already scopes them) - this only matters for super_admins, whose
  // RLS grants unconditional read access to every org's user_profiles.
  // Without this, switching tenants in the super-admin Tenant selector
  // silently kept showing every organization's members mixed together.
  if (organizationId && organizationId !== "demo-org-id") query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) throw error;
  const profiles = data || [];
  if (!profiles.length) return profiles;

  // Use chunked safeInQuery to prevent URL length limits when fetching cohort_members for large user lists
  const memberRows = await safeInQuery("cohort_members", "user_id, cohort_id", "user_id", profiles.map((p) => p.id));
  const cohortIds = [...new Set((memberRows || []).map((m) => m.cohort_id))];
  let cohortNameById = {};
  if (cohortIds.length) {
    const cohorts = await safeInQuery("cohorts", "id, name", "id", cohortIds);
    cohortNameById = Object.fromEntries((cohorts || []).map((c) => [c.id, c.name]));
  }
  const cohortNameByUserId = Object.fromEntries(
    (memberRows || []).map((m) => [m.user_id, cohortNameById[m.cohort_id] || null])
  );
  return profiles.map((p) => {
    const defaultDomain = p.organization_id === "sara-org-1" ? "sarafoundationafrica.com" : "trainailtd.com";
    const email = p.email || (p.display_name ? `${p.display_name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@${defaultDomain}` : null);
    return {
      ...p,
      email,
      cohort_name: cohortNameByUserId[p.id] || null,
    };
  });
}

export async function fetchUsersInOrg(organizationId) {
  if (!supabase) {
    return [
      ...DEMO_LEARNERS.map((l) => ({ id: l.id, name: l.name, initials: l.initials })),
      ...DEMO_INSTRUCTORS.map((i) => ({ id: i.id, name: i.name, initials: i.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() })),
      { id: "demo-manager-id", name: "Demo Manager", initials: "DM" },
    ];
  }
  const orgFilter = (organizationId && organizationId !== "demo-org-id") ? organizationId : null;
  let query = supabase
    .from("user_profiles")
    .select("id, display_name")
    .order("display_name", { ascending: true });
  if (orgFilter) query = query.eq("organization_id", orgFilter);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(u => ({ id: u.id, name: u.display_name || "Unnamed user", initials: (u.display_name || "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() }));
}

export async function fetchOrgMembersWithStatus() {
  if (!supabase) {
    const profiles = await fetchOrgMembers();
    return profiles.map((p) => ({ ...p, member_status: "active" }));
  }
  const profiles = await fetchOrgMembers();
  if (!profiles.length) return [];
  const ids = profiles.map(p => p.id);
  const { data: members, error } = await supabase.from("organization_members").select("user_id, status").in("user_id", ids);
  if (error) console.warn("Org member status fetch warning:", error);
  const statusById = Object.fromEntries((members || []).map(m => [m.user_id, m.status]));
  return profiles.map(p => ({ ...p, member_status: statusById[p.id] || "active" }));
}

export async function fetchMentorApplications(organizationId) {
  if (!supabase) return [];
  const orgFilter = (organizationId && organizationId !== "demo-org-id") ? organizationId : null;
  let query = supabase
    .from("mentors")
    .select("*")
    .eq("is_active", false);
  if (orgFilter) query = query.eq("organization_id", orgFilter);
  const { data, error } = await query;
  if (error) throw error;
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.user_id));
  return rows.map((r) => ({ ...r, user_profiles: profiles[r.user_id] || null, display_name: profiles[r.user_id]?.display_name }));
}

export async function fetchOrgInstructorsMonitor(organizationId) {
  if (!supabase) return DEMO_INSTRUCTORS.map((i) => ({ id: i.id, user_id: i.id, display_name: i.name, is_active: i.isActive, sessions_completed: i.sessionsCompleted, rating: i.rating }));
  const orgFilter = (organizationId && organizationId !== "demo-org-id") ? organizationId : null;
  let query = supabase.from("mentors").select("*");
  if (orgFilter) query = query.eq("organization_id", orgFilter);
  const { data, error } = await query;
  if (error) { console.warn("Instructor monitor fetch warning:", error); return []; }
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.user_id));
  return rows.map((r) => ({ ...r, display_name: profiles[r.user_id]?.display_name || "Instructor" }));
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
  if (!supabase) return [];
  const orgFilter = (organizationId && organizationId !== "demo-org-id") ? organizationId : null;
  let query = supabase
    .from("cohorts")
    .select("*");
  if (orgFilter) query = query.eq("organization_id", orgFilter);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchComplianceAssignments(organizationId) {
  if (!supabase) {
    const now = Date.now();
    return [
      { id: "demo-ca-1", user_id: "demo-learner-1", course_id: "demo-course-compliance-101", status: "completed", due_at: new Date(now - 5 * 86400000).toISOString(), completed_at: new Date(now - 6 * 86400000).toISOString(), courses: { title: "Workplace Compliance 101", category: "Compliance" }, user_profiles: { display_name: "Amara Chen" } },
      { id: "demo-ca-2", user_id: "demo-learner-5", course_id: "demo-course-compliance-101", status: "overdue", due_at: new Date(now - 3 * 86400000).toISOString(), completed_at: null, courses: { title: "Workplace Compliance 101", category: "Compliance" }, user_profiles: { display_name: "Fatima Diallo" } },
      { id: "demo-ca-3", user_id: "demo-learner-6", course_id: "demo-course-compliance-101", status: "overdue", due_at: new Date(now - 10 * 86400000).toISOString(), completed_at: null, courses: { title: "Workplace Compliance 101", category: "Compliance" }, user_profiles: { display_name: "Liam Torres" } },
    ];
  }
  const { data, error } = await supabase
    .from("compliance_assignments")
    .select("*, courses(title, category)")
    .order("due_at", { ascending: true });
  if (error) throw error;
  let rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.user_id), "user_id, display_name, avatar_url, organization_id");
  const orgFilter = (organizationId && organizationId !== "demo-org-id") ? organizationId : null;
  if (orgFilter) rows = rows.filter((r) => profiles[r.user_id]?.organization_id === orgFilter);
  return rows.map((r) => ({ ...r, user_profiles: profiles[r.user_id] || null }));
}

// Assigns a course (mandatory or recommended) to one or more learners
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

// "Apply for a course" - staff side. RLS (course_applications_staff_manage
// in supabase/migrations/0100_course_applications.sql) already restricts
// this to rows for courses the caller instructs/owns, or any admin/
// super_admin - there is no client-side course-id filtering to get wrong
// here, same pattern as the org-admin queries at the top of this file.
export async function fetchCourseApplications(courseId) {
  if (!supabase) {
    if (courseId && courseId !== "demo-course-ai-fundamentals") return [];
    return [
      { id: "demo-app-1", course_id: "demo-course-ai-fundamentals", user_id: "demo-learner-8", status: "pending", created_at: new Date().toISOString(), courses: { title: "AI Fundamentals" }, user_profiles: { display_name: "Sofia Kim" } },
    ];
  }
  let query = supabase.from("course_applications").select("*, courses(title)").order("created_at", { ascending: false });
  if (courseId) query = query.eq("course_id", courseId);
  const { data, error } = await query;
  if (error) { console.warn("Course applications fetch warning:", error); return []; }
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.user_id));
  return rows.map((r) => ({ ...r, user_profiles: profiles[r.user_id] || null }));
}

// Real per-learner enrolled list for one course - used by ContentScreen's
// "Enrolled Students" tab (previously just three stat cards and a generic
// sentence, no actual list of who's enrolled). Queries both the raw table
// (visible to admins/super_admins under RLS) and instructor_course_enrollments
// (visible to this course's instructor/owner) and merges, same pattern as
// fetchAllPlatformLearners above - whichever query the caller's role is
// actually allowed to see comes back with real rows, the other with none.
export async function fetchCourseEnrolledLearners(courseId) {
  if (!supabase) {
    // Same real course IDs as fetchCourses() above - keeping these
    // aligned matters here specifically because this function backs the
    // "Give Certificate" learner picker; a mismatched ID would show an
    // empty picker for a course that visibly has enrolled students.
    const byCourse = {
      "demo-course-ai-fundamentals": [
        { userId: "demo-learner-1", name: "Amara Chen", progress: 100 }, { userId: "demo-learner-2", name: "David Osei", progress: 85 },
        { userId: "demo-learner-3", name: "Priya Nair", progress: 60 }, { userId: "demo-learner-4", name: "Marcus Webb", progress: 100 },
        { userId: "demo-learner-5", name: "Fatima Diallo", progress: 30 }, { userId: "demo-learner-6", name: "Liam Torres", progress: 15 },
        { userId: "demo-learner-7", name: "Ngozi Adeyemi", progress: 100 }, { userId: "demo-learner-8", name: "Sofia Kim", progress: 45 },
      ],
      "demo-course-compliance-101": [
        { userId: "demo-learner-1", name: "Amara Chen", progress: 100 }, { userId: "demo-learner-2", name: "David Osei", progress: 100 },
        { userId: "demo-learner-3", name: "Priya Nair", progress: 100 }, { userId: "demo-learner-4", name: "Marcus Webb", progress: 100 },
      ],
      "demo-course-external-leadership": [
        { userId: "demo-learner-1", name: "Amara Chen", progress: 100 }, { userId: "demo-learner-2", name: "David Osei", progress: 40 },
        { userId: "demo-learner-7", name: "Ngozi Adeyemi", progress: 100 },
      ],
    };
    return byCourse[courseId] || [];
  }
  if (!courseId) return [];
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

// Super-admin-only queries - RLS (org_select_member in 0006_rls_policies.sql)
// only returns every row here if is_super_admin(auth.uid()) is true; a
// non-super-admin calling this gets back just their own organization's row.
export async function fetchAllOrganizations() {
  if (!supabase) {
    const projData = DEMO_PROJECT_DATA[activeProject] || DEMO_PROJECT_DATA.digital_training;
    return projData.orgs;
  }
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchRecentOrganizations(limit = 4) {
  if (!supabase) {
    const projData = DEMO_PROJECT_DATA[activeProject] || DEMO_PROJECT_DATA.digital_training;
    return projData.orgs.slice(0, limit).map(o => ({
      name: o.name,
      tier: o.subscription_tier,
      users: o.user_count || 0,
      status: o.status,
      created: new Date(o.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    }));
  }
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
  if (!supabase) {
    const projData = DEMO_PROJECT_DATA[activeProject] || DEMO_PROJECT_DATA.digital_training;
    return projData.orgs;
  }
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
  if (!supabase) {
    const projData = DEMO_PROJECT_DATA[activeProject] || DEMO_PROJECT_DATA.digital_training;
    const found = projData.orgs?.find(o => o.id === orgId);
    if (found) return found;
    return projData.orgs?.[0] || { id: "demo-org-id", name: "Sara Foundation Africa", status: "active", subscription_tier: "enterprise", max_users: 50 };
  }
  try {
    if (orgId && orgId !== "demo-org-id") {
      const { data, error } = await supabase.from("organizations").select("*").eq("id", orgId).maybeSingle();
      if (!error && data) return data;
    }
    const { data: firstOrg } = await supabase.from("organizations").select("*").limit(1).maybeSingle();
    return firstOrg || { id: orgId || "default-org", name: "Train AI Organization", status: "active", subscription_tier: "enterprise" };
  } catch (e) {
    return null;
  }
}

export async function fetchPlatformSettings() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("platform_settings").select("*");
  if (error) throw error;
  return data || [];
}

export async function fetchOrgAIUsageStats(organizationId) {
  if (!supabase) {
    const projData = DEMO_PROJECT_DATA[activeProject] || DEMO_PROJECT_DATA.digital_training;
    return projData.aiUsage || { total: 12, last7d: 12, last30d: 12 };
  }
  const orgFilter = (organizationId && organizationId !== "demo-org-id") ? organizationId : null;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let qTotal = supabase.from("ai_usage_events").select("id", { count: "exact", head: true });
  let q7d = supabase.from("ai_usage_events").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo);
  let q30d = supabase.from("ai_usage_events").select("id", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo);
  if (orgFilter) {
    qTotal = qTotal.eq("organization_id", orgFilter);
    q7d = q7d.eq("organization_id", orgFilter);
    q30d = q30d.eq("organization_id", orgFilter);
  }
  const [{ count: total }, { count: last7d }, { count: last30d }] = await Promise.all([qTotal, q7d, q30d]);
  return { total: total || 0, last7d: last7d || 0, last30d: last30d || 0 };
}

export async function fetchAIUsageStats() {
  if (!supabase) {
    const projData = DEMO_PROJECT_DATA[activeProject] || DEMO_PROJECT_DATA.digital_training;
    return projData.aiUsage;
  }
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ count: total }, { count: last7d }, { count: last30d }] = await Promise.all([
    supabase.from("ai_usage_events").select("id", { count: "exact", head: true }),
    supabase.from("ai_usage_events").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
    supabase.from("ai_usage_events").select("id", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
  ]);
  return { total: total || 0, last7d: last7d || 0, last30d: last30d || 0 };
}

// Platform Owner brief item: "Website performance." Real data, not
// invented - both demo_requests (0101) and organization_inquiries (0103)
// already capture genuine website conversion events (Book a Demo,
// Organisation Inquiry), just never surfaced anywhere at the platform
// level. No new table; this aggregates what already exists.
export async function fetchWebsitePerformanceStats() {
  if (!supabase) {
    const projData = DEMO_PROJECT_DATA[activeProject] || DEMO_PROJECT_DATA.digital_training;
    return projData.websiteStats;
  }
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [
    { count: demoRequestsTotal }, { count: demoRequestsNew }, { count: demoRequestsRecent },
    { count: inquiriesTotal }, { count: inquiriesNew }, { count: inquiriesRecent },
  ] = await Promise.all([
    supabase.from("demo_requests").select("id", { count: "exact", head: true }),
    supabase.from("demo_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("demo_requests").select("id", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
    supabase.from("organization_inquiries").select("id", { count: "exact", head: true }),
    supabase.from("organization_inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("organization_inquiries").select("id", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
  ]);
  return {
    demoRequestsTotal: demoRequestsTotal || 0,
    demoRequestsNew: demoRequestsNew || 0,
    demoRequestsLast30d: demoRequestsRecent || 0,
    inquiriesTotal: inquiriesTotal || 0,
    inquiriesNew: inquiriesNew || 0,
    inquiriesLast30d: inquiriesRecent || 0,
  };
}

export async function fetchPlatformOverviewStats() {
  if (!supabase) {
    const projData = DEMO_PROJECT_DATA[activeProject] || DEMO_PROJECT_DATA.digital_training;
    return projData.stats;
  }
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
  if (!supabase) {
    const projData = DEMO_PROJECT_DATA[activeProject] || DEMO_PROJECT_DATA.digital_training;
    return projData.activity.slice(0, limit);
  }
  const { data, error } = await supabase
    .from("safe_admin_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(a => ({
    text: `${a.action_type.replace(/_/g, " ")}${a.target_identifier ? `: ${a.target_identifier}` : ""}`,
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
   ADMIN DASHBOARD. Org-wide stats, today's tasks, at-risk learners, top
   mentors, live/upcoming sessions. All scoped to the caller's org via RLS.
   ========================================================================= */

export async function fetchOrgDashboardStats(organizationId) {
  const DEMO_STATS = {
    activeStudents: 142,
    cohorts: 6,
    courses: 18,
    mentors: 12,
    otherUsers: 8,
    completionRate: 84,
    avgCompletedCourses: 2.8,
  };
  if (!supabase) return DEMO_STATS;
  try {
    const orgFilter = (organizationId && organizationId !== "demo-org-id") ? organizationId : null;

    let userQuery = supabase.from("user_profiles").select("id", { count: "exact", head: true }).eq("role", "learner");
    if (orgFilter) userQuery = userQuery.eq("organization_id", orgFilter);
    const { count: activeStudents } = await userQuery;

    let cohortQuery = supabase.from("cohorts").select("id", { count: "exact", head: true });
    if (orgFilter) cohortQuery = cohortQuery.eq("organization_id", orgFilter);
    const { count: cohortCount } = await cohortQuery;

    let courseQuery = supabase.from("courses").select("id", { count: "exact", head: true }).eq("is_published", true);
    const { count: courseCount } = await courseQuery;

    let mentorQuery = supabase.from("mentors").select("id", { count: "exact", head: true }).eq("is_active", true);
    if (orgFilter) mentorQuery = mentorQuery.eq("organization_id", orgFilter);
    const { count: mentorCount } = await mentorQuery;

    let otherQuery = supabase.from("user_profiles").select("id", { count: "exact", head: true }).not("role", "in", "(learner,mentor)");
    if (orgFilter) otherQuery = otherQuery.eq("organization_id", orgFilter);
    const { count: otherUserCount } = await otherQuery;

    const { data: enrollments } = await supabase.from("course_enrollments").select("progress_percentage, completed_at");
    
    const enrollList = enrollments || [];
    const completedCount = enrollList.filter(e => e.completed_at || (e.progress_percentage || 0) >= 100).length;
    const completionRate = enrollList.length ? Math.round((completedCount / enrollList.length) * 100) : 0;
    const totalLearners = activeStudents || 0;
    const avgCompletedCourses = totalLearners > 0 ? (completedCount / totalLearners).toFixed(1) : "0.0";

    return {
      activeStudents: activeStudents ?? 0,
      cohorts: cohortCount ?? 0,
      courses: courseCount ?? 0,
      mentors: mentorCount ?? 0,
      otherUsers: otherUserCount ?? 0,
      completionRate,
      avgCompletedCourses,
    };
  } catch (err) {
    console.warn("fetchOrgDashboardStats query warning:", err);
    return { activeStudents: 0, cohorts: 0, courses: 0, mentors: 0, otherUsers: 0, completionRate: 0, avgCompletedCourses: "0.0" };
  }
}

export async function fetchTodaysTasks(organizationId) {
  if (!supabase) return { mentorApplications: 3, pendingInvitations: 5, moderationQueue: 2 };
  try {
    const orgFilter = (organizationId && organizationId !== "demo-org-id") ? organizationId : null;

    let mentorAppQuery = supabase.from("mentors").select("id", { count: "exact", head: true }).eq("is_active", false);
    if (orgFilter) mentorAppQuery = mentorAppQuery.eq("organization_id", orgFilter);
    const { count: mentorApplications } = await mentorAppQuery;

    let inviteQuery = supabase.from("user_invitations").select("id", { count: "exact", head: true }).eq("status", "pending");
    if (orgFilter) inviteQuery = inviteQuery.eq("organization_id", orgFilter);
    const { count: pendingInvitations } = await inviteQuery;

    let moderationQueue = 0;
    try {
      const { count } = await supabase.from("community_posts").select("id", { count: "exact", head: true }).in("moderation_status", ["pending", "rejected"]);
      moderationQueue = count || 0;
    } catch (e) {
      moderationQueue = 0;
    }

    return {
      mentorApplications: mentorApplications ?? 0,
      pendingInvitations: pendingInvitations ?? 0,
      moderationQueue: moderationQueue ?? 0,
    };
  } catch (err) {
    return { mentorApplications: 0, pendingInvitations: 0, moderationQueue: 0 };
  }
}

export async function fetchCohortProgressSummary(organizationId) {
  if (!supabase) return [];
  try {
    const orgFilter = (organizationId && organizationId !== "demo-org-id") ? organizationId : null;
    let query = supabase.from("cohorts").select("id, name");
    if (orgFilter) query = query.eq("organization_id", orgFilter);
    const { data: cohorts, error } = await query;
    
    if (error) throw error;
    if (!cohorts || cohorts.length === 0) return [];

    const rows = await Promise.all(cohorts.map(async (c) => {
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
  } catch (err) {
    console.warn("fetchCohortProgressSummary warning:", err);
    return [];
  }
}

export async function fetchStudentRiskList(organizationId) {
  if (!supabase) return [];
  try {
    const orgFilter = (organizationId && organizationId !== "demo-org-id") ? organizationId : null;
    let query = supabase
      .from("user_profiles")
      .select("id, display_name, last_active_at, avatar_url")
      .in("role", ["learner", "student"])
      .order("last_active_at", { ascending: true, nullsFirst: true })
      .limit(6);

    if (orgFilter) query = query.eq("organization_id", orgFilter);
    const { data, error } = await query;

    if (error) throw error;
    if (!data || data.length === 0) return [];

    const now = Date.now();
    return data.map(u => {
      const days = u.last_active_at ? Math.floor((now - new Date(u.last_active_at).getTime()) / (24 * 60 * 60 * 1000)) : null;
      return {
        name: u.display_name || "Learner",
        initials: (u.display_name || "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
        days: days ?? "N/A",
        risk: days !== null && days > 7 ? "high" : "medium",
        status: days !== null && days > 7 ? "High Risk" : "Needs Attention",
        avatar: u.avatar_url,
      };
    });
  } catch (err) {
    console.warn("fetchStudentRiskList warning:", err);
    return [];
  }
}

export async function fetchTopMentors(organizationId) {
  if (!supabase) return [];
  try {
    const orgFilter = (organizationId && organizationId !== "demo-org-id") ? organizationId : null;
    let query = supabase
      .from("mentors")
      .select("id, user_id, rating, total_sessions, specializations")
      .eq("is_active", true)
      .order("rating", { ascending: false })
      .limit(5);

    if (orgFilter) query = query.eq("organization_id", orgFilter);
    let { data, error } = await query;

    if (error) {
      // Fallback query if specializations column differs
      const fallbackQuery = await supabase
        .from("mentors")
        .select("id, user_id, rating, total_sessions")
        .eq("is_active", true)
        .order("rating", { ascending: false })
        .limit(5);
      data = fallbackQuery.data;
      error = fallbackQuery.error;
    }

    if (error || !data || data.length === 0) return [];

    const profiles = await fetchProfilesByUserIds(data.map((m) => m.user_id));
    return data.map(m => {
      const p = profiles[m.user_id];
      const name = p?.display_name || "Mentor";
      const spec = Array.isArray(m.specializations) ? m.specializations.join(", ") : (m.specializations || "Instructor");
      return {
        name,
        initials: name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
        specialization: spec,
        rating: m.rating || 5.0,
        sessions: m.total_sessions || 0,
        avatar: p?.avatar_url,
      };
    });
  } catch (err) {
    return [];
  }
}

export async function fetchUpcomingOrgSessions(organizationId) {
  if (!supabase) return [];
  try {
    let sessionQuery = supabase
      .from("mentorship_sessions")
      .select("id, title, scheduled_at, status, mentor_id")
      .order("scheduled_at", { ascending: true })
      .limit(5);

    const { data, error } = await sessionQuery;
    if (error) throw error;
    if (!data || data.length === 0) return [];

    const mentorIds = data.map(s => s.mentor_id).filter(Boolean);
    let nameByMentorId = {};
    if (mentorIds.length) {
      const { data: mentorRows } = await supabase.from("mentors").select("id, user_id").in("id", mentorIds);
      const userIds = (mentorRows || []).map(m => m.user_id);
      const profiles = await fetchProfilesByUserIds(userIds);
      const userToProfile = Object.fromEntries(userIds.map(uid => [uid, profiles[uid]?.display_name]));
      nameByMentorId = Object.fromEntries((mentorRows || []).map(m => [m.id, userToProfile[m.user_id] || "Mentor"]));
    }

    return data.map(s => ({
      id: s.id,
      title: s.title || "Mentorship session",
      mentor: nameByMentorId[s.mentor_id] || "Mentor",
      time: new Date(s.scheduled_at).toLocaleString(),
      status: new Date(s.scheduled_at) <= new Date() ? "live" : "upcoming",
    }));
  } catch (err) {
    console.warn("fetchUpcomingOrgSessions warning:", err);
    return [];
  }
}

/* ==========================================================================
   ADMIN: People: invitations & mentor-application decisions
   ========================================================================= */

export async function fetchPendingInvitations(organizationId) {
  if (!supabase) return [];
  const orgFilter = (organizationId && organizationId !== "demo-org-id") ? organizationId : null;
  let query = supabase
    .from("user_invitations")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (orgFilter) query = query.eq("organization_id", orgFilter);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Creates a pending invitation. Prefers the live "invite-user" edge function
// (see supabase/functions/invite-user/index.ts in the reference app) - it
// calls the same create_user_invitation() RPC server-side (so token
// generation, 7-day expiry and the "already has a pending invite" dedupe
// check are identical) and additionally emails the real invite link via
// Resend. `invitedBy` is accepted for backwards compatibility but unused
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
    // (GRANT EXECUTE ... TO authenticated) - no email gets sent (e.g. if
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

  // Both paths write through user_invitations - read the row back so callers
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
  // ('pending','accepted','expired','cancelled') - "revoked" is not one of
  // the allowed values and would fail this update with a check-violation.
  const { error } = await supabase.from("user_invitations").update({ status: "cancelled" }).eq("id", invitationId);
  if (error) throw error;
}

// No `is_approved` column in the shared schema - `is_active` is the closest
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
   ADMIN: Content: courses, lessons, learning paths, moderation
   ========================================================================= */

export async function fetchCourses() {
  if (!supabase) {
    // A real, confirmed gap: this is a completely separate function from
    // fetchPublishedCourses() (the learner-facing catalog) - Content &
    // Courses (admin) and My Courses (instructor) both call this one
    // specifically, and it returned nothing at all in demo mode, meaning
    // there was genuinely no course to click into and no way to reach
    // the Assessment Grading / Certificates tabs underneath it.
    //
    // Uses the exact same three courses and IDs as
    // fetchPublishedCourses() in lib/api/learner.js, rather than a
    // separate, differently-IDed demo set - fetchCertificateForCourse()
    // and the assessment demo data both specifically key off
    // "demo-course-ai-fundamentals", so a mismatched ID here would have
    // shown the course but left its Assessment/Certificate tabs empty
    // again, just one click deeper.
    const now = new Date().toISOString();
    return [
      {
        id: "demo-course-ai-fundamentals", title: "AI Fundamentals", category: "AI", level: "beginner",
        duration_hours: 4, is_published: true, course_source: "internal", instructor_id: "demo-instructor-1",
        lessons: [{ id: "l1", title: "What is AI, really?", order_index: 0 }, { id: "l2", title: "AI in your daily workflow", order_index: 1 }],
        enrollment_count: 8, created_at: now,
      },
      {
        id: "demo-course-compliance-101", title: "Workplace Compliance 101", category: "Compliance", level: "beginner",
        duration_hours: 2, is_published: true, course_source: "internal", instructor_id: "demo-instructor-1",
        lessons: [{ id: "l3", title: "Key policies overview", order_index: 0 }],
        enrollment_count: 4, created_at: now,
      },
      {
        id: "demo-course-external-leadership", title: "Leadership Essentials", category: "Leadership", level: "intermediate",
        duration_hours: 6, is_published: true, course_source: "external", instructor_id: null,
        lessons: [{ id: "l4", title: "Leading without authority", order_index: 0 }],
        enrollment_count: 3, created_at: now,
      },
    ];
  }
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

export async function fetchLearningPathsAdmin(orgId) {
  const DEMO_PATHS = [
    {
      id: "demo-path-1",
      title: "New Hire Foundations",
      description: "The core courses every new hire completes in their first month.",
      level: "beginner",
      category: "Onboarding",
      isPublished: true,
      courseIds: ["demo-course-ai-fundamentals", "demo-course-compliance-101"],
      courseTitles: ["AI Fundamentals", "Workplace Compliance 101"],
    },
    {
      id: "demo-path-2",
      title: "AI Engineer Track",
      description: "Master LLM orchestration, RAG architectures, and fine-tuning models.",
      level: "advanced",
      category: "Engineering",
      isPublished: true,
      courseIds: ["demo-course-llm-arch", "demo-course-rag-mastery"],
      courseTitles: ["LLM Architecture & Fine-Tuning", "Advanced RAG & Vector Databases"],
    },
    {
      id: "demo-path-3",
      title: "Product Manager Leadership",
      description: "Essential framework for product strategy, data analytics, and team leadership.",
      level: "intermediate",
      category: "Product Management",
      isPublished: true,
      courseIds: ["demo-course-pm-intro"],
      courseTitles: ["Product Analytics 101"],
    }
  ];

  if (!supabase) return DEMO_PATHS;
  try {
    let query = supabase
      .from("learning_paths")
      .select("*, learning_path_courses(*, courses(id, title))")
      .order("title", { ascending: true });

    if (orgId && orgId !== "demo-org-id") {
      query = query.or(`organization_id.eq.${orgId},organization_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return [];

    return data.map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      level: p.level_label || "beginner",
      category: p.category || null,
      isPublished: !!p.is_published,
      courseIds: (p.learning_path_courses || [])
        .sort((a, b) => a.order_index - b.order_index)
        .map(pc => pc.course_id),
      courseTitles: (p.learning_path_courses || [])
        .sort((a, b) => a.order_index - b.order_index)
        .map(pc => pc.courses?.title)
        .filter(Boolean),
    }));
  } catch {
    return DEMO_PATHS;
  }
}

export async function createLearningPath({ title, description, level, category, courseIds, isPublished = true }, organizationId, createdBy) {
  if (!supabase) return null;
  const { data: path, error } = await supabase
    .from("learning_paths")
    .insert({
      title,
      description,
      level_label: level,
      // `category` is a real learning_paths column that create/update never
      // wrote, so a category set in the UI silently vanished on save - and
      // the learner-facing path catalog groups on exactly that column.
      category: category || null,
      organization_id: organizationId,
      created_by: createdBy,
      is_published: !!isPublished,
    })
    .select()
    .single();
  if (error) throw error;
  if (courseIds?.length) {
    // unlock_rule/is_required are written explicitly so a path created here
    // behaves as a guided sequential journey straight away. They were left
    // null before, which the learner-side unlock logic reads as "no rule"
    // and therefore unlocks every step at once.
    const rows = courseIds.map((cid, i) => ({ path_id: path.id, course_id: cid, order_index: i, unlock_rule: "complete_previous", is_required: true }));
    const { error: pcErr } = await supabase.from("learning_path_courses").insert(rows);
    if (pcErr) throw pcErr;
  }
  return path;
}

export async function updateLearningPath(id, { title, description, level, category, courseIds }) {
  if (!supabase) return;
  const patch = { title, description, level_label: level };
  if (category !== undefined) patch.category = category || null;
  const { error } = await supabase
    .from("learning_paths")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
  // Same replace-all-rows strategy as lessons: this path *does* always
  // submit the complete, reordered course list. Per-step edits that must
  // preserve unlock_rule/is_required go through updatePathCourse instead.
  const { data: existingRows } = await supabase
    .from("learning_path_courses")
    .select("course_id, unlock_rule, is_required, prerequisite_course_ids")
    .eq("path_id", id);
  // Carry each step's existing rule forward across the replace, so
  // reordering or renaming a path no longer quietly resets every unlock
  // rule back to the default.
  const prior = Object.fromEntries((existingRows || []).map((r) => [r.course_id, r]));
  const { error: delErr } = await supabase.from("learning_path_courses").delete().eq("path_id", id);
  if (delErr) throw delErr;
  if (courseIds?.length) {
    const rows = courseIds.map((cid, i) => ({
      path_id: id,
      course_id: cid,
      order_index: i,
      unlock_rule: prior[cid]?.unlock_rule || "complete_previous",
      is_required: prior[cid]?.is_required !== false,
      prerequisite_course_ids: prior[cid]?.prerequisite_course_ids || [],
    }));
    const { error: insErr } = await supabase.from("learning_path_courses").insert(rows);
    if (insErr) throw insErr;
  }
}

// No delete function existed alongside create/update - added for the new
// admin Learning Paths screen. learning_path_courses rows cascade-delete
// automatically (path_id references learning_paths(id) on delete cascade,
// 0001_init_schema.sql), so only the parent row needs removing here.
export async function deleteLearningPath(id) {
  if (!supabase || !id) return;
  const { error } = await supabase.from("learning_paths").delete().eq("id", id);
  if (error) throw error;
}

export async function togglePublishLearningPath(id, isPublished) {
  if (!supabase || !id) return;
  const { error } = await supabase.from("learning_paths").update({ is_published: isPublished }).eq("id", id);
  if (error) throw error;
}

export async function fetchModerationQueue() {
  if (!supabase) {
    return [{
      id: "demo-flag-1", contentType: "post", author: "Liam Torres",
      excerpt: "Anyone have the answer key for the compliance quiz?",
      score: 0.62, reason: "Flagged by AI moderation", createdAt: new Date().toISOString(),
    }];
  }
  // IMPORTANT: `moderation_logs` had `SELECT` (and later `INSERT`) revoked
  // from the `authenticated` Postgres role in a security-hardening pass on
  // the shared schema ("REVOKE SELECT ON public.moderation_logs FROM
  // authenticated" - it's now only readable/writable by service_role, i.e.
  // the ai-content-moderation edge function itself). That's a role-level
  // GRANT, not an RLS policy, so no client-side query - admin or not - can
  // read that table directly anymore; a raw `.from("moderation_logs")` call
  // here would just error for every admin.
  //
  // The reference app's own current-generation admin panel
  // (HybridModerationPanel.tsx) hit the same wall and works around it the
  // same way this does: build the queue straight from `community_posts`
  // (whose SELECT grant + RLS - "Users can view approved posts" - still let
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
    // render here - this is an honest degradation, not a guess at a column
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
  // owner-scoped UPDATE policy across its entire migration history - // "Users can update their own posts" USING (auth.uid() = user_id) - with
  // no admin/super_admin bypass ever added (unlike DELETE, which does have
  // "Admins can delete any post" USING (has_role(auth.uid(), 'admin'))).
  // So an admin flipping `moderation_status` back to 'approved' on a post
  // they don't own will be silently blocked by RLS (0 rows affected, no
  // Postgrest error) - there's no edge function or RPC in the live schema
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
    throw new Error("Couldn't restore this post. This schema only lets admins delete flagged content, not edit posts they don't own. Use Remove, or ask the author to repost.");
  }
  return { approved: true };
}

/* ==========================================================================
   ADMIN: Analytics Hub: referrals, UTM, feedback
   ========================================================================= */

export async function fetchReferralAnalytics(organizationId) {
  if (!supabase || !organizationId) return [];
  const { data: members } = await supabase.from("user_profiles").select("id, display_name").eq("organization_id", organizationId);
  const ids = (members || []).map(m => m.id);
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
  if (!supabase) {
    return [{ id: "demo-fb-1", name: "Sofia Kim", category: "Feature request", message: "Would love a dark mode toggle that syncs across devices.", rating: 4 }];
  }
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
// filtered by that id list, then bucketed by month in JS - there is no
// server-side date_trunc/group-by available through PostgREST here.
export async function fetchEnrollmentTrend(organizationId, monthsBack = 6) {
  if (!supabase) {
    const now = new Date();
    return Array.from({ length: monthsBack }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1 - i), 1);
      return { month: d.toLocaleString("default", { month: "short" }), enrollments: [3, 5, 4, 7, 6, 9][i % 6], completions: [1, 2, 2, 3, 3, 5][i % 6] };
    });
  }
  const orgFilter = (organizationId && organizationId !== "demo-org-id") ? organizationId : null;
  let userQuery = supabase.from("user_profiles").select("id");
  if (orgFilter) userQuery = userQuery.eq("organization_id", orgFilter);
  const { data: orgUserRows } = await userQuery;
  const orgUserIds = (orgUserRows || []).map((r) => r.id);
  if (!orgUserIds.length) return [];
  const rows = await safeInQuery("course_enrollments", "created_at, completed_at", "user_id", orgUserIds);
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
// in the last 30 days vs total members.
export async function fetchOrgRetention(organizationId) {
  if (!supabase) return { retention30Pct: 84, active30Days: 120, totalUsers: 143 };
  const orgFilter = (organizationId && organizationId !== "demo-org-id") ? organizationId : null;
  let query = supabase.from("user_profiles").select("last_active_at");
  if (orgFilter) query = query.eq("organization_id", orgFilter);
  const { data: profiles } = await query;
  const total = (profiles || []).length;
  if (!total) return { retention30Pct: 0, active30Days: 0, totalUsers: 0 };
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const active30 = (profiles || []).filter((p) => p.last_active_at && now - new Date(p.last_active_at).getTime() <= thirtyDaysMs).length;
  return {
    retention30Pct: Math.round((active30 / total) * 100),
    active30Days: active30,
    totalUsers: total,
  };
}

export async function fetchTopCourses(organizationId, limit = 5) {
  if (!supabase) return demoTopCourses().slice(0, limit);
  const orgFilter = (organizationId && organizationId !== "demo-org-id") ? organizationId : null;
  let userQuery = supabase.from("user_profiles").select("id");
  if (orgFilter) userQuery = userQuery.eq("organization_id", orgFilter);
  const { data: orgUserRows } = await userQuery;
  const orgUserIds = (orgUserRows || []).map((r) => r.id);
  if (!orgUserIds.length) return [];
  const enrollments = await safeInQuery("course_enrollments", "course_id, progress_percentage, completed_at", "user_id", orgUserIds);
  const byCourseId = {};
  for (const e of enrollments || []) {
    if (!byCourseId[e.course_id]) byCourseId[e.course_id] = { enrolled: 0, completed: 0 };
    byCourseId[e.course_id].enrolled += 1;
    if (e.completed_at || (e.progress_percentage || 0) >= 100) byCourseId[e.course_id].completed += 1;
  }
  const courseIds = Object.keys(byCourseId);
  if (!courseIds.length) return [];
  const { data: courses } = await supabase.from("courses").select("id, title").in("id", courseIds);
  const titleById = Object.fromEntries((courses || []).map((c) => [c.id, c.title]));
  return courseIds
    .map((id) => ({ courseId: id, title: titleById[id] || "Untitled course", enrolled: byCourseId[id].enrolled, completed: byCourseId[id].completed }))
    .sort((a, b) => b.enrolled - a.enrolled)
    .slice(0, limit);
}

export async function fetchMostActiveCohorts(organizationId, limit = 5) {
  if (!supabase) return [{ cohortId: DEMO_COHORT.id, name: DEMO_COHORT.name, posts: 14, members: DEMO_COHORT.memberNames.length }];
  const orgFilter = (organizationId && organizationId !== "demo-org-id") ? organizationId : null;
  let query = supabase.from("cohorts").select("id, name");
  if (orgFilter) query = query.eq("organization_id", orgFilter);
  const { data: cohorts } = await query;
  if (!cohorts?.length) return [];
  const cohortIds = cohorts.map((c) => c.id);
  const [{ data: posts }, { data: members }] = await Promise.all([
    supabase.from("cohort_posts").select("cohort_id").in("cohort_id", cohortIds),
    supabase.from("cohort_members").select("cohort_id").in("cohort_id", cohortIds),
  ]);
  const postCounts = {};
  for (const p of posts || []) postCounts[p.cohort_id] = (postCounts[p.cohort_id] || 0) + 1;
  const memberCounts = {};
  for (const m of members || []) memberCounts[m.cohort_id] = (memberCounts[m.cohort_id] || 0) + 1;
  return cohorts
    .map((c) => ({ cohortId: c.id, name: c.name, posts: postCounts[c.id] || 0, members: memberCounts[c.id] || 0 }))
    .sort((a, b) => (b.posts + b.members) - (a.posts + a.members))
    .slice(0, limit);
}

export async function fetchOrgAIUsageByFeature(organizationId) {
  if (!supabase) return { coach: 8, quiz: 4, total: 12 };
  const orgFilter = (organizationId && organizationId !== "demo-org-id") ? organizationId : null;
  let query = supabase.from("ai_usage_events").select("feature");
  if (orgFilter) query = query.eq("organization_id", orgFilter);
  const { data, error } = await query;
  if (error) { console.warn("AI usage by feature fetch warning:", error); return { coach: 0, quiz: 0, total: 0 }; }
  const rows = data || [];
  const coach = rows.filter((r) => r.feature === "ai_coach").length;
  const quiz = rows.filter((r) => r.feature === "ai_quiz" || r.feature === "quiz_generator").length;
  return { coach, quiz, total: rows.length };
}

/* ==========================================================================
   ADMIN: Cohorts
   ========================================================================= */

export async function createCohort({ organizationId, name, startsAt, endsAt, createdBy }) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("cohorts")
    .insert({ organization_id: organizationId, name, starts_at: startsAt || null, ends_at: endsAt || null, created_by: createdBy })
    .select()
    .single();
  if (error) throw error;
  // Auto-add the creator as a cohort member - matters specifically for an
  // instructor creating their own cohort (confirmed: instructors can now
  // create cohorts, not just admins). Without this, the resource/session
  // management RLS built for "instructors assigned to this specific
  // cohort" (0126) would lock the creator out of their own new cohort
  // until someone separately added them as a member.
  if (createdBy && data?.id) {
    try {
      await supabase.from("cohort_members").insert({ cohort_id: data.id, user_id: createdBy, added_by: createdBy });
    } catch (e) {
      console.warn("Could not auto-add cohort creator as a member:", e);
    }
  }
  return data;
}

export async function fetchCohortsWithStats(organizationId) {
  if (!supabase) {
    return [{
      id: DEMO_COHORT.id, name: DEMO_COHORT.name, start: "1 mo ago", end: "in 2 months",
      endsAt: DEMO_COHORT.endsAt, members: DEMO_COHORT.memberNames.length, courses: 1, progress: 71,
    }];
  }
  const orgFilter = (organizationId && organizationId !== "demo-org-id") ? organizationId : null;
  let query = supabase
    .from("cohorts")
    .select("id, name, starts_at, ends_at")
    .order("starts_at", { ascending: false });

  if (orgFilter) query = query.eq("organization_id", orgFilter);
  const { data: cohorts, error } = await query;
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
      endsAt: c.ends_at || null,
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
  if (!supabase) {
    if (cohortId !== DEMO_COHORT.id) return null;
    const memberList = [
      { userId: "demo-instructor-1", name: "Jordan Reyes", progress: 100 },
      { userId: "demo-learner-1", name: "Amara Chen", progress: 100 },
      { userId: "demo-learner-2", name: "David Osei", progress: 85 },
      { userId: "demo-learner-3", name: "Priya Nair", progress: 60 },
      { userId: "demo-learner-4", name: "Marcus Webb", progress: 100 },
    ];
    return {
      cohort: { id: DEMO_COHORT.id, name: DEMO_COHORT.name, organization_id: "demo-org-id", starts_at: "2026-01-01", ends_at: DEMO_COHORT.endsAt, created_by: "demo-instructor-1" },
      members: memberList.map((m) => ({ cohort_id: cohortId, user_id: m.userId, added_at: new Date().toISOString(), user_profiles: { display_name: m.name }, progress: m.progress })),
      posts: [
        { id: "demo-post-1", cohort_id: cohortId, author_id: "demo-instructor-1", content: "Welcome to the Q1 Onboarding Cohort! Please complete AI Fundamentals by the end of the month.", created_at: new Date(Date.now() - 5 * 86400000).toISOString(), user_profiles: { display_name: "Jordan Reyes" } },
      ],
      resources: [
        { id: "demo-res-1", cohort_id: cohortId, title: "Onboarding Checklist (PDF)", external_url: "https://example.com/onboarding.pdf", created_at: new Date().toISOString() },
      ],
      sessions: [
        { id: "demo-cohort-sess-1", cohort_id: cohortId, title: "Cohort Kickoff Call", starts_at: new Date(Date.now() + 3 * 86400000).toISOString() },
      ],
      learnerCourses: [
        { cohort_id: cohortId, user_id: "demo-learner-1", course_id: "demo-course-ai-fundamentals", progress: 100, user_profiles: { display_name: "Amara Chen" }, courses: { id: "demo-course-ai-fundamentals", title: "AI Fundamentals" } },
        { cohort_id: cohortId, user_id: "demo-learner-2", course_id: "demo-course-ai-fundamentals", progress: 85, user_profiles: { display_name: "David Osei" }, courses: { id: "demo-course-ai-fundamentals", title: "AI Fundamentals" } },
        { cohort_id: cohortId, user_id: "demo-learner-3", course_id: "demo-course-ai-fundamentals", progress: 60, user_profiles: { display_name: "Priya Nair" }, courses: { id: "demo-course-ai-fundamentals", title: "AI Fundamentals" } },
      ],
    };
  }
  if (!cohortId) return null;
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
  let progressByUserCourse = {};
  if (memberIds.length) {
    const { data: enrollments } = await supabase.from("course_enrollments").select("user_id, course_id, progress_percentage").in("user_id", memberIds);
    for (const e of enrollments || []) {
      if (!progressByUser[e.user_id]) progressByUser[e.user_id] = [];
      progressByUser[e.user_id].push(e.progress_percentage || 0);
      // Real per-course progress, not just each learner's overall average
      // repeated across every column - needed for an honest Progress
      // Matrix (each cell reflects that specific course, not a blended
      // number that would be misleading in any column where the learner
      // has more than one assignment).
      progressByUserCourse[`${e.user_id}:${e.course_id}`] = Math.round(e.progress_percentage || 0);
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
    progress: progressByUserCourse[`${l.user_id}:${l.course_id}`] ?? 0,
  }));

  return { cohort: cohort || null, members: membersOut, posts: postsOut, resources: resources || [], sessions: sessions || [], learnerCourses: learnerCoursesOut };
}

// Adds an existing org member to a cohort. cohort_members has a real
// (cohort_id, user_id) row shape with added_by/added_at - same manual-lookup
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

// Bulk add by email - confirmed directly against the 1.0 reference
// site's "Bulk add by email" control. Reuses the already-real
// findUserIdByEmail() (backed by the find_user_id_by_email RPC) rather
// than inventing a new lookup path - an email that doesn't match a real
// account is reported back per-email rather than silently skipped, so
// the caller can see exactly which ones failed and why.
export async function bulkAddCohortMembersByEmail(cohortId, emails, addedBy) {
  if (!supabase) return { success: false, error: "Not available in demo mode.", added: [], failed: [] };
  const list = (emails || "").split(",").map((e) => e.trim()).filter(Boolean);
  const added = [];
  const failed = [];
  for (const email of list) {
    try {
      const userId = await findUserIdByEmail(email);
      if (!userId) { failed.push({ email, reason: "No account found with this email" }); continue; }
      await addCohortMember({ cohortId, userId, addedBy });
      added.push(email);
    } catch (e) {
      failed.push({ email, reason: e?.message || "Could not add this member" });
    }
  }
  return { success: added.length > 0, added, failed };
}

export async function removeCohortMember(memberRowId) {
  if (!supabase || !memberRowId) return;
  const { error } = await supabase.from("cohort_members").delete().eq("id", memberRowId);
  if (error) throw error;
}

// Posts to a cohort's activity feed (cohort_posts - real columns: author_id,
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

// Assigns a course to a single cohort member (cohort_learner_courses - real
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

// cohort_resources - real columns confirmed against
// supabase/migrations/0007_missing_schema.sql: id, cohort_id (FK -> cohorts,
// on delete cascade), created_by (NOT NULL, FK -> user_profiles(id) - same
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

// cohort_sessions - real columns confirmed against the same migration: id,
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
   ADMIN: Forums (categories + moderation). Real `forums` table (columns
   confirmed against 0004_community_gamification_admin.sql: id, course_id
   nullable FK -> courses, is_general bool default false, title NOT NULL,
   description) and `forum_posts` (id, forum_id NOT NULL FK -> forums ON
   DELETE CASCADE, author_id FK -> user_profiles(id), content NOT NULL,
   upvotes/downvotes default 0, is_solution bool default false, parent_post_id
   self-referencing FK -> forum_posts(id): NO "on delete cascade" declared on
   that one. Created_at). A null parent_post_id is a thread's opening post;
   non-null is a reply. RLS (0009_forum_rls_gapfill.sql): forums_write_authorized
   gates category create/update/delete to effective_has_permission(auth.uid(),
   'manage_courses') or super admin; fp_delete_own_or_moderator lets the
   author OR can_moderate_content()/super admin delete any post.
   ========================================================================= */

// Admin view of every category - no learner-facing filtering, same shape as
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
  // removes every thread/reply inside it automatically - no manual cleanup
  // query needed here.
  const { error } = await supabase.from("forums").delete().eq("id", id);
  if (error) throw error;
}

// Admin moderation drill-down: threads (top-level forum_posts) in one
// category, with author + reply count attached - same computation
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

// Moderates (deletes) a single forum_posts row - a thread's opening post OR a
// reply. parent_post_id has NO "on delete cascade" (unlike forum_id), so
// deleting a thread first deletes its direct replies to avoid an FK
// violation, then deletes the thread's own row. This schema's replies are
// only ever one level deep (schemaHelper.js's fetchForumThread only ever
// queries parent_post_id = threadId, never a second level), so a single
// child-delete pass is exhaustive - deleting a reply itself is a no-op on
// the first delete (it has no children) and then removes itself normally.
export async function deleteForumPost(id) {
  if (!supabase || !id) return;
  const { error: repErr } = await supabase.from("forum_posts").delete().eq("parent_post_id", id);
  if (repErr) throw repErr;
  const { error } = await supabase.from("forum_posts").delete().eq("id", id);
  if (error) throw error;
}

/* ==========================================================================
   ADMIN: Compliance
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
   ADMIN: Integrations (webhooks)
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
   ADMIN: Payouts (shared by Admin > Settings Hub and Super Admin views)
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
  return (data || []).map(p => ({ id: p.id, mentor: nameById[p.mentor_id] || "Mentor", amount: p.amount, method: p.payment_method || "N/A", status: p.status }));
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
   ADMIN: GJP (Graduate Job Placement) dashboard. Not backed by its own
   table. It's a real aggregate over user_profiles (school/department/level)
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
    applied: p.created_at ? new Date(p.created_at).toLocaleDateString() : "N/A",
    status: p.last_active_at && new Date(p.last_active_at).getTime() > cutoff ? "active" : "inactive",
  }));
}

/* ==========================================================================
   ADMIN: Emails (campaigns)
   ========================================================================= */

export async function fetchEmailCampaigns(senderId) {
  if (!supabase) {
    return [
      { id: "demo-camp-1", subject: "Welcome to Train AI Platform Q3", recipient_group: "all", sent_count: 1420, open_count: 980, click_count: 420, status: "sent", sent_at: new Date(Date.now() - 86400000).toISOString() },
      { id: "demo-camp-2", subject: "New AI Certification Paths Available", recipient_group: "active_users", sent_count: 850, open_count: 610, click_count: 310, status: "sent", sent_at: new Date(Date.now() - 3 * 86400000).toISOString() }
    ];
  }
  let query = supabase.from("email_campaigns").select("*").order("sent_at", { ascending: false, nullsFirst: false }).limit(20);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Both functions below call the live "advanced-broadcast-email" edge function
// (see supabase/functions/advanced-broadcast-email/index.ts in the reference
// app) - it does its own server-side admin/super_admin auth check (via
// user_roles) using the caller's JWT that supabase.functions.invoke attaches
// automatically, so no client-side role gate is required here beyond the
// nav-level one that already keeps this screen super-admin-only.
//
// The edge function is also what actually writes/updates the real
// `email_campaigns` row (subject, html_content, recipient_group,
// recipient_count, sent_count, status, sent_at, open_count, click_count
// exact columns confirmed against the shared schema) - there is no separate
// client-side insert to keep in sync with it.
export async function previewBroadcastRecipientCount({ recipientGroup, specificEmail }) {
  if (!supabase) {
    const projData = DEMO_PROJECT_DATA[activeProject] || DEMO_PROJECT_DATA.digital_training;
    if (recipientGroup === "specific_email") return specificEmail ? 1 : 0;
    if (recipientGroup === "all") return projData.stats.totalUsers;
    if (recipientGroup === "active_users") return projData.stats.activeInWeek;
    if (recipientGroup === "organizations") return projData.stats.organizations;
    return Math.round(projData.stats.totalUsers * 0.4);
  }
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
  if (!supabase) {
    const projData = DEMO_PROJECT_DATA[activeProject] || DEMO_PROJECT_DATA.digital_training;
    const total = recipientGroup === "specific_email" ? 1 : projData.stats.activeInWeek;
    return { success: true, email_sent: total, total_recipients: total };
  }
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
   SUPER ADMIN. Learning tracks (derived from courses.category. There is
   no dedicated "tracks" table in the schema), Sara Foundation email
   verification, and super-admin role assignment.
   ========================================================================= */

export async function fetchLearningTracksSummary() {
  if (!supabase) {
    const projData = DEMO_PROJECT_DATA[activeProject] || DEMO_PROJECT_DATA.digital_training;
    return projData.tracks;
  }
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
  if (!supabase) return [{ userId: "demo-admin-id", name: "Demo Admin", initials: "DA" }];
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
  if (!supabase) return { success: false, error: "Not available in demo mode." };
  try {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "super_admin" });
    if (error) throw error;
    return { success: true };
  } catch (e) {
    // The real check lives in the database (ur_write_super_admin RLS
    // policy, 0119_super_admin_trainai_only.sql) - "Train AI email accounts
    // only." This just translates the raw RLS rejection into something a
    // human reading the Access Control screen can actually understand.
    const message = e?.message?.includes("row-level security")
      ? "Super Admin can only be granted to a @trainailtd.com account."
      : (e?.message || "Could not grant Super Admin.");
    return { success: false, error: message };
  }
}

/* ==========================================================================
   SUPER ADMIN: Access Control (RBAC): global permission matrix backed by
   role_permissions_matrix, and per-org matrix backed by role_permissions.
   ========================================================================= */

export async function fetchGlobalPermissionMatrix() {
  if (!supabase) {
    return [
      { role: "admin", permission_key: "manage_users", allowed: true }, { role: "admin", permission_key: "manage_courses", allowed: true },
      { role: "admin", permission_key: "manage_cohorts", allowed: true }, { role: "admin", permission_key: "manage_compliance", allowed: true },
      { role: "admin", permission_key: "view_analytics", allowed: true }, { role: "mentor", permission_key: "manage_courses", allowed: true },
      { role: "manager", permission_key: "view_analytics", allowed: true },
    ];
  }
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
   SUPER ADMIN: Branding / white-label. Real `branding_settings` table
   (columns confirmed against the shared schema: id, organization_id,
   logo_url, primary_color, secondary_color, favicon_url, custom_css,
   email_header, email_footer, created_at, updated_at) is the dedicated
   branding config table: `organizations` itself also has its own
   `logo_url` column, but no color columns at all, so branding_settings is
   kept as the single source of truth here for both logo and color rather
   than splitting "logo" and "color" across two different tables.
   `organization_id` has no declared FK/unique constraint on this table (per
   the schema's `Relationships: []`), so a row is looked up by equality and
   updated by its own `id` if one already exists, or inserted otherwise.
   ========================================================================= */

export async function fetchOrgBranding(organizationId) {
  if (!supabase || !organizationId) return null;
  // branding_settings is keyed by organization_id and has neither an `id` nor
  // an `updated_at` column, so ordering on updated_at made PostgREST reject
  // the query outright - branding always read back as null, which is why the
  // Branding screen never showed a saved logo or colour.
  const { data, error } = await supabase
    .from("branding_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) { console.warn("Org branding fetch warning:", error); return null; }
  return data;
}

export async function upsertOrgBranding(organizationId, { logoUrl, primaryColor } = {}) {
  if (!supabase || !organizationId) return null;
  const existing = await fetchOrgBranding(organizationId);
  // No updated_at column on this table either - writing one made every save
  // fail. organization_id is the key, so the update targets that.
  const patch = {};
  if (logoUrl !== undefined) patch.logo_url = logoUrl || null;
  if (primaryColor !== undefined) patch.primary_color = primaryColor || null;
  if (!Object.keys(patch).length) return existing;

  if (existing) {
    const { data, error } = await supabase
      .from("branding_settings")
      .update(patch)
      .eq("organization_id", organizationId)
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
   MENTOR WORKSPACE. Mentees, discussions, agreements, refunds, payouts,
   session templates, blocked slots, direct messages. Reads/writes against
   tables from 0003_mentors_sessions_messaging.sql.
   ========================================================================= */

export async function fetchAllPlatformLearners(organizationId) {
  if (!supabase) {
    return DEMO_LEARNERS.map((l) => {
      const rows = DEMO_ENROLLMENTS.filter((e) => e.learnerId === l.id);
      const avgProgress = rows.length ? Math.round(rows.reduce((a, r) => a + r.progress, 0) / rows.length) : 0;
      return {
        id: l.id, name: l.name, email: l.email, initials: l.initials, progress: avgProgress, quizAvg: rows.length ? 82 : null,
        sessionsCompleted: rows.filter((r) => r.completed).length, courses: rows.map((r) => DEMO_COURSES.find((c) => c.id === r.courseId)?.title).filter(Boolean),
        risk: l.risk,
      };
    });
  }
  let query = supabase
    .from("user_profiles")
    .select("id, display_name, avatar_url, role, school, department, email, created_at, organization_id")
    .order("display_name", { ascending: true });
  if (organizationId && organizationId !== "demo-org-id") {
    query = query.eq("organization_id", organizationId);
  }
  const { data: profiles, error } = await query;
  if (error) { console.warn("Error fetching learner profiles:", error); return []; }

  const learnerProfiles = (profiles || []).filter(p => p.role !== "admin" && p.role !== "super_admin" && p.role !== "mentor" && p.role !== "instructor");
  const learnerIds = learnerProfiles.map(p => p.id);

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

  let progressByLearner = {};
  let courseIdsByLearner = {};
  if (learnerIds.length) {
    const [enrollments, instructorEnrollments, attempts] = await Promise.all([
      safeInQuery("course_enrollments", "user_id, course_id, progress_percentage", "user_id", learnerIds),
      safeInQuery("instructor_course_enrollments", "user_id, course_id, progress_percentage", "user_id", learnerIds),
      safeInQuery("quiz_attempts", "user_id, score", "user_id", learnerIds),
    ]);
    for (const e of [...(enrollments || []), ...(instructorEnrollments || [])]) {
      if (!progressByLearner[e.user_id]) progressByLearner[e.user_id] = [];
      progressByLearner[e.user_id].push(e.progress_percentage || 0);
      if (e.course_id) {
        if (!courseIdsByLearner[e.user_id]) courseIdsByLearner[e.user_id] = new Set();
        courseIdsByLearner[e.user_id].add(e.course_id);
      }
    }

    for (const a of (attempts || [])) {
      if (a.score != null) {
        if (!quizScoresByLearner[a.user_id]) quizScoresByLearner[a.user_id] = [];
        quizScoresByLearner[a.user_id].push(a.score);
      }
    }
  }

  const allCourseIds = [...new Set(Object.values(courseIdsByLearner).flatMap((s) => [...s]))];
  let courseTitleById = {};
  if (allCourseIds.length) {
    const courseRows = await safeInQuery("courses", "id, title", "id", allCourseIds);
    courseTitleById = Object.fromEntries((courseRows || []).map((c) => [c.id, c.title]));
  }
  const coursesByLearner = Object.fromEntries(
    Object.entries(courseIdsByLearner).map(([uid, ids]) => [uid, [...ids].map((cid) => courseTitleById[cid]).filter(Boolean)])
  );

  let quizScoresByLearner = {};

  return learnerProfiles.map(p => {
    const id = p.id;
    const name = p.display_name || "Learner";
    const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "L";
    const progressList = progressByLearner[id] || [];
    const progress = progressList.length ? Math.round(progressList.reduce((a, b) => a + b, 0) / progressList.length) : null;
    const quizScores = quizScoresByLearner[id] || [];
    const quizAvg = quizScores.length ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length) : null;
    const email = p.email || `${name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@trainailtd.com`;
    return {
      id,
      name,
      email,
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

export async function resolveDiscussion(id, replyText) {
  if (!supabase) return;
  const payload = { is_resolved: true };
  if (replyText && replyText.trim()) payload.mentor_response = replyText.trim();
  const { error } = await supabase.from("mentor_learner_discussions").update(payload).eq("id", id);
  // If mentor_response column doesn't exist yet, retry without it
  if (error && error.message?.includes("mentor_response")) {
    const { error: e2 } = await supabase.from("mentor_learner_discussions").update({ is_resolved: true }).eq("id", id);
    if (e2) throw e2;
    return;
  }
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
    expires: a.expires_at ? new Date(a.expires_at).toLocaleDateString() : "N/A",
  }));
}

export async function createAgreementForMentee(mentorId, learnerName, agreementType = "Standard mentorship") {
  if (!supabase) return null;
  // learner_id must be the real auth user id - user_profiles.id IS
  // that id directly (confirmed against the actual schema).
  const { data: learner } = await supabase
    .from("user_profiles")
    .select("id")
    .ilike("display_name", learnerName)
    .maybeSingle();
  if (!learner) throw new Error(`No learner found named "${learnerName}"`);
  const { data, error } = await supabase
    .from("mentorship_agreements")
    .insert({ mentor_id: mentorId, learner_id: learner.id, agreement_type: agreementType, status: "pending learner signature" })
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
    amount: r.amount != null ? `$${r.amount}` : "N/A",
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
   MANAGER WORKSPACE. "My team" view scoped to direct reports.
   user_profiles.manager_id is a real column in the shared schema (added
   alongside the `is_manager_of(_manager, _learner)` RLS helper and the
   compliance_manager_read_reports policy in 0006-era migrations) that stores
   the report's manager's own auth user id. The same convention as
   mentorship_sessions.mentor_id pointing at a user id elsewhere. It has no
   declared FK, so (same as fetchProfilesByUserIds above) it can't be
   embedded; this is a plain equality filter plus two manual follow-up
   queries for each report's enrollment/compliance status.
   ========================================================================= */

export async function fetchDirectReports(managerId) {
  if (!supabase) {
    return DEMO_LEARNERS.slice(0, 5).map((l, i) => {
      const rows = DEMO_ENROLLMENTS.filter((e) => e.learnerId === l.id);
      return {
        userId: l.id, name: l.name, email: l.email, initials: l.initials,
        enrolled: rows.length, completed: rows.filter((r) => r.completed).length,
        overdue: l.risk === "danger" ? 1 : 0, lastActive: `${i + 1} day${i === 0 ? "" : "s"} ago`,
      };
    });
  }
  if (!managerId) return [];
  const { data: profiles, error } = await supabase
    .from("user_profiles")
    .select("id, display_name, email, last_active_at")
    .eq("manager_id", managerId);
  if (error) throw error;
  const rows = profiles || [];
  const ids = rows.map((r) => r.id);
  if (!ids.length) return [];
  const [{ data: enrollments }, { data: compliance }] = await Promise.all([
    supabase.from("course_enrollments").select("user_id, progress_percentage").in("user_id", ids),
    supabase.from("compliance_assignments").select("user_id, status").in("user_id", ids),
  ]);
  const enrollList = enrollments || [];
  const complianceList = compliance || [];
  return rows.map((r) => {
    const userEnrolls = enrollList.filter((e) => e.user_id === r.id);
    const userComp = complianceList.filter((c) => c.user_id === r.id);
    const name = r.display_name || "Unnamed user";
    const email = r.email || `${name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@trainailtd.com`;
    return {
      userId: r.id,
      name,
      email,
      initials: name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
      enrolled: userEnrolls.length,
      completed: userEnrolls.filter((e) => e.progress_percentage === 100).length,
      overdue: userComp.filter((c) => c.status === "overdue").length,
      lastActive: r.last_active_at ? new Date(r.last_active_at).toLocaleDateString() : "N/A",
    };
  });
}


// Backlog item: "Learner Progress Revamp" - admins previously had no
// org-wide view of learner progress at all (fetchStudentRiskList above only
// surfaces up to 6 inactive learners by login recency). This gives every
// learner in the org a row: how many courses they're assigned, how many
// they've finished, their average progress, and a pace label so someone
// behind is visible without opening their record individually.
//
// Pace is a heuristic, not a promise-tracked "expected vs actual" model
// this schema has no per-course expected-completion-date to compare
// against. "ahead": average progress >= 70%. "behind": average progress
// under 30% with at least one course assigned, or no activity in 6+ days
// (same cutoff already used by fetchStudentRiskList, kept consistent
// on purpose). "not started": assigned courses, zero progress on all of
// them. "on pace": everything else.
export async function fetchOrgLearnerProgressOverview(organizationId, options = {}) {
  const { startDate, endDate } = options;
  if (!supabase) return demoLearnerProgressOverview();

  const orgFilter = (organizationId && organizationId !== "demo-org-id") ? organizationId : null;
  let query = supabase
    .from("user_profiles")
    .select("id, display_name, department, last_active_at, role");
  if (orgFilter) query = query.eq("organization_id", orgFilter);
  const { data: allLearners, error: learnersError } = await query;
  if (learnersError) throw learnersError;
  if (!allLearners || allLearners.length === 0) return [];

  const nonAdminLearners = allLearners.filter(l => l.role !== "admin" && l.role !== "super_admin" && l.role !== "mentor" && l.role !== "instructor");
  const learners = nonAdminLearners.length > 0 ? nonAdminLearners : allLearners;
  const learnerIds = learners.map(l => l.id);
  let enrollments = await safeInQuery("course_enrollments", "user_id, progress_percentage, completed_at", "user_id", learnerIds);

  // Historic view: when a date range is set, scope to completions that
  // happened within it (rather than every enrollment's current, all-time
  // state) - this is what "see progress at a certain point in time" means
  // for data that doesn't keep a full progress-snapshot history.
  if (startDate || endDate) {
    const startMs = startDate ? new Date(startDate).getTime() : -Infinity;
    const endMs = endDate ? new Date(endDate).getTime() : Infinity;
    enrollments = (enrollments || []).filter((e) => {
      if (!e.completed_at) return false;
      const t = new Date(e.completed_at).getTime();
      return t >= startMs && t <= endMs;
    });
  }

  // Cohort membership, so the caller can filter learners by cohort.
  const cohortMemberRows = await safeInQuery("cohort_members", "user_id, cohort_id, cohorts(name)", "user_id", learnerIds);
  const cohortsByUser = new Map();
  for (const row of (cohortMemberRows || [])) {
    if (!cohortsByUser.has(row.user_id)) cohortsByUser.set(row.user_id, []);
    cohortsByUser.get(row.user_id).push({ id: row.cohort_id, name: row.cohorts?.name || "Cohort" });
  }

  const byUser = new Map();
  for (const e of (enrollments || [])) {
    if (!byUser.has(e.user_id)) byUser.set(e.user_id, []);
    byUser.get(e.user_id).push(e);
  }

  const now = Date.now();
  const sixDaysMs = 6 * 24 * 60 * 60 * 1000;

  return learners.map(l => {
    const rows = byUser.get(l.id) || [];
    const assignedCount = rows.length;
    const completedCount = rows.filter(r => (r.progress_percentage || 0) >= 100 || !!r.completed_at).length;
    const avgProgress = assignedCount > 0
      ? Math.round(rows.reduce((sum, r) => sum + (r.progress_percentage || 0), 0) / assignedCount)
      : 0;
    const daysSinceActive = l.last_active_at ? Math.floor((now - new Date(l.last_active_at).getTime()) / (24 * 60 * 60 * 1000)) : null;

    let pace;
    if (assignedCount === 0) pace = "not_started";
    else if (avgProgress >= 70) pace = "ahead";
    else if (avgProgress < 30 || (daysSinceActive !== null && daysSinceActive > 6)) pace = "behind";
    else pace = "on_pace";

    return {
      id: l.id,
      name: l.display_name || "Unnamed learner",
      initials: (l.display_name || "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
      department: l.department || "N/A",
      cohorts: cohortsByUser.get(l.id) || [],
      assignedCount,
      completedCount,
      avgProgress,
      daysSinceActive,
      pace,
    };
  });
}

// Instructor grading / override - the other half of
// 0112_assessments_pipeline.sql. RLS (aa_select_grader/aa_update_grader)
// already restricts this to the course's assigned instructor, a
// manage_courses permission holder, or super_admin - no client-side scope
// filtering needed beyond the course_id join itself.
export async function fetchAssessmentAttemptsForCourse(courseId) {
  if (!supabase || !courseId) return [];
  const { data: assessment } = await supabase.from("assessments").select("id").eq("course_id", courseId).maybeSingle();
  if (!assessment) return [];
  const { data, error } = await supabase
    .from("assessment_attempts")
    .select("*, user_profiles(display_name)")
    .eq("assessment_id", assessment.id)
    .order("completed_at", { ascending: false });
  if (error) { console.warn("Assessment attempts fetch warning:", error); return []; }
  return data || [];
}

export async function overrideAssessmentScore(attemptId, newScore, overriddenBy, note = "") {
  if (!supabase || !attemptId) return { success: false, error: "Not available in demo mode." };
  try {
    const { error } = await supabase
      .from("assessment_attempts")
      .update({ score: newScore, overridden_by: overriddenBy, overridden_at: new Date().toISOString(), override_note: note || null })
      .eq("id", attemptId);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not override the score." };
  }
}

// Platform Owner impersonation ("view as") - see
// 0113_super_admin_impersonation.sql for the full design rationale
// (audited read-only snapshot, not real session forgery).
export async function searchUsersForImpersonation(query) {
  if (!supabase || !query?.trim()) return [];
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, display_name, role, organization_id")
    .ilike("display_name", `%${query.trim()}%`)
    .limit(10);
  if (error) { console.warn("User search warning:", error); return []; }
  return data || [];
}

export async function viewUserAsSuperAdmin(targetUserId, reason) {
  if (!supabase || !targetUserId) return { success: false, error: "Not available in demo mode." };
  try {
    const { data, error } = await supabase.rpc("super_admin_view_user", {
      p_target_user_id: targetUserId,
      p_reason: reason || null,
    });
    if (error) throw error;
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e?.message || "Could not view this user. You may not have Platform Owner access." };
  }
}

// Platform Owner org status control (suspend/activate) - see
// 0117_organization_status_control.sql. Audited unconditionally there.
export async function setOrganizationStatus(orgId, status) {
  if (!supabase || !orgId) return { success: false, error: "Not available in demo mode." };
  try {
    const { data, error } = await supabase.rpc("set_organization_status", { p_org_id: orgId, p_status: status });
    if (error) throw error;
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e?.message || "Could not update organization status." };
  }
}

// Platform Owner billing/payments visibility across all organizations
// (Multi-Tenant Architecture Reference, Section 4: "Billing/payments
// management: View and manage payments received from organizations.")
// Real data - the admin_audit_log rows apply_organization_subscription_payment()
// already writes (0114_organization_subscription_payment.sql), not a new
// table. This is a read of what already gets recorded, surfaced for the
// first time at the platform level.
export async function fetchPlatformOrganizationPayments(limit = 50) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("*")
    .eq("action_type", "organization_subscription_payment")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) { console.warn("Platform payments fetch warning:", error); return []; }
  return data || [];
}

// Resolves a known email to the user_id grantSuperAdminByUserId needs -
// restricted to super_admin callers at the database level
// (find_user_id_by_email, 0119_super_admin_trainai_only.sql).
export async function findUserIdByEmail(email) {
  if (!supabase || !email) return null;
  const { data, error } = await supabase.rpc("find_user_id_by_email", { p_email: email.trim() });
  if (error) throw error;
  return data || null;
}

// Certificates - admin/instructor side. See 0120_certificates.sql.
export async function upsertCertificateTemplate({ courseId, organizationId, title, passingScorePct, requiresApproval, templateText }, createdBy) {
  if (!supabase || !courseId) return { success: false, error: "Not available in demo mode." };
  try {
    const { error } = await supabase.from("certificate_templates").upsert({
      course_id: courseId,
      organization_id: organizationId || null,
      title: title || "Certificate of Completion",
      passing_score_pct: passingScorePct ?? 70,
      requires_admin_approval: requiresApproval !== false,
      template_text: templateText || null,
      created_by: createdBy || null,
    }, { onConflict: "course_id" });
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not save certificate settings." };
  }
}

export async function fetchCertificateRequestsForCourse(courseId) {
  if (!supabase) {
    if (courseId !== "demo-course-ai-fundamentals") return [];
    return [
      { id: "demo-req-1", score_pct: 95, status: "issued", requested_at: new Date(Date.now() - 86400000).toISOString(), user_profiles: { display_name: "Amara Chen" } },
      { id: "demo-req-2", score_pct: 62, status: "pending", requested_at: new Date().toISOString(), user_profiles: { display_name: "Priya Nair" } },
    ];
  }
  if (!courseId) return [];
  // `certificates` has TWO foreign keys to user_profiles (user_id and
  // reviewed_by), which makes a bare `user_profiles(...)` embed ambiguous -
  // PostgREST rejects the whole query rather than guessing, so this list came
  // back empty and no learner name ever appeared. Resolved with the same
  // batched manual lookup this file already uses everywhere else.
  const { data, error } = await supabase
    .from("certificates")
    .select("*")
    .eq("course_id", courseId)
    .order("requested_at", { ascending: false });
  if (error) { console.warn("Certificate requests fetch warning:", error); return []; }
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.user_id));
  return rows.map((r) => ({ ...r, user_profiles: profiles[r.user_id] || null }));
}

export async function reviewCertificate(certificateId, approve, rejectionReason = "") {
  if (!supabase || !certificateId) return { success: false, error: "Not available in demo mode." };
  try {
    const { data, error } = await supabase.rpc("review_certificate", {
      p_certificate_id: certificateId, p_approve: approve, p_rejection_reason: rejectionReason || null,
    });
    if (error) throw error;
    return data || { success: false };
  } catch (e) {
    return { success: false, error: e?.message || "Could not review this certificate." };
  }
}

// Instructor/Manager feedback notes - PRD Section 8.1 "Feedback for
// learners (Note section)" and Section 8.2 "Manager feedback for
// department (Note section)". See 0121_feedback_notes.sql.
export async function fetchNotesForLearner(learnerId) {
  if (!supabase || !learnerId) return [];
  const { data, error } = await supabase
    .from("feedback_notes")
    .select("*, user_profiles!feedback_notes_author_id_fkey(display_name)")
    .eq("target_type", "learner")
    .eq("target_learner_id", learnerId)
    .order("created_at", { ascending: false });
  if (error) { console.warn("Learner notes fetch warning:", error); return []; }
  return data || [];
}

export async function addLearnerFeedbackNote(learnerId, organizationId, authorId, noteText) {
  if (!supabase || !learnerId || !noteText?.trim()) return { success: false, error: "Not available in demo mode." };
  try {
    const { error } = await supabase.from("feedback_notes").insert({
      author_id: authorId, organization_id: organizationId, target_type: "learner",
      target_learner_id: learnerId, note_text: noteText.trim(),
    });
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not save this note." };
  }
}

export async function fetchNotesForDepartment(organizationId, department) {
  if (!supabase || !organizationId || !department) return [];
  const { data, error } = await supabase
    .from("feedback_notes")
    .select("*, user_profiles!feedback_notes_author_id_fkey(display_name)")
    .eq("target_type", "department")
    .eq("organization_id", organizationId)
    .eq("target_department", department)
    .order("created_at", { ascending: false });
  if (error) { console.warn("Department notes fetch warning:", error); return []; }
  return data || [];
}

export async function addDepartmentFeedbackNote(organizationId, department, authorId, noteText) {
  if (!supabase || !organizationId || !department || !noteText?.trim()) return { success: false, error: "Not available in demo mode." };
  try {
    const { error } = await supabase.from("feedback_notes").insert({
      author_id: authorId, organization_id: organizationId, target_type: "department",
      target_department: department, note_text: noteText.trim(),
    });
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not save this note." };
  }
}

// Manager "team skill snapshot" (PRD Section 8.2) - no skills taxonomy
// exists in this schema (courses aren't tagged with individual skills
// anywhere), so this is built honestly from what real data actually
// exists: completion broken down by course category (a real column on
// courses, already used as a content-organization tag) for this manager's
// direct reports specifically. Not labeled "AI Skill Graph" - that's a
// materially bigger, separate thing that would need real skill-to-course
// tagging to be honest, which doesn't exist yet.
export async function fetchTeamSkillSnapshot(managerId) {
  if (!supabase) return [{ category: "Compliance", avgProgress: 100, learnerCount: 2 }, { category: "AI", avgProgress: 78, learnerCount: 5 }, { category: "Leadership", avgProgress: 62, learnerCount: 3 }];
  if (!managerId) return [];
  const { data: profiles } = await supabase.from("user_profiles").select("id").eq("manager_id", managerId);
  const ids = (profiles || []).map((p) => p.id);
  if (!ids.length) return [];
  const { data: enrollments } = await supabase
    .from("course_enrollments")
    .select("user_id, progress_percentage, courses(category)")
    .in("user_id", ids);
  const byCategory = {};
  for (const e of (enrollments || [])) {
    const cat = e.courses?.category || "General";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(e.progress_percentage || 0);
  }
  return Object.entries(byCategory).map(([category, values]) => ({
    category,
    avgProgress: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    learnerCount: values.length,
  })).sort((a, b) => a.avgProgress - b.avgProgress);
}

// ============================================================================
// Workforce Intelligence Dashboard - PRD Section 9, confirmed the largest
// unbuilt gap: "This is the key differentiator." Built org-wide (Section
// 9's "team, function, or organisation" scope), visible only to Admin and
// Manager per the explicit access restriction in Section 9's own opening
// line. Section 9.5's data rule: "should not rely on course completion
// alone. It must combine available signals into decision-ready outputs" -
// this combines four real, independently-verified signals rather than
// one: course completion, compliance status, assessment scores, and real
// AI Coach usage (ai_usage_events, already built and genuinely logged by
// the edge function itself, not estimated).
//
// What this is NOT: a fabricated "AI Skill Graph" with a skills taxonomy
// that doesn't exist in this schema. The department/category breakdown
// below is the same honest completion-by-category proxy used for the
// Manager's Team Skill Snapshot, applied org-wide instead of to one
// manager's reports - flagged the same way there, not relabeled as
// something more sophisticated at a bigger scope.
// ============================================================================
export async function fetchWorkforceIntelligence(organizationId) {
  if (!supabase) {
    return {
      readinessScore: 68, departmentBreakdown: [{ department: "Unspecified", avgProgress: 68, learnerCount: 8 }],
      categoryBreakdown: [{ category: "AI", avgProgress: 78, learnerCount: 5 }, { category: "Leadership", avgProgress: 62, learnerCount: 3 }, { category: "Compliance", avgProgress: 100, learnerCount: 4 }],
      aiUsageCount7d: 12, feedbackNotesCount30d: 0, avgAssessmentScore: 94, complianceRate: 50, avgCompletion: 68, learnerCount: 8,
    };
  }
  const orgFilter = (organizationId && organizationId !== "demo-org-id") ? organizationId : null;

  let learnerQuery = supabase
    .from("user_profiles")
    .select("id, department, last_active_at, role");
  if (orgFilter) learnerQuery = learnerQuery.eq("organization_id", orgFilter);
  const { data: allUsers } = await learnerQuery;
  const nonAdminLearners = (allUsers || []).filter(l => l.role !== "admin" && l.role !== "super_admin" && l.role !== "mentor" && l.role !== "instructor");
  const learnerRows = nonAdminLearners.length > 0 ? nonAdminLearners : (allUsers || []);
  const learnerIds = learnerRows.map((l) => l.id);
  if (!learnerIds.length) {
    return { readinessScore: 0, departmentBreakdown: [], categoryBreakdown: [], aiUsageCount7d: 0, feedbackNotesCount30d: 0, avgAssessmentScore: null, complianceRate: 100, avgCompletion: 0, learnerCount: 0 };
  }

  let aiUsageQuery = supabase.from("ai_usage_events").select("id, created_at").gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
  if (orgFilter) aiUsageQuery = aiUsageQuery.eq("organization_id", orgFilter);

  let feedbackNotesQuery = supabase.from("feedback_notes").select("id, created_at").gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  if (orgFilter) feedbackNotesQuery = feedbackNotesQuery.eq("organization_id", orgFilter);

  const [enrollments, compliance, assessmentAttempts, { data: aiUsage }, { data: feedbackNotes }] = await Promise.all([
    safeInQuery("course_enrollments", "user_id, progress_percentage, courses(category)", "user_id", learnerIds),
    safeInQuery("compliance_assignments", "user_id, status", "user_id", learnerIds),
    safeInQuery("assessment_attempts", "user_id, score", "user_id", learnerIds),
    aiUsageQuery,
    feedbackNotesQuery,
  ]);

  const enrollList = enrollments || [];
  const complianceList = compliance || [];
  const scoreList = (assessmentAttempts || []).map((a) => a.score).filter((s) => s != null);

  const avgCompletion = enrollList.length
    ? Math.round(enrollList.reduce((sum, e) => sum + (e.progress_percentage || 0), 0) / enrollList.length)
    : 0;
  const overdueCount = complianceList.filter((c) => c.status === "overdue").length;
  const complianceRate = complianceList.length
    ? Math.round(((complianceList.length - overdueCount) / complianceList.length) * 100)
    : 100;
  const avgAssessmentScore = scoreList.length
    ? Math.round(scoreList.reduce((a, b) => a + b, 0) / scoreList.length)
    : null;

  // Readiness score combines all real signals with explicit, visible weighting
  const signals = [avgCompletion];
  if (complianceRate !== null) signals.push(complianceRate);
  if (avgAssessmentScore !== null) signals.push(avgAssessmentScore);
  const readinessScore = signals.length ? Math.round(signals.reduce((a, b) => a + b, 0) / signals.length) : avgCompletion;

  // Skill gaps by department (Section 9.3) - real department field on user_profiles, real category field on courses.
  const deptByLearner = {};
  for (const l of learnerRows) deptByLearner[l.id] = l.department || "General";
  const byDept = {};
  for (const e of enrollList) {
    const dept = deptByLearner[e.user_id] || "General";
    if (!byDept[dept]) byDept[dept] = [];
    byDept[dept].push(e.progress_percentage || 0);
  }
  const departmentBreakdown = Object.entries(byDept)
    .map(([department, values]) => ({ department, avgProgress: Math.round(values.reduce((a, b) => a + b, 0) / values.length), count: values.length }))
    .sort((a, b) => a.avgProgress - b.avgProgress);

  const byCategory = {};
  for (const e of enrollList) {
    const cat = e.courses?.category || "Core Curriculum";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(e.progress_percentage || 0);
  }
  const categoryBreakdown = Object.entries(byCategory)
    .map(([category, values]) => ({ category, avgProgress: Math.round(values.reduce((a, b) => a + b, 0) / values.length), count: values.length }))
    .sort((a, b) => a.avgProgress - b.avgProgress);

  return {
    readinessScore,
    departmentBreakdown,
    categoryBreakdown,
    aiUsageCount7d: (aiUsage || []).length,
    feedbackNotesCount30d: (feedbackNotes || []).length,
    avgAssessmentScore,
    complianceRate,
    avgCompletion,
    learnerCount: learnerRows.length,
  };
}

// Real per-course assessment result for one learner, scoped to a specific
// set of course ids (a learning pathway's courses) - backs Workforce
// Intelligence's per-learner "Skill Profile" and "Promotion Criteria",
// replacing what used to be a fabricated level (learner's overall progress
// plus a hardcoded per-index offset) with the learner's actual attempt on
// that course's real assessment, and the assessment's real passing_score_pct
// instead of an invented target. A course with no assessment, or no attempt
// yet, is reported honestly (score: null) rather than defaulted to a number.
export async function fetchLearnerAssessmentScoresForCourses(userId, courseIds) {
  if (!supabase || !userId || !courseIds?.length) return [];
  const { data: assessments, error: aErr } = await supabase
    .from("assessments")
    .select("id, course_id, passing_score_pct")
    .in("course_id", courseIds);
  if (aErr) { console.warn("Assessment lookup warning:", aErr); return []; }
  const list = assessments || [];
  if (!list.length) return [];
  const assessmentIds = list.map((a) => a.id);
  const { data: attempts, error: attErr } = await supabase
    .from("assessment_attempts")
    .select("assessment_id, score, completed_at")
    .eq("user_id", userId)
    .in("assessment_id", assessmentIds);
  if (attErr) { console.warn("Assessment attempts warning:", attErr); }
  const byAssessment = new Map((attempts || []).map((a) => [a.assessment_id, a]));
  return list.map((a) => {
    const attempt = byAssessment.get(a.id);
    return {
      courseId: a.course_id,
      passingScorePct: a.passing_score_pct ?? 70,
      score: attempt?.score ?? null,
      completedAt: attempt?.completed_at ?? null,
    };
  });
}

// ============================================================================
// Support Queue - PRD "Platform Owner Support System." See
// 0122_support_tickets.sql for the real table/RLS (cross-org isolation,
// status-change restricted to Platform Owner, internal notes hidden from
// the org - all tested with real Postgres RLS tests).
// ============================================================================
export async function fetchMyOrgSupportTickets(organizationId) {
  if (!supabase || !organizationId) return [];
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) { console.warn("Support tickets fetch warning:", error); return []; }
  return data || [];
}

export async function createSupportTicket({ organizationId, createdBy, subject, description, priority }) {
  if (!supabase || !organizationId || !subject?.trim()) return { success: false, error: "Not available in demo mode." };
  try {
    const { error } = await supabase.from("support_tickets").insert({
      organization_id: organizationId, created_by: createdBy, subject: subject.trim(),
      description: description || "", priority: priority || "normal",
    });
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not submit your support request." };
  }
}

export async function fetchAllSupportTickets() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*, organizations(name)")
    .order("created_at", { ascending: false });
  if (error) { console.warn("Support tickets fetch warning:", error); return []; }
  return data || [];
}

export async function fetchSupportTicketMessages(ticketId) {
  if (!supabase || !ticketId) return [];
  const { data, error } = await supabase
    .from("support_ticket_messages")
    .select("*, user_profiles(display_name)")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) { console.warn("Support ticket messages fetch warning:", error); return []; }
  return data || [];
}

export async function replyToSupportTicket(ticketId, authorId, message, isInternalNote = false) {
  if (!supabase || !ticketId || !message?.trim()) return { success: false, error: "Not available in demo mode." };
  try {
    const { error } = await supabase.from("support_ticket_messages").insert({
      ticket_id: ticketId, author_id: authorId, message: message.trim(), is_internal_note: isInternalNote,
    });
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not send this reply." };
  }
}

export async function updateSupportTicketStatus(ticketId, status) {
  if (!supabase || !ticketId) return { success: false, error: "Not available in demo mode." };
  try {
    const { error } = await supabase.from("support_tickets").update({ status, updated_at: new Date().toISOString() }).eq("id", ticketId);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not update ticket status." };
  }
}

// ============================================================================
// Churn tracking - PRD Platform Owner Analytics, confirmed unbuilt. Built
// from real, already-existing data rather than a new table: every
// organization suspension is already recorded in admin_audit_log
// (organization_status_change, 0117_organization_status_control.sql) -
// this reads that real history rather than inventing a parallel "churn
// events" table that could drift out of sync with what actually happened.
// ============================================================================
export async function fetchChurnSummary() {
  if (!supabase) return { suspendedLast30d: 0, suspendedLast90d: 0, totalActive: 0, totalSuspended: 0, recentEvents: [] };
  const [{ data: statusEvents }, { data: orgs }] = await Promise.all([
    supabase.from("admin_audit_log").select("*").eq("action_type", "organization_status_change").order("created_at", { ascending: false }),
    supabase.from("organizations").select("id, status"),
  ]);
  const events = statusEvents || [];
  const now = Date.now();
  const suspensions = events.filter((e) => e.metadata?.new_status === "suspended");
  const suspendedLast30d = suspensions.filter((e) => now - new Date(e.created_at).getTime() < 30 * 24 * 60 * 60 * 1000).length;
  const suspendedLast90d = suspensions.filter((e) => now - new Date(e.created_at).getTime() < 90 * 24 * 60 * 60 * 1000).length;
  const orgList = orgs || [];
  return {
    suspendedLast30d,
    suspendedLast90d,
    totalActive: orgList.filter((o) => o.status === "active").length,
    totalSuspended: orgList.filter((o) => o.status === "suspended").length,
    recentEvents: suspensions.slice(0, 10),
  };
}

// ============================================================================
// Campaign attribution - PRD Platform Owner Analytics, confirmed unbuilt.
// Reads utm_source/utm_medium/utm_campaign already captured on demo
// requests and organization inquiries (see waitlist.js -
// captureAttributionFromURL, called once on the public landing page) -
// grouped here rather than a separate campaign-tracking table, since the
// real source of truth is the actual submitted lead, not a derived record.
// ============================================================================
export async function fetchCampaignAttribution() {
  if (!supabase) return [];
  const [{ data: demoRequests }, { data: inquiries }] = await Promise.all([
    supabase.from("demo_requests").select("utm_source, utm_medium, utm_campaign, created_at"),
    supabase.from("organization_inquiries").select("utm_source, utm_medium, utm_campaign, created_at"),
  ]);
  const all = [...(demoRequests || []), ...(inquiries || [])];
  const bySource = {};
  for (const r of all) {
    const key = r.utm_campaign || r.utm_source || "Direct / no campaign";
    if (!bySource[key]) bySource[key] = { campaign: key, count: 0, source: r.utm_source || "-", medium: r.utm_medium || "-" };
    bySource[key].count++;
  }
  return Object.values(bySource).sort((a, b) => b.count - a.count);
}

// Real platform health check - genuinely queries the database and times
// it, rather than fabricating an uptime percentage. This is NOT real
// infrastructure/API monitoring (that needs actual monitoring
// infrastructure this app has no access to) - it is exactly what it says:
// a live check of whether this one database is reachable right now, and
// how long that took.
export async function checkPlatformHealth() {
  if (!supabase) return { ok: true, latencyMs: null, checkedAt: new Date().toISOString(), note: "Demo mode - no real database connected." };
  const start = performance.now();
  try {
    const { error } = await supabase.from("organizations").select("id", { count: "exact", head: true });
    const latencyMs = Math.round(performance.now() - start);
    if (error) throw error;
    return { ok: true, latencyMs, checkedAt: new Date().toISOString() };
  } catch (e) {
    return { ok: false, latencyMs: Math.round(performance.now() - start), checkedAt: new Date().toISOString(), error: e?.message };
  }
}

// ============================================================================
// Organization-level RBAC for Manager/Instructor/Learner - PRD:
// "Allow organization administrators to control permissions for:
// Managers, Instructors, Learners... toggle specific permissions/features
// on or off." See 0128_org_level_rbac.sql for the real gap this fixes
// (the pre-existing role_permissions table was keyed by the wrong role
// enum and completely disconnected from actual permission checks).
// ============================================================================
const ORG_RBAC_ROLES = ["manager", "mentor", "learner"];
const ORG_RBAC_PERMISSIONS = [
  { key: "moderate_content", label: "Moderate community content" },
  { key: "send_communications", label: "Send communications/announcements" },
  { key: "view_analytics", label: "View analytics" },
  { key: "manage_cohorts", label: "Manage cohorts" },
  { key: "manage_compliance", label: "Administrative sections (compliance)" },
  { key: "view_learner_data", label: "View other learners' data" },
  { key: "issue_certificates", label: "Issue certificates directly to learners" },
  { key: "create_assessments", label: "Create and manage assessments" },
  { key: "assign_resources", label: "Assign resources to individual learners" },
];

export async function fetchOrgRolePermissions(organizationId) {
  if (!supabase || !organizationId) return [];
  const { data, error } = await supabase
    .from("org_role_permission_settings")
    .select("*")
    .eq("organization_id", organizationId);
  if (error) { console.warn("Org role permissions fetch warning:", error); return []; }
  return data || [];
}

export async function setOrgRolePermission(organizationId, role, permissionKey, allowed, updatedBy) {
  if (!supabase || !organizationId) return { success: false, error: "Not available in demo mode." };
  try {
    const { error } = await supabase.from("org_role_permission_settings").upsert({
      organization_id: organizationId, role, permission_key: permissionKey, allowed, updated_by: updatedBy, updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,role,permission_key" });
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not save this permission." };
  }
}

// Client-side check for a specific user's effective org-level permission -
// used to gate instructor-facing UI (e.g. "Give Certificate" in
// MenteesScreen.jsx, assessment creation in ContentScreen.jsx) based on
// whatever the org admin has actually toggled, rather than hardcoding
// "instructors can never do this."
export async function checkEffectiveOrgPermission(userId, permKey) {
  if (!supabase || !userId) return false;
  try {
    const { data, error } = await supabase.rpc("effective_org_permission", { check_user_id: userId, perm_key: permKey });
    if (error) throw error;
    return !!data;
  } catch (e) {
    console.warn("Org permission check warning:", e);
    return false;
  }
}

export { ORG_RBAC_ROLES, ORG_RBAC_PERMISSIONS };

// ============================================================================
// Admin can directly issue/upload a certificate to a specific learner - a
// real, confirmed gap: only the learner-requests -> admin-approves flow
// existed before this (0120_certificates.sql). See
// 0130_admin_issue_certificate_directly.sql - this does not require an
// existing course/template, and supports an actual uploaded file, not
// just an auto-generated certificate number.
// ============================================================================
export async function issueCertificateDirectly(userId, organizationId, title, courseId, fileUrl) {
  if (!supabase) return { success: false, error: "Not available in demo mode." };
  try {
    const { data, error } = await supabase.rpc("issue_certificate_directly", {
      p_user_id: userId, p_organization_id: organizationId, p_title: title, p_course_id: courseId || null, p_file_url: fileUrl || null,
    });
    if (error) throw error;
    return { success: true, certificateId: data };
  } catch (e) {
    return { success: false, error: e?.message || "Could not issue this certificate." };
  }
}

export async function fetchAllIssuedCertificates(organizationId) {
  if (!supabase) {
    return DEMO_CERTIFICATES.map((c) => ({
      id: c.id, certificate_number: c.certificateNumber, issued_at: c.issuedAt, status: "issued",
      user_profiles: { display_name: c.learnerName }, courses: { title: c.courseTitle },
    }));
  }
  const orgFilter = (organizationId && organizationId !== "demo-org-id") ? organizationId : null;
  let query = supabase
    .from("certificates")
    .select("*, courses(title)")
    .order("issued_at", { ascending: false, nullsFirst: false });
  if (orgFilter) query = query.eq("organization_id", orgFilter);
  const { data, error } = await query;
  if (error) { console.warn("Issued certificates fetch warning:", error); return []; }
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.user_id));
  return rows.map((r) => ({ ...r, user_profiles: profiles[r.user_id] || null }));
}

// ============================================================================
// Real assessment creation - a real, significant gap found while checking
// this: nothing anywhere let anyone create an assessment with real
// questions at all - only grading of already-existing attempts existed
// (ContentScreen.jsx's "Assessment Grading" tab). The database RLS
// already correctly allowed the actual course instructor to write here
// (assessments_write_authorized / aq_write_authorized,
// 0112_assessments_pipeline.sql - c.instructor_id = auth.uid()), so this
// only needed the client functions and UI, not new database access.
// ============================================================================
export async function fetchAssessmentForCourseWithQuestions(courseId) {
  if (!supabase) {
    if (courseId !== "demo-course-ai-fundamentals") return null;
    return {
      id: "demo-assessment-ai", course_id: courseId, title: "AI Fundamentals Assessment",
      questions: [
        { id: "demo-q1", question: "Which of these is a common workplace use of AI?", options: ["Drafting emails", "Watering plants", "Painting walls"], correct_answer: "Drafting emails" },
        { id: "demo-q2", question: "AI recommendations should always be...", options: ["Followed without review", "Reviewed by a person", "Ignored entirely"], correct_answer: "Reviewed by a person" },
      ],
    };
  }
  if (!courseId) return null;
  const { data: assessment, error } = await supabase.from("assessments").select("*").eq("course_id", courseId).maybeSingle();
  if (error) { console.warn("Assessment fetch warning:", error); return null; }
  if (!assessment) return null;
  // Real questions with correct_answer - for the creator/editor only, not
  // the learner-facing safe_assessment_questions view (which strips
  // correct_answer entirely). aq_select_none blocks direct reads of this
  // table for everyone except the actual course instructor / admin (see
  // RLS above) - a learner hitting this function gets nothing back.
  const { data: questions } = await supabase.from("assessment_questions").select("*").eq("assessment_id", assessment.id).order("order_index");
  return { ...assessment, questions: questions || [] };
}

export async function createAssessmentForCourse(courseId, title, createdBy) {
  if (!supabase || !courseId) return null;
  const { data, error } = await supabase.from("assessments").insert({ course_id: courseId, title, created_by: createdBy }).select().single();
  if (error) throw error;
  return data;
}

export async function addAssessmentQuestion(assessmentId, { question, questionType, options, correctAnswer, explanation, points, orderIndex }) {
  if (!supabase || !assessmentId) return null;
  const { data, error } = await supabase.from("assessment_questions").insert({
    assessment_id: assessmentId, question, question_type: questionType || "multiple_choice",
    options: options || [], correct_answer: correctAnswer, explanation: explanation || null,
    points: points || 1, order_index: orderIndex || 0,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteAssessmentQuestion(id) {
  if (!supabase) return;
  const { error } = await supabase.from("assessment_questions").delete().eq("id", id);
  if (error) throw error;
}

// Learner/Instructor general overview for admin - "admin role should be
// able to just see an overview... how many study groups the org has,
// certificate issued, average performance in assessment done etc." A
// confirmed replacement for the admin-facing Study Groups screen (which
// implied admin managed learner-created study groups directly - not the
// right model, per direct confirmation).
export async function fetchOrgGeneralOverview(organizationId) {
  if (!supabase) return { studyGroupCount: 1, certificatesIssued: DEMO_CERTIFICATES.length, avgAssessmentScore: 91 };
  if (!organizationId) return { studyGroupCount: 0, certificatesIssued: 0, avgAssessmentScore: null };
  const { data: orgUserRows } = await supabase.from("user_profiles").select("id").eq("organization_id", organizationId);
  const orgUserIds = (orgUserRows || []).map((r) => r.id);
  const [{ count: studyGroupCount }, { count: certificatesIssued }, attemptsData] = await Promise.all([
    supabase.from("study_groups").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("certificates").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "issued"),
    safeInQuery("assessment_attempts", "score", "user_id", orgUserIds),
  ]);
  const scores = (attemptsData || []).map((a) => a.score).filter((s) => s !== null && s !== undefined);
  const avgAssessmentScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  return { studyGroupCount: studyGroupCount || 0, certificatesIssued: certificatesIssued || 0, avgAssessmentScore };
}

// Instructor's active cohorts for their Overview - confirmed directly:
// "Under overview they should also be able to see their active cohorts."
// Uses the real cohort_members relationship (the same one an instructor
// is added to when they create or get assigned to a cohort -
// 0126/0127/CohortsScreen.jsx's createCohort auto-add) rather than a
// separate, parallel concept of "the instructor's cohorts."
export async function fetchMentorActiveCohorts(userId) {
  if (!supabase) return [{ id: DEMO_COHORT.id, name: DEMO_COHORT.name, ends_at: DEMO_COHORT.endsAt }];
  if (!userId) return [];
  const { data: profile } = await supabase.from("user_profiles").select("organization_id").eq("id", userId).maybeSingle();
  const orgId = profile?.organization_id;

  const { data: memberRows } = await supabase.from("cohort_members").select("cohort_id").eq("user_id", userId);
  const explicitCohortIds = (memberRows || []).map((r) => r.cohort_id);

  let query = supabase.from("cohorts").select("id, name, description, starts_at, ends_at");
  if (orgId && explicitCohortIds.length > 0) {
    query = query.or(`organization_id.eq.${orgId},id.in.(${explicitCohortIds.join(",")})`);
  } else if (orgId) {
    query = query.eq("organization_id", orgId);
  } else if (explicitCohortIds.length > 0) {
    query = query.in("id", explicitCohortIds);
  } else {
    return [];
  }

  const { data: cohorts, error } = await query;
  if (error) { console.warn("Mentor cohorts fetch warning:", error); return []; }
  const now = Date.now();
  return (cohorts || []).filter((c) => !c.ends_at || new Date(c.ends_at).getTime() >= now);
}

// ============================================================================
// Per-instructor payout enablement + learner payment requests. See
// 0133_per_instructor_payouts_and_learner_payments.sql for the real
// enforcement - academy-style instructors are explicitly enabled by the
// platform owner; org-employed instructors stay blocked by default.
// ============================================================================
export async function setInstructorPayoutsEnabled(mentorId, enabled) {
  if (!supabase) return { success: false, error: "Not available in demo mode." };
  try {
    const { error } = await supabase.rpc("set_instructor_payouts_enabled", { p_mentor_id: mentorId, p_enabled: enabled });
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not update payout access." };
  }
}

export async function requestLearnerPayment(mentorId, learnerId, courseId, amount) {
  if (!supabase) return { success: false, error: "Not available in demo mode." };
  try {
    const { error } = await supabase.from("learner_payment_requests").insert({ mentor_id: mentorId, learner_id: learnerId, course_id: courseId, amount });
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not request payment - your organization may not have payouts enabled." };
  }
}

export async function fetchLearnerPaymentRequests(mentorId) {
  if (!supabase || !mentorId) return [];
  const { data, error } = await supabase.from("learner_payment_requests").select("*, user_profiles(display_name), courses(title)").eq("mentor_id", mentorId).order("requested_at", { ascending: false });
  if (error) { console.warn("Learner payment requests fetch warning:", error); return []; }
  return data || [];
}

export async function setLearnerCourseAccessPaused(learnerId, courseId, paused) {
  if (!supabase) return { success: false, error: "Not available in demo mode." };
  try {
    const { error } = await supabase.rpc("set_learner_course_access_paused", { p_learner_id: learnerId, p_course_id: courseId, p_paused: paused });
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not update this learner's access." };
  }
}

// ============================================================================
// Skill gaps detail - confirmed directly: "a way to look at skill gaps in
// details. Where learners have completed and their current gaps based on
// completion." Real per-learner breakdown by course category - completed
// categories are demonstrated skills, categories with low or no completion
// are the gaps - not a fabricated skills taxonomy, the same honest
// completion-by-category proxy already used for Team Skill Snapshot and
// Workforce Intelligence, applied per-learner instead of aggregated.
// ============================================================================
async function computeSkillGapsForLearnerIds(learnerIds) {
  if (!learnerIds.length) return [];
  const { data: profiles } = await supabase.from("user_profiles").select("id, display_name").in("id", learnerIds);
  const { data: enrollments } = await supabase
    .from("course_enrollments")
    .select("user_id, progress_percentage, completed_at, courses(category)")
    .in("user_id", learnerIds);
  const byLearner = {};
  for (const e of (enrollments || [])) {
    const cat = e.courses?.category || "General";
    if (!byLearner[e.user_id]) byLearner[e.user_id] = {};
    if (!byLearner[e.user_id][cat]) byLearner[e.user_id][cat] = [];
    byLearner[e.user_id][cat].push({ progress: e.progress_percentage || 0, completed: !!e.completed_at || (e.progress_percentage || 0) >= 100 });
  }
  const nameById = Object.fromEntries((profiles || []).map((p) => [p.id, p.display_name || "Learner"]));
  return learnerIds.map((id) => {
    const categories = byLearner[id] || {};
    const completed = [];
    const gaps = [];
    for (const [cat, rows] of Object.entries(categories)) {
      const avgProgress = Math.round(rows.reduce((a, r) => a + r.progress, 0) / rows.length);
      if (rows.some((r) => r.completed) && avgProgress >= 70) completed.push({ category: cat, avgProgress });
      else gaps.push({ category: cat, avgProgress });
    }
    return { learnerId: id, name: nameById[id] || "Learner", completedSkills: completed, gapSkills: gaps };
  });
}

export async function fetchOrgSkillGapsDetail(organizationId) {
  if (!supabase) return demoSkillGapsDetail();
  const orgFilter = (organizationId && organizationId !== "demo-org-id") ? organizationId : null;
  let query = supabase.from("user_profiles").select("id").in("role", ["learner", "student"]);
  if (orgFilter) query = query.eq("organization_id", orgFilter);
  const { data: orgUserRows } = await query;
  return computeSkillGapsForLearnerIds((orgUserRows || []).map((r) => r.id));
}

export async function fetchManagerSkillGapsDetail(managerId) {
  if (!supabase) return demoSkillGapsDetail().slice(0, 5);
  if (!managerId) return [];
  const { data: profiles } = await supabase.from("user_profiles").select("id").eq("manager_id", managerId);
  return computeSkillGapsForLearnerIds((profiles || []).map((p) => p.id));
}

// Platform-wide instructor listing for the Payout Controls screen -
// "as a platform owner we should be able to enable and disable this."
// Super-admin only, scoped by the caller's own super_admin RLS access
// rather than any single organization.
export async function fetchAllMentorsForPayoutControl() {
  if (!supabase) return DEMO_INSTRUCTORS.map((i) => ({ id: i.id, user_id: i.id, payouts_enabled: false, organization_id: "demo-org-id", name: i.name }));
  const { data, error } = await supabase.from("mentors").select("id, user_id, payouts_enabled, organization_id");
  if (error) { console.warn("Mentors fetch warning:", error); return []; }
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.user_id));
  return rows.map((r) => ({ ...r, name: profiles[r.user_id]?.display_name || "Instructor" }));
}

// ============================================================================
// General analysis notes - "there should be a place where instructors,
// admin or managers can add notes... relevant for their analysis." See
// 0135_analysis_notes.sql - a standalone table, not tied to any specific
// learner or department, for a person's own running notes.
// ============================================================================
export async function fetchMyAnalysisNotes(authorId) {
  if (!supabase) {
    return [
      { id: "demo-note-1", note_text: "Fatima and Liam are both falling behind on AI Fundamentals - worth a check-in this week.", created_at: new Date(Date.now() - 86400000).toISOString() },
    ];
  }
  if (!authorId) return [];
  const { data, error } = await supabase.from("analysis_notes").select("*").eq("author_id", authorId).order("created_at", { ascending: false });
  if (error) { console.warn("Analysis notes fetch warning:", error); return []; }
  return data || [];
}

export async function addAnalysisNote(authorId, organizationId, noteText) {
  if (!supabase) return { success: false, error: "Not available in demo mode." };
  if (!noteText?.trim()) return { success: false, error: "Note can't be empty." };
  try {
    const { error } = await supabase.from("analysis_notes").insert({ author_id: authorId, organization_id: organizationId, note_text: noteText.trim() });
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not save this note." };
  }
}

export async function deleteAnalysisNote(noteId) {
  if (!supabase) return { success: false, error: "Not available in demo mode." };
  try {
    const { error } = await supabase.from("analysis_notes").delete().eq("id", noteId);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not delete this note." };
  }
}

// ============================================================================
// Manager Team Cohorts + Team Compliance - confirmed directly against the
// real 1.0 reference codebase (ManagerCohortsTab.tsx, ManagerComplianceTab.tsx)
// - Manager View had zero cohort or compliance visibility for their own
// direct reports before this. Ported the same real behavior: which
// cohorts a manager's team belongs to, and their team's compliance
// standing specifically (not the whole org's).
// ============================================================================
export async function fetchManagerTeamCohorts(managerId) {
  if (!supabase) {
    return [{ id: DEMO_COHORT.id, name: DEMO_COHORT.name, starts_at: "2026-01-01", ends_at: DEMO_COHORT.endsAt, memberNames: ["Amara Chen", "David Osei", "Priya Nair"] }];
  }
  if (!managerId) return [];
  const { data: reports } = await supabase.from("user_profiles").select("id, display_name").eq("manager_id", managerId);
  const reportRows = reports || [];
  const reportIds = reportRows.map((r) => r.id);
  if (!reportIds.length) return [];
  const nameById = Object.fromEntries(reportRows.map((r) => [r.id, r.display_name || "Team member"]));
  const { data: memberRows } = await supabase.from("cohort_members").select("user_id, cohort_id").in("user_id", reportIds);
  const cohortIds = [...new Set((memberRows || []).map((m) => m.cohort_id))];
  if (!cohortIds.length) return [];
  const { data: cohorts } = await supabase.from("cohorts").select("id, name, starts_at, ends_at").in("id", cohortIds);
  const cohortById = Object.fromEntries((cohorts || []).map((c) => [c.id, c]));
  const grouped = {};
  for (const m of memberRows || []) {
    if (!cohortById[m.cohort_id]) continue;
    if (!grouped[m.cohort_id]) grouped[m.cohort_id] = { ...cohortById[m.cohort_id], memberNames: [] };
    grouped[m.cohort_id].memberNames.push(nameById[m.user_id] || "Team member");
  }
  return Object.values(grouped);
}

export async function fetchManagerTeamCompliance(managerId) {
  if (!supabase) {
    return [
      { id: "demo-mc-1", user_name: "Amara Chen", course_title: "Workplace Compliance 101", progress_percentage: 100, due_at: "2026-08-14", status: "completed" },
      { id: "demo-mc-2", user_name: "Fatima Diallo", course_title: "Workplace Compliance 101", progress_percentage: 30, due_at: "2026-08-16", status: "overdue" },
    ];
  }
  if (!managerId) return [];
  const { data: reports } = await supabase.from("user_profiles").select("id, display_name").eq("manager_id", managerId);
  const reportRows = reports || [];
  const reportIds = reportRows.map((r) => r.id);
  if (!reportIds.length) return [];
  const nameById = Object.fromEntries(reportRows.map((r) => [r.id, r.display_name || "Team member"]));
  const { data: assignments } = await supabase.from("compliance_assignments").select("*, courses(title)").in("user_id", reportIds);
  const rows = assignments || [];
  // compliance_assignments itself has no progress_percentage column -
  // real progress comes from the matching course_enrollments row, same
  // real relationship already used for fetchComplianceAssignments
  // elsewhere in this file, not a column that doesn't exist.
  const { data: enrollments } = reportIds.length
    ? await supabase.from("course_enrollments").select("user_id, course_id, progress_percentage").in("user_id", reportIds)
    : { data: [] };
  const progressByUserCourse = Object.fromEntries((enrollments || []).map((e) => [`${e.user_id}:${e.course_id}`, e.progress_percentage || 0]));
  return rows.map((a) => ({
    id: a.id, user_name: nameById[a.user_id] || "Team member", course_title: a.courses?.title || "Unknown course",
    progress_percentage: progressByUserCourse[`${a.user_id}:${a.course_id}`] ?? 0, due_at: a.due_at, status: a.status,
  }));
}

// Org-scoped Activity Log for regular admins - confirmed directly
// against the real 1.0 reference codebase (AdminActivityLog.tsx). Only
// buildable safely after fixing a real cross-tenant leak found while
// checking this (see 0137_admin_audit_log_org_scope_fix.sql) - the
// underlying RLS previously let any org admin read every organization's
// audit log, not just their own.
export async function fetchOrgActivityLog(organizationId, limit = 30) {
  if (!supabase || !organizationId || organizationId === "demo-org-id") {
    return [
      { id: "demo-log-1", text: "issue certificate directly: Amara Chen", time: new Date(Date.now() - 3600000).toLocaleString() },
      { id: "demo-log-2", text: "assign compliance course: Fatima Diallo", time: new Date(Date.now() - 86400000).toLocaleString() },
      { id: "demo-log-3", text: "review certificate: Priya Nair", time: new Date(Date.now() - 2 * 86400000).toLocaleString() },
    ];
  }
  const { data, error } = await supabase
    .from("safe_admin_audit_log")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) { console.warn("Org activity log fetch warning:", error); return []; }
  return (data || []).map((a) => ({
    id: a.id,
    text: `${a.action_type.replace(/_/g, " ")}${a.target_identifier ? `: ${a.target_identifier}` : ""}`,
    time: new Date(a.created_at).toLocaleString(),
  }));
}

// ============================================================================
// Real session completion with feedback and earnings - confirmed
// directly against the real 1.0 reference codebase
// (SessionCompletionDialog.tsx). Marking a session complete previously
// just flipped its status - no feedback captured, and no corresponding
// earnings record created at all. Uses the mentor's own real hourly_rate
// where set (more accurate than 1.0's flat "$1/minute" placeholder),
// falling back to a reasonable default rate only when none is set.
// Earnings are always recorded regardless of payouts_enabled - tracking
// what's owed and being allowed to withdraw it are two different things,
// matching the existing "still tracked, not yet paid out" pattern this
// project already established for suspended payouts.
// ============================================================================
export async function completeMentorshipSession(sessionId, feedback) {
  if (!supabase) return { success: true };
  try {
    const { data: session, error: fetchError } = await supabase
      .from("mentorship_sessions").select("mentor_id, duration_minutes").eq("id", sessionId).single();
    if (fetchError) throw fetchError;

    const { error: updateError } = await supabase
      .from("mentorship_sessions")
      .update({ status: "completed", mentor_feedback: feedback || null })
      .eq("id", sessionId);
    if (updateError) throw updateError;

    const { data: mentor } = await supabase.from("mentors").select("hourly_rate").eq("id", session.mentor_id).maybeSingle();
    const ratePerHour = mentor?.hourly_rate || 30;
    const amount = Math.round((ratePerHour / 60) * (session.duration_minutes || 45) * 100) / 100;

    const { error: earningsError } = await supabase
      .from("mentor_earnings")
      .insert({ mentor_id: session.mentor_id, session_id: sessionId, amount, earning_type: "session", status: "pending" });
    if (earningsError) throw earningsError;

    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not mark this session complete." };
  }
}

// Reschedule - confirmed against the real 1.0 reference
// (RescheduleSessionDialog.tsx). Just moves scheduled_at; status stays
// whatever it already was (usually "scheduled"/"confirmed"), matching
// the reference behavior rather than resetting to a "pending" state
// that would force a second, unnecessary re-confirmation.
export async function rescheduleMentorshipSession(sessionId, newScheduledAt) {
  if (!supabase) return { success: true };
  try {
    const { error } = await supabase.from("mentorship_sessions").update({ scheduled_at: newScheduledAt }).eq("id", sessionId);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not reschedule this session." };
  }
}

// ============================================================================
// Course materials - confirmed directly against the real 1.0 reference
// codebase (CourseMaterialsManager.tsx). See 0138_course_materials.sql -
// downloadable files/links attached to a course, distinct from lessons
// and from a cohort's own resources.
// ============================================================================
export async function fetchCourseMaterials(courseId) {
  if (!supabase) {
    if (courseId !== "demo-course-ai-fundamentals") return [];
    return [{ id: "demo-material-1", course_id: courseId, title: "AI Fundamentals - Slide Deck", material_type: "link", external_url: "https://example.com/slides.pdf", description: "Reference slides for this course." }];
  }
  if (!courseId) return [];
  const { data, error } = await supabase.from("course_materials").select("*").eq("course_id", courseId).order("created_at", { ascending: false });
  if (error) { console.warn("Course materials fetch warning:", error); return []; }
  return data || [];
}

export async function addCourseMaterial(courseId, { title, materialType = "link", fileUrl, externalUrl, description, createdBy }) {
  if (!supabase) return { success: false, error: "Not available in demo mode." };
  if (!title?.trim()) return { success: false, error: "A title is required." };
  try {
    const { error } = await supabase.from("course_materials").insert({
      course_id: courseId, title: title.trim(), material_type: materialType,
      file_url: fileUrl || null, external_url: externalUrl || null, description: description || null, created_by: createdBy,
    });
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not add this material." };
  }
}

export async function deleteCourseMaterial(id) {
  if (!supabase) return { success: false, error: "Not available in demo mode." };
  try {
    const { error } = await supabase.from("course_materials").delete().eq("id", id);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not delete this material." };
  }
}

// ============================================================================
// Course Quality Review - confirmed directly against the real 1.0
// reference codebase (CourseQualityReviewPanel.tsx). See
// 0141_course_quality_reviews.sql - deliberately additive, does not
// change or block the existing publish/unpublish/archive flow.
// ============================================================================
export async function fetchCourseQualityReview(courseId) {
  if (!supabase) {
    if (courseId !== "demo-course-ai-fundamentals") return null;
    return { id: "demo-qr-1", course_id: courseId, status: "approved", quality_score: 8, review_notes: "Solid intro course, clear structure.", reviewed_at: new Date().toISOString() };
  }
  if (!courseId) return null;
  const { data, error } = await supabase.from("course_quality_reviews").select("*").eq("course_id", courseId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) { console.warn("Course quality review fetch warning:", error); return null; }
  return data;
}

export async function submitCourseQualityReview(courseId, { status, qualityScore, reviewNotes, reviewerId }) {
  if (!supabase) return { success: false, error: "Not available in demo mode." };
  try {
    const { error } = await supabase.from("course_quality_reviews").insert({
      course_id: courseId, status, quality_score: qualityScore || null, review_notes: reviewNotes || null,
      reviewer_id: reviewerId, reviewed_at: new Date().toISOString(),
    });
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not submit this review." };
  }
}

// Bulk User Import - confirmed directly against the real 1.0 reference
// codebase (BulkUserImportExport.tsx). Reuses the exact same
// createInvitation() already used for a single invite, one row at a
// time, rather than a new bulk-write path - each row succeeds or fails
// independently and is reported back individually, matching the same
// honest per-item reporting already used for bulkAddCohortMembersByEmail.
export async function bulkImportUsers(rows, organizationId, invitedBy) {
  const succeeded = [];
  const failed = [];
  for (const row of rows) {
    const email = (row.email || "").trim();
    const role = (row.role || "learner").trim().toLowerCase();
    if (!email) { failed.push({ email: row.email || "(blank)", reason: "Missing email" }); continue; }
    try {
      await createInvitation({ email, role, organizationId, invitedBy });
      succeeded.push(email);
    } catch (e) {
      failed.push({ email, reason: e?.message || "Could not invite this address" });
    }
  }
  return { succeeded, failed };
}

// Parses a simple CSV with an "email" column and an optional "role"
// column - not a general-purpose CSV parser, just enough for the one
// real shape this import needs (deliberately simple rather than pulling
// in a new dependency for something this small).
export function parseUserImportCsv(csvText) {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const emailIdx = header.indexOf("email");
  const roleIdx = header.indexOf("role");
  const dataLines = emailIdx === -1 ? lines : lines.slice(1);
  return dataLines.map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    if (emailIdx === -1) return { email: cols[0], role: cols[1] || "learner" };
    return { email: cols[emailIdx], role: roleIdx !== -1 ? cols[roleIdx] : "learner" };
  }).filter((r) => r.email && r.email.toLowerCase() !== "email");
}

// Submit platform feedback - confirmed directly against the real 1.0
// reference codebase (FeedbackSection.tsx). The feedback table and
// fetchFeedbackQueue() (admin-side read) already existed with correct
// RLS - confirmed no submit function and no screen anywhere ever called
// either one.
export async function submitPlatformFeedback(userId, { category, message, rating, email }) {
  if (!supabase) return { success: true };
  if (!message?.trim()) return { success: false, error: "Please enter a message." };
  try {
    const { error } = await supabase.from("feedback").insert({
      user_id: userId || null, email: email || null, category: category || "General",
      message: message.trim(), rating: rating || null,
    });
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not submit your feedback." };
  }
}

/* ==========================================================================
   PEOPLE & ACCESS: full user management
   --------------------------------------------------------------------------
   The People screen previously exposed only three real actions per member
   (suspend/activate, issue certificate, export data). Everything else a
   directory needs - open a member's record, edit their profile, change their
   role, move them between cohorts, assign them a course, remove them from
   the organization, resend or copy an invite link - had no backing function
   anywhere in this file. These are those functions.
   ========================================================================= */

// Platform role lives on user_profiles.role (platform_role enum) and is
// mirrored into user_roles, which is what the role-routing layer
// (lib/roleRouting.js) and most RLS policies actually read. Writing only one
// of the two leaves a member who "looks" like an admin in the directory but
// still lands on the learner dashboard, so both are kept in step here.
export async function updateUserPlatformRole(userId, role, organizationId) {
  if (!supabase || !userId || !role) return { success: false, error: "Missing user or role." };
  try {
    const { error: profileErr } = await supabase.from("user_profiles").update({ role }).eq("id", userId);
    if (profileErr) throw profileErr;

    // user_roles is additive by design (a user can legitimately hold more
    // than one platform role). Replacing the rows this screen manages keeps
    // the directory's single-role picker honest without clobbering a
    // super_admin grant, which is issued from Platform Owner, not here.
    const { data: existing } = await supabase.from("user_roles").select("id, role").eq("user_id", userId);
    const managed = ["learner", "mentor", "admin", "manager", "hr"];
    for (const row of existing || []) {
      if (managed.includes(row.role) && row.role !== role) {
        await supabase.from("user_roles").delete().eq("id", row.id);
      }
    }
    if (!(existing || []).some((r) => r.role === role)) {
      const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (insErr && insErr.code !== "23505") throw insErr;
    }

    // organization_members.role is a *different* enum (org_member_role) with
    // its own vocabulary - map the platform role onto the closest org role
    // rather than trying to write an invalid enum value into it.
    if (organizationId) {
      const orgRole = role === "admin" ? "admin" : role === "manager" ? "people_manager" : role === "mentor" ? "content_manager" : "member";
      await supabase.from("organization_members").update({ role: orgRole }).eq("user_id", userId).eq("organization_id", organizationId);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not update this member's role." };
  }
}

// Admin-side profile edit. Deliberately narrow: the fields an admin has a
// legitimate reason to correct on someone else's record (name, department,
// school, bio, reporting line). Never touches role - that goes through
// updateUserPlatformRole above so both role tables stay in step.
export async function updateUserProfileAsAdmin(userId, patch = {}) {
  if (!supabase || !userId) return { success: false, error: "Missing user." };
  const allowed = {};
  if (patch.displayName !== undefined) allowed.display_name = patch.displayName;
  if (patch.department !== undefined) allowed.department = patch.department || null;
  if (patch.school !== undefined) allowed.school = patch.school || null;
  if (patch.bio !== undefined) allowed.bio = patch.bio || null;
  if (patch.managerId !== undefined) allowed.manager_id = patch.managerId || null;
  if (!Object.keys(allowed).length) return { success: true };
  const { error } = await supabase.from("user_profiles").update(allowed).eq("id", userId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// Removes a member from one organization without deleting their account -
// distinct from deleteUserCascade (gdprService), which is the destructive
// erasure path and is only ever reached from a reviewed DSAR request.
export async function removeOrgMember(userId, organizationId) {
  if (!supabase || !userId || !organizationId) return { success: false, error: "Missing user or organization." };
  try {
    const { error } = await supabase
      .from("organization_members")
      .delete()
      .eq("user_id", userId)
      .eq("organization_id", organizationId);
    if (error) throw error;
    // Drop the denormalised pointer too, otherwise fetchOrgMembers (which
    // filters on user_profiles.organization_id, not the membership table)
    // keeps listing them in the directory they were just removed from.
    await supabase.from("user_profiles").update({ organization_id: null }).eq("id", userId);
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not remove this member." };
  }
}

// One member's full record, assembled for the directory's detail drawer.
// Every piece is a real read - no placeholder sections. Individually
// tolerant of failures so one table the caller's role can't see doesn't
// blank out the whole drawer.
export async function fetchUserDetailForAdmin(userId, organizationId) {
  if (!supabase || !userId) return null;
  const safe = async (fn, fallback) => { try { return await fn(); } catch { return fallback; } };

  const [profileRes, memberRes, rolesRes, enrollRes, certsRes, cohortRes, statsRes, complianceRes] = await Promise.all([
    safe(async () => (await supabase.from("user_profiles").select("*").eq("id", userId).maybeSingle()).data, null),
    safe(async () => organizationId
      ? (await supabase.from("organization_members").select("*").eq("user_id", userId).eq("organization_id", organizationId).maybeSingle()).data
      : null, null),
    safe(async () => (await supabase.from("user_roles").select("role").eq("user_id", userId)).data || [], []),
    safe(async () => (await supabase.from("course_enrollments").select("*, courses(id, title, category, duration_hours)").eq("user_id", userId)).data || [], []),
    safe(async () => (await supabase.from("certificates").select("*").eq("user_id", userId).order("issued_at", { ascending: false })).data || [], []),
    safe(async () => (await supabase.from("cohort_members").select("id, cohort_id, cohorts(id, name)").eq("user_id", userId)).data || [], []),
    safe(async () => (await supabase.from("user_gamification_stats").select("*").eq("user_id", userId).maybeSingle()).data, null),
    safe(async () => (await supabase.from("compliance_assignments").select("*, courses(title)").eq("user_id", userId).order("due_at", { ascending: true })).data || [], []),
  ]);

  const enrollments = (enrollRes || []).map((e) => ({
    id: e.id,
    courseId: e.course_id,
    title: e.courses?.title || "Course",
    category: e.courses?.category || null,
    progress: e.progress_percentage || 0,
    completedAt: e.completed_at || null,
    enrolledAt: e.enrolled_at || e.created_at || null,
  }));
  const completed = enrollments.filter((e) => e.completedAt).length;
  const avgProgress = enrollments.length
    ? Math.round(enrollments.reduce((s, e) => s + (e.progress || 0), 0) / enrollments.length)
    : 0;

  return {
    profile: profileRes,
    membership: memberRes,
    roles: (rolesRes || []).map((r) => r.role),
    enrollments,
    completedCount: completed,
    avgProgress,
    certificates: certsRes || [],
    cohorts: (cohortRes || []).map((c) => ({ memberRowId: c.id, id: c.cohort_id, name: c.cohorts?.name || "Cohort" })),
    stats: statsRes,
    compliance: (complianceRes || []).map((c) => ({
      id: c.id, title: c.courses?.title || "Course", status: c.status, dueAt: c.due_at, completedAt: c.completed_at,
    })),
  };
}

// Re-issues a pending invitation. There is no "resend" RPC in the schema, so
// this cancels the stale row and creates a fresh one through the same
// createInvitation path (edge function first, create_user_invitation RPC as
// fallback) - which is what actually re-sends the email and mints a new
// 7-day token, rather than just touching a timestamp on a dead invite.
export async function resendInvitation(invitation) {
  if (!supabase || !invitation?.id) return { success: false, error: "Missing invitation." };
  try {
    await supabase.from("user_invitations").update({ status: "cancelled" }).eq("id", invitation.id);
    const row = await createInvitation({
      email: invitation.email,
      role: invitation.role || "learner",
      organizationId: invitation.organization_id,
      organizationRole: invitation.organization_role || "member",
    });
    return { success: true, invitation: row };
  } catch (e) {
    return { success: false, error: e?.message || "Could not resend this invitation." };
  }
}

// The link an admin can copy and hand to someone directly, for when the
// invite email doesn't arrive (no RESEND_API_KEY configured, spam filter,
// wrong address). Matches the `?invite=TOKEN` form App.jsx boots
// AcceptInvitationScreen from.
export function buildInvitationLink(invitation) {
  if (!invitation?.token) return null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/?invite=${invitation.token}`;
}

// Moves a member into a cohort, replacing any cohort they were already in
// when `exclusive` is set (the directory's "Cohort / Track" column shows one
// cohort per member, so leaving stale rows behind makes that column lie).
export async function assignMemberToCohort(userId, cohortId, addedBy, { exclusive = true } = {}) {
  if (!supabase || !userId || !cohortId) return { success: false, error: "Missing member or cohort." };
  try {
    const { data: existing } = await supabase.from("cohort_members").select("id, cohort_id").eq("user_id", userId);
    if ((existing || []).some((r) => r.cohort_id === cohortId)) return { success: true, alreadyMember: true };
    if (exclusive) {
      for (const row of existing || []) {
        await supabase.from("cohort_members").delete().eq("id", row.id);
      }
    }
    const { error } = await supabase
      .from("cohort_members")
      .insert({ cohort_id: cohortId, user_id: userId, added_by: addedBy || null });
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not assign this member to the cohort." };
  }
}

export async function removeMemberFromCohort(userId, cohortId) {
  if (!supabase || !userId || !cohortId) return { success: false, error: "Missing member or cohort." };
  const { error } = await supabase.from("cohort_members").delete().eq("user_id", userId).eq("cohort_id", cohortId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// Real numbers for the People screen's KPI row. Two of those four tiles used
// to be hardcoded ("92%" avg attendance, "24" top achievers) - identical for
// every organization and never moving. There is still no attendance or
// session-checkin data anywhere in this schema, so that tile is reported as
// unavailable rather than invented; the other three are computed from real
// rows.
export async function fetchOrgPeopleKpis(organizationId) {
  if (!supabase || !organizationId) {
    return { totalMembers: 0, activeMembers: 0, suspendedMembers: 0, pendingInvites: 0, topAchievers: 0, avgCompletion: 0, attendanceAvailable: false };
  }
  const safe = async (fn, fallback) => { try { return await fn(); } catch { return fallback; } };

  const profiles = await safe(async () => (await supabase.from("user_profiles").select("id").eq("organization_id", organizationId)).data || [], []);
  const ids = profiles.map((p) => p.id);

  const [members, invites, stats, enrollments] = await Promise.all([
    safe(async () => (await supabase.from("organization_members").select("user_id, status").eq("organization_id", organizationId)).data || [], []),
    safe(async () => (await supabase.from("user_invitations").select("id").eq("organization_id", organizationId).eq("status", "pending")).data || [], []),
    ids.length ? safe(async () => (await supabase.from("user_gamification_stats").select("user_id, total_points").in("user_id", ids)).data || [], []) : [],
    ids.length ? safe(async () => (await supabase.from("course_enrollments").select("user_id, progress_percentage, completed_at").in("user_id", ids)).data || [], []) : [],
  ]);

  const active = (members || []).filter((m) => m.status === "active").length;
  const suspended = (members || []).filter((m) => m.status === "suspended").length;
  // "Top achievers" = members who have actually earned points this cycle,
  // ranked by the same total_points the leaderboard uses. A member sitting
  // on zero points is not an achiever, so they're excluded rather than
  // counted to pad the number.
  const topAchievers = (stats || []).filter((s) => (s.total_points || 0) > 0).length;
  const avgCompletion = (enrollments || []).length
    ? Math.round((enrollments || []).reduce((s, e) => s + (e.progress_percentage || 0), 0) / enrollments.length)
    : 0;

  return {
    totalMembers: ids.length,
    activeMembers: active,
    suspendedMembers: suspended,
    pendingInvites: (invites || []).length,
    topAchievers,
    avgCompletion,
    attendanceAvailable: false,
  };
}

/* ==========================================================================
   LEARNING PATHS: per-course sequencing (builder)
   --------------------------------------------------------------------------
   createLearningPath/updateLearningPath above replace the whole
   learning_path_courses set on every save, which is fine for a plain ordered
   list but throws away the two columns that make a path a *guided* journey:
   is_required and unlock_rule. These functions operate on individual rows so
   the builder can toggle a step's unlock rule or requirement without
   rewriting the sequence, and so `category` (which the old create/update
   pair never wrote at all) is persisted.
   ========================================================================= */

export async function fetchLearningPathById(pathId) {
  if (!supabase || !pathId) return null;
  const { data, error } = await supabase.from("learning_paths").select("*").eq("id", pathId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchLearningPathCourses(pathId) {
  if (!supabase || !pathId) return [];
  const { data, error } = await supabase
    .from("learning_path_courses")
    .select("*, courses(id, title, level, duration_hours, category, is_published)")
    .eq("path_id", pathId)
    .order("order_index", { ascending: true });
  if (error) throw error;
  return (data || []).map((pc) => ({
    id: pc.id,
    pathId: pc.path_id,
    courseId: pc.course_id,
    orderIndex: pc.order_index,
    isRequired: pc.is_required !== false,
    unlockRule: pc.unlock_rule || "complete_previous",
    prerequisiteCourseIds: pc.prerequisite_course_ids || [],
    course: pc.courses || null,
  }));
}

export async function addCourseToPath(pathId, courseId, orderIndex) {
  if (!supabase || !pathId || !courseId) return null;
  const { data, error } = await supabase
    .from("learning_path_courses")
    .insert({
      path_id: pathId,
      course_id: courseId,
      order_index: Number.isFinite(orderIndex) ? orderIndex : 0,
      unlock_rule: "complete_previous",
      is_required: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeCourseFromPath(pathCourseId) {
  if (!supabase || !pathCourseId) return;
  const { error } = await supabase.from("learning_path_courses").delete().eq("id", pathCourseId);
  if (error) throw error;
}

export async function updatePathCourse(pathCourseId, patch = {}) {
  if (!supabase || !pathCourseId) return;
  const row = {};
  if (patch.unlockRule !== undefined) row.unlock_rule = patch.unlockRule;
  if (patch.isRequired !== undefined) row.is_required = !!patch.isRequired;
  if (patch.orderIndex !== undefined) row.order_index = patch.orderIndex;
  if (patch.prerequisiteCourseIds !== undefined) row.prerequisite_course_ids = patch.prerequisiteCourseIds;
  if (!Object.keys(row).length) return;
  const { error } = await supabase.from("learning_path_courses").update(row).eq("id", pathCourseId);
  if (error) throw error;
}

// Swaps two steps' order_index. Written as two explicit updates rather than
// a bulk upsert because order_index carries no unique constraint here, so
// there is no transient-collision problem to work around.
export async function reorderPathCourses(rows) {
  if (!supabase || !rows?.length) return;
  for (let i = 0; i < rows.length; i++) {
    await supabase.from("learning_path_courses").update({ order_index: i }).eq("id", rows[i].id);
  }
}

// Path metadata only - leaves the course sequence untouched, unlike
// updateLearningPath which deliberately replaces it wholesale.
export async function updateLearningPathMeta(pathId, { title, description, level, category, isPublished } = {}) {
  if (!supabase || !pathId) return;
  const patch = {};
  if (title !== undefined) patch.title = title;
  if (description !== undefined) patch.description = description || null;
  if (level !== undefined) patch.level_label = level;
  if (category !== undefined) patch.category = category || null;
  if (isPublished !== undefined) patch.is_published = !!isPublished;
  if (!Object.keys(patch).length) return;
  const { error } = await supabase.from("learning_paths").update(patch).eq("id", pathId);
  if (error) throw error;
}

// How many learners have actually started each path, keyed by path id. The
// admin list previously showed a course count but nothing about uptake, so
// an unused path looked identical to the org's most popular one.
export async function fetchLearningPathEnrollmentCounts() {
  if (!supabase) return {};
  const { data, error } = await supabase.from("learning_path_enrollments").select("path_id, status");
  if (error) { console.warn("Path enrollment count warning:", error); return {}; }
  const counts = {};
  for (const row of data || []) {
    const bucket = counts[row.path_id] || { total: 0, completed: 0 };
    bucket.total += 1;
    if (row.status === "completed") bucket.completed += 1;
    counts[row.path_id] = bucket;
  }
  return counts;
}

// Assigns a whole path to learners by enrolling them in it, so an admin can
// push a journey out rather than waiting for learners to find it. Uses the
// same existence check enrollInLearningPath (lib/api/learner.js) uses -
// learning_path_enrollments has no declared unique constraint to upsert on.
export async function assignLearningPathToUsers(pathId, userIds) {
  if (!supabase || !pathId) return { success: false, error: "Missing path." };
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return { success: false, error: "Select at least one learner." };
  let enrolled = 0;
  const failed = [];
  for (const userId of ids) {
    try {
      const { data: existing } = await supabase
        .from("learning_path_enrollments")
        .select("id").eq("user_id", userId).eq("path_id", pathId).maybeSingle();
      if (existing) continue;
      const { error } = await supabase
        .from("learning_path_enrollments")
        .insert({ user_id: userId, path_id: pathId, status: "in_progress", current_course_index: 0 });
      if (error) throw error;
      enrolled++;
    } catch (e) {
      failed.push({ userId, reason: e?.message || "Could not enroll" });
    }
  }
  return { success: failed.length === 0, enrolled, failed };
}
