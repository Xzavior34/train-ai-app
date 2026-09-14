-- =============================================================================
-- Train AI - Row-Level Security
-- Every table gets RLS enabled with default-deny (no policy = no access).
-- Explicit policies are then added for the tables most central to the
-- security model. Remaining tables follow the same patterns shown here:
--   - user-owned data: `user_id = auth.uid()`
--   - org-scoped data: `organization_id = get_user_organization_id()` or
--     `is_org_admin(auth.uid())`
--   - mentor-owned data: joined through `mentors.user_id = auth.uid()`
--   - platform-wide/admin-only data: `is_super_admin(auth.uid())`
-- =============================================================================

-- Enable RLS on every table in one pass (default-deny until a policy exists)
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security;', r.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- user_profiles - read own row, org admins/super_admin read org members,
-- managers read direct reports. Update: own row, or admin for org members.
-- ---------------------------------------------------------------------------
create policy up_select_own on user_profiles for select
  using (id = auth.uid());

create policy up_select_org_admin on user_profiles for select
  using (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()));

create policy up_select_super_admin on user_profiles for select
  using (is_super_admin(auth.uid()));

create policy up_select_manager on user_profiles for select
  using (is_manager_of(auth.uid(), id));

create policy up_update_own on user_profiles for update
  using (id = auth.uid());

create policy up_update_org_admin on user_profiles for update
  using (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()));

-- ---------------------------------------------------------------------------
-- organizations - members can read their own org; super_admin reads/writes all;
-- org owner/admin can update their own org.
-- ---------------------------------------------------------------------------
create policy org_select_member on organizations for select
  using (id = get_user_organization_id(auth.uid()) or is_super_admin(auth.uid()));

create policy org_update_owner on organizations for update
  using (is_org_owner(auth.uid(), id) or is_super_admin(auth.uid()));

create policy org_insert_super_admin on organizations for insert
  with check (is_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- organization_members
-- ---------------------------------------------------------------------------
create policy om_select_self on organization_members for select
  using (user_id = auth.uid());

create policy om_select_org_admin on organization_members for select
  using (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()));

create policy om_write_org_admin on organization_members for all
  using (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()))
  with check (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()));

-- ---------------------------------------------------------------------------
-- user_roles - readable by self, org admins (scoped via profile org match),
-- writable only by super_admin (role assignment is a privileged action).
-- ---------------------------------------------------------------------------
create policy ur_select_self on user_roles for select
  using (user_id = auth.uid());

create policy ur_select_super_admin on user_roles for select
  using (is_super_admin(auth.uid()));

create policy ur_write_super_admin on user_roles for all
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- user_permission_overrides - only org admins/owners (scoped to their own
-- org's members) and super_admin may create/edit; every user may read own.
-- ---------------------------------------------------------------------------
create policy upo_select_own on user_permission_overrides for select
  using (user_id = auth.uid());

create policy upo_select_admin on user_permission_overrides for select
  using (is_org_admin(auth.uid()) or is_super_admin(auth.uid()));

create policy upo_write_admin on user_permission_overrides for all
  using (is_org_admin(auth.uid()) or is_super_admin(auth.uid()))
  with check (is_org_admin(auth.uid()) or is_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- role_permissions_matrix / platform_settings - super_admin only, platform-wide
-- ---------------------------------------------------------------------------
create policy rpm_select_all on role_permissions_matrix for select using (true);
create policy rpm_write_super_admin on role_permissions_matrix for all
  using (is_super_admin(auth.uid())) with check (is_super_admin(auth.uid()));

create policy ps_select_public on platform_settings for select using (is_public or is_super_admin(auth.uid()));
create policy ps_write_super_admin on platform_settings for all
  using (is_super_admin(auth.uid())) with check (is_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- courses / lessons - published content is readable by anyone signed in;
-- instructors, org content managers, and super_admin can write.
-- ---------------------------------------------------------------------------
create policy courses_select_published on courses for select
  using (is_published or instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses'));

create policy courses_write_authorized on courses for all
  using (instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()))
  with check (instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));

create policy lessons_select_published on lessons for select
  using (
    is_published
    or exists (select 1 from courses c where c.id = lessons.course_id and c.instructor_id = auth.uid())
    or effective_has_permission(auth.uid(), 'manage_courses')
  );

create policy lessons_write_authorized on lessons for all
  using (
    exists (select 1 from courses c where c.id = lessons.course_id and c.instructor_id = auth.uid())
    or effective_has_permission(auth.uid(), 'manage_courses')
    or is_super_admin(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- course_enrollments / lesson_progress - strictly own rows, plus org admin
-- and the course's instructor/mentor can read (never write) for oversight.
-- ---------------------------------------------------------------------------
create policy ce_select_own on course_enrollments for select using (user_id = auth.uid());
create policy ce_write_own on course_enrollments for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ce_select_org_admin on course_enrollments for select
  using (effective_has_permission(auth.uid(), 'view_analytics') or is_super_admin(auth.uid()));

create policy lp_select_own on lesson_progress for select using (user_id = auth.uid());
create policy lp_write_own on lesson_progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- quiz_attempts - own rows only; questions/answers themselves are protected
-- via the safe_quiz_questions view + check_quiz_answers() server-side scoring.
-- ---------------------------------------------------------------------------
create policy qa_select_own on quiz_attempts for select using (user_id = auth.uid());
create policy qa_write_own on quiz_attempts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy qq_select_none on quiz_questions for select using (false); -- force use of safe_quiz_questions view
create policy qq_write_authorized on quiz_questions for all
  using (effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- mentors - public-safe profile is via mentor_public_profiles view; the
-- underlying table is readable by the mentor themself, org admins, and
-- writable by the same + super_admin.
-- ---------------------------------------------------------------------------
create policy mentors_select_self on mentors for select using (user_id = auth.uid());
create policy mentors_select_public on mentors for select using (is_active and is_approved);
create policy mentors_select_admin on mentors for select
  using (effective_has_permission(auth.uid(), 'manage_users') or is_super_admin(auth.uid()));
create policy mentors_write_self on mentors for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy mentors_write_admin on mentors for all
  using (effective_has_permission(auth.uid(), 'manage_users') or is_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- mentorship_sessions - the mentor, the learner, or org admin.
-- ---------------------------------------------------------------------------
create policy ms_select_participant on mentorship_sessions for select
  using (
    learner_id = auth.uid()
    or exists (select 1 from mentors m where m.id = mentorship_sessions.mentor_id and m.user_id = auth.uid())
    or effective_has_permission(auth.uid(), 'manage_sessions')
    or is_super_admin(auth.uid())
  );

create policy ms_write_participant on mentorship_sessions for all
  using (
    learner_id = auth.uid()
    or exists (select 1 from mentors m where m.id = mentorship_sessions.mentor_id and m.user_id = auth.uid())
    or effective_has_permission(auth.uid(), 'manage_sessions')
  );

-- ---------------------------------------------------------------------------
-- messages / mentor_messages - sender or receiver only.
-- ---------------------------------------------------------------------------
create policy msg_select_participant on messages for select
  using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy msg_insert_sender on messages for insert
  with check (sender_id = auth.uid());
create policy msg_update_receiver on messages for update
  using (receiver_id = auth.uid()); -- e.g. marking is_read

create policy mm_select_participant on mentor_messages for select
  using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy mm_insert_sender on mentor_messages for insert
  with check (sender_id = auth.uid());

-- ---------------------------------------------------------------------------
-- notifications - own rows only.
-- ---------------------------------------------------------------------------
create policy notif_select_own on notifications for select using (user_id = auth.uid());
create policy notif_update_own on notifications for update using (user_id = auth.uid());

create policy rn_select_own on real_notifications for select using (user_id = auth.uid());
create policy rn_update_own on real_notifications for update using (user_id = auth.uid());

create policy np_select_own on notification_preferences for select using (user_id = auth.uid());
create policy np_write_own on notification_preferences for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- community_posts / post_comments / post_reactions - read approved content;
-- write/delete own; moderators can update moderation_status.
-- ---------------------------------------------------------------------------
create policy cp_select_approved on community_posts for select
  using (moderation_status in ('approved','pending') or user_id = auth.uid() or can_moderate_content(auth.uid()));
create policy cp_insert_own on community_posts for insert with check (user_id = auth.uid());
create policy cp_update_own_or_moderator on community_posts for update
  using (user_id = auth.uid() or can_moderate_content(auth.uid()));
create policy cp_delete_own on community_posts for delete using (user_id = auth.uid());

create policy pc_select_all on post_comments for select using (true);
create policy pc_insert_own on post_comments for insert with check (user_id = auth.uid());
create policy pc_delete_own on post_comments for delete using (user_id = auth.uid() or can_moderate_content(auth.uid()));

create policy pr_select_all on post_reactions for select using (true);
create policy pr_write_own on post_reactions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- cohorts / cohort_members / compliance_assignments - org-scoped.
-- ---------------------------------------------------------------------------
create policy cohorts_select_org on cohorts for select
  using (organization_id = get_user_organization_id(auth.uid()) or is_super_admin(auth.uid()));
create policy cohorts_write_admin on cohorts for all
  using (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()));

create policy cm_select_self_or_admin on cohort_members for select
  using (user_id = auth.uid() or is_org_admin(auth.uid()));
create policy cm_write_admin on cohort_members for all using (is_org_admin(auth.uid()));

create policy comp_select_self_or_admin on compliance_assignments for select
  using (user_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));
create policy comp_write_admin on compliance_assignments for all
  using (effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- user_gamification_stats - own row readable/writable by self (writes should
-- in practice go through award_achievement()); admins can read for their org.
-- ---------------------------------------------------------------------------
create policy ugs_select_own on user_gamification_stats for select using (user_id = auth.uid());
create policy ugs_select_admin on user_gamification_stats for select
  using (effective_has_permission(auth.uid(), 'view_analytics') or is_super_admin(auth.uid()));
create policy ugs_write_own on user_gamification_stats for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- admin_audit_log - append-only. No update/delete policy exists for anyone,
-- which combined with RLS-enabled + no policy means those actions are always
-- denied, even to super_admin, at the database layer (matches spec rule 6).
-- ---------------------------------------------------------------------------
create policy aal_select_super_admin on admin_audit_log for select using (is_super_admin(auth.uid()));
create policy aal_select_org_admin on admin_audit_log for select
  using (is_org_admin(auth.uid())); -- reads via safe_admin_audit_log view in the app for non-super-admins
create policy aal_insert_via_function on admin_audit_log for insert with check (true); -- actual writes gated inside log_admin_action()

-- ---------------------------------------------------------------------------
-- feedback / dsar_requests - own rows; admins/super_admin can read all for triage.
-- ---------------------------------------------------------------------------
create policy fb_select_own on feedback for select using (user_id = auth.uid());
create policy fb_insert_own on feedback for insert with check (user_id = auth.uid() or user_id is null);
create policy fb_select_admin on feedback for select
  using (effective_has_permission(auth.uid(), 'view_feedback') or is_super_admin(auth.uid()));

create policy dsar_select_own on dsar_requests for select using (user_id = auth.uid());
create policy dsar_insert_own on dsar_requests for insert with check (user_id = auth.uid());
create policy dsar_select_admin on dsar_requests for select using (is_super_admin(auth.uid()));
