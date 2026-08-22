-- ============================================================================
-- Two real bugs found in the achievement-awarding path (0144 fixed the
-- "never gets awarded at all" half; these are the half that still made the
-- feature broken/misleading even after 0144 landed):
--
-- 1. award_achievement() inserted user_achievements rows with
--    achievement_title/achievement_description left NULL - the columns
--    exist specifically so the client doesn't need a join, but nothing
--    ever populated them, so every earned badge in the UI silently fell
--    back to the generic "Achievement" title with a blank description and
--    a wrong "+50 XP" guess instead of the real points awarded.
--
-- 2. AchievementsScreen matches earned rows against ACHIEVEMENT_CATALOG by
--    comparing a.achievement_id (a real uuid, the FK to achievements.id)
--    against def.id (the catalog's string slug, e.g. "first_lesson").
--    Those never match, so the "Locked" section's filter
--    (!earnedIds.has(def.id)) is always true - every achievement, including
--    ones a learner has genuinely earned, still shows up as locked. Fixing
--    this on the client requires the row to carry the slug, which nothing
--    currently returns - added as achievement_slug below via a join.
-- ============================================================================

create or replace function award_achievement(p_user_id uuid, p_achievement_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_points int;
  v_name text;
  v_description text;
  v_icon text;
  v_already_earned boolean;
begin
  select points, name, description, icon
    into v_points, v_name, v_description, v_icon
    from achievements where id = p_achievement_id;

  select exists(
    select 1 from user_achievements
    where user_id = p_user_id and achievement_id = p_achievement_id
  ) into v_already_earned;

  if v_already_earned then
    return;
  end if;

  insert into user_achievements (
    user_id, achievement_id, achievement_title, achievement_description,
    achievement_icon, points_awarded
  )
  values (
    p_user_id, p_achievement_id, v_name, v_description,
    v_icon, coalesce(v_points, 0)
  )
  on conflict (user_id, achievement_id) do nothing;

  insert into user_gamification_stats (user_id, total_points)
  values (p_user_id, coalesce(v_points, 0))
  on conflict (user_id) do update
    set total_points = user_gamification_stats.total_points + coalesce(v_points, 0);

  -- Real in-app notification on unlock, matching the pattern already used
  -- for every other real_notifications insert in this codebase - previously
  -- the achievement system awarded points silently with zero learner-facing
  -- feedback anywhere (no notification, no toast).
  insert into real_notifications (user_id, type, title, message)
  values (
    p_user_id,
    'achievement',
    'Achievement Unlocked: ' || coalesce(v_name, 'New Badge'),
    coalesce(v_description, 'You earned a new achievement!') || ' (+' || coalesce(v_points, 0) || ' points)'
  );
end;
$$;

-- Lets the client match earned rows to ACHIEVEMENT_CATALOG entries by slug
-- (what the catalog actually keys on) instead of the raw achievement_id
-- uuid, without changing the user_achievements table shape.
create or replace view my_achievements_with_slug as
select ua.*, a.slug as achievement_slug
from user_achievements ua
join achievements a on a.id = ua.achievement_id
where ua.user_id = auth.uid();

grant select on my_achievements_with_slug to authenticated;

-- Backfill: any user_achievements row already earned before this migration
-- still has a NULL achievement_title/achievement_description (the original
-- award_achievement() never set them) - fix those in place too, not just
-- awards made from now on.
update user_achievements ua
set achievement_title = a.name,
    achievement_description = a.description,
    achievement_icon = a.icon
from achievements a
where a.id = ua.achievement_id
  and ua.achievement_title is null;
