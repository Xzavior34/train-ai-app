import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";

// Real, server-backed AI credits - replaces a fake localStorage tracker
// that reset to 10 every calendar day regardless of any real payment or
// usage, and that no AI edge function ever checked (confirmed by reading
// every AI edge function in this repo - none referenced it at all). The
// actual balance now lives in ai_credit_accounts (0156_ai_credit_ledger.sql)
// and is only ever changed by the server: consume_ai_credits() is called
// from inside ai-chat before the AI provider is invoked, not by this hook
// or any client code. This hook is a read (and refresh-after-use) view of
// that real balance, nothing more - `consume()` no longer decrements
// anything itself, because doing so client-side is exactly the trust
// model this whole system exists to replace.
//
// Honest scope note: only ai-chat currently calls consume_ai_credits()
// server-side (this pass's implementation). ai-generate-quiz / ai-insights /
// generate-ai-recommendations do not yet - their credit_cost rows already
// exist in ai_operation_costs for when that wiring is done, but until then
// calling consume() from those screens only refreshes the displayed
// balance, it does not yet enforce a real limit on those specific features.
export function useCredits(userId) {
  const [orgBalance, setOrgBalance] = useState(0);
  const [personalBalance, setPersonalBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supabase || !userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_my_ai_credits");
      if (!error && data) {
        setOrgBalance(data.organization_balance || 0);
        setPersonalBalance(data.personal_balance || 0);
      }
    } catch {
      // leave the last-known balance in place rather than zeroing it out
      // on a transient network error
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addCredits = useCallback(async () => {
    // Purchases are recorded server-side (purchase_ai_credits(), called
    // from the real Paystack/Stripe verify flow) - this just re-reads the
    // resulting real balance rather than guessing at a new number locally.
    await refresh();
  }, [refresh]);

  const consume = useCallback(async () => {
    // The actual deduction already happened server-side (or didn't, for
    // the not-yet-wired features noted above) - re-read the real balance
    // so the UI reflects what the server actually did.
    await refresh();
    return orgBalance + personalBalance;
  }, [refresh, orgBalance, personalBalance]);

  return {
    credits: orgBalance + personalBalance,
    organizationBalance: orgBalance,
    personalBalance,
    loading,
    addCredits,
    consume,
    refresh,
  };
}
