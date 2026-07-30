// NOT CURRENTLY USED — nothing imports this component. App.jsx renders
// src/pages/onboarding/OnboardingPage.jsx (an earlier draft of the same
// screen) instead.
import React, { useState } from "react";
import { Check, ArrowRight, BookOpen, Palette, Cpu, Briefcase } from "lucide-react";

const TRACKS = [
  { name: "Data & AI", icon: Cpu },
  { name: "Design", icon: Palette },
  { name: "Engineering", icon: BookOpen },
  { name: "Business", icon: Briefcase },
];

const LEVELS = [
  { key: "beginner", label: "Beginner", desc: "New to this area" },
  { key: "intermediate", label: "Intermediate", desc: "Some hands-on experience" },
  { key: "advanced", label: "Advanced", desc: "Comfortable going deep" },
];

export default function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(0);
  const [tracks, setTracks] = useState([]);
  const [level, setLevel] = useState(null);

  const totalSteps = 2;

  function toggleTrack(t) {
    setTracks((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }

  function next() {
    if (step + 1 >= totalSteps) onComplete({ tracks, level });
    else setStep((s) => s + 1);
  }

  const canContinue =
    (step === 0 && tracks.length > 0) ||
    (step === 1 && !!level);

  return (
    <div style={styles.outer}>
      <style>{`
        @keyframes obFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .ob-card { animation: obFadeUp .3s ease; }
        .ob-option { transition: border-color .12s ease, background-color .12s ease, transform .12s ease; }
        .ob-option:hover { transform: translateY(-1px); }
        .ob-continue:not(:disabled):hover { box-shadow: 0 14px 28px -8px rgba(37,99,235,.55); transform: translateY(-1px); }
      `}</style>

      <div style={styles.glow} />

      <div className="ob-card" style={styles.card}>
        <div style={styles.brandRow}>
          <img src="/brand/train-ai-logo.png" alt="Train AI" style={{ width: 30, height: 30, objectFit: "contain", borderRadius: 0, flexShrink: 0 }} />
          <div style={styles.brandName}>Train AI</div>
        </div>

        <div style={styles.progressRow}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{ ...styles.progressBar, background: i <= step ? "linear-gradient(135deg, #1D4ED8, #60A5FA)" : "#EEF2FF" }} />
          ))}
        </div>

        {step === 0 && (
          <>
            <h1 style={styles.h1}>What do you want to learn?</h1>
            <p style={styles.sub}>Pick one or more — this shapes your course recommendations.</p>
            <div style={styles.optionList}>
              {TRACKS.map((t) => {
                const active = tracks.includes(t.name);
                const Icon = t.icon;
                return (
                  <div
                    key={t.name} className="ob-option" onClick={() => toggleTrack(t.name)}
                    style={{ ...styles.option, ...(active ? styles.optionActive : {}) }}
                  >
                    <div style={{ ...styles.optionIcon, background: active ? "rgba(37,99,235,.12)" : "#F4F6FC" }}>
                      <Icon size={16} color={active ? "#2563EB" : "#656C86"} />
                    </div>
                    <span style={styles.optionLabel}>{t.name}</span>
                    {active && <Check size={17} color="#2563EB" style={{ marginLeft: "auto" }} />}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 style={styles.h1}>What's your current level?</h1>
            <p style={styles.sub}>We'll pace your first few recommendations around this.</p>
            <div style={styles.optionList}>
              {LEVELS.map((l) => {
                const active = level === l.key;
                return (
                  <div key={l.key} className="ob-option" onClick={() => setLevel(l.key)} style={{ ...styles.option, ...(active ? styles.optionActive : {}), alignItems: "flex-start", flexDirection: "column", gap: 2 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
                      <span style={{ ...styles.optionLabel, fontWeight: 700 }}>{l.label}</span>
                      {active && <Check size={16} color="#2563EB" style={{ marginLeft: "auto" }} />}
                    </div>
                    <span style={styles.optionDesc}>{l.desc}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <button
          onClick={next} disabled={!canContinue} className="ob-continue"
          style={{ ...styles.continue, opacity: canContinue ? 1 : 0.4, cursor: canContinue ? "pointer" : "not-allowed" }}
        >
          {step === totalSteps - 1 ? "Complete onboarding" : "Continue"} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

const styles = {
  outer: {
    position: "relative", overflow: "hidden", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "#F4F6FC", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: 20,
  },
  glow: {
    position: "absolute", top: -160, left: "50%", transform: "translateX(-50%)", width: 520, height: 340, borderRadius: "50%",
    background: "radial-gradient(closest-side, rgba(91,127,255,.2), transparent)", pointerEvents: "none",
  },
  card: {
    position: "relative", width: "100%", maxWidth: 420, background: "#fff", borderRadius: 22, padding: 32,
    border: "1px solid #E6E9F5", boxShadow: "0 1px 2px rgba(16,20,42,.04), 0 30px 60px -24px rgba(16,20,42,.18)",
  },
  brandRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 18 },
  brandMark: {
    width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
    background: "linear-gradient(135deg, #1D4ED8 0%, #2563EB 55%, #60A5FA 100%)",
  },
  brandName: { fontWeight: 800, fontSize: 15, color: "#10142A" },
  progressRow: { display: "flex", gap: 6, marginBottom: 24 },
  progressBar: { flex: 1, height: 4, borderRadius: 2, transition: "background .2s ease" },
  h1: { fontSize: 20, fontWeight: 800, margin: "0 0 5px", color: "#10142A", letterSpacing: "-0.01em" },
  sub: { fontSize: 13, color: "#656C86", margin: "0 0 20px", lineHeight: 1.45 },
  optionList: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 },
  option: {
    display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 14,
    border: "1.5px solid #E6E9F5", background: "#fff", cursor: "pointer", userSelect: "none",
  },
  optionActive: { borderColor: "#2563EB", background: "#F4F6FC" },
  optionIcon: { width: 32, height: 32, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  optionLabel: { fontSize: 14, fontWeight: 600, color: "#10142A" },
  optionDesc: { fontSize: 12, color: "#656C86" },
  continue: {
    width: "100%", border: "none", borderRadius: 13, padding: "13px 16px", fontWeight: 700, fontSize: 14,
    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    background: "linear-gradient(135deg, #1D4ED8 0%, #2563EB 55%, #60A5FA 100%)",
    boxShadow: "0 10px 22px -8px rgba(37,99,235,.5)", transition: "transform .12s ease, box-shadow .12s ease",
  },
};
