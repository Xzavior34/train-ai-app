-- ============================================================================
-- Organization Referral & Shareable Join Link (Automated Member Onboarding)
-- ============================================================================
-- Allows members to join an organization workspace directly via a shareable
-- join/referral link (?join=org_id or ?org=slug) without requiring admins
-- to manually enter every single email address.
--
-- Security Definer: Runs safely for authenticated users.
-- ============================================================================

create or replace function join_organization_by_invite(
  p_org_target text,
  p_role platform_role default 'learner'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org organizations;
  v_is_uuid boolean;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Must be signed in to join an organization');
  end if;

  if p_org_target is null or trim(p_org_target) = '' then
    return jsonb_build_object('success', false, 'error', 'Organization identifier is required');
  end if;

  -- Check if target is UUID or Slug
  v_is_uuid := p_org_target ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  if v_is_uuid then
    select * into v_org from organizations where id = p_org_target::uuid;
  else
    select * into v_org from organizations where slug = lower(trim(p_org_target));
  end if;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Organization not found');
  end if;

  -- Check seat availability if active/paid organization
  if not check_seat_available(v_org.id) then
    return jsonb_build_object('success', false, 'error', 'No seats available in this organization. Please contact your organization administrator.');
  end if;

  -- 1. Insert/Update organization_members
  insert into organization_members (organization_id, user_id, role, status, joined_at)
  values (v_org.id, v_user_id, 'member', 'active', now())
  on conflict (organization_id, user_id)
  do update set status = 'active', joined_at = coalesce(organization_members.joined_at, now());

  -- 2. Update user_profiles organization_id
  update user_profiles
  set organization_id = v_org.id
  where id = v_user_id;

  -- 3. Ensure role exists in user_roles
  insert into user_roles (user_id, role)
  values (v_user_id, p_role)
  on conflict (user_id, role) do nothing;

  return jsonb_build_object(
    'success', true,
    'organization_id', v_org.id,
    'organization_name', v_org.name,
    'slug', v_org.slug
  );
end;
$$;

grant execute on function join_organization_by_invite(text, platform_role) to authenticated;
grant execute on function join_organization_by_invite(text, platform_role) to anon;

comment on function join_organization_by_invite(text, platform_role) is
  'Enables frictionless organization onboarding via shareable referral/join links. Automatically links the signed-in user to the organization workspace.';
