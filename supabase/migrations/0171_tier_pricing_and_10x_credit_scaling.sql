-- ============================================================================
-- Migration 0171: Tier Pricing, Seat Pricing & 10x Credit Scaling Architecture
--
-- 1. Organization Subscription Tiers:
--    - Basic Tier: 250,000 NGN | $250 USD | £190 GBP | €220 EUR
--      Seats: 1 Admin, 1 Instructor, 20 Learners. Additional seats: 15,000 NGN ($15 USD).
--      Branding: Default colors, no custom branding.
--      Org Pool Credits: 2,200 credits (220 questions).
--    - Intermediate Tier: 500,000 NGN | $500 USD | £400 GBP | €440 EUR
--      Seats: Multiple Admins, Instructors, Manager View, Data Download, 30 Learners,
--      Workforce Intelligence. Additional seats: 10,000 NGN ($10 USD).
--      Branding: Custom organization branding enabled on Train AI.
--      Org Pool Credits: 4,000 credits (400 questions).
--    - Advanced / Enterprise Tier: Custom pricing ("Contact our sales team").
--      Full custom branding, API & webhook linking, SSO, multiple staff.
--
-- 2. Subconscious 10x Credit Scaling Rule:
--    - 1 question = 10 credits (scaled with "one zero at the back").
--    - Initial grant per person = 100 credits (was 10 credits).
--    - Digital Training Org unpaid free users = 20 credits (2 questions).
--    - Digital Training Org paid member package = 150 credits for 15,000 NGN.
--    - AI operation costs:
--      ai_chat_message = 10
--      ai_insight = 10
--      ai_recommendation = 10
--      quiz_generation = 20
--    - All existing accounts and ledger transactions scaled by 10x.
-- ============================================================================

-- 1. Update AI Operation Costs to 10x scale
insert into ai_operation_costs (operation_key, credit_cost, label, updated_at) values
  ('ai_chat_message', 10, 'AI Coach message (1 question)', now()),
  ('ai_insight', 10, 'AI insight telemetry', now()),
  ('ai_recommendation', 10, 'AI recommendation analysis', now()),
  ('quiz_generation', 20, 'AI-generated interactive quiz', now())
on conflict (operation_key) do update
  set credit_cost = excluded.credit_cost,
      label = excluded.label,
      updated_at = now();

-- 2. Update billing_prices table constraint if needed to permit new tier categories
alter table billing_prices drop constraint if exists billing_prices_category_check;
alter table billing_prices add constraint billing_prices_category_check check (
  category in (
    'seat_subscription',
    'seat_subscription_basic',
    'seat_subscription_intermediate',
    'org_subscription_basic',
    'org_subscription_intermediate',
    'org_subscription_starter',
    'org_subscription_growth'
  )
);

-- 3. Deactivate previous starter/growth prices and insert current official rates
update billing_prices set is_active = false where category in ('org_subscription_starter', 'org_subscription_growth', 'seat_subscription');

-- Basic Org Subscription (250,000 NGN / $250 USD / £190 GBP / €220 EUR)
insert into billing_prices (category, currency, unit_amount_minor, is_active) values
  ('org_subscription_basic', 'NGN', 25000000, true),
  ('org_subscription_basic', 'USD', 25000, true),
  ('org_subscription_basic', 'GBP', 19000, true),
  ('org_subscription_basic', 'EUR', 22000, true),
  -- Alias starter -> basic for backwards compatibility
  ('org_subscription_starter', 'NGN', 25000000, true),
  ('org_subscription_starter', 'USD', 25000, true),
  ('org_subscription_starter', 'GBP', 19000, true),
  ('org_subscription_starter', 'EUR', 22000, true),

  -- Intermediate Org Subscription (500,000 NGN / $500 USD / £400 GBP / €440 EUR)
  ('org_subscription_intermediate', 'NGN', 50000000, true),
  ('org_subscription_intermediate', 'USD', 50000, true),
  ('org_subscription_intermediate', 'GBP', 40000, true),
  ('org_subscription_intermediate', 'EUR', 44000, true),
  -- Alias growth -> intermediate for backwards compatibility
  ('org_subscription_growth', 'NGN', 50000000, true),
  ('org_subscription_growth', 'USD', 50000, true),
  ('org_subscription_growth', 'GBP', 40000, true),
  ('org_subscription_growth', 'EUR', 44000, true),

  -- Basic Additional Seats (15,000 NGN / $15 USD / £12 GBP / €14 EUR)
  ('seat_subscription_basic', 'NGN', 1500000, true),
  ('seat_subscription_basic', 'USD', 1500, true),
  ('seat_subscription_basic', 'GBP', 1200, true),
  ('seat_subscription_basic', 'EUR', 1400, true),

  -- Intermediate Additional Seats (10,000 NGN / $10 USD / £8 GBP / €9 EUR)
  ('seat_subscription_intermediate', 'NGN', 1000000, true),
  ('seat_subscription_intermediate', 'USD', 1000, true),
  ('seat_subscription_intermediate', 'GBP', 800, true),
  ('seat_subscription_intermediate', 'EUR', 900, true),

  -- Default seat subscription fallback (Basic rate)
  ('seat_subscription', 'NGN', 1500000, true),
  ('seat_subscription', 'USD', 1500, true),
  ('seat_subscription', 'GBP', 1200, true),
  ('seat_subscription', 'EUR', 1400, true);

-- 4. Scale existing AI credit accounts by 10x (only once if not already scaled)
-- We check if accounts haven't been scaled by verifying whether the max lifetime_credited is <= 50
do $$
declare
  v_max_credited int;
begin
  select coalesce(max(lifetime_credited), 0) into v_max_credited from ai_credit_accounts;
  if v_max_credited <= 50 then
    -- Multiply all accounts by 10
    update ai_credit_accounts
    set balance = balance * 10,
        lifetime_credited = lifetime_credited * 10,
        lifetime_consumed = lifetime_consumed * 10,
        updated_at = now();

    -- Multiply all ledger transactions by 10
    update ai_credit_transactions
    set amount = amount * 10,
        balance_before = balance_before * 10,
        balance_after = balance_after * 10;
  end if;
end;
$$;

-- 5. Update get_or_create_learner_credit_account to grant 100 credits by default
-- (and 20 credits for unpaid digital training org members)
create or replace function get_or_create_learner_credit_account(p_user_id uuid, p_org_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_org_slug text;
  v_initial_balance int := 100;
begin
  select id into v_id from ai_credit_accounts where owner_user_id = p_user_id and account_type = 'learner';
  
  if v_id is null then
    -- Check if user's organization is Digital Training Organization (free/unpaid gets 20 credits)
    if p_org_id is not null then
      select slug into v_org_slug from organizations where id = p_org_id;
      if v_org_slug ilike '%digital-training%' or v_org_slug ilike '%digital_training%' then
        v_initial_balance := 20;
      else
        v_initial_balance := 100;
      end if;
    else
      v_initial_balance := 100;
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
          0, v_initial_balance, 'initial_grant_10x', 'initial_100_credits',
          jsonb_build_object('reason', 'Initial 100 credits grant (10 questions)')
        );
      end if;
    end if;
  end if;

  return v_id;
end;
$$;
