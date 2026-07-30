import { useCallback, useEffect, useState } from "react";

const DEFAULT_DAILY_CREDITS = 10;
const todayKey = () => new Date().toISOString().slice(0, 10);
const storageKey = (userId) => `taiCredits:${userId || "guest"}`;

// Lightweight client-side AI credits tracker (mirrors the reference
// train-ai-ltd-main app's useCredits hook). The paystack-initialize /
// stripe-initialize edge functions explicitly do NOT persist anything
// server-side for the "credits" payment context ("credits are client-stored"
// per their own comments) — there is no credits table in this app's schema
// either, so this hook is the source of truth for the balance shown in the
// UI. Resets to DEFAULT_DAILY_CREDITS every calendar day.
export function useCredits(userId) {
  const [credits, setCredits] = useState(DEFAULT_DAILY_CREDITS);

  const load = useCallback(() => {
    try {
      const raw = localStorage.getItem(storageKey(userId));
      if (!raw) {
        setCredits(DEFAULT_DAILY_CREDITS);
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed.date !== todayKey()) {
        setCredits(DEFAULT_DAILY_CREDITS);
        localStorage.setItem(storageKey(userId), JSON.stringify({ date: todayKey(), remaining: DEFAULT_DAILY_CREDITS }));
      } else {
        setCredits(Math.max(0, parsed.remaining));
      }
    } catch {
      setCredits(DEFAULT_DAILY_CREDITS);
    }
  }, [userId]);

  useEffect(() => {
    load();
    const onStorage = (e) => {
      if (e.key === storageKey(userId)) load();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [load, userId]);

  function persist(remaining) {
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify({ date: todayKey(), remaining }));
    } catch {
      // ignore — worst case the balance just doesn't survive a reload
    }
    setCredits(remaining);
  }

  const addCredits = useCallback((amount) => {
    persist(credits + (Number(amount) || 0));
  }, [credits]);

  const consume = useCallback((amount = 1) => {
    const next = Math.max(0, credits - amount);
    persist(next);
    return next;
  }, [credits]);

  return { credits, addCredits, consume, dailyAllowance: DEFAULT_DAILY_CREDITS };
}
