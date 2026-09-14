-- ============================================================================
-- "Tech Learning" - the default organization for individual signups
-- ============================================================================
-- Per the finalized brief: "Users without an organization are automatically
-- placed into a default organization called Tech Learning. This maintains a
-- consistent onboarding and data model." Previously an individual learner
-- signup left organization_id null - every org-scoped query, RLS policy,
-- and admin screen in this codebase assumes a learner has SOME
-- organization_id, so a null value was an unhandled edge case everywhere
-- rather than a deliberate "no org" state.
--
-- created_by is left null deliberately - this organization isn't owned by
-- any single user the way a self-serve org is (see
-- 0102_org_self_serve_signup.sql); it's platform infrastructure, managed by
-- Platform Owner, not by an org admin.
-- ============================================================================

insert into organizations (name, slug, status, subscription_tier, created_by)
values ('Tech Learning', 'tech-learning', 'active', 'free', null)
on conflict (slug) do nothing;
