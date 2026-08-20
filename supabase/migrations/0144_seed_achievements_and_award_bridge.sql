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
