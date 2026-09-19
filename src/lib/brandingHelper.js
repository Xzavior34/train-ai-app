// Utility to dynamically apply organization or platform branding globally across all components and pages
import { useEffect, useState } from "react";
import { fetchOrgBranding } from "./api/platform.js";
import { supabase } from "./supabaseClient.js";

export function applyDynamicBranding(branding) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  const primary = branding?.primary_color || branding?.primaryColor || null;
  if (primary) {
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--primary-hover", primary);
    root.style.setProperty("--primary-light", primary);
  }

  const secondary = branding?.secondary_color || branding?.secondaryColor || null;
  if (secondary) {
    root.style.setProperty("--secondary", secondary);
  }

  // Inject or update dynamic custom CSS tag in document.head
  let customStyleTag = document.getElementById("trainai-custom-branding");
  const css = branding?.custom_css || branding?.customCss || "";
  if (css.trim()) {
    if (!customStyleTag) {
      customStyleTag = document.createElement("style");
      customStyleTag.id = "trainai-custom-branding";
      document.head.appendChild(customStyleTag);
    }
    customStyleTag.textContent = css;
  } else if (customStyleTag) {
    customStyleTag.textContent = "";
  }

  // Dispatch custom event for real-time live UI updates
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("trainai-branding-change", { detail: branding }));
  }
}

export async function initDynamicBranding(organizationId) {
  try {
    let targetOrgId = organizationId;
    if (!targetOrgId && supabase) {
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

export function useDynamicBranding(organizationId) {
  const [branding, setBranding] = useState(null);

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

