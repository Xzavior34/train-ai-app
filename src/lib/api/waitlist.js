import { supabase, getSupabaseClientForProject, SUPABASE_PROJECTS } from "../supabaseClient.js";
import { startPaystackPayment, startStripePayment, PAYMENT_CONTEXTS } from "./payments.js";

// demo_requests, organization_inquiries, and the get_booked_slots RPC all live
// exclusively on the Organization DB (djikuoucsuhdiyrhsduz), never on the Sara
// Foundation tenant. The exported `supabase` variable reflects the ACTIVE project
// which changes depending on which user is signed in. A Sara Foundation user
// visiting the public booking page would have activeProject = "sara_foundation"
// and every insert would fail with "relation does not exist".
// getDemoClient() always resolves to the Organization DB client specifically.
function getDemoClient() {
  return getSupabaseClientForProject(SUPABASE_PROJECTS.ORGANIZATION_DB) || supabase;
}

// Real backing tables/RPCs confirmed against the shared project's
// integrations/supabase/types.ts (train-ai-ltd-main reference app):
//   waitlist        (id, email, source, created_at) - plain single-tier
//                     opt-in list, matches the pre-existing landing page CTA.
//   waitlist_tiers  (id, email, user_id, tier ['free'|'paid'], source,
//                     payment_status, amount, currency, stripe_session_id,
//                     created_at, updated_at) - the two-tier growth feature
//                     from the reference app's TwoTierWaitlist component.
//   paid_waitlist   (id, email, user_id, amount, currency, payment_method,
//                     payment_status, bank_reference, stripe_session_id,
//                     source, created_at, updated_at) - populated
//                     SERVER-SIDE by the paystack-initialize/stripe-initialize
//                     edge functions themselves whenever context is
//                     "waitlist_premium" (confirmed in
//                     supabase/functions/{paystack,stripe}-initialize/index.ts).
//                     This module never inserts into paid_waitlist directly.
//   safe_paid_waitlist - RLS-safe view over paid_waitlist (id, email,
//                     created_at, payment_status, source; no amount/
//                     bank_reference/user_id) used for status lookups.
//   RPC get_waitlist_count() / get_waitlist_count_by_tier(tier_filter)

export const WAITLIST_TIERS = { FREE: "free", PAID: "paid" };

// Matches the reference app's TwoTierWaitlist pricing exactly
// (PREMIUM_AMOUNT_NGN = 10000 in TwoTierWaitlist.tsx; STRIPE_PRICES in
// TwoTierWaitlistSplit.tsx). Amounts are in the currency's main unit - the
// edge functions convert to subunits (kobo/cents) themselves.
const PAYSTACK_PREMIUM_AMOUNT_NGN = 10000;
const STRIPE_PREMIUM_PRICES = { USD: 7.5, GBP: 6, EUR: 7 };

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Joins the waitlist.
 *   - tier omitted    -> plain `waitlist` table insert (unchanged behaviour
 *     for the existing single-field landing page CTA).
 *   - tier === "free" -> `waitlist_tiers` insert (tier: 'free',
 *     payment_status: 'completed'), for the two-tier growth UI.
 *   - tier === "paid" -> starts a real Paystack (NGN) or Stripe (USD/GBP/EUR)
 *     checkout via the existing payments.js helpers with context
 *     "waitlist_premium". Both helpers redirect the browser to the hosted
 *     checkout page on success - the `paid_waitlist` row is written by the
 *     edge function itself once checkout is initialized, and its
 *     payment_status is updated by paystack-verify/stripe-verify once the
 *     user finishes paying. This function never writes to paid_waitlist.
 */
export async function joinWaitlist({ email, tier, source = "landing_page", currency = "NGN", metadata = {} } = {}) {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    return { success: false, error: "Please enter a valid email address." };
  }

  if (tier === WAITLIST_TIERS.PAID) {
    try {
      if (currency === "NGN") {
        await startPaystackPayment({
          email: normalizedEmail,
          amount: PAYSTACK_PREMIUM_AMOUNT_NGN,
          currency: "NGN",
          context: PAYMENT_CONTEXTS.WAITLIST_PREMIUM,
          metadata: { ...metadata, source },
        });
      } else {
        const amount = STRIPE_PREMIUM_PRICES[currency] || STRIPE_PREMIUM_PRICES.USD;
        await startStripePayment({
          email: normalizedEmail,
          amount,
          currency: STRIPE_PREMIUM_PRICES[currency] ? currency : "USD",
          context: PAYMENT_CONTEXTS.WAITLIST_PREMIUM,
          description: "Train AI: Premium Waitlist",
          metadata: { ...metadata, source },
        });
      }
      // Both helpers redirect the browser away to the hosted checkout page
      // on success, so control doesn't normally return here at all.
      return { success: true, redirecting: true };
    } catch (error) {
      return { success: false, error: error?.message || "Could not start premium waitlist checkout." };
    }
  }

  if (!supabase) return { success: true }; // demo mode. Nothing to persist

  try {
    if (tier === WAITLIST_TIERS.FREE) {
      const { error } = await supabase.from("waitlist_tiers").insert({
        email: normalizedEmail,
        tier: "free",
        source,
        payment_status: "completed",
      });
      if (error) throw error;
      return { success: true };
    }

    const { error } = await supabase.from("waitlist").insert({ email: normalizedEmail, source });
    if (error) throw error;
    return { success: true };
  } catch (error) {
    if (error?.code === "23505" || error?.message?.includes("duplicate key")) {
      return { success: false, error: "This email is already on the waitlist." };
    }
    console.warn("Waitlist join warning:", error);
    return { success: false, error: "Could not join the waitlist. Please try again." };
  }
}

/**
 * Looks up whether an email/user is already on the waitlist, checking the
 * paid tier first (most "advanced" status), then the tiered table, then the
 * plain table. Safe to call with just an email (anonymous visitor) or a
 * userId (signed-in learner).
 */
export async function fetchMyWaitlistStatus({ email, userId } = {}) {
  const normalizedEmail = normalizeEmail(email);
  const empty = { onWaitlist: false, tier: null, paymentStatus: null, source: null, joinedAt: null };
  if (!supabase || (!normalizedEmail && !userId)) return empty;

  try {
    if (normalizedEmail) {
      const { data: paidRow } = await supabase
        .from("safe_paid_waitlist")
        .select("*")
        .eq("email", normalizedEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (paidRow) {
        return {
          onWaitlist: true,
          tier: "paid",
          paymentStatus: paidRow.payment_status || "pending",
          source: paidRow.source || null,
          joinedAt: paidRow.created_at || null,
        };
      }
    }

    // waitlist_tiers has no created_at column, so ordering on it made
    // PostgREST reject the query and this check always reported "not on the
    // waitlist" even for someone who had just joined. `id` is a uuid so it
    // gives no chronological ordering - the limit(1) below simply takes the
    // single row for this email/user, which is what the unique key gives us
    // anyway.
    let tierQuery = supabase.from("waitlist_tiers").select("*").limit(1);
    tierQuery = userId ? tierQuery.eq("user_id", userId) : tierQuery.eq("email", normalizedEmail);
    const { data: tierRow } = await tierQuery.maybeSingle();
    if (tierRow) {
      return {
        onWaitlist: true,
        tier: tierRow.tier || "free",
        paymentStatus: tierRow.payment_status || null,
        source: tierRow.source || null,
        joinedAt: tierRow.created_at || null,
      };
    }

    if (normalizedEmail) {
      const { data: plainRow } = await supabase
        .from("waitlist")
        .select("*")
        .eq("email", normalizedEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (plainRow) {
        return { onWaitlist: true, tier: null, paymentStatus: null, source: plainRow.source || null, joinedAt: plainRow.created_at || null };
      }
    }

    return empty;
  } catch (error) {
    console.warn("Waitlist status fetch warning:", error);
    return empty;
  }
}

/**
 * B2B lead capture - "Book a Demo" on the landing page. Real `demo_requests`
 * table (see supabase/migrations/0101_demo_requests.sql), separate from the
 * older individual-consumer `waitlist`/`paid_waitlist` tables above: this is
 * the actual front door for the B2B positioning (organisations booking a
 * demo/pilot), not an individual paying to "skip the line".
 */
// Campaign attribution - PRD Platform Owner Analytics, confirmed unbuilt.
// Reads standard utm_source/utm_medium/utm_campaign query params on first
// landing-page visit, persists them in sessionStorage so they survive
// through to whichever form (Book a Demo or Organisation Inquiry) is
// eventually submitted, potentially several page interactions later -
// not read fresh at submit time, since the URL's query string is usually
// already gone by then.
const UTM_STORAGE_KEY = "trainai_utm_attribution_v1";

export function captureAttributionFromURL() {
  try {
    const params = new URLSearchParams(window.location.search);
    const utm = {
      utm_source: params.get("utm_source") || null,
      utm_medium: params.get("utm_medium") || null,
      utm_campaign: params.get("utm_campaign") || null,
    };
    if (utm.utm_source || utm.utm_medium || utm.utm_campaign) {
      sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
    }
  } catch {
    // best-effort only - never blocks the page from loading
  }
}

function readStoredAttribution() {
  try {
    const raw = sessionStorage.getItem(UTM_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function submitDemoRequest({
  fullName,
  workEmail,
  companyName,
  teamSize,
  message,
  source = "landing_page",
  status = "scheduled",
  scheduledDate = null,
  scheduledTime = null,
  orgType = null,
  timezone = null,
} = {}) {
  const normalizedEmail = normalizeEmail(workEmail);
  if (!fullName?.trim() || !isValidEmail(normalizedEmail) || !companyName?.trim()) {
    return { success: false, error: "Please fill in your name, work email, and company." };
  }

  // Graceful demo-mode: if supabase client is not configured just succeed silently
  if (!supabase) return { success: true };

  try {
    const attribution = readStoredAttribution();

    const insertPayload = {
      full_name: fullName.trim(),
      work_email: normalizedEmail,
      company_name: companyName.trim(),
      team_size: teamSize || null,
      message: message?.trim() || null,
      source,
      status: status || "scheduled",
      ...attribution,
    };

    // Only add scheduling fields if columns exist (graceful - no schema error if migration hasn't run yet)
    if (scheduledDate) insertPayload.scheduled_date = scheduledDate;
    if (scheduledTime) insertPayload.scheduled_time = scheduledTime;
    if (orgType) insertPayload.org_type = orgType;
    if (timezone) insertPayload.timezone = timezone;

    const db = getDemoClient();
    const { error } = await db.from("demo_requests").insert(insertPayload);

    if (error) {
      // If the error is about unknown columns, fall back to inserting without scheduling columns
      if (error.code === "42703" || (error.message?.includes("column") && error.message?.includes("does not exist"))) {
        const fallbackPayload = {
          full_name: fullName.trim(),
          work_email: normalizedEmail,
          company_name: companyName.trim(),
          team_size: teamSize || null,
          message: message?.trim() || null,
          source,
          status: status || "scheduled",
          ...attribution,
        };
        const { error: fallbackError } = await db.from("demo_requests").insert(fallbackPayload);
        if (fallbackError) throw fallbackError;
      } else {
        throw error;
      }
    }

    // Dual-write into organization_inquiries to ensure follow-up queue captures it
    await db.from("organization_inquiries").insert({
      full_name: fullName.trim(),
      work_email: normalizedEmail,
      company_name: companyName.trim(),
      inquiry_type: "partnership",
      message: `[Notification target: info@trainailtd.com & info@sarafoundationafrica.com]\n${message?.trim() || ""}`,
      source,
      status: "new",
      ...attribution,
    }).catch(() => {});

    // Dispatch email notifications to team inboxes for immediate follow-up
    const notificationSubject = `New Demo / Appointment Request: ${fullName.trim()} - ${companyName.trim()}`;
    const notificationHtml = `
      <div style="font-family: sans-serif; line-height: 1.5; color: #0F172A;">
        <h2 style="color: #2563EB;">New Train AI Appointment &amp; Demo Scheduled</h2>
        <p>A new institutional demo request has been submitted for follow-up:</p>
        <table style="width: 100%; max-width: 560px; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #E2E8F0; font-weight: bold; width: 140px;">Name</td><td style="padding: 8px; border-bottom: 1px solid #E2E8F0;">${fullName.trim()}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #E2E8F0; font-weight: bold;">Work Email</td><td style="padding: 8px; border-bottom: 1px solid #E2E8F0;"><a href="mailto:${normalizedEmail}">${normalizedEmail}</a></td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #E2E8F0; font-weight: bold;">Organization</td><td style="padding: 8px; border-bottom: 1px solid #E2E8F0;">${companyName.trim()}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #E2E8F0; font-weight: bold;">Team Size</td><td style="padding: 8px; border-bottom: 1px solid #E2E8F0;">${teamSize || "Not specified"}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #E2E8F0; font-weight: bold;">Scheduled</td><td style="padding: 8px; border-bottom: 1px solid #E2E8F0;">${scheduledDate || "N/A"} at ${scheduledTime || "N/A"} (${timezone || "UTC"})</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #E2E8F0; font-weight: bold;">Source</td><td style="padding: 8px; border-bottom: 1px solid #E2E8F0;">${source}</td></tr>
        </table>
        <h3 style="font-size: 14px; margin-bottom: 6px;">Meeting &amp; Schedule Details:</h3>
        <pre style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 14px; border-radius: 8px; font-size: 13px; white-space: pre-wrap; word-wrap: break-word;">${message || ""}</pre>
        <p style="font-size: 12px; color: #64748B; margin-top: 18px;">
          Follow-up notifications routed to: <strong>info@trainailtd.com</strong> and <strong>info@sarafoundationafrica.com</strong>
        </p>
      </div>
    `;

    // Trigger dispatch asynchronously without blocking the user response
    Promise.allSettled([
      db.functions.invoke("advanced-broadcast-email", {
        body: {
          action: "send",
          recipient_group: "specific_email",
          specific_email: "info@trainailtd.com",
          subject: notificationSubject,
          html_content: notificationHtml,
        }
      }),
      db.functions.invoke("advanced-broadcast-email", {
        body: {
          action: "send",
          recipient_group: "specific_email",
          specific_email: "info@sarafoundationafrica.com",
          subject: notificationSubject,
          html_content: notificationHtml,
        }
      })
    ]).catch((err) => {
      console.warn("Notification dispatch warning:", err);
    });

    return { success: true };
  } catch (error) {
    console.warn("Demo request submit warning:", error);
    return { success: false, error: "Could not submit your request. Please try again." };
  }
}

/**
 * Fetches already-booked demo slots for a given date range.
 * Returns a Set of strings like "2026-10-01|10:00 AM" for O(1) lookup.
 * Uses the get_booked_slots RPC (security definer, callable by anon).
 * Falls back to an empty set if the RPC does not exist yet (migration not run).
 */
export async function fetchBookedSlots({ fromDate, toDate } = {}) {
  const bookedSet = new Set();
  const db = getDemoClient();
  if (!db) return bookedSet;

  try {
    const from = fromDate || new Date().toISOString().split("T")[0];
    const to = toDate || new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const { data, error } = await db.rpc("get_booked_slots", {
      p_from_date: from,
      p_to_date: to,
    });

    if (error) {
      // Migration may not have run yet - silently return empty set
      console.warn("get_booked_slots RPC not available:", error.message);
      return bookedSet;
    }

    if (Array.isArray(data)) {
      for (const row of data) {
        if (row.scheduled_date && row.scheduled_time) {
          bookedSet.add(`${row.scheduled_date}|${row.scheduled_time}`);
        }
      }
    }
  } catch (err) {
    console.warn("fetchBookedSlots warning:", err);
  }

  return bookedSet;
}

// Organisation Inquiry - secondary B2B contact path, distinct from Book a
// Demo (submitDemoRequest above). For organisations not ready for a demo
// yet: procurement questions, partnership enquiries, custom requirements.
// Backing table: organization_inquiries (0103_organization_inquiries.sql).
export async function submitOrganizationInquiry({ fullName, workEmail, companyName, inquiryType = "other", message, source = "landing_page" } = {}) {
  const normalizedEmail = normalizeEmail(workEmail);
  if (!fullName?.trim() || !isValidEmail(normalizedEmail) || !companyName?.trim()) {
    return { success: false, error: "Please fill in your name, work email, and company." };
  }
  if (!supabase) return { success: true }; // demo mode. Nothing to persist

  try {
    const attribution = readStoredAttribution();
    const { error } = await supabase.from("organization_inquiries").insert({
      full_name: fullName.trim(),
      work_email: normalizedEmail,
      company_name: companyName.trim(),
      inquiry_type: inquiryType || "other",
      message: message?.trim() || null,
      source,
      ...attribution,
    });
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.warn("Organization inquiry submit warning:", error);
    return { success: false, error: "Could not submit your inquiry. Please try again." };
  }
}

/** Public headline count for marketing copy ("Join 1,204 others…"). */
export async function fetchWaitlistCount() {
  if (!supabase) return 0;
  try {
    const { data, error } = await supabase.rpc("get_waitlist_count");
    if (error) return 0;
    return data || 0;
  } catch {
    return 0;
  }
}
