import React, { useState, useEffect } from "react";
import {
  ArrowRight, BookOpen, GraduationCap, Cpu, ShieldCheck, CheckCircle2, Globe, X,
  Brain, Layers, ChevronDown, HelpCircle, ClipboardList, UserPlus, Rocket,
  Building2, Users, Target, TrendingUp, AlertTriangle, Eye, Lock, Compass, BarChart3,
  GitCompare, Table, School, Handshake, Briefcase, Zap, Sparkles, Flame, Menu, Check,
  Play, MessageSquare, Laptop, Award, Star, Activity, ArrowUpRight, Gauge, Database,
  Home, Bot, MessageCircle, Mail, Download, Wifi, Accessibility, Bell, Send,
  Facebook, Twitter, Instagram, Linkedin, Search, RefreshCw, ChevronRight, PlayCircle
} from "lucide-react";
import { submitDemoRequest, captureAttributionFromURL } from "../../lib/api/waitlist.js";
import { trackReferralClickIfPresent } from "../../lib/api/organizations.js";

const TEAM_SIZE_OPTIONS = ["1–50", "51–200", "201–1,000", "1,000+"];

const LEGAL_CONTENT = {
  about: {
    title: "About Us",
    body: "Train AI is the next-generation AI-powered workforce learning and intelligence operating system. We bridge the gap between static training and measurable business capability by uniting adaptive AI coaching, live cohort mentorship, and real-time skill telemetry in one unified platform."
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
    desc: "A finished course is not the same as real capability. We evaluate practical application, not video watch time."
  },
  {
    icon: Gauge,
    title: "Intelligence over reporting",
    desc: "Dashboards should power proactive talent decisions, forecasting team capability gaps before they impact delivery."
  },
  {
    icon: Building2,
    title: "Organisation-first",
    desc: "Engineered from the ground up for multi-tenant organizations, with seamless individual learner access."
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
    desc: "Row-level security policies ensure absolute isolation for every organisation's learners, courses, and telemetry."
  },
  {
    icon: ClipboardList,
    title: "Audit logging & compliance",
    desc: "Every administrative action and compliance sign-off is recorded in an immutable audit trail."
  },
  {
    icon: Download,
    title: "Consent & export controls",
    desc: "GDPR-compliant data exports, automated DSAR handling, and full administrative governance."
  },
  {
    icon: Bell,
    title: "Reliable smart notifications",
    desc: "Automated cohort calendar sync, assignment nudges, and email reminders deliver 98% on-time completion."
  },
  {
    icon: Wifi,
    title: "Low-bandwidth optimized",
    desc: "Lightweight progressive web architecture engineered to load in under 1 second even on modest connections."
  },
  {
    icon: Accessibility,
    title: "Accessible UI (WCAG 2.1 AA)",
    desc: "High-contrast palette, full keyboard navigation, screen reader optimization, and font size adaptability."
  }
];

const FAQ_ITEMS = [
  {
    q: "How does Train AI differ from a traditional LMS like TalentLMS or Coursera?",
    a: "Traditional LMS tools only measure passive video completion. Train AI is an active Workforce Intelligence Operating System that maps dynamic team capability in real time, provides 24/7 AI tutoring, automated practice quizzes, and live cohort mentorship."
  },
  {
    q: "Can our organization upload our own proprietary courses and SCORM files?",
    a: "Yes! Train AI supports SCORM 1.2/2004, xAPI, interactive video lessons, custom PDF modules, and AI-assisted quiz generation for your internal proprietary curriculum."
  },
  {
    q: "How does the AI Neural Coach adapt to individual employees?",
    a: "Our AI Neural Coach analyzes real quiz errors and reading speed to deliver tailored step-by-step guidance, recommend targeted remedial exercises, and answer technical questions 24/7 without instructor bottlenecks."
  },
  {
    q: "How are workspaces, roles, and permissions partitioned?",
    a: "Train AI provides distinct role-based views in one seamless app: Learners study and receive AI coaching; Instructors manage cohorts and assessments; Managers track team skill graphs; Admins control bulk onboarding, SSO, and compliance."
  }
];

export default function LandingPage({ onNavigate }) {
  useEffect(() => { captureAttributionFromURL(); }, []);
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) trackReferralClickIfPresent(ref);
  }, []);

  const [activeShowcaseTab, setActiveShowcaseTab] = useState("intelligence");
  const [activeRoleTab, setActiveRoleTab] = useState("instructor");
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
    if (["platform", "intelligence", "learners", "organisation", "faq", "how-it-works", "trust"].includes(target)) {
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
        :root {
          --tai-purple: #4F46E5;
          --tai-purple-light: #6366F1;
          --tai-purple-dark: #4338CA;
          --tai-violet: #7C3AED;
          --tai-grad: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
          --tai-grad-glow: linear-gradient(135deg, rgba(79,70,229,0.15) 0%, rgba(124,58,237,0.08) 100%);
          --tai-tint: #EEF2FF;
          --tai-border: #E0E7FF;
        }

        @keyframes floatSlow { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        @keyframes floatReverse { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(8px); } }
        @keyframes pulseDot { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.35); opacity: 0.6; } }
        @keyframes meshGlow {
          0%, 100% { opacity: 0.45; transform: scale(1) translate(0, 0); }
          50% { opacity: 0.75; transform: scale(1.1) translate(-20px, 15px); }
        }
        @keyframes fillBar1 { from { width: 0%; } to { width: 88%; } }
        @keyframes fillBar2 { from { width: 0%; } to { width: 76%; } }
        @keyframes fillBar3 { from { width: 0%; } to { width: 64%; } }
        @keyframes fillBar4 { from { width: 0%; } to { width: 58%; } }
        @keyframes shimmerBorder {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .lp-purple-grad-text {
          background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 70%, #9333EA 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .lp-card-hover {
          transition: transform .26s cubic-bezier(0.16, 1, 0.3, 1), box-shadow .26s ease, border-color .26s ease;
        }
        .lp-card-hover:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 40px -10px rgba(79, 70, 229, 0.12);
          border-color: #C7D2FE !important;
        }

        .lp-interactive-tab {
          transition: all .2s ease;
          cursor: pointer;
        }
        .lp-interactive-tab:hover {
          color: #4F46E5 !important;
          background: #EEF2FF !important;
        }

        .lp-step-card {
          transition: all .25s ease;
        }
        .lp-step-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 22px 48px -12px rgba(79, 70, 229, 0.2);
          border-color: #A5B4FC !important;
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
          transition: all .2s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: pointer;
        }
        .lp-pill-hover:hover {
          transform: translateY(-2px);
          border-color: #A5B4FC !important;
          background: #EEF2FF !important;
          color: #4F46E5 !important;
          box-shadow: 0 6px 16px rgba(79, 70, 229, 0.12);
        }

        .action-btn-primary {
          background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
          color: #FFFFFF;
          transition: transform .18s ease, box-shadow .18s ease;
        }
        .action-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px -4px rgba(79, 70, 229, 0.45);
        }
        .action-btn-primary:active {
          transform: scale(.97);
        }

        .action-btn-outline {
          background: #FFFFFF;
          color: #1E1B4B;
          border: 1.5px solid #C7D2FE;
          transition: all .18s ease;
        }
        .action-btn-outline:hover {
          background: #EEF2FF;
          border-color: #818CF8;
          color: #4F46E5;
          transform: translateY(-1px);
        }

        .lp-bar-1 { animation: fillBar1 1.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .lp-bar-2 { animation: fillBar2 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .lp-bar-3 { animation: fillBar3 1.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .lp-bar-4 { animation: fillBar4 1.9s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        .lp-float-card { animation: floatSlow 5.5s ease-in-out infinite; }
        .lp-float-badge { animation: floatReverse 4.5s ease-in-out infinite; }
        .lp-pulse-live { animation: pulseDot 2s ease-in-out infinite; }
        .lp-mesh-glow { animation: meshGlow 7s ease-in-out infinite; }

        .lp-footer-link {
          color: #94A3B8;
          text-decoration: none;
          font-size: 13.5px;
          transition: color .15s ease;
          cursor: pointer;
        }
        .lp-footer-link:hover {
          color: #FFFFFF !important;
        }

        .lp-social-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #1E293B;
          border: 1px solid #334155;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94A3B8;
          transition: all .18s ease;
          cursor: pointer;
        }
        .lp-social-btn:hover {
          background: #4F46E5;
          color: #FFFFFF;
          border-color: #4F46E5;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(79, 70, 229, 0.4);
        }

        @media (max-width: 960px) {
          .lp-desktop-nav { display: none !important; }
          .lp-mobile-menu-btn { display: flex !important; }
          .lp-hero-grid { grid-template-columns: 1fr !important; gap: 44px !important; text-align: center !important; }
          .lp-hero-left { margin: 0 auto !important; max-width: 620px !important; }
          .lp-hero-ctas { justify-content: center !important; }
          .lp-hero-pills { justify-content: center !important; }
          .lp-hero-right { justify-content: center !important; }
          .lp-steps-connector { display: none !important; }
        }
        @media (min-width: 961px) {
          .lp-mobile-drawer { display: none !important; }
          .lp-mobile-menu-btn { display: none !important; }
        }
        @media (max-width: 640px) {
          .lp-hero-h1 { font-size: 36px !important; }
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
            <img src="/train-ai-logo.png" alt="Train AI" style={{ height: 42, width: "auto", objectFit: "contain", display: "block" }} />
          </div>

          {/* Center Navigation Links */}
          <nav className="lp-desktop-nav" style={{ display: "flex", gap: 28, alignItems: "center" }}>
            <span className="lp-nav-link" onClick={() => handleNav("home")}>Home</span>
            <span className="lp-nav-link" onClick={() => handleNav("platform")}>Platform</span>
            <span className="lp-nav-link" onClick={() => handleNav("intelligence")}>Intelligence</span>
            <span className="lp-nav-link" onClick={() => handleNav("learners")}>Learners</span>
            <span className="lp-nav-link" onClick={() => handleNav("organisation")}>Organisation</span>
            <span className="lp-nav-link" onClick={() => handleNav("faq")}>FAQ</span>
          </nav>

          {/* Action CTAs */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              style={styles.signInBtn}
              onClick={() => handleNav("signin")}
            >
              Sign In
            </button>
            <button
              className="action-btn-outline"
              style={styles.requestDemoBtn}
              onClick={() => handleNav("demo")}
            >
              Request a demo
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
                width: 38, height: 38, borderRadius: 10, border: "1px solid #E0E7FF",
                background: "#EEF2FF", display: "none", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#4F46E5"
              }}
              aria-label="Toggle Mobile Navigation"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lp-mobile-drawer" style={{ background: "#FFFFFF", borderTop: "1px solid #E0E7FF", padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 14px 30px rgba(79,70,229,0.08)" }}>
            <span className="lp-nav-link" style={{ fontSize: 15, fontWeight: 700 }} onClick={() => handleNav("home")}>Home</span>
            <span className="lp-nav-link" style={{ fontSize: 15, fontWeight: 700 }} onClick={() => handleNav("platform")}>Platform</span>
            <span className="lp-nav-link" style={{ fontSize: 15, fontWeight: 700 }} onClick={() => handleNav("intelligence")}>Intelligence</span>
            <span className="lp-nav-link" style={{ fontSize: 15, fontWeight: 700 }} onClick={() => handleNav("learners")}>Learners</span>
            <span className="lp-nav-link" style={{ fontSize: 15, fontWeight: 700 }} onClick={() => handleNav("organisation")}>Organisation</span>
            <span className="lp-nav-link" style={{ fontSize: 15, fontWeight: 700 }} onClick={() => handleNav("faq")}>FAQ</span>
          </div>
        )}
      </header>

      {/* =========================================================================
          SECTION 1: HERO SECTION WITH DYNAMIC WORKFORCE TELEMETRY
          ========================================================================= */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "64px 24px 80px", position: "relative" }}>
        
        {/* Soft Ambient Radial Mesh in Train AI Blueish-Purple */}
        <div className="lp-mesh-glow" style={{ position: "absolute", top: -60, right: "5%", width: 540, height: 540, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, rgba(124,58,237,0.08) 45%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
        <div className="lp-mesh-glow" style={{ position: "absolute", bottom: 0, left: "5%", width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.12) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

        <div className="lp-hero-grid" style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 40, alignItems: "center", position: "relative", zIndex: 1 }}>
          
          {/* Left Column */}
          <div className="lp-hero-left" style={{ textAlign: "left" }}>
            
            {/* Pill Tag */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 99,
              background: "#EEF2FF", border: "1px solid #C7D2FE",
              color: "#4F46E5", fontSize: 12, fontWeight: 800, marginBottom: 24, letterSpacing: ".02em"
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4F46E5", display: "inline-block" }} />
              <span>AI WORKFORCE INTELLIGENCE PLATFORM</span>
            </div>

            {/* Headline */}
            <h1 className="lp-hero-h1" style={{ fontSize: "clamp(38px, 4.5vw, 60px)", fontWeight: 900, letterSpacing: "-0.035em", color: "#0F172A", margin: "0 0 20px", lineHeight: 1.08 }}>
              Measure<br />
              readiness,<br />
              <span className="lp-purple-grad-text">
                not completion.
              </span>
            </h1>

            {/* Subtitle */}
            <p style={{ fontSize: 16.5, color: "#475569", lineHeight: 1.6, margin: "0 0 30px", maxWidth: 530 }}>
              Train AI turns daily learning signals into decision-ready intelligence about workforce readiness, real capability, and team skill coverage — so leaders know who is prepared, who is stuck, and where the gaps are.
            </p>

            {/* Dual CTAs */}
            <div className="lp-hero-ctas" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 36 }}>
              <button className="action-btn-primary" style={styles.startOrgBtn} onClick={() => handleNav("signin")}>
                Start with your organisation <ArrowRight size={15} />
              </button>
              <button className="action-btn-outline" style={styles.requestDemoOutlineBtn} onClick={() => handleNav("demo")}>
                Request a demo
              </button>
            </div>

            {/* 3 Metric Interactive Pills */}
            <div className="lp-hero-pills" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div className="lp-pill-hover" style={styles.heroPill} onClick={() => scrollToId("platform")}>
                <Layers size={17} color="#4F46E5" />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0F172A" }}>AI Skill Graph</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>Held • developing • missing</div>
                </div>
              </div>

              <div className="lp-pill-hover" style={styles.heroPill} onClick={() => scrollToId("intelligence")}>
                <Gauge size={17} color="#7C3AED" />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0F172A" }}>Readiness Score</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>Team • function • org</div>
                </div>
              </div>

              <div className="lp-pill-hover" style={styles.heroPill} onClick={() => scrollToId("learners")}>
                <Activity size={17} color="#4F46E5" />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0F172A" }}>Live Telemetry</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>Quizzes • AI insights</div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Real Enterprise Team + Floating Telemetry Dashboard */}
          <div className="lp-hero-right" style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
            
            {/* Real Professional Team Photo */}
            <div style={{ width: "100%", maxWidth: 380, marginBottom: -48, position: "relative", zIndex: 1 }}>
              <img
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop&q=80"
                alt="Train AI Professional Team"
                style={{ width: "100%", height: 320, objectFit: "cover", borderRadius: 24, boxShadow: "0 20px 45px -12px rgba(15,23,42,0.18)" }}
              />
              
              {/* Floating Dynamic Badge */}
              <div className="lp-float-badge" style={{
                position: "absolute", top: 20, right: -16, background: "rgba(255,255,255,0.92)",
                backdropFilter: "blur(10px)", padding: "8px 14px", borderRadius: 14,
                border: "1px solid #E0E7FF", boxShadow: "0 10px 25px rgba(79,70,229,0.15)",
                display: "flex", alignItems: "center", gap: 8
              }}>
                <Sparkles size={16} color="#7C3AED" />
                <span style={{ fontSize: 12, fontWeight: 800, color: "#1E1B4B" }}>AI Neural Tutor Live</span>
              </div>
            </div>

            {/* Floating Live Telemetry Card */}
            <div className="lp-float-card" style={{
              position: "relative", zIndex: 2, width: "100%", maxWidth: 440,
              background: "#FFFFFF", borderRadius: 22, padding: "24px 26px",
              border: "1.5px solid #E0E7FF", boxShadow: "0 24px 50px -10px rgba(79,70,229,0.18)",
              textAlign: "left"
            }}>
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: "#6366F1", textTransform: "uppercase", letterSpacing: ".06em" }}>WORKFORCE INTELLIGENCE</div>
                  <div style={{ fontSize: 16.5, fontWeight: 900, color: "#0F172A", marginTop: 2 }}>Readiness by team</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 800, color: "#4F46E5", background: "#EEF2FF", padding: "3px 8px", borderRadius: 99 }}>
                  <span className="lp-pulse-live" style={{ width: 6, height: 6, borderRadius: "50%", background: "#4F46E5", display: "inline-block" }} />
                  <span>Real-time</span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 18 }}>
                <span style={{ fontSize: 38, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.03em" }}>71</span>
                <span style={{ fontSize: 13, color: "#64748B", fontWeight: 700 }}>Organisation readiness index</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#10B981" }}>+4 this month</span>
              </div>

              {/* Progress Bars in Train AI Purple */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span style={{ color: "#334155" }}>Engineering &amp; AI</span>
                    <span style={{ color: "#4F46E5", fontWeight: 800 }}>88 (+6)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: "#EEF2FF", overflow: "hidden" }}>
                    <div className="lp-bar-1" style={{ height: "100%", background: "linear-gradient(90deg, #4F46E5, #7C3AED)", borderRadius: 99 }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span style={{ color: "#334155" }}>Operations &amp; Security</span>
                    <span style={{ color: "#4F46E5", fontWeight: 800 }}>76 (+3)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: "#EEF2FF", overflow: "hidden" }}>
                    <div className="lp-bar-2" style={{ height: "100%", background: "linear-gradient(90deg, #4F46E5, #7C3AED)", borderRadius: 99 }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span style={{ color: "#334155" }}>Compliance &amp; Governance</span>
                    <span style={{ color: "#4F46E5", fontWeight: 800 }}>64 (-2)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: "#EEF2FF", overflow: "hidden" }}>
                    <div className="lp-bar-3" style={{ height: "100%", background: "linear-gradient(90deg, #4F46E5, #7C3AED)", borderRadius: 99 }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span style={{ color: "#334155" }}>Commercial &amp; Growth</span>
                    <span style={{ color: "#4F46E5", fontWeight: 800 }}>58 (+9)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: "#EEF2FF", overflow: "hidden" }}>
                    <div className="lp-bar-4" style={{ height: "100%", background: "linear-gradient(90deg, #4F46E5, #7C3AED)", borderRadius: 99 }} />
                  </div>
                </div>
              </div>

              {/* Bottom 3 Numbers */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, paddingTop: 14, borderTop: "1px solid #F1F5F9" }}>
                <div>
                  <div style={{ fontSize: 19, fontWeight: 900, color: "#0F172A" }}>12</div>
                  <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Skill gaps closed</div>
                </div>
                <div>
                  <div style={{ fontSize: 19, fontWeight: 900, color: "#0F172A" }}>38</div>
                  <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Compliance active</div>
                </div>
                <div>
                  <div style={{ fontSize: 19, fontWeight: 900, color: "#0F172A" }}>6</div>
                  <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Cohorts in flight</div>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          ENTERPRISE STATS TICKER BAR
          ========================================================================= */}
      <section style={{ background: "#FFFFFF", borderTop: "1px solid #E0E7FF", borderBottom: "1px solid #E0E7FF", padding: "26px 24px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24, textAlign: "center" }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#4F46E5", letterSpacing: "-0.02em" }}>94%</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#64748B", marginTop: 2 }}>Workforce Readiness Rate</div>
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#7C3AED", letterSpacing: "-0.02em" }}>3.2x</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#64748B", marginTop: 2 }}>Faster Skill Ramp-Up</div>
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#4F46E5", letterSpacing: "-0.02em" }}>150+</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#64748B", marginTop: 2 }}>Enterprise Career Tracks</div>
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#10B981", letterSpacing: "-0.02em" }}>99.9%</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#64748B", marginTop: 2 }}>Enterprise Uptime SLA</div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: DYNAMIC PLATFORM SHOWCASE (TalentLMS / Linear Grade)
          ========================================================================= */}
      <section id="platform" style={{ maxWidth: 1180, margin: "0 auto", padding: "70px 24px 70px", textAlign: "left" }}>
        
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: "#4F46E5", letterSpacing: ".06em" }}>THE INTELLIGENT LMS PLATFORM</span>
        </div>

        <h2 className="lp-section-h2" style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 14px" }}>
          Everything your enterprise needs to<br />
          <span className="lp-purple-grad-text">train, measure, and scale</span>
        </h2>

        <p style={{ fontSize: 16, color: "#64748B", maxWidth: 680, margin: "0 0 36px", lineHeight: 1.55 }}>
          Explore how Train AI unifies personalized learner coaching, instructor cohort control, and executive skill forecasting in one platform.
        </p>

        {/* Interactive Feature Switcher Tabs */}
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8, marginBottom: 28 }}>
          {[
            { key: "intelligence", label: "Workforce Intelligence", icon: Gauge },
            { key: "ai_tutor", label: "AI Neural Coach", icon: Bot },
            { key: "cohorts", label: "Cohort & Studio", icon: GraduationCap },
            { key: "admin", label: "Enterprise Governance", icon: ShieldCheck },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeShowcaseTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveShowcaseTab(tab.key)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12,
                  border: isActive ? "1.5px solid #4F46E5" : "1px solid #E0E7FF",
                  background: isActive ? "#EEF2FF" : "#FFFFFF",
                  color: isActive ? "#4F46E5" : "#475569",
                  fontWeight: 800, fontSize: 13.5, cursor: "pointer", transition: "all .18s ease"
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Showcase Viewport */}
        <div style={{
          background: "#FFFFFF", borderRadius: 24, border: "1.5px solid #E0E7FF",
          padding: "36px 32px", boxShadow: "0 20px 45px -10px rgba(79,70,229,0.1)",
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 36, alignItems: "center"
        }}>
          {activeShowcaseTab === "intelligence" && (
            <>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#4F46E5", fontWeight: 800, fontSize: 12, marginBottom: 12 }}>
                  <Brain size={16} /> LIVE TALENT TELEMETRY
                </div>
                <h3 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", margin: "0 0 14px", lineHeight: 1.25 }}>
                  Real-time Skill Graphs &amp; Predictive Readiness
                </h3>
                <p style={{ fontSize: 14.5, color: "#64748B", lineHeight: 1.6, margin: "0 0 20px" }}>
                  Say goodbye to guessing employee skill coverage. Train AI computes live capability across technical domains, flagging operational bottlenecks before project kickoffs.
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5, color: "#334155" }}>
                  <li style={{ display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={16} color="#4F46E5" /> <span>Multi-dimensional skill graphs by department &amp; cohort</span></li>
                  <li style={{ display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={16} color="#4F46E5" /> <span>Automated certification and accredited credentials</span></li>
                  <li style={{ display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={16} color="#4F46E5" /> <span>Exportable compliance records ready for board review</span></li>
                </ul>
              </div>
              <div style={{ background: "#F8FAFC", borderRadius: 18, border: "1px solid #E0E7FF", padding: 22 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#6366F1", marginBottom: 10 }}>SKILL GAP RADAR</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ background: "#FFFFFF", padding: 12, borderRadius: 12, border: "1px solid #E0E7FF", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>GenAI Prompt Engineering</div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>42 learners certified</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#10B981", background: "#ECFDF5", padding: "3px 8px", borderRadius: 99 }}>Ready (92%)</span>
                  </div>
                  <div style={{ background: "#FFFFFF", padding: 12, borderRadius: 12, border: "1px solid #E0E7FF", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>Cloud Infrastructure &amp; Kubernetes</div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>18 learners developing</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#F59E0B", background: "#FEF3C7", padding: "3px 8px", borderRadius: 99 }}>In Progress (68%)</span>
                  </div>
                  <div style={{ background: "#FFFFFF", padding: 12, borderRadius: 12, border: "1px solid #E0E7FF", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>Enterprise Data Privacy (GDPR)</div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>98% organisation required</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#4F46E5", background: "#EEF2FF", padding: "3px 8px", borderRadius: 99 }}>Compliant (98%)</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeShowcaseTab === "ai_tutor" && (
            <>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#7C3AED", fontWeight: 800, fontSize: 12, marginBottom: 12 }}>
                  <Bot size={16} /> 24/7 ADAPTIVE COACHING
                </div>
                <h3 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", margin: "0 0 14px", lineHeight: 1.25 }}>
                  The AI Neural Coach: Zero Learning Bottlenecks
                </h3>
                <p style={{ fontSize: 14.5, color: "#64748B", lineHeight: 1.6, margin: "0 0 20px" }}>
                  Every learner has a dedicated AI mentor that breaks down complex code snippets, explains intricate compliance laws, and generates custom revision flashcards on demand.
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5, color: "#334155" }}>
                  <li style={{ display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={16} color="#7C3AED" /> <span>Conversational AI tutor grounded in your course materials</span></li>
                  <li style={{ display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={16} color="#7C3AED" /> <span>Instant dynamic quiz generation tailored to weak points</span></li>
                  <li style={{ display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={16} color="#7C3AED" /> <span>Real-time code debugging &amp; step-by-step guidance</span></li>
                </ul>
              </div>
              <div style={{ background: "#F8FAFC", borderRadius: 18, border: "1px solid #E0E7FF", padding: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#7C3AED", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Bot size={16} /></div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>AI Coach Response</span>
                </div>
                <div style={{ background: "#FFFFFF", padding: 14, borderRadius: 14, border: "1px solid #E0E7FF", fontSize: 13, color: "#334155", lineHeight: 1.5, marginBottom: 12 }}>
                  "Great question! In this module, the <code>useCallback</code> hook optimizes memory by memoizing your event handler across re-renders. Let's practice with a quick 2-question quiz!"
                </div>
                <button className="action-btn-primary" style={{ width: "100%", padding: "10px", borderRadius: 10, fontSize: 12.5, fontWeight: 800, border: "none", cursor: "pointer" }} onClick={() => handleNav("signin")}>
                  Start Practice Quiz →
                </button>
              </div>
            </>
          )}

          {activeShowcaseTab === "cohorts" && (
            <>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#4F46E5", fontWeight: 800, fontSize: 12, marginBottom: 12 }}>
                  <GraduationCap size={16} /> INSTRUCTOR STUDIO
                </div>
                <h3 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", margin: "0 0 14px", lineHeight: 1.25 }}>
                  Live Cohorts, Assessments &amp; Direct Mentorship
                </h3>
                <p style={{ fontSize: 14.5, color: "#64748B", lineHeight: 1.6, margin: "0 0 20px" }}>
                  Empower instructors with unified tools to schedule live sessions, review open-response assignments, provide 1-on-1 feedback, and broadcast community announcements.
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5, color: "#334155" }}>
                  <li style={{ display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={16} color="#4F46E5" /> <span>Cohort calendar scheduling with automated Google/Outlook sync</span></li>
                  <li style={{ display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={16} color="#4F46E5" /> <span>Direct learner messaging and grading queues</span></li>
                  <li style={{ display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={16} color="#4F46E5" /> <span>Peer study groups &amp; discussion boards</span></li>
                </ul>
              </div>
              <div style={{ background: "#F8FAFC", borderRadius: 18, border: "1px solid #E0E7FF", padding: 22 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#4F46E5", marginBottom: 10 }}>ACTIVE COHORTS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ background: "#FFFFFF", padding: 12, borderRadius: 12, border: "1px solid #E0E7FF" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>AI Engineers Cohort Q3</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#4F46E5" }}>24 Learners</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 4 }}>Next session: Thursday, 15:00 UTC</div>
                  </div>
                  <div style={{ background: "#FFFFFF", padding: 12, borderRadius: 12, border: "1px solid #E0E7FF" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>Executive Cybersecurity 2026</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#4F46E5" }}>16 Leaders</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 4 }}>Next session: Friday, 11:00 UTC</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeShowcaseTab === "admin" && (
            <>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#10B981", fontWeight: 800, fontSize: 12, marginBottom: 12 }}>
                  <ShieldCheck size={16} /> ENTERPRISE SCALE &amp; SECURITY
                </div>
                <h3 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", margin: "0 0 14px", lineHeight: 1.25 }}>
                  Enterprise Multi-Tenancy, SSO &amp; Compliance
                </h3>
                <p style={{ fontSize: 14.5, color: "#64748B", lineHeight: 1.6, margin: "0 0 20px" }}>
                  Built for enterprise IT standards: automated SCIM provisioning, SAML/SSO integration, custom branding, and granular role permissions across subsidiaries.
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5, color: "#334155" }}>
                  <li style={{ display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={16} color="#10B981" /> <span>SAML 2.0 / Okta / Azure AD Single Sign-On</span></li>
                  <li style={{ display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={16} color="#10B981" /> <span>Granular row-level permissions &amp; sub-organization tenants</span></li>
                  <li style={{ display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={16} color="#10B981" /> <span>Automated CSV / API bulk onboarding</span></li>
                </ul>
              </div>
              <div style={{ background: "#F8FAFC", borderRadius: 18, border: "1px solid #E0E7FF", padding: 22 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#10B981", marginBottom: 10 }}>GOVERNANCE SNAPSHOT</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ background: "#FFFFFF", padding: 12, borderRadius: 12, border: "1px solid #E0E7FF", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>SAML 2.0 Single Sign-On</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#10B981" }}>Active</span>
                  </div>
                  <div style={{ background: "#FFFFFF", padding: 12, borderRadius: 12, border: "1px solid #E0E7FF", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>MFA Enforcement</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#10B981" }}>100% Enforced</span>
                  </div>
                  <div style={{ background: "#FFFFFF", padding: 12, borderRadius: 12, border: "1px solid #E0E7FF", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Immutable Audit Trail</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#4F46E5" }}>Streaming</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

      </section>

      {/* =========================================================================
          SECTION 3: HOW WE BUILD IT
          ========================================================================= */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "30px 24px 70px" }}>
        
        <div style={{ textAlign: "left", marginBottom: 20 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: "#4F46E5", letterSpacing: ".06em" }}>HOW WE BUILD IT</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18, textAlign: "left" }}>
          {HOW_WE_BUILD_IT.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="lp-card-hover" style={{ background: "#FFFFFF", padding: "24px 24px", borderRadius: 20, border: "1px solid #E0E7FF" }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  <Icon size={20} color="#4F46E5" />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>{item.title}</h3>
                <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.55 }}>{item.desc}</p>
              </div>
            );
          })}
        </div>

      </section>

      {/* =========================================================================
          SECTION 4: THE WORKFORCE INTELLIGENCE LAYER
          ========================================================================= */}
      <section id="intelligence" style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 70px", textAlign: "left" }}>
        
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: "#4F46E5", letterSpacing: ".06em" }}>THE WORKFORCE INTELLIGENCE LAYER</span>
        </div>

        <h2 className="lp-section-h2" style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 12px" }}>
          Understand what your people<br />can actually do
        </h2>

        <p style={{ fontSize: 15.5, color: "#64748B", maxWidth: 640, margin: "0 0 32px", lineHeight: 1.55 }}>
          Available to admins and managers as a live overview, the intelligence layer combines every signal into outputs you can act on — never completion alone.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          
          <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "28px 24px", borderRadius: 20, border: "1px solid #E0E7FF" }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Brain size={22} color="#4F46E5" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 8px" }}>AI Skill Graph</h3>
            <p style={{ fontSize: 13.5, color: "#64748B", margin: 0, lineHeight: 1.55 }}>
              A live view of capability across a learner, team or organisation — what skills exist, what is developing, where the gaps are, and how capability grows over time.
            </p>
          </div>

          <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "28px 24px", borderRadius: 20, border: "1px solid #E0E7FF" }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Gauge size={22} color="#7C3AED" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 8px" }}>Workforce Readiness Score</h3>
            <p style={{ fontSize: 13.5, color: "#64748B", margin: 0, lineHeight: 1.55 }}>
              One readiness indicator per team, function and organisation, so leadership can answer: are we ready, which team is strongest, which team needs support now?
            </p>
          </div>

          <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "28px 24px", borderRadius: 20, border: "1px solid #E0E7FF" }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <BarChart3 size={22} color="#4F46E5" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 8px" }}>Intelligence Dashboard</h3>
            <p style={{ fontSize: 13.5, color: "#64748B", margin: 0, lineHeight: 1.55 }}>
              A summary view built for decisions: skill gaps by department, readiness by team, progress and activity trends, plus high-level organisational insights.
            </p>
          </div>

        </div>

      </section>

      {/* =========================================================================
          SECTION 5: SIGNALS FEEDING THE MODEL & THE LEARNER APP
          ========================================================================= */}
      <section id="learners" style={{ maxWidth: 1180, margin: "0 auto", padding: "30px 24px 70px" }}>
        
        {/* Signals Pill Bar */}
        <div style={{ background: "#FFFFFF", padding: "22px 26px", borderRadius: 20, border: "1px solid #E0E7FF", marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#6366F1", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12, textAlign: "left" }}>
            SIGNALS FEEDING THE INTELLIGENCE ENGINE
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {SIGNALS.map((sig) => (
              <span key={sig} className="lp-pill-hover" style={{ background: "#EEF2FF", color: "#4F46E5", fontSize: 12, fontWeight: 800, padding: "7px 16px", borderRadius: 99, border: "1px solid #C7D2FE" }}>
                {sig}
              </span>
            ))}
          </div>
        </div>

        {/* The Learner App Grid */}
        <div style={{ textAlign: "left", marginBottom: 12 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: "#4F46E5", letterSpacing: ".06em" }}>THE LEARNER EXPERIENCE</span>
        </div>

        <h2 className="lp-section-h2" style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 12px", textAlign: "left" }}>
          Four places. Zero<br />confusion.
        </h2>

        <p style={{ fontSize: 15.5, color: "#64748B", maxWidth: 640, margin: "0 0 36px", lineHeight: 1.55, textAlign: "left" }}>
          Learners get a focused workspace with intuitive navigation: Home, AI Neural Tutor, Courses, and Community.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 32, alignItems: "center" }}>
          
          {/* 2x2 Feature Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18, textAlign: "left" }}>
            
            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: 22, borderRadius: 18, border: "1px solid #E0E7FF" }}>
              <Home size={20} color="#4F46E5" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>Home</h3>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                Current course progress, active cohorts and an AI insight summary — the learner always knows the next action.
              </p>
            </div>

            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: 22, borderRadius: 18, border: "1px solid #E0E7FF" }}>
              <Bot size={20} color="#7C3AED" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>AI Coach</h3>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                Three tools: AI Coach for questions, AI Insights for strengths and gaps, and an AI Quiz Generator for practice.
              </p>
            </div>

            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: 22, borderRadius: 18, border: "1px solid #E0E7FF" }}>
              <BookOpen size={20} color="#4F46E5" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>Courses</h3>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                Assigned paths, organisation courses and partner content, with structured modules and progress tracking.
              </p>
            </div>

            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: 22, borderRadius: 18, border: "1px solid #E0E7FF" }}>
              <Users size={20} color="#4F46E5" style={{ marginBottom: 12 }} />
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
              border: "1.5px solid #E0E7FF", padding: "24px 20px", boxShadow: "0 24px 50px -12px rgba(79,70,229,0.15)",
              textAlign: "left"
            }}>
              
              <div style={{ fontSize: 11, color: "#6366F1", fontWeight: 800, marginBottom: 2 }}>Welcome back, Amara</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", marginBottom: 18 }}>Continue learning</div>

              {/* Course Item */}
              <div style={{ background: "#F8FAFC", padding: 14, borderRadius: 14, border: "1px solid #E0E7FF", marginBottom: 14 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A", marginBottom: 2 }}>Data Protection &amp; Security</div>
                <div style={{ fontSize: 11, color: "#4F46E5", fontWeight: 800, marginBottom: 8 }}>Assigned • due in 5 days</div>
                <div style={{ height: 6, borderRadius: 99, background: "#EEF2FF", overflow: "hidden" }}>
                  <div style={{ width: "65%", height: "100%", background: "linear-gradient(90deg, #4F46E5, #7C3AED)", borderRadius: 99 }} />
                </div>
              </div>

              {/* AI Insight Card */}
              <div style={{ background: "#EEF2FF", padding: 14, borderRadius: 14, border: "1px solid #C7D2FE", marginBottom: 14 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: "#4F46E5", letterSpacing: ".04em", marginBottom: 4 }}>AI INSIGHTS</div>
                <div style={{ fontSize: 12.5, color: "#1E1B4B", lineHeight: 1.45, fontWeight: 600 }}>
                  Strong on process knowledge. Practice risk assessment next.
                </div>
              </div>

              {/* Cohort session */}
              <div style={{ background: "#F8FAFC", padding: 14, borderRadius: 14, border: "1px solid #E0E7FF" }}>
                <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>Cohort Live Masterclass</div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>Thursday • 15:00 UTC</div>
              </div>

            </div>
          </div>

        </div>

      </section>

      {/* =========================================================================
          SECTION 6: THE ORGANISATION APP (Interactive 3 Views)
          ========================================================================= */}
      <section id="organisation" style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 70px", textAlign: "left" }}>
        
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: "#4F46E5", letterSpacing: ".06em" }}>THE ORGANISATION APP</span>
        </div>

        <h2 className="lp-section-h2" style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 12px" }}>
          One workspace, three views
        </h2>

        <p style={{ fontSize: 15.5, color: "#64748B", maxWidth: 680, margin: "0 0 36px", lineHeight: 1.55 }}>
          Instructors, managers and admins work in the same organisation app. Each person sees only the view their role allows — no separate disjointed systems to maintain.
        </p>

        {/* 3 Column Role Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, marginBottom: 20 }}>
          
          {/* Instructor View */}
          <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: 26, borderRadius: 20, border: "1px solid #E0E7FF", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <GraduationCap size={18} color="#4F46E5" />
              <span style={{ fontSize: 11, fontWeight: 800, color: "#4F46E5", letterSpacing: ".05em" }}>INSTRUCTOR VIEW</span>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 16px" }}>Run programmes, not spreadsheets</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "#475569" }}>
              <li style={{ display: "flex", gap: 8 }}>• <span>Cohort creation, scheduling and adjustment</span></li>
              <li style={{ display: "flex", gap: 8 }}>• <span>Session materials and resource library</span></li>
              <li style={{ display: "flex", gap: 8 }}>• <span>Assessment creation and grading queues</span></li>
              <li style={{ display: "flex", gap: 8 }}>• <span>Progress monitoring by course and module</span></li>
              <li style={{ display: "flex", gap: 8 }}>• <span>Direct learner messaging and feedback notes</span></li>
            </ul>
          </div>

          {/* Manager View */}
          <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: 26, borderRadius: 20, border: "1px solid #E0E7FF", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <TrendingUp size={18} color="#7C3AED" />
              <span style={{ fontSize: 11, fontWeight: 800, color: "#7C3AED", letterSpacing: ".05em" }}>MANAGER VIEW</span>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 16px" }}>See who is ready and who needs support</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "#475569" }}>
              <li style={{ display: "flex", gap: 8 }}>• <span>Direct report learning progress</span></li>
              <li style={{ display: "flex", gap: 8 }}>• <span>Department readiness score index</span></li>
              <li style={{ display: "flex", gap: 8 }}>• <span>Team skill snapshot &amp; gaps</span></li>
              <li style={{ display: "flex", gap: 8 }}>• <span>Department coaching notes &amp; nudges</span></li>
              <li style={{ display: "flex", gap: 8 }}>• <span>1-click reminder broadcasts</span></li>
            </ul>
          </div>

          {/* Admin View */}
          <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: 26, borderRadius: 20, border: "1px solid #E0E7FF", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <ShieldCheck size={18} color="#4F46E5" />
              <span style={{ fontSize: 11, fontWeight: 800, color: "#4F46E5", letterSpacing: ".05em" }}>ADMIN VIEW</span>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 16px" }}>Manage learning at scale</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "#475569" }}>
              <li style={{ display: "flex", gap: 8 }}>• <span>Bulk onboarding and SCIM provisioning</span></li>
              <li style={{ display: "flex", gap: 8 }}>• <span>Learning track and course assignment</span></li>
              <li style={{ display: "flex", gap: 8 }}>• <span>Compliance tracking and audit logs</span></li>
              <li style={{ display: "flex", gap: 8 }}>• <span>Certificate settings &amp; accreditation</span></li>
              <li style={{ display: "flex", gap: 8 }}>• <span>SAML SSO, API keys, and export controls</span></li>
            </ul>
          </div>

        </div>

      </section>

      {/* =========================================================================
          SECTION 7: HOW IT WORKS (Connected 3-Step Journey)
          ========================================================================= */}
      <section id="how-it-works" style={{ maxWidth: 1180, margin: "0 auto", padding: "50px 24px 70px", textAlign: "center" }}>
        
        <h2 className="lp-section-h2" style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 10px" }}>
          How It Works
        </h2>
        <p style={{ fontSize: 16, color: "#64748B", maxWidth: 540, margin: "0 auto 44px" }}>
          Move from initial onboarding to measurable workforce capability
        </p>

        {/* 3 Step Connected Grid */}
        <div style={{ position: "relative" }}>
          
          {/* Background Connecting Line (Desktop) */}
          <div className="lp-steps-connector" style={{
            position: "absolute", top: 38, left: "15%", right: "15%", height: 3,
            background: "linear-gradient(90deg, #4F46E5 0%, #7C3AED 50%, #10B981 100%)",
            zIndex: 0
          }} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, textAlign: "left", position: "relative", zIndex: 1 }}>
            
            {/* Step 1 */}
            <div className="lp-step-card" style={{ background: "#FFFFFF", borderRadius: 22, padding: "34px 28px", border: "1.5px solid #E0E7FF", position: "relative" }}>
              <div style={{ position: "absolute", top: -14, left: 24, width: 30, height: 30, borderRadius: "50%", background: "#4F46E5", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, boxShadow: "0 4px 12px rgba(79,70,229,0.4)" }}>
                1
              </div>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #4F46E5, #6366F1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", marginBottom: 20, boxShadow: "0 8px 18px rgba(79,70,229,0.3)" }}>
                <UserPlus size={22} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 10px" }}>Onboard Your People</h3>
              <p style={{ fontSize: 13.5, color: "#64748B", margin: 0, lineHeight: 1.55 }}>
                Invite learners, instructors and managers, then organise them by department, cohort and specific learning track.
              </p>
            </div>

            {/* Step 2 */}
            <div className="lp-step-card" style={{ background: "#FFFFFF", borderRadius: 22, padding: "34px 28px", border: "1.5px solid #E0E7FF", position: "relative" }}>
              <div style={{ position: "absolute", top: -14, left: 24, width: 30, height: 30, borderRadius: "50%", background: "#7C3AED", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, boxShadow: "0 4px 12px rgba(124,58,237,0.4)" }}>
                2
              </div>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #7C3AED, #9333EA)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", marginBottom: 20, boxShadow: "0 8px 18px rgba(124,58,237,0.3)" }}>
                <BookOpen size={22} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 10px" }}>Assign &amp; Develop</h3>
              <p style={{ fontSize: 13.5, color: "#64748B", margin: 0, lineHeight: 1.55 }}>
                Curate courses, assign required training, and accelerate mastery with the 24/7 AI Coach and expert mentors.
              </p>
            </div>

            {/* Step 3 */}
            <div className="lp-step-card" style={{ background: "#FFFFFF", borderRadius: 22, padding: "34px 28px", border: "1.5px solid #E0E7FF", position: "relative" }}>
              <div style={{ position: "absolute", top: -14, left: 24, width: 30, height: 30, borderRadius: "50%", background: "#10B981", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, boxShadow: "0 4px 12px rgba(16,185,129,0.4)" }}>
                3
              </div>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #10B981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", marginBottom: 20, boxShadow: "0 8px 18px rgba(16,185,129,0.3)" }}>
                <TrendingUp size={22} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 10px" }}>Measure Readiness</h3>
              <p style={{ fontSize: 13.5, color: "#64748B", margin: 0, lineHeight: 1.55 }}>
                Track skills, assessments, compliance, certificates and workforce capability from live leadership dashboards.
              </p>
            </div>

          </div>

        </div>

      </section>

      {/* =========================================================================
          SECTION 8: ENTERPRISE TRUST & SECURITY
          ========================================================================= */}
      <section id="trust" style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 70px", textAlign: "left" }}>
        
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: "#4F46E5", letterSpacing: ".06em" }}>ENTERPRISE TRUST</span>
        </div>

        <h2 className="lp-section-h2" style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 12px" }}>
          Trust is part of the product
        </h2>

        <p style={{ fontSize: 15.5, color: "#64748B", maxWidth: 640, margin: "0 0 36px", lineHeight: 1.55 }}>
          Permissions, privacy, auditability and data ownership are built in — not added later.
        </p>

        {/* 6 Grid Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {TRUST_FEATURES.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="lp-card-hover" style={{ background: "#FFFFFF", padding: "26px 24px", borderRadius: 20, border: "1px solid #E0E7FF" }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  <Icon size={19} color="#4F46E5" />
                </div>
                <h3 style={{ fontSize: 16.5, fontWeight: 800, color: "#0F172A", margin: "0 0 8px" }}>{item.title}</h3>
                <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.55 }}>{item.desc}</p>
              </div>
            );
          })}
        </div>

      </section>

      {/* =========================================================================
          SECTION 9: FAQ ACCORDION
          ========================================================================= */}
      <section id="faq" style={{ maxWidth: 840, margin: "0 auto", padding: "40px 24px 80px", textAlign: "left" }}>
        
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h2 className="lp-section-h2" style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 8px" }}>
            Frequently Asked Questions
          </h2>
          <p style={{ fontSize: 15.5, color: "#64748B", margin: 0 }}>
            Got questions? We've got answers. Find everything you need to know about Train AI.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openFaq === i;
            return (
              <div key={item.q} style={{ background: "#FFFFFF", border: "1px solid #E0E7FF", borderRadius: 16, padding: "4px 20px" }}>
                <button
                  type="button"
                  style={{
                    width: "100%", border: "none", background: "transparent", cursor: "pointer",
                    padding: "18px 0", display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: 12, fontSize: 15.5, fontWeight: 800, color: "#0F172A", textAlign: "left"
                  }}
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    size={18}
                    color="#6366F1"
                    style={{ flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s ease" }}
                  />
                </button>
                {isOpen && <p style={{ margin: "0 0 18px", fontSize: 14, color: "#64748B", lineHeight: 1.6 }}>{item.a}</p>}
              </div>
            );
          })}
        </div>

      </section>

      {/* =========================================================================
          SECTION 10: TRAIN AI BLUEISH-PURPLE PRE-FOOTER CTA
          ========================================================================= */}
      <section style={{ maxWidth: 1180, margin: "0 auto 64px", padding: "0 24px" }}>
        <div style={{
          background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 50%, #7C3AED 100%)",
          borderRadius: 28, padding: "58px 32px", textAlign: "center",
          color: "#FFFFFF", boxShadow: "0 24px 50px -12px rgba(79,70,229,0.35)", position: "relative", overflow: "hidden"
        }}>
          
          <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 900, letterSpacing: "-0.035em", margin: "0 0 14px", color: "#FFFFFF", lineHeight: 1.15 }}>
            Ready to Build a Workforce That Is Ready for<br />What's Next?
          </h2>
          
          <p style={{ fontSize: 16.5, color: "#EEF2FF", maxWidth: 640, margin: "0 auto 32px", lineHeight: 1.55 }}>
            Bring courses, cohorts, compliance and workforce intelligence together in one business LMS.
          </p>

          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginBottom: 30 }}>
            <button
              className="action-btn-primary"
              style={{ background: "#FFFFFF", color: "#4F46E5", fontWeight: 800, padding: "13px 28px", borderRadius: 99, border: "none", cursor: "pointer", fontSize: 14.5, boxShadow: "0 6px 18px rgba(0,0,0,0.15)", display: "inline-flex", alignItems: "center", gap: 6 }}
              onClick={() => handleNav("signin")}
            >
              Get Started <ArrowRight size={15} />
            </button>
            <button
              style={{ background: "rgba(255,255,255,0.15)", color: "#FFFFFF", fontWeight: 700, padding: "13px 26px", borderRadius: 99, border: "1.5px solid rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 14.5, backdropFilter: "blur(8px)" }}
              onClick={() => handleNav("signin")}
            >
              Sign In to Train AI
            </button>
            <button
              style={{ background: "transparent", color: "#FFFFFF", fontWeight: 700, padding: "13px 26px", borderRadius: 99, border: "1.5px solid rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 14.5 }}
              onClick={() => handleNav("demo")}
            >
              Request a demo
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap", fontSize: 13, color: "#EEF2FF", fontWeight: 700 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#34D399" }} />
              Role-based access
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#34D399" }} />
              Organisation-ready
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#34D399" }} />
              Secure learner data
            </span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 11: DARK ENTERPRISE FOOTER
          ========================================================================= */}
      <footer style={{ background: "#0B1120", color: "#FFFFFF", paddingTop: 50, paddingBottom: 40, borderTop: "1px solid #1E293B" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px" }}>
          
          {/* Newsletter Box */}
          <div style={{
            background: "#131C31", borderRadius: 22, padding: "36px 32px",
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
                  className="action-btn-primary"
                  style={{
                    border: "none", padding: "11px 22px", borderRadius: 99, fontWeight: 800, fontSize: 13.5,
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
              <span className="lp-footer-link" onClick={() => scrollToId("platform")}>Platform Features</span>
              <span className="lp-footer-link" onClick={() => scrollToId("how-it-works")}>How It Works</span>
              <span className="lp-footer-link" onClick={() => handleNav("signup")}>Sign Up</span>
              <span className="lp-footer-link" onClick={() => scrollToId("learners")}>Courses &amp; Tracks</span>
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
                <h3 style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", margin: 0 }}>Request a Live Demo</h3>
                <p style={{ fontSize: 13, color: "#64748B", margin: "2px 0 0" }}>Experience the workforce intelligence platform tailored to your team.</p>
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
                <button type="submit" disabled={submitting} className="action-btn-primary" style={styles.modalSubmitBtn}>
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
  header: { background: "rgba(255,255,255,0.94)", backdropFilter: "blur(12px)", borderBottom: "1px solid #E0E7FF", position: "sticky", top: 0, zIndex: 60 },
  headerInner: { maxWidth: 1180, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  signInBtn: { border: "none", background: "transparent", padding: "8px 12px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", color: "#334155" },
  requestDemoBtn: { padding: "8px 18px", borderRadius: 99, fontWeight: 700, fontSize: 13, cursor: "pointer" },
  getStartedBtn: { border: "none", padding: "8px 20px", borderRadius: 99, fontWeight: 800, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 14px rgba(79,70,229,0.3)" },
  startOrgBtn: { border: "none", padding: "12px 24px", borderRadius: 99, fontWeight: 800, fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 6px 18px rgba(79,70,229,0.35)" },
  requestDemoOutlineBtn: { padding: "12px 24px", borderRadius: 99, fontWeight: 700, fontSize: 14, cursor: "pointer" },
  heroPill: { background: "#FFFFFF", border: "1px solid #E0E7FF", padding: "8px 16px", borderRadius: 14, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 2px 8px rgba(79,70,229,0.04)" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 100 },
  modalCard: { background: "#FFFFFF", borderRadius: 20, padding: 26, maxWidth: 500, width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 30px 60px -24px rgba(15,23,42,.35)" },
  modalClose: { border: "none", background: "#F1F5F9", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex", color: "#64748B" },
  formInput: { width: "100%", border: "1.5px solid #E0E7FF", padding: "10px 14px", fontSize: 13, borderRadius: 10, outline: "none", boxSizing: "border-box", color: "#0F172A", background: "#F8FAFC" },
  formTextarea: { width: "100%", border: "1.5px solid #E0E7FF", padding: "10px 14px", fontSize: 13, borderRadius: 10, outline: "none", boxSizing: "border-box", color: "#0F172A", resize: "vertical", fontFamily: "inherit", background: "#F8FAFC" },
  modalSubmitBtn: { border: "none", padding: "12px 20px", borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 4px 14px rgba(79,70,229,0.3)" }
};
