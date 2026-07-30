-- =============================================================================
-- Train AI — Core schema migration (continued): mentors, sessions, earnings,
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
