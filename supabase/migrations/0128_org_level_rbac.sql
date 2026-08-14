-- ============================================================================
-- Organization-level role-based access control for Manager/Instructor/
-- Learner - a real, significant gap found while building this.
-- ============================================================================
-- "Allow organization administrators to control permissions for:
-- Managers, Instructors, Learners... toggle specific permissions/features
-- on or off." The existing per-org `role_permissions` table
-- (organization_id, role, resource, action, allowed) looked like the
-- right place at first - but its `role` column is typed `org_member_role`
-- ('owner', 'admin', 'content_manager', 'analytics_viewer',
-- 'people_manager', 'finance_admin', 'partnerships_admin', 'member') -
-- a completely different taxonomy from `platform_role` ('manager',
-- 'mentor', 'learner', etc.), which is what this task actually needs to
-- control. Force-fitting the wrong enum would have meant either silently
-- mismatching roles or requiring a much larger, riskier type migration on
-- a table that already has real dependents. Built a new, correctly-typed
-- table instead, scoped to exactly this purpose.
-- ============================================================================

create table if not exists org_role_permission_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  role platform_role not null,
  permission_key text not null,
  allowed boolean not null default false,
  updated_by uuid references user_profiles(id),
  updated_at timestamptz not null default now(),
  unique (organization_id, role, permission_key)
);

alter table org_role_permission_settings enable row level security;

drop policy if exists orps_select_own_org on org_role_permission_settings;
create policy orps_select_own_org on org_role_permission_settings for select
  using (organization_id = get_user_organization_id(auth.uid()) or is_super_admin(auth.uid()));

drop policy if exists orps_write_org_admin on org_role_permission_settings;
create policy orps_write_org_admin on org_role_permission_settings for all
  using (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()))
  with check (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()));

create or replace function effective_org_permission(check_user_id uuid, perm_key text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_primary_role platform_role;
  v_org_override boolean;
begin
  if exists (
    select 1 from user_permission_overrides
    where user_id = check_user_id and permission_key = perm_key and effect = 'revoke'
      and (expires_at is null or expires_at > now())
  ) then
    return false;
  end if;
  if exists (
    select 1 from user_permission_overrides
    where user_id = check_user_id and permission_key = perm_key and effect = 'grant'
      and (expires_at is null or expires_at > now())
  ) then
    return true;
  end if;

  select organization_id into v_org_id from user_profiles where id = check_user_id;
  v_primary_role := get_primary_role(check_user_id);

  if v_org_id is not null and v_primary_role is not null then
    select allowed into v_org_override
    from org_role_permission_settings
    where organization_id = v_org_id and role = v_primary_role and permission_key = perm_key;
    if v_org_override is not null then
      return v_org_override;
    end if;
  end if;

  return role_has_permission(check_user_id, perm_key);
end;
$$;

comment on function effective_org_permission(uuid, text) is
  'Org-level permission check for Manager/Instructor/Learner: individual override > org-specific toggle (org_role_permission_settings) > platform-wide role default. Separate from effective_has_permission() - opt-in per call site.';

comment on table org_role_permission_settings is
  'Per-organization permission toggles for Manager/Instructor/Learner roles - correctly typed with platform_role, not the unrelated org_member_role used by the older role_permissions table.';
