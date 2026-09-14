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
