-- ============================================================================
-- Cohort banner image - confirmed directly against a screenshot of the
-- "1.0" reference site (train-ai-app-main's earlier deployment), which
-- has a "Cohort banner" upload control this codebase's cohort management
-- did not. A single, additive column - no existing data or policy is
-- touched, minimizing risk given this could not be tested against a real
-- database in this environment (PostgreSQL could not be reinstalled here
-- this round).
-- ============================================================================

alter table cohorts add column if not exists banner_url text;
comment on column cohorts.banner_url is 'Optional cohort banner image, matching the 1.0 reference site cohort management screen.';
