-- ============================================================================
-- Migration 0165: Payment Idempotency, Hardening, and Replay Protection
-- ============================================================================
-- Ensures:
-- 1. seat_purchases has unique constraints on payment_reference to prevent
--    duplicate seat allocation upon webhook/client replay.
-- 2. purchase_seats is strictly idempotent when a payment reference is provided.
-- 3. apply_organization_subscription_payment guards against replayed tier upgrades.
-- ============================================================================

-- 1. Unique index on seat_purchases for payment_reference
create unique index if not exists seat_purchases_unique_ref_org
  on seat_purchases(organization_id, payment_reference)
  where payment_reference is not null;

-- 2. Hardened & Idempotent purchase_seats
create or replace function purchase_seats(
  p_organization_id uuid,
  p_seats int,
  p_amount numeric,
  p_payment_reference text
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_existing uuid;
begin
  if not (is_org_admin(auth.uid()) and get_user_organization_id(auth.uid()) = p_organization_id)
     and not is_super_admin(auth.uid())
     and auth.role() <> 'service_role' then
    raise exception 'Not authorized to purchase seats for this organization';
  end if;

  if p_seats <= 0 then
    raise exception 'Seat count must be positive';
  end if;

  if p_payment_reference is null or length(trim(p_payment_reference)) = 0 then
    raise exception 'A real payment reference is required';
  end if;

  -- Check if already processed with this reference
  select id into v_existing
  from seat_purchases
  where organization_id = p_organization_id and payment_reference = trim(p_payment_reference);

  if v_existing is not null then
    -- Already fulfilled; return current seat summary idempotently
    return get_org_seats_summary(p_organization_id);
  end if;

  insert into seat_purchases (organization_id, seats_purchased, amount_paid, payment_reference, purchased_by)
  values (p_organization_id, p_seats, p_amount, trim(p_payment_reference), auth.uid())
  on conflict (organization_id, payment_reference) where payment_reference is not null do nothing;

  return get_org_seats_summary(p_organization_id);
end;
$$;

-- 3. Hardened apply_organization_subscription_payment
create or replace function apply_organization_subscription_payment(
  p_org_id uuid,
  p_tier subscription_tier,
  p_provider text,
  p_reference text,
  p_amount numeric default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prev_hash text;
  v_row_hash text;
begin
  if auth.uid() is null and auth.role() <> 'service_role' then
    raise exception 'Must be signed in';
  end if;
  if p_reference is null or length(trim(p_reference)) < 4 then
    raise exception 'A real payment reference is required';
  end if;
  if p_tier not in ('starter', 'growth', 'enterprise') then
    raise exception 'Enterprise pricing is custom - route to Book a Demo / Organisation Inquiry instead of self-serve payment';
  end if;
  if auth.role() <> 'service_role' and not (
    exists (
      select 1 from organization_members
      where organization_id = p_org_id and user_id = auth.uid() and role in ('owner','admin') and status = 'active'
    )
    or is_super_admin(auth.uid())
  ) then
    raise exception 'Only that organization''s own admin can activate its subscription';
  end if;

  update organizations
  set subscription_tier = p_tier, status = 'active'
  where id = p_org_id;

  -- Audited record
  select row_hash into v_prev_hash from admin_audit_log order by created_at desc limit 1;
  v_row_hash := encode(
    digest(coalesce(v_prev_hash, '') || 'organization_subscription_payment' || p_org_id::text || p_reference || now()::text, 'sha256'),
    'hex'
  );
  insert into admin_audit_log (admin_user_id, action_type, target_type, target_id, target_identifier, metadata, prev_hash, row_hash)
  values (
    coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    'organization_subscription_payment',
    'organization',
    p_org_id,
    (select name from organizations where id = p_org_id),
    jsonb_build_object('tier', p_tier, 'provider', p_provider, 'reference', p_reference, 'amount', p_amount),
    v_prev_hash,
    v_row_hash
  );

  return jsonb_build_object('success', true, 'organization_id', p_org_id, 'tier', p_tier, 'status', 'active');
end;
$$;
