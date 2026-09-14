-- ============================================================================
-- Per-instructor payout enablement + learner payment requests - confirmed
-- directly: "as a platform owner we should be able to enable and disable
-- this, as some instructors won't be paid as they work for an
-- organisation, and some may be paid as they run like an academy so they
-- can request payments from learners... under earnings there should be a
-- place to request payment and block or pause certain learners access
-- should they don't pay."
-- ============================================================================
-- Revises the blanket payout suspension from 0127 (which blocked every
-- payout request unconditionally) into a real per-instructor toggle -
-- academy-style instructors can be explicitly enabled by the platform
-- owner; org-employed instructors stay blocked by default, matching the
-- described reality directly rather than an all-or-nothing rule.
-- ============================================================================

alter table mentors add column if not exists payouts_enabled boolean not null default false;
comment on column mentors.payouts_enabled is 'Platform-owner-controlled - only an explicitly enabled ("academy-style") instructor can request a real payout. Org-employed instructors default to false.';

drop policy if exists mpr_no_new_requests on mentor_payout_requests;
create policy mpr_insert_enabled_instructor_or_admin on mentor_payout_requests for insert
  with check (
    is_super_admin(auth.uid())
    or exists (select 1 from mentors m where m.user_id = auth.uid() and m.id = mentor_id and m.payouts_enabled = true)
  );

-- Only super_admin can flip this - it's a platform-wide business decision
-- about a specific instructor, not something an org admin or the
-- instructor themselves controls.
create or replace function set_instructor_payouts_enabled(p_mentor_id uuid, p_enabled boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_super_admin(auth.uid()) then
    raise exception 'Only the platform owner can enable or disable instructor payouts';
  end if;
  update mentors set payouts_enabled = p_enabled where id = p_mentor_id;
end;
$$;

-- ============================================================================
-- Learner payment requests - an academy-style instructor requesting
-- payment from a specific learner for a specific course, and the ability
-- to pause that learner's access if they don't pay.
-- ============================================================================

create table if not exists learner_payment_requests (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references mentors(id) on delete cascade,
  learner_id uuid not null references user_profiles(id) on delete cascade,
  course_id uuid references courses(id) on delete set null,
  amount numeric not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'waived')),
  requested_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table learner_payment_requests enable row level security;

drop policy if exists lpr_select_party on learner_payment_requests;
create policy lpr_select_party on learner_payment_requests for select
  using (
    learner_id = auth.uid()
    or exists (select 1 from mentors m where m.id = mentor_id and m.user_id = auth.uid())
    or is_super_admin(auth.uid())
  );

-- Only an instructor whose payouts are actually enabled can request
-- payment - an org-employed instructor with payouts disabled has no
-- reason to be charging learners at all.
drop policy if exists lpr_insert_enabled_instructor on learner_payment_requests;
create policy lpr_insert_enabled_instructor on learner_payment_requests for insert
  with check (
    exists (select 1 from mentors m where m.id = mentor_id and m.user_id = auth.uid() and m.payouts_enabled = true)
  );

drop policy if exists lpr_update_instructor_or_admin on learner_payment_requests;
create policy lpr_update_instructor_or_admin on learner_payment_requests for update
  using (
    exists (select 1 from mentors m where m.id = mentor_id and m.user_id = auth.uid())
    or is_super_admin(auth.uid())
  );

-- course_enrollments gets a real "paused" flag - the actual enforcement
-- point for "block or pause certain learners' access should they not
-- pay." A paused enrollment is checked by the learner-facing course
-- access path, not just hidden in the instructor's own view.
alter table course_enrollments add column if not exists access_paused boolean not null default false;
comment on column course_enrollments.access_paused is 'Set by an instructor with payouts_enabled when a learner has not paid - the real access gate, not just a UI flag.';

create or replace function set_learner_course_access_paused(p_learner_id uuid, p_course_id uuid, p_paused boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_course_instructor uuid;
begin
  select instructor_id into v_course_instructor from courses where id = p_course_id;
  if not (
    (v_course_instructor = auth.uid() and exists (select 1 from mentors m where m.user_id = auth.uid() and m.payouts_enabled = true))
    or is_org_admin(auth.uid())
    or is_super_admin(auth.uid())
  ) then
    raise exception 'Not authorized to change this learner''s access';
  end if;
  update course_enrollments set access_paused = p_paused where user_id = p_learner_id and course_id = p_course_id;
end;
$$;
