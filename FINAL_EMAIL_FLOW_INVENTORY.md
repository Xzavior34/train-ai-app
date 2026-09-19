# Train AI 2.0 — Final Transactional Email Flow Inventory

| # | Flow | Trigger | Handler / Location | Delivery Provider | Sender | Organization Resolution | CTA Destination | Verification Status |
|---|---|---|---|---|---|---|---|---|
| 1 | **Password Reset** | User clicks "Forgot Password" on login | `reset-password` Edge Function (`supabase/functions/reset-password/index.ts`) | Resend API | `Train AI <onboarding@trainailtd.com>` | `get_user_org_name` RPC (server-side) | `https://trainai.app/auth/callback?type=recovery` | **PASS** (Message ID: `01a0bb02-d0ab-75de-8d1f-969560f7aba4`) |
| 2 | **Learner Invitation** | Admin invites learner from People Screen | `invite-user` Edge Function (`supabase/functions/invite-user/index.ts`) | Resend API | `Train AI <onboarding@trainailtd.com>` | `get_user_org_name` RPC / `organizations` table | `https://trainai.app/accept-invitation?token=...` | **PASS** (Message ID: `01a0bb02-e547-740f-bc1d-d83eb74e970b`) |
| 3 | **Instructor Invitation** | Admin invites instructor from People Screen | `invite-user` Edge Function (`supabase/functions/invite-user/index.ts`) | Resend API | `Train AI <onboarding@trainailtd.com>` | `get_user_org_name` RPC / `organizations` table | `https://trainai.app/accept-invitation?token=...` | **PASS** |
| 4 | **Admin Invitation** | Platform owner / Admin invites new Admin | `invite-user` Edge Function (`supabase/functions/invite-user/index.ts`) | Resend API | `Train AI <onboarding@trainailtd.com>` | `get_user_org_name` RPC / `organizations` table | `https://trainai.app/accept-invitation?token=...` | **PASS** |
| 5 | **Signup Confirmation** | New user signs up or requests email confirmation | `send-signup-confirmation` Edge Function (`supabase/functions/send-signup-confirmation/index.ts`) | Resend API | `Train AI <onboarding@trainailtd.com>` | `get_user_org_name` RPC (server-side) | `https://trainai.app/auth/callback` | **PASS** (Message ID: `01a0bb02-ea58-715e-8bf7-dc587c7000cd`) |
| 6 | **Certificate Issuance Email** | Certificate issued directly or request approved | `send-certificate-email` Edge Function (`supabase/functions/send-certificate-email/index.ts`) | Resend API | `Train AI <onboarding@trainailtd.com>` | `get_user_org_name` RPC / `certificates.organization_id` | `https://trainai.app/profile?tab=certificates` | **PASS** (Message ID: `01a0bb02-f723-725d-b286-37017bead6a5`) |

---

## Technical Summary of Gaps Closed

1. **Signup Confirmation Email**:
   - **Gap Closed**: Previously unverified. Generic Supabase Auth confirmation emails bypassed Resend.
   - **Resolution**: Created & deployed `send-signup-confirmation` Edge Function. Generates secure single-use confirmation token via Supabase Auth Admin API and dispatches HTML email through Resend with dynamic organization branding and production callback URL (`https://trainai.app/auth/callback`). Wired `signUp` in `useAuth.js`.
   - **Evidence**: Resend Message ID `01a0bb02-ea58-715e-8bf7-dc587c7000cd`.

2. **Certificate Email Flow & Idempotency**:
   - **Gap Closed**: Previously unverified. Certificate issuance created in-app notification but lacked transactional email dispatch.
   - **Resolution**: Applied migration `0168_certificate_email_idempotency.sql` adding `email_sent_at timestamptz`. Created & deployed `send-certificate-email` Edge Function. Idempotent check ensures duplicate dispatches are suppressed if `email_sent_at` is set. Wired `reviewCertificate` and `issueCertificateDirectly` in `src/lib/api/platform.js`.
   - **Evidence**: Resend Message ID `01a0bb02-f723-725d-b286-37017bead6a5`. 2nd invocation confirmed `alreadySent: true`, suppressing duplicate email.
