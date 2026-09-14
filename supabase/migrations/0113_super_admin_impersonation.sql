-- ============================================================================
-- Platform Owner impersonation ("view as"), and a real audit log gap found
-- while building it
-- ============================================================================
-- Product brief: "Platform owners can impersonate or log into organizations
-- when troubleshooting (super-admin/backdoor access)" - and, per an
-- explicit confirmation earlier in this project, impersonation should be
-- able to see everything, including AI Coach conversations.
--
-- Built as an audited, on-demand "view as" rather than real session
-- forgery: a SECURITY DEFINER function that only a genuine super_admin can
-- call, that logs the access every time, and that returns a read-only
-- snapshot of the target user's data (profile, enrollments/progress, and
-- yes, their real AI Coach conversation history). This is deliberately not
-- "generate a real login session as this user" - that would mean Platform
-- Owner could also take actions (send messages, submit assessments, change
-- settings) *as* the impersonated user with no distinguishable trail
-- separating what the user did from what Platform Owner did while wearing
-- their identity, which is a meaningfully bigger and riskier feature than
-- "see their data." If real session-level impersonation is what's wanted
-- instead of this, that is a further, distinct piece of work - flagging
-- rather than quietly picking one interpretation and calling it done.
--
-- Found while building this: admin_audit_log's own INSERT policy
-- (0006_rls_policies.sql: aal_insert_via_function) was `with check (true)`
-- - genuinely open to any authenticated user, not just admins, and
-- log_admin_action() itself never checked the caller's role either. Between
-- the two, any signed-in user could have written arbitrary fake entries
-- into what is supposed to be a trustworthy admin action record. Tightened
-- below before relying on this table for something as sensitive as
-- impersonation logging.
-- ============================================================================

drop policy if exists aal_insert_via_function on admin_audit_log;
create policy aal_insert_admin_only on admin_audit_log for insert
  with check (is_org_admin(auth.uid()) or is_super_admin(auth.uid()));

create or replace function super_admin_view_user(p_target_user_id uuid, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
  v_prev_hash text;
  v_row_hash text;
begin
  if not is_super_admin(auth.uid()) then
    raise exception 'Only Platform Owner (super_admin) can use this';
  end if;
  if p_target_user_id is null then
    raise exception 'A target user is required';
  end if;

  -- Audited every time, unconditionally - this is the enforcement point,
  -- not a formality. No path to the data below exists without this row
  -- being written first, in the same statement.
  select row_hash into v_prev_hash from admin_audit_log order by created_at desc limit 1;
  v_row_hash := encode(
    digest(coalesce(v_prev_hash, '') || 'impersonation_view' || p_target_user_id::text || now()::text, 'sha256'),
    'hex'
  );
  insert into admin_audit_log (admin_user_id, action_type, target_type, target_id, target_identifier, metadata, prev_hash, row_hash)
  values (
    auth.uid(), 'impersonation_view', 'user_profile', p_target_user_id,
    (select display_name from user_profiles where id = p_target_user_id),
    jsonb_build_object('reason', p_reason),
    v_prev_hash, v_row_hash
  );

  select jsonb_build_object(
    'profile', (
      select jsonb_build_object(
        'id', up.id, 'display_name', up.display_name, 'role', up.role,
        'organization_id', up.organization_id, 'department', up.department,
        'created_at', up.created_at, 'last_active_at', up.last_active_at
      )
      from user_profiles up where up.id = p_target_user_id
    ),
    'enrollments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'course_id', ce.course_id, 'progress_percentage', ce.progress_percentage, 'completed_at', ce.completed_at
      )), '[]'::jsonb)
      from course_enrollments ce where ce.user_id = p_target_user_id
    ),
    -- The explicit ask: impersonation includes AI Coach conversation
    -- content. Every learner-facing screen and every other admin role in
    -- this app is deliberately blocked from this (Module 4.5's "deliberate
    -- trust decision", aim_select_own's owner-only RLS) - this function is
    -- the one, audited exception, and it exists only because this was
    -- explicitly confirmed rather than assumed.
    'ai_conversations', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'conversation_id', c.id,
        'created_at', c.created_at,
        'messages', (
          select coalesce(jsonb_agg(jsonb_build_object('role', m.role, 'content', m.content, 'created_at', m.created_at) order by m.created_at), '[]'::jsonb)
          from ai_messages m where m.conversation_id = c.id
        )
      )), '[]'::jsonb)
      from ai_conversations c where c.user_id = p_target_user_id
    )
  ) into v_result;

  return v_result;
end;
$$;

comment on function super_admin_view_user(uuid, text) is
  'Audited Platform Owner "view as" - read-only snapshot of a user''s profile, enrollments, and AI Coach conversations. Every call is logged to admin_audit_log before any data is returned, unconditionally. Not real session impersonation (see migration header comment).';
