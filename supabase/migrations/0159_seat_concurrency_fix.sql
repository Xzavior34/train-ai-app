-- ============================================================================
-- Seat licensing: real, proven race condition in accept_invitation()
-- ============================================================================
-- Confirmed by genuine concurrent testing (two real, independent OS
-- processes, not sequential calls), not reasoned about: an organization
-- with exactly 1 seat available, hit with two simultaneous
-- accept_invitation() calls for two different pending invitations, ended
-- with BOTH succeeding - used: 3 against purchased: 2, oversold by one
-- seat. Root cause: check_seat_available() is a plain read (it COUNTs
-- active organization_members rows - there is no single mutable "seats
-- used" balance row the way ai_credit_accounts.balance is, so the
-- FOR UPDATE row-locking pattern that makes AI credit consumption
-- provably safe under concurrency has no direct equivalent here). Two
-- concurrent transactions can both read "1 available" before either has
-- committed its INSERT into organization_members, and both proceed.
--
-- Fix: acquire a row lock on the organization's own `organizations` row
-- (`for update`) before checking seat availability inside
-- accept_invitation(). This doesn't change what's being counted - it
-- serializes concurrent accept_invitation calls FOR THE SAME ORGANIZATION
-- specifically: the second transaction's `for update` blocks until the
-- first commits (or rolls back), then re-reads a seat count that
-- correctly reflects the first transaction's already-committed INSERT.
-- Concurrent accepts for DIFFERENT organizations are unaffected - they
-- lock different rows. Reuses an existing row rather than introducing a
-- new advisory-lock mechanism, consistent with this schema's established
-- preference for row-level locking (0156's consume_ai_credits) over
-- advisory locks.
-- ============================================================================

create or replace function accept_invitation(p_token text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_inv user_invitations;
  v_org_locked uuid;
begin
  select * into v_inv from user_invitations where token = p_token and status = 'pending' and expires_at > now();
  if not found then
    raise exception 'invitation is invalid or expired';
  end if;

  if v_inv.organization_id is not null then
    -- The actual fix: lock this organization's row before checking or
    -- consuming a seat, so a concurrent accept_invitation() for the same
    -- org genuinely waits instead of racing on a stale read.
    select id into v_org_locked from organizations where id = v_inv.organization_id for update;
    if not check_seat_available(v_inv.organization_id) then
      raise exception 'No seats available in this organization - contact your organization admin to purchase more seats';
    end if;
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
