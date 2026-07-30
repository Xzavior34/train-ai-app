-- =============================================================================
-- Train AI — Core schema migration (continued): progress, quizzes, AI,
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
