import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";

const WELCOME_FREE_CREDITS = 20;

function getStorageKey(userId) {
  return `trainai_user_ai_credits_v2_${userId || "anon"}`;
}

function readLocalCreditLedger(userId) {
  if (typeof window === "undefined" || !userId) {
    return {
      initialized: true,
      welcomeGranted: WELCOME_FREE_CREDITS,
      consumed: 0,
      purchased: 0,
      balance: WELCOME_FREE_CREDITS,
    };
  }
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.balance === "number") {
        return {
          initialized: true,
          welcomeGranted: WELCOME_FREE_CREDITS,
          consumed: Math.max(0, Number(parsed.consumed || 0)),
          purchased: Math.max(0, Number(parsed.purchased || 0)),
          balance: Math.max(0, Number(parsed.balance)),
        };
      }
    }
  } catch {
    // Ignore storage read errors
  }

  const initial = {
    initialized: true,
    welcomeGranted: WELCOME_FREE_CREDITS,
    consumed: 0,
    purchased: 0,
    balance: WELCOME_FREE_CREDITS,
  };
  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(initial));
  } catch {
    // Ignore storage write errors
  }
  return initial;
}

function writeLocalCreditLedger(userId, nextState) {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(nextState));
  } catch {
    // Ignore storage write errors
  }
}

export function useCredits(userId) {
  const [orgBalance, setOrgBalance] = useState(0);
  const [personalBalance, setPersonalBalance] = useState(() => {
    const ledger = readLocalCreditLedger(userId);
    return ledger.balance;
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const localLedger = readLocalCreditLedger(userId);

    if (!supabase || !userId) {
      setOrgBalance(0);
      setPersonalBalance(localLedger.balance);
      setLoading(false);
      return localLedger.balance;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_my_ai_credits");
      if (!error && data && !data.error) {
        const serverOrgBalance = Math.max(
          0,
          Number(data.org_balance ?? data.organization_balance ?? 0)
        );
        const serverPersonalBalance = Math.max(
          0,
          Number(data.personal_balance ?? 0)
        );

        setOrgBalance(serverOrgBalance);

        // If the server already tracks a positive balance, sync with it while
        // respecting any client-side deductions made in the current session.
        if (serverPersonalBalance > 0) {
          const effectivePersonal =
            localLedger.consumed > 0 && serverPersonalBalance === WELCOME_FREE_CREDITS
              ? Math.max(0, serverPersonalBalance - localLedger.consumed + localLedger.purchased)
              : serverPersonalBalance;
          setPersonalBalance(effectivePersonal);
          writeLocalCreditLedger(userId, {
            ...localLedger,
            balance: effectivePersonal,
          });
          return serverOrgBalance + effectivePersonal;
        }

        // If the server returned 0 because the learner row hasn't been lazily
        // initialized with the 20 welcome credits yet, use the persistent
        // one-time 20-credit welcome ledger (which stays at 0 once exhausted).
        setPersonalBalance(localLedger.balance);
        return serverOrgBalance + localLedger.balance;
      }

      setPersonalBalance(localLedger.balance);
      return localLedger.balance;
    } catch {
      setPersonalBalance(localLedger.balance);
      return localLedger.balance;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addCredits = useCallback(
    async (amount = 0) => {
      const numericAmount = Math.max(0, Number(amount || 0));
      if (numericAmount > 0 && userId) {
        const current = readLocalCreditLedger(userId);
        const updated = {
          ...current,
          purchased: current.purchased + numericAmount,
          balance: current.balance + numericAmount,
        };
        writeLocalCreditLedger(userId, updated);
        setPersonalBalance(updated.balance);
      }
      await refresh();
    },
    [refresh, userId]
  );

  const consume = useCallback(
    async (cost = 1, operationKey = "ai_chat_message") => {
      const deduction = Math.max(1, Number(cost || 1));
      const current = readLocalCreditLedger(userId);
      const nextPersonal = Math.max(0, current.balance - deduction);
      const updated = {
        ...current,
        consumed: current.consumed + deduction,
        balance: nextPersonal,
      };
      writeLocalCreditLedger(userId, updated);
      setPersonalBalance(nextPersonal);

      if (supabase && userId) {
        try {
          await supabase.rpc("consume_ai_credits", {
            p_operation_key: operationKey,
          });
        } catch {
          // Server-side RPC may be restricted to edge functions; local ledger keeps accurate track
        }
      }

      return orgBalance + nextPersonal;
    },
    [userId, orgBalance]
  );

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
