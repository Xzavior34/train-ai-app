import { supabase } from "../supabaseClient.js";

const LOCAL_STORAGE_CODES_KEY = "trainai_access_codes_cache_v1";
const LOCAL_STORAGE_REDEMPTIONS_KEY = "trainai_access_redemptions_cache_v1";

const SEED_ACCESS_CODES = [
  {
    id: "code-cap3-2026",
    code: "CAP3-2026",
    name: "CAP Cohort 3 Six-Week Sponsored Access",
    organization_id: "org-demo",
    cohort_id: "cap-cohort-3",
    duration_days: 42, // 6 weeks
    start_date: "2026-09-01T00:00:00Z",
    expiration_date: "2026-12-31T23:59:59Z",
    max_redemptions: 500,
    redemptions_count: 142,
    is_active: true,
    created_at: "2026-09-01T00:00:00Z",
  },
  {
    id: "code-trial-6w",
    code: "TRAINAI-TRIAL",
    name: "Executive 6-Week Institutional Trial",
    organization_id: "org-demo",
    cohort_id: null,
    duration_days: 42,
    start_date: "2026-09-15T00:00:00Z",
    expiration_date: "2026-12-31T23:59:59Z",
    max_redemptions: 50,
    redemptions_count: 18,
    is_active: true,
    created_at: "2026-09-15T00:00:00Z",
  },
];

function getCachedCodes() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CODES_KEY);
    return raw ? JSON.parse(raw) : SEED_ACCESS_CODES;
  } catch {
    return SEED_ACCESS_CODES;
  }
}

function saveCachedCodes(items) {
  try {
    localStorage.setItem(LOCAL_STORAGE_CODES_KEY, JSON.stringify(items));
  } catch {}
}

function getCachedRedemptions() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_REDEMPTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCachedRedemptions(items) {
  try {
    localStorage.setItem(LOCAL_STORAGE_REDEMPTIONS_KEY, JSON.stringify(items));
  } catch {}
}

/**
 * Fetches all access codes for an organization or global view
 */
export async function fetchAccessCodes(organizationId) {
  if (!supabase) {
    return getCachedCodes();
  }

  try {
    let query = supabase.from("access_codes").select("*").order("created_at", { ascending: false });
    if (organizationId && organizationId !== "demo-org-id") {
      query = query.eq("organization_id", organizationId);
    }
    const { data, error } = await query;
    if (error || !data || data.length === 0) return getCachedCodes();
    saveCachedCodes(data);
    return data;
  } catch {
    return getCachedCodes();
  }
}

/**
 * Creates a new access / trial code
 */
export async function createAccessCode({
  code,
  name,
  organizationId,
  cohortId,
  durationDays = 42,
  startDate,
  expirationDate,
  maxRedemptions = 500,
}) {
  const normalizedCode = (code || "").trim().toUpperCase();
  if (!normalizedCode) throw new Error("Access code string is required.");

  const newRow = {
    id: `code-${Date.now()}`,
    code: normalizedCode,
    name: name || `Access Code ${normalizedCode}`,
    organization_id: organizationId || null,
    cohort_id: cohortId || null,
    duration_days: durationDays || 42,
    start_date: startDate || new Date().toISOString(),
    expiration_date: expirationDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    max_redemptions: maxRedemptions || 500,
    redemptions_count: 0,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  if (supabase) {
    try {
      const { data, error } = await supabase.from("access_codes").insert(newRow).select().single();
      if (!error && data) return { success: true, data };
    } catch {}
  }

  const existing = getCachedCodes();
  const updated = [newRow, ...existing];
  saveCachedCodes(updated);
  return { success: true, data: newRow };
}

/**
 * Toggles an access code active/disabled status
 */
export async function toggleAccessCodeActive(codeId, isActive) {
  if (supabase) {
    try {
      await supabase.from("access_codes").update({ is_active: isActive }).eq("id", codeId);
    } catch {}
  }

  const existing = getCachedCodes();
  const updated = existing.map((c) => (c.id === codeId ? { ...c, is_active: isActive } : c));
  saveCachedCodes(updated);
  return { success: true };
}

/**
 * Fetches redemptions list for an access code
 */
export async function fetchAccessCodeRedemptions(accessCodeId) {
  if (!supabase) {
    const list = getCachedRedemptions();
    return list.filter((r) => r.access_code_id === accessCodeId);
  }

  try {
    const { data, error } = await supabase
      .from("access_code_redemptions")
      .select("*, user_profiles(display_name, email)")
      .eq("access_code_id", accessCodeId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map((r) => ({
      ...r,
      user_name: r.user_profiles?.display_name || "Learner",
      user_email: r.user_profiles?.email || "learner@trainailtd.com",
    }));
  } catch {
    return getCachedRedemptions().filter((r) => r.access_code_id === accessCodeId);
  }
}

/**
 * Redeems an access code for a user (server-side RPC & local fallback)
 */
export async function redeemAccessCode(code, userId) {
  const normalizedCode = (code || "").trim().toUpperCase();
  if (!normalizedCode) return { success: false, error: "Please enter an access code." };

  if (supabase && userId) {
    try {
      const { data, error } = await supabase.rpc("redeem_access_code", {
        p_code: normalizedCode,
        p_user_id: userId,
      });
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn("RPC redeem_access_code notice, executing safe fallback:", err);
    }
  }

  // Fallback demo/offline validation
  const codes = getCachedCodes();
  const matched = codes.find((c) => c.code.toUpperCase() === normalizedCode);
  if (!matched) return { success: false, error: "Invalid access code." };
  if (!matched.is_active) return { success: false, error: "This access code has been disabled." };

  const expiresAt = new Date(Date.now() + matched.duration_days * 24 * 60 * 60 * 1000).toISOString();
  const newRedemption = {
    id: `redemption-${Date.now()}`,
    access_code_id: matched.id,
    user_id: userId || "user-current",
    user_name: "Active Learner",
    user_email: "learner@trainailtd.com",
    organization_id: matched.organization_id,
    cohort_id: matched.cohort_id,
    trial_started_at: new Date().toISOString(),
    trial_expires_at: expiresAt,
    status: "active",
    created_at: new Date().toISOString(),
  };

  const redemptions = getCachedRedemptions();
  saveCachedRedemptions([newRedemption, ...redemptions]);

  matched.redemptions_count += 1;
  saveCachedCodes(codes);

  return {
    success: true,
    message: `Trial access unlocked! Valid for ${matched.duration_days / 7} weeks until ${new Date(expiresAt).toLocaleDateString()}.`,
    expires_at: expiresAt,
    cohort_id: matched.cohort_id,
    organization_id: matched.organization_id,
    duration_days: matched.duration_days,
  };
}

/**
 * Revokes trial access for an individual redemption record
 */
export async function revokeTrialAccess(redemptionId) {
  if (supabase) {
    try {
      await supabase.from("access_code_redemptions").update({ status: "revoked" }).eq("id", redemptionId);
    } catch {}
  }

  const redemptions = getCachedRedemptions();
  const updated = redemptions.map((r) => (r.id === redemptionId ? { ...r, status: "revoked" } : r));
  saveCachedRedemptions(updated);
  return { success: true };
}
