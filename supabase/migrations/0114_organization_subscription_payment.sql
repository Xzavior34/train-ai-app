-- ============================================================================
-- Organization subscription/payment gating - the real gap behind the
-- pricing page
-- ============================================================================
-- Confirmed by reading the code, not assumed: self-serve organization
-- signup (0102_org_self_serve_signup.sql) creates the organization at
-- 'starter' tier and 'trial' status unconditionally - there is no payment
-- step anywhere in that flow. The existing payment infrastructure
-- (lib/api/payments.js - Paystack/Stripe, already live on the shared
-- Supabase project) has contexts for credits, course enrollment, and
-- waitlist premium, but nothing for an organization subscription at all.
-- Meaning: right now, any organization gets full self-serve access for
-- free, indefinitely, regardless of which tier its dashboard claims to be
-- on. The pricing page and the actual account model are disconnected.
--
-- IMPORTANT TRUST BOUNDARY - read before treating this as "done":
-- The real Stripe/Paystack verify calls (stripe-verify / paystack-verify)
-- are edge functions that live in a *separate*, shared codebase
-- (train-ai-ltd-main, per the comment in lib/api/payments.js) that isn't
-- part of this repo - they cannot be edited from here. The correct,
-- fully-hardened design has the *edge function itself* apply the tier
-- change server-side, using its own trusted view of the payment provider's
-- response, the same way it already does for the `paid_waitlist` table on
-- the `waitlist_premium` context. This migration instead exposes an RPC
-- that the *client* calls after receiving a real, trustworthy result from
-- that live verify function - which is much better than nothing (still
-- requires being a genuine admin of that specific org, still requires a
-- real non-empty payment reference, still writes an audit trail), but it
-- is not the same guarantee as the edge function doing it directly. If/when
-- the shared edge functions can be updated to recognize an
-- "organization_subscription" context and call this same logic themselves
-- server-side, that closes this gap completely. Flagging this explicitly
-- rather than presenting client-triggered-after-verification as
-- equivalent to server-verified.
-- ============================================================================

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
  if auth.uid() is null then
    raise exception 'Must be signed in';
  end if;
  if p_reference is null or length(trim(p_reference)) < 4 then
    raise exception 'A real payment reference is required';
  end if;
  if p_tier not in ('starter', 'growth', 'enterprise') then
    raise exception 'Enterprise pricing is custom - route to Book a Demo / Organisation Inquiry instead of self-serve payment';
  end if;
  if not (
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

  -- Audited the same way impersonation is (0113) - a tier change with no
  -- corresponding audit row is exactly the kind of thing that should look
  -- wrong on inspection.
  select row_hash into v_prev_hash from admin_audit_log order by created_at desc limit 1;
  v_row_hash := encode(
    digest(coalesce(v_prev_hash, '') || 'organization_subscription_payment' || p_org_id::text || p_reference || now()::text, 'sha256'),
    'hex'
  );
  insert into admin_audit_log (admin_user_id, action_type, target_type, target_id, target_identifier, metadata, prev_hash, row_hash)
  values (
    auth.uid(), 'organization_subscription_payment', 'organization', p_org_id,
    (select name from organizations where id = p_org_id),
    jsonb_build_object('tier', p_tier, 'provider', p_provider, 'reference', p_reference, 'amount', p_amount),
    v_prev_hash, v_row_hash
  );

  return jsonb_build_object('success', true, 'organization_id', p_org_id, 'tier', p_tier, 'status', 'active');
end;
$$;

comment on function apply_organization_subscription_payment(uuid, subscription_tier, text, text, numeric) is
  'Applies a paid tier + activates an organization after a real payment verification response from the client. See the migration header for the trust-boundary caveat - the stronger version of this lives server-side in the shared payment edge functions, not here.';
