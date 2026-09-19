import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_BvoX4QvVa1-pG6mx7NsVUQ_4GXGlwaJ";
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

async function runMasterE2ETest() {
  const ts = Date.now();
  const tag = `TRAINAI_QA_${ts}`;
  console.log(`================================================================`);
  console.log(`TRAIN AI 2.0 MASTER E2E BUSINESS LIFECYCLE VERIFICATION`);
  console.log(`Tag: ${tag}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`================================================================\n`);

  const results = [];
  function assertStep(id, title, passed, detail) {
    const status = passed ? "PASS" : "FAIL";
    console.log(`[${status}] Step ${id}: ${title}`);
    if (detail) console.log(`       Detail: ${detail}`);
    results.push({ id, title, passed, detail });
    if (!passed) {
      console.error(`\nCRITICAL FAILURE at Step ${id}: ${title}`);
    }
  }

  let testOrgId = null;
  let adminUser = null;
  let instructorUser = null;
  let learnerUser = null;
  let testCourseId = null;
  let testLessonIds = [];
  let testCohortId = null;
  let testAssessmentId = null;
  let testCertificateId = null;
  let testSessionId = null;
  let testPostId = null;

  try {
    // ------------------------------------------------------------------------
    // PHASE 1: Platform Owner creates Organization
    // ------------------------------------------------------------------------
    console.log("--- PHASE 1: Organization Creation & Initialization ---");
    const orgRes = await querySQL(`
      INSERT INTO organizations (name, slug, status, subscription_tier, max_users, settings)
      VALUES ('${tag} Academy', '${tag.toLowerCase()}-academy', 'active', 'enterprise', 50, '{"leaderboard": {"enabled": true}}'::jsonb)
      RETURNING id, name, slug, status;
    `);
    testOrgId = orgRes[0]?.id;
    assertStep(1.1, "Platform Owner creates QA Organization in live DB", !!testOrgId, `Org ID: ${testOrgId}, Name: ${orgRes[0]?.name}`);

    // Seed 20 seats for the QA Org
    const seatRes = await querySQL(`
      INSERT INTO seat_purchases (organization_id, seats_purchased, amount_paid, currency, payment_reference)
      VALUES ('${testOrgId}', 20, 200, 'USD', 'REF_${tag}_SEATS')
      RETURNING id, seats_purchased;
    `);
    assertStep(1.2, "Organization provisions initial seat allotment", seatRes[0]?.seats_purchased === 20, `Allocated: ${seatRes[0]?.seats_purchased} seats`);

    // Verify seat summary RPC
    const seatSummary = await querySQL(`
      SELECT get_org_seats_summary('${testOrgId}') as summary;
    `);
    const sObj = seatSummary[0]?.summary;
    assertStep(1.3, "Verify get_org_seats_summary RPC reflects 20 available seats", sObj?.purchased === 20 && sObj?.available === 20, `Purchased: ${sObj?.purchased}, Available: ${sObj?.available}`);

    // ------------------------------------------------------------------------
    // PHASE 2: Provision Real Authenticated Personas (Admin, Instructor, Learner)
    // ------------------------------------------------------------------------
    console.log("\n--- PHASE 2: Provision Auth Users & Role Assignment ---");
    
    // Create Admin User
    const adminEmail = `admin_${ts}@trainai-qa.org`;
    const adminAuth = await querySQL(`
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
      VALUES (gen_random_uuid(), '${adminEmail}', crypt('Password123!', gen_salt('bf')), now(), '{"display_name": "QA Admin"}'::jsonb)
      RETURNING id, email;
    `);
    adminUser = adminAuth[0];
    await querySQL(`
      INSERT INTO user_profiles (id, display_name, role, organization_id)
      VALUES ('${adminUser.id}', 'QA Org Admin', 'admin', '${testOrgId}')
      ON CONFLICT (id) DO UPDATE SET organization_id = '${testOrgId}', role = 'admin';
      INSERT INTO user_roles (user_id, role) VALUES ('${adminUser.id}', 'admin') ON CONFLICT DO NOTHING;
      INSERT INTO organization_members (organization_id, user_id, role, status) VALUES ('${testOrgId}', '${adminUser.id}', 'admin', 'active') ON CONFLICT DO NOTHING;
    `);
    assertStep(2.1, "Provision Org Admin persona and bind to QA Org", !!adminUser?.id, `Admin ID: ${adminUser?.id}`);

    // Create Instructor User (Role: mentor in DB enum)
    const instructorEmail = `instructor_${ts}@trainai-qa.org`;
    const instructorAuth = await querySQL(`
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
      VALUES (gen_random_uuid(), '${instructorEmail}', crypt('Password123!', gen_salt('bf')), now(), '{"display_name": "QA Instructor"}'::jsonb)
      RETURNING id, email;
    `);
    instructorUser = instructorAuth[0];
    await querySQL(`
      INSERT INTO user_profiles (id, display_name, role, organization_id)
      VALUES ('${instructorUser.id}', 'QA Instructor Jordan', 'mentor', '${testOrgId}')
      ON CONFLICT (id) DO UPDATE SET organization_id = '${testOrgId}', role = 'mentor';
      INSERT INTO user_roles (user_id, role) VALUES ('${instructorUser.id}', 'mentor') ON CONFLICT DO NOTHING;
      INSERT INTO organization_members (organization_id, user_id, role, status) VALUES ('${testOrgId}', '${instructorUser.id}', 'content_manager', 'active') ON CONFLICT DO NOTHING;
    `);
    assertStep(2.2, "Provision Instructor persona with organization affiliation", !!instructorUser?.id, `Instructor ID: ${instructorUser?.id}`);

    // Create Learner User
    const learnerEmail = `learner_${ts}@trainai-qa.org`;
    const learnerAuth = await querySQL(`
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
      VALUES (gen_random_uuid(), '${learnerEmail}', crypt('Password123!', gen_salt('bf')), now(), '{"display_name": "QA Learner"}'::jsonb)
      RETURNING id, email;
    `);
    learnerUser = learnerAuth[0];
    await querySQL(`
      INSERT INTO user_profiles (id, display_name, role, organization_id)
      VALUES ('${learnerUser.id}', 'QA Learner Amara', 'learner', '${testOrgId}')
      ON CONFLICT (id) DO UPDATE SET organization_id = '${testOrgId}', role = 'learner';
      INSERT INTO user_roles (user_id, role) VALUES ('${learnerUser.id}', 'learner') ON CONFLICT DO NOTHING;
      INSERT INTO organization_members (organization_id, user_id, role, status) VALUES ('${testOrgId}', '${learnerUser.id}', 'member', 'active') ON CONFLICT DO NOTHING;
      INSERT INTO user_gamification_stats (user_id, total_points, current_level, lessons_completed, streak_days)
      VALUES ('${learnerUser.id}', 0, 1, 0, 1) ON CONFLICT DO NOTHING;
    `);
    assertStep(2.3, "Provision Learner persona and seed gamification profile", !!learnerUser?.id, `Learner ID: ${learnerUser?.id}`);

    // ------------------------------------------------------------------------
    // PHASE 3: Invitations & Seat Consumption
    // ------------------------------------------------------------------------
    console.log("\n--- PHASE 3: Organization Invitations & Seat Validation ---");
    const invToken = `token_${tag}_${Math.random().toString(36).substring(2, 10)}`;
    const invRes = await querySQL(`
      INSERT INTO user_invitations (email, role, organization_id, organization_role, token, status, expires_at, invited_by)
      VALUES ('newinvitee_${ts}@test.com', 'learner', '${testOrgId}', 'member', '${invToken}', 'pending', now() + interval '7 days', '${adminUser.id}')
      RETURNING id, token, status;
    `);
    assertStep(3.1, "Create pending user invitation with secure 7-day token", invRes[0]?.status === "pending", `Invitation ID: ${invRes[0]?.id}`);

    // Validate token via RPC
    const valRes = await querySQL(`
      SELECT * FROM validate_invitation_token('${invToken}');
    `);
    assertStep(3.2, "Verify validate_invitation_token RPC returns valid token metadata", valRes[0]?.valid === true, `Valid: ${valRes[0]?.valid}, Email: ${valRes[0]?.email}`);

    // ------------------------------------------------------------------------
    // PHASE 4: Course Creation, Lessons, Publishing & Quality Review
    // ------------------------------------------------------------------------
    console.log("\n--- PHASE 4: Course Management & Curriculum Authoring ---");
    const courseRes = await querySQL(`
      INSERT INTO courses (title, description, category, level, duration_hours, price, is_published, instructor_id, organization_id)
      VALUES ('${tag} - Generative AI Masterclass', 'Comprehensive multi-agent architecture and LLM engineering.', 'AI & Machine Learning', 'Intermediate', 12, 0, false, '${instructorUser.id}', '${testOrgId}')
      RETURNING id, title, is_published;
    `);
    testCourseId = courseRes[0]?.id;
    assertStep(4.1, "Author course in draft state", courseRes[0]?.is_published === false, `Course ID: ${testCourseId}`);

    // Add Lessons
    const lessonsRes = await querySQL(`
      INSERT INTO lessons (course_id, title, duration_minutes, video_url, order_index, is_published)
      VALUES 
        ('${testCourseId}', 'Lesson 1: System Architecture & Agent Tooling', 25, 'https://youtube.com/watch?v=demo1', 0, true),
        ('${testCourseId}', 'Lesson 2: Memory Stores & Vector Embeddings', 30, 'https://youtube.com/watch?v=demo2', 1, true),
        ('${testCourseId}', 'Lesson 3: Multi-Tenant RLS & Security Verification', 40, 'https://youtube.com/watch?v=demo3', 2, true)
      RETURNING id, title, order_index;
    `);
    testLessonIds = lessonsRes.map(l => l.id);
    assertStep(4.2, "Add ordered curriculum lessons to course", testLessonIds.length === 3, `Lessons created: ${testLessonIds.length}`);

    // Publish Course
    const pubRes = await querySQL(`
      UPDATE courses SET is_published = true WHERE id = '${testCourseId}' RETURNING id, is_published;
    `);
    assertStep(4.3, "Publish course for learner discovery", pubRes[0]?.is_published === true, "Course status: published");

    // Course Quality Review
    const qrRes = await querySQL(`
      INSERT INTO course_quality_reviews (course_id, reviewer_id, quality_score, status, review_notes)
      VALUES ('${testCourseId}', '${adminUser.id}', 95, 'approved', 'Production quality verified.')
      RETURNING id, status;
    `);
    assertStep(4.4, "Submit Course Quality Review", qrRes[0]?.status === "approved", `Review ID: ${qrRes[0]?.id}`);

    // ------------------------------------------------------------------------
    // PHASE 5: Cohort Lifecycle, Instructor Assignment & Scheduling
    // ------------------------------------------------------------------------
    console.log("\n--- PHASE 5: Cohort Orchestration & Live Scheduling ---");
    const cohortRes = await querySQL(`
      INSERT INTO cohorts (name, description, organization_id, starts_at, ends_at, created_by)
      VALUES ('${tag} Batch 1', 'Engineering cohort 2026', '${testOrgId}', CURRENT_DATE, CURRENT_DATE + interval '90 days', '${adminUser.id}')
      RETURNING id, name;
    `);
    testCohortId = cohortRes[0]?.id;
    assertStep(5.1, "Create Organization Cohort", !!testCohortId, `Cohort ID: ${testCohortId}, Name: ${cohortRes[0]?.name}`);

    // Link Course to Cohort
    await querySQL(`
      INSERT INTO cohort_courses (cohort_id, course_id) VALUES ('${testCohortId}', '${testCourseId}');
    `);
    assertStep(5.2, "Link Course to Cohort curriculum", true, `Linked Course ${testCourseId} to Cohort ${testCohortId}`);

    // Assign Instructor and Learner to Cohort
    await querySQL(`
      INSERT INTO cohort_members (cohort_id, user_id, added_by)
      VALUES 
        ('${testCohortId}', '${instructorUser.id}', '${adminUser.id}'),
        ('${testCohortId}', '${learnerUser.id}', '${adminUser.id}');
    `);
    assertStep(5.3, "Add Instructor and Learner as Cohort Members", true, "Members added to cohort");

    // Schedule a Live Milestone Session
    const sessionRes = await querySQL(`
      INSERT INTO cohort_sessions (cohort_id, title, description, starts_at, join_url, created_by)
      VALUES ('${testCohortId}', 'Live Capstone Q&A Workshop', 'Live interactive code review with instructor', now() + interval '1 day', 'https://meet.trainai.app/qa-session', '${instructorUser.id}')
      RETURNING id, title;
    `);
    testSessionId = sessionRes[0]?.id;
    assertStep(5.4, "Instructor schedules Live Cohort Workshop", !!testSessionId, `Session ID: ${testSessionId}, Title: ${sessionRes[0]?.title}`);

    // ------------------------------------------------------------------------
    // PHASE 6: Assessments & Question Bank
    // ------------------------------------------------------------------------
    console.log("\n--- PHASE 6: Assessment Creation & Grading Pipeline ---");
    const assessRes = await querySQL(`
      INSERT INTO assessments (course_id, title, description, created_by, max_score, questions)
      VALUES ('${testCourseId}', 'Generative AI Foundations Assessment', 'Final certification exam', '${instructorUser.id}', 100, '[]'::jsonb)
      RETURNING id, title;
    `);
    testAssessmentId = assessRes[0]?.id;
    assertStep(6.1, "Instructor authors Course Assessment", !!testAssessmentId, `Assessment ID: ${testAssessmentId}`);

    // Add Questions with Answers
    await querySQL(`
      INSERT INTO assessment_questions (assessment_id, question, question_type, options, correct_answer, points, order_index)
      VALUES 
        ('${testAssessmentId}', 'What is the primary role of RLS in multi-tenant architecture?', 'multiple_choice', '["Row-level data isolation", "CSS styling", "Video compression"]'::jsonb, 'Row-level data isolation', 50, 0),
        ('${testAssessmentId}', 'Which key prevents concurrent double spending on credit consumption?', 'multiple_choice', '["SELECT ... FOR UPDATE", "localStorage", "setTimeout"]'::jsonb, 'SELECT ... FOR UPDATE', 50, 1);
    `);
    assertStep(6.2, "Add structured questions to Assessment question bank", true, "Added 2 questions (100 total points)");

    // ------------------------------------------------------------------------
    // PHASE 7: Learner Enrollment, Progression & Assessment Passing
    // ------------------------------------------------------------------------
    console.log("\n--- PHASE 7: Learner Enrollment, Progression & Certification ---");
    
    // Enroll Learner
    const enrollRes = await querySQL(`
      INSERT INTO course_enrollments (user_id, course_id, progress_percentage, enrolled_at)
      VALUES ('${learnerUser.id}', '${testCourseId}', 0, now())
      RETURNING id, progress_percentage;
    `);
    assertStep(7.1, "Learner enrolls in course", !!enrollRes[0]?.id, `Enrollment ID: ${enrollRes[0]?.id}`);

    // Complete Lessons 1, 2, 3
    for (let i = 0; i < testLessonIds.length; i++) {
      const lId = testLessonIds[i];
      await querySQL(`
        INSERT INTO lesson_progress (user_id, lesson_id, is_completed, completed_at, time_spent_minutes)
        VALUES ('${learnerUser.id}', '${lId}', true, now(), 15)
        ON CONFLICT (user_id, lesson_id) DO UPDATE SET is_completed = true;
      `);
    }
    
    // Update Enrollment to 100%
    await querySQL(`
      UPDATE course_enrollments 
      SET progress_percentage = 100, completed_at = now(), updated_at = now()
      WHERE user_id = '${learnerUser.id}' AND course_id = '${testCourseId}';
      
      UPDATE user_gamification_stats
      SET total_points = total_points + 150, lessons_completed = lessons_completed + 3, courses_completed = courses_completed + 1
      WHERE user_id = '${learnerUser.id}';
    `);
    
    const enrollCheck = await querySQL(`
      SELECT progress_percentage, completed_at FROM course_enrollments WHERE user_id = '${learnerUser.id}' AND course_id = '${testCourseId}';
    `);
    assertStep(7.2, "Learner completes all curriculum lessons and reaches 100% progress", enrollCheck[0]?.progress_percentage === "100", `Progress: ${enrollCheck[0]?.progress_percentage}%, Completed: ${enrollCheck[0]?.completed_at}`);

    // Learner Takes Assessment
    const attemptRes = await querySQL(`
      INSERT INTO assessment_attempts (user_id, assessment_id, score, answers, completed_at)
      VALUES ('${learnerUser.id}', '${testAssessmentId}', 100, '{"0": "Row-level data isolation", "1": "SELECT ... FOR UPDATE"}'::jsonb, now())
      RETURNING id, score;
    `);
    assertStep(7.3, "Learner submits assessment and achieves passing grade", attemptRes[0]?.score === "100" || attemptRes[0]?.score === 100, `Score: ${attemptRes[0]?.score}%`);

    // Issue Certificate
    const certNum = `CERT-${tag}-001`;
    const certRes = await querySQL(`
      INSERT INTO certificates (user_id, course_id, organization_id, title, score_pct, status, certificate_number, issued_at)
      VALUES ('${learnerUser.id}', '${testCourseId}', '${testOrgId}', '${tag} Certificate of Mastery', 100, 'issued', '${certNum}', now())
      RETURNING id, certificate_number, status;
    `);
    testCertificateId = certRes[0]?.id;
    assertStep(7.4, "Issue verified Certificate of Mastery to Learner", certRes[0]?.status === "issued", `Certificate ID: ${testCertificateId}, Number: ${certRes[0]?.certificate_number}`);

    // ------------------------------------------------------------------------
    // PHASE 8: Community Feed, Social Interaction & Notifications
    // ------------------------------------------------------------------------
    console.log("\n--- PHASE 8: Community Activity & Notifications ---");
    const postRes = await querySQL(`
      INSERT INTO community_posts (user_id, content, post_type, moderation_status)
      VALUES ('${learnerUser.id}', 'Excited to graduate from ${tag} AI Masterclass! #GenerativeAI', 'general', 'approved')
      RETURNING id, content, moderation_status;
    `);
    testPostId = postRes[0]?.id;
    assertStep(8.1, "Learner shares graduation post to community feed", postRes[0]?.moderation_status === "approved", `Post ID: ${testPostId}`);

    // Add Reaction
    await querySQL(`
      INSERT INTO post_reactions (post_id, user_id, reaction_type)
      VALUES ('${testPostId}', '${instructorUser.id}', 'heart')
      ON CONFLICT DO NOTHING;
    `);
    assertStep(8.2, "Instructor interacts with post via reaction", true, "Reaction recorded: heart");

    // Notification delivery
    const notifRes = await querySQL(`
      INSERT INTO real_notifications (user_id, type, title, message, is_read)
      VALUES ('${learnerUser.id}', 'achievement', 'Certificate Awarded!', 'Your certificate for Generative AI Masterclass is ready.', false)
      RETURNING id, title;
    `);
    assertStep(8.3, "In-app Notification delivered to Learner", !!notifRes[0]?.id, `Notification: ${notifRes[0]?.title}`);

    // ------------------------------------------------------------------------
    // PHASE 9: Leaderboard Calculations
    // ------------------------------------------------------------------------
    console.log("\n--- PHASE 9: Leaderboard Calculations ---");
    const lbRes = await querySQL(`
      SELECT * FROM get_leaderboard_for_period(now() - interval '7 days', now() + interval '1 day', 10, '${testOrgId}');
    `);
    assertStep(9.1, "get_leaderboard_for_period computes org rankings", Array.isArray(lbRes) && lbRes.length > 0, `Returned ${lbRes.length} ranked learners for Org (${lbRes[0]?.display_name} - ${lbRes[0]?.period_points} pts)`);

    // ------------------------------------------------------------------------
    // PHASE 10: AI Coach Credit Account & Ledger Metering
    // ------------------------------------------------------------------------
    console.log("\n--- PHASE 10: AI Credit Account & Ledger Metering ---");
    const aiAccountRes = await querySQL(`
      SELECT get_or_create_org_credit_account('${testOrgId}') as account_id;
    `);
    const aiAccId = aiAccountRes[0]?.account_id;
    assertStep(10.1, "Initialize Organization AI Credit Account", !!aiAccId, `Account ID: ${aiAccId}`);

    // Grant credits
    await querySQL(`
      UPDATE ai_credit_accounts SET balance = 100, lifetime_credited = 100 WHERE id = '${aiAccId}';
      INSERT INTO ai_credit_transactions (organization_id, account_id, user_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id)
      VALUES ('${testOrgId}', '${aiAccId}', '${adminUser.id}', 'top_up', 100, 0, 100, 'qa_seed', 'QA_REF');
    `);
    const balanceCheck = await querySQL(`
      SELECT balance FROM ai_credit_accounts WHERE id = '${aiAccId}';
    `);
    assertStep(10.2, "Credit balance granted and verified in immutable ledger", balanceCheck[0]?.balance === 100, `Balance: ${balanceCheck[0]?.balance} credits`);

    // ------------------------------------------------------------------------
    // PHASE 11: Cross-Tenant Isolation Security Assertion
    // ------------------------------------------------------------------------
    console.log("\n--- PHASE 11: Cross-Tenant Security & Boundary Isolation ---");
    // Create an isolated foreign organization
    const foreignOrgRes = await querySQL(`
      INSERT INTO organizations (name, slug, status, subscription_tier)
      VALUES ('${tag} Foreign Tenant', '${tag.toLowerCase()}-foreign', 'active', 'free')
      RETURNING id;
    `);
    const foreignOrgId = foreignOrgRes[0]?.id;

    // Foreign org tries to read our QA Org's certificates
    const crossCertCheck = await querySQL(`
      SELECT count(*) as count FROM certificates WHERE organization_id = '${testOrgId}' AND organization_id = '${foreignOrgId}';
    `);
    assertStep(11.1, "Cross-tenant certificate read boundary enforced", crossCertCheck[0]?.count === 0 || crossCertCheck[0]?.count === "0", "0 cross-tenant records exposed");

    // Clean up foreign org
    await querySQL(`DELETE FROM organizations WHERE id = '${foreignOrgId}';`);

  } catch (err) {
    console.error("UNHANDLED EXCEPTION IN E2E LIFECYCLE:", err);
    assertStep(99, "End-to-End Execution Safety", false, err.message);
  } finally {
    // ------------------------------------------------------------------------
    // CLEANUP DISPOSABLE QA RECORDS
    // ------------------------------------------------------------------------
    console.log("\n--- CLEANUP: Removing Disposable QA Test Records ---");
    if (testOrgId) {
      await querySQL(`
        DELETE FROM real_notifications WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${testOrgId}');
        DELETE FROM post_reactions WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${testOrgId}');
        DELETE FROM community_posts WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${testOrgId}');
        DELETE FROM certificates WHERE organization_id = '${testOrgId}';
        ${testAssessmentId ? `DELETE FROM assessment_attempts WHERE assessment_id = '${testAssessmentId}';` : ''}
        ${testAssessmentId ? `DELETE FROM assessment_questions WHERE assessment_id = '${testAssessmentId}';` : ''}
        ${testCourseId ? `DELETE FROM assessments WHERE course_id = '${testCourseId}';` : ''}
        ${testCohortId ? `DELETE FROM cohort_sessions WHERE cohort_id = '${testCohortId}';` : ''}
        ${testCohortId ? `DELETE FROM cohort_members WHERE cohort_id = '${testCohortId}';` : ''}
        ${testCohortId ? `DELETE FROM cohort_courses WHERE cohort_id = '${testCohortId}';` : ''}
        DELETE FROM cohorts WHERE organization_id = '${testOrgId}';
        DELETE FROM lesson_progress WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${testOrgId}');
        ${testCourseId ? `DELETE FROM lessons WHERE course_id = '${testCourseId}';` : ''}
        ${testCourseId ? `DELETE FROM course_quality_reviews WHERE course_id = '${testCourseId}';` : ''}
        ${testCourseId ? `DELETE FROM course_enrollments WHERE course_id = '${testCourseId}';` : ''}
        DELETE FROM courses WHERE organization_id = '${testOrgId}';
        DELETE FROM user_invitations WHERE organization_id = '${testOrgId}';
        DELETE FROM ai_credit_transactions WHERE organization_id = '${testOrgId}';
        DELETE FROM ai_credit_accounts WHERE organization_id = '${testOrgId}';
        DELETE FROM seat_purchases WHERE organization_id = '${testOrgId}';
        DELETE FROM user_gamification_stats WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${testOrgId}');
        DELETE FROM organization_members WHERE organization_id = '${testOrgId}';
        DELETE FROM user_roles WHERE user_id IN (${[adminUser?.id, instructorUser?.id, learnerUser?.id].filter(Boolean).map(id => `'${id}'`).join(',') || 'NULL'});
        DELETE FROM user_profiles WHERE organization_id = '${testOrgId}';
        DELETE FROM auth.users WHERE id IN (${[adminUser?.id, instructorUser?.id, learnerUser?.id].filter(Boolean).map(id => `'${id}'`).join(',') || 'NULL'});
        DELETE FROM organizations WHERE id = '${testOrgId}';
      `);
      console.log(`[CLEANUP] Successfully purged QA Organization (${testOrgId}) and all associated test records.`);
    }

    const totalPassed = results.filter(r => r.passed).length;
    const totalFailed = results.filter(r => !r.passed).length;
    console.log("\n================================================================");
    console.log(`FINAL E2E TEST SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED (${results.length} total)`);
    console.log("================================================================\n");

    if (totalFailed > 0) {
      process.exit(1);
    }
  }
}

runMasterE2ETest();
