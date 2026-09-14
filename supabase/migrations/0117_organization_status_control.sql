-- ============================================================================
-- Audited organization suspend/activate
-- ============================================================================
-- "Multi-Tenant Database Architecture Reference," Section 4: "User/account
-- control: Turn organizations or users on/off (suspend, activate,
-- deactivate)" - listed explicitly as a Platform Owner capability.
-- organizations.status already had a 'suspended' value in the org_status
-- enum since 0001_init_schema.sql, and org_update_admin
-- (0109_ai_coach_settings.sql) already lets a super_admin update any
-- organization's row - so the RLS-level capability already existed. What
-- didn't exist was any function or UI actually using it, and no audit
-- trail for something this consequential (suspending an org kicks every
-- one of its users out of the admin dashboard, per the trial-gate already
-- built in AdminDashboardScreen.jsx).
-- ============================================================================

create or replace function set_organization_status(p_org_id uuid, p_status org_status)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prev_hash text;
  v_row_hash text;
  v_org_name text;
begin
  if not is_super_admin(auth.uid()) then
    raise exception 'Only Platform Owner (super_admin) can change an organization''s status';
  end if;

  select name into v_org_name from organizations where id = p_org_id;
  if v_org_name is null then
    raise exception 'Organization not found';
  end if;

  update organizations set status = p_status where id = p_org_id;

  select row_hash into v_prev_hash from admin_audit_log order by created_at desc limit 1;
  v_row_hash := encode(
    digest(coalesce(v_prev_hash, '') || 'organization_status_change' || p_org_id::text || p_status::text || now()::text, 'sha256'),
    'hex'
  );
  insert into admin_audit_log (admin_user_id, action_type, target_type, target_id, target_identifier, metadata, prev_hash, row_hash)
  values (
    auth.uid(), 'organization_status_change', 'organization', p_org_id, v_org_name,
    jsonb_build_object('new_status', p_status), v_prev_hash, v_row_hash
  );

  return jsonb_build_object('success', true, 'organization_id', p_org_id, 'status', p_status);
end;
$$;

comment on function set_organization_status(uuid, org_status) is
  'Platform Owner suspend/activate/trial control over an organization, audited unconditionally.';
