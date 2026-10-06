import React, { useState, useEffect } from "react";
import {
  Rocket, BookOpen, Hammer, Award, Users, Github, ExternalLink,
  CheckCircle2, Clock, Star, MessageSquare, AlertCircle, Sparkles,
  KeyRound, ShieldCheck, ChevronRight, Play, FileText
} from "lucide-react";
import { fetchCapTeams, saveCapTeam } from "../../lib/api/capProgram.js";
import { fetchMentorshipCheckins } from "../../lib/api/mentorship.js";
import { redeemAccessCode } from "../../lib/api/accessCodes.js";
import { CAP_PHASES, CAP_ROLES } from "../../lib/constants/terminology.js";

export default function CapCohort3Screen({ session, showToast }) {
  const [activePhase, setActivePhase] = useState("BUILD"); // LEARN | BUILD | LAUNCH
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkins, setCheckins] = useState([]);

  // Access Code Modal
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [trialStatus, setTrialStatus] = useState(null);

  async function loadData() {
    setLoading(true);
    try {
      const [teamsData, checkinsData] = await Promise.all([
        fetchCapTeams("cap-cohort-3"),
        fetchMentorshipCheckins({ cohortId: "cap-cohort-3" }),
      ]);
      setTeams(teamsData);
      setCheckins(checkinsData);
    } catch (e) {
      console.warn("Could not load CAP Cohort 3 data:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleRedeemCode(e) {
    e.preventDefault();
    if (!inputCode.trim()) return;
    setRedeeming(true);
    try {
      const res = await redeemAccessCode(inputCode.trim(), session?.user?.id);
      if (res.success) {
        setTrialStatus(res);
        if (showToast) showToast(res.message || "Trial code redeemed successfully!");
        setCodeModalOpen(false);
        setInputCode("");
      } else {
        if (showToast) showToast(res.error || "Invalid code.");
      }
    } catch (e) {
      if (showToast) showToast(e?.message || "Failed to redeem access code.");
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <div className="ta-fade" style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 20px 60px" }}>
      {/* CAP Hero Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          borderRadius: 16,
          padding: "28px 32px",
          color: "#FFFFFF",
          position: "relative",
          overflow: "hidden",
          border: "1.5px solid #334155",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)",
          marginBottom: 24,
        }}
      >
        <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(59,130,246,0.18)",
                border: "1px solid rgba(59,130,246,0.3)",
                color: "#60A5FA",
                padding: "3px 12px",
                borderRadius: 20,
                fontSize: 11.5,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: ".06em",
                marginBottom: 10,
              }}
            >
              <Sparkles size={12} /> 6-Week Intensive Accelerator
            </div>
            <h1 style={{ fontSize: "clamp(22px, 3vw, 30px)", fontWeight: 900, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
              Career Acceleration Programme (CAP) — Cohort 3
            </h1>
            <p style={{ fontSize: 13.5, color: "#94A3B8", margin: 0, maxWidth: 640, lineHeight: 1.5 }}>
              Hands-on enterprise AI product delivery, cross-functional sprints, dedicated industry mentorship, and Demo Day graduation.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <button
              className="ta-btn ta-btn-primary"
              style={{ padding: "8px 16px", fontSize: 13 }}
              onClick={() => setCodeModalOpen(true)}
            >
              <KeyRound size={14} /> Enter Access Code
            </button>
            <span style={{ fontSize: 11.5, color: "#94A3B8" }}>
              Have a sponsor or trial code? (e.g. <code>CAP3-2026</code>)
            </span>
          </div>
        </div>
      </div>

      {/* Visual Progression Timeline: Learn -> Build -> Launch */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12,
          marginBottom: 28,
        }}
      >
        {Object.values(CAP_PHASES).map((phase) => {
          const isSelected = activePhase === phase.key;
          const icons = {
            LEARN: BookOpen,
            BUILD: Hammer,
            LAUNCH: Rocket,
          };
          const Icon = icons[phase.key];

          return (
            <div
              key={phase.key}
              onClick={() => setActivePhase(phase.key)}
              style={{
                background: isSelected ? "var(--bg-card, #FFFFFF)" : "var(--surface-2, #F8FAFC)",
                border: isSelected ? "2px solid #2563EB" : "1px solid var(--border)",
                borderRadius: 12,
                padding: "16px 20px",
                cursor: "pointer",
                transition: "all .15s ease",
                boxShadow: isSelected ? "0 4px 14px rgba(37,99,235,0.1)" : "none",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: isSelected ? "#2563EB" : "rgba(100,116,139,0.1)",
                      color: isSelected ? "#FFFFFF" : "var(--text-2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Icon size={14} />
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 14, color: isSelected ? "#2563EB" : "var(--text)" }}>
                    {phase.label}
                  </span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", background: "var(--surface)", padding: "2px 6px", borderRadius: 4 }}>
                  {phase.weeks}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-2)", margin: 0, lineHeight: 1.4 }}>
                {phase.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* PHASE CONTENT VIEWS */}

      {/* Phase A: LEARN */}
      {activePhase === "LEARN" && (
        <div className="ta-col ta-gap16">
          <div className="ta-card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
              Phase A Curriculum &amp; Career Preparation Modules
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-2)", marginBottom: 20 }}>
              Master technical fundamentals, AI engineering tooling, and complete your job-ready portfolio documents.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
              <div style={{ padding: 16, background: "var(--surface-2)", borderRadius: 10, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <CheckCircle2 size={16} color="#10B981" />
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>AI Engineering &amp; LLM Foundations</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-2)", margin: "0 0 10px" }}>
                  Prompt engineering, API integration, Supabase vector databases, and evaluation rubrics.
                </p>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#10B981" }}>Completed (100%)</div>
              </div>

              <div style={{ padding: 16, background: "var(--surface-2)", borderRadius: 10, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Clock size={16} color="#2563EB" />
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>CV &amp; Cover Letter Workshop</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-2)", margin: "0 0 10px" }}>
                  Engineering CV optimization, portfolio positioning, and soft skills interview prep.
                </p>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#2563EB" }}>In Progress (80%)</div>
              </div>

              <div style={{ padding: 16, background: "var(--surface-2)", borderRadius: 10, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <FileText size={16} color="#64748B" />
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>Product Idea &amp; Problem Statement</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-2)", margin: "0 0 10px" }}>
                  Identify a high-impact African industry problem (Health, Agri, Fintech) for Phase B.
                </p>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>Ready for Phase B</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phase B: BUILD (Teams & Projects) */}
      {activePhase === "BUILD" && (
        <div className="ta-col ta-gap20">
          <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17 }}>Cross-Functional Project Teams &amp; Sprints</div>
              <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                Teams collaborate on real software builds with assigned roles, GitHub repos, and live demos.
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            {teams.map((team) => (
              <div
                key={team.id}
                className="ta-card"
                style={{
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  border: "1.5px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", textTransform: "uppercase" }}>
                      Team {team.name}
                    </span>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: "2px 0 0", color: "var(--text)" }}>
                      {team.project_title}
                    </h3>
                  </div>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: team.demo_day_status === "Featured" ? "rgba(16,185,129,0.15)" : "rgba(37,99,235,0.1)",
                      color: team.demo_day_status === "Featured" ? "#10B981" : "#2563EB",
                      textTransform: "uppercase",
                    }}
                  >
                    {team.demo_day_status}
                  </span>
                </div>

                <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.45, margin: "0 0 14px", flex: 1 }}>
                  {team.problem_statement}
                </p>

                {/* Team Members & Roles */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 6 }}>
                    Team Members &amp; Roles
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {(team.members || []).map((m, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: 11.5,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: "var(--surface-2)",
                          border: "1px solid var(--border)",
                          color: "var(--text)",
                          fontWeight: 600,
                        }}
                      >
                        {m.name} <span style={{ color: "#2563EB", fontWeight: 700 }}>({m.role})</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Mentor */}
                <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 14 }}>
                  Mentor: <strong style={{ color: "var(--text)" }}>{team.mentor_name || "Assigned Mentor"}</strong>
                </div>

                {/* Submission Links */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                  {team.github_url && (
                    <a
                      href={team.github_url}
                      target="_blank"
                      rel="noreferrer"
                      className="ta-btn ta-btn-outline ta-btn-sm"
                      style={{ fontSize: 11.5, padding: "4px 8px" }}
                    >
                      <Github size={12} /> GitHub
                    </a>
                  )}
                  {team.demo_url && (
                    <a
                      href={team.demo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="ta-btn ta-btn-primary ta-btn-sm"
                      style={{ fontSize: 11.5, padding: "4px 8px" }}
                    >
                      <ExternalLink size={12} /> Live Demo
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Mentorship Feed Section */}
          <div className="ta-card" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <MessageSquare size={18} color="#2563EB" />
              <span style={{ fontWeight: 800, fontSize: 16 }}>Mentorship Check-in Feed</span>
            </div>

            <div className="ta-col ta-gap12">
              {checkins.map((chk) => (
                <div
                  key={chk.id}
                  style={{
                    padding: "14px 18px",
                    background: "var(--surface-2)",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text)" }}>
                      {chk.team_name} &bull; Check-in with {chk.mentor_name}
                    </div>
                    <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>{chk.checkin_date}</span>
                  </div>
                  <p style={{ fontSize: 12.5, color: "var(--text-2)", margin: "0 0 8px", lineHeight: 1.45 }}>
                    {chk.notes}
                  </p>
                  {chk.recommended_actions && (
                    <div style={{ fontSize: 12, color: "#2563EB", fontWeight: 600 }}>
                      Next Steps: {chk.recommended_actions}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Phase C: LAUNCH (Demo Day Showcase) */}
      {activePhase === "LAUNCH" && (
        <div className="ta-col ta-gap20">
          <div className="ta-card" style={{ padding: 24, textAlign: "center" }}>
            <Rocket size={36} color="#2563EB" style={{ margin: "0 auto 12px" }} />
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px" }}>
              CAP Cohort 3 Demo Day Showcase
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 540, margin: "0 auto 20px" }}>
              Graduating teams present live software solutions to hiring partners, angel syndicates, and industry leaders.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, textAlign: "left" }}>
              {teams.filter((t) => t.demo_day_status === "Featured" || t.demo_day_status === "Demo Day Ready").map((t) => (
                <div
                  key={t.id}
                  style={{
                    padding: 18,
                    background: "var(--surface-2)",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#10B981", textTransform: "uppercase" }}>
                    Final Score: {t.final_score}/100
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 15, margin: "4px 0 6px" }}>{t.project_title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 12 }}>
                    Judges: "{t.judges_feedback || "Excellent execution and commercial validation."}"
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <a href={t.demo_url} target="_blank" rel="noreferrer" className="ta-btn ta-btn-primary ta-btn-sm" style={{ fontSize: 11.5 }}>
                      Launch Project <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Access Code Modal */}
      {codeModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 14,
              padding: 28,
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(37,99,235,0.1)", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <KeyRound size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#10142A" }}>Enter Trial / Access Code</div>
                <div style={{ fontSize: 11.5, color: "#64748B" }}>Unlock 6-week CAP Cohort 3 sponsored access</div>
              </div>
            </div>

            <form onSubmit={handleRedeemCode}>
              <input
                type="text"
                className="ta-input"
                style={{
                  fontSize: 15,
                  letterSpacing: ".08em",
                  textAlign: "center",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  padding: "12px",
                  margin: "12px 0 16px",
                  border: "1.5px solid #CBD5E1",
                }}
                placeholder="e.g. CAP3-2026"
                required
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  className="ta-btn ta-btn-ghost ta-btn-sm"
                  onClick={() => setCodeModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ta-btn ta-btn-primary ta-btn-sm"
                  disabled={redeeming}
                >
                  {redeeming ? "Validating Code..." : "Redeem & Unlock Access"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
