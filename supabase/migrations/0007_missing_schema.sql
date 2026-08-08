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
