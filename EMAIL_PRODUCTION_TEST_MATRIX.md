# Train AI 2.0 — Email Production Test Matrix

## 1. Test Matrix Overview

This matrix documents the end-to-end verification of transactional email flows, Resend API dispatches, multi-tenant organization branding, redirect URLs, and security controls.

---

## 2. Test Execution Matrix

| Flow | Resend Delivery | Org Branding Resolution | Link Verification | Auth Integration | Result |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Forgot Password (Sara Foundation)** | PASS (ID: `01a0bae1-edd1-7528-a3a0-c2a7e65fcf94`) | PASS (`Sara Foundation Africa`) | PASS (`https://trainai.app/auth/callback?type=recovery`) | PASS | **PASS** |
| **Password Recovery (Train AI Platform)** | PASS | PASS (`Train AI Platform`) | PASS (`https://trainai.app/auth/callback?type=recovery`) | PASS | **PASS** |
| **Multi-Tenant QA Org A (`EMAIL_QA_ORG_A`)** | PASS | PASS (`EMAIL_QA_ORG_A`) | PASS (`https://trainai.app/auth/callback?type=recovery`) | PASS | **PASS** |
| **Multi-Tenant QA Org B (`EMAIL_QA_ORG_B`)** | PASS | PASS (`EMAIL_QA_ORG_B`) | PASS (`https://trainai.app/auth/callback?type=recovery`) | PASS | **PASS** |
| **Admin Invitation (`invite-user`)** | PASS | PASS (Dynamic Org Name) | PASS (`https://trainai.app/accept-invitation?token=...`) | PASS | **PASS** |
| **Learner Invitation (`invite-user`)** | PASS | PASS (Dynamic Org Name) | PASS (`https://trainai.app/accept-invitation?token=...`) | PASS | **PASS** |
| **Invitation Acceptance (`accept-invitation`)** | N/A (Web API) | PASS (Dynamic Org Join) | PASS (`/accept-invitation`) | PASS | **PASS** |
| **AI Credits Grant (`grant-ai-credits-from-payment`)** | PASS | PASS | N/A | PASS | **PASS** |

---

## 3. Key Verification Milestones
1. **Dynamic Org Name Resolution**:
   - `info@sarafoundationafrica.com` → `Sara Foundation Africa`
   - `trainailtd@gmail.com` → `Train AI Platform`
   - `qa_user_a@emailqaa.com` → `EMAIL_QA_ORG_A`
   - `qa_user_b@emailqab.com` → `EMAIL_QA_ORG_B`

2. **Redirect Link Integrity**:
   - Every generated recovery link resolves to `https://trainai.app/auth/callback?type=recovery` (or client origin when testing locally).
   - Supabase Auth Site URL set to `https://trainai.app` with proper `uri_allow_list`.

3. **Resend Delivery Confirmation**:
   - Dispatched real emails via `https://api.resend.com/emails`.
   - Verified HTTP 200 response with Resend message ID `01a0bae1-edd1-7528-a3a0-c2a7e65fcf94`.

4. **Security & Secret Sweeps**:
   - `RESEND_API_KEY` remains server-only (Edge Function secrets).
   - Zero secrets or token leaks in client code.
   - QA test data cleanly removed (`EMAIL_QA_ORG_A = 0`, `EMAIL_QA_ORG_B = 0`).
