-- Remove SECURITY DEFINER view bypasses reported by the Supabase security
-- advisor. Views that can safely rely on base-table RLS now run as the caller.
-- The three deliberate safe projections that cannot use base RLS (quiz
-- questions, assessment questions, and public profile cards) are exposed via
-- narrow SECURITY DEFINER functions with a fixed search_path and explicit
-- authenticated-only grants.

-- ---------------------------------------------------------------------------
-- Base-table policies required by caller-scoped views
-- ---------------------------------------------------------------------------

alter table public.course_enrollments enable row level security;
drop policy if exists ce_select_instructor on public.course_enrollments;
create policy ce_select_instructor on public.course_enrollments
for select to authenticated
using (
  exists (
    select 1
    from public.courses c
    where c.id = course_enrollments.course_id
      and c.instructor_id = auth.uid()
  )
);

alter table public.user_achievements enable row level security;
drop policy if exists ua_select_own on public.user_achievements;
create policy ua_select_own on public.user_achievements
for select to authenticated using (user_id = auth.uid());

alter table public.paid_waitlist enable row level security;
alter table public.paid_waitlist
  add column if not exists created_at timestamptz not null default now();
drop policy if exists paid_waitlist_select_own on public.paid_waitlist;
create policy paid_waitlist_select_own on public.paid_waitlist
for select to authenticated
using (
  user_id = auth.uid()
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- ---------------------------------------------------------------------------
-- Narrow safe read functions
-- ---------------------------------------------------------------------------

create or replace function public.get_safe_quiz_questions(p_quiz_id uuid)
returns table (
  id uuid,
  quiz_id uuid,
  question text,
  question_type text,
  options jsonb,
  order_index integer,
  points integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select q.id, q.quiz_id, q.question, q.question_type, q.options,
         q.order_index, q.points
  from public.quiz_questions q
  join public.quizzes z on z.id = q.quiz_id
  where q.quiz_id = p_quiz_id
    and z.is_published = true
    and auth.uid() is not null
  order by q.order_index;
$$;

create or replace function public.get_safe_assessment_questions(p_assessment_id uuid)
returns table (
  id uuid,
  assessment_id uuid,
  question text,
  question_type text,
  options jsonb,
  order_index integer,
  points integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select q.id, q.assessment_id, q.question, q.question_type, q.options,
         q.order_index, q.points
  from public.assessment_questions q
  where q.assessment_id = p_assessment_id
    and auth.uid() is not null
  order by q.order_index;
$$;

create or replace function public.get_public_user_profiles(
  p_exclude_user_id uuid default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  bio text,
  level integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.display_name, p.avatar_url, p.bio, p.level
  from public.user_profiles p
  where auth.uid() is not null
    and (p_exclude_user_id is null or p.id <> p_exclude_user_id)
  order by p.last_active_at desc nulls last, p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

create or replace function public.get_my_paid_waitlist_status()
returns table (
  id uuid,
  email text,
  currency text,
  payment_status text,
  source text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.email, p.currency, p.payment_status, p.source, p.created_at
  from public.paid_waitlist p
  where auth.uid() is not null
    and (
      p.user_id = auth.uid()
      or lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  order by p.created_at desc
  limit 1;
$$;

revoke all on function public.get_safe_quiz_questions(uuid) from public, anon;
revoke all on function public.get_safe_assessment_questions(uuid) from public, anon;
revoke all on function public.get_public_user_profiles(uuid, integer) from public, anon;
revoke all on function public.get_my_paid_waitlist_status() from public, anon;
grant execute on function public.get_safe_quiz_questions(uuid) to authenticated;
grant execute on function public.get_safe_assessment_questions(uuid) to authenticated;
grant execute on function public.get_public_user_profiles(uuid, integer) to authenticated;
grant execute on function public.get_my_paid_waitlist_status() to authenticated;
grant execute on function public.get_safe_quiz_questions(uuid) to service_role;
grant execute on function public.get_safe_assessment_questions(uuid) to service_role;
grant execute on function public.get_public_user_profiles(uuid, integer) to service_role;
grant execute on function public.get_my_paid_waitlist_status() to service_role;

-- ---------------------------------------------------------------------------
-- Existing views now respect the caller's RLS. Keeping the objects avoids a
-- breaking change for any older client while removing owner-level execution.
-- ---------------------------------------------------------------------------

do $$
declare
  v_name text;
begin
  foreach v_name in array array[
    'booked_demo_slots',
    'safe_quiz_questions',
    'safe_paid_waitlist',
    'safe_admin_audit_log',
    'mentor_public_profiles',
    'public_user_profiles',
    'safe_community_posts',
    'safe_course_enrollments',
    'instructor_course_enrollments',
    'safe_assessment_questions',
    'my_achievements_with_slug'
  ] loop
    if to_regclass('public.' || v_name) is not null then
      execute format('alter view public.%I set (security_invoker = true)', v_name);
      execute format('revoke all on public.%I from anon', v_name);
      execute format('grant select on public.%I to authenticated, service_role', v_name);
    end if;
  end loop;
end;
$$;

-- Booked availability remains public through get_booked_slots(), not by
-- bypassing demo_requests RLS through a view.
revoke all on public.booked_demo_slots from authenticated;
