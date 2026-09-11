-- The learner Leaderboard screen has "This Week" / "This Month" / "My
-- Cohort" / "All Time" tabs, but only "All Time" was ever wired to real
-- data (get_leaderboard_with_profiles, 0005_functions.sql) - the other
-- three changed which button looked selected and nothing else.
--
-- There is no running points-per-period ledger in this schema
-- (user_gamification_stats.total_points is lifetime-cumulative only), so a
-- period leaderboard is computed here from the real, timestamped rows that
-- already back every point award in this schema:
--   - lesson_progress: +50 per completed lesson (matches markLessonComplete
--     in lib/api/learner.js), dated by completed_at.
--   - quiz_attempts.total_points, dated by completed_at (the exact points
--     check_quiz_answers() awarded for that attempt).
--   - daily_login_rewards.points_awarded, dated by claimed_date.
-- This is real activity within the window, not an estimate or a fabricated
-- number - a learner with no timestamped activity in range simply doesn't
-- appear, which is the correct answer for "what happened in this period".
create or replace function get_leaderboard_for_period(p_start timestamptz, p_end timestamptz, p_limit int default 50)
returns table (user_id uuid, display_name text, avatar_url text, period_points bigint, current_level int, streak_days int)
language sql stable security definer set search_path = public as $$
  with lesson_points as (
    select lp.user_id, count(*) * 50 as pts
    from lesson_progress lp
    where lp.is_completed = true and lp.completed_at >= p_start and lp.completed_at < p_end
    group by lp.user_id
  ),
  quiz_points as (
    select qa.user_id, coalesce(sum(qa.total_points), 0) as pts
    from quiz_attempts qa
    where qa.completed_at >= p_start and qa.completed_at < p_end
    group by qa.user_id
  ),
  login_points as (
    select dlr.user_id, coalesce(sum(dlr.points_awarded), 0) as pts
    from daily_login_rewards dlr
    where dlr.claimed_date >= p_start::date and dlr.claimed_date < p_end::date
    group by dlr.user_id
  ),
  combined as (
    select u.user_id, sum(u.pts) as period_points
    from (
      select * from lesson_points
      union all select * from quiz_points
      union all select * from login_points
    ) u
    group by u.user_id
    having sum(u.pts) > 0
  )
  select c.user_id, up.display_name, up.avatar_url, c.period_points,
    coalesce(s.current_level, 1), coalesce(s.streak_days, 0)
  from combined c
  join user_profiles up on up.id = c.user_id
  left join user_gamification_stats s on s.user_id = c.user_id
  order by c.period_points desc
  limit p_limit;
$$;

-- "My Cohort" tab: same lifetime total_points ranking as
-- get_leaderboard_with_profiles, restricted to members of one cohort.
create or replace function get_cohort_leaderboard(p_cohort_id uuid, p_limit int default 50)
returns table (user_id uuid, display_name text, avatar_url text, total_points int, current_level int, streak_days int)
language sql stable security definer set search_path = public as $$
  select s.user_id, up.display_name, up.avatar_url, s.total_points, s.current_level, s.streak_days
  from cohort_members cm
  join user_gamification_stats s on s.user_id = cm.user_id
  join user_profiles up on up.id = cm.user_id
  where cm.cohort_id = p_cohort_id
  order by s.total_points desc
  limit p_limit;
$$;
