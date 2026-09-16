import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log("=== PHASE 3 & 4: ADMIN EXPERIENCE, COURSES & COHORTS ===");
  const testRunId = Date.now().toString(36);

  // 1. Setup New Organization
  const orgSlug = `pilot-academy-${testRunId}`;
  const orgName = `Pilot Academy ${testRunId}`;
  console.log(`\n1. Setting up Organization: ${orgName}`);

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .insert({
      name: orgName,
      slug: orgSlug,
      subscription_tier: "growth",
      max_users: 10,
      status: "active",
      settings: { ai_coach: { enabled: true, manual_mode: false } }
    })
    .select()
    .single();

  if (orgErr) {
    console.error("Org creation error:", orgErr);
    return;
  }

  // 2. Setup Admin, Mentor, and 2 Learners
  console.log(`\n2. Creating Admin, Mentor, and 2 Learners`);
  const adminRes = await supabase.auth.admin.createUser({
    email: `admin-${testRunId}@pilotacademy.com`,
    password: "Password123!Secure",
    email_confirm: true,
    user_metadata: { display_name: "Pilot Admin", role: "admin" }
  });
  const adminId = adminRes.data.user.id;
  await supabase.from("user_profiles").upsert({ id: adminId, display_name: "Pilot Admin", role: "admin", organization_id: org.id });
  await supabase.from("user_roles").upsert({ user_id: adminId, role: "admin" });
  await supabase.from("organization_members").upsert({ organization_id: org.id, user_id: adminId, role: "admin", status: "active" });

  const mentorRes = await supabase.auth.admin.createUser({
    email: `mentor-${testRunId}@pilotacademy.com`,
    password: "Password123!Secure",
    email_confirm: true,
    user_metadata: { display_name: "Pilot Instructor", role: "mentor" }
  });
  const mentorId = mentorRes.data.user.id;
  await supabase.from("user_profiles").upsert({ id: mentorId, display_name: "Pilot Instructor", role: "mentor", organization_id: org.id });
  await supabase.from("user_roles").upsert({ user_id: mentorId, role: "mentor" });
  await supabase.from("organization_members").upsert({ organization_id: org.id, user_id: mentorId, role: "member", status: "active" });
  await supabase.from("mentors").upsert({ user_id: mentorId, organization_id: org.id, name: "Pilot Instructor", status: "approved" });

  const learnerRes1 = await supabase.auth.admin.createUser({
    email: `learner1-${testRunId}@pilotacademy.com`,
    password: "Password123!Secure",
    email_confirm: true,
    user_metadata: { display_name: "Pilot Learner 1", role: "learner" }
  });
  const learner1Id = learnerRes1.data.user.id;
  await supabase.from("user_profiles").upsert({ id: learner1Id, display_name: "Pilot Learner 1", role: "learner", organization_id: org.id });
  await supabase.from("user_roles").upsert({ user_id: learner1Id, role: "learner" });
  await supabase.from("organization_members").upsert({ organization_id: org.id, user_id: learner1Id, role: "member", status: "active" });

  const learnerRes2 = await supabase.auth.admin.createUser({
    email: `learner2-${testRunId}@pilotacademy.com`,
    password: "Password123!Secure",
    email_confirm: true,
    user_metadata: { display_name: "Pilot Learner 2", role: "learner" }
  });
  const learner2Id = learnerRes2.data.user.id;
  await supabase.from("user_profiles").upsert({ id: learner2Id, display_name: "Pilot Learner 2", role: "learner", organization_id: org.id });
  await supabase.from("user_roles").upsert({ user_id: learner2Id, role: "learner" });
  await supabase.from("organization_members").upsert({ organization_id: org.id, user_id: learner2Id, role: "member", status: "active" });

  console.log("Users provisioned: Admin, Mentor, Learner 1, Learner 2");

  // 3. Admin creates a course
  console.log(`\n3. Admin creates Course & Lessons`);
  const { data: course, error: cErr } = await supabase
    .from("courses")
    .insert({
      title: "Foundations of AI & Prompt Engineering",
      description: "Master AI workflows, prompts, and evaluation.",
      category: "Artificial Intelligence",
      level: "intermediate",
      is_published: true,
      duration_hours: 10,
      instructor_id: mentorId
    })
    .select()
    .single();

  if (cErr) {
    console.error("Error creating course:", cErr);
    return;
  }
  console.log("Course created:", { id: course.id, title: course.title, published: course.is_published });

  // Add 2 Lessons
  const { data: lesson1 } = await supabase
    .from("lessons")
    .insert({
      course_id: course.id,
      title: "Lesson 1: Introduction to LLMs",
      description: "Understand model architecture and tokenization.",
      content: "LLMs predict the next token based on statistical probabilities.",
      order_index: 1,
      duration_minutes: 30,
      is_published: true
    })
    .select()
    .single();

  const { data: lesson2 } = await supabase
    .from("lessons")
    .insert({
      course_id: course.id,
      title: "Lesson 2: Advanced Prompting Techniques",
      description: "Few-shot, chain-of-thought, and system prompts.",
      content: "Structured prompt patterns drastically improve reliability.",
      order_index: 2,
      duration_minutes: 45,
      is_published: true
    })
    .select()
    .single();

  console.log("Lessons created:", [lesson1?.title, lesson2?.title]);

  // 4. Admin creates Cohort & assigns course + mentor + learners
  console.log(`\n4. Admin creates Cohort and enrolls learners`);
  const { data: cohort, error: cohErr } = await supabase
    .from("cohorts")
    .insert({
      organization_id: org.id,
      name: "Q3 2026 AI Fellows",
      description: "Intensive 6-week cohort on AI foundations",
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 45 * 24 * 3600 * 1000).toISOString(),
      created_by: adminId
    })
    .select()
    .single();

  if (cohErr) {
    console.error("Error creating cohort:", cohErr);
    return;
  }

  // Link course to cohort
  await supabase.from("cohort_courses").insert({
    cohort_id: cohort.id,
    course_id: course.id
  });

  // Enroll learners in cohort
  await supabase.from("cohort_members").insert([
    { cohort_id: cohort.id, user_id: learner1Id, added_by: adminId },
    { cohort_id: cohort.id, user_id: learner2Id, added_by: adminId }
  ]);

  console.log("Cohort configured:", { cohortId: cohort.id, name: cohort.name });

  // 5. Learner 1 Completes Lessons & Progress Tracking
  console.log(`\n5. Learner 1 completes lessons`);
  // Record progress / completion in user_lesson_progress
  await supabase.from("user_lesson_progress").upsert([
    { user_id: learner1Id, lesson_id: lesson1.id, completed: true, completed_at: new Date().toISOString() },
    { user_id: learner1Id, lesson_id: lesson2.id, completed: true, completed_at: new Date().toISOString() }
  ]);

  // Record course completion / certificate
  const { data: cert, error: certErr } = await supabase
    .from("certificates")
    .insert({
      organization_id: org.id,
      user_id: learner1Id,
      course_id: course.id,
      certificate_number: `CERT-${testRunId.toUpperCase()}-001`,
      title: "Foundations of AI & Prompt Engineering Certificate",
      status: "issued",
      issued_by: adminId,
      issued_at: new Date().toISOString()
    })
    .select()
    .single();

  if (certErr) console.error("Certificate generation error:", certErr);
  else console.log("Certificate issued:", { number: cert.certificate_number, title: cert.title, status: cert.status });

  // 6. Verify Admin Dashboard Aggregates
  console.log(`\n6. Admin Dashboard Scoped Metrics Verification`);
  const { count: orgLearnersCount } = await supabase
    .from("organization_members")
    .select("user_id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .eq("status", "active");

  const { count: orgCohortsCount } = await supabase
    .from("cohorts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id);

  const { count: orgCertsCount } = await supabase
    .from("certificates")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id);

  console.log("Admin Dashboard Metrics for", orgName, ":");
  console.log("- Total Active Members:", orgLearnersCount, "(Expected: 4 - Admin, Mentor, 2 Learners)");
  console.log("- Total Cohorts:", orgCohortsCount, "(Expected: 1)");
  console.log("- Total Certificates Issued:", orgCertsCount, "(Expected: 1)");

  console.log("\n=== PHASE 3 & 4 VERIFICATION COMPLETE ===");
}

run().catch(console.error);
