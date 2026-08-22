import React, { useState, useEffect } from "react";
import {
  ArrowRight, BookOpen, GraduationCap, Cpu, ShieldCheck, CheckCircle2, Globe, X,
  Brain, Layers, ChevronDown, HelpCircle, ClipboardList, UserPlus, Rocket,
  Building2, Users, Target, TrendingUp, AlertTriangle, Eye, Lock, Compass, BarChart3,
  GitCompare, Table, School, Handshake, Briefcase, Zap, Flame, Menu, Check,
  Play, MessageSquare, Laptop, Award, Star, Activity, ArrowUpRight, Gauge, Database,
  Home, Bot, MessageCircle, Mail, Download, Wifi, Accessibility, Bell, Send,
  Facebook, Twitter, Instagram, Linkedin, Search, RefreshCw, ChevronRight, ChevronLeft,
  PlayCircle, Pin, Sparkles, Megaphone, Palette, ThumbsUp, BarChart2, CheckCheck
} from "lucide-react";
import { submitDemoRequest, captureAttributionFromURL } from "../../lib/api/waitlist.js";
import { trackReferralClickIfPresent } from "../../lib/api/organizations.js";

const TEAM_SIZE_OPTIONS = ["1–50", "51–200", "201–1,000", "1,000+"];

const LEGAL_CONTENT = {
  about: {
    title: "About Us",
    body: "Train AI is an enterprise AI-powered workforce learning and intelligence platform. We bridge the gap between static training and measurable business capability by uniting adaptive AI tutoring, live cohort mentorship, and real-time skill telemetry in one unified system."
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
    icon: Target,
    title: "Readiness over completion",
    desc: "A finished course is not the same as capability. We measure real comprehension, assessment scores, and practical execution."
  },
  {
    icon: Gauge,
    title: "Intelligence over reporting",
    desc: "Dashboards should power proactive talent decisions, forecasting team capability gaps before they impact delivery."
  },
  {
    icon: Building2,
    title: "Organisation-first",
    desc: "Engineered specifically for multi-tenant organizations, with seamless individual learner access."
  },
  {
    icon: Activity,
    title: "Every signal matters",
    desc: "Live assessments, instructor feedback, AI queries, and milestone completions all enrich your live skill graph."
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
    icon: ClipboardList,
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

const FAQ_ITEMS = [
  {
    q: "What is Train AI?",
    a: "Train AI is an enterprise AI-powered workforce learning and intelligence platform. We combine adaptive AI tutoring, structured learning pathways, live cohort mentorship, and real-time skill telemetry so organizations can track measurable capability."
  },
  {
    q: "How is this different from a normal LMS?",
    a: "Traditional LMS tools only measure passive video clicks and completion percentages. Train AI is an active Workforce Intelligence Operating System that maps dynamic team capability in real time, provides 24/7 AI tutoring, automated practice quizzes, and live cohort mentorship."
  },
  {
    q: "What is the Workforce Readiness Score?",
    a: "The Workforce Readiness Score is a composite, real-time capability metric calculated per employee, team, and department based on verified assessment scores, practical task performance, and learning velocity."
  },
  {
    q: "What does the AI Skill Graph show?",
    a: "The AI Skill Graph is a dynamic topological map of your organization's talent, visualizing verified skills, skills currently in development, and critical capability gaps across teams."
  },
  {
    q: "What AI tools do learners get?",
    a: "Learners have access to a 24/7 AI Neural Tutor for conversational Q&A and code debugging, an Adaptive Quiz Generator that builds personalized practice assessments, and AI Progress Summaries."
  },
  {
    q: "Which roles does the platform support?",
    a: "Train AI supports 4 dedicated roles: Learners (personal courses, AI tutor, cohort chat), Instructors (cohort management, grading, scheduling), Managers (team analytics, readiness scores), and Admins (multi-tenant governance, SSO, billing, audit logs)."
  },
  {
    q: "Are certificates branded for our organisation?",
    a: "Yes. Administrators can customize certificates with their organization's official logo, signature, verification hashes, and custom accreditation details."
  },
  {
    q: "Is our data separated and auditable?",
    a: "Yes. Every organization operates within an isolated tenant protected by PostgreSQL Row-Level Security (RLS). All administrative actions and compliance completions are logged to an append-only audit trail."
  }
];

export default function LandingPage({ onNavigate }) {
  useEffect(() => { captureAttributionFromURL(); }, []);
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) trackReferralClickIfPresent(ref);
  }, []);

  const [mobileLearnerTab, setMobileLearnerTab] = useState("home"); // "home" | "courses" | "ai" | "community"
  const [pollVoted, setPollVoted] = useState(false);
  const [selectedPollOption, setSelectedPollOption] = useState(0);
  const [demoName, setDemoName] = useState("");
  const [demoEmail, setDemoEmail] = useState("");
  const [demoCompany, setDemoCompany] = useState("");
  const [demoTeamSize, setDemoTeamSize] = useState(TEAM_SIZE_OPTIONS[0]);
  const [demoMessage, setDemoMessage] = useState("");
  const [demoSubmitted, setDemoSubmitted] = useState(false);
  const [demoError, setDemoError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);

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
        @keyframes floatSlow { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-5px); } }
        @keyframes pulseDot { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.35); opacity: 0.6; } }
        @keyframes fillBar1 { from { width: 0%; } to { width: 82%; } }
        @keyframes fillBar2 { from { width: 0%; } to { width: 74%; } }
        @keyframes fillBar3 { from { width: 0%; } to { width: 61%; } }
        @keyframes fillBar4 { from { width: 0%; } to { width: 55%; } }

        .lp-card-hover {
          transition: transform .22s cubic-bezier(0.16, 1, 0.3, 1), box-shadow .22s ease, border-color .22s ease;
        }
        .lp-card-hover:hover {
          transform: translateY(-3px);
          box-shadow: 0 14px 28px -6px rgba(15, 23, 42, 0.08);
          border-color: #CBD5E1 !important;
        }

        .lp-step-card {
          transition: all .22s ease;
        }
        .lp-step-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 16px 32px -8px rgba(79, 70, 229, 0.12);
          border-color: #C7D2FE !important;
        }

        .lp-nav-link {
          transition: color .15s ease;
          cursor: pointer;
          color: #475569;
          font-weight: 600;
          font-size: 14px;
        }
        .lp-nav-link:hover {
          color: #4F46E5 !important;
        }

        .lp-pill-hover {
          transition: all .18s ease;
          cursor: pointer;
        }
        .lp-pill-hover:hover {
          transform: translateY(-1px);
          border-color: #C7D2FE !important;
          background: #EEF2FF !important;
          color: #4F46E5 !important;
        }

        .action-btn-primary {
          background: #4F46E5;
          color: #FFFFFF;
          transition: all .16s ease;
        }
        .action-btn-primary:hover {
          background: #4338CA;
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(79, 70, 229, 0.3);
        }
        .action-btn-primary:active {
          transform: scale(.98);
        }

        .action-btn-outline {
          background: #FFFFFF;
          color: #1E293B;
          border: 1.5px solid #CBD5E1;
          transition: all .16s ease;
        }
        .action-btn-outline:hover {
          background: #F8FAFC;
          border-color: #94A3B8;
          color: #0F172A;
          transform: translateY(-1px);
        }

        .lp-float-card { animation: floatSlow 5s ease-in-out infinite; }
        .lp-pulse-live { animation: pulseDot 2s ease-in-out infinite; }
        .lp-bar-1 { animation: fillBar1 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .lp-bar-2 { animation: fillBar2 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .lp-bar-3 { animation: fillBar3 1.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .lp-bar-4 { animation: fillBar4 1.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        .lp-footer-link {
          color: #94A3B8;
          text-decoration: none;
          font-size: 13px;
          transition: color .15s ease;
          cursor: pointer;
        }
        .lp-footer-link:hover {
          color: #FFFFFF !important;
        }

        .lp-social-btn {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: #1E293B;
          border: 1px solid #334155;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94A3B8;
          transition: all .16s ease;
          cursor: pointer;
        }
        .lp-social-btn:hover {
          background: #4F46E5;
          color: #FFFFFF;
          border-color: #4F46E5;
        }

        /* Interactive Phone Nav Pill Tabs */
        .phone-nav-item {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 5px 8px;
          border-radius: 99px;
          font-size: 10px;
          font-weight: 700;
          color: #64748B;
          cursor: pointer;
          transition: all .16s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .phone-nav-item.active {
          background: #4F46E5;
          color: #FFFFFF !important;
          box-shadow: 0 3px 10px rgba(79, 70, 229, 0.35);
        }

        /* Section Background Texture Utilities */
        .lp-bg-hero {
          background-color: #FFFFFF;
          background-image: radial-gradient(rgba(79, 70, 229, 0.07) 1px, transparent 1px);
          background-size: 28px 28px;
        }
        .lp-bg-surface-1 {
          background-color: #F8FAFC;
          border-top: 1px solid #E2E8F0;
          border-bottom: 1px solid #E2E8F0;
        }
        .lp-bg-surface-2 {
          background-color: #FFFFFF;
        }
        .lp-bg-surface-tint {
          background-color: #F1F5F9;
          border-top: 1px solid #E2E8F0;
          border-bottom: 1px solid #E2E8F0;
        }

        /* Mobile specific layout enhancements */
        @media (max-width: 960px) {
          .lp-desktop-nav { display: none !important; }
          .lp-mobile-menu-btn { display: flex !important; }
          .lp-hero-grid { grid-template-columns: 1fr !important; gap: 32px !important; text-align: center !important; }
          .lp-hero-left { margin: 0 auto !important; max-width: 600px !important; }
          .lp-hero-ctas { justify-content: center !important; }
          .lp-hero-pills { justify-content: center !important; }
          .lp-hero-right { justify-content: center !important; margin-top: 10px !important; }
          .lp-learner-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
        }
        @media (min-width: 961px) {
          .lp-mobile-drawer { display: none !important; }
          .lp-mobile-menu-btn { display: none !important; }
        }
        @media (max-width: 640px) {
          .lp-hero-h1 { font-size: 32px !important; line-height: 1.15 !important; }
          .lp-section-h2 { font-size: 24px !important; line-height: 1.2 !important; }
          .lp-section-inner { padding: 36px 16px !important; }
          .lp-hero-pill-wrap { flex-direction: column !important; width: 100% !important; }
          .lp-hero-pill-wrap > div { width: 100% !important; justify-content: flex-start !important; }
          .lp-header-actions { gap: 6px !important; }
          .lp-hero-ctas { flex-direction: column !important; width: 100% !important; }
          .lp-hero-ctas > button { width: 100% !important; justify-content: center !important; }
        }
      `}</style>

      {/* =========================================================================
          STICKY HEADER
          ========================================================================= */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          
          {/* Logo (Identical 24px size to Learner Header) */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flexShrink: 0 }} onClick={() => handleNav("home")}>
            <img src="/train-ai-logo.png" alt="Train AI" style={{ height: 24, width: "auto", objectFit: "contain", display: "block" }} />
          </div>

          {/* Center Navigation Links */}
          <nav className="lp-desktop-nav" style={{ display: "flex", gap: 26, alignItems: "center" }}>
            <span className="lp-nav-link" onClick={() => handleNav("home")}>Home</span>
            <span className="lp-nav-link" onClick={() => handleNav("intelligence")}>Intelligence</span>
            <span className="lp-nav-link" onClick={() => handleNav("learners")}>Learners</span>
            <span className="lp-nav-link" onClick={() => handleNav("organisation")}>Organisation</span>
            <span className="lp-nav-link" onClick={() => handleNav("faq")}>FAQ</span>
          </nav>

          {/* Action CTAs */}
          <div className="lp-header-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              style={styles.signInBtn}
              onClick={() => handleNav("signin")}
            >
              Sign In
            </button>
            <button
              className="action-btn-outline lp-desktop-nav"
              style={styles.requestDemoBtn}
              onClick={() => handleNav("demo")}
            >
              Request demo
            </button>
            <button
              className="action-btn-primary"
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
                width: 36, height: 36, borderRadius: 10, border: "1px solid #E2E8F0",
                background: "#F8FAFC", display: "none", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#0F172A"
              }}
              aria-label="Toggle Mobile Navigation"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
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
            <button
              className="action-btn-outline"
              style={{ width: "100%", padding: "10px", borderRadius: 10, fontWeight: 800, marginTop: 6 }}
              onClick={() => handleNav("demo")}
            >
              Request a demo
            </button>
          </div>
        )}
      </header>

      {/* =========================================================================
          SECTION 1: HERO SECTION (Subtle Technical Grid Texture)
          ========================================================================= */}
      <section className="lp-bg-hero" style={{ width: "100%", position: "relative", borderBottom: "1px solid #E2E8F0" }}>
        <div className="lp-section-inner" style={{ maxWidth: 1180, margin: "0 auto", padding: "50px 20px 70px" }}>
          <div className="lp-hero-grid" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 36, alignItems: "center" }}>
            
            {/* Left Column */}
            <div className="lp-hero-left" style={{ textAlign: "left" }}>
              
              {/* Pill Tag */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 99,
                background: "#EEF2FF", border: "1px solid #C7D2FE",
                color: "#4F46E5", fontSize: 11.5, fontWeight: 800, marginBottom: 18, letterSpacing: ".02em"
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4F46E5", display: "inline-block" }} />
                <span>AI WORKFORCE INTELLIGENCE PLATFORM</span>
              </div>

              {/* Headline */}
              <h1 className="lp-hero-h1" style={{ fontSize: "clamp(32px, 4.2vw, 54px)", fontWeight: 900, letterSpacing: "-0.035em", color: "#0F172A", margin: "0 0 16px", lineHeight: 1.1 }}>
                Measure<br />
                readiness,<br />
                <span style={{ color: "#4F46E5" }}>
                  not completion.
                </span>
              </h1>

              {/* Subtitle */}
              <p style={{ fontSize: 15.5, color: "#475569", lineHeight: 1.6, margin: "0 0 24px", maxWidth: 520 }}>
                Train AI turns learning activity into decision-ready intelligence about workforce readiness, skill coverage and team capability — so leaders know who is ready, who is stuck, and where the gaps are.
              </p>

              {/* Dual CTAs */}
              <div className="lp-hero-ctas" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
                <button className="action-btn-primary" style={styles.startOrgBtn} onClick={() => handleNav("signin")}>
                  Start with your organisation <ArrowRight size={15} />
                </button>
                <button className="action-btn-outline" style={styles.requestDemoOutlineBtn} onClick={() => handleNav("demo")}>
                  Request a demo
                </button>
              </div>

              {/* 3 Metric Pills in a Row */}
              <div className="lp-hero-pills lp-hero-pill-wrap" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div className="lp-pill-hover" style={styles.heroPill} onClick={() => scrollToId("intelligence")}>
                  <Layers size={16} color="#4F46E5" />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>Skill Graph</div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>Held • developing • missing</div>
                  </div>
                </div>

                <div className="lp-pill-hover" style={styles.heroPill} onClick={() => scrollToId("intelligence")}>
                  <Gauge size={16} color="#4F46E5" />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>Readiness Score</div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>Team • function • org</div>
                  </div>
                </div>

                <div className="lp-pill-hover" style={styles.heroPill} onClick={() => scrollToId("learners")}>
                  <Activity size={16} color="#4F46E5" />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>Live Signals</div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>Assessments • progress</div>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: Real Professional Team Photo + Live Telemetry Card */}
            <div className="lp-hero-right" style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
              
              {/* Real Professional Team Visual */}
              <div style={{ width: "100%", maxWidth: 360, marginBottom: -36, position: "relative", zIndex: 1 }}>
                <img
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop&q=80"
                  alt="Train AI Professional Team"
                  style={{ width: "100%", height: 280, objectFit: "cover", borderRadius: 20, boxShadow: "0 16px 36px -12px rgba(15,23,42,0.15)" }}
                />
              </div>

              {/* Live Workforce Card with Moving Progress Bars */}
              <div className="lp-float-card" style={{
                position: "relative", zIndex: 2, width: "100%", maxWidth: 440,
                background: "#FFFFFF", borderRadius: 18, padding: "20px 22px",
                border: "1px solid #E2E8F0", boxShadow: "0 18px 40px -10px rgba(15,23,42,0.12)",
                textAlign: "left", boxSizing: "border-box"
              }}>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: ".04em" }}>WORKFORCE INTELLIGENCE</div>
                    <div style={{ fontSize: 15.5, fontWeight: 800, color: "#0F172A", marginTop: 2 }}>Readiness by team</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800, color: "#4F46E5", background: "#EEF2FF", padding: "2px 7px", borderRadius: 99 }}>
                    <span className="lp-pulse-live" style={{ width: 6, height: 6, borderRadius: "50%", background: "#4F46E5", display: "inline-block" }} />
                    <span>Live</span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 34, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.03em" }}>71</span>
                  <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Organisation readiness</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#16A34A" }}>+4 this month</span>
                </div>

                {/* Progress Bars */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 700, marginBottom: 3 }}>
                      <span style={{ color: "#334155" }}>Engineering</span>
                      <span style={{ color: "#4F46E5", fontWeight: 800 }}>82 (+6)</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: "#EEF2FF", overflow: "hidden" }}>
                      <div className="lp-bar-1" style={{ height: "100%", background: "#4F46E5", borderRadius: 99 }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 700, marginBottom: 3 }}>
                      <span style={{ color: "#334155" }}>Operations</span>
                      <span style={{ color: "#4F46E5", fontWeight: 800 }}>74 (+3)</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: "#EEF2FF", overflow: "hidden" }}>
                      <div className="lp-bar-2" style={{ height: "100%", background: "#4F46E5", borderRadius: 99 }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 700, marginBottom: 3 }}>
                      <span style={{ color: "#334155" }}>Compliance</span>
                      <span style={{ color: "#4F46E5", fontWeight: 800 }}>61 (-2)</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: "#EEF2FF", overflow: "hidden" }}>
                      <div className="lp-bar-3" style={{ height: "100%", background: "#4F46E5", borderRadius: 99 }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 700, marginBottom: 3 }}>
                      <span style={{ color: "#334155" }}>Sales</span>
                      <span style={{ color: "#4F46E5", fontWeight: 800 }}>55 (+9)</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: "#EEF2FF", overflow: "hidden" }}>
                      <div className="lp-bar-4" style={{ height: "100%", background: "#4F46E5", borderRadius: 99 }} />
                    </div>
                  </div>
                </div>

                {/* Bottom 3 Numbers */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, paddingTop: 12, borderTop: "1px solid #F1F5F9" }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 900, color: "#0F172A" }}>12</div>
                    <div style={{ fontSize: 10.5, color: "#64748B" }}>Skill gaps</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 900, color: "#0F172A" }}>38</div>
                    <div style={{ fontSize: 10.5, color: "#64748B" }}>Compliance due</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 900, color: "#0F172A" }}>6</div>
                    <div style={{ fontSize: 10.5, color: "#64748B" }}>Cohorts active</div>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: HOW WE BUILD IT (Slate Surface #F8FAFC with Borders)
          ========================================================================= */}
      <section className="lp-bg-surface-1" style={{ width: "100%" }}>
        <div className="lp-section-inner" style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 20px 50px" }}>
          
          <div style={{ textAlign: "left", marginBottom: 16 }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: "#4F46E5", letterSpacing: ".06em" }}>HOW WE BUILD IT</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, textAlign: "left" }}>
            {HOW_WE_BUILD_IT.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="lp-card-hover" style={{ background: "#FFFFFF", padding: "20px 20px", borderRadius: 16, border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(15,23,42,0.03)" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                    <Icon size={17} color="#4F46E5" />
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>{item.title}</h3>
                  <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 3: THE WORKFORCE INTELLIGENCE LAYER (Clean White Surface)
          ========================================================================= */}
      <section id="intelligence" className="lp-bg-surface-2" style={{ width: "100%" }}>
        <div className="lp-section-inner" style={{ maxWidth: 1180, margin: "0 auto", padding: "50px 20px 65px", textAlign: "left" }}>
          
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: "#4F46E5", letterSpacing: ".06em" }}>THE WORKFORCE INTELLIGENCE LAYER</span>
          </div>

          <h2 className="lp-section-h2" style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 10px" }}>
            Understand what your people<br />can actually do
          </h2>

          <p style={{ fontSize: 15, color: "#64748B", maxWidth: 640, margin: "0 0 32px", lineHeight: 1.55 }}>
            Available to admins and managers as an overview, the intelligence layer combines every available signal into outputs you can act on — never completion alone.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
            
            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "24px 22px", borderRadius: 18, border: "1px solid #E2E8F0", boxShadow: "0 4px 14px rgba(15,23,42,0.03)" }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <Brain size={20} color="#4F46E5" />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: "0 0 8px" }}>AI Skill Graph</h3>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.55 }}>
                A live view of capability across a learner, team or organisation — what skills exist, what is developing, where the gaps are, and how capability grows over time.
              </p>
            </div>

            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "24px 22px", borderRadius: 18, border: "1px solid #E2E8F0", boxShadow: "0 4px 14px rgba(15,23,42,0.03)" }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <Gauge size={20} color="#4F46E5" />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: "0 0 8px" }}>Workforce Readiness Score</h3>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.55 }}>
                One readiness indicator per team, function and organisation, so leadership can answer: are we ready, which team is strongest, which team needs support now?
              </p>
            </div>

            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "24px 22px", borderRadius: 18, border: "1px solid #E2E8F0", boxShadow: "0 4px 14px rgba(15,23,42,0.03)" }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <BarChart3 size={20} color="#4F46E5" />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: "0 0 8px" }}>Intelligence Dashboard</h3>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.55 }}>
                A summary view built for decisions: skill gaps by department, readiness by team, progress and activity trends, plus high-level organisational insights.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 4: THE LEARNER APP (Rich Full-Height Vertical Showcase - Zero White Space)
          ========================================================================= */}
      <section id="learners" className="lp-bg-surface-tint" style={{ width: "100%" }}>
        <div className="lp-section-inner" style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 20px 55px" }}>
          
          {/* Signals Pill Bar */}
          <div style={{ background: "#FFFFFF", padding: "14px 18px", borderRadius: 16, border: "1px solid #E2E8F0", marginBottom: 28, boxShadow: "0 2px 6px rgba(15,23,42,0.02)" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8, textAlign: "left" }}>
              SIGNALS FEEDING THE MODEL
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SIGNALS.map((sig) => (
                <span key={sig} className="lp-pill-hover" style={{ background: "#EEF2FF", color: "#4F46E5", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 99, border: "1px solid #C7D2FE" }}>
                  {sig}
                </span>
              ))}
            </div>
          </div>

          {/* The Learner App Grid */}
          <div style={{ textAlign: "left", marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: "#4F46E5", letterSpacing: ".06em" }}>THE LEARNER APP</span>
          </div>

          <h2 className="lp-section-h2" style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 8px", textAlign: "left" }}>
            Four places. Zero confusion.
          </h2>

          <p style={{ fontSize: 14.5, color: "#64748B", maxWidth: 640, margin: "0 0 24px", lineHeight: 1.5, textAlign: "left" }}>
            Learners get a focused workspace with primary navigation at the bottom of the screen: Home, Courses, AI Coach, and Community. Tap the tabs on the left or the phone buttons to preview live.
          </p>

          <div className="lp-learner-grid" style={{ display: "grid", gridTemplateColumns: "1.25fr 0.75fr", gap: 24, alignItems: "stretch" }}>
            
            {/* Left Side: Rich Vertical Interactive Tab Stack (Fills Entire Height Seamlessly) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, justifyContent: "space-between" }}>
              
              {/* Tab 1: Home */}
              <div
                className="lp-card-hover"
                onClick={() => setMobileLearnerTab("home")}
                style={{
                  background: mobileLearnerTab === "home" ? "#EEF2FF" : "#FFFFFF",
                  padding: "14px 16px", borderRadius: 14,
                  border: mobileLearnerTab === "home" ? "2px solid #4F46E5" : "1px solid #E2E8F0",
                  boxShadow: mobileLearnerTab === "home" ? "0 4px 14px rgba(79,70,229,0.12)" : "0 2px 6px rgba(15,23,42,0.02)",
                  cursor: "pointer", transition: "all .18s ease"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: mobileLearnerTab === "home" ? "#4F46E5" : "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", color: mobileLearnerTab === "home" ? "#fff" : "#4F46E5" }}>
                      <Home size={15} />
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", margin: 0 }}>Home Workspace</h3>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: mobileLearnerTab === "home" ? "#4F46E5" : "#64748B", background: mobileLearnerTab === "home" ? "rgba(79,70,229,0.15)" : "#F1F5F9", padding: "2px 8px", borderRadius: 99 }}>
                    {mobileLearnerTab === "home" ? "Active Preview" : "Personalized"}
                  </span>
                </div>
                <p style={{ fontSize: 12.5, color: "#64748B", margin: "2px 0 0", lineHeight: 1.45 }}>
                  Current sprint progress, career roadmap, active cohorts and daily streak tracker.
                </p>
              </div>

              {/* Tab 2: Courses */}
              <div
                className="lp-card-hover"
                onClick={() => setMobileLearnerTab("courses")}
                style={{
                  background: mobileLearnerTab === "courses" ? "#EEF2FF" : "#FFFFFF",
                  padding: "14px 16px", borderRadius: 14,
                  border: mobileLearnerTab === "courses" ? "2px solid #4F46E5" : "1px solid #E2E8F0",
                  boxShadow: mobileLearnerTab === "courses" ? "0 4px 14px rgba(79,70,229,0.12)" : "0 2px 6px rgba(15,23,42,0.02)",
                  cursor: "pointer", transition: "all .18s ease"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: mobileLearnerTab === "courses" ? "#4F46E5" : "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", color: mobileLearnerTab === "courses" ? "#fff" : "#4F46E5" }}>
                      <BookOpen size={15} />
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", margin: 0 }}>Courses &amp; Masterclasses</h3>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: mobileLearnerTab === "courses" ? "#4F46E5" : "#64748B", background: mobileLearnerTab === "courses" ? "rgba(79,70,229,0.15)" : "#F1F5F9", padding: "2px 8px", borderRadius: 99 }}>
                    {mobileLearnerTab === "courses" ? "Active Preview" : "49 Courses"}
                  </span>
                </div>
                <p style={{ fontSize: 12.5, color: "#64748B", margin: "2px 0 0", lineHeight: 1.45 }}>
                  Executive masterclasses, spotlight carousels, assigned tracks, and video trailers.
                </p>
              </div>

              {/* Tab 3: AI Coach */}
              <div
                className="lp-card-hover"
                onClick={() => setMobileLearnerTab("ai")}
                style={{
                  background: mobileLearnerTab === "ai" ? "#EEF2FF" : "#FFFFFF",
                  padding: "14px 16px", borderRadius: 14,
                  border: mobileLearnerTab === "ai" ? "2px solid #4F46E5" : "1px solid #E2E8F0",
                  boxShadow: mobileLearnerTab === "ai" ? "0 4px 14px rgba(79,70,229,0.12)" : "0 2px 6px rgba(15,23,42,0.02)",
                  cursor: "pointer", transition: "all .18s ease"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: mobileLearnerTab === "ai" ? "#4F46E5" : "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", color: mobileLearnerTab === "ai" ? "#fff" : "#4F46E5" }}>
                      <Zap size={15} />
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", margin: 0 }}>AI Neural Coach</h3>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: mobileLearnerTab === "ai" ? "#4F46E5" : "#64748B", background: mobileLearnerTab === "ai" ? "rgba(79,70,229,0.15)" : "#F1F5F9", padding: "2px 8px", borderRadius: 99 }}>
                    {mobileLearnerTab === "ai" ? "Active Preview" : "24/7 Neural Tutor"}
                  </span>
                </div>
                <p style={{ fontSize: 12.5, color: "#64748B", margin: "2px 0 0", lineHeight: 1.45 }}>
                  AI Learning Coach, custom adaptive assessment generator, and debugging assistant.
                </p>
              </div>

              {/* Tab 4: Community */}
              <div
                className="lp-card-hover"
                onClick={() => setMobileLearnerTab("community")}
                style={{
                  background: mobileLearnerTab === "community" ? "#EEF2FF" : "#FFFFFF",
                  padding: "14px 16px", borderRadius: 14,
                  border: mobileLearnerTab === "community" ? "2px solid #4F46E5" : "1px solid #E2E8F0",
                  boxShadow: mobileLearnerTab === "community" ? "0 4px 14px rgba(79,70,229,0.12)" : "0 2px 6px rgba(15,23,42,0.02)",
                  cursor: "pointer", transition: "all .18s ease"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: mobileLearnerTab === "community" ? "#4F46E5" : "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", color: mobileLearnerTab === "community" ? "#fff" : "#4F46E5" }}>
                      <Users size={15} />
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", margin: 0 }}>Community Hub</h3>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: mobileLearnerTab === "community" ? "#4F46E5" : "#64748B", background: mobileLearnerTab === "community" ? "rgba(79,70,229,0.15)" : "#F1F5F9", padding: "2px 8px", borderRadius: 99 }}>
                    {mobileLearnerTab === "community" ? "Active Preview" : "Peer Network"}
                  </span>
                </div>
                <p style={{ fontSize: 12.5, color: "#64748B", margin: "2px 0 0", lineHeight: 1.45 }}>
                  Community hub, pinned faculty announcements, live polls, and student discussions.
                </p>
              </div>

              {/* Bottom Feature Badges Bar */}
              <div style={{ background: "#FFFFFF", borderRadius: 12, padding: "10px 14px", border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#334155" }}>
                  <Flame size={12} color="#EA580C" /> Daily Streaks
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#334155" }}>
                  <Target size={12} color="#4F46E5" /> Adaptive Quizzes
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#334155" }}>
                  <Award size={12} color="#16A34A" /> Micro-Certs
                </span>
              </div>

            </div>

            {/* Right Side: COMPACT PROPORTIONAL LIVE MOBILE PHONE PREVIEW */}
            <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
              
              {/* Compact Phone Chassis */}
              <div className="lp-phone-wrapper" style={{
                width: 275, height: 490, background: "#0F172A", borderRadius: 32,
                padding: 6, boxShadow: "0 18px 45px -12px rgba(15,23,42,0.3)",
                border: "2px solid #334155", position: "relative", display: "flex", flexDirection: "column", boxSizing: "border-box"
              }}>
                
                {/* Internal Screen Container */}
                <div style={{
                  flex: 1, background: "#F8FAFC", borderRadius: 26, overflow: "hidden",
                  display: "flex", flexDirection: "column", position: "relative"
                }}>
                  
                  {/* Real Mini Header (Matches exact screenshot header with 'J' avatar for John) */}
                  <div style={{ padding: "8px 10px 6px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#FFFFFF", borderBottom: "1px solid #F1F5F9" }}>
                    <img src="/train-ai-logo.png" alt="TRAIN.AI" style={{ height: 15, width: "auto" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 2, background: "#FFF7ED", padding: "1px 5px", borderRadius: 99, fontSize: 9, fontWeight: 800, color: "#EA580C" }}>
                        <Flame size={10} color="#EA580C" /> 1
                      </div>
                      <div style={{ width: 20, height: 20, borderRadius: 6, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}>
                        <Bell size={10} />
                      </div>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#4F46E5", color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        J
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Screen Body based on tab */}
                  <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px", textAlign: "left" }}>
                    
                    {/* =========================================================
                        TAB 1: HOME (Welcome John + Sprint Goal + Career Roadmap)
                        ========================================================= */}
                    {mobileLearnerTab === "home" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        
                        {/* Dark Welcome Card with John's Name */}
                        <div style={{
                          background: "linear-gradient(135deg, #111827 0%, #1E1B4B 100%)",
                          borderRadius: 12, padding: "9px 10px", color: "#FFFFFF", position: "relative"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 800 }}>Welcome back,</div>
                              <div style={{ fontSize: 12, fontWeight: 900, color: "#FFFFFF" }}>John</div>
                            </div>
                            <div style={{ display: "flex", gap: 3 }}>
                              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#4F46E5", fontSize: 8, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>J</div>
                              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}><Bell size={8} /></div>
                            </div>
                          </div>

                          <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 2, lineHeight: 1.25 }}>
                            0 of 5 lessons done. Continue in <span style={{ color: "#818CF8", fontWeight: 700 }}>AI Fundamentals</span>.
                          </div>

                          {/* Weekly Sprint Goal Bar */}
                          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "4px 6px", marginTop: 6, border: "1px solid rgba(255,255,255,0.1)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 8.5, fontWeight: 800, marginBottom: 3 }}>
                              <span style={{ color: "#E2E8F0" }}>🎯 Sprint Goal (0/5)</span>
                              <span style={{ color: "#34D399" }}>0% Done</span>
                            </div>
                            <div style={{ height: 3.5, borderRadius: 99, background: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
                              <div style={{ width: "8%", height: "100%", background: "#34D399", borderRadius: 99 }} />
                            </div>
                          </div>
                        </div>

                        {/* Browse Catalog Card */}
                        <div style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #E2E8F0", padding: "8px", textAlign: "center" }}>
                          <div style={{ fontSize: 9.5, color: "#475569" }}>No active course yet. Browse catalog to start.</div>
                          <button
                            onClick={() => setMobileLearnerTab("courses")}
                            style={{ width: "100%", background: "#4F46E5", color: "#fff", border: "none", borderRadius: 6, padding: "5px 8px", fontSize: 10, fontWeight: 800, marginTop: 5, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer" }}
                          >
                            <BookOpen size={10} /> Browse courses
                          </button>
                        </div>

                        {/* Your Cohort Card */}
                        <div style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #E2E8F0", padding: "6px 8px", display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 6, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Users size={11} color="#4F46E5" />
                          </div>
                          <div>
                            <div style={{ fontSize: 8, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>YOUR COHORT</div>
                            <div style={{ fontSize: 9.5, color: "#334155", fontWeight: 600 }}>Not part of a cohort yet</div>
                          </div>
                        </div>

                        {/* Your Career Roadmap Card */}
                        <div style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #E2E8F0", padding: "8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 3, color: "#4F46E5", fontSize: 9.5, fontWeight: 800 }}>
                            <TrendingUp size={11} /> Career Roadmap • UX &amp; AI
                          </div>
                          <div style={{ fontSize: 8.5, color: "#64748B", marginTop: 1 }}>
                            Current: <span style={{ fontWeight: 700, color: "#0F172A" }}>Junior Designer</span>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3, marginTop: 5 }}>
                            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 4, padding: "2px", textAlign: "center" }}>
                              <CheckCircle2 size={8} color="#10B981" style={{ margin: "0 auto" }} />
                              <div style={{ fontSize: 7.5, fontWeight: 800, color: "#0F172A" }}>Junior</div>
                            </div>
                            <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 4, padding: "2px", textAlign: "center" }}>
                              <Zap size={8} color="#4F46E5" style={{ margin: "0 auto" }} />
                              <div style={{ fontSize: 7.5, fontWeight: 800, color: "#4F46E5" }}>Tokens</div>
                            </div>
                            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 4, padding: "2px", textAlign: "center" }}>
                              <Lock size={8} color="#94A3B8" style={{ margin: "0 auto" }} />
                              <div style={{ fontSize: 7.5, fontWeight: 800, color: "#64748B" }}>Spatial</div>
                            </div>
                            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 4, padding: "2px", textAlign: "center" }}>
                              <Lock size={8} color="#94A3B8" style={{ margin: "0 auto" }} />
                              <div style={{ fontSize: 7.5, fontWeight: 800, color: "#64748B" }}>Lead</div>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}

                    {/* =========================================================
                        TAB 2: COURSES (With Spotlight + Enriched Mock Courses)
                        ========================================================= */}
                    {mobileLearnerTab === "courses" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        
                        {/* Spotlight Masterclass Card */}
                        <div style={{
                          background: "linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%)",
                          borderRadius: 12, padding: "9px 10px", color: "#FFFFFF"
                        }}>
                          <div style={{ fontSize: 7.5, fontWeight: 800, color: "#C7D2FE", background: "rgba(255,255,255,0.1)", padding: "1px 5px", borderRadius: 4, display: "inline-block" }}>
                            Executive Masterclass • SPOTLIGHT
                          </div>

                          <div style={{ fontSize: 11, fontWeight: 900, marginTop: 4, lineHeight: 1.2 }}>
                            Spatial Computing &amp; VisionOS Foundations
                          </div>

                          <div style={{ fontSize: 8.5, color: "#CBD5E1", marginTop: 2, lineHeight: 1.25 }}>
                            3D spatial user experiences, depth layering &amp; tokens.
                          </div>

                          <div style={{ fontSize: 8, color: "#FCD34D", marginTop: 4, fontWeight: 700 }}>
                            ⭐ 5 (640) • 👥 4.1k Enrolled
                          </div>

                          <button style={{ width: "100%", background: "#4F46E5", color: "#fff", border: "none", borderRadius: 6, padding: "5px 8px", fontSize: 9.5, fontWeight: 800, marginTop: 6 }}>
                            Explore Masterclass →
                          </button>
                        </div>

                        {/* Course Filters */}
                        <div style={{ display: "flex", gap: 4 }}>
                          <span style={{ background: "#4F46E5", color: "#fff", padding: "2px 8px", borderRadius: 99, fontSize: 9, fontWeight: 800 }}>All Courses (49)</span>
                          <span style={{ background: "#FFFFFF", color: "#64748B", border: "1px solid #E2E8F0", padding: "2px 8px", borderRadius: 99, fontSize: 9, fontWeight: 700 }}>Assigned (2)</span>
                        </div>

                        {/* Search Bar */}
                        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "4px 8px", display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "#94A3B8" }}>
                          <Search size={10} /> Search masterclasses...
                        </div>

                        {/* Mock Course 1 */}
                        <div style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #E2E8F0", padding: "6px 8px", display: "flex", gap: 6, alignItems: "center" }}>
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Brain size={14} color="#4F46E5" />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 9.5, fontWeight: 800, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Prompt Engineering &amp; LLM Architecture</div>
                            <div style={{ fontSize: 8, color: "#64748B", marginTop: 1 }}>
                              <span>12 modules</span> • <span>⭐ 4.9 (1.2k)</span>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}

                    {/* =========================================================
                        TAB 3: AI COACH (Adaptive Assessment Generator)
                        ========================================================= */}
                    {mobileLearnerTab === "ai" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        
                        {/* Top Header Card */}
                        <div style={{
                          background: "linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%)",
                          borderRadius: 12, padding: "9px 10px", color: "#FFFFFF"
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 900 }}>AI Learning Coach</div>
                          <div style={{ fontSize: 8.5, color: "#CBD5E1", marginTop: 2 }}>
                            Ask questions, debug code, and take interactive practice quizzes.
                          </div>

                          <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
                            <span style={{ background: "rgba(255,255,255,0.12)", color: "#C7D2FE", padding: "2px 6px", borderRadius: 4, fontSize: 8.5, fontWeight: 800 }}>✦ 10 credits</span>
                            <span style={{ background: "#F97316", color: "#fff", padding: "2px 6px", borderRadius: 4, fontSize: 8.5, fontWeight: 800 }}>+ Get Credits</span>
                          </div>
                        </div>

                        {/* Adaptive Generator Card */}
                        <div style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #E2E8F0", padding: "8px" }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: "#0F172A" }}>AI Assessment Generator</div>
                          <div style={{ fontSize: 8.5, color: "#64748B", marginBottom: 4 }}>Custom quiz tuned to skillset</div>

                          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 6px", fontSize: 8.5, color: "#475569", marginBottom: 4 }}>
                            e.g. LangChain RAG, Figma
                          </div>

                          <button style={{ width: "100%", background: "#4F46E5", color: "#fff", border: "none", borderRadius: 6, padding: "5px 8px", fontSize: 9.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                            ⚡ Generate &amp; Start Quiz
                          </button>
                        </div>

                        {/* Assessment Daily Goal */}
                        <div style={{ background: "#FFFFFF", borderRadius: 8, border: "1px solid #E2E8F0", padding: "6px 8px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, fontWeight: 800 }}>
                            <span style={{ color: "#0F172A" }}>Daily Goal</span>
                            <span style={{ color: "#4F46E5" }}>1 of 3 Done</span>
                          </div>
                          <div style={{ height: 3, borderRadius: 99, background: "#EEF2FF", overflow: "hidden", marginTop: 3 }}>
                            <div style={{ width: "33%", height: "100%", background: "#4F46E5", borderRadius: 99 }} />
                          </div>
                        </div>

                      </div>
                    )}

                    {/* =========================================================
                        TAB 4: COMMUNITY (With Live Poll & Mock Conversations)
                        ========================================================= */}
                    {mobileLearnerTab === "community" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        
                        {/* Top Header Card */}
                        <div style={{
                          background: "linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%)",
                          borderRadius: 12, padding: "9px 10px", color: "#FFFFFF"
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 900 }}>Train AI Community</div>
                          <div style={{ fontSize: 8.5, color: "#CBD5E1", marginTop: 1 }}>
                            Share projects, ask questions, and collaborate.
                          </div>
                        </div>

                        {/* Live Interactive Poll */}
                        <div style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #E2E8F0", padding: "8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 8, fontWeight: 800, color: "#4F46E5", marginBottom: 3 }}>
                            <BarChart2 size={10} /> POLL • 218 Votes
                          </div>
                          <div style={{ fontSize: 9.5, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>
                            Which LLM orchestrator in production?
                          </div>
                          
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <div
                              onClick={() => { setPollVoted(true); setSelectedPollOption(0); }}
                              style={{
                                background: selectedPollOption === 0 && pollVoted ? "#EEF2FF" : "#F8FAFC",
                                border: selectedPollOption === 0 && pollVoted ? "1px solid #4F46E5" : "1px solid #E2E8F0",
                                borderRadius: 4, padding: "3px 6px", fontSize: 8.5, fontWeight: 700,
                                display: "flex", justifyContent: "space-between", cursor: "pointer"
                              }}
                            >
                              <span>LangChain / LangGraph</span>
                              <span style={{ color: "#4F46E5" }}>{pollVoted ? "64%" : "Vote"}</span>
                            </div>

                            <div
                              onClick={() => { setPollVoted(true); setSelectedPollOption(1); }}
                              style={{
                                background: selectedPollOption === 1 && pollVoted ? "#EEF2FF" : "#F8FAFC",
                                border: selectedPollOption === 1 && pollVoted ? "1px solid #4F46E5" : "1px solid #E2E8F0",
                                borderRadius: 4, padding: "3px 6px", fontSize: 8.5, fontWeight: 700,
                                display: "flex", justifyContent: "space-between", cursor: "pointer"
                              }}
                            >
                              <span>Vercel AI SDK</span>
                              <span style={{ color: "#4F46E5" }}>{pollVoted ? "28%" : "Vote"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Mock Student Conversation Thread */}
                        <div style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #E2E8F0", padding: "6px 8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                            <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#10B981", color: "#fff", fontSize: 7.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>MK</div>
                            <div>
                              <div style={{ fontSize: 9, fontWeight: 800, color: "#0F172A" }}>Marcus K.</div>
                            </div>
                          </div>
                          <div style={{ fontSize: 8.5, color: "#334155", lineHeight: 1.25 }}>
                            pgvector with HNSW index had 4ms latency in our benchmark lab!
                          </div>
                        </div>

                      </div>
                    )}

                  </div>

                  {/* Real Exact Interactive Mobile Bottom Navigation Bar */}
                  <div style={{
                    height: 40, background: "#FFFFFF", borderTop: "1px solid #E2E8F0",
                    display: "flex", alignItems: "center", justifyContent: "space-around",
                    padding: "0 4px"
                  }}>
                    <div
                      className={`phone-nav-item ${mobileLearnerTab === "home" ? "active" : ""}`}
                      onClick={() => setMobileLearnerTab("home")}
                    >
                      <Home size={12} />
                      {mobileLearnerTab === "home" && <span>Home</span>}
                    </div>

                    <div
                      className={`phone-nav-item ${mobileLearnerTab === "courses" ? "active" : ""}`}
                      onClick={() => setMobileLearnerTab("courses")}
                    >
                      <BookOpen size={12} />
                      {mobileLearnerTab === "courses" && <span>Courses</span>}
                    </div>

                    <div
                      className={`phone-nav-item ${mobileLearnerTab === "ai" ? "active" : ""}`}
                      onClick={() => setMobileLearnerTab("ai")}
                    >
                      <Zap size={12} />
                      {mobileLearnerTab === "ai" && <span>AI</span>}
                    </div>

                    <div
                      className={`phone-nav-item ${mobileLearnerTab === "community" ? "active" : ""}`}
                      onClick={() => setMobileLearnerTab("community")}
                    >
                      <Users size={12} />
                      {mobileLearnerTab === "community" && <span>Social</span>}
                    </div>
                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 5: THE ORGANISATION APP (White Surface #FFFFFF)
          ========================================================================= */}
      <section id="organisation" className="lp-bg-surface-2" style={{ width: "100%" }}>
        <div className="lp-section-inner" style={{ maxWidth: 1180, margin: "0 auto", padding: "50px 20px 65px", textAlign: "left" }}>
          
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: "#4F46E5", letterSpacing: ".06em" }}>THE ORGANISATION APP</span>
          </div>

          <h2 className="lp-section-h2" style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 10px" }}>
            One workspace, three views
          </h2>

          <p style={{ fontSize: 15, color: "#64748B", maxWidth: 680, margin: "0 0 32px", lineHeight: 1.55 }}>
            Instructors, managers and admins work in the same organisation app. Each person sees only the view their role allows — no separate dashboards to maintain.
          </p>

          {/* 3 Column Role Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, marginBottom: 18 }}>
            
            {/* Instructor View */}
            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "24px 22px", borderRadius: 18, border: "1px solid #E2E8F0", display: "flex", flexDirection: "column", boxShadow: "0 2px 8px rgba(15,23,42,0.03)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <GraduationCap size={17} color="#4F46E5" />
                <span style={{ fontSize: 11, fontWeight: 800, color: "#4F46E5", letterSpacing: ".05em" }}>INSTRUCTOR VIEW</span>
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: "0 0 12px" }}>Run programmes, not spreadsheets</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "#475569" }}>
                <li style={{ display: "flex", gap: 8 }}>• <span>Cohort creation, control and adjustment</span></li>
                <li style={{ display: "flex", gap: 8 }}>• <span>Session scheduling and resources</span></li>
                <li style={{ display: "flex", gap: 8 }}>• <span>Assessment creation and grading</span></li>
                <li style={{ display: "flex", gap: 8 }}>• <span>Progress monitoring by course and level</span></li>
                <li style={{ display: "flex", gap: 8 }}>• <span>Direct learner messaging and feedback notes</span></li>
              </ul>
            </div>

            {/* Manager View */}
            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "24px 22px", borderRadius: 18, border: "1px solid #E2E8F0", display: "flex", flexDirection: "column", boxShadow: "0 2px 8px rgba(15,23,42,0.03)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <TrendingUp size={17} color="#4F46E5" />
                <span style={{ fontSize: 11, fontWeight: 800, color: "#4F46E5", letterSpacing: ".05em" }}>MANAGER VIEW</span>
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: "0 0 12px" }}>See who is ready and who needs support</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "#475569" }}>
                <li style={{ display: "flex", gap: 8 }}>• <span>Direct report progress</span></li>
                <li style={{ display: "flex", gap: 8 }}>• <span>Team summary</span></li>
                <li style={{ display: "flex", gap: 8 }}>• <span>Team readiness score</span></li>
                <li style={{ display: "flex", gap: 8 }}>• <span>Team skill snapshot</span></li>
                <li style={{ display: "flex", gap: 8 }}>• <span>Department feedback notes</span></li>
              </ul>
            </div>

            {/* Admin View */}
            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "24px 22px", borderRadius: 18, border: "1px solid #E2E8F0", display: "flex", flexDirection: "column", boxShadow: "0 2px 8px rgba(15,23,42,0.03)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <ShieldCheck size={17} color="#4F46E5" />
                <span style={{ fontSize: 11, fontWeight: 800, color: "#4F46E5", letterSpacing: ".05em" }}>ADMIN VIEW</span>
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: "0 0 12px" }}>Manage learning at scale</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "#475569" }}>
                <li style={{ display: "flex", gap: 8 }}>• <span>Bulk onboarding and offboarding</span></li>
                <li style={{ display: "flex", gap: 8 }}>• <span>Learning track and course assignment</span></li>
                <li style={{ display: "flex", gap: 8 }}>• <span>Compliance tracking and organisation dashboard</span></li>
                <li style={{ display: "flex", gap: 8 }}>• <span>Certificate settings and AI moderation controls</span></li>
                <li style={{ display: "flex", gap: 8 }}>• <span>Role management, SSO, API, audit and export controls</span></li>
              </ul>
            </div>

          </div>

          {/* Bottom 2 Connected Architecture Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            
            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "18px 20px", borderRadius: 16, border: "1px solid #E2E8F0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Users size={17} color="#4F46E5" />
                <h4 style={{ fontSize: 14.5, fontWeight: 800, color: "#0F172A", margin: 0 }}>Learner side, connected</h4>
              </div>
              <p style={{ fontSize: 12.5, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                Assigned courses, cohort sessions and instructor messages appear straight in the learner app, with notifications and reminders attached.
              </p>
            </div>

            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "18px 20px", borderRadius: 16, border: "1px solid #E2E8F0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Database size={17} color="#4F46E5" />
                <h4 style={{ fontSize: 14.5, fontWeight: 800, color: "#0F172A", margin: 0 }}>Multi-tenant by design</h4>
              </div>
              <p style={{ fontSize: 12.5, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                Every organisation's data is separated and permission-enforced, with audit logging and export controls built in.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 6: HOW IT WORKS (Surface #F8FAFC with Step Connectors)
          ========================================================================= */}
      <section id="how-it-works" className="lp-bg-surface-1" style={{ width: "100%" }}>
        <div className="lp-section-inner" style={{ maxWidth: 1180, margin: "0 auto", padding: "50px 20px 65px", textAlign: "center" }}>
          
          <h2 className="lp-section-h2" style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 8px" }}>
            How It Works
          </h2>
          <p style={{ fontSize: 15, color: "#64748B", maxWidth: 540, margin: "0 auto 36px" }}>
            Move from onboarding to measurable workforce readiness
          </p>

          {/* 3 Step Connected Grid */}
          <div style={{ position: "relative" }}>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, textAlign: "left", position: "relative", zIndex: 1 }}>
              
              {/* Step 1 */}
              <div className="lp-step-card" style={{ background: "#FFFFFF", borderRadius: 18, padding: "26px 22px", border: "1px solid #E2E8F0", position: "relative", boxShadow: "0 2px 8px rgba(15,23,42,0.03)" }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", marginBottom: 14 }}>
                  <UserPlus size={19} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: "0 0 8px" }}>1. Onboard Your People</h3>
                <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.55 }}>
                  Invite learners, instructors and managers, then organise them by team, cohort and learning need.
                </p>
              </div>

              {/* Step 2 */}
              <div className="lp-step-card" style={{ background: "#FFFFFF", borderRadius: 18, padding: "26px 22px", border: "1px solid #E2E8F0", position: "relative", boxShadow: "0 2px 8px rgba(15,23,42,0.03)" }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", marginBottom: 14 }}>
                  <BookOpen size={19} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: "0 0 8px" }}>2. Assign &amp; Develop</h3>
                <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.55 }}>
                  Build or curate courses, assign required learning and support progress through instructors and AI tools.
                </p>
              </div>

              {/* Step 3 */}
              <div className="lp-step-card" style={{ background: "#FFFFFF", borderRadius: 18, padding: "26px 22px", border: "1px solid #E2E8F0", position: "relative", boxShadow: "0 2px 8px rgba(15,23,42,0.03)" }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", marginBottom: 14 }}>
                  <TrendingUp size={19} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: "0 0 8px" }}>3. Measure Readiness</h3>
                <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.55 }}>
                  Track skills, assessments, compliance, certificates and workforce readiness from live business dashboards.
                </p>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 7: ENTERPRISE TRUST & DATA SECURITY (White Surface #FFFFFF)
          ========================================================================= */}
      <section id="trust" className="lp-bg-surface-2" style={{ width: "100%" }}>
        <div className="lp-section-inner" style={{ maxWidth: 1180, margin: "0 auto", padding: "45px 20px 60px", textAlign: "left" }}>
          
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: "#4F46E5", letterSpacing: ".06em" }}>ENTERPRISE TRUST</span>
          </div>

          <h2 className="lp-section-h2" style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 10px" }}>
            Trust is part of the product
          </h2>

          <p style={{ fontSize: 15, color: "#64748B", maxWidth: 640, margin: "0 0 30px", lineHeight: 1.55 }}>
            Permissions, privacy, auditability and data ownership are built in — not added later.
          </p>

          {/* 6 Grid Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            {TRUST_FEATURES.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="lp-card-hover" style={{ background: "#FFFFFF", padding: "20px 20px", borderRadius: 16, border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(15,23,42,0.02)" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                    <Icon size={17} color="#4F46E5" />
                  </div>
                  <h3 style={{ fontSize: 15.5, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>{item.title}</h3>
                  <p style={{ fontSize: 12.5, color: "#64748B", margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 8: FAQ ACCORDION (All 8 Exact Items from trainailtd.com)
          ========================================================================= */}
      <section id="faq" className="lp-bg-surface-1" style={{ width: "100%" }}>
        <div className="lp-section-inner" style={{ maxWidth: 840, margin: "0 auto", padding: "50px 20px 70px", textAlign: "left" }}>
          
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h2 className="lp-section-h2" style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.035em", color: "#0F172A", margin: "0 0 8px" }}>
              Frequently Asked Questions
            </h2>
            <p style={{ fontSize: 15, color: "#64748B", margin: 0 }}>
              Got questions? We've got answers. Find everything you need to know about Train AI.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={item.q} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 14, padding: "4px 20px", boxShadow: "0 2px 6px rgba(15,23,42,0.02)" }}>
                  <button
                    type="button"
                    style={{
                      width: "100%", border: "none", background: "transparent", cursor: "pointer",
                      padding: "16px 0", display: "flex", alignItems: "center", justifyContent: "space-between",
                      gap: 12, fontSize: 15, fontWeight: 700, color: "#0F172A", textAlign: "left"
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

        </div>
      </section>

      {/* =========================================================================
          SECTION 9: PRE-FOOTER CTA CARD
          ========================================================================= */}
      <section style={{ width: "100%", background: "#FFFFFF", padding: "40px 20px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{
            background: "#4F46E5",
            borderRadius: 24, padding: "44px 24px", textAlign: "center",
            boxShadow: "0 18px 40px -12px rgba(79,70,229,0.3)"
          }}>
            <h2 style={{ fontSize: "clamp(22px, 3.6vw, 38px)", fontWeight: 900, letterSpacing: "-0.035em", margin: "0 0 12px", color: "#FFFFFF", lineHeight: 1.15 }}>
              Ready to Build a Workforce That Is Ready for<br />What's Next?
            </h2>
            
            <p style={{ fontSize: 15, color: "#EEF2FF", maxWidth: 620, margin: "0 auto 24px", lineHeight: 1.55 }}>
              Bring courses, cohorts, compliance and workforce intelligence together in one business LMS.
            </p>

            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 22 }}>
              <button
                className="action-btn-primary"
                style={{ background: "#FFFFFF", color: "#4F46E5", fontWeight: 800, padding: "12px 24px", borderRadius: 99, border: "none", cursor: "pointer", fontSize: 14, boxShadow: "0 4px 14px rgba(0,0,0,0.1)", display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={() => handleNav("signin")}
              >
                Get Started <ArrowRight size={15} />
              </button>
              <button
                style={{ background: "rgba(255,255,255,0.12)", color: "#FFFFFF", fontWeight: 700, padding: "12px 20px", borderRadius: 99, border: "1.5px solid rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 14 }}
                onClick={() => handleNav("signin")}
              >
                Sign In to Train AI
              </button>
              <button
                style={{ background: "transparent", color: "#FFFFFF", fontWeight: 700, padding: "12px 20px", borderRadius: 99, border: "1.5px solid rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 14 }}
                onClick={() => handleNav("demo")}
              >
                Request a demo
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", fontSize: 12, color: "#EEF2FF", fontWeight: 700 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399" }} />
                Role-based access
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399" }} />
                Organisation-ready
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399" }} />
                Secure learner data
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 10: DARK ENTERPRISE FOOTER (Uses /logo-dark.png)
          ========================================================================= */}
      <footer style={{ background: "#0B1120", color: "#FFFFFF", paddingTop: 40, paddingBottom: 30, borderTop: "1px solid #1E293B" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 20px" }}>
          
          {/* Newsletter Box */}
          <div style={{
            background: "#131C31", borderRadius: 18, padding: "28px 20px",
            border: "1px solid #1E293B", textAlign: "center", marginBottom: 44,
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
          }}>
            <h3 style={{ fontSize: 19, fontWeight: 800, color: "#FFFFFF", margin: "0 0 6px" }}>
              Stay Updated
            </h3>
            <p style={{ fontSize: 13, color: "#94A3B8", margin: "0 0 18px" }}>
              Get the latest courses, features, and learning tips delivered to your inbox.
            </p>

            {newsletterSubscribed ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px", background: "rgba(16,185,129,0.15)", color: "#34D399", borderRadius: 99, fontWeight: 700, fontSize: 13 }}>
                <CheckCircle2 size={16} />
                <span>Thank you for subscribing! We will keep you updated.</span>
              </div>
            ) : (
              <form onSubmit={handleNewsletterSubmit} style={{ display: "flex", maxWidth: 440, margin: "0 auto", gap: 8, flexWrap: "wrap" }}>
                <input
                  type="email"
                  required
                  placeholder="Enter your email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  style={{
                    flex: 1, minWidth: 180, padding: "10px 14px", borderRadius: 99,
                    border: "1px solid #334155", background: "#0B1120", color: "#FFFFFF",
                    fontSize: 13, outline: "none"
                  }}
                />
                <button
                  type="submit"
                  className="action-btn-primary"
                  style={{
                    border: "none", padding: "10px 18px", borderRadius: 99, fontWeight: 800, fontSize: 13,
                    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6
                  }}
                >
                  <Mail size={14} /> Subscribe
                </button>
              </form>
            )}
          </div>

          {/* Footer Navigation Columns */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 28, marginBottom: 38, textAlign: "left" }}>
            
            {/* Brand column with Dark Mode Logo */}
            <div>
              <img src="/logo-dark.png" alt="Train AI" style={{ height: 24, width: "auto", objectFit: "contain", display: "block", marginBottom: 12 }} />
              <p style={{ fontSize: 12.5, color: "#94A3B8", lineHeight: 1.55, margin: "0 0 16px", maxWidth: 280 }}>
                AI-powered workforce learning and intelligence for modern businesses.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <div className="lp-social-btn" aria-label="Facebook"><Facebook size={15} /></div>
                <div className="lp-social-btn" aria-label="Twitter"><Twitter size={15} /></div>
                <div className="lp-social-btn" aria-label="Instagram"><Instagram size={15} /></div>
                <div className="lp-social-btn" aria-label="LinkedIn"><Linkedin size={15} /></div>
              </div>
            </div>

            {/* Product column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: "#FFFFFF", marginBottom: 2 }}>Product</div>
              <span className="lp-footer-link" onClick={() => scrollToId("intelligence")}>Features</span>
              <span className="lp-footer-link" onClick={() => scrollToId("how-it-works")}>How It Works</span>
              <span className="lp-footer-link" onClick={() => handleNav("signup")}>Sign Up</span>
              <span className="lp-footer-link" onClick={() => scrollToId("learners")}>Courses</span>
            </div>

            {/* For Users column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: "#FFFFFF", marginBottom: 2 }}>For Users</div>
              <span className="lp-footer-link" onClick={() => scrollToId("learners")}>Learner Dashboard</span>
              <span className="lp-footer-link" onClick={() => scrollToId("organisation")}>Instructor Workspace</span>
              <span className="lp-footer-link" onClick={() => scrollToId("learners")}>Community</span>
              <span className="lp-footer-link" onClick={() => scrollToId("how-it-works")}>Certificates</span>
            </div>

          </div>

          {/* Bottom Copyright & Legal Links */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, paddingTop: 18, borderTop: "1px solid #1E293B", fontSize: 12, color: "#64748B" }}>
            <div>
              © 2025 Train AI Ltd. All rights reserved. Headquartered in London, United Kingdom
            </div>
            <div style={{ display: "flex", gap: 16 }}>
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
                <h3 style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", margin: 0 }}>Request a Live Demo</h3>
                <p style={{ fontSize: 12.5, color: "#64748B", margin: "2px 0 0" }}>Experience the workforce intelligence platform tailored to your team.</p>
              </div>
              <button style={styles.modalClose} onClick={() => setDemoModalOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            {demoSubmitted ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, background: "#ECFDF5", color: "#059669", borderRadius: 10, fontWeight: 700, fontSize: 13.5 }}>
                <CheckCircle2 size={18} />
                <span>Thank you! We will reach out to schedule your demo shortly.</span>
              </div>
            ) : (
              <form onSubmit={handleDemoSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
                <button type="submit" disabled={submitting} className="action-btn-primary" style={styles.modalSubmitBtn}>
                  {submitting ? "Submitting..." : "Schedule Live Demo"} <ArrowRight size={14} />
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: 0 }}>{LEGAL_CONTENT[activeModal].title}</h3>
              <button style={styles.modalClose} onClick={() => setActiveModal(null)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, margin: 0 }}>{LEGAL_CONTENT[activeModal].body}</p>
          </div>
        </div>
      )}

    </div>
  );
}

const styles = {
  outer: { minHeight: "100vh", background: "#FFFFFF", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", overflowX: "hidden" },
  header: { background: "rgba(255,255,255,0.96)", backdropFilter: "blur(12px)", borderBottom: "1px solid #E2E8F0", position: "sticky", top: 0, zIndex: 60 },
  headerInner: { maxWidth: 1180, margin: "0 auto", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  signInBtn: { border: "none", background: "transparent", padding: "7px 10px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", color: "#334155" },
  requestDemoBtn: { padding: "7px 14px", borderRadius: 99, fontWeight: 700, fontSize: 13, cursor: "pointer" },
  getStartedBtn: { border: "none", padding: "7px 16px", borderRadius: 99, fontWeight: 800, fontSize: 13, cursor: "pointer" },
  startOrgBtn: { border: "none", padding: "11px 22px", borderRadius: 99, fontWeight: 800, fontSize: 13.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 },
  requestDemoOutlineBtn: { padding: "11px 22px", borderRadius: 99, fontWeight: 700, fontSize: 13.5, cursor: "pointer" },
  heroPill: { background: "#FFFFFF", border: "1px solid #E2E8F0", padding: "7px 12px", borderRadius: 12, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 1px 4px rgba(15,23,42,0.03)" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 100 },
  modalCard: { background: "#FFFFFF", borderRadius: 18, padding: 22, maxWidth: 480, width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 25px 50px -20px rgba(15,23,42,.3)" },
  modalClose: { border: "none", background: "#F1F5F9", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex", color: "#64748B" },
  formInput: { width: "100%", border: "1.5px solid #E2E8F0", padding: "9px 12px", fontSize: 12.5, borderRadius: 8, outline: "none", boxSizing: "border-box", color: "#0F172A", background: "#F8FAFC" },
  formTextarea: { width: "100%", border: "1.5px solid #E2E8F0", padding: "9px 12px", fontSize: 12.5, borderRadius: 8, outline: "none", boxSizing: "border-box", color: "#0F172A", resize: "vertical", fontFamily: "inherit", background: "#F8FAFC" },
  modalSubmitBtn: { border: "none", padding: "11px 18px", borderRadius: 8, fontWeight: 800, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }
};
