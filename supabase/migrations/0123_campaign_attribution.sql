-- ============================================================================
-- Campaign attribution - PRD Platform Owner Analytics, confirmed unbuilt
-- ============================================================================
-- Adds the columns needed to attribute a demo request or organization
-- inquiry to a marketing campaign, rather than a separate "campaign
-- events" table that could drift from what was actually submitted. Real
-- capture happens client-side (see waitlist.js captureAttributionFromURL,
-- reads standard utm_source/utm_medium/utm_campaign query params on first
-- landing-page visit, persists them through to whichever form is
-- eventually submitted) - this migration is just the storage for it.
-- ============================================================================

alter table demo_requests add column if not exists utm_source text;
alter table demo_requests add column if not exists utm_medium text;
alter table demo_requests add column if not exists utm_campaign text;

alter table organization_inquiries add column if not exists utm_source text;
alter table organization_inquiries add column if not exists utm_medium text;
alter table organization_inquiries add column if not exists utm_campaign text;
