-- ============================================================================
-- Cohort <-> course referential tenant integrity
-- ============================================================================
-- Confirmed gap, empirically verified before this fix (not assumed): nothing
-- stopped an org admin from assigning another organization's course_id into
-- their own cohort via cohort_courses or cohort_learner_courses - the RLS on
-- those join tables only checks the COHORT's organization, never that the
-- COURSE being referenced belongs to that same organization (or is genuinely
-- global, organization_id is null).
--
-- Verified this is a data-integrity bug, not a confidentiality leak: the
-- 0149 fix already makes the underlying `courses` row itself invisible to
-- anyone outside its owning organization, so a cross-org assignment produces
-- a dangling reference a learner can see exists but can't open - not an
-- actual content leak. Still worth closing at the data layer: a broken
-- assignment is a real product bug (a learner told "you have this course"
-- who then can't open it), and leaving aFK-valid-but-nonsensical row around
-- is exactly the kind of orphan/ambiguous-ownership state worth preventing
-- outright rather than working around in the UI.
--
-- Postgres has no cross-table CHECK constraint, so this is enforced with a
-- BEFORE INSERT OR UPDATE trigger on both join tables - simplest mechanism
-- that can compare two different tables' rows, and (unlike RLS) applies
-- regardless of which role is doing the writing, including service_role
-- scripts/seed data run directly against the database.
-- ============================================================================

-- Detect (never delete) any already-existing mismatched rows before the
-- trigger goes live, so an operator running this against real data finds
-- out immediately rather than being silently protected going forward while
-- a pre-existing bad row sits unnoticed. Per the brief: existing data is
-- never modified or deleted here - only reported.
do $$
declare
  v_count int;
begin
  select count(*) into v_count
  from cohort_courses cc
  join cohorts co on co.id = cc.cohort_id
  join courses cr on cr.id = cc.course_id
  where cr.organization_id is not null and cr.organization_id is distinct from co.organization_id;
  if v_count > 0 then
    raise notice 'cohort_courses: % existing row(s) reference a course from a different organization than their cohort - not deleted, review manually', v_count;
  end if;

  select count(*) into v_count
  from cohort_learner_courses clc
  join cohorts co on co.id = clc.cohort_id
  join courses cr on cr.id = clc.course_id
  where cr.organization_id is not null and cr.organization_id is distinct from co.organization_id;
  if v_count > 0 then
    raise notice 'cohort_learner_courses: % existing row(s) reference a course from a different organization than their cohort - not deleted, review manually', v_count;
  end if;
end $$;

create or replace function enforce_course_matches_cohort_org()
returns trigger
-- SECURITY DEFINER is required here, not optional: this function's own
-- SELECTs against `cohorts`/`courses` would otherwise run as the calling
-- role and be subject to RLS themselves - meaning an Org B caller's lookup
-- of an Org A course would silently return 0 rows (RLS hides it), the
-- `is not null` guard below would never trigger, and the whole check would
-- be a silent no-op. Confirmed this exact failure mode by testing without
-- SECURITY DEFINER first: the cross-org insert succeeded when it should
-- have been rejected. search_path is pinned per this schema's own
-- convention for every other SECURITY DEFINER function.
language plpgsql security definer set search_path = public as $$
declare
  v_cohort_org uuid;
  v_course_org uuid;
begin
  select organization_id into v_cohort_org from cohorts where id = new.cohort_id;
  select organization_id into v_course_org from courses where id = new.course_id;
  -- A null course organization_id is genuinely global/platform content
  -- (the demo course, external-partner courses - see 0149's comment) and
  -- is assignable into any cohort. Anything else must match the cohort's
  -- own organization.
  if v_course_org is not null and v_course_org is distinct from v_cohort_org then
    raise exception 'Cannot assign a course from a different organization to this cohort';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cohort_courses_org_match on cohort_courses;
create trigger trg_cohort_courses_org_match
  before insert or update on cohort_courses
  for each row execute function enforce_course_matches_cohort_org();

drop trigger if exists trg_cohort_learner_courses_org_match on cohort_learner_courses;
create trigger trg_cohort_learner_courses_org_match
  before insert or update on cohort_learner_courses
  for each row execute function enforce_course_matches_cohort_org();

comment on function enforce_course_matches_cohort_org() is
  'Defense-in-depth for cohort_courses/cohort_learner_courses: rejects assigning a course that belongs to a different, non-global organization than the cohort itself. Runs regardless of caller role, unlike RLS.';
