#!/usr/bin/env node
// ============================================================================
// Demo data seed script - the correct way to do this.
//
// A previous version of this tried to create demo accounts with a raw SQL
// migration inserting directly into auth.users. That does NOT work on a
// real Supabase project: Supabase Auth requires a properly hashed
// password and several internal fields that only the real Auth API sets
// correctly. A raw SQL insert produces a row that looks like a user but
// can never actually sign in - a real, previously undiscovered mistake
// worth being upfront about rather than leaving in place.
//
// This script uses the real Supabase Admin API (supabase.auth.admin.
// createUser) to create genuinely loginable demo accounts with real
// passwords, then seeds all the related data (courses, enrollments,
// certificates, cohorts, study groups, AI usage) using the REAL UUIDs
// Supabase generates for those accounts - not made-up ones.
//
// USAGE (run once, from a trusted machine - never in a browser):
//   SUPABASE_URL=https://your-project.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
//   node scripts/seed-demo-data.mjs
//
// The service role key is required (not the anon key) because creating
// users and bypassing RLS for seeding both need admin privileges. Never
// commit this key or run this script anywhere but your own machine/CI.
// ============================================================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "DemoAcademy2026!";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  console.error("Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-demo-data.mjs");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const LEARNER_NAMES = ["Amara Chen", "David Osei", "Priya Nair", "Marcus Webb", "Fatima Diallo", "Liam Torres", "Ngozi Adeyemi", "Sofia Kim"];

async function createOrGetUser(email, displayName) {
  // Idempotent - if this script is run twice, re-use the existing account
  // rather than erroring or creating a duplicate.
  const { data: existing } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = existing?.users?.find((u) => u.email === email);
  if (found) return found.id;

  const { data, error } = await supabase.auth.admin.createUser({
    email, password: DEMO_PASSWORD, email_confirm: true,
  });
  if (error) throw new Error(`Could not create ${email}: ${error.message}`);
  return data.user.id;
}

async function main() {
  console.log("Creating real, loginable demo accounts via the Supabase Admin API...");

  const adminId = await createOrGetUser("demo-admin@demoacademy.sample");
  const managerId = await createOrGetUser("demo-manager@demoacademy.sample");
  const instructor1Id = await createOrGetUser("demo-instructor1@demoacademy.sample");
  const instructor2Id = await createOrGetUser("demo-instructor2@demoacademy.sample");
  const learnerIds = [];
  for (let i = 1; i <= 8; i++) {
    learnerIds.push(await createOrGetUser(`demo-learner${i}@demoacademy.sample`));
  }

  console.log("Accounts ready. Seeding organization and profile data...");

  const orgSlug = "demo-academy-sample";
  let { data: org } = await supabase.from("organizations").select("id").eq("slug", orgSlug).maybeSingle();
  let orgId = org?.id;
  if (!orgId) {
    const { data: newOrg, error } = await supabase.from("organizations").insert({
      name: "Demo Academy (Sample Data)", slug: orgSlug, status: "active", subscription_tier: "growth", onboarding_completed: true,
    }).select().single();
    if (error) throw error;
    orgId = newOrg.id;
  }

  await supabase.from("user_profiles").upsert([
    { id: adminId, organization_id: orgId, role: "admin", display_name: "Demo Admin" },
    { id: managerId, organization_id: orgId, role: "manager", display_name: "Demo Manager" },
    { id: instructor1Id, organization_id: orgId, role: "mentor", display_name: "Instructor Jordan Reyes" },
    { id: instructor2Id, organization_id: orgId, role: "mentor", display_name: "Instructor Wale Adebayo" },
    ...learnerIds.map((id, i) => ({
      id, organization_id: orgId, role: "learner", display_name: LEARNER_NAMES[i],
      manager_id: i < 5 ? managerId : null,
      last_active_at: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
    })),
  ], { onConflict: "id" });

  const { data: existingMentors } = await supabase.from("mentors").select("user_id").in("user_id", [instructor1Id, instructor2Id]);
  const existingMentorUserIds = new Set((existingMentors || []).map((m) => m.user_id));
  const mentorsToInsert = [];
  if (!existingMentorUserIds.has(instructor1Id)) mentorsToInsert.push({ user_id: instructor1Id, organization_id: orgId, title: "AI & Data Instructor", bio: "Teaches AI Fundamentals and Data Literacy.", specializations: ["AI", "Data"], is_active: true, is_approved: true });
  if (!existingMentorUserIds.has(instructor2Id)) mentorsToInsert.push({ user_id: instructor2Id, organization_id: orgId, title: "Leadership Instructor", bio: "Teaches Leadership Essentials.", specializations: ["Leadership"], is_active: true, is_approved: true });
  if (mentorsToInsert.length) await supabase.from("mentors").insert(mentorsToInsert);

  const { data: mentorRows } = await supabase.from("mentors").select("id, user_id").in("user_id", [instructor1Id, instructor2Id]);
  const mentorRowIdByUser = Object.fromEntries((mentorRows || []).map((m) => [m.user_id, m.id]));

  console.log("Seeding courses, lessons, and assessment...");

  const courseDefs = [
    { title: "AI Fundamentals", category: "AI", level: "beginner", duration_hours: 4, instructor_id: instructor1Id },
    { title: "Leadership Essentials", category: "Leadership", level: "intermediate", duration_hours: 6, instructor_id: instructor2Id },
    { title: "Workplace Compliance 101", category: "Compliance", level: "beginner", duration_hours: 2, instructor_id: instructor1Id },
    { title: "Data Literacy for Teams", category: "Data", level: "beginner", duration_hours: 3, instructor_id: instructor1Id },
    { title: "Advanced Project Management", category: "Management", level: "advanced", duration_hours: 8, instructor_id: null, course_source: "external" },
  ];
  const courseIds = {};
  for (const c of courseDefs) {
    const { data: existingCourse } = await supabase.from("courses").select("id").eq("title", c.title).maybeSingle();
    if (existingCourse) { courseIds[c.title] = existingCourse.id; continue; }
    const { data: newCourse, error } = await supabase.from("courses").insert({
      title: c.title, description: `${c.title} - sample demo course.`, category: c.category, level: c.level,
      duration_hours: c.duration_hours, instructor_id: c.instructor_id, is_published: true, course_source: c.course_source || "internal",
    }).select().single();
    if (error) throw error;
    courseIds[c.title] = newCourse.id;
  }

  const { data: existingAssessment } = await supabase.from("assessments").select("id").eq("course_id", courseIds["AI Fundamentals"]).maybeSingle();
  let assessmentId = existingAssessment?.id;
  if (!assessmentId) {
    const { data: newAssessment } = await supabase.from("assessments").insert({ course_id: courseIds["AI Fundamentals"], title: "AI Fundamentals Assessment", max_score: 100 }).select().single();
    assessmentId = newAssessment.id;
    await supabase.from("assessment_questions").insert([
      { assessment_id: assessmentId, question: "Which of these is a common workplace use of AI?", question_type: "multiple_choice", options: ["Drafting emails", "Watering plants", "Painting walls"], correct_answer: "Drafting emails", order_index: 0, points: 1 },
      { assessment_id: assessmentId, question: "AI recommendations should always be...", question_type: "multiple_choice", options: ["Followed without review", "Reviewed by a person", "Ignored entirely"], correct_answer: "Reviewed by a person", order_index: 1, points: 1 },
    ]);
  }

  console.log("Seeding enrollments, certificates, compliance, cohort, study group, AI usage...");

  const aiProgress = [100, 85, 60, 100, 30, 15, 100, 45];
  const leadershipProgress = [100, 40, 100, 20, 70, 10];
  const enrollments = [];
  learnerIds.forEach((id, i) => {
    enrollments.push({ user_id: id, course_id: courseIds["AI Fundamentals"], progress_percentage: aiProgress[i], completed_at: aiProgress[i] === 100 ? new Date().toISOString() : null });
    if (i < 6) enrollments.push({ user_id: id, course_id: courseIds["Leadership Essentials"], progress_percentage: leadershipProgress[i], completed_at: leadershipProgress[i] === 100 ? new Date().toISOString() : null });
    if (i < 4) enrollments.push({ user_id: id, course_id: courseIds["Workplace Compliance 101"], progress_percentage: 100, completed_at: new Date().toISOString() });
  });
  await supabase.from("course_enrollments").upsert(enrollments, { onConflict: "user_id,course_id" });

  await supabase.from("assessment_attempts").insert([
    { user_id: learnerIds[0], assessment_id: assessmentId, score: 95, completed_at: new Date().toISOString() },
    { user_id: learnerIds[3], assessment_id: assessmentId, score: 88, completed_at: new Date().toISOString() },
    { user_id: learnerIds[6], assessment_id: assessmentId, score: 100, completed_at: new Date().toISOString() },
  ]);

  await supabase.from("certificates").upsert([
    { user_id: learnerIds[0], course_id: courseIds["AI Fundamentals"], organization_id: orgId, status: "issued", issued_at: new Date().toISOString(), certificate_number: "TAI-DEMO0001", score_pct: 95 },
    { user_id: learnerIds[3], course_id: courseIds["AI Fundamentals"], organization_id: orgId, status: "issued", issued_at: new Date().toISOString(), certificate_number: "TAI-DEMO0002", score_pct: 88 },
    { user_id: learnerIds[0], course_id: courseIds["Leadership Essentials"], organization_id: orgId, status: "issued", issued_at: new Date().toISOString(), certificate_number: "TAI-DEMO0003" },
    { user_id: learnerIds[2], course_id: courseIds["Leadership Essentials"], organization_id: orgId, status: "issued", issued_at: new Date().toISOString(), certificate_number: "TAI-DEMO0004" },
  ], { onConflict: "user_id,course_id" });

  await supabase.from("compliance_assignments").insert([
    { user_id: learnerIds[0], course_id: courseIds["Workplace Compliance 101"], assigned_by: adminId, status: "completed", completed_at: new Date().toISOString() },
    { user_id: learnerIds[1], course_id: courseIds["Workplace Compliance 101"], assigned_by: adminId, status: "completed", completed_at: new Date().toISOString() },
    { user_id: learnerIds[4], course_id: courseIds["Workplace Compliance 101"], assigned_by: adminId, status: "overdue" },
    { user_id: learnerIds[5], course_id: courseIds["Workplace Compliance 101"], assigned_by: adminId, status: "overdue" },
  ]);

  const { data: existingCohort } = await supabase.from("cohorts").select("id").eq("organization_id", orgId).eq("name", "Q1 Onboarding Cohort").maybeSingle();
  let cohortId = existingCohort?.id;
  if (!cohortId) {
    const { data: newCohort } = await supabase.from("cohorts").insert({ organization_id: orgId, name: "Q1 Onboarding Cohort", description: "New hire onboarding cohort for the demo organization.", created_by: instructor1Id }).select().single();
    cohortId = newCohort.id;
    await supabase.from("cohort_members").insert([instructor1Id, learnerIds[0], learnerIds[1], learnerIds[2], learnerIds[3]].map((user_id) => ({ cohort_id: cohortId, user_id })));
  }

  const { data: existingGroup } = await supabase.from("study_groups").select("id").eq("organization_id", orgId).eq("name", "AI Fundamentals Study Circle").maybeSingle();
  if (!existingGroup) {
    const { data: newGroup } = await supabase.from("study_groups").insert({ name: "AI Fundamentals Study Circle", description: "Peer study group for AI Fundamentals.", course_id: courseIds["AI Fundamentals"], organization_id: orgId, created_by: instructor1Id }).select().single();
    await supabase.from("study_group_members").insert([
      { group_id: newGroup.id, user_id: instructor1Id, role: "lead" },
      { group_id: newGroup.id, user_id: learnerIds[0], role: "member" },
      { group_id: newGroup.id, user_id: learnerIds[3], role: "member" },
    ]);
  }

  const aiUsageRows = [];
  for (let i = 0; i < 12; i++) {
    aiUsageRows.push({ user_id: learnerIds[i % 8], organization_id: orgId, feature: i % 3 === 0 ? "ai_quiz" : "ai_coach", created_at: new Date(Date.now() - i * 3600000).toISOString() });
  }
  await supabase.from("ai_usage_events").insert(aiUsageRows);

  console.log("\n=== Demo data seeded successfully ===");
  console.log(`Organization: Demo Academy (Sample Data) [${orgId}]`);
  console.log(`\nReal, loginable accounts (password: ${DEMO_PASSWORD}):`);
  console.log("  Admin:       demo-admin@demoacademy.sample");
  console.log("  Manager:     demo-manager@demoacademy.sample");
  console.log("  Instructor:  demo-instructor1@demoacademy.sample");
  console.log("  Instructor:  demo-instructor2@demoacademy.sample");
  console.log("  Learners:    demo-learner1@demoacademy.sample through demo-learner8@demoacademy.sample");
  console.log("\nSign in with any of these at the normal login screen to see every feature populated with real data.");
}

main().catch((err) => {
  console.error("Seed script failed:", err.message);
  process.exit(1);
});
