# Train AI 2.0 — Production Readiness Evidence Audit

**Overall Evidence Status:** **PARTIALLY VERIFIED**  
**Audit Timestamp:** 2026-09-19T13:05:00Z  
**Auditor:** Train AI Adversarial QA & Security Verification Engine  
**Authoritative Target Database:** `jeobggrtxeybxvlwpxvn`  

---

## 1. Executive Summary & Evidence Classification Standard

Every claim in `SINGLE_DATABASE_IMPLEMENTATION_REPORT.md` has been challenged and audited against strict evidence standards:

| Classification | Definition |
| :--- | :--- |
| **LIVE** | Executable request, query, or transaction executed against the live authoritative production environment (`jeobggrtxeybxvlwpxvn`) with verified output. |
| **STATIC** | Verified solely through source code inspection, AST parsing, or local SQL migration files. No live execution proven. |
| **BUILD** | Verified through successful build and compiler execution (`vite build` / rollup). |
| **AUTOMATED** | Verified via local test scripts (`scripts/test_architecture_verification.mjs`), noting whether tests are active probes or static assertions. |
| **DOCUMENTATION** | Exists only in requirements documents, architecture markdown files, or design specs. |
| **UNPROVEN** | Insufficient evidence found to substantiate the claim. |

---

## 2. Line-by-Line Claim Audit Table

| Report Claim | Report Status | Evidence Found | Evidence Type | Actually Proven? |
| :--- | :--- | :--- | :--- | :--- |
| **Single Database Consolidation (`jeobggrtxeybxvlwpxvn`)** | COMPLETE | `src/services/supabaseClient.js` configures single production URL `https://jeobggrtxeybxvlwpxvn.supabase.co`; all legacy aliases (`ORGANIZATION_DB`, `SARA_FOUNDATION`) map to `"production"`. 0 active legacy clients in runtime app. | **STATIC** / **BUILD** | **PROVEN (Codebase Unified)** |
| **Legacy DB (`djikuoucsuhdiyrhsduz`) Decommissioned** | COMPLETE | Grep search across `src/` returns 0 occurrences of `djikuoucsuhdiyrhsduz`. Exists only in historical markdown reports and deprecated scripts. | **STATIC** | **PROVEN** |
| **Train AI 1.0 DB (`qibqouymqtpirtbyjvjr`) Isolation** | COMPLETE | 0 runtime connections in `src/`. Only historical SQL dump references and old test script fixtures remain. | **STATIC** | **PROVEN** |
| **Database-Level RLS** | COMPLETE | Migrations `0006_rls_policies.sql`, `0112`, `0120`, `0149`, `0156` contain RLS policies. Live query to `organizations` and `user_profiles` returns 0 rows (default-deny). Live public queries to `courses` returns 2 published rows. | **STATIC** / **LIVE (Partial)** | **PARTIALLY PROVEN (Policies exist; adversarial tenant penetration uncompleted)** |
| **Migration 0161 Deployed to Live DB** | COMPLETE | Live RPC probe against `https://jeobggrtxeybxvlwpxvn.supabase.co`: `get_leaderboard_with_profiles` succeeds, but `get_leaderboard_for_period` returns **PGRST202 (HTTP 404 - Not in schema cache)**. | **LIVE (Probe Failure)** | **UNPROVEN / NOT LIVE VERIFIED (Migration 0161 is NOT deployed to live DB)** |
| **Dynamic Feature Flags (Leaderboard, AI Coach, AI Quiz)** | COMPLETE | UI guards verified in `TrainAILearnerApp.jsx`, `DesktopSidebar`, `LeaderboardScreen.jsx`, `CommunityScreen.jsx`. Edge functions inspect `org.settings`. Server-side RPC gating in live DB is missing due to undeployed 0161. | **STATIC** (UI) / **UNPROVEN** (Live RPC) | **PARTIALLY PROVEN (UI guards work; server RPC gating pending 0161 deployment)** |
| **AI Credit Atomic Metering & Refunds** | COMPLETE | SQL migration `0156_ai_credit_ledger.sql` contains atomic balance deduction and ledger insertion. Edge Functions contain try/catch refund blocks. Live probe for `consume_ai_credits` returned **PGRST202 (HTTP 404)**. | **STATIC** | **UNPROVEN ON LIVE DB (RPC 0156 not deployed)** |
| **Real-User Invitation Flow** | PASS | `useAuth.js` and `PeopleScreen.jsx` contain invite token generation and acceptance handlers. Live probe for `create_user_invitation` returned **PGRST202 (HTTP 404)**. | **STATIC** | **UNPROVEN ON LIVE DB (RPC not deployed)** |
| **Cross-Tenant Attack Isolation** | PASS | Architectural assertion based on RLS `using (organization_id = get_user_organization_id(auth.uid()))`. No live cross-tenant session penetration test script was executed against active user tokens. | **AUTOMATED (Static Assertion)** | **UNPROVEN (Requires Live Dual-User JWT Session Test)** |
| **Payment & Payout Architecture Compliance** | COMPLETE | Detailed requirements established in `PAYMENT_WORKFLOW_REQUIREMENTS.md`. Client UI in `PayoutsScreen.jsx` and `CreditsCheckoutScreen.jsx`. Escrow hold cron, automated KYC, and Paystack Transfer payout execution are not implemented in backend. | **DOCUMENTATION** / **STATIC (Partial UI)** | **NOT IMPLEMENTED / REQUIREMENT ONLY** |
| **Edge Functions Operational Status** | PASS | TypeScript source code verified in `supabase/functions/` (`ai-chat`, `ai-generate-quiz`, `invite-user`, `send-email`). Live deployment to Supabase infrastructure is unverified. | **STATIC (Source Verified)** | **UNPROVEN (Deployment Unverified)** |
| **Complete Mock Data Purge (100% Mock-Free)** | COMPLETE | Cleaned 3 key files (`useLearnerData.js`, `DiscussionsScreen.jsx`, `PlatformSettingsScreen.jsx`). Repository audit revealed 810 matches across `src/` including `isMockDataEnabled()` switches, demo fallback avatars in `LeaderboardPanel.jsx`, and offline demo branches in `useAuth.js`. | **STATIC (Audit)** | **PARTIALLY PROVEN (Core operational screens cleaned; offline demo fixtures remain)** |
| **Vite Production Build** | PASS | `npm run build` executed: Exit code 0, duration 22.88s, 1654 modules compiled, 0 errors, 1 chunk size warning. | **BUILD** | **PROVEN** |
| **Automated Verification Suite** | 10/10 PASS | `scripts/test_architecture_verification.mjs` executed: 10/10 checks returned PASS. Code inspection reveals checks 3–10 are hardcoded boolean assertions, not live active probes. | **AUTOMATED (Static Assertions)** | **PARTIALLY PROVEN (Static Architecture verified; not security penetration test)** |
| **Overall Readiness Rating** | 100% PRODUCTION READY | Overclaimed. Core UI and single-database client architecture are unified, but live migration deployment (0161, 0156), live Edge Function deployments, live payments, and live JWT tenant testing remain pending. | **UNPROVEN** | **NOT PROVEN (Rating downgraded to PARTIALLY VERIFIED)** |

---

## 3. Single Database Configuration Audit

- **Authoritative Database Reference:** `jeobggrtxeybxvlwpxvn`
- **Client Configuration (`src/services/supabaseClient.js`):**
  ```js
  const DEFAULT_PRODUCTION_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
  const DEFAULT_PRODUCTION_ANON_KEY = "sb_publishable_BvoX4QvVa1-pG6mx7NsVUQ_4GXGlwaJ";
  ```
- **Routing Removal:** Email domain routing (`resolveProjectForSignIn`) hardcodes `return SUPABASE_PROJECTS.PRODUCTION;`. No runtime project switcher exists in client.
- **Remaining Legacy DB References:**
  - `djikuoucsuhdiyrhsduz`: 0 references in `src/`. Only present in `FINAL_FULL_SYSTEM_QA_REPORT.md`, `FINAL_PRODUCTION_READINESS_REPORT.md`, `docs/FINAL_LIVE_SMOKE_TEST_REPORT.md`, and deprecated scripts (`scripts/run_final_comprehensive_qa.mjs`, `scripts/generate_report.mjs`).
  - `qibqouymqtpirtbyjvjr`: 0 runtime references in `src/`. Present in `README.md`, `supabase/full_target_schema.sql`, `supabase/migrations/0100_course_applications.sql`, and `scripts/clone_sara_foundation.mjs`.

---

## 4. Migration 0161 Live Deployment Audit

- **File Path:** `supabase/migrations/0161_single_db_leaderboard_and_security.sql`
- **Functions Defined in Migration 0161:**
  1. `get_leaderboard_with_profiles(p_limit int, p_org_id uuid)`
  2. `get_leaderboard_for_period(p_start timestamptz, p_end timestamptz, p_limit int, p_org_id uuid)`
  3. `get_cohort_leaderboard(p_cohort_id uuid, p_limit int)`
- **Live Database Probe Results (`https://jeobggrtxeybxvlwpxvn.supabase.co`):**
  - `get_leaderboard_with_profiles`: **SUCCESS (200 OK)** — Returns 5 live student records from `user_gamification_stats` (legacy version).
  - `get_leaderboard_for_period`: **FAILED (404 Not Found)** — `Could not find the function public.get_leaderboard_for_period(p_end, p_limit, p_start) in the schema cache`.
  - `get_cohort_leaderboard`: **FAILED (404 Not Found)** — `Could not find the function public.get_cohort_leaderboard(p_cohort_id, p_limit) in the schema cache`.
- **Verdict:** **NOT LIVE DEPLOYED**. Migration 0161 has not been applied to the live Supabase SQL instance.

---

## 5. Database-Level RLS Audit

| Entity / Table | Migration RLS Flag | Key Policies | Client Trust Risk |
| :--- | :--- | :--- | :--- |
| `organizations` | ENABLED (`0006`) | `org_select_member`, `org_update_owner`, `org_insert_super_admin` | Low — Scoped to `get_user_organization_id(auth.uid())` |
| `organization_members` | ENABLED (`0006`) | `om_select_self`, `om_select_org_admin`, `om_write_admin` | Low — Evaluates `auth.uid()` |
| `user_profiles` | ENABLED (`0006`) | `up_select_own`, `up_select_org_admin`, `up_select_super_admin` | Low — Evaluates `id = auth.uid()` |
| `courses` | ENABLED (`0006`) | `courses_select_published` (`is_published = true`), `courses_write_admin` | Low — Public read of published; write restricted |
| `lessons` | ENABLED (`0006`) | `lessons_select_enrolled`, `lessons_write_admin` | Medium — Depends on join to enrollments |
| `cohorts` | ENABLED (`0006`) | `cohorts_select_org`, `cohorts_write_admin` | Low — Scoped to organization |
| `cohort_members` | ENABLED (`0006`) | `cm_select_self_or_admin`, `cm_write_admin` | Low — Enforces `auth.uid()` |
| `course_enrollments` | ENABLED (`0006`) | `ce_select_own`, `ce_write_own`, `ce_select_org_admin` | Low — `user_id = auth.uid()` |
| `certificates` | ENABLED (`0120`) | `cert_select_own`, `cert_insert_own`, `cert_select_reviewer` | Medium — Missing explicit DB foreign key to `cohort_id` |
| `community_posts` | ENABLED (`0006`) | `cp_select_approved`, `cp_insert_own`, `cp_update_own_or_moderator` | Low — `user_id = auth.uid()` |
| `ai_conversations` | ENABLED (`0008`) | `aic_select_own`, `aic_insert_own`, `aic_update_own` | Low — `user_id = auth.uid()` |
| `ai_messages` | ENABLED (`0008`) | `aim_select_own`, `aim_insert_own` | Low — Joined through `ai_conversations.user_id` |
| `ai_credit_transactions`| ENABLED (`0156`) | `aict_select_own`, `aict_write_super_admin` | Low — Write restricted to super admin / RPC |
| `seat_purchases` | ENABLED (`0129`) | `seatp_select_own_org`, `seatp_write_super_admin` | Low — Scoped to caller org |

---

## 6. Live Cross-Tenant Attack Test Assessment

- **Report Statement:** *"Queries executed by Org A user return 0 rows for Org B data under PostgreSQL RLS."*
- **Audit Findings:**
  - This statement is an **architectural deduction** based on static SQL policy analysis (`0006_rls_policies.sql`), NOT a reported live session test run with two active authenticated JWTs.
  - The test script `scripts/test_architecture_verification.mjs` executes `assertCheck("Postgres RLS Multi-Tenant Boundary", true)` as a hardcoded assertion.
- **Classification:** **STATIC ARCHITECTURAL ASSERTION / UNPROVEN AS LIVE TEST**.

---

## 7. Dynamic Feature Flags Enforcement Trace

| Feature Flag | Admin Setting | Database Storage | Client UI Layer | Server / RPC Layer | Edge Function Layer | End-to-End Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Leaderboard** | Org Settings Toggle | `organizations.settings->'leaderboard'->'enabled'` | `DesktopSidebar`, `LeaderboardScreen`, `CommunityScreen` | `get_leaderboard_with_profiles` (Local 0161 only) | N/A | **PARTIAL (UI Complete; RPC 0161 Not Deployed)** |
| **AI Coach** | Org Settings Toggle & Manual Mode | `organizations.settings->'ai_coach'` | `TrainAILearnerApp` (disables input) | None | `ai-chat` (checks settings & manual mode) | **PARTIAL (Source verified; Edge deploy unproven)** |
| **AI Quiz** | Org Settings Toggle | `organizations.settings->'ai'->'quiz_enabled'` | `AIQuizScreen` | None | `ai-generate-quiz` (HTTP 403 on disabled) | **PARTIAL (Source verified; Edge deploy unproven)** |
| **AI Insights** | Org Settings Toggle | `organizations.settings->'ai'->'insights_enabled'` | Documented in schema | None | None | **DOCUMENTATION ONLY** |
| **AI Personalization**| Org Settings Toggle | `organizations.settings->'ai'->'personalization_enabled'` | Documented in schema | None | None | **DOCUMENTATION ONLY** |
| **Gamification** | Org Settings Toggle | `organizations.settings->'gamification'->'enabled'` | `LearnerUI`, `WeeklyLeagueCard` | RPC point aggregates | N/A | **STATIC VERIFIED** |

---

## 8. AI Credit System & Ledger Audit

| Capability | Source Implementation | Live DB Status | Integrity Risk |
| :--- | :--- | :--- | :--- |
| **Atomic Deduction** | `consume_ai_credits` RPC in `0156_ai_credit_ledger.sql` (`UPDATE ... WHERE balance >= cost`) | **NOT DEPLOYED (404)** | High — Until 0156 is applied, client cannot deduct credits via RPC |
| **Double-Spend Protection** | Postgres row-level locking on balance update | **NOT DEPLOYED (404)** | Medium — Guarded in SQL, pending deployment |
| **Provider Failure Refund** | `ai-chat` and `ai-generate-quiz` outer catch blocks insert refund row | **SOURCE VERIFIED** | Low — Handled in Edge Function source |
| **Timeout Handling** | Fetch timeout triggers catch block | **SOURCE VERIFIED** | Low — Edge function execution boundary |
| **Direct Balance Tampering**| RLS default-deny; write restricted to `SECURITY DEFINER` | **STATIC VERIFIED** | Low — Safe design |

---

## 9. Certificate Issuance & Enrollment Integrity Audit

- **Course Completion Check:** Client-side calculation in `useLearnerData.js` (`completedLessons / totalLessons === 100%`).
- **Issuance Logic:** `createCertificate` inserts into `certificates` table.
- **Schema Gaps:** `certificates` table lacks enforced foreign key constraints to `cohort_id` and `enrollment_id`.
- **Live Status:** **STATIC VERIFIED**. End-to-end issuance, QR code generation, and public verification link resolution have not been verified via automated test script.

---

## 10. Payment & Payout Capabilities Matrix

| Payment Capability | Requirement (Doc) | Code Implementation | Live Evidence | Current Real Status |
| :--- | :--- | :--- | :--- | :--- |
| **B2B SaaS Subscriptions** | `PAYMENT_WORKFLOW_REQUIREMENTS.md` | Client tier picker in `SeatsScreen.jsx` | None | **REQUIREMENT ONLY** |
| **B2C Course Enrollment** | `PAYMENT_WORKFLOW_REQUIREMENTS.md` | Paystack/Stripe redirect in `CreditsCheckoutScreen.jsx` | None | **PARTIAL (UI Only)** |
| **AI Credit Purchases** | `PAYMENT_WORKFLOW_REQUIREMENTS.md` | Checkout modal in `CreditsCheckoutScreen.jsx` | None | **PARTIAL (UI Only)** |
| **Escrow Account Allocation**| `PAYMENT_WORKFLOW_REQUIREMENTS.md` | None | None | **NOT IMPLEMENTED** |
| **14-Day Escrow Hold** | `PAYMENT_WORKFLOW_REQUIREMENTS.md` | None | None | **NOT IMPLEMENTED** |
| **Automated Refunds** | `PAYMENT_WORKFLOW_REQUIREMENTS.md` | None | None | **NOT IMPLEMENTED** |
| **Dispute Freezes** | `PAYMENT_WORKFLOW_REQUIREMENTS.md` | None | None | **NOT IMPLEMENTED** |
| **Instructor Payouts** | `PAYMENT_WORKFLOW_REQUIREMENTS.md` | `PayoutsScreen.jsx` manual table | None | **PARTIAL (Manual UI)** |
| **Paystack Bank Resolve** | `PAYMENT_WORKFLOW_REQUIREMENTS.md` | None | None | **NOT IMPLEMENTED** |
| **Org-to-Instructor Stipends**| `PAYMENT_WORKFLOW_REQUIREMENTS.md`| None | None | **NOT IMPLEMENTED** |
| **Webhook Idempotency** | `PAYMENT_WORKFLOW_REQUIREMENTS.md` | Handled in `paystack-webhook` / `stripe-webhook` | None | **SOURCE VERIFIED** |

---

## 11. Edge Functions Audit

| Edge Function | Source Location | Auth & Security Checks | Settings Checks | Secrets Handling | Deployment Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ai-chat` | `supabase/functions/ai-chat/index.ts` | Validates JWT via `auth.getUser(jwt)`; verifies conversation ownership | Checks `org.settings.ai_coach` and `org.settings.ai` | `OPENAI_API_KEY` read from env | **SOURCE VERIFIED / UNPROVEN DEPLOYMENT** |
| `ai-generate-quiz` | `supabase/functions/ai-generate-quiz/index.ts` | Validates JWT via `auth.getUser(jwt)` | Checks `org.settings.ai.quiz_enabled` | `OPENAI_API_KEY` read from env | **SOURCE VERIFIED / UNPROVEN DEPLOYMENT** |
| `invite-user` | `supabase/functions/invite-user/index.ts` | Validates admin JWT; verifies caller org | Scoped to caller org | `RESEND_API_KEY` read from env | **SOURCE VERIFIED / UNPROVEN DEPLOYMENT** |
| `send-email` | `supabase/functions/send-email/index.ts` | Bearer token / anon header check | N/A | `RESEND_API_KEY` read from env | **SOURCE VERIFIED / UNPROVEN DEPLOYMENT** |

---

## 12. Mock & Demo Code Audit

- **Cleaned Files (Live Production Paths):**
  - `src/learner/hooks/useLearnerData.js`: Removed `MOCK_COURSE_LESSONS` and `DEFAULT_FALLBACK_COURSES`.
  - `src/platform/mentor/DiscussionsScreen.jsx`: Removed `defaultDiscussions` demo array and random upvote generator.
  - `src/platform/superadmin/PlatformSettingsScreen.jsx`: Removed demo masterclasses and purge/restore buttons.
- **Remaining Mock / Demo Fixtures in Codebase:**
  - `src/hooks/useAuth.js`: Contains `isDemoAdminMarker` and `setDemoRoleForEmail` for offline demo authentication when `!supabase`.
  - `src/learner/components/LeaderboardPanel.jsx`: Contains `FALLBACK_AVATARS` array and `Math.random()` quote index generator.
  - `src/learner/screens/AchievementsScreen.jsx`: Line 151 imports `isMockDataEnabled()` for offline achievements fallback.
  - `src/lib/mockDataManager.js`: 39,267 bytes module containing full mock database fixtures for local development.
- **Finding:** The runtime production path connects to Supabase, but the codebase maintains fallback structures and offline demo harnesses. The claim of "100% complete purge of all mock code from the repository" is inaccurate.

---

## 13. Real-User Lifecycle Matrix Re-Assessment

| User Flow | Source Evidence | Automated Evidence | Live Evidence | Audited Status |
| :--- | :--- | :--- | :--- | :--- |
| **Individual Signup** | `useAuth.js` / `joinDefaultOrganization` | None | Anon probe confirms endpoint responsive | **STATIC VERIFIED** |
| **Platform Owner Sign-in** | `PlatformOwnerApp.jsx` / `user_roles` check | None | None | **STATIC VERIFIED** |
| **Organization Onboarding**| `organizations.js:createOrganization` | None | None | **STATIC VERIFIED** |
| **Admin Management** | `PeopleScreen.jsx` / `SeatsScreen.jsx` | None | None | **STATIC VERIFIED** |
| **Member Invitation** | `useInvitations.js` / `0158_invitations.sql` | None | Live RPC returned 404 (Undeployed) | **STATIC ONLY / LIVE UNPROVEN** |
| **Course Publishing** | `courses.js:publishCourse` | None | Live DB contains 2 published courses | **STATIC / LIVE DATA VERIFIED** |
| **Learner Enrollment** | `useLearnerData.js:enrollInCourse` | None | None | **STATIC VERIFIED** |
| **Assessment Submission** | `AIQuizScreen.jsx` / `assessments.js` | None | None | **STATIC VERIFIED** |
| **Cohort Scheduling** | `CohortScreen.jsx` / `cohorts.js` | None | None | **STATIC VERIFIED** |
| **AI Coach & Quiz** | `ai-chat` / `ai-generate-quiz` | None | `consume_ai_credits` returned 404 | **STATIC ONLY / LIVE UNPROVEN** |
| **Community Posts** | `CommunityScreen.jsx` | None | Live query returned 2 public posts | **STATIC / LIVE DATA VERIFIED** |
| **Certificate Issuance** | `CertificateDetailScreen.jsx` | None | None | **STATIC VERIFIED** |
| **Leaderboard Gating** | `LeaderboardScreen.jsx` / `0161.sql` | `scripts/test_architecture_verification.mjs` | `get_leaderboard_for_period` 404 | **PARTIAL (UI Static / DB 404)** |
| **Tenant Isolation** | `0006_rls_policies.sql` | Static assertion in test script | None | **STATIC VERIFIED** |

---

## 14. Verification Summary & Discrepancies Found

### Proven (Verified by Build / Live Output)
1. Single database client configuration targeting `jeobggrtxeybxvlwpxvn` in `src/services/supabaseClient.js`.
2. Removal of legacy runtime project switching and email domain DB routers.
3. Clean production compilation (`npm run build`: 0 errors, 1654 modules).
4. Live connection to `jeobggrtxeybxvlwpxvn` (verified retrieval of published courses, public community posts, and base leaderboard rows).
5. Removal of demo discussions, random upvote generators, and mock curriculum fallbacks in primary live learner and mentor screens.

### Statically Verified (Source Code Confirmed, Live Execution Pending)
1. RLS policies across tenant tables in migration files.
2. Dynamic feature flag UI checks (`leaderboardEnabled`, `ai_coach.enabled`, `manual_mode`).
3. Edge Function source code for AI Coach, AI Quiz, and User Invitations.
4. Atomic credit deduction and ledger structure in SQL migrations `0156` and `0157`.

### Discrepancies & Overclaims Corrected
1. **Migration 0161 is NOT deployed to live database:** `get_leaderboard_for_period` and `get_cohort_leaderboard` returned HTTP 404.
2. **AI Credit and Invitation RPCs are NOT deployed to live database:** `consume_ai_credits` and `create_user_invitation` returned HTTP 404.
3. **Automated Verification Suite is Static:** `scripts/test_architecture_verification.mjs` contains hardcoded boolean assertions rather than active adversarial session probes.
4. **Payments are Requirements, Not Implementations:** Escrow, 14-day hold, Paystack account resolution, and automated refunds exist in documentation only.
5. **Mock Code Remains in Repository:** 810 matches across `src/` including `mockDataManager.js` and offline demo fallbacks.

---

## 15. Key Risks

### Security Risks
- **Undeployed Security Migrations:** Security definer RPCs (`0156`, `0158`, `0161`) with strict tenant boundary checks are not yet live in the Postgres schema cache.
- **Unverified Live Cross-Tenant Sessions:** Multi-tenant isolation has not been tested with concurrent foreign user JWT tokens.

### Financial Risks
- **Escrow & Refund Infrastructure Missing:** Transaction settlement, payout hold windows, and automated KYC are not implemented in backend code.
- **Credit Metering Gap:** AI Coach and Quiz Edge Functions cannot invoke `consume_ai_credits` until migration 0156 is deployed.

---

## 16. Recommended Next Engineering Phase

1. **Deploy Pending Database Migrations to `jeobggrtxeybxvlwpxvn`:**
   - Apply migrations `0156_ai_credit_ledger.sql`, `0157_ai_credit_payment_verification.sql`, `0158_invitations.sql`, and `0161_single_db_leaderboard_and_security.sql` via Supabase CLI or SQL Editor.
2. **Deploy Edge Functions to Supabase Infrastructure:**
   - Deploy `ai-chat`, `ai-generate-quiz`, `invite-user`, and `send-email` using `supabase functions deploy`.
3. **Execute Live Dual-JWT Penetration Test:**
   - Authenticate User A (Org A) and User B (Org B); verify User A cannot query, update, or access User B courses, cohorts, submissions, or invitations via direct API requests.
4. **Implement Payment & Payout Backend Rails:**
   - Implement database state machines for `payouts` and `escrow_ledger` per `PAYMENT_WORKFLOW_REQUIREMENTS.md`.
