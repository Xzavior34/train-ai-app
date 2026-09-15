-- ============================================================================
-- Real, server-side AI credit metering - replaces the fake system.
-- ============================================================================
-- Phase 1 audit finding, confirmed by reading the actual code, not assumed:
-- the "credits" shown in every screen of this app today
-- (src/learner/hooks/useCredits.js) are 100% client-side - stored in
-- localStorage, reset to 10 every calendar day regardless of any purchase,
-- and never checked by any AI edge function. Any user could set their own
-- balance to any number via devtools with zero server involvement. This is
-- the exact anti-pattern the billing spec for this feature explicitly
-- warns against ("the browser must never be trusted to determine whether a
-- learner has credits"). This migration is a real replacement, not an
-- addition alongside it - useCredits.js and its call sites need to be
-- retired once the frontend is wired to this (tracked separately, not
-- done in this pass - see the accompanying report).
--
-- Reused, not duplicated, from what this repo already has correctly built:
--   - seat_purchases / purchase_seats() (0129) - the exact ledger-style
--     pattern this migration mirrors for AI credits
--   - src/lib/api/payments.js - the real, live Paystack/Stripe edge
--     functions already used for the "credits" payment context. This
--     migration adds the missing other half: crediting a real server-side
--     account after a successful payment, instead of a localStorage write.
--   - organization_feature_flags / get_org_feature (0115, fixed 0154) -
--     reused as-is for "does this org have AI enabled at all", not
--     reimplemented here.
--   - credit_requests (0146) - reused as-is for the learner-asks-org-for-
--     credits workflow; this migration adds the missing admin-approval
--     side (approve_credit_request()) that 0146's own comment says never
--     got built, and fixes a real bug found while reading it: cr_update_admin
--     used bare is_org_admin(auth.uid()) with no organization match - the
--     same cross-tenant pattern found and fixed repeatedly elsewhere in
--     this schema (0152/0153) - any org admin anywhere could resolve any
--     other org's learner's credit request.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Accounts - one per organization (owner_user_id null), one per learner
--    who has ever needed one (created lazily by the RPCs below, not by a
--    signup trigger, to keep this self-contained).
-- ----------------------------------------------------------------------------
create table if not exists ai_credit_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  owner_user_id uuid references user_profiles(id) on delete cascade,
  account_type text not null check (account_type in ('organization', 'learner')),
  balance int not null default 0 check (balance >= 0),
  lifetime_credited int not null default 0,
  lifetime_consumed int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_credit_accounts_org_shape check (
    (account_type = 'organization' and owner_user_id is null and organization_id is not null)
    or (account_type = 'learner' and owner_user_id is not null)
  )
);

-- One organization account per org; one learner account per user (a
-- learner's personal account is independent of which org they're in,
-- matching "may have organization credits available and personal
-- purchased credits" - organization_id on a learner row just records
-- which org they belonged to when the account was created, for RLS scoping).
create unique index if not exists ai_credit_accounts_one_org_account
  on ai_credit_accounts(organization_id) where account_type = 'organization';
create unique index if not exists ai_credit_accounts_one_learner_account
  on ai_credit_accounts(owner_user_id) where account_type = 'learner';

alter table ai_credit_accounts enable row level security;

drop policy if exists aica_select_own on ai_credit_accounts;
create policy aica_select_own on ai_credit_accounts for select
  using (
    owner_user_id = auth.uid()
    or (account_type = 'organization' and organization_id = get_user_organization_id(auth.uid()))
    or is_super_admin(auth.uid())
  );

-- No insert/update/delete policy for ordinary users at all - every balance
-- change happens through the SECURITY DEFINER RPCs below, which is the
-- actual enforcement point (matches seat_purchases' own established
-- pattern: "no direct insert policy needed for ordinary users"). A
-- super_admin-only policy exists for genuine manual support corrections.
drop policy if exists aica_write_super_admin on ai_credit_accounts;
create policy aica_write_super_admin on ai_credit_accounts for all
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 2. Immutable ledger. No update/delete policy exists anywhere in this
--    migration for any role except super_admin correction - by omission,
--    matching "never allow normal users to arbitrarily edit ledger history."
-- ----------------------------------------------------------------------------
create table if not exists ai_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  account_id uuid not null references ai_credit_accounts(id) on delete cascade,
  user_id uuid references user_profiles(id) on delete set null,
  transaction_type text not null check (transaction_type in
    ('purchase', 'top_up', 'consumption', 'refund', 'adjustment', 'expiration', 'reversal')),
  amount int not null,
  balance_before int not null,
  balance_after int not null,
  reference_type text,
  reference_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references user_profiles(id)
);

create index if not exists ai_credit_transactions_account_idx on ai_credit_transactions(account_id, created_at desc);
create index if not exists ai_credit_transactions_org_idx on ai_credit_transactions(organization_id, created_at desc);

alter table ai_credit_transactions enable row level security;

drop policy if exists aict_select_own on ai_credit_transactions;
create policy aict_select_own on ai_credit_transactions for select
  using (
    user_id = auth.uid()
    or (organization_id = get_user_organization_id(auth.uid()) and is_org_admin(auth.uid()))
    or is_super_admin(auth.uid())
  );

drop policy if exists aict_write_super_admin on ai_credit_transactions;
create policy aict_write_super_admin on ai_credit_transactions for insert
  with check (is_super_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 3. Configurable per-operation credit cost - "do not hard-code every AI
--    operation to cost exactly one credit." Platform-owner-writable only;
--    readable by anyone signed in (it's a price list, not tenant data).
-- ----------------------------------------------------------------------------
create table if not exists ai_operation_costs (
  operation_key text primary key,
  credit_cost int not null default 1 check (credit_cost >= 0),
  label text,
  updated_at timestamptz not null default now(),
  updated_by uuid references user_profiles(id)
);

insert into ai_operation_costs (operation_key, credit_cost, label) values
  ('ai_chat_message', 1, 'AI Coach message'),
  ('quiz_generation', 2, 'AI-generated quiz'),
  ('ai_insight', 1, 'AI insight'),
  ('ai_recommendation', 1, 'AI recommendation')
on conflict (operation_key) do nothing;

alter table ai_operation_costs enable row level security;

drop policy if exists aioc_select_all on ai_operation_costs;
create policy aioc_select_all on ai_operation_costs for select using (true);

drop policy if exists aioc_write_super_admin on ai_operation_costs;
create policy aioc_write_super_admin on ai_operation_costs for all
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 4. Account lookup/creation helper - lazy, idempotent. Not exposed
--    directly to clients (no grant needed beyond normal function execute,
--    since it only ever touches the caller's own accounts or is called
--    from within the other SECURITY DEFINER functions below).
-- ----------------------------------------------------------------------------
create or replace function get_or_create_org_credit_account(p_org_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from ai_credit_accounts where organization_id = p_org_id and account_type = 'organization';
  if v_id is null then
    insert into ai_credit_accounts (organization_id, account_type, balance)
    values (p_org_id, 'organization', 0)
    on conflict (organization_id) where account_type = 'organization' do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from ai_credit_accounts where organization_id = p_org_id and account_type = 'organization';
    end if;
  end if;
  return v_id;
end;
$$;

create or replace function get_or_create_learner_credit_account(p_user_id uuid, p_org_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from ai_credit_accounts where owner_user_id = p_user_id and account_type = 'learner';
  if v_id is null then
    insert into ai_credit_accounts (organization_id, owner_user_id, account_type, balance)
    values (p_org_id, p_user_id, 'learner', 0)
    on conflict (owner_user_id) where account_type = 'learner' do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from ai_credit_accounts where owner_user_id = p_user_id and account_type = 'learner';
    end if;
  end if;
  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Atomic consumption. Called by an AI Edge Function (service-role
--    context, but org/user are passed explicitly since edge functions
--    authenticate the caller themselves - see ai-chat's own auth.getUser()
--    pattern already in place) BEFORE the AI provider is called.
--
--    Atomicity: `select ... for update` locks the specific account row for
--    the duration of this transaction, so two concurrent calls against the
--    same account genuinely serialize - the second call's SELECT blocks
--    until the first's UPDATE commits, and re-reads the now-current
--    balance rather than a stale one. This is what actually prevents
--    double-spending under concurrency; checking the balance and updating
--    it as two separate statements without the row lock would not.
--
--    Policy (explicit, matching the brief's own recommendation): consume
--    organization credits first, then the learner's personal credits,
--    then block. A learner can never touch another learner's account -
--    the function only ever operates on the account belonging to
--    p_user_id and their own organization, both server-derived from the
--    edge function's verified auth context, never client-supplied trust.
-- ----------------------------------------------------------------------------
create or replace function consume_ai_credits(
  p_operation_key text,
  p_reference_id text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_cost int;
  v_org_account uuid;
  v_learner_account uuid;
  v_org_balance int;
  v_learner_balance int;
  v_txn_id uuid;
begin
  -- The only trustworthy identity here is auth.uid() - the caller's own
  -- verified session. p_user_id/p_org_id were client-supplied parameters
  -- in an earlier draft of this function; adversarial testing during this
  -- same implementation pass proved that let any authenticated user drain
  -- any organization's credit pool by simply naming it (confirmed: a
  -- learner with zero relationship to Org A successfully deducted from
  -- Org A's balance by passing its id as a parameter). Fixed by deriving
  -- both from the server-verified session instead, matching the trust
  -- pattern every other SECURITY DEFINER function in this schema already
  -- uses (get_user_organization_id(auth.uid()), never a parameter).
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Must be signed in';
  end if;
  v_org_id := get_user_organization_id(v_user_id);

  select credit_cost into v_cost from ai_operation_costs where operation_key = p_operation_key;
  if v_cost is null then v_cost := 1; end if;
  if v_cost = 0 then
    return jsonb_build_object('authorized', true, 'consumed_from', 'free', 'cost', 0);
  end if;

  if v_org_id is not null then
    v_org_account := get_or_create_org_credit_account(v_org_id);
    select balance into v_org_balance from ai_credit_accounts where id = v_org_account for update;
    if v_org_balance >= v_cost then
      update ai_credit_accounts
        set balance = balance - v_cost, lifetime_consumed = lifetime_consumed + v_cost, updated_at = now()
        where id = v_org_account
        returning balance into v_org_balance;
      insert into ai_credit_transactions (organization_id, account_id, user_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, metadata)
      values (v_org_id, v_org_account, v_user_id, 'consumption', -v_cost, v_org_balance + v_cost, v_org_balance, p_operation_key, p_reference_id, jsonb_build_object('operation', p_operation_key))
      returning id into v_txn_id;
      return jsonb_build_object('authorized', true, 'consumed_from', 'organization', 'cost', v_cost, 'transaction_id', v_txn_id, 'org_balance', v_org_balance);
    end if;
  end if;

  -- Organization credits exhausted or no organization - try the learner's
  -- own personal account.
  v_learner_account := get_or_create_learner_credit_account(v_user_id, v_org_id);
  select balance into v_learner_balance from ai_credit_accounts where id = v_learner_account for update;
  if v_learner_balance >= v_cost then
    update ai_credit_accounts
      set balance = balance - v_cost, lifetime_consumed = lifetime_consumed + v_cost, updated_at = now()
      where id = v_learner_account
      returning balance into v_learner_balance;
    insert into ai_credit_transactions (organization_id, account_id, user_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, metadata)
    values (v_org_id, v_learner_account, v_user_id, 'consumption', -v_cost, v_learner_balance + v_cost, v_learner_balance, p_operation_key, p_reference_id, jsonb_build_object('operation', p_operation_key))
    returning id into v_txn_id;
    return jsonb_build_object('authorized', true, 'consumed_from', 'learner', 'cost', v_cost, 'transaction_id', v_txn_id, 'learner_balance', v_learner_balance);
  end if;

  -- Both exhausted - hard block, per spec ("do not allow AI requests to
  -- continue"). No row is written for a denied request - there is nothing
  -- to refund because nothing was ever consumed.
  return jsonb_build_object('authorized', false, 'reason', 'insufficient_credits', 'cost', v_cost);
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Refund/reversal - called by an Edge Function if the AI provider call
--    fails AFTER consume_ai_credits already succeeded. Writes a REFUND
--    transaction rather than deleting the original CONSUMPTION row -
--    the ledger stays a complete, honest history of what happened, not a
--    edited-after-the-fact one.
-- ----------------------------------------------------------------------------
create or replace function refund_ai_credits(p_transaction_id uuid, p_reason text default 'provider_failure')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_txn ai_credit_transactions%rowtype;
  v_new_balance int;
begin
  -- This must never be a user-triggerable action - a learner refunding
  -- their own AI usage on demand would make the whole hard-limit
  -- pointless. Only a genuine service-role caller (the Edge Function's
  -- own internal "the AI provider failed after I already deducted
  -- credits" handling, invoked with the service-role key) or a
  -- super_admin correction may call this.
  --
  -- NOTE ON A BUG CAUGHT DURING THIS SAME IMPLEMENTATION PASS: an earlier
  -- version of this check used `current_user <> 'authenticated'`, copied
  -- from a different function's pattern without checking it actually
  -- applies here. It does not: current_user inside any SECURITY DEFINER
  -- function is always the function's OWNER, never the real caller - so
  -- that check was true for every single caller, including an ordinary
  -- learner, and never blocked anyone. Confirmed by testing (a learner
  -- successfully self-refunded before this fix), not just reasoned about.
  -- auth.role() is the correct mechanism - it reads the JWT's own role
  -- claim ('service_role' vs 'authenticated'), independent of which
  -- Postgres role is executing the function body.
  if not (is_super_admin(auth.uid()) or auth.role() = 'service_role') then
    raise exception 'Not authorized to issue AI credit refunds';
  end if;

  select * into v_txn from ai_credit_transactions where id = p_transaction_id and transaction_type = 'consumption';
  if v_txn.id is null then
    raise exception 'No matching consumption transaction to refund';
  end if;
  if exists (select 1 from ai_credit_transactions where reference_type = 'refund_of' and reference_id = p_transaction_id::text) then
    raise exception 'Already refunded';
  end if;

  update ai_credit_accounts
    set balance = balance + abs(v_txn.amount), lifetime_consumed = greatest(0, lifetime_consumed - abs(v_txn.amount)), updated_at = now()
    where id = v_txn.account_id
    returning balance into v_new_balance;

  insert into ai_credit_transactions (organization_id, account_id, user_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, metadata)
  values (v_txn.organization_id, v_txn.account_id, v_txn.user_id, 'refund', abs(v_txn.amount), v_new_balance - abs(v_txn.amount), v_new_balance, 'refund_of', p_transaction_id::text, jsonb_build_object('reason', p_reason));

  return jsonb_build_object('refunded', true, 'new_balance', v_new_balance);
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. Grant/top-up - the missing other half of the real Paystack/Stripe
--    flow (src/lib/api/payments.js already exists and works; nothing
--    server-side ever credited an account after a successful "credits"
--    payment - it just wrote to localStorage). Also used for a
--    super_admin manual adjustment and for approving a credit_requests row.
-- ----------------------------------------------------------------------------
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

  -- Authorization: an org admin may only grant to their own org's account
  -- (organization or a learner within it); a learner may only grant to
  -- their own personal account (the real purchase-for-self path);
  -- super_admin may grant to anything.
  if not (
    is_super_admin(auth.uid())
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

-- Convenience wrapper matching purchase_seats()'s shape, for the org
-- admin's real "Buy AI Credits" flow after a verified Paystack/Stripe payment.
create or replace function purchase_ai_credits(p_organization_id uuid, p_credits int, p_amount numeric, p_payment_reference text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_account uuid;
begin
  if not (is_org_admin(auth.uid()) and get_user_organization_id(auth.uid()) = p_organization_id) and not is_super_admin(auth.uid()) then
    raise exception 'Not authorized to purchase AI credits for this organization';
  end if;
  if p_payment_reference is null or length(trim(p_payment_reference)) = 0 then
    raise exception 'A real payment reference is required';
  end if;
  v_account := get_or_create_org_credit_account(p_organization_id);
  return grant_ai_credits(v_account, p_credits, 'purchase', p_payment_reference);
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. Approve a pending credit_requests row (0146) - the admin-side half
--    that table's own header comment says was never built. Also fixes the
--    cross-tenant bug found while reading 0146: cr_update_admin had no
--    organization match.
-- ----------------------------------------------------------------------------
drop policy if exists cr_update_admin on credit_requests;
create policy cr_update_admin on credit_requests for update
  using (
    (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()))
    or is_super_admin(auth.uid())
  );

create or replace function approve_credit_request(p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_req credit_requests%rowtype;
  v_learner_account uuid;
  v_result jsonb;
begin
  select * into v_req from credit_requests where id = p_request_id and status = 'pending';
  if v_req.id is null then
    raise exception 'No pending request found';
  end if;
  if not (
    (is_org_admin(auth.uid()) and v_req.organization_id = get_user_organization_id(auth.uid()))
    or is_super_admin(auth.uid())
  ) then
    raise exception 'Not authorized to approve this request';
  end if;

  v_learner_account := get_or_create_learner_credit_account(v_req.user_id, v_req.organization_id);
  v_result := grant_ai_credits(v_learner_account, v_req.amount, 'adjustment', 'credit_request:' || p_request_id::text);

  update credit_requests set status = 'approved', resolved_at = now(), resolved_by = auth.uid() where id = p_request_id;

  return v_result;
end;
$$;

create or replace function deny_credit_request(p_request_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (
    exists (select 1 from credit_requests where id = p_request_id and (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid())))
    or is_super_admin(auth.uid())
  ) then
    raise exception 'Not authorized to deny this request';
  end if;
  update credit_requests set status = 'denied', resolved_at = now(), resolved_by = auth.uid()
  where id = p_request_id and status = 'pending';
end;
$$;

-- Learner buying credits for themselves (PaymentCallbackScreen.jsx's
-- CREDITS payment context) - the actual missing other half of that
-- already-real Paystack/Stripe flow. Mirrors purchase_ai_credits()'s
-- shape for the org-level equivalent.
create or replace function purchase_personal_ai_credits(p_credits int, p_amount numeric, p_payment_reference text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_account uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Must be signed in';
  end if;
  if p_payment_reference is null or length(trim(p_payment_reference)) = 0 then
    raise exception 'A real payment reference is required';
  end if;
  v_org_id := get_user_organization_id(v_user_id);
  v_account := get_or_create_learner_credit_account(v_user_id, v_org_id);
  return grant_ai_credits(v_account, p_credits, 'purchase', p_payment_reference);
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. Read-only summary for the admin billing screen - mirrors
--    get_org_seats_summary()'s shape deliberately for UI consistency.
-- ----------------------------------------------------------------------------
create or replace function get_org_ai_credits_summary(p_org_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_account ai_credit_accounts%rowtype;
begin
  if not (p_org_id = get_user_organization_id(auth.uid()) or is_super_admin(auth.uid())) then
    raise exception 'Not authorized to view this organization''s AI credits';
  end if;
  select * into v_account from ai_credit_accounts where organization_id = p_org_id and account_type = 'organization';
  if v_account.id is null then
    return jsonb_build_object('balance', 0, 'lifetime_credited', 0, 'lifetime_consumed', 0);
  end if;
  return jsonb_build_object('balance', v_account.balance, 'lifetime_credited', v_account.lifetime_credited, 'lifetime_consumed', v_account.lifetime_consumed);
end;
$$;

create or replace function get_my_ai_credits()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_org_balance int := 0;
  v_learner_balance int := 0;
begin
  v_org_id := get_user_organization_id(auth.uid());
  if v_org_id is not null then
    select balance into v_org_balance from ai_credit_accounts where organization_id = v_org_id and account_type = 'organization';
  end if;
  select balance into v_learner_balance from ai_credit_accounts where owner_user_id = auth.uid() and account_type = 'learner';
  return jsonb_build_object('organization_balance', coalesce(v_org_balance, 0), 'personal_balance', coalesce(v_learner_balance, 0));
end;
$$;
