-- ============================================================================
-- Billing foundation: configurable pricing, feature entitlement pricing,
-- academy commission architecture.
-- ============================================================================
-- Phase 1 audit, confirmed by reading the code, not assumed:
--   - seat_purchases/purchase_seats/check_seat_available (0129) - real,
--     reused as-is, not touched here.
--   - ai_credit_accounts/transactions/costs (0156/0157) - real, reused
--     as-is, not touched here.
--   - organization_feature_flags (0115) - real (organization_id,
--     feature_key, enabled), extended below with pricing columns rather
--     than duplicated with a parallel entitlement table.
--   - payments.js's real Paystack/Stripe integration - reused as-is.
--   - A genuinely missing, concrete gap found while auditing:
--     `SEAT_PRICE_USD = 10` and `SEAT_PRICE_NGN = 15000` are hardcoded
--     JavaScript constants in src/lib/api/organizations.js - the exact
--     "hard-coded exchange rate scattered through the app" anti-pattern
--     this task names explicitly (15000 silently bakes in an unstated,
--     unconfigurable ~1500 NGN/USD rate). Replaced with a real,
--     platform-owner-configurable table.
--   - Academy commission - genuinely did not exist anywhere in this
--     schema. Built new, minimally, below.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. billing_prices - replaces the two hardcoded JS constants. Historical
--    rows are kept (never deleted/overwritten) so past transactions can
--    always be traced back to the price that was actually active when
--    they happened - same "preserve the rate applied at the time" principle
--    the academy commission model below needs too.
-- ----------------------------------------------------------------------------
create table if not exists billing_prices (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('seat_subscription', 'org_subscription_starter', 'org_subscription_growth')),
  currency text not null,
  unit_amount_minor bigint not null check (unit_amount_minor >= 0),
  effective_date timestamptz not null default now(),
  is_active boolean not null default true,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists billing_prices_lookup_idx on billing_prices(category, currency, is_active, effective_date desc);

alter table billing_prices enable row level security;

-- Pricing is not tenant-sensitive data (it's what the platform charges
-- everyone in that currency), so it's readable by any signed-in user -
-- the frontend needs it to show real prices instead of a hardcoded one.
drop policy if exists bp_select_all on billing_prices;
create policy bp_select_all on billing_prices for select using (true);

drop policy if exists bp_write_super_admin on billing_prices;
create policy bp_write_super_admin on billing_prices for all
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

-- Seed with the same reference values the hardcoded constants used
-- ($10.00 = 1000 cents, NGN15,000.00 = 1,500,000 kobo) - preserved as the
-- documented starting configuration, not silently changed, but now a real,
-- inspectable, platform-owner-editable row instead of a JS constant three
-- files deep.
insert into billing_prices (category, currency, unit_amount_minor, is_active) values
  ('seat_subscription', 'USD', 1000, true),
  ('seat_subscription', 'NGN', 1500000, true),
  ('org_subscription_starter', 'USD', 1500, true),
  ('org_subscription_starter', 'NGN', 1500000, true),
  ('org_subscription_growth', 'USD', 4500, true),
  ('org_subscription_growth', 'NGN', 4500000, true)
on conflict do nothing;

create or replace function get_active_price(p_category text, p_currency text)
returns jsonb
language sql stable as $$
  select jsonb_build_object('currency', currency, 'unit_amount_minor', unit_amount_minor, 'effective_date', effective_date)
  from billing_prices
  where category = p_category and currency = p_currency and is_active = true and effective_date <= now()
  order by effective_date desc
  limit 1;
$$;

-- ----------------------------------------------------------------------------
-- 2. organization_feature_flags - extended with negotiated-pricing columns
--    (Section B: "pricing may be negotiated per organization... do not
--    create a global hard-coded price"). The enable/disable mechanism
--    (0115) already exists and is unchanged; this only adds the pricing
--    metadata alongside it.
-- ----------------------------------------------------------------------------
alter table organization_feature_flags add column if not exists negotiated_price_minor bigint;
alter table organization_feature_flags add column if not exists currency text;
alter table organization_feature_flags add column if not exists billing_frequency text check (billing_frequency in ('monthly', 'annual', 'one_time') or billing_frequency is null);
alter table organization_feature_flags add column if not exists effective_date timestamptz;
alter table organization_feature_flags add column if not exists expiration_date timestamptz;
alter table organization_feature_flags add column if not exists notes text;

comment on column organization_feature_flags.negotiated_price_minor is 'Negotiated price for this org+feature, smallest currency unit. Null means no separate charge (included in plan, or not yet priced).';

-- ----------------------------------------------------------------------------
-- 3. Academy commission - did not exist. One config row per organization
--    (its current negotiated rate), one immutable transaction row per
--    charge (capturing the rate that actually applied at that moment, per
--    "historical transactions must retain the commission rate actually
--    applied at the time" - never derived retroactively from the current
--    config row, which could have changed since).
-- ----------------------------------------------------------------------------
create table if not exists academy_commission_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  commission_percent numeric(5,2) not null check (commission_percent >= 0 and commission_percent <= 100),
  fixed_fee_minor bigint not null default 0 check (fixed_fee_minor >= 0),
  currency text not null default 'USD',
  effective_date timestamptz not null default now(),
  is_active boolean not null default true,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists academy_commission_configs_org_idx
  on academy_commission_configs(organization_id, is_active, effective_date desc);

alter table academy_commission_configs enable row level security;

drop policy if exists acc_select_own_org on academy_commission_configs;
create policy acc_select_own_org on academy_commission_configs for select
  using (organization_id = get_user_organization_id(auth.uid()) or is_super_admin(auth.uid()));

-- Only the platform owner sets commission terms - an academy negotiating
-- its own cut would be an obvious conflict of interest, matching this
-- task's own explicit instruction that commission is platform-configured,
-- not organization-configured.
drop policy if exists acc_write_super_admin on academy_commission_configs;
create policy acc_write_super_admin on academy_commission_configs for all
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

create or replace function get_active_academy_commission(p_org_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('commission_percent', commission_percent, 'fixed_fee_minor', fixed_fee_minor, 'currency', currency)
  from academy_commission_configs
  where organization_id = p_org_id and is_active = true and effective_date <= now()
  order by effective_date desc
  limit 1;
$$;

create table if not exists academy_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  learner_id uuid references user_profiles(id) on delete set null,
  provider text check (provider in ('paystack', 'stripe')),
  provider_reference text,
  currency text not null,
  gross_amount_minor bigint not null check (gross_amount_minor >= 0),
  commission_percent_applied numeric(5,2) not null,
  fixed_fee_minor_applied bigint not null default 0,
  platform_fee_minor bigint not null,
  academy_net_minor bigint not null,
  status text not null default 'completed' check (status in ('completed', 'refunded', 'reversed')),
  created_at timestamptz not null default now(),
  constraint academy_transactions_math check (platform_fee_minor + academy_net_minor = gross_amount_minor)
);

-- Idempotency, same principle as ai_credit_payment_records: the same
-- provider reference can only ever produce one academy_transactions row.
create unique index if not exists academy_transactions_unique_ref
  on academy_transactions(provider, provider_reference) where provider_reference is not null;

create index if not exists academy_transactions_org_idx on academy_transactions(organization_id, created_at desc);

alter table academy_transactions enable row level security;

drop policy if exists at_select_own_org on academy_transactions;
create policy at_select_own_org on academy_transactions for select
  using (
    (organization_id = get_user_organization_id(auth.uid()) and is_org_admin(auth.uid()))
    or learner_id = auth.uid()
    or is_super_admin(auth.uid())
  );

-- Immutable to every ordinary role, including org admins and the academy
-- itself - only ever written by record_academy_transaction() below
-- (service-role-only, same pattern as the AI credit payment ledger).
-- No insert/update/delete policy exists for authenticated at all.

create or replace function record_academy_transaction(
  p_organization_id uuid,
  p_learner_id uuid,
  p_provider text,
  p_provider_reference text,
  p_currency text,
  p_gross_amount_minor bigint
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_config jsonb;
  v_commission_percent numeric(5,2);
  v_fixed_fee_minor bigint;
  v_platform_fee_minor bigint;
  v_academy_net_minor bigint;
  v_id uuid;
begin
  -- Same trust boundary as record_and_grant_ai_credit_payment(): only a
  -- trusted server-side caller (the Edge Function that already verified
  -- this payment against the real provider) may record a financial event,
  -- never an ordinary authenticated client.
  if auth.role() <> 'service_role' then
    raise exception 'This operation is only available through the verified payment flow';
  end if;
  if p_gross_amount_minor <= 0 then
    raise exception 'Gross amount must be positive';
  end if;

  v_config := get_active_academy_commission(p_organization_id);
  if v_config is null then
    raise exception 'No active commission configuration for this organization - platform owner must configure one before this organization can process learner payments';
  end if;
  v_commission_percent := (v_config->>'commission_percent')::numeric(5,2);
  v_fixed_fee_minor := (v_config->>'fixed_fee_minor')::bigint;

  -- Integer arithmetic throughout - no floating-point money math. The
  -- commission is computed once here and stored on the row itself
  -- (commission_percent_applied), never recomputed later from a config
  -- row that may since have changed.
  v_platform_fee_minor := floor(p_gross_amount_minor * v_commission_percent / 100.0) + v_fixed_fee_minor;
  if v_platform_fee_minor > p_gross_amount_minor then
    v_platform_fee_minor := p_gross_amount_minor;
  end if;
  v_academy_net_minor := p_gross_amount_minor - v_platform_fee_minor;

  insert into academy_transactions (
    organization_id, learner_id, provider, provider_reference, currency,
    gross_amount_minor, commission_percent_applied, fixed_fee_minor_applied,
    platform_fee_minor, academy_net_minor
  ) values (
    p_organization_id, p_learner_id, p_provider, p_provider_reference, p_currency,
    p_gross_amount_minor, v_commission_percent, v_fixed_fee_minor,
    v_platform_fee_minor, v_academy_net_minor
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id, 'gross', p_gross_amount_minor, 'platform_fee', v_platform_fee_minor,
    'academy_net', v_academy_net_minor, 'commission_percent', v_commission_percent
  );
exception when unique_violation then
  -- Idempotent replay of the same provider reference - return the
  -- existing record rather than erroring, matching
  -- record_and_grant_ai_credit_payment()'s idempotency shape.
  select jsonb_build_object(
    'id', id, 'gross', gross_amount_minor, 'platform_fee', platform_fee_minor,
    'academy_net', academy_net_minor, 'commission_percent', commission_percent_applied,
    'already_processed', true
  ) into v_config
  from academy_transactions where provider = p_provider and provider_reference = p_provider_reference;
  return v_config;
end;
$$;
