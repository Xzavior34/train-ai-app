import { creditPurchase } from "./paymentCatalog.js";

export function isAllowedPaymentReturn(value) {
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    return (["trainailtd.com", "www.trainailtd.com"].includes(url.hostname) && url.protocol === "https:") ||
      (["localhost", "127.0.0.1"].includes(url.hostname) && ["http:", "https:"].includes(url.protocol));
  } catch { return false; }
}

// Prices and entitlements are resolved from the server catalog, never copied
// from caller metadata simply because a provider echoed it back.
export async function validatePayment(db, userId, context, amount, currency, requested = {}) {
  currency = String(currency || "").toUpperCase();
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) throw Error("Invalid payment amount.");
  if (context === "credits") return { ...creditPurchase(requested, amount, currency), user_id: userId };
  if (context === "seat_purchase" || context === "organization_subscription") {
    const orgId = String(requested.org_id || "");
    const { data: membership, error } = await db.from("organization_members").select("role").eq("organization_id", orgId).eq("user_id", userId).eq("status", "active").maybeSingle();
    if (error || !["owner", "admin"].includes(membership?.role)) throw Error("An active administrator of this organization must make this purchase.");
    let category, metadata;
    if (context === "seat_purchase") {
      const seats = Number(requested.seats);
      if (!Number.isInteger(seats) || seats < 1 || seats > 10000) throw Error("Invalid seat quantity.");
      const { data: org, error: orgError } = await db.from("organizations").select("subscription_tier").eq("id", orgId).single();
      if (orgError || !org) throw Error("Could not load organization pricing.");
      category = ["starter", "basic"].includes(org.subscription_tier) ? "seat_subscription_basic" : "seat_subscription";
      metadata = { org_id: orgId, seats, user_id: userId };
    } else {
      const tier = ({ basic: "starter", intermediate: "growth", professional: "growth" })[requested.tier] || requested.tier;
      if (!["starter", "growth"].includes(tier)) throw Error("This plan requires an agreed quote.");
      category = "org_subscription_" + (tier === "growth" ? "growth" : tier);
      metadata = { org_id: orgId, tier, user_id: userId };
    }
    const { data: price, error: priceError } = await db.rpc("get_active_price", { p_category: category, p_currency: currency });
    const expected = Number(price?.unit_amount_minor) * (metadata.seats || 1);
    if (priceError || !price || !Number.isSafeInteger(expected) || expected <= 0 || Math.round(Number(amount) * 100) !== expected) throw Error("Price changed or is unavailable. Refresh pricing before checkout.");
    return metadata;
  }
  if (context === "course_enrollment") {
    const { data: course, error } = await db.from("courses").select("id,price,is_published,archived_at,organization_id").eq("id", requested.course_id).maybeSingle();
    if (error || !course?.is_published || course.archived_at || currency !== "USD" || Number(course.price) <= 0 || Math.round(Number(course.price)*100) !== Math.round(Number(amount)*100)) throw Error("Course price or availability changed. Refresh the course before checkout.");
    if (course.organization_id) {
      const { data: membership } = await db.from("organization_members").select("user_id").eq("organization_id",course.organization_id).eq("user_id",userId).eq("status","active").maybeSingle();
      if (!membership) throw Error("You cannot purchase this organization's private course.");
    }
    return { course_id: course.id, user_id: userId };
  }
  throw Error("Checkout is unavailable for this purchase type. Contact support before paying.");
}

export async function recordVerifiedPayment(db, { provider, reference, userId, context, amount, currency, metadata }) {
  if (!reference || !userId) throw Error("Verified payment identity is missing.");
  const { error } = await db.rpc("record_verified_payment", { p_provider: provider, p_reference: reference, p_user_id: userId,
    p_context: context, p_amount: Number(amount), p_currency: String(currency).toUpperCase(), p_metadata: metadata });
  if (error) throw Error("Payment verified, but recording it failed. Retry with the same reference.");
  if (context === "course_enrollment") {
    const { error: enrollmentError } = await db.from("course_enrollments").upsert({ user_id: userId, course_id: metadata.course_id,
      payment_status: "completed", amount_paid: Number(amount), currency: String(currency).toUpperCase() }, { onConflict: "user_id,course_id" });
    if (enrollmentError) throw Error("Payment verified, but enrollment failed. Retry with the same reference.");
  }
}
