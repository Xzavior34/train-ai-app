-- ============================================================================
-- A real, persistent mock demo course - "build a mock data course so i can
-- see how it is." Every prior verification in this project used temporary
-- Playwright fixtures that get reverted after each test - meaning nobody
-- has ever actually seen persistent example content when opening a real
-- deployment of this app. This seeds one, for real, so it's there the
-- first time anyone signs in.
-- ============================================================================
-- instructor_id is left null - a fresh deployment has no way to know which
-- real user_profiles row should own this, and courses.instructor_id is
-- nullable by schema. Clearly labeled as a demo course in its own title
-- and description rather than pretending to be a real one, and running
-- this migration twice is safe (checks for its own marker first).
-- ============================================================================

do $$
declare
  v_course_id uuid;
  v_lesson1_id uuid;
  v_lesson2_id uuid;
  v_lesson3_id uuid;
  v_assessment_id uuid;
begin
  if exists (select 1 from courses where title = 'Getting Started with Train AI (Demo Course)') then
    return;
  end if;

  insert into courses (title, description, category, level, duration_hours, is_published, course_source)
  values (
    'Getting Started with Train AI (Demo Course)',
    'A real example course seeded so you can see exactly how a course, its lessons, and its assessment look and behave end to end - not a placeholder, genuinely functional.',
    'General', 'beginner', 1.5, true, 'internal'
  )
  returning id into v_course_id;

  insert into lessons (course_id, title, description, content, duration_minutes, order_index)
  values (v_course_id, 'Welcome to Train AI', 'What this platform does and how it fits into your organization.',
    'Train AI brings together course delivery, cohorts, AI-assisted coaching, and workforce intelligence in one platform. This lesson walks through the pieces you will use most: courses, cohorts, and your AI Coach.',
    8, 0)
  returning id into v_lesson1_id;

  insert into lessons (course_id, title, description, content, duration_minutes, order_index)
  values (v_course_id, 'Navigating Your Dashboard', 'A tour of the Home, Courses, AI, and Community tabs.',
    'Your Home tab surfaces what needs your attention today. Courses is where you browse and continue learning. The AI tab holds your Coach, Quiz Generator, and Insights. Community is where your cohort, study groups, and rank live.',
    10, 1)
  returning id into v_lesson2_id;

  insert into lessons (course_id, title, description, content, duration_minutes, order_index)
  values (v_course_id, 'Completing Your First Assessment', 'How assessments, scoring, and certificates connect.',
    'Once you finish a course''s lessons, its assessment becomes available. A passing score can make a certificate available, if your organization has configured one for this course.',
    12, 2)
  returning id into v_lesson3_id;

  insert into assessments (course_id, title, description, max_score)
  values (v_course_id, 'Getting Started with Train AI Assessment', 'A short check of what this demo course covered.', 100)
  returning id into v_assessment_id;

  insert into assessment_questions (assessment_id, question, question_type, options, correct_answer, explanation, order_index, points)
  values
    (v_assessment_id, 'Which tab holds your AI Coach, Quiz Generator, and Insights?', 'multiple_choice',
     '["Home", "Courses", "AI", "Community"]'::jsonb, 'AI', 'The AI tab groups all three AI-powered tools together.', 0, 1),
    (v_assessment_id, 'What can become available after a passing assessment score, if configured?', 'multiple_choice',
     '["A certificate", "A new organization", "A different role", "A payout"]'::jsonb, 'A certificate',
     'Certificate availability is tied to a passing assessment score for that course.', 1, 1),
    (v_assessment_id, 'Where would you find your cohort, study groups, and rank?', 'multiple_choice',
     '["Home", "Courses", "AI", "Community"]'::jsonb, 'Community', 'Community is where cohort activity, study groups, and the leaderboard live.', 2, 1);

  raise notice 'Demo course seeded: % (assessment: %)', v_course_id, v_assessment_id;
end $$;
