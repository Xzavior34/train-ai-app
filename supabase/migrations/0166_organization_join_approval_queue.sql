-- ============================================================================
-- Organization Member Join Approval & Seat Protection Queue
-- ============================================================================
-- Allows organizations to review, accept, or reject learners before they
-- consume a paid organization seat.
-- ============================================================================

-- 1. Optional organization setting column for requiring join approvals
alter table public.organizations 
add column if not exists require_join_approval boolean default false;

-- 2. Approve Organization Member & Consume Seat
create or replace function approve_organization_member(
  p_org_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_seats_avail boolean;
begin
  -- Check seat availability
  v_seats_avail := check_seat_available(p_org_id);
  if not v_seats_avail then
    return jsonb_build_object('success', false, 'error', 'No seats available in this organization. Please purchase additional seats first.');
  end if;

  -- Update organization membership to active
  update organization_members
  set status = 'active',
      joined_at = coalesce(joined_at, now())
  where organization_id = p_org_id and user_id = p_user_id;

  if not found then
    -- Insert if missing
    insert into organization_members (organization_id, user_id, role, status, joined_at)
    values (p_org_id, p_user_id, 'member', 'active', now())
    on conflict (organization_id, user_id)
    do update set status = 'active', joined_at = coalesce(organization_members.joined_at, now());
  end if;

  -- Update user profile organization_id
  update user_profiles
  set organization_id = p_org_id
  where id = p_user_id;

  return jsonb_build_object('success', true, 'organization_id', p_org_id, 'user_id', p_user_id);
end;
$$;

-- 3. Reject / Remove Pending Join Request
create or replace function reject_organization_member(
  p_org_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Update status to rejected
  update organization_members
  set status = 'rejected'
  where organization_id = p_org_id and user_id = p_user_id;

  -- Reset user profile organization_id if it pointed to this org
  update user_profiles
  set organization_id = null
  where id = p_user_id and organization_id = p_org_id;

  return jsonb_build_object('success', true, 'organization_id', p_org_id, 'user_id', p_user_id);
end;
$$;

grant execute on function approve_organization_member(uuid, uuid) to authenticated;
grant execute on function reject_organization_member(uuid, uuid) to authenticated;
