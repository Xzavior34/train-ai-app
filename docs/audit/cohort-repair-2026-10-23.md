# Sara Foundation cohort audit — 23 October 2026

Production was inspected through the owner's signed-in Supabase dashboard, project `jeobggrtxeybxvlwpxvn`. The old local environment also references a separate legacy project; no accounts or cohorts were moved between projects.

## Saved records

- Sara Foundation Africa has 852 active organization memberships at the time of inspection.
- CAP Cohort 3 has 26 saved cohort memberships; FLIP Fellow C2 has 10. Two accounts belong to both, giving 34 distinct assigned accounts.
- All existing CAP and FLIP members have active memberships and matching profile organization links.
- CAP has 21 individually assigned course recipients. All 21 already have cohort memberships. FLIP has no individual course assignment records from which to recover additional memberships.
- 818 active organization accounts have no saved cohort membership. Organization membership alone does not establish whether an account should join CAP, FLIP, both, or neither. A roster or an affected account is required to repair those assignments accurately. No speculative enrollment was performed.

## Applied repair

Migration `202610230001_cohort_assignment_read_models.sql` was applied to the production project through SQL Editor and returned success. The new self-only lookup returns all saved cohort memberships in one request and reports inaccessible assignments explicitly. The member directory now includes the cohort's instructor/learner role while retaining scoped access and excluding private profile fields.

Live verification of a saved FLIP learner returned `FLIP Fellow C2`, a directory of 10 members, and confirmed anonymous execution is denied. The existing CAP access helper was also verified for an assigned learner.

The website now distinguishes errors from empty assignments, refreshes assignments when returning to the app, selects cohort titles by the selected cohort ID, and never substitutes unrelated enrolled courses for cohort curriculum. The learner cohort page no longer downloads the administrator's full cohort workspace as a fallback. Admin summaries use assigned cohort instructors instead of inferring instructors from global roles or the cohort creator. Missing dates no longer invent a six-week schedule.

Mobile views have a compact cohort summary, a full-width cohort selector, optional details, shorter navigation labels, and no repeated hero title. Admin pages show concise actions, remove generic stock photos, hide empty secondary panels, and collapse the broadcast composer. Broadcast failures are no longer reported as success.

## Validation

- PostgreSQL-compatible isolated tests: multiple memberships, instructor role projection, safe profile fields, admin access, and denial for anonymous, unassigned and suspended accounts.
- Cohort browser checks at 320, 390, 540, 768 and 1440 pixels: switching between CAP and FLIP, scoped curriculum, management controls, and loading/error/empty recovery.
- Existing admin/platform-owner responsive audit: 116 checks passed.
- Data display regression tests: 21 passed; existing unit tests: 33 passed.
- Screen rendering audit: 73 screens passed. Production build passed.
