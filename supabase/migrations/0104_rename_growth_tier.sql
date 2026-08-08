-- ============================================================================
-- Rename subscription_tier 'professional' -> 'growth'
-- ============================================================================
-- Per the finalized pricing brief: "Free (Demo), Starter, Growth, Enterprise
-- ... Database and UI must use the same tier names." The enum shipped in
-- 0001_init_schema.sql as ('free','starter','professional','enterprise') - -- 'professional' was never the agreed name, 'growth' was. Renaming the enum
-- value in place (rather than adding a new value and migrating rows) keeps
-- every existing organizations.subscription_tier row correct automatically:
-- a row previously reading 'professional' now reads 'growth', with no data
-- migration needed.
-- ============================================================================

ALTER TYPE subscription_tier RENAME VALUE 'professional' TO 'growth';
