-- ============================================================================
-- Sara Foundation as a real organization tenant (Section 2.1)
-- ============================================================================
-- "Multi-Tenant Database Architecture Reference," Section 2.1: "A single,
-- dedicated organization on Train AI 1.0... Treat this as the
-- reference/first production tenant - it's a normal instance of the B2B
-- structure (Section 2.3), just the first one live."
--
-- This was a real, confirmed gap: "Sara Foundation" existed elsewhere in
-- this codebase only as an unrelated emails table
-- (sara_foundation_emails, 0004_community_gamification_admin.sql) and a
-- comment about the hardcoded admin-email backdoor removed several rounds
-- ago - there was no actual organization tenant for it in the
-- multi-tenant data model at all, despite the document explicitly naming
-- it as the first of three tenant categories.
--
-- "Old database falls here" (Section 1) means Sara Foundation's
-- pre-existing data should be associated with this tenant once a real
-- migration path exists for it - that's real data this sandbox has no
-- access to and isn't something to fabricate. What's built here is the
-- tenant itself, seeded and ready to receive that association, matching
-- exactly how Digital Training Organization and the three demo orgs were
-- seeded (0116_digital_training_org_and_demos.sql) - a real, isolated
-- organizations row, not a placeholder.
--
-- Tier: the document doesn't specify one for Sara Foundation specifically
-- (only that it's "a normal instance of the B2B structure"). Defaulted to
-- 'starter' as the least presumptuous choice - adjust directly in the
-- organizations table (or via the Platform Owner's Organizations screen)
-- once the actual agreed tier is known.
-- ============================================================================

insert into organizations (name, slug, status, subscription_tier, created_by)
values ('Sara Foundation', 'sara-foundation', 'active', 'starter', null)
on conflict (slug) do nothing;
