-- ============================================================================
-- No learner-to-learner communication of any kind - explicit clarification
-- ============================================================================
-- Confirmed directly, correcting an earlier, too-narrow reading: "learners
-- should [not] message learners at all, only instructors" - not just
-- private 1:1 DMs (already correctly restricted, mentor_messages,
-- 0108_messaging_restriction.sql), but *any* form of learner-to-learner
-- communication, including posting into a shared cohort or study-group
-- channel. Both of those previously let any learner in the group post
-- messages other learners in the same group would see - a real violation
-- of this rule, just a different shape than a private DM.
--
-- cohort_posts already had a real (too-permissive) policy
-- (cpost_insert_member, 0007_missing_schema.sql) - tightened here.
-- study_group_messages had NO policies at all, a separate, previously
-- undiscovered gap (found while fixing this) - the table has been
-- completely inaccessible by default (RLS enabled via the blanket loop,
-- zero actual policies) this whole time. Built correctly restricted from
-- the start, not "fixed" into unrestricted access and then re-restricted.
--
-- Learners can still read every message in their own cohort/study group
-- (so instructor announcements and updates are visible) - only posting is
-- restricted to instructors/admins now.
-- ============================================================================

drop policy if exists cpost_insert_member on cohort_posts;
drop policy if exists cpost_insert_instructor_only on cohort_posts;
create policy cpost_insert_instructor_only on cohort_posts for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from cohort_members cm
      where cm.cohort_id = cohort_posts.cohort_id and cm.user_id = auth.uid()
    )
    and (has_role(auth.uid(), 'mentor'::platform_role) or is_org_admin(auth.uid()) or is_super_admin(auth.uid()))
  );

alter table study_group_messages enable row level security;
drop policy if exists sgm_select_member on study_group_messages;
create policy sgm_select_member on study_group_messages for select
  using (
    exists (
      select 1 from study_group_members sgm
      where sgm.group_id = study_group_messages.study_group_id and sgm.user_id = auth.uid()
    )
    or is_org_admin(auth.uid())
    or is_super_admin(auth.uid())
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

-- Replies to a cohort post are visible to every other cohort member too -
-- a learner replying is exactly as much "learner-to-learner" as posting a
-- new update would be, just threaded. Restricted the same way.
drop policy if exists cpr_insert_member on cohort_post_replies;
drop policy if exists cpr_insert_instructor_only on cohort_post_replies;
create policy cpr_insert_instructor_only on cohort_post_replies for insert
  with check (
    author_id = auth.uid()
    and (has_role(auth.uid(), 'mentor'::platform_role) or is_org_admin(auth.uid()) or is_super_admin(auth.uid()))
  );

-- ============================================================================
-- A separate, real gap found while re-verifying this migration: Section
-- 8.1 requires an Instructor to "Manage cohorts... Upload sessions...
-- Manage learning resources" for their own cohort - but cohort_resources
-- and cohort_sessions were only ever writable by is_org_admin()
-- (owner/admin/super_admin), never a plain mentor. Confirmed with a real
-- test: a genuine instructor (mentor role, not also an org admin - the
-- normal case) was blocked from adding a resource or session to their own
-- cohort. cohort_members has no dedicated instructor flag (unlike
-- study_group_members, which does), so this scopes correctly by checking
-- the mentor is actually a member of that specific cohort, not just "any
-- mentor anywhere in the org."
-- ============================================================================

drop policy if exists cres_write_admin on cohort_resources;
create policy cres_write_admin_or_instructor on cohort_resources for all
  using (
    is_org_admin(auth.uid())
    or (has_role(auth.uid(), 'mentor'::platform_role) and exists (
      select 1 from cohort_members cm where cm.cohort_id = cohort_resources.cohort_id and cm.user_id = auth.uid()
    ))
  )
  with check (
    is_org_admin(auth.uid())
    or (has_role(auth.uid(), 'mentor'::platform_role) and exists (
      select 1 from cohort_members cm where cm.cohort_id = cohort_resources.cohort_id and cm.user_id = auth.uid()
    ))
  );

drop policy if exists csess_write_admin on cohort_sessions;
create policy csess_write_admin_or_instructor on cohort_sessions for all
  using (
    is_org_admin(auth.uid())
    or (has_role(auth.uid(), 'mentor'::platform_role) and exists (
      select 1 from cohort_members cm where cm.cohort_id = cohort_sessions.cohort_id and cm.user_id = auth.uid()
    ))
  )
  with check (
    is_org_admin(auth.uid())
    or (has_role(auth.uid(), 'mentor'::platform_role) and exists (
      select 1 from cohort_members cm where cm.cohort_id = cohort_sessions.cohort_id and cm.user_id = auth.uid()
    ))
  );
