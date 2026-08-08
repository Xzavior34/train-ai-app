-- ============================================================================
-- AI usage tracking - for real "AI credit tracking" / "AI cost monitoring"
-- ============================================================================
-- Product brief: Platform Owner should see "AI credit tracking" /
-- "usage analytics." Checked what backs the existing "AI Credits" shown on
-- the learner Profile screen first: useCredits.js is explicitly client-side
-- only (localStorage), by design - "the paystack-initialize /
-- stripe-initialize edge functions explicitly do NOT persist anything
-- server-side for the 'credits' payment context... there is no credits
-- table in this app's schema." That's a deliberate, documented choice for
-- the learner-facing daily-allowance mechanic, not an oversight - but it
-- means there was no real data anywhere to build genuine platform-level
-- usage tracking from. Faking a number here would misrepresent real
-- platform cost data to whoever is deciding whether AI spend is under
-- control, so this adds a minimal real events table instead and wires
-- actual logging into the one place AI calls actually happen server-side
-- (supabase/functions/ai-chat/index.ts).
--
-- Deliberately minimal: one row per real AI Coach reply that actually
-- called a provider (OpenAI/Gemini) - not for Manual Mode replies or
-- disabled-org attempts, since those never reach a provider and cost
-- nothing. No token counts (neither provider response used here is asked
-- for token usage, and estimating it would be another number that looks
-- more precise than it is) - just a real count of real calls, which is
-- enough to show usage trend and relative organization load honestly.
-- ============================================================================

create table if not exists ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id) on delete set null,
  organization_id uuid references organizations(id) on delete set null,
  feature text not null default 'ai_coach',
  created_at timestamptz not null default now()
);

alter table ai_usage_events enable row level security;

-- No INSERT policy for any client role - this is written only by the
-- ai-chat edge function via its service-role key, same posture as
-- moderation_logs (see the comment on fetchModerationQueue in
-- lib/api/platform.js: "REVOKE SELECT ... FROM authenticated ... now only
-- readable/writable by service_role").
drop policy if exists aiue_select_super_admin on ai_usage_events;
create policy aiue_select_super_admin on ai_usage_events for select
  using (is_super_admin(auth.uid()));

drop policy if exists aiue_select_org_admin on ai_usage_events;
create policy aiue_select_org_admin on ai_usage_events for select
  using (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()));

create index if not exists idx_ai_usage_events_org_created on ai_usage_events(organization_id, created_at);
create index if not exists idx_ai_usage_events_created on ai_usage_events(created_at);
