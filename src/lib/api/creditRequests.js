import { supabase } from "../supabaseClient.js";
import { isRealDatabaseId } from "../mockDataManager.js";

const LOCAL_STORAGE_KEY = "trainai_mock_credit_requests_v1";

function getLocalCreditRequests() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalCreditRequests(list) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn("Failed to save local credit requests:", err);
  }
}

/**
 * Learner submits a request for AI credits from their organization
 */
export async function requestCredits({ userId, organizationId, amount, reason }) {
  let resolvedUserId = userId;
  if (!resolvedUserId && supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      resolvedUserId = user?.id;
    } catch (_) {}
  }

  const cleanOrgId = isRealDatabaseId(organizationId) ? organizationId : null;
  const numAmount = Number(amount) || 50;

  if (supabase && resolvedUserId && isRealDatabaseId(resolvedUserId)) {
    const { data, error } = await supabase
      .from("credit_requests")
      .insert({
        user_id: resolvedUserId,
        organization_id: cleanOrgId,
        amount: numAmount,
        reason: reason || null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Fallback / Demo storage
  const newLocal = {
    id: "req-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 6),
    user_id: resolvedUserId || "demo-learner-user",
    organization_id: organizationId || null,
    amount: numAmount,
    reason: reason || null,
    status: "pending",
    created_at: new Date().toISOString(),
    resolved_at: null,
    resolved_by: null,
  };

  const list = getLocalCreditRequests();
  list.unshift(newLocal);
  saveLocalCreditRequests(list);
  return newLocal;
}

/**
 * Fetch credit requests submitted by the current learner
 */
export async function fetchMyCreditRequests(userId) {
  if (supabase && userId && isRealDatabaseId(userId)) {
    const { data, error } = await supabase
      .from("credit_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  return getLocalCreditRequests()
    .filter((r) => !userId || r.user_id === userId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/**
 * Fetch all credit requests for an organization (for Org Admins & Super Admins)
 */
export async function fetchOrgCreditRequests(orgId) {
  if (supabase) {
    let query = supabase
      .from("credit_requests")
      .select(`
          id,
          user_id,
          organization_id,
          amount,
          reason,
          status,
          created_at,
          resolved_at,
          resolved_by,
          user_profiles:user_id (
            id,
            display_name,
            role,
            avatar_url
          )
      `)
      .order("created_at", { ascending: false });

    if (orgId && isRealDatabaseId(orgId)) {
      query = query.eq("organization_id", orgId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((item) => ({
      ...item,
      user: item.user_profiles || { id: item.user_id, display_name: "Learner" },
    }));
  }

  return getLocalCreditRequests()
    .filter((r) => !orgId || !r.organization_id || r.organization_id === orgId)
    .map((item) => ({ ...item, user: { id: item.user_id, display_name: "Learner (Demo)" } }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/**
 * Approve a pending credit request
 */
export async function approveCreditRequest(requestId, orgId) {
  if (supabase && isRealDatabaseId(requestId)) {
    const { data, error } = await supabase.rpc("approve_credit_request", { p_request_id: requestId });
    if (error) throw error;
    return { success: true, data };
  }

  // Update local store
  const localList = getLocalCreditRequests();
  const found = localList.find((r) => r.id === requestId);
  if (found) {
    found.status = "approved";
    found.resolved_at = new Date().toISOString();
    saveLocalCreditRequests(localList);
  }
  if (found) return { success: true };
  return { success: false, error: "Credit request not found." };
}

/**
 * Deny a pending credit request
 */
export async function denyCreditRequest(requestId) {
  if (supabase && isRealDatabaseId(requestId)) {
    const { data, error } = await supabase.rpc("deny_credit_request", { p_request_id: requestId });
    if (error) throw error;
    return { success: true, data };
  }

  // Update local store
  const localList = getLocalCreditRequests();
  const found = localList.find((r) => r.id === requestId);
  if (found) {
    found.status = "denied";
    found.resolved_at = new Date().toISOString();
    saveLocalCreditRequests(localList);
  }
  if (found) return { success: true };
  return { success: false, error: "Credit request not found." };
}

/**
 * Direct credit grant from Admin to a learner
 */
export async function grantDirectCredits({ userId, organizationId, amount, reason }) {
  const numAmount = Number(amount) || 50;
  if (supabase && userId && isRealDatabaseId(userId)) {
    if (!isRealDatabaseId(organizationId)) throw new Error("A valid organization is required.");
    const { data, error } = await supabase.rpc("grant_ai_credits_to_learner", {
      p_user_id: userId,
      p_organization_id: organizationId,
      p_amount: numAmount,
      p_reference: `admin_direct:${reason || "manual"}:${Date.now()}`,
    });
    if (error) throw error;
    return { success: true, data };
  }

  return { success: false, error: "Credits can only be granted to a saved learner account." };
}

