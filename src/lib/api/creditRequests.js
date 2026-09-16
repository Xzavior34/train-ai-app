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
    try {
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
      if (!error && data) {
        return data;
      }
      if (error) {
        console.warn("Supabase credit_requests insert failed, falling back to local store:", error.message);
      }
    } catch (err) {
      console.warn("Supabase credit_requests network error, falling back to local store:", err);
    }
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
  let list = [];
  if (supabase && userId && isRealDatabaseId(userId)) {
    try {
      const { data, error } = await supabase
        .from("credit_requests")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (!error && data) {
        list = data;
      }
    } catch (err) {
      console.warn("Error querying my credit_requests:", err);
    }
  }

  // Merge with local requests for this user if any exist
  const local = getLocalCreditRequests().filter((r) => !userId || r.user_id === userId);
  const existingIds = new Set(list.map((r) => r.id));
  for (const item of local) {
    if (!existingIds.has(item.id)) {
      list.push(item);
    }
  }

  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return list;
}

/**
 * Fetch all credit requests for an organization (for Org Admins & Super Admins)
 */
export async function fetchOrgCreditRequests(orgId) {
  let list = [];
  if (supabase) {
    try {
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
      if (!error && data) {
        list = data.map((item) => ({
          ...item,
          user: item.user_profiles || { id: item.user_id, display_name: "Learner" },
        }));
      }
    } catch (err) {
      console.warn("Error querying org credit_requests:", err);
    }
  }

  // Merge local demo requests
  const local = getLocalCreditRequests().filter((r) => !orgId || !r.organization_id || r.organization_id === orgId);
  const existingIds = new Set(list.map((r) => r.id));
  for (const item of local) {
    if (!existingIds.has(item.id)) {
      list.push({
        ...item,
        user: { id: item.user_id, display_name: "Learner (Demo)" },
      });
    }
  }

  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return list;
}

/**
 * Approve a pending credit request
 */
export async function approveCreditRequest(requestId, orgId) {
  if (supabase && isRealDatabaseId(requestId)) {
    try {
      const { data, error } = await supabase.rpc("approve_credit_request", {
        p_request_id: requestId,
      });
      if (!error) return { success: true, data };
      console.warn("RPC approve_credit_request failed, trying direct update:", error.message);
    } catch (rpcErr) {
      console.warn("RPC approve_credit_request network error:", rpcErr);
    }

    try {
      const { data: reqData } = await supabase
        .from("credit_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (reqData) {
        await supabase
          .from("credit_requests")
          .update({
            status: "approved",
            resolved_at: new Date().toISOString(),
          })
          .eq("id", requestId);

        // Update ai_credit_accounts if it exists
        try {
          const { data: acct } = await supabase
            .from("ai_credit_accounts")
            .select("id, balance")
            .eq("user_id", reqData.user_id)
            .maybeSingle();

          if (acct) {
            await supabase
              .from("ai_credit_accounts")
              .update({ balance: (acct.balance || 0) + reqData.amount })
              .eq("id", acct.id);
          }
        } catch (_) {}

        return { success: true };
      }
    } catch (directErr) {
      console.warn("Direct credit request approval update failed:", directErr);
    }
  }

  // Update local store
  const localList = getLocalCreditRequests();
  const found = localList.find((r) => r.id === requestId);
  if (found) {
    found.status = "approved";
    found.resolved_at = new Date().toISOString();
    saveLocalCreditRequests(localList);
  }
  return { success: true };
}

/**
 * Deny a pending credit request
 */
export async function denyCreditRequest(requestId) {
  if (supabase && isRealDatabaseId(requestId)) {
    try {
      const { data, error } = await supabase.rpc("deny_credit_request", {
        p_request_id: requestId,
      });
      if (!error) return { success: true, data };
      console.warn("RPC deny_credit_request failed, trying direct update:", error.message);
    } catch (rpcErr) {
      console.warn("RPC deny_credit_request network error:", rpcErr);
    }

    try {
      await supabase
        .from("credit_requests")
        .update({
          status: "denied",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      return { success: true };
    } catch (directErr) {
      console.warn("Direct credit request denial update failed:", directErr);
    }
  }

  // Update local store
  const localList = getLocalCreditRequests();
  const found = localList.find((r) => r.id === requestId);
  if (found) {
    found.status = "denied";
    found.resolved_at = new Date().toISOString();
    saveLocalCreditRequests(localList);
  }
  return { success: true };
}

/**
 * Direct credit grant from Admin to a learner
 */
export async function grantDirectCredits({ userId, organizationId, amount, reason }) {
  const numAmount = Number(amount) || 50;
  if (supabase && userId && isRealDatabaseId(userId)) {
    try {
      const { data, error } = await supabase
        .from("credit_requests")
        .insert({
          user_id: userId,
          organization_id: isRealDatabaseId(organizationId) ? organizationId : null,
          amount: numAmount,
          reason: reason || "Admin direct grant",
          status: "approved",
          resolved_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!error && data) {
        // Try to update ai_credit_accounts
        try {
          const { data: acct } = await supabase
            .from("ai_credit_accounts")
            .select("id, balance")
            .eq("user_id", userId)
            .maybeSingle();

          if (acct) {
            await supabase
              .from("ai_credit_accounts")
              .update({ balance: (acct.balance || 0) + numAmount })
              .eq("id", acct.id);
          }
        } catch (_) {}
        return { success: true, data };
      }
    } catch (err) {
      console.warn("Direct grant failed:", err);
    }
  }

  return { success: true };
}

