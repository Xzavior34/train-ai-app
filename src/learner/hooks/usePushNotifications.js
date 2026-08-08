import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";

// Same VAPID public key hardcoded in the reference app's
// src/services/pushNotificationService.ts (safe to ship client-side by
// design - it's the public half of a keypair). Matching it exactly here
// means subscriptions created by this app are readable by the same
// VAPID_PRIVATE_KEY secret already configured server-side on the live
// "send-push-notification" edge function in this shared Supabase project
// there is no separate key to provision.
const VAPID_PUBLIC_KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBrXhqhE8VIx0-7jvpzo";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// train-ai-app has no vite-plugin-pwa/workbox build step (deliberately not
// adding one here - see task notes), but a static public/sw.js already
// exists in this repo with real "push" and "notificationclick" listeners;
// nothing in the app was registering it before this hook. Registering a
// plain static file via the native Service Worker API needs no new
// dependency, so that's what this does.
async function getRegistration() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing) return existing;
    return await navigator.serviceWorker.register("/sw.js");
  } catch (e) {
    console.warn("Service worker registration failed:", e);
    return null;
  }
}

// Real push_subscriptions row shape (user_id, endpoint, p256dh, auth,
// user_agent) confirmed against the shared schema - identical to what the
// reference app's pushNotificationService.ts writes and what
// send-push-notification's edge function reads back to call web-push with.
export function usePushNotifications(userId) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied"
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const isSupported =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      if (cancelled) return;
      setSupported(isSupported);
      if (!isSupported) {
        setLoading(false);
        return;
      }
      setPermission(Notification.permission);
      try {
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (!cancelled) setSubscribed(!!sub);
      } catch {
        // Treat lookup failures as "not subscribed" - nothing to recover here.
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Requests Notification permission, registers/finds the service worker,
  // creates (or reuses) a real Web Push subscription, and stores it in
  // push_subscriptions so the live send-push-notification edge function can
  // find it. Returns false at any step that isn't possible instead of
  // throwing, since this is always driven from a UI toggle.
  const requestAndSubscribe = useCallback(async () => {
    if (!supported || !userId) return false;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return false;

      const reg = await getRegistration();
      if (!reg) return false;

      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const json = subscription.toJSON();
      if (!supabase || !json?.endpoint || !json?.keys?.p256dh || !json?.keys?.auth) return false;

      // Avoid piling up duplicate rows for the same endpoint on repeat
      // clicks - no assumption made about a unique constraint existing on
      // (user_id, endpoint), so this checks first instead of using upsert.
      const { data: existing } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", userId)
        .eq("endpoint", json.endpoint)
        .maybeSingle();

      if (!existing) {
        const { error } = await supabase.from("push_subscriptions").insert({
          user_id: userId,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          user_agent: navigator.userAgent,
        });
        if (error) {
          console.warn("Could not store push subscription:", error);
          return false;
        }
      }

      setSubscribed(true);
      return true;
    } catch (e) {
      console.warn("Push subscription failed:", e);
      return false;
    } finally {
      setBusy(false);
    }
  }, [supported, userId]);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await getRegistration();
      const subscription = reg ? await reg.pushManager.getSubscription() : null;
      if (subscription) {
        const { endpoint } = subscription;
        await subscription.unsubscribe();
        if (supabase && userId) {
          await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
        }
      }
      setSubscribed(false);
      return true;
    } catch (e) {
      console.warn("Push unsubscribe failed:", e);
      return false;
    } finally {
      setBusy(false);
    }
  }, [userId]);

  // Real round trip through the live "send-push-notification" edge function,
  // targeting the caller's own user_id (always allowed - the function only
  // requires the admin role for sending to *other* users). Lets the
  // Profile screen offer a "send me a test push" action once subscribed.
  const sendTestPush = useCallback(async () => {
    if (!supabase || !userId) return { ok: false, error: "Not signed in" };
    try {
      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: { user_id: userId, title: "Train AI", message: "Push notifications are working." },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  }, [userId]);

  // Fallback path for an immediate, in-app-triggered reminder that doesn't
  // need a round trip to the server. This only fires while the page/tab is
  // open - true push-while-the-app-is-closed still requires the real
  // subscribe() flow above (which this app now has) plus something
  // server-side actually invoking send-push-notification later.
  const showLocalNotification = useCallback((title, options = {}) => {
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
      return false;
    }
    try {
      new Notification(title, options);
      return true;
    } catch (e) {
      console.warn("Local notification failed:", e);
      return false;
    }
  }, []);

  return {
    supported,
    permission,
    subscribed,
    loading,
    busy,
    requestAndSubscribe,
    unsubscribe,
    sendTestPush,
    showLocalNotification,
  };
}
