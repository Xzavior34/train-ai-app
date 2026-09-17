import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=== STEP 1: FIND ALL REAL INSTRUCTORS & MENTORS IN DB ===");

  // 1. Fetch all user_profiles
  const { data: profiles, error: pErr } = await supabase.from("user_profiles").select("*");
  console.log("Total user_profiles:", profiles?.length, pErr);

  // 2. Fetch all auth users
  let allAuthUsers = [];
  let page = 1;
  while (true) {
    const { data: res } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    const users = res?.users || [];
    if (!users.length) break;
    allAuthUsers = allAuthUsers.concat(users);
    if (users.length < 1000) break;
    page++;
  }

  // Filter out demo academy emails & IDs
  const realAuthUsers = allAuthUsers.filter(u => {
    const email = (u.email || "").toLowerCase();
    const id = u.id || "";
    return !id.startsWith("d0000000-") &&
      !email.endsWith("@demoacademy.sample") &&
      !email.includes("demoacademy") &&
      !email.endsWith("@sample") &&
      !email.endsWith(".sample");
  });
  const realAuthUserIds = new Set(realAuthUsers.map(u => u.id));

  const realProfiles = (profiles || []).filter(p => realAuthUserIds.has(p.id));
  console.log(`Real user_profiles count: ${realProfiles.length}`);

  // 3. Find candidates for instructors in user_profiles by role, title, department, or courses created
  const instructorProfilesByRole = realProfiles.filter(p => {
    const r = (p.role || "").toLowerCase();
    return r === "mentor" || r === "instructor" || r === "admin" || r === "super_admin" || r === "manager" || r === "teacher";
  });

  console.log("\nProfiles with instructor/admin/manager role:");
  console.table(instructorProfilesByRole.map(p => ({
    id: p.id,
    display_name: p.display_name,
    role: p.role,
    organization_id: p.organization_id,
    department: p.department,
    school: p.school
  })));

  // 4. Check courses table for instructor_id or created_by
  const { data: courses } = await supabase.from("courses").select("id, title, instructor_id, created_at");
  console.log("\nCourses and their instructor_ids:");
  console.table(courses || []);

  const courseInstructorIds = new Set((courses || []).map(c => c.instructor_id).filter(id => id && realAuthUserIds.has(id)));
  console.log("\nReal User IDs in courses.instructor_id:", Array.from(courseInstructorIds));

  // 5. Check mentors table
  const { data: existingMentors } = await supabase.from("mentors").select("*");
  console.log("\nExisting mentors table rows:");
  console.table(existingMentors || []);

  // 6. Check user_profiles with non-null department or title or any instructor markers
  const allPotentialInstructorIds = new Set([
    ...instructorProfilesByRole.map(p => p.id),
    ...Array.from(courseInstructorIds),
    ...(existingMentors || []).map(m => m.user_id).filter(id => realAuthUserIds.has(id))
  ]);

  console.log("\nAll candidate instructor/mentor user IDs:", Array.from(allPotentialInstructorIds));
  const candidateProfiles = realProfiles.filter(p => allPotentialInstructorIds.has(p.id));
  console.table(candidateProfiles.map(p => ({
    id: p.id,
    display_name: p.display_name,
    role: p.role,
    department: p.department,
    school: p.school
  })));
}

main().catch(console.error);
