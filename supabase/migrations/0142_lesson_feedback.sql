-- ============================================================================
-- Lesson feedback - confirmed directly against the real 1.0 reference
-- codebase (LessonFeedback.tsx). A quick, optional prompt after
-- completing a lesson: how confident do you feel, was it helpful, do you
-- need more resources. Purely additive - does not touch or gate the
-- existing "mark lesson complete" flow in any way.
-- ============================================================================

create table if not exists lesson_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  confidence int not null check (confidence between 1 and 5),
  helpful boolean not null,
  needs_more_resources boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

alter table lesson_feedback enable row level security;

-- Same real shape already proven for lesson_progress on this exact
-- relationship (lp_select_own/lp_write_own, 0006_rls_policies.sql) - a
-- learner's own rows, plus the course's own instructor and an org admin
-- can read (real, useful signal for them), not write.
drop policy if exists lf_select_own_or_staff on lesson_feedback;
create policy lf_select_own_or_staff on lesson_feedback for select
  using (
    user_id = auth.uid()
    or exists (select 1 from courses c where c.id = lesson_feedback.course_id and c.instructor_id = auth.uid())
    or effective_has_permission(auth.uid(), 'manage_courses')
    or is_super_admin(auth.uid())
  );

drop policy if exists lf_write_own on lesson_feedback;
create policy lf_write_own on lesson_feedback for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_lesson_feedback_lesson on lesson_feedback(lesson_id);
