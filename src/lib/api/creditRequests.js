import { supabase } from "../supabaseClient.js";

// Learner "Request Credits" flow (see supabase/migrations/0146_credit_requests.sql).
// Learner-side only for now: submit a request, see its own status. No
// admin approve/deny screen or auto-crediting yet - a future feature will
// update these rows' `status`.

export async function requestCredits({ userId, organizationId, amount, reason }) {
  const { data, error } = await supabase
    .from("credit_requests")
    .insert({
      user_id: userId,
      organization_id: organizationId || null,
      amount,
      reason: reason || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchMyCreditRequests(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("credit_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
