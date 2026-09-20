import { supabase } from "../supabaseClient.js";
import { startPaystackPayment, startStripePayment, PAYMENT_CONTEXTS } from "./payments.js";

// ============================================================================
// Revenue & Commission API
// ============================================================================

// --- Org Revenue (Admin) ---

export async function fetchOrgRevenueSummary(orgId) {
  if (!supabase || !orgId) return { total_gross: 0, total_platform_fee: 0, total_net: 0, transaction_count: 0 };
  try {
    const { data, error } = await supabase.rpc("get_org_revenue_summary", { p_org_id: orgId });
    if (error) throw error;
    return data || { total_gross: 0, total_platform_fee: 0, total_net: 0, transaction_count: 0 };
  } catch (e) {
    console.warn("fetchOrgRevenueSummary warning:", e);
    return { total_gross: 0, total_platform_fee: 0, total_net: 0, transaction_count: 0 };
  }
}

export async function fetchOrgCourseRevenue(orgId) {
  if (!supabase || !orgId) return [];
  try {
    const { data, error } = await supabase.rpc("get_org_course_revenue", { p_org_id: orgId });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn("fetchOrgCourseRevenue warning:", e);
    return [];
  }
}

// --- Instructor Earnings (Mentor) ---
// Note: We join academy_transactions through the courses the instructor owns.
// The DB doesn't store course_id on academy_transactions directly, so we
// derive it from courses where instructor_id = mentor's user_id.

export async function fetchInstructorEarningsSummary(mentorId) {
  if (!supabase || !mentorId) return { total_gross: 0, total_platform_fee: 0, total_net: 0, enrollment_count: 0 };
  try {
    // Get mentor's user_id from mentors table
    const { data: mentor } = await supabase.from("mentors").select("user_id").eq("id", mentorId).maybeSingle();
    if (!mentor?.user_id) return { total_gross: 0, total_platform_fee: 0, total_net: 0, enrollment_count: 0 };

    // Get courses this instructor owns
    const { data: courses } = await supabase.from("courses").select("id, organization_id").eq("instructor_id", mentor.user_id);
    if (!courses?.length) return { total_gross: 0, total_platform_fee: 0, total_net: 0, enrollment_count: 0 };

    const orgId = courses[0].organization_id;
    // Get academy_transactions for enrollments in their courses
    const { data: txns } = await supabase
      .from("academy_transactions")
      .select("gross_amount_minor, platform_fee_minor, academy_net_minor")
      .eq("organization_id", orgId);

    const rows = txns || [];
    return {
      total_gross: rows.reduce((s, r) => s + (r.gross_amount_minor || 0), 0) / 100,
      total_platform_fee: rows.reduce((s, r) => s + (r.platform_fee_minor || 0), 0) / 100,
      total_net: rows.reduce((s, r) => s + (r.academy_net_minor || 0), 0) / 100,
      enrollment_count: rows.length,
    };
  } catch (e) {
    console.warn("fetchInstructorEarningsSummary warning:", e);
    return { total_gross: 0, total_platform_fee: 0, total_net: 0, enrollment_count: 0 };
  }
}

export async function fetchInstructorCourseRevenue(mentorId) {
  if (!supabase || !mentorId) return [];
  try {
    const { data: mentor } = await supabase.from("mentors").select("user_id").eq("id", mentorId).maybeSingle();
    if (!mentor?.user_id) return [];
    const { data: courses } = await supabase.from("courses").select("id, title, price, organization_id").eq("instructor_id", mentor.user_id);
    if (!courses?.length) return [];

    // For each course, count enrollments
    const result = await Promise.all(courses.map(async (c) => {
      const { count } = await supabase.from("course_enrollments")
        .select("*", { count: "exact", head: true })
        .eq("course_id", c.id)
        .eq("status", "active");
      return {
        course_id: c.id,
        course_name: c.title,
        listed_price: c.price || 0,
        enrollment_count: count || 0,
        // Gross approximated from price × enrollments (real txns need course_id on academy_transactions)
        gross_revenue: (c.price || 0) * (count || 0),
      };
    }));
    return result;
  } catch (e) {
    console.warn("fetchInstructorCourseRevenue warning:", e);
    return [];
  }
}

export async function fetchMyPayoutRequests(mentorId) {
  if (!supabase || !mentorId) return [];
  try {
    const { data, error } = await supabase
      .from("mentor_payout_requests")
      .select("*")
      .eq("mentor_id", mentorId)
      .order("requested_at", { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn("fetchMyPayoutRequests warning:", e);
    return [];
  }
}

export async function submitPayoutRequest(mentorId, amount, paymentMethod) {
  if (!supabase || !mentorId) return { success: false, error: "Not available in demo mode." };
  if (!amount || Number(amount) <= 0) return { success: false, error: "Amount must be positive." };
  if (!paymentMethod?.trim()) return { success: false, error: "Payment method is required." };
  try {
    const { error } = await supabase.from("mentor_payout_requests").insert({
      mentor_id: mentorId,
      amount: Number(amount),
      payment_method: paymentMethod.trim(),
      status: "pending",
    });
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not submit payout request." };
  }
}

// --- Platform Owner Commission Config ---

export async function fetchAllOrgCommissions() {
  if (!supabase) return [];
  try {
    // Join organizations with their latest active commission config
    const { data: orgs, error: orgErr } = await supabase.from("organizations").select("id, name");
    if (orgErr) throw orgErr;

    const { data: configs, error: cfgErr } = await supabase
      .from("academy_commission_configs")
      .select("*")
      .eq("is_active", true)
      .order("effective_date", { ascending: false });
    if (cfgErr) throw cfgErr;

    // Latest config per org
    const latestByOrg = new Map();
    for (const cfg of configs || []) {
      if (!latestByOrg.has(cfg.organization_id)) latestByOrg.set(cfg.organization_id, cfg);
    }

    return (orgs || []).map((org) => {
      const cfg = latestByOrg.get(org.id);
      return {
        org_id: org.id,
        org_name: org.name,
        commission_percent: cfg?.commission_percent ?? 10,
        fixed_fee_minor: cfg?.fixed_fee_minor ?? 0,
        currency: cfg?.currency ?? "USD",
        effective_date: cfg?.effective_date ?? null,
        has_custom_config: !!cfg,
      };
    });
  } catch (e) {
    console.warn("fetchAllOrgCommissions warning:", e);
    return [];
  }
}

export async function setOrgCommission(orgId, commissionPercent, fixedFeeMinor, currency = "USD") {
  if (!supabase || !orgId) return { success: false, error: "Not available in demo mode." };
  const pct = Number(commissionPercent);
  if (isNaN(pct) || pct < 0 || pct > 100) return { success: false, error: "Commission must be 0–100%." };
  try {
    // Deactivate current active configs for this org
    await supabase
      .from("academy_commission_configs")
      .update({ is_active: false })
      .eq("organization_id", orgId)
      .eq("is_active", true);

    // Insert new active config
    const { error } = await supabase.from("academy_commission_configs").insert({
      organization_id: orgId,
      commission_percent: pct,
      fixed_fee_minor: Number(fixedFeeMinor) || 0,
      currency,
      is_active: true,
    });
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not update commission." };
  }
}

// --- Paid Course Enrollment (Learner) ---

export async function startPaidCourseEnrollment({ courseId, courseName, price, currency = "NGN", email, userId, provider = "paystack" }) {
  if (!courseId || !email || !userId) return { success: false, error: "Missing required info." };
  if (!price || price <= 0) return { success: false, error: "This course has no price set." };

  try {
    if (provider === "stripe") {
      await startStripePayment({
        email,
        amount: price,
        currency: "USD",
        context: PAYMENT_CONTEXTS.COURSE_ENROLLMENT,
        description: `Train AI: ${courseName}`,
        metadata: { course_id: courseId, user_id: userId },
      });
    } else {
      await startPaystackPayment({
        email,
        amount: price,
        currency,
        context: PAYMENT_CONTEXTS.COURSE_ENROLLMENT,
        metadata: { course_id: courseId, user_id: userId },
      });
    }
    return { success: true }; // redirects browser; nothing after runs
  } catch (e) {
    return { success: false, error: e?.message || "Could not start payment." };
  }
}

// ============================================================================
// Platform Owner Payment Gateways & Transactions Monitor APIs
// ============================================================================

export async function fetchAllOrgPaymentGateways() {
  if (!supabase) return [];
  try {
    const { data: orgs, error } = await supabase
      .from("organizations")
      .select("id, name, slug, settings, subscription_tier, status, created_at")
      .order("name", { ascending: true });
    if (error) throw error;

    return (orgs || []).map((o) => {
      const gateways = o.settings?.payment_gateways || {};
      const hasPaystack = !!(gateways.paystack_subaccount_code || gateways.paystack_public_key || gateways.paystack_secret_key);
      const hasStripe = !!(gateways.stripe_account_id || gateways.stripe_publishable_key || gateways.stripe_secret_key);
      const hasBank = !!(gateways.bank_name && gateways.account_number);
      const isConfigured = hasPaystack || hasStripe || hasBank;

      return {
        org_id: o.id,
        org_name: o.name,
        org_slug: o.slug,
        subscription_tier: o.subscription_tier,
        status: o.status,
        created_at: o.created_at,
        preferred_gateway: gateways.preferred_gateway || "default",
        environment: gateways.environment || "test",
        paystack_subaccount_code: gateways.paystack_subaccount_code || "",
        paystack_public_key: gateways.paystack_public_key || "",
        has_paystack_secret: !!gateways.paystack_secret_key,
        stripe_account_id: gateways.stripe_account_id || "",
        stripe_publishable_key: gateways.stripe_publishable_key || "",
        has_stripe_secret: !!gateways.stripe_secret_key,
        bank_name: gateways.bank_name || "",
        account_number: gateways.account_number || "",
        account_name: gateways.account_name || "",
        payout_currency: gateways.payout_currency || "NGN",
        swift_code: gateways.swift_code || "",
        has_paystack: hasPaystack,
        has_stripe: hasStripe,
        has_bank: hasBank,
        is_configured: isConfigured,
      };
    });
  } catch (e) {
    console.warn("fetchAllOrgPaymentGateways warning:", e);
    return [];
  }
}

export async function fetchAllPlatformTransactions(limit = 100) {
  if (!supabase) return { transactions: [], summary: { total_gross: 0, total_platform_fee: 0, total_net: 0, count: 0, currency_breakdown: {} } };
  try {
    const { data: txns, error } = await supabase
      .from("academy_transactions")
      .select(`
        id,
        organization_id,
        learner_id,
        provider,
        provider_reference,
        currency,
        gross_amount_minor,
        commission_percent_applied,
        fixed_fee_minor_applied,
        platform_fee_minor,
        academy_net_minor,
        status,
        created_at,
        organizations (id, name, slug),
        user_profiles:learner_id (id, display_name, email)
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const rows = (txns || []).map((t) => ({
      id: t.id,
      organization_id: t.organization_id,
      org_name: t.organizations?.name || "Unknown Organization",
      org_slug: t.organizations?.slug || "",
      learner_id: t.learner_id,
      learner_name: t.user_profiles?.display_name || t.user_profiles?.email || "Learner",
      learner_email: t.user_profiles?.email || "",
      provider: t.provider || "paystack",
      provider_reference: t.provider_reference,
      currency: t.currency || "NGN",
      gross_amount: (t.gross_amount_minor || 0) / 100,
      commission_percent: t.commission_percent_applied,
      platform_fee: (t.platform_fee_minor || 0) / 100,
      academy_net: (t.academy_net_minor || 0) / 100,
      status: t.status || "completed",
      created_at: t.created_at,
    }));

    const currencyBreakdown = {};
    let totalGross = 0;
    let totalPlatformFee = 0;
    let totalNet = 0;

    for (const r of rows) {
      totalGross += r.gross_amount;
      totalPlatformFee += r.platform_fee;
      totalNet += r.academy_net;

      const curr = r.currency || "NGN";
      if (!currencyBreakdown[curr]) {
        currencyBreakdown[curr] = { gross: 0, platform_fee: 0, net: 0, count: 0 };
      }
      currencyBreakdown[curr].gross += r.gross_amount;
      currencyBreakdown[curr].platform_fee += r.platform_fee;
      currencyBreakdown[curr].net += r.academy_net;
      currencyBreakdown[curr].count += 1;
    }

    return {
      transactions: rows,
      summary: {
        total_gross: totalGross,
        total_platform_fee: totalPlatformFee,
        total_net: totalNet,
        count: rows.length,
        currency_breakdown: currencyBreakdown,
      },
    };
  } catch (e) {
    console.warn("fetchAllPlatformTransactions warning:", e);
    return { transactions: [], summary: { total_gross: 0, total_platform_fee: 0, total_net: 0, count: 0, currency_breakdown: {} } };
  }
}

export async function fetchAllPlatformPayoutRequests() {
  if (!supabase) return [];
  try {
    const { data: requests, error } = await supabase
      .from("mentor_payout_requests")
      .select(`
        id,
        mentor_id,
        amount,
        payment_method,
        status,
        notes,
        requested_at,
        processed_at,
        processed_by,
        mentors (
          id,
          user_id,
          payouts_enabled,
          organization_id,
          organizations (id, name, slug)
        )
      `)
      .order("requested_at", { ascending: false });

    if (error) throw error;

    // Resolve mentor user_profiles for names
    const userIds = (requests || []).map((r) => r.mentors?.user_id).filter(Boolean);
    const profileMap = new Map();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, display_name, email")
        .in("id", userIds);
      (profiles || []).forEach((p) => profileMap.set(p.id, p));
    }

    return (requests || []).map((r) => {
      const mentorProfile = r.mentors?.user_id ? profileMap.get(r.mentors.user_id) : null;
      return {
        id: r.id,
        mentor_id: r.mentor_id,
        mentor_name: mentorProfile?.display_name || mentorProfile?.email || "Instructor",
        mentor_email: mentorProfile?.email || "",
        payouts_enabled: r.mentors?.payouts_enabled ?? false,
        organization_id: r.mentors?.organization_id,
        org_name: r.mentors?.organizations?.name || "Independent",
        org_slug: r.mentors?.organizations?.slug || "",
        amount: Number(r.amount) || 0,
        payment_method: r.payment_method || "N/A",
        status: r.status || "pending",
        notes: r.notes || "",
        requested_at: r.requested_at,
        processed_at: r.processed_at,
        processed_by: r.processed_by,
      };
    });
  } catch (e) {
    console.warn("fetchAllPlatformPayoutRequests warning:", e);
    return [];
  }
}

export async function updatePlatformPayoutRequest(requestId, status, processedBy) {
  if (!supabase || !requestId) return { success: false, error: "Missing request ID" };
  try {
    const { error } = await supabase
      .from("mentor_payout_requests")
      .update({
        status,
        processed_at: new Date().toISOString(),
        processed_by: processedBy || null,
      })
      .eq("id", requestId);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not update payout request." };
  }
}

