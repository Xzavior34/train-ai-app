# Train AI Platform Upgrade — Progress & Architecture Log

## Overview
This document tracks the incremental implementation of the Train AI platform improvements across product, admin, onboarding, cohort, trial, certificate, demo-booking, marketplace, AI-credit, mentorship, and CAP Cohort 3 specifications.

---

## 1. System Architecture & Tech Stack Identification
- **Frontend Framework**: React 18 SPA built with Vite, utilizing Lucide React icons, CSS variables/theme tokens, and PWA capabilities.
- **Backend & Database**: Supabase (PostgreSQL) with Row-Level Security (RLS), parameterized RPCs, and Security Definer functions.
- **Authentication**: Supabase Auth (email/password, OTP, MFA TOTP, password recovery, session sync).
- **Payment Processing**: Multi-gateway support via Paystack and Stripe with minor-unit integer calculation.
- **Transactional Email**: Resend API (`info@trainailtd.com`, domain `trainailtd.com`).
- **AI Integration & Monetization**: Multi-model routing (OpenAI, Anthropic, Gemini) backed by transactional AI Credit Ledger and quota enforcement.
- **Storage**: Supabase Storage buckets for certificates, profile photos, course media, and assets.
- **Calendar & Meetings**: Google Meet automated link generation, `.ics` calendar invitation dispatch, and demo request booking flow.

---

## 2. Implementation Sprints Matrix

| Sprint | Description | Status | Key Deliverables |
| :--- | :--- | :--- | :--- |
| **Sprint 1** | Platform Stability & Terminology | ✅ Complete | Terminology standardization (`src/lib/constants/terminology.js`), KPI Tracker with monthly filters and in-UI editor (`KPITrackerCard.jsx`), Cohort lifecycle with safe archive/delete & elapsed-time progress formula (`cohorts.js`, `CohortsScreen.jsx`), Admin Auth UX with Caps Lock & rate limiting (`PlatformOwnerLoginScreen.jsx`), Org referral join & seats management. |
| **Sprint 2** | CAP Cohort 3 & Trial Access | ✅ Complete | 6-week access code engine (`accessCodes.js`), Server-side trial enforcement, Learn $\rightarrow$ Build $\rightarrow$ Launch timeline, Teams & project submissions, Mentorship check-ins with 1-5 rating & blocker logging (`mentorship.js`), Demo Day review & showcase (`CapCohort3Screen.jsx`). |
| **Sprint 3** | Sales Operations & Demos | ✅ Complete | Demo booking database persistence, transactional Resend notifications to `info@trainailtd.com` and `info@sarafoundationafrica.com`, prospect confirmation with Google Meet info, Admin Demo Requests screen with status tracking (`New`, `Scheduled`, `Confirmed`, `Completed`, `Follow-up Required`, `No Show`, `Cancelled`). |
| **Sprint 4** | Certification Engine | ✅ Complete | Train AI vs Org custom template selection, automated & manual issuance, public verification route (`/certificate/:id` or `/?verify=...`), tamper-proof code generation, PDF preview/download/revoke (`CertificateVerificationPage.jsx`, `certificates.js`). |
| **Sprint 5** | Academy Marketplace Foundation | ✅ Complete | Academy profiles, instructor accounts & seat plans, course publishing workflow, public marketplace browsing & enrollment (`MarketplacePage.jsx`), 15% platform commission ledger in integer minor units (`marketplace.js`). |
| **Sprint 6** | AI Monetization & Quota Engine | ✅ Complete | Reusable AI credit ledger, Org & user balance allocations (`useCredits.js`), server-side quota consumption (`consume_ai_credits`), top-up package checkout (`CreditsCheckoutScreen.jsx`), credit request workflows (`creditRequests.js`). |
| **Sprint 7** | Polish, Accessibility & Full QA | ✅ Complete | In-app notification center, multi-tenant database routing preservation, responsive layout & a11y styling, zero Vite build/lint compilation errors. |

---

## 3. Existing Functionality (Preserved)
- Multi-tenant Organization management & Super Admin controls.
- Role-based views: Learner, Mentor/Instructor, HR, Manager, Organization Admin, Super Admin.
- Learner module player, assessment engine, quiz pipeline, and achievement badges.
- Course builder wizard with rich modules & lessons.
- Resend email dispatch for invites and password resets.
- Organization self-serve onboarding & seat billing.

---

## 4. Features Being Changed
- **Terminology**: Standardizing "Organization", "Academy", "Cohort", "Course", "Training Programme" across all screens.
- **KPI Tracker**: Obvious completed vs pending activities, monthly filters (September & future), owner/team filter, status filter, and live in-UI status updates.
- **Cohort Lifecycle**: Elapsed-time progress formula `(current - start) / (end - start) * 100`, safe date parsing, duplicate/archive/delete workflows with soft-delete safety.
- **Admin Auth UX**: Password show/hide, Caps Lock warning, robust error states, password reset, removing any hardcoded password references.

---

## 5. New Features Being Added
- **CAP Cohort 3 Engine**: 6-week trial access codes, automated team placement, Learn $\rightarrow$ Build $\rightarrow$ Launch visual progression, project milestone submissions, and Demo Day review.
- **Mentorship Check-in System**: Structured check-in notes, progress rating, blockers, and learner-visible feedback vs private notes.
- **Public Certificate Verification**: Tamper-proof public lookup route with rich credential display.
- **Academy Marketplace & Commission Ledger**: 15% configurable platform fee, instructor seat plans, marketplace course publishing, and financial ledger.
- **AI Credit Management**: Balance allocation, usage guards, and credit top-up packages.

---

## 6. Database & Migration Log
- `0162_platform_stability_kpi_cohorts_trials.sql` (Sprint 1 & 2):
  - KPI Tracker records table & status updates.
  - Cohorts archive status & progress enhancements.
  - Access codes, redemptions, and trial access tracking.
  - CAP Cohort 3 project teams, milestones, and mentorship check-in logs.
  - Marketplace commissions, instructor seat plans, and course publication states.
  - Public certificate verification enhancements.

---

## 7. API Changes
- `src/lib/api/kpi.js`: KPI tracking, status updating, monthly filtering.
- `src/lib/api/cohorts.js`: Enhanced cohort CRUD, duplicate, archive, soft-delete, and date calculations.
- `src/lib/api/accessCodes.js`: Trial code generation, redemption, expiration check, and access validation.
- `src/lib/api/capProgram.js`: CAP Cohort 3 teams, project submissions, Demo Day scoring, and phase tracking.
- `src/lib/api/mentorship.js`: Mentor assignment, workload inspection, structured check-ins, and learner feedback.
- `src/lib/api/certificates.js`: Template selection, automated issuance, public verification resolution.
- `src/lib/api/marketplace.js`: Academy profile management, course submission/publishing, purchase calculations with 15% commission.
- `src/lib/api/aiCredits.js`: Credit ledger balance, quota deduction, package purchasing.

---

## 8. UI Changes
- Terminology constants & unified labels throughout navigation, cards, and modals.
- Enhanced KPI Tracker card & manager modal.
- Modernized Cohort management cards with progress bars and duration metrics.
- CAP Cohort 3 dedicated dashboard and Learn-Build-Launch timeline view.
- Mentor check-in dialog & feedback stream.
- Public certificate verification screen.
- Academy Marketplace browse, detail, and instructor seat plan cards.
- AI Credit top-up and balance indicator.
