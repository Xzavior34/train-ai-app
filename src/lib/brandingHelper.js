// Global dynamic branding system
// Applies organization branding (colors, logo, custom CSS) to the entire
// application in real-time. Called from App.jsx on boot and from
// BrandingScreen.jsx on save/org-change so every dashboard inherits it.
import { useEffect, useState } from "react";
import { fetchOrgBranding } from "./api/platform.js";
import { supabase } from "./supabaseClient.js";

const BRANDING_CACHE_KEY = "trainai_active_branding";

// Lighten a hex color by mixing it with white at `amount` ratio (0–1)
function lightenHex(hex, amount = 0.85) {
  try {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const lr = Math.round(r + (255 - r) * amount);
    const lg = Math.round(g + (255 - g) * amount);
    const lb = Math.round(b + (255 - b) * amount);
    return `rgb(${lr},${lg},${lb})`;
  } catch {
    return hex;
  }
}

// Darken a hex color by mixing with black at `amount` ratio (0–1)
function darkenHex(hex, amount = 0.15) {
  try {
    const h = hex.replace("#", "");
    const r = Math.round(parseInt(h.slice(0, 2), 16) * (1 - amount));
    const g = Math.round(parseInt(h.slice(2, 4), 16) * (1 - amount));
    const b = Math.round(parseInt(h.slice(4, 6), 16) * (1 - amount));
    return `rgb(${r},${g},${b})`;
  } catch {
    return hex;
  }
}

export function applyDynamicBranding(branding) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  const primary = branding?.primary_color || branding?.primaryColor || null;
  if (primary && /^#[0-9a-fA-F]{3,6}$/.test(primary)) {
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--primary-hover", darkenHex(primary, 0.12));
    root.style.setProperty("--primary-light", lightenHex(primary, 0.8));
    root.style.setProperty("--primary-tint", lightenHex(primary, 0.92));
  }

  const secondary = branding?.secondary_color || branding?.secondaryColor || null;
  if (secondary && /^#[0-9a-fA-F]{3,6}$/.test(secondary)) {
    root.style.setProperty("--secondary", secondary);
  }

  // Store logo URL as CSS variable AND in localStorage so components can read it
  const logoUrl = branding?.logo_url || branding?.logoUrl || null;
  if (logoUrl) {
    root.style.setProperty("--brand-logo-url", `url('${logoUrl}')`);
    try { localStorage.setItem("trainai_brand_logo", logoUrl); } catch {}
  } else {
    root.style.removeProperty("--brand-logo-url");
    try { localStorage.removeItem("trainai_brand_logo"); } catch {}
  }

  // Inject / update custom CSS tag in document.head
  let customStyleTag = document.getElementById("trainai-custom-branding");
  const css = branding?.custom_css || branding?.customCss || "";
  if (css && css.trim()) {
    if (!customStyleTag) {
      customStyleTag = document.createElement("style");
      customStyleTag.id = "trainai-custom-branding";
      document.head.appendChild(customStyleTag);
    }
    customStyleTag.textContent = css;
  } else if (customStyleTag) {
    customStyleTag.textContent = "";
  }

  // Cache the normalized branding object in localStorage so the next page
  // load can apply it before any async fetch completes (avoids a color flash)
  try {
    const normalized = {
      primary_color: primary,
      secondary_color: secondary,
      logo_url: logoUrl,
      custom_css: css,
    };
    localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(normalized));
  } catch {}

  // Broadcast to all simultaneously-mounted dashboards / components
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("trainai-branding-change", { detail: branding }));
  }
}

// Apply cached branding immediately from localStorage (zero-latency, avoids
// color flash before the async Supabase fetch returns)
export function applyCachedBranding() {
  try {
    const raw = localStorage.getItem(BRANDING_CACHE_KEY);
    if (raw) applyDynamicBranding(JSON.parse(raw));
  } catch {}
}

export async function initDynamicBranding(organizationId) {
  // Apply cached version first for instant paint, then fetch fresh
  applyCachedBranding();

  try {
    let targetOrgId = organizationId;
    if (!targetOrgId && supabase) {
      // Only query organizations if there is an active authenticated session.
      // Querying unauthenticated triggers RLS 403 errors on the login screen.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) return null;

      const { data: defaultOrg } = await supabase
        .from("organizations")
        .select("id")
        .limit(1)
        .maybeSingle();
      targetOrgId = defaultOrg?.id;
    }
    if (targetOrgId) {
      const branding = await fetchOrgBranding(targetOrgId);
      if (branding) {
        applyDynamicBranding(branding);
        return branding;
      }
    }
  } catch (e) {
    console.warn("Dynamic branding init error:", e);
  }
  return null;
}

// React hook: returns current branding object and re-renders on any
// branding-change event (e.g. when super admin saves new colors on BrandingScreen)
export function useDynamicBranding(organizationId) {
  const [branding, setBranding] = useState(() => {
    try {
      const raw = localStorage.getItem(BRANDING_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  useEffect(() => {
    let active = true;
    initDynamicBranding(organizationId).then((data) => {
      if (active && data) setBranding(data);
    });

    function handleBrandingChange(e) {
      if (active && e.detail) {
        setBranding(e.detail);
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener("trainai-branding-change", handleBrandingChange);
    }
    return () => {
      active = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("trainai-branding-change", handleBrandingChange);
      }
    };
  }, [organizationId]);

  return branding;
}
