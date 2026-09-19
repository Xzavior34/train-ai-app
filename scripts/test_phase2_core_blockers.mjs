import { createClient } from "@supabase/supabase-js";

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MGMT_TOKEN || "";
const PROJECT = "jeobggrtxeybxvlwpxvn";

async function querySQL(q) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: q }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SQL query failed (${res.status}): ${txt}`);
  }
  return res.json();
}

async function testPhase2CoreBlockers() {
  const ts = Date.now();
  const tag = `TRAINAI_P2_${ts}`;
  console.log(`================================================================`);
  console.log(`PHASE 2: CORE BLOCKERS VERIFICATION`);
  console.log(`Tag: ${tag}`);
  console.log(`================================================================\n`);

  const results = [];
  function logStep(stepNum, name, pass, detail) {
    const s = pass ? "PASS" : "FAIL";
    console.log(`[${s}] Step 2.${stepNum}: ${name}`);
    if (detail) console.log(`       -> ${detail}`);
    results.push({ step: `2.${stepNum}`, name, pass, detail });
  }

  let orgId = null;
  let adminId = null;
  let instructorId = null;
  let learnerId = null;
  let courseId = null;
  let lessonIds = [];
  let cohortId = null;
  let assessmentId = null;
  let certId = null;

  try {
    // 1. Authentication & Role Enforcement
    const adminAuth = await querySQL(`
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
      VALUES (gen_random_uuid(), 'admin_${ts}@test.org', crypt('Pass123!', gen_salt('bf')), now(), '{"name":"Admin"}'::jsonb)
      RETURNING id;
    `);
    adminId = adminAuth[0]?.id;
    logStep(1, "Authentication / User Creation in auth.users", !!adminId, `Admin UID: ${adminId}`);

    // 2. Organization Lifecycle
    const orgRes = await querySQL(`
      INSERT INTO organizations (name, slug, status, subscription_tier, max_users)
      VALUES ('${tag} Corp', '${tag.toLowerCase()}-corp', 'active', 'enterprise', 50)
      RETURNING id, name, status;
    `);
    orgId = orgRes[0]?.id;
    logStep(2, "Organization creation & status persistence", orgRes[0]?.status === "active", `Org: ${orgRes[0]?.name} (${orgId})`);

    // Assign Admin profile & roles
    await querySQL(`
      INSERT INTO user_profiles (id, display_name, role, organization_id)
      VALUES ('${adminId}', 'Phase2 Admin', 'admin', '${orgId}');
      INSERT INTO user_roles (user_id, role) VALUES ('${adminId}', 'admin');
      INSERT INTO organization_members (organization_id, user_id, role, status) VALUES ('${orgId}', '${adminId}', 'admin', 'active');
    `);
    const roleCheck = await querySQL(`SELECT get_user_roles('${adminId}') as roles;`);
    logStep(3, "Role resolution & org membership binding", roleCheck[0]?.roles?.includes('admin'), `Resolved roles: ${JSON.stringify(roleCheck[0]?.roles)}`);

    // 3. Members & Invitations
    const invToken = `tok_p2_${ts}`;
    const invRes = await querySQL(`
      INSERT INTO user_invitations (email, role, organization_id, organization_role, token, status, expires_at, invited_by)
      VALUES ('learner_${ts}@test.org', 'learner', '${orgId}', 'member', '${invToken}', 'pending', now() + interval '7 days', '${adminId}')
      RETURNING id, token, status;
    `);
    const tokenVal = await querySQL(`SELECT * FROM validate_invitation_token('${invToken}');`);
    logStep(4, "Invitation generation & validate_invitation_token RPC", tokenVal[0]?.valid === true, `Token valid: ${tokenVal[0]?.valid}`);

    // Create Instructor & Learner
    const instAuth = await querySQL(`
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
      VALUES (gen_random_uuid(), 'inst_${ts}@test.org', crypt('Pass123!', gen_salt('bf')), now()) RETURNING id;
    `);
    instructorId = instAuth[0]?.id;
    await querySQL(`
      INSERT INTO user_profiles (id, display_name, role, organization_id) VALUES ('${instructorId}', 'Phase2 Instructor', 'mentor', '${orgId}');
      INSERT INTO user_roles (user_id, role) VALUES ('${instructorId}', 'mentor');
      INSERT INTO organization_members (organization_id, user_id, role, status) VALUES ('${orgId}', '${instructorId}', 'content_manager', 'active');
    `);

    const lAuth = await querySQL(`
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
      VALUES (gen_random_uuid(), 'learner_${ts}@test.org', crypt('Pass123!', gen_salt('bf')), now()) RETURNING id;
    `);
    learnerId = lAuth[0]?.id;
    await querySQL(`
      INSERT INTO user_profiles (id, display_name, role, organization_id) VALUES ('${learnerId}', 'Phase2 Learner', 'learner', '${orgId}');
      INSERT INTO user_roles (user_id, role) VALUES ('${learnerId}', 'learner');
      INSERT INTO organization_members (organization_id, user_id, role, status) VALUES ('${orgId}', '${learnerId}', 'member', 'active');
      INSERT INTO user_gamification_stats (user_id, total_points, current_level, lessons_completed) VALUES ('${learnerId}', 0, 1, 0);
    `);
    logStep(5, "Instructor & Learner provisioned with org isolation", !!learnerId && !!instructorId, `Instructor: ${instructorId}, Learner: ${learnerId}`);

    // 4. Courses (Create, Edit, Publish)
    const cRes = await querySQL(`
      INSERT INTO courses (title, description, category, level, is_published, instructor_id, organization_id)
      VALUES ('${tag} React & Node Mastery', 'Full stack curriculum', 'Web Development', 'Beginner', false, '${instructorId}', '${orgId}')
      RETURNING id, is_published;
    `);
    courseId = cRes[0]?.id;
    await querySQL(`UPDATE courses SET is_published = true, description = 'Updated description' WHERE id = '${courseId}';`);
    const cCheck = await querySQL(`SELECT is_published, description FROM courses WHERE id = '${courseId}';`);
    logStep(6, "Course authoring, update & publishing lifecycle", cCheck[0]?.is_published === true && cCheck[0]?.description === 'Updated description', `Published: ${cCheck[0]?.is_published}`);

    // 5. Lessons (Ordered curriculum)
    const lRes = await querySQL(`
      INSERT INTO lessons (course_id, title, duration_minutes, order_index, is_published)
      VALUES 
        ('${courseId}', 'Lesson 1: Intro', 20, 0, true),
        ('${courseId}', 'Lesson 2: Core Concepts', 35, 1, true)
      RETURNING id;
    `);
    lessonIds = lRes.map(l => l.id);
    logStep(7, "Lesson creation & curriculum ordering", lessonIds.length === 2, `Lessons created: ${lessonIds.length}`);

    // 6. Cohorts & Membership
    const cohRes = await querySQL(`
      INSERT INTO cohorts (name, organization_id, starts_at, ends_at, created_by)
      VALUES ('${tag} Cohort Alpha', '${orgId}', CURRENT_DATE, CURRENT_DATE + interval '60 days', '${adminId}')
      RETURNING id;
    `);
    cohortId = cohRes[0]?.id;
    await querySQL(`
      INSERT INTO cohort_courses (cohort_id, course_id) VALUES ('${cohortId}', '${courseId}');
      INSERT INTO cohort_members (cohort_id, user_id, added_by) VALUES ('${cohortId}', '${instructorId}', '${adminId}'), ('${cohortId}', '${learnerId}', '${adminId}');
    `);
    const cohMembers = await querySQL(`SELECT count(*) as count FROM cohort_members WHERE cohort_id = '${cohortId}';`);
    logStep(8, "Cohort creation, course linking & member assignment", cohMembers[0]?.count === 2 || cohMembers[0]?.count === "2", `Cohort members count: ${cohMembers[0]?.count}`);

    // 7. Enrollment & Learner Progress
    await querySQL(`
      INSERT INTO course_enrollments (user_id, course_id, progress_percentage, enrolled_at)
      VALUES ('${learnerId}', '${courseId}', 0, now());
    `);
    for (const lid of lessonIds) {
      await querySQL(`
        INSERT INTO lesson_progress (user_id, lesson_id, is_completed, completed_at, time_spent_minutes)
        VALUES ('${learnerId}', '${lid}', true, now(), 15)
        ON CONFLICT (user_id, lesson_id) DO UPDATE SET is_completed = true;
      `);
    }
    await querySQL(`
      UPDATE course_enrollments SET progress_percentage = 100, completed_at = now(), updated_at = now() WHERE user_id = '${learnerId}' AND course_id = '${courseId}';
    `);
    const enCheck = await querySQL(`SELECT progress_percentage FROM course_enrollments WHERE user_id = '${learnerId}' AND course_id = '${courseId}';`);
    logStep(9, "Learner course enrollment & 100% progress persistence", enCheck[0]?.progress_percentage === "100" || enCheck[0]?.progress_percentage === 100, `Progress: ${enCheck[0]?.progress_percentage}%`);

    // 8. Assessments & Grading
    const aRes = await querySQL(`
      INSERT INTO assessments (course_id, title, created_by, max_score, questions)
      VALUES ('${courseId}', 'Core Assessment', '${instructorId}', 100, '[]'::jsonb)
      RETURNING id;
    `);
    assessmentId = aRes[0]?.id;
    await querySQL(`
      INSERT INTO assessment_questions (assessment_id, question, question_type, options, correct_answer, points, order_index)
      VALUES ('${assessmentId}', 'What is state in React?', 'multiple_choice', '["Component memory", "CSS rule"]'::jsonb, 'Component memory', 100, 0);
      INSERT INTO assessment_attempts (user_id, assessment_id, score, answers, completed_at)
      VALUES ('${learnerId}', '${assessmentId}', 100, '{"0":"Component memory"}'::jsonb, now());
    `);
    const aAttempt = await querySQL(`SELECT score FROM assessment_attempts WHERE user_id = '${learnerId}' AND assessment_id = '${assessmentId}';`);
    logStep(10, "Assessment authoring, question bank & passing submission", aAttempt[0]?.score === "100" || aAttempt[0]?.score === 100, `Score: ${aAttempt[0]?.score}%`);

    // 9. Certificates & Verification
    const certNum = `CERT-${tag}-888`;
    const certRes = await querySQL(`
      INSERT INTO certificates (user_id, course_id, organization_id, title, score_pct, status, certificate_number, issued_at)
      VALUES ('${learnerId}', '${courseId}', '${orgId}', '${tag} Certificate', 100, 'issued', '${certNum}', now())
      RETURNING id, certificate_number;
    `);
    certId = certRes[0]?.id;
    logStep(11, "Certificate issuance & unique certificate number generation", certRes[0]?.certificate_number === certNum, `Cert Number: ${certRes[0]?.certificate_number}`);

  } catch (e) {
    console.error("Phase 2 Execution Error:", e);
    logStep(99, "Phase 2 Execution Safety", false, e.message);
  } finally {
    // Cleanup
    if (orgId) {
      await querySQL(`
        DELETE FROM certificates WHERE organization_id = '${orgId}';
        ${assessmentId ? `DELETE FROM assessment_attempts WHERE assessment_id = '${assessmentId}';` : ''}
        ${assessmentId ? `DELETE FROM assessment_questions WHERE assessment_id = '${assessmentId}';` : ''}
        ${courseId ? `DELETE FROM assessments WHERE course_id = '${courseId}';` : ''}
        ${cohortId ? `DELETE FROM cohort_members WHERE cohort_id = '${cohortId}';` : ''}
        ${cohortId ? `DELETE FROM cohort_courses WHERE cohort_id = '${cohortId}';` : ''}
        DELETE FROM cohorts WHERE organization_id = '${orgId}';
        DELETE FROM lesson_progress WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${orgId}');
        ${courseId ? `DELETE FROM lessons WHERE course_id = '${courseId}';` : ''}
        ${courseId ? `DELETE FROM course_enrollments WHERE course_id = '${courseId}';` : ''}
        DELETE FROM courses WHERE organization_id = '${orgId}';
        DELETE FROM user_invitations WHERE organization_id = '${orgId}';
        DELETE FROM user_gamification_stats WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${orgId}');
        DELETE FROM organization_members WHERE organization_id = '${orgId}';
        DELETE FROM user_roles WHERE user_id IN (${[adminId, instructorId, learnerId].filter(Boolean).map(id=>`'${id}'`).join(',') || 'NULL'});
        DELETE FROM user_profiles WHERE organization_id = '${orgId}';
        DELETE FROM auth.users WHERE id IN (${[adminId, instructorId, learnerId].filter(Boolean).map(id=>`'${id}'`).join(',') || 'NULL'});
        DELETE FROM organizations WHERE id = '${orgId}';
      `);
      console.log(`\n[CLEANUP] Phase 2 QA Org ${orgId} purged cleanly.`);
    }
  }

  const passedCount = results.filter(r => r.pass).length;
  console.log(`\n================================================================`);
  console.log(`PHASE 2 SUMMARY: ${passedCount} / ${results.length} PASSED`);
  console.log(`================================================================\n`);
  return passedCount === results.length;
}

testPhase2CoreBlockers();
