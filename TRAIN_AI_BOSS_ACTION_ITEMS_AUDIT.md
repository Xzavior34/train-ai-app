# Train AI 2.0 — Authoritative 20 Action Items Audit & Remediation Plan

This document represents the definitive, codebase-verified discovery, audit, and implementation planning assessment for Train AI 2.0 across all 20 agreed team action items under the consolidated single-database architecture (`jeobggrtxeybxvlwpxvn`).

---

## Executive Summary Status Matrix

| # | Action Item Description | Current Code Status | Primary Files Involved | Database Tables / RPCs | Security / Multi-Tenant Risk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Date Range Filter on Platform & Org Analytics | **NOT IMPLEMENTED** | `AdminAnalyticsScreen.jsx`, `live/ownerLive.js`, `platform.js` | `fetch_org_dashboard_stats`, `enrollment_trends` | Low — Read query parameterization required |
| **2** | Localized Multi-Currency Display (NGN, USD, GBP, etc.) | **PARTIAL** | `CreditsCheckoutScreen.jsx`, `PayoutsScreen.jsx`, `useCurrency.js` | `get_active_price`, `payments`, `payouts` | Medium — Ledger consistency across currency conversions |
| **3** | Dynamic UI Feature Flags (Leaderboard, AI Coach, etc.) | **PARTIAL** | `HomeScreen.jsx`, `LeaderboardScreen.jsx`, `organizations.js` | `organization_settings` (`feature_flags`) | Low — UI rendering guard missing |
| **4** | Unified Org Admin Analytics View | **PARTIAL** | `AdminAnalyticsScreen.jsx`, `WorkforceIntelligenceScreen.jsx` | `user_profiles`, `enrollments`, `lesson_completions` | Low — UI consolidation and metric alignment |
| **5** | Desktop Viewport Spacing, Margins & Typography | **PASS / VERIFIED** | `src/index.css`, `PlatformUI.jsx`, `App.jsx` | None (Client CSS & Design Tokens) | None — Responsive container styling verified |
| **6** | Supabase Auth Email Templates & Resend Branding | **NOT IMPLEMENTED** | `supabase/functions/send-email`, Supabase Auth Config | Supabase Auth Config / Resend API | Medium — Deliverability and link domain integrity |
| **7** | Production Email Confirmation & Recovery Links | **PARTIAL** | `src/hooks/useAuth.js`, `AuthPage.jsx`, `App.jsx` | Supabase Auth (`auth.users`) | High — Must route recovery hash cleanly on single DB |
| **8** | Google SSO (OAuth) Sign-In & Registration | **NOT IMPLEMENTED** | `AuthPage.jsx`, `useAuth.js`, `supabaseClient.js` | `auth.users`, `user_profiles`, OAuth Providers | High — Ensure proper tenant profile creation upon SSO |
| **9** | Platform Owner Portal Dedicated Route (`?portal=owner`) | **PASS / VERIFIED** | `PlatformOwnerApp.jsx`, `PlatformOwnerLoginScreen.jsx` | `user_roles` (`super_admin`), `organizations` | High — Hardened RBAC prevents tenant privilege leaks |
| **10** | End-to-End Payment & Payout Business Logic | **PARTIAL** | `src/lib/api/payments.js`, `PayoutsScreen.jsx`, Edge Functions | `payments`, `payouts`, `instructor_profiles` | Critical — Escrow holds and bank resolve logic |
| **11** | Dedicated AI Credit Usage & Management Dashboard | **PARTIAL** | `ModerationScreen.jsx`, `src/lib/api/creditRequests.js` | `credit_requests`, `ai_usage_events` | Low — Repurpose screen from moderation to credit analytics |
| **12** | Complete Certificate Issuance & Enrollment Integrity | **PARTIAL** | `src/lib/api/certificates.js`, `CertificateDetailScreen.jsx` | `certificates`, `certificate_templates` | Low — Schema lacks foreign keys to cohort/enrollment |
| **13** | In-Place Seat & Role Management (No Duplicate Accounts)| **PASS / VERIFIED** | `SeatsScreen.jsx`, `PeopleScreen.jsx`, `organizations.js` | `organization_members`, `user_profiles` | Medium — Verified in-place updates; seat limits enforced |
| **14** | Invited Learners Categorization (Pending/Accepted/Expired) | **PARTIAL** | `PeopleScreen.jsx`, `src/lib/api/invitations.js` | `organization_invitations` | Low — UI only displays pending; needs state filtering |
| **15** | Instructor Feed & Cohort Discussion Scope | **PARTIAL** | `DiscussionsScreen.jsx`, `CommunityScreen.jsx` | `forum_posts`, `cohort_members`, `0152_cohort_feed` | Medium — Remove hardcoded fallback demo discussions |
| **16** | Sara Foundation Cap Cohort 3 Launch Deployment | **READY FOR LAUNCH**| `CoursesScreen.jsx`, `CourseDetailScreen.jsx` | `cohorts`, `cohort_courses`, `cohort_members` | High — Production deployment of Cap Cohort 3 syllabus |
| **17** | Google Play Store PWA / Android Native Packaging | **PARTIAL** | `public/manifest.json`, `sw.js`, PWA Service Worker | None (Android TWA / Capacitor Wrapper) | Medium — Needs Bubblewrap/Capacitor setup for APK/AAB |
| **18** | Multi-Segment Landing Page Messaging | **PARTIAL** | `LandingPage.jsx`, `src/components/common` | None (Marketing & Copywriting Content) | None — Expand copy beyond enterprise workforce |
| **19** | Full-Lifecycle Interactive Demo Request CRM Pipeline | **PARTIAL** | `OverviewScreen.jsx`, `src/lib/api/platform.js` | `demo_requests` | Low — UI needs full CRM kanban/status pipeline |
| **20** | Inactive Mentor Pool & Application Decisions | **PASS / VERIFIED** | `PeopleScreen.jsx`, `src/lib/api/mentors.js` | `mentors` (`is_active` toggle), `mentor_applications`| Low — Verified activation/deactivation mechanics |

---

## Detailed 20 Action Items Audit & Remediation Specifications

### Action Item 1: Date Range Filter on Platform & Org Analytics
- **Status:** `NOT IMPLEMENTED`
- **Current Implementation:** Analytics screens (`AdminAnalyticsScreen.jsx` and Platform Owner overview) make calls to `fetchOrgDashboardStats` and `fetchPlatformEnrollmentTrend` which execute static SQL aggregates without accepting start/end date parameters.
- **Files Involved:**
  - `src/screens/admin/AdminAnalyticsScreen.jsx`
  - `src/lib/api/live/ownerLive.js`
  - `src/lib/api/platform.js`
- **Database Tables / RPCs:** `fetch_org_dashboard_stats(p_org_id)`, `enrollments`, `lesson_completions`.
- **What is Missing/Broken:** UI lacks date picker dropdowns (e.g. "Last 7 Days", "Last 30 Days", "Quarter to Date", "Custom Range"); API queries lack `start_date` and `end_date` filters.
- **Required Implementation:**
  1. Add date range selector component to `AdminAnalyticsScreen.jsx`.
  2. Update RPC `fetch_org_dashboard_stats(p_org_id, p_start_date, p_end_date)` to support dynamic date bounds.
  3. Wire frontend state to re-fetch on date range changes.
- **Verification Test:** Switch date range from "Last 30 Days" to "Last 7 Days" and verify that metrics and charts update accordingly.

---

### Action Item 2: Localized Multi-Currency Display (NGN, USD, GBP, etc.)
- **Status:** `PARTIAL`
- **Current Implementation:** `CreditsCheckoutScreen.jsx` contains hardcoded multi-currency conversion arrays for NGN, USD, GBP. Payouts screen uses flat numbers without currency symbol formatting. `get_active_price(p_currency)` exists in migration `0070`.
- **Files Involved:**
  - `src/screens/CreditsCheckoutScreen.jsx`
  - `src/screens/admin/PayoutsScreen.jsx`
  - `src/components/common/PlatformUI.jsx`
- **Database Tables / RPCs:** `subscription_tiers`, `tier_prices`, `payments`, `payouts`.
- **What is Missing/Broken:** No global currency context hook (`useCurrency`); admin dashboards display unformatted numerical values without explicit currency designations; exchange rates are hardcoded.
- **Required Implementation:**
  1. Implement `CurrencyContext` and `useCurrency` hook with user preference persistence.
  2. Format all financial figures using `Intl.NumberFormat(locale, { style: 'currency', currency })`.
  3. Ensure database transactions record ISO currency alongside amounts.
- **Verification Test:** Toggle currency switch in learner and admin views; confirm all checkout modals, pricing tables, and payout screens display correct currency symbols and converted amounts.

---

### Action Item 3: Dynamic UI Feature Flags (Leaderboard, AI Coach, etc.)
- **Status:** `PARTIAL`
- **Current Implementation:** Database stores organization settings including `leaderboard_enabled` and `ai_coach_enabled`. `organizations.js` has `fetchOrgLeaderboardSettings`. However, `HomeScreen.jsx` and navigation bars do not check this flag before rendering the Leaderboard tab.
- **Files Involved:**
  - `src/screens/HomeScreen.jsx`
  - `src/screens/LeaderboardScreen.jsx`
  - `src/lib/api/organizations.js`
- **Database Tables / RPCs:** `organizations.settings`, `organization_settings`.
- **What is Missing/Broken:** Missing client-side guard: when `leaderboard_enabled = false`, the leaderboard button remains visible in navigation and leaderboard screen remains directly accessible.
- **Required Implementation:**
  1. Wrap Leaderboard route and navigation items in a feature flag check.
  2. If disabled for an org, render "Feature disabled by organization administrator" or hide tab entirely.
- **Verification Test:** Disable leaderboard in Org Settings; log in as learner in that org; verify Leaderboard navigation item is completely absent.

---

### Action Item 4: Unified Org Admin Analytics View
- **Status:** `PARTIAL`
- **Current Implementation:** Analytics are split between `AdminAnalyticsScreen.jsx`, `WorkforceIntelligenceScreen.jsx`, and `OverviewScreen.jsx`, resulting in duplicated queries and slightly divergent metrics.
- **Files Involved:**
  - `src/screens/admin/AdminAnalyticsScreen.jsx`
  - `src/screens/admin/WorkforceIntelligenceScreen.jsx`
  - `src/screens/admin/OverviewScreen.jsx`
- **Database Tables / RPCs:** `user_profiles`, `enrollments`, `lesson_completions`, `assessment_submissions`.
- **What is Missing/Broken:** Lack of a single, coherent executive dashboard summarizing completion rates, learner engagement, assessment scores, and seat utilization in one unified view.
- **Required Implementation:**
  1. Consolidate workforce metrics and course completion KPIs into a unified tabbed dashboard inside `AdminAnalyticsScreen.jsx`.
  2. Share unified data fetching hook `useOrgAnalytics`.
- **Verification Test:** Open Admin Analytics; verify all cards (Active Learners, Course Completion Rate, Avg Assessment Score, Seat Utilization) render consistently.

---

### Action Item 5: Desktop Viewport Spacing, Margins & Typography
- **Status:** `PASS / VERIFIED`
- **Current Implementation:** Verified across `src/index.css` and `PlatformUI.jsx`. Container classes utilize `max-w-7xl`, `px-4 sm:px-6 lg:px-8`, responsive flex wraps, and CSS clamp typography.
- **Files Involved:**
  - `src/index.css`
  - `src/components/common/PlatformUI.jsx`
  - `src/App.jsx`
- **Database Tables / RPCs:** None (Client CSS & Design Tokens).
- **What is Missing/Broken:** Nothing broken. Verified on 1440px and 1920px desktop viewports with zero horizontal overflow and proper negative space.
- **Verification Test:** Inspect desktop UI at 1920x1080 resolution; all sidebars, main contents, and cards align properly with clean padding.

---

### Action Item 6: Supabase Auth Email Templates & Resend Branding
- **Status:** `NOT IMPLEMENTED`
- **Current Implementation:** Auth emails (magic links, confirmations, password resets) currently use Supabase's default system templates with unbranded formatting. Edge Function `send-email` exists for team invitations via Resend, but auth transactional emails are unbranded.
- **Files Involved:**
  - `supabase/functions/send-email/index.ts`
  - Supabase Dashboard Auth Email Templates configuration.
- **Database Tables / RPCs:** Supabase Auth system.
- **What is Missing/Broken:** Train AI HTML email templates (logo, primary dark purple branding, official footer, verified sending domain) have not been injected into the live Supabase Auth configuration.
- **Required Implementation:**
  1. Author production HTML email templates for: Confirmation, Magic Link, Password Reset, and Organization Invite.
  2. Configure SMTP credentials and verified domain `mail.trainai.com` / Resend in Supabase project `jeobggrtxeybxvlwpxvn`.
- **Verification Test:** Trigger a password reset; verify email arrives from official domain with Train AI 2.0 branded styling.

---

### Action Item 7: Production Email Confirmation & Recovery Links
- **Status:** `PARTIAL`
- **Current Implementation:** Password reset recovery hash parser exists in `useAuth.js`. Signup email confirmation landing needs explicit verification on the consolidated database to prevent redirect loops.
- **Files Involved:**
  - `src/hooks/useAuth.js`
  - `src/screens/AuthPage.jsx`
  - `src/App.jsx`
- **Database Tables / RPCs:** `auth.users`.
- **What is Missing/Broken:** Explicit landing callback for `#access_token=...&type=signup` vs `type=recovery` needs bulletproof handling so new users are immediately routed to profile onboarding.
- **Required Implementation:**
  1. Add dedicated `AuthCallbackScreen.jsx` or enhance `useAuth.js` listener to distinguish signup confirmation from password recovery.
  2. Redirect confirmed signups to onboarding and recovery users to password reset modal.
- **Verification Test:** Click signup confirmation link in external browser session; verify immediate redirect to onboarding flow.

---

### Action Item 8: Google SSO (OAuth) Sign-In & Registration
- **Status:** `NOT IMPLEMENTED`
- **Current Implementation:** `AuthPage.jsx` provides Email/Password and Magic Link tabs only. No Google OAuth button or `supabase.auth.signInWithOAuth({ provider: 'google' })` is implemented.
- **Files Involved:**
  - `src/screens/AuthPage.jsx`
  - `src/hooks/useAuth.js`
  - `src/services/supabaseClient.js`
- **Database Tables / RPCs:** `auth.users`, `user_profiles`, `0001_initial_schema`.
- **What is Missing/Broken:** UI button "Continue with Google" is absent; OAuth callback logic and automatic profile/role creation trigger for OAuth users need verification.
- **Required Implementation:**
  1. Add "Continue with Google" button with Google SVG icon to `AuthPage.jsx`.
  2. Call `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`.
  3. Ensure database trigger `handle_new_user()` auto-creates `user_profiles` entry with metadata from Google.
- **Verification Test:** Click "Continue with Google"; authenticate with Google account; verify user is logged in with profile populated.

---

### Action Item 9: Platform Owner Portal Dedicated Route (`?portal=owner`)
- **Status:** `PASS / VERIFIED`
- **Current Implementation:** Dedicated route handled in `PlatformOwnerLoginScreen.jsx` and `PlatformOwnerApp.jsx`. Authenticates exclusively against `super_admin` role in `user_roles` table with strict RLS enforcement.
- **Files Involved:**
  - `src/screens/owner/PlatformOwnerLoginScreen.jsx`
  - `src/screens/owner/PlatformOwnerApp.jsx`
  - `src/lib/api/live/ownerLive.js`
- **Database Tables / RPCs:** `user_roles`, `organizations`, `platform_audit_logs`.
- **What is Missing/Broken:** Fully verified and working as expected.
- **Verification Test:** Open `http://localhost:5173/?portal=owner`; log in as `trainailtd@gmail.com`; verify full platform administration access.

---

### Action Item 10: End-to-End Payment & Payout Business Logic
- **Status:** `PARTIAL`
- **Current Implementation:** Client API `src/lib/api/payments.js` and edge functions for Paystack/Stripe exist. However, the 14-day escrow hold, automated KYC check, and bank account resolution for instructors need full end-to-end integration.
- **Files Involved:**
  - `src/lib/api/payments.js`
  - `src/screens/admin/PayoutsScreen.jsx`
  - `supabase/functions/paystack-checkout`
  - `supabase/functions/stripe-checkout`
- **Database Tables / RPCs:** `payments`, `payouts`, `instructor_profiles`, `payment_events`.
- **What is Missing/Broken:** Instructor withdrawal request modal lacks automated bank resolution check; payout approval triggers in `PayoutsScreen.jsx` require live webhook feedback.
- **Required Implementation:**
  1. Follow full requirements detailed in `PAYMENT_WORKFLOW_REQUIREMENTS.md`.
  2. Add Paystack Account Resolve API endpoint before saving instructor bank details.
  3. Enforce 14-day escrow maturity before funds shift to "Available for Withdrawal".
- **Verification Test:** Process course payment; verify funds appear in instructor's pending balance; simulate 14-day release; execute withdrawal request and verify admin approval flow.

---

### Action Item 11: Dedicated AI Credit Usage & Management Dashboard
- **Status:** `PARTIAL`
- **Current Implementation:** `ModerationScreen.jsx` currently hosts prompt moderation queues and manual AI toggles. Real-time token consumption logs exist in `ai_usage_events` and credit top-up requests in `credit_requests`.
- **Files Involved:**
  - `src/screens/admin/ModerationScreen.jsx`
  - `src/lib/api/creditRequests.js`
  - `src/lib/api/ai.js`
- **Database Tables / RPCs:** `credit_requests`, `ai_usage_events`, `organization_credits`.
- **What is Missing/Broken:** Admin lacks a clean graphical dashboard showing tokens consumed per department/user, remaining credit burn-rate projections, and pending top-up requests with one-click approvals.
- **Required Implementation:**
  1. Repurpose `ModerationScreen.jsx` into "AI Governance & Credits Dashboard".
  2. Add visual charts for Daily Token Usage, Top Prompt Consumers, and Credit Request Approval table.
- **Verification Test:** Spend tokens in AI Coach; open Admin AI Dashboard; verify usage counter increases and credit balance updates.

---

### Action Item 12: Complete Certificate Issuance & Enrollment Integrity
- **Status:** `PARTIAL`
- **Current Implementation:** `certificates` and `certificate_templates` tables exist in migrations. PDF generation works via client-side canvas/jsPDF.
- **Files Involved:**
  - `src/lib/api/certificates.js`
  - `src/screens/CertificateDetailScreen.jsx`
  - `src/screens/admin/CertificatesScreen.jsx`
- **Database Tables / RPCs:** `certificates`, `certificate_templates`, `enrollments`.
- **What is Missing/Broken:** `certificates` table lacks explicit foreign keys to `cohort_id` and `enrollment_id`, causing orphan certificate potential if courses are duplicated across cohorts.
- **Required Implementation:**
  1. Add migration adding foreign keys `cohort_id` and `enrollment_id` to `certificates`.
  2. Include QR code with verifiable URL (`https://app.trainai.com/verify-certificate/{cert_uuid}`).
- **Verification Test:** Complete a cohort course; generate certificate; scan QR code; verify authenticity page displays matching learner and cohort details.

---

### Action Item 13: In-Place Seat & Role Management (No Duplicate Accounts)
- **Status:** `PASS / VERIFIED`
- **Current Implementation:** Role updates in `SeatsScreen.jsx` and `PeopleScreen.jsx` execute direct `UPDATE` queries on `user_profiles` and `organization_members` using unique `user_id` and `org_id`.
- **Files Involved:**
  - `src/screens/admin/SeatsScreen.jsx`
  - `src/screens/admin/PeopleScreen.jsx`
  - `src/lib/api/organizations.js`
- **Database Tables / RPCs:** `organization_members`, `user_profiles`, `seats`.
- **What is Missing/Broken:** Fully verified. Changes are made in-place without creating secondary or duplicate accounts.
- **Verification Test:** Change a user's role from "Learner" to "Instructor"; verify user's UUID remains identical and seat count accurately updates.

---

### Action Item 14: Invited Learners Categorization (Pending/Accepted/Expired)
- **Status:** `PARTIAL`
- **Current Implementation:** `PeopleScreen.jsx` has an "Invited" section, but it only fetches records where `status = 'pending'`.
- **Files Involved:**
  - `src/screens/admin/PeopleScreen.jsx`
  - `src/lib/api/invitations.js`
- **Database Tables / RPCs:** `organization_invitations`.
- **What is Missing/Broken:** Admin cannot view history of accepted invites, resend expired invites, or view audit of revoked tokens.
- **Required Implementation:**
  1. Add segmented tab filter in People screen: [Active Members | Pending Invites | Accepted History | Expired / Revoked].
  2. Add "Resend Invite" and "Revoke Token" buttons to pending items.
- **Verification Test:** Send invitation; verify it appears under "Pending"; accept invitation with recipient account; verify entry shifts to "Accepted History".

---

### Action Item 15: Instructor Feed & Cohort Discussion Scope
- **Status:** `PARTIAL`
- **Current Implementation:** Database migration `0152` established scoped cohort posts. However, `DiscussionsScreen.jsx` still includes mock fallback objects when empty.
- **Files Involved:**
  - `src/screens/instructor/DiscussionsScreen.jsx`
  - `src/screens/CommunityScreen.jsx`
  - `src/lib/api/discussions.js`
- **Database Tables / RPCs:** `forum_posts`, `cohort_members`, `discussions`.
- **What is Missing/Broken:** Hardcoded fallback posts must be removed so instructors and learners only see live, authenticated posts from their active cohorts.
- **Required Implementation:**
  1. Remove static demo fallback array from `DiscussionsScreen.jsx`.
  2. Render clean empty state ("No discussions in this cohort yet. Start the conversation!") when query returns 0 rows.
- **Verification Test:** Create new empty cohort; navigate to Discussions; confirm 0 demo posts are displayed and new posts persist to Supabase.

---

### Action Item 16: Sara Foundation Cap Cohort 3 Launch Deployment
- **Status:** `READY FOR LAUNCH`
- **Current Implementation:** Database structures for Sara Foundation organization, cohorts, syllabi, and enrollment rosters are fully configured and verified.
- **Files Involved:**
  - `src/screens/CoursesScreen.jsx`
  - `src/screens/CourseDetailScreen.jsx`
  - `src/screens/ScheduleScreen.jsx`
- **Database Tables / RPCs:** `organizations` (Sara Foundation), `cohorts`, `cohort_courses`, `cohort_members`.
- **What is Missing/Broken:** Final deployment configuration and syllabus seeding for Cap Cohort 3.
- **Required Implementation:**
  1. Run Cap Cohort 3 data seeding script linking live Zoom/Meet URLs and assignment deadlines.
  2. Batch invite Cap Cohort 3 students.
- **Verification Test:** Log in as Sara Foundation learner; confirm Cap Cohort 3 courses, live class schedules, and mentor assignments appear immediately.

---

### Action Item 17: Google Play Store PWA / Android Native Packaging
- **Status:** `PARTIAL`
- **Current Implementation:** Complete PWA configuration with `public/manifest.json`, responsive icons, standalone display mode, and service worker registration in `sw.js`.
- **Files Involved:**
  - `public/manifest.json`
  - `sw.js`
  - `index.html`
- **Database Tables / RPCs:** None (Android TWA / Capacitor Wrapper).
- **What is Missing/Broken:** Native Android wrapper configuration (Capacitor or Trusted Web Activity via Bubblewrap) to generate `.aab` bundle for Google Play Console.
- **Required Implementation:**
  1. Initialize Capacitor Android project or Bubblewrap TWA manifest.
  2. Configure digital asset links (`/.well-known/assetlinks.json`) for URL bar removal.
  3. Build release signed APK/AAB.
- **Verification Test:** Deploy TWA to Android test device via ADB; verify full-screen native execution and notification capabilities.

---

### Action Item 18: Multi-Segment Landing Page Messaging
- **Status:** `PARTIAL`
- **Current Implementation:** Landing page copy is currently heavily skewed toward enterprise workforce training.
- **Files Involved:**
  - `src/screens/LandingPage.jsx`
  - `src/components/common/Header.jsx`
- **Database Tables / RPCs:** None (Marketing & Copywriting Content).
- **What is Missing/Broken:** Copy lacks tailored value propositions for:
  1. Professional Training Academies & Coding Bootcamps.
  2. Non-Profit Foundations & Scholarship Programs (e.g. Sara Foundation).
  3. Higher Education & Vocational Institutions.
- **Required Implementation:**
  1. Add segmented tabs / hero carousel: "For Enterprises", "For Academies", "For Foundations & NGOs".
  2. Update testimonials and feature highlights to showcase multi-tenant flexibility.
- **Verification Test:** Browse landing page; verify distinct sections for enterprises, academies, and foundations are legible and responsive.

---

### Action Item 19: Full-Lifecycle Interactive Demo Request CRM Pipeline
- **Status:** `PARTIAL`
- **Current Implementation:** Landing page demo request form saves directly to `demo_requests` table via `submitDemoRequest`. Platform Owner overview lists recent requests.
- **Files Involved:**
  - `src/screens/LandingPage.jsx`
  - `src/screens/owner/OverviewScreen.jsx`
  - `src/lib/api/platform.js`
- **Database Tables / RPCs:** `demo_requests` (`id`, `name`, `email`, `company`, `status`, `notes`, `created_at`).
- **What is Missing/Broken:** Platform owner lacks interactive status transitions (New ──▶ Contacted ──▶ Demo Scheduled ──▶ Completed ──▶ Converted / Closed).
- **Required Implementation:**
  1. Add Kanban or status dropdown in Platform Owner demo requests table.
  2. Add lead notes textarea and one-click "Convert to Organization" onboarding trigger.
- **Verification Test:** Submit demo request on landing page; open Platform Owner portal; change status to "Demo Scheduled" and add meeting notes; confirm persistence.

---

### Action Item 20: Inactive Mentor Pool & Application Decisions
- **Status:** `PASS / VERIFIED`
- **Current Implementation:** `PeopleScreen.jsx` and `src/lib/api/mentors.js` support activating, deactivating, and reviewing mentor applications via `is_active` boolean flag in `mentors` table.
- **Files Involved:**
  - `src/screens/admin/PeopleScreen.jsx`
  - `src/lib/api/mentors.js`
- **Database Tables / RPCs:** `mentors`, `mentor_applications`.
- **What is Missing/Broken:** Fully verified. Inactive mentors remain in standby pool without receiving automated student bookings until activated by an administrator.
- **Verification Test:** Toggle mentor status from "Active" to "Inactive"; verify mentor is hidden from learner booking catalog; reactivate and verify reappearance.

---

## Technical Remediation Priority & Sequencing

```
Phase 1: Critical Core & Auth (Blockers)
├── Action Item 6: Supabase Auth Email Branding & SMTP
├── Action Item 7: Email Confirmation & Callback Route Hardening
├── Action Item 8: Google SSO Integration
└── Action Item 10: Payment & Escrow Payout Rules (per PAYMENT_WORKFLOW_REQUIREMENTS.md)

Phase 2: Admin Operations & Governance
├── Action Item 1: Dynamic Date Range Analytics
├── Action Item 2: Localized Multi-Currency Display (useCurrency)
├── Action Item 3: Leaderboard & AI Coach Feature Flag UI Guards
├── Action Item 4: Unified Org Analytics Dashboard
├── Action Item 11: AI Credit Usage & Management Screen
└── Action Item 14: Invitation Lifecycle State Tabs

Phase 3: Learning Experience & Cohorts
├── Action Item 12: Certificate Schema Foreign Keys & QR Verification
├── Action Item 15: Clean Cohort Feeds (Remove Mock Fallbacks)
└── Action Item 16: Sara Foundation Cap Cohort 3 Production Deployment

Phase 4: Growth, CRM & Mobile Distribution
├── Action Item 17: Android Google Play Store TWA Packaging
├── Action Item 18: Multi-Segment Landing Page Copy
└── Action Item 19: Demo Request Interactive CRM Pipeline
```
