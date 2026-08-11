-- ============================================================================
-- Instructor/mentor payouts - temporarily suspended, made explicit
-- ============================================================================
-- Explicit architecture decision: "Train AI is currently intended to be
-- the sole payment recipient; instructor/mentor payouts are temporarily
-- suspended." A real, confirmed violation was found: the client-side
-- submitMentorPayoutRequest() function let a mentor actually submit a
-- payout request with no restriction, and in demo mode this returned a
-- fake success response - genuinely misleading, not just a missing
-- feature. The client-side function itself has been changed to always
-- return a clear rejection message rather than a fake success.
--
-- This migration makes the underlying database state intentional rather
-- than an accidental side effect: mentor_payout_requests had RLS enabled
-- (via the blanket per-table loop) with zero actual policies defined -
-- meaning any real, connected attempt would already have failed with a
-- generic RLS error, not a deliberate, explained one. Adding a real
-- explicit policy here so the restriction is documented and intentional,
-- not an accident that happens to currently produce the right result.
--
-- Earnings visibility is untouched - mentor_earnings keeps whatever
-- policies it already had; only *requesting a payout* is blocked.
-- ============================================================================

drop policy if exists mpr_no_new_requests on mentor_payout_requests;
create policy mpr_no_new_requests on mentor_payout_requests for insert
  with check (is_super_admin(auth.uid()));

comment on table mentor_payout_requests is
  'Payout requests are suspended - "Train AI is currently intended to be the sole payment recipient." Only super_admin can insert here (e.g. to manually process a one-off exception) - a mentor cannot create a new request through the normal app flow.';

-- ============================================================================
-- Instructors can create and manage cohorts, not just admins - confirmed
-- directly: "Everything around cohorts should also be accessible to
-- instructors" and "Instructors should also be able to manage and create
-- cohorts." cohorts_write_admin (0006_rls_policies.sql) only ever allowed
-- is_org_admin() - a plain instructor could not create a cohort at all.
-- ============================================================================

drop policy if exists cohorts_write_admin on cohorts;

-- Anyone with org-level write access - admin or a real instructor in this
-- org - can create a new cohort.
drop policy if exists cohorts_insert_admin_or_instructor on cohorts;
create policy cohorts_insert_admin_or_instructor on cohorts for insert
  with check (
    organization_id = get_user_organization_id(auth.uid())
    and (is_org_admin(auth.uid()) or has_role(auth.uid(), 'mentor'::platform_role))
  );

-- Managing an existing cohort (rename, reschedule, archive) - admins can
-- manage any cohort in their org; an instructor can manage cohorts they're
-- actually assigned to (via cohort_members), same scoping already used for
-- cohort_resources/cohort_sessions in 0126.
drop policy if exists cohorts_update_admin_or_assigned_instructor on cohorts;
create policy cohorts_update_admin_or_assigned_instructor on cohorts for update
  using (
    organization_id = get_user_organization_id(auth.uid())
    and (
      is_org_admin(auth.uid())
      or (has_role(auth.uid(), 'mentor'::platform_role) and exists (
        select 1 from cohort_members cm where cm.cohort_id = cohorts.id and cm.user_id = auth.uid()
      ))
    )
  );

drop policy if exists cohorts_delete_admin_only on cohorts;
create policy cohorts_delete_admin_only on cohorts for delete
  using (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()));

-- Allows a mentor to add themselves as a member of a cohort they're
-- legitimately creating (see createCohort() in lib/api/platform.js) -
-- cm_write_admin (0006_rls_policies.sql) only ever allowed an org admin to
-- write here at all, which would have silently blocked the auto-add.
-- Admins can still add/remove anyone; a mentor can only ever add or remove
-- themselves specifically, never another user.
drop policy if exists cm_write_admin on cohort_members;
create policy cm_write_admin_or_self on cohort_members for all
  using (is_org_admin(auth.uid()) or user_id = auth.uid())
  with check (is_org_admin(auth.uid()) or user_id = auth.uid());

-- ============================================================================
-- A real, previously undiscovered cross-tenant data leak found while
-- building the "Admins should see all study groups" feature: study_groups
-- has a real organization_id column, but sg_select_all
-- (0008_learner_app_rls_gapfill.sql) used "using (true)" - meaning any
-- authenticated user, from any organization, could see every study group
-- on the entire platform, not just their own org's. Scoped correctly now.
-- ============================================================================

drop policy if exists sg_select_all on study_groups;
drop policy if exists sg_select_own_org on study_groups;
create policy sg_select_own_org on study_groups for select
  using (
    organization_id = get_user_organization_id(auth.uid())
    or organization_id is null
    or is_super_admin(auth.uid())
  );

-- ============================================================================
-- A real infinite-recursion bug found by testing, not caught by reading
-- the code: study_groups' write policy checks study_group_members (is the
-- caller a member), and study_group_members' write policy checks
-- study_groups (did the caller create this group) - each policy's
-- evaluation triggers the other's, which triggers the first's again.
-- Postgres correctly refuses this outright ("infinite recursion detected
-- in policy for relation study_groups") rather than silently doing
-- something wrong - caught only because a real UPDATE was actually run
-- against a real database, not from reading either policy in isolation.
--
-- Fixed with the same pattern already used everywhere else in this schema
-- for exactly this situation (is_org_admin(), has_role(), etc.) - a
-- SECURITY DEFINER function's internal query does not re-trigger RLS
-- evaluation the way a direct EXISTS subquery inside a policy does,
-- breaking the cycle.
-- ============================================================================

create or replace function is_study_group_creator(check_user_id uuid, check_group_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from study_groups sg where sg.id = check_group_id and sg.created_by = check_user_id);
$$;

create or replace function is_study_group_member(check_user_id uuid, check_group_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from study_group_members sgm where sgm.group_id = check_group_id and sgm.user_id = check_user_id);
$$;

-- Instructor study group management - a real gap found while building the
-- actual management screen for this: sgm_write_own
-- (0008_learner_app_rls_gapfill.sql) only ever allowed a user to
-- insert/delete their *own* row in study_group_members - meaning an
-- instructor managing their own group could never remove a different
-- learner from it, only themselves. Extended so the group's creator (or
-- an org admin) can manage any member row for that specific group, while
-- an ordinary member can still only ever manage their own.
drop policy if exists sgm_write_own on study_group_members;
drop policy if exists sgm_write_own_or_group_creator on study_group_members;
create policy sgm_write_own_or_group_creator on study_group_members for all
  using (
    user_id = auth.uid()
    or is_org_admin(auth.uid())
    or is_study_group_creator(auth.uid(), group_id)
  )
  with check (
    is_org_admin(auth.uid())
    or is_study_group_creator(auth.uid(), group_id)
    -- Self-join is allowed, but only ever as an ordinary member - a real
    -- bug found by testing, not assumed safe: without the role check
    -- below, any unrelated user could self-insert as 'lead' into a study
    -- group they didn't create, since "user_id = auth.uid()" alone says
    -- nothing about which role they're claiming.
    or (user_id = auth.uid() and role = 'member')
  );

-- Instructors can manage a study group they're a genuine member of, not
-- only ones they personally created - same scoping pattern already used
-- for cohorts (0126/above: instructor assigned via membership, not just
-- "created it" or an org-wide permission grant that may or may not be
-- configured for the mentor role in a given organization's permission
-- matrix). sg_write_authorized (0008_learner_app_rls_gapfill.sql)
-- previously only covered created_by = auth.uid() or a configurable
-- manage_courses permission - this adds a third, always-true path.
-- Uses is_study_group_member() (not a direct EXISTS on
-- study_group_members) - see the recursion note above.
drop policy if exists sg_write_authorized on study_groups;
drop policy if exists sg_write_authorized_or_member_instructor on study_groups;
create policy sg_write_authorized_or_member_instructor on study_groups for all
  using (
    created_by = auth.uid()
    or effective_has_permission(auth.uid(), 'manage_courses')
    or is_super_admin(auth.uid())
    or (has_role(auth.uid(), 'mentor'::platform_role) and is_study_group_member(auth.uid(), id))
  )
  with check (
    created_by = auth.uid()
    or effective_has_permission(auth.uid(), 'manage_courses')
    or is_super_admin(auth.uid())
    or (has_role(auth.uid(), 'mentor'::platform_role) and is_study_group_member(auth.uid(), id))
  );
