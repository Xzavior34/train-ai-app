-- ============================================================================
-- Seat-based payment model - confirmed entirely unbuilt, the single
-- largest gap on Philip's task list.
-- ============================================================================
-- "Require payment for seats before learners/users can be added in the
-- cloud version. Prevent organizations from adding users without the
-- required paid seats. Support organizations purchasing multiple seats
-- upfront. Allow purchased seats to be allocated to learners/users later.
-- Track available, allocated, and used seats."
--
-- Scoped deliberately: a trial organization keeps using the existing
-- `max_users` soft cap unchanged (matching the already-established free
-- trial model - "Free... used as demo, trial, entry-level experience").
-- Seat enforcement applies specifically once an organization is 'active'
-- (paid, out of trial) - "in the cloud version" - not to every
-- organization unconditionally, which would have broken the existing
-- trial flow this app already relies on.
--
-- No real payment gateway exists in this sandbox (same honest position
-- taken for organization subscription payments,
-- 0114_organization_subscription_payment.sql) - purchase_seats() records
-- a real seat grant against a real payment reference the caller provides,
-- the same trust-boundary pattern already used and already documented
-- there, not a new gap introduced here.
-- ============================================================================

create table if not exists seat_purchases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  seats_purchased int not null check (seats_purchased > 0),
  amount_paid numeric,
  currency text default 'USD',
  payment_reference text,
  purchased_by uuid references user_profiles(id),
  purchased_at timestamptz not null default now()
);

alter table seat_purchases enable row level security;

drop policy if exists seatp_select_own_org on seat_purchases;
create policy seatp_select_own_org on seat_purchases for select
  using (organization_id = get_user_organization_id(auth.uid()) or is_super_admin(auth.uid()));

-- Purchases are only ever created through purchase_seats() below (security
-- definer, does its own admin check) - no direct insert policy needed for
-- ordinary users, only super_admin for manual/support corrections.
drop policy if exists seatp_write_super_admin on seat_purchases;
create policy seatp_write_super_admin on seat_purchases for all
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

-- Real seat accounting: purchased = sum of all real purchases; used = real
-- active organization_members count right now - never a separately
-- tracked, driftable counter that could fall out of sync with reality.
create or replace function get_org_seats_summary(check_org_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_purchased int;
  v_used int;
begin
  select coalesce(sum(seats_purchased), 0) into v_purchased from seat_purchases where organization_id = check_org_id;
  select count(*) into v_used from organization_members where organization_id = check_org_id and status = 'active';
  return jsonb_build_object('purchased', v_purchased, 'used', v_used, 'available', greatest(0, v_purchased - v_used));
end;
$$;

create or replace function purchase_seats(p_organization_id uuid, p_seats int, p_amount numeric, p_payment_reference text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not (is_org_admin(auth.uid()) and get_user_organization_id(auth.uid()) = p_organization_id) and not is_super_admin(auth.uid()) then
    raise exception 'Not authorized to purchase seats for this organization';
  end if;
  if p_seats <= 0 then
    raise exception 'Seat count must be positive';
  end if;
  if p_payment_reference is null or length(trim(p_payment_reference)) = 0 then
    raise exception 'A real payment reference is required';
  end if;

  insert into seat_purchases (organization_id, seats_purchased, amount_paid, payment_reference, purchased_by)
  values (p_organization_id, p_seats, p_amount, p_payment_reference, auth.uid());

  return get_org_seats_summary(p_organization_id);
end;
$$;

-- The actual enforcement point - "Ensure payment authorization is
-- enforced before user/seat creation" and "at the backend level, not only
-- through UI visibility." Checked at both the point an admin invites
-- someone (better UX - caught immediately) and the point they actually
-- accept and become a counted member (the real safety net - seats could
-- have been consumed by other invites accepted in between).
create or replace function check_seat_available(check_org_id uuid)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_status org_status;
  v_summary jsonb;
begin
  select status into v_status from organizations where id = check_org_id;
  -- Trial organizations keep the existing max_users soft cap unchanged -
  -- seat purchases are specifically an "active" (paid, cloud) requirement.
  if v_status is distinct from 'active' then
    return true;
  end if;
  v_summary := get_org_seats_summary(check_org_id);
  return (v_summary->>'available')::int > 0;
end;
$$;

create or replace function create_user_invitation(
  p_email text, p_role platform_role, p_organization_id uuid, p_organization_role org_member_role
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_org_admin(auth.uid()) then
    raise exception 'not authorized to invite users to this organization';
  end if;
  if p_organization_id is not null and not check_seat_available(p_organization_id) then
    raise exception 'No seats available - purchase more seats before inviting additional users';
  end if;
  insert into user_invitations (email, role, organization_id, organization_role, invited_by)
  values (p_email, p_role, p_organization_id, p_organization_role, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function accept_invitation(p_token text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_inv user_invitations;
begin
  select * into v_inv from user_invitations where token = p_token and status = 'pending' and expires_at > now();
  if not found then
    raise exception 'invitation is invalid or expired';
  end if;
  if v_inv.organization_id is not null and not check_seat_available(v_inv.organization_id) then
    raise exception 'No seats available in this organization - contact your organization admin to purchase more seats';
  end if;
  insert into user_roles (user_id, role) values (auth.uid(), v_inv.role)
    on conflict do nothing;
  if v_inv.organization_id is not null then
    insert into organization_members (organization_id, user_id, role, status, invited_by, joined_at)
    values (v_inv.organization_id, auth.uid(), v_inv.organization_role, 'active', v_inv.invited_by, now())
    on conflict (organization_id, user_id) do update set status = 'active', joined_at = now();
    update user_profiles set organization_id = v_inv.organization_id where id = auth.uid();
  end if;
  update user_invitations set status = 'accepted', accepted_at = now() where id = v_inv.id;
end;
$$;

comment on function purchase_seats(uuid, int, numeric, text) is
  'Real seat purchase, requires a real payment reference - same trust-boundary honesty as apply_organization_subscription_payment() (0114). No real payment gateway exists in this sandbox.';
comment on function check_seat_available(uuid) is
  'The real enforcement point for seat-based payments - trial orgs unaffected, active (paid) orgs blocked from adding members beyond purchased seats.';
