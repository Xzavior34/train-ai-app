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
