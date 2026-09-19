# Train AI 2.0 — Payment & Payout Workflow Requirements

This document establishes the authoritative specifications, business logic, transaction lifecycles, and policy frameworks for financial flows across Train AI 2.0.

---

## 1. Actor Roles & Transaction Typology

| Transaction Type | Primary Payer | Recipient / Destination | Gateway / Rail | Settlement Method | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **B2B Organization SaaS Subscription** | Organization Admin / Enterprise Buyer | Train AI Ltd (Platform Escrow/Treasury) | Stripe (Card, SEPA, ACH) / Paystack | Direct Charge / Recurring Invoice | Seat licensing, enterprise platform access, white-label features |
| **B2C Course / Cohort Enrollment** | Individual Learner / Student | Train AI Escrow Account (held for instructor) | Paystack (NGN/GHS/KES) / Stripe (USD/GBP/EUR) | Checkout Session / Dynamic Webhook | Direct payment for paid course/cohort enrollment |
| **AI Coach Credits Top-Up** | Learner or Org Admin | Train AI Ltd (Platform Treasury) | In-app credit checkout (Paystack / Stripe) | Immediate balance increment | Top-up tokens for AI Tutor, prompt executions, code reviews |
| **Instructor Revenue Payout** | Train AI Escrow / Org Treasury | Verified Instructor / Mentor Bank Account | Paystack Transfer API / Stripe Connect Custom | Batch or On-Demand Payout | Instructor earnings from course sales or cohort delivery |
| **Org-to-Instructor Stipend** | Organization Admin | Instructor / Academy Staff | Internal ledger allocation or Paystack Transfer | Org-level budget deduction | Sponsored program instructor compensation |

---

## 2. Currency & Multi-Region Support Matrix

| Base Currency | Primary Target Markets | Primary Gateway | Fallback Gateway | Minimum Transaction Unit | Exchange Rate Authority |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **NGN (₦)** | Nigeria, West Africa | Paystack | Stripe | ₦500.00 | Realtime Paystack Currency Matrix / Central Bank Daily Median |
| **USD ($)** | United States, Global International | Stripe | Paystack (International) | $5.00 | Platform Standard Fixed Peg / Stripe Exchange FX |
| **GBP (£)** | United Kingdom, Europe | Stripe | Paystack | £5.00 | Stripe Automated FX Conversion |
| **GHS (GH₵)** | Ghana, West Africa | Paystack | Stripe | GH₵20.00 | Paystack Live Multi-Currency Settlement |
| **KES (KSh)** | Kenya, East Africa | Paystack (M-Pesa / Card) | Stripe | KSh 500.00 | Paystack Live Multi-Currency Settlement |

### Currency Selection & Display Rules:
1. **Geo-IP Auto-Detection:** Default currency displays in the user's local operating currency (NGN for Nigeria, GBP for UK, USD for rest of world).
2. **User Explicit Override:** Persistent currency picker on pricing headers and checkout screens (`useCurrency` hook / localStorage state).
3. **Database Normalization:** All amounts in database ledgers (`payments`, `payouts`, `enrollments`) store **both** `amount_cents`/`amount_subunits` integer and ISO-4217 `currency` string (e.g., `amount: 50000, currency: 'NGN'` for ₦500.00).

---

## 3. Escrow & Revenue Distribution Lifecycle

```
[ Learner / Org Payment ] 
           │
           ▼
[ Payment Gateway Webhook ] ──▶ [ Train AI Escrow Account ]
                                            │
           ┌────────────────────────────────┴────────────────────────────────┐
           ▼                                                                 ▼
[ Platform Commission (10-20%) ]                                 [ Instructor Net Share (80-90%) ]
           │                                                                 │
           ▼                                                                 ▼
[ Train AI Operating Treasury ]                                 [ Pending Balance (14-Day Hold) ]
                                                                             │
                                                                             ▼ (Course completion / Hold expiry)
                                                                 [ Available Balance for Withdrawal ]
                                                                             │
                                                                             ▼
                                                                [ Instructor Payout Request ]
                                                                             │
                                                                             ▼ (Admin Manual/Auto Audit)
                                                                 [ Disbursed via Bank Transfer ]
```

### Escrow Hold Rules:
- **Default Hold Period:** 14 calendar days from enrollment date to protect against student dissatisfaction and chargeback claims.
- **Immediate Release Threshold:** For verified Top-Tier Instructors (over 100 successful completions, <1% refund rate), hold period reduces to 48 hours post-session.
- **Chargeback / Dispute Hold:** If a student flags a dispute before the 14-day window closes, funds are frozen in escrow until resolved.

---

## 4. Instructor Payout & Withdrawal Approval Workflow

### Prerequisites for Withdrawal:
1. **KYC Verification:** Completed national identity / corporate registration on file (`instructor_profiles.kyc_status = 'approved'`).
2. **Verified Bank Details / Stripe Connect Account:**
   - **Nigeria/Ghana/Kenya:** Validated account number, account name, and bank code via Paystack Bank Resolve API (`paystack.verification.resolveAccount`).
   - **US/UK/EU/Global:** Active Stripe Connect Custom/Express account onboarding with status `charges_enabled = true` and `payouts_enabled = true`.
3. **Minimum Withdrawal Threshold:**
   - NGN: ₦10,000.00
   - USD: $50.00
   - GBP: £40.00

### Approval Mechanics:
- **Level 1 (Automated Verification):** Payouts under $250 / ₦200,000 with 0 active disputes and clean audit history process automatically via hourly cron edge function.
- **Level 2 (Admin Review Required):**
  - First-time payout for any instructor.
  - Payouts exceeding $250 / ₦200,000.
  - Accounts with active dispute flags or elevated refund rates (>5%).
- **State Machine in Database (`payouts` table):**
  `pending` ──▶ `under_review` ──▶ `approved` ──▶ `processing` ──▶ `completed` (or `rejected` / `failed`).

---

## 5. Refund Policy & Dispute Resolution Rules

1. **Self-Service Grace Window:**
   - Learners may request an instant automated refund within **48 hours of purchase** if **less than 15% of course content** has been accessed.
   - Cohort live bootcamps: Full refund allowed up to **72 hours before the first scheduled live class**.
2. **Ineligible Refund Scenarios:**
   - Course certificate already generated or downloaded.
   - More than 25% course progress recorded in `lesson_completions`.
   - Cohort bootcamp already in session past Week 1.
   - AI credits spent/consumed.
3. **Refund Execution Path:**
   - Refunds are routed through original payment rail (Paystack Refund API or Stripe Refunds API).
   - Corresponding enrollment is revoked (`enrollments.status = 'refunded'`).
   - Escrow allocation is automatically debited from instructor's pending balance.
   - Platform fee is netted per payment processor rules.

---

## 6. Fee Architecture & Platform Margins

| Sales Channel | Platform Fee (Train AI) | Instructor Net | Processing Fee (Gateway) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Marketplace Organic** | 20% | 80% | Included in gross or deducted at source | Learner discovered course on Train AI marketplace |
| **Instructor Direct Referral** | 5% | 95% | Deducted at source | Instructor used custom affiliate referral tag |
| **Enterprise / Org Sponsored** | 0% - 10% (Tiered) | 90% - 100% | B2B Invoice terms | Organization pays contracted enterprise seat/license rate |
| **AI Credit Resale** | 100% Platform | 0% | Stripe / Paystack | Train AI native token consumption |

---

## 7. Compliance, Tax, and Invoicing

1. **Automated Receipts & Invoices:**
   - Every completed transaction generates an immutable PDF receipt stored in Supabase Storage bucket `invoices` with a cryptographically signed public verify URL.
   - Invoices include buyer name, organization registration, VAT/Tax identification number (if entered), payment method reference, and itemized subtotal.
2. **Tax Withholding / WHT / VAT:**
   - Nigeria: 7.5% VAT calculation where applicable.
   - UK / EU: VAT reverse-charge compliance for verified VAT IDs.
   - US: 1099-K reporting threshold monitoring for US-resident instructors via Stripe Connect.
3. **Audit Trail & Immutability:**
   - All transactions write to `payment_events` / `audit_logs` with webhook payload snapshots, idempotency keys, and IP addresses.
