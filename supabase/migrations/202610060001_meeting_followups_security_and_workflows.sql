-- Meeting follow-ups: safe organisation join approvals, cohort lifecycle,
-- CAP trial redemption, and independent-academy ownership boundaries.

begin;

alter table public.organizations
  add column if not exists require_join_approval boolean not null default true;

alter table public.cohorts
  add column if not exists status text default 'Active',
  add column if not exists is_archived boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists trial_status text not null default 'none',
  add column if not exists program_name text not null default 'Training Programme',
  add column if not exists banner_url text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.org_promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  tier text not null default 'starter',
  grant_ai_credits integer not null default 1000 check (grant_ai_credits >= 0),
  grant_seats integer not null default 50 check (grant_seats > 0),
  max_redemptions integer not null default 100 check (max_redemptions > 0),
  redemptions_count integer not null default 0 check (redemptions_count >= 0),
  is_active boolean not null default true,
  organization_type text not null default 'foundation',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.org_promo_codes enable row level security;
revoke insert, update, delete on public.org_promo_codes from anon, authenticated;

insert into public.org_promo_codes (
  code, name, tier, grant_ai_credits, grant_seats, max_redemptions,
  is_active, organization_type, expires_at
) values
  ('SARA-FOUNDATION', 'Sara Foundation Africa Social Impact Grant', 'starter', 1000, 50, 100, true, 'foundation', now() + interval '1 year'),
  ('CAP3-FOUNDATION', 'CAP Cohort 3 Foundation Sponsor', 'starter', 1000, 50, 100, true, 'foundation', now() + interval '1 year')
on conflict (code) do update set
  grant_ai_credits = excluded.grant_ai_credits,
  grant_seats = excluded.grant_seats,
  is_active = true,
  updated_at = now();

create or replace function public.validate_org_promo_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_code public.org_promo_codes%rowtype;
begin
  select * into v_code from public.org_promo_codes where upper(code) = upper(trim(p_code));
  if not found or not v_code.is_active then return jsonb_build_object('valid', false, 'error', 'Invalid Foundation Code.'); end if;
  if v_code.expires_at is not null and v_code.expires_at <= now() then return jsonb_build_object('valid', false, 'error', 'This Foundation Code has expired.'); end if;
  if v_code.redemptions_count >= v_code.max_redemptions then return jsonb_build_object('valid', false, 'error', 'This Foundation Code has reached its redemption limit.'); end if;
  return jsonb_build_object('valid', true, 'code', v_code.code, 'name', v_code.name, 'tier', v_code.tier, 'grant_ai_credits', v_code.grant_ai_credits, 'grant_seats', v_code.grant_seats, 'organization_type', v_code.organization_type);
end;
$$;

grant execute on function public.validate_org_promo_code(text) to anon, authenticated;

-- Client-supplied payment references are not accepted as proof of payment.
-- Until the payment verification edge function provisions the organisation,
-- this self-serve RPC is deliberately limited to controlled grant codes.
create or replace function public.create_organization_with_code_or_payment(
  p_org_name text,
  p_promo_code text default null,
  p_payment_ref text default null,
  p_payment_provider text default 'verified_payment'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code public.org_promo_codes%rowtype;
  v_org_id uuid;
  v_credit_account uuid;
begin
  if v_user_id is null then raise exception 'You must be signed in to create an organization'; end if;
  if p_org_name is null or length(trim(p_org_name)) < 2 then raise exception 'Organization name must be at least 2 characters'; end if;
  if p_promo_code is null or trim(p_promo_code) = '' then
    return jsonb_build_object('success', false, 'error', 'A verified payment or valid Foundation Code is required. Client-supplied payment references are not accepted.');
  end if;

  select * into v_code from public.org_promo_codes
  where upper(code) = upper(trim(p_promo_code)) for update;
  if not found or not v_code.is_active or (v_code.expires_at is not null and v_code.expires_at <= now()) then
    return jsonb_build_object('success', false, 'error', 'The Foundation Code is invalid or expired.');
  end if;
  if v_code.redemptions_count >= v_code.max_redemptions then
    return jsonb_build_object('success', false, 'error', 'The Foundation Code has reached its redemption limit.');
  end if;

  v_org_id := public.create_organization_self_serve(trim(p_org_name));
  update public.organizations
  set status = 'active', subscription_tier = 'starter', max_users = greatest(max_users, v_code.grant_seats)
  where id = v_org_id;
  update public.org_promo_codes set redemptions_count = redemptions_count + 1, updated_at = now() where id = v_code.id;

  if v_code.grant_ai_credits > 0 and to_regclass('public.ai_credit_accounts') is not null then
    v_credit_account := public.get_or_create_org_credit_account(v_org_id);
    perform public.grant_ai_credits(v_credit_account, v_code.grant_ai_credits, 'top_up', 'foundation_grant:' || v_code.code);
  end if;

  return jsonb_build_object(
    'success', true,
    'organization_id', v_org_id,
    'tier', 'starter',
    'status', 'active',
    'seats', v_code.grant_seats,
    'ai_credits', v_code.grant_ai_credits,
    'is_free_grant', true
  );
end;
$$;

grant execute on function public.create_organization_with_code_or_payment(text, text, text, text) to authenticated;

-- Shareable organisation links always create a learner request. They never
-- grant a privileged role or consume a seat before an admin approves it.
create or replace function public.join_organization_by_invite(
  p_org_target text,
  p_role platform_role default 'learner'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org public.organizations%rowtype;
  v_existing_status org_member_status;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'You must be signed in to request access.');
  end if;
  if p_org_target is null or trim(p_org_target) = '' then
    return jsonb_build_object('success', false, 'error', 'Organization identifier is required.');
  end if;

  if p_org_target ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into v_org from public.organizations where id = p_org_target::uuid;
  else
    select * into v_org from public.organizations where slug = lower(trim(p_org_target));
  end if;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Organization not found.');
  end if;

  select status into v_existing_status
  from public.organization_members
  where organization_id = v_org.id and user_id = v_user_id;

  if v_existing_status = 'active' then
    return jsonb_build_object(
      'success', true,
      'already_member', true,
      'pending_approval', false,
      'organization_id', v_org.id,
      'organization_name', v_org.name,
      'slug', v_org.slug
    );
  end if;

  insert into public.organization_members (
    organization_id, user_id, role, status, invited_at, joined_at
  ) values (
    v_org.id, v_user_id, 'member', 'pending', now(), null
  )
  on conflict (organization_id, user_id) do update
    set role = 'member', status = 'pending', invited_at = now(), joined_at = null;

  return jsonb_build_object(
    'success', true,
    'pending_approval', true,
    'status', 'pending',
    'message', 'Your request was sent to the organization administrator.',
    'organization_id', v_org.id,
    'organization_name', v_org.name,
    'slug', v_org.slug
  );
end;
$$;

grant execute on function public.join_organization_by_invite(text, platform_role) to authenticated;
revoke execute on function public.join_organization_by_invite(text, platform_role) from anon;

create or replace function public.approve_organization_member(p_org_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_profile_org uuid;
begin
  if v_caller is null or not (
    public.is_super_admin(v_caller)
    or exists (
      select 1 from public.organization_members om
      where om.organization_id = p_org_id and om.user_id = v_caller
        and om.role in ('owner', 'admin') and om.status = 'active'
    )
  ) then
    raise exception 'Not authorized to approve members for this organization';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text, 0));
  if not public.check_seat_available(p_org_id) then
    return jsonb_build_object('success', false, 'error', 'No seats are available. Purchase another seat before approving this request.');
  end if;

  if not exists (
    select 1 from public.organization_members
    where organization_id = p_org_id and user_id = p_user_id and status = 'pending'
  ) then
    return jsonb_build_object('success', false, 'error', 'This pending request no longer exists.');
  end if;

  select organization_id into v_profile_org from public.user_profiles where id = p_user_id;
  if v_profile_org is not null and v_profile_org <> p_org_id then
    return jsonb_build_object('success', false, 'error', 'This learner already belongs to another organization.');
  end if;

  update public.organization_members
  set status = 'active', joined_at = now()
  where organization_id = p_org_id and user_id = p_user_id and status = 'pending';

  update public.user_profiles set organization_id = p_org_id where id = p_user_id;
  insert into public.user_roles (user_id, role) values (p_user_id, 'learner')
  on conflict (user_id, role) do nothing;

  return jsonb_build_object('success', true, 'organization_id', p_org_id, 'user_id', p_user_id);
end;
$$;

create or replace function public.reject_organization_member(p_org_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null or not (
    public.is_super_admin(v_caller)
    or exists (
      select 1 from public.organization_members om
      where om.organization_id = p_org_id and om.user_id = v_caller
        and om.role in ('owner', 'admin') and om.status = 'active'
    )
  ) then
    raise exception 'Not authorized to decline members for this organization';
  end if;

  delete from public.organization_members
  where organization_id = p_org_id and user_id = p_user_id and status = 'pending';

  return jsonb_build_object('success', true, 'organization_id', p_org_id, 'user_id', p_user_id);
end;
$$;

grant execute on function public.approve_organization_member(uuid, uuid) to authenticated;
grant execute on function public.reject_organization_member(uuid, uuid) to authenticated;

-- Cohort deletion and duplication must be limited to the owning organisation.
create or replace function public.delete_or_archive_cohort(p_cohort_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_org_id uuid;
  v_member_count integer;
  v_cohort_name text;
begin
  select organization_id, name into v_org_id, v_cohort_name
  from public.cohorts where id = p_cohort_id for update;
  if not found then return jsonb_build_object('success', false, 'error', 'Cohort not found.'); end if;

  if v_caller is null or not (
    public.is_super_admin(v_caller)
    or exists (
      select 1 from public.organization_members om
      where om.organization_id = v_org_id and om.user_id = v_caller
        and om.role in ('owner', 'admin') and om.status = 'active'
    )
  ) then raise exception 'Not authorized to manage this cohort'; end if;

  select count(*) into v_member_count
  from public.cohort_members cm
  join public.user_profiles up on up.id = cm.user_id
  where cm.cohort_id = p_cohort_id and up.role = 'learner';
  if v_member_count > 0 then
    update public.cohorts set is_archived = true, status = 'Archived', deleted_at = now()
    where id = p_cohort_id;
    return jsonb_build_object('success', true, 'action', 'archived', 'message', format('Cohort "%s" contains %s learner records and was archived.', v_cohort_name, v_member_count));
  end if;

  delete from public.cohorts where id = p_cohort_id;
  return jsonb_build_object('success', true, 'action', 'deleted', 'message', format('Empty cohort "%s" deleted.', v_cohort_name));
end;
$$;

create or replace function public.duplicate_cohort(p_cohort_id uuid, p_new_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_orig public.cohorts%rowtype;
  v_new_id uuid := gen_random_uuid();
begin
  select * into v_orig from public.cohorts where id = p_cohort_id;
  if not found then return jsonb_build_object('success', false, 'error', 'Original cohort not found.'); end if;
  if v_caller is null or not (
    public.is_super_admin(v_caller)
    or exists (
      select 1 from public.organization_members om
      where om.organization_id = v_orig.organization_id and om.user_id = v_caller
        and om.role in ('owner', 'admin') and om.status = 'active'
    )
  ) then raise exception 'Not authorized to duplicate this cohort'; end if;

  insert into public.cohorts (
    id, name, organization_id, starts_at, ends_at, status, is_archived,
    program_name, trial_status, created_by
  ) values (
    v_new_id,
    coalesce(nullif(trim(p_new_name), ''), v_orig.name || ' (Copy)'),
    v_orig.organization_id, current_date, current_date + 42, 'Draft', false,
    v_orig.program_name, v_orig.trial_status, v_caller
  );
  return jsonb_build_object('success', true, 'new_cohort_id', v_new_id, 'name', coalesce(nullif(trim(p_new_name), ''), v_orig.name || ' (Copy)'));
end;
$$;

grant execute on function public.delete_or_archive_cohort(uuid) to authenticated;
grant execute on function public.duplicate_cohort(uuid, text) to authenticated;

-- Independent academy ownership and instructor-only access model.
create table if not exists public.marketplace_academies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  description text,
  instructor_seat_limit integer not null default 1,
  instructor_plan text not null default '1-instructor',
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_courses (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.marketplace_academies(id) on delete cascade,
  title text not null,
  slug text unique,
  description text,
  category text not null default 'Artificial Intelligence',
  skill_level text not null default 'Beginner',
  thumbnail_url text,
  price_amount integer not null default 0 check (price_amount >= 0),
  currency text not null default 'USD',
  status text not null default 'Draft' check (status in ('Draft', 'Pending Review', 'Published', 'Unpublished', 'Archived')),
  platform_commission_percent numeric(4,2) not null default 15.00 check (platform_commission_percent between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_purchases (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.marketplace_courses(id) on delete restrict,
  academy_id uuid not null references public.marketplace_academies(id) on delete restrict,
  user_id uuid not null references public.user_profiles(id),
  gross_amount integer not null check (gross_amount >= 0),
  platform_fee_amount integer not null check (platform_fee_amount >= 0),
  instructor_revenue_amount integer not null check (instructor_revenue_amount >= 0),
  currency text not null default 'USD',
  payment_provider_tx_id text unique not null,
  settlement_status text not null default 'pending' check (settlement_status in ('pending', 'settled', 'refunded')),
  created_at timestamptz not null default now()
);

alter table public.marketplace_academies enable row level security;
alter table public.marketplace_courses enable row level security;
alter table public.marketplace_purchases enable row level security;

alter table public.marketplace_academies
  add column if not exists owner_user_id uuid references public.user_profiles(id),
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists plan_status text not null default 'pending'
    check (plan_status in ('pending', 'active', 'past_due', 'cancelled')),
  add column if not exists plan_started_at timestamptz;

drop policy if exists "Marketplace academies public" on public.marketplace_academies;
drop policy if exists marketplace_academies_public_or_owner on public.marketplace_academies;
create policy marketplace_academies_public_or_owner on public.marketplace_academies
  for select using (is_verified or owner_user_id = auth.uid() or public.is_super_admin(auth.uid()));
drop policy if exists marketplace_academies_owner_update on public.marketplace_academies;
create policy marketplace_academies_owner_update on public.marketplace_academies
  for update using (owner_user_id = auth.uid() or public.is_super_admin(auth.uid()))
  with check (owner_user_id = auth.uid() or public.is_super_admin(auth.uid()));

drop policy if exists "Marketplace courses public view" on public.marketplace_courses;
drop policy if exists marketplace_courses_public_view on public.marketplace_courses;
create policy marketplace_courses_public_view on public.marketplace_courses
  for select using (
    status = 'Published'
    or exists (select 1 from public.marketplace_academies a where a.id = academy_id and a.owner_user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists marketplace_courses_academy_owner_write on public.marketplace_courses;
create policy marketplace_courses_academy_owner_write on public.marketplace_courses
  for all using (
    exists (select 1 from public.marketplace_academies a where a.id = academy_id and (a.owner_user_id = auth.uid() or public.is_super_admin(auth.uid())))
  ) with check (
    exists (select 1 from public.marketplace_academies a where a.id = academy_id and a.plan_status = 'active' and (a.owner_user_id = auth.uid() or public.is_super_admin(auth.uid())))
  );

revoke insert, update, delete on public.marketplace_purchases from anon, authenticated;
drop policy if exists "Marketplace purchases user and staff" on public.marketplace_purchases;
drop policy if exists marketplace_purchases_read on public.marketplace_purchases;
create policy marketplace_purchases_read on public.marketplace_purchases
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.marketplace_academies a where a.id = academy_id and a.owner_user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

-- CAP trial redemption is always for the signed-in user and writes the real
-- cohort_members columns. The access-code row is locked to prevent overuse.
create table if not exists public.access_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  organization_id uuid references public.organizations(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete set null,
  duration_days integer not null default 42 check (duration_days > 0),
  start_date timestamptz not null default now(),
  expiration_date timestamptz not null default (now() + interval '90 days'),
  max_redemptions integer not null default 500 check (max_redemptions > 0),
  redemptions_count integer not null default 0 check (redemptions_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.access_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  access_code_id uuid not null references public.access_codes(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete set null,
  trial_started_at timestamptz not null default now(),
  trial_expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked', 'converted')),
  created_at timestamptz not null default now(),
  unique(access_code_id, user_id)
);

alter table public.access_codes enable row level security;
alter table public.access_code_redemptions enable row level security;

insert into public.access_codes (
  code, name, organization_id, cohort_id, duration_days, start_date,
  expiration_date, max_redemptions, is_active
)
select
  'CAP3-2026',
  'CAP Cohort 3 Six-Week Sponsored Access',
  org.id,
  cohort.id,
  42,
  now(),
  now() + interval '180 days',
  500,
  true
from (select id from public.organizations where name ilike '%Sara Foundation%' order by created_at limit 1) org
left join lateral (
  select id from public.cohorts
  where organization_id = org.id and name ilike '%CAP%Cohort%3%'
  order by starts_at desc nulls last limit 1
) cohort on true
on conflict (code) do update set
  name = excluded.name,
  organization_id = coalesce(excluded.organization_id, public.access_codes.organization_id),
  cohort_id = coalesce(excluded.cohort_id, public.access_codes.cohort_id),
  duration_days = 42,
  is_active = true;

insert into public.access_codes (
  code, name, duration_days, start_date, expiration_date, max_redemptions, is_active
) values (
  'CAP3-2026', 'CAP Cohort 3 Six-Week Sponsored Access', 42, now(), now() + interval '180 days', 500, true
)
on conflict (code) do nothing;

drop policy if exists access_codes_admin_read on public.access_codes;
create policy access_codes_admin_read on public.access_codes for select using (
  public.is_super_admin(auth.uid())
  or exists (
    select 1 from public.organization_members om
    where om.organization_id = access_codes.organization_id and om.user_id = auth.uid()
      and om.role in ('owner', 'admin') and om.status = 'active'
  )
);
drop policy if exists access_codes_admin_write on public.access_codes;
create policy access_codes_admin_write on public.access_codes for all using (
  public.is_super_admin(auth.uid())
  or exists (
    select 1 from public.organization_members om
    where om.organization_id = access_codes.organization_id and om.user_id = auth.uid()
      and om.role in ('owner', 'admin') and om.status = 'active'
  )
) with check (
  public.is_super_admin(auth.uid())
  or exists (
    select 1 from public.organization_members om
    where om.organization_id = access_codes.organization_id and om.user_id = auth.uid()
      and om.role in ('owner', 'admin') and om.status = 'active'
  )
);
drop policy if exists access_redemptions_owner_or_admin_read on public.access_code_redemptions;
create policy access_redemptions_owner_or_admin_read on public.access_code_redemptions for select using (
  user_id = auth.uid()
  or public.is_super_admin(auth.uid())
  or exists (
    select 1 from public.organization_members om
    where om.organization_id = access_code_redemptions.organization_id and om.user_id = auth.uid()
      and om.role in ('owner', 'admin') and om.status = 'active'
  )
);

create or replace function public.redeem_access_code(p_code text, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code public.access_codes%rowtype;
  v_existing public.access_code_redemptions%rowtype;
  v_expires_at timestamptz;
begin
  if v_user_id is null or p_user_id is distinct from v_user_id then
    raise exception 'Access codes can only be redeemed for the signed-in account';
  end if;

  select * into v_code from public.access_codes
  where upper(trim(code)) = upper(trim(p_code)) for update;
  if not found then return jsonb_build_object('success', false, 'error', 'Invalid access code.'); end if;
  if not v_code.is_active then return jsonb_build_object('success', false, 'error', 'This access code is disabled.'); end if;
  if now() < v_code.start_date then return jsonb_build_object('success', false, 'error', 'This access code is not active yet.'); end if;
  if now() > v_code.expiration_date then return jsonb_build_object('success', false, 'error', 'This access code has expired.'); end if;

  select * into v_existing from public.access_code_redemptions
  where access_code_id = v_code.id and user_id = v_user_id;
  if found and v_existing.status = 'active' and now() <= v_existing.trial_expires_at then
    return jsonb_build_object('success', true, 'already_redeemed', true, 'message', 'Your six-week access is already active.', 'expires_at', v_existing.trial_expires_at, 'cohort_id', v_code.cohort_id, 'organization_id', v_code.organization_id);
  end if;

  if v_code.redemptions_count >= v_code.max_redemptions then
    return jsonb_build_object('success', false, 'error', 'This access code has reached its redemption limit.');
  end if;

  v_expires_at := now() + make_interval(days => v_code.duration_days);
  insert into public.access_code_redemptions (
    access_code_id, user_id, organization_id, cohort_id, trial_started_at, trial_expires_at, status
  ) values (v_code.id, v_user_id, v_code.organization_id, v_code.cohort_id, now(), v_expires_at, 'active')
  on conflict (access_code_id, user_id) do update
    set trial_started_at = now(), trial_expires_at = excluded.trial_expires_at, status = 'active';

  update public.access_codes set redemptions_count = redemptions_count + 1 where id = v_code.id;

  if v_code.organization_id is not null then
    insert into public.organization_members (organization_id, user_id, role, status, joined_at)
    values (v_code.organization_id, v_user_id, 'member', 'active', now())
    on conflict (organization_id, user_id) do update set status = 'active', joined_at = now();
    update public.user_profiles set organization_id = v_code.organization_id where id = v_user_id;
  end if;

  if v_code.cohort_id is not null then
    insert into public.cohort_members (cohort_id, user_id, added_by, added_at)
    values (v_code.cohort_id, v_user_id, v_user_id, now())
    on conflict (cohort_id, user_id) do nothing;
  end if;

  return jsonb_build_object(
    'success', true,
    'message', format('Six-week access is active until %s.', to_char(v_expires_at, 'Mon DD, YYYY')),
    'expires_at', v_expires_at,
    'cohort_id', v_code.cohort_id,
    'organization_id', v_code.organization_id,
    'duration_days', v_code.duration_days
  );
end;
$$;

grant execute on function public.redeem_access_code(text, uuid) to authenticated;

commit;
