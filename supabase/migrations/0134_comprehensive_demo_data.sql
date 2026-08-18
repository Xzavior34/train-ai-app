-- ============================================================================
-- Comprehensive demo data - "show those that can't show due to no
-- database, make a mock or demo data for it so we will see how it
-- works." Every screen built across this project has been shown with
-- honest empty states because no real deployment has ever had actual
-- data in it. This seeds one, for real, so anyone signing into a
-- connected deployment sees every feature actually working with real
-- numbers - not fabricated in the UI, genuinely written to the database.
--
-- Clearly labeled: the organization is named "Demo Academy (Sample
-- Data)" and every person's email is under a demo domain, so this is
-- unmistakably sample content, never confusable with a real
-- organization. Idempotent - checks for its own marker first, safe to
-- run more than once.
-- ============================================================================

do $$
declare
  v_org_id uuid := 'd0000000-0000-0000-0000-000000000001';
  v_admin_id uuid := 'd0000000-0000-0000-0000-000000000002';
  v_manager_id uuid := 'd0000000-0000-0000-0000-000000000003';
  v_instructor1_id uuid := 'd0000000-0000-0000-0000-000000000004';
  v_instructor2_id uuid := 'd0000000-0000-0000-0000-000000000005';
  v_mentor1_row_id uuid := 'd0000000-0000-0000-0000-000000000006';
  v_mentor2_row_id uuid := 'd0000000-0000-0000-0000-000000000007';
  v_learner_ids uuid[] := array[
    'd0000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000011',
    'd0000000-0000-0000-0000-000000000012', 'd0000000-0000-0000-0000-000000000013',
    'd0000000-0000-0000-0000-000000000014', 'd0000000-0000-0000-0000-000000000015',
    'd0000000-0000-0000-0000-000000000016', 'd0000000-0000-0000-0000-000000000017'
  ];
  v_learner_names text[] := array['Amara Chen', 'David Osei', 'Priya Nair', 'Marcus Webb', 'Fatima Diallo', 'Liam Torres', 'Ngozi Adeyemi', 'Sofia Kim'];
  v_course_ai uuid := 'd0000000-0000-0000-0000-000000000020';
  v_course_leadership uuid := 'd0000000-0000-0000-0000-000000000021';
  v_course_compliance uuid := 'd0000000-0000-0000-0000-000000000022';
  v_course_data uuid := 'd0000000-0000-0000-0000-000000000023';
  v_course_external uuid := 'd0000000-0000-0000-0000-000000000024';
  v_cohort_id uuid := 'd0000000-0000-0000-0000-000000000030';
  v_studygroup_id uuid := 'd0000000-0000-0000-0000-000000000031';
  v_assessment_ai uuid := 'd0000000-0000-0000-0000-000000000040';
  i int;
  v_progress int;
begin
  if exists (select 1 from organizations where id = v_org_id) then
    return;
  end if;

  -- --- Organization ---
  insert into organizations (id, name, slug, status, subscription_tier, onboarding_completed)
  values (v_org_id, 'Demo Academy (Sample Data)', 'demo-academy-sample', 'active', 'growth', true);

  -- --- Auth users + profiles: admin, manager, 2 instructors ---
  insert into auth.users (id, email) values
    (v_admin_id, 'demo-admin@demoacademy.sample'),
    (v_manager_id, 'demo-manager@demoacademy.sample'),
    (v_instructor1_id, 'demo-instructor1@demoacademy.sample'),
    (v_instructor2_id, 'demo-instructor2@demoacademy.sample');

  insert into user_profiles (id, organization_id, role, display_name) values
    (v_admin_id, v_org_id, 'admin', 'Demo Admin'),
    (v_manager_id, v_org_id, 'manager', 'Demo Manager'),
    (v_instructor1_id, v_org_id, 'mentor', 'Instructor Jordan Reyes'),
    (v_instructor2_id, v_org_id, 'mentor', 'Instructor Wale Adebayo');

  insert into mentors (id, user_id, organization_id, title, bio, specializations, is_active, is_approved)
  values
    (v_mentor1_row_id, v_instructor1_id, v_org_id, 'AI & Data Instructor', 'Teaches AI Fundamentals and Data Literacy.', array['AI', 'Data'], true, true),
    (v_mentor2_row_id, v_instructor2_id, v_org_id, 'Leadership Instructor', 'Teaches Leadership Essentials.', array['Leadership'], true, true);

  -- --- Learners (8 total, first 5 report to the demo manager) ---
  for i in 1..8 loop
    insert into auth.users (id, email) values (v_learner_ids[i], 'demo-learner' || i || '@demoacademy.sample');
    insert into user_profiles (id, organization_id, role, display_name, manager_id, last_active_at)
    values (
      v_learner_ids[i], v_org_id, 'learner', v_learner_names[i],
      case when i <= 5 then v_manager_id else null end,
      now() - (i || ' days')::interval
    );
  end loop;

  -- --- Courses: internal (varied categories), one external ---
  insert into courses (id, title, description, category, level, duration_hours, instructor_id, is_published, course_source) values
    (v_course_ai, 'AI Fundamentals', 'An introduction to practical AI concepts for the workplace.', 'AI', 'beginner', 4, v_instructor1_id, true, 'internal'),
    (v_course_leadership, 'Leadership Essentials', 'Core leadership skills for new and aspiring managers.', 'Leadership', 'intermediate', 6, v_instructor2_id, true, 'internal'),
    (v_course_compliance, 'Workplace Compliance 101', 'Mandatory compliance training covering key policies.', 'Compliance', 'beginner', 2, v_instructor1_id, true, 'internal'),
    (v_course_data, 'Data Literacy for Teams', 'Reading, interpreting, and acting on real workplace data.', 'Data', 'beginner', 3, v_instructor1_id, true, 'internal'),
    (v_course_external, 'Advanced Project Management', 'A curated external partner course on project delivery.', 'Management', 'advanced', 8, null, true, 'external');

  insert into lessons (course_id, title, duration_minutes, order_index) values
    (v_course_ai, 'What is AI, really?', 15, 0),
    (v_course_ai, 'AI in your daily workflow', 20, 1),
    (v_course_leadership, 'Leading without authority', 18, 0),
    (v_course_compliance, 'Key policies overview', 12, 0),
    (v_course_data, 'Reading a dashboard', 15, 0);

  -- --- Assessment for AI Fundamentals, with real questions ---
  insert into assessments (id, course_id, title, max_score) values (v_assessment_ai, v_course_ai, 'AI Fundamentals Assessment', 100);
  insert into assessment_questions (assessment_id, question, question_type, options, correct_answer, order_index, points) values
    (v_assessment_ai, 'Which of these is a common workplace use of AI?', 'multiple_choice', '["Drafting emails", "Watering plants", "Painting walls"]'::jsonb, 'Drafting emails', 0, 1),
    (v_assessment_ai, 'AI recommendations should always be...', 'multiple_choice', '["Followed without review", "Reviewed by a person", "Ignored entirely"]'::jsonb, 'Reviewed by a person', 1, 1);

  -- --- Enrollments: realistic spread of progress across learners and courses ---
  for i in 1..8 loop
    v_progress := (array[100, 85, 60, 100, 30, 15, 100, 45])[i];
    insert into course_enrollments (user_id, course_id, progress_percentage, completed_at, enrolled_at)
    values (v_learner_ids[i], v_course_ai, v_progress, case when v_progress = 100 then now() - (i || ' days')::interval else null end, now() - ((i + 10) || ' days')::interval);

    if i <= 6 then
      v_progress := (array[100, 40, 100, 20, 70, 10])[i];
      insert into course_enrollments (user_id, course_id, progress_percentage, completed_at, enrolled_at)
      values (v_learner_ids[i], v_course_leadership, v_progress, case when v_progress = 100 then now() - (i || ' days')::interval else null end, now() - ((i + 8) || ' days')::interval);
    end if;

    if i <= 4 then
      insert into course_enrollments (user_id, course_id, progress_percentage, completed_at, enrolled_at)
      values (v_learner_ids[i], v_course_compliance, 100, now() - (i || ' days')::interval, now() - ((i + 20) || ' days')::interval);
    end if;
  end loop;

  -- --- Assessment attempts matching the completed AI Fundamentals enrollments ---
  insert into assessment_attempts (user_id, assessment_id, score, completed_at) values
    (v_learner_ids[1], v_assessment_ai, 95, now() - interval '1 day'),
    (v_learner_ids[4], v_assessment_ai, 88, now() - interval '3 days'),
    (v_learner_ids[7], v_assessment_ai, 100, now() - interval '2 days');

  -- --- Certificates issued for completed courses ---
  insert into certificates (user_id, course_id, organization_id, status, issued_at, certificate_number, score_pct) values
    (v_learner_ids[1], v_course_ai, v_org_id, 'issued', now() - interval '1 day', 'TAI-DEMO0001', 95),
    (v_learner_ids[4], v_course_ai, v_org_id, 'issued', now() - interval '3 days', 'TAI-DEMO0002', 88),
    (v_learner_ids[1], v_course_leadership, v_org_id, 'issued', now() - interval '5 days', 'TAI-DEMO0003', null),
    (v_learner_ids[3], v_course_leadership, v_org_id, 'issued', now() - interval '2 days', 'TAI-DEMO0004', null);

  -- --- Compliance assignments (Workplace Compliance 101), including overdue ---
  insert into compliance_assignments (user_id, course_id, assigned_by, due_at, status, completed_at) values
    (v_learner_ids[1], v_course_compliance, v_admin_id, current_date - 5, 'completed', now() - interval '1 day'),
    (v_learner_ids[2], v_course_compliance, v_admin_id, current_date - 5, 'completed', now() - interval '3 days'),
    (v_learner_ids[5], v_course_compliance, v_admin_id, current_date - 3, 'overdue', null),
    (v_learner_ids[6], v_course_compliance, v_admin_id, current_date - 10, 'overdue', null);

  -- --- Cohort with members, including both instructors and several learners ---
  insert into cohorts (id, organization_id, name, description, starts_at, ends_at, created_by)
  values (v_cohort_id, v_org_id, 'Q1 Onboarding Cohort', 'New hire onboarding cohort for the demo organization.', current_date - 30, current_date + 60, v_instructor1_id);
  insert into cohort_members (cohort_id, user_id) values
    (v_cohort_id, v_instructor1_id), (v_cohort_id, v_learner_ids[1]), (v_cohort_id, v_learner_ids[2]),
    (v_cohort_id, v_learner_ids[3]), (v_cohort_id, v_learner_ids[4]);

  -- --- Study group ---
  insert into study_groups (id, name, description, course_id, organization_id, created_by)
  values (v_studygroup_id, 'AI Fundamentals Study Circle', 'Peer study group for AI Fundamentals.', v_course_ai, v_org_id, v_instructor1_id);
  insert into study_group_members (group_id, user_id, role) values
    (v_studygroup_id, v_instructor1_id, 'lead'), (v_studygroup_id, v_learner_ids[1], 'member'), (v_studygroup_id, v_learner_ids[4], 'member');

  -- --- AI usage events (Coach + Quiz), spread over the last week ---
  for i in 1..12 loop
    insert into ai_usage_events (user_id, organization_id, feature, created_at)
    values (v_learner_ids[(i % 8) + 1], v_org_id, case when i % 3 = 0 then 'ai_quiz' else 'ai_coach' end, now() - (i || ' hours')::interval);
  end loop;

  raise notice 'Demo data seeded: org %, % learners, 5 courses, 1 cohort, 1 study group', v_org_id, 8;
end $$;
