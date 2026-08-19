-- ============================================================================
-- Fixes a real, previously undiscovered cross-tenant data leak in
-- admin_audit_log - found while checking whether a per-org Activity Log
-- screen could safely be built for regular admins (not just the platform
-- owner).
-- ============================================================================
-- The existing policy `aal_select_org_admin` (0006_rls_policies.sql) only
-- checked `is_org_admin(auth.uid())` - whether the caller is an admin of
-- *some* organization, not *which* one. admin_audit_log had no
-- organization_id column at all, so there was no way to scope this
-- correctly even if the policy had tried to. The practical effect: any
-- org admin could read every other organization's admin action history -
-- who did what, when, across the entire platform, not just their own
-- org. This was found and fixed before any new UI was built on top of it,
-- not after - building an Activity Log screen on top of the leak would
-- have made the exposure worse by giving it a visible surface.
-- ============================================================================

alter table admin_audit_log add column if not exists organization_id uuid references organizations(id);
comment on column admin_audit_log.organization_id is 'The acting admin''s own organization at the time of the action - real scoping column that did not previously exist, see migration header.';

-- log_admin_action() now populates it from the acting admin's real
-- current org. NULL for platform-level actions with no org context
-- (e.g. granting another super admin) - those rows remain visible only
-- to super_admin, which is correct; they were never meant to be
-- org-scoped in the first place.
create or replace function log_admin_action(
  p_action_type text, p_target_type text, p_target_id uuid, p_target_identifier text,
  p_old_value jsonb, p_new_value jsonb, p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_prev_hash text;
  v_row_hash text;
  v_id uuid;
  v_org_id uuid;
begin
  select organization_id into v_org_id from user_profiles where id = auth.uid();
  select row_hash into v_prev_hash from admin_audit_log order by created_at desc limit 1;
  v_row_hash := encode(
    digest(
      coalesce(v_prev_hash, '') || p_action_type || coalesce(p_target_id::text, '') || now()::text,
      'sha256'
    ),
    'hex'
  );
  insert into admin_audit_log (admin_user_id, organization_id, action_type, target_type, target_id, target_identifier, old_value, new_value, metadata, prev_hash, row_hash)
  values (auth.uid(), v_org_id, p_action_type, p_target_type, p_target_id, p_target_identifier, p_old_value, p_new_value, p_metadata, v_prev_hash, v_row_hash)
  returning id into v_id;
  return v_id;
end;
$$;

-- The actual fix - real per-org scoping instead of a blanket "is an admin
-- of something" check.
drop policy if exists aal_select_org_admin on admin_audit_log;
create policy aal_select_org_admin on admin_audit_log for select
  using (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()));

-- safe_admin_audit_log is a plain view (Postgres views enforce the
-- underlying table's RLS for the querying role) - using CREATE OR
-- REPLACE rather than DROP + CREATE specifically so any existing grants
-- on this view are preserved automatically (a fresh CREATE VIEW after a
-- DROP would be a new object with no grants until re-granted, which
-- could silently break every existing caller of this view). Postgres
-- requires appending new columns at the end of the list for REPLACE to
-- work, so organization_id is added last, not in its "natural" position
-- next to admin_user_id.
create or replace view safe_admin_audit_log as
  select id, admin_user_id, action_type, target_type, target_id, target_identifier, created_at, organization_id
  from admin_audit_log;

-- No explicit grant on this view exists anywhere else in this project's
-- migrations (views appear to rely on a broader schema-level default),
-- but re-granting here is a harmless no-op if that's already covered,
-- and a real safety net if CREATE OR REPLACE VIEW ever behaves like a
-- fresh object in some environment - cheap insurance either way.
grant select on safe_admin_audit_log to authenticated;
