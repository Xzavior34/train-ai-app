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

  try {
    const attribution = readStoredAttribution();
    const db = getDemoClient();
    if (!db) {
      return { success: false, error: "Booking is temporarily unavailable. Please try again or email info@trainailtd.com." };
    }

    const { data, error } = await db.functions.invoke("book-demo-appointment", {
      body: {
        fullName: fullName.trim(),
        workEmail: normalizedEmail,
        organizationName: companyName.trim(),
        teamSize: teamSize || "Not specified",
        agendaNotes: message?.trim() || "",
        source,
        scheduledDate,
        scheduledTime,
        orgType: orgType || "Other",
        timezone: timezone || "UTC",
        ...attribution,
      },
    });
    if (error || !data?.success) {
      let remoteMessage = data?.error;
      if (!remoteMessage && error?.context instanceof Response) {
        try {
          const payload = await error.context.clone().json();
          remoteMessage = payload?.error;
        } catch {}
      }
      console.warn("Demo appointment creation failed:", error || data);
      return {
        success: false,
        code: data?.code || null,
        error: remoteMessage || "We could not create the calendar invitation. No appointment was recorded. Please try again or email info@trainailtd.com.",
      };
    }

    return data;
  } catch (error) {
    console.warn("submitDemoRequest caught error:", error);
    return { success: false, error: "We could not save your booking. Please try again or email info@trainailtd.com." };
  }
}

/**
 * Fetches already-booked demo slots for a given date range.
 * Returns a Set of strings like "2026-10-01|10:00 AM" for O(1) lookup.
 */
export async function fetchBookedSlots({ fromDate, toDate } = {}) {
  const bookedSet = new Set();
  const db = getDemoClient();

  // Local bookings are only a development fallback. In production, stale
  // browser records must never override the shared appointment calendar.
  if (!db) {
    try {
      const localBooked = JSON.parse(localStorage.getItem("trainai_booked_slots_v1") || "[]");
      for (const b of localBooked) {
        if (b.scheduled_date && b.scheduled_time) {
          bookedSet.add(`${b.scheduled_date}|${b.scheduled_time}`);
        }
      }
    } catch {}
    return bookedSet;
  }

  const from = fromDate || new Date().toISOString().split("T")[0];
  const to = toDate || new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // 2. Try RPC get_booked_slots
  let rpcFailure = null;
  try {
    const { data: rpcData, error: rpcError } = await db.rpc("get_booked_slots", {
      p_from_date: from,
      p_to_date: to,
    });
    if (!rpcError && Array.isArray(rpcData)) {
      for (const row of rpcData) {
        if (row.scheduled_date && row.scheduled_time) {
          bookedSet.add(`${row.scheduled_date}|${row.scheduled_time}`);
        }
      }
      return bookedSet;
    }
    rpcFailure = rpcError || new Error("Availability response was invalid.");
  } catch (error) {
    rpcFailure = error;
  }

  // 3. Fallback: Query demo_requests table directly
  try {
    const { data: rows, error } = await db
      .from("demo_requests")
      .select("scheduled_date, scheduled_time, status")
      .gte("scheduled_date", from)
      .lte("scheduled_date", to)
      .not("status", "in", "('cancelled','closed')");

    if (error) throw error;

    if (Array.isArray(rows)) {
      for (const row of rows) {
        if (row.scheduled_date && row.scheduled_time) {
          bookedSet.add(`${row.scheduled_date}|${row.scheduled_time}`);
        }
      }
    }
    return bookedSet;
  } catch (error) {
    console.warn("fetchBookedSlots failed:", rpcFailure, error);
    throw new Error("Live appointment availability could not be loaded.");
  }
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
