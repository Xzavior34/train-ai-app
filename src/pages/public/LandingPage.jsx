import React, { useState, useEffect } from "react";
import {
  ArrowRight, BookOpen, GraduationCap, Cpu, ShieldCheck, CheckCircle2, Globe, X,
  Brain, Layers, ChevronDown, HelpCircle, ClipboardList, UserPlus, Rocket,
  Building2, Users, Target, TrendingUp, AlertTriangle, Eye, Lock, Compass, BarChart3,
  GitCompare, Table, School, Handshake, Briefcase, Zap, Sparkles, Flame, Menu, Check,
  Play, MessageSquare, Laptop, Award, Star, Activity, ArrowUpRight, Gauge, Database,
  Home, Bot, MessageCircle, Mail, Download, Wifi, Accessibility, Bell, Send,
  Facebook, Twitter, Instagram, Linkedin, Search, RefreshCw
} from "lucide-react";
import { submitDemoRequest, submitOrganizationInquiry, captureAttributionFromURL } from "../../lib/api/waitlist.js";
import { trackReferralClickIfPresent } from "../../lib/api/organizations.js";

const TEAM_SIZE_OPTIONS = ["1–50", "51–200", "201–1,000", "1,000+"];

const LEGAL_CONTENT = {
  about: {
    title: "About Us",
    body: "Train AI is an AI-powered workforce learning and intelligence operating system that gives modern organizations a live, real-time map of employee capabilities. We connect enterprise learners, instructors, and structured curriculum into personalized, outcome-driven pathways to measure readiness, not completion."
  },
  privacy: {
    title: "Privacy Policy",
    body: "Our Privacy Policy ensures your workforce data remains strictly confidential and protected. We process minimal telemetry required to deliver adaptive pathways, track skills, and issue certified credentials. We never sell personal data or use proprietary enterprise data to train public foundation models."
  },
  terms: {
    title: "Terms of Service",
    body: "Train AI terms govern organizational workspaces, role-based licensing, and institutional agreements. All accounts, certifications, and compliance logs are auditable under enterprise SLAs. Questions: hello@trainailtd.com."
  },
  cookie: {
    title: "Cookie Policy",
    body: "We use strictly necessary session cookies to maintain secure authentication and role isolation. Optional analytics cookies remain disabled until explicit user consent is provided. Questions: hello@trainailtd.com."
  }
};

const HOW_WE_BUILD_IT = [
  {
    title: "Readiness over completion",
    desc: "A finished course is not the same as capability."
  },
  {
    title: "Intelligence over reporting",
    desc: "Dashboards should support decisions, not just activity."
  },
  {
    title: "Organisation-first",
    desc: "Built for businesses, with individual access as a second layer."
  },
  {
    title: "Every signal matters",
    desc: "Assessments, progress, usage and feedback all contribute."
  }
];

const SIGNALS = [
  "Assessments",
  "Course completion",
  "Compliance completion",
  "Learner activity",
  "Progress data",
  "Instructor feedback",
  "Manager review",
  "AI usage signals"
];

const TRUST_FEATURES = [
  {
    icon: Lock,
    title: "Secure tenant separation",
    desc: "Row-level policies keep every organisation's learners, courses and results isolated."
  },
  {
    icon: DocumentIcon,
    title: "Audit logging",
    desc: "Administrative actions are recorded in an append-only trail for enterprise review."
  },
  {
    icon: Download,
    title: "Consent & export controls",
    desc: "Data ownership is explicit, with export and consent controls for compliance teams."
  },
  {
    icon: Bell,
    title: "Reliable notifications",
    desc: "Session reminders, assignment alerts and nudges by email and in-app."
  },
  {
    icon: Wifi,
    title: "Low-bandwidth ready",
    desc: "Fast on modest connections and mobile-first across every surface."
  },
  {
    icon: Accessibility,
    title: "Accessible UI",
    desc: "Readable contrast, keyboard-friendly navigation and semantic structure."
  }
];

function DocumentIcon(props) {
  return <ClipboardList {...props} />;
}

const FAQ_ITEMS = [
  {
    q: "How does Train AI differ from a traditional LMS like TalentLMS or Coursera?",
    a: "Traditional LMS platforms measure course completion: whether a learner clicked through videos or took a static quiz. Train AI is a Workforce Intelligence Operating System that maps real capability, tracks team readiness scores in real-time, and provides 24/7 AI tutoring with live cohort mentorship."
  },
  {
    q: "Can our organization upload our own proprietary courses and SCORM files?",
    a: "Yes. Train AI supports internal courses, SCORM packages, interactive lessons, custom quizzes, and external partner curriculum, all tracked in the same unified readiness dashboard."
  },
  {
    q: "How does the AI Neural Coach work in daily practice?",
    a: "Every learner has access to a 24/7 conversational AI learning tutor that provides personalized step-by-step explanations, generates practice quizzes tailored to weak spots, and reviews code exercises in real time."
  },
  {
    q: "How are workspaces, roles, and permissions partitioned?",
    a: "Train AI provides two unified applications (Learner App and Organisation Workspace) with role-based access control: Learners view their own progress; Instructors run cohorts and grade assessments; Managers inspect team readiness scores; Admins manage bulk onboarding, SSO, and compliance."
  }
];

export default function LandingPage({ onNavigate }) {
  useEffect(() => { captureAttributionFromURL(); }, []);
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) trackReferralClickIfPresent(ref);
  }, []);

  const [demoName, setDemoName] = useState("");
  const [demoEmail, setDemoEmail] = useState("");
  const [demoCompany, setDemoCompany] = useState("");
  const [demoTeamSize, setDemoTeamSize] = useState(TEAM_SIZE_OPTIONS[0]);
  const [demoMessage, setDemoMessage] = useState("");
  const [demoSubmitted, setDemoSubmitted] = useState(false);
  const [demoError, setDemoError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [openFaq, setOpenFaq] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);

  // Interactive dynamic simulator tab for Learner App preview
  const [learnerPreviewTab, setLearnerPreviewTab] = useState("insights");

  useEffect(() => {
    if (!activeModal && !demoModalOpen) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setActiveModal(null);
        setDemoModalOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeModal, demoModalOpen]);

  async function handleDemoSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setDemoError("");
    try {
      const result = await submitDemoRequest({
        fullName: demoName,
        workEmail: demoEmail,
        companyName: demoCompany,
        teamSize: demoTeamSize,
        message: demoMessage,
        source: "landing_page",
      });
      if (!result.success) {
        setDemoError(result.error || "Could not submit your request. Please try again.");
        return;
      }
      setDemoSubmitted(true);
    } catch (err) {
      console.warn("Demo request failed:", err);
      setDemoError("Something went wrong. Please try again, or email info@trainailtd.com.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleNewsletterSubmit(e) {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setNewsletterSubscribed(true);
    setNewsletterEmail("");
  }

  function scrollToId(id) {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleNav(target) {
    setMobileMenuOpen(false);
    if (["about", "privacy", "terms", "cookie"].includes(target)) {
      setActiveModal(target);
      return;
    }
    if (["intelligence", "learners", "organisation", "faq", "how-it-works", "trust"].includes(target)) {
      scrollToId(target);
      return;
    }
    if (target === "demo") {
      setDemoModalOpen(true);
      return;
    }
    onNavigate(target);
  }

  return (
    <div style={styles.outer}>
      <style>{`
        @keyframes floatSlow { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        @keyframes floatSubtle { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-4px); } }
        @keyframes pulseDot { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: 0.6; } }
        @keyframes pulseGlow { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.08); } }
        @keyframes shimmerLine { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

        @keyframes fillBar1 { from { width: 0%; } to { width: 82%; } }
        @keyframes fillBar2 { from { width: 0%; } to { width: 74%; } }
        @keyframes fillBar3 { from { width: 0%; } to { width: 61%; } }
        @keyframes fillBar4 { from { width: 0%; } to { width: 55%; } }

        .lp-card-hover { transition: transform .24s cubic-bezier(0.16, 1, 0.3, 1), box-shadow .24s ease, border-color .24s ease; }
        .lp-card-hover:hover { transform: translateY(-5px); box-shadow: 0 20px 40px -10px rgba(15,23,42,.1); border-color: #BFDBFE !important; }

        .lp-step-card { transition: all .25s ease; }
        .lp-step-card:hover { transform: translateY(-6px); box-shadow: 0 20px 45px -12px rgba(37,99,235,0.18); border-color: #93C5FD !important; }

        .lp-nav-link { transition: color .15s ease; cursor: pointer; color: #475569; font-weight: 500; font-size: 14px; }
        .lp-nav-link:hover { color: #2563EB !important; }

        .lp-pill-hover { transition: all .2s ease; cursor: pointer; }
        .lp-pill-hover:hover { transform: translateY(-2px); border-color: #93C5FD !important; background: #EFF6FF !important; color: #1D4ED8 !important; box-shadow: 0 4px 12px rgba(37,99,235,0.1); }

        .action-btn { transition: transform .15s ease, box-shadow .15s ease; }
        .action-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 25px -4px rgba(37, 99, 235, 0.4); }
        .action-btn:active { transform: scale(.96); }

        .lp-bar-1 { animation: fillBar1 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .lp-bar-2 { animation: fillBar2 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .lp-bar-3 { animation: fillBar3 1.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .lp-bar-4 { animation: fillBar4 1.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        .lp-float-card { animation: floatSlow 5s ease-in-out infinite; }
        .lp-pulse-live { animation: pulseDot 2s ease-in-out infinite; }
        .lp-glow-ambient { animation: pulseGlow 6s ease-in-out infinite; }

        .lp-footer-link { color: #94A3B8; text-decoration: none; font-size: 13.5px; transition: color .15s ease; cursor: pointer; }
        .lp-footer-link:hover { color: #FFFFFF !important; }

        .lp-social-btn { width: 36px; height: 36px; border-radius: 50%; background: #1E293B; border: 1px solid #334155; display: flex; align-items: center; justifyContent: center; color: #94A3B8; transition: all .18s ease; cursor: pointer; }
        .lp-social-btn:hover { background: #2563EB; color: #FFFFFF; border-color: #2563EB; transform: translateY(-2px); }

        @media (max-width: 920px) {
          .lp-desktop-nav { display: none !important; }
          .lp-mobile-menu-btn { display: flex !important; }
          .lp-hero-grid { grid-template-columns: 1fr !important; gap: 40px !important; text-align: center !important; }
          .lp-hero-left { margin: 0 auto !important; max-width: 600px !important; }
          .lp-hero-ctas { justify-content: center !important; }
          .lp-hero-pills { justify-content: center !important; }
          .lp-hero-right { justify-content: center !important; }
          .lp-steps-connector { display: none !important; }
        }
        @media (min-width: 921px) {
          .lp-mobile-drawer { display: none !important; }
          .lp-mobile-menu-btn { display: none !important; }
        }
        @media (max-width: 640px) {
          .lp-hero-h1 { font-size: 34px !important; }
          .lp-section-h2 { font-size: 26px !important; }
          .lp-section { padding: 48px 16px !important; }
        }
      `}</style>

      {/* =========================================================================
          STICKY HEADER
          ========================================================================= */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => handleNav("home")}>
            <img src="/train-ai-logo.png" alt="Train AI" style={{ height: 40, width: "auto", objectFit: "contain", display: "block" }} />
          </div>

          {/* Center Navigation Links */}
          <nav className="lp-desktop-nav" style={{ display: "flex", gap: 28, alignItems: "center" }}>
            <span className="lp-nav-link" onClick={() => handleNav("home")}>Home</span>
            <span className="lp-nav-link" onClick={() => handleNav("intelligence")}>Intelligence</span>
            <span className="lp-nav-link" onClick={() => handleNav("learners")}>Learners</span>
            <span className="lp-nav-link" onClick={() => handleNav("organisation")}>Organisation</span>
            <span className="lp-nav-link" onClick={() => handleNav("faq")}>FAQ</span>
          </nav>

          {/* Action CTAs */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              className="action-btn"
              style={styles.signInBtn}
              onClick={() => handleNav("signin")}
            >
              Sign In
            </button>
            <button
              className="action-btn"
              style={styles.requestDemoBtn}
              onClick={() => handleNav("demo")}
            >
              Request a demo
            </button>
            <button
              className="action-btn"
              style={styles.getStartedBtn}
              onClick={() => handleNav("signin")}
            >
              Get Started
            </button>

            {/* Mobile Hamburger Button */}
            <button
              className="lp-mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                width: 38, height: 38, borderRadius: 10, border: "1px solid #E2E8F0",
                background: "#F8FAFC", display: "none", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#0F172A"
              }}
              aria-label="Toggle Mobile Navigation"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lp-mobile-drawer" style={{ background: "#FFFFFF", borderTop: "1px solid #E2E8F0", padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 10px 25px rgba(0,0,0,0.06)" }}>
            <span className="lp-nav-link" style={{ fontSize: 15, fontWeight: 700 }} onClick={() => handleNav("home")}>Home</span>
            <span className="lp-nav-link" style={{ fontSize: 15, fontWeight: 700 }} onClick={() => handleNav("intelligence")}>Intelligence</span>
            <span className="lp-nav-link" style={{ fontSize: 15, fontWeight: 700 }} onClick={() => handleNav("learners")}>Learners</span>
            <span className="lp-nav-link" style={{ fontSize: 15, fontWeight: 700 }} onClick={() => handleNav("organisation")}>Organisation</span>
            <span className="lp-nav-link" style={{ fontSize: 15, fontWeight: 700 }} onClick={() => handleNav("faq")}>FAQ</span>
          </div>
        )}
      </header>

      {/* =========================================================================
          SECTION 1: HERO SECTION
          ========================================================================= */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 24px 80px", position: "relative" }}>
        
        {/* Soft Ambient Radial Glow */}
        <div className="lp-glow-ambient" style={{ position: "absolute", top: -80, right: "10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.1) 0%, rgba(239,246,255,0) 70%)", pointerEvents: "none", zIndex: 0 }} />

        <div className="lp-hero-grid" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 36, alignItems: "center", position: "relative", zIndex: 1 }}>
          
          {/* Left Column */}
          <div className="lp-hero-left" style={{ textAlign: "left" }}>
            
            {/* Pill Tag */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 99,
              background: "#EFF6FF", border: "1px solid #DBEAFE",
              color: "#2563EB", fontSize: 12, fontWeight: 700, marginBottom: 24, letterSpacing: ".02em"
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563EB", display: "inline-block" }} />
              <span>AI WORKFORCE INTELLIGENCE PLATFORM</span>
            </div>

            {/* Headline */}
            <h1 className="lp-hero-h1" style={{ fontSize: "clamp(36px, 4.4vw, 56px)", fontWeight: 900, letterSpacing: "-0.035em", color: "#0F172A", margin: "0 0 20px", lineHeight: 1.1 }}>
              Measure<br />
              readiness,<br />
              <span style={{ color: "#2563EB" }}>
                not completion.
              </span>
            </h1>

            {/* Subtitle */}
            <p style={{ fontSize: 16, color: "#475569", lineHeight: 1.6, margin: "0 0 28px", maxWidth: 520 }}>
              Train AI turns learning activity into decision-ready intelligence about workforce readiness, skill coverage and team capability — so you know who is ready, who is stuck, and where the gaps are.
            </p>

            {/* Dual CTAs */}
            <div className="lp-hero-ctas" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 36 }}>
              <button className="action-btn" style={styles.startOrgBtn} onClick={() => handleNav("signin")}>
                Start with your organisation <ArrowRight size={15} />
              </button>
              <button className="action-btn" style={styles.requestDemoOutlineBtn} onClick={() => handleNav("demo")}>
                Request a demo
              </button>
            </div>

            {/* 3 Metric Pills in a Row */}
            <div className="lp-hero-pills" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div className="lp-pill-hover" style={styles.heroPill} onClick={() => scrollToId("intelligence")}>
                <Layers size={16} color="#2563EB" />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0F172A" }}>Skill Graph</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>Held • developing • missing</div>
                </div>
              </div>

              <div className="lp-pill-hover" style={styles.heroPill} onClick={() => scrollToId("intelligence")}>
                <Gauge size={16} color="#2563EB" />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0F172A" }}>Readiness Score</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>Team • function • org</div>
                </div>
              </div>

              <div className="lp-pill-hover" style={styles.heroPill} onClick={() => scrollToId("learners")}>
                <Activity size={16} color="#2563EB" />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0F172A" }}>Live Signals</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>Assessments • progress</div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Real Team Image + Floating Live Telemetry Card */}
          <div className="lp-hero-right" style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
            
            {/* Professional Diverse Team Visual */}
            <div style={{ width: "100%", maxWidth: 360, marginBottom: -40, position: "relative", zIndex: 1 }}>
              <img
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop&q=80"
                alt="Train AI Professional Team"
                style={{ width: "100%", height: 320, objectFit: "cover", borderRadius: 24, boxShadow: "0 18px 40px -12px rgba(15,23,42,0.18)" }}
              />
            </div>

            {/* Floating Live Workforce Card */}
            <div className="lp-float-card" style={{
              position: "relative", zIndex: 2, width: "100%", maxWidth: 440,
              background: "#FFFFFF", borderRadius: 20, padding: "22px 24px",
              border: "1px solid #E2E8F0", boxShadow: "0 20px 45px -10px rgba(15,23,42,0.14)",
              textAlign: "left"
            }}>
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".04em" }}>WORKFORCE INTELLIGENCE</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", marginTop: 2 }}>Readiness by team</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800, color: "#2563EB" }}>
                  <span className="lp-pulse-live" style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563EB", display: "inline-block" }} />
                  <span>Live</span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.03em" }}>71</span>
                <span style={{ fontSize: 12.5, color: "#64748B", fontWeight: 600 }}>Organisation readiness</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#16A34A" }}>+4 this month</span>
              </div>

              {/* Progress Bars */}
              <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 18 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span style={{ color: "#334155" }}>Engineering</span>
                    <span style={{ color: "#2563EB", fontWeight: 800 }}>82 (+6)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: "#EFF6FF", overflow: "hidden" }}>
                    <div className="lp-bar-1" style={{ height: "100%", background: "#2563EB", borderRadius: 99 }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span style={{ color: "#334155" }}>Operations</span>
                    <span style={{ color: "#2563EB", fontWeight: 800 }}>74 (+3)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: "#EFF6FF", overflow: "hidden" }}>
                    <div className="lp-bar-2" style={{ height: "100%", background: "#2563EB", borderRadius: 99 }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span style={{ color: "#334155" }}>Compliance</span>
                    <span style={{ color: "#2563EB", fontWeight: 800 }}>61 (-2)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: "#EFF6FF", overflow: "hidden" }}>
                    <div className="lp-bar-3" style={{ height: "100%", background: "#2563EB", borderRadius: 99 }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span style={{ color: "#334155" }}>Sales</span>
                    <span style={{ color: "#2563EB", fontWeight: 800 }}>55 (+9)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: "#EFF6FF", overflow: "hidden" }}>
                    <div className="lp-bar-4" style={{ height: "100%", background: "#2563EB", borderRadius: 99 }} />
                  </div>
                </div>
              </div>

              {/* Bottom 3 Numbers */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, paddingTop: 14, borderTop: "1px solid #F1F5F9" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A" }}>12</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>Skill gaps</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A" }}>38</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>Compliance due</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A" }}>6</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>Cohorts active</div>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 2: HOW WE BUILD IT
          ========================================================================= */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "30px 24px 70px" }}>
        
        <div style={{ textAlign: "left", marginBottom: 20 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: "#2563EB", letterSpacing: ".06em" }}>HOW WE BUILD IT</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18, textAlign: "left" }}>
          {HOW_WE_BUILD_IT.map((item) => (
            <div key={item.title} className="lp-card-hover" style={{ background: "#FFFFFF", padding: "22px 24px", borderRadius: 18, border: "1px solid #E2E8F0" }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>{item.title}</h3>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
            </div>
          ))}
        </div>

      </section>

      {/* =========================================================================
          SECTION 3: THE WORKFORCE INTELLIGENCE LAYER
          ========================================================================= */}
      <section id="intelligence" style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 70px", textAlign: "left" }}>
        
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: "#2563EB", letterSpacing: ".06em" }}>THE WORKFORCE INTELLIGENCE LAYER</span>
        </div>

        <h2 className="lp-section-h2" style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 12px" }}>
          Understand what your people<br />can actually do
        </h2>

        <p style={{ fontSize: 15, color: "#64748B", maxWidth: 640, margin: "0 0 32px", lineHeight: 1.55 }}>
          Available to admins and managers as an overview, the intelligence layer combines every available signal into outputs you can act on — never completion alone.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          
          <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "28px 24px", borderRadius: 20, border: "1px solid #E2E8F0" }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Brain size={22} color="#2563EB" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 8px" }}>AI Skill Graph</h3>
            <p style={{ fontSize: 13.5, color: "#64748B", margin: 0, lineHeight: 1.55 }}>
              A live view of capability across a learner, team or organisation — what skills exist, what is developing, where the gaps are, and how capability grows over time.
            </p>
          </div>

          <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "28px 24px", borderRadius: 20, border: "1px solid #E2E8F0" }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Gauge size={22} color="#2563EB" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 8px" }}>Workforce Readiness Score</h3>
            <p style={{ fontSize: 13.5, color: "#64748B", margin: 0, lineHeight: 1.55 }}>
              One readiness indicator per team, function and organisation, so leadership can answer: are we ready, which team is strongest, which team needs support now?
            </p>
          </div>

          <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "28px 24px", borderRadius: 20, border: "1px solid #E2E8F0" }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <BarChart3 size={22} color="#2563EB" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 8px" }}>Intelligence Dashboard</h3>
            <p style={{ fontSize: 13.5, color: "#64748B", margin: 0, lineHeight: 1.55 }}>
              A summary view built for decisions: skill gaps by department, readiness by team, progress and activity trends, plus high-level organisational insights.
            </p>
          </div>

        </div>

      </section>

      {/* =========================================================================
          SECTION 4: SIGNALS FEEDING THE MODEL & THE LEARNER APP
          ========================================================================= */}
      <section id="learners" style={{ maxWidth: 1180, margin: "0 auto", padding: "30px 24px 70px" }}>
        
        {/* Signals Pill Bar */}
        <div style={{ background: "#FFFFFF", padding: "20px 24px", borderRadius: 20, border: "1px solid #E2E8F0", marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12, textAlign: "left" }}>
            SIGNALS FEEDING THE MODEL
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {SIGNALS.map((sig) => (
              <span key={sig} className="lp-pill-hover" style={{ background: "#EFF6FF", color: "#2563EB", fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 99, border: "1px solid #DBEAFE" }}>
                {sig}
              </span>
            ))}
          </div>
        </div>

        {/* The Learner App Grid */}
        <div style={{ textAlign: "left", marginBottom: 12 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: "#2563EB", letterSpacing: ".06em" }}>THE LEARNER APP</span>
        </div>

        <h2 className="lp-section-h2" style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 12px", textAlign: "left" }}>
          Four places. Zero<br />confusion.
        </h2>

        <p style={{ fontSize: 15, color: "#64748B", maxWidth: 640, margin: "0 0 36px", lineHeight: 1.55, textAlign: "left" }}>
          Learners get a focused workspace with primary navigation at the bottom of the screen: Home, AI, Courses and Community.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 32, alignItems: "center" }}>
          
          {/* 2x2 Feature Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18, textAlign: "left" }}>
            
            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: 22, borderRadius: 18, border: "1px solid #E2E8F0" }}>
              <Home size={20} color="#2563EB" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>Home</h3>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                Current course progress, active cohorts and an AI insight summary — the learner always knows the next action.
              </p>
            </div>

            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: 22, borderRadius: 18, border: "1px solid #E2E8F0" }}>
              <Bot size={20} color="#2563EB" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>AI</h3>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                Three tools: AI Coach for questions, AI Insights for strengths and gaps, and a Quiz Generator for practice.
              </p>
            </div>

            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: 22, borderRadius: 18, border: "1px solid #E2E8F0" }}>
              <BookOpen size={20} color="#2563EB" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>Courses</h3>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                Assigned paths, organisation courses and partner content, with structured modules and progress tracking.
              </p>
            </div>

            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: 22, borderRadius: 18, border: "1px solid #E2E8F0" }}>
              <Users size={20} color="#2563EB" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>Community</h3>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                Cohort feed, announcements and study groups — peer learning built into the daily experience.
              </p>
            </div>

          </div>

          {/* Right Side: Interactive Learner App Mockup */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{
              width: "100%", maxWidth: 360, background: "#FFFFFF", borderRadius: 28,
              border: "1.5px solid #E2E8F0", padding: "24px 20px", boxShadow: "0 22px 50px -12px rgba(15,23,42,0.12)",
              textAlign: "left"
            }}>
              
              <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700, marginBottom: 2 }}>Welcome back, Amara</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", marginBottom: 18 }}>Continue learning</div>

              {/* Course Item */}
              <div style={{ background: "#F8FAFC", padding: 14, borderRadius: 14, border: "1px solid #E2E8F0", marginBottom: 14 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A", marginBottom: 2 }}>Data Protection Essentials</div>
                <div style={{ fontSize: 11, color: "#2563EB", fontWeight: 700, marginBottom: 8 }}>Assigned • due in 5 days</div>
                <div style={{ height: 5, borderRadius: 99, background: "#E2E8F0", overflow: "hidden" }}>
                  <div style={{ width: "65%", height: "100%", background: "#2563EB", borderRadius: 99 }} />
                </div>
              </div>

              {/* AI Insight Card */}
              <div style={{ background: "#EFF6FF", padding: 14, borderRadius: 14, border: "1px solid #DBEAFE", marginBottom: 14 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: "#2563EB", letterSpacing: ".04em", marginBottom: 4 }}>AI INSIGHTS</div>
                <div style={{ fontSize: 12.5, color: "#1E293B", lineHeight: 1.45 }}>
                  Strong on process knowledge. Practice risk assessment next.
                </div>
              </div>

              {/* Cohort session */}
              <div style={{ background: "#F8FAFC", padding: 14, borderRadius: 14, border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Cohort session</div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>Thursday • 15:00</div>
              </div>

            </div>
          </div>

        </div>

      </section>

      {/* =========================================================================
          SECTION 5: THE ORGANISATION APP
          ========================================================================= */}
      <section id="organisation" style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 70px", textAlign: "left" }}>
        
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: "#2563EB", letterSpacing: ".06em" }}>THE ORGANISATION APP</span>
        </div>

        <h2 className="lp-section-h2" style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 12px" }}>
          One workspace, three views
        </h2>

        <p style={{ fontSize: 15, color: "#64748B", maxWidth: 680, margin: "0 0 36px", lineHeight: 1.55 }}>
          Instructors, managers and admins work in the same organisation app. Each person sees only the view their role allows — no separate dashboards to maintain.
        </p>

        {/* 3 Column Role Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, marginBottom: 20 }}>
          
          {/* Instructor View */}
          <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: 26, borderRadius: 20, border: "1px solid #E2E8F0", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <GraduationCap size={18} color="#2563EB" />
              <span style={{ fontSize: 11, fontWeight: 800, color: "#2563EB", letterSpacing: ".05em" }}>INSTRUCTOR VIEW</span>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 16px" }}>Run programmes, not spreadsheets</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "#475569" }}>
              <li style={{ display: "flex", gap: 8 }}>• <span>Cohort creation, control and adjustment</span></li>
              <li style={{ display: "flex", gap: 8 }}>• <span>Session scheduling and resources</span></li>
              <li style={{ display: "flex", gap: 8 }}>• <span>Assessment creation and grading</span></li>
              <li style={{ display: "flex", gap: 8 }}>• <span>Progress monitoring by course and level</span></li>
              <li style={{ display: "flex", gap: 8 }}>• <span>Direct learner messaging and feedback notes</span></li>
            </ul>
          </div>

          {/* Manager View */}
          <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: 26, borderRadius: 20, border: "1px solid #E2E8F0", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <TrendingUp size={18} color="#2563EB" />
              <span style={{ fontSize: 11, fontWeight: 800, color: "#2563EB", letterSpacing: ".05em" }}>MANAGER VIEW</span>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 16px" }}>See who is ready and who needs support</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "#475569" }}>
              <li style={{ display: "flex", gap: 8 }}>• <span>Direct report progress</span></li>
              <li style={{ display: "flex", gap: 8 }}>• <span>Team summary</span></li>
              <li style={{ display: "flex", gap: 8 }}>• <span>Team readiness score</span></li>
              <li style={{ display: "flex", gap: 8 }}>• <span>Team skill snapshot</span></li>
              <li style={{ display: "flex", gap: 8 }}>• <span>Department feedback notes</span></li>
            </ul>
          </div>

          {/* Admin View */}
          <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: 26, borderRadius: 20, border: "1px solid #E2E8F0", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <ShieldCheck size={18} color="#2563EB" />
              <span style={{ fontSize: 11, fontWeight: 800, color: "#2563EB", letterSpacing: ".05em" }}>ADMIN VIEW</span>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 16px" }}>Manage learning at scale</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "#475569" }}>
              <li style={{ display: "flex", gap: 8 }}>• <span>Bulk onboarding and offboarding</span></li>
              <li style={{ display: "flex", gap: 8 }}>• <span>Learning track and course assignment</span></li>
              <li style={{ display: "flex", gap: 8 }}>• <span>Compliance tracking and organisation dashboard</span></li>
              <li style={{ display: "flex", gap: 8 }}>• <span>Certificate settings and AI moderation controls</span></li>
              <li style={{ display: "flex", gap: 8 }}>• <span>Role management, SSO, API, audit and export controls</span></li>
            </ul>
          </div>

        </div>

        {/* Bottom 2 Connected Architecture Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
          
          <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "20px 24px", borderRadius: 16, border: "1px solid #E2E8F0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Users size={18} color="#2563EB" />
              <h4 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", margin: 0 }}>Learner side, connected</h4>
            </div>
            <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
              Assigned courses, cohort sessions and instructor messages appear straight in the learner app, with notifications and reminders attached.
            </p>
          </div>

          <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "20px 24px", borderRadius: 16, border: "1px solid #E2E8F0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Database size={18} color="#2563EB" />
              <h4 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", margin: 0 }}>Multi-tenant by design</h4>
            </div>
            <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
              Every organisation's data is separated and permission-enforced, with audit logging and export controls built in.
            </p>
          </div>

        </div>

      </section>

      {/* =========================================================================
          SECTION 6: HOW IT WORKS (Connected 3-Step Journey from Screenshot 1)
          ========================================================================= */}
      <section id="how-it-works" style={{ maxWidth: 1180, margin: "0 auto", padding: "50px 24px 70px", textAlign: "center" }}>
        
        <h2 className="lp-section-h2" style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 10px" }}>
          How It Works
        </h2>
        <p style={{ fontSize: 15.5, color: "#64748B", maxWidth: 540, margin: "0 auto 40px" }}>
          Move from onboarding to measurable workforce readiness
        </p>

        {/* 3 Step Connected Grid */}
        <div style={{ position: "relative" }}>
          
          {/* Background Connecting Line (Desktop) */}
          <div className="lp-steps-connector" style={{
            position: "absolute", top: 38, left: "15%", right: "15%", height: 2,
            background: "linear-gradient(90deg, #3B82F6 0%, #A855F7 50%, #F97316 100%)",
            zIndex: 0
          }} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, textAlign: "left", position: "relative", zIndex: 1 }}>
            
            {/* Step 1 */}
            <div className="lp-step-card" style={{ background: "#FFFFFF", borderRadius: 22, padding: "32px 26px", border: "1px solid #E2E8F0", position: "relative" }}>
              <div style={{ position: "absolute", top: -14, left: 24, width: 28, height: 28, borderRadius: "50%", background: "#2563EB", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, boxShadow: "0 4px 10px rgba(37,99,235,0.4)" }}>
                1
              </div>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", marginBottom: 20, boxShadow: "0 8px 18px rgba(37,99,235,0.3)" }}>
                <UserPlus size={22} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 10px" }}>Onboard Your People</h3>
              <p style={{ fontSize: 13.5, color: "#64748B", margin: 0, lineHeight: 1.55 }}>
                Invite learners, instructors and managers, then organise them by team, cohort and learning need.
              </p>
            </div>

            {/* Step 2 */}
            <div className="lp-step-card" style={{ background: "#FFFFFF", borderRadius: 22, padding: "32px 26px", border: "1px solid #E2E8F0", position: "relative" }}>
              <div style={{ position: "absolute", top: -14, left: 24, width: 28, height: 28, borderRadius: "50%", background: "#A855F7", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, boxShadow: "0 4px 10px rgba(168,85,247,0.4)" }}>
                2
              </div>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#A855F7", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", marginBottom: 20, boxShadow: "0 8px 18px rgba(168,85,247,0.3)" }}>
                <BookOpen size={22} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 10px" }}>Assign &amp; Develop</h3>
              <p style={{ fontSize: 13.5, color: "#64748B", margin: 0, lineHeight: 1.55 }}>
                Build or curate courses, assign required learning and support progress through instructors and AI tools.
              </p>
            </div>

            {/* Step 3 */}
            <div className="lp-step-card" style={{ background: "#FFFFFF", borderRadius: 22, padding: "32px 26px", border: "1px solid #E2E8F0", position: "relative" }}>
              <div style={{ position: "absolute", top: -14, left: 24, width: 28, height: 28, borderRadius: "50%", background: "#F97316", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, boxShadow: "0 4px 10px rgba(249,115,22,0.4)" }}>
                3
              </div>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#F97316", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", marginBottom: 20, boxShadow: "0 8px 18px rgba(249,115,22,0.3)" }}>
                <TrendingUp size={22} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 10px" }}>Measure Readiness</h3>
              <p style={{ fontSize: 13.5, color: "#64748B", margin: 0, lineHeight: 1.55 }}>
                Track skills, assessments, compliance, certificates and workforce readiness from live business dashboards.
              </p>
            </div>

          </div>

        </div>

      </section>

      {/* =========================================================================
          SECTION 7: ENTERPRISE TRUST & DATA SECURITY (From Screenshot 2)
          ========================================================================= */}
      <section id="trust" style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 70px", textAlign: "left" }}>
        
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: "#2563EB", letterSpacing: ".06em" }}>ENTERPRISE TRUST</span>
        </div>

        <h2 className="lp-section-h2" style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 12px" }}>
          Trust is part of the product
        </h2>

        <p style={{ fontSize: 15, color: "#64748B", maxWidth: 640, margin: "0 0 36px", lineHeight: 1.55 }}>
          Permissions, privacy, auditability and data ownership are built in — not added later.
        </p>

        {/* 6 Grid Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {TRUST_FEATURES.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="lp-card-hover" style={{ background: "#FFFFFF", padding: "24px 22px", borderRadius: 18, border: "1px solid #E2E8F0" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  <Icon size={18} color="#2563EB" />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>{item.title}</h3>
                <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
              </div>
            );
          })}
        </div>

      </section>

      {/* =========================================================================
          SECTION 8: FAQ ACCORDION (From Screenshot 2)
          ========================================================================= */}
      <section id="faq" style={{ maxWidth: 840, margin: "0 auto", padding: "40px 24px 80px", textAlign: "left" }}>
        
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h2 className="lp-section-h2" style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 8px" }}>
            Frequently Asked Questions
          </h2>
          <p style={{ fontSize: 15, color: "#64748B", margin: 0 }}>
            Got questions? We've got answers. Find everything you need to know about Train AI.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openFaq === i;
            return (
              <div key={item.q} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16, padding: "4px 20px" }}>
                <button
                  type="button"
                  style={{
                    width: "100%", border: "none", background: "transparent", cursor: "pointer",
                    padding: "16px 0", display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: 12, fontSize: 15, fontWeight: 800, color: "#0F172A", textAlign: "left"
                  }}
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    size={18}
                    color="#64748B"
                    style={{ flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s ease" }}
                  />
                </button>
                {isOpen && <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "#64748B", lineHeight: 1.6 }}>{item.a}</p>}
              </div>
            );
          })}
        </div>

      </section>

      {/* =========================================================================
          SECTION 9: PRE-FOOTER CTA CARD (Exact match from Screenshot 3)
          ========================================================================= */}
      <section style={{ maxWidth: 1180, margin: "0 auto 60px", padding: "0 24px" }}>
        <div style={{
          background: "linear-gradient(135deg, #DBEAFE 0%, #EFF6FF 50%, #E0E7FF 100%)",
          borderRadius: 28, padding: "54px 32px", textAlign: "center",
          border: "1px solid #BFDBFE", boxShadow: "0 20px 45px -12px rgba(37,99,235,0.12)"
        }}>
          <h2 style={{ fontSize: "clamp(26px, 3.8vw, 42px)", fontWeight: 900, letterSpacing: "-0.035em", margin: "0 0 14px", color: "#0F172A", lineHeight: 1.15 }}>
            Ready to Build a Workforce That Is Ready for<br />What's Next?
          </h2>
          
          <p style={{ fontSize: 16, color: "#475569", maxWidth: 620, margin: "0 auto 30px", lineHeight: 1.55 }}>
            Bring courses, cohorts, compliance and workforce intelligence together in one business LMS.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 28 }}>
            <button
              className="action-btn"
              style={{ background: "#2563EB", color: "#FFFFFF", fontWeight: 800, padding: "12px 26px", borderRadius: 99, border: "none", cursor: "pointer", fontSize: 14, boxShadow: "0 6px 18px rgba(37,99,235,0.35)", display: "inline-flex", alignItems: "center", gap: 6 }}
              onClick={() => handleNav("signin")}
            >
              Get Started <ArrowRight size={15} />
            </button>
            <button
              className="action-btn"
              style={{ background: "#FFFFFF", color: "#0F172A", fontWeight: 700, padding: "12px 24px", borderRadius: 99, border: "1.5px solid #CBD5E1", cursor: "pointer", fontSize: 14 }}
              onClick={() => handleNav("signin")}
            >
              Sign In to Train AI
            </button>
            <button
              className="action-btn"
              style={{ background: "transparent", color: "#2563EB", fontWeight: 700, padding: "12px 24px", borderRadius: 99, border: "1.5px solid #93C5FD", cursor: "pointer", fontSize: 14 }}
              onClick={() => handleNav("demo")}
            >
              Request a demo
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap", fontSize: 12.5, color: "#475569", fontWeight: 700 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
              Role-based access
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
              Organisation-ready
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
              Secure learner data
            </span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 10: DARK ENTERPRISE FOOTER (Exact match from Screenshot 4)
          ========================================================================= */}
      <footer style={{ background: "#0B1120", color: "#FFFFFF", paddingTop: 50, paddingBottom: 40, borderTop: "1px solid #1E293B" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px" }}>
          
          {/* Newsletter Box */}
          <div style={{
            background: "#131C31", borderRadius: 20, padding: "36px 32px",
            border: "1px solid #1E293B", textAlign: "center", marginBottom: 56,
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
          }}>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: "#FFFFFF", margin: "0 0 8px" }}>
              Stay Updated
            </h3>
            <p style={{ fontSize: 14, color: "#94A3B8", margin: "0 0 22px" }}>
              Get the latest courses, features, and learning tips delivered to your inbox.
            </p>

            {newsletterSubscribed ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "rgba(16,185,129,0.15)", color: "#34D399", borderRadius: 99, fontWeight: 700, fontSize: 13.5 }}>
                <CheckCircle2 size={16} />
                <span>Thank you for subscribing! We will keep you updated.</span>
              </div>
            ) : (
              <form onSubmit={handleNewsletterSubmit} style={{ display: "flex", maxWidth: 460, margin: "0 auto", gap: 8, flexWrap: "wrap" }}>
                <input
                  type="email"
                  required
                  placeholder="Enter your email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  style={{
                    flex: 1, minWidth: 220, padding: "11px 16px", borderRadius: 99,
                    border: "1px solid #334155", background: "#0B1120", color: "#FFFFFF",
                    fontSize: 13.5, outline: "none"
                  }}
                />
                <button
                  type="submit"
                  className="action-btn"
                  style={{
                    background: "#2563EB", color: "#FFFFFF", border: "none",
                    padding: "11px 22px", borderRadius: 99, fontWeight: 800, fontSize: 13.5,
                    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6
                  }}
                >
                  <Mail size={15} /> Subscribe
                </button>
              </form>
            )}
          </div>

          {/* Footer Navigation Columns */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 40, marginBottom: 48, textAlign: "left" }}>
            
            {/* Brand column */}
            <div>
              <img src="/train-ai-logo.png" alt="Train AI" style={{ height: 38, width: "auto", objectFit: "contain", display: "block", marginBottom: 14 }} />
              <p style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.6, margin: "0 0 20px", maxWidth: 280 }}>
                AI-powered workforce learning and intelligence for modern businesses.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <div className="lp-social-btn" aria-label="Facebook"><Facebook size={16} /></div>
                <div className="lp-social-btn" aria-label="Twitter"><Twitter size={16} /></div>
                <div className="lp-social-btn" aria-label="Instagram"><Instagram size={16} /></div>
                <div className="lp-social-btn" aria-label="LinkedIn"><Linkedin size={16} /></div>
              </div>
            </div>

            {/* Product column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#FFFFFF", marginBottom: 4 }}>Product</div>
              <span className="lp-footer-link" onClick={() => scrollToId("intelligence")}>Features</span>
              <span className="lp-footer-link" onClick={() => scrollToId("how-it-works")}>How It Works</span>
              <span className="lp-footer-link" onClick={() => handleNav("signup")}>Sign Up</span>
              <span className="lp-footer-link" onClick={() => scrollToId("learners")}>Courses</span>
            </div>

            {/* For Users column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#FFFFFF", marginBottom: 4 }}>For Users</div>
              <span className="lp-footer-link" onClick={() => scrollToId("learners")}>Learner Dashboard</span>
              <span className="lp-footer-link" onClick={() => scrollToId("organisation")}>Instructor Workspace</span>
              <span className="lp-footer-link" onClick={() => scrollToId("learners")}>Community</span>
              <span className="lp-footer-link" onClick={() => scrollToId("how-it-works")}>Certificates</span>
            </div>

          </div>

          {/* Bottom Copyright & Legal Links */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, paddingTop: 24, borderTop: "1px solid #1E293B", fontSize: 12.5, color: "#64748B" }}>
            <div>
              © 2025 Train AI Ltd. All rights reserved. Headquartered in London, United Kingdom
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              <span className="lp-footer-link" onClick={() => handleNav("about")}>About Us</span>
              <span className="lp-footer-link" onClick={() => handleNav("privacy")}>Privacy Policy</span>
              <span className="lp-footer-link" onClick={() => handleNav("terms")}>Terms of Service</span>
              <span className="lp-footer-link" onClick={() => handleNav("cookie")}>Cookie Policy</span>
            </div>
          </div>

        </div>
      </footer>

      {/* Demo Modal */}
      {demoModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setDemoModalOpen(false)} role="presentation">
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 19, fontWeight: 900, color: "#0F172A", margin: 0 }}>Request a Live Demo</h3>
                <p style={{ fontSize: 12.5, color: "#64748B", margin: "2px 0 0" }}>Experience the workforce intelligence layer tailored to your team.</p>
              </div>
              <button style={styles.modalClose} onClick={() => setDemoModalOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            {demoSubmitted ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, background: "#ECFDF5", color: "#059669", borderRadius: 12, fontWeight: 700, fontSize: 14 }}>
                <CheckCircle2 size={20} />
                <span>Thank you! We will reach out to schedule your demo shortly.</span>
              </div>
            ) : (
              <form onSubmit={handleDemoSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <input
                    required placeholder="Full name" value={demoName} onChange={(e) => setDemoName(e.target.value)}
                    style={styles.formInput}
                  />
                  <input
                    required placeholder="Company name" value={demoCompany} onChange={(e) => setDemoCompany(e.target.value)}
                    style={styles.formInput}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <input
                    type="email" required placeholder="Work email" value={demoEmail} onChange={(e) => setDemoEmail(e.target.value)}
                    style={styles.formInput}
                  />
                  <select
                    value={demoTeamSize} onChange={(e) => setDemoTeamSize(e.target.value)}
                    style={styles.formInput}
                  >
                    {TEAM_SIZE_OPTIONS.map((t) => <option key={t} value={t}>{t} employees</option>)}
                  </select>
                </div>
                <textarea
                  placeholder="Tell us about your team's goals or current training challenges (optional)"
                  value={demoMessage} onChange={(e) => setDemoMessage(e.target.value)}
                  rows={2} style={styles.formTextarea}
                />
                <button type="submit" disabled={submitting} className="action-btn" style={styles.modalSubmitBtn}>
                  {submitting ? "Submitting..." : "Schedule Live Demo"} <ArrowRight size={15} />
                </button>
                {demoError && <div style={{ fontSize: 12, color: "#EF4444", fontWeight: 700 }}>{demoError}</div>}
              </form>
            )}
          </div>
        </div>
      )}

      {/* Legal Content Modal */}
      {activeModal && (
        <div style={styles.modalOverlay} onClick={() => setActiveModal(null)} role="presentation">
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: 0 }}>{LEGAL_CONTENT[activeModal].title}</h3>
              <button style={styles.modalClose} onClick={() => setActiveModal(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.6, margin: 0 }}>{LEGAL_CONTENT[activeModal].body}</p>
          </div>
        </div>
      )}

    </div>
  );
}

const styles = {
  outer: { minHeight: "100vh", background: "#F8FAFC", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  header: { background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid #E2E8F0", position: "sticky", top: 0, zIndex: 60 },
  headerInner: { maxWidth: 1180, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  signInBtn: { border: "none", background: "transparent", padding: "8px 12px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", color: "#334155" },
  requestDemoBtn: { border: "1.5px solid #CBD5E1", background: "#FFFFFF", padding: "8px 18px", borderRadius: 99, fontWeight: 700, fontSize: 13, cursor: "pointer", color: "#0F172A" },
  getStartedBtn: { border: "none", background: "#2563EB", color: "#FFFFFF", padding: "8px 20px", borderRadius: 99, fontWeight: 800, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 14px rgba(37,99,235,0.3)" },
  startOrgBtn: { border: "none", background: "#2563EB", color: "#FFFFFF", padding: "12px 24px", borderRadius: 99, fontWeight: 800, fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 6px 18px rgba(37,99,235,0.35)" },
  requestDemoOutlineBtn: { border: "1.5px solid #CBD5E1", background: "#FFFFFF", color: "#0F172A", padding: "12px 24px", borderRadius: 99, fontWeight: 700, fontSize: 14, cursor: "pointer" },
  heroPill: { background: "#FFFFFF", border: "1px solid #E2E8F0", padding: "8px 16px", borderRadius: 14, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 2px 8px rgba(15,23,42,0.03)" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 100 },
  modalCard: { background: "#FFFFFF", borderRadius: 20, padding: 26, maxWidth: 500, width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 30px 60px -24px rgba(15,23,42,.35)" },
  modalClose: { border: "none", background: "#F1F5F9", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex", color: "#64748B" },
  formInput: { width: "100%", border: "1.5px solid #E2E8F0", padding: "10px 14px", fontSize: 13, borderRadius: 10, outline: "none", boxSizing: "border-box", color: "#0F172A", background: "#F8FAFC" },
  formTextarea: { width: "100%", border: "1.5px solid #E2E8F0", padding: "10px 14px", fontSize: 13, borderRadius: 10, outline: "none", boxSizing: "border-box", color: "#0F172A", resize: "vertical", fontFamily: "inherit", background: "#F8FAFC" },
  modalSubmitBtn: { border: "none", background: "#2563EB", color: "#FFFFFF", padding: "12px 20px", borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 4px 14px rgba(37,99,235,0.3)" }
};
