-- ============================================================================
-- Migration 0170: Sara Foundation AI Credits & Strict Individual Metering
--
-- Requirements:
-- 1. All users of Sara Foundation (sara-foundation, sara-foundation-africa)
--    are granted 10 initial personal AI credits in their individual account.
-- 2. New Sara Foundation users automatically receive 10 initial personal credits
--    upon account creation / join.
-- 3. AI usage must strictly consume from individual user credits first.
-- 4. Sara Foundation AI usage is strictly gated to individual user credits.
-- 5. AI is NEVER unlimited: when credits reach 0, all AI features are hard blocked
--    until additional credits are purchased/granted.
-- ============================================================================

-- 1. Update get_or_create_learner_credit_account to automatically grant 10 credits
--    to any new learner joining a Sara Foundation organization.
create or replace function get_or_create_learner_credit_account(p_user_id uuid, p_org_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_org_slug text;
  v_initial_balance int := 0;
begin
  select id into v_id from ai_credit_accounts where owner_user_id = p_user_id and account_type = 'learner';
  
  if v_id is null then
    -- Check if user's organization is Sara Foundation
    if p_org_id is not null then
      select slug into v_org_slug from organizations where id = p_org_id;
      if v_org_slug ilike '%sara%' then
        v_initial_balance := 10;
      end if;
    end if;

    insert into ai_credit_accounts (organization_id, owner_user_id, account_type, balance, lifetime_credited)
    values (p_org_id, p_user_id, 'learner', v_initial_balance, v_initial_balance)
    on conflict (owner_user_id) where account_type = 'learner' do nothing
    returning id into v_id;

    if v_id is null then
      select id into v_id from ai_credit_accounts where owner_user_id = p_user_id and account_type = 'learner';
    else
      if v_initial_balance > 0 then
        insert into ai_credit_transactions (
          organization_id, account_id, user_id, transaction_type, amount,
          balance_before, balance_after, reference_type, reference_id, metadata
        ) values (
          p_org_id, v_id, p_user_id, 'top_up', v_initial_balance,
          0, v_initial_balance, 'sara_foundation_initial_grant', 'initial_10_credits',
          jsonb_build_object('reason', 'Sara Foundation 10 initial credits grant')
        );
      end if;
    end if;
  end if;

  return v_id;
end;
$$;

-- 2. Function to grant 10 initial credits to all existing Sara Foundation users
create or replace function grant_sara_foundation_initial_credits()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user record;
  v_account_id uuid;
  v_current_balance int;
  v_updated_count int := 0;
  v_created_count int := 0;
begin
  for v_user in (
    select up.id as user_id, up.organization_id, o.name as org_name, o.slug as org_slug
    from user_profiles up
    join organizations o on o.id = up.organization_id
    where o.slug ilike '%sara%' or o.name ilike '%sara%'
  ) loop
    select id, balance into v_account_id, v_current_balance
    from ai_credit_accounts
    where owner_user_id = v_user.user_id and account_type = 'learner';

    if v_account_id is null then
      insert into ai_credit_accounts (organization_id, owner_user_id, account_type, balance, lifetime_credited)
      values (v_user.organization_id, v_user.user_id, 'learner', 10, 10)
      returning id into v_account_id;

      insert into ai_credit_transactions (
        organization_id, account_id, user_id, transaction_type, amount,
        balance_before, balance_after, reference_type, reference_id, metadata
      ) values (
        v_user.organization_id, v_account_id, v_user.user_id, 'top_up', 10,
        0, 10, 'sara_foundation_initial_grant', 'initial_10_credits',
        jsonb_build_object('reason', 'Sara Foundation 10 initial credits grant')
      );

      v_created_count := v_created_count + 1;
    else
      -- If account exists but has less than 10 credits from initial setup, top up to 10
      if v_current_balance < 10 then
        update ai_credit_accounts
        set balance = 10,
            lifetime_credited = greatest(lifetime_credited, 10),
            updated_at = now()
        where id = v_account_id;

        insert into ai_credit_transactions (
          organization_id, account_id, user_id, transaction_type, amount,
          balance_before, balance_after, reference_type, reference_id, metadata
        ) values (
          v_user.organization_id, v_account_id, v_user.user_id, 'top_up', 10 - v_current_balance,
          v_current_balance, 10, 'sara_foundation_initial_grant', 'initial_10_credits_topup',
          jsonb_build_object('reason', 'Sara Foundation 10 initial credits topup')
        );

        v_updated_count := v_updated_count + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'accounts_created', v_created_count,
    'accounts_updated', v_updated_count
  );
end;
$$;

-- Execute the grant function immediately
select grant_sara_foundation_initial_credits();

-- 3. Strict Credit Metering Function: Individual Learner credits consumed first.
--    Sara Foundation uses individual credits exclusively.
--    AI usage is strictly hard-blocked when credits are exhausted (never unlimited).
create or replace function consume_ai_credits(
  p_operation_key text,
  p_reference_id text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_org_slug text;
  v_cost int;
  v_org_account uuid;
  v_learner_account uuid;
  v_org_balance int;
  v_learner_balance int;
  v_txn_id uuid;
begin
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

  -- 1. Check and deduct from individual learner personal account first
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

  -- 2. If learner individual balance is insufficient, check org balance IF AND ONLY IF not Sara Foundation
  if v_org_id is not null then
    select slug into v_org_slug from organizations where id = v_org_id;
    -- For Sara Foundation, individual credits are required (no shared fallback)
    if v_org_slug not ilike '%sara%' then
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
  end if;

  -- 3. Hard block when credits are exhausted - AI IS NOT UNLIMITED
  return jsonb_build_object(
    'authorized', false,
    'reason', 'insufficient_credits',
    'cost', v_cost,
    'learner_balance', coalesce(v_learner_balance, 0)
  );
end;
$$;

-- 4. Read function: get_my_ai_credits
create or replace function get_my_ai_credits()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_org_slug text;
  v_org_balance int := 0;
  v_learner_balance int := 0;
begin
  v_org_id := get_user_organization_id(auth.uid());
  if v_org_id is not null then
    select slug into v_org_slug from organizations where id = v_org_id;
    -- For Sara Foundation, org balance is not shared; individual learner balance is what counts
    if v_org_slug not ilike '%sara%' then
      select balance into v_org_balance from ai_credit_accounts where organization_id = v_org_id and account_type = 'organization';
    end if;
  end if;
  select balance into v_learner_balance from ai_credit_accounts where owner_user_id = auth.uid() and account_type = 'learner';
  return jsonb_build_object('organization_balance', coalesce(v_org_balance, 0), 'personal_balance', coalesce(v_learner_balance, 0));
end;
$$;
