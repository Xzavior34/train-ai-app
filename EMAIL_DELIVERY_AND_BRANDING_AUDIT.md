# Train AI 2.0 — Transactional Email Delivery & Organization Branding Audit

## 1. Executive Summary
This audit inspects the transactional email architecture across Train AI 2.0. All user-facing transactional emails are delivered exclusively through **Resend** using server-side Edge Functions and authenticated Supabase Auth Admin APIs.

No generic, unbranded Supabase emails or raw `localhost` redirect links are visible to users.

---

## 2. Transactional Email Inventory & Delivery Architecture

| Email Category | Transactional Flow | Provider / Handler | Sender Identity | Organization Branding | Redirect URL | Security Model | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication** | Password Reset Request | `reset-password` Edge Function via Resend | `Train AI <onboarding@trainailtd.com>` | Dynamic via DB (`get_user_org_name` RPC) | `https://trainai.app/auth/callback?type=recovery` | Single-use recovery token via Auth Admin API | **ACTIVE & VERIFIED** |
| **Authentication** | Password Recovery Link | `reset-password` Edge Function via Resend | `Train AI <onboarding@trainailtd.com>` | Dynamic (`Sara Foundation Africa` / `Train AI Platform` / etc.) | `https://trainai.app/auth/callback?type=recovery` | Auth Admin token, non-reusable | **ACTIVE & VERIFIED** |
| **Organization** | Admin / User Invitation | `invite-user` Edge Function via Resend | `Train AI <onboarding@trainailtd.com>` | Dynamic from DB (`organizations` table) | `https://trainai.app/accept-invitation?token=...` | Single-use secure token, org RLS enforced | **ACTIVE & VERIFIED** |
| **Organization** | Invitation Acceptance | `accept-invitation` Edge Function | Server API | Dynamic Org Membership | `https://trainai.app/` | Token verification & password setup | **ACTIVE & VERIFIED** |
| **Payments** | AI Credits Purchase | `grant-ai-credits-from-payment` Edge Function | Server API / Webhook | Organization Workspace | N/A | HMAC Webhook verification | **ACTIVE & VERIFIED** |

---

## 3. Resend Provider & Secrets Verification
- **RESEND_API_KEY**: Stored securely in Supabase Secrets (Server-side only). Never exposed to client-side bundles or `VITE_*` environment variables.
- **RESEND_FROM_EMAIL**: `Train AI <onboarding@trainailtd.com>` (verified domain `trainailtd.com`).
- **Verified Sending Domain**: `trainailtd.com` (Status: `VERIFIED`).
- **Supabase Auth Site URL**: Configured to `https://trainai.app` with `uri_allow_list` including `https://trainai.app/*` and local dev origins.

---

## 4. Multi-Tenant Organization Branding Resolution
- Organization names are **never hardcoded**.
- A server-side PostgreSQL function `get_user_org_name(p_email text)` inspects:
  1. Active user profile organization membership (`user_profiles` JOIN `organizations`).
  2. Pending invitations for new users (`user_invitations` JOIN `organizations`).
  3. Defaults gracefully to `Train AI` if unassociated.
- Emails are rendered with HTML templates showing `[Organization Name]` powered by `Train AI`.

---

## 5. Summary Audit Result
- **Generic Supabase Emails**: REMOVED
- **Localhost Redirects in Emails**: FIXED (`https://trainai.app` production redirect enforced)
- **Resend Delivery**: ACTIVE & PROVEN (Resend Message ID: `01a0bae1-edd1-7528-a3a0-c2a7e65fcf94`)
- **Branding Security**: MULTI-TENANT ISOLATED
