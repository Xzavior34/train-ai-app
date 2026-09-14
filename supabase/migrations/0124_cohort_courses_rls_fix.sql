-- ============================================================================
-- cohort_courses had RLS enabled with zero policies - a real gap found
-- while building the "Cohort Assigned Courses" feature (PRD Section 7.4)
-- ============================================================================
-- Same pattern found and fixed multiple times before in this project
-- (bookmarks, learning_path_courses, assessment tables): the blanket
-- per-table RLS-enable loop (0006_rls_policies.sql) correctly enabled RLS
-- on cohort_courses (created in 0002_progress_quizzes_cohorts.sql, before
-- RLS existed at all), but nothing ever added real policies for it -
-- meaning the table has been completely inaccessible (default-deny) to
-- everyone, including a legitimate org admin trying to assign a course to
-- a cohort, this whole time. Found only because building the "Assigned
-- Courses" tab required actually querying this table for the first time -
-- it was never exercised by any existing screen before this.
-- ============================================================================

drop policy if exists cc_select_cohort_member_or_admin on cohort_courses;
create policy cc_select_cohort_member_or_admin on cohort_courses for select
  using (
    exists (select 1 from cohort_members cm where cm.cohort_id = cohort_courses.cohort_id and cm.user_id = auth.uid())
    or is_org_admin(auth.uid())
    or is_super_admin(auth.uid())
  );

drop policy if exists cc_write_admin on cohort_courses;
create policy cc_write_admin on cohort_courses for all
  using (is_org_admin(auth.uid()) or is_super_admin(auth.uid()))
  with check (is_org_admin(auth.uid()) or is_super_admin(auth.uid()));
