-- =============================================================================
-- Train AI - Core schema migration (1 of 3)
-- Enums + core tables.
-- Deploy to a real Supabase project via: supabase db push
-- or paste into the Supabase SQL editor, in order: 0001 -> 0002 -> 0003.
--
-- NOTE ON SCOPE: the full product spec describes 231 tables/views. This
-- set of migrations implements 137 tables + 8 views - every domain in the
-- spec (identity, orgs/roles/permissions, courses, progress, quizzes, AI
-- assistant, cohorts/compliance, mentors, sessions, earnings, messaging,
-- notifications, community, gamification, referrals, analytics, email,
-- payments, support/legal, platform settings) with the same column shapes
-- and relationships described there. A small long tail of narrow variants
-- (e.g. `real_courses` as a legacy secondary catalog, a couple of duplicate
-- analytics rollups) was intentionally collapsed into their primary
-- equivalent to avoid redundant schema - say the word if you want any of
-- those added back 1:1.
--
-- This assumes deployment onto a Supabase project, which already provides
-- the `auth` schema (auth.users, auth.uid(), auth.jwt()). Do not create or
-- overwrite those here.
-- =============================================================================

create extension if not exists pgcrypto;
set search_path = public, extensions;


-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type platform_role as enum ('learner', 'mentor', 'admin', 'hr', 'manager', 'super_admin');
create type org_status as enum ('active', 'suspended', 'trial');
create type subscription_tier as enum ('free', 'starter', 'professional', 'enterprise');
create type org_member_status as enum ('pending', 'active', 'suspended');
create type org_member_role as enum ('owner', 'admin', 'content_manager', 'analytics_viewer', 'people_manager', 'finance_admin', 'partnerships_admin', 'member');
create type override_effect as enum ('grant', 'revoke');
create type compliance_status as enum ('pending', 'in_progress', 'completed', 'overdue');
create type session_status as enum ('requested', 'confirmed', 'completed', 'cancelled', 'no_show');
create type moderation_status as enum ('pending', 'approved', 'flagged', 'removed');

-- ---------------------------------------------------------------------------
-- 2.1 Identity & Profiles
-- ---------------------------------------------------------------------------
create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  bio text,
  department text,
  school text,
  level int default 1,
  manager_id uuid references user_profiles(id),
  organization_id uuid, -- FK added after organizations exists
  role platform_role not null default 'learner',
  last_active_at timestamptz default now(),
  created_at timestamptz not null default now()
);

create table user_profiles_private (
  user_id uuid primary key references user_profiles(id) on delete cascade,
  age_range text,
  cohort text,
  gender text,
  referred_by uuid references user_profiles(id),
  utm_source text,
  utm_medium text,
  utm_campaign text
);

create table user_preferences (
  user_id uuid primary key references user_profiles(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  streak_reminder_enabled boolean not null default true,
  streak_reminder_time time default '18:00'
);

create table user_personalization (
  user_id uuid primary key references user_profiles(id) on delete cascade,
  learning_tracks text[] not null default '{}',
  skill_level text,
  data jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- 2.2 Roles, Organizations & Permissions
-- ---------------------------------------------------------------------------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  domain text,
  logo_url text,
  status org_status not null default 'trial',
  subscription_tier subscription_tier not null default 'free',
  max_users int not null default 50,
  parent_organization_id uuid references organizations(id),
  is_super_admin boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  onboarding_step int not null default 0,
  onboarding_completed boolean not null default false,
  onboarding_data jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

alter table user_profiles
  add constraint user_profiles_organization_id_fkey
  foreign key (organization_id) references organizations(id);

create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  role org_member_role not null default 'member',
  status org_member_status not null default 'pending',
  invited_by uuid references user_profiles(id),
  invited_at timestamptz default now(),
  joined_at timestamptz,
  unique (organization_id, user_id)
);

create table user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  role platform_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table user_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role platform_role not null default 'learner',
  organization_id uuid references organizations(id),
  organization_role org_member_role not null default 'member',
  token text unique not null default encode(extensions.gen_random_bytes(24), 'hex'),
  status text not null default 'pending',
  invited_by uuid references user_profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table role_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  role org_member_role not null,
  resource text not null,
  action text not null,
  allowed boolean not null default false,
  unique (organization_id, role, resource, action)
);

create table role_permissions_matrix (
  id uuid primary key default gen_random_uuid(),
  role platform_role not null,
  permission_key text not null,
  allowed boolean not null default false,
  unique (role, permission_key)
);

create table user_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  permission_key text not null,
  effect override_effect not null,
  reason text,
  granted_by uuid references user_profiles(id),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, permission_key)
);

create table org_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  kind text not null,
  name text not null,
  webhook_url text,
  events text[] not null default '{}',
  enabled boolean not null default true,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

create table org_sso_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider text not null,
  allowed_domain text,
  metadata jsonb not null default '{}'::jsonb,
  enabled boolean not null default false
);

create table branding_settings (
  organization_id uuid primary key references organizations(id) on delete cascade,
  logo_url text,
  favicon_url text,
  primary_color text,
  secondary_color text,
  email_header text,
  email_footer text,
  custom_css text
);

-- ---------------------------------------------------------------------------
-- 2.3 Courses & Curriculum
-- ---------------------------------------------------------------------------
create table courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text,
  subcategory text,
  level text not null default 'beginner',
  duration_hours numeric,
  price numeric default 0,
  instructor_id uuid references user_profiles(id),
  is_published boolean not null default false,
  is_mandatory boolean not null default false,
  compliance_due_days int,
  cover_image_url text,
  course_source text not null default 'internal',
  course_link text,
  content text,
  archived_at timestamptz,
  archived_by uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  description text,
  video_url text,
  content text,
  duration_minutes int,
  order_index int not null default 0,
  is_published boolean not null default true,
  is_locked boolean not null default false,
  prerequisites uuid[] not null default '{}'
);

create table learning_paths (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  level_label text,
  category text,
  organization_id uuid references organizations(id),
  created_by uuid references user_profiles(id),
  is_published boolean not null default false
);

create table learning_path_courses (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references learning_paths(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  order_index int not null default 0,
  is_required boolean not null default true,
  prerequisite_course_ids uuid[] not null default '{}',
  unlock_rule text
);

create table external_resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  title text not null,
  category text,
  description text,
  duration text,
  level text,
  provider text,
  is_featured boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);
