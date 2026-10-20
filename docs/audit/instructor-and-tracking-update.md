# Instructor assignment and individual tracking — October 20, 2026

Implemented locally; no production deployment or account changes.

| Request | Result |
|---|---|
| Admin sees each person's track | People → open a member → Learning track. The cohort roster also opens the member record. Shows organization learning paths, cohort-wide and individual course assignments, actual progress and completion. An assigned course without an enrollment is shown as not started. Suspended members remain inspectable by their organization's administrator. |
| Admin assigns cohort instructors | Cohort → Members → Assign Instructor. Select an active organization member. One secured transaction grants the mentor role, synchronizes the mentor directory and records the explicit teaching assignment. Other teaching assignments are retained. |
| Instructor receives correct workspace | Roles come from an authenticated caller-only RPC. Instructors enter the instructor workspace. General navigation stays in that workspace; the admin workspace has no fallback grant. Role changes refresh on focus and every 30 seconds while the page is visible. Lookup failures offer retry. |
| Instructor privileges | Teaching cohorts show assigned learners, scoped learning progress, resource management and session scheduling. People, organization role management and cohort roster administration remain administrative actions. Cross-organization operations and self-promotion are denied by the database. |
| Access removal | Removing a teaching assignment or suspending organization membership immediately revokes database access, including existing database sessions. Teaching screens refresh on focus, assignment events and a periodic check. |

`cohort_members.cohort_role` distinguishes learner membership from an instructor assignment. For compatibility, migration `202610200006` treats existing memberships held by users with an authoritative mentor role as teaching assignments. Review these legacy assignments in staging; the old schema did not distinguish teaching from learning membership. New assignments are explicit.

The organization role picker now uses a secured transaction instead of separate profile and permission writes. Administrator grants/revocations require the organization owner or platform owner. Organization owners and platform-owner accounts cannot be rewritten through this picker. Changes to a member active in multiple organizations require platform-owner review because platform roles are global.

Verification: 103 migrations replayed in a fresh PostgreSQL 18 fixture; 29 earlier database regressions and 15 instructor/tracking cases pass; 10 unit/endpoint cases pass; production build passes. Existing bundle-size warnings remain. The instructor cohort and individual learning-track production components were opened and exercised in a browser with isolated fixture data. This is not a real Supabase sign-in or mobile end-to-end test.

Evidence: `instructor-test-results.json`, `database-test-results.json`, `migration-replay-results.json`, `instructor-workspace.png`, `admin-learning-track.png`.

Run locally:

```text
npm run test:database:start
npm test
npm run test:database
npm run build
npm run test:database:stop
```

Browser fixture: `node scripts/audit/serve-instructor-preview.mjs`, then open `http://127.0.0.1:5187`. It substitutes data services and makes no remote calls.

Before release, reconcile migration history and take a staging backup, apply migrations through `202610200006`, then release the matching frontend. Check real admin/instructor logins, promote an approved staging member, assign/reassign/remove them, inspect individual progress and test resources and sessions on the deployed Supabase/PostgreSQL 17 stack. No real people have been assigned during this work.

Rollback: keep the prior app build and a database snapshot from before the migration. Prefer a reviewed forward correction. Rolling back the frontend alone does not undo role grants or explicit assignments. Record affected role and membership rows before applying the migration; use that snapshot to review any access rollback. Do not drop the role marker or restore older permissive policies as an emergency workaround.
