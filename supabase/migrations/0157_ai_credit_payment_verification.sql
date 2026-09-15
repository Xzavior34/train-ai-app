-- ============================================================================
-- Phase 2 fix (flagged HIGH PRIORITY): close the fake-payment-reference gap
-- in purchase_ai_credits()/purchase_personal_ai_credits().
-- ============================================================================
-- Confirmed by reading src/lib/api/payments.js: this app's real Paystack/
-- Stripe integration works by the CLIENT calling paystack-verify/
-- stripe-verify (live edge functions on the same project, which really do
-- call out to Paystack/Stripe's own API server-side - not client-trusted)
-- and then, separately, the client calling purchase_ai_credits()/
-- purchase_personal_ai_credits() with whatever reference/amount it wants.
-- Nothing tied those two calls together - a client could skip the verify
-- step entirely and call the purchase RPC directly with a fabricated
-- reference and an arbitrary credit amount. That is a real, exploitable
-- gap, not a hypothetical one.
--
-- Fix, in two parts:
--   1. A real idempotency ledger (ai_credit_payment_records) - one row per
--      (provider, provider_reference), unique-constrained, so the exact
--      same payment can never be credited twice even if the grant is
--      attempted more than once (page reload, retried callback, etc).
--   2. purchase_ai_credits()/purchase_personal_ai_credits() are now
--      service-role-only - an ordinary authenticated client can no longer
--      call them directly at all (auth.role() check, the standard Supabase
--      mechanism, not current_user which does not work inside a SECURITY
--      DEFINER function - see 0156's own comment on that exact mistake).
--      The only caller left is the new grant-ai-credits-from-payment Edge
--      Function (supabase/functions/grant-ai-credits-from-payment/),
--      which independently re-verifies the payment server-side via the
--      real paystack-verify/stripe-verify functions before ever calling
--      these RPCs - the client's claimed amount/reference is never trusted
--      on its own past that point.
-- ============================================================================

create table if not exists ai_credit_payment_records (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('paystack', 'stripe')),
  provider_reference text not null,
  organization_id uuid references organizations(id) on delete set null,
  user_id uuid references user_profiles(id) on delete set null,
  account_scope text not null check (account_scope in ('organization', 'learner')),
  credits_granted int not null,
  amount numeric,
  currency text,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

-- The actual idempotency guarantee: the same provider+reference can only
-- ever exist once, at the database constraint level - not just an
-- application-level "check first" race that a concurrent retry could slip
-- past.
create unique index if not exists ai_credit_payment_records_unique_ref
  on ai_credit_payment_records(provider, provider_reference);

alter table ai_credit_payment_records enable row level security;

drop policy if exists aicpr_select_own on ai_credit_payment_records;
create policy aicpr_select_own on ai_credit_payment_records for select
  using (
    user_id = auth.uid()
    or (organization_id = get_user_organization_id(auth.uid()) and is_org_admin(auth.uid()))
    or is_super_admin(auth.uid())
  );

-- No insert/update/delete policy for any authenticated-role caller at all -
-- only the service-role Edge Function writes here (service_role bypasses
-- RLS entirely by design in Supabase, so no policy is needed for it, and
-- none should exist for anyone else).

-- ----------------------------------------------------------------------------
-- Restrict the purchase RPCs to service-role callers only. auth.role() is
-- the correct mechanism here (reads the JWT's own role claim), not
-- current_user (always the function owner inside SECURITY DEFINER,
-- confirmed the hard way in 0156).
-- ----------------------------------------------------------------------------
create or replace function purchase_ai_credits(p_organization_id uuid, p_credits int, p_amount numeric, p_payment_reference text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_account uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'This operation is only available through the verified payment flow';
  end if;
  if p_payment_reference is null or length(trim(p_payment_reference)) = 0 then
    raise exception 'A real payment reference is required';
  end if;
  v_account := get_or_create_org_credit_account(p_organization_id);
  return grant_ai_credits(v_account, p_credits, 'purchase', p_payment_reference);
end;
$$;

-- The old client-callable purchase_personal_ai_credits(int, numeric, text)
-- is superseded entirely by purchase_personal_ai_credits_for() below (which
-- takes an explicit, server-verified user id and is service-role-only) -
-- dropped outright rather than left as a confusing broken stub.
drop function if exists purchase_personal_ai_credits(int, numeric, text);

-- grant_ai_credits() itself is also authorization-checked by the account's
-- real owner/org (0156) - service_role bypasses RLS but this function's own
-- internal auth.uid()-based check would reject a null auth.uid() (which is
-- what a service-role call without a forwarded user JWT has) unless it's
-- also given a service_role bypass. Fixed here rather than weakened at the
-- call site.
create or replace function grant_ai_credits(
  p_account_id uuid,
  p_amount int,
  p_transaction_type text,
  p_reference text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_account ai_credit_accounts%rowtype;
  v_new_balance int;
begin
  if p_amount <= 0 then
    raise exception 'Grant amount must be positive';
  end if;
  if p_transaction_type not in ('purchase', 'top_up', 'adjustment') then
    raise exception 'Invalid grant transaction type';
  end if;

  select * into v_account from ai_credit_accounts where id = p_account_id for update;
  if v_account.id is null then
    raise exception 'Credit account not found';
  end if;

  if not (
    auth.role() = 'service_role'
    or is_super_admin(auth.uid())
    or (v_account.owner_user_id = auth.uid())
    or (v_account.account_type = 'organization' and is_org_admin(auth.uid()) and v_account.organization_id = get_user_organization_id(auth.uid()))
    or (v_account.account_type = 'learner' and is_org_admin(auth.uid()) and v_account.organization_id = get_user_organization_id(auth.uid()))
  ) then
    raise exception 'Not authorized to add credits to this account';
  end if;

  update ai_credit_accounts
    set balance = balance + p_amount, lifetime_credited = lifetime_credited + p_amount, updated_at = now()
    where id = p_account_id
    returning balance into v_new_balance;

  insert into ai_credit_transactions (organization_id, account_id, user_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, created_by)
  values (v_account.organization_id, p_account_id, v_account.owner_user_id, p_transaction_type, p_amount, v_new_balance - p_amount, v_new_balance, 'payment_reference', p_reference, auth.uid());

  return jsonb_build_object('granted', true, 'new_balance', v_new_balance);
end;
$$;

-- Replaces the broken purchase_personal_ai_credits stub above - the
-- service-role Edge Function calls this with the real, server-verified
-- user id (it authenticated that user's own JWT itself before granting),
-- never a client-supplied one.
create or replace function purchase_personal_ai_credits_for(p_user_id uuid, p_credits int, p_amount numeric, p_payment_reference text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_account uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'This operation is only available through the verified payment flow';
  end if;
  if p_payment_reference is null or length(trim(p_payment_reference)) = 0 then
    raise exception 'A real payment reference is required';
  end if;
  v_org_id := get_user_organization_id(p_user_id);
  v_account := get_or_create_learner_credit_account(p_user_id, v_org_id);
  return grant_ai_credits(v_account, p_credits, 'purchase', p_payment_reference);
end;
$$;

-- ----------------------------------------------------------------------------
-- The actual idempotent grant entry point - records the payment first
-- (unique constraint catches a duplicate attempt immediately, before any
-- balance change happens), then grants. Called by the Edge Function only.
-- ----------------------------------------------------------------------------
create or replace function record_and_grant_ai_credit_payment(
  p_provider text,
  p_provider_reference text,
  p_account_scope text,
  p_organization_id uuid,
  p_user_id uuid,
  p_credits int,
  p_amount numeric,
  p_currency text
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
  v_account uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'This operation is only available through the verified payment flow';
  end if;

  -- Idempotency: the unique index on (provider, provider_reference) makes
  -- this a hard database guarantee, not just an application check - a
  -- second attempt for the same real payment fails here, before any
  -- credit is touched.
  begin
    insert into ai_credit_payment_records
      (provider, provider_reference, organization_id, user_id, account_scope, credits_granted, amount, currency)
    values
      (p_provider, p_provider_reference, p_organization_id, p_user_id, p_account_scope, p_credits, p_amount, p_currency);
  exception when unique_violation then
    return jsonb_build_object('granted', false, 'reason', 'already_processed');
  end;

  if p_account_scope = 'organization' then
    v_account := get_or_create_org_credit_account(p_organization_id);
  else
    v_account := get_or_create_learner_credit_account(p_user_id, p_organization_id);
  end if;

  v_result := grant_ai_credits(v_account, p_credits, 'purchase', p_provider || ':' || p_provider_reference);
  return v_result || jsonb_build_object('idempotent', true);
end;
$$;
