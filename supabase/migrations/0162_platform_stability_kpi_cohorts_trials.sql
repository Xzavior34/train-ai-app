-- ============================================================================
-- Migration: 0162_platform_stability_kpi_cohorts_trials.sql
-- Comprehensive database schema for:
-- 1. Standardized KPI Tracker Activities & Monthly Tracking
-- 2. Enhanced Cohort Lifecycle, Archive & Duration Progress
-- 3. CAP Cohort 3 Six-Week Access Codes & Trial Enforcement
-- 4. CAP Cohort 3 Program Structure (Learn -> Build -> Launch), Teams & Demo Day
-- 5. Structured Mentorship Check-in System & Learner Feedback
-- 6. Tamper-Proof Public Certificate Verification & Template Engine
-- 7. Academy Marketplace, 15% Platform Commission Ledger & Instructor Plans
-- ============================================================================

-- ==========================================
-- 1. KPI ACTIVITIES TRACKER
-- ==========================================
create table if not exists public.kpi_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  title text not null,
  category text not null default 'Operations',
  owner_name text not null default 'Train AI Operations',
  month_year text not null default to_char(current_date, 'YYYY-MM'),
  status text not null default 'In Progress' check (status in ('Not Started', 'In Progress', 'Completed', 'Blocked')),
  progress_percent integer not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  target_metric text,
  current_metric text,
  notes text,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_kpi_activities_org_month on public.kpi_activities(organization_id, month_year);
create index if not exists idx_kpi_activities_status on public.kpi_activities(status);

alter table public.kpi_activities enable row level security;

create policy "KPI activities readable by authenticated" on public.kpi_activities
  for select using (auth.role() = 'authenticated');

create policy "KPI activities editable by admins and staff" on public.kpi_activities
  for all using (
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
      and ur.role in ('super_admin', 'admin', 'trainer', 'manager')
    )
  );

-- ==========================================
-- 2. COHORTS ENHANCEMENTS
-- ==========================================
alter table public.cohorts 
  add column if not exists status text default 'Active' check (status in ('Draft', 'Upcoming', 'Active', 'Completed', 'Archived')),
  add column if not exists is_archived boolean default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists trial_status text default 'none' check (trial_status in ('none', 'active', 'expired')),
  add column if not exists program_name text default 'Training Programme',
  add column if not exists banner_url text;

create index if not exists idx_cohorts_status on public.cohorts(status);

-- RPC for Safe Cohort Delete / Archive
create or replace function delete_or_archive_cohort(p_cohort_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_count integer;
  v_cohort_name text;
begin
  select count(*), coalesce(max(name), 'Cohort')
  into v_member_count, v_cohort_name
  from cohort_members cm
  join cohorts c on c.id = cm.cohort_id
  where cm.cohort_id = p_cohort_id;

  if v_member_count > 0 then
    -- Soft-archive to protect learner history
    update cohorts
    set is_archived = true,
        status = 'Archived',
        updated_at = now()
    where id = p_cohort_id;

    return jsonb_build_object(
      'success', true,
      'action', 'archived',
      'message', format('Cohort "%s" contains %s learner records and has been safely archived.', v_cohort_name, v_member_count)
    );
  else
    -- Safe hard delete for empty cohorts
    delete from cohorts where id = p_cohort_id;

    return jsonb_build_object(
      'success', true,
      'action', 'deleted',
      'message', format('Empty cohort "%s" deleted.', v_cohort_name)
    );
  end if;
end;
$$;

-- RPC for Cohort Duplication
create or replace function duplicate_cohort(p_cohort_id uuid, p_new_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orig cohorts%rowtype;
  v_new_id uuid := gen_random_uuid();
begin
  select * into v_orig from cohorts where id = p_cohort_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Original cohort not found');
  end if;

  insert into cohorts (
    id, name, organization_id, start_date, end_date, status, 
    is_archived, program_name, trial_status, created_at, updated_at
  )
  values (
    v_new_id,
    coalesce(nullif(trim(p_new_name), ''), v_orig.name || ' (Copy)'),
    v_orig.organization_id,
    current_date,
    current_date + interval '42 days', -- Default 6 weeks
    'Draft',
    false,
    v_orig.program_name,
    v_orig.trial_status,
    now(),
    now()
  );

  return jsonb_build_object(
    'success', true,
    'new_cohort_id', v_new_id,
    'name', coalesce(nullif(trim(p_new_name), ''), v_orig.name || ' (Copy)')
  );
end;
$$;

grant execute on function delete_or_archive_cohort(uuid) to authenticated;
grant execute on function duplicate_cohort(uuid, text) to authenticated;

-- ==========================================
-- 3. ACCESS CODES & 6-WEEK TRIAL SYSTEM
-- ==========================================
create table if not exists public.access_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  organization_id uuid references public.organizations(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete set null,
  duration_days integer not null default 42, -- 6 weeks
  start_date timestamptz not null default now(),
  expiration_date timestamptz not null default (now() + interval '90 days'),
  max_redemptions integer not null default 500,
  redemptions_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.access_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  access_code_id uuid references public.access_codes(id) on delete cascade,
  user_id uuid not null,
  organization_id uuid references public.organizations(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete set null,
  trial_started_at timestamptz not null default now(),
  trial_expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked', 'converted')),
  created_at timestamptz not null default now(),
  unique(access_code_id, user_id)
);

create index if not exists idx_access_codes_code on public.access_codes(code);
create index if not exists idx_access_code_redemptions_user on public.access_code_redemptions(user_id);

alter table public.access_codes enable row level security;
alter table public.access_code_redemptions enable row level security;

create policy "Access codes readable by authenticated" on public.access_codes
  for select using (auth.role() = 'authenticated');

create policy "Access codes manageable by staff" on public.access_codes
  for all using (
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
      and ur.role in ('super_admin', 'admin', 'trainer')
    )
  );

create policy "Redemptions readable by owner and staff" on public.access_code_redemptions
  for select using (
    auth.uid() = user_id or
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
      and ur.role in ('super_admin', 'admin', 'trainer')
    )
  );

-- RPC to Redeem an Access Code (Server-Enforced)
create or replace function redeem_access_code(
  p_code text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code_row access_codes%rowtype;
  v_existing_redemption access_code_redemptions%rowtype;
  v_expires_at timestamptz;
  v_user_email text;
begin
  -- Look up code
  select * into v_code_row
  from access_codes
  where upper(trim(code)) = upper(trim(p_code));

  if not found then
    return jsonb_build_object('success', false, 'error', 'Invalid access code.');
  end if;

  if not v_code_row.is_active then
    return jsonb_build_object('success', false, 'error', 'This access code is currently disabled.');
  end if;

  if now() < v_code_row.start_date then
    return jsonb_build_object('success', false, 'error', 'This access code is not active yet.');
  end if;

  if now() > v_code_row.expiration_date then
    return jsonb_build_object('success', false, 'error', 'This access code has expired.');
  end if;

  if v_code_row.redemptions_count >= v_code_row.max_redemptions then
    return jsonb_build_object('success', false, 'error', 'This access code has reached its maximum redemptions limit.');
  end if;

  -- Check if already redeemed
  select * into v_existing_redemption
  from access_code_redemptions
  where access_code_id = v_code_row.id and user_id = p_user_id;

  if found then
    if v_existing_redemption.status = 'active' and now() <= v_existing_redemption.trial_expires_at then
      return jsonb_build_object(
        'success', true,
        'already_redeemed', true,
        'message', 'You already have active trial access with this code.',
        'expires_at', v_existing_redemption.trial_expires_at,
        'cohort_id', v_code_row.cohort_id,
        'organization_id', v_code_row.organization_id
      );
    end if;
  end if;

  v_expires_at := now() + (v_code_row.duration_days || ' days')::interval;

  -- Record redemption
  insert into access_code_redemptions (
    access_code_id, user_id, organization_id, cohort_id, trial_started_at, trial_expires_at, status
  )
  values (
    v_code_row.id, p_user_id, v_code_row.organization_id, v_code_row.cohort_id, now(), v_expires_at, 'active'
  )
  on conflict (access_code_id, user_id)
  do update set
    trial_started_at = now(),
    trial_expires_at = v_expires_at,
    status = 'active';

  -- Increment counter
  update access_codes
  set redemptions_count = redemptions_count + 1
  where id = v_code_row.id;

  -- Link user to Organization if configured
  if v_code_row.organization_id is not null then
    insert into organization_members (organization_id, user_id, role, status, joined_at)
    values (v_code_row.organization_id, p_user_id, 'member', 'active', now())
    on conflict (organization_id, user_id)
    do update set status = 'active';

    update user_profiles
    set organization_id = v_code_row.organization_id
    where id = p_user_id;
  end if;

  -- Link user to Cohort if configured
  if v_code_row.cohort_id is not null then
    insert into cohort_members (cohort_id, user_id, role, joined_at)
    values (v_code_row.cohort_id, p_user_id, 'learner', now())
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'success', true,
    'message', format('Trial access unlocked! Valid for %s weeks until %s.', (v_code_row.duration_days / 7), to_char(v_expires_at, 'Mon DD, YYYY')),
    'expires_at', v_expires_at,
    'cohort_id', v_code_row.cohort_id,
    'organization_id', v_code_row.organization_id,
    'duration_days', v_code_row.duration_days
  );
end;
$$;

grant execute on function redeem_access_code(text, uuid) to authenticated;

-- ==========================================
-- 4. CAP COHORT 3 TEAMS, PROJECTS & DEMO DAY
-- ==========================================
create table if not exists public.cap_teams (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references public.cohorts(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  project_title text,
  problem_statement text,
  technologies text[] default '{}',
  github_url text,
  demo_url text,
  presentation_url text,
  demo_video_url text,
  screenshot_url text,
  mentor_id uuid,
  phase text not null default 'LEARN' check (phase in ('LEARN', 'BUILD', 'LAUNCH')),
  demo_day_status text not null default 'Draft' check (demo_day_status in ('Draft', 'Pending Review', 'Needs Changes', 'Demo Day Ready', 'Featured')),
  final_score numeric(4,2) default 0.0,
  judges_feedback text,
  mentor_feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cap_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.cap_teams(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'Software Engineer' check (role in ('Product Manager', 'Software Engineer', 'Data Analyst', 'UI/UX Designer', 'Other')),
  joined_at timestamptz not null default now(),
  unique(team_id, user_id)
);

create index if not exists idx_cap_teams_cohort on public.cap_teams(cohort_id);
create index if not exists idx_cap_team_members_user on public.cap_team_members(user_id);

alter table public.cap_teams enable row level security;
alter table public.cap_team_members enable row level security;

create policy "CAP teams readable by authenticated" on public.cap_teams
  for select using (auth.role() = 'authenticated');

create policy "CAP teams editable by staff and team members" on public.cap_teams
  for all using (
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
      and ur.role in ('super_admin', 'admin', 'trainer', 'mentor')
    ) or exists (
      select 1 from public.cap_team_members ctm 
      where ctm.team_id = id and ctm.user_id = auth.uid()
    )
  );

create policy "CAP team members readable by authenticated" on public.cap_team_members
  for select using (auth.role() = 'authenticated');

create policy "CAP team members manageable by staff and team members" on public.cap_team_members
  for all using (
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
      and ur.role in ('super_admin', 'admin', 'trainer', 'mentor')
    ) or user_id = auth.uid()
  );

-- ==========================================
-- 5. MENTORSHIP CHECK-IN SYSTEM
-- ==========================================
create table if not exists public.mentorship_checkins (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.cap_teams(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete set null,
  mentor_id uuid not null,
  checkin_date date not null default current_date,
  notes text not null,
  progress_rating integer not null default 4 check (progress_rating between 1 and 5),
  issues_blockers text,
  recommended_actions text,
  next_checkin_date date,
  is_private_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_mentorship_checkins_team on public.mentorship_checkins(team_id);
create index if not exists idx_mentorship_checkins_mentor on public.mentorship_checkins(mentor_id);

alter table public.mentorship_checkins enable row level security;

create policy "Mentorship checkins readable" on public.mentorship_checkins
  for select using (
    (not is_private_admin) or 
    mentor_id = auth.uid() or
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
      and ur.role in ('super_admin', 'admin')
    )
  );

create policy "Mentorship checkins editable by mentor and admin" on public.mentorship_checkins
  for all using (
    mentor_id = auth.uid() or
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
      and ur.role in ('super_admin', 'admin', 'trainer')
    )
  );

-- ==========================================
-- 6. PUBLIC CERTIFICATE VERIFICATION & TEMPLATES
-- ==========================================
alter table public.certificates
  add column if not exists certificate_code text unique,
  add column if not exists template_type text default 'train_ai_default' check (template_type in ('train_ai_default', 'organization_custom')),
  add column if not exists custom_template_url text,
  add column if not exists trigger_source text default 'course_completed',
  add column if not exists is_revoked boolean default false,
  add column if not exists revoked_reason text;

create or replace function verify_public_certificate(p_certificate_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cert record;
begin
  select 
    c.id,
    c.certificate_code,
    coalesce(up.display_name, 'Certified Learner') as recipient_name,
    coalesce(co.name, 'Train AI Programme') as course_name,
    coalesce(org.name, 'Train AI Academy') as organization_name,
    c.issued_at,
    c.is_revoked,
    c.revoked_reason,
    c.template_type
  into v_cert
  from certificates c
  left join user_profiles up on up.id = c.user_id
  left join courses co on co.id = c.course_id
  left join organizations org on org.id = c.organization_id
  where upper(trim(c.certificate_code)) = upper(trim(p_certificate_code))
     or c.id::text = trim(p_certificate_code);

  if not found then
    return jsonb_build_object('verified', false, 'error', 'Certificate not found or identifier invalid.');
  end if;

  if v_cert.is_revoked then
    return jsonb_build_object(
      'verified', false,
      'is_revoked', true,
      'reason', coalesce(v_cert.revoked_reason, 'This certificate has been revoked by the issuing authority.'),
      'issued_at', v_cert.issued_at
    );
  end if;

  return jsonb_build_object(
    'verified', true,
    'certificate_code', v_cert.certificate_code,
    'recipient_name', v_cert.recipient_name,
    'course_name', v_cert.course_name,
    'organization_name', v_cert.organization_name,
    'issued_at', v_cert.issued_at,
    'template_type', v_cert.template_type
  );
end;
$$;

grant execute on function verify_public_certificate(text) to anon, authenticated;

-- ==========================================
-- 7. ACADEMY MARKETPLACE & 15% COMMISSION
-- ==========================================
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
  academy_id uuid references public.marketplace_academies(id) on delete cascade,
  title text not null,
  slug text,
  description text,
  category text not null default 'Artificial Intelligence',
  skill_level text not null default 'Beginner',
  thumbnail_url text,
  price_amount integer not null default 0, -- Cents / minor unit
  currency text not null default 'USD',
  status text not null default 'Draft' check (status in ('Draft', 'Pending Review', 'Published', 'Unpublished', 'Archived')),
  platform_commission_percent numeric(4,2) not null default 15.00,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_purchases (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.marketplace_courses(id) on delete cascade,
  academy_id uuid references public.marketplace_academies(id) on delete cascade,
  user_id uuid not null,
  gross_amount integer not null, -- Cents
  platform_fee_amount integer not null, -- 15% in Cents
  instructor_revenue_amount integer not null, -- 85% in Cents
  currency text not null default 'USD',
  payment_provider_tx_id text,
  settlement_status text not null default 'pending' check (settlement_status in ('pending', 'settled', 'refunded')),
  created_at timestamptz not null default now()
);

create index if not exists idx_marketplace_courses_status on public.marketplace_courses(status);
create index if not exists idx_marketplace_purchases_user on public.marketplace_purchases(user_id);

alter table public.marketplace_academies enable row level security;
alter table public.marketplace_courses enable row level security;
alter table public.marketplace_purchases enable row level security;

create policy "Marketplace academies public" on public.marketplace_academies
  for select using (true);

create policy "Marketplace courses public view" on public.marketplace_courses
  for select using (status = 'Published' or auth.role() = 'authenticated');

create policy "Marketplace purchases user and staff" on public.marketplace_purchases
  for select using (
    user_id = auth.uid() or
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
      and ur.role in ('super_admin', 'admin')
    )
  );
