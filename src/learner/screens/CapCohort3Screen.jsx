import React, { useState, useEffect } from "react";
import {
  Rocket, BookOpen, Hammer, Award, Users, Github, ExternalLink,
  CheckCircle2, Clock, Star, MessageSquare, AlertCircle, Sparkles,
  KeyRound, ShieldCheck, ChevronRight, Play, FileText, Plus, Edit3, X, Check, Code
} from "lucide-react";
import { fetchCapTeams, saveCapTeam, joinCapTeam, updateDemoDayReview } from "../../lib/api/capProgram.js";
import { fetchMentorshipCheckins, createMentorCheckin } from "../../lib/api/mentorship.js";
import { redeemAccessCode } from "../../lib/api/accessCodes.js";
import { CAP_PHASES, CAP_ROLES } from "../../lib/constants/terminology.js";

const LOCAL_STORAGE_PROBLEM_KEY = "trainai_cap_problem_statement_v1";

export default function CapCohort3Screen({ session, showToast, push, goTab, cohortId, courses = [], user }) {
  const [activePhase, setActivePhase] = useState("BUILD"); // LEARN | BUILD | LAUNCH
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkins, setCheckins] = useState([]);

  // Access Code Modal
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [trialStatus, setTrialStatus] = useState(null);

  // Register Team Modal
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProblemStatement, setNewProblemStatement] = useState("");
  const [newTechs, setNewTechs] = useState("React, Python, FastAPI, Supabase");
  const [newMentorName, setNewMentorName] = useState("Dr. Amara Okafor");
  const [newCreatorRole, setNewCreatorRole] = useState("Software Engineer");
  const [submittingTeam, setSubmittingTeam] = useState(false);

  // Join Team Modal
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [selectedTeamForJoin, setSelectedTeamForJoin] = useState(null);
  const [selectedRole, setSelectedRole] = useState("Software Engineer");
  const [joiningTeam, setJoiningTeam] = useState(false);

  // Edit / Submit Project Links Modal
  const [linksModalOpen, setLinksModalOpen] = useState(false);
  const [selectedTeamForLinks, setSelectedTeamForLinks] = useState(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [presentationUrl, setPresentationUrl] = useState("");
  const [submittingLinks, setSubmittingLinks] = useState(false);

  // Log Mentorship Check-in Modal
  const [checkinModalOpen, setCheckinModalOpen] = useState(false);
  const [checkinTeamId, setCheckinTeamId] = useState("");
  const [checkinMentor, setCheckinMentor] = useState("Dr. Amara Okafor");
  const [checkinDate, setCheckinDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [checkinRating, setCheckinRating] = useState(5);
  const [checkinNotes, setCheckinNotes] = useState("");
  const [checkinBlockers, setCheckinBlockers] = useState("");
  const [checkinActions, setCheckinActions] = useState("");
  const [submittingCheckin, setSubmittingCheckin] = useState(false);

  // Score / Review Demo Day Modal (Admins / Mentors / Judges)
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [selectedTeamForScore, setSelectedTeamForScore] = useState(null);
  const [scoreStatus, setScoreStatus] = useState("Demo Day Ready");
  const [scoreVal, setScoreVal] = useState(90);
  const [scoreFeedback, setScoreFeedback] = useState("");
  const [submittingScore, setSubmittingScore] = useState(false);

  // Problem Statement Modal (Phase A)
  const [problemModalOpen, setProblemModalOpen] = useState(false);
  const [problemTitle, setProblemTitle] = useState("");
  const [problemText, setProblemText] = useState("");
  const [savedProblem, setSavedProblem] = useState(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_PROBLEM_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const currentUserId = session?.user?.id || user?.id;
  const currentUserName = user?.name || session?.user?.user_metadata?.display_name || session?.user?.email?.split("@")[0] || "Learner";
  const currentUserEmail = session?.user?.email || "";

  const isAdminOrMentor =
    user?.role === "admin" ||
    user?.role === "mentor" ||
    user?.role === "instructor" ||
    session?.user?.user_metadata?.role === "admin" ||
    session?.user?.user_metadata?.role === "mentor" ||
    String(currentUserEmail || "").toLowerCase().includes("admin");

  async function loadData() {
    setLoading(true);
    try {
      const [teamsData, checkinsData] = await Promise.all([
        fetchCapTeams(cohortId || "cap-cohort-3"),
        fetchMentorshipCheckins({ cohortId: cohortId || "cap-cohort-3" }),
      ]);
      setTeams(teamsData);
      setCheckins(checkinsData);
      if (teamsData.length > 0 && !checkinTeamId) {
        setCheckinTeamId(teamsData[0].id);
      }
    } catch (e) {
      console.warn("Could not load CAP Cohort 3 data:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [cohortId]);

  async function handleRedeemCode(e) {
    e.preventDefault();
    if (!inputCode.trim()) return;
    setRedeeming(true);
    try {
      const res = await redeemAccessCode(inputCode.trim(), currentUserId);
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

  async function handleRegisterTeam(e) {
    e.preventDefault();
    if (!newTeamName.trim() || !newProjectTitle.trim()) {
      showToast?.("Please enter a team name and project title.");
      return;
    }
    setSubmittingTeam(true);
    try {
      const techsList = newTechs.split(",").map(s => s.trim()).filter(Boolean);
      const teamPayload = {
        cohort_id: cohortId || "cap-cohort-3",
        name: newTeamName.trim(),
        project_title: newProjectTitle.trim(),
        problem_statement: newProblemStatement.trim() || "High-impact African industry solution.",
        technologies: techsList.length ? techsList : ["React", "Python", "Supabase"],
        mentor_name: newMentorName.trim() || "Dr. Amara Okafor",
        phase: "BUILD",
        demo_day_status: "Pending Review",
        members: [
          {
            id: `mem-${Date.now()}`,
            user_id: currentUserId,
            name: currentUserName,
            email: currentUserEmail,
            role: newCreatorRole,
          }
        ],
      };
      await saveCapTeam(teamPayload);
      showToast?.(`Team "${newTeamName}" registered successfully!`);
      setRegisterModalOpen(false);
      setNewTeamName("");
      setNewProjectTitle("");
      setNewProblemStatement("");
      await loadData();
    } catch (err) {
      showToast?.(err?.message || "Could not register team.");
    } finally {
      setSubmittingTeam(false);
    }
  }

  async function handleConfirmJoinTeam(e) {
    e.preventDefault();
    if (!selectedTeamForJoin) return;
    setJoiningTeam(true);
    try {
      await joinCapTeam({
        teamId: selectedTeamForJoin.id,
        userId: currentUserId,
        name: currentUserName,
        email: currentUserEmail,
        role: selectedRole,
      });
      showToast?.(`Joined Team ${selectedTeamForJoin.name} as ${selectedRole}!`);
      setJoinModalOpen(false);
      setSelectedTeamForJoin(null);
      await loadData();
    } catch (err) {
      showToast?.(err?.message || "Could not join team.");
    } finally {
      setJoiningTeam(false);
    }
  }

  function openEditLinksModal(team) {
    setSelectedTeamForLinks(team);
    setRepoUrl(team.github_url || "");
    setDemoUrl(team.demo_url || "");
    setPresentationUrl(team.presentation_url || "");
    setLinksModalOpen(true);
  }

  async function handleSaveLinks(e) {
    e.preventDefault();
    if (!selectedTeamForLinks) return;
    setSubmittingLinks(true);
    try {
      await saveCapTeam({
        ...selectedTeamForLinks,
        github_url: repoUrl.trim() || null,
        demo_url: demoUrl.trim() || null,
        presentation_url: presentationUrl.trim() || null,
      });
      showToast?.("Project repository and demo links updated!");
      setLinksModalOpen(false);
      setSelectedTeamForLinks(null);
      await loadData();
    } catch (err) {
      showToast?.(err?.message || "Failed to update project links.");
    } finally {
      setSubmittingLinks(false);
    }
  }

  async function handleCreateCheckin(e) {
    e.preventDefault();
    if (!checkinNotes.trim()) {
      showToast?.("Please enter sprint check-in notes.");
      return;
    }
    setSubmittingCheckin(true);
    try {
      const selectedT = teams.find(t => t.id === checkinTeamId);
      await createMentorCheckin({
        teamId: checkinTeamId,
        teamName: selectedT?.name || "Sprint Team",
        cohortId: cohortId || "cap-cohort-3",
        mentorId: currentUserId,
        mentorName: checkinMentor.trim() || currentUserName,
        checkinDate,
        notes: checkinNotes.trim(),
        progressRating: Number(checkinRating) || 5,
        issuesBlockers: checkinBlockers.trim() || null,
        recommendedActions: checkinActions.trim() || null,
      });
      showToast?.("Mentor check-in logged successfully!");
      setCheckinModalOpen(false);
      setCheckinNotes("");
      setCheckinBlockers("");
      setCheckinActions("");
      await loadData();
    } catch (err) {
      showToast?.(err?.message || "Could not log check-in.");
    } finally {
      setSubmittingCheckin(false);
    }
  }

  function openScoreModal(team) {
    setSelectedTeamForScore(team);
    setScoreStatus(team.demo_day_status || "Demo Day Ready");
    setScoreVal(team.final_score !== undefined ? team.final_score : 90);
    setScoreFeedback(team.judges_feedback || "");
    setScoreModalOpen(true);
  }

  async function handleSaveScore(e) {
    e.preventDefault();
    if (!selectedTeamForScore) return;
    setSubmittingScore(true);
    try {
      await updateDemoDayReview(selectedTeamForScore.id, {
        demoDayStatus: scoreStatus,
        finalScore: Number(scoreVal),
        judgesFeedback: scoreFeedback.trim(),
      });
      showToast?.(`Review updated for Team ${selectedTeamForScore.name}!`);
      setScoreModalOpen(false);
      setSelectedTeamForScore(null);
      await loadData();
    } catch (err) {
      showToast?.(err?.message || "Could not save review.");
    } finally {
      setSubmittingScore(false);
    }
  }

  function handleSaveProblemStatement(e) {
    e.preventDefault();
    if (!problemText.trim()) return;
    const doc = {
      title: problemTitle.trim() || "African Industry Problem Statement",
      statement: problemText.trim(),
      submittedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(LOCAL_STORAGE_PROBLEM_KEY, JSON.stringify(doc));
      setSavedProblem(doc);
      showToast?.("Problem statement saved successfully!");
      setProblemModalOpen(false);
    } catch {
      showToast?.("Could not save problem statement.");
    }
  }

  // Derive relevant courses for Phase A
  const primaryCourse = courses.find(c => c.enrolled || c.assigned) || courses[0] || null;

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
              Career Acceleration Programme (CAP): Cohort 3
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
                boxShadow: isSelected ? "0 4px 14px rgba(37,99,235,0.15)" : "none",
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
              {/* Module 1: AI Engineering */}
              <div style={{ padding: 18, background: "var(--surface-2)", borderRadius: 10, border: "1px solid var(--border)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <CheckCircle2 size={16} color="#10B981" />
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>AI Engineering &amp; LLM Foundations</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-2)", margin: "0 0 10px", lineHeight: 1.45 }}>
                    Prompt engineering, API integration, Supabase vector databases, and evaluation rubrics.
                  </p>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: (primaryCourse?.progress || 0) >= 100 ? "#10B981" : "#2563EB", marginBottom: 12 }}>
                    {(primaryCourse?.progress || 0) >= 100 ? "Completed (100%)" : `Curriculum Pace: ${primaryCourse?.progress || 0}%`}
                  </div>
                </div>
                {primaryCourse?.id && (
                  <button
                    className="ta-btn ta-btn-outline ta-btn-sm"
                    style={{ fontSize: 12, alignSelf: "flex-start" }}
                    onClick={() => push?.("courseDetail", { id: primaryCourse.id })}
                  >
                    Open Course Syllabus &rarr;
                  </button>
                )}
              </div>

              {/* Module 2: CV Workshop */}
              <div style={{ padding: 18, background: "var(--surface-2)", borderRadius: 10, border: "1px solid var(--border)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Clock size={16} color="#2563EB" />
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>CV &amp; Cover Letter Workshop</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-2)", margin: "0 0 10px", lineHeight: 1.45 }}>
                    Engineering CV optimization, portfolio positioning, and soft skills interview prep.
                  </p>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "#2563EB", marginBottom: 12 }}>
                    Career Acceleration Track &bull; Active
                  </div>
                </div>
                <button
                  className="ta-btn ta-btn-outline ta-btn-sm"
                  style={{ fontSize: 12, alignSelf: "flex-start" }}
                  onClick={() => {
                    if (goTab) goTab("profile");
                    else if (push) push("profile");
                    showToast?.("Navigating to Career Profile & Credentials...");
                  }}
                >
                  View Career Profile &rarr;
                </button>
              </div>

              {/* Module 3: Problem Statement */}
              <div style={{ padding: 18, background: "var(--surface-2)", borderRadius: 10, border: "1px solid var(--border)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <FileText size={16} color={savedProblem ? "#10B981" : "#64748B"} />
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>Product Idea &amp; Problem Statement</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-2)", margin: "0 0 10px", lineHeight: 1.45 }}>
                    {savedProblem?.statement ? `"${savedProblem.statement.slice(0, 85)}..."` : "Identify a high-impact African industry problem (Health, Agri, Fintech) for Phase B."}
                  </p>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: savedProblem ? "#10B981" : "#64748B", marginBottom: 12 }}>
                    {savedProblem ? "Submitted & Validated ✓" : "Ready for Phase B Submission"}
                  </div>
                </div>
                <button
                  className="ta-btn ta-btn-primary ta-btn-sm"
                  style={{ fontSize: 12, alignSelf: "flex-start" }}
                  onClick={() => {
                    setProblemTitle(savedProblem?.title || "");
                    setProblemText(savedProblem?.statement || "");
                    setProblemModalOpen(true);
                  }}
                >
                  {savedProblem ? "Edit Problem Statement" : "+ Submit Problem Statement"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phase B: BUILD (Teams & Projects) */}
      {activePhase === "BUILD" && (
        <div className="ta-col ta-gap20">
          <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17 }}>Cross-Functional Project Teams &amp; Sprints</div>
              <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                Teams collaborate on real software builds with assigned roles, GitHub repos, and live demos.
              </div>
            </div>
            <button
              className="ta-btn ta-btn-primary ta-btn-sm"
              style={{ fontWeight: 800 }}
              onClick={() => setRegisterModalOpen(true)}
            >
              <Plus size={14} /> Register Team &amp; Project
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            {teams.map((team) => {
              const isMember = (team.members || []).some(
                m => m.user_id === currentUserId || (currentUserEmail && m.email === currentUserEmail)
              );

              return (
                <div
                  key={team.id}
                  className="ta-card"
                  style={{
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    border: isMember ? "2px solid #2563EB" : "1.5px solid var(--border)",
                    boxShadow: isMember ? "0 4px 14px rgba(37,99,235,0.12)" : "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", textTransform: "uppercase" }}>
                        Team {team.name} {isMember && <span style={{ color: "#10B981", fontWeight: 800 }}>(Your Team)</span>}
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
                    <div className="ta-row ta-between" style={{ marginBottom: 6, alignItems: "center" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>
                        Team Members &amp; Roles ({team.members?.length || 0})
                      </div>
                      {!isMember && (
                        <button
                          type="button"
                          className="ta-btn ta-btn-outline ta-btn-sm"
                          style={{ fontSize: 11, padding: "2px 8px" }}
                          onClick={() => {
                            setSelectedTeamForJoin(team);
                            setJoinModalOpen(true);
                          }}
                        >
                          <Plus size={11} /> Join Team
                        </button>
                      )}
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
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 12, alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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

                    {(isMember || isAdminOrMentor) && (
                      <button
                        type="button"
                        className="ta-btn ta-btn-ghost ta-btn-sm"
                        style={{ fontSize: 11.5, padding: "4px 8px", color: "var(--primary)" }}
                        onClick={() => openEditLinksModal(team)}
                      >
                        <Edit3 size={12} /> Edit Links
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mentorship Feed Section */}
          <div className="ta-card" style={{ padding: 24 }}>
            <div className="ta-row ta-between" style={{ marginBottom: 14, alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MessageSquare size={18} color="#2563EB" />
                <span style={{ fontWeight: 800, fontSize: 16 }}>Mentorship Check-in Feed</span>
              </div>
              {isAdminOrMentor && (
                <button
                  type="button"
                  className="ta-btn ta-btn-outline ta-btn-sm"
                  style={{ fontWeight: 700 }}
                  onClick={() => setCheckinModalOpen(true)}
                >
                  <Plus size={13} /> Log Mentorship Check-in
                </button>
              )}
            </div>

            <div className="ta-col ta-gap12">
              {checkins.length === 0 && (
                <div style={{ fontSize: 13, color: "var(--text-3)", padding: "12px 0" }}>
                  No mentorship check-ins recorded yet.
                </div>
              )}
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
              {teams.map((t) => (
                <div
                  key={t.id}
                  style={{
                    padding: 18,
                    background: "var(--surface-2)",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between"
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#10B981", textTransform: "uppercase" }}>
                        Final Score: {t.final_score !== undefined ? `${t.final_score}/100` : "Pending"}
                      </span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(37,99,235,0.1)", color: "#2563EB" }}>
                        {t.demo_day_status}
                      </span>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 15, margin: "4px 0 6px" }}>{t.project_title}</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 8 }}>Team: {t.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 14, fontStyle: "italic" }}>
                      Judges: "{t.judges_feedback || "Commercial validation in progress."}"
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                    {t.demo_url ? (
                      <a href={t.demo_url} target="_blank" rel="noreferrer" className="ta-btn ta-btn-primary ta-btn-sm" style={{ fontSize: 11.5 }}>
                        Launch Project <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--text-3)" }}>Demo URL pending</span>
                    )}

                    {isAdminOrMentor && (
                      <button
                        type="button"
                        className="ta-btn ta-btn-ghost ta-btn-sm"
                        style={{ fontSize: 11.5, color: "var(--primary)" }}
                        onClick={() => openScoreModal(t)}
                      >
                        <Award size={13} /> Score Team
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS
          ========================================================================= */}

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
                  width: "100%",
                  boxSizing: "border-box"
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

      {/* Register Team & Project Modal */}
      {registerModalOpen && (
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
              padding: 26,
              maxWidth: 520,
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              color: "#0F172A",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 17, color: "#0F172A" }}>Register CAP Sprint Team &amp; Project</div>
              <button
                type="button"
                className="ta-btn ta-btn-ghost ta-btn-sm"
                onClick={() => setRegisterModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRegisterTeam}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Team Name *</div>
                  <input
                    type="text"
                    className="ta-input"
                    style={{ width: "100%", boxSizing: "border-box" }}
                    placeholder="e.g. Apex Health AI"
                    required
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Your Sprint Role</div>
                  <select
                    className="ta-input"
                    style={{ width: "100%", boxSizing: "border-box" }}
                    value={newCreatorRole}
                    onChange={(e) => setNewCreatorRole(e.target.value)}
                  >
                    {CAP_ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Project Title *</div>
                <input
                  type="text"
                  className="ta-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                  placeholder="e.g. Real-Time Patient Triage & Bed Allocation Engine"
                  required
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Problem Statement</div>
                <textarea
                  className="ta-input"
                  rows={2}
                  style={{ width: "100%", boxSizing: "border-box" }}
                  placeholder="What specific African industry pain point does this team solve?"
                  value={newProblemStatement}
                  onChange={(e) => setNewProblemStatement(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Technologies (comma separated)</div>
                  <input
                    type="text"
                    className="ta-input"
                    style={{ width: "100%", boxSizing: "border-box" }}
                    placeholder="React, Python, FastAPI"
                    value={newTechs}
                    onChange={(e) => setNewTechs(e.target.value)}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Assigned Mentor</div>
                  <input
                    type="text"
                    className="ta-input"
                    style={{ width: "100%", boxSizing: "border-box" }}
                    placeholder="Dr. Amara Okafor"
                    value={newMentorName}
                    onChange={(e) => setNewMentorName(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  className="ta-btn ta-btn-outline ta-btn-sm"
                  onClick={() => setRegisterModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ta-btn ta-btn-primary ta-btn-sm"
                  disabled={submittingTeam}
                >
                  {submittingTeam ? "Registering..." : "Register & Join Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Team Modal */}
      {joinModalOpen && selectedTeamForJoin && (
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
              padding: 26,
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              color: "#0F172A",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Join Team {selectedTeamForJoin.name}</div>
              <button
                type="button"
                className="ta-btn ta-btn-ghost ta-btn-sm"
                onClick={() => setJoinModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 14px" }}>
              Project: <strong>{selectedTeamForJoin.project_title}</strong>
            </p>

            <form onSubmit={handleConfirmJoinTeam}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Select Your Team Role</div>
                <select
                  className="ta-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                >
                  {CAP_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  className="ta-btn ta-btn-outline ta-btn-sm"
                  onClick={() => setJoinModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ta-btn ta-btn-primary ta-btn-sm"
                  disabled={joiningTeam}
                >
                  {joiningTeam ? "Joining..." : "Confirm & Join Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit / Submit Links Modal */}
      {linksModalOpen && selectedTeamForLinks && (
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
              padding: 26,
              maxWidth: 480,
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              color: "#0F172A",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Update Links: {selectedTeamForLinks.name}</div>
              <button
                type="button"
                className="ta-btn ta-btn-ghost ta-btn-sm"
                onClick={() => setLinksModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveLinks}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>GitHub Repository URL</div>
                <input
                  type="url"
                  className="ta-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                  placeholder="https://github.com/..."
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Live Demo URL</div>
                <input
                  type="url"
                  className="ta-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                  placeholder="https://myproject.trainailtd.com"
                  value={demoUrl}
                  onChange={(e) => setDemoUrl(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Presentation Slides URL</div>
                <input
                  type="url"
                  className="ta-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                  placeholder="https://slides.trainailtd.com/..."
                  value={presentationUrl}
                  onChange={(e) => setPresentationUrl(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  className="ta-btn ta-btn-outline ta-btn-sm"
                  onClick={() => setLinksModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ta-btn ta-btn-primary ta-btn-sm"
                  disabled={submittingLinks}
                >
                  {submittingLinks ? "Saving..." : "Save Links"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Mentorship Check-in Modal */}
      {checkinModalOpen && (
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
              padding: 26,
              maxWidth: 500,
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              color: "#0F172A",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Log Mentorship Sprint Check-in</div>
              <button
                type="button"
                className="ta-btn ta-btn-ghost ta-btn-sm"
                onClick={() => setCheckinModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateCheckin}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Select Team</div>
                  <select
                    className="ta-input"
                    style={{ width: "100%", boxSizing: "border-box" }}
                    value={checkinTeamId}
                    onChange={(e) => setCheckinTeamId(e.target.value)}
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>Team {t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Check-in Date</div>
                  <input
                    type="date"
                    className="ta-input"
                    style={{ width: "100%", boxSizing: "border-box" }}
                    value={checkinDate}
                    onChange={(e) => setCheckinDate(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Sprint Progress Notes *</div>
                <textarea
                  className="ta-input"
                  rows={2}
                  style={{ width: "100%", boxSizing: "border-box" }}
                  placeholder="Sprint milestones completed this week..."
                  required
                  value={checkinNotes}
                  onChange={(e) => setCheckinNotes(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Blockers / Architecture Issues</div>
                <input
                  type="text"
                  className="ta-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                  placeholder="Optional latency, API, or data bottlenecks"
                  value={checkinBlockers}
                  onChange={(e) => setCheckinBlockers(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Recommended Next Steps</div>
                <input
                  type="text"
                  className="ta-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                  placeholder="Action items before next check-in"
                  value={checkinActions}
                  onChange={(e) => setCheckinActions(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  className="ta-btn ta-btn-outline ta-btn-sm"
                  onClick={() => setCheckinModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ta-btn ta-btn-primary ta-btn-sm"
                  disabled={submittingCheckin}
                >
                  {submittingCheckin ? "Saving..." : "Log Check-in"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Demo Day Score / Review Modal */}
      {scoreModalOpen && selectedTeamForScore && (
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
              padding: 26,
              maxWidth: 480,
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              color: "#0F172A",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Score Demo Day: Team {selectedTeamForScore.name}</div>
              <button
                type="button"
                className="ta-btn ta-btn-ghost ta-btn-sm"
                onClick={() => setScoreModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveScore}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Demo Day Status</div>
                  <select
                    className="ta-input"
                    style={{ width: "100%", boxSizing: "border-box" }}
                    value={scoreStatus}
                    onChange={(e) => setScoreStatus(e.target.value)}
                  >
                    <option value="Featured">Featured (Top Pick)</option>
                    <option value="Demo Day Ready">Demo Day Ready</option>
                    <option value="Pending Review">Pending Review</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Final Score (0-100)</div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="ta-input"
                    style={{ width: "100%", boxSizing: "border-box" }}
                    value={scoreVal}
                    onChange={(e) => setScoreVal(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Judges Feedback</div>
                <textarea
                  className="ta-input"
                  rows={3}
                  style={{ width: "100%", boxSizing: "border-box" }}
                  placeholder="Critique, commercial validation, and technical architecture feedback..."
                  value={scoreFeedback}
                  onChange={(e) => setScoreFeedback(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  className="ta-btn ta-btn-outline ta-btn-sm"
                  onClick={() => setScoreModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ta-btn ta-btn-primary ta-btn-sm"
                  disabled={submittingScore}
                >
                  {submittingScore ? "Saving..." : "Save Score & Feedback"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Problem Statement Modal (Phase A) */}
      {problemModalOpen && (
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
              padding: 26,
              maxWidth: 500,
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              color: "#0F172A",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Submit African Industry Problem Statement</div>
              <button
                type="button"
                className="ta-btn ta-btn-ghost ta-btn-sm"
                onClick={() => setProblemModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProblemStatement}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Target Industry &amp; Title</div>
                <input
                  type="text"
                  className="ta-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                  placeholder="e.g. Health: Reducing Maternal Referral Delays"
                  value={problemTitle}
                  onChange={(e) => setProblemTitle(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Problem Statement &amp; Scope *</div>
                <textarea
                  className="ta-input"
                  rows={4}
                  style={{ width: "100%", boxSizing: "border-box" }}
                  placeholder="Detail the pain point, who suffers from it, and what software/AI intervention can solve it..."
                  required
                  value={problemText}
                  onChange={(e) => setProblemText(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  className="ta-btn ta-btn-outline ta-btn-sm"
                  onClick={() => setProblemModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ta-btn ta-btn-primary ta-btn-sm"
                >
                  Save Problem Statement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
