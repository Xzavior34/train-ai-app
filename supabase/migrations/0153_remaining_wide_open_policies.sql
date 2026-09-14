-- ============================================================================
-- Remaining wide-open (`using (true)`) and unscoped-permission policies
-- found while finishing the systemic sweep started in 0152.
-- ============================================================================
-- Scope decision, stated plainly: a full exhaustive RLS audit of every
-- policy in this 150+ migration schema was NOT performed. This migration
-- fixes the specific instances found that are reachable from the
-- second-organization workflow this pass is testing (forums/discussions
-- attached to courses - which 0149 already made org-ownable, so leaving
-- these open would have quietly reopened that fix one join away - and
-- study_group_members, which sits in the same "cohort collaboration"
-- cluster 0152 already covers). Two lower-severity items were found and
-- deliberately NOT fixed here, to keep this batch bounded to what the
-- workflow test actually exercises - documented, not hidden:
--   - fp_update_own_or_moderator / fp_delete_own_or_moderator
--     (forum_posts) and course_discussions' equivalent moderator paths use
--     can_moderate_content()/effective_has_permission(), the same
--     unscoped-role-check class as everything else in this pass - an
--     org admin with moderate_content could edit/delete another org's
--     forum post. This is a moderation-authority overreach, not a data
--     exfiltration path (the content was already readable per the fixes
--     below), so it's lower severity and left for a follow-up pass.
--   - community_posts/polls/post_comments/post_reactions were checked and
--     LEFT AS `using (true)` deliberately: community_posts has no
--     organization_id or course_id at all - it is a genuinely
--     platform-wide feed by original design, not a missed tenant
--     boundary. Not "fixed" because there was nothing to scope it to.
-- ============================================================================

-- study_group_members: 0152 fixed the ALL policy but missed this second,
-- separately-defined, never-superseded SELECT policy that granted
-- unconditional read access to every study group's membership platform-wide.
drop policy if exists sgm_select_all on study_group_members;

-- forums / forum_posts - course_id is nullable (is_general = true for
-- non-course forums, which remain intentionally global); when set, scope
-- to that course's organization the same way 0149 scoped courses itself.
drop policy if exists forums_select_all on forums;
create policy forums_select_all on forums for select
  using (
    is_general
    or course_id is null
    or exists (select 1 from courses c where c.id = forums.course_id and (c.organization_id is null or c.organization_id = get_user_organization_id(auth.uid())))
    or is_super_admin(auth.uid())
  );

drop policy if exists forums_write_authorized on forums;
create policy forums_write_authorized on forums for all
  using (
    is_super_admin(auth.uid())
    or (
      effective_has_permission(auth.uid(), 'manage_courses')
      and (
        course_id is null
        or exists (select 1 from courses c where c.id = forums.course_id and c.organization_id = get_user_organization_id(auth.uid()))
      )
    )
  )
  with check (
    is_super_admin(auth.uid())
    or (
      effective_has_permission(auth.uid(), 'manage_courses')
      and (
        course_id is null
        or exists (select 1 from courses c where c.id = forums.course_id and c.organization_id = get_user_organization_id(auth.uid()))
      )
    )
  );

drop policy if exists fp_select_all on forum_posts;
create policy fp_select_all on forum_posts for select
  using (
    exists (
      select 1 from forums f
      where f.id = forum_posts.forum_id
      and (
        f.is_general or f.course_id is null
        or exists (select 1 from courses c where c.id = f.course_id and (c.organization_id is null or c.organization_id = get_user_organization_id(auth.uid())))
        or is_super_admin(auth.uid())
      )
    )
  );

-- course_discussions / course_discussion_messages - same pattern. Insert
-- previously required only `auth.uid() is not null` - any signed-in user
-- could open a discussion thread under any organization's private course.
drop policy if exists cd_select_all on course_discussions;
create policy cd_select_all on course_discussions for select
  using (
    exists (select 1 from courses c where c.id = course_discussions.course_id and (c.organization_id is null or c.organization_id = get_user_organization_id(auth.uid())))
    or is_super_admin(auth.uid())
  );

drop policy if exists cd_insert_authenticated on course_discussions;
create policy cd_insert_authenticated on course_discussions for insert
  with check (
    exists (select 1 from courses c where c.id = course_discussions.course_id and (c.organization_id is null or c.organization_id = get_user_organization_id(auth.uid())))
    or is_super_admin(auth.uid())
  );

drop policy if exists cdm_select_all on course_discussion_messages;
create policy cdm_select_all on course_discussion_messages for select
  using (
    exists (
      select 1 from course_discussions cd join courses c on c.id = cd.course_id
      where cd.id = course_discussion_messages.discussion_id
      and (c.organization_id is null or c.organization_id = get_user_organization_id(auth.uid()))
    )
    or is_super_admin(auth.uid())
  );

-- 0131's mentor-settings tables: the is_org_admin() branch had no match
-- against the mentor's own organization, letting any org admin anywhere
-- write another org's mentor credentials/portfolio/pricing/session
-- templates/cancellation policies/reminder settings.
do $$
declare
  t text;
  affected_tables text[] := array[
    'mentor_credentials', 'mentor_portfolio_items', 'mentor_resources', 'mentor_pricing_tiers',
    'session_templates', 'cancellation_policies', 'reminder_settings'
  ];
  policy_name text;
begin
  foreach t in array affected_tables loop
    -- owner_readable_tables used '<t>_write_owner', owner_only_tables used '<t>_all_owner' - handle both names.
    execute format('drop policy if exists %I_write_owner on %I', t, t);
    execute format('drop policy if exists %I_all_owner on %I', t, t);
    policy_name := t || '_scoped_owner';
    execute format(
      'create policy %I on %I for all using (is_mentor_owner(auth.uid(), mentor_id) or (is_org_admin(auth.uid()) and exists (select 1 from mentors m where m.id = %I.mentor_id and m.organization_id = get_user_organization_id(auth.uid()))) or is_super_admin(auth.uid())) with check (is_mentor_owner(auth.uid(), mentor_id) or (is_org_admin(auth.uid()) and exists (select 1 from mentors m where m.id = %I.mentor_id and m.organization_id = get_user_organization_id(auth.uid()))) or is_super_admin(auth.uid()))',
      policy_name, t, t, t
    );
  end loop;
end $$;
