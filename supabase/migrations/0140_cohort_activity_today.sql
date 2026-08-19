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
