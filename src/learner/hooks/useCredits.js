import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { normalizeCreditBalance } from "../utils/creditBalance.js";

// The provider endpoint charges once. These callbacks only refresh that balance.
export function useCredits(userId) {
  const [state, setState] = useState({ organizationBalance: 0, personalBalance: 0, loading: true, error: null });
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setState({ organizationBalance: 0, personalBalance: 0, loading: true, error: null });
    try {
      if (!supabase || !userId) return 0;
      const { data, error } = await supabase.rpc("get_my_ai_credits");
      if (error || data?.error) throw new Error("AI balance is unavailable. Please retry.");
      const balance = normalizeCreditBalance(data);
      if (request === generation.current) setState({ ...balance, loading: false, error: null });
      return balance.organizationBalance + balance.personalBalance;
    } catch (error) {
      if (request === generation.current) setState({ organizationBalance: 0, personalBalance: 0, loading: false, error: error.message });
      return 0;
    } finally {
      if (request === generation.current) setState(s => ({ ...s, loading: false }));
    }
  }, [userId]);
  useEffect(() => { refresh(); return () => { generation.current += 1; }; }, [refresh]);
  return { ...state, credits: state.organizationBalance + state.personalBalance, refresh, consume: refresh, addCredits: refresh };
}
