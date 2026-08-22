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
  code text unique not null default encode(extensions.gen_random_bytes(4), 'hex'),
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
