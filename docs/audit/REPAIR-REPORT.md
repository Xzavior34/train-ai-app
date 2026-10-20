# Platform repair report — October 20, 2026

Implemented local code repairs for the five database findings and the attached platform brief. No production database, deployed environment, credentials, live billing, real calendar booking, outreach or user records were changed. The existing architecture and visual identity are retained.

See [instructor assignment and individual tracking update](instructor-and-tracking-update.md) for the latest requested changes and their release checks.

## Verification

- Baseline production build: PASS. The original package had no test, lint or type-check command.
- Final production build: PASS; existing warnings remain for JavaScript bundles over 500 kB.
- 10 automated unit/endpoint tests: PASS. Provider calls were stubbed; no paid AI requests were made.
- 44 real PostgreSQL role/concurrency regression cases: PASS.
- All 103 SQL migrations replayed successfully into a fresh isolated PostgreSQL 18 fixture, with Supabase-style Auth helpers and role grants. The configured Supabase target is PostgreSQL 17; verify on a restored staging instance before deployment.
- Community server-render preview and empty/error-state checks: PASS.
- In-browser Community fixture: desktop and 390px layout checked; discussion, group and leaderboard full-list destinations verified. A fresh page had no captured console warnings/errors after deduplicating identical Supabase client configurations. Screenshots are saved in this folder.
- git diff whitespace check: PASS. No project lint/type-check configuration or Deno runtime was available. The AI quiz endpoint was exercised through Node's TypeScript stripping with stubbed Auth, ledger and provider calls; this is not a full Deno deployment test.

Machine-readable evidence: verification-summary.json, database-test-results.json, migration-replay-results.json. Scripts and fixtures are under scripts/audit/. These results do not certify live Supabase configuration, real email delivery, payment callbacks, device behavior or production load.

## Original database findings

| Finding | Root cause and implemented repair | Evidence |
|---|---|---|
| Cross-organization session/compliance mutations | An admin-of-any-org predicate bypassed row security. Privileged RPCs now authorize the resource's organization; compliance updates filter their rows. | Cross-tenant creation/cancellation denied; other-tenant compliance remains pending |
| Signup seat bypass | Auth bootstrap inserted active membership without a shared capacity boundary. A serialized membership trigger now covers every activation; full shareable-link signups queue as pending, and profiles use the actual resulting status. | Concurrent signups allocate exactly one available seat; queued profiles remain unaffiliated |
| Arbitrary and duplicate achievements | Browsers supplied the award; duplicate inserts could still add points. Eligibility is checked against server-owned stats, the learner's stats row is locked, and points/notifications require a successful award insertion. | Ineligible awards and direct stats writes denied; concurrent awards increment once |
| Mentor identity mismatch | A mentors.id was compared with auth.uid(), while membership and identity use user_profiles.id/mentors.user_id. | A mentor with a distinct mentor-profile UUID can generate/cancel linked recurrence families |
| Duplicate migration versions | Four numeric versions were reused, and later SQL mixed an incompatible credit schema and an invalid role literal. Local versions are now unique; canonical UUID credit contracts and function defaults replay correctly. | 103 fresh migration replay passes; deployed history reconciliation is still required |

## Attached brief checklist

Status means verified local implementation; production verification is a separate gate.

| Issue | Status | Result and remaining work |
|---|---|---|
| 1. Mentor access/assignment | FIXED | Assigned-only cohort RPC; correct user identity for managed groups; active-membership-aware RLS; roster/resource access; atomic cohort+instructor creation; focus/realtime/periodic refresh; explicit retry states. Assignment, reassignment, same-session removal and resources pass database tests. Verify real sign-in/session refresh in staging. |
| 2. Community Hub | FIXED | Two discussion/group/mentor previews, three leaderboard entries, retained full-list navigation, compact loading placeholders and clear empty/error states. Existing branding retained. Desktop/390px fixture inspected. |
| 3. Cleanup/display accuracy | PARTIALLY FIXED | Removed live CAP/cohort fixture fallbacks and false-success writes, corrected leaderboard names/points, scoped activity indicators, initials for missing avatars, and removed fake workshop/broadcast success messages. Read-only cleanup inventory and review/rollback guide ready. Real account data has not been reviewed or deleted. |
| 4. Role/cohort permissions | FIXED | Assigned mentors manage their resources without gaining org admin permissions. Learners can message enrolled study groups; private self-join and cross-tenant messaging are denied. Authorized direct messages remain available. CAP teams/check-ins inherit cohort access; review fields are protected. Suspension removes stale private-group access. This is targeted coverage, not a certification of every legacy policy. |
| 5. Three free AI questions | FIXED | Server-owned one-time welcome allowance is three for unaffiliated users. Generic tech-learning membership does not count as customer affiliation. Existing affiliated welcome allocation/operation prices are preserved. Browser storage cannot mint credits; post-response callbacks refresh instead of charging twice. Membership switching cannot enlarge the free allowance. Paid credits survive adjustments; concurrent debits/refunds serialize. A chat question costs one credit; other operations retain their existing prices. |
| 6. Demo quality | FIXED | Required text/email/phone/date validation, normalization, rollover/control-character checks, honeypot support, atomic email/IP throttling and fail-closed limiter errors. Contact ownership is explicitly unverified until verified through an authorized workflow. Calendar and email delivery still need staging checks. |
| 7. Reliability/regression | PARTIALLY FIXED | Unit, endpoint-stub, real RLS/concurrency, CAP/reward and Community-render coverage added; production build passes. Live sign-in, all-screen device testing, deployed Edge Functions and external-provider delivery remain unverified. |
| 8. CAP readiness | PARTIALLY FIXED | Conference checklist for Saturday October 24 is ready; local cohort/CAP workflows repaired and tested. Organizers must validate real rosters, links, resources, providers and attendee/mentor/admin staging journeys. |
| 9. KPI/business follow-up | PARTIALLY FIXED | Existing evidence sources and honest measurement limits documented; aggregate read-only KPI queries and separate business actions provided. Outreach conversions and historical access-failure/reliability rates cannot be fabricated. No general event pipeline was added; agree event definitions/privacy/retention before broader instrumentation. |

## Files and modules changed

- Database: five forward migrations, 202610200001 through 202610200005. Four historical duplicates renamed per migration-version-map.json; two historical SQL definitions corrected for fresh replay; the renamed stability migration uses the real mentor role.
- Assignment/permissions: src/lib/api/platform.js, src/lib/useAssignmentRefresh.js, src/lib/useSupabaseQuery.js, src/platform/TrainAIPlatformApp.jsx, src/platform/mentor/MentorDashboardScreen.jsx.
- Community/credits: src/learner/screens/CommunityScreen.jsx, AIQuizScreen.jsx, src/learner/hooks/useCredits.js, src/learner/utils/creditBalance.js, src/learner/TrainAILearnerApp.jsx.
- CAP/rewards/data: src/lib/api/capProgram.js, mentorship.js, learner.js, retention.js, schemaHelper.js, src/learner/screens/CapCohort3Screen.jsx.
- Demo: supabase/functions/book-demo-appointment/index.ts, _shared/demoValidation.js, src/platform/superadmin/DemoRequestsScreen.jsx.
- AI quiz: supabase/functions/ai-generate-quiz/index.ts stores a generated attempt; scoring/points are recorded once on the server. Daily login rewards also moved to a server RPC to preserve working rewards while closing browser writes to achievement stats.
- Runtime/testing: src/services/supabaseClient.js reuses a client when both project configurations are identical; package.json exposes test commands; scripts/audit contains isolated regression and render tooling; .gitignore excludes machine-local fixture state/generated bundles.

Four files already had user changes before this work: platform.js, CohortDetailScreen.jsx, CohortsScreen.jsx and PeopleScreen.jsx. Those changes were retained; this repair only additionally changed targeted functions inside platform.js. Do not attribute the full current diff in those files to this repair.

## Run the local checks again

Prerequisites used here: existing Node 24, project dependencies and PostgreSQL 18 binaries. No new dependency was installed.

1. npm test
2. npm run test:database:start
3. npm run test:database
4. npm run test:community
5. npm run build
6. npm run test:database:stop

The database harness is restricted to a loopback fixture and a trainai_audit_* database. It never uses production connection variables or service keys. For another PostgreSQL binary directory, set AUDIT_PG_BIN for the start script. The fixture's machine-local state is ignored by Git. The browser fixtures are local test pages under scripts/audit; they contain no real accounts.

## Release gates and rollback

Read cleanup-and-rollback.md before deployment. Do not blindly push the renamed historical migrations to an existing project. Compare each real project's migration history and canonical credit schema; preserve and restore-test backups; stage database, frontend and Edge Function changes as one coordinated release. A deployed noncanonical credit schema requires a reviewed mapping of its paid ledger. No production cleanup or migration-history repair was attempted.

See CAP-readiness-2026-10-24.md for the event checklist and business-follow-up.md for owner actions and KPI definitions. The cleanup dry run is scripts/audit/cleanup-dry-run.sql; no destructive cleanup script is included.
