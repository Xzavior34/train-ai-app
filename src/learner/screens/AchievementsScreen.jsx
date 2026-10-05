import React, { useState, useEffect } from "react";
import { TopBar, StatTile, ProgressBar, Tag } from "../components/LearnerUI.jsx";
import { ACHIEVEMENT_CATALOG, getAchievementProgress } from "../achievementCatalog.js";
import { AIInsightsCard } from "../components/AIInsightsCard.jsx";
import {
  Trophy, Flame, Snowflake, Award, BookOpen, Users, GraduationCap, CheckCircle2,
  Gift, Calendar, BarChart3, Clock, Download, Share2, ExternalLink,
  ShieldCheck, ArrowUpRight, Check, X, TrendingUp, Target
} from "lucide-react";
import { fetchMyMysteryBoxes, claimMysteryBox } from "../../lib/api/schemaHelper.js";
import { PortalModal } from "../../components/common/PortalModal.jsx";
import { isMockDataEnabled } from "../../lib/mockDataManager.js";
import { CertificateDocument } from "../../components/certificates/CertificateDocument.jsx";
import { CERTIFICATE_THEMES } from "../../components/certificates/certificateThemes.js";
import { getCanonicalDomain } from "../../services/emailService.js";

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

export function AchievementsScreen({ user = {}, courses = [], achievements = [], streakActivity = [], leaderboardQuery = {}, complianceAssignmentsQuery = {}, myCertificates = [], back, session, showToast, credits, consumeCredit, onBuyCredits, push }) {
  const userId = session?.user?.id;
  const [activeProgressTab, setActiveProgressTab] = useState("overview"); // "overview" | "certificates" | "badges" | "activity"
  const [mysteryBoxes, setMysteryBoxes] = useState([]);
  const [claimingBox, setClaimingBox] = useState(false);
  const [revealedReward, setRevealedReward] = useState(null);
  const [selectedCertificate, setSelectedCertificate] = useState(null);
  const [customCertName, setCustomCertName] = useState("");

  useEffect(() => {
    if (session?.user) {
      const defaultName = session.user.user_metadata?.full_name || session.user.user_metadata?.display_name || user.name || session.user.email?.split("@")[0] || "Learner Name";
      setCustomCertName(defaultName);
    }
  }, [session?.user, user.name]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchMyMysteryBoxes(userId).then((rows) => { if (!cancelled) setMysteryBoxes(rows); });
    return () => { cancelled = true; };
  }, [userId]);

  const streakMilestonesEarned = Math.floor((user.streak || 0) / 7);
  const boxesAlreadyClaimed = mysteryBoxes.length;
  const milestoneBoxAvailable = streakMilestonesEarned > boxesAlreadyClaimed && streakMilestonesEarned > 0;

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

  // Derive dynamic certificates from real database certificates or completed courses
  const dynamicCertificates = (() => {
    if (myCertificates && myCertificates.length > 0) {
      return myCertificates.map((cert, idx) => ({
        id: cert.id || `cert-db-${idx}`,
        title: cert.courses?.title || cert.title || "Course Completion Certificate",
        specialization: cert.courses?.category || "Professional Track",
        issueDate: cert.issued_at ? formatDate(cert.issued_at) : "Recently",
        credentialId: cert.certificate_number || cert.id?.slice(0, 16) || `TAI-CERT-${new Date().getFullYear()}`,
        grade: "Verified Completion",
        scorePct: cert.score_pct || 100,
        template: cert.certificate_templates || null,
        instructor: cert.courses?.instructor || user.organization || "Sara Foundation",
        skills: [cert.courses?.category || "Core Curriculum", "Applied Mastery"],
        verificationUrl: `${getCanonicalDomain()}/verify/${cert.certificate_number || cert.id}`,
        bannerImage: cert.courses?.coverImageUrl || cert.courses?.image || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80"
      }));
    }
    const completedCourses = (courses || []).filter(c => (c.progress || 0) >= 100);
    return completedCourses.map((c, idx) => ({
      id: `cert-c-${c.id || idx}`,
      title: c.title,
      specialization: c.category || "Professional Track",
      issueDate: formatDate(new Date().toISOString()),
      credentialId: `TAI-CERT-${new Date().getFullYear()}-${(c.id || "").slice(-4).toUpperCase() || "1001"}`,
      grade: "100% Complete",
      scorePct: 100,
      template: null,
      instructor: c.instructor || user.organization || "Sara Foundation",
      skills: [c.category || "General", "Track Completion"],
      verificationUrl: `${getCanonicalDomain()}/verify/TAI-${c.id}`,
      bannerImage: c.coverImageUrl || c.image || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80"
    }));
  })();

  // Derive skill radar from actual courses
  const categoriesMap = {};
  (courses || []).forEach(c => {
    const cat = c.category || "Core Track";
    if (!categoriesMap[cat]) categoriesMap[cat] = { total: 0, count: 0 };
    categoriesMap[cat].total += (c.progress || 0);
    categoriesMap[cat].count += 1;
  });
  const dynamicSkillRadar = Object.entries(categoriesMap).map(([skill, data]) => {
    const score = Math.round(data.total / (data.count || 1));
    const level = score >= 90 ? "Expert" : score >= 75 ? "Proficient" : score >= 40 ? "Intermediate" : score > 0 ? "In Progress" : "Not Started";
    return { skill, score, level };
  });
  const skillRadar = dynamicSkillRadar.length > 0 ? dynamicSkillRadar : [
    { skill: "Curriculum Track", score: user.mastery || 0, level: (user.mastery || 0) >= 70 ? "Proficient" : "In Progress" }
  ];

  const effectiveAchievements = achievements || [];
  const { ceiling, percent } = levelProgress(user.level || 1, user.totalPoints || 0);
  const earnedIds = new Set(effectiveAchievements.map((a) => a.achievement_slug || a.achievement_id));
  const locked = ACHIEVEMENT_CATALOG.filter((def) => !earnedIds.has(def.id));

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      {/* =========================================================================
          HERO BANNER: Progression & Level Showcase (Adaptive Liquid Glass)
          ========================================================================= */}
      <div
        className="tai-card tai-hero-card anim-fluid-entrance"
        style={{
          borderRadius: 14,
          padding: "clamp(18px, 2.5vw, 24px)",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="tai-hero-title" style={{ fontSize: "clamp(20px, 2.5vw, 25px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 4px", lineHeight: 1.2 }}>
              Level {user.level || 1} • {user.role ? user.role.toUpperCase() : "Active Learner"}
            </h1>
            <p className="tai-hero-desc" style={{ fontSize: 13, margin: 0, maxWidth: 620, lineHeight: 1.45 }}>
              {(user.totalPoints || 0).toLocaleString()} XP earned • {Math.max(0, ceiling - (user.totalPoints || 0))} XP to Level {(user.level || 1) + 1}
            </p>
          </div>

          <div className="tai-hero-subcard" style={{ textAlign: "right", flexShrink: 0, padding: "10px 16px", borderRadius: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#F59E0B" }}>{(user.totalPoints || 0).toLocaleString()} XP</div>
            <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>Total Earned XP</div>
          </div>
        </div>

        {/* Level Progress Meter */}
        <div className="tai-hero-subcard" style={{
          marginTop: 16,
          position: "relative",
          zIndex: 1,
          padding: "12px 16px",
          borderRadius: 10
        }}>
          <div className="tai-row tai-between" style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>
            <span>Level {user.level || 1} Progress ({percent}%)</span>
            <span style={{ color: "#FBBF24", fontWeight: 700 }}>{Math.max(0, ceiling - (user.totalPoints || 0)).toLocaleString()} XP to Level {(user.level || 1) + 1}</span>
          </div>
          <div style={{
            height: 8,
            borderRadius: 99,
            background: "var(--surface-3)",
            overflow: "hidden"
          }}>
            <div style={{
              width: `${percent}%`,
              height: "100%",
              background: "#F59E0B",
              borderRadius: 99,
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
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>{user.lessonsCompleted || 0}</div>
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
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>{dynamicCertificates.length}</div>
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
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>{user.streak || 0} Days</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Daily Streak</div>
            </div>
          </div>
        </div>

        <div className="tai-card" style={{ padding: 18, borderRadius: 10 }}>
          <div className="tai-row tai-gap10">
            <div style={{ width: 38, height: 38, borderRadius: 8, background: "rgba(139, 92, 246, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={18} color="#3B82F6" />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>{user.totalHours || 0} hrs</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Total Study Time</div>
            </div>
          </div>
        </div>

        <div className="tai-card" style={{ padding: 18, borderRadius: 10 }}>
          <div className="tai-row tai-gap10">
            <div style={{ width: 38, height: 38, borderRadius: 8, background: "rgba(37, 99, 235, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Trophy size={18} color="var(--primary)" />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>
                {(() => {
                  const rows = leaderboardQuery?.data || [];
                  const mine = rows.find(r => r.you || r.user_id === userId || r.id === userId);
                  return mine?.rank ? `#${mine.rank}` : "-";
                })()}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Current Rank</div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          TAB NAVIGATION STRIP
          ========================================================================= */}
      <div className="tai-scrollx" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8, width: "100%", boxSizing: "border-box", gap: 8 }}>
        {[
          { k: "overview", label: "Progress Analytics", icon: BarChart3 },
          { k: "certificates", label: `Certificates (${dynamicCertificates.length})`, icon: GraduationCap },
          { k: "badges", label: `Badges (${effectiveAchievements.length})`, icon: Award },
          { k: "activity", label: `Activity (${streakActivity.length})`, icon: Calendar },
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeProgressTab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setActiveProgressTab(t.k)}
              className={`tai-btn tai-btn-sm ${isActive ? "tai-btn-primary" : "tai-btn-outline"}`}
              style={{
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 12.5,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                flexShrink: 0,
                whiteSpace: "nowrap"
              }}
            >
              <Icon size={14} />
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
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 20 }}>
            
            {/* Weekly Learning Hours Chart Card */}
            <div className="tai-card" style={{ padding: "18px 14px", borderRadius: 10 }}>
              <div className="tai-row tai-between" style={{ marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 2px", color: "var(--text)" }}>
                    Study Time &amp; Velocity
                  </h3>
                  <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>
                    {user.totalHours || 0} hrs total logged across enrolled tracks
                  </div>
                </div>
                <Tag tone="success">Active</Tag>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-3)", padding: "12px 14px", borderRadius: 8 }}>
                  <span style={{ fontSize: 12.5, color: "var(--text-2)", fontWeight: 600 }}>Lessons Finished</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>{user.lessonsCompleted || 0}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-3)", padding: "12px 14px", borderRadius: 8 }}>
                  <span style={{ fontSize: 12.5, color: "var(--text-2)", fontWeight: 600 }}>Continuous Streak</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#F59E0B" }}>{user.streak || 0} Days</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-3)", padding: "12px 14px", borderRadius: 8 }}>
                  <span style={{ fontSize: 12.5, color: "var(--text-2)", fontWeight: 600 }}>Curriculum Mastery</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "var(--primary)" }}>{user.mastery || 0}%</span>
                </div>
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
                    Assessed from course progress &amp; assessments
                  </div>
                </div>
                <Target size={18} color="var(--primary)" />
              </div>

              <div className="tai-col tai-gap12">
                {skillRadar.map((item, idx) => (
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
                  {claimingBox ? "Opening Box..." : <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Gift size={14} /> Open Mystery Box</span>}
                </button>
              </div>
            </div>
          )}

          {revealedReward && (
            <div className="tai-card anim-pop" style={{ borderColor: "var(--success)", textAlign: "center", padding: 18, borderRadius: 10, background: "rgba(16, 185, 129, 0.06)" }}>
              <div style={{ fontWeight: 800, fontSize: 17, color: "var(--success)" }}>+{revealedReward.points} Points Awarded!</div>
              {revealedReward.streak_freeze > 0 && (
                <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4 }}>+{revealedReward.streak_freeze} Streak Freeze added to inventory</div>
              )}
            </div>
          )}

          {/* Key Alerts */}
          {(() => {
            const pendingCompliance = (complianceAssignmentsQuery?.data || []).filter(a => a.status !== "completed");
            const alerts = [];
            if (pendingCompliance.length > 0) {
              alerts.push({ text: `${pendingCompliance.length} mandatory compliance module${pendingCompliance.length > 1 ? "s" : ""} due`, tone: "danger" });
            }
            if (typeof credits === "number" && credits <= 2) {
              alerts.push({ text: "AI credits running low", tone: "warning" });
            }
            if (!user?.streak || user.streak <= 0) {
              alerts.push({ text: "Your study streak has reset - complete a lesson today to start a new one", tone: "warning" });
            }
            if (alerts.length === 0) return null;
            return (
              <div className="tai-card" style={{ padding: 16, borderRadius: 10, border: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)", marginBottom: 10 }}>Key Alerts</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {alerts.map((a, idx) => (
                    <div key={idx} className="tai-row tai-gap8" style={{ alignItems: "center", padding: "8px 10px", borderRadius: 8, background: a.tone === "danger" ? "rgba(239, 68, 68, 0.08)" : "rgba(245, 158, 11, 0.08)" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: a.tone === "danger" ? "var(--danger)" : "#B45309" }}>{a.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Completed Courses */}
          <div className="tai-card" style={{ padding: 16, borderRadius: 10, border: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)", marginBottom: 10 }}>Completed Courses</div>
            {(() => {
              const completed = (courses || []).filter(c => (c.progress || 0) >= 100);
              if (completed.length === 0) {
                return <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>No completed courses yet.</div>;
              }
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {completed.map(c => (
                    <div key={c.id} className="tai-row tai-between" style={{ padding: "8px 10px", background: "var(--surface-3)", borderRadius: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{c.title}</span>
                      <CheckCircle2 size={15} color="#10B981" />
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

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

          {dynamicCertificates.length === 0 ? (
            <div className="tai-card" style={{ textAlign: "center", padding: "40px 20px", borderRadius: 10 }}>
              <GraduationCap size={40} color="var(--text-3)" style={{ margin: "0 auto 12px", opacity: 0.6 }} />
              <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>No Certificates Earned Yet</div>
              <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4, maxWidth: 440, margin: "4px auto 16px" }}>
                Complete all modules and assignments in an enrolled course to earn your verified credential.
              </div>
              {push && (
                <button className="tai-btn tai-btn-primary" onClick={() => push("courses")} style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: "0 auto" }}>
                  <span>Browse Courses</span>
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 20 }}>
              {dynamicCertificates.map((cert) => (
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
          )}
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

            {effectiveAchievements.length === 0 ? (
              <div className="tai-card" style={{ padding: "24px 16px", textAlign: "center", borderRadius: 10 }}>
                <Award size={32} color="var(--text-3)" style={{ margin: "0 auto 8px", opacity: 0.6 }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>No badges unlocked yet</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Complete lessons and daily study streaks to unlock badges.</div>
              </div>
            ) : (
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
            )}
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
            {streakActivity.length === 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                No recent study activity recorded. Start a lesson to track your daily stream.
              </div>
            ) : (
              streakActivity.map((row, idx) => (
                <div key={row.id || idx} className="tai-row tai-between" style={{ padding: "10px 12px", background: "var(--surface-3)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                      {`${row.lessons_completed || 0} lesson${row.lessons_completed === 1 ? "" : "s"} completed`}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>
                      {formatDate(row.activity_date) || "Recently"}
                    </div>
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--primary)" }}>
                    +{row.points_earned || 0} XP
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          CERTIFICATE PREVIEW MODAL (PORTAL-MOUNTED DIRECTLY ON DOCUMENT.BODY)
          ========================================================================= */}
      <PortalModal
        isOpen={Boolean(selectedCertificate)}
        onClose={() => setSelectedCertificate(null)}
        maxWidth={840}
        zIndex={9999}
      >
        {selectedCertificate && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="tai-row tai-between" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Award size={18} color="var(--primary)" />
                <span style={{ fontSize: 13, fontWeight: 900, color: "var(--text)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                  Verified Certificate of Achievement
                </span>
              </div>
              <button
                onClick={() => setSelectedCertificate(null)}
                style={{ background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Render High-Fidelity Creative Certificate Document */}
            <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
              <CertificateDocument
                certificate={selectedCertificate}
                template={selectedCertificate.template}
                recipientName={customCertName || session?.user?.user_metadata?.full_name || session?.user?.email?.split("@")[0] || "Learner"}
                onRecipientNameChange={setCustomCertName}
                allowNameEdit={true}
                courseTitle={selectedCertificate.title}
                issueDate={selectedCertificate.issueDate}
                credentialNumber={selectedCertificate.credentialId}
                scorePct={selectedCertificate.scorePct}
                verificationUrl={selectedCertificate.verificationUrl}
              />
            </div>

            {/* Bottom Actions Toolbar */}
            <div className="tai-row tai-between" style={{ marginTop: 8, paddingTop: 14, borderTop: "1px solid var(--border)", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="tai-btn tai-btn-outline tai-btn-sm"
                  onClick={() => {
                    navigator.clipboard?.writeText(selectedCertificate.verificationUrl);
                    showToast?.("Verification link copied to clipboard!");
                  }}
                  style={{ borderRadius: 8, fontWeight: 700 }}
                >
                  <Share2 size={14} /> Copy Verification Link
                </button>

                <button
                  type="button"
                  className="tai-btn tai-btn-outline tai-btn-sm"
                  onClick={() => {
                    const text = `I just earned my verified certificate in "${selectedCertificate.title}" on Train AI with Sara Foundation! 🎓`;
                    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(selectedCertificate.verificationUrl)}`;
                    window.open(url, "_blank");
                  }}
                  style={{ borderRadius: 8, fontWeight: 700 }}
                >
                  Share to Socials
                </button>
              </div>

              <button
                type="button"
                className="tai-btn tai-btn-primary tai-btn-sm"
                onClick={() => {
                  window.print();
                }}
                style={{ borderRadius: 8, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Download size={14} /> Print / Download PDF
              </button>
            </div>
          </div>
        )}
      </PortalModal>

    </div>
  );
}

