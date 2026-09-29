import OneSignal from "react-onesignal";

// Default or fallback OneSignal App ID (can be overridden via VITE_ONESIGNAL_APP_ID in .env.local)
export const ONESIGNAL_APP_ID =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_ONESIGNAL_APP_ID) ||
  (typeof process !== "undefined" && process.env?.VITE_ONESIGNAL_APP_ID) ||
  "7816e190-f530-4432-a59f-76c5c2cca236";

let isInitialized = false;
let initPromise = null;

/**
 * Initializes OneSignal Web SDK once.
 */
export async function initOneSignal() {
  if (typeof window === "undefined") return false;

  if (isInitialized) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (!ONESIGNAL_APP_ID || ONESIGNAL_APP_ID === "00000000-0000-0000-0000-000000000000") {
        console.info(
          "[OneSignal] Placeholder App ID detected. Set VITE_ONESIGNAL_APP_ID in .env.local for production device push."
        );
      }

      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        notifyButton: {
          enable: false, // We render custom UI triggers in ProfileScreen
        },
        serviceWorkerParam: {
          scope: "/",
        },
        serviceWorkerPath: "OneSignalSDKWorker.js",
      });

      isInitialized = true;
      console.log("[OneSignal] Initialized successfully");
      return true;
    } catch (err) {
      console.warn("[OneSignal] Initialization error:", err);
      return false;
    }
  })();

  return initPromise;
}

/**
 * Associates the logged-in user ID with OneSignal for targeted push notifications.
 */
export async function loginOneSignalUser(userId) {
  if (!userId) return;
  try {
    const ok = await initOneSignal();
    if (!ok) return;
    await OneSignal.login(userId);
    console.log(`[OneSignal] Logged in user: ${userId}`);
  } catch (err) {
    console.warn("[OneSignal] Login user failed:", err);
  }
}

/**
 * Logs out user from OneSignal on sign out.
 */
export async function logoutOneSignalUser() {
  try {
    if (isInitialized && typeof OneSignal.logout === "function") {
      await OneSignal.logout();
      console.log("[OneSignal] Logged out user");
    }
  } catch (err) {
    console.warn("[OneSignal] Logout failed:", err);
  }
}

/**
 * Requests device push notification permission via OneSignal.
 */
export async function requestOneSignalPushPermission() {
  try {
    const ok = await initOneSignal();
    if (!ok) return false;

    if (OneSignal.Notifications && typeof OneSignal.Notifications.requestPermission === "function") {
      await OneSignal.Notifications.requestPermission();
      return Notification.permission === "granted";
    }
    
    // Fallback native permission
    if ("Notification" in window) {
      const perm = await Notification.requestPermission();
      return perm === "granted";
    }

    return false;
  } catch (err) {
    console.warn("[OneSignal] Permission request error:", err);
    return false;
  }
}

/**
 * Gets current OneSignal push subscription info.
 */
export function getOneSignalSubscriptionState() {
  if (typeof window === "undefined" || !isInitialized) {
    return { optedIn: false, id: null, token: null };
  }
  try {
    const sub = OneSignal.User?.PushSubscription;
    return {
      optedIn: !!sub?.optedIn,
      id: sub?.id || null,
      token: sub?.token || null,
    };
  } catch {
    return { optedIn: false, id: null, token: null };
  }
}

export default OneSignal;
