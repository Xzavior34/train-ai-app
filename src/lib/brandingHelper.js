// Global dynamic branding system
// Applies organization branding (colors, logo, custom CSS) to the entire
// application in real-time. Called from App.jsx on boot and from
// BrandingScreen.jsx on save/org-change so every dashboard inherits it.
import { useEffect, useState } from "react";
import { fetchOrgBranding } from "./api/platform.js";
import { supabase } from "./supabaseClient.js";

const BRANDING_CACHE_KEY = "trainai_active_branding";

export function resetDynamicBranding() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.removeProperty("--primary");
  root.style.removeProperty("--primary-rgb");
  root.style.removeProperty("--primary-hover");
  root.style.removeProperty("--primary-dark");
  root.style.removeProperty("--primary-light");
  root.style.removeProperty("--primary-tint");
  root.style.removeProperty("--brand-glow");
  root.style.removeProperty("--secondary");
  root.style.removeProperty("--secondary-rgb");
  root.style.removeProperty("--accent-gradient");
  root.style.removeProperty("--brand-logo-url");

  const customStyleTag = document.getElementById("trainai-custom-branding");
  if (customStyleTag) customStyleTag.textContent = "";

  try {
    localStorage.removeItem("trainai_brand_logo");
  } catch {}

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("trainai-branding-change", { detail: null }));
  }
}

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

// Convert hex to comma-separated RGB values "r, g, b"
export function hexToRgb(hex) {
  try {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    const r = parseInt(full.slice(0, 2), 16) || 0;
    const g = parseInt(full.slice(2, 4), 16) || 0;
    const b = parseInt(full.slice(4, 6), 16) || 0;
    return `${r}, ${g}, ${b}`;
  } catch {
    return "37, 99, 235";
  }
}

export function applyDynamicBranding(branding, organizationId = null) {
  if (typeof document === "undefined") return;

  const primary = branding?.primary_color || branding?.primaryColor || null;
  const secondary = branding?.secondary_color || branding?.secondaryColor || null;
  const logoUrl = branding?.logo_url || branding?.logoUrl || null;
  const css = branding?.custom_css || branding?.customCss || "";

  // If no branding values exist or empty reset object, reset to Train AI defaults
  const hasCustomBranding = (primary && /^#[0-9a-fA-F]{3,6}$/.test(primary)) ||
    (secondary && /^#[0-9a-fA-F]{3,6}$/.test(secondary)) ||
    logoUrl ||
    (css && css.trim().length > 0);

  if (!hasCustomBranding) {
    resetDynamicBranding();
    if (organizationId) {
      try { localStorage.removeItem(`trainai_branding_${organizationId}`); } catch {}
    }
    return;
  }

  const root = document.documentElement;
  const isDark = root.classList.contains("dark") || (typeof localStorage !== "undefined" && localStorage.getItem("trainai_theme_dark") === "true");

  if (primary && /^#[0-9a-fA-F]{3,6}$/.test(primary)) {
    const rgb = hexToRgb(primary);
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--primary-rgb", rgb);
    root.style.setProperty("--primary-hover", darkenHex(primary, 0.12));
    root.style.setProperty("--primary-dark", darkenHex(primary, 0.25));
    root.style.setProperty("--primary-light", isDark ? lightenHex(primary, 0.4) : lightenHex(primary, 0.8));
    root.style.setProperty("--primary-tint", isDark ? `rgba(${rgb}, 0.18)` : lightenHex(primary, 0.92));
    root.style.setProperty("--brand-glow", `0 0 24px rgba(${rgb}, 0.35)`);
  } else {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--primary-rgb");
    root.style.removeProperty("--primary-hover");
    root.style.removeProperty("--primary-dark");
    root.style.removeProperty("--primary-light");
    root.style.removeProperty("--primary-tint");
    root.style.removeProperty("--brand-glow");
  }

  if (secondary && /^#[0-9a-fA-F]{3,6}$/.test(secondary)) {
    const secRgb = hexToRgb(secondary);
    root.style.setProperty("--secondary", secondary);
    root.style.setProperty("--secondary-rgb", secRgb);
    root.style.setProperty("--accent-gradient", `linear-gradient(135deg, ${primary || "var(--primary)"}, ${secondary})`);
  } else if (primary) {
    root.style.setProperty("--accent-gradient", `linear-gradient(135deg, ${primary}, ${darkenHex(primary, 0.2)})`);
  } else {
    root.style.removeProperty("--secondary");
    root.style.removeProperty("--secondary-rgb");
    root.style.removeProperty("--accent-gradient");
  }

  // Store logo URL as CSS variable AND in localStorage so components can read it
  if (logoUrl) {
    root.style.setProperty("--brand-logo-url", `url('${logoUrl}')`);
    try { localStorage.setItem("trainai_brand_logo", logoUrl); } catch {}
  } else {
    root.style.removeProperty("--brand-logo-url");
    try { localStorage.removeItem("trainai_brand_logo"); } catch {}
  }

  // Inject / update custom CSS tag in document.head
  let customStyleTag = document.getElementById("trainai-custom-branding");
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

  // Cache normalized branding object strictly scoped to this organization
  try {
    const normalized = {
      primary_color: primary,
      secondary_color: secondary,
      logo_url: logoUrl,
      custom_css: css,
    };
    if (organizationId) {
      localStorage.setItem(`trainai_branding_${organizationId}`, JSON.stringify(normalized));
    }
  } catch {}

  // Broadcast to all simultaneously-mounted dashboards / components
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("trainai-branding-change", { detail: branding }));
  }
}

// Apply cached branding immediately from localStorage for a specific organization
export function applyCachedBranding(organizationId = null) {
  if (!organizationId) {
    resetDynamicBranding();
    return;
  }
  try {
    const raw = localStorage.getItem(`trainai_branding_${organizationId}`);
    if (raw) {
      applyDynamicBranding(JSON.parse(raw), organizationId);
    } else {
      resetDynamicBranding();
    }
  } catch {}
}

export async function initDynamicBranding(organizationId) {
  if (!organizationId) {
    // When no organization context is active, strictly revert to Train AI defaults
    resetDynamicBranding();
    return null;
  }

  // Apply cached version first for instant paint without flash
  applyCachedBranding(organizationId);

  try {
    const branding = await fetchOrgBranding(organizationId);
    if (branding && (branding.primary_color || branding.secondary_color || branding.logo_url || branding.custom_css)) {
      applyDynamicBranding(branding, organizationId);
      return branding;
    } else {
      resetDynamicBranding();
      try { localStorage.removeItem(`trainai_branding_${organizationId}`); } catch {}
      return null;
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
    if (!organizationId) return null;
    try {
      const raw = localStorage.getItem(`trainai_branding_${organizationId}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  useEffect(() => {
    let active = true;
    if (!organizationId) {
      resetDynamicBranding();
      setBranding(null);
      return;
    }

    initDynamicBranding(organizationId).then((data) => {
      if (active) setBranding(data);
    });

    function handleBrandingChange(e) {
      if (active) {
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
