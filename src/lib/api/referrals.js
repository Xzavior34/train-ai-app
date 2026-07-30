import { supabase } from "../supabaseClient.js";

// Real backing tables/RPCs confirmed against the shared project's
// integrations/supabase/types.ts (train-ai-ltd-main reference app):
//   referral_links   (id, user_id, code, label, clicks, is_active,
//                      utm_source, utm_medium, utm_campaign,
//                      whatsapp_group_url, created_at, updated_at)
//   referral_signups (id, referral_code, referral_link_id, referred_user_id,
//                      referrer_user_id, signup_completed, utm_source,
//                      utm_medium, utm_campaign, created_at)
//   RPC validate_referral_code(p_code) -> { is_valid, referral_link_id,
//                      referrer_name, referrer_user_id, whatsapp_group_url }
//   RPC get_my_referral_signups() -> rows of { referral_code,
//                      referral_link_id, signed_up_at, signup_completed },
//                      scoped server-side to auth.uid() (Args: never).
//
// This app has no router (no "/join/:code" page), so the shareable link is
// just "<origin>/?ref=<code>" — captured by AuthPage.jsx on the signup form.

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; // no ambiguous chars (0/O, 1/l), matches the reference app's generator
const CODE_LENGTH = 8;

function generateReferralCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
  }
  return code;
}

export function buildReferralUrl(code) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://trainai.app";
  return `${origin}/?ref=${encodeURIComponent(code)}`;
}

/**
 * Get-or-create this user's referral_links row. Returns
 * { id, code, url, clicks, label, whatsapp_group_url, ... } or null.
 */
export async function fetchMyReferralCode(userId) {
  if (!userId) return null;

  if (!supabase) {
    // Demo mode (no Supabase project configured) — deterministic fake code
    // so the "Refer a friend" panel still has something to show.
    const code = `DEMO${String(userId).replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase() || "0000"}`;
    return { code, url: buildReferralUrl(code), clicks: 0, label: null, whatsapp_group_url: null };
  }

  const { data: existing, error: fetchError } = await supabase
    .from("referral_links")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fetchError) console.warn("Referral code fetch warning:", fetchError);
  if (existing) return { ...existing, url: buildReferralUrl(existing.code) };

  // No link yet — mint one. Retry a couple of times in case of a (very
  // unlikely) collision against the table's unique constraint on `code`.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateReferralCode();
    const { data: created, error: insertError } = await supabase
      .from("referral_links")
      .insert({
        user_id: userId,
        code,
        utm_source: "referral",
        utm_medium: "ambassador",
        utm_campaign: "general",
      })
      .select()
      .single();

    if (!insertError && created) return { ...created, url: buildReferralUrl(created.code) };
    if (insertError && insertError.code !== "23505") {
      console.warn("Referral code create warning:", insertError);
      break;
    }
    // 23505 = duplicate code — loop and mint a fresh random one.
  }
  return null;
}

/**
 * Stats for the "Refer a friend" panel: link-level clicks (from
 * referral_links, owned by this user) plus this user's own signups via the
 * real get_my_referral_signups() RPC (scoped to auth.uid() server-side).
 */
export async function fetchMyReferralStats(userId) {
  const empty = { totalLinks: 0, totalClicks: 0, totalSignups: 0, completedSignups: 0, conversionRate: 0, recentSignups: [] };
  if (!userId || !supabase) return empty;

  const [linksResult, signupsResult] = await Promise.all([
    supabase.from("referral_links").select("*").eq("user_id", userId),
    supabase.rpc("get_my_referral_signups"),
  ]);

  if (linksResult.error) console.warn("Referral links fetch warning:", linksResult.error);
  if (signupsResult.error) console.warn("Referral signups fetch warning:", signupsResult.error);

  const links = linksResult.data || [];
  const signups = signupsResult.data || [];
  const totalClicks = links.reduce((sum, l) => sum + (l.clicks || 0), 0);
  const completedSignups = signups.filter((s) => s.signup_completed).length;
  const conversionRate = totalClicks > 0 ? Number(((completedSignups / totalClicks) * 100).toFixed(1)) : 0;

  return {
    totalLinks: links.length,
    totalClicks,
    totalSignups: signups.length,
    completedSignups,
    conversionRate,
    recentSignups: signups
      .slice()
      .sort((a, b) => new Date(b.signed_up_at) - new Date(a.signed_up_at))
      .slice(0, 10),
  };
}

/**
 * Records a referral right after a successful signup, when a `?ref=CODE`
 * was captured on the auth screen. Validates the code via the real
 * validate_referral_code(p_code) RPC, then inserts into referral_signups
 * (idempotent — skips if this new user already has a row, e.g. a retried
 * call). Mirrors the reference app's useReferralTracking hook, minus the
 * extra demographic fields (school/department/level/gender/age_range) that
 * hook also writes to user_profiles/user_profiles_private — out of scope
 * here since this app's signup form doesn't collect those.
 */
export async function applyReferralCode(code, newUserId) {
  if (!code || !newUserId) return { success: false };
  if (!supabase) return { success: false, error: "Referrals are not available right now." };

  try {
    const { data: validation, error: validateError } = await supabase.rpc("validate_referral_code", { p_code: code });
    if (validateError) throw validateError;

    const info = Array.isArray(validation) ? validation[0] : validation;
    if (!info || !info.is_valid) {
      return { success: false, error: "Invalid or expired referral code." };
    }

    const { data: existingSignup } = await supabase
      .from("referral_signups")
      .select("id")
      .eq("referred_user_id", newUserId)
      .limit(1)
      .maybeSingle();

    if (!existingSignup) {
      const { error: insertError } = await supabase.from("referral_signups").insert({
        referral_link_id: info.referral_link_id || null,
        referred_user_id: newUserId,
        referral_code: code,
        referrer_user_id: info.referrer_user_id || null,
        signup_completed: true,
        utm_source: "referral",
        utm_medium: "ambassador",
        utm_campaign: null,
      });
      if (insertError) throw insertError;
    }

    return { success: true, referrerName: info.referrer_name || null, whatsappGroupUrl: info.whatsapp_group_url || null };
  } catch (error) {
    console.warn("Apply referral code warning:", error);
    return { success: false, error: error?.message || "Could not record this referral." };
  }
}
