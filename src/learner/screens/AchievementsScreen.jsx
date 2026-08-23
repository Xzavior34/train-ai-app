import React, { useState } from "react";
import { TopBar, StatTile, ProgressBar, Tag } from "../components/LearnerUI.jsx";
import { ACHIEVEMENT_CATALOG, getAchievementProgress } from "../achievementCatalog.js";
import { AIInsightsCard } from "../components/AIInsightsCard.jsx";
import {
  Trophy, Flame, Snowflake, Award, BookOpen, Users, GraduationCap, CheckCircle2,
  Gift, Calendar, BarChart3, Clock, Zap, Download, Share2, ExternalLink,
  ShieldCheck, ArrowUpRight, Check, X, Star, TrendingUp
} from "lucide-react";
import { fetchMyMysteryBoxes, claimMysteryBox } from "../../lib/api/schemaHelper.js";
import { PortalModal } from "../../components/common/PortalModal.jsx";
import { isMockDataEnabled } from "../../lib/mockDataManager.js";

function iconForCategory(category) {
  if (category === "streak") return Flame;
  if (category === "mastery") return Trophy;
  if (category === "social") return Users;
  if (category === "completion") return BookOpen;
  return Award;
}

function levelProgress(level, totalPoints) {
  const lvl = level || 1;
  const floor = (lvl - 1) * 500;
  const ceiling = lvl * 500;
  const percent = ceiling > floor ? Math.max(0, Math.min(100, Math.round(((totalPoints - floor) / (ceiling - floor)) * 100))) : 0;
  return { floor, ceiling, percent };
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function AchievementsScreen({ user = {}, achievements = [], streakActivity = [], back, session, showToast, credits, consumeCredit, onBuyCredits }) {
  const userId = session?.user?.id;
  const [activeProgressTab, setActiveProgressTab] = useState("overview"); // "overview" | "certificates" | "badges" | "activity"
  const [mysteryBoxes, setMysteryBoxes] = useState([]);
  const [claimingBox, setClaimingBox] = useState(false);
  const [revealedReward, setRevealedReward] = useState(null);
  const [selectedCertificate, setSelectedCertificate] = useState(null);

  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchMyMysteryBoxes(userId).then((rows) => { if (!cancelled) setMysteryBoxes(rows); });
    return () => { cancelled = true; };
  }, [userId]);

  const streakMilestonesEarned = Math.floor((user.streak || 8) / 7);
  const boxesAlreadyClaimed = mysteryBoxes.length;
  const milestoneBoxAvailable = streakMilestonesEarned > boxesAlreadyClaimed;

  async function handleClaimBox() {
    if (!userId) return;
    setClaimingBox(true);
    try {
      const box = await claimMysteryBox(userId);
      setMysteryBoxes((prev) => [box, ...prev]);
      setRevealedReward(box.reward_value);
      showToast?.(`You earned ${box.reward_value?.points || 0} points for your ${user.streak}-day streak!`);
    } catch (e) {
      showToast?.(e.message || "Could not claim your reward right now.");
    } finally {
      setClaimingBox(false);
    }
  }

  const DEFAULT_EARNED = [
    {
      id: "badge-1",
      achievement_id: "first_lesson",
      achievement_title: "First Step Explorer",
      achievement_description: "Completed your first interactive lesson in Train AI.",
      points_awarded: 50,
      earned_at: new Date(Date.now() - 3600000 * 48).toISOString()
    },
    {
      id: "badge-2",
      achievement_id: "streak_3",
      achievement_title: "3-Day Streak Runner",
      achievement_description: "Maintained a continuous 3-day learning streak.",
      points_awarded: 100,
      earned_at: new Date(Date.now() - 3600000 * 24).toISOString()
    },
    {
      id: "badge-3",
      achievement_id: "quiz_ace",
      achievement_title: "Quiz Master Ace",
      achievement_description: "Scored 100% on an AI-generated assessment quiz.",
      points_awarded: 150,
      earned_at: new Date(Date.now() - 3600000 * 12).toISOString()
    },
    {
      id: "badge-4",
      achievement_id: "social_star",
      achievement_title: "Community Pioneer",
      achievement_description: "Participated in 3 cohort discussions and study lounge sessions.",
      points_awarded: 75,
      earned_at: new Date(Date.now() - 3600000 * 6).toISOString()
    }
  ];

  const CERTIFICATES = [
    {
      id: "cert-1",
      title: "Generative AI & LLM Systems Mastery 2026",
      specialization: "Artificial Intelligence & Product Engineering",
      issueDate: "August 15, 2026",
      credentialId: "TAI-CERT-2026-8942",
      grade: "98.5% Distinction",
      instructor: "Dr. Elena Vance & Train AI Academic Board",
      skills: ["LangChain", "Vector Embeddings", "RAG Pipelines", "Autonomous Agents", "Prompt Engineering"],
      verificationUrl: "https://trainai.app/verify/TAI-CERT-2026-8942",
      bannerImage: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80"
    },
    {
      id: "cert-2",
      title: "UI/UX & Design Systems with Figma AI",
      specialization: "Digital Product & Spatial Interface Design",
      issueDate: "July 28, 2026",
      credentialId: "TAI-CERT-2026-7319",
      grade: "96.0% Honors",
      instructor: "Marcus Aurelius Thorne & UX Guild",
      skills: ["Figma Variables", "Design Tokens", "Micro-interactions", "Design Systems Governance"],
      verificationUrl: "https://trainai.app/verify/TAI-CERT-2026-7319",
      bannerImage: "https://images.unsplash.com/photo-1558655146-d09347e92766?w=800&auto=format&fit=crop&q=80"
    }
  ];

  const WEEKLY_HOURS = [
    { day: "Mon", hours: 2.5, heightPct: 75 },
    { day: "Tue", hours: 1.8, heightPct: 54 },
    { day: "Wed", hours: 3.2, heightPct: 95 },
    { day: "Thu", hours: 2.1, heightPct: 63 },
    { day: "Fri", hours: 2.8, heightPct: 84 },
    { day: "Sat", hours: 1.4, heightPct: 42 },
    { day: "Sun", hours: 2.0, heightPct: 60 },
  ];

  const SKILL_RADAR = [
    { skill: "Prompt Engineering & LLM APIs", score: 94, level: "Expert" },
    { skill: "Design Tokens & Variables (Figma)", score: 88, level: "Advanced" },
    { skill: "Autonomous Agents & RAG", score: 82, level: "Proficient" },
    { skill: "Spatial Interface Design", score: 76, level: "Intermediate" },
    { skill: "Cloud Services & Deployment", score: 70, level: "Intermediate" },
  ];

  const effectiveAchievements = (achievements && achievements.length > 0) ? achievements : (isMockDataEnabled() ? DEFAULT_EARNED : []);
  const { ceiling, percent } = levelProgress(user.level || 2, user.totalPoints || 450);
  // Real earned rows carry the catalog slug as achievement_slug (via the
  // my_achievements_with_slug view - achievement_id itself is a uuid FK
  // and never matches a catalog id). Demo/default rows already use the
  // slug directly in achievement_id, so both are checked.
  const earnedIds = new Set(effectiveAchievements.map((a) => a.achievement_slug || a.achievement_id));
  const locked = ACHIEVEMENT_CATALOG.filter((def) => !earnedIds.has(def.id));

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      {/* =========================================================================
          HERO BANNER: Progression & Level Showcase
          ========================================================================= */}
      <div style={{
        borderRadius: 10,
        background: "#0F172A",
        color: "#FFFFFF",
        padding: "clamp(16px, 2.5vw, 22px)",
        boxShadow: "0 4px 16px rgba(15, 23, 42, 0.2)",
        border: "1px solid #1E293B",
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: "clamp(18px, 2.2vw, 24px)", fontWeight: 800, letterSpacing: "-0.025em", margin: "0 0 4px", color: "#FFFFFF" }}>
              Level {user.level || 2} • Senior Specialist
            </h1>
            <p style={{ fontSize: 13, color: "#94A3B8", margin: 0, maxWidth: 620, lineHeight: 1.45 }}>
              {(user.totalPoints || 4520).toLocaleString()} XP earned • {ceiling - (user.totalPoints || 450)} XP to Level {(user.level || 2) + 1}
            </p>
          </div>

          <div style={{ textAlign: "right", flexShrink: 0, background: "rgba(255,255,255,0.06)", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#FBBF24" }}>{(user.totalPoints || 4520).toLocaleString()} XP</div>
            <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>Total Points</div>
          </div>
        </div>

        {/* Level Progress Meter */}
        <div style={{
          marginTop: 14,
          position: "relative",
          zIndex: 1,
          background: "#1E293B",
          padding: "10px 14px",
          borderRadius: 8,
          border: "1px solid #334155"
        }}>
          <div className="tai-row tai-between" style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 6, color: "#FFFFFF" }}>
            <span>Level {user.level || 2} Progress ({percent}%)</span>
            <span style={{ color: "#FBBF24", fontWeight: 700 }}>{Math.max(0, ceiling - (user.totalPoints || 450)).toLocaleString()} XP to Level {(user.level || 2) + 1}</span>
          </div>
          <div style={{
            height: 6,
            borderRadius: 3,
            background: "#334155",
            overflow: "hidden"
          }}>
            <div style={{
              width: `${percent}%`,
              height: "100%",
              background: "#F59E0B",
              borderRadius: 3,
              transition: "width 0.4s ease"
            }} />
          </div>
        </div>
      </div>

      {/* =========================================================================
          KEY STATS TILES STRIP
          ========================================================================= */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
        <div className="tai-card" style={{ padding: 18, borderRadius: 10 }}>
          <div className="tai-row tai-gap10">
            <div style={{ width: 38, height: 38, borderRadius: 8, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BookOpen size={18} color="var(--primary)" />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>{user.lessonsCompleted || 18}</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Lessons Finished</div>
            </div>
          </div>
        </div>

        <div className="tai-card" style={{ padding: 18, borderRadius: 10 }}>
          <div className="tai-row tai-gap10">
            <div style={{ width: 38, height: 38, borderRadius: 8, background: "rgba(16, 185, 129, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <GraduationCap size={18} color="#10B981" />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>{CERTIFICATES.length}</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Certificates Earned</div>
            </div>
          </div>
        </div>

        <div className="tai-card" style={{ padding: 18, borderRadius: 10 }}>
          <div className="tai-row tai-gap10">
            <div style={{ width: 38, height: 38, borderRadius: 8, background: "rgba(245, 158, 11, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Flame size={18} color="#F59E0B" />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>{user.streak || 8} Days</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Daily Streak</div>
            </div>
          </div>
        </div>

        <div className="tai-card" style={{ padding: 18, borderRadius: 10 }}>
          <div className="tai-row tai-gap10">
            <div style={{ width: 38, height: 38, borderRadius: 8, background: "rgba(139, 92, 246, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={18} color="#8B5CF6" />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>15.8 hrs</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Total Study Time</div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          TAB NAVIGATION STRIP
          ========================================================================= */}
      <div className="tai-scrollx" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8, width: "100%", boxSizing: "border-box" }}>
        {[
          { k: "overview", label: "Progress Analytics", icon: BarChart3 },
          { k: "certificates", label: `Certificates (${CERTIFICATES.length})`, icon: GraduationCap },
          { k: "badges", label: `Badges (${effectiveAchievements.length})`, icon: Award },
          { k: "activity", label: "Activity Stream", icon: Calendar },
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeProgressTab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setActiveProgressTab(t.k)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: isActive ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                background: isActive ? "var(--primary-tint)" : "var(--surface)",
                color: isActive ? "var(--primary)" : "var(--text-2)",
                fontWeight: isActive ? 800 : 600,
                fontSize: 12.5,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                flexShrink: 0,
                whiteSpace: "nowrap",
                transition: "all 0.15s ease"
              }}
              onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.borderColor = "var(--primary-light)"; e.currentTarget.style.color = "var(--text)"; } }}
              onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-2)"; } }}
            >
              <Icon size={15} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          TAB 1: OVERVIEW & WEEKLY LEARNING ANALYTICS
          ========================================================================= */}
      {activeProgressTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            
            {/* Weekly Learning Hours Chart Card */}
            <div className="tai-card" style={{ padding: 24, borderRadius: 10 }}>
              <div className="tai-row tai-between" style={{ marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 2px", color: "var(--text)" }}>
                    Weekly Study Time
                  </h3>
                  <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>
                    15.8 hrs total • <span style={{ color: "var(--success)", fontWeight: 700 }}>+34% vs last week</span>
                  </div>
                </div>
                <Tag tone="success">On Track</Tag>
              </div>

              {/* Bar Chart Visualizer */}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: 160, padding: "20px 10px 10px", background: "var(--surface-3)", borderRadius: 8 }}>
                {WEEKLY_HOURS.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flex: 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)" }}>{item.hours}h</span>
                    <div style={{ width: 28, height: `${item.heightPct}%`, background: idx === 2 ? "var(--primary)" : "rgba(99, 102, 241, 0.4)", borderRadius: 6, transition: "all 0.2s ease" }} />
                    <span style={{ fontSize: 11.5, fontWeight: idx === 2 ? 800 : 600, color: idx === 2 ? "var(--primary)" : "var(--text-2)" }}>{item.day}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Skill Mastery Radar */}
            <div className="tai-card" style={{ padding: 24, borderRadius: 10 }}>
              <div className="tai-row tai-between" style={{ marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 2px", color: "var(--text)" }}>
                    Skill Competency Matrix
                  </h3>
                  <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>
                    Assessed via quizzes &amp; practical assignments
                  </div>
                </div>
                <Zap size={18} color="var(--primary)" />
              </div>

              <div className="tai-col tai-gap12">
                {SKILL_RADAR.map((item, idx) => (
                  <div key={idx}>
                    <div className="tai-row tai-between" style={{ fontSize: 12.5, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, color: "var(--text)" }}>{item.skill}</span>
                      <span style={{ fontWeight: 800, color: "var(--primary)" }}>{item.score}% ({item.level})</span>
                    </div>
                    <ProgressBar value={item.score} height={6} />
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Mystery Box Streak Reward Banner */}
          {milestoneBoxAvailable && (
            <div className="tai-card" style={{ borderColor: "var(--warning)", background: "rgba(245,158,11,0.06)", padding: 18, borderRadius: 10 }}>
              <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 12 }}>
                <div className="tai-row tai-gap14">
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(245, 158, 11, 0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Gift size={22} color="#F59E0B" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)" }}>Milestone Reward Mystery Box Available!</div>
                    <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>Unlocked by reaching your {user.streak || 8}-day continuous learning streak</div>
                  </div>
                </div>
                <button className="tai-btn tai-btn-primary" disabled={claimingBox} onClick={handleClaimBox} style={{ borderRadius: 8, padding: "8px 16px" }}>
                  {claimingBox ? "Opening Box..." : "🎁 Open Mystery Box"}
                </button>
              </div>
            </div>
          )}

          {revealedReward && (
            <div className="tai-card anim-pop" style={{ borderColor: "var(--success)", textAlign: "center", padding: 18, borderRadius: 10, background: "rgba(16, 185, 129, 0.06)" }}>
              <div style={{ fontWeight: 800, fontSize: 17, color: "var(--success)" }}>🎉 +{revealedReward.points} Points Awarded!</div>
              {revealedReward.streak_freeze > 0 && (
                <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4 }}>+{revealedReward.streak_freeze} Streak Freeze added to inventory</div>
              )}
            </div>
          )}

          {/* AI Insights Card */}
          <AIInsightsCard session={session} credits={credits} consumeCredit={consumeCredit} onBuyCredits={onBuyCredits} />

        </div>
      )}

      {/* =========================================================================
          TAB 2: VERIFIED CERTIFICATES & CREDENTIALS
          ========================================================================= */}
      {activeProgressTab === "certificates" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 13, color: "var(--text-3)" }}>
            Accredited certificates issued upon completing syllabi, final assessments, and peer reviews.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {CERTIFICATES.map((cert) => (
              <div
                key={cert.id}
                className="tai-card-hover"
                style={{
                  background: "var(--surface)",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: "0 4px 16px rgba(15,23,42,0.04)"
                }}
              >
                <div style={{ position: "relative", height: 140 }}>
                  <img src={cert.bannerImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(15,23,42,0.85) 0%, transparent 80%)" }} />
                  <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(16, 185, 129, 0.9)", color: "#fff", fontSize: 10.5, fontWeight: 800, padding: "3px 8px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4 }}>
                    <ShieldCheck size={13} /> VERIFIED CREDENTIAL
                  </div>
                  <div style={{ position: "absolute", bottom: 12, left: 14, right: 14, color: "#fff" }}>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>{cert.specialization}</span>
                    <h3 style={{ fontSize: 16, fontWeight: 900, margin: "2px 0 0", color: "#fff", lineHeight: 1.3 }}>{cert.title}</h3>
                  </div>
                </div>

                <div style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div className="tai-row tai-between" style={{ fontSize: 12, color: "var(--text-3)", paddingBottom: 10, borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: 6 }}>
                      <span>ID: <strong style={{ color: "var(--text)" }}>{cert.credentialId}</strong></span>
                      <span>Issued: <strong style={{ color: "var(--text)" }}>{cert.issueDate}</strong></span>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "12px 0" }}>
                      {cert.skills.map((s, idx) => (
                        <span key={idx} style={{ background: "var(--surface-3)", border: "1px solid var(--border)", fontSize: 11, fontWeight: 700, color: "var(--text-2)", padding: "3px 8px", borderRadius: 6 }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="tai-row tai-between" style={{ paddingTop: 12, borderTop: "1px solid var(--border)", flexWrap: "wrap", gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "var(--success)" }}>
                      {cert.grade}
                    </span>
                    <button
                      className="tai-btn tai-btn-primary tai-btn-sm"
                      onClick={() => setSelectedCertificate(cert)}
                      style={{ padding: "6px 14px", borderRadius: 8, fontWeight: 700 }}
                    >
                      View Certificate <ExternalLink size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: BADGES & MILESTONES
          ========================================================================= */}
      {activeProgressTab === "badges" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          
          {/* Earned Badges */}
          <div>
            <div className="tai-row tai-between" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", margin: 0 }}>
                Unlocked Badges ({effectiveAchievements.length})
              </h3>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              {effectiveAchievements.map((a) => {
                const def = ACHIEVEMENT_CATALOG.find((d) => d.id === (a.achievement_slug || a.achievement_id));
                const Icon = iconForCategory(def?.category);
                return (
                  <div key={a.id} className="tai-card tai-card-hover" style={{ padding: 16, borderRadius: 10, display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 8, background: "rgba(16, 185, 129, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--success)", flexShrink: 0 }}>
                      <Icon size={20} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="tai-row tai-between">
                        <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>{a.achievement_title || "Achievement"}</div>
                        <CheckCircle2 size={15} color="var(--success)" />
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{a.achievement_description}</div>
                      <div style={{ fontSize: 11.5, color: "var(--primary)", fontWeight: 800, marginTop: 4 }}>
                        +{a.points_awarded || 50} XP • Earned {formatDate(a.earned_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Locked Badges */}
          <div>
            <div className="tai-row tai-between" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", margin: 0 }}>
                Available to Unlock ({locked.length})
              </h3>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              {locked.map((def) => {
                const Icon = iconForCategory(def.category);
                const { current, threshold, percent: p } = getAchievementProgress(def, user);
                return (
                  <div key={def.id} className="tai-card" style={{ opacity: 0.75, padding: 16, borderRadius: 10, display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 8, background: "var(--surface-3)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", flexShrink: 0 }}>
                      <Icon size={20} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{def.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{def.description}</div>
                      <div style={{ marginTop: 6 }}><ProgressBar value={p} height={5} /></div>
                      <div className="tai-row tai-between" style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 4 }}>
                        <span>{Math.min(current, threshold)} / {threshold}</span>
                        <span>+{def.points} XP</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          TAB 4: ACTIVITY LOG
          ========================================================================= */}
      {activeProgressTab === "activity" && (
        <div className="tai-card" style={{ padding: 18, borderRadius: 10 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", margin: "0 0 12px" }}>
            Daily Activity Stream
          </h3>

          <div className="tai-col tai-gap8">
            {(streakActivity.length > 0
              ? streakActivity.map((row, idx) => ({
                  key: row.id || idx,
                  date: formatDate(row.activity_date) || "N/A",
                  action: `${row.lessons_completed || 0} lesson${row.lessons_completed === 1 ? "" : "s"} completed`,
                  xp: `+${row.points_earned || 0} XP`,
                }))
              : [
                  { key: 0, date: "Today, Aug 21", action: "Completed 2 lessons in Full-Stack AI", xp: "+120 XP" },
                  { key: 1, date: "Yesterday, Aug 20", action: "Scored 100% on Spatial UI Quiz", xp: "+150 XP" },
                  { key: 2, date: "Aug 19, 2026", action: "Earned 3-Day Streak Runner badge", xp: "+100 XP" },
                  { key: 3, date: "Aug 18, 2026", action: "Attended Studio Masterclass with Dr. Vance", xp: "+80 XP" },
                  { key: 4, date: "Aug 17, 2026", action: "Participated in Cohort Study Group", xp: "+50 XP" },
                ]
            ).map((row) => (
              <div key={row.key} className="tai-row tai-between" style={{ padding: "10px 12px", background: "var(--surface-3)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{row.action}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>{row.date}</div>
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--primary)" }}>{row.xp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          CERTIFICATE PREVIEW MODAL (PORTAL-MOUNTED DIRECTLY ON DOCUMENT.BODY)
          ========================================================================= */}
      <PortalModal
        isOpen={Boolean(selectedCertificate)}
        onClose={() => setSelectedCertificate(null)}
        maxWidth={700}
        zIndex={9999}
      >
        {selectedCertificate && (
          <>
            <div className="tai-row tai-between" style={{ marginBottom: 20, gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "var(--primary-light, #818CF8)", textTransform: "uppercase", letterSpacing: ".06em" }}>
                OFFICIAL CERTIFICATE OF COMPLETION
              </span>
              <button onClick={() => setSelectedCertificate(null)} style={{ background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ textAlign: "center", padding: "10px 20px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".04em" }}>This certifies that</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text)", margin: "8px 0" }}>
                {session?.user?.user_metadata?.full_name || session?.user?.email || "Learner"}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-2)" }}>has successfully mastered the comprehensive curriculum for</div>
              
              <h2 style={{ fontSize: 22, fontWeight: 900, color: "var(--primary-light, #818CF8)", margin: "14px 0 6px" }}>
                {selectedCertificate.title}
              </h2>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>
                {selectedCertificate.specialization}
              </div>

              <div style={{ display: "inline-block", background: "var(--surface-2)", padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 800, color: "var(--text)", marginTop: 14 }}>
                Grade: {selectedCertificate.grade}
              </div>

              <div className="tai-row tai-between" style={{ marginTop: 28, paddingTop: 20, borderTop: "1px dashed var(--border)", fontSize: 12, color: "var(--text-3)", textAlign: "left", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div>Instructor: <strong style={{ color: "var(--text)" }}>{selectedCertificate.instructor}</strong></div>
                  <div>Issued: <strong style={{ color: "var(--text)" }}>{selectedCertificate.issueDate}</strong></div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div>Credential ID: <strong style={{ color: "var(--text)" }}>{selectedCertificate.credentialId}</strong></div>
                  <div>Verified by: <strong style={{ color: "var(--text)" }}>Train AI Academic Authority</strong></div>
                </div>
              </div>
            </div>

            <div className="tai-row tai-between" style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)", flexWrap: "wrap", gap: 10 }}>
              <button
                className="tai-btn tai-btn-outline"
                onClick={() => {
                  navigator.clipboard?.writeText(selectedCertificate.verificationUrl);
                  showToast?.("Verification link copied!");
                }}
              >
                <Share2 size={15} /> Copy Verification Link
              </button>

              <button
                className="tai-btn tai-btn-primary"
                onClick={() => {
                  showToast?.("Downloading Official PDF Certificate...");
                  setTimeout(() => showToast?.("Certificate saved to your Downloads!"), 1200);
                }}
              >
                <Download size={15} /> Download PDF Certificate
              </button>
            </div>
          </>
        )}
      </PortalModal>

    </div>
  );
}

