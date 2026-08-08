-- ============================================================================
-- Learning Paths - fix two real gaps found while building the admin UI
-- ============================================================================
-- Product brief: "Learning Paths are primarily an Admin feature... Admins
-- organize: Tracks, Cohorts, Assigned learning journeys." No admin screen
-- for this existed anywhere in the app - only the backend functions
-- (createLearningPath / updateLearningPath / fetchLearningPathsAdmin in
-- lib/api/platform.js), never wired to a UI. Building that UI surfaced two
-- real bugs, found by reading the actual RLS state rather than assuming the
-- existing functions worked:
--
-- 1. learning_path_courses has RLS enabled (via the blanket per-table
--    enable loop in 0006_rls_policies.sql) but had ZERO policies defined
--    default-deny for every role except service_role. This is the join
--    table that actually records which courses belong to a path and in
--    what order; createLearningPath/updateLearningPath both write to it
--    directly. Without a policy, those calls would have failed outright
--    for any real admin, RLS or no UI notwithstanding.
--
-- 2. learning_paths' own write policy (lpaths_write_authorized,
--    0008_learner_app_rls_gapfill.sql) checked only
--    effective_has_permission(auth.uid(), 'manage_courses') - a permission
--    check with no organization scoping at all. learning_paths.organization_id
--    exists specifically to scope a path to one org (unlike `courses`, which
--    has no organization_id column and is deliberately shared/global) - so
--    an admin from Org A with manage_courses could read, edit, or delete
--    Org B's paths outright. Fixed to also require the row's
--    organization_id match the caller's own org, with a super_admin bypass
--    for the platform-wide case.
-- ============================================================================

drop policy if exists lpaths_write_authorized on learning_paths;
create policy lpaths_write_authorized on learning_paths for all
  using (
    (
      effective_has_permission(auth.uid(), 'manage_courses')
      and organization_id = get_user_organization_id(auth.uid())
    )
    or is_super_admin(auth.uid())
  )
  with check (
    (
      effective_has_permission(auth.uid(), 'manage_courses')
      and organization_id = get_user_organization_id(auth.uid())
    )
    or is_super_admin(auth.uid())
  );

create policy lpc_select_via_path on learning_path_courses for select
  using (
    exists (
      select 1 from learning_paths lp
      where lp.id = learning_path_courses.path_id
        and (lp.is_published or lp.organization_id = get_user_organization_id(auth.uid()))
    )
    or is_super_admin(auth.uid())
  );

create policy lpc_write_via_path on learning_path_courses for all
  using (
    exists (
      select 1 from learning_paths lp
      where lp.id = learning_path_courses.path_id
        and effective_has_permission(auth.uid(), 'manage_courses')
        and lp.organization_id = get_user_organization_id(auth.uid())
    )
    or is_super_admin(auth.uid())
  )
  with check (
    exists (
      select 1 from learning_paths lp
      where lp.id = learning_path_courses.path_id
        and effective_has_permission(auth.uid(), 'manage_courses')
        and lp.organization_id = get_user_organization_id(auth.uid())
    )
    or is_super_admin(auth.uid())
  );
