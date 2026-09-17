-- ============================================================================
-- Systemic fix: bare is_org_admin(auth.uid()) with no organization match,
-- across cohort_members, cohort_learner_courses, cohort_courses,
-- cohort_resources, cohort_sessions, cohort_posts, cohort_post_replies,
-- cohort_post_reactions, study_group_messages, study_group_members,
-- compliance_assignments, and the set_learner_course_access_paused() RPC.
-- ============================================================================
-- Found while running the Phase 4/5 (Org A <-> Org B attack) tests in this
-- pass, starting from a single empirical result: an Org B admin could both
-- READ and DELETE an Org A cohort's session through cohort_sessions,
-- despite 0149/0150 already fixing courses/certificates/cohort-course
-- referential integrity. Tracing the root cause (is_org_admin(auth.uid())
-- alone, the exact same unscoped-permission class fixed for courses in
-- 0149) and then grepping the rest of the schema for the identical bare
-- pattern surfaced eleven more affected policies and one RPC across nine
-- tables - this was not an isolated bug, it was a repeated pattern applied
-- every time a "cohort collaboration" feature was built.
--
-- is_org_admin(user) only ever answers "is this person an admin of *some*
-- organization" - it was never meant to be a tenant boundary by itself,
-- only a role check to be combined with an actual org/cohort match. Most
-- of the RLS in this schema does combine it correctly (cohorts_write_admin,
-- 0006; cohorts_insert/update/delete, 0127; the 0149 courses fix); these
-- eleven policies simply never got that second half.
--
-- Fix pattern, consistent with every other tenant-scoping fix in this
-- schema: resolve each resource's owning organization_id through its
-- cohort_id / study_group_id / user_id (whichever it actually has), then
-- require it to equal get_user_organization_id(auth.uid()) alongside the
-- existing is_org_admin()/role checks. Every pre-existing membership-based
-- or ownership-based clause (cohort_members, author_id, user_id) is left
-- exactly as it was - those were already correctly scoped, since
-- membership in a specific cohort is itself a real, if now newly-enforced,
-- tenant boundary.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- cohort_members
-- ---------------------------------------------------------------------------
-- NOTE: cm_write_admin (0006) was already dropped and replaced by
-- cm_write_admin_or_self in 0127_suspend_instructor_payouts.sql, to let a
-- mentor auto-add themselves when creating a cohort (createCohort() in
-- lib/api/platform.js). That replacement kept the same is_org_admin() bug
-- AND introduced a second one: `user_id = auth.uid()` with no org check at
-- all meant literally any authenticated user - including a learner in a
-- completely different organization - could self-insert into ANY cohort's
-- membership list, which would then unlock read access through every
-- cm.user_id = auth.uid() membership check elsewhere (cohort_posts,
-- cohort_sessions, cohort_resources). Fixed by requiring the self-joiner
-- to actually belong to the same org as the cohort - preserves the
-- self-add behavior 0127 intended, closes the cross-org path.
drop policy if exists cm_write_admin_or_self on cohort_members;
drop policy if exists cm_write_admin on cohort_members;
create policy cm_write_admin_or_self on cohort_members for all
  using (
    (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_members.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
    or (user_id = auth.uid() and exists (select 1 from cohorts co where co.id = cohort_members.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
  )
  with check (
    (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_members.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
    or (user_id = auth.uid() and exists (select 1 from cohorts co where co.id = cohort_members.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
  );

drop policy if exists cm_select_self_or_admin on cohort_members;
create policy cm_select_self_or_admin on cohort_members for select
  using (
    user_id = auth.uid()
    or (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_members.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
  );

-- ---------------------------------------------------------------------------
-- cohort_learner_courses
-- ---------------------------------------------------------------------------
drop policy if exists clc_select_self_or_admin on cohort_learner_courses;
create policy clc_select_self_or_admin on cohort_learner_courses for select
  using (
    user_id = auth.uid()
    or (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_learner_courses.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
  );

drop policy if exists clc_write_admin on cohort_learner_courses;
create policy clc_write_admin on cohort_learner_courses for all
  using (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_learner_courses.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
  with check (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_learner_courses.cohort_id and co.organization_id = get_user_organization_id(auth.uid())));

-- ---------------------------------------------------------------------------
-- cohort_courses
-- ---------------------------------------------------------------------------
drop policy if exists cc_select_cohort_member_or_admin on cohort_courses;
create policy cc_select_cohort_member_or_admin on cohort_courses for select
  using (
    exists (select 1 from cohort_members cm where cm.cohort_id = cohort_courses.cohort_id and cm.user_id = auth.uid())
    or (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_courses.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
    or is_super_admin(auth.uid())
  );

drop policy if exists cc_write_admin on cohort_courses;
create policy cc_write_admin on cohort_courses for all
  using ((is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_courses.cohort_id and co.organization_id = get_user_organization_id(auth.uid()))) or is_super_admin(auth.uid()))
  with check ((is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_courses.cohort_id and co.organization_id = get_user_organization_id(auth.uid()))) or is_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- cohort_resources
-- ---------------------------------------------------------------------------
drop policy if exists cres_select_member on cohort_resources;
create policy cres_select_member on cohort_resources for select
  using (
    exists (select 1 from cohort_members cm where cm.cohort_id = cohort_resources.cohort_id and cm.user_id = auth.uid())
    or (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_resources.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
  );

drop policy if exists cres_write_admin_or_instructor on cohort_resources;
create policy cres_write_admin_or_instructor on cohort_resources for all
  using (
    (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_resources.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
    or (has_role(auth.uid(), 'mentor'::platform_role) and exists (select 1 from cohort_members cm where cm.cohort_id = cohort_resources.cohort_id and cm.user_id = auth.uid()))
  )
  with check (
    (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_resources.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
    or (has_role(auth.uid(), 'mentor'::platform_role) and exists (select 1 from cohort_members cm where cm.cohort_id = cohort_resources.cohort_id and cm.user_id = auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- cohort_sessions - the table that surfaced this whole pass: empirically
-- confirmed an Org B admin could both read AND delete an Org A session
-- before this fix.
-- ---------------------------------------------------------------------------
drop policy if exists csess_select_member on cohort_sessions;
create policy csess_select_member on cohort_sessions for select
  using (
    exists (select 1 from cohort_members cm where cm.cohort_id = cohort_sessions.cohort_id and cm.user_id = auth.uid())
    or (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_sessions.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
  );

drop policy if exists csess_write_admin_or_instructor on cohort_sessions;
create policy csess_write_admin_or_instructor on cohort_sessions for all
  using (
    (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_sessions.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
    or (has_role(auth.uid(), 'mentor'::platform_role) and exists (select 1 from cohort_members cm where cm.cohort_id = cohort_sessions.cohort_id and cm.user_id = auth.uid()))
  )
  with check (
    (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_sessions.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
    or (has_role(auth.uid(), 'mentor'::platform_role) and exists (select 1 from cohort_members cm where cm.cohort_id = cohort_sessions.cohort_id and cm.user_id = auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- cohort_posts (insert already safe via required cohort_members check -
-- left untouched; select/update/delete fixed)
-- ---------------------------------------------------------------------------
drop policy if exists cpost_select_member on cohort_posts;
create policy cpost_select_member on cohort_posts for select
  using (
    exists (select 1 from cohort_members cm where cm.cohort_id = cohort_posts.cohort_id and cm.user_id = auth.uid())
    or (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_posts.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
  );

drop policy if exists cpost_update_own_or_admin on cohort_posts;
create policy cpost_update_own_or_admin on cohort_posts for update
  using (
    author_id = auth.uid()
    or (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_posts.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
  );

drop policy if exists cpost_delete_own_or_admin on cohort_posts;
create policy cpost_delete_own_or_admin on cohort_posts for delete
  using (
    author_id = auth.uid()
    or (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_posts.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
  );

-- ---------------------------------------------------------------------------
-- cohort_post_replies - insert had NO membership/org check at all (worse
-- than the others: any org admin anywhere could reply into any cohort's
-- thread). select/delete fixed the same way as cohort_posts.
-- ---------------------------------------------------------------------------
drop policy if exists cpr_select_member on cohort_post_replies;
create policy cpr_select_member on cohort_post_replies for select
  using (
    exists (
      select 1 from cohort_posts p join cohort_members cm on cm.cohort_id = p.cohort_id
      where p.id = cohort_post_replies.post_id and cm.user_id = auth.uid()
    )
    or (is_org_admin(auth.uid()) and exists (
      select 1 from cohort_posts p join cohorts co on co.id = p.cohort_id
      where p.id = cohort_post_replies.post_id and co.organization_id = get_user_organization_id(auth.uid())
    ))
  );

drop policy if exists cpr_insert_instructor_only on cohort_post_replies;
create policy cpr_insert_instructor_only on cohort_post_replies for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from cohort_posts p join cohort_members cm on cm.cohort_id = p.cohort_id
      where p.id = cohort_post_replies.post_id and cm.user_id = auth.uid()
    )
    and (has_role(auth.uid(), 'mentor'::platform_role) or is_org_admin(auth.uid()) or is_super_admin(auth.uid()))
  );

drop policy if exists cpr_delete_own_or_admin on cohort_post_replies;
create policy cpr_delete_own_or_admin on cohort_post_replies for delete
  using (
    author_id = auth.uid()
    or (is_org_admin(auth.uid()) and exists (
      select 1 from cohort_posts p join cohorts co on co.id = p.cohort_id
      where p.id = cohort_post_replies.post_id and co.organization_id = get_user_organization_id(auth.uid())
    ))
  );

-- ---------------------------------------------------------------------------
-- cohort_post_reactions
-- ---------------------------------------------------------------------------
drop policy if exists cpreact_select_member on cohort_post_reactions;
create policy cpreact_select_member on cohort_post_reactions for select
  using (
    exists (
      select 1 from cohort_posts p join cohort_members cm on cm.cohort_id = p.cohort_id
      where p.id = cohort_post_reactions.post_id and cm.user_id = auth.uid()
    )
    or (is_org_admin(auth.uid()) and exists (
      select 1 from cohort_posts p join cohorts co on co.id = p.cohort_id
      where p.id = cohort_post_reactions.post_id and co.organization_id = get_user_organization_id(auth.uid())
    ))
  );

-- ---------------------------------------------------------------------------
-- study_group_messages / study_group_members
-- ---------------------------------------------------------------------------
drop policy if exists sgm_select_member on study_group_messages;
create policy sgm_select_member on study_group_messages for select
  using (
    exists (select 1 from study_group_members sgm where sgm.group_id = study_group_messages.study_group_id and sgm.user_id = auth.uid())
    or (is_org_admin(auth.uid()) and exists (select 1 from study_groups sg where sg.id = study_group_messages.study_group_id and sg.organization_id = get_user_organization_id(auth.uid())))
  );

drop policy if exists sgm_insert_instructor_only on study_group_messages;
create policy sgm_insert_instructor_only on study_group_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from study_group_members sgm
      where sgm.group_id = study_group_messages.study_group_id and sgm.user_id = auth.uid()
    )
    and (has_role(auth.uid(), 'mentor'::platform_role) or is_org_admin(auth.uid()) or is_super_admin(auth.uid()))
  );

drop policy if exists sgm_write_own_or_group_creator on study_group_members;
create policy sgm_write_own_or_group_creator on study_group_members for all
  using (
    user_id = auth.uid()
    or (is_org_admin(auth.uid()) and exists (select 1 from study_groups sg where sg.id = study_group_members.group_id and sg.organization_id = get_user_organization_id(auth.uid())))
    or is_study_group_creator(auth.uid(), group_id)
  )
  with check (
    (is_org_admin(auth.uid()) and exists (select 1 from study_groups sg where sg.id = study_group_members.group_id and sg.organization_id = get_user_organization_id(auth.uid())))
    or is_study_group_creator(auth.uid(), group_id)
    or (user_id = auth.uid() and role = 'member')
  );

-- ---------------------------------------------------------------------------
-- compliance_assignments - no organization_id column; scoped through the
-- assigned learner's own organization, since a compliance assignment is
-- inherently "this org's admin assigning this org's learner" a mandatory
-- course.
-- ---------------------------------------------------------------------------
drop policy if exists comp_select_self_or_admin on compliance_assignments;
create policy comp_select_self_or_admin on compliance_assignments for select
  using (
    user_id = auth.uid()
    or (effective_has_permission(auth.uid(), 'manage_courses') and exists (select 1 from user_profiles up where up.id = compliance_assignments.user_id and up.organization_id = get_user_organization_id(auth.uid())))
    or is_super_admin(auth.uid())
  );

drop policy if exists comp_write_admin on compliance_assignments;
create policy comp_write_admin on compliance_assignments for all
  using (
    (effective_has_permission(auth.uid(), 'manage_courses') and exists (select 1 from user_profiles up where up.id = compliance_assignments.user_id and up.organization_id = get_user_organization_id(auth.uid())))
    or is_super_admin(auth.uid())
  )
  with check (
    (effective_has_permission(auth.uid(), 'manage_courses') and exists (select 1 from user_profiles up where up.id = compliance_assignments.user_id and up.organization_id = get_user_organization_id(auth.uid())))
    or is_super_admin(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- set_learner_course_access_paused() - RPC-level fix, same root cause: any
-- org admin anywhere could pause/unpause any learner's access to any
-- course. Scoped to require the learner actually be in the caller's org.
-- ---------------------------------------------------------------------------
create or replace function set_learner_course_access_paused(p_learner_id uuid, p_course_id uuid, p_paused boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_course_instructor uuid;
  v_learner_org uuid;
begin
  select instructor_id into v_course_instructor from courses where id = p_course_id;
  select organization_id into v_learner_org from user_profiles where id = p_learner_id;
  if not (
    (v_course_instructor = auth.uid() and exists (select 1 from mentors m where m.user_id = auth.uid() and m.payouts_enabled = true))
    or (is_org_admin(auth.uid()) and v_learner_org is not null and v_learner_org = get_user_organization_id(auth.uid()))
    or is_super_admin(auth.uid())
  ) then
    raise exception 'Not authorized to change this learner''s access';
  end if;
  update course_enrollments set access_paused = p_paused where user_id = p_learner_id and course_id = p_course_id;
end;
$$;
