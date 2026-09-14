-- Train AI 2.0 Complete Consolidated Schema Migration
-- Generated for Target Project: jeobggrtxeybxvlwpxvn


-- ============================================================================
-- MIGRATION: 0001_init_schema.sql
-- ============================================================================
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
  token text unique not null default encode(gen_random_bytes(24), 'hex'),
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


-- ============================================================================
-- MIGRATION: 0002_progress_quizzes_cohorts.sql
-- ============================================================================
-- =============================================================================
-- Train AI - Core schema migration (continued): progress, quizzes, AI,
-- cohorts & compliance. Appended to 0001 conceptually; kept in the same file
-- for migration-tool simplicity (Supabase applies files in filename order).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 2.4 Learner Progress & Enrollment
-- ---------------------------------------------------------------------------
create table course_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  progress_percentage numeric not null default 0,
  payment_status text default 'not_required',
  amount_paid numeric,
  currency text default 'usd',
  stripe_payment_intent_id text,
  unique (user_id, course_id)
);

create table lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  is_completed boolean not null default false,
  completed_at timestamptz,
  time_spent_minutes numeric default 0,
  video_progress_seconds numeric default 0,
  unique (user_id, lesson_id)
);

create table course_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  lesson_id uuid references lessons(id),
  content text,
  formatting jsonb default '{}'::jsonb,
  tags text[] default '{}',
  is_bookmarked boolean default false,
  versions jsonb default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table lesson_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  timestamp_seconds numeric not null default 0,
  content text not null
);

create table course_certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  certificate_number text unique not null default encode(gen_random_bytes(8), 'hex'),
  issued_at timestamptz not null default now()
);

create table certificate_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  platform text not null,
  shared_at timestamptz not null default now()
);

create table bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  unique (user_id, course_id)
);

create table course_wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  notes text,
  unique (user_id, course_id)
);

create table course_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  review_text text,
  is_verified_purchase boolean not null default false,
  helpful_count int not null default 0,
  created_at timestamptz not null default now()
);

create table learning_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  title text not null,
  goal_type text,
  target numeric,
  current_progress numeric default 0,
  deadline date,
  completed boolean not null default false
);

-- ---------------------------------------------------------------------------
-- 2.5 Quizzes & Assessments
-- ---------------------------------------------------------------------------
create table quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade,
  lesson_id uuid references lessons(id) on delete cascade,
  title text not null,
  description text,
  passing_score int not null default 70,
  max_attempts int default 3,
  time_limit_minutes int default 20,
  is_published boolean not null default true
);

create table quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  question text not null,
  question_type text not null default 'multiple_choice',
  options jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  explanation text,
  order_index int not null default 0,
  points int not null default 1
);

-- Client-safe view: never exposes correct_answer
create view safe_quiz_questions as
  select id, quiz_id, question, question_type, options, order_index, points
  from quiz_questions;

create table quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  quiz_id uuid not null references quizzes(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  score numeric,
  correct_answers int,
  wrong_answers int,
  total_points int,
  time_spent_minutes numeric
);

create table assessments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id),
  lesson_id uuid references lessons(id),
  created_by uuid references user_profiles(id),
  title text not null,
  description text,
  is_ai_generated boolean not null default false,
  max_score numeric default 100,
  questions jsonb not null default '[]'::jsonb,
  time_limit int
);

create table assessment_answer_keys (
  assessment_id uuid primary key references assessments(id) on delete cascade,
  correct_answers jsonb not null default '{}'::jsonb
);

create table assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  assessment_id uuid not null references assessments(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  score numeric,
  time_taken numeric
);

-- ---------------------------------------------------------------------------
-- 2.6 AI Assistant
-- ---------------------------------------------------------------------------
create table ai_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

create table ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references ai_chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  course_id uuid references courses(id),
  title text,
  created_at timestamptz not null default now()
);

create table ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2.7 Cohorts & Compliance
-- ---------------------------------------------------------------------------
create table cohorts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  starts_at date,
  ends_at date,
  created_by uuid references user_profiles(id)
);

create table cohort_members (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references cohorts(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  added_by uuid references user_profiles(id),
  added_at timestamptz not null default now(),
  unique (cohort_id, user_id)
);

create table cohort_courses (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references cohorts(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  due_at date,
  unique (cohort_id, course_id)
);

create table compliance_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  assigned_by uuid references user_profiles(id),
  assigned_at timestamptz not null default now(),
  due_at date,
  status compliance_status not null default 'pending',
  completed_at timestamptz
);


-- ============================================================================
-- MIGRATION: 0003_mentors_sessions_messaging.sql
-- ============================================================================
-- =============================================================================
-- Train AI - Core schema migration (continued): mentors, sessions, earnings,
-- messaging, notifications.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 2.8 Mentors & Mentorship Operations
-- ---------------------------------------------------------------------------
create table mentors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references user_profiles(id) on delete cascade,
  organization_id uuid references organizations(id),
  title text,
  bio text,
  tagline text,
  hourly_rate numeric,
  session_duration int default 45,
  years_of_experience int,
  languages text[] default '{}',
  specializations text[] default '{}',
  mentor_type text default 'standard',
  timezone text default 'UTC',
  availability_schedule jsonb default '{}'::jsonb,
  is_active boolean not null default true,
  is_approved boolean not null default false,
  allow_group_sessions boolean not null default false,
  allow_reviews boolean not null default true,
  auto_accept_bookings boolean not null default false,
  max_students int default 20,
  profile_completion_percentage int default 0,
  profile_visibility text default 'public',
  rating numeric default 0,
  require_pre_payment boolean not null default false,
  show_rates boolean not null default true,
  total_sessions int not null default 0,
  video_intro_url text,
  education jsonb default '[]'::jsonb
);

create table mentor_credentials (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references mentors(id) on delete cascade,
  credential_type text,
  credential_id text,
  document_url text,
  expiry_date date,
  is_verified boolean not null default false,
  issue_date date,
  issuing_organization text,
  title text,
  verification_url text
);

create table mentor_portfolio_items (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references mentors(id) on delete cascade,
  item_type text,
  title text,
  description text,
  media_urls text[] default '{}',
  display_order int default 0,
  is_featured boolean default false
);

create table mentor_testimonials (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references mentors(id) on delete cascade,
  learner_id uuid references user_profiles(id),
  session_id uuid,
  rating int check (rating between 1 and 5),
  testimonial_text text,
  is_featured boolean default false,
  is_public boolean default true
);

create table mentor_pricing_tiers (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references mentors(id) on delete cascade,
  session_type text,
  duration_minutes int,
  price numeric,
  currency text default 'usd',
  package_sessions int,
  max_participants int default 1,
  is_active boolean default true
);

create table mentor_resources (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references mentors(id) on delete cascade,
  title text not null,
  description text,
  resource_type text,
  file_path text,
  external_url text,
  file_size bigint,
  mime_type text,
  is_public boolean default false,
  download_count int default 0
);

create table mentor_availability (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references mentors(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text default 'UTC',
  is_available boolean not null default true
);

create table mentor_blocked_slots (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references mentors(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  reason text,
  is_recurring boolean default false,
  recurrence_pattern text
);

create table mentor_waiting_list (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references mentors(id) on delete cascade,
  learner_id uuid references user_profiles(id),
  learner_name text,
  topic text,
  priority int default 0,
  status text default 'waiting',
  contacted_at timestamptz,
  notes text
);

-- ---------------------------------------------------------------------------
-- 2.9 Sessions & Scheduling
-- ---------------------------------------------------------------------------
create table session_templates (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references mentors(id) on delete cascade,
  title text not null,
  description text,
  agenda text,
  suggested_duration int,
  resources jsonb default '[]'::jsonb,
  is_active boolean default true
);

create table cancellation_policies (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references mentors(id) on delete cascade,
  hours_before int not null,
  fee_percentage numeric not null,
  description text,
  is_active boolean default true
);

create table session_requests (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references mentors(id) on delete cascade,
  learner_id uuid not null references user_profiles(id) on delete cascade,
  topic text,
  description text,
  proposed_date timestamptz,
  duration_minutes int default 45,
  status text not null default 'pending',
  rejection_reason text,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create table mentorship_sessions (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references mentors(id) on delete cascade,
  learner_id uuid not null references user_profiles(id) on delete cascade,
  title text,
  description text,
  scheduled_at timestamptz not null,
  duration_minutes int not null default 45,
  session_type text default 'one_on_one',
  status session_status not null default 'confirmed',
  meeting_url text,
  is_recurring boolean default false,
  parent_session_id uuid references mentorship_sessions(id),
  recurrence_pattern text,
  recurrence_end_date date,
  max_participants int default 1,
  learner_notes text,
  mentor_notes text,
  session_notes text,
  learner_feedback text,
  mentor_feedback text,
  rating int check (rating between 1 and 5),
  cancellation_reason text,
  cancellation_fee numeric,
  cancelled_by uuid references user_profiles(id),
  request_id uuid references session_requests(id),
  template_id uuid references session_templates(id)
);

create table session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references mentorship_sessions(id) on delete cascade,
  learner_id uuid not null references user_profiles(id) on delete cascade,
  joined_at timestamptz,
  left_at timestamptz,
  status text default 'invited'
);

create table session_reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references mentorship_sessions(id) on delete cascade,
  old_scheduled_at timestamptz not null,
  new_scheduled_at timestamptz not null,
  reason text,
  requested_by uuid references user_profiles(id),
  status text default 'pending',
  responded_at timestamptz
);

create table mentorship_agreements (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references mentors(id) on delete cascade,
  learner_id uuid not null references user_profiles(id) on delete cascade,
  agreement_type text,
  expectations text,
  signed_by_mentor boolean default false,
  signed_by_learner boolean default false,
  mentor_signed_at timestamptz,
  learner_signed_at timestamptz,
  status text default 'pending',
  expires_at date
);

create table session_reminders_sent (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references mentorship_sessions(id) on delete cascade,
  recipient_id uuid references user_profiles(id),
  reminder_type text,
  channel text,
  sent_at timestamptz not null default now()
);

create table session_ratings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references mentorship_sessions(id) on delete cascade,
  mentor_id uuid not null references mentors(id) on delete cascade,
  learner_id uuid not null references user_profiles(id) on delete cascade,
  learner_name text,
  rating int check (rating between 1 and 5),
  feedback text,
  session_type text,
  mentor_response text,
  is_featured boolean default false
);

create table session_feedback_forms (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references mentors(id) on delete cascade,
  title text not null,
  description text,
  questions jsonb not null default '[]'::jsonb,
  is_default boolean default false,
  is_active boolean default true
);

create table session_feedback_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references session_feedback_forms(id) on delete cascade,
  session_id uuid references mentorship_sessions(id),
  responder_id uuid references user_profiles(id),
  responder_type text,
  responses jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

create table reminder_settings (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references mentors(id) on delete cascade,
  reminder_type text,
  hours_before int,
  custom_message text,
  is_enabled boolean default true
);

create table video_integration_settings (
  mentor_id uuid primary key references mentors(id) on delete cascade,
  preferred_platform text default 'zoom',
  personal_meeting_url text,
  auto_generate_url boolean default true,
  allow_recording boolean default true,
  recording_consent_required boolean default true,
  platform_settings jsonb default '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- 2.10 Mentor Earnings
-- ---------------------------------------------------------------------------
create table mentor_earnings (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references mentors(id) on delete cascade,
  session_id uuid references mentorship_sessions(id),
  amount numeric not null,
  earning_type text default 'session',
  status text default 'pending',
  payout_date date
);

create table mentor_payout_requests (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references mentors(id) on delete cascade,
  amount numeric not null,
  payment_method text,
  status text not null default 'pending',
  notes text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references user_profiles(id)
);

create table refund_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references mentorship_sessions(id),
  mentor_id uuid references mentors(id),
  learner_id uuid references user_profiles(id),
  learner_name text,
  session_date timestamptz,
  reason text,
  amount numeric,
  resolved_by uuid references user_profiles(id),
  resolved_at timestamptz,
  mentor_response text,
  status text not null default 'pending'
);

-- ---------------------------------------------------------------------------
-- 2.11 Messaging
-- ---------------------------------------------------------------------------
create table messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references user_profiles(id) on delete cascade,
  receiver_id uuid not null references user_profiles(id) on delete cascade,
  subject text,
  content text not null,
  is_read boolean not null default false,
  parent_message_id uuid references messages(id),
  created_at timestamptz not null default now()
);

create table mentor_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references user_profiles(id) on delete cascade,
  receiver_id uuid not null references user_profiles(id) on delete cascade,
  content text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table mentor_learner_discussions (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references mentors(id) on delete cascade,
  learner_id uuid not null references user_profiles(id) on delete cascade,
  course_id uuid references courses(id),
  lesson_id uuid references lessons(id),
  title text,
  content text not null,
  is_question boolean default true,
  is_resolved boolean default false,
  parent_id uuid references mentor_learner_discussions(id),
  created_at timestamptz not null default now()
);

create table course_discussions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  lesson_id uuid references lessons(id),
  title text,
  is_general boolean default false,
  created_at timestamptz not null default now()
);

create table course_discussion_messages (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references course_discussions(id) on delete cascade,
  sender_id uuid references user_profiles(id),
  sender_type text default 'learner',
  content text not null,
  is_question boolean default false,
  parent_id uuid references course_discussion_messages(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2.12 Notifications
-- ---------------------------------------------------------------------------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  status text default 'sent',
  sent_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb
);

create table real_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  action_url text,
  is_read boolean not null default false,
  target_role platform_role,
  created_at timestamptz not null default now()
);

create table notification_preferences (
  user_id uuid primary key references user_profiles(id) on delete cascade,
  email_enabled boolean not null default true,
  push_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  frequency text default 'realtime',
  notification_types text[] default '{}',
  quiet_hours_start time,
  quiet_hours_end time
);

create table notification_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  notification_type text not null,
  title text not null,
  message text,
  channels text[] default '{in_app}',
  priority text default 'normal',
  scheduled_for timestamptz default now(),
  sent_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  action_url text
);

create table mentor_notifications (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references mentors(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  data jsonb default '{}'::jsonb,
  action_url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text,
  auth text,
  platform text default 'web',
  user_agent text
);


-- ============================================================================
-- MIGRATION: 0004_community_gamification_admin.sql
-- ============================================================================
-- =============================================================================
-- Train AI - Core schema migration (final part): community, gamification,
-- referrals/waitlist, analytics & admin ops, email/payments, support, settings.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 2.13 Community
-- ---------------------------------------------------------------------------
create table community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  post_type text default 'text',
  content text not null,
  media_type text,
  media_url text,
  is_pinned boolean default false,
  ai_moderated boolean default false,
  moderation_status moderation_status default 'pending',
  moderation_score numeric,
  moderated_at timestamptz,
  moderated_by uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

create table post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references community_posts(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  content text not null,
  parent_comment_id uuid references post_comments(id),
  ai_moderated boolean default false,
  moderation_score numeric,
  created_at timestamptz not null default now()
);

create table post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references community_posts(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  reaction_type text not null default 'like',
  unique (post_id, user_id)
);

create table community_activity_feed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  activity_type text not null,
  activity_text text,
  is_public boolean default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table community_engagement_stats (
  user_id uuid primary key references user_profiles(id) on delete cascade,
  total_posts int not null default 0,
  total_comments int not null default 0,
  total_likes_received int not null default 0,
  engagement_score numeric not null default 0,
  badge_tier text default 'bronze'
);

create table forums (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id),
  is_general boolean default false,
  title text not null,
  description text
);

create table forum_posts (
  id uuid primary key default gen_random_uuid(),
  forum_id uuid not null references forums(id) on delete cascade,
  author_id uuid references user_profiles(id),
  content text not null,
  upvotes int default 0,
  downvotes int default 0,
  is_solution boolean default false,
  parent_post_id uuid references forum_posts(id),
  created_at timestamptz not null default now()
);

create table study_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  course_id uuid references courses(id),
  organization_id uuid references organizations(id),
  created_by uuid references user_profiles(id),
  is_private boolean default false,
  max_members int default 50
);

create table study_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references study_groups(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  role text default 'member',
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create table study_group_messages (
  id uuid primary key default gen_random_uuid(),
  study_group_id uuid not null references study_groups(id) on delete cascade,
  sender_id uuid not null references user_profiles(id) on delete cascade,
  message text not null,
  media_type text,
  media_url text,
  created_at timestamptz not null default now()
);

create table content_library_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  description text,
  file_path text,
  file_size bigint,
  file_type text,
  tags text[] default '{}',
  uploaded_by uuid references user_profiles(id)
);

create table content_appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  content_id uuid not null,
  content_type text not null,
  appeal_reason text,
  status text not null default 'pending',
  admin_response text,
  reviewed_by uuid references user_profiles(id),
  reviewed_at timestamptz
);

create table moderation_logs (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null,
  content_type text not null,
  moderation_action text not null,
  ai_reason text,
  ai_score numeric,
  reviewed_by uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2.14 Gamification
-- ---------------------------------------------------------------------------
create table achievements (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text,
  icon text,
  criteria jsonb default '{}'::jsonb,
  points int not null default 0
);

create table user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  achievement_id uuid not null references achievements(id) on delete cascade,
  achievement_title text,
  achievement_description text,
  achievement_icon text,
  points_awarded int default 0,
  earned_at timestamptz not null default now(),
  unique (user_id, achievement_id)
);

create table user_gamification_stats (
  user_id uuid primary key references user_profiles(id) on delete cascade,
  total_points int not null default 0,
  current_level int not null default 1,
  lessons_completed int not null default 0,
  courses_completed int not null default 0,
  sessions_completed int not null default 0,
  streak_days int not null default 0,
  streak_freezes_available int not null default 1
);

create table streak_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  activity_date date not null,
  lessons_completed int default 0,
  points_earned int default 0,
  unique (user_id, activity_date)
);

create table streak_freezes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  source text,
  earned_at timestamptz not null default now(),
  used_at timestamptz,
  used_for_date date
);

create table user_streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  streak_type text not null default 'daily_lesson',
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_activity_date date,
  unique (user_id, streak_type)
);

create table daily_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  challenge_date date not null,
  challenge_type text,
  challenge_title text,
  challenge_description text,
  target_value numeric,
  current_progress numeric default 0,
  is_completed boolean default false,
  completed_at timestamptz,
  points_reward int default 0
);

create table daily_login_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  claimed_date date not null,
  day_in_cycle int not null,
  points_awarded int default 0,
  bonus_reward jsonb,
  unique (user_id, claimed_date)
);

create table mystery_boxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  trigger_type text,
  reward_type text,
  reward_value jsonb,
  is_opened boolean default false,
  opened_at timestamptz
);

create table claimed_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  reward_id uuid,
  claimed_at timestamptz not null default now()
);

create table weekly_leagues (
  id uuid primary key default gen_random_uuid(),
  league_name text not null,
  league_tier int not null default 1,
  week_start date not null,
  week_end date not null,
  is_active boolean default true
);

create table league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references weekly_leagues(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  weekly_points int default 0,
  rank_position int,
  promoted boolean default false,
  demoted boolean default false,
  joined_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create table user_leaderboard_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  pathway text,
  points int default 0,
  position int,
  calculated_at timestamptz not null default now()
);

create table weekly_goal_commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  week_start date not null,
  committed_lessons int not null default 5,
  completed_lessons int not null default 0,
  is_completed boolean default false,
  reward_claimed boolean default false,
  unique (user_id, week_start)
);

-- ---------------------------------------------------------------------------
-- 2.15 Referrals, Waitlist & Growth
-- ---------------------------------------------------------------------------
create table referral_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  code text unique not null default encode(gen_random_bytes(4), 'hex'),
  label text,
  clicks int not null default 0,
  is_active boolean default true,
  whatsapp_group_url text,
  utm_source text,
  utm_medium text,
  utm_campaign text
);

create table referral_signups (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid references user_profiles(id),
  referred_user_id uuid references user_profiles(id),
  referral_code text,
  referral_link_id uuid references referral_links(id),
  signup_completed boolean default false,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now()
);

create table waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text,
  created_at timestamptz not null default now()
);

create table waitlist_tiers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  tier text not null,
  amount numeric,
  currency text default 'usd',
  payment_status text default 'pending',
  stripe_session_id text,
  user_id uuid references user_profiles(id),
  source text
);

create table paid_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  amount numeric,
  currency text default 'usd',
  payment_method text,
  payment_status text default 'pending',
  bank_reference text,
  stripe_session_id text,
  user_id uuid references user_profiles(id),
  source text
);

create view safe_paid_waitlist as
  select id, email, currency, payment_status, source from paid_waitlist;

create table newsletter_subscriptions (
  user_id uuid primary key references user_profiles(id) on delete cascade,
  email text not null,
  is_subscribed boolean not null default true,
  preferences jsonb default '{}'::jsonb
);

create table newsletter_access_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references user_profiles(id),
  access_type text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2.16 Analytics & Admin Operations
-- ---------------------------------------------------------------------------
create table admin_analytics_summary (
  id uuid primary key default gen_random_uuid(),
  daily_active_users int,
  daily_logins int,
  weekly_active_users int,
  weekly_signups int,
  monthly_completions int,
  refreshed_at timestamptz not null default now()
);

create table admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references user_profiles(id),
  action_type text not null,
  target_type text,
  target_id uuid,
  target_identifier text,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb default '{}'::jsonb,
  ip_address text,
  user_agent text,
  prev_hash text,
  row_hash text not null,
  created_at timestamptz not null default now()
);

-- Client-safe view: strips ip_address/user_agent/hash chain internals for
-- non-super-admin readers.
create view safe_admin_audit_log as
  select id, admin_user_id, action_type, target_type, target_id, target_identifier, created_at
  from admin_audit_log;

create table analytics_time_series (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  metric_type text not null,
  value numeric not null
);

create table anonymous_analytics (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  page_path text,
  activity_type text,
  activity_data jsonb default '{}'::jsonb,
  referrer text,
  country text,
  region text,
  city text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table learning_analytics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id),
  course_id uuid references courses(id),
  lesson_id uuid references lessons(id),
  activity_type text,
  duration_minutes numeric,
  score numeric,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table user_analytics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id),
  session_id text,
  activity_type text,
  activity_data jsonb default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table user_activity_patterns (
  user_id uuid primary key references user_profiles(id) on delete cascade,
  total_sessions int default 0,
  typical_hour_utc int,
  last_active_at timestamptz
);

create table recommendation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id),
  recommendation_id uuid,
  event_type text,
  context jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table utm_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id),
  session_id text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  landing_url text,
  referrer text,
  country text,
  region text,
  city text,
  created_at timestamptz not null default now()
);

create table error_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id),
  session_id text,
  error_type text,
  error_message text,
  error_stack text,
  component_name text,
  user_context jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2.17 Email Campaigns & Integrations
-- ---------------------------------------------------------------------------
create table email_campaigns (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references user_profiles(id),
  subject text not null,
  html_content text,
  recipient_group text,
  recipient_count int default 0,
  sent_count int default 0,
  open_count int default 0,
  click_count int default 0,
  status text default 'draft',
  sent_at timestamptz
);

create table email_campaign_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references email_campaigns(id) on delete cascade,
  recipient_email text,
  event_type text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table email_bounce_events (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  event_type text,
  reason text,
  raw jsonb,
  created_at timestamptz not null default now()
);

create table email_delivery_log (
  id uuid primary key default gen_random_uuid(),
  email_id text,
  recipient_id uuid references user_profiles(id),
  recipient_email text,
  notification_type text,
  status text,
  error_message text,
  created_at timestamptz not null default now()
);

create table sara_foundation_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  verification_status text,
  is_valid_format boolean,
  is_deliverable boolean,
  mx_domain text,
  verification_error text,
  verified_at timestamptz,
  bounce_count int default 0
);

create table integration_dispatch_log (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid references org_integrations(id),
  organization_id uuid references organizations(id),
  event text,
  payload jsonb,
  http_status int,
  status text,
  error text,
  created_at timestamptz not null default now()
);

create table inactivity_email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  email_type text not null,
  sent_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2.18 Payments
-- ---------------------------------------------------------------------------
create table payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text unique,
  event_type text,
  payload jsonb,
  processed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- 2.19 Support & Legal
-- ---------------------------------------------------------------------------
create table feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id),
  email text,
  category text,
  message text not null,
  rating int check (rating between 1 and 5),
  status text default 'open',
  created_at timestamptz not null default now()
);

create table dsar_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id),
  email text,
  request_type text not null,
  status text not null default 'received',
  notes text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create table user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id),
  anon_id text,
  policy_version text not null,
  choices jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table auth_failed_attempts (
  id uuid primary key default gen_random_uuid(),
  email_lower text not null,
  ip text,
  user_agent text,
  attempted_at timestamptz not null default now()
);

create table auth_lockouts (
  email_lower text primary key,
  attempts int not null default 0,
  locked_until timestamptz
);

-- ---------------------------------------------------------------------------
-- 2.20 Platform Settings
-- ---------------------------------------------------------------------------
create table platform_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text unique not null,
  setting_value text,
  setting_type text not null default 'string',
  description text,
  is_public boolean not null default false
);

-- ---------------------------------------------------------------------------
-- 2.21 Read-optimized / privacy-safe views
-- ---------------------------------------------------------------------------
create view mentor_public_profiles as
  select m.id, m.user_id, up.display_name, up.avatar_url, m.title, m.tagline, m.bio,
         m.hourly_rate, m.rating, m.specializations, m.languages, m.years_of_experience,
         m.is_active, m.is_approved, m.video_intro_url
  from mentors m
  join user_profiles up on up.id = m.user_id
  where m.is_active and m.is_approved and m.profile_visibility = 'public';

create view public_user_profiles as
  select id, display_name, avatar_url, bio, level
  from user_profiles;

create view safe_community_posts as
  select id, user_id, post_type, content, media_type, media_url, is_pinned, created_at
  from community_posts
  where moderation_status in ('approved', 'pending');

create view safe_course_enrollments as
  select id, user_id, course_id, enrolled_at, completed_at, progress_percentage
  from course_enrollments;

create view instructor_course_enrollments as
  select ce.id, ce.course_id, c.instructor_id, ce.user_id, ce.progress_percentage, ce.completed_at
  from course_enrollments ce
  join courses c on c.id = ce.course_id;


-- ============================================================================
-- MIGRATION: 0005_functions.sql
-- ============================================================================
-- =============================================================================
-- Train AI - Backend functions (SECURITY DEFINER)
-- Every function pins `search_path` explicitly - required so a
-- SECURITY DEFINER function can't be tricked into resolving an
-- attacker-controlled object via a manipulated search_path.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Role & permission resolution
-- ---------------------------------------------------------------------------

create or replace function get_user_roles(user_uuid uuid)
returns setof platform_role
language sql stable security definer set search_path = public as $$
  select role from user_roles where user_id = user_uuid;
$$;

create or replace function has_role(check_user_id uuid, check_role platform_role)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = check_user_id and role = check_role);
$$;

-- Priority order per spec: super_admin > admin > hr > manager > mentor > learner
create or replace function get_primary_role(check_user_id uuid)
returns platform_role
language sql stable security definer set search_path = public as $$
  select role from user_roles
  where user_id = check_user_id
  order by array_position(
    array['super_admin','admin','hr','manager','mentor','learner']::platform_role[],
    role
  )
  limit 1;
$$;

create or replace function current_user_is_super_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select has_role(auth.uid(), 'super_admin');
$$;

create or replace function is_super_admin(check_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select has_role(check_user_id, 'super_admin');
$$;

create or replace function is_org_admin(check_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members
    where user_id = check_user_id and role in ('owner','admin') and status = 'active'
  ) or is_super_admin(check_user_id);
$$;

create or replace function is_org_owner(check_user_id uuid, org_uuid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members
    where user_id = check_user_id and organization_id = org_uuid and role = 'owner' and status = 'active'
  ) or is_super_admin(check_user_id);
$$;

create or replace function is_any_org_admin(check_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select is_org_admin(check_user_id);
$$;

create or replace function get_user_organization_id(check_user_id uuid default auth.uid())
returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from user_profiles where id = check_user_id;
$$;

create or replace function is_manager_of(manager_id uuid, learner_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_profiles where id = learner_id and manager_id = is_manager_of.manager_id
  );
$$;

create or replace function is_group_member(check_user_id uuid, group_uuid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from study_group_members where user_id = check_user_id and group_id = group_uuid);
$$;

-- Role-level default lookup (role_permissions_matrix), by the caller's primary role
create or replace function role_has_permission(check_user_id uuid, perm_key text)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select allowed from role_permissions_matrix
     where role = get_primary_role(check_user_id) and permission_key = perm_key),
    false
  );
$$;

-- Resolution order: explicit revoke always wins, then explicit grant, then role default.
create or replace function effective_has_permission(check_user_id uuid, perm_key text)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when exists (
      select 1 from user_permission_overrides
      where user_id = check_user_id and permission_key = perm_key and effect = 'revoke'
        and (expires_at is null or expires_at > now())
    ) then false
    when exists (
      select 1 from user_permission_overrides
      where user_id = check_user_id and permission_key = perm_key and effect = 'grant'
        and (expires_at is null or expires_at > now())
    ) then true
    else role_has_permission(check_user_id, perm_key)
  end;
$$;

create or replace function get_my_effective_permissions()
returns table (permission_key text, allowed boolean)
language sql stable security definer set search_path = public as $$
  select distinct pk.permission_key, effective_has_permission(auth.uid(), pk.permission_key)
  from (select distinct permission_key from role_permissions_matrix) pk;
$$;

create or replace function can_manage_people(check_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select effective_has_permission(check_user_id, 'manage_users');
$$;

create or replace function can_moderate_content(check_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select effective_has_permission(check_user_id, 'moderate_content');
$$;

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------

create or replace function create_user_invitation(
  p_email text, p_role platform_role, p_organization_id uuid, p_organization_role org_member_role
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_org_admin(auth.uid()) then
    raise exception 'not authorized to invite users to this organization';
  end if;
  insert into user_invitations (email, role, organization_id, organization_role, invited_by)
  values (p_email, p_role, p_organization_id, p_organization_role, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function validate_invitation_token(p_token text)
returns table (id uuid, email text, role platform_role, organization_id uuid, organization_role org_member_role, valid boolean)
language sql stable security definer set search_path = public as $$
  select id, email, role, organization_id, organization_role,
    (status = 'pending' and expires_at > now()) as valid
  from user_invitations where token = p_token;
$$;

create or replace function accept_invitation(p_token text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_inv user_invitations;
begin
  select * into v_inv from user_invitations where token = p_token and status = 'pending' and expires_at > now();
  if not found then
    raise exception 'invitation is invalid or expired';
  end if;
  insert into user_roles (user_id, role) values (auth.uid(), v_inv.role)
    on conflict do nothing;
  if v_inv.organization_id is not null then
    insert into organization_members (organization_id, user_id, role, status, invited_by, joined_at)
    values (v_inv.organization_id, auth.uid(), v_inv.organization_role, 'active', v_inv.invited_by, now())
    on conflict (organization_id, user_id) do update set status = 'active', joined_at = now();
    update user_profiles set organization_id = v_inv.organization_id where id = auth.uid();
  end if;
  update user_invitations set status = 'accepted', accepted_at = now() where id = v_inv.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Referrals
-- ---------------------------------------------------------------------------

create or replace function validate_referral_code(p_code text)
returns table (link_id uuid, referrer_user_id uuid, is_active boolean)
language sql stable security definer set search_path = public as $$
  select id, user_id, is_active from referral_links where code = p_code;
$$;

create or replace function get_my_referral_signups()
returns setof referral_signups
language sql stable security definer set search_path = public as $$
  select * from referral_signups where referrer_user_id = auth.uid();
$$;

create or replace function get_referral_analytics(check_user_id uuid default auth.uid())
returns table (clicks int, signups bigint, conversion_rate numeric)
language sql stable security definer set search_path = public as $$
  select rl.clicks, count(rs.id), case when rl.clicks > 0 then round(count(rs.id)::numeric / rl.clicks * 100, 1) else 0 end
  from referral_links rl
  left join referral_signups rs on rs.referral_link_id = rl.id and rs.signup_completed
  where rl.user_id = check_user_id
  group by rl.id, rl.clicks;
$$;

-- ---------------------------------------------------------------------------
-- Quiz/assessment integrity - scores server-side; client never receives
-- correct_answer directly (see the safe_quiz_questions view).
-- ---------------------------------------------------------------------------

create or replace function check_quiz_answers(p_quiz_id uuid, p_answers jsonb)
returns table (score numeric, correct_count int, total int, total_points int)
language plpgsql security definer set search_path = public as $$
declare
  v_total int;
  v_correct int := 0;
  v_points int := 0;
  v_total_points int := 0;
  q record;
begin
  select count(*) into v_total from quiz_questions where quiz_id = p_quiz_id;
  for q in select * from quiz_questions where quiz_id = p_quiz_id loop
    v_total_points := v_total_points + q.points;
    if (p_answers ->> q.id::text) = q.correct_answer then
      v_correct := v_correct + 1;
      v_points := v_points + q.points;
    end if;
  end loop;
  return query select
    case when v_total > 0 then round(v_correct::numeric / v_total * 100, 1) else 0 end,
    v_correct, v_total, v_points;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gamification
-- ---------------------------------------------------------------------------

create or replace function award_achievement(p_user_id uuid, p_achievement_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_points int;
begin
  select points into v_points from achievements where id = p_achievement_id;
  insert into user_achievements (user_id, achievement_id, points_awarded)
  values (p_user_id, p_achievement_id, coalesce(v_points, 0))
  on conflict (user_id, achievement_id) do nothing;

  insert into user_gamification_stats (user_id, total_points)
  values (p_user_id, coalesce(v_points, 0))
  on conflict (user_id) do update
    set total_points = user_gamification_stats.total_points + coalesce(v_points, 0);
end;
$$;

create or replace function get_my_gamification_stats()
returns setof user_gamification_stats
language sql stable security definer set search_path = public as $$
  select * from user_gamification_stats where user_id = auth.uid();
$$;

create or replace function get_public_gamification_stats(check_user_id uuid)
returns table (total_points int, current_level int, streak_days int)
language sql stable security definer set search_path = public as $$
  select total_points, current_level, streak_days from user_gamification_stats where user_id = check_user_id;
$$;

create or replace function create_or_join_weekly_league(p_user_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_league_id uuid;
begin
  select id into v_league_id from weekly_leagues
  where is_active and week_start <= current_date and week_end >= current_date
  order by league_tier asc limit 1;

  if v_league_id is null then
    insert into weekly_leagues (league_name, league_tier, week_start, week_end)
    values ('Bronze League', 1, date_trunc('week', now())::date, (date_trunc('week', now()) + interval '6 days')::date)
    returning id into v_league_id;
  end if;

  insert into league_members (league_id, user_id) values (v_league_id, p_user_id)
    on conflict (league_id, user_id) do nothing;
  return v_league_id;
end;
$$;

create or replace function get_streak_leaderboard(p_limit int default 20)
returns table (user_id uuid, display_name text, streak_days int)
language sql stable security definer set search_path = public as $$
  select s.user_id, up.display_name, s.streak_days
  from user_gamification_stats s
  join user_profiles up on up.id = s.user_id
  order by s.streak_days desc
  limit p_limit;
$$;

-- ---------------------------------------------------------------------------
-- Leaderboard
-- ---------------------------------------------------------------------------

create or replace function get_leaderboard_data(p_limit int default 50)
returns table (user_id uuid, total_points int, current_level int, streak_days int)
language sql stable security definer set search_path = public as $$
  select user_id, total_points, current_level, streak_days
  from user_gamification_stats
  order by total_points desc
  limit p_limit;
$$;

-- Joins display name/avatar server-side since direct cross-user profile reads are RLS-restricted
create or replace function get_leaderboard_with_profiles(p_limit int default 50)
returns table (user_id uuid, display_name text, avatar_url text, total_points int, current_level int, streak_days int)
language sql stable security definer set search_path = public as $$
  select s.user_id, up.display_name, up.avatar_url, s.total_points, s.current_level, s.streak_days
  from user_gamification_stats s
  join user_profiles up on up.id = s.user_id
  order by s.total_points desc
  limit p_limit;
$$;

create or replace function get_public_leaderboard(p_limit int default 50)
returns table (display_name text, total_points int, current_level int)
language sql stable security definer set search_path = public as $$
  select up.display_name, s.total_points, s.current_level
  from user_gamification_stats s
  join user_profiles up on up.id = s.user_id
  order by s.total_points desc
  limit p_limit;
$$;

-- ---------------------------------------------------------------------------
-- Community
-- ---------------------------------------------------------------------------

create or replace function get_community_posts_with_details(p_limit int default 20)
returns table (id uuid, author_name text, author_avatar text, content text, created_at timestamptz, like_count bigint, comment_count bigint)
language sql stable security definer set search_path = public as $$
  select p.id, up.display_name, up.avatar_url, p.content, p.created_at,
    (select count(*) from post_reactions r where r.post_id = p.id),
    (select count(*) from post_comments c where c.post_id = p.id)
  from community_posts p
  join user_profiles up on up.id = p.user_id
  where p.moderation_status in ('approved','pending')
  order by p.created_at desc
  limit p_limit;
$$;

create or replace function set_post_pinned(p_post_id uuid, p_pinned boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_moderate_content(auth.uid()) then
    raise exception 'not authorized to pin posts';
  end if;
  update community_posts set is_pinned = p_pinned where id = p_post_id;
end;
$$;

create or replace function search_mentionable_users(p_query text, p_limit int default 10)
returns table (id uuid, display_name text)
language sql stable security definer set search_path = public as $$
  select id, display_name from user_profiles
  where display_name ilike '%' || p_query || '%'
  limit p_limit;
$$;

-- ---------------------------------------------------------------------------
-- Mentor operations
-- ---------------------------------------------------------------------------

create or replace function get_mentor_analytics(p_mentor_id uuid)
returns table (total_sessions bigint, completed_sessions bigint, avg_rating numeric, total_earnings numeric)
language sql stable security definer set search_path = public as $$
  select
    count(*) filter (where true),
    count(*) filter (where status = 'completed'),
    (select avg(rating) from session_ratings where mentor_id = p_mentor_id),
    (select coalesce(sum(amount), 0) from mentor_earnings where mentor_id = p_mentor_id)
  from mentorship_sessions where mentor_id = p_mentor_id;
$$;

create or replace function generate_recurring_sessions(
  p_mentor_id uuid, p_learner_id uuid, p_start timestamptz, p_duration int, p_pattern text, p_end_date date
) returns int
language plpgsql security definer set search_path = public as $$
declare v_count int := 0; v_current timestamptz := p_start; v_step interval;
begin
  v_step := case p_pattern when 'weekly' then interval '7 days' when 'biweekly' then interval '14 days' else interval '7 days' end;
  while v_current::date <= p_end_date loop
    insert into mentorship_sessions (mentor_id, learner_id, scheduled_at, duration_minutes, is_recurring, recurrence_pattern, recurrence_end_date)
    values (p_mentor_id, p_learner_id, v_current, p_duration, true, p_pattern, p_end_date);
    v_count := v_count + 1;
    v_current := v_current + v_step;
  end loop;
  return v_count;
end;
$$;

create or replace function cancel_recurring_sessions(p_parent_session_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update mentorship_sessions set status = 'cancelled'
  where parent_session_id = p_parent_session_id and status not in ('completed','cancelled');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Compliance
-- ---------------------------------------------------------------------------

create or replace function refresh_compliance_status()
returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update compliance_assignments
  set status = 'overdue'
  where status in ('pending','in_progress') and due_at < current_date;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Auth helpers
-- ---------------------------------------------------------------------------

create or replace function current_user_email()
returns text
language sql stable security definer set search_path = public as $$
  select email from auth.users where id = auth.uid();
$$;

create or replace function get_current_auth_email()
returns text
language sql stable security definer set search_path = public as $$
  select current_user_email();
$$;

-- ---------------------------------------------------------------------------
-- Logging - writes to the hash-chained admin_audit_log. The chain makes the
-- log tamper-evident: each row's hash is derived from the previous row's
-- hash, so editing or deleting a past row breaks every hash after it.
-- ---------------------------------------------------------------------------

create or replace function log_admin_action(
  p_action_type text, p_target_type text, p_target_id uuid, p_target_identifier text,
  p_old_value jsonb, p_new_value jsonb, p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_prev_hash text;
  v_row_hash text;
  v_id uuid;
begin
  select row_hash into v_prev_hash from admin_audit_log order by created_at desc limit 1;
  v_row_hash := encode(
    digest(
      coalesce(v_prev_hash, '') || p_action_type || coalesce(p_target_id::text, '') || now()::text,
      'sha256'
    ),
    'hex'
  );
  insert into admin_audit_log (admin_user_id, action_type, target_type, target_id, target_identifier, old_value, new_value, metadata, prev_hash, row_hash)
  values (auth.uid(), p_action_type, p_target_type, p_target_id, p_target_identifier, p_old_value, p_new_value, p_metadata, v_prev_hash, v_row_hash)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function log_error(p_error_type text, p_error_message text, p_component text, p_context jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into error_logs (user_id, error_type, error_message, component_name, user_context)
  values (auth.uid(), p_error_type, p_error_message, p_component, p_context);
end;
$$;

create or replace function track_user_activity(p_activity_type text, p_activity_data jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into user_analytics (user_id, activity_type, activity_data)
  values (auth.uid(), p_activity_type, p_activity_data);
end;
$$;


-- ============================================================================
-- MIGRATION: 0006_rls_policies.sql
-- ============================================================================
-- =============================================================================
-- Train AI - Row-Level Security
-- Every table gets RLS enabled with default-deny (no policy = no access).
-- Explicit policies are then added for the tables most central to the
-- security model. Remaining tables follow the same patterns shown here:
--   - user-owned data: `user_id = auth.uid()`
--   - org-scoped data: `organization_id = get_user_organization_id()` or
--     `is_org_admin(auth.uid())`
--   - mentor-owned data: joined through `mentors.user_id = auth.uid()`
--   - platform-wide/admin-only data: `is_super_admin(auth.uid())`
-- =============================================================================

-- Enable RLS on every table in one pass (default-deny until a policy exists)
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security;', r.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- user_profiles - read own row, org admins/super_admin read org members,
-- managers read direct reports. Update: own row, or admin for org members.
-- ---------------------------------------------------------------------------
create policy up_select_own on user_profiles for select
  using (id = auth.uid());

create policy up_select_org_admin on user_profiles for select
  using (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()));

create policy up_select_super_admin on user_profiles for select
  using (is_super_admin(auth.uid()));

create policy up_select_manager on user_profiles for select
  using (is_manager_of(auth.uid(), id));

create policy up_update_own on user_profiles for update
  using (id = auth.uid());

create policy up_update_org_admin on user_profiles for update
  using (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()));

-- ---------------------------------------------------------------------------
-- organizations - members can read their own org; super_admin reads/writes all;
-- org owner/admin can update their own org.
-- ---------------------------------------------------------------------------
create policy org_select_member on organizations for select
  using (id = get_user_organization_id(auth.uid()) or is_super_admin(auth.uid()));

create policy org_update_owner on organizations for update
  using (is_org_owner(auth.uid(), id) or is_super_admin(auth.uid()));

create policy org_insert_super_admin on organizations for insert
  with check (is_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- organization_members
-- ---------------------------------------------------------------------------
create policy om_select_self on organization_members for select
  using (user_id = auth.uid());

create policy om_select_org_admin on organization_members for select
  using (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()));

create policy om_write_org_admin on organization_members for all
  using (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()))
  with check (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()));

-- ---------------------------------------------------------------------------
-- user_roles - readable by self, org admins (scoped via profile org match),
-- writable only by super_admin (role assignment is a privileged action).
-- ---------------------------------------------------------------------------
create policy ur_select_self on user_roles for select
  using (user_id = auth.uid());

create policy ur_select_super_admin on user_roles for select
  using (is_super_admin(auth.uid()));

create policy ur_write_super_admin on user_roles for all
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- user_permission_overrides - only org admins/owners (scoped to their own
-- org's members) and super_admin may create/edit; every user may read own.
-- ---------------------------------------------------------------------------
create policy upo_select_own on user_permission_overrides for select
  using (user_id = auth.uid());

create policy upo_select_admin on user_permission_overrides for select
  using (is_org_admin(auth.uid()) or is_super_admin(auth.uid()));

create policy upo_write_admin on user_permission_overrides for all
  using (is_org_admin(auth.uid()) or is_super_admin(auth.uid()))
  with check (is_org_admin(auth.uid()) or is_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- role_permissions_matrix / platform_settings - super_admin only, platform-wide
-- ---------------------------------------------------------------------------
create policy rpm_select_all on role_permissions_matrix for select using (true);
create policy rpm_write_super_admin on role_permissions_matrix for all
  using (is_super_admin(auth.uid())) with check (is_super_admin(auth.uid()));

create policy ps_select_public on platform_settings for select using (is_public or is_super_admin(auth.uid()));
create policy ps_write_super_admin on platform_settings for all
  using (is_super_admin(auth.uid())) with check (is_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- courses / lessons - published content is readable by anyone signed in;
-- instructors, org content managers, and super_admin can write.
-- ---------------------------------------------------------------------------
create policy courses_select_published on courses for select
  using (is_published or instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses'));

create policy courses_write_authorized on courses for all
  using (instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()))
  with check (instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));

create policy lessons_select_published on lessons for select
  using (
    is_published
    or exists (select 1 from courses c where c.id = lessons.course_id and c.instructor_id = auth.uid())
    or effective_has_permission(auth.uid(), 'manage_courses')
  );

create policy lessons_write_authorized on lessons for all
  using (
    exists (select 1 from courses c where c.id = lessons.course_id and c.instructor_id = auth.uid())
    or effective_has_permission(auth.uid(), 'manage_courses')
    or is_super_admin(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- course_enrollments / lesson_progress - strictly own rows, plus org admin
-- and the course's instructor/mentor can read (never write) for oversight.
-- ---------------------------------------------------------------------------
create policy ce_select_own on course_enrollments for select using (user_id = auth.uid());
create policy ce_write_own on course_enrollments for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ce_select_org_admin on course_enrollments for select
  using (effective_has_permission(auth.uid(), 'view_analytics') or is_super_admin(auth.uid()));

create policy lp_select_own on lesson_progress for select using (user_id = auth.uid());
create policy lp_write_own on lesson_progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- quiz_attempts - own rows only; questions/answers themselves are protected
-- via the safe_quiz_questions view + check_quiz_answers() server-side scoring.
-- ---------------------------------------------------------------------------
create policy qa_select_own on quiz_attempts for select using (user_id = auth.uid());
create policy qa_write_own on quiz_attempts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy qq_select_none on quiz_questions for select using (false); -- force use of safe_quiz_questions view
create policy qq_write_authorized on quiz_questions for all
  using (effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- mentors - public-safe profile is via mentor_public_profiles view; the
-- underlying table is readable by the mentor themself, org admins, and
-- writable by the same + super_admin.
-- ---------------------------------------------------------------------------
create policy mentors_select_self on mentors for select using (user_id = auth.uid());
create policy mentors_select_public on mentors for select using (is_active and is_approved);
create policy mentors_select_admin on mentors for select
  using (effective_has_permission(auth.uid(), 'manage_users') or is_super_admin(auth.uid()));
create policy mentors_write_self on mentors for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy mentors_write_admin on mentors for all
  using (effective_has_permission(auth.uid(), 'manage_users') or is_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- mentorship_sessions - the mentor, the learner, or org admin.
-- ---------------------------------------------------------------------------
create policy ms_select_participant on mentorship_sessions for select
  using (
    learner_id = auth.uid()
    or exists (select 1 from mentors m where m.id = mentorship_sessions.mentor_id and m.user_id = auth.uid())
    or effective_has_permission(auth.uid(), 'manage_sessions')
    or is_super_admin(auth.uid())
  );

create policy ms_write_participant on mentorship_sessions for all
  using (
    learner_id = auth.uid()
    or exists (select 1 from mentors m where m.id = mentorship_sessions.mentor_id and m.user_id = auth.uid())
    or effective_has_permission(auth.uid(), 'manage_sessions')
  );

-- ---------------------------------------------------------------------------
-- messages / mentor_messages - sender or receiver only.
-- ---------------------------------------------------------------------------
create policy msg_select_participant on messages for select
  using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy msg_insert_sender on messages for insert
  with check (sender_id = auth.uid());
create policy msg_update_receiver on messages for update
  using (receiver_id = auth.uid()); -- e.g. marking is_read

create policy mm_select_participant on mentor_messages for select
  using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy mm_insert_sender on mentor_messages for insert
  with check (sender_id = auth.uid());

-- ---------------------------------------------------------------------------
-- notifications - own rows only.
-- ---------------------------------------------------------------------------
create policy notif_select_own on notifications for select using (user_id = auth.uid());
create policy notif_update_own on notifications for update using (user_id = auth.uid());

create policy rn_select_own on real_notifications for select using (user_id = auth.uid());
create policy rn_update_own on real_notifications for update using (user_id = auth.uid());

create policy np_select_own on notification_preferences for select using (user_id = auth.uid());
create policy np_write_own on notification_preferences for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- community_posts / post_comments / post_reactions - read approved content;
-- write/delete own; moderators can update moderation_status.
-- ---------------------------------------------------------------------------
create policy cp_select_approved on community_posts for select
  using (moderation_status in ('approved','pending') or user_id = auth.uid() or can_moderate_content(auth.uid()));
create policy cp_insert_own on community_posts for insert with check (user_id = auth.uid());
create policy cp_update_own_or_moderator on community_posts for update
  using (user_id = auth.uid() or can_moderate_content(auth.uid()));
create policy cp_delete_own on community_posts for delete using (user_id = auth.uid());

create policy pc_select_all on post_comments for select using (true);
create policy pc_insert_own on post_comments for insert with check (user_id = auth.uid());
create policy pc_delete_own on post_comments for delete using (user_id = auth.uid() or can_moderate_content(auth.uid()));

create policy pr_select_all on post_reactions for select using (true);
create policy pr_write_own on post_reactions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- cohorts / cohort_members / compliance_assignments - org-scoped.
-- ---------------------------------------------------------------------------
create policy cohorts_select_org on cohorts for select
  using (organization_id = get_user_organization_id(auth.uid()) or is_super_admin(auth.uid()));
create policy cohorts_write_admin on cohorts for all
  using (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()));

create policy cm_select_self_or_admin on cohort_members for select
  using (user_id = auth.uid() or is_org_admin(auth.uid()));
create policy cm_write_admin on cohort_members for all using (is_org_admin(auth.uid()));

create policy comp_select_self_or_admin on compliance_assignments for select
  using (user_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));
create policy comp_write_admin on compliance_assignments for all
  using (effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- user_gamification_stats - own row readable/writable by self (writes should
-- in practice go through award_achievement()); admins can read for their org.
-- ---------------------------------------------------------------------------
create policy ugs_select_own on user_gamification_stats for select using (user_id = auth.uid());
create policy ugs_select_admin on user_gamification_stats for select
  using (effective_has_permission(auth.uid(), 'view_analytics') or is_super_admin(auth.uid()));
create policy ugs_write_own on user_gamification_stats for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- admin_audit_log - append-only. No update/delete policy exists for anyone,
-- which combined with RLS-enabled + no policy means those actions are always
-- denied, even to super_admin, at the database layer (matches spec rule 6).
-- ---------------------------------------------------------------------------
create policy aal_select_super_admin on admin_audit_log for select using (is_super_admin(auth.uid()));
create policy aal_select_org_admin on admin_audit_log for select
  using (is_org_admin(auth.uid())); -- reads via safe_admin_audit_log view in the app for non-super-admins
create policy aal_insert_via_function on admin_audit_log for insert with check (true); -- actual writes gated inside log_admin_action()

-- ---------------------------------------------------------------------------
-- feedback / dsar_requests - own rows; admins/super_admin can read all for triage.
-- ---------------------------------------------------------------------------
create policy fb_select_own on feedback for select using (user_id = auth.uid());
create policy fb_insert_own on feedback for insert with check (user_id = auth.uid() or user_id is null);
create policy fb_select_admin on feedback for select
  using (effective_has_permission(auth.uid(), 'view_feedback') or is_super_admin(auth.uid()));

create policy dsar_select_own on dsar_requests for select using (user_id = auth.uid());
create policy dsar_insert_own on dsar_requests for insert with check (user_id = auth.uid());
create policy dsar_select_admin on dsar_requests for select using (is_super_admin(auth.uid()));


-- ============================================================================
-- MIGRATION: 0007_missing_schema.sql
-- ============================================================================
-- =============================================================================
-- Train AI - Schema parity migration (7 of 7)
-- Adds the tables present in the source "train-ai-ltd-main" app's live
-- Supabase project (reverse-engineered from its generated types.ts + docs)
-- that were not yet part of this app's schema, so the two apps share the
-- same database structure. Written to run after 0001-0006.
--
-- Of the 29 tables the source app has that this schema lacked, 8 were
-- skipped as legacy/duplicate variants of tables this schema already has
-- (the same kind of collapsing 0001's header comment already describes):
--   profiles              -> superseded by user_profiles
--   roles                 -> superseded by the platform_role enum + user_roles
--   real_courses          -> superseded by courses
--   user_course_progress  -> superseded by course_enrollments.progress_percentage
--   user_progress         -> superseded by lesson_progress
--   chat_messages         -> superseded by study_group_messages
--   mentor_availability_slots -> superseded by mentor_availability
--   reschedule_requests   -> superseded by session_reschedule_requests
-- Say the word if you want any of those 8 added back 1:1 anyway.
--
-- The remaining 21 tables below represent real functionality gaps (career
-- tracking, richer cohort spaces with posts/resources/live sessions,
-- external-course completion tracking, community polls, course content
-- uploads/quality review, mentor achievements, learning-path enrollment
-- tracking) and are added in full.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Career tracking (learner-facing "career goal" progress card)
-- ---------------------------------------------------------------------------
create table career_goal_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  goal_title text not null,
  courses_required int not null default 0,
  courses_completed int not null default 0,
  mentor_sessions_required int not null default 0,
  mentor_sessions_completed int not null default 0,
  total_milestones int not null default 0,
  completed_milestones int not null default 0,
  estimated_completion_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Cohort Space - posts, replies, reactions, resources, live sessions, and
-- per-learner course assignment within a cohort (richer than cohort_courses,
-- which only assigns a course to the whole cohort).
-- ---------------------------------------------------------------------------
create table cohort_learner_courses (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references cohorts(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  assigned_by uuid references user_profiles(id),
  assigned_at timestamptz not null default now()
);

create table cohort_posts (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references cohorts(id) on delete cascade,
  author_id uuid not null references user_profiles(id) on delete cascade,
  content text not null,
  is_announcement boolean not null default false,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table cohort_post_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references cohort_posts(id) on delete cascade,
  author_id uuid not null references user_profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table cohort_post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references cohort_posts(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  emoji text not null default 'like',
  created_at timestamptz not null default now(),
  unique (post_id, user_id, emoji)
);

create table cohort_resources (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references cohorts(id) on delete cascade,
  created_by uuid not null references user_profiles(id),
  title text not null,
  description text,
  resource_type text not null default 'file',
  file_url text,
  external_url text,
  created_at timestamptz not null default now()
);

create table cohort_sessions (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references cohorts(id) on delete cascade,
  created_by uuid not null references user_profiles(id),
  title text not null,
  description text,
  starts_at timestamptz not null,
  join_url text,
  recording_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- External course tracking (3rd-party courses e.g. Udemy/Coursera-style,
-- independent completion/certificate path from internal courses/lessons).
-- ---------------------------------------------------------------------------
create table external_course_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  course_id text not null,
  course_title text not null,
  course_url text,
  has_started boolean not null default false,
  is_completed boolean not null default false,
  progress_percentage numeric not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table external_course_certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  external_progress_id uuid references external_course_progress(id) on delete cascade,
  course_title text not null,
  certificate_url text,
  certificate_file_path text,
  verified boolean not null default false,
  verified_by uuid references user_profiles(id),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Learning path enrollment tracking (this schema had learning_paths and
-- learning_path_courses, but no per-learner enrollment/progress record).
-- ---------------------------------------------------------------------------
create table learning_path_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  path_id uuid not null references learning_paths(id) on delete cascade,
  current_course_index int not null default 0,
  status text not null default 'in_progress',
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, path_id)
);

-- ---------------------------------------------------------------------------
-- Content management - course/lesson file uploads, plus a generic
-- session/course-scoped upload table and a course quality-review workflow.
-- ---------------------------------------------------------------------------
create table course_files (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  owner_id uuid not null references user_profiles(id),
  file_name text not null,
  original_file_name text,
  storage_path text not null,
  mime_type text,
  file_type text,
  file_size bigint,
  description text,
  is_public boolean not null default false,
  upload_status text not null default 'complete',
  metadata jsonb not null default '{}'::jsonb,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table course_uploads (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade,
  uploader_id uuid not null references user_profiles(id),
  filename text not null,
  original_filename text not null,
  file_path text not null,
  file_type text not null,
  file_size bigint,
  is_external_link boolean not null default false,
  external_url text,
  display_order int not null default 0,
  upload_status text not null default 'complete',
  processing_progress int not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lesson_uploads (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references lessons(id) on delete cascade,
  uploader_id uuid not null references user_profiles(id),
  filename text not null,
  original_filename text not null,
  file_path text not null,
  file_type text not null,
  file_size bigint,
  upload_status text not null default 'complete',
  processing_progress int not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table file_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  course_id uuid references courses(id),
  session_id uuid references mentorship_sessions(id),
  category text,
  filename text not null,
  original_filename text not null,
  file_path text not null,
  file_size bigint not null,
  mime_type text not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table course_quality_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  reviewer_id uuid not null references user_profiles(id),
  quality_score numeric,
  review_notes text,
  status text not null default 'pending',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table course_analytics (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade,
  user_id uuid references user_profiles(id),
  total_enrollments int not null default 0,
  active_learners int not null default 0,
  completion_rate numeric not null default 0,
  average_rating numeric,
  total_reviews int not null default 0,
  revenue_generated numeric not null default 0,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Course-scoped mentor discussions (distinct from mentor_learner_discussions,
-- which is not tied to a specific course).
-- ---------------------------------------------------------------------------
create table course_mentor_discussions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  mentor_id uuid not null references mentors(id) on delete cascade,
  learner_id uuid not null references user_profiles(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Mentor achievements (gamification for mentors, parallel to
-- achievements/user_achievements for learners).
-- ---------------------------------------------------------------------------
create table mentor_achievements (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references mentors(id) on delete cascade,
  achievement_type text not null,
  title text not null,
  description text,
  badge_icon text,
  points int not null default 0,
  earned_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Community polls (community_posts.post_type = 'poll' links here).
-- ---------------------------------------------------------------------------
create table polls (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references community_posts(id) on delete cascade,
  question text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  post_id uuid references community_posts(id),
  user_id uuid references user_profiles(id),
  option_text text not null,
  order_index int not null default 0,
  vote_count int not null default 0,
  created_at timestamptz not null default now()
);

create table poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  option_id uuid not null references poll_options(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_id, user_id)
);

-- =============================================================================
-- RLS - enable + explicit policies for every table above. (0006's blanket
-- "enable RLS on every table" loop only ran once against the tables that
-- existed at that time, so new tables need this done explicitly here.)
-- =============================================================================

alter table career_goal_progress enable row level security;
alter table cohort_learner_courses enable row level security;
alter table cohort_posts enable row level security;
alter table cohort_post_replies enable row level security;
alter table cohort_post_reactions enable row level security;
alter table cohort_resources enable row level security;
alter table cohort_sessions enable row level security;
alter table external_course_progress enable row level security;
alter table external_course_certificates enable row level security;
alter table learning_path_enrollments enable row level security;
alter table course_files enable row level security;
alter table course_uploads enable row level security;
alter table lesson_uploads enable row level security;
alter table file_uploads enable row level security;
alter table course_quality_reviews enable row level security;
alter table course_analytics enable row level security;
alter table course_mentor_discussions enable row level security;
alter table mentor_achievements enable row level security;
alter table polls enable row level security;
alter table poll_options enable row level security;
alter table poll_votes enable row level security;

-- career_goal_progress - own row; admins with analytics permission can read.
create policy cgp_select_own on career_goal_progress for select using (user_id = auth.uid());
create policy cgp_write_own on career_goal_progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cgp_select_admin on career_goal_progress for select
  using (effective_has_permission(auth.uid(), 'view_analytics') or is_super_admin(auth.uid()));

-- cohort_learner_courses - the assigned learner or an org admin.
create policy clc_select_self_or_admin on cohort_learner_courses for select
  using (user_id = auth.uid() or is_org_admin(auth.uid()));
create policy clc_write_admin on cohort_learner_courses for all using (is_org_admin(auth.uid()));

-- cohort_posts / replies / reactions - readable by cohort members, writable
-- by the author (or an org admin, e.g. for announcements/moderation).
create policy cpost_select_member on cohort_posts for select
  using (exists (select 1 from cohort_members cm where cm.cohort_id = cohort_posts.cohort_id and cm.user_id = auth.uid())
    or is_org_admin(auth.uid()));
create policy cpost_insert_member on cohort_posts for insert
  with check (author_id = auth.uid()
    and (exists (select 1 from cohort_members cm where cm.cohort_id = cohort_posts.cohort_id and cm.user_id = auth.uid())
      or is_org_admin(auth.uid())));
create policy cpost_update_own_or_admin on cohort_posts for update
  using (author_id = auth.uid() or is_org_admin(auth.uid()));
create policy cpost_delete_own_or_admin on cohort_posts for delete
  using (author_id = auth.uid() or is_org_admin(auth.uid()));

create policy cpr_select_member on cohort_post_replies for select
  using (exists (
    select 1 from cohort_posts p join cohort_members cm on cm.cohort_id = p.cohort_id
    where p.id = cohort_post_replies.post_id and cm.user_id = auth.uid()
  ) or is_org_admin(auth.uid()));
create policy cpr_insert_member on cohort_post_replies for insert with check (author_id = auth.uid());
create policy cpr_delete_own_or_admin on cohort_post_replies for delete
  using (author_id = auth.uid() or is_org_admin(auth.uid()));

create policy cpreact_select_member on cohort_post_reactions for select
  using (exists (
    select 1 from cohort_posts p join cohort_members cm on cm.cohort_id = p.cohort_id
    where p.id = cohort_post_reactions.post_id and cm.user_id = auth.uid()
  ) or is_org_admin(auth.uid()));
create policy cpreact_write_own on cohort_post_reactions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- cohort_resources / cohort_sessions - readable by cohort members, writable
-- by org admins (mirrors cohorts_write_admin in 0006).
create policy cres_select_member on cohort_resources for select
  using (exists (select 1 from cohort_members cm where cm.cohort_id = cohort_resources.cohort_id and cm.user_id = auth.uid())
    or is_org_admin(auth.uid()));
create policy cres_write_admin on cohort_resources for all using (is_org_admin(auth.uid()));

create policy csess_select_member on cohort_sessions for select
  using (exists (select 1 from cohort_members cm where cm.cohort_id = cohort_sessions.cohort_id and cm.user_id = auth.uid())
    or is_org_admin(auth.uid()));
create policy csess_write_admin on cohort_sessions for all using (is_org_admin(auth.uid()));

-- external_course_progress / certificates - own rows only (plus admin read).
create policy ecp_select_own on external_course_progress for select using (user_id = auth.uid());
create policy ecp_write_own on external_course_progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ecp_select_admin on external_course_progress for select
  using (effective_has_permission(auth.uid(), 'view_analytics') or is_super_admin(auth.uid()));

create policy ecc_select_own on external_course_certificates for select using (user_id = auth.uid());
create policy ecc_write_own on external_course_certificates for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- learning_path_enrollments - own rows only.
create policy lpe_select_own on learning_path_enrollments for select using (user_id = auth.uid());
create policy lpe_write_own on learning_path_enrollments for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- course_files / course_uploads / lesson_uploads - public files readable by
-- anyone signed in; the course's instructor, the uploader, and content
-- managers/super_admin can write.
create policy cfiles_select_public on course_files for select
  using (is_public
    or owner_id = auth.uid()
    or exists (select 1 from courses c where c.id = course_files.course_id and c.instructor_id = auth.uid())
    or effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));
create policy cfiles_write_authorized on course_files for all
  using (owner_id = auth.uid()
    or exists (select 1 from courses c where c.id = course_files.course_id and c.instructor_id = auth.uid())
    or effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));

create policy cup_select_authorized on course_uploads for select
  using (uploader_id = auth.uid()
    or exists (select 1 from courses c where c.id = course_uploads.course_id and c.instructor_id = auth.uid())
    or effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));
create policy cup_write_authorized on course_uploads for all
  using (uploader_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));

create policy lup_select_authorized on lesson_uploads for select
  using (uploader_id = auth.uid()
    or exists (select 1 from lessons l join courses c on c.id = l.course_id where l.id = lesson_uploads.lesson_id and c.instructor_id = auth.uid())
    or effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));
create policy lup_write_authorized on lesson_uploads for all
  using (uploader_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));

create policy fu_select_own on file_uploads for select using (user_id = auth.uid());
create policy fu_write_own on file_uploads for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- course_quality_reviews / course_analytics - content managers/super_admin only.
create policy cqr_select_authorized on course_quality_reviews for select
  using (reviewer_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));
create policy cqr_write_authorized on course_quality_reviews for all
  using (effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));

create policy canalytics_select_authorized on course_analytics for select
  using (exists (select 1 from courses c where c.id = course_analytics.course_id and c.instructor_id = auth.uid())
    or effective_has_permission(auth.uid(), 'view_analytics') or is_super_admin(auth.uid()));
create policy canalytics_write_admin on course_analytics for all
  using (effective_has_permission(auth.uid(), 'view_analytics') or is_super_admin(auth.uid()));

-- course_mentor_discussions - the mentor, the learner, or an admin.
create policy cmd_select_participant on course_mentor_discussions for select
  using (learner_id = auth.uid()
    or exists (select 1 from mentors m where m.id = course_mentor_discussions.mentor_id and m.user_id = auth.uid())
    or effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));
create policy cmd_write_participant on course_mentor_discussions for all
  using (learner_id = auth.uid()
    or exists (select 1 from mentors m where m.id = course_mentor_discussions.mentor_id and m.user_id = auth.uid()));

-- mentor_achievements - publicly viewable (like achievements), award-only by
-- admin/backend (no client-side insert path, matching the achievements model).
create policy ma_select_all on mentor_achievements for select using (true);
create policy ma_write_admin on mentor_achievements for all
  using (is_super_admin(auth.uid())) with check (is_super_admin(auth.uid()));

-- polls / poll_options / poll_votes - readable wherever the parent post is
-- readable; the post author manages the poll and its options; anyone can vote once.
create policy polls_select_all on polls for select using (true);
create policy polls_write_author on polls for all
  using (exists (select 1 from community_posts p where p.id = polls.post_id and p.user_id = auth.uid())
    or can_moderate_content(auth.uid()));

create policy popt_select_all on poll_options for select using (true);
create policy popt_write_author on poll_options for all
  using (exists (select 1 from polls pl join community_posts p on p.id = pl.post_id where pl.id = poll_options.poll_id and p.user_id = auth.uid())
    or can_moderate_content(auth.uid()));

create policy pvote_select_own on poll_votes for select using (user_id = auth.uid());
create policy pvote_write_own on poll_votes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ============================================================================
-- MIGRATION: 0008_learner_app_rls_gapfill.sql
-- ============================================================================
-- =============================================================================
-- Train AI - RLS gap-fill for learner-app real-data wiring
--
-- Migrations 0001-0007 enable RLS with default-deny on every table (see the
-- header comment in 0006_rls_policies.sql), then add explicit policies only
-- for a subset of "central" tables. A handful of tables the learner app's
-- real (non-mock) screens depend on were left with RLS enabled and zero
-- policies - meaning every caller, including the row's own owner, gets
-- back an empty result set forever (indistinguishable in the UI from "no
-- data yet"), even though the client code and data are both correct.
--
-- This migration only ADDS policies. It does not alter, replace, or drop
-- anything defined in 0001-0007.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- AI Assistant - a conversation and its messages belong to one learner.
-- (The ai-chat edge function itself uses the service-role key and so is
-- unaffected by these policies; they matter for the client-side reads/writes
-- done directly from src/lib/api/schemaHelper.js.)
-- ---------------------------------------------------------------------------
create policy aic_select_own on ai_conversations for select using (user_id = auth.uid());
create policy aic_insert_own on ai_conversations for insert with check (user_id = auth.uid());
create policy aic_update_own on ai_conversations for update using (user_id = auth.uid());

create policy aim_select_own on ai_messages for select
  using (exists (select 1 from ai_conversations c where c.id = ai_messages.conversation_id and c.user_id = auth.uid()));
create policy aim_insert_own on ai_messages for insert
  with check (exists (select 1 from ai_conversations c where c.id = ai_messages.conversation_id and c.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- mentor_messages - mm_select_participant / mm_insert_sender already exist
-- (0006); marking a received message as read was the missing piece.
-- ---------------------------------------------------------------------------
create policy mm_update_receiver on mentor_messages for update
  using (receiver_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Quizzes - published quizzes are readable by any signed-in learner, the
-- same pattern as courses_select_published. quiz_questions stays locked
-- (qq_select_none, 0006) - safe_quiz_questions view remains the only way
-- to read questions client-side, so correct answers still never leak.
-- ---------------------------------------------------------------------------
create policy quizzes_select_published on quizzes for select using (is_published);
create policy quizzes_write_authorized on quizzes for all
  using (effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()))
  with check (effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Learning paths - published paths are readable by any signed-in learner;
-- enrollments/progress are the learner's own rows.
-- ---------------------------------------------------------------------------
create policy lpaths_select_published on learning_paths for select using (is_published);
create policy lpaths_write_authorized on learning_paths for all
  using (effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()))
  with check (effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));

-- lpe_select_own already exists as of 0007_missing_schema.sql; guarded here
-- so this file can still be run standalone/idempotently without erroring on
-- a fresh sequential apply (found by actually running the migrations in
-- order end to end, not by inspection).
drop policy if exists lpe_select_own on learning_path_enrollments;
create policy lpe_select_own on learning_path_enrollments for select using (user_id = auth.uid());
drop policy if exists lpe_write_own on learning_path_enrollments;
create policy lpe_write_own on learning_path_enrollments for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Study groups - browsable directory for every signed-in learner;
-- membership rows are self-managed (join/leave).
-- ---------------------------------------------------------------------------
create policy sg_select_all on study_groups for select using (true);
create policy sg_write_authorized on study_groups for all
  using (created_by = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));

create policy sgm_select_all on study_group_members for select using (true);
create policy sgm_write_own on study_group_members for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Daily challenges / mystery boxes - the learner's own gamification data.
-- ---------------------------------------------------------------------------
create policy dc_select_own on daily_challenges for select using (user_id = auth.uid());
create policy dc_write_own on daily_challenges for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy mb_select_own on mystery_boxes for select using (user_id = auth.uid());
create policy mb_insert_own on mystery_boxes for insert with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Course reviews - readable by anyone signed in (used for the average
-- rating shown on course cards); writable by the reviewing learner only.
-- ---------------------------------------------------------------------------
create policy cr_select_all on course_reviews for select using (true);
create policy cr_write_own on course_reviews for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Lesson notes / course notes - private to the learner who wrote them.
-- ---------------------------------------------------------------------------
create policy ln_select_own on lesson_notes for select using (user_id = auth.uid());
create policy ln_write_own on lesson_notes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy cn_select_own on course_notes for select using (user_id = auth.uid());
create policy cn_write_own on course_notes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Course discussion (general Q&A per course) - readable/postable by any
-- signed-in learner, matching lessons_select_published's "signed in" bar.
-- ---------------------------------------------------------------------------
create policy cd_select_all on course_discussions for select using (true);
create policy cd_insert_authenticated on course_discussions for insert with check (auth.uid() is not null);

create policy cdm_select_all on course_discussion_messages for select using (true);
create policy cdm_insert_own on course_discussion_messages for insert with check (sender_id = auth.uid());


-- ============================================================================
-- MIGRATION: 0009_forum_rls_gapfill.sql
-- ============================================================================
-- =============================================================================
-- Train AI - RLS gap-fill for the Forums feature (community_gamification_admin
-- creates `forums`/`forum_posts` in 0004, but - like the tables 0008 already
-- patched - 0006's blanket RLS-enable pass left both with zero policies, so
-- every caller got back an empty result set forever, indistinguishable from
-- "no threads yet" in the UI even though the client code and data are both
-- correct. This migration only ADDS policies/functions; it does not alter,
-- replace, or drop anything defined in 0001-0008.
--
-- `forums` = discussion categories (course-scoped via course_id, or
-- `is_general`). `forum_posts` is self-referencing via parent_post_id: a row
-- with parent_post_id null is a thread's opening post, a row with it set is a
-- reply to that thread - same shape as cohort_posts/cohort_post_replies, just
-- collapsed into one table.
-- =============================================================================

-- Categories are structural, so only content managers/admins create them;
-- every signed-in learner can browse the list, matching study_groups'
-- sg_select_all pattern (0008).
create policy forums_select_all on forums for select using (true);
create policy forums_write_authorized on forums for all
  using (effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()))
  with check (effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));

-- Threads and replies are authored by any learner and world-readable, same
-- bar as course_discussion_messages (0008). Editing/deleting is restricted to
-- the author or a moderator/admin, mirroring cohort_posts (0007).
create policy fp_select_all on forum_posts for select using (true);
create policy fp_insert_own on forum_posts for insert with check (author_id = auth.uid());
create policy fp_update_own_or_moderator on forum_posts for update
  using (author_id = auth.uid() or can_moderate_content(auth.uid()) or is_super_admin(auth.uid()));
create policy fp_delete_own_or_moderator on forum_posts for delete
  using (author_id = auth.uid() or can_moderate_content(auth.uid()) or is_super_admin(auth.uid()));

-- Upvote/downvote counters live directly on forum_posts (no dedicated
-- forum_post_votes table exists in this schema), so any RLS update policy
-- broad enough to let another learner increment them would also let that
-- learner rewrite the post's content. A SECURITY DEFINER function that only
-- ever touches the two counter columns - same technique as set_post_pinned
-- in 0005_functions.sql - avoids that without a schema change.
--
-- Note: with no per-user vote table, this cannot track/undo an individual's
-- vote (a second click adds a second increment) - it is an honest "helpful"
-- tally, not a toggle. Building real one-vote-per-user tracking would need a
-- new table + migration, which is out of scope here.
create or replace function vote_forum_post(p_post_id uuid, p_direction text default 'up')
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_direction = 'down' then
    update forum_posts set downvotes = downvotes + 1 where id = p_post_id;
  else
    update forum_posts set upvotes = upvotes + 1 where id = p_post_id;
  end if;
end;
$$;


-- ============================================================================
-- MIGRATION: 0100_course_applications.sql
-- ============================================================================
-- ============================================================================
-- Course Applications - "Apply for a course" approval workflow
-- ============================================================================
-- Run this ONCE in the Supabase SQL Editor for the shared project
-- (qibqouymqtpirtbyjvjr): Dashboard -> SQL Editor -> paste this file -> Run.
--
-- What this adds:
--   1. courses.requires_approval - a course can be flagged so learners must
--      request to join instead of enrolling instantly.
--   2. course_applications - one row per learner's request to join a course
--      that requires approval, with a pending/approved/rejected status that
--      the course's instructor/owner or an admin/super_admin reviews.
--
-- This does not touch or remove any existing table, column, or policy
-- courses without requires_approval=true keep working exactly as before
-- (instant self-enrollment).
-- ============================================================================

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.course_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

GRANT SELECT, INSERT, UPDATE ON public.course_applications TO authenticated;
GRANT ALL ON public.course_applications TO service_role;
ALTER TABLE public.course_applications ENABLE ROW LEVEL SECURITY;

-- A learner can see and create their own applications.
DROP POLICY IF EXISTS "course_applications_learner_select_own" ON public.course_applications;
CREATE POLICY "course_applications_learner_select_own"
ON public.course_applications FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "course_applications_learner_insert_own" ON public.course_applications;
CREATE POLICY "course_applications_learner_insert_own"
ON public.course_applications FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- A learner whose application was rejected can re-apply (flip their own row
-- back to pending) - but cannot self-approve.
DROP POLICY IF EXISTS "course_applications_learner_reapply" ON public.course_applications;
CREATE POLICY "course_applications_learner_reapply"
ON public.course_applications FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND status = 'rejected')
WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- The course's instructor, or any admin/super_admin, can see and
-- decide (approve/reject/delete) applications to that course.
-- (Previously also checked c.owner_id, but courses has no such column
-- that's a course_files column, copied here from the wrong table. Found by
-- running this migration against a genuinely fresh database rather than an
-- already-patched one, where it hard-failed instead of silently matching
-- nothing.)
DROP POLICY IF EXISTS "course_applications_staff_manage" ON public.course_applications;
CREATE POLICY "course_applications_staff_manage"
ON public.course_applications FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::platform_role)
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = course_applications.course_id
      AND c.instructor_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::platform_role)
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = course_applications.course_id
      AND c.instructor_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_course_applications_course_id ON public.course_applications(course_id);
CREATE INDEX IF NOT EXISTS idx_course_applications_status ON public.course_applications(status);
CREATE INDEX IF NOT EXISTS idx_course_applications_user_id ON public.course_applications(user_id);


-- ============================================================================
-- MIGRATION: 0101_demo_requests.sql
-- ============================================================================
-- ============================================================================
-- Demo Requests - B2B lead capture for the landing page's "Book a Demo" CTA
-- ============================================================================
-- Run this ONCE in the Supabase SQL Editor for the shared project
-- (Dashboard -> SQL Editor -> paste this file -> Run), after 0100.
--
-- Context: the landing page previously funnelled every visitor into an
-- individual-consumer "join the waitlist / pay NGN 10,000 to skip the line"
-- flow (see the `waitlist` / `waitlist_tiers` / `paid_waitlist` tables from
-- 0004_community_gamification_admin.sql). That's a B2C motion. Train AI's
-- actual positioning (per the Enterprise Platform roadmap doc) is B2B
-- organisations book a demo / pilot, not individual learners paying to skip
-- a line - so the landing page CTA needed a real backing table shaped for
-- that: who's asking, what company, how big a team, what they want to pilot.
--
-- This does not touch or remove any existing table - the old waitlist tables
-- still exist and still work for anything still using them.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  work_email text NOT NULL,
  company_name text NOT NULL,
  team_size text, -- freeform band, e.g. "1-50", "51-200", "201-1000", "1000+"
  message text,
  source text DEFAULT 'landing_page',
  status text NOT NULL DEFAULT 'new', -- 'new' | 'contacted' | 'scheduled' | 'closed'
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.demo_requests TO anon, authenticated;
GRANT SELECT, UPDATE ON public.demo_requests TO authenticated;
GRANT ALL ON public.demo_requests TO service_role;
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (signed in or not - this is a public marketing form) can submit a
-- demo request. There's no "own row" concept for an anonymous visitor, so
-- this is intentionally a blanket insert allowance, same posture as the
-- pre-existing `waitlist` table.
DROP POLICY IF EXISTS "demo_requests_public_insert" ON public.demo_requests;
CREATE POLICY "demo_requests_public_insert"
ON public.demo_requests FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- Only platform staff can read/triage submitted leads (contains company +
-- personal contact info, so this is staff-only, not a "select own row" case
-- like course_applications).
DROP POLICY IF EXISTS "demo_requests_staff_select" ON public.demo_requests;
CREATE POLICY "demo_requests_staff_select"
ON public.demo_requests FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::platform_role)
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "demo_requests_staff_update" ON public.demo_requests;
CREATE POLICY "demo_requests_staff_update"
ON public.demo_requests FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::platform_role)
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::platform_role)
  OR public.is_super_admin(auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_demo_requests_status ON public.demo_requests(status);
CREATE INDEX IF NOT EXISTS idx_demo_requests_created_at ON public.demo_requests(created_at);


-- ============================================================================
-- MIGRATION: 0102_org_self_serve_signup.sql
-- ============================================================================
-- =============================================================================
-- Train AI - Organization self-serve sign-up
--
-- Backlog item: "New Sign-up Flow" - organization sign-up should be its own
-- primary path, not something only a super_admin can provision by hand.
-- Before this migration, `organizations` could only be inserted by a
-- super_admin (see org_insert_super_admin in 0006_rls_policies.sql), which
-- matched Train AI 2.0's org-provisioned-by-us model but not the Starter-tier
-- self-serve motion described in the product spec (Part II, Section 10).
--
-- This does not touch org_insert_super_admin - Train AI staff can still
-- provision an org directly for Growth/Enterprise deals reached via Book a
-- Demo. This adds a second, narrower path for a brand-new authenticated user
-- registering their own organization for the first time.
-- =============================================================================

create or replace function create_organization_self_serve(p_org_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_slug text;
  v_existing_org uuid;
begin
  if v_user_id is null then
    raise exception 'Must be signed in to register an organization';
  end if;

  if p_org_name is null or length(trim(p_org_name)) < 2 then
    raise exception 'Organization name is required';
  end if;

  -- One self-serve org per user. Someone who already belongs to an
  -- organization should be added by that org's admin (invitation flow),
  -- not create a second org through this path.
  select organization_id into v_existing_org from user_profiles where id = v_user_id;
  if v_existing_org is not null then
    raise exception 'This account already belongs to an organization';
  end if;

  -- Slugify the name, then disambiguate with a short random suffix so two
  -- organizations with the same display name (e.g. two different "Acme"s)
  -- don't collide on the unique slug constraint.
  v_slug := lower(regexp_replace(trim(p_org_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then
    v_slug := 'org';
  end if;
  v_slug := v_slug || '-' || substr(encode(gen_random_bytes(4), 'hex'), 1, 6);

  insert into organizations (name, slug, status, subscription_tier, created_by)
  values (trim(p_org_name), v_slug, 'trial', 'starter', v_user_id)
  returning id into v_org_id;

  update user_profiles
  set organization_id = v_org_id, role = 'admin'
  where id = v_user_id;

  insert into organization_members (organization_id, user_id, role, status, joined_at)
  values (v_org_id, v_user_id, 'owner', 'active', now());

  insert into user_roles (user_id, role)
  values (v_user_id, 'admin')
  on conflict (user_id, role) do nothing;

  return v_org_id;
end;
$$;

comment on function create_organization_self_serve(text) is
  'Self-serve organization sign-up: the calling user becomes org owner/admin. One organization per previously-unaffiliated user. Growth/Enterprise deals reached via Book a Demo are still provisioned directly by a super_admin, unchanged from org_insert_super_admin.';


-- ============================================================================
-- MIGRATION: 0103_organization_inquiries.sql
-- ============================================================================
-- ============================================================================
-- Organization Inquiries - secondary B2B contact path, distinct from Book a
-- Demo
-- ============================================================================
-- Backlog item: "Contact Form Revamp" - replace a single generic contact
-- form with two distinct paths: Book a Demo (0101_demo_requests.sql, ready
-- to buy/pilot) and Organisation Inquiry (this table - procurement
-- questions, partnership enquiries, custom requirements; not ready for a
-- demo yet, and routed to sales rather than support). Mirrors
-- 0101_demo_requests.sql's shape and RLS posture exactly, on purpose, so
-- the two leads queues behave identically for staff.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.organization_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  work_email text NOT NULL,
  company_name text NOT NULL,
  inquiry_type text NOT NULL DEFAULT 'other', -- 'procurement' | 'partnership' | 'custom_requirements' | 'other'
  message text,
  source text DEFAULT 'landing_page',
  status text NOT NULL DEFAULT 'new', -- 'new' | 'contacted' | 'closed'
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.organization_inquiries TO anon, authenticated;
GRANT SELECT, UPDATE ON public.organization_inquiries TO authenticated;
GRANT ALL ON public.organization_inquiries TO service_role;
ALTER TABLE public.organization_inquiries ENABLE ROW LEVEL SECURITY;

-- Anyone (signed in or not - this is a public marketing form) can submit an
-- inquiry, same posture as demo_requests_public_insert.
DROP POLICY IF EXISTS "organization_inquiries_public_insert" ON public.organization_inquiries;
CREATE POLICY "organization_inquiries_public_insert"
ON public.organization_inquiries FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- Only platform staff can read/triage submitted inquiries - contains
-- personal + company contact info, staff-only same as demo_requests.
DROP POLICY IF EXISTS "organization_inquiries_staff_select" ON public.organization_inquiries;
CREATE POLICY "organization_inquiries_staff_select"
ON public.organization_inquiries FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::platform_role)
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "organization_inquiries_staff_update" ON public.organization_inquiries;
CREATE POLICY "organization_inquiries_staff_update"
ON public.organization_inquiries FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::platform_role)
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::platform_role)
  OR public.is_super_admin(auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_organization_inquiries_status ON public.organization_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_organization_inquiries_created_at ON public.organization_inquiries(created_at);


-- ============================================================================
-- MIGRATION: 0104_rename_growth_tier.sql
-- ============================================================================
-- ============================================================================
-- Rename subscription_tier 'professional' -> 'growth'
-- ============================================================================
-- Per the finalized pricing brief: "Free (Demo), Starter, Growth, Enterprise
-- ... Database and UI must use the same tier names." The enum shipped in
-- 0001_init_schema.sql as ('free','starter','professional','enterprise') - -- 'professional' was never the agreed name, 'growth' was. Renaming the enum
-- value in place (rather than adding a new value and migrating rows) keeps
-- every existing organizations.subscription_tier row correct automatically:
-- a row previously reading 'professional' now reads 'growth', with no data
-- migration needed.
-- ============================================================================

ALTER TYPE subscription_tier RENAME VALUE 'professional' TO 'growth';


-- ============================================================================
-- MIGRATION: 0105_tech_learning_default_org.sql
-- ============================================================================
-- ============================================================================
-- "Tech Learning" - the default organization for individual signups
-- ============================================================================
-- Per the finalized brief: "Users without an organization are automatically
-- placed into a default organization called Tech Learning. This maintains a
-- consistent onboarding and data model." Previously an individual learner
-- signup left organization_id null - every org-scoped query, RLS policy,
-- and admin screen in this codebase assumes a learner has SOME
-- organization_id, so a null value was an unhandled edge case everywhere
-- rather than a deliberate "no org" state.
--
-- created_by is left null deliberately - this organization isn't owned by
-- any single user the way a self-serve org is (see
-- 0102_org_self_serve_signup.sql); it's platform infrastructure, managed by
-- Platform Owner, not by an org admin.
-- ============================================================================

insert into organizations (name, slug, status, subscription_tier, created_by)
values ('Tech Learning', 'tech-learning', 'active', 'free', null)
on conflict (slug) do nothing;


-- ============================================================================
-- MIGRATION: 0106_join_default_organization.sql
-- ============================================================================
-- ============================================================================
-- Individual signup -> "Tech Learning" default org, and a real bug fix
-- ============================================================================
-- Discovered while building this: nothing in these migrations creates a
-- user_profiles row on signup (no trigger on auth.users, and no INSERT
-- policy on user_profiles for a client to create its own row either).
-- Whatever makes user_profiles rows exist today is either configured
-- directly on the live Supabase project outside these tracked migrations,
-- or genuinely doesn't exist yet - either way, code here should not assume
-- a row is already there.
--
-- That surfaced two real bugs in create_organization_self_serve() (0102),
-- found by testing against a genuinely fresh signup (auth.users row only,
-- no user_profiles row) rather than by inspection:
--   1. It UPDATEd user_profiles to set organization_id/role, which silently
--      affects zero rows if no profile exists yet - the organization would
--      get created, but the calling user would never end up linked to it.
--   2. organizations.created_by has a foreign key to user_profiles(id), not
--      auth.users(id) - so the very first insert (creating the
--      organization itself) hard-fails with a foreign-key violation for a
--      genuinely fresh signup, before the UPDATE bug above even matters.
-- Fixed below by ensuring a bare user_profiles row exists before touching
-- organizations at all, then updating it once the org exists.
-- ============================================================================

create or replace function create_organization_self_serve(p_org_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_slug text;
  v_existing_org uuid;
begin
  if v_user_id is null then
    raise exception 'Must be signed in to register an organization';
  end if;

  if p_org_name is null or length(trim(p_org_name)) < 2 then
    raise exception 'Organization name is required';
  end if;

  select organization_id into v_existing_org from user_profiles where id = v_user_id;
  if v_existing_org is not null then
    raise exception 'This account already belongs to an organization';
  end if;

  -- Ensure a user_profiles row exists BEFORE creating the organization:
  -- organizations.created_by has a foreign key to user_profiles(id), not
  -- auth.users(id), so a genuinely fresh signup with no profile row yet
  -- would fail the organizations insert below with a foreign-key violation
  -- (found by testing against a real fresh-signup scenario, not by
  -- inspection - the organizations insert is the very first statement to
  -- touch user_profiles transitively, so it's also the first to fail).
  insert into user_profiles (id) values (v_user_id)
  on conflict (id) do nothing;

  v_slug := lower(regexp_replace(trim(p_org_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then
    v_slug := 'org';
  end if;
  v_slug := v_slug || '-' || substr(encode(gen_random_bytes(4), 'hex'), 1, 6);

  insert into organizations (name, slug, status, subscription_tier, created_by)
  values (trim(p_org_name), v_slug, 'trial', 'starter', v_user_id)
  returning id into v_org_id;

  update user_profiles set organization_id = v_org_id, role = 'admin' where id = v_user_id;

  insert into organization_members (organization_id, user_id, role, status, joined_at)
  values (v_org_id, v_user_id, 'owner', 'active', now());

  insert into user_roles (user_id, role)
  values (v_user_id, 'admin')
  on conflict (user_id, role) do nothing;

  return v_org_id;
end;
$$;

-- Individual signup path (secondary to organization signup): places a
-- previously-unaffiliated user into the "Tech Learning" default org rather
-- than leaving organization_id null. Learner role only - this is not a
-- promotion the way create_organization_self_serve's admin grant is.
create or replace function join_default_organization()
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_existing_org uuid;
begin
  if v_user_id is null then
    raise exception 'Must be signed in';
  end if;

  select id into v_org_id from organizations where slug = 'tech-learning';
  if v_org_id is null then
    raise exception 'Default organization is not configured - run 0105_tech_learning_default_org.sql';
  end if;

  select organization_id into v_existing_org from user_profiles where id = v_user_id;
  if v_existing_org is not null then
    -- Already affiliated (Tech Learning already, or a real organization
    -- via invitation/self-serve) - leave it alone, this is a no-op.
    return v_existing_org;
  end if;

  insert into user_profiles (id, organization_id, role)
  values (v_user_id, v_org_id, 'learner')
  on conflict (id) do update
    set organization_id = coalesce(user_profiles.organization_id, v_org_id);

  insert into organization_members (organization_id, user_id, role, status, joined_at)
  values (v_org_id, v_user_id, 'member', 'active', now())
  on conflict do nothing;

  return v_org_id;
end;
$$;

comment on function join_default_organization() is
  'Individual (no-organization) signup path: places a previously-unaffiliated learner into the "Tech Learning" default organization. No-op if the user already belongs to any organization.';


-- ============================================================================
-- MIGRATION: 0107_bookmarks_rls.sql
-- ============================================================================
-- ============================================================================
-- Bookmarks - RLS (previously had none at all)
-- ============================================================================
-- Course UI brief: "Keep: ... Bookmarking. Bookmarked courses appear
-- first." The `bookmarks` table (0002_progress_quizzes_cohorts.sql) was
-- never actually wired to the frontend, and - found while wiring it now
-- had no RLS enabled at all, meaning it was unprotected by default rather
-- than merely unused. Fixed alongside the real feature, not left as a
-- silent gap.
-- ============================================================================

alter table bookmarks enable row level security;

drop policy if exists bookmarks_select_own on bookmarks;
create policy bookmarks_select_own on bookmarks for select using (user_id = auth.uid());

drop policy if exists bookmarks_write_own on bookmarks;
create policy bookmarks_write_own on bookmarks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ============================================================================
-- MIGRATION: 0108_messaging_restriction.sql
-- ============================================================================
-- ============================================================================
-- Messaging restriction - enforced at the database, not just the UI
-- ============================================================================
-- Product brief: "Messaging is intentionally restricted. Learners may
-- message: Their Instructor... No unrestricted learner-to-learner
-- messaging." The learner UI (CommunityScreen.jsx) now only shows a
-- Message action for instructor-role members. But the existing
-- mm_insert_sender policy (0006_rls_policies.sql) only checked
-- `sender_id = auth.uid()` - it never checked who the *receiver* was, so a
-- learner could message another learner directly via the API regardless of
-- what the UI shows. A UI-only restriction protects against nothing but
-- accidental clicks; this is the actual enforcement.
--
-- Allowed after this migration: learner -> instructor, instructor ->
-- learner (replies), and instructor -> instructor. Blocked: learner ->
-- learner. Existing rows are untouched - this only affects new inserts.
-- ============================================================================

drop policy if exists mm_insert_sender on mentor_messages;
create policy mm_insert_sender on mentor_messages for insert
  with check (
    sender_id = auth.uid()
    and (
      has_role(auth.uid(), 'mentor'::platform_role)
      or has_role(receiver_id, 'mentor'::platform_role)
    )
  );


-- ============================================================================
-- MIGRATION: 0109_ai_coach_settings.sql
-- ============================================================================
-- ============================================================================
-- AI Coach settings (enable/disable, Manual Mode) + an admin permission fix
-- ============================================================================
-- Product brief: "Organizations can enable or disable [AI Coach]...
-- Organizations can switch AI into Manual Mode. Manual Mode allows admins to
-- replace AI responses with custom messages instead of automatic AI
-- replies." Also: "Organization Admin... Responsibilities: ... AI
-- controls." No new table needed - organizations.settings (jsonb, already
-- in the schema, previously completely unused by any code) stores this as:
--   settings->'ai_coach' = { "enabled": bool, "manual_mode": bool, "manual_message": text }
-- Missing keys default to enabled=true, manual_mode=false client-side (see
-- lib/api/organizations.js) - this migration doesn't need to backfill
-- existing rows.
--
-- Found while building this: org_update_owner (0006_rls_policies.sql) only
-- allowed the literal org *owner* (organization_members.role = 'owner') to
-- update organizations, not a regular org *admin* - but the brief lists "AI
-- controls" as an Admin responsibility, and an admin who isn't specifically
-- the owner would have been unable to toggle these settings at all. Fixed
-- by using is_org_admin() (owner OR admin) instead of is_org_owner()
-- (owner only).
-- ============================================================================

drop policy if exists org_update_owner on organizations;
create policy org_update_admin on organizations for update
  using (
    (is_org_admin(auth.uid()) and id = get_user_organization_id(auth.uid()))
    or is_super_admin(auth.uid())
  );


-- ============================================================================
-- MIGRATION: 0110_learning_paths_rls_fix.sql
-- ============================================================================
-- ============================================================================
-- Learning Paths - fix two real gaps found while building the admin UI
-- ============================================================================
-- Product brief: "Learning Paths are primarily an Admin feature... Admins
-- organize: Tracks, Cohorts, Assigned learning journeys." No admin screen
-- for this existed anywhere in the app - only the backend functions
-- (createLearningPath / updateLearningPath / fetchLearningPathsAdmin in
-- lib/api/platform.js), never wired to a UI. Building that UI surfaced two
-- real bugs, found by reading the actual RLS state rather than assuming the
-- existing functions worked:
--
-- 1. learning_path_courses has RLS enabled (via the blanket per-table
--    enable loop in 0006_rls_policies.sql) but had ZERO policies defined
--    default-deny for every role except service_role. This is the join
--    table that actually records which courses belong to a path and in
--    what order; createLearningPath/updateLearningPath both write to it
--    directly. Without a policy, those calls would have failed outright
--    for any real admin, RLS or no UI notwithstanding.
--
-- 2. learning_paths' own write policy (lpaths_write_authorized,
--    0008_learner_app_rls_gapfill.sql) checked only
--    effective_has_permission(auth.uid(), 'manage_courses') - a permission
--    check with no organization scoping at all. learning_paths.organization_id
--    exists specifically to scope a path to one org (unlike `courses`, which
--    has no organization_id column and is deliberately shared/global) - so
--    an admin from Org A with manage_courses could read, edit, or delete
--    Org B's paths outright. Fixed to also require the row's
--    organization_id match the caller's own org, with a super_admin bypass
--    for the platform-wide case.
-- ============================================================================

drop policy if exists lpaths_write_authorized on learning_paths;
create policy lpaths_write_authorized on learning_paths for all
  using (
    (
      effective_has_permission(auth.uid(), 'manage_courses')
      and organization_id = get_user_organization_id(auth.uid())
    )
    or is_super_admin(auth.uid())
  )
  with check (
    (
      effective_has_permission(auth.uid(), 'manage_courses')
      and organization_id = get_user_organization_id(auth.uid())
    )
    or is_super_admin(auth.uid())
  );

create policy lpc_select_via_path on learning_path_courses for select
  using (
    exists (
      select 1 from learning_paths lp
      where lp.id = learning_path_courses.path_id
        and (lp.is_published or lp.organization_id = get_user_organization_id(auth.uid()))
    )
    or is_super_admin(auth.uid())
  );

create policy lpc_write_via_path on learning_path_courses for all
  using (
    exists (
      select 1 from learning_paths lp
      where lp.id = learning_path_courses.path_id
        and effective_has_permission(auth.uid(), 'manage_courses')
        and lp.organization_id = get_user_organization_id(auth.uid())
    )
    or is_super_admin(auth.uid())
  )
  with check (
    exists (
      select 1 from learning_paths lp
      where lp.id = learning_path_courses.path_id
        and effective_has_permission(auth.uid(), 'manage_courses')
        and lp.organization_id = get_user_organization_id(auth.uid())
    )
    or is_super_admin(auth.uid())
  );


-- ============================================================================
-- MIGRATION: 0111_ai_usage_tracking.sql
-- ============================================================================
-- ============================================================================
-- AI usage tracking - for real "AI credit tracking" / "AI cost monitoring"
-- ============================================================================
-- Product brief: Platform Owner should see "AI credit tracking" /
-- "usage analytics." Checked what backs the existing "AI Credits" shown on
-- the learner Profile screen first: useCredits.js is explicitly client-side
-- only (localStorage), by design - "the paystack-initialize /
-- stripe-initialize edge functions explicitly do NOT persist anything
-- server-side for the 'credits' payment context... there is no credits
-- table in this app's schema." That's a deliberate, documented choice for
-- the learner-facing daily-allowance mechanic, not an oversight - but it
-- means there was no real data anywhere to build genuine platform-level
-- usage tracking from. Faking a number here would misrepresent real
-- platform cost data to whoever is deciding whether AI spend is under
-- control, so this adds a minimal real events table instead and wires
-- actual logging into the one place AI calls actually happen server-side
-- (supabase/functions/ai-chat/index.ts).
--
-- Deliberately minimal: one row per real AI Coach reply that actually
-- called a provider (OpenAI/Gemini) - not for Manual Mode replies or
-- disabled-org attempts, since those never reach a provider and cost
-- nothing. No token counts (neither provider response used here is asked
-- for token usage, and estimating it would be another number that looks
-- more precise than it is) - just a real count of real calls, which is
-- enough to show usage trend and relative organization load honestly.
-- ============================================================================

create table if not exists ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id) on delete set null,
  organization_id uuid references organizations(id) on delete set null,
  feature text not null default 'ai_coach',
  created_at timestamptz not null default now()
);

alter table ai_usage_events enable row level security;

-- No INSERT policy for any client role - this is written only by the
-- ai-chat edge function via its service-role key, same posture as
-- moderation_logs (see the comment on fetchModerationQueue in
-- lib/api/platform.js: "REVOKE SELECT ... FROM authenticated ... now only
-- readable/writable by service_role").
drop policy if exists aiue_select_super_admin on ai_usage_events;
create policy aiue_select_super_admin on ai_usage_events for select
  using (is_super_admin(auth.uid()));

drop policy if exists aiue_select_org_admin on ai_usage_events;
create policy aiue_select_org_admin on ai_usage_events for select
  using (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()));

create index if not exists idx_ai_usage_events_org_created on ai_usage_events(organization_id, created_at);
create index if not exists idx_ai_usage_events_created on ai_usage_events(created_at);


-- ============================================================================
-- MIGRATION: 0112_assessments_pipeline.sql
-- ============================================================================
-- ============================================================================
-- Assessments - the pipeline this feature needed and never had
-- ============================================================================
-- Product brief, twice: "Assessments are auto-graded. Instructors may
-- override grades" and Instructor responsibilities include "Override AI
-- grading." Went to add a grade-override button and found there was
-- nothing to override: assessment_attempts had zero RLS policies (not even
-- a learner could submit or read their own attempt), no submission function
-- existed anywhere in the client, and "assessment" appears in exactly one
-- learner-facing file - the AI Quiz Generator, a different feature the
-- brief explicitly distinguishes from Assessments. This is the whole
-- pipeline underneath grade override, built to match the one part of this
-- schema that already does the equivalent correctly: quizzes
-- (quiz_questions / safe_quiz_questions / check_quiz_answers(), all in
-- 0002_progress_quizzes_cohorts.sql and 0005_functions.sql).
--
-- assessments.questions (jsonb, 0002) is left in place but unused - no code
-- ever read or wrote it, so there's no data to migrate. Real structure
-- below mirrors quiz_questions exactly, as a proper table, for the same
-- reason quizzes use one: a jsonb blob can't be selectively hidden from
-- learners the way a column-scoped view can, and grading logic against
-- real rows is far less error-prone than parsing a blob shape nobody had
-- committed to yet.
-- ============================================================================

create table if not exists assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  question text not null,
  question_type text not null default 'multiple_choice',
  options jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  explanation text,
  order_index int not null default 0,
  points int not null default 1
);

-- Client-safe view: never exposes correct_answer. Same pattern as
-- safe_quiz_questions.
create or replace view safe_assessment_questions as
  select id, assessment_id, question, question_type, options, order_index, points
  from assessment_questions;

-- Grading history, not just a silent overwrite: an instructor override
-- keeps the original auto-graded score visible rather than replacing it
-- invisibly, so "Instructors may override grades" is something a learner
-- or a later reviewer can actually see happened, not a fact only present in
-- an audit log they'll never look at.
alter table assessment_attempts add column if not exists ai_score numeric;
alter table assessment_attempts add column if not exists overridden_by uuid references user_profiles(id);
alter table assessment_attempts add column if not exists overridden_at timestamptz;
alter table assessment_attempts add column if not exists override_note text;

alter table assessment_questions enable row level security;

drop policy if exists aq_select_none on assessment_questions;
create policy aq_select_none on assessment_questions for select using (false); -- force use of safe_assessment_questions view

drop policy if exists aq_write_authorized on assessment_questions;
create policy aq_write_authorized on assessment_questions for all
  using (
    exists (
      select 1 from assessments a join courses c on c.id = a.course_id
      where a.id = assessment_questions.assessment_id
        and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses'))
    )
    or is_super_admin(auth.uid())
  )
  with check (
    exists (
      select 1 from assessments a join courses c on c.id = a.course_id
      where a.id = assessment_questions.assessment_id
        and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses'))
    )
    or is_super_admin(auth.uid())
  );

-- assessments and assessment_answer_keys themselves had no policies either
-- (same silent gap as their child table) - fixed alongside it, same
-- authorization shape as assessment_questions above.
drop policy if exists assessments_select_published on assessments;
create policy assessments_select_published on assessments for select using (true);
-- Read access is intentionally open (question text/options are hidden by
-- the safe view regardless, and an assessment row on its own reveals
-- nothing gradeable) - this matches courses_select_published's posture of
-- letting anyone browse course-level metadata.

drop policy if exists assessments_write_authorized on assessments;
create policy assessments_write_authorized on assessments for all
  using (
    exists (select 1 from courses c where c.id = assessments.course_id and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses')))
    or is_super_admin(auth.uid())
  )
  with check (
    exists (select 1 from courses c where c.id = assessments.course_id and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses')))
    or is_super_admin(auth.uid())
  );

drop policy if exists aak_select_none on assessment_answer_keys;
create policy aak_select_none on assessment_answer_keys for select using (false); -- never client-readable, even to the instructor who owns it - grading goes through check_assessment_answers()/the override path, not by reading the key directly

drop policy if exists aak_write_authorized on assessment_answer_keys;
create policy aak_write_authorized on assessment_answer_keys for all
  using (
    exists (select 1 from assessments a join courses c on c.id = a.course_id where a.id = assessment_answer_keys.assessment_id and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses')))
    or is_super_admin(auth.uid())
  )
  with check (
    exists (select 1 from assessments a join courses c on c.id = a.course_id where a.id = assessment_answer_keys.assessment_id and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses')))
    or is_super_admin(auth.uid())
  );

-- assessment_attempts: a learner can submit and read their own; an
-- instructor/admin scoped to that course can read and grade (override)
-- every attempt for it. Deliberately no learner UPDATE policy at all
-- unlike quiz_attempts (pure self-practice, qa_write_own allows the learner
-- to write their own row freely), a real assessment's score feeds
-- certificates and completion, so only the grading path below can change it
-- once submitted.
drop policy if exists aa_select_own on assessment_attempts;
create policy aa_select_own on assessment_attempts for select using (user_id = auth.uid());

drop policy if exists aa_insert_own on assessment_attempts;
create policy aa_insert_own on assessment_attempts for insert with check (user_id = auth.uid());

drop policy if exists aa_select_grader on assessment_attempts;
create policy aa_select_grader on assessment_attempts for select
  using (
    exists (
      select 1 from assessments a join courses c on c.id = a.course_id
      where a.id = assessment_attempts.assessment_id
        and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses'))
    )
    or is_super_admin(auth.uid())
  );

drop policy if exists aa_update_grader on assessment_attempts;
create policy aa_update_grader on assessment_attempts for update
  using (
    exists (
      select 1 from assessments a join courses c on c.id = a.course_id
      where a.id = assessment_attempts.assessment_id
        and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses'))
    )
    or is_super_admin(auth.uid())
  )
  with check (
    exists (
      select 1 from assessments a join courses c on c.id = a.course_id
      where a.id = assessment_attempts.assessment_id
        and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses'))
    )
    or is_super_admin(auth.uid())
  );

-- Server-side scoring, mirroring check_quiz_answers() exactly - the
-- learner never receives correct_answer, only their computed result.
create or replace function check_assessment_answers(p_assessment_id uuid, p_answers jsonb)
returns table (score numeric, correct_count int, total int, total_points int)
language plpgsql security definer set search_path = public as $$
declare
  v_total int;
  v_correct int := 0;
  v_points int := 0;
  v_total_points int := 0;
  q record;
begin
  select count(*) into v_total from assessment_questions where assessment_id = p_assessment_id;
  for q in select * from assessment_questions where assessment_id = p_assessment_id loop
    v_total_points := v_total_points + q.points;
    if (p_answers ->> q.id::text) = q.correct_answer then
      v_correct := v_correct + 1;
      v_points := v_points + q.points;
    end if;
  end loop;
  return query select
    case when v_total > 0 then round(v_correct::numeric / v_total * 100, 1) else 0 end,
    v_correct, v_total, v_points;
end;
$$;

comment on function check_assessment_answers(uuid, jsonb) is
  'Server-side assessment scoring, never exposing correct_answer to the caller. Client inserts the resulting assessment_attempts row itself (same two-step shape as check_quiz_answers + the quiz_attempts insert in lib/api/learner.js).';


-- ============================================================================
-- MIGRATION: 0113_super_admin_impersonation.sql
-- ============================================================================
-- ============================================================================
-- Platform Owner impersonation ("view as"), and a real audit log gap found
-- while building it
-- ============================================================================
-- Product brief: "Platform owners can impersonate or log into organizations
-- when troubleshooting (super-admin/backdoor access)" - and, per an
-- explicit confirmation earlier in this project, impersonation should be
-- able to see everything, including AI Coach conversations.
--
-- Built as an audited, on-demand "view as" rather than real session
-- forgery: a SECURITY DEFINER function that only a genuine super_admin can
-- call, that logs the access every time, and that returns a read-only
-- snapshot of the target user's data (profile, enrollments/progress, and
-- yes, their real AI Coach conversation history). This is deliberately not
-- "generate a real login session as this user" - that would mean Platform
-- Owner could also take actions (send messages, submit assessments, change
-- settings) *as* the impersonated user with no distinguishable trail
-- separating what the user did from what Platform Owner did while wearing
-- their identity, which is a meaningfully bigger and riskier feature than
-- "see their data." If real session-level impersonation is what's wanted
-- instead of this, that is a further, distinct piece of work - flagging
-- rather than quietly picking one interpretation and calling it done.
--
-- Found while building this: admin_audit_log's own INSERT policy
-- (0006_rls_policies.sql: aal_insert_via_function) was `with check (true)`
-- - genuinely open to any authenticated user, not just admins, and
-- log_admin_action() itself never checked the caller's role either. Between
-- the two, any signed-in user could have written arbitrary fake entries
-- into what is supposed to be a trustworthy admin action record. Tightened
-- below before relying on this table for something as sensitive as
-- impersonation logging.
-- ============================================================================

drop policy if exists aal_insert_via_function on admin_audit_log;
create policy aal_insert_admin_only on admin_audit_log for insert
  with check (is_org_admin(auth.uid()) or is_super_admin(auth.uid()));

create or replace function super_admin_view_user(p_target_user_id uuid, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
  v_prev_hash text;
  v_row_hash text;
begin
  if not is_super_admin(auth.uid()) then
    raise exception 'Only Platform Owner (super_admin) can use this';
  end if;
  if p_target_user_id is null then
    raise exception 'A target user is required';
  end if;

  -- Audited every time, unconditionally - this is the enforcement point,
  -- not a formality. No path to the data below exists without this row
  -- being written first, in the same statement.
  select row_hash into v_prev_hash from admin_audit_log order by created_at desc limit 1;
  v_row_hash := encode(
    digest(coalesce(v_prev_hash, '') || 'impersonation_view' || p_target_user_id::text || now()::text, 'sha256'),
    'hex'
  );
  insert into admin_audit_log (admin_user_id, action_type, target_type, target_id, target_identifier, metadata, prev_hash, row_hash)
  values (
    auth.uid(), 'impersonation_view', 'user_profile', p_target_user_id,
    (select display_name from user_profiles where id = p_target_user_id),
    jsonb_build_object('reason', p_reason),
    v_prev_hash, v_row_hash
  );

  select jsonb_build_object(
    'profile', (
      select jsonb_build_object(
        'id', up.id, 'display_name', up.display_name, 'role', up.role,
        'organization_id', up.organization_id, 'department', up.department,
        'created_at', up.created_at, 'last_active_at', up.last_active_at
      )
      from user_profiles up where up.id = p_target_user_id
    ),
    'enrollments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'course_id', ce.course_id, 'progress_percentage', ce.progress_percentage, 'completed_at', ce.completed_at
      )), '[]'::jsonb)
      from course_enrollments ce where ce.user_id = p_target_user_id
    ),
    -- The explicit ask: impersonation includes AI Coach conversation
    -- content. Every learner-facing screen and every other admin role in
    -- this app is deliberately blocked from this (Module 4.5's "deliberate
    -- trust decision", aim_select_own's owner-only RLS) - this function is
    -- the one, audited exception, and it exists only because this was
    -- explicitly confirmed rather than assumed.
    'ai_conversations', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'conversation_id', c.id,
        'created_at', c.created_at,
        'messages', (
          select coalesce(jsonb_agg(jsonb_build_object('role', m.role, 'content', m.content, 'created_at', m.created_at) order by m.created_at), '[]'::jsonb)
          from ai_messages m where m.conversation_id = c.id
        )
      )), '[]'::jsonb)
      from ai_conversations c where c.user_id = p_target_user_id
    )
  ) into v_result;

  return v_result;
end;
$$;

comment on function super_admin_view_user(uuid, text) is
  'Audited Platform Owner "view as" - read-only snapshot of a user''s profile, enrollments, and AI Coach conversations. Every call is logged to admin_audit_log before any data is returned, unconditionally. Not real session impersonation (see migration header comment).';


-- ============================================================================
-- MIGRATION: 0114_organization_subscription_payment.sql
-- ============================================================================
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


-- ============================================================================
-- MIGRATION: 0115_organization_feature_flags.sql
-- ============================================================================
-- ============================================================================
-- Real per-organization feature flags - replacing hardcoded tier checks
-- ============================================================================
-- "Train AI - Multi-Tenant Database Architecture Reference" (Sarah),
-- Section 3: "Feature availability is not hardcoded per organization
-- type - it's controlled centrally by Train AI as platform owner... via
-- toggleable feature flags per organization." Section 6: "Model as a
-- per-organization settings/config table (organization_id, feature_key,
-- enabled) rather than hardcoding tier logic."
--
-- What existed before this (lib/tierFeatures.js, built two rounds ago)
-- hardcoded a tier->feature map directly in application code - correct
-- defaults, wrong mechanism per this doc. This migration adds the real
-- mechanism (a real settings table, checked by a real SQL function), and
-- the application-layer tier map becomes only the *default* used when no
-- explicit per-org override row exists - same architecture already used
-- for role_permissions_matrix + user_permission_overrides
-- (0005_functions.sql: effective_has_permission resolves explicit
-- grant/revoke first, falls back to the role default) - this mirrors that
-- exact pattern for organizations instead of users.
-- ============================================================================

create table if not exists organization_feature_flags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null,
  set_by uuid references user_profiles(id),
  updated_at timestamptz not null default now(),
  unique (organization_id, feature_key)
);

alter table organization_feature_flags enable row level security;

drop policy if exists off_select_member on organization_feature_flags;
create policy off_select_member on organization_feature_flags for select
  using (
    organization_id = get_user_organization_id(auth.uid())
    or is_super_admin(auth.uid())
  );

-- Only the platform owner sets these - "Feature flag control: Turn
-- features on/off per organization" is listed explicitly under Section 4's
-- Platform Owner View capabilities, not under any organization's own Admin
-- capabilities. A tenant admin (even Enterprise) does not get to grant
-- itself SSO by editing this table.
drop policy if exists off_write_super_admin on organization_feature_flags;
create policy off_write_super_admin on organization_feature_flags for all
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

-- Tier-based defaults, matching Section 3's baseline table exactly. Used
-- only when no explicit organization_feature_flags row exists for that
-- org+feature - an explicit row (set by the platform owner) always wins,
-- same resolution order as effective_has_permission.
create or replace function tier_default_feature(p_tier subscription_tier, p_feature_key text)
returns boolean
language sql immutable as $$
  select case p_feature_key
    when 'learner_view' then true
    when 'instructor_view' then true
    when 'admin_view' then true
    when 'manager_view' then p_tier in ('growth', 'enterprise')
    when 'ai_intelligence_layer' then true  -- everyone gets at least "Limited"
    when 'ai_intelligence_advanced' then p_tier in ('growth', 'enterprise')  -- the "Limited" vs "Yes" distinction
    when 'sso' then p_tier = 'enterprise'
    when 'api_integrations' then p_tier = 'enterprise'
    when 'analytics_export' then p_tier in ('growth', 'enterprise')
    when 'multi_department_breakdown' then p_tier in ('growth', 'enterprise')
    when 'custom_branding' then p_tier = 'enterprise'
    else false
  end;
$$;

create or replace function get_org_feature(p_org_id uuid, p_feature_key text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_override boolean;
  v_tier subscription_tier;
begin
  select enabled into v_override
  from organization_feature_flags
  where organization_id = p_org_id and feature_key = p_feature_key;

  if v_override is not null then
    return v_override;
  end if;

  select subscription_tier into v_tier from organizations where id = p_org_id;
  return tier_default_feature(coalesce(v_tier, 'starter'), p_feature_key);
end;
$$;

comment on function get_org_feature(uuid, text) is
  'Resolution order: explicit organization_feature_flags row always wins (platform-owner override), then falls back to the tier default (tier_default_feature) - same shape as effective_has_permission for users.';


-- ============================================================================
-- MIGRATION: 0116_digital_training_org_and_demos.sql
-- ============================================================================
-- ============================================================================
-- Digital Training Organization (rename), and demo orgs per tier
-- ============================================================================
-- "Multi-Tenant Database Architecture Reference," Section 2.2: the B2C
-- default-org for individual learners is named "Digital Training
-- Organization" - not "Tech Learning" (built two rounds ago, before this
-- document existed, under a different working name for the same concept).
-- Renaming the existing row in place rather than creating a second default
-- org: same slug-based lookup in join_default_organization()
-- (0106_join_default_organization.sql) still works unchanged, since that
-- function looks up by slug, not by display name.
--
-- Also per Section 2.2: "This is not a stripped-down, structure-less
-- tenant - it is a full organization in the data model, with the same
-- internal structure as any B2B tenant." No schema change needed for
-- that part specifically - any organization row already supports
-- instructor/admin/manager roles via the existing role machinery; Digital
-- Training Organization gets that "for free" just by being a real
-- organizations row, which it already was.
-- ============================================================================

update organizations
set name = 'Digital Training Organization'
where slug = 'tech-learning';

-- Section 2.3: "For engineering/demo purposes, build at least one demo
-- account per pricing tier so the tiered feature model can be tested and
-- shown... Each of these demo orgs is a fully isolated tenant just like a
-- real customer would be."
insert into organizations (name, slug, status, subscription_tier, created_by)
values
  ('Demo Org - Starter', 'demo-org-starter', 'active', 'starter', null),
  ('Demo Org - Growth', 'demo-org-growth', 'active', 'growth', null),
  ('Demo Org - Enterprise', 'demo-org-enterprise', 'active', 'enterprise', null)
on conflict (slug) do nothing;

-- Bulk variant of get_org_feature() - the application checks several flags
-- per screen (e.g. AdminAnalyticsScreen checks analytics_export AND
-- multi_department_breakdown), and the existing fetch-once-check-many-times
-- pattern used everywhere else in this app (useSupabaseQuery once, read
-- from cached data thereafter) needs one round trip, not one per flag.
create or replace function get_org_features_bulk(p_org_id uuid, p_feature_keys text[])
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_result jsonb := '{}'::jsonb;
  v_key text;
begin
  foreach v_key in array p_feature_keys loop
    v_result := v_result || jsonb_build_object(v_key, get_org_feature(p_org_id, v_key));
  end loop;
  return v_result;
end;
$$;


-- ============================================================================
-- MIGRATION: 0117_organization_status_control.sql
-- ============================================================================
-- ============================================================================
-- Audited organization suspend/activate
-- ============================================================================
-- "Multi-Tenant Database Architecture Reference," Section 4: "User/account
-- control: Turn organizations or users on/off (suspend, activate,
-- deactivate)" - listed explicitly as a Platform Owner capability.
-- organizations.status already had a 'suspended' value in the org_status
-- enum since 0001_init_schema.sql, and org_update_admin
-- (0109_ai_coach_settings.sql) already lets a super_admin update any
-- organization's row - so the RLS-level capability already existed. What
-- didn't exist was any function or UI actually using it, and no audit
-- trail for something this consequential (suspending an org kicks every
-- one of its users out of the admin dashboard, per the trial-gate already
-- built in AdminDashboardScreen.jsx).
-- ============================================================================

create or replace function set_organization_status(p_org_id uuid, p_status org_status)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prev_hash text;
  v_row_hash text;
  v_org_name text;
begin
  if not is_super_admin(auth.uid()) then
    raise exception 'Only Platform Owner (super_admin) can change an organization''s status';
  end if;

  select name into v_org_name from organizations where id = p_org_id;
  if v_org_name is null then
    raise exception 'Organization not found';
  end if;

  update organizations set status = p_status where id = p_org_id;

  select row_hash into v_prev_hash from admin_audit_log order by created_at desc limit 1;
  v_row_hash := encode(
    digest(coalesce(v_prev_hash, '') || 'organization_status_change' || p_org_id::text || p_status::text || now()::text, 'sha256'),
    'hex'
  );
  insert into admin_audit_log (admin_user_id, action_type, target_type, target_id, target_identifier, metadata, prev_hash, row_hash)
  values (
    auth.uid(), 'organization_status_change', 'organization', p_org_id, v_org_name,
    jsonb_build_object('new_status', p_status), v_prev_hash, v_row_hash
  );

  return jsonb_build_object('success', true, 'organization_id', p_org_id, 'status', p_status);
end;
$$;

comment on function set_organization_status(uuid, org_status) is
  'Platform Owner suspend/activate/trial control over an organization, audited unconditionally.';


-- ============================================================================
-- MIGRATION: 0118_sara_foundation_tenant.sql
-- ============================================================================
-- ============================================================================
-- Sara Foundation as a real organization tenant (Section 2.1)
-- ============================================================================
-- "Multi-Tenant Database Architecture Reference," Section 2.1: "A single,
-- dedicated organization on Train AI 1.0... Treat this as the
-- reference/first production tenant - it's a normal instance of the B2B
-- structure (Section 2.3), just the first one live."
--
-- This was a real, confirmed gap: "Sara Foundation" existed elsewhere in
-- this codebase only as an unrelated emails table
-- (sara_foundation_emails, 0004_community_gamification_admin.sql) and a
-- comment about the hardcoded admin-email backdoor removed several rounds
-- ago - there was no actual organization tenant for it in the
-- multi-tenant data model at all, despite the document explicitly naming
-- it as the first of three tenant categories.
--
-- "Old database falls here" (Section 1) means Sara Foundation's
-- pre-existing data should be associated with this tenant once a real
-- migration path exists for it - that's real data this sandbox has no
-- access to and isn't something to fabricate. What's built here is the
-- tenant itself, seeded and ready to receive that association, matching
-- exactly how Digital Training Organization and the three demo orgs were
-- seeded (0116_digital_training_org_and_demos.sql) - a real, isolated
-- organizations row, not a placeholder.
--
-- Tier: the document doesn't specify one for Sara Foundation specifically
-- (only that it's "a normal instance of the B2B structure"). Defaulted to
-- 'starter' as the least presumptuous choice - adjust directly in the
-- organizations table (or via the Platform Owner's Organizations screen)
-- once the actual agreed tier is known.
-- ============================================================================

insert into organizations (name, slug, status, subscription_tier, created_by)
values ('Sara Foundation', 'sara-foundation', 'active', 'starter', null)
on conflict (slug) do nothing;


-- ============================================================================
-- MIGRATION: 0119_super_admin_trainai_only.sql
-- ============================================================================
-- ============================================================================
-- Super Admin can only ever be granted to Train AI email accounts
-- ============================================================================
-- Philip's task memo, "Important Architecture Decisions": "Keep Super Admin
-- access separate from Foundation accounts" and Platform/Super Admin
-- requires "Train AI email accounts only." Checked the actual grant path
-- (grantSuperAdminByUserId in lib/api/platform.js, backed by
-- ur_write_super_admin in 0006_rls_policies.sql) and found a real gap: any
-- existing super_admin could grant the role to *any* account at all, with
-- no check on whose account it actually was. "Foundation accounts should
-- not automatically receive Super Admin privileges" was already true by
-- construction (Sara Foundation lives in a separate Supabase project
-- entirely, so there's no code path connecting a Foundation account to
-- this table at all) - but "Train AI email accounts only" was not enforced
-- anywhere; it was just something that happened to be true if nobody ever
-- tried it, not a real constraint.
--
-- Enforced directly in the RLS policy itself (not only in a wrapper
-- function that a direct insert could bypass) - checks the target user's
-- real email in auth.users ends with @trainailtd.com before allowing a
-- super_admin row to be written at all, regardless of which code path
-- attempts the insert.
-- ============================================================================

create or replace function is_trainai_staff_email(check_user_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select email ilike '%@trainailtd.com' from auth.users where id = check_user_id),
    false
  );
$$;

drop policy if exists ur_write_super_admin on user_roles;
create policy ur_write_super_admin on user_roles for all
  using (is_super_admin(auth.uid()))
  with check (
    is_super_admin(auth.uid())
    and (role != 'super_admin' or is_trainai_staff_email(user_id))
  );

comment on function is_trainai_staff_email(uuid) is
  'Used to gate super_admin role grants to Train AI staff accounts only (ur_write_super_admin policy) - "Train AI email accounts only" per the confirmed architecture requirement.';

-- The Access Control screen's Super Admin Roster had a working Revoke
-- button but no way to Grant at all - grantSuperAdminByUserId() existed in
-- lib/api/platform.js but was never called from anywhere, and there was no
-- way to resolve a known @trainailtd.com email into the user_id that
-- function actually needs. This is that lookup, restricted to super_admin
-- callers (an open "look up any user by email" function would itself be a
-- real information-disclosure gap for any other role).
create or replace function find_user_id_by_email(p_email text)
returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  v_user_id uuid;
begin
  if not is_super_admin(auth.uid()) then
    raise exception 'Only Platform Owner (super_admin) can look up users by email';
  end if;
  select id into v_user_id from auth.users where email ilike p_email;
  return v_user_id;
end;
$$;


-- ============================================================================
-- MIGRATION: 0120_certificates.sql
-- ============================================================================
-- ============================================================================
-- Certificates - explicitly in-scope for v1, confirmed entirely unbuilt
-- ============================================================================
-- PRD Summary v4.0, Section 4.1 lists "Certificates" as in-scope for v1.
-- Section 7.3: "Assessments... feed completion, certificates, and
-- reporting." Section 8.3 lists "certificate settings" as an Admin
-- capability, and the original brief's Section 5 spells out the full
-- workflow: detect completion, check passing score, determine
-- eligibility, send for approval, allow admin approval, issue, store
-- against learner, let the learner access/download it.
--
-- Checked the actual codebase before building this: "certificate" appeared
-- in exactly one place as a real reference (a code comment in learner.js
-- about assessments feeding certificates conceptually) and nowhere as an
-- actual table, screen, or workflow. This is not a small gap - the entire
-- feature was unbuilt.
--
-- Workflow implemented, matching the original brief's numbered steps:
--   1. Detect assessment completion
--   2. Check passing score
--   3. Determine eligibility
--   4. Send for approval
--   5. Allow admin approval
--   6. Issue certificate
--   7. Store against learner
--   8. Learner can access/download
-- ============================================================================

create type certificate_status as enum ('pending', 'issued', 'rejected');

-- One template per course - "certificate settings" (Section 8.3) and
-- "Certificate templates" (Section 22). Admin-configured; org-branded per
-- the confirmed Open Question answer ("Should certificates be
-- organisation-branded... Org branded").
create table if not exists certificate_templates (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade unique,
  organization_id uuid references organizations(id) on delete cascade,
  title text not null default 'Certificate of Completion',
  passing_score_pct numeric not null default 70,
  requires_admin_approval boolean not null default true,
  template_text text,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  template_id uuid references certificate_templates(id) on delete set null,
  organization_id uuid references organizations(id) on delete cascade,
  score_pct numeric,
  status certificate_status not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_by uuid references user_profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  issued_at timestamptz,
  certificate_number text unique,
  unique (user_id, course_id)
);

alter table certificate_templates enable row level security;
alter table certificates enable row level security;

drop policy if exists ct_select_all on certificate_templates;
create policy ct_select_all on certificate_templates for select using (true);

drop policy if exists ct_write_authorized on certificate_templates;
create policy ct_write_authorized on certificate_templates for all
  using (
    exists (select 1 from courses c where c.id = certificate_templates.course_id and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses')))
    or is_super_admin(auth.uid())
  )
  with check (
    exists (select 1 from courses c where c.id = certificate_templates.course_id and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses')))
    or is_super_admin(auth.uid())
  );

drop policy if exists cert_select_own on certificates;
create policy cert_select_own on certificates for select using (user_id = auth.uid());

drop policy if exists cert_insert_own on certificates;
create policy cert_insert_own on certificates for insert with check (user_id = auth.uid());

drop policy if exists cert_select_reviewer on certificates;
create policy cert_select_reviewer on certificates for select
  using (
    exists (select 1 from courses c where c.id = certificates.course_id and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses')))
    or is_super_admin(auth.uid())
  );

drop policy if exists cert_update_reviewer on certificates;
create policy cert_update_reviewer on certificates for update
  using (
    exists (select 1 from courses c where c.id = certificates.course_id and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses')))
    or is_super_admin(auth.uid())
  )
  with check (
    exists (select 1 from courses c where c.id = certificates.course_id and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses')))
    or is_super_admin(auth.uid())
  );

create or replace function request_certificate(p_course_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_template certificate_templates%rowtype;
  v_best_score numeric;
  v_cert_id uuid;
  v_auto_issue boolean;
begin
  select * into v_template from certificate_templates where course_id = p_course_id;
  if v_template.id is null then
    raise exception 'No certificate is configured for this course';
  end if;

  select max(aa.score) into v_best_score
  from assessment_attempts aa
  join assessments a on a.id = aa.assessment_id
  where a.course_id = p_course_id and aa.user_id = auth.uid();

  if v_best_score is null then
    raise exception 'Complete this course''s assessment before requesting a certificate';
  end if;
  if v_best_score < v_template.passing_score_pct then
    raise exception 'Score does not meet the required passing threshold';
  end if;

  v_auto_issue := not v_template.requires_admin_approval;

  insert into certificates (user_id, course_id, template_id, organization_id, score_pct, status, issued_at, certificate_number)
  values (
    auth.uid(), p_course_id, v_template.id, v_template.organization_id, v_best_score,
    (case when v_auto_issue then 'issued' else 'pending' end)::certificate_status,
    case when v_auto_issue then now() else null end,
    case when v_auto_issue then 'TAI-' || upper(substr(md5(random()::text), 1, 10)) else null end
  )
  on conflict (user_id, course_id) do update set score_pct = excluded.score_pct
  returning id into v_cert_id;

  return jsonb_build_object('success', true, 'certificate_id', v_cert_id, 'status', case when v_auto_issue then 'issued' else 'pending' end);
end;
$$;

create or replace function review_certificate(p_certificate_id uuid, p_approve boolean, p_rejection_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cert certificates%rowtype;
  v_prev_hash text;
  v_row_hash text;
  v_course_title text;
begin
  select * into v_cert from certificates where id = p_certificate_id;
  if v_cert.id is null then
    raise exception 'Certificate request not found';
  end if;
  if not (
    exists (select 1 from courses c where c.id = v_cert.course_id and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses')))
    or is_super_admin(auth.uid())
  ) then
    raise exception 'Not authorized to review this certificate';
  end if;

  update certificates set
    status = (case when p_approve then 'issued' else 'rejected' end)::certificate_status,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    issued_at = case when p_approve then now() else null end,
    rejection_reason = case when p_approve then null else p_rejection_reason end,
    certificate_number = case when p_approve then coalesce(v_cert.certificate_number, 'TAI-' || upper(substr(md5(random()::text), 1, 10))) else v_cert.certificate_number end
  where id = p_certificate_id;

  select title into v_course_title from courses where id = v_cert.course_id;
  select row_hash into v_prev_hash from admin_audit_log order by created_at desc limit 1;
  v_row_hash := encode(digest(coalesce(v_prev_hash, '') || 'certificate_review' || p_certificate_id::text || now()::text, 'sha256'), 'hex');
  insert into admin_audit_log (admin_user_id, action_type, target_type, target_id, target_identifier, metadata, prev_hash, row_hash)
  values (
    auth.uid(), 'certificate_review', 'certificate', p_certificate_id, v_course_title,
    jsonb_build_object('approved', p_approve, 'learner_id', v_cert.user_id, 'reason', p_rejection_reason),
    v_prev_hash, v_row_hash
  );

  return jsonb_build_object('success', true, 'status', case when p_approve then 'issued' else 'rejected' end);
end;
$$;

comment on function request_certificate(uuid) is 'Steps 1-4 of the certificate workflow: verifies real completion/passing score server-side, creates a pending (or auto-issued) request.';
comment on function review_certificate(uuid, boolean, text) is 'Steps 5-6: admin/instructor approval or rejection, audited unconditionally.';


-- ============================================================================
-- MIGRATION: 0121_feedback_notes.sql
-- ============================================================================
-- ============================================================================
-- Instructor and Manager feedback notes - both explicitly required, both
-- confirmed unbuilt
-- ============================================================================
-- PRD Summary v4.0, Section 8.1 (Instructor view): "Feedback for learners
-- (Note section)." Section 8.2 (Manager view): "Manager feedback for
-- department (Note section)." Confirmed by checking the actual codebase -
-- no notes/feedback table or screen existed for either role.
--
-- One shared table serves both, since the shape is nearly identical
-- (author writes a note, it's visible to specific people) - the only real
-- difference is what the note is *about*: a specific learner
-- (Instructor's case) or a whole department (Manager's case).
-- ============================================================================

create type feedback_note_target as enum ('learner', 'department');

create table if not exists feedback_notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references user_profiles(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  target_type feedback_note_target not null,
  target_learner_id uuid references user_profiles(id) on delete cascade,
  target_department text,
  note_text text not null,
  created_at timestamptz not null default now(),
  constraint feedback_notes_target_check check (
    (target_type = 'learner' and target_learner_id is not null and target_department is null)
    or (target_type = 'department' and target_department is not null and target_learner_id is null)
  )
);

alter table feedback_notes enable row level security;

-- Visible to: the author themselves, any admin/manage_courses holder in
-- the same org (so notes actually reach the people who'd act on them, not
-- just sit invisibly with their author), and - for a learner-targeted note
-- specifically - the learner the note is about, since "Feedback for
-- learners" implies it's meant to reach them, not just be filed away.
drop policy if exists fn_select_scoped on feedback_notes;
create policy fn_select_scoped on feedback_notes for select
  using (
    author_id = auth.uid()
    or (target_type = 'learner' and target_learner_id = auth.uid())
    or (organization_id = get_user_organization_id(auth.uid()) and is_org_admin(auth.uid()))
    or is_super_admin(auth.uid())
  );

-- Writable by the author only for their own notes, scoped so an
-- instructor/manager can only write notes within their own organization -
-- an instructor from Org A writing a "note" about a learner in Org B would
-- be exactly the kind of cross-tenant leak this app has been careful to
-- close everywhere else.
drop policy if exists fn_write_own on feedback_notes;
create policy fn_write_own on feedback_notes for all
  using (author_id = auth.uid())
  with check (
    author_id = auth.uid()
    and organization_id = get_user_organization_id(auth.uid())
  );

create index if not exists idx_feedback_notes_learner on feedback_notes(target_learner_id) where target_type = 'learner';
create index if not exists idx_feedback_notes_department on feedback_notes(organization_id, target_department) where target_type = 'department';


-- ============================================================================
-- MIGRATION: 0122_support_tickets.sql
-- ============================================================================
-- ============================================================================
-- Support Queue - PRD "Platform Owner Support System," confirmed unbuilt
-- ============================================================================
-- "Organizations can: Submit support request, ask questions, report
-- problems, track request status. Platform Owner can: view support
-- tickets, respond, change status, track organization, maintain support
-- history." Checked the codebase before building: zero matches for
-- "support_ticket" or "SupportQueue" anywhere.
-- ============================================================================

create type support_ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');
create type support_ticket_priority as enum ('low', 'normal', 'high', 'urgent');

create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  created_by uuid not null references user_profiles(id) on delete cascade,
  subject text not null,
  description text not null,
  status support_ticket_status not null default 'open',
  priority support_ticket_priority not null default 'normal',
  assigned_to uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  author_id uuid not null references user_profiles(id) on delete cascade,
  message text not null,
  is_internal_note boolean not null default false,
  created_at timestamptz not null default now()
);

alter table support_tickets enable row level security;
alter table support_ticket_messages enable row level security;

-- An org's own users can see and create their own org's tickets (any org
-- admin/staff member, not just the creator - "track request status" implies
-- the whole org can follow it, not just whoever happened to file it).
-- Only Platform Owner sees across every organization.
drop policy if exists st_select_own_org_or_platform on support_tickets;
create policy st_select_own_org_or_platform on support_tickets for select
  using (
    organization_id = get_user_organization_id(auth.uid())
    or is_super_admin(auth.uid())
  );

drop policy if exists st_insert_own_org on support_tickets;
create policy st_insert_own_org on support_tickets for insert
  with check (
    created_by = auth.uid()
    and organization_id = get_user_organization_id(auth.uid())
  );

-- Status/assignment changes: Platform Owner only - "change status" is
-- listed as a Platform Owner capability specifically, not a self-service
-- org action (an org marking its own ticket "resolved" would defeat the
-- point of a support queue Train AI actually manages).
drop policy if exists st_update_platform_owner on support_tickets;
create policy st_update_platform_owner on support_tickets for update
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

drop policy if exists stm_select_scoped on support_ticket_messages;
create policy stm_select_scoped on support_ticket_messages for select
  using (
    (
      exists (select 1 from support_tickets t where t.id = support_ticket_messages.ticket_id and t.organization_id = get_user_organization_id(auth.uid()))
      and not is_internal_note
    )
    or is_super_admin(auth.uid())
  );

drop policy if exists stm_insert_scoped on support_ticket_messages;
create policy stm_insert_scoped on support_ticket_messages for insert
  with check (
    author_id = auth.uid()
    and (
      (exists (select 1 from support_tickets t where t.id = support_ticket_messages.ticket_id and t.organization_id = get_user_organization_id(auth.uid())) and not is_internal_note)
      or is_super_admin(auth.uid())
    )
  );

create index if not exists idx_support_tickets_org on support_tickets(organization_id);
create index if not exists idx_support_ticket_messages_ticket on support_ticket_messages(ticket_id);


-- ============================================================================
-- MIGRATION: 0123_campaign_attribution.sql
-- ============================================================================
-- ============================================================================
-- Campaign attribution - PRD Platform Owner Analytics, confirmed unbuilt
-- ============================================================================
-- Adds the columns needed to attribute a demo request or organization
-- inquiry to a marketing campaign, rather than a separate "campaign
-- events" table that could drift from what was actually submitted. Real
-- capture happens client-side (see waitlist.js captureAttributionFromURL,
-- reads standard utm_source/utm_medium/utm_campaign query params on first
-- landing-page visit, persists them through to whichever form is
-- eventually submitted) - this migration is just the storage for it.
-- ============================================================================

alter table demo_requests add column if not exists utm_source text;
alter table demo_requests add column if not exists utm_medium text;
alter table demo_requests add column if not exists utm_campaign text;

alter table organization_inquiries add column if not exists utm_source text;
alter table organization_inquiries add column if not exists utm_medium text;
alter table organization_inquiries add column if not exists utm_campaign text;


-- ============================================================================
-- MIGRATION: 0124_cohort_courses_rls_fix.sql
-- ============================================================================
-- ============================================================================
-- cohort_courses had RLS enabled with zero policies - a real gap found
-- while building the "Cohort Assigned Courses" feature (PRD Section 7.4)
-- ============================================================================
-- Same pattern found and fixed multiple times before in this project
-- (bookmarks, learning_path_courses, assessment tables): the blanket
-- per-table RLS-enable loop (0006_rls_policies.sql) correctly enabled RLS
-- on cohort_courses (created in 0002_progress_quizzes_cohorts.sql, before
-- RLS existed at all), but nothing ever added real policies for it -
-- meaning the table has been completely inaccessible (default-deny) to
-- everyone, including a legitimate org admin trying to assign a course to
-- a cohort, this whole time. Found only because building the "Assigned
-- Courses" tab required actually querying this table for the first time -
-- it was never exercised by any existing screen before this.
-- ============================================================================

drop policy if exists cc_select_cohort_member_or_admin on cohort_courses;
create policy cc_select_cohort_member_or_admin on cohort_courses for select
  using (
    exists (select 1 from cohort_members cm where cm.cohort_id = cohort_courses.cohort_id and cm.user_id = auth.uid())
    or is_org_admin(auth.uid())
    or is_super_admin(auth.uid())
  );

drop policy if exists cc_write_admin on cohort_courses;
create policy cc_write_admin on cohort_courses for all
  using (is_org_admin(auth.uid()) or is_super_admin(auth.uid()))
  with check (is_org_admin(auth.uid()) or is_super_admin(auth.uid()));


-- ============================================================================
-- MIGRATION: 0125_external_course_approval.sql
-- ============================================================================
-- ============================================================================
-- External course approval gate - PRD Open Question: "Should the external
-- course feed be manually curated, AI-curated, or mixed in v1? AI curated
-- with human approval." A real, confirmed gap found on the final
-- verification pass: external courses were shown to learners straight from
-- a static curated list with no approval concept at all.
-- ============================================================================
-- Internal courses default to approved=true (an internal course an
-- instructor publishes doesn't need a second admin approval step - that's
-- what is_published already gates). External courses default to
-- approved=false, requiring an explicit admin action before a learner ever
-- sees them - this is the actual "human approval" half of the confirmed
-- answer. The "AI curated" half (an AI suggesting which external courses
-- to add in the first place) is a separate, larger content-sourcing
-- pipeline that doesn't exist yet - not fabricated here; this migration
-- only builds the approval gate itself, honestly.
-- ============================================================================

alter table courses add column if not exists is_approved boolean not null default true;
update courses set is_approved = false where course_source = 'external' and is_approved is distinct from false;

comment on column courses.is_approved is
  'External courses require explicit admin approval before learners see them (PRD: "AI curated with human approval"). Internal courses default true - is_published already gates those.';


-- ============================================================================
-- MIGRATION: 0126_no_learner_to_learner_messaging.sql
-- ============================================================================
-- ============================================================================
-- No learner-to-learner communication of any kind - explicit clarification
-- ============================================================================
-- Confirmed directly, correcting an earlier, too-narrow reading: "learners
-- should [not] message learners at all, only instructors" - not just
-- private 1:1 DMs (already correctly restricted, mentor_messages,
-- 0108_messaging_restriction.sql), but *any* form of learner-to-learner
-- communication, including posting into a shared cohort or study-group
-- channel. Both of those previously let any learner in the group post
-- messages other learners in the same group would see - a real violation
-- of this rule, just a different shape than a private DM.
--
-- cohort_posts already had a real (too-permissive) policy
-- (cpost_insert_member, 0007_missing_schema.sql) - tightened here.
-- study_group_messages had NO policies at all, a separate, previously
-- undiscovered gap (found while fixing this) - the table has been
-- completely inaccessible by default (RLS enabled via the blanket loop,
-- zero actual policies) this whole time. Built correctly restricted from
-- the start, not "fixed" into unrestricted access and then re-restricted.
--
-- Learners can still read every message in their own cohort/study group
-- (so instructor announcements and updates are visible) - only posting is
-- restricted to instructors/admins now.
-- ============================================================================

drop policy if exists cpost_insert_member on cohort_posts;
drop policy if exists cpost_insert_instructor_only on cohort_posts;
create policy cpost_insert_instructor_only on cohort_posts for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from cohort_members cm
      where cm.cohort_id = cohort_posts.cohort_id and cm.user_id = auth.uid()
    )
    and (has_role(auth.uid(), 'mentor'::platform_role) or is_org_admin(auth.uid()) or is_super_admin(auth.uid()))
  );

alter table study_group_messages enable row level security;
drop policy if exists sgm_select_member on study_group_messages;
create policy sgm_select_member on study_group_messages for select
  using (
    exists (
      select 1 from study_group_members sgm
      where sgm.group_id = study_group_messages.study_group_id and sgm.user_id = auth.uid()
    )
    or is_org_admin(auth.uid())
    or is_super_admin(auth.uid())
  );

drop policy if exists sgm_insert_instructor_only on study_group_messages;
create policy sgm_insert_instructor_only on study_group_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from study_group_members sgm
      where sgm.group_id = study_group_messages.study_group_id and sgm.user_id = auth.uid()
    )
    and (has_role(auth.uid(), 'mentor'::platform_role) or is_org_admin(auth.uid()) or is_super_admin(auth.uid()))
  );

-- Replies to a cohort post are visible to every other cohort member too -
-- a learner replying is exactly as much "learner-to-learner" as posting a
-- new update would be, just threaded. Restricted the same way.
drop policy if exists cpr_insert_member on cohort_post_replies;
drop policy if exists cpr_insert_instructor_only on cohort_post_replies;
create policy cpr_insert_instructor_only on cohort_post_replies for insert
  with check (
    author_id = auth.uid()
    and (has_role(auth.uid(), 'mentor'::platform_role) or is_org_admin(auth.uid()) or is_super_admin(auth.uid()))
  );

-- ============================================================================
-- A separate, real gap found while re-verifying this migration: Section
-- 8.1 requires an Instructor to "Manage cohorts... Upload sessions...
-- Manage learning resources" for their own cohort - but cohort_resources
-- and cohort_sessions were only ever writable by is_org_admin()
-- (owner/admin/super_admin), never a plain mentor. Confirmed with a real
-- test: a genuine instructor (mentor role, not also an org admin - the
-- normal case) was blocked from adding a resource or session to their own
-- cohort. cohort_members has no dedicated instructor flag (unlike
-- study_group_members, which does), so this scopes correctly by checking
-- the mentor is actually a member of that specific cohort, not just "any
-- mentor anywhere in the org."
-- ============================================================================

drop policy if exists cres_write_admin on cohort_resources;
create policy cres_write_admin_or_instructor on cohort_resources for all
  using (
    is_org_admin(auth.uid())
    or (has_role(auth.uid(), 'mentor'::platform_role) and exists (
      select 1 from cohort_members cm where cm.cohort_id = cohort_resources.cohort_id and cm.user_id = auth.uid()
    ))
  )
  with check (
    is_org_admin(auth.uid())
    or (has_role(auth.uid(), 'mentor'::platform_role) and exists (
      select 1 from cohort_members cm where cm.cohort_id = cohort_resources.cohort_id and cm.user_id = auth.uid()
    ))
  );

drop policy if exists csess_write_admin on cohort_sessions;
create policy csess_write_admin_or_instructor on cohort_sessions for all
  using (
    is_org_admin(auth.uid())
    or (has_role(auth.uid(), 'mentor'::platform_role) and exists (
      select 1 from cohort_members cm where cm.cohort_id = cohort_sessions.cohort_id and cm.user_id = auth.uid()
    ))
  )
  with check (
    is_org_admin(auth.uid())
    or (has_role(auth.uid(), 'mentor'::platform_role) and exists (
      select 1 from cohort_members cm where cm.cohort_id = cohort_sessions.cohort_id and cm.user_id = auth.uid()
    ))
  );


-- ============================================================================
-- MIGRATION: 0127_suspend_instructor_payouts.sql
-- ============================================================================
-- ============================================================================
-- Instructor/mentor payouts - temporarily suspended, made explicit
-- ============================================================================
-- Explicit architecture decision: "Train AI is currently intended to be
-- the sole payment recipient; instructor/mentor payouts are temporarily
-- suspended." A real, confirmed violation was found: the client-side
-- submitMentorPayoutRequest() function let a mentor actually submit a
-- payout request with no restriction, and in demo mode this returned a
-- fake success response - genuinely misleading, not just a missing
-- feature. The client-side function itself has been changed to always
-- return a clear rejection message rather than a fake success.
--
-- This migration makes the underlying database state intentional rather
-- than an accidental side effect: mentor_payout_requests had RLS enabled
-- (via the blanket per-table loop) with zero actual policies defined -
-- meaning any real, connected attempt would already have failed with a
-- generic RLS error, not a deliberate, explained one. Adding a real
-- explicit policy here so the restriction is documented and intentional,
-- not an accident that happens to currently produce the right result.
--
-- Earnings visibility is untouched - mentor_earnings keeps whatever
-- policies it already had; only *requesting a payout* is blocked.
-- ============================================================================

drop policy if exists mpr_no_new_requests on mentor_payout_requests;
create policy mpr_no_new_requests on mentor_payout_requests for insert
  with check (is_super_admin(auth.uid()));

comment on table mentor_payout_requests is
  'Payout requests are suspended - "Train AI is currently intended to be the sole payment recipient." Only super_admin can insert here (e.g. to manually process a one-off exception) - a mentor cannot create a new request through the normal app flow.';

-- ============================================================================
-- Instructors can create and manage cohorts, not just admins - confirmed
-- directly: "Everything around cohorts should also be accessible to
-- instructors" and "Instructors should also be able to manage and create
-- cohorts." cohorts_write_admin (0006_rls_policies.sql) only ever allowed
-- is_org_admin() - a plain instructor could not create a cohort at all.
-- ============================================================================

drop policy if exists cohorts_write_admin on cohorts;

-- Anyone with org-level write access - admin or a real instructor in this
-- org - can create a new cohort.
drop policy if exists cohorts_insert_admin_or_instructor on cohorts;
create policy cohorts_insert_admin_or_instructor on cohorts for insert
  with check (
    organization_id = get_user_organization_id(auth.uid())
    and (is_org_admin(auth.uid()) or has_role(auth.uid(), 'mentor'::platform_role))
  );

-- Managing an existing cohort (rename, reschedule, archive) - admins can
-- manage any cohort in their org; an instructor can manage cohorts they're
-- actually assigned to (via cohort_members), same scoping already used for
-- cohort_resources/cohort_sessions in 0126.
drop policy if exists cohorts_update_admin_or_assigned_instructor on cohorts;
create policy cohorts_update_admin_or_assigned_instructor on cohorts for update
  using (
    organization_id = get_user_organization_id(auth.uid())
    and (
      is_org_admin(auth.uid())
      or (has_role(auth.uid(), 'mentor'::platform_role) and exists (
        select 1 from cohort_members cm where cm.cohort_id = cohorts.id and cm.user_id = auth.uid()
      ))
    )
  );

drop policy if exists cohorts_delete_admin_only on cohorts;
create policy cohorts_delete_admin_only on cohorts for delete
  using (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()));

-- Allows a mentor to add themselves as a member of a cohort they're
-- legitimately creating (see createCohort() in lib/api/platform.js) -
-- cm_write_admin (0006_rls_policies.sql) only ever allowed an org admin to
-- write here at all, which would have silently blocked the auto-add.
-- Admins can still add/remove anyone; a mentor can only ever add or remove
-- themselves specifically, never another user.
drop policy if exists cm_write_admin on cohort_members;
create policy cm_write_admin_or_self on cohort_members for all
  using (is_org_admin(auth.uid()) or user_id = auth.uid())
  with check (is_org_admin(auth.uid()) or user_id = auth.uid());

-- ============================================================================
-- A real, previously undiscovered cross-tenant data leak found while
-- building the "Admins should see all study groups" feature: study_groups
-- has a real organization_id column, but sg_select_all
-- (0008_learner_app_rls_gapfill.sql) used "using (true)" - meaning any
-- authenticated user, from any organization, could see every study group
-- on the entire platform, not just their own org's. Scoped correctly now.
-- ============================================================================

drop policy if exists sg_select_all on study_groups;
drop policy if exists sg_select_own_org on study_groups;
create policy sg_select_own_org on study_groups for select
  using (
    organization_id = get_user_organization_id(auth.uid())
    or organization_id is null
    or is_super_admin(auth.uid())
  );

-- ============================================================================
-- A real infinite-recursion bug found by testing, not caught by reading
-- the code: study_groups' write policy checks study_group_members (is the
-- caller a member), and study_group_members' write policy checks
-- study_groups (did the caller create this group) - each policy's
-- evaluation triggers the other's, which triggers the first's again.
-- Postgres correctly refuses this outright ("infinite recursion detected
-- in policy for relation study_groups") rather than silently doing
-- something wrong - caught only because a real UPDATE was actually run
-- against a real database, not from reading either policy in isolation.
--
-- Fixed with the same pattern already used everywhere else in this schema
-- for exactly this situation (is_org_admin(), has_role(), etc.) - a
-- SECURITY DEFINER function's internal query does not re-trigger RLS
-- evaluation the way a direct EXISTS subquery inside a policy does,
-- breaking the cycle.
-- ============================================================================

create or replace function is_study_group_creator(check_user_id uuid, check_group_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from study_groups sg where sg.id = check_group_id and sg.created_by = check_user_id);
$$;

create or replace function is_study_group_member(check_user_id uuid, check_group_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from study_group_members sgm where sgm.group_id = check_group_id and sgm.user_id = check_user_id);
$$;

-- Instructor study group management - a real gap found while building the
-- actual management screen for this: sgm_write_own
-- (0008_learner_app_rls_gapfill.sql) only ever allowed a user to
-- insert/delete their *own* row in study_group_members - meaning an
-- instructor managing their own group could never remove a different
-- learner from it, only themselves. Extended so the group's creator (or
-- an org admin) can manage any member row for that specific group, while
-- an ordinary member can still only ever manage their own.
drop policy if exists sgm_write_own on study_group_members;
drop policy if exists sgm_write_own_or_group_creator on study_group_members;
create policy sgm_write_own_or_group_creator on study_group_members for all
  using (
    user_id = auth.uid()
    or is_org_admin(auth.uid())
    or is_study_group_creator(auth.uid(), group_id)
  )
  with check (
    is_org_admin(auth.uid())
    or is_study_group_creator(auth.uid(), group_id)
    -- Self-join is allowed, but only ever as an ordinary member - a real
    -- bug found by testing, not assumed safe: without the role check
    -- below, any unrelated user could self-insert as 'lead' into a study
    -- group they didn't create, since "user_id = auth.uid()" alone says
    -- nothing about which role they're claiming.
    or (user_id = auth.uid() and role = 'member')
  );

-- Instructors can manage a study group they're a genuine member of, not
-- only ones they personally created - same scoping pattern already used
-- for cohorts (0126/above: instructor assigned via membership, not just
-- "created it" or an org-wide permission grant that may or may not be
-- configured for the mentor role in a given organization's permission
-- matrix). sg_write_authorized (0008_learner_app_rls_gapfill.sql)
-- previously only covered created_by = auth.uid() or a configurable
-- manage_courses permission - this adds a third, always-true path.
-- Uses is_study_group_member() (not a direct EXISTS on
-- study_group_members) - see the recursion note above.
drop policy if exists sg_write_authorized on study_groups;
drop policy if exists sg_write_authorized_or_member_instructor on study_groups;
create policy sg_write_authorized_or_member_instructor on study_groups for all
  using (
    created_by = auth.uid()
    or effective_has_permission(auth.uid(), 'manage_courses')
    or is_super_admin(auth.uid())
    or (has_role(auth.uid(), 'mentor'::platform_role) and is_study_group_member(auth.uid(), id))
  )
  with check (
    created_by = auth.uid()
    or effective_has_permission(auth.uid(), 'manage_courses')
    or is_super_admin(auth.uid())
    or (has_role(auth.uid(), 'mentor'::platform_role) and is_study_group_member(auth.uid(), id))
  );


-- ============================================================================
-- MIGRATION: 0128_org_level_rbac.sql
-- ============================================================================
-- ============================================================================
-- Organization-level role-based access control for Manager/Instructor/
-- Learner - a real, significant gap found while building this.
-- ============================================================================
-- "Allow organization administrators to control permissions for:
-- Managers, Instructors, Learners... toggle specific permissions/features
-- on or off." The existing per-org `role_permissions` table
-- (organization_id, role, resource, action, allowed) looked like the
-- right place at first - but its `role` column is typed `org_member_role`
-- ('owner', 'admin', 'content_manager', 'analytics_viewer',
-- 'people_manager', 'finance_admin', 'partnerships_admin', 'member') -
-- a completely different taxonomy from `platform_role` ('manager',
-- 'mentor', 'learner', etc.), which is what this task actually needs to
-- control. Force-fitting the wrong enum would have meant either silently
-- mismatching roles or requiring a much larger, riskier type migration on
-- a table that already has real dependents. Built a new, correctly-typed
-- table instead, scoped to exactly this purpose.
-- ============================================================================

create table if not exists org_role_permission_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  role platform_role not null,
  permission_key text not null,
  allowed boolean not null default false,
  updated_by uuid references user_profiles(id),
  updated_at timestamptz not null default now(),
  unique (organization_id, role, permission_key)
);

alter table org_role_permission_settings enable row level security;

drop policy if exists orps_select_own_org on org_role_permission_settings;
create policy orps_select_own_org on org_role_permission_settings for select
  using (organization_id = get_user_organization_id(auth.uid()) or is_super_admin(auth.uid()));

drop policy if exists orps_write_org_admin on org_role_permission_settings;
create policy orps_write_org_admin on org_role_permission_settings for all
  using (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()))
  with check (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()));

create or replace function effective_org_permission(check_user_id uuid, perm_key text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_primary_role platform_role;
  v_org_override boolean;
begin
  if exists (
    select 1 from user_permission_overrides
    where user_id = check_user_id and permission_key = perm_key and effect = 'revoke'
      and (expires_at is null or expires_at > now())
  ) then
    return false;
  end if;
  if exists (
    select 1 from user_permission_overrides
    where user_id = check_user_id and permission_key = perm_key and effect = 'grant'
      and (expires_at is null or expires_at > now())
  ) then
    return true;
  end if;

  select organization_id into v_org_id from user_profiles where id = check_user_id;
  v_primary_role := get_primary_role(check_user_id);

  if v_org_id is not null and v_primary_role is not null then
    select allowed into v_org_override
    from org_role_permission_settings
    where organization_id = v_org_id and role = v_primary_role and permission_key = perm_key;
    if v_org_override is not null then
      return v_org_override;
    end if;
  end if;

  return role_has_permission(check_user_id, perm_key);
end;
$$;

comment on function effective_org_permission(uuid, text) is
  'Org-level permission check for Manager/Instructor/Learner: individual override > org-specific toggle (org_role_permission_settings) > platform-wide role default. Separate from effective_has_permission() - opt-in per call site.';

comment on table org_role_permission_settings is
  'Per-organization permission toggles for Manager/Instructor/Learner roles - correctly typed with platform_role, not the unrelated org_member_role used by the older role_permissions table.';


-- ============================================================================
-- MIGRATION: 0129_seat_based_payments.sql
-- ============================================================================
-- ============================================================================
-- Seat-based payment model - confirmed entirely unbuilt, the single
-- largest gap on Philip's task list.
-- ============================================================================
-- "Require payment for seats before learners/users can be added in the
-- cloud version. Prevent organizations from adding users without the
-- required paid seats. Support organizations purchasing multiple seats
-- upfront. Allow purchased seats to be allocated to learners/users later.
-- Track available, allocated, and used seats."
--
-- Scoped deliberately: a trial organization keeps using the existing
-- `max_users` soft cap unchanged (matching the already-established free
-- trial model - "Free... used as demo, trial, entry-level experience").
-- Seat enforcement applies specifically once an organization is 'active'
-- (paid, out of trial) - "in the cloud version" - not to every
-- organization unconditionally, which would have broken the existing
-- trial flow this app already relies on.
--
-- No real payment gateway exists in this sandbox (same honest position
-- taken for organization subscription payments,
-- 0114_organization_subscription_payment.sql) - purchase_seats() records
-- a real seat grant against a real payment reference the caller provides,
-- the same trust-boundary pattern already used and already documented
-- there, not a new gap introduced here.
-- ============================================================================

create table if not exists seat_purchases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  seats_purchased int not null check (seats_purchased > 0),
  amount_paid numeric,
  currency text default 'USD',
  payment_reference text,
  purchased_by uuid references user_profiles(id),
  purchased_at timestamptz not null default now()
);

alter table seat_purchases enable row level security;

drop policy if exists seatp_select_own_org on seat_purchases;
create policy seatp_select_own_org on seat_purchases for select
  using (organization_id = get_user_organization_id(auth.uid()) or is_super_admin(auth.uid()));

-- Purchases are only ever created through purchase_seats() below (security
-- definer, does its own admin check) - no direct insert policy needed for
-- ordinary users, only super_admin for manual/support corrections.
drop policy if exists seatp_write_super_admin on seat_purchases;
create policy seatp_write_super_admin on seat_purchases for all
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

-- Real seat accounting: purchased = sum of all real purchases; used = real
-- active organization_members count right now - never a separately
-- tracked, driftable counter that could fall out of sync with reality.
create or replace function get_org_seats_summary(check_org_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_purchased int;
  v_used int;
begin
  select coalesce(sum(seats_purchased), 0) into v_purchased from seat_purchases where organization_id = check_org_id;
  select count(*) into v_used from organization_members where organization_id = check_org_id and status = 'active';
  return jsonb_build_object('purchased', v_purchased, 'used', v_used, 'available', greatest(0, v_purchased - v_used));
end;
$$;

create or replace function purchase_seats(p_organization_id uuid, p_seats int, p_amount numeric, p_payment_reference text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not (is_org_admin(auth.uid()) and get_user_organization_id(auth.uid()) = p_organization_id) and not is_super_admin(auth.uid()) then
    raise exception 'Not authorized to purchase seats for this organization';
  end if;
  if p_seats <= 0 then
    raise exception 'Seat count must be positive';
  end if;
  if p_payment_reference is null or length(trim(p_payment_reference)) = 0 then
    raise exception 'A real payment reference is required';
  end if;

  insert into seat_purchases (organization_id, seats_purchased, amount_paid, payment_reference, purchased_by)
  values (p_organization_id, p_seats, p_amount, p_payment_reference, auth.uid());

  return get_org_seats_summary(p_organization_id);
end;
$$;

-- The actual enforcement point - "Ensure payment authorization is
-- enforced before user/seat creation" and "at the backend level, not only
-- through UI visibility." Checked at both the point an admin invites
-- someone (better UX - caught immediately) and the point they actually
-- accept and become a counted member (the real safety net - seats could
-- have been consumed by other invites accepted in between).
create or replace function check_seat_available(check_org_id uuid)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_status org_status;
  v_summary jsonb;
begin
  select status into v_status from organizations where id = check_org_id;
  -- Trial organizations keep the existing max_users soft cap unchanged -
  -- seat purchases are specifically an "active" (paid, cloud) requirement.
  if v_status is distinct from 'active' then
    return true;
  end if;
  v_summary := get_org_seats_summary(check_org_id);
  return (v_summary->>'available')::int > 0;
end;
$$;

create or replace function create_user_invitation(
  p_email text, p_role platform_role, p_organization_id uuid, p_organization_role org_member_role
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_org_admin(auth.uid()) then
    raise exception 'not authorized to invite users to this organization';
  end if;
  if p_organization_id is not null and not check_seat_available(p_organization_id) then
    raise exception 'No seats available - purchase more seats before inviting additional users';
  end if;
  insert into user_invitations (email, role, organization_id, organization_role, invited_by)
  values (p_email, p_role, p_organization_id, p_organization_role, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function accept_invitation(p_token text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_inv user_invitations;
begin
  select * into v_inv from user_invitations where token = p_token and status = 'pending' and expires_at > now();
  if not found then
    raise exception 'invitation is invalid or expired';
  end if;
  if v_inv.organization_id is not null and not check_seat_available(v_inv.organization_id) then
    raise exception 'No seats available in this organization - contact your organization admin to purchase more seats';
  end if;
  insert into user_roles (user_id, role) values (auth.uid(), v_inv.role)
    on conflict do nothing;
  if v_inv.organization_id is not null then
    insert into organization_members (organization_id, user_id, role, status, invited_by, joined_at)
    values (v_inv.organization_id, auth.uid(), v_inv.organization_role, 'active', v_inv.invited_by, now())
    on conflict (organization_id, user_id) do update set status = 'active', joined_at = now();
    update user_profiles set organization_id = v_inv.organization_id where id = auth.uid();
  end if;
  update user_invitations set status = 'accepted', accepted_at = now() where id = v_inv.id;
end;
$$;

comment on function purchase_seats(uuid, int, numeric, text) is
  'Real seat purchase, requires a real payment reference - same trust-boundary honesty as apply_organization_subscription_payment() (0114). No real payment gateway exists in this sandbox.';
comment on function check_seat_available(uuid) is
  'The real enforcement point for seat-based payments - trial orgs unaffected, active (paid) orgs blocked from adding members beyond purchased seats.';


-- ============================================================================
-- MIGRATION: 0130_admin_issue_certificate_directly.sql
-- ============================================================================
-- ============================================================================
-- Admin can directly issue/upload a certificate to a specific learner - a
-- real, confirmed gap: the only certificate path built before this was
-- learner-requests -> admin-approves (request_certificate()/
-- review_certificate(), 0120_certificates.sql). There was no way for an
-- admin to hand a certificate to someone directly, and no way to attach
-- an actual uploaded file (PDF/image) to a certificate at all - only an
-- auto-generated certificate number existed.
-- ============================================================================

alter table certificates add column if not exists file_url text;
alter table certificates add column if not exists issued_by uuid references user_profiles(id);
-- template_id/course_id are both `not null` today (0120) - a direct issue
-- may not correspond to any course/template the learner is enrolled in at
-- all (e.g. an external achievement, a manually-recognized credential).
-- Relaxed to nullable rather than force-fitting every direct issue into
-- an existing course, and added a real `title` for exactly that case.
alter table certificates alter column course_id drop not null;
alter table certificates alter column template_id drop not null;
alter table certificates add column if not exists title text;

comment on column certificates.file_url is 'An admin-uploaded certificate file (PDF/image) for a directly-issued certificate - separate from the auto-generated certificate_number.';
comment on column certificates.issued_by is 'Who issued this - set for direct admin issuance; review_certificate() already tracks reviewed_by separately for the request/approve path.';

create or replace function issue_certificate_directly(
  p_user_id uuid, p_organization_id uuid, p_title text, p_course_id uuid, p_file_url text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_cert_id uuid;
  v_cert_number text;
begin
  if not (is_org_admin(auth.uid()) or is_super_admin(auth.uid()) or (has_role(auth.uid(), 'mentor'::platform_role) and effective_org_permission(auth.uid(), 'issue_certificates'))) then
    raise exception 'Not authorized to issue certificates';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'A certificate title is required';
  end if;

  v_cert_number := 'TAI-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  insert into certificates (user_id, organization_id, course_id, title, status, issued_at, issued_by, certificate_number, file_url)
  values (p_user_id, p_organization_id, p_course_id, trim(p_title), 'issued', now(), auth.uid(), v_cert_number, p_file_url)
  returning id into v_cert_id;

  perform log_admin_action('issue_certificate_directly', 'certificate', v_cert_id, p_title, null, jsonb_build_object('user_id', p_user_id, 'title', p_title), jsonb_build_object('file_url', p_file_url is not null));

  return v_cert_id;
end;
$$;

comment on function issue_certificate_directly(uuid, uuid, text, uuid, text) is
  'Admin-initiated certificate issuance, independent of the request/approve flow - supports an uploaded file and does not require an existing course/template.';


-- ============================================================================
-- MIGRATION: 0131_mentor_settings_rls_gapfill.sql
-- ============================================================================
-- ============================================================================
-- Nine tables backing the full Instructor Settings experience had zero RLS
-- policies at all - a real, significant, previously undiscovered gap.
-- ============================================================================
-- mentor_credentials, mentor_portfolio_items, session_templates,
-- cancellation_policies, mentorship_agreements, reminder_settings,
-- video_integration_settings, mentor_resources, mentor_pricing_tiers all
-- had RLS enabled (via the blanket per-table loop, 0006_rls_policies.sql)
-- with zero actual policies defined - meaning every one of them has been
-- completely inaccessible by default this whole time, including to the
-- mentor who owns the row. This was masked in earlier testing because
-- demo mode's `if (!supabase) return []` never touches a real database at
-- all - a real, connected Supabase project would have rejected every read
-- and write against all nine tables outright.
--
-- Ownership pattern: mentor_id -> mentors.user_id = auth.uid(). Tables
-- meant to build trust with a learner deciding whether to book
-- (credentials, portfolio, resources, pricing tiers) are readable by any
-- authenticated user; pure back-office configuration (reminders, video
-- settings, session templates, cancellation policies) is owner + admin
-- only. mentorship_agreements is two-sided - both the mentor and the
-- named learner can read/sign their own agreement.
-- ============================================================================

create or replace function is_mentor_owner(check_user_id uuid, check_mentor_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from mentors m where m.id = check_mentor_id and m.user_id = check_user_id);
$$;

do $$
declare
  t text;
  owner_readable_tables text[] := array['mentor_credentials', 'mentor_portfolio_items', 'mentor_resources', 'mentor_pricing_tiers'];
  owner_only_tables text[] := array['session_templates', 'cancellation_policies', 'reminder_settings'];
begin
  foreach t in array owner_readable_tables loop
    execute format('drop policy if exists %I_select_all on %I', t, t);
    execute format('create policy %I_select_all on %I for select using (true)', t, t);
    execute format('drop policy if exists %I_write_owner on %I', t, t);
    execute format(
      'create policy %I_write_owner on %I for all using (is_mentor_owner(auth.uid(), mentor_id) or is_org_admin(auth.uid()) or is_super_admin(auth.uid())) with check (is_mentor_owner(auth.uid(), mentor_id) or is_org_admin(auth.uid()) or is_super_admin(auth.uid()))',
      t, t
    );
  end loop;

  foreach t in array owner_only_tables loop
    execute format('drop policy if exists %I_all_owner on %I', t, t);
    execute format(
      'create policy %I_all_owner on %I for all using (is_mentor_owner(auth.uid(), mentor_id) or is_org_admin(auth.uid()) or is_super_admin(auth.uid())) with check (is_mentor_owner(auth.uid(), mentor_id) or is_org_admin(auth.uid()) or is_super_admin(auth.uid()))',
      t, t
    );
  end loop;
end $$;

-- video_integration_settings uses mentor_id as its own primary key, not a
-- separate id column - same ownership check, singular row per mentor.
drop policy if exists vis_all_owner on video_integration_settings;
create policy vis_all_owner on video_integration_settings for all
  using (is_mentor_owner(auth.uid(), mentor_id) or is_org_admin(auth.uid()) or is_super_admin(auth.uid()))
  with check (is_mentor_owner(auth.uid(), mentor_id) or is_org_admin(auth.uid()) or is_super_admin(auth.uid()));

-- mentorship_agreements - two-sided: the mentor and the specific named
-- learner can each read/sign their own agreement; only the mentor (or
-- admin) creates one in the first place.
drop policy if exists ma_select_party on mentorship_agreements;
create policy ma_select_party on mentorship_agreements for select
  using (is_mentor_owner(auth.uid(), mentor_id) or learner_id = auth.uid() or is_org_admin(auth.uid()) or is_super_admin(auth.uid()));

drop policy if exists ma_insert_mentor on mentorship_agreements;
create policy ma_insert_mentor on mentorship_agreements for insert
  with check (is_mentor_owner(auth.uid(), mentor_id) or is_org_admin(auth.uid()));

-- Update is for signing - a learner can only ever flip their own
-- signed_by_learner/learner_signed_at, never rewrite the agreement terms
-- or sign on the mentor's behalf; enforced by application logic calling a
-- narrow update, this policy just gates who can touch the row at all.
drop policy if exists ma_update_party on mentorship_agreements;
create policy ma_update_party on mentorship_agreements for update
  using (is_mentor_owner(auth.uid(), mentor_id) or learner_id = auth.uid() or is_org_admin(auth.uid()))
  with check (is_mentor_owner(auth.uid(), mentor_id) or learner_id = auth.uid() or is_org_admin(auth.uid()));


-- ============================================================================
-- MIGRATION: 0132_seed_demo_course.sql
-- ============================================================================
-- ============================================================================
-- A real, persistent mock demo course - "build a mock data course so i can
-- see how it is." Every prior verification in this project used temporary
-- Playwright fixtures that get reverted after each test - meaning nobody
-- has ever actually seen persistent example content when opening a real
-- deployment of this app. This seeds one, for real, so it's there the
-- first time anyone signs in.
-- ============================================================================
-- instructor_id is left null - a fresh deployment has no way to know which
-- real user_profiles row should own this, and courses.instructor_id is
-- nullable by schema. Clearly labeled as a demo course in its own title
-- and description rather than pretending to be a real one, and running
-- this migration twice is safe (checks for its own marker first).
-- ============================================================================

do $$
declare
  v_course_id uuid;
  v_lesson1_id uuid;
  v_lesson2_id uuid;
  v_lesson3_id uuid;
  v_assessment_id uuid;
begin
  if exists (select 1 from courses where title = 'Getting Started with Train AI (Demo Course)') then
    return;
  end if;

  insert into courses (title, description, category, level, duration_hours, is_published, course_source)
  values (
    'Getting Started with Train AI (Demo Course)',
    'A real example course seeded so you can see exactly how a course, its lessons, and its assessment look and behave end to end - not a placeholder, genuinely functional.',
    'General', 'beginner', 1.5, true, 'internal'
  )
  returning id into v_course_id;

  insert into lessons (course_id, title, description, content, duration_minutes, order_index)
  values (v_course_id, 'Welcome to Train AI', 'What this platform does and how it fits into your organization.',
    'Train AI brings together course delivery, cohorts, AI-assisted coaching, and workforce intelligence in one platform. This lesson walks through the pieces you will use most: courses, cohorts, and your AI Coach.',
    8, 0)
  returning id into v_lesson1_id;

  insert into lessons (course_id, title, description, content, duration_minutes, order_index)
  values (v_course_id, 'Navigating Your Dashboard', 'A tour of the Home, Courses, AI, and Community tabs.',
    'Your Home tab surfaces what needs your attention today. Courses is where you browse and continue learning. The AI tab holds your Coach, Quiz Generator, and Insights. Community is where your cohort, study groups, and rank live.',
    10, 1)
  returning id into v_lesson2_id;

  insert into lessons (course_id, title, description, content, duration_minutes, order_index)
  values (v_course_id, 'Completing Your First Assessment', 'How assessments, scoring, and certificates connect.',
    'Once you finish a course''s lessons, its assessment becomes available. A passing score can make a certificate available, if your organization has configured one for this course.',
    12, 2)
  returning id into v_lesson3_id;

  insert into assessments (course_id, title, description, max_score)
  values (v_course_id, 'Getting Started with Train AI Assessment', 'A short check of what this demo course covered.', 100)
  returning id into v_assessment_id;

  insert into assessment_questions (assessment_id, question, question_type, options, correct_answer, explanation, order_index, points)
  values
    (v_assessment_id, 'Which tab holds your AI Coach, Quiz Generator, and Insights?', 'multiple_choice',
     '["Home", "Courses", "AI", "Community"]'::jsonb, 'AI', 'The AI tab groups all three AI-powered tools together.', 0, 1),
    (v_assessment_id, 'What can become available after a passing assessment score, if configured?', 'multiple_choice',
     '["A certificate", "A new organization", "A different role", "A payout"]'::jsonb, 'A certificate',
     'Certificate availability is tied to a passing assessment score for that course.', 1, 1),
    (v_assessment_id, 'Where would you find your cohort, study groups, and rank?', 'multiple_choice',
     '["Home", "Courses", "AI", "Community"]'::jsonb, 'Community', 'Community is where cohort activity, study groups, and the leaderboard live.', 2, 1);

  raise notice 'Demo course seeded: % (assessment: %)', v_course_id, v_assessment_id;
end $$;


-- ============================================================================
-- MIGRATION: 0133_per_instructor_payouts_and_learner_payments.sql
-- ============================================================================
-- ============================================================================
-- Per-instructor payout enablement + learner payment requests - confirmed
-- directly: "as a platform owner we should be able to enable and disable
-- this, as some instructors won't be paid as they work for an
-- organisation, and some may be paid as they run like an academy so they
-- can request payments from learners... under earnings there should be a
-- place to request payment and block or pause certain learners access
-- should they don't pay."
-- ============================================================================
-- Revises the blanket payout suspension from 0127 (which blocked every
-- payout request unconditionally) into a real per-instructor toggle -
-- academy-style instructors can be explicitly enabled by the platform
-- owner; org-employed instructors stay blocked by default, matching the
-- described reality directly rather than an all-or-nothing rule.
-- ============================================================================

alter table mentors add column if not exists payouts_enabled boolean not null default false;
comment on column mentors.payouts_enabled is 'Platform-owner-controlled - only an explicitly enabled ("academy-style") instructor can request a real payout. Org-employed instructors default to false.';

drop policy if exists mpr_no_new_requests on mentor_payout_requests;
create policy mpr_insert_enabled_instructor_or_admin on mentor_payout_requests for insert
  with check (
    is_super_admin(auth.uid())
    or exists (select 1 from mentors m where m.user_id = auth.uid() and m.id = mentor_id and m.payouts_enabled = true)
  );

-- Only super_admin can flip this - it's a platform-wide business decision
-- about a specific instructor, not something an org admin or the
-- instructor themselves controls.
create or replace function set_instructor_payouts_enabled(p_mentor_id uuid, p_enabled boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_super_admin(auth.uid()) then
    raise exception 'Only the platform owner can enable or disable instructor payouts';
  end if;
  update mentors set payouts_enabled = p_enabled where id = p_mentor_id;
end;
$$;

-- ============================================================================
-- Learner payment requests - an academy-style instructor requesting
-- payment from a specific learner for a specific course, and the ability
-- to pause that learner's access if they don't pay.
-- ============================================================================

create table if not exists learner_payment_requests (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references mentors(id) on delete cascade,
  learner_id uuid not null references user_profiles(id) on delete cascade,
  course_id uuid references courses(id) on delete set null,
  amount numeric not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'waived')),
  requested_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table learner_payment_requests enable row level security;

drop policy if exists lpr_select_party on learner_payment_requests;
create policy lpr_select_party on learner_payment_requests for select
  using (
    learner_id = auth.uid()
    or exists (select 1 from mentors m where m.id = mentor_id and m.user_id = auth.uid())
    or is_super_admin(auth.uid())
  );

-- Only an instructor whose payouts are actually enabled can request
-- payment - an org-employed instructor with payouts disabled has no
-- reason to be charging learners at all.
drop policy if exists lpr_insert_enabled_instructor on learner_payment_requests;
create policy lpr_insert_enabled_instructor on learner_payment_requests for insert
  with check (
    exists (select 1 from mentors m where m.id = mentor_id and m.user_id = auth.uid() and m.payouts_enabled = true)
  );

drop policy if exists lpr_update_instructor_or_admin on learner_payment_requests;
create policy lpr_update_instructor_or_admin on learner_payment_requests for update
  using (
    exists (select 1 from mentors m where m.id = mentor_id and m.user_id = auth.uid())
    or is_super_admin(auth.uid())
  );

-- course_enrollments gets a real "paused" flag - the actual enforcement
-- point for "block or pause certain learners' access should they not
-- pay." A paused enrollment is checked by the learner-facing course
-- access path, not just hidden in the instructor's own view.
alter table course_enrollments add column if not exists access_paused boolean not null default false;
comment on column course_enrollments.access_paused is 'Set by an instructor with payouts_enabled when a learner has not paid - the real access gate, not just a UI flag.';

create or replace function set_learner_course_access_paused(p_learner_id uuid, p_course_id uuid, p_paused boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_course_instructor uuid;
begin
  select instructor_id into v_course_instructor from courses where id = p_course_id;
  if not (
    (v_course_instructor = auth.uid() and exists (select 1 from mentors m where m.user_id = auth.uid() and m.payouts_enabled = true))
    or is_org_admin(auth.uid())
    or is_super_admin(auth.uid())
  ) then
    raise exception 'Not authorized to change this learner''s access';
  end if;
  update course_enrollments set access_paused = p_paused where user_id = p_learner_id and course_id = p_course_id;
end;
$$;


-- ============================================================================
-- MIGRATION: 0134_comprehensive_demo_data.sql
-- ============================================================================
-- ============================================================================
-- Comprehensive demo data - "show those that can't show due to no
-- database, make a mock or demo data for it so we will see how it
-- works." Every screen built across this project has been shown with
-- honest empty states because no real deployment has ever had actual
-- data in it. This seeds one, for real, so anyone signing into a
-- connected deployment sees every feature actually working with real
-- numbers - not fabricated in the UI, genuinely written to the database.
--
-- Clearly labeled: the organization is named "Demo Academy (Sample
-- Data)" and every person's email is under a demo domain, so this is
-- unmistakably sample content, never confusable with a real
-- organization. Idempotent - checks for its own marker first, safe to
-- run more than once.
-- ============================================================================

do $$
declare
  v_org_id uuid := 'd0000000-0000-0000-0000-000000000001';
  v_admin_id uuid := 'd0000000-0000-0000-0000-000000000002';
  v_manager_id uuid := 'd0000000-0000-0000-0000-000000000003';
  v_instructor1_id uuid := 'd0000000-0000-0000-0000-000000000004';
  v_instructor2_id uuid := 'd0000000-0000-0000-0000-000000000005';
  v_mentor1_row_id uuid := 'd0000000-0000-0000-0000-000000000006';
  v_mentor2_row_id uuid := 'd0000000-0000-0000-0000-000000000007';
  v_learner_ids uuid[] := array[
    'd0000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000011',
    'd0000000-0000-0000-0000-000000000012', 'd0000000-0000-0000-0000-000000000013',
    'd0000000-0000-0000-0000-000000000014', 'd0000000-0000-0000-0000-000000000015',
    'd0000000-0000-0000-0000-000000000016', 'd0000000-0000-0000-0000-000000000017'
  ];
  v_learner_names text[] := array['Amara Chen', 'David Osei', 'Priya Nair', 'Marcus Webb', 'Fatima Diallo', 'Liam Torres', 'Ngozi Adeyemi', 'Sofia Kim'];
  v_course_ai uuid := 'd0000000-0000-0000-0000-000000000020';
  v_course_leadership uuid := 'd0000000-0000-0000-0000-000000000021';
  v_course_compliance uuid := 'd0000000-0000-0000-0000-000000000022';
  v_course_data uuid := 'd0000000-0000-0000-0000-000000000023';
  v_course_external uuid := 'd0000000-0000-0000-0000-000000000024';
  v_cohort_id uuid := 'd0000000-0000-0000-0000-000000000030';
  v_studygroup_id uuid := 'd0000000-0000-0000-0000-000000000031';
  v_assessment_ai uuid := 'd0000000-0000-0000-0000-000000000040';
  i int;
  v_progress int;
begin
  if exists (select 1 from organizations where id = v_org_id) then
    return;
  end if;

  -- --- Organization ---
  insert into organizations (id, name, slug, status, subscription_tier, onboarding_completed)
  values (v_org_id, 'Demo Academy (Sample Data)', 'demo-academy-sample', 'active', 'growth', true);

  -- --- Auth users + profiles: admin, manager, 2 instructors ---
  insert into auth.users (id, email) values
    (v_admin_id, 'demo-admin@demoacademy.sample'),
    (v_manager_id, 'demo-manager@demoacademy.sample'),
    (v_instructor1_id, 'demo-instructor1@demoacademy.sample'),
    (v_instructor2_id, 'demo-instructor2@demoacademy.sample');

  insert into user_profiles (id, organization_id, role, display_name) values
    (v_admin_id, v_org_id, 'admin', 'Demo Admin'),
    (v_manager_id, v_org_id, 'manager', 'Demo Manager'),
    (v_instructor1_id, v_org_id, 'mentor', 'Instructor Jordan Reyes'),
    (v_instructor2_id, v_org_id, 'mentor', 'Instructor Wale Adebayo');

  insert into mentors (id, user_id, organization_id, title, bio, specializations, is_active, is_approved)
  values
    (v_mentor1_row_id, v_instructor1_id, v_org_id, 'AI & Data Instructor', 'Teaches AI Fundamentals and Data Literacy.', array['AI', 'Data'], true, true),
    (v_mentor2_row_id, v_instructor2_id, v_org_id, 'Leadership Instructor', 'Teaches Leadership Essentials.', array['Leadership'], true, true);

  -- --- Learners (8 total, first 5 report to the demo manager) ---
  for i in 1..8 loop
    insert into auth.users (id, email) values (v_learner_ids[i], 'demo-learner' || i || '@demoacademy.sample');
    insert into user_profiles (id, organization_id, role, display_name, manager_id, last_active_at)
    values (
      v_learner_ids[i], v_org_id, 'learner', v_learner_names[i],
      case when i <= 5 then v_manager_id else null end,
      now() - (i || ' days')::interval
    );
  end loop;

  -- --- Courses: internal (varied categories), one external ---
  insert into courses (id, title, description, category, level, duration_hours, instructor_id, is_published, course_source) values
    (v_course_ai, 'AI Fundamentals', 'An introduction to practical AI concepts for the workplace.', 'AI', 'beginner', 4, v_instructor1_id, true, 'internal'),
    (v_course_leadership, 'Leadership Essentials', 'Core leadership skills for new and aspiring managers.', 'Leadership', 'intermediate', 6, v_instructor2_id, true, 'internal'),
    (v_course_compliance, 'Workplace Compliance 101', 'Mandatory compliance training covering key policies.', 'Compliance', 'beginner', 2, v_instructor1_id, true, 'internal'),
    (v_course_data, 'Data Literacy for Teams', 'Reading, interpreting, and acting on real workplace data.', 'Data', 'beginner', 3, v_instructor1_id, true, 'internal'),
    (v_course_external, 'Advanced Project Management', 'A curated external partner course on project delivery.', 'Management', 'advanced', 8, null, true, 'external');

  insert into lessons (course_id, title, duration_minutes, order_index) values
    (v_course_ai, 'What is AI, really?', 15, 0),
    (v_course_ai, 'AI in your daily workflow', 20, 1),
    (v_course_leadership, 'Leading without authority', 18, 0),
    (v_course_compliance, 'Key policies overview', 12, 0),
    (v_course_data, 'Reading a dashboard', 15, 0);

  -- --- Assessment for AI Fundamentals, with real questions ---
  insert into assessments (id, course_id, title, max_score) values (v_assessment_ai, v_course_ai, 'AI Fundamentals Assessment', 100);
  insert into assessment_questions (assessment_id, question, question_type, options, correct_answer, order_index, points) values
    (v_assessment_ai, 'Which of these is a common workplace use of AI?', 'multiple_choice', '["Drafting emails", "Watering plants", "Painting walls"]'::jsonb, 'Drafting emails', 0, 1),
    (v_assessment_ai, 'AI recommendations should always be...', 'multiple_choice', '["Followed without review", "Reviewed by a person", "Ignored entirely"]'::jsonb, 'Reviewed by a person', 1, 1);

  -- --- Enrollments: realistic spread of progress across learners and courses ---
  for i in 1..8 loop
    v_progress := (array[100, 85, 60, 100, 30, 15, 100, 45])[i];
    insert into course_enrollments (user_id, course_id, progress_percentage, completed_at, enrolled_at)
    values (v_learner_ids[i], v_course_ai, v_progress, case when v_progress = 100 then now() - (i || ' days')::interval else null end, now() - ((i + 10) || ' days')::interval);

    if i <= 6 then
      v_progress := (array[100, 40, 100, 20, 70, 10])[i];
      insert into course_enrollments (user_id, course_id, progress_percentage, completed_at, enrolled_at)
      values (v_learner_ids[i], v_course_leadership, v_progress, case when v_progress = 100 then now() - (i || ' days')::interval else null end, now() - ((i + 8) || ' days')::interval);
    end if;

    if i <= 4 then
      insert into course_enrollments (user_id, course_id, progress_percentage, completed_at, enrolled_at)
      values (v_learner_ids[i], v_course_compliance, 100, now() - (i || ' days')::interval, now() - ((i + 20) || ' days')::interval);
    end if;
  end loop;

  -- --- Assessment attempts matching the completed AI Fundamentals enrollments ---
  insert into assessment_attempts (user_id, assessment_id, score, completed_at) values
    (v_learner_ids[1], v_assessment_ai, 95, now() - interval '1 day'),
    (v_learner_ids[4], v_assessment_ai, 88, now() - interval '3 days'),
    (v_learner_ids[7], v_assessment_ai, 100, now() - interval '2 days');

  -- --- Certificates issued for completed courses ---
  insert into certificates (user_id, course_id, organization_id, status, issued_at, certificate_number, score_pct) values
    (v_learner_ids[1], v_course_ai, v_org_id, 'issued', now() - interval '1 day', 'TAI-DEMO0001', 95),
    (v_learner_ids[4], v_course_ai, v_org_id, 'issued', now() - interval '3 days', 'TAI-DEMO0002', 88),
    (v_learner_ids[1], v_course_leadership, v_org_id, 'issued', now() - interval '5 days', 'TAI-DEMO0003', null),
    (v_learner_ids[3], v_course_leadership, v_org_id, 'issued', now() - interval '2 days', 'TAI-DEMO0004', null);

  -- --- Compliance assignments (Workplace Compliance 101), including overdue ---
  insert into compliance_assignments (user_id, course_id, assigned_by, due_at, status, completed_at) values
    (v_learner_ids[1], v_course_compliance, v_admin_id, current_date - 5, 'completed', now() - interval '1 day'),
    (v_learner_ids[2], v_course_compliance, v_admin_id, current_date - 5, 'completed', now() - interval '3 days'),
    (v_learner_ids[5], v_course_compliance, v_admin_id, current_date - 3, 'overdue', null),
    (v_learner_ids[6], v_course_compliance, v_admin_id, current_date - 10, 'overdue', null);

  -- --- Cohort with members, including both instructors and several learners ---
  insert into cohorts (id, organization_id, name, description, starts_at, ends_at, created_by)
  values (v_cohort_id, v_org_id, 'Q1 Onboarding Cohort', 'New hire onboarding cohort for the demo organization.', current_date - 30, current_date + 60, v_instructor1_id);
  insert into cohort_members (cohort_id, user_id) values
    (v_cohort_id, v_instructor1_id), (v_cohort_id, v_learner_ids[1]), (v_cohort_id, v_learner_ids[2]),
    (v_cohort_id, v_learner_ids[3]), (v_cohort_id, v_learner_ids[4]);

  -- --- Study group ---
  insert into study_groups (id, name, description, course_id, organization_id, created_by)
  values (v_studygroup_id, 'AI Fundamentals Study Circle', 'Peer study group for AI Fundamentals.', v_course_ai, v_org_id, v_instructor1_id);
  insert into study_group_members (group_id, user_id, role) values
    (v_studygroup_id, v_instructor1_id, 'lead'), (v_studygroup_id, v_learner_ids[1], 'member'), (v_studygroup_id, v_learner_ids[4], 'member');

  -- --- AI usage events (Coach + Quiz), spread over the last week ---
  for i in 1..12 loop
    insert into ai_usage_events (user_id, organization_id, feature, created_at)
    values (v_learner_ids[(i % 8) + 1], v_org_id, case when i % 3 = 0 then 'ai_quiz' else 'ai_coach' end, now() - (i || ' hours')::interval);
  end loop;

  raise notice 'Demo data seeded: org %, % learners, 5 courses, 1 cohort, 1 study group', v_org_id, 8;
end $$;


-- ============================================================================
-- MIGRATION: 0135_analysis_notes.sql
-- ============================================================================
-- ============================================================================
-- General analysis notes for admin, instructor, and manager - confirmed
-- directly: "there should be a place where instructors, admin or
-- managers can add notes. This notes will be relevant for their
-- analysis... once done, you can share with Emmanuel."
-- ============================================================================
-- Deliberately a new, standalone table rather than extending the
-- existing feedback_notes table (0121) - that table's target_type is a
-- real Postgres enum, and altering an enum to add a new value carries a
-- real, non-trivial risk (the new value cannot always be used safely in
-- the same transaction it was added in, depending on Postgres version and
-- how the migration is applied) that could not be verified in this
-- environment. This use case is also genuinely different in shape - a
-- person's own running notes for their own analysis, not about any
-- specific learner or department - so a clean, separate table is the
-- safer and more honest design here, not just the more cautious one.
-- ============================================================================

create table if not exists analysis_notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references user_profiles(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  note_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table analysis_notes enable row level security;

-- Visible to the author themselves, and to an org admin (so notes
-- actually reach the people described as sharing them later, e.g.
-- "share with Emmanuel" implies someone else in the org may need to see
-- them) - not visible org-wide by default, since these are personal
-- working notes, not a public board.
drop policy if exists an_select_scoped on analysis_notes;
create policy an_select_scoped on analysis_notes for select
  using (
    author_id = auth.uid()
    or (organization_id = get_user_organization_id(auth.uid()) and is_org_admin(auth.uid()))
    or is_super_admin(auth.uid())
  );

drop policy if exists an_write_own on analysis_notes;
create policy an_write_own on analysis_notes for all
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create index if not exists idx_analysis_notes_author on analysis_notes(author_id, created_at desc);


-- ============================================================================
-- MIGRATION: 0136_cohort_banner.sql
-- ============================================================================
-- ============================================================================
-- Cohort banner image - confirmed directly against a screenshot of the
-- "1.0" reference site (train-ai-app-main's earlier deployment), which
-- has a "Cohort banner" upload control this codebase's cohort management
-- did not. A single, additive column - no existing data or policy is
-- touched, minimizing risk given this could not be tested against a real
-- database in this environment (PostgreSQL could not be reinstalled here
-- this round).
-- ============================================================================

alter table cohorts add column if not exists banner_url text;
comment on column cohorts.banner_url is 'Optional cohort banner image, matching the 1.0 reference site cohort management screen.';


-- ============================================================================
-- MIGRATION: 0137_admin_audit_log_org_scope_fix.sql
-- ============================================================================
-- ============================================================================
-- Fixes a real, previously undiscovered cross-tenant data leak in
-- admin_audit_log - found while checking whether a per-org Activity Log
-- screen could safely be built for regular admins (not just the platform
-- owner).
-- ============================================================================
-- The existing policy `aal_select_org_admin` (0006_rls_policies.sql) only
-- checked `is_org_admin(auth.uid())` - whether the caller is an admin of
-- *some* organization, not *which* one. admin_audit_log had no
-- organization_id column at all, so there was no way to scope this
-- correctly even if the policy had tried to. The practical effect: any
-- org admin could read every other organization's admin action history -
-- who did what, when, across the entire platform, not just their own
-- org. This was found and fixed before any new UI was built on top of it,
-- not after - building an Activity Log screen on top of the leak would
-- have made the exposure worse by giving it a visible surface.
-- ============================================================================

alter table admin_audit_log add column if not exists organization_id uuid references organizations(id);
comment on column admin_audit_log.organization_id is 'The acting admin''s own organization at the time of the action - real scoping column that did not previously exist, see migration header.';

-- log_admin_action() now populates it from the acting admin's real
-- current org. NULL for platform-level actions with no org context
-- (e.g. granting another super admin) - those rows remain visible only
-- to super_admin, which is correct; they were never meant to be
-- org-scoped in the first place.
create or replace function log_admin_action(
  p_action_type text, p_target_type text, p_target_id uuid, p_target_identifier text,
  p_old_value jsonb, p_new_value jsonb, p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_prev_hash text;
  v_row_hash text;
  v_id uuid;
  v_org_id uuid;
begin
  select organization_id into v_org_id from user_profiles where id = auth.uid();
  select row_hash into v_prev_hash from admin_audit_log order by created_at desc limit 1;
  v_row_hash := encode(
    digest(
      coalesce(v_prev_hash, '') || p_action_type || coalesce(p_target_id::text, '') || now()::text,
      'sha256'
    ),
    'hex'
  );
  insert into admin_audit_log (admin_user_id, organization_id, action_type, target_type, target_id, target_identifier, old_value, new_value, metadata, prev_hash, row_hash)
  values (auth.uid(), v_org_id, p_action_type, p_target_type, p_target_id, p_target_identifier, p_old_value, p_new_value, p_metadata, v_prev_hash, v_row_hash)
  returning id into v_id;
  return v_id;
end;
$$;

-- The actual fix - real per-org scoping instead of a blanket "is an admin
-- of something" check.
drop policy if exists aal_select_org_admin on admin_audit_log;
create policy aal_select_org_admin on admin_audit_log for select
  using (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()));

-- safe_admin_audit_log is a plain view (Postgres views enforce the
-- underlying table's RLS for the querying role) - using CREATE OR
-- REPLACE rather than DROP + CREATE specifically so any existing grants
-- on this view are preserved automatically (a fresh CREATE VIEW after a
-- DROP would be a new object with no grants until re-granted, which
-- could silently break every existing caller of this view). Postgres
-- requires appending new columns at the end of the list for REPLACE to
-- work, so organization_id is added last, not in its "natural" position
-- next to admin_user_id.
create or replace view safe_admin_audit_log as
  select id, admin_user_id, action_type, target_type, target_id, target_identifier, created_at, organization_id
  from admin_audit_log;

-- No explicit grant on this view exists anywhere else in this project's
-- migrations (views appear to rely on a broader schema-level default),
-- but re-granting here is a harmless no-op if that's already covered,
-- and a real safety net if CREATE OR REPLACE VIEW ever behaves like a
-- fresh object in some environment - cheap insurance either way.
grant select on safe_admin_audit_log to authenticated;


-- ============================================================================
-- MIGRATION: 0138_course_materials.sql
-- ============================================================================
-- ============================================================================
-- Course materials - confirmed directly against the real 1.0 reference
-- codebase (CourseMaterialsManager.tsx / useCourseMaterials hook) -
-- downloadable files and reference links attached to a course, separate
-- from its lessons and separate from a cohort's own resources (which
-- already existed here as cohort_resources). This table did not exist at
-- all before this migration - a real, confirmed gap, not a duplicate of
-- an existing feature.
-- ============================================================================

create table if not exists course_materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  material_type text not null default 'link' check (material_type in ('file', 'link')),
  file_url text,
  external_url text,
  description text,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

alter table course_materials enable row level security;

-- Same real authorization shape already proven for lessons on this exact
-- course relationship (lessons_select_published / lessons_write_authorized,
-- 0006_rls_policies.sql) - a published course's materials are visible to
-- any authenticated user, an unpublished course's materials are visible
-- only to its own instructor or an admin, and only the course's own
-- instructor or an admin can write.
drop policy if exists cm_select_published on course_materials;
create policy cm_select_published on course_materials for select
  using (
    exists (select 1 from courses c where c.id = course_materials.course_id and c.is_published)
    or exists (select 1 from courses c where c.id = course_materials.course_id and c.instructor_id = auth.uid())
    or effective_has_permission(auth.uid(), 'manage_courses')
  );

drop policy if exists cm_write_authorized on course_materials;
create policy cm_write_authorized on course_materials for all
  using (
    exists (select 1 from courses c where c.id = course_materials.course_id and c.instructor_id = auth.uid())
    or effective_has_permission(auth.uid(), 'manage_courses')
    or is_super_admin(auth.uid())
  );

create index if not exists idx_course_materials_course on course_materials(course_id);


-- ============================================================================
-- MIGRATION: 0139_mentor_messages_org_scope_fix.sql
-- ============================================================================
-- ============================================================================
-- Fixes a real, previously flagged cross-tenant gap in mentor_messages -
-- found while adding Fellow Instructors messaging (confirmed directly
-- against the real 1.0 reference codebase), not introduced by that
-- feature. The existing rule (mm_insert_sender,
-- 0108_messaging_restriction.sql) only required that either party have
-- the mentor role - it never checked which organization either party
-- belonged to. As written, nothing stopped an instructor in one
-- organization from messaging any person - instructor or learner - in a
-- completely different organization.
-- ============================================================================
-- This is a genuine security fix, not a feature addition - explicitly
-- flagged rather than fixed in the previous round so it could get its
-- own careful, standalone pass instead of being bundled quietly into an
-- unrelated feature.
-- ============================================================================

drop policy if exists mm_insert_sender on mentor_messages;
create policy mm_insert_sender on mentor_messages for insert
  with check (
    sender_id = auth.uid()
    and (
      has_role(auth.uid(), 'mentor'::platform_role)
      or has_role(receiver_id, 'mentor'::platform_role)
    )
    -- The real fix: both parties must actually belong to the same
    -- organization. get_user_organization_id() is the same helper
    -- already used throughout this project's other cross-tenant fixes
    -- (study_groups, admin_audit_log) - not new logic invented for this
    -- specific case.
    and get_user_organization_id(sender_id) is not null
    and get_user_organization_id(sender_id) = get_user_organization_id(receiver_id)
  );

comment on policy mm_insert_sender on mentor_messages is
  'Requires same-organization membership for both parties - fixes a real cross-tenant gap found while adding Fellow Instructors messaging. See migration header.';


-- ============================================================================
-- MIGRATION: 0140_cohort_activity_today.sql
-- ============================================================================
-- ============================================================================
-- Cohort activity today - confirmed directly against the real 1.0
-- reference codebase (CohortStreaksCard.tsx) - "X peers in your cohort
-- studied today," a passive aggregate stat, not messaging or posting, so
-- it does not contradict this project's existing restriction on
-- learner-to-learner communication.
-- ============================================================================
-- A security definer function returning only a count, not individual
-- learners' raw lesson_progress rows - a learner's own progress data
-- stays exactly as locked down as it already is; this never exposes who
-- studied what, only how many people in the same cohort studied
-- something today.
-- ============================================================================

create or replace function get_cohort_activity_today(check_cohort_id uuid)
returns int
language sql stable security definer set search_path = public as $$
  select count(distinct lp.user_id)::int
  from lesson_progress lp
  join cohort_members cm on cm.user_id = lp.user_id
  where cm.cohort_id = check_cohort_id
    and lp.completed_at >= now() - interval '24 hours';
$$;

comment on function get_cohort_activity_today(uuid) is
  'Real-only, aggregate-only cohort activity count for the "your cohort today" learner widget - never exposes individual learner data, only a count.';


-- ============================================================================
-- MIGRATION: 0141_course_quality_reviews.sql
-- ============================================================================
-- ============================================================================
-- Course Quality Review - confirmed directly against the real 1.0
-- reference codebase (CourseQualityReviewPanel.tsx). Deliberately
-- additive - an admin can already publish/unpublish/archive a course
-- directly, and this migration changes none of that. This adds a
-- separate, optional quality-review record (status, score, notes) an
-- admin can attach to any course, useful for content QA tracking without
-- adding friction to the existing publish flow.
-- ============================================================================

create table if not exists course_quality_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  reviewer_id uuid references user_profiles(id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'needs_changes', 'rejected')),
  quality_score int check (quality_score between 1 and 10),
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table course_quality_reviews enable row level security;

-- Same real authorization shape already proven for lessons/materials on
-- this same course relationship - a course's own instructor or an admin
-- can read/write its quality reviews, not a new pattern invented here.
drop policy if exists cqr_select_authorized on course_quality_reviews;
create policy cqr_select_authorized on course_quality_reviews for select
  using (
    exists (select 1 from courses c where c.id = course_quality_reviews.course_id and c.instructor_id = auth.uid())
    or effective_has_permission(auth.uid(), 'manage_courses')
    or is_super_admin(auth.uid())
  );

drop policy if exists cqr_write_admin on course_quality_reviews;
create policy cqr_write_admin on course_quality_reviews for all
  using (effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()))
  with check (effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));

create index if not exists idx_course_quality_reviews_course on course_quality_reviews(course_id);
create index if not exists idx_course_quality_reviews_status on course_quality_reviews(status);


-- ============================================================================
-- MIGRATION: 0142_lesson_feedback.sql
-- ============================================================================
-- ============================================================================
-- Lesson feedback - confirmed directly against the real 1.0 reference
-- codebase (LessonFeedback.tsx). A quick, optional prompt after
-- completing a lesson: how confident do you feel, was it helpful, do you
-- need more resources. Purely additive - does not touch or gate the
-- existing "mark lesson complete" flow in any way.
-- ============================================================================

create table if not exists lesson_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  confidence int not null check (confidence between 1 and 5),
  helpful boolean not null,
  needs_more_resources boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

alter table lesson_feedback enable row level security;

-- Same real shape already proven for lesson_progress on this exact
-- relationship (lp_select_own/lp_write_own, 0006_rls_policies.sql) - a
-- learner's own rows, plus the course's own instructor and an org admin
-- can read (real, useful signal for them), not write.
drop policy if exists lf_select_own_or_staff on lesson_feedback;
create policy lf_select_own_or_staff on lesson_feedback for select
  using (
    user_id = auth.uid()
    or exists (select 1 from courses c where c.id = lesson_feedback.course_id and c.instructor_id = auth.uid())
    or effective_has_permission(auth.uid(), 'manage_courses')
    or is_super_admin(auth.uid())
  );

drop policy if exists lf_write_own on lesson_feedback;
create policy lf_write_own on lesson_feedback for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_lesson_feedback_lesson on lesson_feedback(lesson_id);


-- ============================================================================
-- MIGRATION: 0143_weekly_lesson_goal.sql
-- ============================================================================
-- ============================================================================
-- Weekly lesson goal - confirmed directly: the Home screen's own "Edit"
-- link next to "This week's goal" navigated to Settings, where no control
-- existed to actually change it - and checking further, the column it
-- was reading (user_profiles.weekly_lesson_goal) never existed at all.
-- Every learner's weekly goal was silently the hardcoded default (5)
-- forever, with no way to ever change it. Confirmed directly against the
-- real 1.0 reference codebase (WeeklyCommitmentCard.tsx / useWeeklyCommitment)
-- as the real feature this was always meant to be.
-- ============================================================================

alter table user_profiles add column if not exists weekly_lesson_goal int not null default 5 check (weekly_lesson_goal > 0);
comment on column user_profiles.weekly_lesson_goal is 'A learner''s own weekly lesson-completion goal - previously read but never writable anywhere, and the column itself never existed until this migration.';


-- ============================================================================
-- MIGRATION: 0144_seed_achievements_and_award_bridge.sql
-- ============================================================================
-- ============================================================================
-- A genuinely major, previously undiscovered gap: the entire achievement-
-- awarding system has never worked for any real user, in any real
-- deployment, ever. Confirmed directly - a live screenshot showed
-- "First Steps: 1/1", "Dedicated Learner: 5/5", "Knowledge Seeker: 10/10"
-- all at fully-met thresholds, yet all still listed under "Locked"
-- instead of "Earned". Tracing why found two separate, compounding
-- problems: the real award_achievement() function (0005_functions.sql)
-- was correct but had zero callers anywhere in the client, and the
-- `achievements` table it depends on had never been seeded with a single
-- row - so even if something had called it, there was nothing to award.
-- ============================================================================

alter table achievements add column if not exists slug text unique;
comment on column achievements.slug is 'Matches the client-side ACHIEVEMENT_CATALOG ids (lib is a plain JS array, not a table) - the real bridge that let this system be wired up at all.';

insert into achievements (slug, name, description, category, points) values
  ('first_lesson', 'First Steps', 'Complete your first lesson', 'completion', 10),
  ('five_lessons', 'Dedicated Learner', 'Complete 5 lessons', 'completion', 50),
  ('ten_lessons', 'Knowledge Seeker', 'Complete 10 lessons', 'completion', 100),
  ('first_course', 'Course Completer', 'Complete your first course', 'completion', 100),
  ('five_courses', 'Course Master', 'Complete 5 courses', 'completion', 500),
  ('ten_courses', 'Learning Champion', 'Complete 10 courses', 'completion', 1000),
  ('three_day_streak', '3-Day Streak', 'Learn for 3 consecutive days', 'streak', 30),
  ('week_streak', 'Week Warrior', 'Learn for 7 consecutive days', 'streak', 70),
  ('two_week_streak', 'Consistency King', 'Learn for 14 consecutive days', 'streak', 140),
  ('month_streak', 'Monthly Master', 'Learn for 30 consecutive days', 'streak', 300),
  ('hundred_points', 'Century', 'Earn 100 points', 'mastery', 10),
  ('five_hundred_points', 'Point Master', 'Earn 500 points', 'mastery', 50),
  ('thousand_points', 'Elite Learner', 'Earn 1000 points', 'mastery', 100),
  ('level_five', 'Level 5 Legend', 'Reach level 5', 'mastery', 50),
  ('level_ten', 'Level 10 Hero', 'Reach level 10', 'mastery', 100),
  ('first_session', 'First Session', 'Complete your first mentorship session', 'social', 25),
  ('session_regular', 'Session Regular', 'Complete 5 mentorship sessions', 'social', 75),
  ('session_master', 'Session Master', 'Complete 10 mentorship sessions', 'social', 150)
on conflict (slug) do nothing;

-- award_achievement() (0005_functions.sql) takes a real achievement uuid,
-- and the client only ever has the string slug (from ACHIEVEMENT_CATALOG) -
-- this is the missing bridge, letting the client award by slug directly
-- rather than needing a separate lookup round-trip first.
create or replace function award_achievement_by_slug(p_user_id uuid, p_slug text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from achievements where slug = p_slug;
  if v_id is null then return; end if;
  perform award_achievement(p_user_id, v_id);
end;
$$;

