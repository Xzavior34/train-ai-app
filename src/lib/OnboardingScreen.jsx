// NOT CURRENTLY USED - nothing imports this component. App.jsx renders
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
        .ob-continue:not(:disabled):hover { box-shadow: 0 14px 28px -8px rgba(79,70,229,.55); transform: translateY(-1px); }
      `}</style>

      <div style={styles.glow} />

      <div className="ob-card" style={styles.card}>
        <div style={styles.brandRow}>
          <img src="/brand/train-ai-logo.png" alt="Train AI" style={{ width: 30, height: 30, objectFit: "contain", borderRadius: 0, flexShrink: 0 }} />
          <div style={styles.brandName}>Train AI</div>
        </div>

        <div style={styles.progressRow}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{ ...styles.progressBar, background: i <= step ? "#4F46E5" : "#EEF2FF" }} />
          ))}
        </div>

        {step === 0 && (
          <>
            <h1 style={styles.h1}>What do you want to learn?</h1>
            <p style={styles.sub}>Pick one or more. This shapes your course recommendations.</p>
            <div style={styles.optionList}>
              {TRACKS.map((t) => {
                const active = tracks.includes(t.name);
                const Icon = t.icon;
                return (
                  <div
                    key={t.name} className="ob-option" onClick={() => toggleTrack(t.name)}
                    style={{ ...styles.option, ...(active ? styles.optionActive : {}) }}
                  >
                    <div style={{ ...styles.optionIcon, background: active ? "rgba(79,70,229,.12)" : "#F4F6FC" }}>
                      <Icon size={16} color={active ? "#4F46E5" : "#656C86"} />
                    </div>
                    <span style={styles.optionLabel}>{t.name}</span>
                    {active && <Check size={17} color="#4F46E5" style={{ marginLeft: "auto" }} />}
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
                      {active && <Check size={16} color="#4F46E5" style={{ marginLeft: "auto" }} />}
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
  glow: { display: "none" },
  card: {
    position: "relative", width: "100%", maxWidth: 420, background: "#fff", borderRadius: 8, padding: 32,
    border: "1px solid #E2E8F0", boxShadow: "0 4px 16px rgba(15, 23, 42, 0.06)",
  },
  brandRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 18 },
  brandMark: {
    width: 30, height: 30, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
    background: "#4F46E5",
  },
  brandName: { fontWeight: 800, fontSize: 15, color: "#10142A" },
  progressRow: { display: "flex", gap: 6, marginBottom: 24 },
  progressBar: { flex: 1, height: 4, borderRadius: 2, transition: "background .2s ease" },
  h1: { fontSize: 20, fontWeight: 800, margin: "0 0 5px", color: "#10142A", letterSpacing: "-0.01em" },
  sub: { fontSize: 13, color: "#656C86", margin: "0 0 20px", lineHeight: 1.45 },
  optionList: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 },
  option: {
    display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 8,
    border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer", userSelect: "none",
  },
  optionActive: { borderColor: "#4F46E5", background: "#F8FAFC" },
  optionIcon: { width: 32, height: 32, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  optionLabel: { fontSize: 13.5, fontWeight: 600, color: "#10142A" },
  optionDesc: { fontSize: 12, color: "#656C86" },
  continue: {
    width: "100%", border: "none", borderRadius: 8, padding: "11px 16px", fontWeight: 700, fontSize: 14,
    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    background: "#4F46E5",
    transition: "background .12s ease",
  },
};
