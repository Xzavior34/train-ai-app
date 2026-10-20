# Platform repairs ? 20 October 2026

Baseline: production build passes (Vite 5.4.21); existing package has no test/lint/typecheck scripts. Four user-modified files existed before this work: platform.js, CohortDetailScreen.jsx, CohortsScreen.jsx, PeopleScreen.jsx. Preserve those edits. No production access, credential changes, billing changes, deletion, outreach, or deployment authorized by this repair plan.

| Priority | Work | Modules | Final local status |
|---|---|---|---|
| P1 | Mentor assignment and tenant boundaries; mentor/user ID; session recurrence | SQL policies, platform API, mentor dashboard, platform app | FIXED |
| P1 | Atomic seat enforcement across signup and joins | membership trigger | FIXED |
| P1 | Server-authoritative AI balances; 3 unaffiliated questions; refunds | credit ledger, useCredits, AI endpoints | FIXED |
| P1 | Achievement eligibility and concurrent duplicate awards | award RPC | FIXED |
| P2 | Duplicate migration versions and credit schema mismatch | migration files, history reconciliation guide | FIXED |
| P2 | Compact Community Hub | CommunityScreen | FIXED |
| P2 | Accurate labels/profile fallbacks; cleanup dry run | mentor dashboard, read-only SQL report | PARTIALLY FIXED ? real-data review pending |
| P2 | Demo input validation and atomic rate limits | booking function, SQL RPC | FIXED |
| P2 | Isolated security/regression tests | Node tests + local PostgreSQL fixture | FIXED locally; external-service E2E pending |
| P2 | CAP readiness and business follow-up | docs/audit | FIXED |

Verification requires independent local PostgreSQL fixtures and a fresh build. Existing scripts include live signup, password-reset, and production mutation workflows; do not run those as a baseline. Production history/schema and browser journeys remain separate manual gates.

Final statuses and evidence are recorded in REPAIR-REPORT.md. All prioritized local code repairs were implemented; production cleanup, deployment reconciliation and external-service journeys remain explicit manual gates.
