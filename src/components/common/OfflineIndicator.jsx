import React from "react";
import { WifiOff, Wifi } from "lucide-react";

// Purely presentational fixed top banner. The actual online/offline
// detection lives in App.jsx's `online`/`offline` window event listeners
// this component just renders whichever `mode` it's told about:
//   "offline" -> persistent red banner while navigator.onLine is false
//   "online"  -> brief green confirmation banner right after reconnecting
//   null/undefined -> renders nothing
//
// Pairs with the cache-first strategy added to public/sw.js: while this
// banner is showing "offline", previously-visited screens and the cached
// app shell (index.html + static JS/CSS) keep working from the service
// worker's cache, and Supabase calls simply fail fast instead of hanging.
export default function OfflineIndicator({ mode }) {
  if (!mode) return null;
  const isOffline = mode === "offline";

  return (
    <div
      role="status"
      aria-live="polite"
      style={styles.banner(isOffline)}
    >
      <style>{`@keyframes offlineSlideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }`}</style>
      {isOffline ? <WifiOff size={14} /> : <Wifi size={14} />}
      <span>
        {isOffline
          ? "You're offline. Showing cached content where available."
          : "Back online."}
      </span>
    </div>
  );
}

const styles = {
  banner: (isOffline) => ({
    position: "fixed", top: 0, left: 0, right: 0, zIndex: 10000,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: "9px 16px", fontSize: 12.5, fontWeight: 700, textAlign: "center",
    color: "#fff", background: isOffline ? "#EF4444" : "#17A673",
    boxShadow: "0 4px 14px -6px rgba(16,20,42,.35)",
    animation: "offlineSlideDown .25s ease both",
  }),
};
