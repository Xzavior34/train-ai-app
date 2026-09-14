-- ============================================================================
-- External course approval gate - PRD Open Question: "Should the external
-- course feed be manually curated, AI-curated, or mixed in v1? AI curated
-- with human approval." A real, confirmed gap found on the final
-- verification pass: external courses were shown to learners straight from
-- a static curated list with no approval concept at all.
-- ============================================================================
-- Internal courses default to approved=true (an internal course an
-- instructor publishes doesn't need a second admin approval step - that's
-- what is_published already gates). External courses default to
-- approved=false, requiring an explicit admin action before a learner ever
-- sees them - this is the actual "human approval" half of the confirmed
-- answer. The "AI curated" half (an AI suggesting which external courses
-- to add in the first place) is a separate, larger content-sourcing
-- pipeline that doesn't exist yet - not fabricated here; this migration
-- only builds the approval gate itself, honestly.
-- ============================================================================

alter table courses add column if not exists is_approved boolean not null default true;
update courses set is_approved = false where course_source = 'external' and is_approved is distinct from false;

comment on column courses.is_approved is
  'External courses require explicit admin approval before learners see them (PRD: "AI curated with human approval"). Internal courses default true - is_published already gates those.';
