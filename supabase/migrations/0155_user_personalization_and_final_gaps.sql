-- ============================================================================
-- Final production-readiness gate: user_personalization RLS + schema gap
-- ============================================================================
-- Confirmed: src/services/authService.js and src/lib/api/learner.js call
-- `supabase.from("user_personalization")` directly (select/upsert) for
-- onboarding personalization - but this table has RLS enabled with zero
-- policies (default-deny), so every one of those calls fails silently
-- against a real project (each call site already wraps the request in
-- try/catch with a console.warn, which is exactly why this was never
-- surfaced as a visible error). Not a tenant-isolation bug - a purely
-- functional one, explicitly called out to be fixed in this pass rather
-- than left open.
--
-- Also confirmed: the client's upsert payload includes `updated_at`, a
-- column that does not exist on this table in any migration - that upsert
-- would fail on a live project even after RLS is fixed. Added as a nullable,
-- additive column (no data loss, no NOT NULL, matches this schema's own
-- established pattern for this kind of gap).
--
-- This table is purely self-owned (user_id is its own primary key, no
-- organization_id at all) - the standard "own row only" pattern already
-- used for user_gamification_stats, course_enrollments, etc.
-- ============================================================================

alter table user_personalization add column if not exists updated_at timestamptz not null default now();

drop policy if exists up_personalization_own on user_personalization;
create policy up_personalization_own on user_personalization for all
  using (user_id = auth.uid() or is_super_admin(auth.uid()))
  with check (user_id = auth.uid());

comment on table user_personalization is
  'Learner onboarding personalization (learning tracks, skill level). Own-row RLS added in 0155 - was previously RLS-enabled with zero policies (default-deny), silently breaking every save/read from a real deployment.';
