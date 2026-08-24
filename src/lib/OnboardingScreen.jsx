// NOT CURRENTLY USED - nothing imports this component. App.jsx renders
// src/pages/onboarding/OnboardingPage.jsx (an earlier draft of the same
// screen) instead.
import React, { useState } from "react";
import { Check, ArrowRight, BookOpen, Palette, Cpu, Briefcase } from "lucide-react";
import { useSupabaseQuery } from "./useSupabaseQuery.js";
import { fetchAvailableTracks } from "./api/learner.js";
import { DEMO_MODE } from "./demoMode.js";

// The four tracks below used to be the entire catalogue this screen offered,
// hardcoded, while the copy promised "This shapes your course
// recommendations" and the choice was persisted to user_personalization. A
// learner could therefore commit to a track ("Design", "Engineering") that
// matched no real courses.category anywhere in the database.
//
// fetchAvailableTracks() (lib/api/learner.js) derives the real track list
// from published, non-archived courses.category with per-track course and
// hour counts, so that is what is offered when a database is connected. This
// list survives as the no-database fallback, and also as a last resort if a
// live catalogue comes back empty - onboarding is a blocking step and must
// never present an empty choice. Kept in sync with the copy of this screen
// that is actually rendered, pages/onboarding/OnboardingPage.jsx.
const FALLBACK_TRACKS = [
  { name: "Data & AI", icon: Cpu },
  { name: "Design", icon: Palette },
  { name: "Engineering", icon: BookOpen },
  { name: "Business", icon: Briefcase },
];

// Real category names are free text, so an icon is matched by keyword rather
// than looked up in a fixed table.
function iconForTrack(name) {
  const n = (name || "").toLowerCase();
  if (/(design|ux|ui|creative|brand)/.test(n)) return Palette;
  if (/(business|leader|manage|sales|finance|market|complian|hr|people)/.test(n)) return Briefcase;
  if (/(ai|data|analytic|machine|engineer|develop|code|software|cloud|security|tech)/.test(n)) return Cpu;
  return BookOpen;
}

const LEVELS = [
  { key: "beginner", label: "Beginner", desc: "New to this area" },
  { key: "intermediate", label: "Intermediate", desc: "Some hands-on experience" },
  { key: "advanced", label: "Advanced", desc: "Comfortable going deep" },
];

export default function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(0);
  const [tracks, setTracks] = useState([]);
  const [level, setLevel] = useState(null);

  const tracksQuery = useSupabaseQuery(async () => (DEMO_MODE ? [] : fetchAvailableTracks()), []);
  const liveTracks = tracksQuery.data || [];
  // Live catalogue where there is one; the illustrative list only when there
  // is no database, or when the real catalogue has no categorised published
  // courses yet (a learner must still be able to finish onboarding).
  const trackOptions = liveTracks.length > 0
    ? liveTracks.map((t) => ({ name: t.name, icon: iconForTrack(t.name), courses: t.courses, hours: t.hours }))
    : FALLBACK_TRACKS;
  const usingFallbackTracks = liveTracks.length === 0;

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
            <div key={i} style={{ ...styles.progressBar, background: i <= step ? "linear-gradient(135deg, #4338CA, #818CF8)" : "#EEF2FF" }} />
          ))}
        </div>

        {step === 0 && (
          <>
            <h1 style={styles.h1}>What do you want to learn?</h1>
            <p style={styles.sub}>Pick one or more. This shapes your course recommendations.</p>
            <div style={styles.optionList}>
              {tracksQuery.loading && <div style={styles.optionDesc}>Loading available tracks...</div>}
              {!tracksQuery.loading && trackOptions.map((t) => {
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
                    {/* Real per-track course count, so the choice is visibly
                        tied to what is actually in the catalogue. */}
                    {!usingFallbackTracks && (
                      <span style={styles.optionDesc}>{t.courses} course{t.courses === 1 ? "" : "s"}</span>
                    )}
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
    background: "linear-gradient(135deg, #4338CA 0%, #4F46E5 55%, #818CF8 100%)",
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
  optionActive: { borderColor: "#4F46E5", background: "#F4F6FC" },
  optionIcon: { width: 32, height: 32, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  optionLabel: { fontSize: 14, fontWeight: 600, color: "#10142A" },
  optionDesc: { fontSize: 12, color: "#656C86" },
  continue: {
    width: "100%", border: "none", borderRadius: 13, padding: "13px 16px", fontWeight: 700, fontSize: 14,
    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    background: "linear-gradient(135deg, #4338CA 0%, #4F46E5 55%, #818CF8 100%)",
    boxShadow: "0 10px 22px -8px rgba(79,70,229,.5)", transition: "transform .12s ease, box-shadow .12s ease",
  },
};
