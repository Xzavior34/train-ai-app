import React, { useState, useEffect } from "react";
import { Cookie } from "lucide-react";
import { saveConsentPreferences } from "../../lib/api/gdprService.js";

const STORAGE_KEY = "trainai_consent_v1";
const POLICY_VERSION = "2026-07-29";

const DEFAULT_CHOICES = { essential: true, analytics: false, marketing: false };

const ROWS = [
  { key: "essential", label: "Strictly necessary", desc: "Required for the app to work. Always on.", locked: true },
  { key: "analytics", label: "Analytics", desc: "Helps us understand how learners use Train AI." },
  { key: "marketing", label: "Marketing", desc: "Used to tailor offers and announcements." },
];

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeStored(choices, synced) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: POLICY_VERSION, choices, ts: Date.now(), synced }));
}

function MiniSwitch({ on, onChange, disabled }) {
  return (
    <div
      onClick={disabled ? undefined : onChange}
      role="switch"
      aria-checked={on}
      style={{
        width: 36, height: 21, borderRadius: 99, background: on ? "#2563EB" : "#EFF6FF",
        position: "relative", cursor: disabled ? "default" : "pointer", flexShrink: 0,
        opacity: disabled ? 0.6 : 1, transition: "background .15s"
      }}
    >
      <div
        style={{
          width: 15, height: 15, borderRadius: "50%", background: "#fff", position: "absolute",
          top: 3, left: on ? 18 : 3, transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.25)"
        }}
      />
    </div>
  );
}

const primaryBtnStyle = {
  border: "none", cursor: "pointer", borderRadius: 8, fontWeight: 700, fontSize: 12.5, padding: "9px 14px",
  background: "#2563EB", color: "#fff"
};
const outlineBtnStyle = {
  border: "1.5px solid #E6E9F5", cursor: "pointer", borderRadius: 8, fontWeight: 700, fontSize: 12.5,
  padding: "9px 14px", background: "transparent", color: "#10142A"
};
const ghostBtnStyle = {
  border: "none", cursor: "pointer", borderRadius: 8, fontWeight: 700, fontSize: 12.5, padding: "9px 14px",
  background: "#EFF6FF", color: "#2563EB"
};

// Bottom-of-screen GDPR-style cookie consent banner. Shown once per policy
// version to first-time visitors (tracked in localStorage). Also records the
// choice server-side via gdprService.saveConsentPreferences(userId, prefs)
// once the visitor is authenticated - if they decide while signed out, the
// locally-stored choice is synced the next time `session` becomes available
// (e.g. right after they log in), so it isn't lost and isn't overengineered
// with its own auth flow.
export default function ConsentBanner({ session }) {
  const [open, setOpen] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [choices, setChoices] = useState(DEFAULT_CHOICES);

  useEffect(() => {
    const stored = readStored();
    if (!stored || stored.version !== POLICY_VERSION || !stored.choices) {
      setOpen(true);
    } else {
      setChoices(stored.choices);
    }
  }, []);

  // Sync a locally-decided consent choice to the backend once we have an
  // authenticated session, if it hasn't been recorded there yet.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    const stored = readStored();
    if (stored && stored.version === POLICY_VERSION && stored.choices && !stored.synced) {
      saveConsentPreferences(userId, stored.choices)
        .then((res) => {
          if (res?.success) writeStored(stored.choices, true);
        })
        .catch(() => {
          // best-effort - never block UX on this
        });
    }
  }, [session?.user?.id]);

  function save(nextChoices) {
    writeStored(nextChoices, false);
    setChoices(nextChoices);

    const userId = session?.user?.id;
    if (userId) {
      saveConsentPreferences(userId, nextChoices)
        .then((res) => {
          if (res?.success) writeStored(nextChoices, true);
        })
        .catch(() => {});
    }

    setOpen(false);
    setShowPrefs(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 9999,
        display: "flex", justifyContent: "center", padding: 12, pointerEvents: "none"
      }}
    >
      <div
        style={{
          pointerEvents: "auto", width: "100%", maxWidth: 480, background: "#FFFFFF",
          border: "1px solid #E6E9F5", borderRadius: 10, boxShadow: "0 20px 50px -15px rgba(16,20,42,.35)",
          padding: 18
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%", background: "#EFF6FF",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
          }}>
            <Cookie size={17} color="#2563EB" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#10142A" }}>We value your privacy</div>
            <p style={{ marginTop: 4, marginBottom: 0, fontSize: 12.5, color: "#656C86", lineHeight: 1.45 }}>
              We use cookies for essential functionality and, with your consent, for analytics and marketing.
              You can change your choices anytime from Profile &gt; Privacy &amp; Data.
            </p>

            {showPrefs && (
              <div style={{
                marginTop: 12, display: "flex", flexDirection: "column", gap: 10,
                border: "1px solid #E6E9F5", borderRadius: 8, padding: 12
              }}>
                {ROWS.map((row) => (
                  <div key={row.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#10142A" }}>{row.label}</div>
                      <div style={{ fontSize: 11, color: "#9AA1B9" }}>{row.desc}</div>
                    </div>
                    <MiniSwitch
                      on={!!choices[row.key]}
                      disabled={row.locked}
                      onChange={() => !row.locked && setChoices((p) => ({ ...p, [row.key]: !p[row.key] }))}
                    />
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowPrefs((s) => !s)} style={ghostBtnStyle}>
                {showPrefs ? "Hide preferences" : "Manage cookies"}
              </button>
              <button
                type="button"
                onClick={() => save({ essential: true, analytics: false, marketing: false })}
                style={outlineBtnStyle}
              >
                Reject non-essential
              </button>
              {showPrefs ? (
                <button type="button" onClick={() => save(choices)} style={primaryBtnStyle}>
                  Save choices
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => save({ essential: true, analytics: true, marketing: true })}
                  style={primaryBtnStyle}
                >
                  Accept all
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
