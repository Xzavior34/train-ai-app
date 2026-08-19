-- ============================================================================
-- General analysis notes for admin, instructor, and manager - confirmed
-- directly: "there should be a place where instructors, admin or
-- managers can add notes. This notes will be relevant for their
-- analysis... once done, you can share with Emmanuel."
-- ============================================================================
-- Deliberately a new, standalone table rather than extending the
-- existing feedback_notes table (0121) - that table's target_type is a
-- real Postgres enum, and altering an enum to add a new value carries a
-- real, non-trivial risk (the new value cannot always be used safely in
-- the same transaction it was added in, depending on Postgres version and
-- how the migration is applied) that could not be verified in this
-- environment. This use case is also genuinely different in shape - a
-- person's own running notes for their own analysis, not about any
-- specific learner or department - so a clean, separate table is the
-- safer and more honest design here, not just the more cautious one.
-- ============================================================================

create table if not exists analysis_notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references user_profiles(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  note_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table analysis_notes enable row level security;

-- Visible to the author themselves, and to an org admin (so notes
-- actually reach the people described as sharing them later, e.g.
-- "share with Emmanuel" implies someone else in the org may need to see
-- them) - not visible org-wide by default, since these are personal
-- working notes, not a public board.
drop policy if exists an_select_scoped on analysis_notes;
create policy an_select_scoped on analysis_notes for select
  using (
    author_id = auth.uid()
    or (organization_id = get_user_organization_id(auth.uid()) and is_org_admin(auth.uid()))
    or is_super_admin(auth.uid())
  );

drop policy if exists an_write_own on analysis_notes;
create policy an_write_own on analysis_notes for all
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create index if not exists idx_analysis_notes_author on analysis_notes(author_id, created_at desc);
