import React, { useState, useEffect } from "react";
import { X, Accessibility, Type, Eye, Zap } from "lucide-react";

const STORAGE_KEY = "trainai_accessibility_v1";

const DEFAULTS = { fontSize: "medium", highContrast: false, reducedMotion: false };

// Read the persisted preferences (or defaults if none/invalid saved yet).
export function getStoredAccessibilityPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

// Apply preferences to <html> via classes/CSS custom property. Called both
// from this panel (live, as the user toggles things) and once from App.jsx
// on boot so a saved preference sticks across reloads before the panel is
// ever opened.
export function applyAccessibilityPrefs(prefs) {
  const root = document.documentElement;
  const fontSize = prefs?.fontSize || DEFAULTS.fontSize;

  root.style.setProperty(
    "--tai-a11y-font-scale",
    fontSize === "small" ? "0.92" : fontSize === "large" ? "1.12" : "1"
  );

  root.classList.remove("tai-font-small", "tai-font-medium", "tai-font-large");
  root.classList.add(`tai-font-${fontSize}`);

  root.classList.toggle("tai-high-contrast", !!prefs?.highContrast);
  root.classList.toggle("tai-reduced-motion", !!prefs?.reducedMotion);
}

function persist(prefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

function MiniSwitch({ on, onChange }) {
  return (
    <div
      onClick={onChange}
      role="switch"
      aria-checked={on}
      style={{
        width: 38, height: 22, borderRadius: 99, background: on ? "#2563EB" : "#EFF6FF",
        position: "relative", cursor: "pointer", flexShrink: 0, transition: "background .15s"
      }}
    >
      <div
        style={{
          width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute",
          top: 3, left: on ? 19 : 3, transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.25)"
        }}
      />
    </div>
  );
}

const FONT_SIZES = [
  { key: "small", label: "Small" },
  { key: "medium", label: "Medium" },
  { key: "large", label: "Large" },
];

export default function AccessibilityPanel({ onClose }) {
  const [prefs, setPrefs] = useState(getStoredAccessibilityPrefs);

  // Apply + persist immediately as the user changes anything, so the effect
  // is visible right away rather than only on next boot.
  useEffect(() => {
    applyAccessibilityPrefs(prefs);
    persist(prefs);
  }, [prefs]);

  function update(patch) {
    setPrefs((p) => ({ ...p, ...patch }));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Accessibility settings"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 10000, background: "rgba(16,20,42,.45)",
        display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 440, background: "#FFFFFF", borderRadius: 10,
          boxShadow: "0 20px 60px -15px rgba(16,20,42,.4)", padding: 20,
          maxHeight: "88vh", overflowY: "auto"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Accessibility size={18} color="#2563EB" />
            <div style={{ fontWeight: 800, fontSize: 15.5, color: "#10142A" }}>Accessibility options</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32, height: 32, borderRadius: 8, border: "1px solid #E6E9F5", background: "#FFFFFF",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#656C86"
            }}
          >
            <X size={15} />
          </button>
        </div>
        <p style={{ marginTop: 6, marginBottom: 0, fontSize: 12.5, color: "#656C86", lineHeight: 1.45 }}>
          Adjust how Train AI looks and moves for you. Saved on this device only.
        </p>

        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 700, color: "#10142A" }}>
            <Type size={14} color="#2563EB" /> Text size
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {FONT_SIZES.map(({ key, label }) => {
              const active = prefs.fontSize === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => update({ fontSize: key })}
                  style={{
                    flex: 1, padding: "9px 10px", borderRadius: 8, fontSize: 12.5, fontWeight: 700,
                    cursor: "pointer", border: active ? "1.5px solid #2563EB" : "1.5px solid #E6E9F5",
                    background: active ? "#EFF6FF" : "#FFFFFF", color: active ? "#2563EB" : "#10142A"
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 700, color: "#10142A" }}>
              <Eye size={14} color="#2563EB" /> High contrast
            </div>
            <div style={{ fontSize: 11.5, color: "#9AA1B9", marginTop: 2 }}>Stronger colour contrast for readability</div>
          </div>
          <MiniSwitch on={!!prefs.highContrast} onChange={() => update({ highContrast: !prefs.highContrast })} />
        </div>

        <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 700, color: "#10142A" }}>
              <Zap size={14} color="#2563EB" /> Reduce motion
            </div>
            <div style={{ fontSize: 11.5, color: "#9AA1B9", marginTop: 2 }}>Minimise animations and transitions</div>
          </div>
          <MiniSwitch on={!!prefs.reducedMotion} onChange={() => update({ reducedMotion: !prefs.reducedMotion })} />
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 22, width: "100%", border: "none", cursor: "pointer", borderRadius: 8, fontWeight: 700,
            fontSize: 14, padding: "11px 18px", color: "#fff",
            background: "#2563EB"
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
