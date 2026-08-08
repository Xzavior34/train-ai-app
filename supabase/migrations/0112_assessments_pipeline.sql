-- ============================================================================
-- Assessments - the pipeline this feature needed and never had
-- ============================================================================
-- Product brief, twice: "Assessments are auto-graded. Instructors may
-- override grades" and Instructor responsibilities include "Override AI
-- grading." Went to add a grade-override button and found there was
-- nothing to override: assessment_attempts had zero RLS policies (not even
-- a learner could submit or read their own attempt), no submission function
-- existed anywhere in the client, and "assessment" appears in exactly one
-- learner-facing file - the AI Quiz Generator, a different feature the
-- brief explicitly distinguishes from Assessments. This is the whole
-- pipeline underneath grade override, built to match the one part of this
-- schema that already does the equivalent correctly: quizzes
-- (quiz_questions / safe_quiz_questions / check_quiz_answers(), all in
-- 0002_progress_quizzes_cohorts.sql and 0005_functions.sql).
--
-- assessments.questions (jsonb, 0002) is left in place but unused - no code
-- ever read or wrote it, so there's no data to migrate. Real structure
-- below mirrors quiz_questions exactly, as a proper table, for the same
-- reason quizzes use one: a jsonb blob can't be selectively hidden from
-- learners the way a column-scoped view can, and grading logic against
-- real rows is far less error-prone than parsing a blob shape nobody had
-- committed to yet.
-- ============================================================================

create table if not exists assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  question text not null,
  question_type text not null default 'multiple_choice',
  options jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  explanation text,
  order_index int not null default 0,
  points int not null default 1
);

-- Client-safe view: never exposes correct_answer. Same pattern as
-- safe_quiz_questions.
create or replace view safe_assessment_questions as
  select id, assessment_id, question, question_type, options, order_index, points
  from assessment_questions;

-- Grading history, not just a silent overwrite: an instructor override
-- keeps the original auto-graded score visible rather than replacing it
-- invisibly, so "Instructors may override grades" is something a learner
-- or a later reviewer can actually see happened, not a fact only present in
-- an audit log they'll never look at.
alter table assessment_attempts add column if not exists ai_score numeric;
alter table assessment_attempts add column if not exists overridden_by uuid references user_profiles(id);
alter table assessment_attempts add column if not exists overridden_at timestamptz;
alter table assessment_attempts add column if not exists override_note text;

alter table assessment_questions enable row level security;

drop policy if exists aq_select_none on assessment_questions;
create policy aq_select_none on assessment_questions for select using (false); -- force use of safe_assessment_questions view

drop policy if exists aq_write_authorized on assessment_questions;
create policy aq_write_authorized on assessment_questions for all
  using (
    exists (
      select 1 from assessments a join courses c on c.id = a.course_id
      where a.id = assessment_questions.assessment_id
        and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses'))
    )
    or is_super_admin(auth.uid())
  )
  with check (
    exists (
      select 1 from assessments a join courses c on c.id = a.course_id
      where a.id = assessment_questions.assessment_id
        and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses'))
    )
    or is_super_admin(auth.uid())
  );

-- assessments and assessment_answer_keys themselves had no policies either
-- (same silent gap as their child table) - fixed alongside it, same
-- authorization shape as assessment_questions above.
drop policy if exists assessments_select_published on assessments;
create policy assessments_select_published on assessments for select using (true);
-- Read access is intentionally open (question text/options are hidden by
-- the safe view regardless, and an assessment row on its own reveals
-- nothing gradeable) - this matches courses_select_published's posture of
-- letting anyone browse course-level metadata.

drop policy if exists assessments_write_authorized on assessments;
create policy assessments_write_authorized on assessments for all
  using (
    exists (select 1 from courses c where c.id = assessments.course_id and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses')))
    or is_super_admin(auth.uid())
  )
  with check (
    exists (select 1 from courses c where c.id = assessments.course_id and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses')))
    or is_super_admin(auth.uid())
  );

drop policy if exists aak_select_none on assessment_answer_keys;
create policy aak_select_none on assessment_answer_keys for select using (false); -- never client-readable, even to the instructor who owns it - grading goes through check_assessment_answers()/the override path, not by reading the key directly

drop policy if exists aak_write_authorized on assessment_answer_keys;
create policy aak_write_authorized on assessment_answer_keys for all
  using (
    exists (select 1 from assessments a join courses c on c.id = a.course_id where a.id = assessment_answer_keys.assessment_id and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses')))
    or is_super_admin(auth.uid())
  )
  with check (
    exists (select 1 from assessments a join courses c on c.id = a.course_id where a.id = assessment_answer_keys.assessment_id and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses')))
    or is_super_admin(auth.uid())
  );

-- assessment_attempts: a learner can submit and read their own; an
-- instructor/admin scoped to that course can read and grade (override)
-- every attempt for it. Deliberately no learner UPDATE policy at all
-- unlike quiz_attempts (pure self-practice, qa_write_own allows the learner
-- to write their own row freely), a real assessment's score feeds
-- certificates and completion, so only the grading path below can change it
-- once submitted.
drop policy if exists aa_select_own on assessment_attempts;
create policy aa_select_own on assessment_attempts for select using (user_id = auth.uid());

drop policy if exists aa_insert_own on assessment_attempts;
create policy aa_insert_own on assessment_attempts for insert with check (user_id = auth.uid());

drop policy if exists aa_select_grader on assessment_attempts;
create policy aa_select_grader on assessment_attempts for select
  using (
    exists (
      select 1 from assessments a join courses c on c.id = a.course_id
      where a.id = assessment_attempts.assessment_id
        and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses'))
    )
    or is_super_admin(auth.uid())
  );

drop policy if exists aa_update_grader on assessment_attempts;
create policy aa_update_grader on assessment_attempts for update
  using (
    exists (
      select 1 from assessments a join courses c on c.id = a.course_id
      where a.id = assessment_attempts.assessment_id
        and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses'))
    )
    or is_super_admin(auth.uid())
  )
  with check (
    exists (
      select 1 from assessments a join courses c on c.id = a.course_id
      where a.id = assessment_attempts.assessment_id
        and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses'))
    )
    or is_super_admin(auth.uid())
  );

-- Server-side scoring, mirroring check_quiz_answers() exactly - the
-- learner never receives correct_answer, only their computed result.
create or replace function check_assessment_answers(p_assessment_id uuid, p_answers jsonb)
returns table (score numeric, correct_count int, total int, total_points int)
language plpgsql security definer set search_path = public as $$
declare
  v_total int;
  v_correct int := 0;
  v_points int := 0;
  v_total_points int := 0;
  q record;
begin
  select count(*) into v_total from assessment_questions where assessment_id = p_assessment_id;
  for q in select * from assessment_questions where assessment_id = p_assessment_id loop
    v_total_points := v_total_points + q.points;
    if (p_answers ->> q.id::text) = q.correct_answer then
      v_correct := v_correct + 1;
      v_points := v_points + q.points;
    end if;
  end loop;
  return query select
    case when v_total > 0 then round(v_correct::numeric / v_total * 100, 1) else 0 end,
    v_correct, v_total, v_points;
end;
$$;

comment on function check_assessment_answers(uuid, jsonb) is
  'Server-side assessment scoring, never exposing correct_answer to the caller. Client inserts the resulting assessment_attempts row itself (same two-step shape as check_quiz_answers + the quiz_attempts insert in lib/api/learner.js).';
