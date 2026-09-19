# Train AI 2.0 — Final Production Email Flow Inventory

## 1. Production Email Flow Inventory

| Email Type | Trigger | Frontend Entry Point | Backend / Edge Function | Delivery Provider | Resend Call | Sender Identity | Recipient Resolution | Organization Resolution | Template | CTA URL | Fallback Behavior | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Password Reset** | User requests password reset on Auth screen | `sendPasswordReset()` in `src/hooks/useAuth.js` | `reset-password` Edge Function | Resend | `POST https://api.resend.com/emails` | `Train AI <onboarding@trainailtd.com>` | Target user email | Server-side RPC `get_user_org_name(p_email)` | Responsive HTML template with `[Organization Name]` powered by `Train AI` | `https://trainai.app/auth/callback?type=recovery` (single-use recovery token) | Returns explicit error to UI; generic Supabase fallback eliminated | **PASS & VERIFIED** (Resend ID: `01a0bae8-b05a-70a7-a911-b85bff475552`) |
| **Learner Invitation** | Admin invites a learner on PeopleScreen | `createInvitation()` in `src/lib/api/platform.js` | `invite-user` Edge Function | Resend | `POST https://api.resend.com/emails` | `Train AI <onboarding@trainailtd.com>` | Invitee email | Server-side lookup from `organizations` table | Responsive HTML email: `You've been invited to join [Org] as learner` | `https://trainai.app/accept-invitation?token=...` | Invitation token row created; token-based link can be shared manually | **PASS & VERIFIED** (Resend ID: `01a0bae8-7d9f-733c-9489-dc957dd1f1a9`) |
| **Instructor Invitation** | Admin invites an instructor on PeopleScreen | `createInvitation()` in `src/lib/api/platform.js` | `invite-user` Edge Function | Resend | `POST https://api.resend.com/emails` | `Train AI <onboarding@trainailtd.com>` | Invitee email | Server-side lookup from `organizations` table | Responsive HTML email: `You've been invited to join [Org] as instructor` | `https://trainai.app/accept-invitation?token=...` | Invitation token row created | **PASS & VERIFIED** |
| **Admin Invitation** | Admin invites another admin on PeopleScreen | `createInvitation()` in `src/lib/api/platform.js` | `invite-user` Edge Function | Resend | `POST https://api.resend.com/emails` | `Train AI <onboarding@trainailtd.com>` | Invitee email | Server-side lookup from `organizations` table | Responsive HTML email: `You've been invited to join [Org] as admin` | `https://trainai.app/accept-invitation?token=...` | Invitation token row created | **PASS & VERIFIED** |
| **Invitation Acceptance** | Invitee opens invite link and sets password | `AcceptInvitationScreen.jsx` | `accept-invitation` Edge Function & RPC `accept_user_invitation` | Web API | N/A | Server API | Account email | Enforced server-side via RPC | N/A (Screen flow) | `https://trainai.app/` | Returns clear error if token expired/invalid | **PASS & VERIFIED** |
| **Signup Confirmation** | User fills signup form | `signUp()` in `src/hooks/useAuth.js` | Supabase Auth API (`signUp`) | Supabase Auth | Native Supabase Auth Mailer | Supabase System Sender | Registrant email | N/A | Default Supabase Auth template | `https://trainai.app/auth/callback` | Default Auth mailer | **UNVERIFIED** (SMTP host is null, not routed through Resend) |
| **Certificate Notification** | Certificate issued upon course completion | Course completion trigger | `issue_certificate` RPC & `notifications` table | In-app Notification | N/A | System | Student user ID | DB Organization ID | In-app card UI | N/A | In-app notification feed | **UNVERIFIED** (In-app only; no transactional email flow exists) |

---

## 2. Resend Sender & Configuration Summary
- **Resend Sending Domain**: `trainailtd.com`
- **Domain Status**: `VERIFIED`
- **Sender Address**: `Train AI <onboarding@trainailtd.com>`
- **Supabase Auth Site URL**: `https://trainai.app` (configured with `uri_allow_list`)
- **API Key Security**: Resend API key stored exclusively in server-side Supabase Secrets. Zero client-side leakage.
