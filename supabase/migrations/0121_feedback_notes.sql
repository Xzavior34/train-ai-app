-- ============================================================================
-- Instructor and Manager feedback notes - both explicitly required, both
-- confirmed unbuilt
-- ============================================================================
-- PRD Summary v4.0, Section 8.1 (Instructor view): "Feedback for learners
-- (Note section)." Section 8.2 (Manager view): "Manager feedback for
-- department (Note section)." Confirmed by checking the actual codebase -
-- no notes/feedback table or screen existed for either role.
--
-- One shared table serves both, since the shape is nearly identical
-- (author writes a note, it's visible to specific people) - the only real
-- difference is what the note is *about*: a specific learner
-- (Instructor's case) or a whole department (Manager's case).
-- ============================================================================

create type feedback_note_target as enum ('learner', 'department');

create table if not exists feedback_notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references user_profiles(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  target_type feedback_note_target not null,
  target_learner_id uuid references user_profiles(id) on delete cascade,
  target_department text,
  note_text text not null,
  created_at timestamptz not null default now(),
  constraint feedback_notes_target_check check (
    (target_type = 'learner' and target_learner_id is not null and target_department is null)
    or (target_type = 'department' and target_department is not null and target_learner_id is null)
  )
);

alter table feedback_notes enable row level security;

-- Visible to: the author themselves, any admin/manage_courses holder in
-- the same org (so notes actually reach the people who'd act on them, not
-- just sit invisibly with their author), and - for a learner-targeted note
-- specifically - the learner the note is about, since "Feedback for
-- learners" implies it's meant to reach them, not just be filed away.
drop policy if exists fn_select_scoped on feedback_notes;
create policy fn_select_scoped on feedback_notes for select
  using (
    author_id = auth.uid()
    or (target_type = 'learner' and target_learner_id = auth.uid())
    or (organization_id = get_user_organization_id(auth.uid()) and is_org_admin(auth.uid()))
    or is_super_admin(auth.uid())
  );

-- Writable by the author only for their own notes, scoped so an
-- instructor/manager can only write notes within their own organization -
-- an instructor from Org A writing a "note" about a learner in Org B would
-- be exactly the kind of cross-tenant leak this app has been careful to
-- close everywhere else.
drop policy if exists fn_write_own on feedback_notes;
create policy fn_write_own on feedback_notes for all
  using (author_id = auth.uid())
  with check (
    author_id = auth.uid()
    and organization_id = get_user_organization_id(auth.uid())
  );

create index if not exists idx_feedback_notes_learner on feedback_notes(target_learner_id) where target_type = 'learner';
create index if not exists idx_feedback_notes_department on feedback_notes(organization_id, target_department) where target_type = 'department';
