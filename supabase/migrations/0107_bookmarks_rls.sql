-- ============================================================================
-- Bookmarks - RLS (previously had none at all)
-- ============================================================================
-- Course UI brief: "Keep: ... Bookmarking. Bookmarked courses appear
-- first." The `bookmarks` table (0002_progress_quizzes_cohorts.sql) was
-- never actually wired to the frontend, and - found while wiring it now
-- had no RLS enabled at all, meaning it was unprotected by default rather
-- than merely unused. Fixed alongside the real feature, not left as a
-- silent gap.
-- ============================================================================

alter table bookmarks enable row level security;

drop policy if exists bookmarks_select_own on bookmarks;
create policy bookmarks_select_own on bookmarks for select using (user_id = auth.uid());

drop policy if exists bookmarks_write_own on bookmarks;
create policy bookmarks_write_own on bookmarks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
